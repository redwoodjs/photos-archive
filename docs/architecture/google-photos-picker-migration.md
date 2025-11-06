# Google Photos Picker API Migration

## Current State

The application uses the Google Photos Library API with the `photoslibrary.readonly` scope to access user photos:

- OAuth flow grants access to entire photo library
- Direct API calls to `photoslibrary.googleapis.com/v1/mediaItems` and `/albums`
- Access token stored in KV for ongoing access
- User authenticates once, app has continuous access to photos

## Problem

As of March 31, 2025, Google deprecated the `photoslibrary.readonly`, `photoslibrary.sharing`, and `photoslibrary` scopes. Applications can now only access content they have created, not user's existing photos.

Reference: https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/

## Proposed Solution

Migrate to the Google Photos Picker API, which requires explicit user selection for each photo access session.

### Architecture Overview

The Picker API uses a session-based flow:

1. Application creates a picker session via API, receives `pickerUri`
2. User is redirected to `pickerUri` (Google Photos interface)
3. User selects photos/albums
4. User is redirected back to application
5. Application polls session to confirm selection completion
6. Application retrieves selected media items
7. Application deletes session

### Key Differences from Current Implementation

| Current (Library API)                | New (Picker API)                    |
| ------------------------------------ | ----------------------------------- |
| One-time OAuth grant for all photos  | Session-based per-selection         |
| Direct API calls to list all items   | User explicitly selects items       |
| Continuous access via refresh token  | Transient access per session        |
| Backend fetches photos automatically | User interaction required each time |

### Authentication Changes

**Current scopes:**

- `https://www.googleapis.com/auth/photoslibrary.readonly`

**New scopes:**

- `https://www.googleapis.com/auth/photoslibrary.readonly.native` - For Picker API
- `https://www.googleapis.com/auth/photoslibrary.appendonly` - If app needs to upload

**OAuth flow remains** but scope changes to support Picker API functionality.

### API Flow

#### 1. Session Creation

```
POST https://photospicker.googleapis.com/v1/sessions
Authorization: Bearer {access_token}

Response:
{
  "id": "session_id",
  "pickerUri": "https://photos.google.com/picker/..."
}
```

#### 2. User Redirection

Redirect user to `pickerUri` with callback parameter.

#### 3. Callback Handling

User returns to application after selection. Application receives callback with session information.

#### 4. Session Polling

```
GET https://photospicker.googleapis.com/v1/sessions/{session_id}

Response:
{
  "id": "session_id",
  "mediaItemsSet": true
}
```

#### 5. Media Retrieval

```
GET https://photospicker.googleapis.com/v1/mediaItems?sessionId={session_id}&pageSize=100

Response:
{
  "mediaItems": [...]
}
```

#### 6. Session Cleanup

```
DELETE https://photospicker.googleapis.com/v1/sessions/{session_id}
```

### Data Model Changes

#### New Storage Requirements

```
picker_sessions:{sessionId} -> {
  sessionId: string;
  userId: string;
  pickerUri: string;
  createdAt: number;
  status: 'pending' | 'completed' | 'expired';
}

selected_media:{sessionId} -> {
  mediaItems: MediaItem[];
  selectedAt: number;
}
```

#### KV Storage Structure

```
tokens:default -> TokenData (existing)
picker_sessions:{sessionId} -> PickerSessionData
selected_media:{sessionId} -> SelectedMediaData
```

### UI/UX Changes

**Current flow:**

1. User clicks "Authenticate with Google"
2. User grants access once
3. App shows all photos automatically

**New flow:**

1. User clicks "Authenticate with Google" (OAuth)
2. User clicks "Select Photos"
3. User redirected to Google Photos Picker
4. User selects specific photos/albums
5. User confirms selection
6. Redirect back to app
7. App displays selected photos

**Key UX Impact:**

- User must select photos each time
- Cannot automatically display all user photos
- More privacy-focused but more user interaction required

### Implementation Strategy

Given the fundamental change in user experience, two approaches:

#### Option A: Session-based Photo Selection

- User explicitly selects photos each session
- App displays only selected photos
- No persistent library access
- Aligns with Google's privacy model

#### Option B: Cached Selection with Re-selection

- User selects photos via Picker
- App caches selected photo metadata
- When cache expires or user wants new photos, repeat selection
- Provides some continuity between sessions

## Implementation Tasks

### Phase 1: Authentication Update

1. Update OAuth scope from `photoslibrary.readonly` to `photoslibrary.readonly.native`
2. Verify OAuth flow still works with new scope
3. Update Google Cloud Console OAuth consent screen

### Phase 2: Picker Session Management

1. Implement `createPickerSession()` function
2. Implement `getPickerSession()` polling function
3. Implement `getSessionMediaItems()` retrieval function
4. Implement `deletePickerSession()` cleanup function
5. Add KV storage for picker sessions

### Phase 3: Backend Endpoints

1. Add `POST /api/picker/session` - Create picker session
2. Add `GET /api/picker/callback` - Handle picker redirect
3. Add `GET /api/picker/session/:id/status` - Check session status
4. Add `GET /api/picker/session/:id/media` - Get selected media
5. Remove/deprecate `GET /api/test-photos` endpoint

### Phase 4: Frontend Updates

1. Update Photos.tsx to use Picker flow
2. Add "Select Photos" button that triggers picker session
3. Add callback handler for returning from picker
4. Add polling logic to wait for selection completion
5. Update photo display to show selected items only

### Phase 5: Library Updates

1. Update `src/lib/auth.ts` with new scopes
2. Create new `src/lib/google-photos-picker.ts` for Picker API functions
3. Deprecate direct listing functions in `src/lib/google-photos.ts`
4. Keep `getMediaItem()` for fetching individual items if needed

### Phase 6: Cleanup

1. Remove deprecated endpoints
2. Remove unused Library API code
3. Update documentation
4. Test end-to-end flow

## Open Questions

1. How to handle session expiration and cleanup?
2. Should we cache selected photos, and if so, for how long?
3. Do we want to allow multiple selections to build up a collection?
4. How to communicate the UX change to users?

## Migration Impact

**Breaking Changes:**

- User can no longer browse entire photo library
- Application cannot automatically sync all photos
- More user interaction required for photo access

**Benefits:**

- Compliant with Google's updated privacy model
- User has explicit control over shared photos
- More secure and privacy-focused

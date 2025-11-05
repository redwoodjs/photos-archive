# Google Photos API 403 Scope Error Investigation

## Problem

Application fails with 403 error: "Request had insufficient authentication scopes"

## Initial Investigation

Examined authentication configuration in `src/lib/auth.ts`:

- Line 18 shows scope is set to: `https://www.googleapis.com/auth/photoslibrary.readonly`
- This scope is used during OAuth authentication in `getAuthUrl` function

## Root Cause

As of March 31, 2025, Google deprecated the following scopes for Photos Library API:

- `photoslibrary.readonly`
- `photoslibrary.sharing`
- `photoslibrary`

After this deprecation date, applications can only access content they have created themselves. This is a fundamental API change by Google that restricts third-party access to user photos.

## Current Situation

Today is November 5, 2025, which is after the deprecation date. The scope being used is no longer valid for accessing user photos.

## Possible Solutions

### Option 1: Application in Testing Mode

If the Google Cloud project is in testing mode:

- Add yourself as a test user in Google Cloud Console
- Test users might still have access during the testing phase
- This is not a long-term solution for production

### Option 2: Application in Production Mode

Move the application to production mode in Google Cloud Console. However, the deprecated scopes may still not work for accessing existing user photos.

### Option 3: Confirm API Limitations

The deprecation indicates that third-party applications can no longer read arbitrary user photos through the Photos Library API. This fundamentally breaks the intended functionality of this application.

## Solution: Migrate to Google Photos Picker API

Google introduced the Photos Picker API as a replacement for the deprecated Library API scopes. This API requires a fundamentally different approach:

### How Picker API Works

1. Application creates a picker session via API, receives `pickerUri`
2. User is redirected to Google Photos picker interface
3. User explicitly selects photos or albums they want to share
4. User confirms selection and is redirected back to application
5. Application polls session to check completion status
6. Application retrieves selected media items
7. Application cleans up session

### Key Changes Required

**Authentication:**

- Change scope from `photoslibrary.readonly` to `photoslibrary.readonly.native`

**Backend:**

- New `src/lib/google-photos-picker.ts` library for picker session management
- New endpoints: POST /api/picker/session, GET /api/picker/callback, GET /api/picker/session/:id/status, GET /api/picker/session/:id/media
- Session storage in KV for tracking picker sessions

**Frontend:**

- Replace automatic photo listing with "Select Photos" button
- Handle redirect to picker and callback
- Poll for selection completion
- Display only user-selected photos

**UX Impact:**

- User must select photos each time through Google's picker
- No automatic access to entire library
- More privacy-focused but requires more user interaction

### Implementation

Architecture documented in `docs/architecture/google-photos-picker-migration.md`
Implementation tasks created with 12 steps across OAuth updates, backend API, and frontend changes.

## Status

Investigation complete. Solution identified. Implementation approved and ready to proceed.

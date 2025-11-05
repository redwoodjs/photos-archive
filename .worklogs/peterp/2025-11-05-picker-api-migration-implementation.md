# Google Photos Picker API Migration - Implementation Summary

## What Changed

Migrated from deprecated Google Photos Library API to the new Google Photos Picker API due to Google's deprecation of `photoslibrary.readonly` scope on March 31, 2025.

## Files Modified

### Authentication

- **src/lib/auth.ts**
  - Changed OAuth scope from `photoslibrary.readonly` to `photospicker.mediaitems.readonly`
  - Added type safety for OAuth responses

### New Library

- **src/lib/google-photos-picker.ts** (NEW)
  - `createPickerSession()` - Creates a new picker session
  - `getPickerSession()` - Gets session status
  - `getSessionMediaItems()` - Retrieves selected photos
  - `deletePickerSession()` - Cleans up sessions
  - `pollSessionUntilReady()` - Helper for polling completion

### Backend API

- **src/worker.tsx**
  - Added `POST /api/picker/session` - Create picker session
  - Added `GET /api/picker/callback` - Handle picker redirect
  - Added `GET /api/picker/session/:id/status` - Check session status
  - Added `GET /api/picker/session/:id/media` - Get selected media
  - Session data stored in KV with TTL

### Frontend

- **src/app/pages/Photos.tsx**
  - Changed "Test API Connection" button to "Select Photos"
  - Added photo grid display for selected photos
  - Implemented callback handling and session polling
  - Displays photos with thumbnails and metadata

## New User Flow

1. User authenticates with Google (OAuth)
2. User clicks "Select Photos"
3. Redirected to Google Photos picker interface
4. User selects photos/albums
5. User confirms selection
6. Redirected back to app with session ID
7. App polls session until selection is ready
8. App fetches and displays selected photos

## Data Storage

### KV Storage Keys

- `tokens:default` - OAuth tokens (existing)
- `picker_session:{sessionId}` - Session metadata (TTL: 1 hour)
- `selected_media:{sessionId}` - Selected photos (TTL: 24 hours)

## Next Steps

### 1. Update Google Cloud Console

**New OAuth Scope Required:**

- **Old scope (deprecated):** `https://www.googleapis.com/auth/photoslibrary.readonly`
- **New scope (required):** `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`

**Step-by-step instructions:**

a. **Enable Google Photos Picker API:**

- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Select your project
- Navigate to **APIs & Services** > **Library**
- Search for "Google Photos Picker API"
- Click **Enable**

b. **Update OAuth Consent Screen:**

- Navigate to **APIs & Services** > **OAuth consent screen**
- Click **Edit App** button
- Click through to the **Scopes** section (or navigate directly to it)
- Click **Add or Remove Scopes**
- In the filter/search box, paste: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
- Check the box next to this scope (description: "See photos and videos you've selected")
- Remove the old scope `photoslibrary.readonly` if present
- Click **Update** at the bottom
- Click **Save and Continue** through remaining screens

c. **Verify Test Users (if app is in Testing mode):**

- Still in OAuth consent screen settings
- Check **Test users** section
- Ensure your email is added as a test user
- If not, click **Add Users** and add your email

d. **Re-authenticate to get new tokens:**

- Visit your app at `/auth/clear` to clear old tokens
- Visit `/auth/google` to start new OAuth flow
- During consent, verify you see the new permission request
- Complete the flow

### 2. Test the flow:

- Clear existing tokens: visit `/auth/clear`
- Authenticate: visit `/auth/google`
- Select photos: click "Select Photos" button
- Verify photos display after selection

### 3. Update redirect URI in picker session creation if needed (currently uses default callback)

## Breaking Changes

- Users can no longer browse entire photo library
- Application only displays explicitly selected photos
- Selection process required for each new set of photos
- More privacy-focused but requires more user interaction

## Architecture Documentation

See `docs/architecture/google-photos-picker-migration.md` for detailed architecture information.

## Issue: Scope Mismatch in Auth Check

### Problem

After migration, the `/api/test-photos` endpoint was still calling the old Google Photos Library API's `listAlbums` method. This failed with a 403 "insufficient authentication scopes" error because the OAuth scope was changed to `photospicker.mediaitems.readonly`, which only grants access to the Picker API, not the Library API.

### Solution

Updated `handleTestPhotos` in `worker.tsx` to only verify token existence without making calls to the old Google Photos Library API. The endpoint now:

- Checks for valid access token
- Returns success/failure based on authentication status
- Does not attempt to call deprecated Library API endpoints

### Files Changed

- `src/worker.tsx`: Removed `listAlbums` call and `googlePhotos` import from auth check endpoint

## Issue: Incorrect API Endpoint URLs

### Problem

When clicking "Select Photos", the application returned a 404 error. The error showed that `/v1/pickerSessions` was not found on `photoslibrary.googleapis.com`. The implementation was using incorrect base URL and endpoint paths for the Google Photos Picker API.

### Root Cause

The Google Photos Picker API has a separate base URL and different endpoint structure:

- **Incorrect**: `https://photoslibrary.googleapis.com/v1/pickerSessions`
- **Correct**: `https://photospicker.googleapis.com/v1/sessions`

### Solution

Updated all API endpoints in `google-photos-picker.ts`:

- Base URL: Changed from `photoslibrary.googleapis.com` to `photospicker.googleapis.com`
- Endpoint path: Changed from `/v1/pickerSessions` to `/v1/sessions`

Affected endpoints:

- `createPickerSession()` - Create new picker session
- `getPickerSession()` - Get session status
- `getSessionMediaItems()` - Retrieve selected media items
- `deletePickerSession()` - Clean up session

### Files Changed

- `src/lib/google-photos-picker.ts`: Updated all API endpoint URLs to use correct base URL and path structure

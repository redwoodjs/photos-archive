# Google Photos Library API Scope Deprecation

## Date
2025-11-07

## Problem
Attempted to integrate the Google Photos Library API to allow viewing user albums and their contents. Consistently received 403 "Request had insufficient authentication scopes" errors when calling the `listAlbums` endpoint, despite the OAuth token containing the required `photoslibrary.readonly` scope.

## Investigation

### Attempt 1: Missing Scope
Initial error showed the app was missing the `photoslibrary.readonly.appcreateddata` scope needed to list albums. This scope allows reading albums created by the app.

**Action**: Added `photoslibrary.readonly.appcreateddata` to auth scopes.
**Result**: Still got 403 errors. Albums listed were empty because they only showed app-created content, not user albums.

### Attempt 2: Broader Scope
User wanted to view albums they created manually, not just app-created albums. This requires broader library access.

**Action**: Changed scope from `photoslibrary.readonly.appcreateddata` to `photoslibrary.readonly` for full library read access.
**Result**: Still got 403 errors, despite token showing the correct scope.

### Attempt 3: Debugging Token Scopes
Added debug endpoint `/api/debug/token` to verify token contents and added logging to the library API calls.

**Findings**:
- Token correctly contained `photoslibrary.readonly` scope
- Token was being sent correctly to Google Photos API
- Google Photos Library API was enabled in Google Cloud Console
- OAuth consent screen was configured with the scope
- User had re-authenticated multiple times with the new scope
- API still returned 403 "insufficient authentication scopes"

### Root Cause Discovery
Searched for information about Google Photos API scope restrictions and discovered that Google deprecated several scopes on **March 31, 2025**:

- `photoslibrary.readonly` - Read all user media
- `photoslibrary.sharing` - Share albums  
- `photoslibrary` - Full access

These deprecated scopes are no longer honored by the API, even if they appear in OAuth tokens and are listed in the Google Cloud Console.

## Available Scopes (Post-Deprecation)
The only remaining scopes that work are:

- `photoslibrary.readonly.appcreateddata` - Read app-created content only
- `photoslibrary.appendonly` - Create albums and upload photos
- `photoslibrary.edit.appcreateddata` - Edit app-created content
- `photospicker.mediaitems.readonly` - Access user-selected photos via Picker API

## Solution
Removed the Library API integration entirely since the original use case (browsing user albums and photos) is no longer possible through the Google Photos Library API.

**Changes made**:
1. Deleted `/src/app/pages/Library.tsx`
2. Deleted `/src/lib/google-photos-library.ts`
3. Deleted `/docs/architecture/library-api-integration.md`
4. Removed library-related routes and handlers from worker
5. Removed debug token endpoint
6. Reverted auth scopes to only `photospicker.mediaitems.readonly`
7. Removed unused library and debug imports

## Alternative Approaches
The application now relies solely on the Picker API at `/photos`, which:
- Lets users explicitly select photos to share with the app
- Provides temporary access to selected media items
- Works with current Google Photos API restrictions
- Follows Google's recommended approach for photo selection

## Lessons Learned
1. Google significantly restricted the Photos Library API in March 2025
2. Deprecated scopes may still appear in tokens but are not honored by the API
3. Current API design strongly favors user-initiated sharing (Picker) over broad library access
4. Always check for recent API deprecations when integrating with Google services
5. 403 errors with "correct" scopes can indicate the scope itself is deprecated

## References
- Google Photos API Updates: https://developers.google.com/photos/support/updates
- Authorization Guide: https://developers.google.com/photos/library/legacy/guides/authorization


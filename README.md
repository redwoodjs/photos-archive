# Photos Archive

A RedwoodSDK application that integrates with Google Photos using the Photos Picker API. Users authenticate with Google OAuth2, select specific photos or albums they want to backup, and view them within the application.

## Setup

### Google OAuth Credentials

This application uses Google OAuth2 to authenticate with Google Photos Picker API. You need to create OAuth credentials in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Photos Picker API:
   - Navigate to **APIs & Services** > **Library**
   - Search for "Google Photos Picker API"
   - Click **Enable**
4. Configure the OAuth consent screen:
   - Navigate to **APIs & Services** > **OAuth consent screen**
   - Select **External** (unless you have a Google Workspace account)
   - Fill in the required app information:
     - App name: Your app name
     - User support email: Your email
     - Developer contact information: Your email
   - Click **Save and Continue**
   - Under **Scopes**, click **Add or Remove Scopes**
   - Search for and add: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
     - This scope allows users to select specific photos to share with your app
     - Alternative description in UI: "See photos and videos you've selected"
   - Click **Update** then **Save and Continue**
   - Add test users if your app is in testing mode (add your own email)
   - Click **Save and Continue**
5. Create OAuth 2.0 credentials:
   - Navigate to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: Add `http://localhost:5173/auth/callback` (for local development)
   - Click **Create**
6. Copy your credentials:
   - **Client ID**: Displayed immediately after creation
   - **Client Secret**: Click **Show** to reveal it

**Note:** This app uses the Google Photos Picker API, which requires users to explicitly select photos to share rather than granting access to their entire library. This is a privacy-focused API introduced after Google deprecated broader library access scopes in March 2025.

### Environment Variables

1. Copy the example environment file:

   ```shell
   cp .env.example .env
   ```

2. Edit `.env` and add your Google OAuth credentials:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
   ```

## Running the dev server

```shell
npm run dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:5173/`). You should see a "Hello World" message in your browser.

## Troubleshooting

### Error: "Request had insufficient authentication scopes" (403)

This error occurs when your tokens don't have the required Google Photos Picker API scope. Follow these steps:

1. **Verify APIs are enabled:**

   - Go to [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Enabled APIs & services
   - Confirm "Google Photos Picker API" is listed
   - If not, go to Library, search for it, and enable it

2. **Verify OAuth consent screen configuration:**

   - Go to [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > OAuth consent screen
   - Click on your app
   - Go to the **Scopes** section
   - Verify that `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` is listed
   - If not present, click **Add or Remove Scopes**, search for and add it, then **Save**

3. **Revoke existing access:**

   - Visit `/auth/revoke` in your browser (this revokes Google access and clears local tokens)
   - Alternatively, manually revoke access at: [Google Account Security](https://myaccount.google.com/permissions) > find your app > Remove Access

4. **Re-authenticate:**
   - Visit `/auth/google` and complete the OAuth flow
   - Make sure you see the permission request during consent
   - If the permission doesn't appear, the OAuth consent screen isn't configured correctly

**Important:** Tokens issued before the scope was added to the consent screen won't work. You must revoke and re-authenticate after configuring the consent screen.

### How the Photo Picker Works

This application uses the Google Photos Picker API, which works differently from traditional library access:

1. User authenticates with Google (grants permission to use picker)
2. User clicks "Select Photos" in the app
3. User is redirected to Google Photos picker interface
4. User explicitly selects photos or albums to share
5. User is redirected back to the app
6. App displays only the selected photos

This approach gives users explicit control over which photos they share with your application.

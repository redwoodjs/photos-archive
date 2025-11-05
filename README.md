# RedwoodSDK Minimal Starter

This is the starter project for RedwoodSDK. It's a template designed to get you up and running as quickly as possible.

Create your new project:

```shell
npx create-rwsdk my-project-name
cd my-project-name
npm install
```

## Setup

### Google OAuth Credentials

This application uses Google OAuth2 to authenticate with Google Photos API. You need to create OAuth credentials in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Photos Library API:
   - Navigate to **APIs & Services** > **Library**
   - Search for "Google Photos Library API"
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
   - Search for and add: `https://www.googleapis.com/auth/photoslibrary.readonly`
   - Click **Update** then **Save and Continue**
   - Add test users if your app is in testing mode (your own email)
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

This error occurs when your tokens don't have the required Google Photos Library API scope. Follow these steps:

1. **Verify OAuth consent screen configuration:**

   - Go to [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > OAuth consent screen
   - Click on your app
   - Go to the **Scopes** section
   - Verify that `https://www.googleapis.com/auth/photoslibrary.readonly` is listed
   - If not present, click **Add or Remove Scopes**, search for and add it, then **Save**

2. **Revoke existing access:**

   - Visit `/auth/revoke` in your browser (this revokes Google access and clears local tokens)
   - Alternatively, manually revoke access at: [Google Account Security](https://myaccount.google.com/permissions) > find your app > Remove Access

3. **Re-authenticate:**
   - Visit `/auth/google` and complete the OAuth flow
   - Make sure you see the Google Photos Library permission request during consent
   - If the permission doesn't appear, the OAuth consent screen isn't configured correctly

**Important:** Tokens issued before the scope was added to the consent screen won't work. You must revoke and re-authenticate after configuring the consent screen.

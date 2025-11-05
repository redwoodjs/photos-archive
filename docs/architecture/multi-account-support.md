# Multi-Account Google Photos Support

## Current State

The application currently supports a single Google account:

- Authentication uses a hardcoded `userId = "default"`
- Tokens are stored in KV with key `tokens:default`
- Each new authentication overwrites the previous account's tokens
- No way to identify which Google account is authenticated

## Proposed Changes

### Architecture Overview

Support multiple Google accounts by:

1. **Account Identification**: Use Google account email as the unique identifier for each account
2. **Token Storage**: Store tokens per account using key pattern `tokens:${accountEmail}`
3. **Account Management**: Maintain a list of connected accounts, stored separately from tokens
4. **Multi-Account Sync**: Sync photos from all connected accounts

### Data Model

#### KV Storage Structure

```
tokens:${accountEmail} -> TokenData (JSON)
accounts:list -> string[] (JSON array of account emails)
```

#### TokenData (unchanged)

```typescript
interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
}
```

### Authentication Flow Changes

1. **Account Email Retrieval**: After token exchange, fetch user info from Google OAuth to get the account email
2. **Account Addition**: New accounts are added to the accounts list instead of replacing the default account
3. **Duplicate Prevention**: Check if account already exists before adding

### API Changes

#### New Endpoints

- `GET /api/accounts` - List all connected accounts
- `DELETE /api/accounts/:email` - Remove an account

#### Modified Endpoints

- `POST /auth/google` - Add account parameter to identify which account is being added
- `GET /api/test-photos` - Accept optional account parameter, or return data from all accounts

### Sync Logic Changes

- Iterate over all accounts in the accounts list
- Fetch photos from each account independently
- Merge results, possibly tagging with account source

## Implementation Plan

1. Add Google userinfo API call to get account email after token exchange
2. Update token storage functions to use account email instead of hardcoded userId
3. Add account list management functions (add, list, remove accounts)
4. Modify auth callback to add accounts instead of replacing
5. Update API endpoints to support account selection
6. Update UI to show/manage multiple accounts
7. Update sync logic to iterate over all accounts

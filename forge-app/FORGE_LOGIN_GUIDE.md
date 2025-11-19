# Forge Login Guide

## Issue: Authentication Failed

If you're getting "We couldn't log you in with those credentials", follow these steps:

## Step 1: Create a New API Token

1. **Go to Atlassian API Tokens page:**
   - Visit: https://id.atlassian.com/manage/api-tokens
   - **IMPORTANT**: Make sure you're logged in with `solutions.atg@amzur.com`

2. **Create a new API token:**
   - Click **"Create API token"**
   - Give it a label (e.g., "Forge CLI - BRD Time Tracker")
   - Click **"Create"**
   - **Copy the token immediately** (you won't be able to see it again!)

3. **Important Notes:**
   - The token must be created while logged in as `solutions.atg@amzur.com`
   - If you create it with a different account, it won't work
   - Tokens look like: `ATATT3xFfGF0...` (long string)

## Step 2: Login to Forge CLI

Run the login command again:

```bash
forge login
```

When prompted:
1. **Email**: Enter `solutions.atg@amzur.com`
2. **API Token**: Paste the token you just created

## Step 3: Verify Login

After successful login, you should see a success message. Then you can proceed with:

```bash
forge register
```

## Troubleshooting

### "Invalid credentials" error

**Possible causes:**
1. **Wrong email**: Make sure you're using `solutions.atg@amzur.com` (not the pre-filled one)
2. **Token created for different account**: The API token must be created while logged in as `solutions.atg@amzur.com`
3. **Expired token**: Create a new token
4. **Token copied incorrectly**: Make sure there are no extra spaces when pasting

### "Token not found" error

- Make sure you copied the entire token
- Tokens are long (usually 50+ characters)
- Don't include any spaces or line breaks

### Still having issues?

1. **Check your Atlassian account:**
   - Go to https://id.atlassian.com
   - Make sure you're logged in as `solutions.atg@amzur.com`
   - Verify you have developer access

2. **Create a fresh token:**
   - Delete old tokens if needed
   - Create a new one specifically for Forge CLI

3. **Try verbose mode:**
   ```bash
   forge login --verbose
   ```
   This will show more detailed error messages

## Next Steps After Login

Once logged in successfully:

1. **Register the app:**
   ```bash
   forge register
   ```
   - Enter app name: "BRD Time Tracker"

2. **Deploy:**
   ```bash
   forge deploy
   ```

3. **Install on Jira:**
   ```bash
   forge install
   ```


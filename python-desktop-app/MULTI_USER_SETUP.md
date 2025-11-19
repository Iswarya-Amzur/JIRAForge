# Multi-User Setup Guide

## Problem: "You don't have access to this app"

When trying to log in with a different Atlassian account, you may see:
> "You don't have access to this app. This application is in development - only the owner of this application may grant it access to their account."

## Why This Happens

Atlassian OAuth apps start in **"Development"** mode, which restricts access to:
- The app owner (the person who created the app)
- Collaborators/developers explicitly added to the app

This is a security feature to prevent unauthorized access during development.

## Solutions

### Solution 1: Enable Sharing (Recommended for Teams)

**Best for:** Internal teams, small groups, controlled distribution

1. Go to **https://developer.atlassian.com/console/myapps/**
2. Click on your OAuth app
3. Go to **"Distribution"** in the left sidebar
4. In the **"Edit distribution controls"** section:
   
   **a. Change Distribution Status:**
   - Select **"Sharing"** (currently "Not sharing" is selected)
   
   **b. Fill Required Fields:**
   - **Vendor name***: Enter your name or company (e.g., "Your Company")
     - Check "Use your own name" to use your Atlassian account name
   - **Privacy policy***: Enter a URL (e.g., `https://example.com/privacy` for testing)
   - **Customer support contact***: Enter email or URL (e.g., `support@yourcompany.com`)
   - **Terms of service** (Optional): Enter URL if you have one
   
   **c. Personal Data Declaration:**
   - Select **"No"** (unless you store personal data in your own systems)
   - For this time tracker, "No" is correct since you only store screenshots

5. Click **"Save changes"**
6. The app status will change to **"Sharing"**
7. **Any Atlassian user** can now authorize your app!

**Pros:**
- ✅ Quick and easy (no app review needed)
- ✅ Perfect for internal use
- ✅ Users can authorize immediately
- ✅ No need to add users manually

**Cons:**
- ❌ Requires privacy policy URL (can use placeholder for internal use)
- ❌ Not suitable for public marketplace distribution

### Solution 2: Publish the App (For Public Marketplace)

**Best for:** Public distribution, many users, production apps

1. Go to **https://developer.atlassian.com/console/myapps/**
2. Click on your OAuth app
3. Go to **"Distribution"** or **"Publish"** section
4. Click **"Publish"** or **"Request publication"**
5. Fill out required information:
   - App description
   - Privacy policy URL (required for public apps)
   - Support/help URL
   - Terms of service (if applicable)
6. Submit for Atlassian review
7. Wait for approval (typically 1-3 business days)
8. Once published, **any Atlassian user** can authorize your app

**Pros:**
- ✅ No need to add users manually
- ✅ Any Atlassian user can use it
- ✅ Professional/public distribution

**Cons:**
- ❌ Requires app review process
- ❌ May need privacy policy and support pages
- ❌ Takes time to get approved

### Solution 3: Keep in Development (Testing Only)

**Best for:** Quick testing, single-user development

- Use the app owner's account for testing
- Or add specific test users as collaborators
- Not suitable for production use

## How the App Handles Multiple Users

The Python desktop app is **already designed for multiple users**:

1. **User Creation:** Each Atlassian account that logs in gets a separate user record in Supabase
2. **Data Isolation:** Screenshots and data are stored per user (using `user_id`)
3. **Row-Level Security:** Supabase RLS ensures users can only see their own data
4. **Storage:** Each user's screenshots are stored in separate folders: `user_id/screenshot.png`

## Verification

After adding users as collaborators or publishing:

1. Have the new user try to log in
2. They should see the authorization page (not the "no access" error)
3. After authorization, they'll have their own user account in Supabase
4. Their screenshots will be stored separately

## Current Status

Based on your verification script:
- ✅ **1 user** currently in the system: `solutions.atg@amzur.com`
- ✅ **5 screenshots** saved for that user
- ✅ System is ready for multiple users (once sharing is enabled in Distribution settings)

## Quick Steps to Enable Sharing

1. Go to: https://developer.atlassian.com/console/myapps/
2. Click your app: **BRD Time Tracker Desktop App**
3. Go to **Distribution** in the left sidebar
4. In **"Edit distribution controls"**:
   - Select **"Sharing"** radio button
   - Enter **Vendor name** (e.g., "Your Company")
   - Enter **Privacy policy URL** (e.g., `https://example.com/privacy`)
   - Enter **Customer support contact** (e.g., `support@yourcompany.com`)
   - Set **Personal Data Declaration** to **"No"**
5. Click **"Save changes"**
6. Done! Any Atlassian user can now log in!

---

**Need Help?** If you're unsure which option to choose:
- **Internal team or controlled distribution:** Use Solution 1 (Enable Sharing)
- **Public marketplace distribution:** Use Solution 2 (Publish)
- **Just testing with your own account:** Keep it as "Not sharing" (current state)



# OAuth Flow - Corrected Understanding

## Summary

**✅ CONFIRMED:** Atlassian OAuth **DOES** show a site selector during authorization where the user picks which Jira instance to grant access to.

---

## Complete OAuth Flow (Actual Behavior)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User Clicks "Login with Atlassian"                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Atlassian Login Page                                │
│                                                             │
│    ┌─────────────────────────────────────┐                 │
│    │ Sign in to Atlassian                │                 │
│    │                                     │                 │
│    │ Email: _______________               │                 │
│    │ Password: _______________            │                 │
│    │                                     │                 │
│    │        [Continue]                   │                 │
│    └─────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: ✅ SITE SELECTOR (This is what we missed!)          │
│                                                             │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ BRD Time Tracker Desktop App is requesting          │ │
│    │ access to your Atlassian account.                   │ │
│    │                                                     │ │
│    │ Use app on *                                        │ │
│    │ ┌─────────────────────────────────┐                │ │
│    │ │ Choose a site                ▼  │                │ │
│    │ └─────────────────────────────────┘                │ │
│    │   ├─ amzur-team-pq9sjopg.atlassian.net            │ │
│    │   └─ amzur.atlassian.net                          │ │
│    │                                                     │ │
│    │ Update                                              │ │
│    │   › jira-work                                       │ │
│    │                                                     │ │
│    │ In User, it would like to:                         │ │
│    │ View                                                │ │
│    │   › me                                              │ │
│    │                                                     │ │
│    │    [Cancel]        [Accept]                         │ │
│    └─────────────────────────────────────────────────────┘ │
│                                                             │
│    ✅ USER PICKS SITE HERE                                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: User Clicks "Accept"                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Redirect Back to Your App                           │
│    http://localhost:7777/auth/callback?code=ABC123...       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Exchange Code for Tokens                            │
│    POST https://auth.atlassian.com/oauth/token             │
│                                                             │
│    Response: {                                              │
│      access_token: "...",                                   │
│      refresh_token: "...",                                  │
│      expires_in: 3600                                       │
│    }                                                        │
│                                                             │
│    ⚠️ NOTE: Token is scoped to the site user selected      │
│    ❌ BUT: Response doesn't include cloudId                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Get Site Information (accessible-resources API)     │
│    GET https://api.atlassian.com/oauth/token/              │
│        accessible-resources                                 │
│    Authorization: Bearer <access_token>                     │
│                                                             │
│    Response: [                                              │
│      {                                                      │
│        "id": "abc-123-xyz",        ← This is cloudId       │
│        "url": "https://amzur-team-pq9sjopg.atlassian.net", │
│        "name": "Amzur Team",                               │
│        "scopes": ["read:jira-work", "write:jira-work"],    │
│        "avatarUrl": "https://..."                          │
│      }                                                      │
│    ]                                                        │
│                                                             │
│    ✅ Returns the site(s) user has access to               │
│    ✅ Usually returns the ONE site they selected           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: Your App Uses the CloudID                           │
│    - Store cloudId for future API calls                    │
│    - Register organization in database                      │
│    - Start tracking time                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Insights

### 1. **User Already Picks Site During OAuth**

✅ **True:** The OAuth authorization page shows a dropdown where user selects which Jira site to grant access to.

✅ **Benefit:** You don't need to build a separate site selector UI - user already chose!

### 2. **Token is Scoped to Selected Site**

✅ **The access token is tied to the site user selected**

Example:
- User selects: `amzur-team-pq9sjopg.atlassian.net` during OAuth
- Token can only access: That specific Jira instance
- Cannot access: `amzur.atlassian.net` (the other site)

### 3. **You Still Need accessible-resources API**

❓ **Why?** If user already picked a site, why call the API?

**Reasons:**
1. **To get the cloudId** - Token response doesn't include it
2. **To get site metadata** - Name, URL, avatar, etc.
3. **To confirm which site** - User might have access to multiple

### 4. **What If User Has Multiple Sites?**

**Scenario A: User picks ONE site during OAuth**
```
OAuth Screen Shows:
├─ amzur-team-pq9sjopg.atlassian.net
└─ amzur.atlassian.net

User selects: amzur-team-pq9sjopg.atlassian.net

accessible-resources returns: [
  { id: "cloudId-1", url: "amzur-team-pq9sjopg.atlassian.net" }
]

✅ Simple: Just use that cloudId
```

**Scenario B: Token has access to multiple sites**
```
(In some cases, token might grant access to multiple sites)

accessible-resources returns: [
  { id: "cloudId-1", url: "amzur-team-pq9sjopg.atlassian.net" },
  { id: "cloudId-2", url: "amzur.atlassian.net" }
]

⚠️ Need to determine which one user selected during OAuth
✅ Usually the first one is the primary/selected site
```

---

## Implementation Strategy (Simplified)

### For Desktop App

Since user already picks site during OAuth, your implementation is **simpler**:

```python
def handle_oauth_callback(self, code):
    """Handle OAuth callback after user authorization"""

    # 1. Exchange code for tokens
    tokens = self.exchange_code_for_token(code)

    # 2. Get accessible resources (the site user selected)
    resources = self.get_accessible_resources(tokens['access_token'])

    if not resources:
        raise Exception("No accessible Jira sites found")

    # 3. Use the site user selected during OAuth
    # (Typically the first one in the array)
    selected_site = resources[0]

    # 4. Store organization information
    self.jira_cloud_id = selected_site['id']
    self.organization_name = selected_site['name']
    self.jira_instance_url = selected_site['url']

    # 5. Register organization in database
    organization = self.register_organization({
        'jira_cloud_id': selected_site['id'],
        'org_name': selected_site['name'],
        'jira_instance_url': selected_site['url']
    })

    self.organization_id = organization['id']

    # 6. Save to local config
    self.save_credentials({
        'access_token': tokens['access_token'],
        'refresh_token': tokens['refresh_token'],
        'organization_id': self.organization_id,
        'jira_cloud_id': self.jira_cloud_id,
        'organization_name': self.organization_name
    })

    print(f"✅ Authenticated for: {self.organization_name}")
    return True
```

**Key Points:**
- ✅ No need for additional site selector UI
- ✅ User already chose during OAuth
- ✅ Just call accessible-resources to get cloudId
- ✅ Use the first site in response (user's selection)

---

## Handling Edge Cases

### Edge Case 1: User Wants to Switch Organizations

**Solution:** Provide a "Switch Organization" feature that triggers re-authentication

```python
def switch_organization(self):
    """Allow user to switch to a different organization"""
    print("Switching organization requires re-authentication...")

    # Clear existing tokens
    self.logout()

    # Start new OAuth flow
    # User will see the site selector again and can pick a different site
    self.start_authentication()
```

### Edge Case 2: Multiple Sites Returned from API

**Solution:** If multiple sites are returned, show a selector

```python
def handle_oauth_callback(self, code):
    tokens = self.exchange_code_for_token(code)
    resources = self.get_accessible_resources(tokens['access_token'])

    if len(resources) == 1:
        # Only one site - use it
        selected_site = resources[0]
    else:
        # Multiple sites returned - let user pick
        # (This is rare, but handle it gracefully)
        selected_site = self.select_from_multiple_sites(resources)

    # ... rest of setup
```

### Edge Case 3: Token Expires

**Solution:** Use refresh token to get new access token

```python
def refresh_access_token(self):
    """Refresh access token using refresh token"""
    refresh_token = self.tokens.get('refresh_token')

    response = requests.post(
        'https://auth.atlassian.com/oauth/token',
        json={
            'grant_type': 'refresh_token',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'refresh_token': refresh_token
        }
    )

    tokens = response.json()
    self.tokens.update({
        'access_token': tokens['access_token'],
        'refresh_token': tokens.get('refresh_token', refresh_token),
        'expires_at': time.time() + tokens['expires_in']
    })

    self._save_tokens()
    return True
```

---

## For Forge App

Forge app is even simpler because `cloudId` is already in the context:

```javascript
// In any Forge resolver
async function myResolver(req) {
  const { accountId, cloudId } = req.context;

  // Find or create organization
  const organization = await findOrCreateOrganization({
    jira_cloud_id: cloudId,
    jira_instance_url: req.context.siteUrl,
    org_name: await getOrgName(cloudId)  // Fetch from Jira API
  });

  // Get or create user
  const user = await getOrCreateUser({
    atlassian_account_id: accountId,
    organization_id: organization.id
  });

  // All queries filter by organization_id
  const data = await supabase
    .from('screenshots')
    .select('*')
    .eq('user_id', user.id)
    .eq('organization_id', organization.id);

  return { success: true, data };
}
```

---

## Comparison: Before vs After Understanding

| Aspect | Old Understanding | ✅ Correct Understanding |
|--------|------------------|-------------------------|
| **Site Selection** | OAuth doesn't show selector | OAuth DOES show selector |
| **When User Picks** | Must build UI after OAuth | User picks during OAuth |
| **accessible-resources** | Must call to show selector | Call to get cloudId only |
| **Implementation** | Need custom site selector UI | Simplified - use OAuth choice |
| **Multiple Sites** | Always need to handle | Rare - token usually scoped to one |

---

## Updated Flow Diagram

```
Desktop App:
1. User clicks "Login"
2. OAuth login page (email + password)
3. ✅ OAuth shows site selector
4. User picks "amzur-team-pq9sjopg.atlassian.net"
5. User clicks "Accept"
6. Redirect back with code
7. Exchange code → access_token (scoped to selected site)
8. Call accessible-resources → get cloudId
9. Register organization in database
10. Start tracking time

Forge App:
1. User already logged into Jira in browser
2. User on specific Jira site (e.g., "amzur-team.atlassian.net")
3. Forge app loads
4. Get cloudId from req.context
5. Register/find organization in database
6. Show dashboard with organization's data
```

---

## Recommendations

### ✅ DO:

1. **Trust user's OAuth selection** - They already picked a site
2. **Call accessible-resources** - To get cloudId and metadata
3. **Use the first site** - In the API response (user's selection)
4. **Handle site switching** - Via re-authentication
5. **Store cloudId** - For future API calls

### ❌ DON'T:

1. **Don't build redundant UI** - OAuth already has a selector
2. **Don't assume multiple sites** - Token is usually scoped to one
3. **Don't skip accessible-resources** - You need the cloudId
4. **Don't hardcode site selection** - Always call the API

---

## Testing Checklist

- [ ] Test with user who has 1 Jira site
- [ ] Test with user who has multiple sites
- [ ] Verify cloudId is correctly fetched
- [ ] Verify organization is registered in database
- [ ] Test token refresh flow
- [ ] Test "Switch Organization" feature
- [ ] Verify screenshots include organization_id
- [ ] Test Forge app gets cloudId from context

---

## Summary

**Key Takeaway:** Atlassian OAuth **already handles site selection** for you! Your job is to:

1. ✅ Complete OAuth flow
2. ✅ Call accessible-resources API
3. ✅ Get cloudId from response
4. ✅ Register organization in database
5. ✅ Start tracking with organization_id

**This makes implementation simpler than originally planned!** 🎉

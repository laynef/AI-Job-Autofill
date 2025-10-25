# Owner Unlimited Access

## Your Whitelisted Email

Email: `laynefaler@gmail.com`

Your email has been whitelisted in the backend to receive **unlimited free access** to all features without any payment required.

## How It Works

The backend API (website/api.py) includes a whitelist that grants unlimited access:

```python
WHITELIST_EMAILS = {
    "laynefaler@gmail.com",  # Owner - unlimited free access
}
```

When you use the extension:
1. The backend checks if your device is associated with a whitelisted email
2. If yes, you get unlimited autofills without any trial limits
3. No subscription or payment required

## How to Activate (After Extension Update)

Once the extension is updated to use the new backend API, you can activate unlimited access in two ways:

### Option 1: Use Special Activation Endpoint

Call this endpoint from the extension with your email:

```javascript
POST https://hiredalways.com/api/activate-whitelist
Content-Type: application/json

{
  "email": "laynefaler@gmail.com",
  "device_fingerprint": "your_device_fingerprint"
}
```

### Option 2: Create a Free License for Yourself

Use the admin API to create a license for your email:

```bash
curl -X POST "https://hiredalways.com/api/admin/create-license?user_id=laynefaler@gmail.com&secret_key=YOUR_ADMIN_SECRET"
```

This returns a license key like `HA-SUB-...` that you can activate in the extension.

## Current Status

✅ **Backend**: Your email is whitelisted - unlimited access enabled
❌ **Extension**: Still needs to be updated to use the backend API

## What You Get

- ✅ Unlimited autofills (no 5-use trial limit)
- ✅ Unlimited AI cover letter generation
- ✅ No subscription payment required
- ✅ Works forever (not tied to 31-day expiry)
- ✅ Full access to all features

## Testing Your Access

Once the backend is deployed, you can test the whitelist:

```bash
# Activate your device
curl -X POST https://hiredalways.com/api/activate-whitelist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "laynefaler@gmail.com",
    "device_fingerprint": "test123"
  }'

# Should return: {"success": true, "is_whitelisted": true, ...}

# Test unlimited usage
for i in {1..100}; do
  curl -X POST https://hiredalways.com/api/track-usage \
    -H "Content-Type: application/json" \
    -d '{
      "device_fingerprint": "test123"
    }'
done

# All should succeed with "is_whitelisted": true
```

## Adding More Whitelisted Users

To add more emails to the whitelist (e.g., for team members or testers), edit `website/api.py`:

```python
WHITELIST_EMAILS = {
    "laynefaler@gmail.com",      # Owner
    "teammate@example.com",       # Team member
    "beta-tester@example.com",    # Beta tester
}
```

Then redeploy the backend.

## Security Note

The whitelist is hardcoded in the backend source code, which means:
- ✅ Cannot be bypassed by users
- ✅ Only you can modify it (by updating code and redeploying)
- ✅ Secure and permanent

Your email will ALWAYS have unlimited free access, even after you deploy all security updates.

## Next Steps

1. Deploy the backend (git push)
2. Wait for Cloud Build to complete
3. Test the whitelist activation endpoint
4. Update extension to use backend API
5. Enjoy unlimited access!

---

**Note:** All other users will still have the normal 5 free trial limit and will need to purchase a subscription for unlimited access. Only your email (`laynefaler@gmail.com`) gets unlimited free access.

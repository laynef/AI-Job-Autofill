# Hired Always - Subscription Setup Guide

Your product has been converted to a **$9.99/month subscription model** using PayPal Subscriptions.

## 🚨 IMPORTANT: Create PayPal Subscription Plan First

Before the purchase page will work, you **MUST create a subscription plan** in your PayPal Business account.

## 📋 Step 1: Create PayPal Subscription Plan

### Go to PayPal Developer Dashboard

1. **Login to PayPal Business**: https://www.paypal.com
2. **Go to Settings** → Click your profile → **Account Settings**
3. **Navigate to**: **Products & Services** → **Manage Products** (or directly visit: https://www.paypal.com/businessmanage/products/subscriptions)

### Create New Subscription Product

1. Click **"Create a Product"** or **"Create Plan"**
2. **Product Type**: Select **"Subscription"**
3. **Fill in details**:
   - **Product Name**: Hired Always Monthly Subscription
   - **Product Description**: AI-powered job application assistant - Monthly access
   - **Product Type**: Digital Products
   - **Category**: Software

4. **Create Plan**:
   - **Plan Name**: Monthly Plan
   - **Plan ID**: `P-HIRED-ALWAYS-MONTHLY` (use exactly this)
   - **Billing Cycle**: Monthly
   - **Price**: $9.99 USD
   - **Setup Fee**: None
   - **Trial Period**: None (or add 7-day free trial if desired)

5. **Advanced Settings**:
   - **Billing Cycles**: Unlimited (until customer cancels)
   - **Payment Failure**: Suspend subscription after 3 failed payments
   - **Auto-renewal**: Enabled

6. **Save the Plan**

### Get Your Plan ID

After creating the plan, PayPal will give you a **Plan ID** that looks like:
- Format: `P-XXXXXXXXXXXXXXX`
- Example: `P-5ML4271244454362WXNWU5NQ`

**CRITICAL**: Copy this Plan ID!

## 📝 Step 2: Update Your Code

Open `website/purchase.html` and replace the placeholder Plan ID:

**Find this line (around line 266):**
```javascript
'plan_id': 'P-HIRED-ALWAYS-MONTHLY', // You need to create this plan in PayPal dashboard
```

**Replace with your actual Plan ID:**
```javascript
'plan_id': 'P-5ML4271244454362WXNWU5NQ', // Your actual Plan ID from PayPal
```

## 🎯 What's Been Changed

### Subscription Model
- **Price**: $9.99/month (was one-time $9.99)
- **Billing**: Monthly recurring via PayPal
- **Cancellation**: Users can cancel anytime in PayPal
- **Key Format**: `HA-SUB-XXXXXXXXXXXXXXXXXXXX`

### Files Modified

1. **website/purchase.html**
   - PayPal Subscription Buttons (not regular buttons)
   - Generates `HA-SUB-` prefixed keys
   - Shows monthly billing info
   - Links to PayPal subscription management

2. **popup.js** (Extension)
   - Changed from license to subscription verification
   - 31-day validity period check
   - Shows days remaining
   - Expired subscription warning
   - Links to renewal

3. **popup.html**
   - "Subscription Active" instead of "Licensed"
   - "Manage Subscription" button
   - Days remaining indicator
   - Renewal links

4. **website/index.html**
   - All CTAs updated to "$9.99/month"
   - "Subscribe" instead of "Purchase"
   - "Cancel anytime" messaging

## 🔄 User Subscription Flow

### Initial Subscription
1. User visits `hiredalways.com/purchase.html`
2. Enters email
3. Clicks "Subscribe with PayPal"
4. Completes PayPal subscription setup
5. Receives subscription key: `HA-SUB-XXXXXXXXXXXX`
6. Enters key in extension → Activated for 31 days

### Monthly Renewal
1. PayPal automatically charges $9.99 monthly
2. **IMPORTANT**: Extension uses client-side 31-day check
3. After 31 days, extension shows "Subscription Expired"
4. User must re-enter key or renew (limitation of frontend-only)

### Cancellation
1. User goes to PayPal.com → Settings → Payments → Manage Automatic Payments
2. Finds "Hired Always" subscription
3. Clicks "Cancel"
4. Subscription ends at current period
5. Extension stops working after 31 days from last activation

## ⚠️ Important Limitations (Frontend-Only)

Since this is a **frontend-only implementation** without a backend server:

### What Works ✅
- ✅ PayPal subscription creation
- ✅ Monthly billing by PayPal
- ✅ Subscription key generation
- ✅ 31-day client-side validation
- ✅ PayPal subscription management

### What Doesn't Work ❌
- ❌ **Automatic renewal detection** - Extension can't detect when PayPal renews subscription
- ❌ **Real-time cancellation detection** - Extension doesn't know if user cancelled in PayPal
- ❌ **Multi-device sync** - Key works on any device, can't limit to one
- ❌ **Usage tracking** - No way to track active subscribers
- ❌ **Automatic expiration** - Extension expires after 31 days regardless of PayPal status

### The Problem

**After 31 days, the extension will show "Expired" even if the PayPal subscription is still active.**

Users will need to:
1. Get a new subscription key (not ideal)
2. Contact support to get refreshed key
3. OR you implement a backend (recommended)

## 🔧 Recommended: Add Backend (Production)

For a production subscription service, you should implement:

### Backend API Endpoints
```
POST /api/verify-subscription
  - Input: { subscriptionKey, subscriptionID }
  - Checks PayPal subscription status via API
  - Returns: { active: true/false, expiresAt: date }

POST /api/webhook/paypal
  - Receives PayPal webhooks
  - Updates subscription status in database
  - Handles: subscription.created, subscription.cancelled, payment.sale.completed
```

### Database Schema
```sql
subscriptions:
  - subscription_key (unique)
  - subscription_id (PayPal ID)
  - email
  - status (active/cancelled/expired)
  - started_at
  - expires_at
  - last_payment_at
```

### Extension Changes
```javascript
// Check with backend API instead of local date
async function checkSubscription() {
  const response = await fetch('https://api.hiredalways.com/verify', {
    method: 'POST',
    body: JSON.stringify({ subscriptionKey })
  });
  return response.json(); // { valid: true, expiresAt: "2025-11-25" }
}
```

## 💰 Revenue & Analytics

### Track Revenue
- **PayPal Dashboard**: https://www.paypal.com/reports
- View: Monthly Recurring Revenue (MRR)
- Export: Transaction reports

### Key Metrics
| Metric | Calculation |
|--------|-------------|
| MRR | Active Subscribers × $9.99 |
| Churn Rate | Cancelled / Total Subscribers |
| LTV | Avg Subscription Length × $9.99 |

### Example
- 100 active subscribers = $999/month MRR
- 500 active subscribers = $4,995/month MRR
- 1,000 active subscribers = $9,990/month MRR

## 🧪 Testing Subscription Flow

### Test Mode (Sandbox)

1. **Create Sandbox Accounts**: https://developer.paypal.com/dashboard/accounts
2. **Create Sandbox Plan** in test mode
3. **Update purchase.html**:
   ```html
   <!-- Change SDK URL to sandbox -->
   <script src="https://www.paypal.com/sdk/js?client-id=YOUR_SANDBOX_CLIENT_ID&vault=true&intent=subscription"></script>
   ```
4. **Test complete flow** without real charges

### Live Testing

1. Subscribe with real account (you'll be charged $9.99)
2. Verify subscription in PayPal
3. Test key activation in extension
4. Test 31-day expiration (change dates in code temporarily)
5. Cancel subscription and verify
6. Test renewal (wait 30 days or manually test)

## 🎬 Go Live Checklist

Before launching subscriptions:

- [ ] Created PayPal subscription plan
- [ ] Updated Plan ID in `purchase.html`
- [ ] Tested subscription creation
- [ ] Tested key activation
- [ ] Updated Chrome Web Store listing
- [ ] Added subscription terms/policy
- [ ] Set up customer support email
- [ ] Documented refund policy
- [ ] Tested cancellation flow
- [ ] Decided on backend implementation timeline

## 📞 Customer Support

Common questions:

**"My subscription expired but I'm still paying"**
- Explain frontend limitation
- Provide new key or instruct to re-subscribe

**"How do I cancel?"**
- PayPal.com → Settings → Payments → Manage Automatic Payments → Cancel

**"Can I get a refund?"**
- PayPal handles this - you can approve refunds in PayPal dashboard

**"Why do I need to re-enter my key every month?"**
- Frontend limitation - recommend implementing backend API

## 🚀 Current Status

✅ **Ready to Deploy:**
- Subscription UI created
- PayPal integration complete
- Extension updated for subscriptions
- Website updated with pricing

⚠️ **Before Going Live:**
- Create PayPal subscription plan
- Update Plan ID in code
- Test with real PayPal account
- Consider backend implementation

## 🔗 Useful Links

- **PayPal Subscriptions API**: https://developer.paypal.com/docs/subscriptions/
- **PayPal Webhooks**: https://developer.paypal.com/api/rest/webhooks/
- **Manage Plans**: https://www.paypal.com/businessmanage/products
- **Developer Dashboard**: https://developer.paypal.com/dashboard/

---

Need help? See `PAYMENT_SETUP.md` for additional payment information.

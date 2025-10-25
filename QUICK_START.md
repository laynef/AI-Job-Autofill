# Quick Start - Fix "Subscribe Now" Button

## 🚨 The subscription button is broken because we need to create a PayPal Subscription Plan first!

## Step 1: Create PayPal Subscription Plan (5 minutes)

### Go to PayPal Products

1. **Login**: https://www.paypal.com
2. **Navigate to**: Products & Services
   - Click your name (top right) → **Account Settings**
   - OR go directly to: https://www.paypal.com/businessmanage/products

### Create Subscription Product

3. Click **"Create Product"** button

4. Fill in the form:
   ```
   Product name: Hired Always Monthly Subscription
   Product type: Service
   Category: Software
   ```

5. Click **"Next"** or **"Continue"**

6. Create the plan:
   ```
   Plan name: Monthly Plan
   Billing cycle: Every month
   Price per cycle: $9.99
   Currency: USD
   ```

7. **IMPORTANT**: Set these options:
   - ✅ Auto-renewal: ON
   - ✅ Unlimited billing cycles (or set to 999)
   - ❌ Setup fee: None (leave blank)
   - ❌ Trial period: None (we handle trials in-app)

8. Click **"Save"** or **"Create"**

### Get Your Plan ID

9. After creating, PayPal will show your **Plan ID**
   - It looks like: `P-5ML4271244454362WXNWU5NQ`
   - Or: `P-XXXXXXXXXXXXXXX`

10. **COPY THIS PLAN ID!** You need it for the next step.

## Step 2: Update Your Code (30 seconds)

### Open the file: `website/purchase.html`

Find line **266** (around that area):

**BEFORE:**
```javascript
'plan_id': 'P-HIRED-ALWAYS-MONTHLY', // You need to create this plan in PayPal dashboard
```

**AFTER** (replace with YOUR Plan ID):
```javascript
'plan_id': 'P-5ML4271244454362WXNWU5NQ', // Your actual Plan ID from PayPal
```

### Save the file!

## Step 3: Deploy (Optional - for testing locally, skip to Step 4)

If you want to deploy to production:

```bash
git add website/purchase.html
git commit -m "Added PayPal subscription plan ID"
git push
gcloud builds submit --config=cloudbuild.yaml
```

## Step 4: Test Locally

### Option A: Open HTML file directly

1. Open `website/purchase.html` in your browser
2. Enter test email
3. Click PayPal button
4. Should now open PayPal subscription flow!

### Option B: Run with Docker

```bash
cd website
docker-compose up --build
```

Visit: http://localhost:8080/purchase.html

## Step 5: Test the Full Flow

1. **Visit purchase page**
2. **Enter your email**
3. **Click PayPal Subscribe button**
   - Should redirect to PayPal
   - Shows $9.99/month subscription details
4. **Complete subscription** (use sandbox for testing, or real for production)
5. **Copy subscription key** shown on success page
6. **Open extension popup**
7. **Enter subscription key**
8. **Verify**: Should show "✓ Subscription Active"
9. **Try autofill**: Should work unlimited!

## 🎯 That's It!

After these steps:
- ✅ Subscription button works
- ✅ PayPal charges $9.99/month
- ✅ Users get subscription keys
- ✅ Extension unlocks unlimited access

## ❓ Troubleshooting

### "Invalid plan" error
- Make sure you copied the full Plan ID
- Check for extra spaces
- Plan ID should start with `P-`

### "Subscription failed" error
- Check your PayPal account is a Business account
- Make sure API credentials are correct
- Try in sandbox mode first

### Can't find "Products" in PayPal
- You might need to upgrade to PayPal Business
- Or go to: https://www.paypal.com/businessmanage
- Look for "Products & Services" in left menu

### Want to test without real money?

**Use PayPal Sandbox:**

1. Go to: https://developer.paypal.com
2. Create sandbox Business account
3. Create sandbox subscription plan
4. Update `purchase.html` line 10:
   ```html
   <!-- Change to sandbox -->
   <script src="https://www.paypal.com/sdk/js?client-id=YOUR_SANDBOX_CLIENT_ID&vault=true&intent=subscription"></script>
   ```
5. Test with sandbox buyer account

## 📞 Still Broken?

Check these common issues:

1. **Wrong Client ID**: Line 10 in `purchase.html` should have your real PayPal Client ID
2. **No Plan ID**: Line 266 must have real Plan ID from PayPal
3. **Wrong account type**: Must be PayPal Business account
4. **Browser console**: Check for JavaScript errors (F12 → Console)

---

**Once you update the Plan ID, the Subscribe button will work!** 🎉

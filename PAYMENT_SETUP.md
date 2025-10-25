# Hired Always - Payment Integration Guide

This extension has been converted to a paid product using PayPal for payment processing.

## Overview

**Price:** $9.99 (one-time payment, lifetime license)
**Payment Processor:** PayPal
**License System:** Frontend license key validation

## How It Works

1. **User purchases license** at `https://hiredalways.com/purchase.html`
2. **PayPal processes payment** using your PayPal Business account
3. **License key is generated** automatically after successful payment
4. **User activates extension** by entering the license key
5. **License is stored locally** in Chrome storage

## Files Modified

### Website (`/website/`)
- `index.html` - Updated CTAs to direct to purchase page
- `purchase.html` (NEW) - PayPal checkout page with license generation
- `Dockerfile` - Added purchase.html to deployment

### Extension
- `popup.html` - Added license activation modal
- `popup.js` - Added license verification and activation logic

## PayPal Configuration

Your PayPal credentials are configured in:
- **Client ID:** `Afi-D_TFUCNLZun1AEyBNjJGEeKNuhDcDsUgchF1kR1zPnmxlrHGGP29h8Y--RlXFSth7Ge83FJuOacF`
- **Mode:** Live (production)
- **Price:** $9.99 USD

The PayPal SDK is loaded in `purchase.html` and processes payments client-side.

## License Key Format

License keys follow this format: `HA-XXXXXXXXXXXXXXXXXXXX`
- Prefix: `HA-`
- Length: 23 characters total
- Generated from: email + orderID + timestamp (base64 encoded)

## User Flow

### 1. Purchase
1. User visits https://hiredalways.com/purchase.html
2. Enters email address
3. Clicks "Pay with PayPal"
4. Completes PayPal checkout
5. Receives license key on success page

### 2. Activation
1. User installs extension from Chrome Web Store
2. Opens extension popup
3. License modal appears automatically
4. User enters license key
5. Extension validates format and saves to storage

### 3. Usage
- Extension checks for valid license before allowing autofill
- "✓ Licensed" indicator shown when active
- "Manage License" button to view/deactivate license

## Security Notes

⚠️ **Important:** This is a client-side implementation. License validation happens in the browser without server verification.

**Limitations:**
- Users could potentially bypass by modifying extension code
- No centralized license database
- Cannot revoke licenses remotely
- Cannot track usage across installations

**For Production:**
Consider implementing:
- Server-side license verification API
- License activation limits (e.g., 3 devices max)
- Periodic online license checks
- Database to store and manage licenses
- Email delivery system for license keys

## Testing

### Test PayPal Payment (Sandbox Mode)
To test without real charges, update `purchase.html`:
1. Change PayPal SDK URL to sandbox:
   ```html
   <script src="https://www.paypal.com/sdk/js?client-id=YOUR_SANDBOX_CLIENT_ID&currency=USD"></script>
   ```
2. Use PayPal sandbox test account

### Test License Activation
1. Generate a test license key: `HA-TESTKEY12345678901`
2. Open extension popup
3. Enter test key
4. Verify activation works

## Deployment

1. **Deploy Website:**
   ```bash
   cd website
   docker-compose up --build
   # Or deploy to Cloud Run
   ```

2. **Update Extension:**
   - Package extension: `chrome://extensions` → "Pack extension"
   - Upload to Chrome Web Store
   - Update extension listing to mention paid license

3. **Chrome Web Store:**
   - Update description to mention $9.99 price
   - Add purchase link in description
   - Update screenshots to show activation flow

## Support

Common user issues:

1. **"Invalid license key"**
   - Check format: must start with `HA-` and be 23 characters
   - Ensure no extra spaces
   - Try copying again from purchase page

2. **Payment completed but no license shown**
   - Check browser console for errors
   - Verify PayPal transaction in PayPal dashboard
   - Manually generate license from transaction ID

3. **Lost license key**
   - Check PayPal transaction history for Order ID
   - Check email for confirmation
   - Contact support with PayPal transaction ID

## Future Enhancements

Consider adding:
- [ ] Backend API for license validation
- [ ] Email delivery of license keys via SendGrid/Mailgun
- [ ] License management dashboard
- [ ] Subscription options (monthly/annual)
- [ ] Team licenses (multiple users)
- [ ] License transfer/reset functionality
- [ ] Usage analytics
- [ ] Refund handling

## Revenue Tracking

Track PayPal transactions in your PayPal Business Dashboard:
- **Sales:** Transaction History
- **Revenue:** Reports → All Transactions
- **Export:** Download CSV for accounting

## Contact

For payment or licensing support, users should contact you via:
- Email: (add your support email)
- PayPal: Reference transaction ID

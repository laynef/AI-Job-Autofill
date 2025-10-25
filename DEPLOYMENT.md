# Hired Always - Deployment Guide

## ✅ Changes Ready to Deploy

All files have been updated and tested locally. The Docker container builds successfully and images load correctly.

## 🚀 Deploy to Google Cloud Run

### Option 1: Using Cloud Build (Recommended)

```bash
# From project root directory
gcloud builds submit --config=cloudbuild.yaml
```

This will:
1. Build the Docker image from `website/Dockerfile`
2. Push to Google Container Registry
3. Deploy to Cloud Run as `hiredalways`
4. Make it publicly accessible

### Option 2: Manual Deployment

```bash
# Build locally
docker build -f website/Dockerfile -t gcr.io/YOUR_PROJECT_ID/hiredalways .

# Push to GCR
docker push gcr.io/YOUR_PROJECT_ID/hiredalways

# Deploy to Cloud Run
gcloud run deploy hiredalways \
  --image gcr.io/YOUR_PROJECT_ID/hiredalways \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 🧪 Testing

### Local Testing

```bash
# Build and run locally
docker build -f website/Dockerfile -t hired-always-local .
docker run -d -p 8080:8080 -e PORT=8080 --name hired-always hired-always-local

# Test in browser
open http://localhost:8080
open http://localhost:8080/purchase.html

# Check images load
curl -I http://localhost:8080/images/icon48.png

# Cleanup
docker stop hired-always && docker rm hired-always
```

### Verify Deployment

After deploying to Cloud Run:

1. **Check homepage**: https://hiredalways.com
   - Verify images load
   - Check "Get Started - $9.99" button works

2. **Test purchase page**: https://hiredalways.com/purchase.html
   - Enter test email
   - Click PayPal button
   - Complete test transaction
   - Verify license key generates

3. **Test extension**:
   - Install extension from Chrome Web Store
   - Open popup
   - Enter license key from purchase
   - Verify activation works

## 📝 Issues Fixed

### Image 404 Errors - RESOLVED ✓

**Problem**: Images were returning 404 errors on Cloud Run

**Root Causes Fixed**:
1. ✅ Dockerfile now copies images correctly: `COPY images/ /usr/share/nginx/html/images/`
2. ✅ HTML paths updated: `images/icon48.png` (not `../images/icon48.png`)
3. ✅ Entrypoint script line endings fixed (CRLF → LF)
4. ✅ Build context set to parent directory in cloudbuild.yaml
5. ✅ .dockerignore updated to not exclude necessary files

**Verified**:
- ✅ Local Docker build successful
- ✅ Images exist in container: `/usr/share/nginx/html/images/`
- ✅ HTTP access works: `curl http://localhost:8080/images/icon48.png` returns 200 OK
- ✅ All 6 image files present (icon16/48/128 in png and svg)

## 🔧 Configuration

### PayPal
- **Client ID**: Configured in `purchase.html`
- **Mode**: Live (production)
- **Price**: $9.99 USD

### Domain
- **Production**: hiredalways.com
- **Cloud Run**: Automatically assigned URL, map custom domain in Cloud Run settings

### Files Modified
- `popup.html` - License activation modal
- `popup.js` - License verification logic
- `website/index.html` - Pricing CTAs
- `website/purchase.html` - NEW - PayPal checkout
- `website/Dockerfile` - Fixed image copying and entrypoint
- `cloudbuild.yaml` - NEW - Cloud Build configuration

## 📋 Post-Deployment Checklist

After successful deployment:

- [ ] Visit https://hiredalways.com and verify site loads
- [ ] Check images load (no 404 errors in console)
- [ ] Test purchase flow end-to-end
- [ ] Verify license key generation works
- [ ] Test license activation in extension
- [ ] Update Chrome Web Store listing:
  - [ ] Add $9.99 price to description
  - [ ] Add purchase link
  - [ ] Update screenshots
- [ ] Set up domain mapping in Cloud Run (if needed)
- [ ] Configure SSL certificate (auto with Cloud Run)
- [ ] Test autofill with active license

## 🆘 Troubleshooting

### Images Still 404 After Deploy

1. Check Cloud Run logs:
   ```bash
   gcloud run services logs read hiredalways --region=us-central1
   ```

2. Verify build succeeded:
   ```bash
   gcloud builds list --limit=5
   ```

3. Check container images:
   ```bash
   gcloud run services describe hiredalways --region=us-central1
   ```

4. SSH into running container (debug):
   ```bash
   gcloud run services describe hiredalways --region=us-central1 --format="value(status.url)"
   # Visit URL, then check Cloud Run logs for nginx access logs
   ```

### PayPal Payments Not Working

1. Check browser console for JavaScript errors
2. Verify PayPal SDK loaded: Look for `paypal` object in console
3. Check PayPal credentials in `purchase.html`
4. Test with PayPal sandbox mode first
5. Check PayPal dashboard for transaction logs

### License Activation Issues

1. Check license key format: `HA-XXXXXXXXXXXXXXXXXXXX`
2. Verify Chrome storage: DevTools → Application → Storage → Local Storage
3. Check popup.js console for errors
4. Try clearing extension data and re-activating

## 🔐 Security Notes

**Current Implementation**: Client-side license validation
- License keys are validated in browser
- No server-side verification
- Users could technically bypass with code modifications

**Recommended for Production**:
- Add backend API for license verification
- Store licenses in database (Firebase, PostgreSQL, etc.)
- Implement periodic online license checks
- Add activation limits (e.g., 3 devices max)
- Send license keys via email (SendGrid, Mailgun)

## 📊 Monitoring

Track your revenue and usage:

1. **PayPal Dashboard**:
   - Sales reports
   - Transaction history
   - Export to CSV

2. **Cloud Run Metrics**:
   ```bash
   gcloud run services describe hiredalways --region=us-central1
   ```

3. **Chrome Web Store**:
   - User count
   - Rating/reviews
   - Installation stats

## 💰 Revenue Estimate

**Pricing**: $9.99 one-time payment
**Target**: 100-1000 users/month

| Users/Month | Monthly Revenue | Annual Revenue |
|-------------|----------------|----------------|
| 100         | $999           | $11,988        |
| 500         | $4,995         | $59,940        |
| 1,000       | $9,990         | $119,880       |

**PayPal Fees**: ~2.9% + $0.30 per transaction = ~$0.59 per sale
**Net per sale**: ~$9.40

---

## 🚀 Ready to Deploy!

Everything is configured and tested. Run this command to deploy:

```bash
gcloud builds submit --config=cloudbuild.yaml
```

Good luck with Hired Always! 🎉

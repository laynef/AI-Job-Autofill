# Social Preview Image

## Required Image: social-preview.png

Create a 1200x630px image for social media previews (Open Graph/Twitter cards).

### Design Recommendations:

**Dimensions:** 1200px × 630px (required for social media)

**Content:**
- **Headline:** "Stop Wasting Hours on Job Applications"
- **Subheadline:** "AI-Powered Autofill for Greenhouse, Lever, Workday & More"
- **Visual:** Screenshot of the extension in action OR mockup of form being filled
- **Badge:** "5 FREE Applications - No Credit Card"
- **Logo:** Hired Always logo (use icon128.png)
- **Color Scheme:** Purple gradient background (#667eea to #764ba2)
- **Text Color:** White with good contrast

### Tools to Create:

- **Canva** (easiest): Use "Facebook Post" template (1200x630)
- **Figma**: Create 1200x630 frame
- **Photoshop**: New file 1200x630px at 72 DPI

### Quick Steps:

1. Create 1200x630px canvas
2. Add purple gradient background
3. Add headline in bold white text (72-96pt)
4. Add screenshot or mockup
5. Add "5 FREE Applications" badge
6. Export as PNG
7. Save as `social-preview.png` in this directory

### Current Fallback:

The meta tags currently reference `social-preview.png` which doesn't exist yet.
Until created, social media will show the icon128.png instead.

### Test Your Image:

- **Facebook:** https://developers.facebook.com/tools/debug/
- **Twitter:** https://cards-dev.twitter.com/validator
- **LinkedIn:** Post the link and check preview

### Alternative:

If you don't want to create an image, you can use icon128.png by changing the meta tags in `templates/index.html`:

```html
<!-- Change from: -->
<meta property="og:image" content="https://hiredalways.com/static/images/social-preview.png">

<!-- To: -->
<meta property="og:image" content="https://hiredalways.com/static/images/icon128.png">
```

#!/usr/bin/env python3
"""
Generate social preview image for Hired Always
Creates a 1200x630px PNG for Open Graph/Twitter cards
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
except ImportError:
    print("❌ Pillow library not installed!")
    print("\nInstall with: pip install Pillow")
    print("Then run this script again.")
    exit(1)

# Image dimensions (required for social media)
WIDTH = 1200
HEIGHT = 630

# Colors
GRADIENT_START = (102, 126, 234)  # #667eea
GRADIENT_END = (118, 75, 162)     # #764ba2
WHITE = (255, 255, 255)
SEMI_TRANSPARENT_WHITE = (255, 255, 255, 180)

def create_gradient(width, height, start_color, end_color):
    """Create a vertical gradient"""
    base = Image.new('RGB', (width, height), start_color)
    top = Image.new('RGB', (width, height), end_color)
    mask = Image.new('L', (width, height))
    mask_data = []
    for y in range(height):
        for x in range(width):
            # Diagonal gradient
            mask_data.append(int(255 * (x + y) / (width + height)))
    mask.putdata(mask_data)
    base.paste(top, (0, 0), mask)
    return base

def main():
    print("🎨 Creating social preview image...")

    # Create base image with gradient
    img = create_gradient(WIDTH, HEIGHT, GRADIENT_START, GRADIENT_END)
    draw = ImageDraw.Draw(img, 'RGBA')

    # Add decorative circles
    # Top right circle
    draw.ellipse([800, -200, 1400, 400], fill=(255, 255, 255, 25))
    # Bottom left circle
    draw.ellipse([-100, 400, 350, 850], fill=(255, 255, 255, 20))

    # Try to load fonts (fallback to default if not available)
    try:
        # Try to find system fonts
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 85)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 42)
        feature_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        badge_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        logo_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
    except:
        try:
            # Windows fonts
            title_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 85)
            subtitle_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 42)
            feature_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 28)
            badge_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 36)
            logo_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 48)
        except:
            try:
                # macOS fonts
                title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 85)
                subtitle_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 42)
                feature_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
                badge_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
                logo_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 48)
            except:
                print("⚠️  Using default font (text may look basic)")
                title_font = ImageFont.load_default()
                subtitle_font = ImageFont.load_default()
                feature_font = ImageFont.load_default()
                badge_font = ImageFont.load_default()
                logo_font = ImageFont.load_default()

    # Logo section (top)
    draw.text((100, 60), "💼", font=logo_font, fill=WHITE)
    draw.text((180, 70), "Hired Always", font=logo_font, fill=WHITE)

    # Main headline
    headline = "Stop Wasting Hours\non Job Applications"
    draw.text((100, 180), headline, font=title_font, fill=WHITE)

    # Subheadline
    subheadline = "AI-Powered Autofill for Greenhouse,\nLever, Workday & More"
    draw.text((100, 390), subheadline, font=subtitle_font, fill=WHITE)

    # Feature checkmarks
    features_y = 490
    features = ["✓ Instant Autofill", "✓ AI Cover Letters", "✓ 100% Free Trial"]
    for i, feature in enumerate(features):
        x_pos = 100 + (i * 350)
        # Draw semi-transparent circle background
        circle_x = x_pos - 10
        circle_y = features_y - 10
        draw.ellipse([circle_x, circle_y, circle_x + 50, circle_y + 50],
                    fill=(255, 255, 255, 60))
        draw.text((x_pos + 55, features_y), feature, font=feature_font, fill=WHITE)

    # Free badge at bottom
    badge_y = 560
    # Draw badge background (rounded rectangle)
    badge_rect = [80, badge_y - 20, 650, badge_y + 60]
    draw.rounded_rectangle(badge_rect, radius=40, fill=(255, 255, 255, 60))
    draw.rounded_rectangle(badge_rect, radius=40, outline=WHITE, width=3)

    # Badge text
    draw.text((110, badge_y), "🎁  5 FREE Applications - No Credit Card",
             font=badge_font, fill=WHITE)

    # Save the image
    output_path = "website/static/images/social-preview.png"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, 'PNG', optimize=True)

    print(f"✅ Image created successfully!")
    print(f"📁 Saved to: {output_path}")
    print(f"📐 Size: {WIDTH}x{HEIGHT}px")
    print(f"💾 File size: {os.path.getsize(output_path) / 1024:.1f} KB")
    print("\n🎉 Done! Now commit and deploy:")
    print("   git add website/static/images/social-preview.png")
    print("   git commit -m 'Add social preview image'")
    print("   git push")
    print("\n🔍 Test your image:")
    print("   Facebook: https://developers.facebook.com/tools/debug/")
    print("   Twitter: https://cards-dev.twitter.com/validator")

if __name__ == "__main__":
    main()

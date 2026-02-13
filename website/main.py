from fastapi import FastAPI, Request, Query, HTTPException
from pydantic import BaseModel, EmailStr, ValidationError, validator
from fastapi.responses import (
    HTMLResponse,
    Response,
    PlainTextResponse,
    RedirectResponse,
    JSONResponse,
)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import os
import glob
from adcash_config import get_zone_id, get_primary_zone_id, ANTI_ADBLOCK_CONFIG

app = FastAPI(
    title="Hired Always",
    description="AI-powered job application assistant",
    version="1.0.0",
)


def get_adblock_lib_path():
    """Get the dynamically generated anti-adblock library path"""
    try:
        # First, try to read from the path file created by Docker
        path_file = os.path.join(BASE_DIR, "adblock-lib-path.txt")
        if os.path.exists(path_file):
            with open(path_file, "r") as f:
                lib_path = f.read().strip()
                if lib_path and os.path.exists(lib_path):
                    # Convert absolute path to relative URL path
                    return lib_path.replace("/app/static", "/static")

        # Fallback: Look for adblock library files with various patterns
        patterns = [
            os.path.join(BASE_DIR, "static/js/lib-*.js"),
            os.path.join(BASE_DIR, "static/js/*lib*.js"),
            os.path.join(
                BASE_DIR, "static/js/[a-z][0-9][a-z][0-9][a-z][0-9]*.js"
            ),  # Pattern like x7n4vw...
            os.path.join(
                BASE_DIR, "static/js/[tmzwk]*[0-9a-f]*.js"
            ),  # Pattern matching the prefix + hex
            os.path.join(
                BASE_DIR, "static/js/[a-z0-9]*.js"
            ),  # Pattern for any alphanumeric filename
        ]

        for pattern in patterns:
            adblock_files = glob.glob(pattern)
            if adblock_files:
                # Return the path relative to static folder
                # We need to extract the filename and append to /static/js/
                filename = os.path.basename(adblock_files[0])
                return f"/static/js/{filename}"

        return None
    except Exception as e:
        print(f"Error in get_adblock_lib_path: {e}")
        return None


# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Content Security Policy - DISABLED to allow ads to load freely
        # csp_directives = [
        #     "default-src 'self'",
        #     "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.paypal.com https://www.paypalobjects.com https://pagead2.googlesyndication.com https://www.googletagmanager.com https://cdn.adcash.com https://*.adcash.com https://adbpage.com",
        #     "style-src 'self' 'unsafe-inline'",
        #     "img-src 'self' data: https:",
        #     "font-src 'self' data:",
        #     "connect-src 'self' https://www.paypal.com https://www.paypalobjects.com https://generativelanguage.googleapis.com https://pagead2.googlesyndication.com https://www.google-analytics.com https://cdn.adcash.com https://*.adcash.com https://adbpage.com https://adexchangeclear.com https://*.space https://usrpubtrk.com",
        #     "frame-src https://www.paypal.com https://cdn.adcash.com https://*.adcash.com https://adbpage.com https://adexchangeclear.com https://*.space https://usrpubtrk.com",
        #     "worker-src 'self' blob:",
        #     "object-src 'none'",
        #     "base-uri 'self'",
        #     "form-action 'self' https://www.paypal.com",
        #     "frame-ancestors 'none'",
        #     "upgrade-insecure-requests"
        # ]
        # response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"

        # Enable browser XSS protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Strict Transport Security - Force HTTPS (31536000 = 1 year)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

        # Referrer Policy - Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy - Disable unnecessary browser features
        permissions_policy = [
            "accelerometer=()",
            "camera=()",
            "geolocation=()",
            "gyroscope=()",
            "magnetometer=()",
            "microphone=()",
            "payment=(self)",
            "usb=()",
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions_policy)

        # Remove server header for security through obscurity
        if "Server" in response.headers:
            del response.headers["Server"]

        return response


# Add security headers middleware (add this before CORS)
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "https://hiredalways.com",
        "http://localhost:*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include API router
from api import router as api_router

app.include_router(api_router)

# Mount static files (CSS, images, etc.)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount(
    "/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static"
)

# Setup Jinja2 templates
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Home page - Main landing page"""
    adblock_lib_path = get_adblock_lib_path()
    # Get zone ID based on the host domain
    host = request.headers.get("host", "hiredalways.com")
    domain = host.split(":")[0]  # Remove port if present
    zone_id = get_zone_id(domain) or get_primary_zone_id()

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "adblock_lib_path": adblock_lib_path,
            "adcash_zone_id": zone_id,
            "adblock_enabled": ANTI_ADBLOCK_CONFIG.get("enabled", True),
        },
    )


@app.get("/index.html", response_class=HTMLResponse)
async def home_alt(request: Request):
    """Home page - Alternative route with .html extension"""
    return RedirectResponse(url="/", status_code=301)


@app.get("/purchase.html", response_class=HTMLResponse)
async def purchase(request: Request):
    """Purchase page - Subscription checkout"""
    return RedirectResponse(url="/purchase", status_code=301)


@app.get("/purchase", response_class=HTMLResponse)
async def purchase_alt(request: Request):
    """Purchase page - Alternative route without .html extension"""
    adblock_lib_path = get_adblock_lib_path()
    # Get zone ID based on the host domain
    host = request.headers.get("host", "hiredalways.com")
    domain = host.split(":")[0]  # Remove port if present
    zone_id = get_zone_id(domain) or get_primary_zone_id()

    return templates.TemplateResponse(
        "purchase.html",
        {
            "request": request,
            "adblock_lib_path": adblock_lib_path,
            "adcash_zone_id": zone_id,
            "adblock_enabled": ANTI_ADBLOCK_CONFIG.get("enabled", True),
        },
    )


@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run"""
    return {"status": "healthy"}


@app.get("/robots.txt")
async def robots():
    """Serve robots.txt for SEO"""
    with open(os.path.join(BASE_DIR, "static/robots.txt"), "r") as f:
        content = f.read()
    return Response(content=content, media_type="text/plain")


@app.get("/sitemap.xml")
async def sitemap():
    """Serve sitemap.xml for SEO"""
    with open(os.path.join(BASE_DIR, "static/sitemap.xml"), "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/xml")


@app.get("/manifest.json")
async def manifest():
    """Serve web app manifest for PWA support"""
    with open(os.path.join(BASE_DIR, "static/manifest.json"), "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/json")


@app.get("/browserconfig.xml")
async def browserconfig():
    """Serve browserconfig.xml for Windows tiles"""
    with open(os.path.join(BASE_DIR, "static/browserconfig.xml"), "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/xml")


@app.get("/js/lib.js", response_class=Response)
async def adblock_library():
    """Serve the anti-adblock library at a consistent endpoint"""
    try:
        # First, try to read from the path file created by Docker
        path_file = os.path.join(BASE_DIR, "adblock-lib-path.txt")
        if os.path.exists(path_file):
            with open(path_file, "r") as f:
                lib_path = f.read().strip()
                if lib_path and os.path.exists(lib_path):
                    with open(lib_path, "r") as f:
                        content = f.read()
                    return Response(content=content, media_type="text/javascript")

        # Fallback: Look for adblock library files with various patterns
        patterns = [
            os.path.join(BASE_DIR, "static/js/lib-*.js"),
            os.path.join(BASE_DIR, "static/js/*lib*.js"),
            os.path.join(
                BASE_DIR, "static/js/[a-z][0-9][a-z][0-9][a-z][0-9]*.js"
            ),  # Pattern like x7n4vw...
            os.path.join(
                BASE_DIR, "static/js/[tmzwk]*[0-9a-f]*.js"
            ),  # Pattern matching the prefix + hex
            os.path.join(
                BASE_DIR, "static/js/[a-z0-9]*.js"
            ),  # Pattern for any alphanumeric filename
        ]

        for pattern in patterns:
            adblock_files = glob.glob(pattern)
            if adblock_files:
                # Serve the first matching file
                with open(adblock_files[0], "r") as f:
                    content = f.read()
                return Response(content=content, media_type="text/javascript")

        # Final fallback: return empty script (won't break page)
        return Response(
            content="// Anti-adblock library not found", media_type="text/javascript"
        )
    except Exception as e:
        # Return empty script on error to prevent page breaking
        return Response(
            content=f"// Error loading anti-adblock library: {str(e)}",
            media_type="text/javascript",
        )


@app.get("/test-ads.html", response_class=HTMLResponse)
async def test_ads():
    """Debug page for testing ad functionality"""
    with open(os.path.join(BASE_DIR, "test-ads.html"), "r") as f:
        content = f.read()
    return HTMLResponse(content=content)


# Mock categories data for infinite scroll demo
CATEGORIES = [
    {"id": i, "name": f"Category {i}", "jobCount": i * 100, "icon": "💼"}
    for i in range(1, 101)
]


@app.get("/categories", response_class=HTMLResponse)
async def categories_page(request: Request):
    """Categories page with infinite scroll"""
    adblock_lib_path = get_adblock_lib_path()
    # Get zone ID based on the host domain
    host = request.headers.get("host", "hiredalways.com")
    domain = host.split(":")[0]  # Remove port if present
    zone_id = get_zone_id(domain) or get_primary_zone_id()

    return templates.TemplateResponse(
        "categories.html",
        {
            "request": request,
            "adblock_lib_path": adblock_lib_path,
            "adcash_zone_id": zone_id,
            "adblock_enabled": ANTI_ADBLOCK_CONFIG.get("enabled", True),
        },
    )


@app.get("/api/categories")
async def get_categories(
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    search: str = Query(None, description="Search term for categories"),
):
    """API endpoint for fetching categories with pagination and search"""
    # Filter categories if search term is provided
    filtered_categories = CATEGORIES
    if search:
        search_lower = search.lower()
        filtered_categories = [
            c for c in CATEGORIES if search_lower in c["name"].lower()
        ]

    start = (page - 1) * limit
    end = start + limit

    return {
        "categories": filtered_categories[start:end],
        "page": page,
        "limit": limit,
        "total": len(filtered_categories),
        "has_more": end < len(filtered_categories),
    }


class ContactForm(BaseModel):
    name: str
    email: str
    message: str

    @validator("email")
    def validate_email(cls, v: str) -> str:
        if "@" not in v or "." not in v:
            raise ValueError("Invalid email address")
        return v


@app.post("/api/contact")
async def contact_form(form: ContactForm):
    """Handle contact form submissions"""
    # In a real app, you would send an email or save to DB
    print(f"Contact form received: {form}")
    return {"status": "success", "message": "Message received"}


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

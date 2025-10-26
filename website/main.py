from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import os

app = FastAPI(
    title="Hired Always",
    description="AI-powered job application assistant",
    version="1.0.0"
)

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Content Security Policy - Comprehensive policy for web security
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.paypalobjects.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://www.paypal.com https://www.paypalobjects.com https://generativelanguage.googleapis.com",
            "frame-src https://www.paypal.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self' https://www.paypal.com",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests"
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"

        # Enable browser XSS protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Strict Transport Security - Force HTTPS (31536000 = 1 year)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

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
            "usb=()"
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions_policy)

        # Remove server header for security through obscurity
        response.headers.pop("Server", None)

        return response

# Add security headers middleware (add this before CORS)
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "https://hiredalways.com",
        "http://localhost:*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include API router
from api import router as api_router
app.include_router(api_router)

# Mount static files (CSS, images, etc.)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup Jinja2 templates
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Home page - Main landing page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/index.html", response_class=HTMLResponse)
async def home_alt(request: Request):
    """Home page - Alternative route with .html extension"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/purchase.html", response_class=HTMLResponse)
async def purchase(request: Request):
    """Purchase page - Subscription checkout"""
    return templates.TemplateResponse("purchase.html", {"request": request})

@app.get("/purchase", response_class=HTMLResponse)
async def purchase_alt(request: Request):
    """Purchase page - Alternative route without .html extension"""
    return templates.TemplateResponse("purchase.html", {"request": request})

@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run"""
    return {"status": "healthy"}

@app.get("/robots.txt")
async def robots():
    """Serve robots.txt for SEO"""
    with open("static/robots.txt", "r") as f:
        content = f.read()
    return Response(content=content, media_type="text/plain")

@app.get("/sitemap.xml")
async def sitemap():
    """Serve sitemap.xml for SEO"""
    with open("static/sitemap.xml", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/xml")

@app.get("/manifest.json")
async def manifest():
    """Serve web app manifest for PWA support"""
    with open("static/manifest.json", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/json")

@app.get("/browserconfig.xml")
async def browserconfig():
    """Serve browserconfig.xml for Windows tiles"""
    with open("static/browserconfig.xml", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/xml")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

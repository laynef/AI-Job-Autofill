from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="Hired Always",
    description="AI-powered job application assistant",
    version="1.0.0"
)

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.config import settings
from backend.app.logger import logger
from backend.app.database import init_db
from backend.app.routes.webhook_routes import router as webhook_router
from backend.app.routes.api_routes import router as api_router

# Initialize database schema
init_db()

app = FastAPI(
    title="OpenSource PR Chronicler",
    description="Automated Open-Source PR Chronicler and Learning Dispatcher using FastAPI, GitHub REST API, LangChain, Gemini Flash, and SMTP.",
    version="1.0.0"
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global request timing and logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000
    
    # Exclude high-frequency log polling from flooding stdout
    if not request.url.path.endswith("/logs"):
        logger.info(
            f"HTTP {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)"
        )
    return response

# Include routers
app.include_router(webhook_router)
app.include_router(api_router)

@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "OpenSource PR Chronicler",
        "version": "1.0.0",
        "gemini_model": settings.gemini_model
    }

# Mount frontend production build if available
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.exists(os.path.join(frontend_dist, "index.html")):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", tags=["UI"], include_in_schema=False)
    async def serve_spa_index():
        return FileResponse(os.path.join(frontend_dist, "index.html"))

@app.on_event("startup")
def on_startup():
    logger.info("=======================================================")
    logger.info("OpenSource PR Chronicler backend server started.")
    logger.info(f"Configured Gemini Model: {settings.gemini_model}")
    logger.info(f"Webhook Secret Configured: {bool(settings.github_webhook_secret)}")
    logger.info(f"GitHub Token Configured: {bool(settings.github_token)}")
    logger.info(f"SMTP Configured: {bool(settings.smtp_email and settings.smtp_app_password)}")
    logger.info("=======================================================")

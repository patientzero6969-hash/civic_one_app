from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import time
import logging

# Import all routers
from .routes import issues, users, auth, assignments, updates, files, dashboard
from .routes.chatbot import router as chatbot_router
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Civic Issue Reporting API",
    description="API for civic issue reporting and management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["*"]  # Configure for production
)

# CORS middleware - Configure for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173", 
        "http://192.168.1.103:5173",
        "http://localhost:3000",
        "*"  # Allow all for development
    ],  # Replace with your frontend domains in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error occurred"}
    )

# Include all routers with proper prefixes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(issues.router, prefix="/api/issues", tags=["Issues"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["Assignments"])
app.include_router(updates.router, prefix="/api/updates", tags=["Issue Updates"])
app.include_router(files.router, prefix="/api/files", tags=["File Management"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard & Analytics"])
app.include_router(chatbot_router)
# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Civic Issue Reporting API is running 🚀",
        "version": "1.0.0",
        "status": "healthy",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "service": "civic-issue-api",
        "timestamp": time.time(),
        "version": "1.0.0"
    }

@app.get("/api/health/web")
async def web_health_check():
    """Health check endpoint specifically for web app."""
    return {
        "status": "healthy",
        "service": "civic-issue-api",
        "timestamp": time.time(),
        "version": "1.0.0",
        "web_compatible": True,
        "cors_enabled": True
    }

# API info endpoint
@app.get("/api")
async def api_info():
    """API information endpoint."""
    return {
        "name": "Civic Issue Reporting API",
        "version": "1.0.0",
        "description": "Backend API for civic issue reporting and management",
        "endpoints": {
            "authentication": "/api/auth",
            "users": "/api/users", 
            "issues": "/api/issues",
            "assignments": "/api/assignments",
            "updates": "/api/updates",
            "files": "/api/files",
            "dashboard": "/api/dashboard"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
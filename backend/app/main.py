"""
FastAPI application entry point for BnchMrkd backend.

Configures the FastAPI app with CORS, routes, database lifecycle,
and health check endpoint.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import routes
from app.api import scrape_routes
from app.api import athlete_routes
from app.api import ai_scanner_routes
from app.core.database import close_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — clean up DB pool on shutdown."""
    yield
    close_pool()


# Initialize FastAPI application
app = FastAPI(
    title="BnchMrkd API",
    description="Talent identification and performance analysis for athletics",
    version="0.2.0",
    lifespan=lifespan,
)

# Configure CORS middleware.
# Origins are read from the ALLOWED_ORIGINS env var (comma-separated).
# Defaults to local dev origins so nothing breaks locally; set ALLOWED_ORIGINS
# in production to your real domains, e.g.
#   ALLOWED_ORIGINS=https://bnchmrkd.com,https://app.bnchmrkd.com
_default_origins = "http://localhost:5173,http://localhost:3000,http://localhost:19006"
allowed_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(routes.router)
app.include_router(scrape_routes.router)
app.include_router(athlete_routes.router)
app.include_router(ai_scanner_routes.router)


@app.get("/health")
async def health_check() -> JSONResponse:
    """
    Health check endpoint to verify API is running.

    Returns:
        JSONResponse: Status and version information
    """
    return JSONResponse(
        status_code=200,
        content={"status": "healthy", "version": "0.2.0"},
    )


@app.get("/")
async def root() -> JSONResponse:
    """
    Root endpoint providing API information.

    Returns:
        JSONResponse: API metadata and available endpoints
    """
    return JSONResponse(
        status_code=200,
        content={
            "name": "BnchMrkd API",
            "version": "0.2.0",
            "description": "Talent identification and performance analysis for athletics",
            "documentation": "/docs",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

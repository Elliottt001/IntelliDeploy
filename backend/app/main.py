from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.database import Base, engine
from app import models as _models  # noqa: F401
from app.routers.auth import router as auth_router
from app.routers.websocket import router as websocket_router
from app.routers.intellideploy import (
    github_router,
    projects_router,
    user_settings_router,
    generation_router,
    deployments_router,
    images_router,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create all database tables on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="IntelliDeploy API", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(websocket_router)
app.include_router(github_router)
app.include_router(projects_router)
app.include_router(user_settings_router)
app.include_router(generation_router)
app.include_router(deployments_router)
app.include_router(images_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if request.url.path.startswith("/api/"):
        if isinstance(exc.detail, dict):
            content = {
                "error": exc.detail.get("error", "Request failed"),
                "code": exc.detail.get("code"),
                "details": exc.detail.get("details"),
            }
            return JSONResponse(status_code=exc.status_code, content=content)
        if isinstance(exc.detail, str):
            return JSONResponse(
                status_code=exc.status_code,
                content={"error": exc.detail, "code": None, "details": None},
            )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.url.path.startswith("/api/"):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Request validation failed",
                "code": "VALIDATION_ERROR",
                "details": exc.errors(),
            },
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.get("/")
def root():
    return {"message": "IntelliDeploy API is running"}

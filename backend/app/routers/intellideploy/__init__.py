from app.routers.intellideploy.github import router as github_router
from app.routers.intellideploy.projects import router as projects_router
from app.routers.intellideploy.user_settings import router as user_settings_router
from app.routers.intellideploy.generation import router as generation_router
from app.routers.intellideploy.deployments import router as deployments_router
from app.routers.intellideploy.images import router as images_router

__all__ = ["github_router", "projects_router", "user_settings_router", "generation_router", "deployments_router", "images_router"]

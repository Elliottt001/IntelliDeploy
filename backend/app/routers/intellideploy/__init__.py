from app.routers.intellideploy.github import router as github_router
from app.routers.intellideploy.projects import router as projects_router
from app.routers.intellideploy.user_settings import router as user_settings_router

__all__ = ["github_router", "projects_router", "user_settings_router"]

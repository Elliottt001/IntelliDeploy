from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.intellideploy_github import GitHubApiError, list_github_repos
from app.utils.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/github", tags=["intellideploy-github"])


@router.get("/repos")
def get_repos(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        repos = list_github_repos(db, current_user.id)
        return {"repos": repos}
    except GitHubApiError as e:
        status = 401 if "token missing" in str(e).lower() else 500
        return JSONResponse(status_code=status, content={"error": str(e)})

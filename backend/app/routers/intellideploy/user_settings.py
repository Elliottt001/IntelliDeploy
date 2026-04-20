from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.intellideploy.github_account import GitHubAccount
from app.models.user import User
from app.services.intellideploy_github import upsert_github_access_token
from app.services.intellideploy_k8s import K8sDeployError, validate_kubeconfig
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/user", tags=["intellideploy-user"])


class UserSettingsPayload(BaseModel):
    kubeconfig: str | None = None


class GitHubTokenPayload(BaseModel):
    githubToken: str


@router.post("/settings")
def update_settings(
    payload: UserSettingsPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.kubeconfig or not isinstance(payload.kubeconfig, str):
        return JSONResponse(status_code=400, content={"error": "kubeconfig is required"})

    try:
        namespace = validate_kubeconfig(payload.kubeconfig)
    except K8sDeployError as e:
        return JSONResponse(status_code=400, content={"error": f"Kubeconfig 格式无效: {e}"})

    try:
        current_user.kubeconfig = payload.kubeconfig
        db.add(current_user)
        db.commit()
        return {"success": True, "namespace": namespace}
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to update settings"})


@router.post("/github-token")
def update_github_token(
    payload: GitHubTokenPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.githubToken or not isinstance(payload.githubToken, str):
        raise HTTPException(status_code=400, detail="githubToken is required")

    upsert_github_access_token(db, current_user.id, payload.githubToken)

    account = db.query(GitHubAccount).filter(GitHubAccount.user_id == current_user.id).first()
    return {"success": True, "hasGithubToken": bool(account and account.access_token)}

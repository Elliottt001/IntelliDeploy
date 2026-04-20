import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.intellideploy.analysis import Analysis
from app.models.intellideploy.deployment import Deployment
from app.models.intellideploy.project import Project
from app.models.user import User
from app.services.intellideploy_ai import analyze_repository
from app.services.intellideploy_auto_docker import auto_analyze_and_push
from app.services.intellideploy_auto_yaml import auto_analyze_and_push_sealos
from app.services.intellideploy_github import (
    GitHubApiError,
    get_github_access_token,
    get_repo_contents,
    get_repo_meta,
    get_repo_readme,
)
from app.services.intellideploy_k8s import deploy_with_kubeconfig
from app.services.intellideploy_project_utils import parse_repo_url
from app.services.intellideploy_sealos import slugify
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/projects", tags=["intellideploy-projects"])


class CreateProjectPayload(BaseModel):
    repoUrl: str | None = None


def _error_response(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message})


@router.get("")
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.created_at.desc()).all()

    output = [_project_json(p, db, include_deployments=True) for p in projects]
    return {"projects": output}


@router.post("")
def create_project(payload: CreateProjectPayload, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not payload.repoUrl:
        return _error_response("Missing repoUrl", 400)

    parsed = parse_repo_url(payload.repoUrl)
    if not parsed:
        return _error_response("Invalid repo URL", 400)

    existing = db.query(Project).filter(Project.user_id == current_user.id, Project.repo_url == payload.repoUrl).first()
    if existing:
        return {"project": _project_scalar_json(existing)}

    try:
        repo = get_repo_meta(db, current_user.id, parsed["owner"], parsed["repo"])
        project = Project(
            name=repo.get("name"),
            repo_url=repo.get("html_url"),
            repo_owner=repo.get("owner", {}).get("login"),
            repo_name=repo.get("name"),
            visibility=repo.get("visibility") or ("private" if repo.get("private") else "public"),
            default_branch=repo.get("default_branch", "main"),
            user_id=current_user.id,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return {"project": _project_scalar_json(project)}
    except GitHubApiError as e:
        status = 401 if "token missing" in str(e).lower() else 500
        return _error_response(str(e), status)


@router.get("/{project_id}")
def get_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        return _error_response("Not found", 404)
    return {"project": _project_json(project, db, include_deployments=True)}


@router.post("/{project_id}/analyze")
def analyze_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        return _error_response("Not found", 404)

    try:
        contents = get_repo_contents(db, current_user.id, project.repo_owner, project.repo_name)
        readme = get_repo_readme(db, current_user.id, project.repo_owner, project.repo_name)

        signal = {
            "files": [item.get("name") for item in contents if item.get("name")],
            "readme": (readme or "")[:4000],
        }
        analyzed = analyze_repository(signal)
        result = analyzed["result"]
        raw = analyzed["raw"]

        analysis = db.query(Analysis).filter(Analysis.project_id == project.id).first()
        if not analysis:
            analysis = Analysis(project_id=project.id)
            db.add(analysis)

        analysis.runtime = result["runtime"]
        analysis.base_image = result["baseImage"]
        analysis.install_cmd = result["installCmd"]
        analysis.start_cmd = result["startCmd"]
        analysis.ports = ",".join(str(p) for p in result["ports"])
        analysis.needs_database = bool(result["needsDatabase"])
        analysis.needs_ingress = bool(result["needsIngress"])
        analysis.env_vars = result["envVars"]
        analysis.raw_response = raw if raw is not None else result

        db.commit()
        db.refresh(analysis)
        return {"analysis": _analysis_json(analysis)}
    except GitHubApiError as e:
        status = 401 if "token missing" in str(e).lower() else 500
        return _error_response(str(e), status)


@router.post("/{project_id}/auto-docker")
def auto_docker(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        return _error_response("Not found", 404)

    token = get_github_access_token(db, current_user.id)
    if not token:
        return _error_response("GitHub access token missing", 401)

    try:
        readme = get_repo_readme(db, current_user.id, project.repo_owner, project.repo_name)
        result = auto_analyze_and_push(token, project.repo_owner, project.repo_name, readme=readme)
        return result
    except Exception as e:
        message = str(e) or "Failed to generate Docker assets"
        status = 401 if "token missing" in message.lower() else 500
        return _error_response(message, status)


@router.post("/{project_id}/auto-yaml")
def auto_yaml(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        return _error_response("Not found", 404)

    token = get_github_access_token(db, current_user.id)
    if not token:
        return _error_response("GitHub access token missing", 401)

    try:
        readme = get_repo_readme(db, current_user.id, project.repo_owner, project.repo_name)
        result = auto_analyze_and_push_sealos(token, project.repo_owner, project.repo_name, readme)
        if result.get("error"):
            return _error_response(result["error"], 500)
        return result
    except Exception as e:
        message = str(e) or "Failed to generate Sealos YAML"
        status = 401 if "token missing" in message.lower() else 500
        return _error_response(message, status)


@router.post("/{project_id}/deploy")
def deploy_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        return _error_response("Missing analysis", 400)

    analysis = db.query(Analysis).filter(Analysis.project_id == project.id).first()
    if not analysis:
        return _error_response("Missing analysis", 400)

    if not current_user.kubeconfig:
        return _error_response(
            "Kubeconfig not configured — please paste your Sealos kubeconfig in the console first.",
            400,
        )

    ports = [int(x.strip()) for x in analysis.ports.split(",") if x.strip().isdigit()]
    main_port = ports[0] if ports else 3000

    app_name = slugify(project.name) or "project"
    domain = f"{app_name}.{settings.SEALOS_DOMAIN_SUFFIX}"

    env_var_map = None
    if isinstance(analysis.env_vars, dict):
        env_var_map = {k: str(v) for k, v in analysis.env_vars.items()}

    try:
        deploy_result = deploy_with_kubeconfig(
            kubeconfig_content=current_user.kubeconfig,
            name=app_name,
            image=analysis.base_image,
            port=main_port,
            enable_ingress=analysis.needs_ingress,
            domain=domain,
            env_vars=env_var_map,
            needs_database=analysis.needs_database,
        )
    except Exception as e:
        failed_results = [{"step": "deploy", "success": False, "message": str(e) or "Unknown error"}]
        deploy_result = {
            "status": "failed",
            "runtimeName": app_name,
            "ingressDomain": domain,
            "databaseName": f"{app_name}-db" if analysis.needs_database else None,
            "results": failed_results,
            "log": json.dumps(failed_results),
        }

    deployment = Deployment(
        project_id=project.id,
        status=deploy_result["status"],
        runtime_name=deploy_result["runtimeName"],
        ingress_domain=deploy_result["ingressDomain"],
        database_name=deploy_result["databaseName"],
        log=deploy_result["log"],
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    return {"deployment": _deployment_json(deployment), "results": deploy_result["results"]}


def _analysis_json(analysis: Analysis | None):
    if not analysis:
        return None
    return {
        "id": str(analysis.id),
        "projectId": str(analysis.project_id),
        "runtime": analysis.runtime,
        "baseImage": analysis.base_image,
        "installCmd": analysis.install_cmd,
        "startCmd": analysis.start_cmd,
        "ports": analysis.ports,
        "needsDatabase": analysis.needs_database,
        "needsIngress": analysis.needs_ingress,
        "envVars": analysis.env_vars,
        "rawResponse": analysis.raw_response,
    }


def _deployment_json(deployment: Deployment):
    return {
        "id": str(deployment.id),
        "projectId": str(deployment.project_id),
        "status": deployment.status,
        "runtimeName": deployment.runtime_name,
        "ingressDomain": deployment.ingress_domain,
        "databaseName": deployment.database_name,
        "log": deployment.log,
        "createdAt": deployment.created_at.isoformat() if deployment.created_at else None,
    }


def _project_json(project: Project, db: Session, include_deployments: bool = False):
    analysis = db.query(Analysis).filter(Analysis.project_id == project.id).first()
    deployments = []
    if include_deployments:
        deployments = db.query(Deployment).filter(Deployment.project_id == project.id).order_by(Deployment.created_at.desc()).all()

    payload = {
        "id": str(project.id),
        "name": project.name,
        "repoUrl": project.repo_url,
        "repoOwner": project.repo_owner,
        "repoName": project.repo_name,
        "visibility": project.visibility,
        "defaultBranch": project.default_branch,
        "userId": str(project.user_id),
        "createdAt": project.created_at.isoformat() if project.created_at else None,
        "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
        "analysis": _analysis_json(analysis),
    }
    if include_deployments:
        payload["deployments"] = [_deployment_json(d) for d in deployments]
    return payload


def _project_scalar_json(project: Project):
    return {
        "id": str(project.id),
        "name": project.name,
        "repoUrl": project.repo_url,
        "repoOwner": project.repo_owner,
        "repoName": project.repo_name,
        "visibility": project.visibility,
        "defaultBranch": project.default_branch,
        "userId": str(project.user_id),
        "createdAt": project.created_at.isoformat() if project.created_at else None,
        "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
    }

import base64
import json
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from sqlalchemy.orm import Session

from app.models.intellideploy.github_account import GitHubAccount


class GitHubApiError(Exception):
    pass


def _github_fetch(url: str, token: str, label: str) -> Dict[str, Any] | List[Any]:
    req = request.Request(
        url=url,
        method="GET",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "IntelliDeploy",
        },
    )
    try:
        with request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        raise GitHubApiError(f"GitHub API error ({label}): {e.code} {body[:200]}")
    except Exception as e:
        raise GitHubApiError(f"GitHub API network error ({label}): {e}")


def get_github_access_token(db: Session, user_id: int) -> Optional[str]:
    account = db.query(GitHubAccount).filter(GitHubAccount.user_id == user_id).first()
    return account.access_token if account else None


def upsert_github_access_token(db: Session, user_id: int, token: str) -> None:
    account = db.query(GitHubAccount).filter(GitHubAccount.user_id == user_id).first()
    if account:
        account.access_token = token
    else:
        account = GitHubAccount(user_id=user_id, access_token=token)
        db.add(account)
    db.commit()


def list_github_repos(db: Session, user_id: int):
    token = get_github_access_token(db, user_id)
    if not token:
        raise GitHubApiError("GitHub access token missing — please re-sign in with GitHub")

    return _github_fetch("https://api.github.com/user/repos?per_page=100&sort=updated", token, "listRepos")


def get_repo_contents(db: Session, user_id: int, owner: str, repo: str):
    token = get_github_access_token(db, user_id)
    if not token:
        raise GitHubApiError("GitHub access token missing — please re-sign in with GitHub")

    url = f"https://api.github.com/repos/{owner}/{repo}/contents"
    return _github_fetch(url, token, f"getContents({owner}/{repo})")


def get_repo_meta(db: Session, user_id: int, owner: str, repo: str):
    token = get_github_access_token(db, user_id)
    if not token:
        raise GitHubApiError("GitHub access token missing — please re-sign in with GitHub")

    url = f"https://api.github.com/repos/{owner}/{repo}"
    return _github_fetch(url, token, f"getRepoMeta({owner}/{repo})")


def get_repo_readme(db: Session, user_id: int, owner: str, repo: str) -> Optional[str]:
    token = get_github_access_token(db, user_id)
    if not token:
        return None

    try:
        data = _github_fetch(f"https://api.github.com/repos/{owner}/{repo}/readme", token, "readme")
        content = data.get("content") if isinstance(data, dict) else None
        if not content:
            return None
        return base64.b64decode(content).decode("utf-8", errors="ignore")
    except Exception:
        return None


def github_request_json(token: str, method: str, path_or_url: str, body: Optional[Dict[str, Any]] = None, allow_404: bool = False):
    url = path_or_url if path_or_url.startswith("http") else f"https://api.github.com{path_or_url}"
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(
        url=url,
        method=method,
        data=payload,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "aicd-auto",
        },
    )
    try:
        with request.urlopen(req, timeout=30) as resp:
            if resp.status == 204:
                return None
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as e:
        if allow_404 and e.code == 404:
            return None
        body_txt = ""
        try:
            body_txt = e.read().decode("utf-8")
        except Exception:
            body_txt = ""
        raise GitHubApiError(f"GitHub API request failed ({e.code}) for {url}: {body_txt[:300]}")

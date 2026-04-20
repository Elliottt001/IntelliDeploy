from urllib.parse import urlparse


def parse_repo_url(repo_url: str):
    try:
        parsed = urlparse(repo_url)
        if not parsed.scheme or not parsed.netloc:
            return None

        path = parsed.path.lstrip("/")
        parts = path.split("/")
        if len(parts) < 2:
            return None
        owner = parts[0]
        repo = parts[1].removesuffix(".git")
        if not owner or not repo:
            return None
        return {"owner": owner, "repo": repo}
    except Exception:
        return None

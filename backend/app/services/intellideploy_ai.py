import json
from typing import Any, Dict
from urllib import request

from app.config import settings


def _default_result() -> Dict[str, Any]:
    return {
        "runtime": "node",
        "baseImage": "node:20-alpine",
        "installCmd": "npm install",
        "startCmd": "npm run start",
        "ports": [3000],
        "needsDatabase": False,
        "needsIngress": True,
        "envVars": [],
    }


def _heuristic_analyze(signal: Dict[str, Any]) -> Dict[str, Any]:
    files = [f.lower() for f in signal.get("files", [])]
    file_set = set(files)

    if "go.mod" in file_set:
        return {
            "runtime": "go",
            "baseImage": "golang:1.22-alpine",
            "installCmd": "go mod download",
            "startCmd": "go run ./",
            "ports": [8080],
            "needsDatabase": ("migrations" in file_set) or ("sql" in file_set),
            "needsIngress": True,
            "envVars": [],
        }

    if "requirements.txt" in file_set or "pyproject.toml" in file_set:
        return {
            "runtime": "python",
            "baseImage": "python:3.12-slim",
            "installCmd": "pip install -r requirements.txt",
            "startCmd": "python app.py",
            "ports": [8000],
            "needsDatabase": ("migrations" in file_set) or ("sql" in file_set),
            "needsIngress": True,
            "envVars": [],
        }

    if "package.json" in file_set:
        return {
            "runtime": "node",
            "baseImage": "node:20-alpine",
            "installCmd": "npm install",
            "startCmd": "npm run start",
            "ports": [3000],
            "needsDatabase": ("prisma" in file_set) or ("drizzle" in file_set),
            "needsIngress": True,
            "envVars": [],
        }

    return _default_result()


def analyze_repository(signal: Dict[str, Any]):
    api_base = settings.MODEL_API or getattr(settings, "BASE_URL", "")
    api_key = settings.MODEL_KEY or getattr(settings, "API_KEY", "")
    model = settings.MODEL_NAME

    if not api_base or not api_key or not model:
        return {"result": _heuristic_analyze(signal), "raw": None}

    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "You analyze repo files to infer runtime, base image, install/start commands, ports, db and ingress needs. Reply with strict JSON matching schema: {runtime, baseImage, installCmd, startCmd, ports, needsDatabase, needsIngress, envVars}.",
            },
            {"role": "user", "content": json.dumps(signal)},
        ],
    }

    req = request.Request(
        url=f"{api_base.rstrip('/')}/v1/chat/completions",
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    try:
        with request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
        parsed = json.loads(content)
        required = ["runtime", "baseImage", "installCmd", "startCmd", "ports", "needsDatabase", "needsIngress", "envVars"]
        if not all(k in parsed for k in required):
            return {"result": _heuristic_analyze(signal), "raw": content}
        return {"result": parsed, "raw": content}
    except Exception:
        return {"result": _heuristic_analyze(signal), "raw": None}

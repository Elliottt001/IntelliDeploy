"""Export public API schemas without starting services or connecting to providers."""
import json
from pathlib import Path

from app.main import app


if __name__ == '__main__':
    destination=Path(__file__).resolve().parents[1]/'packages/api-client/openapi.json'
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(app.openapi(),ensure_ascii=False,indent=2)+'\n')

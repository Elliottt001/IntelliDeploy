from pathlib import Path
import tempfile

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import settings

router=APIRouter(tags=['health'])

def validate_production_configuration():
    if settings.ENVIRONMENT!='production': return
    from sqlalchemy.engine import make_url
    url=make_url(settings.DATABASE_URL)
    if (url.drivername!='postgresql+psycopg' or url.database in {None,'postgres','intellideploy_dev','intellideploy_test'}
        or len(settings.SECRET_KEY)<32 or settings.SECRET_KEY=='your-secret-key-change-in-production'):
        raise RuntimeError('Production requires a dedicated PostgreSQL database and a strong authentication secret')

def ready_status():
    from app.main import check_schema
    checks={'schema':False,'storage':False}
    try:
        check_schema()
        checks['schema']=True
    except Exception:
        pass
    try:
        roots={settings.ARTIFACTS_ROOT,settings.AGENT_WORKSPACE_ROOT,settings.INSTANCE_FILES_ROOT,settings.INSTANCE_SECRETS_ROOT,str(Path(settings.REPOSITORY_INDEX_PATH).parent)}
        for value in roots:
            root=Path(value)
            root.mkdir(parents=True,exist_ok=True,mode=0o700)
            with tempfile.TemporaryFile(dir=root) as probe:
                probe.write(b'health')
                probe.flush()
        checks['storage']=True
    except (OSError,ValueError):
        pass
    return {'ready':all(checks.values()),'checks':checks}

@router.get('/health/live')
def live(): return {'alive':True}

@router.get('/health/ready')
def ready():
    value=ready_status()
    return JSONResponse(value,status_code=200 if value['ready'] else 503)

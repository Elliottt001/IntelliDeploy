from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import engine
from app.routers.auth import router as auth_router
from app.apps.router import router as apps_router
from app.jobs.router import router as jobs_router


def check_schema():
    config=Config(str(Path(__file__).resolve().parents[1]/'alembic.ini'))
    heads=set(ScriptDirectory.from_config(config).get_heads())
    with engine.connect() as connection:
        current=set(MigrationContext.configure(connection).get_current_heads())
    if current!=heads or len(heads)!=1:
        raise RuntimeError('Database schema is behind; run alembic upgrade head')


@asynccontextmanager
async def lifespan(_app):
    check_schema()
    yield


app=FastAPI(title='IntelliDeploy API',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,allow_methods=['GET','POST','PUT','DELETE','OPTIONS'],
    allow_headers=['Authorization','Content-Type','Idempotency-Key','Last-Event-ID'])
app.include_router(auth_router)
app.include_router(apps_router)
app.include_router(jobs_router)


@app.middleware('http')
async def correlate(request,call_next):
    request.state.request_id=str(uuid4())
    response=await call_next(request)
    response.headers['X-Request-ID']=request.state.request_id
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request,exc):
    detail=exc.detail if isinstance(exc.detail,dict) and 'code' in exc.detail else {
        'code':{401:'UNAUTHORIZED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',402:'QUOTA_INSUFFICIENT',503:'UNAVAILABLE'}.get(exc.status_code,'REQUEST_FAILED'),
        'message':str(exc.detail),'retryable':exc.status_code==503}
    return JSONResponse(status_code=exc.status_code,content={'error':detail,'request_id':request.state.request_id},headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(request,exc):
    return JSONResponse(status_code=422,content={'error':{'code':'INVALID_REQUEST','message':'请求参数不符合要求','retryable':False},'request_id':request.state.request_id})


@app.get('/')
def root():
    return {'message':'IntelliDeploy API is running'}

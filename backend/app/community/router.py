from typing import Annotated
from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session
from app.community import service
from app.core.types import PublishRequest, PublicationPage, PublicationResponse, CopyRequest, CreateAppResponse
from app.database import get_db
from app.models.user import User
from app.utils.security import get_current_user

router=APIRouter(tags=['community'])
Key=Annotated[str,Header(alias='Idempotency-Key',min_length=1,max_length=200)]


@router.post('/api/apps/{app_id}/publish',response_model=PublicationResponse)
def publish(app_id:str,body:PublishRequest,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    publication=service.publish(db,app_id,user.id,body.version_id,body.payer_policy,sponsor_period=body.sponsor_period,sponsor_limit_units=body.sponsor_limit_units)
    db.commit()
    return service.public_response(db,publication)


@router.get('/api/community/apps',response_model=PublicationPage)
def listing(cursor:str|None=None,limit:int=Query(default=20,ge=1,le=100),db:Session=Depends(get_db)):
    return service.list_publications(db,cursor,limit)


@router.get('/api/publications/{publication_id}',response_model=PublicationResponse)
def detail(publication_id:str,db:Session=Depends(get_db)):
    return service.get_publication(db,publication_id)


@router.delete('/api/publications/{publication_id}')
def unpublish(publication_id:str,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    service.unpublish(db,publication_id,user.id); db.commit()
    return {'ok':True}


@router.get('/api/library/recent',response_model=PublicationPage)
def recent(cursor:str|None=None,limit:int=Query(default=20,ge=1,le=100),user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    return service.list_publications(db,cursor,limit,user_id=user.id,library='recent')


@router.get('/api/library/favorites',response_model=PublicationPage)
def favorites(cursor:str|None=None,limit:int=Query(default=20,ge=1,le=100),user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    return service.list_publications(db,cursor,limit,user_id=user.id,library='favorites')


@router.put('/api/library/favorites/{publication_id}')
def favorite(publication_id:str,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    service.set_favorite(db,user.id,publication_id,True); db.commit()
    return {'ok':True}


@router.delete('/api/library/favorites/{publication_id}')
def unfavorite(publication_id:str,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    service.set_favorite(db,user.id,publication_id,False); db.commit()
    return {'ok':True}


@router.post('/api/publications/{publication_id}/use',response_model=PublicationResponse)
def use(publication_id:str,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    public=service.record_use(db,user.id,publication_id); db.commit()
    return public

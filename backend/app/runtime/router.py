from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.apps.models import Instance, InstanceOperation
from app.core.types import DeleteInstanceRequest, InstanceOperationResponse, InstanceSnapshot
from app.database import get_db
from app.models.user import User
from app.runtime.operations import OperationConflict, request_instance_operation
from app.utils.security import get_current_user

router = APIRouter(tags=["runtime"])
Key = Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=200)]


def _owned(session: Session, instance_id: str, owner_id: int) -> Instance:
    instance = session.scalar(
        select(Instance).where(Instance.id == instance_id, Instance.owner_id == owner_id)
    )
    if instance is None:
        raise HTTPException(404, "instance not found")
    return instance


def _snapshot(session: Session, instance: Instance) -> InstanceSnapshot:
    active = session.scalar(
        select(InstanceOperation.id).where(
            InstanceOperation.instance_id == instance.id,
            InstanceOperation.status.in_(("QUEUED", "RUNNING")),
        )
    )
    status = {"DEPLOYING": "PENDING", "DELETING": "PENDING"}.get(
        instance.status, instance.status
    )
    return InstanceSnapshot(
        id=instance.id,
        status=status,
        desired_state=instance.desired_state,
        stop_reason=instance.stop_reason,
        url=instance.url,
        observed_at=instance.observed_at,
        active_operation_id=active,
    )


def _response(operation: InstanceOperation) -> InstanceOperationResponse:
    return InstanceOperationResponse(
        id=operation.id,
        instance_id=operation.instance_id,
        kind=operation.kind,
        status=operation.status,
        error=operation.error,
        created_at=operation.created_at,
        updated_at=operation.updated_at,
    )


def _request(session, instance_id, owner_id, kind, key, delete_data=False):
    try:
        return request_instance_operation(
            session, instance_id, owner_id, kind, key, delete_data
        )
    except LookupError as exc:
        raise HTTPException(404, "instance not found") from exc
    except OperationConflict as exc:
        raise HTTPException(
            409,
            {"code": "INSTANCE_OPERATION_CONFLICT", "message": str(exc), "retryable": False},
        ) from exc


@router.get("/api/instances/{instance_id}", response_model=InstanceSnapshot)
def get_instance(
    instance_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _snapshot(db, _owned(db, instance_id, user.id))


@router.post(
    "/api/instances/{instance_id}/start",
    response_model=InstanceOperationResponse,
    status_code=202,
)
def start_instance(
    instance_id: str,
    key: Key,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _response(_request(db, instance_id, user.id, "START", key))


@router.post(
    "/api/instances/{instance_id}/stop",
    response_model=InstanceOperationResponse,
    status_code=202,
)
def stop_instance(
    instance_id: str,
    key: Key,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _response(_request(db, instance_id, user.id, "STOP", key))


@router.delete(
    "/api/instances/{instance_id}",
    response_model=InstanceOperationResponse,
    status_code=202,
)
def delete_instance(
    instance_id: str,
    body: DeleteInstanceRequest,
    key: Key,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.confirmation != "DELETE":
        raise HTTPException(
            409,
            {
                "code": "DELETE_CONFIRMATION_REQUIRED",
                "message": "需要精确输入 DELETE 并明确数据删除选项",
                "retryable": False,
            },
        )
    return _response(
        _request(db, instance_id, user.id, "DELETE", key, body.delete_data)
    )


@router.get(
    "/api/instance-operations/{operation_id}",
    response_model=InstanceOperationResponse,
)
def get_operation(
    operation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    operation = db.scalar(
        select(InstanceOperation).where(
            InstanceOperation.id == operation_id,
            InstanceOperation.owner_id == user.id,
        )
    )
    if operation is None:
        raise HTTPException(404, "instance operation not found")
    return _response(operation)

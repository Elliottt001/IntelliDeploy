import pytest
from sqlalchemy import select, func
from app.jobs.models import Job
from app.runtime.models import ResourceRecord
from app.billing.models import UnknownUsage
from test_default_execution import new_job as new_job


def pending_call(session_factory, job_id, *, state='REQUESTED', terminal=True):
    operation = f'model:{job_id}:audit:0'
    with session_factory() as session:
        job = session.get(Job, job_id)
        if terminal:
            job.status = 'CANCELLED'
        metadata = {'request_hash':'a'*64,'reservation_operation_id':f'job:{job_id}','private_source':'must-not-leak'}
        if state == 'METERED':
            metadata['response'] = {'usage_known':True,'input_tokens':20,'output_tokens':5,'cached_input_tokens':0,'assistant_message':{'content':'must-not-leak'}}
        session.add(ResourceRecord(type='MODEL_CALL',job_id=job_id,app_id=job.app_id,operation_id=operation,state=state,reference=operation,metadata_json=metadata))
        session.commit()
    return operation


def test_model_audit_is_readonly_and_projects_no_response(new_job, session_factory):
    from scripts.reconcile_model_usage import reconcile_model_usage
    job_id, _, _, _ = new_job
    operation = pending_call(session_factory, job_id)
    with session_factory() as session:
        rows = reconcile_model_usage(session, job_id)
        assert rows[0]['state'] == 'REQUESTED'
        assert rows[0]['operation_id'] == operation
        assert 'must-not-leak' not in str(rows)
        assert session.scalar(select(func.count()).select_from(UnknownUsage)) == 0


def test_explicit_unknown_reconciliation_is_idempotent(new_job, session_factory):
    from scripts.reconcile_model_usage import reconcile_model_usage
    job_id, _, _, _ = new_job
    operation = pending_call(session_factory, job_id)
    for _ in range(2):
        with session_factory() as session:
            rows = reconcile_model_usage(session, job_id, mark_unknown=True, operation_id=operation, expected_request_hash='a'*64)
            session.commit()
            assert rows[0]['state'] == 'UNKNOWN'
            assert rows[0]['known_token_usage'] is None
    with session_factory() as session:
        assert session.scalar(select(func.count()).select_from(UnknownUsage).where(UnknownUsage.operation_id==operation)) == 1
        assert session.get(Job,job_id).used_units == 0


@pytest.mark.parametrize('state,terminal,hash_value', [('METERED',True,'a'*64),('REQUESTED',False,'a'*64),('REQUESTED',True,'b'*64)])
def test_reconciliation_refuses_known_running_or_changed_calls(new_job, session_factory, state, terminal, hash_value):
    from scripts.reconcile_model_usage import reconcile_model_usage
    job_id, _, _, _ = new_job
    operation = pending_call(session_factory, job_id, state=state, terminal=terminal)
    with session_factory() as session:
        with pytest.raises(ValueError):
            reconcile_model_usage(session,job_id,mark_unknown=True,operation_id=operation,expected_request_hash=hash_value)
        assert session.scalar(select(ResourceRecord).where(ResourceRecord.operation_id==operation)).state == state
        assert session.scalar(select(func.count()).select_from(UnknownUsage)) == 0

"""Audit model request uncertainty without replaying the provider or inventing fees."""
from __future__ import annotations

import argparse
import json
import os

from sqlalchemy import select, text

from app.database import SessionLocal
from app.jobs.models import Job
from app.jobs.execution import record_model_uncertainty
from app.runtime.models import ResourceRecord


def reconcile_model_usage(session, job_id, *, mark_unknown=False, operation_id=None,
                          expected_request_hash=None):
    if mark_unknown and (not operation_id or not expected_request_hash):
        raise ValueError('an explicit operation and expected request hash are required')
    job_query = select(Job).where(Job.id == job_id)
    job = session.scalar(job_query.with_for_update() if mark_unknown else job_query)
    if job is None:
        raise LookupError('job does not exist')
    if mark_unknown and job.status not in {'FAILED', 'CANCELLED', 'PAUSED_QUOTA'}:
        raise ValueError('a running or successful job cannot be reconciled this way')
    query = select(ResourceRecord).where(ResourceRecord.job_id == job_id,
                                        ResourceRecord.type == 'MODEL_CALL')
    if operation_id:
        query = query.where(ResourceRecord.operation_id == operation_id)
    records = list(session.scalars(query.with_for_update() if mark_unknown else query.order_by(ResourceRecord.created_at)))
    if mark_unknown:
        if len(records) != 1:
            raise LookupError('model operation does not belong to this job')
        record = records[0]
        if record.metadata_json.get('request_hash') != expected_request_hash:
            raise ValueError('request hash changed')
        if not record_model_uncertainty(session, record, 'operator_reconciliation'):
            raise ValueError('a received or metered response must not be replaced by uncertainty')
    rows = []
    for record in records:
        response = record.metadata_json.get('response') or {}
        rows.append({
            'operation_id': record.operation_id,
            'state': record.state,
            'request_hash': record.metadata_json.get('request_hash'),
            'provider_request_id': response.get('provider_request_id'),
            'known_token_usage': ({key: response.get(key, 0) for key in
                                   ['input_tokens', 'cached_input_tokens', 'output_tokens']}
                                  if response.get('usage_known') else None),
        })
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--job-id', required=True)
    parser.add_argument('--operation-id')
    parser.add_argument('--expected-request-hash')
    parser.add_argument('--mark-unknown', action='store_true')
    args = parser.parse_args(argv)
    if not os.environ.get('DATABASE_URL'):
        raise SystemExit('Set DATABASE_URL explicitly for the identified database.')
    with SessionLocal() as session:
        if not args.mark_unknown:
            session.execute(text('SET TRANSACTION READ ONLY'))
        rows = reconcile_model_usage(session, args.job_id, mark_unknown=args.mark_unknown,
                                     operation_id=args.operation_id,
                                     expected_request_hash=args.expected_request_hash)
        if args.mark_unknown:
            session.commit()
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

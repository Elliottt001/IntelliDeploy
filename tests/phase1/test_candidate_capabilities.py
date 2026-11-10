from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from sqlalchemy import select
from app.apps.models import App, Instance
from app.jobs.models import Job
from app.models.user import User
from app.runtime.models import ResourceRecord
from test_capability_identity import identity_keys as identity_keys


def test_candidate_other_identity_uses_job_parent_budget(
    session_factory, identity_keys, monkeypatch
):
    from app.capabilities.identity import (
        issue_app_identity,
        provision_instance_credential,
        resolve_context,
        IdentityError,
    )
    from app.capabilities.search import _reserve_operation, _reservation_id
    from app.billing.ledger import grant, reserve
    from app.billing.models import Reservation, PriceRule
    from app.config import settings

    monkeypatch.setattr(settings, "CAPABILITY_RESERVATION_UNITS", 20)
    with session_factory() as session:
        owner = User(
            username="candidate-owner-" + uuid4().hex,
            email=uuid4().hex + "@test",
            hashed_password="test-only",
        )
        other = User(
            username="candidate-other-" + uuid4().hex,
            email=uuid4().hex + "@test",
            hashed_password="test-only",
        )
        session.add_all([owner, other])
        session.flush()
        grant(session, owner.id, "candidate", 1000, "FREE")
        app = App(owner_id=owner.id, name="notes", prompt="notes")
        session.add(app)
        session.flush()
        instance = Instance(
            owner_id=owner.id, app_id=app.id, kind="CANDIDATE", status="RUNNING"
        )
        session.add(instance)
        session.flush()
        job = Job(
            app_id=app.id,
            kind="GENERATE",
            status="RUNNING",
            lease_owner="worker",
            lease_generation=1,
            lease_until=datetime.now(timezone.utc) + timedelta(minutes=5),
            budget_units=100,
            operation_id=uuid4().hex,
        )
        session.add(job)
        session.flush()
        parent = reserve(session, owner.id, f"job:{job.id}", 100)
        job.reservation_id = parent.id
        credential = provision_instance_credential(session, instance.id)
        session.add(
            PriceRule(
                kind="search.success",
                version=settings.PRICE_VERSION,
                numerator=1,
                denominator=1,
            )
        )
        record = ResourceRecord(
            type="CANDIDATE_RUNTIME",
            job_id=job.id,
            app_id=app.id,
            operation_id="candidate-" + uuid4().hex,
            reference=instance.id,
            state="RUNNING",
            metadata_json={
                "owner_id": owner.id,
                "other_id": other.id,
                "worker_id": "worker",
                "generation": 1,
                "reservation_operation_id": parent.operation_id,
                "anonymous_allowed": False,
            },
        )
        session.add(record)
        session.commit()
        token = issue_app_identity(other.id, app.id, instance.id)
        context = resolve_context(session, instance.id, token, credential)
        assert (
            context.payer_id == owner.id
            and context.reservation_operation_id == parent.operation_id
        )
    _reserve_operation(
        context,
        "candidate-search",
        "fingerprint",
        ("search.success",),
        session_factory=session_factory,
    )
    with session_factory() as session:
        assert (
            session.scalar(
                select(Reservation).where(
                    Reservation.operation_id == _reservation_id("candidate-search")
                )
            )
            is None
        )
        job = session.get(Job, job.id)
        job.lease_generation = 2
        session.commit()
        with pytest.raises(IdentityError):
            resolve_context(session, instance.id, token, credential)

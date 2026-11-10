from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.types import UsageInput
from app.billing.ledger import (
    grant,
    reserve,
    record_usage,
    settle,
    refund,
    balance,
    InsufficientQuota,
)
from app.billing.models import PriceRule, QuotaGrant, UsageEntry


@pytest.fixture
def account(session_factory):
    from app.models.user import User

    with session_factory() as session:
        user = User(
            username="ledger-owner", email="ledger@test", hashed_password="test-only"
        )
        session.add(user)
        session.flush()
        grant(session, user.id, "initial", 100, "PURCHASE", None)
        session.add(
            PriceRule(kind="model.input", version="test-v1", numerator=1, denominator=1)
        )
        session.commit()
        return user.id


def test_concurrent_reservation_never_overdraws(session_factory, account):
    def hold(operation):
        with session_factory() as session:
            try:
                reserve(session, account, operation, 80)
                session.commit()
                return True
            except InsufficientQuota:
                session.rollback()
                return False

    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(hold, ["job-a", "job-b"])) == [False, True]
    with session_factory() as session:
        assert balance(session, account) == {
            "available_units": 20,
            "reserved_units": 80,
        }


def test_usage_consumes_parent_once_and_settlement_releases_remainder(
    session_factory, account
):
    with session_factory() as session:
        reserve(session, account, "job", 80)
        usage = UsageInput(
            operation_id="call-1",
            payer_id=account,
            kind="model.input",
            units=30,
            price_version="test-v1",
            reservation_operation_id="job",
        )
        first = record_usage(session, usage)
        session.commit()
        again = record_usage(session, usage)
        assert again.id == first.id
        assert balance(session, account) == {
            "available_units": 20,
            "reserved_units": 50,
        }
        settle(session, "job")
        settle(session, "job")
        session.commit()
        assert balance(session, account) == {"available_units": 70, "reserved_units": 0}


def test_expired_grants_cannot_be_reserved_and_expiring_grant_is_spent_first(
    session_factory, account
):
    with session_factory() as session:
        grant(
            session,
            account,
            "expired",
            1000,
            "FREE",
            datetime.now(timezone.utc) - timedelta(seconds=1),
        )
        expiring = grant(
            session,
            account,
            "early",
            20,
            "SUBSCRIPTION",
            datetime.now(timezone.utc) + timedelta(days=1),
        )
        reserve(session, account, "job", 30)
        record_usage(
            session,
            UsageInput(
                operation_id="call",
                payer_id=account,
                kind="model.input",
                units=25,
                price_version="test-v1",
                reservation_operation_id="job",
            ),
        )
        session.flush()
        session.refresh(expiring)
        assert expiring.balance_units == 0
        assert balance(session, account)["available_units"] == 90


def test_refund_is_idempotent_and_never_erases_original_usage(session_factory, account):
    with session_factory() as session:
        usage = record_usage(
            session,
            UsageInput(
                operation_id="call",
                payer_id=account,
                kind="model.input",
                units=30,
                price_version="test-v1",
            ),
        )
        session.commit()
        refund(session, "call", 20, "平台故障")
        refund(session, "call", 20, "平台故障")
        session.commit()
        assert balance(session, account) == {"available_units": 90, "reserved_units": 0}
        assert len(list(session.scalars(select(UsageEntry)))) == 2


def test_replayed_usage_with_changed_content_is_rejected(session_factory, account):
    from app.billing.ledger import LedgerConflict

    with session_factory() as session:
        record_usage(
            session,
            UsageInput(
                operation_id="call",
                payer_id=account,
                kind="model.input",
                units=10,
                price_version="test-v1",
            ),
        )
        with pytest.raises(LedgerConflict):
            record_usage(
                session,
                UsageInput(
                    operation_id="call",
                    payer_id=account,
                    kind="model.input",
                    units=11,
                    price_version="test-v1",
                ),
            )


def test_registration_and_resume_use_real_quota(
    api_client, owner_headers, session_factory
):
    from app.jobs.models import Job

    response = api_client.get("/api/quota/balance", headers=owner_headers)
    assert response.status_code == 200
    assert response.json()["available_units"] > 0
    created = api_client.post(
        "/api/apps",
        headers={**owner_headers, "Idempotency-Key": "create"},
        json={"prompt": "保存笔记", "budget_units": 100},
    ).json()
    with session_factory() as session:
        job = session.get(Job, created["job_id"])
        job.status = "PAUSED_QUOTA"
        session.commit()
    headers = {**owner_headers, "Idempotency-Key": "resume"}
    resumed = api_client.post(
        "/api/jobs/" + created["job_id"] + "/resume",
        headers=headers,
        json={"budget_units": 50},
    )
    assert resumed.status_code == 202 and resumed.json()["job_id"] == created["job_id"]
    assert (
        api_client.post(
            "/api/jobs/" + created["job_id"] + "/resume",
            headers=headers,
            json={"budget_units": 50},
        ).json()
        == resumed.json()
    )
    assert (
        api_client.get("/api/quota/balance", headers=owner_headers).json()[
            "reserved_units"
        ]
        == 50
    )


def test_expiry_does_not_invalidate_already_reserved_units(session_factory, account):
    with session_factory() as session:
        reserve(session, account, "job", 40)
        initial = session.scalar(
            select(QuotaGrant).where(
                QuotaGrant.payer_id == account, QuotaGrant.grant_key == "initial"
            )
        )
        initial.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        record_usage(
            session,
            UsageInput(
                operation_id="after-expiry",
                payer_id=account,
                kind="model.input",
                units=10,
                price_version="test-v1",
                reservation_operation_id="job",
            ),
        )
        settle(session, "job")
        session.commit()
        assert balance(session, account) == {"available_units": 0, "reserved_units": 0}


def test_price_rounding_is_integer_and_missing_price_does_not_charge(
    session_factory, account
):
    from fastapi import HTTPException

    with session_factory() as session:
        session.add(
            PriceRule(kind="fraction", version="test-v1", numerator=1, denominator=10)
        )
        row = record_usage(
            session,
            UsageInput(
                operation_id="round",
                payer_id=account,
                kind="fraction",
                units=11,
                price_version="test-v1",
            ),
        )
        assert row.cost_units == 2
        with pytest.raises(HTTPException) as error:
            record_usage(
                session,
                UsageInput(
                    operation_id="missing",
                    payer_id=account,
                    kind="unknown",
                    units=20,
                    price_version="test-v1",
                ),
            )
        assert error.value.status_code == 503
        assert balance(session, account)["available_units"] == 98


def test_resume_cannot_raise_total_budget_above_hard_cap(
    api_client, owner_headers, session_factory, monkeypatch
):
    from app.config import settings
    from app.jobs.models import Job

    monkeypatch.setattr(settings, "HARD_CAP_UNITS", 100)
    one = api_client.post(
        "/api/apps",
        headers={**owner_headers, "Idempotency-Key": "cap"},
        json={"prompt": "abc", "budget_units": 100},
    ).json()
    with session_factory() as session:
        job = session.get(Job, one["job_id"])
        job.used_units = 80
        job.status = "PAUSED_QUOTA"
        session.commit()
    response = api_client.post(
        "/api/jobs/" + one["job_id"] + "/resume",
        headers={**owner_headers, "Idempotency-Key": "raise"},
        json={"budget_units": 50},
    )
    assert response.status_code == 422


def test_default_budget_is_bounded_by_available_quota(
    api_client, owner_headers, session_factory
):
    from app.jobs.models import Job

    one = api_client.post(
        "/api/apps",
        headers={**owner_headers, "Idempotency-Key": "default"},
        json={"prompt": "abc"},
    ).json()
    available = api_client.get("/api/quota/balance", headers=owner_headers).json()[
        "available_units"
    ]
    with session_factory() as session:
        assert session.get(Job, one["job_id"]).budget_units <= available


def test_period_grant_is_issued_once(session_factory, account):
    from app.billing.ledger import grant_period

    start = datetime(2026, 11, 1, tzinfo=timezone.utc)
    end = datetime(2026, 12, 1, tzinfo=timezone.utc)
    with session_factory() as session:
        first = grant_period(session, account, "monthly-v1", 20, start, end, "FREE")
        second = grant_period(session, account, "monthly-v1", 20, start, end, "FREE")
        assert first.id == second.id
        assert balance(session, account)["available_units"] == 120


def test_cached_and_uncached_input_are_settled_once_from_the_same_parent(
    session_factory, account
):
    with session_factory() as session:
        session.add_all([
            PriceRule(kind="cache-test.input", version="test-v1", numerator=1, denominator=10),
            PriceRule(kind="cache-test.cached", version="test-v1", numerator=1, denominator=30),
            PriceRule(kind="cache-test.output", version="test-v1", numerator=1, denominator=5),
        ])
        parent = reserve(session, account, "cache-job", 20)
        # 80 prompt tokens = 50 uncached + 30 cached, plus 20 output tokens.
        usages = [
            UsageInput(operation_id="uncached", payer_id=account, kind="cache-test.input", units=50, price_version="test-v1", reservation_operation_id="cache-job"),
            UsageInput(operation_id="cached", payer_id=account, kind="cache-test.cached", units=30, price_version="test-v1", reservation_operation_id="cache-job"),
            UsageInput(operation_id="output", payer_id=account, kind="cache-test.output", units=20, price_version="test-v1", reservation_operation_id="cache-job"),
        ]
        ids = [record_usage(session, usage).id for usage in usages]
        assert [record_usage(session, usage).id for usage in usages] == ids
        assert parent.used_units == 10
        settle(session, "cache-job")
        session.commit()
        assert balance(session, account) == {"available_units": 90, "reserved_units": 0}

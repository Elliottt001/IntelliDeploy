from app.billing.models import ProductSku


def test_public_catalog_is_anonymous_filters_disabled_and_matches_private_catalog(
    api_client, owner_headers, session_factory
):
    with session_factory() as session:
        session.add_all(
            [
                ProductSku(id="cny-pack", name="基础额度包", provider="alipay", currency="CNY", amount_minor=9900, units=10000, period=None, enabled=True),
                ProductSku(id="usd-monthly", name="月度套餐", provider="stripe", currency="USD", amount_minor=1900, units=30000, period="MONTH", enabled=True),
                ProductSku(id="hidden", name="未发布套餐", provider="wechat", currency="CNY", amount_minor=1, units=1, period=None, enabled=False),
            ]
        )
        session.commit()

    public = api_client.get("/api/catalog/skus")
    assert public.status_code == 200
    assert [item["id"] for item in public.json()] == ["cny-pack", "usd-monthly"]
    assert all(
        set(item)
        == {"id", "name", "provider", "currency", "amount_minor", "units", "period"}
        for item in public.json()
    )

    assert api_client.get("/api/quota/skus").status_code == 401
    private = api_client.get("/api/quota/skus", headers=owner_headers)
    assert private.status_code == 200
    assert private.json() == public.json()

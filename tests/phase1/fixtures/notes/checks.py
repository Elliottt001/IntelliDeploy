from __future__ import annotations


def persistence_checks(content: str = "test-run-note") -> list[dict]:
    return [
        {
            "item_id": "persist",
            "actor": "owner",
            "expected": "note survives browser and service restart",
            "actions": [
                {"type": "goto", "path": "/"},
                {"type": "fill", "selector": "#note", "value": content},
                {"type": "click", "selector": "#save"},
                {"type": "expect_text", "selector": "#notes", "text": content},
                {"type": "reload"},
                {"type": "expect_text", "selector": "#notes", "text": content},
                {"type": "restart_service", "service": "web"},
                {"type": "reload"},
                {"type": "expect_text", "selector": "#notes", "text": content},
            ],
        }
    ]

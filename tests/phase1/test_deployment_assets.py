from app.core.types import RetrievalCandidate


def candidate(body):
    return RetrievalCandidate(repo_url='https://github.com/example/notes',commit='a'*40,
        file_tree=['README.md','compose.yml','deploy.sh'],key_files={'README.md':body,
        'compose.yml':'services:\n  web:\n    image: example/notes:1','deploy.sh':'#!/bin/sh\necho ready'})


def test_demo_does_not_become_official_service():
    from app.agent.deployment_assets import discover_deployment_assets
    assets=discover_deployment_assets(candidate('Live demo: https://demo.example/'))
    assert {a.kind for a in assets}=={'DEMO','COMPOSE','SCRIPT','IMAGE'}
    assert all(a.source_ref and len(a.source_digest)==64 for a in assets)


def test_official_service_requires_source_label_not_arbitrary_link():
    from app.agent.deployment_assets import discover_deployment_assets
    assets=discover_deployment_assets(candidate('Official hosted service: [Use notes](https://notes.example/)\nDocumentation: https://docs.example/'))
    assert [a.location for a in assets if a.kind=='OFFICIAL_SERVICE']==['https://notes.example/']


def test_non_http_and_deploy_buttons_are_not_running_services():
    from app.agent.deployment_assets import discover_deployment_assets
    assets=discover_deployment_assets(candidate('Official service: javascript:alert(1)\nDeploy on Cloud: https://cloud.example/new'))
    assert not any(a.kind=='OFFICIAL_SERVICE' for a in assets)
    assert any(a.kind=='INSTALL_DOC' for a in assets)

import pytest
from app.core.types import RetrievalCandidate
from test_candidate_ranking import profile


def test_official_compose_wins_over_generated_dockerfile():
    from app.agent.deployment_assets import discover_deployment_assets
    from app.agent.contracts import ReuseDecision
    from app.runtime.official_deployment import plan_official_deployment, compose_manifest
    body='services:\n  web:\n    image: example/notes:1\n    ports: ["8080:3000"]\n    volumes: ["notes:/data"]\nvolumes:\n  notes: {}'
    p=profile('notes');p.deployment_assets=discover_deployment_assets(RetrievalCandidate(repo_url=p.repo_url,commit=p.commit,
        key_files={'compose.yml':body},file_tree=['compose.yml']))
    d=ReuseDecision(delivery_kind='HOSTED_INSTANCE',route='DEPLOY_EXISTING',deployment_asset=p.deployment_assets[0])
    plan=plan_official_deployment(p,d)
    assert plan.kind=='COMPOSE'
    manifest=compose_manifest(body)
    assert manifest.services[0].volumes=={'notes':'/data'}
    assert manifest.builds==[]


def test_privileged_compose_is_not_silently_simplified():
    from app.runtime.official_deployment import compose_manifest, OfficialDeploymentUnsupported
    with pytest.raises(OfficialDeploymentUnsupported):
        compose_manifest('services:\n  web:\n    image: example/notes:1\n    ports: ["8080:3000"]\n    privileged: true')


def test_official_command_and_nonsecret_environment_survive_rendering():
    from app.runtime.official_deployment import compose_manifest
    from app.runtime.linux import render_compose
    body='services:\n  web:\n    image: example/notes@sha256:'+'a'*64+'\n    ports: ["8080:3000"]\n    command: ["node", "server.js"]\n    environment: {NODE_ENV: production}'
    manifest=compose_manifest(body)
    rendered=render_compose(manifest,'test-instance',{})
    assert rendered['services']['web']['command']==['node','server.js']
    assert rendered['services']['web']['environment']['NODE_ENV']=='production'

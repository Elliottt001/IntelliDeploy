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


def test_author_homepage_survives_github_search_and_is_unverified_asset():
    from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient
    from app.agent.retrieval import normalize_candidate
    from app.agent.deployment_assets import discover_deployment_assets
    source=GitHubRepositorySearchClient._candidate_from_search_item({'full_name':'example/editor',
        'html_url':'https://github.com/example/editor','homepage':'https://editor.example/'})
    source.commit='a'*40
    value=RetrievalCandidate.model_validate(normalize_candidate(source))
    assert value.homepage=='https://editor.example/'
    from app.agent.retrieval import _merge_rows
    assert _merge_rows([('github',value.model_dump())])[0].homepage==value.homepage
    assets=discover_deployment_assets(value)
    assert assets[0].kind=='OFFICIAL_SERVICE'
    assert assets[0].verification_status=='NOT_RUN'


import pytest


@pytest.mark.asyncio
async def test_github_reader_pins_commit_not_tree_sha(monkeypatch):
    from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient
    from app.agent_core.brains.context_rag_agent import RepositoryCandidate
    client=GitHubRepositorySearchClient();refs=[]
    async def request(path,**kwargs):
        if '/commits/' in path:return {'sha':'c'*40}
        if '/git/trees/' in path:return {'sha':'a'*40,'tree':[]}
        return []
    async def attach(owner,ref,candidate):refs.append(ref)
    monkeypatch.setattr(client,'_request_json',request)
    monkeypatch.setattr(client,'_attach_readme',attach)
    monkeypatch.setattr(client,'_attach_key_files',attach)
    value=await client.enrich_repository(RepositoryCandidate(full_name='example/notes',default_branch='main'))
    assert value.commit=='c'*40
    assert refs==['c'*40,'c'*40]


@pytest.mark.asyncio
async def test_empty_repository_commit_resolution_keeps_empty_rejection(monkeypatch):
    import httpx
    from unittest.mock import AsyncMock
    from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient, EmptyRepository
    original=httpx.AsyncClient
    transport=httpx.MockTransport(lambda request:httpx.Response(409,json={'message':'Git Repository is empty.'}))
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:original(transport=transport,**kwargs))
    pool=AsyncMock();pool._tokens=[];pool.acquire_token.return_value=None
    client=GitHubRepositorySearchClient(token_pool=pool)
    with pytest.raises(EmptyRepository):
        await client._request_json('/repos/example/empty/commits/main')


@pytest.mark.asyncio
async def test_nested_docs_cannot_displace_root_official_compose(monkeypatch):
    import base64
    from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient
    from app.agent_core.brains.context_rag_agent import RepositoryCandidate
    from app.agent.deployment_assets import discover_deployment_assets
    from app.agent.retrieval import normalize_candidate
    client = GitHubRepositorySearchClient()
    value = RepositoryCandidate(full_name='example/editor', repo_url='https://github.com/example/editor',
        html_url='https://github.com/example/editor', default_branch='main', commit='a' * 40,
        file_tree=[f'assets/{i}/LICENSE' for i in range(20)] + ['desktop-app/docker-compose.yml', 'docker-compose.yml'])
    async def request(path, **kwargs):
        body = 'services:\n  web:\n    image: example/editor:1\n    ports: ["8080:80"]' if path.endswith('/docker-compose.yml') else 'license'
        return {'content': base64.b64encode(body.encode()).decode()}
    monkeypatch.setattr(client, '_request_json', request)
    await client._attach_key_files('example/editor', 'a' * 40, value)
    assert 'docker-compose.yml' in value.key_files
    assets = discover_deployment_assets(RetrievalCandidate.model_validate(normalize_candidate(value)))
    assert next(a for a in assets if a.kind == 'COMPOSE').location == 'docker-compose.yml'

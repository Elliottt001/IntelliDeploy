import pytest
from app.config import settings


def test_full_storage_rejects_new_workspace_and_keeps_existing_progress(tmp_path,monkeypatch):
    from app.agent.workspace import WorkspaceManager
    manager=WorkspaceManager(tmp_path)
    existing=tmp_path/'paused'; existing.mkdir(); (existing/'checkpoint').write_text('keep')
    monkeypatch.setattr(settings,'WORKSPACE_MIN_FREE_MB',10**12)
    with pytest.raises(ValueError): manager.create_workspace('new-job')
    assert (existing/'checkpoint').read_text()=='keep'
    assert not (tmp_path/'new-job').exists()
    assert manager.create_workspace('paused')==str(existing)

import os
import stat
from pathlib import Path
import pytest


def test_missing_loop_nodes_are_prepared_without_replacing_existing(tmp_path,monkeypatch):
    from app.runner.quota import ensure_loop_nodes
    existing=tmp_path/'loop0'
    existing.write_text('placeholder')
    original=Path.stat
    def file_stat(path,*args,**kwargs):
        if path==existing:
            from types import SimpleNamespace
            return SimpleNamespace(st_mode=stat.S_IFBLK,st_rdev=os.makedev(7,0))
        return original(path,*args,**kwargs)
    monkeypatch.setattr(Path,'stat',file_stat)
    created=[]
    monkeypatch.setattr(os,'mknod',lambda path,mode,device:created.append((Path(path).name,mode,device)))
    ensure_loop_nodes(tmp_path,slots=10)
    assert [row[0] for row in created]==[f'loop{i}' for i in range(1,10)]
    assert all(stat.S_ISBLK(mode) and os.major(device)==7 for _,mode,device in created)


def test_loop_node_preparation_refuses_unexpected_existing_path(tmp_path):
    from app.runner.quota import ensure_loop_nodes
    (tmp_path/'loop0').write_text('must remain')
    with pytest.raises(RuntimeError):
        ensure_loop_nodes(tmp_path,slots=1)
    assert (tmp_path/'loop0').read_text()=='must remain'

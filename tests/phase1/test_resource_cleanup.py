from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import select

from app.apps.models import AppVersion
from app.config import settings
from app.jobs.models import Job
from app.runtime.models import ResourceRecord


@pytest.fixture
def cleanup_context(session_factory,job_factory,tmp_path,monkeypatch):
    root=tmp_path/'workspaces'; root.mkdir()
    artifacts=tmp_path/'artifacts'; artifacts.mkdir()
    monkeypatch.setattr(settings,'AGENT_WORKSPACE_ROOT',str(root))
    monkeypatch.setattr(settings,'ARTIFACTS_ROOT',str(artifacts))
    now=datetime.now(timezone.utc)
    job=job_factory(status='FAILED')
    with session_factory() as session:
        session.get(Job,job.id).updated_at=now-timedelta(days=10)
        session.commit()
    return session_factory,job,root,now


def workspace(context):
    from app.runtime.cleanup import register_resource
    factory,job,root,now=context
    path=root/job.id; path.mkdir(exist_ok=True); (path/'source.txt').write_text('owned source')
    with factory() as session:
        row=register_resource(session,'WORKSPACE','workspace:'+job.id,str(path),job_id=job.id,app_id=job.app_id)
        row.created_at=row.last_seen_at=now-timedelta(days=10)
        session.commit()
        return row.id,path


def test_cleanup_preserves_paused_tasks_version_sources_and_all_user_data(cleanup_context):
    from app.runtime.cleanup import plan_cleanup
    factory,job,root,now=cleanup_context
    resource_id,path=workspace(cleanup_context)
    with factory() as session:
        session.get(Job,job.id).status='PAUSED_QUOTA'
        assert plan_cleanup(session,now)==[]
        session.get(Job,job.id).status='FAILED'
        session.get(Job,job.id).updated_at=now-timedelta(days=10)
        session.add(AppVersion(app_id=job.app_id,requirement_revision=1,manifest={},validation={},artifact_path=str(path/'source.zip')))
        session.add(ResourceRecord(type='DATA',operation_id='data',state='STOPPED',reference=str(root/'private-data'),metadata_json={'managed':True},created_at=now-timedelta(days=90),last_seen_at=now-timedelta(days=90)))
        session.flush()
        assert plan_cleanup(session,now)==[]


def test_candidate_race_resource_has_ttl_and_cleanup_state(cleanup_context):
    from app.runtime.cleanup import (
        mark_candidate_race_cleanup,
        register_candidate_race_resource,
    )

    factory, job, _, _ = cleanup_context
    with factory() as session:
        resource = register_candidate_race_resource(
            session,
            job_id=job.id,
            app_id=job.app_id,
            candidate_id="candidate-one",
            ttl_seconds=600,
        )
        session.commit()
        assert resource.type == "CANDIDATE_RUNTIME"
        assert resource.metadata_json["race_candidate"] is True
        assert resource.metadata_json["ttl_seconds"] == 600
        mark_candidate_race_cleanup(session, "candidate-one", "STOPPED")
        session.commit()
        assert resource.state == "STOPPED"
        assert resource.metadata_json["cleanup_state"] == "STOPPED"


@pytest.mark.asyncio
async def test_new_version_reference_cancels_a_preplanned_cleanup(cleanup_context):
    from app.runtime.cleanup import plan_cleanup,execute_cleanup
    from app.runtime.models import CleanupAction
    factory,job,_,now=cleanup_context
    resource_id,path=workspace(cleanup_context)
    with factory() as session:
        actions=plan_cleanup(session,now); session.commit(); action_id=actions[0].id
        session.add(AppVersion(app_id=job.app_id,requirement_revision=1,manifest={},validation={},artifact_path=str(path/'source.zip')))
        session.commit()
    await execute_cleanup(action_id,session_factory=factory)
    with factory() as session:
        assert session.get(CleanupAction,action_id).status=='CANCELLED'
    assert path.is_dir()


@pytest.mark.asyncio
async def test_local_cleanup_confirms_removal_and_refuses_symlink_escape(cleanup_context,tmp_path):
    from app.runtime.cleanup import plan_cleanup,execute_cleanup
    from app.runtime.models import CleanupAction
    factory,_,_,now=cleanup_context
    _,path=workspace(cleanup_context)
    with factory() as session:
        action=plan_cleanup(session,now)[0]; session.commit(); action_id=action.id
    await execute_cleanup(action_id,session_factory=factory,adapter=LocalOnly())
    assert not path.exists()
    with factory() as session:
        assert session.get(CleanupAction,action_id).status=='DELETED'
    outside=tmp_path/'outside'; outside.mkdir(); (outside/'private').write_text('preserve')
    path.symlink_to(outside,target_is_directory=True)
    from app.runtime.cleanup import register_resource
    with factory() as session:
        row=register_resource(session,'WORKSPACE','symlink:'+path.name,str(path),job_id=cleanup_context[1].id,app_id=cleanup_context[1].app_id)
        row.created_at=row.last_seen_at=now-timedelta(days=10)
        session.commit()
        action=plan_cleanup(session,now)[0]; session.commit(); unsafe_id=action.id
    await execute_cleanup(unsafe_id,session_factory=factory,adapter=LocalOnly())
    with factory() as session:
        assert session.get(CleanupAction,unsafe_id).status=='UNKNOWN'
    assert (outside/'private').read_text()=='preserve'


@pytest.mark.asyncio
async def test_cleanup_works_with_production_expiring_sessions(cleanup_context):
    from sqlalchemy.orm import sessionmaker
    from app.runtime.cleanup import plan_cleanup,execute_cleanup
    factory,_,_,now=cleanup_context
    _,path=workspace(cleanup_context)
    with factory() as session:
        action=plan_cleanup(session,now)[0]; action_id=action.id; session.commit()
    expiring=sessionmaker(bind=factory.kw['bind'],expire_on_commit=True)
    await execute_cleanup(action_id,session_factory=expiring,adapter=LocalOnly())
    assert not path.exists()


class LocalOnly:
    async def inspect(self,resource): return {'exists':False}
    async def remove(self,resource): raise AssertionError('No external deletion is needed')


@pytest.mark.asyncio
async def test_remote_loss_after_delete_is_unknown_then_reconciles_without_duplicate_effect(cleanup_context):
    from app.runtime.cleanup import register_resource,plan_cleanup,execute_cleanup
    from app.runtime.models import CleanupAction
    factory,job,_,now=cleanup_context
    with factory() as session:
        row=register_resource(session,'CANDIDATE_RUNTIME','runtime:'+job.id,'instance-fixture',job_id=job.id,app_id=job.app_id,
            metadata={'instance_id':'instance-fixture'})
        row.created_at=row.last_seen_at=now-timedelta(hours=2)
        session.commit(); resource_id=row.id
        action=plan_cleanup(session,now)[0]; session.commit(); action_id=action.id
    class Remote:
        exists=True
        async def inspect(self,resource):
            return {'exists':self.exists,'labels':{'managed':True,'job_id':job.id,'operation_id':'runtime:'+job.id,'instance_id':'instance-fixture'}}
        async def remove(self,resource):
            self.exists=False
            raise ConnectionError('Remote response was lost')
    remote=Remote()
    await execute_cleanup(action_id,session_factory=factory,adapter=remote)
    with factory() as session:
        assert session.get(CleanupAction,action_id).status=='UNKNOWN'
    await execute_cleanup(action_id,session_factory=factory,adapter=remote)
    with factory() as session:
        assert session.get(ResourceRecord,resource_id).state=='DELETED'


@pytest.mark.asyncio
async def test_foreign_remote_labels_block_cleanup(cleanup_context):
    from app.runtime.cleanup import register_resource,plan_cleanup,execute_cleanup
    from app.runtime.models import CleanupAction
    factory,job,_,now=cleanup_context
    with factory() as session:
        row=register_resource(session,'CANDIDATE_RUNTIME','runtime:'+job.id,'foreign-instance',job_id=job.id,app_id=job.app_id)
        row.created_at=row.last_seen_at=now-timedelta(hours=2)
        session.commit()
        action=plan_cleanup(session,now)[0]; session.commit(); action_id=action.id
    class Foreign:
        async def inspect(self,resource): return {'exists':True,'labels':{'managed':True,'job_id':'foreign','operation_id':resource.operation_id}}
        async def remove(self,resource): raise AssertionError('Must not remove a foreign resource')
    await execute_cleanup(action_id,session_factory=factory,adapter=Foreign())
    with factory() as session:
        assert session.get(CleanupAction,action_id).status=='UNKNOWN'


@pytest.mark.asyncio
async def test_expired_candidate_runtime_is_not_destroyed_without_control_plane_reference_check(tmp_path):
    import json,time
    from uuid import uuid4
    from app.runner.runtimes import ContainerRuntimes
    runtimes=ContainerRuntimes(tmp_path,'candidate.test')
    id=str(uuid4()); root=tmp_path/id; root.mkdir()
    marker=root/'live-container'; marker.write_text('still needed')
    (root/'runtime.json').write_text(json.dumps({'id':id,'state':'RUNNING','expires_at':time.time()-60}))
    (root/'compose.json').write_text('{}')
    async def destructive_command(*args,**kwargs): marker.unlink(); return ''
    runtimes.command=destructive_command
    await runtimes.cleanup_expired()
    assert marker.exists()


@pytest.mark.asyncio
async def test_failed_candidate_stop_preserves_data_until_remote_state_is_known(cleanup_context):
    from types import SimpleNamespace
    from uuid import uuid4
    from app.apps.models import Instance
    from app.capabilities.models import InstanceDataSpace
    from app.runtime.candidate_execution import CandidateExecution
    factory,job,_,_=cleanup_context
    id=str(uuid4())
    with factory() as session:
        from app.apps.models import App
        owner=session.get(App,job.app_id).owner_id
        session.add(Instance(id=id,owner_id=owner,app_id=job.app_id,kind='CANDIDATE',status='RUNNING'))
        session.add(ResourceRecord(type='CANDIDATE_RUNTIME',operation_id='runtime:'+id,reference=id,state='RUNNING',job_id=job.id,app_id=job.app_id,metadata_json={'other_id':owner,'managed':True}))
        session.add(InstanceDataSpace(instance_id=id,database_name='test_candidate',role_name='test_role',secret_ref='test-ref'))
        session.commit()
    class Offline:
        async def stop(self,*args): raise ConnectionError('Runner unavailable')
    class Data:
        def destroy(self,instance_id,confirmed):
            with factory() as session:
                session.get(InstanceDataSpace,instance_id).destroyed_at=datetime.now(timezone.utc); session.commit()
    execution=CandidateExecution.__new__(CandidateExecution)
    execution.execution=SimpleNamespace(runner=Offline(),sessions=factory)
    execution.configuration=SimpleNamespace(data_manager=Data()); execution.controllers={}
    with pytest.raises(ConnectionError): await execution.stop(id)
    with factory() as session:
        assert session.get(InstanceDataSpace,id).destroyed_at is None
        assert session.get(Instance,id).status!='DELETED'

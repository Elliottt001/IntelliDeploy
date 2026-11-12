"""Run with platform-server OS permissions: python -m app.admin.cli ..."""
import argparse
import asyncio
import json
import sys

from sqlalchemy import select

from app.admin import service
from app.billing.models import PriceRule, ProductSku
from app.database import SessionLocal
from app.jobs.models import Job


def parser():
    root=argparse.ArgumentParser(description='IntelliDeploy local administration')
    groups=root.add_subparsers(dest='group',required=True)
    targets=groups.add_parser('targets').add_subparsers(dest='action',required=True)
    add=targets.add_parser('add'); add.add_argument('--id',required=True); add.add_argument('--kind',choices=['linux','kubernetes'],required=True); add.add_argument('--config-file',required=True)
    for name in ('check','disable'):
        targets.add_parser(name).add_argument('--id',required=True)
    targets.add_parser('list')
    prices=groups.add_parser('prices').add_subparsers(dest='action',required=True)
    prices.add_parser('import').add_argument('--file',required=True); prices.add_parser('list')
    developer=groups.add_parser('users').add_subparsers(dest='section',required=True).add_parser('developer').add_subparsers(dest='action',required=True)
    for action in ('grant','revoke'): developer.add_parser(action).add_argument('--user-id',required=True,type=int)
    jobs=groups.add_parser('jobs').add_subparsers(dest='action',required=True); jobs.add_parser('inspect').add_argument('--id',required=True)
    maintenance=groups.add_parser('maintenance').add_subparsers(dest='action',required=True)
    for action in ('status','run-once','drain','resume'): maintenance.add_parser(action)
    cleanup=groups.add_parser('cleanup').add_subparsers(dest='action',required=True)
    cleanup.add_parser('plan'); cleanup.add_parser('run').add_argument('--action-id')
    cleanup.add_parser('register').add_argument('--file',required=True)
    return root


def _json_file(name):
    from pathlib import Path
    return json.loads(Path(name).read_text())


async def execute(args,session_factory):
    with session_factory() as session:
        if args.group=='targets':
            if args.action=='add': service.add_target(session,args.id,args.kind,_json_file(args.config_file)); result={'id':args.id,'health':'UNKNOWN'}
            elif args.action=='disable': service.disable_target(session,args.id); result={'id':args.id,'enabled':False}
            elif args.action=='check': result=await service.check_target(session,args.id)
            else: result=service.list_targets(session)
        elif args.group=='prices':
            if args.action=='import': result=service.import_catalog(session,_json_file(args.file))
            else:
                result={'prices':[{k:getattr(p,k) for k in ('kind','version','numerator','denominator')} for p in session.scalars(select(PriceRule))],
                    'skus':[{k:getattr(s,k) for k in ('id','name','provider','currency','amount_minor','units','period','enabled')} for s in session.scalars(select(ProductSku))]}
        elif args.group=='users': service.set_developer(session,args.user_id,args.action=='grant'); result={'user_id':args.user_id,'is_developer':args.action=='grant'}
        elif args.group=='jobs':
            job=session.get(Job,args.id)
            if not job: raise ValueError('Unknown job')
            result={key:getattr(job,key) for key in ('id','app_id','kind','status','phase','used_units','budget_units')}
            result['error_code']=(job.error or {}).get('code')
            result['version_id']=(job.result or {}).get('version_id')
            result['report_url']='/api/jobs/'+job.id+'/report'
            from app.runtime.models import ResourceRecord
            result['resources']=[{'id':r.id,'type':r.type,'state':r.state,'operation_id':r.operation_id}
                for r in session.scalars(select(ResourceRecord).where(ResourceRecord.job_id==job.id).limit(100))]
        elif args.group=='cleanup':
            from datetime import datetime,timezone
            from app.runtime.cleanup import register_resource,plan_cleanup,execute_cleanup
            if args.action=='register':
                data=_json_file(args.file)
                if set(data)-{'type','operation_id','reference','job_id','app_id','metadata'}: raise ValueError('Unexpected resource registration fields')
                row=register_resource(session,**data); result={'resource_id':row.id}
                service.audit(session,'cleanup.register',row.id)
            else:
                actions=plan_cleanup(session,datetime.now(timezone.utc)); ids=[a.id for a in actions]
                session.commit()
                if args.action=='run':
                    for id in ([args.action_id] if args.action_id else ids): await execute_cleanup(id,session_factory=session_factory)
                    service.audit(session,'cleanup.run',args.action_id or 'planned')
                    session.expire_all()
                result=[{'action_id':a.id,'resource_id':a.resource_id,'status':a.status,'reason':a.reason} for a in actions]
        elif args.action=='run-once':
            from datetime import datetime,timezone
            from app.jobs.maintenance import run_maintenance_once
            session.commit()
            await run_maintenance_once(datetime.now(timezone.utc),session_factory=session_factory)
            result=service.maintenance_status(session)
        elif args.action in {'drain','resume'}: service.set_drain(session,args.action=='drain'); result={'claims_paused':args.action=='drain'}
        else:
            result=service.maintenance_status(session)
            result['runner']=await service.runner_status()
        session.commit()
        return result


def main(argv=None,session_factory=SessionLocal):
    args=parser().parse_args(argv)
    try:
        result=asyncio.run(execute(args,session_factory))
        print(json.dumps(result,ensure_ascii=False,default=str))
        return 0
    except Exception as exc:
        # Config/provider exceptions may contain credentials; never print their text.
        print(json.dumps({'error':type(exc).__name__,'message':'Management operation failed; verify registered configuration and permissions'}),file=sys.stderr)
        return 1

if __name__=='__main__': raise SystemExit(main())

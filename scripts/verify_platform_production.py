"""Read-only public platform checks. Restore, node and business drills remain separate evidence."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import httpx


def _origin(value):
    parsed=urlsplit(value)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {'','/'}:
        raise ValueError('Register an HTTPS platform origin')
    return value.rstrip('/')


def verify_platform(base_url,api_url,*,client=None):
    web,api=_origin(base_url),_origin(api_url)
    owned=client is None
    client=client or httpx.Client(timeout=10,follow_redirects=False)
    checks={}
    requests=[('api_live',api+'/health/live'),('api_ready',api+'/health/ready'),('web_login',web+'/login'),('api_auth_boundary',api+'/api/apps')]
    try:
        for name,url in requests:
            try:
                response=client.get(url)
                if name=='api_auth_boundary': passed=response.status_code==401
                elif name=='web_login': passed=response.status_code==200 and 'text/html' in response.headers.get('content-type','')
                else: passed=response.status_code==200 and response.json().get('alive' if name=='api_live' else 'ready') is True
                checks[name]={'status':'PASS' if passed else 'FAIL','http_status':response.status_code}
            except (httpx.HTTPError,ValueError): checks[name]={'status':'FAIL','reason':'request_failed'}
    finally:
        if owned: client.close()
    return {'time':datetime.now(timezone.utc).isoformat(),'platform_ready':all(c['status']=='PASS' for c in checks.values()),
        'checks':checks,'production_acceptance':'NOT_RUN','remaining':['restart_and_queue_recovery','persistent_data_restore','executor_network_and_quota','linux_sealos_app_business_checks']}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',required=True); parser.add_argument('--api-url',required=True)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    try: report=verify_platform(args.base_url,args.api_url)
    except ValueError: parser.error('Use registered HTTPS platform and API origins')
    output=args.output or Path('artifacts/platform-verification')/uuid4().hex/'report.json'
    output.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    descriptor=os.open(output,os.O_CREAT|os.O_WRONLY|os.O_TRUNC,0o600)
    with os.fdopen(descriptor,'w') as file: json.dump(report,file,ensure_ascii=False,indent=2)
    print(json.dumps({'platform_ready':report['platform_ready'],'production_acceptance':report['production_acceptance'],'report':str(output)}))
    return 0 if report['platform_ready'] else 1

if __name__=='__main__': raise SystemExit(main())

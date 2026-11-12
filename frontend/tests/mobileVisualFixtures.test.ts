import {execFileSync} from 'node:child_process';
import {expect,test} from 'vitest';
import {visualJobStates,makeVisualApp,visualPublication,visualRankingPublications,visualProductApps,visualStorePublications,visualCommunityPublications} from '../e2e/mobileVisualFixtures';
const python=process.env.INTELLIDEPLOY_DTO_PYTHON;
const validate=(payload:unknown)=>execFileSync(python!,['-c',`import json,sys
from app.core.types import AppDetail,AppSummary,PublicationResponse
p=json.load(sys.stdin)
for app in p['apps']: AppDetail.model_validate(app)
for app in p.get('summaries',[]): AppSummary.model_validate(app)
for publication in p['publications']: PublicationResponse.model_validate(publication)
print('VALID')`],{input:JSON.stringify(payload),env:{...process.env,PYTHONPATH:'../backend'},encoding:'utf8',stdio:['pipe','pipe','pipe']});
test.skipIf(!python)(`${python?'':'NOT_RUN without INTELLIDEPLOY_DTO_PYTHON: '}every formal visual fixture passes the real public Pydantic DTO and success delivery validator`,()=>{
 expect(validate({apps:visualJobStates.map(([number,status,phase])=>makeVisualApp(number,status,phase)),summaries:visualProductApps,publications:[visualPublication('one'),...visualRankingPublications,...visualStorePublications,...visualCommunityPublications]}).trim()).toBe('VALID');
 const success=makeVisualApp(58,'SUCCEEDED','verifying_live');expect(success.active_job).toBeNull();expect(success.delivery).toEqual(success.latest_job?.result);expect(success.delivery?.url).toMatch(/^http:\/\/127\.0\.0\.1:9199\//);
});
test.skipIf(!python)(`${python?'':'NOT_RUN without INTELLIDEPLOY_DTO_PYTHON: '}the validator rejects CREATE kind, null phase and success without a delivery`,()=>{
 const valid=makeVisualApp(48,'QUEUED','clarifying');for(const job of [{...valid.active_job,kind:'CREATE'},{...valid.active_job,phase:null},{...valid.active_job,status:'SUCCEEDED',result:null}])expect(()=>validate({apps:[{...valid,active_job:job}],publications:[]})).toThrow();
});

test('portable typed fixtures retain real job phases and matching success delivery semantics',()=>{for(const[number,status,phase]of visualJobStates){const app=makeVisualApp(number,status,phase),job=app.latest_job!;expect(job.kind).toBe('GENERATE');expect(typeof job.phase).toBe('string');expect(job.phase.length).toBeGreaterThan(0);expect(job.status).toBe(status);expect(app.delivery).toEqual(job.result);expect(Boolean(job.result)).toBe(status==='SUCCEEDED');}});

// This boundary catches accidental imports of design examples into public API fixtures.
test('visual API scenarios stay within IntelliDeploy apps and do not carry foreign projects or design installation claims',()=>{
 const payload=JSON.stringify({apps:visualProductApps,publications:[...visualRankingPublications,...visualStorePublications,...visualCommunityPublications],details:visualJobStates.map(([number,status,phase])=>makeVisualApp(number,status,phase))});
 expect(payload).not.toMatch(/Pawzzle|Vora|Wonder Garden|Li Wei|Chen Mo|Python 3\.9\.18|torch==|8\/8|\uFEFF/);
 for(const publication of visualRankingPublications)expect(publication.creator).not.toBe(publication.name);
});

import {renderToStaticMarkup} from 'react-dom/server';
import {expect,test,vi} from 'vitest';
import DeliveryCard from '../components/DeliveryCard';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
test('official link renders directly without hosted instance controls',()=>{
 const app:any={id:'app',instance_status:null,delivery:{kind:'EXTERNAL_LINK',url:'https://notes.example/',
  repo_url:'https://github.com/example/notes',summary:'官方笔记',features:['保存笔记'],differences:['界面不同'],report_url:'/api/jobs/job/report'}};
 const html=renderToStaticMarkup(<DeliveryCard app={app}/>);
 expect(html).toContain('打开官方服务');
 expect(html).toContain('href="https://notes.example/"');
 expect(html).toContain('第三方官方服务');
 expect(html).toContain('界面不同');
 expect(html).not.toContain('下载源码');
});

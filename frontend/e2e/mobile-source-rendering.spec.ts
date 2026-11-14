import {makeVisualApp,visualRankingPublications} from './mobileVisualFixtures';
import {expect,test} from '@playwright/test';
import {catXml} from '../screens/login/generated/loginSvgAssets';
import {readFile} from 'node:fs/promises';
import {effectSupport} from '../design/sourceEffectSupport';
import {sourceNode} from '../tests/figmaSource';
test('Mibo composer preserves its source first-line baseline independently of the 44pt input target', async ({ page }) => {
 const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
 test.skip(!source, 'Requires the original Figma source for the composer parent-chain audit');
 const document = JSON.parse(await readFile(`${source}/design-data/document.kiwi.json`, 'utf8'));
 const node = (id: string) => document.nodeChanges.find((n: {guid: {sessionID: number; localID: number}}) => `${n.guid.sessionID}:${n.guid.localID}` === id);
 const parent = (n: ReturnType<typeof node>) => node(`${n.parentIndex.guid.sessionID}:${n.parentIndex.guid.localID}`);
 const sourceBaselines = ['845:3532','846:3597','849:3661','849:3758','849:3847','849:3936','849:4025','852:4114','852:4203','852:4295','852:4445'].map(id => {
  const text = node(id), content = parent(text), shell = parent(content);
  expect(content.transform.m12, `${id} content offset`).toBe(7);
  expect(text.transform.m12, `${id} text offset`).toBe(8);
  expect(shell.transform.m12, `${id} composer origin`).toBe(729);
  return shell.transform.m12 + content.transform.m12 + text.transform.m12 + text.derivedTextData.baselines[0].position.y;
 });
 for (const baseline of sourceBaselines) expect(baseline).toBeCloseTo(760.3199996948242, 6);
 await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
 await page.route('**/auth/me', r => r.fulfill({ json: { id: 1, username: '真实名字' } }));
 await page.route('**/api/quota/**', r => r.fulfill({ json: { available_units: 900, reserved_units: 0, default_budget_units: 100, hard_cap_units: 1000, price_version: 'fixture', failed_usage_rule: '失败按实际用量结算', items: [] } }));
 await page.goto('/chatbot');
 const input = page.getByTestId('create-prompt');
 await input.fill('首行\n第二行');
 await input.blur();
 // A textarea cannot contain an inline baseline marker. Use its measured
 // native font/line box/padding in a DOM line box, then remove that probe.
 const baseline = await input.evaluate(element => {
  const style = getComputedStyle(element), box = element.getBoundingClientRect(), probe = document.createElement('div');
  Object.assign(probe.style, { position: 'absolute', left: `${box.x}px`, top: `${box.y}px`, width: style.width, boxSizing: style.boxSizing, font: style.font, lineHeight: style.lineHeight, padding: style.padding, border: style.border, whiteSpace: 'nowrap', visibility: 'hidden' });
  probe.textContent = (element as HTMLTextAreaElement).value[0];
  const marker = document.createElement('span');
  marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  probe.append(marker); document.body.append(probe);
  const result = marker.getBoundingClientRect().y;
  probe.remove(); return result;
 });
 // The expected baseline comes from the actual11source parent chains above.
 expect(Math.abs(baseline - sourceBaselines[0])).toBeLessThan(1 / 32);
 expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await expect(input).toHaveValue('首行\n第二行');
});
test('expanding the personal home card uses its actual alternate source atmosphere and restores on collapse', async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
 await page.route('**/auth/me', r => r.fulfill({ json: { id: 1, username: '真实名字' } }));
 await page.goto('/');
 const atmosphere = page.getByTestId('mobile-source-atmosphere').locator('g[clip-path]').first();
 await page.getByTestId('home-card-profile').click();
 await expect(atmosphere).toHaveAttribute('transform', 'translate(230 -134)'); // Kiwi268:23926.
 await page.getByTestId('home-card-profile').click();
 await expect(atmosphere).toHaveAttribute('transform', 'translate(-96 76.99995422363281)');
});
test('expanded Gallery retains its editable source folded front independently of catalog data', async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem('token', 'fixture-token'));
 await page.route('**/auth/me', r => r.fulfill({ json: { id: 1, username: '真实名字' } }));
 await page.goto('/');
 await page.getByTestId('home-card-store').click();
 const front = page.locator('path[data-source-node="268:23090"]');
 await expect(front).toHaveCount(2); // Actual Kiwi fill15617 and stroke15618.
 await expect.poll(async()=>front.first().evaluate(element => {
  const m = (element as SVGPathElement).getScreenCTM()!;
  return { x: m.e, y: m.f };
 })).toMatchObject({x:expect.closeTo(28,1),y:expect.closeTo(414,1)}); // Card328 + bag56 + front30 after the source transition.
 await expect(page.getByTestId('home-card-store-open')).toBeVisible();
});
test('home static question uses its actual ten native source glyphs while the greeting retains API username',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));let username='真实名字';await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username}}));await page.goto('/');const greeting=page.getByText('Hi！真实名字✨',{exact:true});await expect(greeting).toBeVisible();const question=page.getByTestId('home-question');await expect(question.locator('path')).toHaveCount(10);const box=(await question.boundingBox())!;expect(box.y).toBeCloseTo(130,2);await expect(page.getByLabel('今天又有什么新想法？',{exact:true})).toBeVisible();
 const baseline=await greeting.evaluate(element=>{const marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';element.append(marker);const result={baseline:marker.getBoundingClientRect().top-element.parentElement!.getBoundingClientRect().top,font:getComputedStyle(element).font,height:element.getBoundingClientRect().height};marker.remove();return result;});console.info('Actual Expo greeting font metrics',JSON.stringify(baseline));expect(baseline.baseline).toBeCloseTo(27.200000762939453,3);username='Grace';await page.goto('/');const latin=page.getByText('Hi！Grace✨',{exact:true});await expect(latin).toBeVisible();const latinBaseline=await latin.evaluate(element=>{const marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';element.append(marker);const y=marker.getBoundingClientRect().top-element.parentElement!.getBoundingClientRect().top;marker.remove();return y;});expect(latinBaseline).toBeCloseTo(27.200000762939453,3);
});
test('short actual multiline reply uses the native source body origin and 35 then 36pt row advance',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));const app=makeVisualApp(52,'RUNNING','building');await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));await page.goto('/app-detail/app');
 const reply=page.getByTestId('latest-assistant-reply');expect((await reply.boundingBox())!.x).toBeCloseTo(126,2);
 const lines=reply.getByTestId(/^assistant-reply-line-/);await expect(lines).toHaveCount(3);for(const [index,y] of [451,486,522].entries())expect((await lines.nth(index).boundingBox())!.y).toBeCloseTo(y,2);
 expect((await lines.allTextContents()).join('')).toBe(app.conversation.at(-1)!.content);await expect(page.getByText('Mibo 最新回复',{exact:true})).toBeVisible();
});
test('validating and deploying actual short replies use their source 441pt origin and 36pt advances',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));let app=makeVisualApp(53,'RUNNING','validating');await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));
 for(const [number,phase] of [[53,'validating'],[54,'deploying']] as const){app=makeVisualApp(number,'RUNNING',phase);await page.goto('/app-detail/app');const lines=page.getByTestId(/^assistant-reply-line-/);await expect(lines).toHaveCount(3);for(const [index,y] of [441,477,513].entries())expect((await lines.nth(index).boundingBox())!.y).toBeCloseTo(y,2);expect((await lines.allTextContents()).join('')).toBe(app.conversation.at(-1)!.content);await expect(page.getByText('Mibo 最新回复',{exact:true})).toBeVisible();}
});
test('detailed actual reply places the native source body at 74,450 and keeps its caption above the surface',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));const app=makeVisualApp(55,'RUNNING','building');await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));await page.goto('/app-detail/app');const body=page.getByTestId('latest-assistant-reply'),box=(await body.boundingBox())!;expect(box.x).toBeCloseTo(74,2);const logicalY=await body.evaluate(element=>{const transform=getComputedStyle(element).transform;return element.getBoundingClientRect().y-(transform==='none'?0:new DOMMatrix(transform).m42);});expect(logicalY).toBeCloseTo(450,2);expect(box.width).toBeCloseTo(230,2);await expect(body).toHaveCSS('line-height','19px');await expect(body).toHaveText(app.conversation.at(-1)!.content);await expect(page.getByText('Mibo 最新回复',{exact:true})).toBeVisible();
 const metrics=await body.evaluate(element=>{const marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';element.prepend(marker);const result={baseline:marker.getBoundingClientRect().top-element.getBoundingClientRect().top,font:getComputedStyle(element).font};marker.remove();return result;});console.info('Actual Expo detailed reply font metrics',JSON.stringify(metrics));expect(box.y+metrics.baseline).toBeCloseTo(450+13.819999694824219,3);
});
test('successful actual reply uses the visible 4391 source cat and actual conversation anchor',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));const app=makeVisualApp(58,'SUCCEEDED','verifying_live');await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));await page.goto('/app-detail/app');const cat=(await page.getByTestId('mibo-cat').boundingBox())!,canvas=(await page.getByTestId('mibo-art-canvas').boundingBox())!;expect(cat.x-canvas.x).toBe(99);expect(cat.y-canvas.y+137).toBe(166);expect(cat.width).toBe(178);expect(cat.height).toBe(154);
 const body=page.getByTestId('latest-assistant-reply'),box=(await body.boundingBox())!;expect(box.x).toBe(74);const logicalY=await body.evaluate(element=>{const transform=getComputedStyle(element).transform;return element.getBoundingClientRect().y-(transform==='none'?0:new DOMMatrix(transform).m42);});expect(logicalY).toBeCloseTo(455,2);await expect(body).toHaveCSS('line-height','19px');await expect(body).toHaveText(app.conversation.at(-1)!.content);await expect(page.getByText('Mibo 最新回复',{exact:true})).toBeVisible();await expect(page.getByTestId('open-app')).toHaveCount(1);
});
test('actual conversation bytes remain raw even with doubled FEFF and long multiline replies',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));
 const app=makeVisualApp(55,'RUNNING','building');
 const content='实际后端回复：\r\n\uFEFF\uFEFF保留原文，不添加列表\r\n- 用户原有列表\r\n```text\r\n完整消息第 5 行\r\n```\r\n第 7 行\r\n第 8 行\r\n第 9 行\r\n第 10 行\r\n第 11 行\r\n末行';
 app.conversation.at(-1)!.content=content;
 await page.route('**/api/apps/app',r=>r.fulfill({json:app}));
 await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));
 await page.goto('/app-detail/app');
 const body=page.getByTestId('latest-assistant-reply');
 expect(await body.textContent()).toBe(content);
 await expect(body).toHaveAttribute('aria-label',content);
 await expect(body.locator('svg')).toHaveCount(0);
 await expect(page.getByText('Mibo 最新回复',{exact:true})).toBeVisible();
 await page.getByTestId('chatbot-settings').click();
 await page.getByTestId('conversation-toggle').click();
 await expect(page.getByText('笔记工具 · 需求与调整',{exact:true})).toBeVisible();
 await expect(page.getByText(content,{exact:true})).toHaveCount(2);
});
test('working Mibo artwork follows the actual phase and multiline public reply geometry',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));
 let app=makeVisualApp(49,'RUNNING','clarifying');await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));
 for(const [phase,reply,x,y] of [['clarifying','',94,154],['building','',94,188],['building','真实回复第一行\n真实回复第二行\n真实回复第三行',94,188],['building','真实回复第一行\n真实回复第二行\n真实回复第三行\n真实回复第四行',101,164]] as const){app=makeVisualApp(49,'RUNNING',phase);app.conversation=reply?[{id:'reply',role:'assistant',sequence:1,content:reply,created_at:'2026-11-10T00:00:00Z'}]:[];await page.goto('/app-detail/app');const cat=page.getByTestId('mibo-cat');await expect(cat).toBeVisible();const box=await cat.boundingBox(),canvas=await page.getByTestId('mibo-art-canvas').boundingBox();expect(box!.x-canvas!.x).toBe(x);expect(box!.y-canvas!.y+137).toBe(y);}
});
test('short public Mibo replies use source readable 14pt copy while detailed replies retain their 12pt surface',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));let app=makeVisualApp(49,'RUNNING','clarifying');await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));
 for(const [number,size,color] of [[49,'14px','rgb(107, 114, 128)'],[55,'12px','rgb(127, 128, 161)']] as const){app=makeVisualApp(number,'RUNNING','building');await page.goto('/app-detail/app');await expect(page.getByText('Mibo 最新回复',{exact:true})).toBeVisible();const body=number===49?page.getByTestId('assistant-reply-line-0'):page.getByTestId('latest-assistant-reply');await expect(body).toHaveCSS('font-size',size);await expect(body).toHaveCSS('color',color);}
});
test('closed home card paint overflows its source 70pt advance without overlapping action targets',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis'}}));await page.goto('/');
 const first=page.getByTestId('home-card-store');const shell=first.locator('..');await expect(shell).toHaveCSS('overflow','visible');expect((await first.boundingBox())!.height).toBe(70);await expect(shell.locator('svg').first()).toHaveAttribute('height','195');
});
test('home card surface preserves the three actual source inner shadow paints',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis'}}));await page.goto('/');
 const path=page.getByTestId('home-card-store-shell').locator('path[data-source-node="270:26347"]').first();const group=path.locator('xpath=ancestor::*[@filter][1]');await expect(group).toHaveAttribute('filter',/home-store-effect/);const filter=await group.getAttribute('filter');await expect(page.locator(filter!.slice(4,-1)).locator('feComposite[operator=\"arithmetic\"]')).toHaveCount(3);
});
test('home static Gallery and product copy uses the original glyph paints and source offsets',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis'}}));await page.goto('/');
 await expect(page.getByLabel('发现优秀应用，提升效率',{exact:true})).toBeVisible();const title=page.getByTestId('home-products-source-title');await expect(title.locator('path')).toHaveCount(4);const box=await title.boundingBox(),card=await page.getByTestId('home-card-products').boundingBox();expect(box!.y-card!.y).toBeCloseTo(12,2);
});
test('home brand paint and bottom navigation centers preserve the actual source positions',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis'}}));await page.goto('/');
 const brand=page.getByLabel('INTELLIDEPLOY',{exact:true}).locator('svg').first();expect((await brand.boundingBox())!.y).toBeCloseTo(49,2);
 const tabs=page.getByRole('tab');for(const [index,x] of [78.527027,152.527027,226.527027,300.527027].entries()){const box=await tabs.nth(index).boundingBox();expect(box!.x+box!.width/2).toBeCloseTo(x,1);expect(box!.height).toBeGreaterThanOrEqual(44);}
});
test('bottom navigation renders its source glyph origin and 20 percent inactive surface inside real tabs',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis'}}));await page.goto('/');const label=page.getByTestId('bottom-nav-label-store');await expect(label.locator('path')).toHaveCount(2);const box=await label.boundingBox();expect(box!.x).toBeCloseTo(144.927034,1);expect(box!.y).toBeCloseTo(760.299561,1);await expect(page.getByRole('tab',{name:'应用',exact:true}).locator('div').first()).toHaveCSS('background-color','rgba(255, 255, 255, 0.2)');
});
test('shared background renders the actual clipped Kiwi atmosphere and no hard-edge approximation',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/api/apps',r=>r.fulfill({json:{items:[],next_cursor:null}}));
 await page.goto('/app-gallery');
 const atmosphere=page.getByTestId('mobile-source-atmosphere');
 await expect(atmosphere).toBeAttached();
 expect(Number(await atmosphere.locator('feGaussianBlur').getAttribute('stdDeviation'))).toBeCloseTo(101.54186248779297/2,5);
 await expect(atmosphere.locator('clipPath rect')).toHaveAttribute('width','658.4503784179688');
 await expect(atmosphere.locator('path')).toHaveCount(2);
});

test('Mibo image UV crop expands the actual source image inside its measured node',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'owner@test'}}));
 await page.route('**/api/quota/**',r=>r.fulfill({json:{available_units:900,reserved_units:0,default_budget_units:100,hard_cap_units:1000,price_version:'fixture',failed_usage_rule:'失败按实际用量结算',items:[]}}));
 await page.goto('/chatbot');
 const image=page.getByTestId('mibo-cat-image');await expect(image).toBeAttached();
 const box=await image.boundingBox(),crop=await page.getByTestId('mibo-cat').boundingBox();
 expect(box!.width).toBeCloseTo(157/.5964051485061646,1);expect(box!.height).toBeCloseTo(136/.774509847164154,1);
 expect(box!.x-crop!.x).toBeCloseTo(-157*.19607843458652496/.5964051485061646,1);
});

test('formal Mibo header origin and source-hidden robot match the original node visibility',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'owner@test'}}));
 await page.route('**/api/quota/**',r=>r.fulfill({json:{available_units:900,reserved_units:0,default_budget_units:100,hard_cap_units:1000,price_version:'fixture',failed_usage_rule:'失败按实际用量结算',items:[]}}));
 await page.goto('/chatbot');
 const header=await page.getByTestId('chatbot-back').locator('..').boundingBox();expect(header!.y).toBe(44);
 await expect(page.getByTestId('mibo-robot')).toBeHidden();
 const face=page.getByTestId('mibo-suggestion-face-845:3524');await expect(face).toHaveCSS('height','35px');
 expect((await face.locator('..').boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('visible Mibo actions menu opens real products and quota destinations at 44pt',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'owner@test'}}));
 await page.route('**/api/quota/**',r=>r.fulfill({json:{available_units:900,reserved_units:0,default_budget_units:100,hard_cap_units:1000,price_version:'fixture',failed_usage_rule:'失败按实际用量结算',items:[]}}));
 await page.goto('/chatbot');await page.getByTestId('chatbot-settings').click();
 await expect(page.getByRole('button',{name:'我的应用',exact:true})).toBeVisible();
 for(const id of ['chatbot-products','chatbot-billing'])expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await page.getByTestId('chatbot-products').click();await expect(page).toHaveURL(/\/app-gallery$/);
 await page.goto('/chatbot');await page.getByTestId('chatbot-settings').click();await page.getByTestId('chatbot-billing').click();await expect(page).toHaveURL(/\/billing$/);
});

test('source background blur remains separate from tested optical GLASS',async({page})=>{
 expect(effectSupport('GLASS','web')).toBe('PASS');
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/api/apps',r=>r.fulfill({json:{items:[],next_cursor:null}}));
 await page.goto('/app-gallery');await expect(page.getByTestId('product-folder-created')).toBeVisible();
 const png=(await page.screenshot()).toString('base64');
 const delta=await page.evaluate(async data=>{const i=new Image();i.src=`data:image/png;base64,${data}`;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d')!;x.drawImage(i,0,0);const a=x.getImageData(187,438,1,1).data,b=x.getImageData(187,442,1,1).data;return Math.max(...[0,1,2].map(k=>Math.abs(a[k]-b[k])));},png);
 expect(delta).toBeLessThan(15);
});

test('products without an API icon use their real name initial, preserving App identity',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/api/apps',r=>r.fulfill({json:{items:[{id:'named',name:'Notion',updated_at:'2026-11-10T00:00:00Z',active_job_id:null,instance_status:null,source_version_id:null}],next_cursor:null}}));
 await page.goto('/app-gallery');await page.getByTestId('product-folder-created').click();
 await expect(page.getByTestId('folder-item-named').locator('text')).toHaveText('N');
 await page.getByTestId('products-actions-open').click();await page.getByRole('button',{name:'查看应用列表',exact:true}).click();await expect(page.getByTestId('product-row-named')).toContainText('Notion');
});

test('product categories stay reachable through the visible native actions menu',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/api/apps',r=>r.fulfill({json:{items:[],next_cursor:null}}));
 await page.goto('/app-gallery');await page.getByTestId('products-actions-open').click();
 for(const name of ['我创建的','我的副本','我的收藏','最近使用','新建应用']){const control=page.getByRole('button',{name,exact:true});await expect(control).toBeVisible();expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);}
 await page.getByRole('button',{name:'我的副本',exact:true}).click();await expect(page.getByTestId('product-folder-copies')).toBeVisible();
 await page.getByTestId('products-actions-open').click();await page.getByRole('button',{name:'我的收藏',exact:true}).click();await expect(page).toHaveURL(/\/library\/favorites$/);
});

test('formal home settings uses its actual gear geometry rather than the arrow component variant',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis'}}));
 await page.goto('/');const paths=page.getByTestId('home-settings').locator('[data-source-icon="settings"] path');
 await expect(paths).toHaveCount(1);
 await expect(paths.first()).toHaveAttribute('fill-rule','evenodd');
});

test('active Mibo keeps the reply composer at the source bottom edge and conversation discoverable',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'owner@test'}}));
 const stamp='2026-11-10T00:00:00Z';const job={id:'job',app_id:'app',kind:'GENERATE',status:'QUEUED',phase:'clarifying',usage_units:10,event_cursor:0,question:null,result:null,error:null,created_at:stamp,updated_at:stamp};
 await page.route('**/api/apps/app',r=>r.fulfill({json:{id:'app',name:'记录梦境',updated_at:stamp,active_job_id:'job',active_job:job,latest_job:job,instance_status:null,candidate_version_id:null,requirement:{prompt:'记录梦境',acceptance:[],revision:1,facts:[],source_message_ids:[]},conversation:[{id:'message',sequence:1,role:'user',content:'记录并分析梦境',created_at:stamp}],delivery:null}}));
 await page.route('**/api/jobs/job',r=>r.fulfill({json:job}));await page.goto('/app-detail/app');await expect(page.getByTestId('job-status')).toBeVisible();
 const box=await page.getByTestId('message-input').locator('..').boundingBox();expect(box!.y).toBeCloseTo(729,1);
 await page.getByTestId('chatbot-settings').click(); await page.getByTestId('conversation-toggle').click();await expect(page.getByText('记录并分析梦境',{exact:true})).toBeVisible();
});

test('source PingFang labels use the existing OS face with distinct real paint metrics',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/api/apps',r=>r.fulfill({json:{items:[],next_cursor:null}}));await page.goto('/app-gallery');
 const title=page.getByRole('heading',{name:'我的产品',exact:true});await expect(title).toHaveCSS('font-family','"PingFang SC"');
 const metrics=await page.evaluate(()=>{const c=document.createElement('canvas').getContext('2d')!;c.font='16px "PingFang SC"';const expected=c.measureText('IntelliDeploy').width;c.font='16px AlibabaPuHuiTiRegular';const previous=c.measureText('IntelliDeploy').width;return{expected,previous};});
 expect(Math.abs(metrics.expected-metrics.previous)).toBeGreaterThan(.5);
});

test('home avatar preserves actual source paint order and optical effects without nested buttons',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis',email:'fixture@test'}}));
 await page.goto('/');const avatar=page.getByTestId('home-mibo-avatar');
 await expect(avatar.locator('path').first()).toHaveAttribute('data-source-node','270:26292');
 await expect(avatar.locator('feGaussianBlur').first()).toBeAttached();
 await expect(page.locator('button button')).toHaveCount(0);
});
test('home avatars preserve their real native source masks for normal and pressed contours',async({page})=>{
 expect(sourceNode('270:26297').mask).toBe(true);expect(sourceNode('188:16344').mask).toBe(true);
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis'}}));await page.goto('/');await expect(page.locator('clipPath[id$="-mask-270-26297"]')).toHaveCount(1);const avatar=page.getByTestId('home-mibo-avatar');await avatar.hover();await page.mouse.down();try{await expect(page.locator('clipPath[id$="-mask-188-16344"]')).toHaveCount(1);}finally{await page.mouse.up();}
});

test('login native flow retains the formal input origin and source blurred button ornaments',async({page})=>{
 await page.goto('/login');const input=page.getByTestId('login-account');await expect(input).toBeVisible();
 await expect.poll(async()=>Math.round((await input.boundingBox())!.y)).toBe(356);
 await expect(page.getByTestId('login-submit').locator('feGaussianBlur[stdDeviation="25"]')).toHaveCount(7);
});
test('login hero renders the editable 339pt source subtree with its exact native masks and transforms',async({page})=>{
 await page.goto('/login');const hero=page.getByTestId('login-source-hero');await expect(hero).toBeVisible();expect((await hero.boundingBox())!.x).toBeCloseTo(33,1);expect((await hero.boundingBox())!.y).toBeCloseTo(98,1);await expect(hero.locator('path[data-source-node="119:76635"]').first()).toBeAttached();await expect(hero.locator('clipPath[id="login-hero-mask-119-76636"]')).toHaveCount(1);
});
test('native login source cat keeps the actual purple eye vector visible inside its source mask',async({page})=>{
 await page.goto('/login');await expect(page.getByTestId('login-source-hero')).toBeVisible();const png=(await page.screenshot()).toString('base64');const purple=await page.evaluate(async data=>{const i=new Image();i.src=`data:image/png;base64,${data}`;await i.decode();const c=document.createElement('canvas');c.width=375;c.height=812;const ctx=c.getContext('2d')!;ctx.drawImage(i,0,0);const pixels=ctx.getImageData(178,177,37,30).data;let count=0;for(let n=0;n<pixels.length;n+=4)if(pixels[n]>100&&pixels[n]<165&&pixels[n+1]>75&&pixels[n+1]<145&&pixels[n+2]>170&&pixels[n+2]<240)count++;return count;},png);expect(purple).toBeGreaterThan(30);
});
test('native editable Boolean geometry paints the resolved union once and applies ripple blur after inner shadows',async({page})=>{
 await page.goto('/login');await expect(page.getByTestId('login-source-hero')).toBeVisible();await expect(page.locator('path[data-source-node="119:76643"]')).toHaveCount(1);await expect(page.locator('path[data-source-node="119:76644"],path[data-source-node="119:76645"]')).toHaveCount(0);const filter=page.locator('filter[id^="login-hero-119-76625"]').first();await expect(filter.locator('feGaussianBlur').last()).toHaveAttribute('in','effect-3');
});
test('source tree keeps leaf viewports open and applies node opacity after its paint composite',async({page})=>{
 await page.goto('/login');await expect(page.getByTestId('login-source-hero')).toBeVisible();const dot=page.locator('path[data-source-node="119:76649"]');expect(await dot.evaluate(n=>getComputedStyle(n.closest('svg')!).overflow)).toBe('visible');await expect(page.locator('path[data-source-node="119:76625"]').first()).toHaveAttribute('opacity','1');await expect(page.locator('g[data-source-group="119:76625"]')).toHaveAttribute('opacity','0.5');
});
test('native source effect adapter preserves exported sRGB filter interpolation on Web',async({page})=>{
 await page.goto('/login');const filter=page.locator('filter[id="login-hero-119-76625-effects"]');await expect(filter).toBeAttached();expect(await filter.evaluate(n=>getComputedStyle(n).colorInterpolationFilters)).toBe('srgb');
});
test('source white inner shadow preserves the exported low-alpha arithmetic and the actual .001 node paint',async({page})=>{
 await page.goto('/login');await expect(page.locator('path[data-source-node="119:76640"]')).toHaveAttribute('opacity','0.001');const filter=page.locator('filter[id="login-hero-119-76640-effects"]');await expect(filter).toBeAttached();const actual=await filter.evaluate(n=>n.outerHTML);const result=await page.evaluate(async({actual,xml})=>{const reference=new DOMParser().parseFromString(xml,'image/svg+xml').getElementById('filter5_i_0_24')!;reference.setAttribute('id','reference');reference.setAttribute('filterUnits','objectBoundingBox');for(const[k,v]of Object.entries({x:'-100%',y:'-100%',width:'300%',height:'300%'}))reference.setAttribute(k,v);const load=async(filter:string,id:string)=>{const i=new Image();i.src='data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs>${filter}</defs><rect x="20" y="20" width="40" height="40" fill="white" fill-opacity=".01" filter="url(#${id})"/></svg>`);await i.decode();const c=document.createElement('canvas');c.width=80;c.height=80;const ctx=c.getContext('2d')!;ctx.drawImage(i,0,0);return ctx.getImageData(22,40,1,1).data[3];};return {actual:await load(actual,'login-hero-119-76640-effects'),source:await load(new XMLSerializer().serializeToString(reference),'reference')};},{actual,xml:catXml});expect(result.source).toBeGreaterThan(8);expect(result.actual).toBeGreaterThanOrEqual(result.source-1);
});
test('source drop shadow stays outside a translucent gradient node when behind-node shadow is disabled',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis'}}));await page.goto('/');const filter=await page.locator('g[data-source-group="270:26293"] > defs > filter').evaluate(n=>({markup:n.outerHTML,id:n.id}));expect(filter.id).toBeTruthy();const alpha=await page.evaluate(async filter=>{const i=new Image();i.src='data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs>${filter.markup}</defs><rect x="20" y="20" width="40" height="40" fill="white" fill-opacity=".8" filter="url(#${filter.id})"/></svg>`);await i.decode();const c=document.createElement('canvas');c.width=80;c.height=80;const ctx=c.getContext('2d')!;ctx.drawImage(i,0,0);return ctx.getImageData(40,40,1,1).data[3];},filter);expect(alpha).toBeLessThanOrEqual(205);
});
test('login provider artwork uses its actual source UV to crop standalone company logos',async({page})=>{
 await page.goto('/login');const github=page.getByTestId('login-github').locator('img');await expect(github).toBeAttached();expect((await github.boundingBox())!.width).toBeCloseTo(26/.4160156548023224,1);const apple=page.getByTestId('login-apple').locator('img');expect((await apple.boundingBox())!.width).toBeCloseTo(22/.2800000309944153,1);
});

test('Mibo darken paint composites with the actual source atmosphere in its clipped native art canvas',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));await page.route('**/api/quota/**',r=>r.fulfill({json:{available_units:10,failed_usage_rule:'按实际使用结算'}}));
 await page.goto('/chatbot');await expect(page.getByTestId('mibo-cat-image')).toBeVisible();
 const png=(await page.screenshot()).toString('base64');const rgb=await page.evaluate(async data=>{const img=new Image();img.src=`data:image/png;base64,${data}`;await img.decode();const c=document.createElement('canvas');c.width=375;c.height=812;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);return [...ctx.getImageData(25,150,1,1).data];},png);
 expect(rgb[0]).toBeLessThan(248);expect(rgb[2]).toBeGreaterThan(rgb[0]);
});

test('store keeps the actual centered foreground source card and source vertical origin while showing API-only content',async({page})=>{
 await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:[{id:'one',app_id:'app',instance_id:'instance',version_id:'v',name:'真实应用',summary:'真实摘要',features:[],creator:'作者',preview_url:null,url:null,available:true,payer_policy:'VISITOR',sponsor_period:'DAY',sponsor_limit_units:10,updated_at:'2026-11-10T00:00:00Z'}],next_cursor:null}}));
 await page.goto('/store');const card=page.getByTestId('store-carousel-card-one');await expect(card).toBeVisible();
 await expect.poll(async()=>Math.round((await card.boundingBox())!.y)).toBe(243);

 await expect.poll(async()=>Math.round((await card.boundingBox())!.x)).toBe(52);
 await expect(page.getByTestId('store-preview-placeholder-one')).toBeVisible();
});
test('store centers the actual selected source card with multiple API publications',async({page})=>{
 let items=visualRankingPublications.slice(0,2);await page.route('**/api/community/apps**',r=>r.fulfill({json:{items,next_cursor:null}}));for(const selected of [0,1]){items=visualRankingPublications.slice(0,2).map((p,index)=>({...p,available:selected===0||index===1}));await page.goto('/store');const card=page.getByTestId(`store-carousel-card-${items[selected].id}`);await expect(card).toBeVisible();if(selected===1){await expect(page.getByTestId(`store-carousel-card-${items[0].id}`)).toHaveAttribute('aria-selected','true');await card.click();}await expect(card).toHaveAttribute('aria-selected','true');await expect.poll(async()=>Math.round((await card.boundingBox())!.x)).toBe(52);}
});
test('store API title and summary use the actual 14pt and 8pt source text slots',async({page})=>{
 await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:[{...visualRankingPublications[0],id:'one',name:'实际笔记应用',summary:'真实 API 摘要'}],next_cursor:null}}));await page.goto('/store');await expect(page.getByText('实际笔记应用',{exact:true})).toHaveCSS('font-size','14px');const summary=page.getByText('真实 API 摘要',{exact:true});await expect(summary).toHaveCSS('font-size','8px');expect((await summary.boundingBox())!.y).toBeCloseTo(344.501709,1);expect((await page.getByTestId('store-preview-frame-one').boundingBox())!.width).toBe(214);
});

test('product source asymmetric header and COLLECTION origin stay independent of the 44pt hit wrappers',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/api/apps**',r=>r.fulfill({json:{items:[],next_cursor:null}}));await page.goto('/app-gallery');
 const header=await page.getByTestId('products-header').boundingBox();expect(header!.x).toBe(24);expect(header!.width).toBe(340);
 const collection=await page.getByLabel('COLLECTION').boundingBox();expect(collection!.x).toBe(27);
 const share=await page.getByRole('button',{name:'产品分类与操作',exact:true}).boundingBox();expect(share!.x+share!.width/2).toBe(342);expect(share!.height).toBe(44);
});

test('home source avatar accumulates both visible original shadows in one final composite',async({page})=>{
 expect(sourceNode('270:26293').effects.filter((effect:{type:string;visible?:boolean})=>effect.type==='DROP_SHADOW'&&effect.visible!==false)).toHaveLength(2);
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'Oasis',email:'fixture@test'}}));await page.goto('/');
 await expect(page.locator('g[data-source-group="270:26293"] > defs > filter').locator('feMergeNode')).toHaveCount(3);
});

test('Mibo greeting and suggestion source origins preserve the measured asymmetric composition',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));await page.route('**/api/quota/**',r=>r.fulfill({json:{available_units:10,failed_usage_rule:'按实际使用结算'}}));await page.goto('/chatbot');
 expect((await page.getByTestId('mibo-source-greeting').boundingBox())!.x).toBe(92);
 const face=page.getByTestId('mibo-suggestion-face-845:3524');expect((await face.boundingBox())!.x).toBe(93);
 expect((await page.getByTestId('mibo-suggestion-text-845:3524').boundingBox())!.x).toBeCloseTo(127.527,1);
});
test('Mibo composer keeps source text paint and microphone origin inside the preserved 44pt controls',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));await page.route('**/api/quota/**',r=>r.fulfill({json:{available_units:10,failed_usage_rule:'按实际使用结算'}}));await page.goto('/chatbot');const input=page.getByTestId('create-prompt');await input.fill('真实用户输入');await input.blur();await expect(input).toHaveCSS('color','rgba(107, 114, 128, 0.8)');await expect(input).toHaveCSS('text-align','center');const box=await input.boundingBox();expect(box!.x).toBeCloseTo(34.684925,1);expect(box!.height).toBeGreaterThanOrEqual(44);const mic=await page.getByTestId('chat-composer-microphone').locator('path').first().boundingBox();expect(mic!.x).toBeCloseTo(274.379749,1);
});

test('Mibo renders all eleven formal source frames from actual UI and Job states',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));await page.route('**/api/quota/**',r=>r.fulfill({json:{available_units:10,failed_usage_rule:'按实际使用结算'}}));
 await page.route('**/api/apps',()=>new Promise(()=>{}));await page.goto('/chatbot');await expect(page.getByTestId('mibo-stage')).toHaveAttribute('data-source-frame','845:3479');await page.getByTestId('create-prompt').fill('真实需求');await page.getByTestId('create-app').click();await expect(page.getByTestId('mibo-stage')).toHaveAttribute('data-source-frame','846:3544');
 const states=[
  [48,'QUEUED','clarifying','849:3608'],[49,'RUNNING','clarifying','849:3705'],[50,'RUNNING','retrieving','849:3794'],
  [51,'RUNNING','implementing','849:3883'],[52,'RUNNING','building','849:3972'],[53,'RUNNING','validating','852:4061'],
  [54,'RUNNING','deploying','852:4150'],[55,'RUNNING','building','852:4242'],[58,'SUCCEEDED','verifying_live','852:4391'],
 ] as const;
 for(const [number,status,phase,frame] of states){const app=makeVisualApp(number,status,phase);await page.unroute('**/api/apps/app');await page.unroute('**/api/jobs/job');await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));await page.goto('/app-detail/app');await expect(page.getByTestId('mibo-stage')).toHaveAttribute('data-source-frame',frame);}
});

test('actual public assistant reply is visible with normal menu access to history and management',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));
 const app=makeVisualApp(49,'RUNNING','clarifying');app.conversation.push({id:'assistant',sequence:2,role:'assistant',content:'开发者提供的真实回复：保留私有笔记，并支持搜索。',created_at:'2026-11-10T00:00:01Z'});
 await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));await page.goto('/app-detail/app');await expect(page.getByTestId('latest-assistant-reply')).toHaveText('开发者提供的真实回复：保留私有笔记，并支持搜索。');await page.getByTestId('chatbot-settings').click();await page.getByTestId('delivery-management-toggle').click();await expect(page.getByTestId('cancel-job')).toBeVisible();
 await page.getByTestId('chatbot-settings').click(); await page.getByTestId('conversation-toggle').click();await expect(page.getByText('笔记工具 · 需求与调整',{exact:true})).toBeVisible();
});

test('ranking native source places the real DTO rows at the measured list origin',async({page})=>{
 await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:visualRankingPublications,next_cursor:null}}));await page.goto('/store/ranking');
 const list=await page.getByTestId('store-ranking-list-surface').boundingBox();expect(list!.x).toBe(37);expect(list!.y).toBeCloseTo(351.58,1);
 await expect(page.getByTestId(/^store-ranking-row-/)).toHaveCount(3);await expect(page.getByTestId('store-ranking-row-ranking-1')).toContainText('保存和查看笔记');
});
test('ranking real API name and summary use the actual source type sizes and row copy origin',async({page})=>{
 await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:visualRankingPublications,next_cursor:null}}));await page.goto('/store/ranking');const name=page.getByText('笔记工具',{exact:true});await expect(name).toHaveCSS('font-size','10px');expect((await name.boundingBox())!.x).toBeCloseTo(134.735939,1);await expect(page.getByText('保存和查看笔记',{exact:true})).toHaveCSS('font-size','8px');
});

test('an older assistant reply stays visibly conversational while the actual new job remains running',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));const app=makeVisualApp(49,'RUNNING','clarifying');
 app.conversation=[{id:'old-user',sequence:1,role:'user',content:'上次的需求',created_at:'2026-11-09T00:00:00Z'},{id:'old-assistant',sequence:2,role:'assistant',content:'上一版回复：笔记支持保存和查看。',created_at:'2026-11-09T00:01:00Z'}];
 await page.route('**/api/apps/app',r=>r.fulfill({json:app}));await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));await page.goto('/app-detail/app');await expect(page.getByText('Mibo 最新回复',{exact:true})).toBeVisible();await expect(page.getByTestId('latest-assistant-reply')).toHaveText('上一版回复：笔记支持保存和查看。');await expect(page.getByTestId('job-status')).toHaveText('正在理解需求');await page.getByTestId('chatbot-settings').click();await page.getByTestId('delivery-management-toggle').click();await expect(page.getByTestId('cancel-job')).toBeVisible();await expect(page.getByTestId('open-app')).toHaveCount(0);
});

test('a complete local delivery opens its reachable app, report and artifact without claiming external acceptance',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));
 await page.route('**/auth/me',r=>r.fulfill({json:{id:1,username:'owner',email:'fixture@test'}}));
 const app=makeVisualApp(58,'SUCCEEDED','verifying_live');
 await page.route('**/api/apps/app',r=>r.fulfill({json:app}));
 await page.route('**/api/jobs/job',r=>r.fulfill({json:app.latest_job}));
 await page.route('**/api/instances/fixture-instance/login-code',r=>r.fulfill({json:{code:'local-fixture-code',expires_in:60}}));
 for(const url of [app.delivery!.url,app.delivery!.report_url,app.delivery!.artifact_url])expect((await page.request.get(url)).status()).toBe(200);
 expect(await (await page.request.get(app.delivery!.report_url)).json()).toMatchObject({job_id:'job',overall:'NOT_RUN',checks:[]});
 await page.goto('/app-detail/app');await page.getByTestId('open-app').click();
 await expect(page).toHaveURL('http://127.0.0.1:9199/api/platform/callback?code=local-fixture-code');
 await expect(page.getByRole('heading',{name:'笔记工具',exact:true})).toBeVisible();
 await page.locator('#notes').fill('回归测试笔记');await page.getByRole('button',{name:'保存笔记',exact:true}).click();
 await expect(page.locator('#saved')).toHaveText('已保存');await page.reload();await expect(page.locator('#notes')).toHaveValue('回归测试笔记');
});

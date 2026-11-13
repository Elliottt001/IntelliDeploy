import {expect,test,type Locator} from '@playwright/test';
import {getSourceMotion} from '../../design/sourceMotionEvidence';
import {communityEvidence as source} from '../../features/community/communityEvidence';
import {sampleSourceEasing} from '../../features/navigation/sourceMotionPolicy';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceNode } from '../../tests/figmaSource';
import { mobileEvidence } from '../../design/mobileEvidence';

async function railX(rail:Locator){
 return rail.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).m41);
}

test('fixture app is isolated and does not request API data',async({page})=>{
 const requests:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))requests.push(request.url());});
 await page.goto('/');await expect(page.getByTestId('component-fixture-community')).toBeVisible();
 await expect(page.getByText('component-fixture-author',{exact:true})).toBeVisible();
 expect(requests).toEqual([]);
});

test('source card keeps short and long bodies in independent slots with complete scrollable copy',async({page})=>{
 await page.goto('/');
 const card=page.getByTestId('community-source-card-fixture-long'),short=page.getByTestId('community-source-card-fixture-second');
 await expect(card.getByTestId('community-card-author')).toHaveText('component-fixture-author');
 await expect(card.getByTestId('community-card-time')).toHaveText('12分钟前');
 await expect(short.getByTestId('community-card-body')).toHaveText('短正文');
 await expect(card.getByTestId('community-card-body')).toContainText('末尾 sentinel');
 await card.getByTestId('community-card-body').evaluate(element=>{element.scrollTop=element.scrollHeight;});
 await expect(card.getByText('末尾 sentinel')).toBeVisible();
 const author=await card.getByTestId('community-card-author').boundingBox();
 const time=await card.getByTestId('community-card-time').boundingBox();
 const body=await card.getByTestId('community-card-body').boundingBox();
 expect(author!.y).toBeLessThan(body!.y);expect(time!.y).toBeLessThan(body!.y);expect(Math.abs(author!.y-time!.y)).toBeLessThan(2);
});

test('source rail adapts across five widths and uses original drag motion',async({page})=>{
 for(const width of [320,360,375,390,430]){
  await page.setViewportSize({width,height:812});await page.goto('/');
  const rail=page.getByTestId('community-source-rail'),responder=page.getByTestId('community-source-drag-responder'),card=page.getByTestId('community-source-card-fixture-long');
  await expect(rail).toBeVisible();await expect(responder).toHaveAttribute('data-source-responder','pan');const box=await card.boundingBox(),railBox=(await responder.boundingBox())!;expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.height).toBeGreaterThanOrEqual(345);
  await expect(rail).toHaveAttribute('data-source-duration-ms','300.00001192092896');
  await page.mouse.move(railBox.x+120,railBox.y+30);await page.mouse.down();await page.mouse.move(railBox.x+20,railBox.y+30,{steps:6});await page.mouse.up();
  const motion=getSourceMotion('825:5887','DRAG','825:6452')!,expectedMid=(source.railTarget.transform.m02-source.rail.transform.m02)*sampleSourceEasing(motion,150/motion.durationMs);
  await page.waitForTimeout(150);expect(Math.abs(await railX(rail)-expectedMid)).toBeLessThanOrEqual(16);
  await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');
  await expect.poll(()=>rail.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).m41)).toBeCloseTo(-94,1);
 }
});

test('source rail cancels reverse motion and reduced motion snaps to target',async({page})=>{
 await page.goto('/');const rail=page.getByTestId('community-source-rail'),responder=page.getByTestId('community-source-drag-responder');
 const box=(await responder.boundingBox())!;
 await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();await page.mouse.move(box.x+20,box.y+30);await page.mouse.up();
 await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();await page.mouse.move(box.x+220,box.y+30);await page.mouse.up();
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('0');
 await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>railX(rail)).toBeCloseTo(0,1);
 await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();await page.mouse.move(box.x+20,box.y+30);await page.mouse.up();
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');
});

test('vertical wheel over a scrollable body scrolls the body without moving the rail',async({page})=>{
 await page.goto('/');
 const rail=page.getByTestId('community-source-rail'),body=page.getByTestId('community-source-card-fixture-long').getByTestId('community-card-body');
 await expect(rail).toHaveAttribute('data-source-progress','0');
 const box=(await body.boundingBox())!,before=await body.evaluate(element=>element.scrollTop);
 await page.mouse.move(box.x+box.width/2,box.y+Math.min(20,box.height/2));
 await page.mouse.wheel(0,120);
 await expect.poll(()=>body.evaluate(element=>element.scrollTop)).toBeGreaterThan(before);
 await page.waitForTimeout(350);
 await expect(rail).toHaveAttribute('data-source-progress','0');
 expect(await railX(rail)).toBeCloseTo(0,1);
});

test('wheel navigation only responds to dominant horizontal delta',async({page})=>{
 await page.goto('/');
 const rail=page.getByTestId('community-source-rail'),responder=page.getByTestId('community-source-drag-responder'),box=(await responder.boundingBox())!;
 await page.mouse.move(box.x+120,box.y+30);
 await page.mouse.wheel(24,120);
 await page.waitForTimeout(350);
 await expect(rail).toHaveAttribute('data-source-progress','0');
 expect(await railX(rail)).toBeCloseTo(0,1);
 await page.mouse.wheel(120,24);
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');
});

test('pointer cancellation during a new gesture settles in-flight motion in both directions',async({page})=>{
 await page.goto('/');
 const rail=page.getByTestId('community-source-rail'),responder=page.getByTestId('community-source-drag-responder'),box=(await responder.boundingBox())!;
 const start=async(dx:number)=>{
  await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();await page.mouse.move(box.x+120+dx,box.y+30);await page.mouse.up();
 };
 const cancel=async(dx:number)=>{
  await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();await page.mouse.move(box.x+120+dx,box.y+30);
  await responder.evaluate(element=>element.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1})));
  await page.mouse.up();
 };
 await start(-100);await page.waitForTimeout(90);await cancel(40);
 await expect.poll(()=>railX(rail)).toBeCloseTo(-94,1);
 await expect(rail).toHaveAttribute('data-source-progress','1');
 await start(100);await page.waitForTimeout(90);await cancel(-40);
 await expect.poll(()=>railX(rail)).toBeCloseTo(0,1);
 await expect(rail).toHaveAttribute('data-source-progress','0');
});

// Browser-native capture and document listener accounting complements the
// ReactDOM tests: compatibility mouse delivery must not create extra handles.
test('captured drag released outside cleans each document handle and capture once',async({page})=>{
 await page.goto('/');
 const rail=page.getByTestId('community-source-rail'),responder=page.getByTestId('community-source-drag-responder'),box=(await responder.boundingBox())!;
 await page.evaluate(()=>{
  const counts={added:0,removed:0,set:0,released:0};
  (window as typeof window&{gestureAudit:typeof counts}).gestureAudit=counts;
  const types=['pointermove','pointerup','pointercancel','mousemove','mouseup'];
  const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
  document.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(types.includes(type))counts.added++;add(type,listener,options);}) as typeof document.addEventListener;
  document.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{if(types.includes(type))counts.removed++;remove(type,listener,options);}) as typeof document.removeEventListener;
  const element=document.querySelector<HTMLElement>('[data-testid="community-source-drag-responder"]')!;
  const set=element.setPointerCapture.bind(element),release=element.releasePointerCapture.bind(element);
  element.setPointerCapture=id=>{counts.set++;set(id);};
  element.releasePointerCapture=id=>{counts.released++;release(id);};
 });
 await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();
 await page.mouse.move(box.x+20,box.y+30);await page.mouse.move(box.x+10,box.y+box.height+30);await page.mouse.up();
 await expect.poll(()=>railX(rail)).toBeCloseTo(-94,1);
 expect(await page.evaluate(()=>(window as typeof window&{gestureAudit:unknown}).gestureAudit)).toEqual({added:3,removed:3,set:1,released:1});
 expect(await responder.evaluate(element=>element.hasPointerCapture(1))).toBe(false);
});

test('native browser touch pans the long body vertically without claiming the rail',async({page})=>{
 await page.goto('/');
 const rail=page.getByTestId('community-source-rail'),body=page.getByTestId('community-source-card-fixture-long').getByTestId('community-card-body');
 const box=(await body.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height-10;
 const session=await page.context().newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let distance=20;distance<=120;distance+=20){
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance}]});
 }
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>body.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
 await page.waitForTimeout(350);
 expect(await railX(rail)).toBeCloseTo(0,1);
 await expect(rail).toHaveAttribute('data-source-progress','0');
 await session.detach();
});

test('source cards expose supported paints and effects without treating GLASS as implemented',async({page})=>{
 await page.goto('/');
 const card=page.getByTestId('community-source-card-fixture-long');
 await expect(card).toHaveCSS('background-color','rgba(255, 255, 255, 0.65)');
 await expect(card).toHaveCSS('border-radius','24px');
 await expect(card).toHaveCSS('box-shadow',/rgba?\(/);
 await expect(card).toHaveAttribute('data-source-glass','NOT_IMPLEMENTED');
});

test('records original-source 59/60 component measurements without certifying production post data', async ({ page }) => {
 const root = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
 expect(root, 'Original source is required for acceptance records').toBeTruthy();
 const bytes = await readFile(`${root}/design-data/document.kiwi.json`);
 const surface = sourceNode('270:24544'), initial = sourceNode('825:5887'), target = sourceNode('825:6488');
 const expectedOffset = target.transform.m02 - initial.transform.m02;
 const records = [];
 for (const width of [320, 360, 375, 390, 430]) {
  await page.setViewportSize({ width, height: 812 }); await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.goto('/');
  const rail = page.getByTestId('community-source-rail'), responder = page.getByTestId('community-source-drag-responder');
  const capture = async () => ({
   rail: await rail.boundingBox(), offset: await railX(rail),
   cards: await page.getByTestId(/^community-source-card-/).evaluateAll(elements => elements.map(element => {
    const css = getComputedStyle(element), box = element.getBoundingClientRect();
    return { id: element.getAttribute('data-testid'), x: box.x, y: box.y, width: box.width, height: box.height,
     background: css.backgroundColor, radius: css.borderRadius, shadow: css.boxShadow,
     copy: Array.from(element.querySelectorAll('[data-testid="community-card-author"],[data-testid="community-card-time"],[data-testid="community-card-body"]')).map(e => {
      const text = e.getAttribute('data-testid') === 'community-card-body' ? e.querySelector('[dir="auto"]') ?? e : e;
      const c = getComputedStyle(text); return { text: e.textContent, font: c.font, fontSize: c.fontSize, lineHeight: c.lineHeight, color: c.color, scrollTop: e.scrollTop, scrollHeight: e.scrollHeight };
     }) };
   })),
  });
  const before = await capture();
  expect(before.cards[0].width).toBeCloseTo(surface.size.x, 5);
  expect(before.cards[0].height).toBeCloseTo(surface.size.y, 5);
  expect(parseFloat(before.cards[0].radius)).toBe(surface.cornerRadius);
  const actualAlpha = Number(before.cards[0].background.match(/,\s*([\d.]+)\)$/)![1]);
  expect(actualAlpha).toBeCloseTo(surface.fillPaints[0].opacity, 5);
  const box = (await responder.boundingBox())!;
  await page.mouse.move(box.x + 120, box.y + 30); await page.mouse.down(); await page.mouse.move(box.x + 20, box.y + 30, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150); const middle = await capture();
  await expect.poll(() => railX(rail)).toBeCloseTo(expectedOffset, 1); const after = await capture();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await rail.hover(); await page.mouse.wheel(-94, 0);
  await expect.poll(() => railX(rail)).toBeCloseTo(0, 1); const reducedReverse = await capture();
  records.push({ viewport: { width, height: 812 }, frame59: before, frame60: after, middle, reducedReverse });
 }
 await mkdir('artifacts/source-acceptance', { recursive: true });
 await writeFile('artifacts/source-acceptance/community-component.json', JSON.stringify({
  sourceSha256: createHash('sha256').update(bytes).digest('hex'), frameIds: mobileEvidence.community.frameIds,
  scope: 'Isolated component fixture only; production post DATA_BINDING API_UNAVAILABLE',
  expected: { surface, initial, target, expectedOffset }, measurements: records,
  checks: { selectedPaintAndRadius: 'PASS', dragEndpoints: 'PASS', wholeFrame: 'NOT_RUN', native: 'NOT_RUN', data: 'API_UNAVAILABLE', glass: 'NOT_IMPLEMENTED' },
 }, null, 2));
});

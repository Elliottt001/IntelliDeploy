import {expect,test} from '@playwright/test';

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
  await page.mouse.move(railBox.x+120,railBox.y+30);await page.mouse.down();await page.mouse.move(railBox.x+20,railBox.y+30,{steps:6});await page.mouse.up();await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');
  await expect.poll(()=>rail.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).m41)).toBeCloseTo(-94,1);
 }
});

test('source rail cancels reverse motion and reduced motion snaps to target',async({page})=>{
 await page.goto('/');const rail=page.getByTestId('community-source-rail'),responder=page.getByTestId('community-source-drag-responder');
 const box=(await responder.boundingBox())!;
 await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();await page.mouse.move(box.x+20,box.y+30);await page.mouse.up();
 await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();await page.mouse.move(box.x+220,box.y+30);await page.mouse.up();
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('0');
 await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.move(box.x+120,box.y+30);await page.mouse.down();await page.mouse.move(box.x+20,box.y+30);await page.mouse.up();
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');
});

test('source cards expose supported paints and effects without treating GLASS as implemented',async({page})=>{
 await page.goto('/');
 const card=page.getByTestId('community-source-card-fixture-long');
 await expect(card).toHaveCSS('background-color','rgba(255, 255, 255, 0.65)');
 await expect(card).toHaveCSS('border-radius','24px');
 await expect(card).toHaveCSS('box-shadow',/rgba?\(/);
 await expect(card).toHaveAttribute('data-source-glass','NOT_IMPLEMENTED');
});

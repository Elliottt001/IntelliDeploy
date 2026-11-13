import {expect,test} from '@playwright/test';

test('fixture app is isolated and does not request API data',async({page})=>{
 const requests:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))requests.push(request.url());});
 await page.goto('/');await expect(page.getByTestId('component-fixture-community')).toBeVisible();
 await expect(page.getByText('component-fixture-author',{exact:true})).toBeVisible();
 expect(requests).toEqual([]);
});

test('source card keeps author time and long body in independent slots',async({page})=>{
 await page.goto('/');
 const card=page.getByTestId('community-source-card-fixture-long');
 await expect(card.getByTestId('community-card-author')).toHaveText('component-fixture-author');
 await expect(card.getByTestId('community-card-time')).toHaveText('12分钟前');
 await expect(card.getByTestId('community-card-body')).toContainText('这一段 fixture 正文故意很长');
 const author=await card.getByTestId('community-card-author').boundingBox();
 const time=await card.getByTestId('community-card-time').boundingBox();
 const body=await card.getByTestId('community-card-body').boundingBox();
 expect(author!.y).toBeLessThan(body!.y);expect(time!.y).toBeLessThan(body!.y);expect(Math.abs(author!.y-time!.y)).toBeLessThan(2);
});

test('source rail adapts across five widths and uses original drag motion',async({page})=>{
 for(const width of [320,360,375,390,430]){
  await page.setViewportSize({width,height:812});await page.goto('/');
  const rail=page.getByTestId('community-source-rail'),card=page.getByTestId('community-source-card-fixture-long');
  await expect(rail).toBeVisible();const box=await card.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.height).toBeGreaterThanOrEqual(345);
  await rail.hover();await page.mouse.wheel(120,0);await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');
  const shifted=await rail.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).m41);expect(shifted).toBeCloseTo(-94,1);
 }
});

test('source rail cancels reverse motion and reduced motion snaps to target',async({page})=>{
 await page.goto('/');const rail=page.getByTestId('community-source-rail');
 await rail.hover();await page.mouse.wheel(120,0);await page.mouse.wheel(-120,0);
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('0');
 await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.wheel(120,0);
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');
});

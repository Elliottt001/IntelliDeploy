import {expect,test,type Page} from '@playwright/test';
import {installMobileSourceFixtures} from './sourceAssertions';

test('community states the unavailable post content instead of inventing a feed',async({page})=>{
 await installMobileSourceFixtures(page);await page.goto('/community');
 await expect(page.getByTestId('community-content-unavailable')).toBeVisible();
 await expect(page.getByTestId(/^discovery-publication-/)).toHaveCount(0);
 await expect(page.getByTestId(/^featured-publication-/)).toHaveCount(0);
 await expect(page.getByText(/\d+分钟前|\d+\s*赞|TOP\s*1|示例开发者|笔记工具/)).toHaveCount(0);
});

test('community source shell keeps formal 59 geometry without exposing fake post copy',async({page})=>{
 await installMobileSourceFixtures(page);await page.goto('/community');
 const rail=page.getByTestId('community-source-rail'),first=page.getByTestId('community-source-card-primary');
 await expect(rail).toBeVisible();await expect(first).toBeVisible();
 expect((await page.getByTestId('community-source-title').boundingBox())!.y).toBeCloseTo(105,2);
 expect((await rail.boundingBox())!.y).toBeCloseTo(188,2);
 expect((await first.boundingBox())!.width).toBeCloseTo(145.5,1);
 expect((await first.boundingBox())!.height).toBeCloseTo(345.5,1);
 await expect(first.getByTestId('community-card-author')).toHaveCount(0);
 await expect(first.getByTestId('community-card-time')).toHaveCount(0);
 await expect(first.getByTestId('community-card-body')).toHaveCount(0);
 await expect(page.getByTestId('community-atmosphere').locator('feGaussianBlur').first()).toHaveAttribute('stdDeviation','50.770931');
});

test('community 59/60 drag follows the original rail delta and reduced motion snaps',async({page})=>{
 await installMobileSourceFixtures(page);await page.goto('/community');
 const rail=page.getByTestId('community-source-rail');
 await expect(rail).toHaveAttribute('data-source-motion','825:5887->825:6452');
 await expect(rail).toHaveAttribute('data-source-progress','0');
 await rail.hover();await page.mouse.wheel(120,0);
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('1');
 const shifted=await rail.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).m41);
 expect(shifted).toBeCloseTo(-94,1);
 await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.wheel(-120,0);
 await expect.poll(()=>rail.getAttribute('data-source-progress')).toBe('0');
 const reset=await rail.evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).m41);
 expect(reset).toBeCloseTo(0,1);
});

test('320/360/375/390/430 widths keep source shell inside the viewport and 44pt controls',async({page})=>{
 await installMobileSourceFixtures(page);
 for(const width of [320,360,375,390,430]){
  await page.setViewportSize({width,height:812});await page.goto('/community');
  for(const target of [page.getByRole('button',{name:'返回首页'}),page.getByRole('button',{name:'分享暂未开放'}),page.getByTestId('community-source-card-primary')]){
   const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+Math.min(box!.width,width)).toBeLessThanOrEqual(width+1);
  }
  await expect(page.getByTestId('mobile-community')).toHaveCSS('transform','none');
 }
});

test('actual blurred atmosphere output stops at the enabled source frame edge',async({page})=>{
 await installMobileSourceFixtures(page);await page.goto('/community');const svg=page.getByTestId('community-atmosphere');
 const pixels=await svg.evaluate(async element=>{
  const clone=element.cloneNode(true) as SVGSVGElement;clone.setAttribute('width','375');clone.setAttribute('height','812');clone.removeAttribute('style');clone.querySelector(':scope > rect')!.remove();
  const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=375;canvas.height=812;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);const data=context.getImageData(0,0,375,812).data;
  let below=0,inside=0;for(let x=0;x<375;x++){below+=data[(700*375+x)*4+3];inside+=data[(600*375+x)*4+3];}return {below,inside};
 });
 expect(pixels.inside).toBeGreaterThan(0);expect(pixels.below).toBe(0);
 await expect(svg.locator('clipPath rect')).toHaveAttribute('height','611.3303833007812');
});

async function publicationDetailFixture(page:Page){
 const stamp='2026-11-10T00:00:00Z';
 const publication={id:'shared',app_id:'owner-app',instance_id:'shared-instance',version_id:'v1',name:'共享笔记',summary:'记录自己的笔记',features:['记录历史'],creator:'作者',preview_url:null,url:'https://fixture-app.example',available:true,payer_policy:'VISITOR',sponsor_period:'DAY',sponsor_limit_units:10000,copy_url:'/api/publications/shared/copies',updated_at:stamp};
 await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:[publication],next_cursor:null}}));
 await page.route('**/api/publications/shared',r=>r.fulfill({json:publication}));
 return publication;
}

for(const action of ['收藏应用','创建我的副本'])test(`store-opened public detail ${action} retains the existing login boundary`,async({page})=>{
 await publicationDetailFixture(page);await page.route('**/auth/me',r=>r.fulfill({status:401,json:{detail:'请登录'}}));
 await page.route('**/api/library/favorites**',r=>r.fulfill({status:401,json:{error:{message:'请登录'}}}));
 await page.goto('/store');await page.getByTestId('store-open-shared').click();await expect(page).toHaveURL(/\/community\/shared$/);
 await page.getByRole('button',{name:action,exact:true}).click();await expect(page).toHaveURL(/\/login\?next=%2Fcommunity%2Fshared$/);
});

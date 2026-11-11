import {expect,test,type Page} from '@playwright/test';
const stamp='2026-11-10T00:00:00Z';
const publication=(id:string,available=true)=>({id,app_id:`app-${id}`,instance_id:`instance-${id}`,version_id:'v',name:`应用 ${id}`,summary:'',features:[],creator:`作者 ${id}`,preview_url:null,url:null,available,payer_policy:'VISITOR',sponsor_period:'DAY',sponsor_limit_units:10,copy_url:'/copy',updated_at:stamp});
async function fixtures(page:Page,empty=false){
 await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:empty?[]:new URL(r.request().url()).searchParams.has('cursor')?[publication('third')]:[publication('first',false),publication('second')],next_cursor:empty||new URL(r.request().url()).searchParams.has('cursor')?null:'page-2'}}));
 await page.route('**/api/publications/*',r=>r.fulfill({json:publication(r.request().url().split('/').pop()!)}));
}
test('anonymous discovery preserves API order and prioritizes first available for layout only',async({page})=>{
 await fixtures(page);await page.goto('/community');
 const rail=page.getByTestId('community-discovery');await expect(rail).toBeVisible();
 const cards=rail.getByTestId(/^discovery-publication-/);await expect(cards).toHaveCount(2);await expect(cards.nth(0)).toContainText('应用 first');
 await expect(page.getByTestId('featured-publication-second')).toContainText('查看应用介绍');
 await expect(page.getByText(/点赞|评论|分钟前|评分|获奖|在线|\d+%/)).toHaveCount(0);
 await page.getByTestId('community-load-more').click();await expect(cards).toHaveCount(3);await expect(cards.nth(0)).toContainText('应用 first');
 await page.getByTestId('discovery-publication-first').click();await expect(page).toHaveURL(/\/community\/first$/);expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull();
});
test('empty hides rail and featured, retries actual read',async({page})=>{
 await fixtures(page,true);await page.goto('/community');await expect(page.getByTestId('community-empty')).toBeVisible();
 await expect(page.getByTestId('community-discovery')).toHaveCount(0);await expect(page.getByTestId(/^featured-publication-/)).toHaveCount(0);
 await page.unroute('**/api/community/apps**');await fixtures(page);await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByTestId('community-discovery')).toBeVisible();
});
test('initial and paging errors keep retry and loaded facts',async({page})=>{
 await fixtures(page);await page.route('**/api/community/apps**',r=>r.fulfill({status:503,json:{error:{message:'temporarily unavailable'}}}));
 await page.goto('/community');await expect(page.getByRole('alert')).toContainText('应用暂时无法加载');
 await page.unroute('**/api/community/apps**');await fixtures(page);await page.getByRole('button',{name:'重试',exact:true}).click();
 await page.route('**/api/community/apps?**',r=>r.fulfill({status:503,json:{error:{message:'temporarily unavailable'}}}));
 await page.getByTestId('community-load-more').click();await expect(page.getByRole('alert')).toContainText('更多应用加载失败');await expect(page.getByTestId('discovery-publication-first')).toBeVisible();
 await page.unroute('**/api/community/apps?**');await page.getByTestId('community-load-more').click();await expect(page.getByTestId('discovery-publication-third')).toBeAttached();await expect(page.getByRole('alert')).toHaveCount(0);
});
test('320/375/430 retain 44pt controls, readable type and source shell geometry without root scaling',async({page},testInfo)=>{
 await fixtures(page);
 for(const width of [320,375,430]){
  await page.setViewportSize({width,height:812});await page.goto('/community');await expect(page.getByTestId('community-discovery')).toBeVisible();
  for(const target of [page.getByRole('button',{name:'返回首页'}),page.getByTestId('community-load-more'),page.getByTestId('discovery-publication-first'),page.getByTestId('featured-publication-second')]){
   const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
  await expect(page.getByTestId('mobile-community')).toHaveCSS('transform','none');
  await expect(page.getByTestId('discovery-publication-first')).toHaveCSS('width','145.5px');await expect(page.getByTestId('discovery-publication-first')).toHaveCSS('height','345.5px');
  await expect(page.getByTestId('community-source-title').locator('path').first()).toHaveAttribute('transform',/scale\(24 -24\)/);
  await expect(page.getByTestId('featured-publication-second')).toHaveCSS('border-radius','24px');
  if(process.env.INTELLIDEPLOY_COMMUNITY_CAPTURE){await page.screenshot({path:testInfo.outputPath(`community-${width}.png`),fullPage:true});if(width===375){await page.getByTestId('community-discovery').evaluate(element=>element.scrollTo({left:94,behavior:'instant'}));await page.screenshot({path:testInfo.outputPath('community-page-60.png'),fullPage:true});}}
 }
});
test('source glyphs have real SVG bounds and screen origins without development errors',async({page})=>{
 const errors:string[]=[];page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await fixtures(page);await page.goto('/community');
 const heading=page.getByTestId('community-source-title');const glyph=heading.locator('path').first();await expect(glyph).toBeAttached();expect((await heading.boundingBox())!.y).toBeCloseTo(105,2);expect((await page.getByTestId('community-discovery').boundingBox())!.y).toBeCloseTo(188,2);expect((await page.getByTestId('featured-publication-second').boundingBox())!.y).toBeCloseTo(549.5,2);
 const bounds=await glyph.evaluate(element=>{const node=element as unknown as SVGGraphicsElement;const box=node.getBBox();const matrix=node.getScreenCTM()!;return {width:box.width,height:box.height,origin:new DOMPoint(0,0).matrixTransform(matrix).y};});
 expect(bounds.width).toBeGreaterThan(0);expect(bounds.height).toBeGreaterThan(0);expect(bounds.origin).toBeGreaterThan(105);expect(errors).toEqual([]);
});
test('formal atmosphere uses actual blurred ellipse geometry and paint visibility',async({page})=>{
 await fixtures(page);await page.goto('/community');
 const atmosphere=page.getByTestId('community-atmosphere');await expect(atmosphere.locator('feGaussianBlur').first()).toHaveAttribute('stdDeviation','101.541862');await expect(atmosphere.locator('path[fill="#EDAFF6"]')).toBeAttached();await expect(atmosphere.locator('path[fill="#A7A4F3"]')).toBeAttached();
});
for(const action of ['收藏应用','创建我的副本'])test(`anonymous ${action} retains the existing detail login boundary`,async({page})=>{
 await fixtures(page);await page.route('**/auth/me',r=>r.fulfill({status:401,json:{detail:'请登录'}}));
 await page.route('**/api/library/favorites**',r=>r.fulfill({status:401,json:{error:{message:'请登录'}}}));
 await page.goto('/community');await page.getByTestId('featured-publication-second').click();await expect(page).toHaveURL(/\/community\/second$/);
 await page.getByRole('button',{name:action,exact:true}).click();await expect(page).toHaveURL(/\/login\?next=%2Fcommunity%2Fsecond$/);
});
test('failed real preview falls back to neutral artwork and all unavailable still use the first loaded item',async({page})=>{
 await fixtures(page);await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:[{...publication('first',false),preview_url:'http://127.0.0.1:9199/failed-preview.png'},publication('second',false)],next_cursor:null}}));
 await page.route('**/failed-preview.png',r=>r.fulfill({status:404,body:''}));await page.goto('/community');
 await expect(page.getByTestId('featured-publication-first')).toContainText('暂不可用');await expect(page.getByLabel('应用 first暂无预览').first()).toBeVisible();
});
test('Publication facts use formal card and featured typography at native point sizes',async({page})=>{
 await fixtures(page);await page.goto('/community');
 await expect(page.getByTestId('discovery-publication-first').getByText('应用 first',{exact:true})).toHaveCSS('font-size','12px');
 await expect(page.getByTestId('discovery-publication-first').getByText('查看应用介绍',{exact:true})).toHaveCSS('line-height','19.5px');
 await expect(page.getByTestId('featured-publication-second').getByText('应用 second',{exact:true})).toHaveCSS('font-size','18px');
});

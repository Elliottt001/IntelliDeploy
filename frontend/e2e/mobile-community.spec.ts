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
test('featured image inverse UV preserves raw aspect, local origin and source node affine in the actual SVG',async({page})=>{
 await fixtures(page);await page.goto('/community');
 const node=page.getByTestId('community-decoration');const image=node.locator('image');await expect(image).toBeAttached();
 const dimensions=await image.evaluate(element=>{
  const image=element as unknown as SVGGraphicsElement;const parent=image.parentElement as unknown as SVGGraphicsElement;
  const box=image.getBBox();const relative=parent.getScreenCTM()!.inverse().multiply(image.getScreenCTM()!);const origin=new DOMPoint(0,0).matrixTransform(relative);const right=new DOMPoint(box.width,0).matrixTransform(relative);const bottom=new DOMPoint(0,box.height).matrixTransform(relative);
  const decoration=parent.parentElement as unknown as SVGGraphicsElement;const affine=(decoration.parentElement as unknown as SVGGraphicsElement).getScreenCTM()!.inverse().multiply(decoration.getScreenCTM()!);
  return {width:Math.hypot(right.x-origin.x,right.y-origin.y),height:Math.hypot(bottom.x-origin.x,bottom.y-origin.y),x:origin.x,y:origin.y,rotation:Math.atan2(affine.b,affine.a)*180/Math.PI,nodeX:affine.e,nodeY:affine.f};
 });
 expect(dimensions.width).toBeCloseTo(74.062501,4);expect(dimensions.height).toBeCloseTo(160,4);expect(dimensions.width/dimensions.height).toBeCloseTo(.4628904,6);expect(dimensions.width/dimensions.height).toBeCloseTo(148/320,3);expect(dimensions.x).toBeCloseTo(42.968716,4);expect(dimensions.y).toBeCloseTo(-.000036,4);expect(dimensions.rotation).toBeCloseTo(12,4);expect(dimensions.nodeX).toBeCloseTo(33.265903,4);expect(dimensions.nodeY).toBeCloseTo(0,4);
});
test('actual blurred atmosphere output stops at the enabled source frame edge',async({page})=>{
 await fixtures(page);await page.goto('/community');const svg=page.getByTestId('community-atmosphere');
 const pixels=await svg.evaluate(async element=>{
  const clone=element.cloneNode(true) as SVGSVGElement;clone.setAttribute('width','375');clone.setAttribute('height','812');clone.removeAttribute('style');clone.querySelector(':scope > rect')!.remove();
  const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=375;canvas.height=812;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);const data=context.getImageData(0,0,375,812).data;
  let below=0,inside=0;for(let x=0;x<375;x++){below+=data[(700*375+x)*4+3];inside+=data[(600*375+x)*4+3];}return {below,inside};
 });
 expect(pixels.inside).toBeGreaterThan(0);expect(pixels.below).toBe(0);
 await expect(svg.locator('clipPath rect')).toHaveAttribute('height','611.3303833007812');
});
test('one native grouped card action exposes all honest facts including unavailable state',async({page})=>{
 await fixtures(page);await page.route('**/api/community/apps**',r=>r.fulfill({json:{items:[publication('first',false)],next_cursor:null}}));await page.goto('/community');
 for(const id of ['discovery-publication-first','featured-publication-first'])await expect(page.getByTestId(id)).toHaveAccessibleName('查看应用 first，作者 first，查看应用介绍，暂不可用');
 await expect(page.getByTestId('featured-publication-first').getByText('作者 first',{exact:true})).toHaveCSS('color','rgb(102, 70, 198)');
});
test('delayed double activation sends one page request and late results cannot overwrite a returned focus',async({page})=>{
 await fixtures(page);let initialReads=0,pages=0;let release!:()=>void;const delayed=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/library/favorites**',route=>route.fulfill({json:{items:[],next_cursor:null}}));
 await page.route('**/api/community/apps**',async route=>{
  if(new URL(route.request().url()).searchParams.has('cursor')){pages++;await delayed;await route.fulfill({json:{items:[publication('stale')],next_cursor:null}});}
  else{initialReads++;await route.fulfill({json:{items:[publication(initialReads===1?'first':'fresh')],next_cursor:'page-2'}});}
 });
 await page.goto('/community');await page.getByTestId('community-load-more').dblclick();await expect.poll(()=>pages).toBe(1);
 await page.getByTestId('discovery-publication-first').click();await expect(page).toHaveURL(/\/community\/first$/);
 await page.getByRole('button',{name:'应用社区',exact:true}).click();await expect(page.getByTestId('discovery-publication-fresh')).toBeVisible();
 const response=page.waitForResponse(response=>new URL(response.url()).searchParams.get('cursor')==='page-2');release();await response;await page.waitForLoadState('networkidle');
 expect(pages).toBe(1);await expect(page.getByTestId('discovery-publication-stale')).toHaveCount(0);await expect(page.getByTestId('discovery-publication-fresh')).toBeVisible();
});

import {expect,test} from '@playwright/test';
import {getSourceMotion} from '../design/sourceMotionEvidence';
import {sampleSourceEasing} from '../features/navigation/sourceMotionPolicy';
test('source settings runs spring start/middle/end and interruption keeps current presentation',async({page})=>{
 await page.goto('/motion');await expect(page.getByTestId('source-settings')).toBeVisible();await page.clock.install({time:new Date(0)});await page.clock.pauseAt(new Date(10000));
 const control=page.getByTestId('source-settings'),width=()=>control.locator('[data-source-control-width]').getAttribute('data-source-control-width').then(Number);
 expect(await width()).toBe(38);await control.hover();await page.clock.runFor(220);
 const measured=await width();expect(measured).not.toBe(38);
 await page.mouse.move(350,700);const before=await width();await page.clock.runFor(1);expect(Math.abs((await width())-before)).toBeLessThan(.1);
 await page.clock.runFor(1500);expect(await width()).toBe(38);
});
test('isolated visual reaction completes both click/timeout paths without an API request',async({page})=>{
 const requests:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))requests.push(request.url());});
 await page.goto('/motion');const reaction=page.getByTestId('source-reaction');await expect(reaction).toBeVisible();await page.clock.install({time:new Date(0)});await page.clock.pauseAt(new Date(10000));
 await reaction.click();await page.clock.runFor(900);await expect(reaction.locator('[data-source-control-state]')).toHaveAttribute('data-source-control-state','228:19791');
 await reaction.click();await page.clock.runFor(900);await expect(reaction.locator('[data-source-control-state]')).toHaveAttribute('data-source-control-state','228:19794');expect(requests).toEqual([]);
});
for(const [direction,owner] of Object.entries({top:'825:5828',bottom:'268:23006',left:'825:6984',right:'266:21193'}))test(`actual ${direction} route layer follows raw curve and releases frozen IDs`,async({page})=>{
 await page.goto('/motion');await expect(page.getByTestId('motion-fixture')).toBeVisible();await page.clock.install({time:new Date(0)});await page.clock.pauseAt(new Date(10000));await page.getByTestId(`route-${direction}`).click();
 const snapshot=page.locator('[data-source-route-snapshot]');await expect(snapshot).toContainText('Actual previous DOM text');await expect(snapshot.locator('[inert]')).toHaveCount(1);
 const motion=getSourceMotion(owner,'ON_CLICK')!;await page.clock.runFor(motion.durationMs/2);
 const sample=await page.locator('[data-source-route-progress]').evaluate(element=>({progress:Number(element.getAttribute('data-source-route-progress')),matrix:new DOMMatrix(getComputedStyle(element).transform).toString()}));
 expect(Math.abs(sample.progress-sampleSourceEasing(motion,.5))).toBeLessThan(.1);
 const duplicate=await page.evaluate(()=>{const ids=Array.from(document.querySelectorAll('[id]'),e=>e.id);return ids.length-new Set(ids).size;});expect(duplicate).toBe(0);
 await page.clock.runFor(motion.durationMs+100);await expect(snapshot).toHaveCount(0);await expect(page.getByTestId('motion-fixture')).toContainText(`Current ${direction} destination DOM`);
});
test('reduced motion releases presentation immediately',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/motion');await page.getByTestId('route-top').click();await expect(page.locator('[data-source-route-snapshot]')).toHaveCount(0);await expect(page.getByTestId('motion-fixture')).toContainText('Current top destination DOM');
});
test('canonical SMART uses matched source node bounds and local paint layers without a page fade',async({page})=>{
 await page.goto('/motion');await expect(page.getByTestId('smart-navigation')).toBeVisible();await page.clock.install({time:new Date(0)});await page.clock.pauseAt(new Date(10000));
 const before=await page.getByTestId('smart-navigation').boundingBox();await page.getByTestId('route-smart').click();await page.clock.runFor(300);
 const current=page.getByTestId('smart-navigation'),box=await current.boundingBox();
 const progress=await page.locator('[data-source-route-progress]').getAttribute('data-source-route-progress').then(Number);
 expect(progress).toBeGreaterThan(0);expect(progress).toBeLessThan(1);
 expect(box!.width).toBeLessThan(before!.width);expect(box!.width).toBeGreaterThan(334);
 await expect(current).toContainText('PREVIOUS SOURCE HEADER');expect(await page.locator('[data-source-route-progress]').evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
 await page.clock.runFor(600);await expect(page.locator('[data-source-route-snapshot]')).toHaveCount(0);expect((await current.boundingBox())!.width).toBeCloseTo(334,1);
});

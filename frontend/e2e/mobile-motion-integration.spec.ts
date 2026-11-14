import {expect,test,type Page} from '@playwright/test';
async function productionHome(page:Page){await page.addInitScript(()=>localStorage.setItem('token','fixture-token'));await page.route('**/auth/me',route=>route.fulfill({json:{id:1,username:'owner',email:'owner@test.example'}}));await page.goto('/');await expect(page.getByTestId('mobile-home')).toBeVisible();}
test('production Home source wrappers keep links and all card hit areas at least44',async({page})=>{
 await productionHome(page);
 for(const id of ['home-mibo-open','home-card-store','home-card-products','home-card-community','home-card-profile']){const box=await page.getByTestId(id).boundingBox();expect(box).not.toBeNull();expect(box!.height,id).toBeGreaterThanOrEqual(44);expect(box!.width,id).toBeGreaterThanOrEqual(44);}
 await page.getByTestId('home-card-products').click();await expect(page.getByTestId('home-card-products')).toHaveAttribute('aria-expanded','true');await page.getByTestId('home-card-products-open').click();await expect(page).toHaveURL(/\/app-gallery$/);
});
test('production Mibo source header keeps its actual340x44 content row',async({page})=>{
 await productionHome(page);await page.goto('/chatbot');await expect(page.getByTestId('chatbot-back')).toBeVisible();
 const header=page.locator('[data-source-smart-id="845:3502"]'),row=header.locator(':scope > div').first();const box=await row.boundingBox();expect(box!.width).toBeCloseTo(340,2);expect(box!.height).toBeCloseTo(44,2);
});
for(const [presentation,owner] of [['avatar','188:16337'],['cloud','188:16805']] as const)test(`production ${presentation} presentation uses actual SMART click owner ${owner}`,async({page})=>{
 await productionHome(page);await page.clock.install({time:new Date(0)});await page.clock.pauseAt(new Date(10000));
 if(presentation==='avatar'){await page.getByTestId('home-mibo-avatar').hover();await page.clock.runFor(1100);}else{await page.getByTestId('home-inspiration-refresh').click();await page.clock.runFor(1100);}
 await page.getByTestId('home-mibo-open').click();await expect(page).toHaveURL(/\/chatbot$/);await expect(page.locator('[data-source-route-owner]')).toHaveAttribute('data-source-route-owner',owner);
 expect(await page.locator('[data-source-route-progress]').evaluate(node=>getComputedStyle(node).opacity)).toBe('1');
 const retained=page.locator('[data-source-route-snapshot]');expect(await retained.count()).toBeGreaterThan(0);expect(await retained.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).pointerEvents==='none'))).toBe(true);
 await page.clock.runFor(700);await expect(retained).toHaveCount(0);
});

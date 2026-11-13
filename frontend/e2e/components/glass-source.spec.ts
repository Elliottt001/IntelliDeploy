import {test,expect} from '@playwright/test';
test('actual live glass changes stripe pixels and tracks dynamic earlier text without remount',async({page})=>{
 await page.addInitScript(()=>{(window as any).__glassBufferBuilds=0;const original=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(...args){(window as any).__glassBufferBuilds++;return original.apply(this,args);};});
 await page.goto('/glass');
 await expect(page.getByTestId('glass-fixture')).toBeVisible();
 const lens=page.getByTestId('glass-region');
 const nested=page.getByTestId('glass-nested-region');
 const nestedZero=await nested.screenshot();
 const zero=await lens.screenshot();
 await page.getByTestId('glass-enable').click();
 await page.waitForTimeout(100);
 const refracted=await lens.screenshot();
 expect(refracted.equals(zero)).toBe(false);
 expect((await nested.screenshot()).equals(nestedZero)).toBe(false);
 const builds=await page.evaluate(()=>(window as any).__glassBufferBuilds);
 await page.getByTestId('glass-underlay').click();
 expect(await page.evaluate(()=>(window as any).__glassBufferBuilds)).toBe(builds);
 expect((await lens.screenshot()).equals(refracted)).toBe(false);
 await page.getByTestId('glass-enable').click();
 await page.getByTestId('glass-underlay').click();
 expect((await lens.screenshot()).equals(zero)).toBe(true);
});

test('frost, RGB dispersion, light, bevel, reflection and seeded noise affect actual sampled output',async({page})=>{
 await page.goto('/glass');const lens=page.getByTestId('glass-region');
 const set=async(value:Record<string,number>)=>{await page.getByTestId('glass-params').fill(JSON.stringify(value));await page.waitForTimeout(60);return lens.screenshot();};
 const zero=await set({});
 const controls:Array<Record<string,number>>=[{radius:4},{refractionIntensity:.8},{specularIntensity:1},{specularIntensity:1,bevelSize:4},{reflectionDistance:8}];
 for(const value of controls)expect((await set(value)).equals(zero)).toBe(false);
 const normal=await set({refractionIntensity:.8});
 expect((await set({refractionIntensity:.8,chromaticAberration:1})).equals(normal)).toBe(false);
 expect((await set({refractionIntensity:0})).equals(zero)).toBe(true);
 await page.getByTestId('glass-noise').fill(JSON.stringify({density:.5,seed:17}));const noise=await lens.screenshot();
 expect(noise.equals(zero)).toBe(false);
 await page.getByTestId('glass-noise').fill(JSON.stringify({density:.5,seed:18}));expect((await lens.screenshot()).equals(noise)).toBe(false);
 await page.getByTestId('glass-noise').fill(JSON.stringify({density:.5,seed:17}));expect((await lens.screenshot()).equals(noise)).toBe(true);
 await page.getByTestId('glass-noise').fill(JSON.stringify({density:0,seed:17}));expect((await lens.screenshot()).equals(zero)).toBe(true);
});

test('original frame, ellipse, rounded rectangle and vector paths refract live input at DPR2 and remain aligned after scroll',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:400},deviceScaleFactor:2});const page=await context.newPage();
 await page.goto('http://127.0.0.1:8187/glass');const lens=page.getByTestId('glass-region');
 for(const sourceNodeId of ['270:26530','119:76672','270:26347','280:26959']){
  await page.getByTestId('glass-shape').fill(sourceNodeId);
  const zero=await lens.screenshot();await page.getByTestId('glass-enable').click();
  expect((await lens.screenshot()).equals(zero)).toBe(false);await page.getByTestId('glass-enable').click();
 }
 await page.getByTestId('glass-enable').click();const before=await lens.screenshot();
 await page.evaluate(()=>{document.querySelector('[data-testid="glass-fixture"]')!.setAttribute('style','padding-top:250px;background:white;height:1200px');});
 await page.evaluate(()=>window.scrollTo(0,150));
 expect((await lens.screenshot()).equals(before)).toBe(true);
 await context.close();
});

import {test,expect} from '@playwright/test';
test('actual live glass changes stripe pixels and tracks dynamic earlier text without remount',async({page})=>{
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
 await page.getByTestId('glass-underlay').click();
 expect((await lens.screenshot()).equals(refracted)).toBe(false);
 await page.getByTestId('glass-enable').click();
 await page.getByTestId('glass-underlay').click();
 expect((await lens.screenshot()).equals(zero)).toBe(true);
});

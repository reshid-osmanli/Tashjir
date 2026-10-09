import { test, expect } from '@playwright/test';
import { UI_REGISTRY } from '../../src/ui/ui-registry';
for (const route of UI_REGISTRY.filter(e=>e.kind==='route')) {
  test(`UI route ${route.route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error=>errors.push(error.message));
    const response=await page.goto(route.route);
    expect(response?.status()).toBe(200);
    await expect(page.locator(`[data-ui-id="${route.id}"]`).first()).toBeVisible();
    const missing=await page.locator('button,input,select,textarea,summary,a,[role="tab"],[role="menuitem"]:not([data-ui-id])').evaluateAll(nodes=>nodes.filter(n=>!n.hasAttribute('data-ui-id')&&!n.closest('nextjs-portal')).map(n=>n.outerHTML.slice(0,180)));
    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test('Inspector Alt-click reads exact ID without invoking the button', async ({page})=>{
 await page.goto('/editor');
 await page.locator('[data-ui-id="A410"]').click();
 await page.locator('[data-ui-id="A116"]').click({modifiers:['Alt']});
 await expect(page.locator('[data-ui-id="A412"]')).toContainText('A116');
 await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);
});

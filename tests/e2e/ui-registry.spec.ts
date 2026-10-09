import { test, expect } from '@playwright/test';
import { UI_REGISTRY } from '../../src/ui/ui-registry';

for (const route of UI_REGISTRY.filter((entry) => entry.kind === 'route')) {
  test(`UI route ${route.route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(route.route);
    expect(response?.status()).toBe(200);
    await expect(page.locator(`[data-ui-id="${route.id}"]`).first()).toBeVisible();
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);

    const missing = await page.locator(
      'button,input,select,textarea,summary,a,[role="tab"],[role="menuitem"]'
    ).evaluateAll((nodes) => nodes
      .filter((node) => !node.hasAttribute('data-ui-id') && !node.closest('nextjs-portal'))
      .map((node) => node.outerHTML.slice(0, 180)));
    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
  });
}

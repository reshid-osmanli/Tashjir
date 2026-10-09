import { test, expect } from '@playwright/test';
import { UI_REGISTRY } from '../../src/ui/ui-registry';

const mainInspectorRoutes = ['/editor', '/studio', '/quran', '/tracking'];

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

test('production Inspector shows DOM-backed badges on the main application routes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const route of mainInspectorRoutes) {
    const response = await page.goto(`${route}?uiInspector=1`);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('[data-ui-inspector-toggle]'), route).toBeVisible();
    const badges = page.locator('[data-ui-badge-for]');
    await expect(badges.first(), route).toBeVisible();

    const overlayReport = await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll('[data-ui-id]'))
        .filter((target) => !target.closest('[data-ui-inspector-root]'))
        .filter((target) => {
          const rect = target.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight &&
            rect.right >= 0 && rect.left <= innerWidth;
        });
      const badges = Array.from(document.querySelectorAll('[data-ui-badge-for]'));
      const invalidMappings = badges
        .filter((badge) => {
          const targetId = badge.getAttribute('data-ui-badge-for');
          return !targetId || badge.textContent?.trim() !== targetId ||
            !targets.some((target) => target.getAttribute('data-ui-id') === targetId);
        })
        .map((badge) => ({
          text: badge.textContent?.trim(),
          target: badge.getAttribute('data-ui-badge-for'),
        }));
      return { visibleTargets: targets.length, badges: badges.length, invalidMappings };
    });
    expect(overlayReport.badges, `${route}: every visible registered element must have a badge`)
      .toBe(overlayReport.visibleTargets);
    expect(overlayReport.invalidMappings, `${route}: every visible badge must match a real DOM identity`)
      .toEqual([]);
  }

  expect(errors).toEqual([]);
});

test('editor Inspector identifies a real button and input, preserves interaction, and toggles cleanly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  const response = await page.goto('/editor?uiInspector=1');
  expect(response?.status()).toBe(200);
  await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();

  const button = page.locator('[data-ui-id="A116"]').first();
  const input = page.locator('[data-ui-id="A110"]').first();
  const dropdown = page.locator('[data-ui-id="A108"]').first();
  const buttonBadge = page.locator('[data-ui-badge-for="A116"]').first();
  const inputBadge = page.locator('[data-ui-badge-for="A110"]').first();
  const dropdownBadge = page.locator('[data-ui-badge-for="A108"]').first();
  await expect(button).toBeVisible();
  await expect(input).toBeVisible();
  await expect(dropdown).toBeVisible();
  await expect(buttonBadge).toBeVisible();
  await expect(inputBadge).toBeVisible();
  await expect(dropdownBadge).toBeVisible();
  await dropdown.selectOption('1');
  await expect(dropdown).toHaveValue('1');

  const buttonId = await button.getAttribute('data-ui-id');
  const inputId = await input.getAttribute('data-ui-id');
  expect(await buttonBadge.textContent()).toBe(buttonId);
  expect(await buttonBadge.getAttribute('data-ui-badge-for')).toBe(buttonId);
  expect(await inputBadge.textContent()).toBe(inputId);
  expect(await inputBadge.getAttribute('data-ui-badge-for')).toBe(inputId);
  expect(await buttonBadge.evaluate((badge) => getComputedStyle(badge).pointerEvents)).toBe('none');
  expect(await inputBadge.evaluate((badge) => getComputedStyle(badge).pointerEvents)).toBe('none');

  // Search suggestions are created dynamically after typing and receive badges too.
  await input.fill('الحمد');
  await expect(input).toHaveValue('الحمد');
  await expect(page.locator('[data-ui-id="A737"]')).toBeVisible();
  await expect(page.locator('[data-ui-badge-for="A739"]').first()).toBeVisible();
  await input.fill('');

  // Alt+click selects the real UI control without invoking its normal action.
  await button.click({ modifiers: ['Alt'] });
  const details = page.locator('[data-ui-id="A412"]');
  await expect(details.locator('[data-ui-inspector-selected-id]')).toHaveText('A116');
  await expect(details).toContainText('Open Smart Create Button');
  await expect(details).toContainText('Kind');
  await expect(details).toContainText('/editor');
  await expect(details).toContainText('A114');
  await expect(details).toContainText('A001');
  await expect(details).toContainText('VariantsPanel');
  await expect(details).toContainText('src/components/editor/VariantsPanel.tsx');
  await expect(details).toContainText('setShowSmartWizard');
  await expect(details).toContainText('A102');
  await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);

  const copyButton = details.locator('[data-ui-id="A732"]');
  await copyButton.click();
  await expect(copyButton).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('A116');

  const screenshotPath = process.env.PLAYWRIGHT_BASE_URL
    ? 'test-results/ui-inspector-vercel-preview.png'
    : 'test-results/ui-inspector-local-production.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // A regular click is not captured by the Inspector and the editor keeps working.
  await page.keyboard.press('Escape');
  await button.click();
  await expect(page.locator('[data-ui-id="A421"]')).toBeVisible();
  await expect(page.locator('[data-ui-badge-for="A421"]')).toBeVisible();

  await page.locator('[data-ui-inspector-toggle]').click();
  await expect(page.locator('[data-ui-inspector-toggle]')).toHaveCount(0);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('uiInspector')).toBe(false);
  await expect(page.locator('[data-ui-id="A421"]')).toBeVisible();

  await page.keyboard.press('Alt+Shift+i');
  await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();
  await page.keyboard.press('Alt+Shift+i');
  await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

import { test, expect, type Page } from '@playwright/test';
import { ph3Document } from '../helpers/ph3-fixture';
import { UI_REGISTRY } from '../../src/ui/ui-registry';

const mainInspectorRoutes = ['/editor', '/studio', '/quran', '/tracking'];

/** مرّر المؤشر على عنصر مسجّل وانتظر شارته. */
async function hoverIdentity(page: Page, uiId: string) {
  const target = page.locator(`[data-ui-id="${uiId}"]`).first();
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box, `bounding box for ${uiId}`).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.locator(`[data-ui-badge-for="${uiId}"]`).first()).toBeVisible();
  return target;
}

/** اضغط شارة المعرّف نفسها — لا العنصر الأصلي. */
async function clickBadge(page: Page, uiId: string) {
  const badge = page.locator(`[data-ui-badge-for="${uiId}"]`).first();
  await expect(badge, `badge for ${uiId}`).toBeVisible();
  await badge.click();
  return badge;
}

for (const route of UI_REGISTRY.filter((entry) => entry.kind === 'route')) {
  test(`UI route ${route.route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(route.route);
    expect(response?.status()).toBe(200);
    await expect(page.locator(`[data-ui-id="${route.id}"]`).first()).toBeVisible();
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
    await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(0);

    const missing = await page.locator(
      'button,input,select,textarea,summary,a,[role="tab"],[role="menuitem"]'
    ).evaluateAll((nodes) => nodes
      // `data-next-mark` هو زر أدوات المطوّر الخاص بـ Next في وضع التطوير فقط.
      .filter((node) => !node.hasAttribute('data-ui-id') && !node.closest('nextjs-portal') &&
        !node.hasAttribute('data-next-mark'))
      .map((node) => node.outerHTML.slice(0, 180)));
    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('enabled Inspector never floods the UI: no badge is rendered until an element is targeted', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const route of mainInspectorRoutes) {
    const response = await page.goto(`${route}?uiInspector=1`);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('[data-ui-inspector-toggle]'), route).toBeVisible();

    // The page really does contain many registered elements, so "no badge"
    // is a meaningful assertion rather than an empty-page side effect.
    const registeredCount = await page.evaluate(() => Array.from(
      document.querySelectorAll('[data-ui-id]'),
    ).filter((node) => {
      if (node.closest('[data-ui-inspector-root]')) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length);
    expect(registeredCount, `${route}: expected many registered elements`).toBeGreaterThan(10);

    await expect(page.locator('[data-ui-badge-for]'), `${route}: no permanent badges`).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-hover-outline]'), route).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-pin-outline]'), route).toHaveCount(0);
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
  await expect(button).toBeVisible();
  await expect(input).toBeVisible();
  await expect(dropdown).toBeVisible();

  // Enabling the Inspector must not move or resize anything.
  const buttonBoxBefore = await button.boundingBox();
  await dropdown.selectOption('1');
  await expect(dropdown).toHaveValue('1');

  await hoverIdentity(page, 'A116');
  const buttonBadge = page.locator('[data-ui-badge-for="A116"]').first();
  await expect(buttonBadge).toHaveText(/^A116/);
  expect(await buttonBadge.getAttribute('data-ui-badge-for')).toBe('A116');
  // The badge is clickable now: it is the pin affordance.
  expect(await buttonBadge.evaluate((badge) => getComputedStyle(badge).pointerEvents)).toBe('auto');

  await hoverIdentity(page, 'A110');
  await expect(page.locator('[data-ui-badge-for="A110"]').first()).toHaveText(/^A110/);
  await input.fill('الحمد');
  await expect(input).toHaveValue('الحمد');
  // Suggestions are created dynamically after typing and are identifiable too.
  await expect(page.locator('[data-ui-id="A737"]')).toBeVisible();
  await hoverIdentity(page, 'A739');
  await input.fill('');

  // Clicking the badge pins the element without running its own action.
  await hoverIdentity(page, 'A116');
  await clickBadge(page, 'A116');
  const details = page.locator('[data-ui-id="A412"]');
  await expect(details.locator('[data-ui-inspector-selected-id]')).toHaveText('A116');
  await expect(details).toContainText('Open Smart Create Button');
  await expect(details).toContainText('Type');
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
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // A regular click is not captured by the Inspector and the editor keeps working.
  await page.keyboard.press('Escape');
  await button.click();
  await expect(page.locator('[data-ui-id="A421"]')).toBeVisible();

  await page.locator('[data-ui-inspector-toggle]').click();
  await expect(page.locator('[data-ui-inspector-toggle]')).toHaveCount(0);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('uiInspector')).toBe(false);
  await expect(page.locator('[data-ui-id="A421"]')).toBeVisible();

  expect(await button.boundingBox()).toEqual(buttonBoxBefore);

  await page.keyboard.press('Alt+Shift+i');
  await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();
  await page.keyboard.press('Alt+Shift+i');
  await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('inspector badge click never invokes the delete action of the pinned button', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    (doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)),
    ph3Document(),
  );

  await page.goto('/editor?uiInspector=1');
  await expect(page.locator('[data-ui-id="A116"]').first()).toBeVisible();

  await page.locator('[data-ui-id="A1580"]').first().click({ modifiers: ['Control'] });
  const deleteButton = page.locator('[data-ui-id="A333"]').first();
  await expect(deleteButton).toBeVisible();

  const before = await page.evaluate(() => localStorage.getItem('tashjeer:doc:v2:1004'));
  await hoverIdentity(page, 'A333');
  await clickBadge(page, 'A333');

  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline][data-ui-inspector-outline-for="A333"]')).toHaveCount(1);
  await expect(page.locator('[data-ui-id="A412"]').locator('[data-ui-inspector-selected-id]')).toHaveText('A333');
  expect(await page.evaluate(() => localStorage.getItem('tashjeer:doc:v2:1004'))).toBe(before);
  expect(errors).toEqual([]);
});

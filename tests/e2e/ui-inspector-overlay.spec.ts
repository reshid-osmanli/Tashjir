import { expect, test } from '@playwright/test';
import { UI_REGISTRY } from '../../src/ui/ui-registry';

/**
 * UI ID Inspector — end-to-end proof that the visual overlay works on the real
 * interface (development AND production builds, e.g. Vercel Preview).
 *
 * Run against a production build (what Vercel Preview serves):
 *   npm run build && CI=1 E2E_PRODUCTION=1 npx playwright test
 * Run against a live deployment (e.g. Vercel Preview URL):
 *   E2E_BASE_URL=https://<preview>.vercel.app npx playwright test
 */

const TOGGLE = '[data-ui-id="A410"]';
const OVERLAY = '[data-ui-id="A411"]';
const PANEL = '[data-ui-id="A412"]';
const BADGE = '[data-ui-id="A731"]';
const COPY_BUTTON = '[data-ui-id="A2126"]';

function collectErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.describe('UI ID Inspector overlay', () => {
  test('?uiInspector=1 shows real, visible ID badges on registered button and input (/editor)', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/editor?uiInspector=1');

    // Enabled straight from the URL — no click, no DevTools, no localhost tweaks.
    await expect(page.locator(TOGGLE)).toContainText('ON');
    await expect(page.locator(OVERLAY)).toBeVisible();

    const badges = page.locator(BADGE);
    await expect(badges.first()).toBeVisible();
    expect(await badges.count()).toBeGreaterThan(50);

    // --- Registered button: the badge element itself exists, is visible, and
    // its text equals the live data-ui-id of the real button in the DOM.
    const button = page.locator('button[data-ui-id="A103"]').first();
    await expect(button).toBeVisible();
    expect(await button.getAttribute('data-ui-id')).toBe('A103');
    const buttonBadge = page.locator(`${BADGE}[data-ui-instance="A103"]`).first();
    await expect(buttonBadge).toBeVisible();
    await expect(buttonBadge).toHaveText('A103');
    const buttonBadgeBox = await buttonBadge.boundingBox();
    expect(buttonBadgeBox).not.toBeNull();
    expect(buttonBadgeBox!.width).toBeGreaterThan(0);
    expect(buttonBadgeBox!.height).toBeGreaterThan(0);

    // The ID shown is a real registry record (kind/route/component), not a mock.
    const buttonRecord = UI_REGISTRY.find((entry) => entry.id === 'A103');
    expect(buttonRecord, 'A103 must exist in the UI Registry').toBeTruthy();
    expect(buttonRecord!.kind).toBe('button');

    // --- Registered input field: badge visible next to/above the real input.
    const input = page.locator('input[data-ui-id="A766"]').first();
    await expect(input).toBeVisible();
    await expect(page.locator(`${BADGE}[data-ui-instance="A766"]`).first()).toBeVisible();

    // --- Badges must never block interaction: they are click-through labels.
    const allClickThrough = await badges.evaluateAll((elements) =>
      elements.every((element) => getComputedStyle(element).pointerEvents === 'none')
    );
    expect(allClickThrough).toBe(true);
    const hitTarget = await page.evaluate(() => {
      const target = document.querySelector('button[data-ui-id="A103"]');
      if (!(target instanceof Element)) return null;
      const rect = target.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit instanceof Element
        ? hit.closest('[data-ui-id]')?.getAttribute('data-ui-id') ?? null
        : null;
    });
    expect(hitTarget).toBe('A103');

    expect(errors).toEqual([]);
  });

  test('clicking a registered element shows its real registry details and suppresses the app action', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/editor?uiInspector=1');

    const record = UI_REGISTRY.find((entry) => entry.id === 'A116');
    expect(record, 'A116 must exist in the UI Registry').toBeTruthy();

    // Plain click while the inspector is on (the way a user inspects).
    await page.locator('button[data-ui-id="A116"]').first().click();

    // Details card appears with the real ID and real registry fields.
    await expect(page.locator(PANEL)).toBeVisible();
    await expect(page.locator(PANEL)).toContainText('A116');
    await expect(page.locator(PANEL)).toContainText(record!.name);
    await expect(page.locator(PANEL)).toContainText(record!.kind);
    await expect(page.locator(PANEL)).toContainText(record!.route);
    await expect(page.locator(PANEL)).toContainText(record!.component);
    await expect(page.locator(PANEL)).toContainText(record!.sourceFile);
    await expect(page.locator(PANEL)).toContainText('Parent ID');
    await expect(page.locator(PANEL)).toContainText('Feature ID');
    await expect(page.locator(PANEL)).toContainText('Related IDs');

    // Inspect-mode click must not trigger the button's real action:
    // A116 normally opens the Smart Create wizard dialog (A421).
    await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('copy button writes the selected element real ID to the clipboard', async ({ page, context }) => {
    const errors = collectErrors(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/editor?uiInspector=1');
    await page.locator('button[data-ui-id="A116"]').first().click();

    const copyButton = page.locator(`${PANEL} ${COPY_BUTTON}`);
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(copyButton).toContainText('Copied');

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('A116');

    expect(errors).toEqual([]);
  });

  test('toggle button and Alt+Shift+I switch the inspector; disabled state leaves the UI untouched', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/editor');

    // Disabled by default: only the small toggle exists, no overlay, no badges.
    await expect(page.locator(TOGGLE)).toContainText('OFF');
    await expect(page.locator(OVERLAY)).toHaveCount(0);
    await expect(page.locator(BADGE)).toHaveCount(0);
    await expect(page.locator(PANEL)).toHaveCount(0);

    // Keyboard activation works like the visible toggle.
    await page.keyboard.press('Alt+Shift+I');
    await expect(page.locator(TOGGLE)).toContainText('ON');
    await expect(page.locator(BADGE).first()).toBeVisible();

    // The visible toggle switches it off again: every badge disappears.
    await page.locator(TOGGLE).click();
    await expect(page.locator(TOGGLE)).toContainText('OFF');
    await expect(page.locator(BADGE)).toHaveCount(0);
    await expect(page.locator(OVERLAY)).toHaveCount(0);
    await expect(page.locator(PANEL)).toHaveCount(0);

    // With the inspector off, normal interaction is fully restored:
    // the focus-mode button (A132) performs its real action.
    const focusButton = page.locator('button[data-ui-id="A132"]');
    const labelBefore = await focusButton.textContent();
    await focusButton.click();
    await expect(focusButton).not.toHaveText(labelBefore ?? '');
    await expect(page.locator(PANEL)).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  for (const route of ['/editor', '/studio', '/quran', '/tracking']) {
    test(`badges appear via URL param and disappear on toggle for ${route}`, async ({ page }) => {
      const errors = collectErrors(page);

      await page.goto(`${route}?uiInspector=1`);
      const badges = page.locator(BADGE);
      await expect(badges.first()).toBeVisible();
      expect(await badges.count()).toBeGreaterThan(0);

      await page.locator(TOGGLE).click();
      await expect(badges).toHaveCount(0);
      await expect(page.locator(TOGGLE)).toContainText('OFF');

      expect(errors).toEqual([]);
    });
  }
});

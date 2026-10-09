import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { UI_REGISTRY } from '../../src/ui/ui-registry';

/**
 * UI ID Inspector in a real browser. These run against the production build (next start) as well
 * as dev, because the inspector must work on the build Vercel serves. Each test drives the UI the
 * way a person would: keyboard shortcut, URL switch, clicks and the on-screen buttons.
 */

const ACTIVE_IDS = new Set(UI_REGISTRY.filter((entry) => entry.status === 'active').map((entry) => entry.id));
const ROUTES = ['/', '/editor', '/studio', '/quran', '/tracking', '/variants', '/qiraat', '/readers', '/review', '/admin', '/settings', '/statistics', '/login'];
const SCREENSHOT_DIR = 'test-results/ui-inspector';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

const toggle = (page: Page) => page.locator('[data-ui-id="A410"]');
const clickMode = (page: Page) => page.locator('[data-ui-id="A2127"]');
const card = (page: Page) => page.locator('[data-ui-id="A412"]');
const badge = (page: Page, id: string) => page.locator(`[data-ui-inspector-badge="${id}"]`);
const visibleTarget = (page: Page, id: string) => page.locator(`[data-ui-id="${id}"]:visible`).first();
/** Value of a row in the details card, found by its label. */
const detail = (page: Page, label: string) => card(page).locator(`xpath=.//dt[normalize-space()="${label}"]/following-sibling::dd[1]`);

/** Badges that the browser would hit-test as the topmost element at their centre. Must be zero. */
async function badgesIntercepting(page: Page): Promise<number> {
  return page.evaluate(() => {
    let intercepting = 0;
    document.querySelectorAll<HTMLElement>('[data-ui-inspector-badge]').forEach((node) => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (hit?.closest('[data-ui-inspector-badge]')) intercepting += 1;
      if (getComputedStyle(node).pointerEvents !== 'none') intercepting += 1;
    });
    return intercepting;
  });
}

/** Registered elements that are on screen (outside the inspector) against the badges drawn for them. */
async function coverage(page: Page): Promise<{ elements: number; badges: number }> {
  return page.evaluate(() => {
    let elements = 0;
    document.querySelectorAll<Element>('[data-ui-id]').forEach((node) => {
      if (node.closest('[data-ui-inspector-root]')) return;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (rect.right < 0 || rect.bottom < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight) return;
      elements += 1;
    });
    return { elements, badges: document.querySelectorAll('[data-ui-inspector-badge]').length };
  });
}

/** A badge sits above an element's top-left corner, or just inside it, and never far from it. */
async function expectBadgeNear(badgeLocator: Locator, target: Locator): Promise<void> {
  const b = await badgeLocator.boundingBox();
  const t = await target.boundingBox();
  expect(b, 'badge is rendered').not.toBeNull();
  expect(t, 'target is rendered').not.toBeNull();
  expect(b!.y, 'badge is at or above the element top').toBeGreaterThan(t!.y - 24);
  expect(b!.y, 'badge is not below the element').toBeLessThan(t!.y + t!.height);
  expect(b!.x, 'badge starts near the element left').toBeGreaterThan(t!.x - 4);
  expect(b!.x, 'badge is not far to the right').toBeLessThan(t!.x + t!.width + 160);
}

test.describe('UI ID Inspector', () => {
  test('editor: Alt+Shift+I shows real ID badges, click-inspect shows registry data, and off restores the page', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/editor');
    await expect(visibleTarget(page, 'A116')).toBeVisible();
    await page.mouse.move(1, 1);

    // Off by default: nothing from the inspector exists in the page.
    await expect(toggle(page)).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
    const before = await page.screenshot({ animations: 'disabled', caret: 'hide' });

    // Turn it on with the keyboard shortcut.
    await page.keyboard.press('Alt+Shift+KeyI');
    await expect(toggle(page)).toBeVisible();
    await expect(toggle(page)).toContainText('UI ID Inspector');
    await expect(page).toHaveURL(/[?&]uiInspector=1/);

    // Real badges over a registered button and over a registered field.
    const buttonBadge = badge(page, 'A116').first();
    await expect(buttonBadge).toBeVisible();
    await expect(buttonBadge).toHaveText('A116');
    await expectBadgeNear(buttonBadge, visibleTarget(page, 'A116'));
    const fieldBadge = badge(page, 'A110').first();
    await expect(fieldBadge).toBeVisible();
    await expect(fieldBadge).toHaveText('A110');
    await expectBadgeNear(fieldBadge, visibleTarget(page, 'A110'));

    // Every on-screen registered element carries a badge, and no badge takes a click.
    await expect.poll(async () => {
      const { elements, badges } = await coverage(page);
      return elements > 0 && elements === badges;
    }).toBe(true);
    expect(await badgesIntercepting(page)).toBe(0);
    await page.mouse.move(1, 1);

    // Click an element: its real registry record opens, and its action does not run.
    await visibleTarget(page, 'A116').click();
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('A116');
    await expect(detail(page, 'UI ID')).toHaveText('A116');
    await expect(detail(page, 'Name')).toHaveText('Open Smart Create Button');
    await expect(detail(page, 'Kind')).toHaveText('button');
    await expect(detail(page, 'Route')).toHaveText('/editor');
    await expect(detail(page, 'Parent ID')).toHaveText('A114 — Differences and Variants Panel');
    await expect(detail(page, 'Feature ID')).toContainText('A001');
    await expect(detail(page, 'Component')).toHaveText('VariantsPanel');
    await expect(detail(page, 'Source file')).toHaveText('src/components/editor/VariantsPanel.tsx');
    await expect(detail(page, 'Action / handler')).toHaveText('reference: setShowSmartWizard');
    await expect(detail(page, 'Related IDs')).toHaveText('A102, A114');
    await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);

    // Copy the ID to the clipboard.
    await page.locator('[data-ui-id="A2126"]').click();
    await expect(page.locator('[data-ui-id="A2126"]')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('A116');

    // A field is inspected without taking focus.
    await visibleTarget(page, 'A110').click();
    await expect(detail(page, 'UI ID')).toHaveText('A110');
    await expect(detail(page, 'Kind')).toHaveText('input');
    await expect(detail(page, 'Name')).toHaveText('Quran Text Search Input');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-ui-id') ?? null)).not.toBe('A110');

    // Escape closes the details; the badges stay.
    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveCount(0);
    await expect(badge(page, 'A110').first()).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/editor-inspector-on.png`, animations: 'disabled', caret: 'hide' });

    // Off: no toggle, no badges, no overlay, no URL flag, and the same pixels as before.
    await toggle(page).click();
    await expect(toggle(page)).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-badge]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/uiInspector/);
    await page.mouse.move(1, 1);
    const after = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    expect(Buffer.compare(after, before), 'page looks exactly as it did before the inspector').toBe(0);

    expect(errors).toEqual([]);
  });

  test('use mode: badges stay visible and never block the editor; Alt+click still inspects', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await page.goto('/editor?uiInspector=1');
    await expect(badge(page, 'A116').first()).toBeVisible();

    await clickMode(page).click();
    await expect(clickMode(page)).toHaveText('Clicks: use editor');
    expect(await badgesIntercepting(page)).toBe(0);

    // A normal click runs the action while the badges remain on screen.
    await visibleTarget(page, 'A116').click();
    await expect(page.locator('[data-ui-id="A421"]')).toBeVisible();
    await expect(badge(page, 'A421').first()).toBeVisible();
    expect(await badgesIntercepting(page)).toBe(0);

    // The dialog's own close button works, and its badge goes with it.
    await page.locator('[data-ui-id="A1326"]').click();
    await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);
    await expect(badge(page, 'A421')).toHaveCount(0);

    // Alt+click inspects even in use mode.
    await visibleTarget(page, 'A110').click({ modifiers: ['Alt'] });
    await expect(card(page)).toContainText('A110');
    await expect(detail(page, 'Name')).toHaveText('Quran Text Search Input');

    await clickMode(page).click();
    await expect(clickMode(page)).toHaveText('Clicks: inspect');
    expect(errors).toEqual([]);
  });

  test('the switch survives reloads and navigation; ?uiInspector=0 turns it off; Ctrl+Alt+Shift+I does nothing', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await page.goto('/editor?uiInspector=1');
    await expect(toggle(page)).toBeVisible();
    await page.reload();
    await expect(toggle(page)).toBeVisible();
    await page.goto('/studio');
    await expect(toggle(page)).toBeVisible();
    await expect(page).toHaveURL(/uiInspector=1/);

    await page.keyboard.press('Control+Alt+Shift+KeyI');
    await expect(toggle(page)).toBeVisible();

    await page.goto('/editor?uiInspector=0');
    await expect(toggle(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/uiInspector/);
    await page.goto('/studio');
    await expect(toggle(page)).toHaveCount(0);

    await page.keyboard.press('Alt+Shift+KeyI');
    await expect(toggle(page)).toBeVisible();
    await page.keyboard.press('Alt+Shift+KeyI');
    await expect(toggle(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a context menu opened before the inspector is on gets badges, and they go when it closes', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await page.goto('/editor');
    await expect(visibleTarget(page, 'A116')).toBeVisible();

    // Ordinary use: right-click a word on the canvas to open the selection menu (a portal).
    await page.locator('[data-word-id]').first().click({ button: 'right' });
    const menu = page.locator('[data-ui-id="A130"]');
    await expect(menu).toBeVisible();

    // Turn the inspector on while the menu is open: the menu and its first command get badges.
    await page.keyboard.press('Alt+Shift+KeyI');
    await expect(toggle(page)).toBeVisible();
    await expect(badge(page, 'A130').first()).toBeVisible();
    const command = await menu.locator('[data-ui-id]').first().getAttribute('data-ui-id');
    expect(command, 'menu command carries a registry ID').toMatch(/^A\d+$/);
    await expect(badge(page, command!).first()).toBeVisible();
    expect(await badgesIntercepting(page)).toBe(0);

    // Escape closes the menu, and its badges go with it.
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(badge(page, 'A130')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('every main route: badges for every registered element, none intercepting, no page errors', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    for (const route of ROUTES) {
      await page.goto(`${route}?uiInspector=1`);
      await expect(toggle(page), route).toBeVisible();
      await expect.poll(async () => (await coverage(page)).badges, { message: route }).toBeGreaterThan(0);
      await expect.poll(async () => {
        const { elements, badges } = await coverage(page);
        return elements === badges;
      }, { message: `${route}: every registered element has a badge` }).toBe(true);

      const shown = await page.locator('[data-ui-inspector-badge]').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ''));
      for (const id of new Set(shown)) {
        expect(ACTIVE_IDS.has(id), `${route}: badge ${id} is an active registry ID`).toBe(true);
      }
      expect(await badgesIntercepting(page), `${route}: badges intercepting clicks`).toBe(0);
      const name = route === '/' ? 'root' : route.slice(1).replace(/\//g, '-');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}-inspector-on.png`, animations: 'disabled', caret: 'hide' });
    }
    expect(errors).toEqual([]);
  });
});

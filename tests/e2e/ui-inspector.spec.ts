import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ph3Document } from '../helpers/ph3-fixture';

/**
 * Production browser suite for the interactive UI ID Inspector.
 * Run against `next start` (see `npm run test:e2e:production`), not `next dev`.
 */

const SHOTS = 'test-results/inspector';
mkdirSync(SHOTS, { recursive: true });
const DOC_KEY = 'tashjeer:doc:v2:1004';

const hoverBadge = (page: Page, id: string) => page.locator(`[data-ui-badge-for="${id}"][data-ui-badge-layer="hover"]`);
const pinnedBadge = (page: Page, id: string) => page.locator(`[data-ui-badge-for="${id}"][data-ui-badge-layer="pinned"]`);
const allBadges = (page: Page) => page.locator('[data-ui-badge-for]');
const pinnedHighlight = (page: Page) => page.locator('[data-ui-inspector-highlight="pinned"]');
const hoverHighlight = (page: Page) => page.locator('[data-ui-inspector-highlight="hover"]');
const details = (page: Page) => page.locator('[data-ui-id="A412"]');
const visibleTarget = (page: Page, id: string) => page.locator(`[data-ui-id="${id}"]`).filter({ visible: true }).first();

/**
 * Hovers a registered container at a point that belongs to the container itself,
 * not to a registered child. The centre of a panel is usually a child list.
 */
async function hoverOwnArea(page: Page, id: string): Promise<Locator> {
  const target = visibleTarget(page, id);
  await target.scrollIntoViewIfNeeded();
  const point = await target.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    for (let y = rect.top + 3; y < rect.bottom - 3; y += 5) {
      for (let x = rect.left + 3; x < rect.right - 3; x += 5) {
        const hit = document.elementFromPoint(x, y);
        if (hit && node.contains(hit) && hit.closest('[data-ui-id]') === node) return { x, y };
      }
    }
    return null;
  });
  if (!point) throw new Error(`no point inside ${id} that belongs to it alone`);
  await page.mouse.move(point.x, point.y);
  await expect(hoverBadge(page, id)).toBeVisible();
  return target;
}

/** Hovers the visible registered element and waits until its own hover badge is shown. */
async function hoverRegistered(page: Page, id: string): Promise<Locator> {
  const target = visibleTarget(page, id);
  await target.scrollIntoViewIfNeeded();
  await target.hover();
  await expect(hoverBadge(page, id)).toBeVisible();
  return target;
}

/**
 * A point on the page that belongs to no registered element, when one exists.
 * Most editor pixels belong to some registered region, so callers fall back to a far point.
 */
async function unregisteredPoint(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    for (let y = 8; y < innerHeight; y += 24) {
      for (let x = 8; x < innerWidth; x += 24) {
        const node = document.elementFromPoint(x, y);
        const owner = node?.closest('[data-ui-id]');
        if (node && (!owner || owner === document.documentElement) && !node.closest('[data-ui-inspector-root]')) {
          return { x, y };
        }
      }
    }
    return null;
  });
}

async function localStorageSnapshot(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])))
  );
}

async function appDomCount(page: Page): Promise<number> {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-ui-id]'))
    .filter((node) => !node.closest('[data-ui-inspector-root]')).length);
}

/** Positions of the visible registered elements, used to prove the layout never moves. */
async function layoutSnapshot(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-ui-id]'))
      .filter((node) => !node.closest('[data-ui-inspector-root]'))
      .slice(0, 400);
    const seen = new Map<string, number>();
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const id = node.getAttribute('data-ui-id')!;
      const occurrence = seen.get(id) ?? 0;
      seen.set(id, occurrence + 1);
      out[`${id}#${occurrence}`] = [rect.left, rect.top, rect.width, rect.height].map((value) => value.toFixed(2)).join(',');
    }
    return out;
  });
}

async function computedBackground(locator: Locator): Promise<string> {
  return locator.evaluate((node) => getComputedStyle(node).backgroundColor);
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.describe('UI ID Inspector — production behaviour', () => {
  test('1. disabled by default: no badges, no overlay, and no layout change when enabled', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/editor');
    await expect(page.locator('[data-ui-id="A116"]').first()).toBeVisible();
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
    await expect(allBadges(page)).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-highlight]')).toHaveCount(0);
    const disabledLayout = await layoutSnapshot(page);

    await page.keyboard.press('Alt+Shift+i');
    await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();
    await expect(allBadges(page)).toHaveCount(0);
    // Compare every identity present in both snapshots; editor data loads asynchronously, so the
    // set of visible elements may differ slightly, but no shared element may move or resize.
    const enabledLayout = await layoutSnapshot(page);
    const shared = Object.keys(disabledLayout).filter((key) => key in enabledLayout);
    expect(shared.length).toBeGreaterThan(40);
    expect(shared.filter((key) => disabledLayout[key] !== enabledLayout[key])).toEqual([]);

    await page.keyboard.press('Alt+Shift+i');
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('2. enabled: badges are not shown for every element at once', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/editor?uiInspector=1');
    await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();
    const registeredVisible = await page.evaluate(() => Array.from(document.querySelectorAll('[data-ui-id]'))
      .filter((node) => !node.closest('[data-ui-inspector-root]') && node.getBoundingClientRect().width > 0).length);
    expect(registeredVisible).toBeGreaterThan(50);
    await expect(allBadges(page)).toHaveCount(0);

    await hoverRegistered(page, 'A116');
    await expect(allBadges(page)).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('3 & 4. hovering a button shows its own badge; leaving hides the badge and the temporary outline', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/editor?uiInspector=1');
    const button = await hoverRegistered(page, 'A116');

    // The enclosing panel (A114) must not be reported instead of the button.
    await expect(page.locator('[data-ui-badge-for="A114"]')).toHaveCount(0);
    await expect(hoverBadge(page, 'A116')).toContainText('A116');
    await expect(hoverBadge(page, 'A116')).toContainText('Open Smart Create Button');
    await expect(hoverHighlight(page)).toHaveCount(1);
    await expect(hoverHighlight(page)).toHaveAttribute('data-ui-inspector-highlight', 'hover');

    // The badge sits beside the control and does not cover it.
    const buttonBox = (await button.boundingBox())!;
    const badgeBox = (await hoverBadge(page, 'A116').boundingBox())!;
    const overlaps = !(badgeBox.x >= buttonBox.x + buttonBox.width || badgeBox.x + badgeBox.width <= buttonBox.x
      || badgeBox.y >= buttonBox.y + buttonBox.height || badgeBox.y + badgeBox.height <= buttonBox.y);
    expect(overlaps, 'badge must not cover the control').toBe(false);

    // Leave the button for a point far from it. If the point is unregistered, nothing may be shown.
    const unregistered = await unregisteredPoint(page);
    const point = unregistered ?? { x: 20, y: 1080 };
    await page.mouse.move(point.x, point.y);
    await expect(hoverBadge(page, 'A116')).toHaveCount(0);
    const buttonAfterLeave = (await button.boundingBox())!;
    if (unregistered) {
      await expect(allBadges(page)).toHaveCount(0);
      await expect(hoverHighlight(page)).toHaveCount(0);
    } else {
      // Another element is now under the pointer: its outline replaces the old one.
      const outline = (await hoverHighlight(page).boundingBox())!;
      expect(Math.abs(outline.x - buttonAfterLeave.x) + Math.abs(outline.y - buttonAfterLeave.y)).toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
  });

  test('3b. the badge stays clickable when the pointer travels from the element into the badge', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    const button = await hoverRegistered(page, 'A116');
    const badge = hoverBadge(page, 'A116');
    const from = (await button.boundingBox())!;
    const to = (await badge.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-ui-badge-for', 'A116');
  });

  test('5. clicking the badge pins the real element, opens its details, and does not run its action', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/editor?uiInspector=1');
    const button = visibleTarget(page, 'A116');
    const before = await computedBackground(button); // resting state, before any pointer contact
    await hoverRegistered(page, 'A116');
    await hoverBadge(page, 'A116').click();

    await expect(details(page).locator('[data-ui-inspector-selected-id]')).toHaveText('A116');
    await expect(pinnedBadge(page, 'A116')).toBeVisible();
    await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0); // the wizard opened by A116 must not open
    const dd = details(page);
    await expect(dd).toContainText('Open Smart Create Button');
    await expect(dd).toContainText('button');
    await expect(dd).toContainText('/editor');
    await expect(dd).toContainText('A114');
    await expect(dd).toContainText('A001');
    await expect(dd).toContainText('VariantsPanel');
    await expect(dd).toContainText('src/components/editor/VariantsPanel.tsx');
    await expect(dd).toContainText('setShowSmartWizard');
    await expect(dd).toContainText('A102');
    expect(await computedBackground(button), 'app styling must be untouched').toBe(before);
    await page.screenshot({ path: `${SHOTS}/pinned-A116-red.png` });
    expect(errors).toEqual([]);
  });

  test('6. the pinned button is marked red by a temporary overlay that matches its box exactly', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    const button = await hoverRegistered(page, 'A116');
    await hoverBadge(page, 'A116').click();

    await expect(pinnedHighlight(page)).toHaveCount(1);
    await expect(pinnedHighlight(page)).toHaveAttribute('data-ui-inspector-tone', 'fill');
    await expect(pinnedHighlight(page)).toHaveCSS('background-color', 'rgba(220, 38, 38, 0.38)');
    const box = (await button.boundingBox())!;
    const marker = (await pinnedHighlight(page).boundingBox())!;
    for (const [a, b] of [[box.x, marker.x], [box.y, marker.y], [box.width, marker.width], [box.height, marker.height]] as const) {
      expect(Math.abs(a - b)).toBeLessThan(1);
    }
  });

  test('6b. fields, tabs and panels get a red marker suited to their type', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    await hoverRegistered(page, 'A110');
    await hoverBadge(page, 'A110').click();
    await expect(pinnedHighlight(page)).toHaveAttribute('data-ui-inspector-tone', 'field');
    await expect(pinnedHighlight(page)).toHaveCSS('background-color', 'rgba(220, 38, 38, 0.1)');

    await hoverOwnArea(page, 'A114');
    await hoverBadge(page, 'A114').click();
    await expect(pinnedHighlight(page)).toHaveAttribute('data-ui-inspector-tone', 'container');
  });

  test('7. the badge of a real delete button pins it without deleting anything', async ({ page }) => {
    const errors = trackErrors(page);
    const document = ph3Document();
    await page.addInitScript(([key, doc]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, JSON.stringify(doc));
        sessionStorage.setItem('seeded', '1');
      }
    }, [DOC_KEY, document] as const);
    await page.goto('/editor?uiInspector=1');
    const rows = page.locator('[data-ui-id="A118"] > li');
    await expect(rows).toHaveCount(3);
    await rows.nth(0).click();
    await rows.nth(1).click({ modifiers: ['Control'] });
    await expect(visibleTarget(page, 'A333')).toBeVisible();

    const storedBefore = await localStorageSnapshot(page);
    const variantCount = (snapshot: string) =>
      (JSON.parse(JSON.parse(snapshot)[DOC_KEY] as string) as { variants: unknown[] }).variants.length;
    expect(variantCount(storedBefore)).toBe(3);

    await hoverRegistered(page, 'A333');
    await hoverBadge(page, 'A333').click();

    await expect(details(page).locator('[data-ui-inspector-selected-id]')).toHaveText('A333');
    await expect(details(page)).toContainText('Delete Selected Differences Button');
    await expect(details(page)).toContainText('requestDeleteItems');
    await expect(page.getByRole('alertdialog')).toHaveCount(0); // no confirmation: the action never ran
    await expect(pinnedBadge(page, 'A333')).toBeVisible();
    await expect(pinnedHighlight(page)).toHaveCSS('background-color', 'rgba(220, 38, 38, 0.38)');
    await page.screenshot({ path: `${SHOTS}/delete-badge-pinned-no-action.png` });

    expect(await localStorageSnapshot(page)).toBe(storedBefore);
    expect(variantCount(await localStorageSnapshot(page))).toBe(3);

    // Control: the same button, uninspected, does start the confirmed deletion flow.
    await page.keyboard.press('Alt+Shift+i');
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
    await visibleTarget(page, 'A333').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('8. choosing another element moves the red marker; the previous one is cleared', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    const first = await hoverRegistered(page, 'A116');
    await hoverBadge(page, 'A116').click();
    await expect(pinnedHighlight(page)).toHaveCount(1);
    const firstBefore = await computedBackground(first);

    await hoverRegistered(page, 'A110');
    await hoverBadge(page, 'A110').click();

    await expect(details(page).locator('[data-ui-inspector-selected-id]')).toHaveText('A110');
    await expect(pinnedHighlight(page)).toHaveCount(1);
    await expect(pinnedHighlight(page)).toHaveAttribute('data-ui-inspector-tone', 'field');
    await expect(pinnedBadge(page, 'A116')).toHaveCount(0);
    expect(await computedBackground(first)).toBe(firstBefore);
  });

  test('9. Escape clears the pinned selection, closes details, and removes the marker', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    await hoverRegistered(page, 'A116');
    await hoverBadge(page, 'A116').click();
    await expect(details(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(details(page)).toHaveCount(0);
    await expect(pinnedHighlight(page)).toHaveCount(0);
    await expect(pinnedBadge(page, 'A116')).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(1); // still enabled
  });

  test('10. turning the Inspector off removes every badge, outline, marker, and details panel', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    await hoverRegistered(page, 'A116');
    await hoverBadge(page, 'A116').click();
    await hoverRegistered(page, 'A110');
    await expect(allBadges(page)).toHaveCount(2);

    await page.locator('[data-ui-inspector-toggle]').click();
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
    await expect(allBadges(page)).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-highlight]')).toHaveCount(0);
    await expect(details(page)).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has('uiInspector')).toBe(false);
  });

  test('11. client-side navigation leaves no stale badges, outlines, or markers', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/editor?uiInspector=1');
    await hoverRegistered(page, 'A116');
    await hoverBadge(page, 'A116').click();
    await expect(pinnedHighlight(page)).toHaveCount(1);

    await visibleTarget(page, 'A325').click(); // header link to /quran (Next.js client navigation)
    await expect(page).toHaveURL(/\/quran$/);
    await expect(allBadges(page)).toHaveCount(0);
    await expect(page.locator('[data-ui-inspector-highlight]')).toHaveCount(0);
    await expect(details(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('12. small controls, text fields, and nested elements resolve to the exact element', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    // Small icon button in the toolbar.
    const undo = await hoverRegistered(page, 'A103');
    await expect(hoverBadge(page, 'A103')).toContainText('A103');
    expect((await undo.boundingBox())!.width).toBeLessThan(80);
    // Native select and text input.
    await hoverRegistered(page, 'A108');
    await expect(hoverBadge(page, 'A108')).toHaveCount(1);
    await hoverRegistered(page, 'A110');
    await expect(hoverBadge(page, 'A110')).toHaveCount(1);
    // Nested: the button inside the panel A114 wins over the panel itself.
    await hoverRegistered(page, 'A116');
    await expect(allBadges(page)).toHaveCount(1);
    await expect(hoverBadge(page, 'A116')).toHaveCount(1);
  });

  test('12b. dynamic results and dialogs receive identities after they appear', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    const input = await hoverRegistered(page, 'A110');
    await input.fill('الحمد');
    await expect(page.locator('[data-ui-id="A737"]').first()).toBeVisible();
    const suggestion = page.locator('[data-ui-id="A739"]').first();
    await suggestion.hover();
    await expect(hoverBadge(page, 'A739')).toBeVisible();
    await input.fill('');

    await hoverRegistered(page, 'A116');
    await hoverBadge(page, 'A116').click();
    await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);
  });

  test('13. no JavaScript errors across inspection on every main application route', async ({ page }) => {
    const errors = trackErrors(page);
    for (const route of ['/editor', '/studio', '/quran', '/tracking']) {
      const response = await page.goto(`${route}?uiInspector=1`);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('[data-ui-inspector-toggle]'), route).toBeVisible();
      await expect(allBadges(page), `${route}: no flood of badges`).toHaveCount(0);
      for (const [x, y] of [[300, 200], [900, 500], [1200, 800]] as const) {
        await page.mouse.move(x, y, { steps: 4 });
      }
      await page.keyboard.press('Escape');
    }
    expect(errors).toEqual([]);
  });

  test('14. inspecting never changes project data', async ({ page }) => {
    const errors = trackErrors(page);
    const document = ph3Document();
    await page.addInitScript(([key, doc]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, JSON.stringify(doc));
        sessionStorage.setItem('seeded', '1');
      }
    }, [DOC_KEY, document] as const);
    await page.goto('/editor');
    await expect(page.locator('[data-ui-id="A116"]').first()).toBeVisible();
    const storedBefore = await localStorageSnapshot(page);
    const domBefore = await appDomCount(page);

    await page.keyboard.press('Alt+Shift+i');
    for (const id of ['A116', 'A110', 'A108', 'A103']) {
      await hoverRegistered(page, id);
      await hoverBadge(page, id).click();
      await page.keyboard.press('Escape');
    }
    await hoverOwnArea(page, 'A114');
    await hoverBadge(page, 'A114').click();
    await page.keyboard.press('Escape');
    await visibleTarget(page, 'A116').click({ modifiers: ['Alt'] });
    await expect(details(page).locator('[data-ui-inspector-selected-id]')).toHaveText('A116');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt+Shift+i');

    expect(await localStorageSnapshot(page)).toBe(storedBefore);
    expect(await appDomCount(page)).toBe(domBefore);
    expect(errors).toEqual([]);
  });

  test('keyboard: focus shows the badge; Alt+Shift+Enter pins; Escape clears', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    await page.keyboard.press('Tab');
    await visibleTarget(page, 'A116').focus();
    await expect(hoverBadge(page, 'A116')).toBeVisible();

    await page.keyboard.press('Alt+Shift+Enter');
    await expect(details(page).locator('[data-ui-inspector-selected-id]')).toHaveText('A116');
    await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);
    await expect(pinnedHighlight(page)).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(details(page)).toHaveCount(0);
    await expect(pinnedHighlight(page)).toHaveCount(0);
  });

  test('edge: a badge for an element at the right screen edge stays inside the viewport', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    const edgeId = await page.evaluate(() => {
      let best: { id: string; right: number } | null = null;
      for (const node of Array.from(document.querySelectorAll<HTMLElement>('[data-ui-id]'))) {
        if (node.closest('[data-ui-inspector-root]') || node === document.documentElement) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.right > innerWidth || rect.left < 0) continue;
        if (!best || rect.right > best.right) best = { id: node.getAttribute('data-ui-id')!, right: rect.right };
      }
      return best?.id ?? null;
    });
    expect(edgeId).not.toBeNull();
    await hoverOwnArea(page, edgeId!);
    const badge = (await hoverBadge(page, edgeId!).boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(badge.x).toBeGreaterThanOrEqual(0);
    expect(badge.x + badge.width).toBeLessThanOrEqual(viewport.width);
  });

  test('copy button copies the pinned real UI ID', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/editor?uiInspector=1');
    await hoverRegistered(page, 'A116');
    await hoverBadge(page, 'A116').click();
    const copy = details(page).locator('[data-ui-id="A732"]');
    await copy.click();
    await expect(copy).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('A116');
  });

  test('screenshots of the enabled Inspector on the production build', async ({ page }) => {
    await page.goto('/editor?uiInspector=1');
    await hoverRegistered(page, 'A116');
    await page.screenshot({ path: `${SHOTS}/hover-A116-badge.png` });
  });
});

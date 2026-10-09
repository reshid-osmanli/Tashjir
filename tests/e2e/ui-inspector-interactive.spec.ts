import { test, expect, type Page } from '@playwright/test';
import { ph3Document } from '../helpers/ph3-fixture';

/**
 * السلوك التفاعلي الدقيق لأداة UI Inspector: لا شارات دائمة، شارة واحدة للعنصر
 * المُشار إليه، وتثبيت اختياري بضغطة على الشارة نفسها دون تنفيذ إجراء العنصر.
 */

const RED = 'rgb(239, 68, 68)';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

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

async function clickBadge(page: Page, uiId: string) {
  const badge = page.locator(`[data-ui-badge-for="${uiId}"]`).first();
  await expect(badge, `badge for ${uiId}`).toBeVisible();
  await badge.click();
  return badge;
}

async function openInspector(page: Page, route = '/editor') {
  const response = await page.goto(`${route}?uiInspector=1`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();
}

// 1. Inspector معطّل: لا شارات ولا تغيير في شكل الصفحة.
test('1 · disabled Inspector renders no badge and leaves the page untouched', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/editor');

  await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('style')).some((style) =>
        style.textContent?.includes('data-ui-inspector-pinned'),
      ),
    ),
  ).toBe(false);

  // Hovering with the Inspector off must not create anything either.
  const button = page.locator('[data-ui-id="A116"]').first();
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-hover-outline]')).toHaveCount(0);

  // …and the editor keeps behaving exactly as before.
  await button.click();
  await expect(page.locator('[data-ui-id="A421"]')).toBeVisible();
  expect(errors).toEqual([]);
});

// 2. Inspector مفعّل: لا تظهر كل الشارات بصورة دائمة.
test('2 · enabled Inspector shows no badge until an element is targeted', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(
    (doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)),
    ph3Document(),
  );
  await openInspector(page);

  const registered = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('[data-ui-id]')).filter((node) => {
        if (node.closest('[data-ui-inspector-root]')) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length,
  );
  expect(registered, 'the page really holds many registered elements').toBeGreaterThan(20);

  // السكون: لا شارة واحدة قبل أن يمرّ المؤشر على عنصر.
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-hover-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(0);

  const boxes = () => page.evaluate(() =>
    ['A116', 'A110', 'A108', 'A115'].map((id) => {
      const node = document.querySelector(`[data-ui-id="${id}"]`)!;
      const rect = node.getBoundingClientRect();
      return [id, Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)];
    }),
  );
  const before = await boxes();

  // التحرك في أنحاء الصفحة لا يُنتج إلا شارة واحدة في المرة.
  for (const [x, y] of [[8, 8], [420, 320], [820, 620], [1240, 900]] as const) {
    await page.mouse.move(x, y);
    const badges = await page.locator('[data-ui-badge-for]').count();
    expect(badges, `at most one badge while moving over (${x},${y})`).toBeLessThanOrEqual(1);
  }

  // الأداة لا تغيّر حجم أي عنصر أو موضعه.
  await hoverIdentity(page, 'A116');
  expect(await boxes()).toEqual(before);
  expect(errors).toEqual([]);
});

// 3. تمرير المؤشر على زر: تظهر شارة معرّفه الصحيح.
test('3 · hovering a button reveals exactly that button identity', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  const badge = page.locator('[data-ui-badge-for="A116"]').first();
  await expect(badge).toHaveText(/^A116/);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(1);
  await expect(page.locator('[data-ui-inspector-hover-outline][data-ui-inspector-outline-for="A116"]')).toHaveCount(1);

  // الشارة مرتبطة بعنصر DOM حقيقي يحمل المعرّف نفسه.
  const matches = await page.evaluate(() => {
    const badge = document.querySelector('[data-ui-badge-for="A116"]')!;
    const id = badge.getAttribute('data-ui-badge-for')!;
    return Array.from(document.querySelectorAll(`[data-ui-id="${id}"]`)).length;
  });
  expect(matches).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

// 4. مغادرة الزر: تختفي شارة المرور.
test('4 · leaving the element hides the hover badge', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  await expect(page.locator('[data-ui-badge-for="A116"]')).toHaveCount(1);
  await expect(page.locator('[data-ui-inspector-hover-outline]')).toHaveCount(1);

  // مغادرة العنصر إلى عنصر آخر: تزول شارته وتظهر شارة الهدف الجديد.
  await hoverIdentity(page, 'A110');
  await expect(page.locator('[data-ui-badge-for="A116"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-badge-for="A110"]')).toHaveCount(1);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(1);

  // مغادرة النافذة نفسها: لا يبقى أي أثر.
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseleave')));
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-hover-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// 5. الضغط على الشارة: تثبيت العنصر وفتح تفاصيله.
test('5 · clicking the badge pins the element and opens its details', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  await clickBadge(page, 'A116');

  const details = page.locator('[data-ui-id="A412"]');
  await expect(details).toBeVisible();
  await expect(details.locator('[data-ui-inspector-selected-id]')).toHaveText('A116');
  await expect(details).toContainText('Open Smart Create Button');
  await expect(details).toContainText('button');
  await expect(details).toContainText('/editor');
  await expect(details).toContainText('A114');
  await expect(details).toContainText('A001');
  await expect(details).toContainText('VariantsPanel');
  await expect(details).toContainText('src/components/editor/VariantsPanel.tsx');
  await expect(details).toContainText('A102');
  await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);

  // يبقى التثبيت قائما بعد مغادرة العنصر.
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseleave')));
  await expect(page.locator('[data-ui-badge-for="A116"]')).toHaveCount(1);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(1);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

// 6. العنصر المثبّت يظهر بالأحمر.
test('6 · the pinned element is highlighted red', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  await clickBadge(page, 'A116');

  const element = page.locator('[data-ui-id="A116"]').first();
  await expect(element).toHaveAttribute('data-ui-inspector-pinned', '1');
  expect(await element.evaluate((node) => getComputedStyle(node).outlineColor)).toBe(RED);
  expect(await element.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe('solid');

  const outline = page.locator('[data-ui-inspector-pin-outline]');
  await expect(outline).toHaveCount(1);
  expect(await outline.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe(RED);

  await page.screenshot({ path: 'test-results/inspector-06-pinned-red.png' });
  expect(errors).toEqual([]);
});

// 7. الضغط على شارة زر حذف لا ينفّذ الحذف.
test('7 · clicking a delete button badge never performs the deletion', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(
    (doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)),
    ph3Document(),
  );
  await openInspector(page);

  await page.locator('[data-ui-id="A1580"]').first().click({ modifiers: ['Control'] });
  const deleteButton = page.locator('[data-ui-id="A333"]').first();
  await expect(deleteButton).toBeVisible();

  const before = await page.evaluate(() => localStorage.getItem('tashjeer:doc:v2:1004'));
  const rowsBefore = await page.locator('[data-ui-id="A118"] > li').count();

  await hoverIdentity(page, 'A333');
  await clickBadge(page, 'A333');

  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('[data-ui-id="A412"]').locator('[data-ui-inspector-selected-id]')).toHaveText('A333');
  await expect(page.locator('[data-ui-inspector-pin-outline][data-ui-inspector-outline-for="A333"]')).toHaveCount(1);
  await expect(page.locator('[data-ui-id="A118"] > li')).toHaveCount(rowsBefore);
  expect(await page.evaluate(() => localStorage.getItem('tashjeer:doc:v2:1004'))).toBe(before);

  await page.screenshot({ path: 'test-results/inspector-07-delete-badge-no-action.png' });
  expect(errors).toEqual([]);
});

// 8. اختيار معرّف آخر ينقل التمييز.
test('8 · pinning another identity moves the highlight without leftovers', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  await clickBadge(page, 'A116');
  await expect(page.locator('[data-ui-id="A116"]').first()).toHaveAttribute('data-ui-inspector-pinned', '1');

  await hoverIdentity(page, 'A110');
  await clickBadge(page, 'A110');

  await expect(page.locator('[data-ui-badge-for="A110"]')).toHaveCount(1);
  await expect(page.locator('[data-ui-inspector-pin-outline][data-ui-inspector-outline-for="A110"]')).toHaveCount(1);
  await expect(page.locator('[data-ui-id="A412"]').locator('[data-ui-inspector-selected-id]')).toHaveText('A110');

  // لا أثر للتثبيت السابق: عنصر واحد محدّد فقط.
  await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(1);
  await expect(page.locator('[data-ui-id="A116"]').first()).not.toHaveAttribute('data-ui-inspector-pinned', '1');
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

// 9. Escape يلغي التحديد.
test('9 · Escape clears the pin, the details panel and every highlight', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  await clickBadge(page, 'A116');
  await expect(page.locator('[data-ui-id="A412"]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(0);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();
  expect(errors).toEqual([]);
});

// 10. إيقاف Inspector يزيل كل الطبقات المؤقتة.
test('10 · turning the Inspector off removes every temporary layer', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  await clickBadge(page, 'A116');
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(1);

  await page.locator('[data-ui-inspector-toggle]').click();

  await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-toggle]')).toHaveCount(0);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-hover-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('style')).some((style) =>
        style.textContent?.includes('data-ui-inspector-pinned'),
      ),
    ),
  ).toBe(false);
  expect(new URL(page.url()).searchParams.has('uiInspector')).toBe(false);
  await expect(page.locator('[data-ui-id="A116"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

// 11. الانتقال بين الصفحات: لا شارات أو تمييزات قديمة.
test('11 · navigating to another page leaves no stale badge or highlight', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  await clickBadge(page, 'A116');
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(1);

  await page.locator('[data-ui-id="A315"]').first().click();
  await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-hover-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();

  await page.locator('[data-ui-id="A318"]').first().click();
  await expect(page.locator('[data-ui-badge-for]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// 12. الأزرار الصغيرة والحقول والعناصر المتداخلة.
test('12 · small buttons, inputs and nested elements resolve to the innermost identity', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(
    (doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)),
    ph3Document(),
  );
  await openInspector(page);

  // زر أيقوني/نصي صغير في رأس اللوحة.
  await hoverIdentity(page, 'A115');
  await expect(page.locator('[data-ui-badge-for="A115"]')).toHaveCount(1);

  // حقل إدخال.
  await hoverIdentity(page, 'A110');
  await expect(page.locator('[data-ui-badge-for="A110"]')).toHaveCount(1);

  // قائمة منسدلة.
  await hoverIdentity(page, 'A108');
  await expect(page.locator('[data-ui-badge-for="A108"]')).toHaveCount(1);

  // عنصر متداخل: الزر داخل اللوحة يعطي معرّف الزر لا معرّف اللوحة الأم.
  await hoverIdentity(page, 'A1580');
  await expect(page.locator('[data-ui-badge-for="A1580"]')).toHaveCount(1);
  await expect(page.locator('[data-ui-badge-for="A114"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-hover-outline][data-ui-inspector-outline-for="A1580"]')).toHaveCount(1);

  const nested = await page.evaluate(() => {
    const button = document.querySelector('[data-ui-id="A1580"]')!.getBoundingClientRect();
    const panel = document.querySelector('[data-ui-id="A114"]')!.getBoundingClientRect();
    return button.width < panel.width;
  });
  expect(nested).toBe(true);
  expect(errors).toEqual([]);
});

// 13. لا أخطاء JavaScript أثناء الفحص على صفحات متعددة.
test('13 · inspecting several routes raises no JavaScript error', async ({ page }) => {
  const errors = collectErrors(page);

  for (const route of ['/editor', '/studio', '/quran', '/tracking']) {
    await openInspector(page, route);
    // عناصر يمكن الوصول إليها فعلا: العنصر الأعلى عند مركزها هو نفسه.
    const ids = await page.evaluate(() => {
      const picked: string[] = [];
      for (const node of Array.from(document.querySelectorAll<HTMLElement>('[data-ui-id]'))) {
        if (node.closest('[data-ui-inspector-root]')) continue;
        if (node === document.body || node === document.documentElement) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) continue;
        if (rect.top < 0 || rect.bottom > window.innerHeight) continue;
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (!top || top.closest('[data-ui-id]') !== node) continue;
        const id = node.getAttribute('data-ui-id')!;
        if (picked.includes(id)) continue;
        picked.push(id);
        if (picked.length >= 8) break;
      }
      return picked;
    });
    expect(ids.length, `${route}: some registered elements must be reachable`).toBeGreaterThan(0);

    for (const id of ids) {
      await page.mouse.move(1, 1);
      const target = page.locator(`[data-ui-id="${id}"]`).first();
      const box = await target.boundingBox();
      if (!box || box.width < 2 || box.height < 2) continue;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.locator(`[data-ui-badge-for="${id}"]`).first(), `${route}/${id}`).toBeVisible();
      await expect(page.locator('[data-ui-badge-for]'), `${route}/${id}: one badge at a time`).toHaveCount(1);
    }

    await page.locator('[data-ui-inspector-toggle]').click();
    await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
  }

  expect(errors).toEqual([]);
});

// 14. الفحص لا يغيّر بيانات المشروع.
test('14 · inspecting elements never mutates the project document', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(
    (doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)),
    ph3Document(),
  );
  await openInspector(page);

  const before = await page.evaluate(() => ({
    document: localStorage.getItem('tashjeer:doc:v2:1004'),
    storage: JSON.stringify(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
  }));

  for (const id of ['A116', 'A110', 'A108', 'A115', 'A1580']) {
    await hoverIdentity(page, id);
    await clickBadge(page, id);
    await expect(page.locator('[data-ui-id="A412"]').locator('[data-ui-inspector-selected-id]')).toHaveText(id);
    await page.locator('[data-ui-id="A732"]').click();
    // إلغاء التحديد قبل الانتقال إلى العنصر التالي حتى لا تحجب اللوحة الهدف.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);
  }

  const after = await page.evaluate(() => ({
    document: localStorage.getItem('tashjeer:doc:v2:1004'),
    storage: JSON.stringify(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
  }));
  expect(after.document).toBe(before.document);
  expect(after.storage).toBe(before.storage);
  expect(errors).toEqual([]);
});

// سلوك إضافي: الشارة تبقى قابلة للضغط عند انتقال المؤشر من العنصر إليها.
test('the badge stays reachable when the pointer moves from the element onto it', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  await hoverIdentity(page, 'A116');
  const badge = page.locator('[data-ui-badge-for="A116"]').first();
  const box = (await badge.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await expect(badge).toBeVisible();
  await expect(page.locator('[data-ui-inspector-hover-outline][data-ui-inspector-outline-for="A116"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

// سلوك إضافي: اختفاء العنصر المثبّت يُزال معه التمييز بلا أثر.
test('a pinned element that disappears clears its own highlight', async ({ page }) => {
  const errors = collectErrors(page);
  await openInspector(page);

  const input = page.locator('[data-ui-id="A110"]').first();
  await input.fill('الحمد');
  await expect(page.locator('[data-ui-id="A737"]')).toBeVisible();

  await hoverIdentity(page, 'A739');
  await clickBadge(page, 'A739');
  await expect(page.locator('[data-ui-inspector-pin-outline][data-ui-inspector-outline-for="A739"]')).toHaveCount(1);

  await input.fill('');
  await expect(page.locator('[data-ui-id="A737"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// سلوك إضافي: التشغيل والاختيار والإلغاء بلوحة المفاتيح وحدها.
test('keyboard: enable, walk, pin and clear without the mouse', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/editor');

  await page.keyboard.press('Alt+Shift+I');
  await expect(page.locator('[data-ui-inspector-toggle]')).toBeVisible();

  await page.keyboard.press('Alt+Shift+ArrowDown');
  const firstBadge = page.locator('[data-ui-badge-for]').first();
  await expect(firstBadge).toBeVisible();
  const firstId = await firstBadge.getAttribute('data-ui-badge-for');

  await page.keyboard.press('Alt+Shift+ArrowDown');
  await expect(page.locator('[data-ui-badge-for]').first()).not.toHaveAttribute('data-ui-badge-for', firstId!);

  // الشارة تأخذ التركيز في وضع لوحة المفاتيح، فيعمل Enter طبيعيًا.
  const focused = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return active?.getAttribute('data-ui-inspector-badge') ?? null;
  });
  expect(focused).toBe('hover');

  await page.keyboard.press('Enter');
  const pinnedId = await page.locator('[data-ui-inspector-pin-outline]').first().getAttribute('data-ui-inspector-outline-for');
  await expect(page.locator('[data-ui-id="A412"]').locator('[data-ui-inspector-selected-id]')).toHaveText(pinnedId!);

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pin-outline]')).toHaveCount(0);
  await expect(page.locator('[data-ui-inspector-pinned]')).toHaveCount(0);

  await page.keyboard.press('Alt+Shift+I');
  await expect(page.locator('[data-ui-inspector-root]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

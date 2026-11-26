// المرحلة 8: السيناريو الكامل في Chromium بمنفذ عرض عادي 1600×1100
import { test, expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ph3Document } from '../helpers/ph3-fixture';

const KEY = 'tashjeer:doc:v2:1004';
const rows = (page: Page) => page.locator('[data-order-line-id]');
const order = (page: Page) => rows(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-order-line-id')));

async function seed(page: Page) {
  const document = ph3Document(); document.variants = []; document.links = [];
  // لا addInitScript هنا: إعادة التحميل لاحقًا يجب أن تقرأ الحفظ الفعلي لا البذرة.
  await page.goto('/editor');
  await page.evaluate(([key, doc]) => localStorage.setItem(key, JSON.stringify(doc)), [KEY, document] as const);
  await page.reload();
  await page.getByRole('button', { name: 'ترتيب الأسطر', exact: true }).click();
  return document;
}

async function dragRowToGap(page: Page, from: number, gap: number) {
  const source = rows(page).nth(from);
  await source.scrollIntoViewIfNeeded();
  const handle = source.locator('span[title="اسحب لتغيير الترتيب"]');
  const start = (await handle.boundingBox())!;
  const x = start.x + start.width / 2, y = start.y + start.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 12, y + 12, { steps: 3 });
  await expect(page.locator('[data-ui-id="A2211"]')).toBeVisible({ timeout: 200 });
  const count = await rows(page).count();
  const vp = (await page.locator('[data-ui-id="A123"] [data-ui-id="A1997"]').boundingBox())!;
  let targetY: number;
  if (gap === 0) targetY = vp.y + 4;
  else if (gap === count) targetY = vp.y + vp.height - 4;
  else {
    await rows(page).nth(gap).scrollIntoViewIfNeeded();
    targetY = (await rows(page).nth(gap).boundingBox())!.y + 2;
  }
  await page.mouse.move(vp.x + vp.width / 2, targetY, { steps: 6 });
  await expect(page.locator(`[data-insert-gap="${gap}"]`)).toHaveClass(/bg-emerald-500/);
  await expect(page.locator(`[data-insert-gap="${gap}"]`)).toHaveAttribute('data-drop-indicator', 'true');
  const margin = await page.locator(`[data-insert-gap="${gap}"]`).evaluate((element) => parseFloat(getComputedStyle(element).marginBottom));
  expect(margin).toBeGreaterThan(0); // إزاحة الصفوف/فجوة منطقية
  await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toContainText('نقل السطر');
  await page.getByRole('button', { name: 'تأكيد', exact: true }).click();
}

test('سيناريو كامل: ترتيب → تأكيد → لوحة/تراجع → لمس → دمج مستقل → A130/A1448 → حفظ/تصدير', async ({ page, browser }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await seed(page);
  const before = await order(page);
  expect(before).toHaveLength(25);

  // تحديد الصف الثالث ثم سحبه إلى الموضع العاشر.
  await rows(page).nth(2).click();
  await expect(rows(page).nth(2)).toHaveAttribute('data-state', 'selected');
  await dragRowToGap(page, 2, 10);
  const after = await order(page);
  expect(after).toHaveLength(25);
  expect(new Set(after).size).toBe(25);
  expect(after[9]).toBe(before[2]);
  // نتيجة الرسم: التحديد الموحّد يبقى على السطر المنقول، بلا معرف جديد.
  await expect(page.locator('[data-ui-id="A1448"][data-line-selected="1"]')).toHaveCount(1);

  await page.keyboard.press('Control+z');
  expect(await order(page)).toEqual(before);
  await page.keyboard.press('Control+Shift+z');
  expect((await order(page))[9]).toBe(before[2]);

  // حفظ أولي لاستخدامه في إعادة المحاولة باللمس.
  await page.keyboard.press('Control+s');
  const saved = await page.evaluate((key) => localStorage.getItem(key), KEY);
  expect(saved).toBeTruthy();

  // إعادة المحاولة باللمس في سياق hasTouch، مع نفس المستند المحفوظ.
  await touchRetry(browser, saved!);

  // دمج مستقل بمقبض ↳، ثم تراجع يعيد عدد الأسطر.
  const handle = page.getByRole('button', { name: 'مقبض دمج السطر ١', exact: true });
  await handle.scrollIntoViewIfNeeded();
  const start = (await handle.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2 + 12, { steps: 3 });
  await expect(page.locator('[data-ui-id="A2212"]')).toBeVisible();
  const target = rows(page).nth(1); await target.scrollIntoViewIfNeeded();
  const end = (await target.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 5 });
  await expect(target).toHaveClass(/border-violet-600/);
  await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toContainText('دمج');
  await page.getByRole('alertdialog').getByRole('button', { name: /^(تأكيد|تجاوز بقرار يدوي موثق)$/ }).click();
  await expect(rows(page)).toHaveCount(24);
  await page.keyboard.press('Control+z');
  await expect(rows(page)).toHaveCount(25);

  // A130/A1448 بعد تحقق الهوية: قالب SVG حقيقي + قائمة أوامر حقيقية.
  const line = page.locator('[data-ui-id="A1448"][data-line-id="manual::line-3"]').first();
  await expect(line).toHaveAttribute('role', 'button');
  await line.dispatchEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 600, clientY: 300 });
  await expect(page.locator('[data-ui-id="A130"]')).toBeVisible();
  const lineId = (await line.getAttribute('data-line-id'))!;
  await page.locator('[data-ui-id="A130"] [data-command-id="COPY_ID"]').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(lineId);
  await page.keyboard.press('Escape');

  // إعادة التحميل: الترتيب محفوظ، ثم تصدير JSON وفحص سلامته.
  await page.keyboard.press('Control+s');
  await page.reload();
  await page.getByRole('button', { name: 'ترتيب الأسطر', exact: true }).click();
  const persisted = await order(page);
  expect(persisted).toHaveLength(25);
  expect(persisted[9]).toBe(before[2]);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-ui-id="A135"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const bundle = JSON.parse(readFileSync(path!, 'utf8'));
  expect(bundle.documents).toHaveLength(1);
  const exported = bundle.documents[0];
  expect(exported.lineOrder).toHaveLength(25);
  expect(new Set(exported.lineOrder).size).toBe(25);
  expect(exported.lineOrder[9]).toBe(before[2]);
  expect(exported.links ?? []).toEqual([]);
  expect(exported.mergeRecords ?? []).toEqual([]);
  expect(exported.corrections ?? []).toEqual([]);
  expect(exported.segments ?? []).toEqual([]);
  expect(exported.editLog).toBeDefined();
});

async function touchRetry(browser: Browser, saved: string) {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000', hasTouch: true, viewport: { width: 1600, height: 1100 } });
  await context.addInitScript(([key, doc]) => localStorage.setItem(key, JSON.stringify(doc)), [KEY, JSON.parse(saved)] as const);
  const page = await context.newPage();
  await page.goto('/editor');
  await page.getByRole('button', { name: 'ترتيب الأسطر', exact: true }).click();
  const before = await order(page);
  const source = rows(page).first(); await source.scrollIntoViewIfNeeded();
  const start = (await source.boundingBox())!;
  const target = (await rows(page).nth(3).boundingBox())!;
  const client = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', x = 0, y = 0) =>
    client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }] });
  await touch('touchStart', start.x + start.width / 2, start.y + start.height / 2);
  await page.waitForTimeout(400);
  await expect(page.locator('[data-ui-id="A2211"]')).toBeVisible();
  await touch('touchMove', target.x + target.width / 2, target.y + target.height * .75);
  await expect(page.locator('[data-insert-gap="4"]')).toHaveClass(/bg-emerald-500/);
  await touch('touchEnd');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'تأكيد', exact: true }).click();
  const after = await order(page);
  expect(after).toHaveLength(25);
  expect(new Set(after).size).toBe(25);
  expect(after[3]).toBe(before[0]);
  await context.close();
}

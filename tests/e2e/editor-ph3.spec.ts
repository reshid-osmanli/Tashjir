import { test, expect, type Page } from '@playwright/test';
import { ph3Document } from '../helpers/ph3-fixture';

async function open(page: Page, manualOnly = true) {
  const document = ph3Document();
  if (manualOnly) { document.variants = []; document.links = []; }
  else document.manualLines = [];
  await page.addInitScript((doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)), document);
  await page.goto('/editor');
  if (manualOnly) await page.getByRole('button', { name: 'ترتيب الأسطر', exact: true }).click();
}
const rows = (page: Page) => page.locator('[data-order-line-id]');
const order = (page: Page) => rows(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-order-line-id')));

async function mouseDrag(page: Page, from: number, to: number) {
  const source = rows(page).nth(from);
  await source.scrollIntoViewIfNeeded();
  const start = (await source.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  // Gesture threshold is intentional, not a synchronization workaround.
  await page.waitForTimeout(400);
  await expect(source).toHaveClass(/opacity-60/);
  const target = rows(page).nth(to);
  await target.scrollIntoViewIfNeeded();
  const end = (await target.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height * .75);
  await expect(page.locator(`[data-insert-gap="${to + 1}"]`)).toHaveClass(/bg-emerald-500/);
  await page.mouse.up();
}

test('mouse: long press, insertion indicator, mandatory cancel/confirm, rank 10 → 20, save JSON, undo/redo', async ({ page }) => {
  await open(page);
  await expect(rows(page)).toHaveCount(25);
  const before = await order(page);
  await mouseDrag(page, 9, 19);
  await expect(page.getByRole('alertdialog')).toContainText('نقل السطر ١٠');
  expect(await order(page)).toEqual(before);
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  expect(await order(page)).toEqual(before);
  await mouseDrag(page, 9, 19);
  await page.getByRole('button', { name: 'تأكيد', exact: true }).click();
  await expect(rows(page).nth(19)).toHaveAttribute('data-order-line-id', before[9]!);
  await page.keyboard.press('Control+s');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tashjeer:doc:v2:1004')!));
  expect(saved.lineOrder[19]).toBe(before[9]);
  expect(saved.lines.find((line: { id: string }) => line.id === before[9]).order).toBe(20);
  await page.keyboard.press('Control+z');
  expect(await order(page)).toEqual(before);
  await page.keyboard.press('Control+Shift+z');
  await expect(rows(page).nth(19)).toHaveAttribute('data-order-line-id', before[9]!);
});

test('ordinary click cannot drag; Escape and pointercancel do not open confirmation or mutate order', async ({ page }) => {
  await open(page); const before = await order(page);
  const row = rows(page).first(); await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height + 5); await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await order(page)).toEqual(before);
  await row.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'touch' });
  expect(await order(page)).toEqual(before);
});

test('keyboard move is confirmed and Enter on initially focused Cancel cancels safely', async ({ page }) => {
  await open(page); const before = await order(page);
  await rows(page).first().focus(); await page.keyboard.press('Alt+ArrowDown');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await order(page)).toEqual(before);
  await rows(page).first().focus(); await page.keyboard.press('Alt+ArrowDown');
  await page.getByRole('button', { name: 'تأكيد', exact: true }).click();
  await expect(rows(page).nth(1)).toHaveAttribute('data-order-line-id', before[0]!);
});

test('real touch pointer capture supports reorder and cancellation without canvas pan', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000', hasTouch: true, viewport: { width: 1600, height: 1100 } });
  const page = await context.newPage(); await open(page); const before = await order(page);
  const source = rows(page).first(); await source.scrollIntoViewIfNeeded();
  const start = (await source.boundingBox())!; const end = (await rows(page).nth(2).boundingBox())!;
  const client = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', x = 0, y = 0) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }] });
  await touch('touchStart', start.x + start.width / 2, start.y + start.height / 2);
  await page.waitForTimeout(400);
  await touch('touchMove', end.x + end.width / 2, end.y + end.height * .75);
  await expect(page.locator('[data-insert-gap="3"]')).toHaveClass(/bg-emerald-500/);
  await touch('touchCancel');
  await expect(page.getByRole('alertdialog')).toHaveCount(0); expect(await order(page)).toEqual(before);
  await touch('touchStart', start.x + start.width / 2, start.y + start.height / 2); await page.waitForTimeout(400);
  await touch('touchMove', end.x + end.width / 2, end.y + end.height * .75); await touch('touchEnd');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'تأكيد', exact: true }).click();
  await expect(rows(page).nth(2)).toHaveAttribute('data-order-line-id', before[0]!);
  await context.close();
});

test('five selected faces: cancel retains selection, confirmed bulk delete is one undo step', async ({ page }) => {
  await open(page, false);
  const owner = page.locator('[data-difference-id="d1"]');
  await owner.getByRole('button', { name: /d1/ }).first().click();
  const list = owner.getByRole('list', { name: /أوجه الموضع/ });
  await list.focus(); await page.keyboard.press('Control+a');
  await owner.getByRole('button', { name: 'حذف المحدد', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('حذف ٥ أوجه؟');
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  await expect(owner.locator('input[type="checkbox"]:checked')).toHaveCount(5);
  await owner.getByRole('button', { name: 'حذف المحدد', exact: true }).click();
  await page.getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
  await expect(owner.locator('[data-face-id]')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await owner.getByRole('button', { name: /d1/ }).first().click();
  await expect(owner.locator('[data-face-id]')).toHaveCount(5);
});

test('merge handle preserves originals; confirmed split and history jump restore the line count', async ({ page }) => {
  await open(page); const before = await order(page);
  const handle = page.getByRole('button', { name: 'مقبض دمج السطر ١', exact: true });
  await handle.scrollIntoViewIfNeeded();
  const start = (await handle.boundingBox())!; const end = (await rows(page).nth(1).boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down(); await page.waitForTimeout(400);
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2); await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toContainText('دمج');
  await page.getByRole('alertdialog').getByRole('button', { name: /^(تأكيد|تجاوز بقرار يدوي موثق)$/ }).click();
  await expect(rows(page)).toHaveCount(24);
  await page.keyboard.press('Control+s');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tashjeer:doc:v2:1004')!));
  expect(saved.mergeRecords[0].before.map((line: { id: string }) => line.id)).toEqual(before.slice(0, 2));
  await page.getByRole('button', { name: 'فك الدمج', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'تأكيد', exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
  await page.locator('summary').filter({ hasText: 'سجل العمليات' }).click();
  await page.getByRole('button', { name: /أقدم حالة محفوظة/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'تأكيد', exact: true }).click();
  expect(await order(page)).toEqual(before);
});

test('clipboard copies only two checked faces, shows dangling review, and undo restores destination', async ({ page }) => {
  await open(page, false);
  const source = page.locator('[data-difference-id="d1"]'), target = page.locator('[data-difference-id="d3"]');
  await source.getByRole('button', { name: /d1/ }).first().click();
  await source.locator('input[type="checkbox"]').nth(0).check();
  await source.locator('input[type="checkbox"]').nth(1).check();
  await source.getByRole('list', { name: /أوجه الموضع/ }).focus(); await page.keyboard.press('Control+c');
  await target.getByRole('button', { name: /d3/ }).first().click(); await page.keyboard.press('Control+v');
  await expect(page.getByRole('alertdialog')).toContainText('٢ عناصر');
  await page.getByRole('alertdialog').getByRole('button', { name: 'تأكيد', exact: true }).click();
  await expect(target.locator('[data-face-id]')).toHaveCount(7);
  await page.locator('summary').filter({ hasText: 'الحافظة' }).click();
  await expect(page.getByText('علاقات معلّقة للمراجعة — لم تُطبّق', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+z');
  await target.getByRole('button', { name: /d3/ }).first().click();
  await expect(target.locator('[data-face-id]')).toHaveCount(5);
});

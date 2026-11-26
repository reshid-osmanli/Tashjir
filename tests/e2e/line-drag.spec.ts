// المرحلة 7: سحب حقيقي بالماوس/القلم/اللمس، معاينة عائمة، مؤشر إدراج،
// تمرير تلقائي، إلغاء آمن، وفصل كامل بين ORDER وMERGE.
import { test, expect, type Page } from '@playwright/test';
import { ph3Document } from '../helpers/ph3-fixture';

async function openOrder(page: Page) {
  const document = ph3Document();
  document.variants = []; document.links = [];
  await page.addInitScript((doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)), document);
  await page.goto('/editor');
  await page.getByRole('button', { name: 'ترتيب الأسطر', exact: true }).click();
}

const rows = (page: Page) => page.locator('[data-order-line-id]');
const order = (page: Page) => rows(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-order-line-id')));
const viewport = (page: Page) => page.locator('[data-ui-id="A123"] [data-ui-id="A1997"]');

async function startMouseDrag(page: Page, from: number) {
  const source = rows(page).nth(from);
  await source.scrollIntoViewIfNeeded();
  const handle = source.locator('span[title="اسحب لتغيير الترتيب"]');
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 12, { steps: 3 });
  await expect(page.locator('[data-ui-id="A2211"][data-drag-mode="ORDER"]')).toBeVisible({ timeout: 200 });
  return { x, y };
}

async function moveToGap(page: Page, gap: number) {
  const count = await rows(page).count();
  const targetRank = Math.min(Math.max(gap, 0), count - 1);
  // التمرير التلقائي قد يغيّر مواضع الصفوف بين قياس الصندوق وإرسال الحركة؛
  // نعيد القياس داخل الاستطلاع نفسه لا مرة واحدة قبل الإفلات.
  await expect.poll(async () => {
    await rows(page).nth(targetRank).scrollIntoViewIfNeeded();
    const box = (await viewport(page).boundingBox())!;
    const x = box.x + box.width / 2;
    let y: number;
    // بداية/نهاية القائمة تُؤخذ من حافة منطقة التمرير نفسها.
    if (gap === 0) y = box.y + 4;
    else if (gap === count) y = box.y + box.height - 4;
    else y = (await rows(page).nth(gap).boundingBox())!.y + 2;
    await page.mouse.move(x, y, { steps: 6 });
    return page.locator(`[data-insert-gap="${gap}"]`).getAttribute('data-drop-indicator');
  }, { timeout: 5000 }).toBe('true');
  await expect(page.locator(`[data-insert-gap="${gap}"]`)).toHaveClass(/bg-emerald-500/);
}

async function confirmMove(page: Page) {
  await page.getByRole('button', { name: 'تأكيد', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
}

test('الماوس: يبدأ بعد 7px بلا 350ms؛ المعاينة تتبع المؤشر بإزاحة المقبض', async ({ page }) => {
  await openOrder(page);
  const source = rows(page).nth(2);
  const { x: startX, y: startY } = await startMouseDrag(page, 2);
  const box = (await source.boundingBox())!;
  const overlay = page.locator('[data-ui-id="A2211"]');

  const x = startX + 80, y = startY + 60;
  await page.mouse.move(x, y, { steps: 5 });
  await expect(overlay).toHaveAttribute('data-pointer-x', String(Math.round(x)));
  await expect(overlay).toHaveAttribute('data-pointer-y', String(Math.round(y)));
  const transform = await overlay.evaluate((element) => (element as HTMLElement).style.transform);
  expect(transform).toMatch(/^translate3d\(/);
  const rect = (await overlay.boundingBox())!;
  // الإزاحة = فرق المؤشر عن يسار/أعلى الصف عند بدء الضغط.
  expect(Math.abs(rect.x - (x - (startX - box.x)))).toBeLessThan(2);
  expect(Math.abs(rect.y - (y - (startY - box.y)))).toBeLessThan(2);
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

test('بداية→نهاية، نهاية→بداية، وبين صفين: بلا فقدان/تكرار، مع Undo/Redo', async ({ page }) => {
  await openOrder(page);
  const before = await order(page);
  expect(before).toHaveLength(25);

  await startMouseDrag(page, 0);
  await moveToGap(page, 25);
  await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toContainText('نقل السطر ١');
  await confirmMove(page);
  const endFirst = await order(page);
  expect(endFirst).toHaveLength(25);
  expect(new Set(endFirst).size).toBe(25);
  expect(endFirst[24]).toBe(before[0]);

  await page.keyboard.press('Control+z');
  expect(await order(page)).toEqual(before);
  await page.keyboard.press('Control+Shift+z');
  expect((await order(page))[24]).toBe(before[0]);

  const afterEnd = await order(page);
  await startMouseDrag(page, 24);
  await moveToGap(page, 0);
  await page.mouse.up();
  await confirmMove(page);
  const startFirst = await order(page);
  expect(startFirst).toHaveLength(25);
  expect(new Set(startFirst).size).toBe(25);
  expect(startFirst[0]).toBe(afterEnd[24]);

  await startMouseDrag(page, 5);
  await moveToGap(page, 12);
  await page.mouse.up();
  await confirmMove(page);
  const middle = await order(page);
  expect(middle).toHaveLength(25);
  expect(new Set(middle).size).toBe(25);
  expect(middle).toEqual(expect.arrayContaining(before));
});

test('إلغاء، Escape، pointercancel، إفلات خارج القائمة، ونقرة عارضة لا تغيّر شيئًا', async ({ page }) => {
  await openOrder(page);
  const before = await order(page);

  await startMouseDrag(page, 4);
  await moveToGap(page, 10);
  await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  expect(await order(page)).toEqual(before);

  await startMouseDrag(page, 4);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ui-id="A2211"]')).toHaveCount(0);
  await page.mouse.up();
  expect(await order(page)).toEqual(before);

  await startMouseDrag(page, 4);
  await rows(page).nth(4).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await order(page)).toEqual(before);

  await startMouseDrag(page, 4);
  await page.mouse.move(5, 5, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await order(page)).toEqual(before);

  const row = rows(page).nth(4); await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 3); await page.mouse.up();
  await expect(page.locator('[data-ui-id="A2211"]')).toHaveCount(0);
  expect(await order(page)).toEqual(before);
});

test('تمرير تلقائي تدريجي قرب الحافة مع بقاء المعاينة وتحديث موضع الإدراج', async ({ page }) => {
  await openOrder(page);
  await startMouseDrag(page, 0);
  const vp = viewport(page);
  const before = await vp.evaluate((element) => element.scrollTop);
  const box = (await vp.boundingBox())!;
  const edgeX = Number.isFinite(box.x) ? Math.min(Math.max(box.x + box.width / 2, 1), 1599) : 800;
  const bottom = Number.isFinite(box.y) ? box.y + box.height : 900;
  const edgeY = Math.min(Math.max(bottom - 8, 1), 1099);
  const farY = Math.min(Math.max(bottom - 60, 1), 1099);
  await page.mouse.move(edgeX, farY, { steps: 4 });
  await expect.poll(() => vp.evaluate((element) => element.scrollTop), { timeout: 5000 }).toBeGreaterThan(before);
  const afterFar = await vp.evaluate((element) => element.scrollTop);
  await page.mouse.move(edgeX, edgeY, { steps: 3 });
  await page.waitForTimeout(220);
  const afterNear = await vp.evaluate((element) => element.scrollTop);
  // نفس زمن القياس تقريبًا، لكن الاقتراب من الحافة يضاعف سرعة التمرير.
  expect(afterNear - afterFar).toBeGreaterThan(afterFar - before);
  await expect(page.locator('[data-ui-id="A2211"]')).toBeVisible();
  const transform = await page.locator('[data-ui-id="A2211"]').evaluate((element) => (element as HTMLElement).style.transform);
  expect(transform).toContain('translate3d');
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

test('اللمس: ضغطة مطولة وتتبع، والحركة قبلها تبقى تمريرًا طبيعيًا بلا سحب', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000', hasTouch: true, viewport: { width: 1600, height: 1100 } });
  const document = ph3Document(); document.variants = []; document.links = [];
  await context.addInitScript((doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)), document);
  const page = await context.newPage();
  await page.goto('/editor');
  await page.getByRole('button', { name: 'ترتيب الأسطر', exact: true }).click();
  const before = await order(page);
  const source = rows(page).first(); await source.scrollIntoViewIfNeeded();
  const start = (await source.boundingBox())!; const target = (await rows(page).nth(3).boundingBox())!;
  const client = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', x = 0, y = 0) =>
    client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }] });
  const sx = start.x + start.width / 2, sy = start.y + start.height / 2;

  // حركة قبل اكتمال الضغطة: لا معاينة ولا حوار، والصفحة لا تُسحب ولا تُpan.
  await touch('touchStart', sx, sy);
  await touch('touchMove', sx + 20, sy + 30);
  await expect(page.locator('[data-ui-id="A2211"]')).toHaveCount(0);
  await touch('touchEnd');
  expect(await order(page)).toEqual(before);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await touch('touchStart', sx, sy);
  await page.waitForTimeout(400);
  await expect(page.locator('[data-ui-id="A2211"]')).toBeVisible();
  const ty = target.y + target.height * .75;
  await touch('touchMove', target.x + target.width / 2, ty);
  await expect(page.locator('[data-ui-id="A2211"]')).toHaveAttribute('data-pointer-y', String(Math.round(ty)));
  await expect(page.locator('[data-insert-gap="4"]')).toHaveClass(/bg-emerald-500/);
  await touch('touchCancel');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await order(page)).toEqual(before);

  await touch('touchStart', sx, sy);
  await page.waitForTimeout(400);
  await touch('touchMove', target.x + target.width / 2, ty);
  await touch('touchEnd');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await confirmMove(page);
  const after = await order(page);
  expect(after).toHaveLength(25);
  expect(new Set(after).size).toBe(25);
  expect(after[3]).toBe(before[0]);
  await context.close();
});

test('↳ وحده يدمج: معاينة بنفسجية وهدف مميز، وسحب الصف العادي لا يندمج أبدًا', async ({ page }) => {
  await openOrder(page);
  const before = await order(page);

  // سحب صف عادي إلى صف آخر: ترتيب فقط، بلا معاينة دمج وبلا نقص في الصفوف.
  await startMouseDrag(page, 0);
  const target = rows(page).nth(2); await target.scrollIntoViewIfNeeded();
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height * .75, { steps: 5 });
  await expect(page.locator('[data-ui-id="A2212"]')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toContainText('نقل السطر');
  await confirmMove(page);
  expect(await order(page)).toHaveLength(25);

  // مقبض الدمج: معاينة مستقلة وهدف بنفسجي وحوار السياسة.
  const handle = page.getByRole('button', { name: 'مقبض دمج السطر ١', exact: true });
  await handle.scrollIntoViewIfNeeded();
  const start = (await handle.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2 + 12, { steps: 3 });
  await expect(page.locator('[data-ui-id="A2212"][data-drag-mode="MERGE"]')).toBeVisible();
  const targetRow = rows(page).nth(1); await targetRow.scrollIntoViewIfNeeded();
  const end = (await targetRow.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 5 });
  await expect(targetRow).toHaveClass(/border-violet-600/);
  await page.mouse.up();
  await expect(page.getByRole('alertdialog')).toContainText('دمج');
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  expect(await rows(page).count()).toBe(25);
  expect(await order(page)).not.toEqual(before); // تغيّر الترتيب فقط من الخطوة الأولى
});


test('القلم: يبدأ بعد 7px بلا انتظار ضغطة مطولة، ويتبع المؤشر كالفأرة', async ({ page }) => {
  await openOrder(page);
  const handle = rows(page).nth(3).locator('span[title="اسحب لتغيير الترتيب"]');
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);
  const pen = (type: 'mousePressed' | 'mouseMoved' | 'mouseReleased', px: number, py: number, buttons: number) =>
    client.send('Input.dispatchMouseEvent', { type, x: px, y: py, button: 'left', buttons, clickCount: 1, pointerType: 'pen' });

  await pen('mousePressed', x, y, 1);
  await pen('mouseMoved', x + 12, y + 12, 1);
  // لا waitForTimeout(260): القلم لا ينتظر مؤقّت اللمس.
  await expect(page.locator('[data-ui-id="A2211"][data-drag-mode="ORDER"]')).toBeVisible({ timeout: 200 });
  await pen('mouseMoved', x + 70, y + 50, 1);
  await expect(page.locator('[data-ui-id="A2211"]')).toHaveAttribute('data-pointer-x', String(Math.round(x + 70)));
  await page.keyboard.press('Escape');
  await pen('mouseReleased', x + 70, y + 50, 0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await rows(page).count()).toBe(25);
});

test('FLIP: الصفوف المتأثرة تُترجم ثم تعود بعد تعيين الترتيب الذري', async ({ page }) => {
  await openOrder(page);
  await startMouseDrag(page, 0);
  await moveToGap(page, 10);
  await page.evaluate(() => {
    const flips: string[] = [];
    (window as unknown as { __flips: string[] }).__flips = flips;
    new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target as HTMLElement;
        if (el.matches?.('[data-order-line-id]') && el.style.transform.includes('translateY')) flips.push(el.style.transform);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] });
  });
  await page.mouse.up();
  await confirmMove(page);
  const transforms = await page.evaluate(() => (window as unknown as { __flips: string[] }).__flips);
  expect(transforms.length).toBeGreaterThan(0);
  expect(transforms[0]).toMatch(/translateY\(-?\d/);
  await expect.poll(() => rows(page).first().evaluate((el) => (el as HTMLElement).style.transform || 'none')).toBe('none');
});

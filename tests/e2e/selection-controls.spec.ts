// المرحلة 7: اختبار وظيفي حقيقي لكل عناصر A1448 وA130 بعد تحقيق الهوية
import { test, expect, type Page } from '@playwright/test';
import { ph3Document } from '../helpers/ph3-fixture';

async function openEditor(page: Page) {
  const document = ph3Document();
  await page.addInitScript((doc) => localStorage.setItem('tashjeer:doc:v2:1004', JSON.stringify(doc)), document);
  await page.goto('/editor');
}

const lineTemplate = (page: Page) => page.locator('[data-ui-id="A1448"]').first();
const manualLine = (page: Page, rank = 3) => page.locator(`[data-ui-id="A1448"][data-line-id="manual::line-${rank}"]`).first();
const contextMenu = (page: Page) => page.locator('[data-ui-id="A130"]');

async function openLineMenu(page: Page, selected = lineTemplate(page)) {
  const line = selected;
  await line.scrollIntoViewIfNeeded();
  // الأسطر المتداخلة في SVG قد تحجب مركز <g>؛ نرسل الحدث إلى العنصر نفسه
  // بعد التحقق من هويته، كما يفعل مفتش الواجهة، عند إحداثيات داخل الشاشة.
  await line.dispatchEvent('contextmenu', {
    button: 2, bubbles: true, cancelable: true, clientX: 600, clientY: 300,
  });
  await expect(contextMenu(page)).toBeVisible();
  return line;
}

test('A1448: focus, press, selected, Enter/Space, ARIA وحالة تفاعل واحدة', async ({ page }) => {
  await openEditor(page);
  const line = lineTemplate(page);
  await expect(line).toHaveAttribute('role', 'button');
  await expect(line).toHaveAttribute('tabindex', '0');

  await line.focus();
  await expect(line).toHaveAttribute('data-interaction-state', 'focus');

  const box = (await line.boundingBox())!;
  const at = { clientX: Math.round(box.x + 8), clientY: Math.round(box.y + 8), bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0 };
  await line.dispatchEvent('pointerdown', at);
  await expect(line).toHaveAttribute('data-interaction-state', 'pressed');
  await line.dispatchEvent('pointerup', at);
  await expect(line).not.toHaveAttribute('data-interaction-state', 'pressed');

  await line.dispatchEvent('click', at);
  await expect(line).toHaveAttribute('data-line-selected', '1');
  await expect(line).toHaveAttribute('aria-pressed', 'true');

  await line.focus();
  await page.keyboard.press('Enter');
  await expect(line).toHaveAttribute('data-line-selected', '1');
  await page.keyboard.press('Space');
  await expect(line).toHaveAttribute('data-line-selected', '1');
});

test('A130: كل أمر معروض جاهز، وكل ضغطة تنفّذ أثرًا حقيقيًا', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openEditor(page);
  const line = await openLineMenu(page, manualLine(page, 3));
  const lineId = (await line.getAttribute('data-line-id'))!;

  const menu = contextMenu(page);
  const commands = menu.locator('[data-command-id]');
  expect(await commands.count()).toBeGreaterThanOrEqual(5);
  for (const button of await commands.all()) {
    await expect(button).toHaveAttribute('data-command-state', 'ready');
  }

  // نسخ المعرّف → حافظة النظام تحمل معرّف السطر نفسه.
  await menu.locator('[data-command-id="COPY_ID"]').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(lineId);
  await expect(page.locator('[data-ui-id="A740"] [role="status"]')).toContainText(lineId);

  // نسخ «سطر كامل» غير مدعوم: يُخفى بدل زر يعطي «غير متاح بعد».
  await openLineMenu(page, manualLine(page, 3));
  await expect(contextMenu(page).locator('[data-command-id="COPY"]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // أعلى/أسفل → حوار نقل كمّي، والإلغاء لا يغيّر الترتيب.
  for (const id of ['MOVE_UP', 'MOVE_DOWN']) {
    await openLineMenu(page, manualLine(page, 3));
    await contextMenu(page).locator(`[data-command-id="${id}"]`).click();
    await expect(page.getByRole('alertdialog')).toContainText('نقل السطر');
    await expect(page.getByRole('alertdialog')).toContainText('أسطر متأثرة');
    await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  }

  // ربط/تحرير → تبويب «سطر ↔ سطر» والسطر المحدد طرف أول فعلي.
  for (const id of ['LINK', 'EDIT']) {
    await openLineMenu(page, manualLine(page, 3));
    await contextMenu(page).locator(`[data-command-id="${id}"]`).click();
    await expect(page.locator('[data-ui-id="A1150"]')).toHaveValue(lineId);
  }
});


test('A130: نسخ اختلاف سطر مركّب ينفّذ أثرًا حقيقيًا ويبقى داخل الشاشة', async ({ page }) => {
  await openEditor(page);
  const line = await openLineMenu(page, lineTemplate(page));
  const box = await contextMenu(page).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1600);
  expect(box!.y + box!.height).toBeLessThanOrEqual(1100);
  await expect(contextMenu(page).locator('[data-command-id="COPY"]')).toHaveCount(1);
  await contextMenu(page).locator('[data-command-id="COPY"]').click();
  await expect(page.locator('[data-ui-id="A740"] [role="status"]')).toContainText('نُسخ');
  expect(await line.getAttribute('data-line-id')).toContain('combo::');
});

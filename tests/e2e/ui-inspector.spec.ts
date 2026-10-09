// اختبارات فاحص هويات الواجهة — UI ID Inspector e2e
// مشروع التشجير - نظام القراءات العشر
//
// تثبت هذه الاختبارات أن الفاحص يعمل على واجهة حقيقية في بناء إنتاجي
// (playwright.config يشغّل next build + next start، لا وضع التطوير):
// شارات معرفات فعلية فوق الأزرار والحقول، تفاصيل السجل الحقيقية،
// النسخ، عدم إعاقة التفاعل، اختفاء كل شيء عند الإيقاف، وخلو الصفحة من أخطاء JS.

import { test, expect } from '@playwright/test';
import { UI_REGISTRY } from '../../src/ui/ui-registry';

const registered = (id: string) => UI_REGISTRY.find((entry) => entry.id === id);

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('UI ID Inspector', () => {
  test('visible toggle reveals real ID badges over a registered button and input on /editor', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/editor');
    await expect(page.locator('[data-ui-id="A020"]')).toBeVisible();

    // قبل التفعيل: لا شارات ولا طبقة ولا لوحة — المظهر الطبيعي تمامًا.
    const toggle = page.locator('[data-ui-id="A410"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-ui-id="A731"]')).toHaveCount(0);
    await expect(page.locator('[data-ui-id="A411"]')).toHaveCount(0);
    await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);

    // التفعيل كما يفعل المستخدم: نقرة على المفتاح المرئي.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // شارة فعلية فوق زر «الإنشاء الذكي» المسجل (A116) في الكود الحالي.
    const buttonBadge = page.locator('[data-ui-id="A731"][data-ui-target-id="A116"]').first();
    await expect(buttonBadge).toBeVisible();
    await expect(buttonBadge).toHaveText('A116');

    // نص الشارة يطابق data-ui-id الخاص بالعنصر الحقيقي نفسه.
    await expect(page.locator('[data-ui-id="A116"]')).toHaveAttribute('data-ui-id', 'A116');

    // شارة فعلية فوق حقل إدخال مسجل: حقل بحث الآيات (A110).
    const inputBadge = page.locator('[data-ui-id="A731"][data-ui-target-id="A110"]').first();
    await expect(inputBadge).toBeVisible();
    await expect(inputBadge).toHaveText('A110');

    // كل شارة ظاهرة تحمل معرفًا موجودًا فعلًا في السجل.
    const badgeIds = await page.locator('[data-ui-id="A731"]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-ui-target-id') ?? ''),
    );
    expect(badgeIds.length).toBeGreaterThan(20);
    for (const id of new Set(badgeIds)) {
      expect(registered(id), `badge ${id} must exist in the registry`).toBeDefined();
    }

    expect(errors).toEqual([]);
  });

  test('?uiInspector=1 activates the inspector and a badge click shows real registry details', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // التفعيل عبر معامل الرابط — يعمل على النشر الإنتاجي دون DevTools.
    await page.goto('/editor?uiInspector=1');
    const badge = page.locator('[data-ui-id="A731"][data-ui-target-id="A116"]').first();
    await expect(badge).toBeVisible();

    await badge.click();
    const panel = page.locator('[data-ui-id="A412"]');
    await expect(panel).toBeVisible();

    // البيانات الحقيقية من السجل، لا قيم افتراضية.
    const record = registered('A116')!;
    await expect(panel).toContainText('A116');
    await expect(panel).toContainText(record.name);
    await expect(panel).toContainText(record.kind);
    await expect(panel).toContainText(record.component);
    await expect(panel).toContainText(record.sourceFile);
    await expect(panel).toContainText(record.route);
    await expect(panel).toContainText(record.featureId);

    // زر النسخ يكتب المعرف الدقيق في الحافظة.
    const copyButton = page.locator('[data-ui-id="A2126"]');
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(copyButton).toHaveText(/Copied/);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('A116');

    expect(errors).toEqual([]);
  });

  test('badges never block interaction; dynamic dialog elements get badges; OFF removes every artifact', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/editor');
    await page.locator('[data-ui-id="A410"]').click();
    await expect(page.locator('[data-ui-id="A731"][data-ui-target-id="A116"]').first()).toBeVisible();

    // النقر على الزر الحقيقي (لا الشارة) يظل يعمل: المعالج الذكي يُفتح.
    await page.locator('[data-ui-id="A116"]').click();
    const wizard = page.locator('[data-ui-id="A421"]');
    await expect(wizard).toBeVisible();

    // عنصر أُنشئ ديناميكيًا داخل النافذة يحصل على شارة فورًا.
    const closeBadge = page.locator('[data-ui-id="A731"][data-ui-target-id="A1326"]').first();
    await expect(closeBadge).toBeVisible();
    await expect(closeBadge).toHaveText('A1326');

    // نقرة الشارة تعرض تفاصيل السجل للعنصر الديناميكي.
    await closeBadge.click();
    await expect(page.locator('[data-ui-id="A412"]')).toContainText('A1326');

    // زر الإغلاق الحقيقي داخل النافذة يظل قابلًا للنقر رغم الشارات.
    await page.locator('[data-ui-id="A1326"]').click();
    await expect(page.locator('[data-ui-id="A421"]')).toHaveCount(0);

    // الإيقاف: كل آثار الفاحص تختفي والموقع يعود طبيعيًا تمامًا.
    await page.locator('[data-ui-id="A410"]').click();
    await expect(page.locator('[data-ui-id="A731"]')).toHaveCount(0);
    await expect(page.locator('[data-ui-id="A411"]')).toHaveCount(0);
    await expect(page.locator('[data-ui-id="A412"]')).toHaveCount(0);

    // التطبيق صالح للاستخدام بعد الإيقاف.
    await page.locator('[data-ui-id="A116"]').click();
    await expect(page.locator('[data-ui-id="A421"]')).toBeVisible();

    expect(errors).toEqual([]);
  });

  // الفحص يتكرر على الصفحات الرئيسية: الشارات تظهر على كل مسار واقعي.
  for (const route of ['/studio', '/quran', '/tracking', '/variants', '/settings']) {
    test(`inspector badges appear on ${route}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(route);
      await page.locator('[data-ui-id="A410"]').click();

      const badges = page.locator('[data-ui-id="A731"]');
      await expect(badges.first()).toBeVisible();
      const count = await badges.count();
      expect(count).toBeGreaterThan(5);

      const badgeIds = await badges.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-ui-target-id') ?? ''),
      );
      for (const id of new Set(badgeIds)) {
        expect(registered(id), `badge ${id} must exist in the registry`).toBeDefined();
      }

      // الإيقاف يعمل من أي صفحة.
      await page.locator('[data-ui-id="A410"]').click();
      await expect(page.locator('[data-ui-id="A731"]')).toHaveCount(0);

      expect(errors).toEqual([]);
    });
  }
});

// اختبار أداء القوائم الطويلة — Windowed List Performance (NFR-01, FR-ED-01)
// مشروع التشجير - نظام القراءات العشر
//
// المحسوم في الحزمة 03: «يجب اجتياز قائمة 2000 عنصر بتمرير سلس». هذا
// الاختبار يثبت الحساب لا الإحساس: نواة التنافذ (windowed-list-core) تُقاس
// على 2000 عنصر بارتفاع متفاوت، مع تصفية 1000 عنصر ومحاكاة 120 خطوة تمرير،
// فتثبت صحة النوافذ والحشوات وسرعتها — بلا DOM ثقيل.

import { describe, expect, it } from 'vitest';
import {
  computeWindow,
  offsetOfIndex,
  scrollDirections,
  scrollTopToCenterIndex,
  shouldShowJumpToTop,
  totalHeight,
} from '@/hooks/windowed-list-core';

const COUNT = 2000;

/** ارتفاعات متفاوتة واقعيا: صف الاختلاف الموسع أطول من المختصر. */
const heightOf = (index: number): number => 64 + ((index * 37) % 96);

describe('نواة التنافذ على 2000 عنصر (NFR-01)', () => {
  it('حدود النافذة داخل المدى الصحيح والحشوات تساوي ما بقي', () => {
    const window = computeWindow({ scrollTop: 12_000, viewport: 640, count: COUNT, heightOf, overscan: 6 });
    expect(window.start).toBeGreaterThanOrEqual(0);
    expect(window.end).toBeLessThanOrEqual(COUNT - 1);
    expect(window.start).toBeLessThanOrEqual(window.end);

    const rendered = totalHeight(window.end - window.start + 1, (i) => heightOf(window.start + i));
    expect(window.topPad + rendered + window.bottomPad).toBeCloseTo(totalHeight(COUNT, heightOf), 0);
  });

  it('أعلى القائمة: نافذة تبدأ من الصفر بلا حشو علوي', () => {
    const window = computeWindow({ scrollTop: 0, viewport: 600, count: COUNT, heightOf, overscan: 6 });
    expect(window.start).toBe(0);
    expect(window.topPad).toBe(0);
    expect(window.end).toBeGreaterThan(0);
  });

  it('أسفل القائمة: النافذة تصل لآخر صف والحشو السفلي صفّر', () => {
    const total = totalHeight(COUNT, heightOf);
    const window = computeWindow({ scrollTop: total + 500, viewport: 600, count: COUNT, heightOf, overscan: 6 });
    expect(window.end).toBe(COUNT - 1);
    expect(window.bottomPad).toBe(0);
  });

  it('قائمة قصيرة تُعاد كاملة (بلا تنافذ) وحاصل جمعها مطابق', () => {
    // رؤية أوسع من مجموع الارتفاعات ⇒ كل الصفوف في النافذة بلا حشوات.
    const window = computeWindow({ scrollTop: 0, viewport: 50_000, count: 20, heightOf, overscan: 6 });
    expect(window.start).toBe(0);
    expect(window.end).toBe(19);
    expect(window.topPad).toBe(0);
    expect(window.bottomPad).toBe(0);
  });

  it('قائمة فارغة تعطي نافذة معطلة لا استثناء', () => {
    const window = computeWindow({ scrollTop: 0, viewport: 600, count: 0, heightOf, overscan: 6 });
    expect(window.end).toBe(-1);
  });
});

describe('التمرير إلى العنصر المحدد (Scroll Into View الموحّد)', () => {
  it('التمركز يضع منتصف الصف قرب منتصف الرؤية داخل الحدود', () => {
    const viewport = 640;
    const target = 1500;
    const top = scrollTopToCenterIndex(COUNT, target, heightOf, viewport);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(Math.max(totalHeight(COUNT, heightOf) - viewport, 0));

    const rowTop = offsetOfIndex(COUNT, target, heightOf);
    const rowCenter = rowTop + heightOf(target) / 2;
    const viewCenter = top + viewport / 2;
    expect(Math.abs(viewCenter - rowCenter)).toBeLessThanOrEqual(1);
  });

  it('تمركز أول صف لا يعطي قيمة سالبة وآخر صف لا يتجاوز الحد', () => {
    const viewport = 640;
    expect(scrollTopToCenterIndex(COUNT, 0, heightOf, viewport)).toBe(0);
    const max = scrollTopToCenterIndex(COUNT, COUNT - 1, heightOf, viewport);
    expect(max).toBe(Math.max(totalHeight(COUNT, heightOf) - viewport, 0));
  });

  it('الإزاحة التراكمية متسقة مع مجموع الارتفاعات', () => {
    expect(offsetOfIndex(COUNT, 0, heightOf)).toBe(0);
    expect(offsetOfIndex(COUNT, COUNT, heightOf)).toBe(totalHeight(COUNT, heightOf) - heightOf(COUNT - 1));
  });
});

describe('أزرار الصعود/النزول والعودة لأعلى القائمة', () => {
  it('الاتجاهان يظهران عند الحاجة فقط وبهامش قرب الحدود', () => {
    expect(scrollDirections(0, 600, 5000)).toEqual({ up: false, down: true });
    // في المنتصف: الاتجاهان متاحان.
    expect(scrollDirections(3000, 600, 5000)).toEqual({ up: true, down: true });
    // عند الحد تماما: لا زر نزول (منع الاهتزاز بهامش 2px).
    expect(scrollDirections(4400, 600, 5000)).toEqual({ up: true, down: false });
  });

  it('زر العودة لأعلى لا يظهر إلا بعد تمرير بعيد', () => {
    expect(shouldShowJumpToTop(300, 600)).toBe(false);
    expect(shouldShowJumpToTop(1600, 600)).toBe(true);
    expect(shouldShowJumpToTop(0, 600)).toBe(false);
  });
});

describe('قياس الأداء: تصفية 1000 + تمرير 120 خطوة على 2000', () => {
  it('العمليات الحسابية للقائمة الطويلة تتم بلا تجمد ملحوظ', () => {
    // بناء قائمة 1000 اختلاف (مشتق من قاعدة عامة) كما في سيناريو القبول.
    const items = Array.from({ length: 1000 }, (_, index) => ({
      id: `global:${index}`,
      title: `اختلاف موضع ${index}`,
      source: index % 2 === 0 ? 'قاعدة عامة' : 'محرر',
    }));

    const started = performance.now();

    // تصفية فورية كاملة على 1000 عنصر (بحث النص/المصدر).
    let matches = 0;
    for (let pass = 0; pass < 100; pass += 1) {
      matches = items.filter((item) => item.title.includes('موضع 84') || item.source === 'محرر').length;
    }

    // محاكاة 120 خطوة تمرير متصل على 2000 صف: كل خطوة تعيد حساب النافذة.
    const total = totalHeight(COUNT, heightOf);
    for (let step = 0; step < 120; step += 1) {
      const scrollTop = (total / 120) * step;
      const window = computeWindow({ scrollTop, viewport: 640, count: COUNT, heightOf, overscan: 6 });
      expect(window.end).toBeGreaterThan(0);
    }

    // تمركز صف البحث (الوصول للعنصر 847 في خطوتين: بحث ← تحديد → تمركز).
    const centerScroll = scrollTopToCenterIndex(COUNT, 847, heightOf, 640);
    expect(centerScroll).toBeGreaterThanOrEqual(0);

    const elapsed = performance.now() - started;
    // هامش متسع لتباين أجهزة CI: المطلوب «بلا تجمد ملحوظ» لا سباق سرعة.
    expect(elapsed).toBeLessThan(1500);
    expect(matches).toBeGreaterThan(0);
  });
});

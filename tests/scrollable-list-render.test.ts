// اختبار رسم القائمة الاحترافية — ScrollableList Render Contract (FR-ED-01)
// مشروع التشجير - نظام القراءات العشر
//
// «ومكوّنات الرسم نقية كذلك (SVG بلا حالة)، فتُولَّد نصا على الخادم
// ويُتحقق من ناتجها» (vitest.config.ts). هنا نفس الأسلوب للقائمة الطويلة:
// نتحقق نصا من عقد القائمة الاحترافية الذي تعتمده كل لوحات المحرر:
//
//   1. حاوية تمرير واحدة تحمل data-scroll-viewport وrole=region وtabIndex
//      (تمرير بالأسهم بعد التركيز + يكتشفها سحب الترتيب).
//   2. رأس ثابت (sticky) لا يُمرَّر مع المحتوى.
//   3. القوائم القصيرة تُرسم كاملة؛ والطويلة تُنافذ (renderWindow) فلا
//      يُرسم إلا المدى المرئي مع حشوات تحفظ صدق شريط التمرير.
//   4. حالة الفراغ تُعرض بدل قائمة فارغة صامتة.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScrollableList } from '@/components/ui/ScrollableList';

describe('عقد القائمة الاحترافية (FR-ED-01)', () => {
  it('حاوية التمرير تحمل data-scroll-viewport وقابلية تركيز لوحة المفاتيح', () => {
    const markup = renderToStaticMarkup(
      createElement(ScrollableList, { itemCount: 3, ariaLabel: 'قائمة تجريبية' }, null)
    );
    expect(markup).toContain('data-scroll-viewport');
    expect(markup).toContain('role="region"');
    expect(markup).toContain('tabindex="0"');
    // شريط التمرير الرأسي الدائم: overflow-y-scroll صراحة لا auto المتقلب.
    expect(markup).toContain('overflow-y-scroll');
  });

  it('الرأس ثابت sticky ولا يُمرَّر مع المحتوى', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ScrollableList,
        { itemCount: 3, header: createElement('div', { className: 'x' }, 'بحث وتصفية') },
        createElement('ul', null, createElement('li', { key: '1' }, 'عنصر'))
      )
    );
    expect(markup).toContain('sticky top-0');
    // الرأس قبل جسم القائمة في الترميز (أعلى الصندوق).
    expect(markup.indexOf('بحث وتصفية')).toBeLessThan(markup.indexOf('عنصر'));
  });

  it('القائمة القصيرة تُرسم كاملة بلا تنافذ', () => {
    const rows = Array.from({ length: 10 }, (_, index) => `صف-${index}`);
    const markup = renderToStaticMarkup(
      createElement(
        ScrollableList,
        { itemCount: rows.length },
        createElement('ul', null, rows.map((row) => createElement('li', { key: row }, row)))
      )
    );
    for (const row of rows) expect(markup).toContain(row);
    // بلا حشوات وهمية تحت العتبة.
    expect(markup).not.toContain('aria-hidden');
  });

  it('القائمة الطويلة تُنافذ: المدى المرئي يُرسم والبعيد لا', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ScrollableList,
        {
          itemCount: 2000,
          estimateHeight: 64,
          threshold: 40,
          renderWindow: (range) =>
            createElement(
              'ul',
              null,
              Array.from({ length: range.end - range.start + 1 }, (_, offset) => {
                const index = range.start + offset;
                return createElement('li', { key: index, 'data-list-index': index }, `صف-${index}`);
              })
            ),
        },
        null
      )
    );
    // أول المدى مرسوم (مع overscan) وآخر القائمة البعيد غير مرسوم.
    expect(markup).toContain('صف-0');
    expect(markup).toContain('data-list-index');
    expect(markup).not.toContain('صف-1999');
    // الحشوة السفلية تحفظ ارتفاع التمرير (شريط بمقبض يتناسب مع النسبة).
    expect(markup).toContain('aria-hidden');
  });

  it('حالة الفراغ تُعرض نصا واضحا', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ScrollableList,
        { itemCount: 0, emptyState: createElement('p', null, 'لا توجد عناصر بعد.') },
        null
      )
    );
    expect(markup).toContain('لا توجد عناصر بعد.');
  });
});

// اختبارات شكل التشجير الكلاسيكي
//
// هذه الاختبارات تحرس الشكل المعتمد في المصحف المشجّر، لا مجرد عدم الانهيار:
//   - كل الأسطر تحت الآية، متتالية تنازليا بلا تشارك في المسار.
//   - السطر يمتد مع الآية كلها ليبيّن موافقة الوجه لما قبله.
//   - ترتيب المواضع من آخر الآية إلى أولها، وترتيب الأوجه بقوة الوجه.
//   - رتبة الموضع اليدوية وترتيب الأوجه الصريح يتقدمان على قاعدة المحرك.

import { describe, it, expect } from 'vitest';
import { makeAyahKey, getAyahWordsByKey } from '@/data/quran';
import { layoutAyah, DEFAULT_LAYOUT_OPTIONS } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import type { Variant, ViewFilter } from '@/types/tashjeer';

const filter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

const ayahKey = makeAyahKey(1, 2); // الحمد لله رب العالمين
const words = getAyahWordsByKey(ayahKey);
const layout = layoutAyah(ayahKey, words, DEFAULT_LAYOUT_OPTIONS);

/** اختلاف اختباري بوجه واحد غير أساسي، بنطاق راوٍ معروف. */
function variant(
  id: string,
  start: number,
  end: number,
  overrides: Partial<Variant> = {},
  alternatives?: Variant['alternatives']
): Variant {
  return {
    id,
    ayahKey,
    category: 'FARSH',
    title: id,
    startPosition: start,
    endPosition: end,
    status: 'DRAFT',
    alternatives: alternatives ?? [
      {
        id: `${id}-alt`,
        text: 'وجه',
        label: 'وجه',
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
    ],
    ...overrides,
  };
}

// هذه المجموعة تحرس قواعد **الموضع الواحد**، فتعمل في وضع «سطر لكل وجه».
// أما التركيب (اجتماع أحكام الراوي في سطر واحد) فله ملف اختبار مستقل.
function build(variants: Variant[], engine = {}) {
  return generateClassicTashjeer(variants, layout, filter, DEFAULT_LAYOUT_OPTIONS, {
    engine: { ...DEFAULT_ENGINE_SETTINGS, lineComposition: 'PER_VARIANT', ...engine },
  });
}

describe('شكل الشجرة تحت الآية', () => {
  it('يضع كل الأسطر تحت النص، ولا يرفع الأصول والمدود فوقه', () => {
    const result = build([
      variant('farsh', 1, 1),
      variant('usul', 2, 2, { category: 'USUL' }),
      variant('madud', 3, 3, { category: 'MADUD' }),
    ]);

    expect(result.lines).toHaveLength(3);
    expect(result.lines.every((line) => line.side === 'BOTTOM')).toBe(true);
    // كل سطر أسفل نص الآية فعليا، لا فوقه.
    expect(result.lines.every((line) => line.rowY > result.textBottom)).toBe(true);
  });

  it('ينزّل الأسطر واحدا تلو الآخر بلا تشارك في المسار', () => {
    // موضعان متباعدان أفقيا: كانا يتشاركان مسارا واحدا في الإصدار السابق.
    const result = build([variant('first', 1, 1), variant('last', 4, 4)]);

    const lanes = result.lines.map((line) => line.lane).sort();
    expect(lanes).toEqual([0, 1]);

    // ولا يتساوى ارتفاع سطرين.
    const rows = new Set(result.lines.map((line) => line.rowY));
    expect(rows.size).toBe(result.lines.length);
  });

  it('يمتد السطر مع الآية كلها في الوضع الافتراضي', () => {
    const result = build([variant('one', 2, 2)]);
    const line = result.lines[0];

    expect(line.spanStartX).toBe(result.textLeftX);
    expect(line.spanEndX).toBe(result.textRightX);
    // ومع ذلك تبقى العقدة على موضع الكلمة نفسها.
    expect(line.marks.map((mark) => mark.position)).toEqual([2]);
  });

  it('يقصر السطر على مدى الاختلاف عند اختيار ذلك في لوحة التحكم', () => {
    const result = build([variant('one', 2, 2)], { lineSpan: 'VARIANT_SPAN' });
    const line = result.lines[0];

    expect(line.spanStartX).toBeGreaterThan(result.textLeftX);
    expect(line.spanEndX).toBeLessThan(result.textRightX);
  });
});

describe('ترتيب المواضع', () => {
  it('يبدأ بآخر موضع في الآية وينتهي بأولها', () => {
    const result = build([variant('a', 1, 1), variant('b', 2, 2), variant('c', 4, 4)]);

    // «العالمين» (4) ← «لله» (2) ← «الحمد» (1)
    const byLane = [...result.lines].sort((first, second) => first.lane - second.lane);
    expect(byLane.map((line) => line.variantId)).toEqual(['c', 'b', 'a']);
  });

  it('يحترم الرتبة اليدوية للموضع ويقدّمها على قاعدة المحرك', () => {
    const result = build([
      variant('a', 1, 1, { orderRank: 1 }),
      variant('c', 4, 4),
    ]);

    const byLane = [...result.lines].sort((first, second) => first.lane - second.lane);
    // «الحمد» ثُبِّتت رتبته الأولى فتقدّم على «العالمين» رغم قاعدة آخر الآية.
    expect(byLane.map((line) => line.variantId)).toEqual(['a', 'c']);
  });
});

describe('ترتيب أوجه الموضع الواحد', () => {
  const multi = variant('madd', 2, 3, { category: 'MADUD' }, [
    {
      id: 'ishbaa',
      text: 'إشباع',
      label: 'إشباع',
      ruleLabel: 'إشباع',
      maddHarakat: 6,
      strength: 2,
      scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
    },
    {
      id: 'qasr',
      text: 'قصر',
      label: 'قصر',
      ruleLabel: 'قصر',
      maddHarakat: 2,
      strength: 1,
      scope: { kind: 'NARRATORS', narratorIds: ['narrator-al-susi'] },
    },
  ]);

  it('يقدّم الوجه الأقوى في الكتاب وإن تأخر في الإدخال', () => {
    const result = build([multi], { alternativeOrder: 'STRENGTH' });
    const byLane = [...result.lines].sort((first, second) => first.lane - second.lane);

    expect(byLane.map((line) => line.alternativeId)).toEqual(['qasr', 'ishbaa']);
    expect(byLane[0].ruleLabel).toBe('قصر');
    expect(byLane[0].maddHarakat).toBe(2);
  });

  it('يحترم ترتيب المحقق الصريح لهذا الموضع فوق كل قاعدة', () => {
    const pinned = { ...multi, alternativeOrder: ['ishbaa', 'qasr'] };
    const result = build([pinned], { alternativeOrder: 'STRENGTH' });
    const byLane = [...result.lines].sort((first, second) => first.lane - second.lane);

    expect(byLane.map((line) => line.alternativeId)).toEqual(['ishbaa', 'qasr']);
  });

  it('يبقي أوجه الموضع الواحد متتالية بلا فاصل', () => {
    const result = build([multi, variant('other', 4, 4)]);
    const maddLines = result.lines
      .filter((line) => line.variantId === 'madd')
      .sort((first, second) => first.lane - second.lane);

    expect(maddLines).toHaveLength(2);
    expect(maddLines[1].lane).toBe(maddLines[0].lane + 1);
    // وكلاهما في مجموعة موضع واحدة، وأولهما هو رأس المجموعة.
    expect(maddLines[0].groupIndex).toBe(maddLines[1].groupIndex);
    expect(maddLines[0].isGroupLeader).toBe(true);
    expect(maddLines[1].isGroupLeader).toBe(false);
  });
});

describe('بيانات السطر المطبوعة', () => {
  it('يعطي كل سطر اسم حكم يُطبع تحت الكلمة', () => {
    const result = build([
      variant('one', 1, 1, {}, [
        {
          id: 'imala',
          text: 'نص',
          label: 'بالإمالة',
          ruleLabel: 'إمالة',
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
        },
      ]),
    ]);

    expect(result.lines[0].ruleLabel).toBe('إمالة');
  });

  it('يسقط إلى وصف الوجه ثم إلى اسم الفئة عند غياب اسم الحكم', () => {
    const withLabel = build([
      variant('a', 1, 1, {}, [
        {
          id: 'x',
          text: 'نص',
          label: 'بالتسهيل',
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
        },
      ]),
    ]);
    expect(withLabel.lines[0].ruleLabel).toBe('بالتسهيل');

    const bare = build([
      variant('b', 1, 1, {}, [
        {
          id: 'y',
          text: 'نص',
          label: '',
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
        },
      ]),
    ]);
    expect(bare.lines[0].ruleLabel).toBe('فرش');
  });

  it('يعرض رموز القراء لا أسماءهم في الوضع الافتراضي', () => {
    const result = build([variant('one', 1, 1)]);
    // ورش رمزه «ج».
    expect(result.lines[0].symbols).toEqual(['ج']);
    expect(result.lines[0].label).toBe('ج');
  });
});

describe('الآية الطويلة الملتفة على عدة أسطر', () => {
  // البقرة 2:20 تلتف على ثلاثة أسطر نصية في العرض الافتراضي.
  const longKey = makeAyahKey(2, 20);
  const longWords = getAyahWordsByKey(longKey);
  const longLayout = layoutAyah(longKey, longWords, DEFAULT_LAYOUT_OPTIONS);

  function longVariant(id: string, start: number, end: number): Variant {
    return {
      id,
      ayahKey: longKey,
      category: 'FARSH',
      title: id,
      startPosition: start,
      endPosition: end,
      status: 'DRAFT',
      alternatives: [
        {
          id: `${id}-alt`,
          text: 'وجه',
          label: 'وجه',
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
        },
      ],
    };
  }

  it('يبقي كل الأسطر تحت آخر سطر نصي، لا تحت السطر الأول', () => {
    expect(longLayout.lineCount).toBeGreaterThan(1);

    const result = generateClassicTashjeer(
      [longVariant('early', 2, 2), longVariant('late', 18, 18)],
      longLayout,
      filter,
      DEFAULT_LAYOUT_OPTIONS,
      { engine: { ...DEFAULT_ENGINE_SETTINGS, lineComposition: 'PER_VARIANT' } }
    );

    // أسفل كتلة النص هو أسفل آخر سطر نصي، وكل الأسطر تنزل بعده.
    const lastTextBottom = Math.max(...longLayout.boxes.map((box) => box.bottomY));
    expect(result.textBottom).toBe(lastTextBottom);
    expect(result.lines.every((line) => line.rowY > lastTextBottom)).toBe(true);
  });

  it('يمتد السطر على عرض كتلة النص كاملة مهما تعددت أسطرها', () => {
    const result = generateClassicTashjeer(
      [longVariant('one', 2, 2)],
      longLayout,
      filter,
      DEFAULT_LAYOUT_OPTIONS,
      { engine: { ...DEFAULT_ENGINE_SETTINGS, lineComposition: 'PER_VARIANT' } }
    );

    const line = result.lines[0];
    expect(line.spanStartX).toBe(Math.min(...longLayout.boxes.map((box) => box.x)));
    expect(line.spanEndX).toBe(Math.max(...longLayout.boxes.map((box) => box.x + box.width)));
  });
});

describe('سطر الاتفاق: جمهور', () => {
  it('يرسم سطر «جمهور» وحده حين تخلو الآية من كل اختلاف', () => {
    const result = build([]);

    expect(result.hasDifferences).toBe(false);
    expect(result.lines).toHaveLength(0);
    expect(result.agreement).not.toBeNull();
    expect(result.agreement?.label).toBe('جمهور');
  });

  it('لا ينسب الاتفاق إلى حفص ولا إلى أي راوٍ بعينه', () => {
    // كان يُطبع «الجمهور · حفص»، وهو خطأ منهجي: حفص أحد القراء لا مرجع
    // الاتفاق، وإنما نص المصحف مكتوب بروايته.
    const label = build([]).agreement?.label ?? '';

    expect(label).toBe('جمهور');
    expect(label).not.toContain('حفص');
  });

  it('يحمل سطر الاتفاق القراء كلهم مختصرين برموز الأئمة', () => {
    const readers = build([]).agreement?.readers ?? [];

    // اتفق القراء كلهم، فاجتمع راويا كل إمام على وجه واحد: يُرمز للإمام
    // مرة واحدة بدل رمزي راوييه. عشرة أئمة = عشر بطاقات لا عشرون.
    expect(readers).toHaveLength(10);
    expect(readers.every((reader) => reader.kind === 'IMAM')).toBe(true);
    // مرتبون بترتيب طيبة النشر: قالون أولهم.
    expect(readers[0].narratorId).toBe('narrator-qalun');
    // ولكل بطاقة اسمها، فلا يسقط من لا رمز له كحفص.
    expect(readers.every((reader) => reader.name.length > 0)).toBe(true);
    expect(readers.some((reader) => reader.narratorIds.includes('narrator-hafs'))).toBe(true);
  });

  it('يمتد سطر الاتفاق مع الآية كلها كبقية الأسطر', () => {
    const result = build([]);

    expect(result.agreement?.guideStartX).toBe(result.textLeftX);
    expect(result.agreement?.guideEndX).toBe(result.textRightX);
  });

  it('يختفي سطر الاتفاق متى وُجد اختلاف واحد في الآية', () => {
    // عند الاختلاف يبيّن امتدادُ أسطر الأوجه موافقةَ من وافق، فلا حاجة إلى
    // سطر اتفاق ثانٍ يزاحمها.
    const result = build([variant('one', 2, 2)]);

    expect(result.hasDifferences).toBe(true);
    expect(result.agreement).toBeNull();
  });
});

describe('الخط التوضيحي وبطاقات القراء', () => {
  it('يعطي كل سطر خطا توضيحيا بطول الآية كلها', () => {
    const result = build([variant('one', 2, 2)]);
    const line = result.lines[0];

    expect(line.guideStartX).toBe(result.textLeftX);
    expect(line.guideEndX).toBe(result.textRightX);
  });

  it('يبقي الخط التوضيحي ممتدا مع الآية حتى حين يقصر خط الوجه على مداه', () => {
    // هذا هو موضع فائدته: خط الوجه محصور في كلمة، والخط التوضيحي يصلها
    // ببطاقة القارئ في الطرف الأيسر.
    const result = build([variant('one', 2, 2)], { lineSpan: 'VARIANT_SPAN' });
    const line = result.lines[0];

    expect(line.spanStartX).toBeGreaterThan(line.guideStartX);
    expect(line.spanEndX).toBeLessThan(line.guideEndX);
    expect(line.guideStartX).toBe(result.textLeftX);
    expect(line.guideEndX).toBe(result.textRightX);
  });

  it('يقرن كل رمز بصاحبه في بطاقات السطر', () => {
    const result = build([variant('one', 2, 2)]);
    const readers = result.lines[0].readers;

    expect(readers).toHaveLength(1);
    expect(readers[0].narratorId).toBe('narrator-warsh');
    expect(readers[0].name).toBe('ورش');
    expect(readers[0].symbol).toBe('ج');
  });
});

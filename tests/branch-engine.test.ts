// اختبارات محرك التشجير - Branch Engine Tests
// مشروع التشجير - نظام القراءات العشر
//
// هذه الاختبارات تحرس القواعد المنهجية للرسم:
//   - وجه المصحف لا يُرسم له خط.
//   - الأصول فوق النص والفرش تحته.
//   - ترتيب المسارات من آخر الآية إلى أولها.
//   - الخطوط المتباعدة أفقيا تتشارك المسار الواحد.

import { describe, expect, it } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import {
  CATEGORY_SIDE,
  assignLanes,
  computeStats,
  filterBranches,
  generateBranches,
  maxLane,
  renderBranches,
} from '@/lib/tashjeer/branch-engine';
import { getSeedVariants } from '@/data/variants/seed-variants';
import type { TashjeerBranch, Variant, ViewFilter } from '@/types/tashjeer';

const AYAH_KEY = makeAyahKey(1, 7);
const words = getAyahWords(1, 7);
const layout = layoutAyah(AYAH_KEY, words);

const ALL_VISIBLE: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

/** يبني اختلافا للاختبار بأقل قدر من التفاصيل. */
function makeVariant(overrides: Partial<Variant> & { id: string }): Variant {
  return {
    ayahKey: AYAH_KEY,
    category: 'FARSH',
    title: 'اختبار',
    startPosition: 1,
    endPosition: 1,
    status: 'DRAFT',
    alternatives: [
      { id: `${overrides.id}-base`, text: 'أصل', label: 'أصل', isBase: true, scope: { kind: 'ALL' } },
      {
        id: `${overrides.id}-alt`,
        text: 'بديل',
        label: 'بديل',
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
    ],
    ...overrides,
  };
}

describe('توليد الخطوط', () => {
  it('لا يرسم خطا لوجه المصحف', () => {
    const branches = generateBranches([makeVariant({ id: 'v1' })], layout);
    expect(branches).toHaveLength(1);
    expect(branches[0].alternativeId).toBe('v1-alt');
  });

  it('يتجاهل الوجه الذي لا يقرأ به أحد', () => {
    const variant = makeVariant({ id: 'v2' });
    variant.alternatives[1].scope = { kind: 'NARRATORS', narratorIds: [] };

    expect(generateBranches([variant], layout)).toHaveLength(0);
  });

  it('يبني عقدة لكل كلمة في مدى الاختلاف', () => {
    const variant = makeVariant({ id: 'v3', startPosition: 2, endPosition: 4 });
    const [branch] = generateBranches([variant], layout);

    expect(branch.nodes).toHaveLength(3);
    expect(branch.nodes.map((node) => node.position)).toEqual([2, 3, 4]);
  });

  it('يتجاهل المواضع خارج حدود الآية', () => {
    const variant = makeVariant({ id: 'v4', startPosition: 90, endPosition: 95 });
    expect(generateBranches([variant], layout)).toHaveLength(0);
  });

  it('يضع الأصول فوق النص والفرش تحته', () => {
    const usul = makeVariant({ id: 'u1', category: 'USUL' });
    const farsh = makeVariant({ id: 'f1', category: 'FARSH', startPosition: 3, endPosition: 3 });

    const branches = generateBranches([usul, farsh], layout);

    expect(branches.find((branch) => branch.variantId === 'u1')?.side).toBe('TOP');
    expect(branches.find((branch) => branch.variantId === 'f1')?.side).toBe('BOTTOM');
  });

  it('توزيع الفئات على الجهات ثابت وموثق', () => {
    expect(CATEGORY_SIDE.USUL).toBe('TOP');
    expect(CATEGORY_SIDE.MADUD).toBe('TOP');
    expect(CATEGORY_SIDE.FARSH).toBe('BOTTOM');
    expect(CATEGORY_SIDE.HAMZ).toBe('BOTTOM');
    expect(CATEGORY_SIDE.WAQF).toBe('BOTTOM');
  });

  it('يحفظ الخطوط اليدوية ولا يعيد توليدها', () => {
    const variant = makeVariant({ id: 'v5' });
    const manual: TashjeerBranch = {
      id: 'v5::v5-alt',
      variantId: 'v5',
      alternativeId: 'v5-alt',
      category: 'FARSH',
      nodes: [{ id: 'n', wordId: words[0].id, position: 1, anchor: 'BOTTOM' }],
      lane: 4,
      side: 'BOTTOM',
      label: 'يدوي',
      color: '#000000',
      isManual: true,
    };

    const branches = generateBranches([variant], layout, [manual]);
    expect(branches).toHaveLength(1);
    expect(branches[0].label).toBe('يدوي');
  });

  it('يحفظ حالة الإخفاء بعد إعادة التوليد', () => {
    const variant = makeVariant({ id: 'v6' });
    const hidden = generateBranches([variant], layout).map((branch) => ({
      ...branch,
      isHidden: true,
    }));

    const regenerated = generateBranches([variant], layout, hidden);
    expect(regenerated[0].isHidden).toBe(true);
  });

  it('بطاقة الوجه تجمع وصف الوجه ووصف النطاق', () => {
    const [branch] = generateBranches([makeVariant({ id: 'v7' })], layout);
    expect(branch.label).toContain('بديل');
    expect(branch.label).toContain('ورش');
  });
});

describe('توزيع المسارات', () => {
  it('الخطان المتداخلان أفقيا لا يتشاركان مسارا', () => {
    const a = makeVariant({ id: 'a', startPosition: 1, endPosition: 5 });
    const b = makeVariant({ id: 'b', startPosition: 3, endPosition: 7 });

    const branches = generateBranches([a, b], layout);
    const lanes = branches.map((branch) => branch.lane);

    expect(new Set(lanes).size).toBe(2);
  });

  it('الخطان المتباعدان يتشاركان المسار نفسه', () => {
    const a = makeVariant({ id: 'a', startPosition: 1, endPosition: 1 });
    const b = makeVariant({ id: 'b', startPosition: 8, endPosition: 9 });

    const branches = generateBranches([a, b], layout);
    expect(branches.every((branch) => branch.lane === 0)).toBe(true);
  });

  it('الخط الأقرب لآخر الآية يأخذ مسارا أقرب للنص', () => {
    // القاعدة: يُقرأ من آخر الآية إلى أولها.
    const early = makeVariant({ id: 'early', startPosition: 1, endPosition: 6 });
    const late = makeVariant({ id: 'late', startPosition: 5, endPosition: 9 });

    const branches = generateBranches([early, late], layout);
    const lateBranch = branches.find((branch) => branch.variantId === 'late')!;
    const earlyBranch = branches.find((branch) => branch.variantId === 'early')!;

    expect(lateBranch.lane).toBeLessThan(earlyBranch.lane);
  });

  it('جهتا الرسم تُحسبان بمسارات مستقلة', () => {
    const usul = makeVariant({ id: 'u', category: 'USUL', startPosition: 1, endPosition: 9 });
    const farsh = makeVariant({ id: 'f', category: 'FARSH', startPosition: 1, endPosition: 9 });

    const branches = generateBranches([usul, farsh], layout);
    expect(branches.every((branch) => branch.lane === 0)).toBe(true);
  });

  it('maxLane يحسب عدد المسارات المستخدمة', () => {
    const variants = [1, 3, 5].map((start) =>
      makeVariant({ id: `v${start}`, startPosition: start, endPosition: start + 3 })
    );

    const branches = generateBranches(variants, layout);
    expect(maxLane(branches, 'BOTTOM')).toBe(3);
    expect(maxLane(branches, 'TOP')).toBe(0);
  });

  it('assignLanes مستقر عند إعادة التطبيق', () => {
    const branches = generateBranches(
      [makeVariant({ id: 'x', startPosition: 2, endPosition: 4 })],
      layout
    );

    expect(assignLanes(branches).map((branch) => branch.lane)).toEqual(
      branches.map((branch) => branch.lane)
    );
  });
});

describe('الحساب الهندسي', () => {
  it('ينتج مسار SVG صالحا', () => {
    const branches = generateBranches([makeVariant({ id: 'g1' })], layout);
    const [rendered] = renderBranches(branches, layout);

    expect(rendered.path).toMatch(/^M /);
    expect(rendered.path.length).toBeGreaterThan(10);
    expect(rendered.path).not.toContain('NaN');
  });

  it('نقاط الخط مرتبة من اليمين إلى اليسار', () => {
    const branches = generateBranches(
      [makeVariant({ id: 'g2', startPosition: 1, endPosition: 4 })],
      layout
    );
    const [rendered] = renderBranches(branches, layout);

    for (let index = 1; index < rendered.points.length; index++) {
      expect(rendered.points[index].x).toBeLessThan(rendered.points[index - 1].x);
    }
  });

  it('لا يرسم الخطوط المخفية', () => {
    const branches = generateBranches([makeVariant({ id: 'g3' })], layout).map((branch) => ({
      ...branch,
      isHidden: true,
    }));

    expect(renderBranches(branches, layout)).toHaveLength(0);
  });

  it('البطاقة توضع يسار أقصى نقطة في الخط', () => {
    const branches = generateBranches(
      [makeVariant({ id: 'g4', startPosition: 2, endPosition: 5 })],
      layout
    );
    const [rendered] = renderBranches(branches, layout);
    const leftMost = Math.min(...rendered.points.map((point) => point.x));

    expect(rendered.labelX).toBeLessThan(leftMost);
  });
});

describe('التصفية', () => {
  const variants = [
    makeVariant({ id: 'c1', category: 'USUL' }),
    makeVariant({ id: 'c2', category: 'FARSH', startPosition: 5, endPosition: 5 }),
  ];
  const branches = generateBranches(variants, layout);

  it('تصفية الفئات تخفي غير المحدد', () => {
    const result = filterBranches(branches, variants, { ...ALL_VISIBLE, categories: ['USUL'] });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('USUL');
  });

  it('تصفية الرواة تُظهر خطوط الراوي فقط', () => {
    const warsh = filterBranches(branches, variants, {
      ...ALL_VISIBLE,
      narratorIds: ['narrator-warsh'],
    });
    const hafs = filterBranches(branches, variants, {
      ...ALL_VISIBLE,
      narratorIds: ['narrator-hafs'],
    });

    expect(warsh).toHaveLength(2);
    expect(hafs).toHaveLength(0);
  });

  it('قائمة رواة فارغة تعني إظهار الجميع', () => {
    expect(filterBranches(branches, variants, ALL_VISIBLE)).toHaveLength(2);
  });
});

describe('الإحصاءات', () => {
  it('تحسب الاختلافات والأوجه والكلمات المغطاة', () => {
    const variants = [
      makeVariant({ id: 's1', startPosition: 1, endPosition: 3 }),
      makeVariant({ id: 's2', startPosition: 3, endPosition: 4 }),
    ];
    const branches = generateBranches(variants, layout);
    const stats = computeStats(variants, branches);

    expect(stats.variantsCount).toBe(2);
    expect(stats.alternativesCount).toBe(4);
    expect(stats.branchesCount).toBe(2);
    // الكلمات 1,2,3,4 مع عدم تكرار الكلمة 3.
    expect(stats.coveredWords).toBe(4);
  });
});

describe('البيانات الأولية', () => {
  it('كل اختلاف أولي فيه وجه أساس واحد على الأقل', () => {
    for (const key of [1004, 1007, 2003, 2006, 2009, 2010, 112004]) {
      for (const variant of getSeedVariants(key)) {
        const baseCount = variant.alternatives.filter((item) => item.isBase).length;
        expect(baseCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('كل الاختلافات الأولية بحالة مسودة', () => {
    const variants = [1004, 1007, 2003, 2006, 2009, 2010].flatMap(getSeedVariants);
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.every((variant) => variant.status === 'DRAFT')).toBe(true);
  });

  it('مواضع الاختلافات الأولية داخل حدود آياتها', () => {
    for (const [surah, ayah] of [
      [1, 4],
      [1, 7],
      [2, 3],
      [2, 6],
      [2, 9],
      [2, 10],
      [112, 4],
    ] as const) {
      const wordsCount = getAyahWords(surah, ayah).length;

      for (const variant of getSeedVariants(makeAyahKey(surah, ayah))) {
        expect(variant.startPosition).toBeGreaterThanOrEqual(1);
        expect(variant.endPosition).toBeLessThanOrEqual(wordsCount);
        expect(variant.startPosition).toBeLessThanOrEqual(variant.endPosition);
      }
    }
  });

  it('اختلاف مالك في الفاتحة يُرسم له خط واحد', () => {
    const ayahWords = getAyahWords(1, 4);
    const ayahLayout = layoutAyah(makeAyahKey(1, 4), ayahWords);
    const branches = generateBranches(getSeedVariants(makeAyahKey(1, 4)), ayahLayout);

    expect(branches).toHaveLength(1);
    expect(branches[0].label).toContain('بغير ألف');
  });

  it('اختلاف كفوا في الإخلاص يُرسم له وجهان', () => {
    const ayahWords = getAyahWords(112, 4);
    const ayahLayout = layoutAyah(makeAyahKey(112, 4), ayahWords);
    const branches = generateBranches(getSeedVariants(makeAyahKey(112, 4)), ayahLayout);

    expect(branches).toHaveLength(2);
  });
});

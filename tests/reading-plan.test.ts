// اختبارات خطة المرور الجديدة: آخر الآية أولا، والوقف/الوصل، وكتالوج الإدارة.

import { describe, expect, it } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { generateBranches } from '@/lib/tashjeer/branch-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { normalizeEngineSettings } from '@/lib/tashjeer/engine-settings';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import {
  buildReadingPlan,
  compareReadingPositions,
  variantTraversalAnchor,
} from '@/lib/tashjeer/reading-plan';
import {
  createDefaultTransmissionCatalog,
  normalizeTransmissionCatalog,
} from '@/lib/transmissions/catalog';
import { resolveScope } from '@/lib/tashjeer/scope';
import { getNarratorSymbol } from '@/lib/tashjeer/symbols';
import type { Variant } from '@/types/tashjeer';

const ayahKey = makeAyahKey(1, 2); // الحمد لله رب العالمين: أربع كلمات
const layout = layoutAyah(ayahKey, getAyahWords(1, 2));

function variant(
  id: string,
  startPosition: number,
  endPosition: number,
  category: Variant['category']
): Variant {
  return {
    id,
    ayahKey,
    category,
    title: id,
    startPosition,
    endPosition,
    status: 'DRAFT',
    alternatives: [
      { id: `${id}-base`, text: 'الأصل', label: 'الأصل', isBase: true, scope: { kind: 'ALL' } },
      {
        id: `${id}-alt`,
        text: id,
        label: id,
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
    ],
  };
}

describe('خطة المرور من آخر الآية', () => {
  it('تبدأ بالعالمين ثم رب ثم لله ثم الحمد', () => {
    const plan = buildReadingPlan(4);
    expect(plan.positions).toEqual([4, 3, 2, 1]);
    expect(plan.segments).toEqual([
      { startPosition: 1, endPosition: 4, endsWithWaqf: false },
    ]);
  });

  it('لا تسمح لوحة الإدارة بحفظ ترتيب معكوس يبدأ من أول الآية', () => {
    expect(normalizeEngineSettings({ traversal: 'START_TO_END' }).traversal).toBe('END_TO_START');
  });

  it('يقسم الوقف والابتداء الآية إلى مقاطع محفوظة في الخطة', () => {
    const plan = buildReadingPlan(4, [
      { id: 'waqf', kind: 'WAQF', position: 2, label: 'وقف' },
      { id: 'ibtida', kind: 'IBTIDA', position: 3, label: 'ابتداء' },
    ]);

    // المقاطع تعرض بترتيب الأداء، أي المقطع الأخير قبل الأول.
    expect(plan.segments).toEqual([
      { startPosition: 3, endPosition: 4, endsWithWaqf: false },
      { startPosition: 1, endPosition: 2, endsWithWaqf: true },
    ]);
    expect(plan.positions).toEqual([4, 3, 2, 1]);
  });

  it('يسجل وصل رأس الآية بالتي بعدها من غير اختراع وقف', () => {
    const plan = buildReadingPlan(4, [
      { id: 'wasl', kind: 'WASL', position: 4, connectsToNextAyah: true },
    ]);
    expect(plan.connectsToNextAyah).toBe(true);
  });

  it('يعتمد آخر كلمة من مدى الاختلاف مرساة في الوضع الصحيح', () => {
    expect(variantTraversalAnchor(1, 4)).toBe(4);
    expect(variantTraversalAnchor(1, 4, 'START_TO_END')).toBe(1);

    const plan = buildReadingPlan(4);
    expect(compareReadingPositions(4, 3, plan)).toBeLessThan(0);
  });
});

describe('ترتيب المحرك لا يقدّم الفئة على آخر موضع', () => {
  it('يقدم اختلافا ممتدا آخره الكلمة الرابعة على اختلاف عند الثالثة', () => {
    // هذا يحرس الخلل القديم: كان المحرك يقارن أول المدى وأولوية الفئة، فيمكن
    // أن يتأخر مدى ينتهي في «العالمين» عن موضع «رب».
    const spanning = variant('spanning', 1, 4, 'TAJWEED');
    const middle = variant('middle', 3, 3, 'FARSH');
    const branches = generateBranches([middle, spanning], layout);

    expect(branches.find((branch) => branch.variantId === 'spanning')?.lane).toBe(0);
    expect(branches.find((branch) => branch.variantId === 'middle')?.lane).toBe(1);
  });
});

describe('أثر الوقف في شكل الشجرة', () => {
  it('يترك فصلا بصريا بين مقطعي الوقف عند توزيع الأسطر', () => {
    const late = variant('late', 4, 4, 'FARSH');
    const early = variant('early', 2, 2, 'FARSH');
    const result = generateClassicTashjeer(
      [early, late],
      layout,
      {
        categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
        narratorIds: [],
        showLabels: true,
        showGrid: false,
        showRulers: false,
        showAnchors: true,
      },
      {},
      {
        boundaries: [{ id: 'waqf', kind: 'WAQF', position: 2 }],
        engine: { lineComposition: 'PER_VARIANT' },
      }
    );

    const lateLine = result.lines.find((line) => line.variantId === 'late')!;
    const earlyLine = result.lines.find((line) => line.variantId === 'early')!;
    expect(lateLine.segmentIndex).toBe(0);
    expect(earlyLine.segmentIndex).toBe(1);
    // الأسطر متتالية بلا فراغ: مقطع ما بعد الوقف يُقرأ أولا فيأخذ السطر
    // الأعلى، ثم يليه مقطع ما قبله مباشرة. الفصل يظهر في الترتيب لا بسطر خال.
    expect(lateLine.lane).toBe(0);
    expect(earlyLine.lane).toBe(1);
  });
});

describe('كتالوج لوحة التحكم', () => {
  it('يحل الراوي الجديد ورمزه من الكتالوج بدلا من البذرة الثابتة', () => {
    const base = createDefaultTransmissionCatalog();
    const catalog = normalizeTransmissionCatalog({
      ...base,
      narrators: [
        ...base.narrators,
        {
          id: 'narrator-test',
          imamId: 'imam-nafi',
          name: 'راوٍ تجريبي',
          slug: 'test',
          order: 3,
          legacyOrderInTayyibah: 21,
          symbol: 'ظ',
        },
      ],
    });

    expect(resolveScope({ kind: 'NARRATORS', narratorIds: ['narrator-test'] }, catalog)).toEqual([
      'narrator-test',
    ]);
    expect(getNarratorSymbol('narrator-test', catalog)).toBe('ظ');
  });
});

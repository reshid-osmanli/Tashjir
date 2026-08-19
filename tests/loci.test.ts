// اختبارات المواضع المنفصلة وتنافي أوجه الموضع الواحد

import { describe, expect, it } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import {
  buildLociFromMarks,
  clusterWordPositions,
  exclusiveLocusKey,
  lociOfVariant,
  positionsOfVariant,
} from '@/lib/tashjeer/loci';
import type { Variant, VariantAlternative, ViewFilter } from '@/types/tashjeer';

const ayahKey = makeAyahKey(1, 2);
const layout = layoutAyah(ayahKey, getAyahWords(1, 2), DEFAULT_LAYOUT_OPTIONS);

const filter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

function variant(
  id: string,
  start: number,
  end: number,
  alternatives: VariantAlternative[],
  overrides: Partial<Variant> = {}
): Variant {
  return {
    id,
    ayahKey,
    category: 'FARSH',
    title: id,
    startPosition: start,
    endPosition: end,
    status: 'DRAFT',
    alternatives,
    ...overrides,
  };
}

describe('تجميع التحديد المتباعد', () => {
  it('يبقي الكلمتين المتباعدتين مجموعتين منفصلتين', () => {
    expect(clusterWordPositions([1, 4])).toEqual([[1], [4]]);
  });

  it('يجمع الكلمات المتجاورة في مدى واحد', () => {
    expect(clusterWordPositions([2, 3, 4])).toEqual([[2, 3, 4]]);
  });

  it('يبني مواضع من نقرات الحروف المتباعدة بلا ملء الفجوة', () => {
    const loci = buildLociFromMarks({
      mode: 'CHARACTERS',
      positions: [],
      characters: [
        { position: 1, characterIndex: 2 },
        { position: 4, characterIndex: 1 },
      ],
    });

    expect(loci).toHaveLength(2);
    expect(loci[0].startPosition).toBe(1);
    expect(loci[1].startPosition).toBe(4);
  });
});

describe('رسم المواضع المنفصلة', () => {
  it('يثبّت علامة على كل كلمة معلّمة دون الكلمات التي بينها', () => {
    const silah = variant(
      'silah',
      1,
      4,
      [
        {
          id: 'silah-alt',
          text: 'صلة',
          label: 'صلة',
          ruleLabel: 'صلة',
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
        },
      ],
      {
        category: 'USUL',
        loci: [
          { startPosition: 1, endPosition: 1 },
          { startPosition: 4, endPosition: 4 },
        ],
      }
    );

    const { lines } = generateClassicTashjeer([silah], layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].entries[0].marks.map((mark) => mark.position)).toEqual([1, 4]);
    expect(lines[0].entries[0].emphases).toHaveLength(2);
    expect(positionsOfVariant(silah)).toEqual([1, 4]);
  });
});

describe('تنافي أوجه الموضع الواحد المسجّلة اختلافا مستقلا', () => {
  it('لا يضرب مدّين في الحروف نفسها، بل يجعلهما وجهين متنافيين', () => {
    const qasr = variant(
      'qasr',
      1,
      1,
      [
        {
          id: 'qasr-alt',
          text: 'قصر',
          label: 'قصر',
          ruleLabel: 'مد',
          maddHarakat: 2,
          strength: 1,
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
        },
      ],
      { category: 'MADUD' }
    );
    const tawassut = variant(
      'tawassut',
      1,
      1,
      [
        {
          id: 'tawassut-alt',
          text: 'توسط',
          label: 'توسط',
          ruleLabel: 'مد',
          maddHarakat: 4,
          strength: 2,
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
        },
      ],
      { category: 'MADUD' }
    );

    expect(exclusiveLocusKey(qasr)).toBe(exclusiveLocusKey(tawassut));

    const { lines } = generateClassicTashjeer([qasr, tawassut], layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
    });

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.entries.length === 1)).toBe(true);
    expect(lines.map((line) => line.entries[0].maddHarakat)).toEqual([2, 4]);
  });

  it('يضرب المد مع التقليل لأنهما فئتان ولو اتحد الموضع', () => {
    const madd = variant(
      'madd',
      1,
      1,
      [
        {
          id: 'madd-alt',
          text: 'قصر',
          label: 'قصر',
          ruleLabel: 'مد',
          maddHarakat: 2,
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
        },
      ],
      { category: 'MADUD' }
    );
    const taqlil = variant(
      'taqlil',
      1,
      1,
      [
        {
          id: 'taqlil-alt',
          text: 'تقليل',
          label: 'تقليل',
          ruleLabel: 'تقليل',
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
        },
      ],
      { category: 'USUL' }
    );

    const { lines } = generateClassicTashjeer([madd, taqlil], layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].entries).toHaveLength(2);
  });
});

describe('lociOfVariant', () => {
  it('يرجع المدى القديم إن لم تُحفظ مواضع منفصلة', () => {
    const item = variant('one', 2, 3, []);
    expect(lociOfVariant(item)).toEqual([{ startPosition: 2, endPosition: 3 }]);
  });
});

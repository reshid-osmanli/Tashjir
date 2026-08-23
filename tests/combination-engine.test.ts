// اختبارات محرك الأوجه المركّبة
//
// هذه الاختبارات تحرس المطلب الأساسي في هذه المرحلة:
//
//   1. الراوي يقرأ الآية **مرة واحدة**، فتجتمع أحكامه كلها في سطر واحد،
//      كل حكم فوق كلمته: مدٌّ هنا، وفرشٌ هناك، وإدغام في موضع ثالث.
//   2. إذا كان له في موضع وجهان تعدّدت سطوره بضرب الأوجه بعضها في بعض،
//      والمقدَّم أولا.
//   3. الترتيب ترتيب الأمة: قالون ومن وافقه، ثم بقية أوجه قالون، ثم من بعده.
//   4. الطريق وحدة قراءة مستقلة إذا خُصّ بحكم، ويُذكر باسمه لا برمز.

import { describe, expect, it } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import { buildReadingCombinations } from '@/lib/tashjeer/combination-engine';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import type { Variant, VariantAlternative, ViewFilter } from '@/types/tashjeer';

const ayahKey = makeAyahKey(1, 2); // الحمد لله رب العالمين: أربع كلمات
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

function build(variants: Variant[], engine: Partial<typeof DEFAULT_ENGINE_SETTINGS> = {}) {
  return generateClassicTashjeer(variants, layout, filter, DEFAULT_LAYOUT_OPTIONS, {
    engine: { ...DEFAULT_ENGINE_SETTINGS, ...engine },
  });
}

describe('اجتماع أحكام الراوي في سطر واحد', () => {
  const madd = variant(
    'madd',
    1,
    1,
    [
      {
        id: 'madd-qasr',
        text: 'قصر',
        label: 'قصر',
        ruleLabel: 'مد',
        maddHarakat: 2,
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
      },
    ],
    { category: 'MADUD' }
  );

  const farsh = variant('farsh', 3, 3, [
    {
      id: 'farsh-alt',
      text: 'فرش',
      label: 'فرش',
      ruleLabel: 'فرش',
      scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
    },
  ]);

  const idgham = variant(
    'idgham',
    4,
    4,
    [
      {
        id: 'idgham-alt',
        text: 'إدغام',
        label: 'إدغام',
        ruleLabel: 'إدغام',
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
      },
    ],
    { category: 'USUL' }
  );

  it('يضع الأحكام الثلاثة في سطر واحد لا في ثلاثة أسطر', () => {
    const { lines } = build([madd, farsh, idgham]);

    expect(lines).toHaveLength(1);
    expect(lines[0].entries).toHaveLength(3);
    expect(lines[0].entries.map((entry) => entry.ruleLabel).sort()).toEqual(
      ['إدغام', 'فرش', 'مد'].sort()
    );
  });

  it('يثبّت كل حكم على كلمته، فلا يجتمع الحكمان على موضع واحد', () => {
    const { lines } = build([madd, farsh, idgham]);
    const positions = lines[0].entries.map((entry) => entry.marks.map((mark) => mark.position));

    expect(positions).toEqual([[4], [3], [1]]);
    // ولكل حكم تغليظه المستقل فوق السطر.
    const spans = lines[0].entries.map((entry) => entry.emphasisEndX - entry.emphasisStartX);
    expect(spans.every((span) => span > 0)).toBe(true);
  });

  it('يفصل الراوي الذي لا يوافق في كل الأحكام في سطر مستقل', () => {
    const shared = variant('shared', 2, 2, [
      {
        id: 'shared-alt',
        text: 'وجه',
        label: 'وجه',
        ruleLabel: 'سكت',
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun', 'narrator-warsh'] },
      },
    ]);

    const { lines } = build([madd, shared]);

    // قالون: مد + سكت. ورش: سكت وحده. سطران لا سطر واحد.
    expect(lines).toHaveLength(2);
    const qalunLine = lines.find((line) => line.narratorIds.includes('narrator-qalun'))!;
    const warshLine = lines.find(
      (line) => line.narratorIds.includes('narrator-warsh') && line !== qalunLine
    )!;

    expect(qalunLine.entries).toHaveLength(2);
    expect(warshLine.entries).toHaveLength(1);
    // وقالون أولا: ترتيب الأمة يبدأ به.
    expect(lines[0]).toBe(qalunLine);
  });
});

describe('ضرب أوجه الموضع الواحد', () => {
  const tahqiq = variant(
    'hamz',
    4,
    4,
    [
      {
        id: 'tahqiq',
        text: 'تحقيق',
        label: 'تحقيق',
        ruleLabel: 'تحقيق',
        strength: 1,
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
      {
        id: 'taqlil',
        text: 'تقليل',
        label: 'تقليل',
        ruleLabel: 'تقليل',
        strength: 2,
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
    ],
    { category: 'HAMZ' }
  );

  const madd = variant(
    'madd',
    1,
    1,
    [
      {
        id: 'qasr',
        text: 'قصر',
        label: 'قصر',
        ruleLabel: 'مد',
        maddHarakat: 2,
        strength: 1,
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
      {
        id: 'tawassut',
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

  it('يولّد سطرا لكل تركيب: تحقيق×قصر، تحقيق×توسط، تقليل×قصر، تقليل×توسط', () => {
    const { lines } = build([tahqiq, madd]);

    expect(lines).toHaveLength(4);
    const signature = lines.map((line) =>
      line.entries.map((entry) => entry.readingLabel).join('+')
    );
    expect(signature).toEqual([
      'تحقيق+قصر',
      'تحقيق+توسط',
      'تقليل+قصر',
      'تقليل+توسط',
    ]);
  });

  it('يجعل الموضع الأول في المرور أبطأ تغيّرا: تُستوفى فروعه قبل الانتقال', () => {
    const combinations = buildReadingCombinations([tahqiq, madd], buildReadingPlan(4), {
      engine: DEFAULT_ENGINE_SETTINGS,
    });

    const warsh = combinations.filter((combination) =>
      combination.narratorIds.includes('narrator-warsh')
    );
    // الوجه المقدَّم أولا، ورتبته صفر عند رائده.
    expect(warsh[0].rankInLead).toBe(0);
    expect(warsh.map((combination) => combination.rankInLead)).toEqual([0, 1, 2, 3]);
  });

  it('يعلّم أول تركيب للراوي بأنه المقدَّم', () => {
    const { lines } = build([tahqiq, madd]);
    expect(lines[0].isPreferred).toBe(true);
    expect(lines[1].isPreferred).toBe(false);
  });
});

describe('ترتيب الأمة في الأسطر', () => {
  it('يبدأ بقالون ومن وافقه، ثم يأتي دور من خالفه', () => {
    const shared = variant('shared', 2, 2, [
      {
        id: 'shared-alt',
        text: 'وجه',
        label: 'وجه',
        ruleLabel: 'إدغام',
        scope: {
          kind: 'NARRATORS',
          narratorIds: ['narrator-qalun', 'narrator-al-susi', 'narrator-ibn-jammaz'],
        },
      },
    ]);
    const warshOnly = variant('warsh', 3, 3, [
      {
        id: 'warsh-alt',
        text: 'وجه',
        label: 'وجه',
        ruleLabel: 'إمالة',
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
    ]);

    const { lines } = build([shared, warshOnly]);

    expect(lines).toHaveLength(2);
    // السطر الأول يجمع قالون ومن وافقه، والثاني لورش.
    expect(lines[0].narratorIds).toEqual([
      'narrator-qalun',
      'narrator-al-susi',
      'narrator-ibn-jammaz',
    ]);
    expect(lines[1].narratorIds).toEqual(['narrator-warsh']);
    expect(lines[0].lane).toBe(0);
    expect(lines[1].lane).toBe(1);
  });

  it('يرفع الرمز إلى الإمام إذا اجتمع راوياه على التركيب نفسه', () => {
    const both = variant('both', 2, 2, [
      {
        id: 'both-alt',
        text: 'وجه',
        label: 'وجه',
        ruleLabel: 'إدغام',
        scope: { kind: 'IMAMS', imamIds: ['imam-nafi'] },
      },
    ]);

    const { lines } = build([both]);

    expect(lines).toHaveLength(1);
    expect(lines[0].readers).toHaveLength(1);
    expect(lines[0].readers[0].kind).toBe('IMAM');
    expect(lines[0].readers[0].symbol).toBe('أ');
    expect(lines[0].narratorIds).toEqual(['narrator-qalun', 'narrator-warsh']);
  });
});

describe('الطريق وحدة قراءة مستقلة', () => {
  const azraqOnly = variant(
    'sila',
    2,
    2,
    [
      {
        id: 'azraq-alt',
        text: 'صلة',
        label: 'صلة',
        ruleLabel: 'صلة',
        maddHarakat: 5,
        scope: { kind: 'PATHS', pathIds: ['path-warsh-al-azraq'] },
      },
    ],
    { category: 'MADUD' }
  );

  it('يُذكر الطريق باسمه لا برمز، وينفرد بسطره دون طريق أخيه', () => {
    const { lines } = build([azraqOnly]);

    expect(lines).toHaveLength(1);
    expect(lines[0].readers).toHaveLength(1);
    expect(lines[0].readers[0].kind).toBe('PATH');
    expect(lines[0].readers[0].name).toBe('الأزرق');
    expect(lines[0].readers[0].symbol).toBe('');
  });

  it('يرجع إلى رمز الراوي إذا اجتمع طريقاه على الوجه', () => {
    const bothPaths = variant('sila-both', 2, 2, [
      {
        id: 'both-paths',
        text: 'صلة',
        label: 'صلة',
        ruleLabel: 'صلة',
        scope: {
          kind: 'PATHS',
          pathIds: ['path-warsh-al-azraq', 'path-warsh-al-asbahani'],
        },
      },
    ]);

    const { lines } = build([bothPaths]);

    expect(lines[0].readers).toHaveLength(1);
    expect(lines[0].readers[0].kind).toBe('NARRATOR');
    expect(lines[0].readers[0].name).toBe('ورش');
    expect(lines[0].readers[0].symbol).toBe('ج');
  });
});

describe('تنافي المدى المتداخل لنفس الفئة', () => {
  it('لا يضرب صلتين متداخلتين لنفس الطريق، بل يجعلهما وجهين متنافيين', () => {
    const silahWide = variant(
      'silah-wide',
      1,
      4,
      [
        {
          id: 'silah-wide-alt',
          text: 'صلة',
          label: 'صلة',
          ruleLabel: 'صلة',
          scope: { kind: 'PATHS', pathIds: ['path-warsh-al-asbahani'] },
        },
      ],
      { category: 'USUL' }
    );
    const silahNarrow = variant(
      'silah-narrow',
      2,
      4,
      [
        {
          id: 'silah-narrow-alt',
          text: 'صلة ٢',
          label: 'صلة ٢',
          ruleLabel: 'صلة ٢',
          scope: { kind: 'PATHS', pathIds: ['path-warsh-al-asbahani'] },
        },
      ],
      { category: 'USUL' }
    );

    const { lines } = build([silahWide, silahNarrow]);
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.entries.length === 1)).toBe(true);
  });

  it('يجمع مدّين في كلمتين منفصلتين في سطر واحد', () => {
    const first = variant(
      'madd-1',
      1,
      1,
      [
        {
          id: 'madd-1-alt',
          text: 'مد',
          label: 'مد',
          ruleLabel: 'مد',
          maddHarakat: 2,
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
        },
      ],
      { category: 'MADUD' }
    );
    const second = variant(
      'madd-4',
      4,
      4,
      [
        {
          id: 'madd-4-alt',
          text: 'مد',
          label: 'مد',
          ruleLabel: 'مد',
          maddHarakat: 2,
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
        },
      ],
      { category: 'MADUD' }
    );

    const { lines } = build([first, second]);
    expect(lines).toHaveLength(1);
    expect(lines[0].entries).toHaveLength(2);
  });
});

describe('حصر التشجير في مقطع', () => {
  it('لا يشجّر إلا المواضع الواقعة في المقطع المحدد', () => {
    const early = variant('early', 1, 1, [
      {
        id: 'early-alt',
        text: 'وجه',
        label: 'وجه',
        ruleLabel: 'مد',
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
    ]);
    const late = variant('late', 4, 4, [
      {
        id: 'late-alt',
        text: 'وجه',
        label: 'وجه',
        ruleLabel: 'إمالة',
        scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      },
    ]);

    const result = generateClassicTashjeer(
      [early, late],
      layout,
      filter,
      DEFAULT_LAYOUT_OPTIONS,
      {
        engine: DEFAULT_ENGINE_SETTINGS,
        focusSegment: { startPosition: 1, endPosition: 2 },
      }
    );

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].entries).toHaveLength(1);
    expect(result.lines[0].entries[0].variantId).toBe('early');
    // وطرفا السطر محصوران في كلمات المقطع، لا في الآية كلها.
    const segmentRight = Math.max(
      ...layout.boxes.filter((box) => box.position <= 2).map((box) => box.x + box.width)
    );
    expect(result.lines[0].spanEndX).toBeCloseTo(segmentRight, 5);
  });
});

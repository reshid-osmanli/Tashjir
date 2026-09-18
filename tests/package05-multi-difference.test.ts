// اختبارات الحزمة 05 — تعدد الاختلافات المستقلة لنفس القارئ والموضع
// مشروع التشجير - نظام القراءات العشر (FR-ED-03 · DM-09)
//
// تحرس هذه الاختبارات القواعد الصارمة للحزمة:
//   1. الكيانات المستقلة: إضافة اختلاف ثانٍ/ثالث/رابع لنفس القارئ والكلمة
//      تنشئ كيانًا جديدًا بمعرّف جديد وفهرس تالٍ — لا استبدال ولا دمج ولا
//      تحديث ضمني للسابق، وحذف أحدها لا يمس البقية ولا علاقاتها.
//   2. قرار التنافي/الارتباط عبر Resolver حصرًا (P-07): المتنافيان (مد ٢ ومد ٤)
//      لا يُضربان ويظهران وجهين لموضع واحد، والمستقلان (مد وصلة وفرش) يُطبقان
//      معًا في سطر الراوي — والتصحيح اليدوي الموثق يسبق السياسة مع Correction.
//   3. المثال المرجعي كاملًا: القارئ X في الكلمة Y بأربعة اختلافات أحياء
//      مستقلين في المحرك والرسم والتصدير v8 وإعادة الاستيراد.
//   4. رسالة الحالة «اختلافان لموضع واحد» عند الإضافة الثانية (AC-2).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import { buildReadingCombinations } from '@/lib/tashjeer/combination-engine';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import type { Variant, VariantAlternative, ViewFilter } from '@/types/tashjeer';
import {
  assignOccurrenceIndices,
  differenceOccurrenceKey,
  multiDifferenceNotice,
  occurrenceIndexOf,
  sortLocusDifferences,
} from '@/lib/tashjeer/difference-occurrences';
import {
  resolveExclusiveGroups,
  resolveLocusRelation,
} from '@/lib/tashjeer/decision/editor-bridge';
import { MemoryStorage } from './helpers/memory-storage';

// ==================== أدوات مشتركة ====================

const ENGINE_AYAH = makeAyahKey(1, 2); // الحمد لله رب العالمين: أربع كلمات
const STORE_AYAH = makeAyahKey(1, 4);

const filter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

const qalun = { kind: 'NARRATORS' as const, narratorIds: ['narrator-qalun'] };

function alternative(id: string, label: string, overrides: Partial<VariantAlternative> = {}): VariantAlternative {
  return { id, text: label, label, scope: qalun, ...overrides };
}

function difference(
  id: string,
  position: number,
  category: Variant['category'],
  alternatives: VariantAlternative[],
  overrides: Partial<Variant> = {}
): Variant {
  return {
    id,
    ayahKey: ENGINE_AYAH,
    category,
    title: id,
    startPosition: position,
    endPosition: position,
    status: 'DRAFT',
    alternatives,
    ...overrides,
  };
}

/** المثال المرجعي الملزم: أربعة اختلافات لنفس القارئ في الكلمة نفسها. */
function referenceExample(word = 2): Variant[] {
  return [
    difference('d-madd-a', word, 'MADUD', [alternative('f-qasr', 'قصر', { maddHarakat: 2, ruleLabel: 'مد' })]),
    difference('d-madd-b', word, 'MADUD', [alternative('f-tawil', 'طويل', { maddHarakat: 4, ruleLabel: 'مد' })]),
    difference('d-silah', word, 'USUL', [alternative('f-silah', 'صلة', { ruleLabel: 'صلة' })]),
    difference('d-farsh', word, 'FARSH', [alternative('f-farsh', 'فرش', { ruleLabel: 'فرش' })]),
  ];
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// ==================== T1: نموذج التعدد (فهرسة وترتيب) ====================

describe('T1 — فهرسة التعدد (DM-09): دوال نقية', () => {
  it('أربعة اختلافات لنفس القارئ والكلمة تأخذ فهارس ١ إلى ٤ بمعرّفات مستقلة', () => {
    const variants = referenceExample();
    const indices = assignOccurrenceIndices(variants);
    expect([...indices.values()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(new Set(variants.map((variant) => variant.id)).size).toBe(4);
    expect(occurrenceIndexOf(variants[1]!, variants)).toBe(2);
  });

  it('نطاق قرّاء مختلف في الكلمة نفسها مجموعة تعدد مستقلة (فهرس ١ لكلٍّ)', () => {
    const forQalun = difference('d-a', 2, 'MADUD', [alternative('f-a', 'مد')]);
    const forWarsh: Variant = {
      ...difference('d-b', 2, 'MADUD', [{ id: 'f-b', text: 'مد', label: 'مد', scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] } }]),
    };
    expect(differenceOccurrenceKey(forQalun)).not.toBe(differenceOccurrenceKey(forWarsh));
    const indices = assignOccurrenceIndices([forQalun, forWarsh]);
    expect(indices.get('d-a')).toBe(1);
    expect(indices.get('d-b')).toBe(1);
  });

  it('ترتيب العرض: المصدر (محرك ثم محرر) ثم الرتبة الصريحة ثم الفهرس', () => {
    const editorLow = difference('d-editor-1', 2, 'MADUD', [alternative('f1', 'مد')], { origin: 'EDITOR' });
    const engine = difference('d-engine', 2, 'MADUD', [alternative('f2', 'مد')], { origin: 'ENGINE' });
    const editorRanked = difference('d-editor-2', 2, 'USUL', [alternative('f3', 'صلة')], {
      origin: 'EDITOR',
      orderRank: 1,
    });
    const editorUnranked = difference('d-editor-3', 2, 'FARSH', [alternative('f4', 'فرش')], { origin: 'EDITOR' });

    const ordered = sortLocusDifferences([editorUnranked, editorRanked, editorLow, engine]);
    // المحرك أولًا، ثم المحرر بالرتبة الصريحة، ثم بلا رتبة بفهرس التعدد
    // (الأربعة في مجموعة تعدد واحدة؛ الفهرس بترتيب المصفوفة: ٣ قبل ١).
    expect(ordered.map((variant) => variant.id)).toEqual(['d-engine', 'd-editor-2', 'd-editor-3', 'd-editor-1']);
  });

  it('رسالة الحالة: الثاني يعلن «اختلافان لموضع واحد» والثالث «٣ اختلافات»', () => {
    const [maddA, maddB, silah] = referenceExample();
    const second = multiDifferenceNotice([maddA], [maddB]);
    expect(second).toContain('اختلافان لموضع واحد');
    expect(second).toContain(maddA.title);
    expect(second).toContain(maddB.title);

    const third = multiDifferenceNotice([maddA, maddB], [silah]);
    expect(third).toContain('٣ اختلافات لموضع واحد');
    expect(third).toContain('لا دمج');

    // دفعة واحدة كلها جديدة (معالج متعدد الأنواع في موضع واحد): استقلال داخلي.
    const [maddA2, maddB2, silah2] = referenceExample();
    const batch = multiDifferenceNotice([], [maddA2, maddB2, silah2]);
    expect(batch).toContain('٣ اختلافات مستقلة لموضع واحد');
    expect(batch).toContain('لا دمج بينها');

    // موضع مختلف أو نطاق مختلف: لا رسالة.
    const elsewhere = difference('d-elsewhere', 3, 'MADUD', [alternative('f-x', 'مد')]);
    expect(multiDifferenceNotice([maddA], [elsewhere])).toBeNull();
  });
});

// ==================== T2: قرار التنافي/الارتباط عبر Resolver ====================

describe('T2 — resolveLocusRelation: قرار واحد في مكان واحد', () => {
  const maddA = difference('d-madd-a', 2, 'MADUD', [alternative('f-qasr', 'قصر')]);
  const maddB = difference('d-madd-b', 2, 'MADUD', [alternative('f-tawil', 'طويل')]);
  const silah = difference('d-silah', 2, 'USUL', [alternative('f-silah', 'صلة')]);
  const farsh = difference('d-farsh', 2, 'FARSH', [alternative('f-farsh', 'فرش')]);
  const elsewhere = difference('d-elsewhere', 3, 'MADUD', [alternative('f-x', 'مد')]);

  it('مد + مد في الكلمة نفسها: متنافيان (وجهان لموضع واحد)', () => {
    const result = resolveLocusRelation(maddA, maddB);
    expect(result.decision.status).toBe('EXCLUSIVE');
    expect(result.decision.manual).toBe(false);
  });

  it('مد + فرش في الكلمة نفسها: مستقلان (لا يُدمجان)', () => {
    expect(resolveLocusRelation(maddA, farsh).decision.status).toBe('INDEPENDENT');
  });

  it('مد + تحقيق/صلة في الكلمة نفسها: مرتبطان (مصفوفة الدمج الافتراضية)', () => {
    expect(resolveLocusRelation(maddA, silah).decision.status).toBe('RELATED');
  });

  it('موضعان منفصلان: مستقلان دائمًا', () => {
    expect(resolveLocusRelation(maddA, elsewhere).decision.status).toBe('INDEPENDENT');
    expect(resolveLocusRelation(maddA, elsewhere).decision.sharePosition).toBe(false);
  });

  it('تصحيح يدوي يسبق السياسة: «مرتبطان» لمدّين متنافيين بالسياسة', () => {
    const result = resolveLocusRelation(maddA, maddB, undefined, {
      fromId: 'd-madd-a',
      toId: 'd-madd-b',
      relation: 'RELATED',
      note: 'بُعدان مستقلان في الحرفين',
    });
    expect(result.decision.status).toBe('RELATED');
    expect(result.decision.manual).toBe(true);
    expect(result.trace.some((step) => step.stage === 'MANUAL_RELATION')).toBe(true);
  });

  it('تصحيح يدوي يسبق السياسة: «متنافيان» لمد وفرش مستقلين بالسياسة', () => {
    const result = resolveLocusRelation(maddA, farsh, undefined, {
      fromId: 'd-madd-a',
      toId: 'd-farsh',
      relation: 'MUTUALLY_EXCLUSIVE',
    });
    expect(result.decision.status).toBe('EXCLUSIVE');
    expect(result.decision.manual).toBe(true);
  });

  it('resolveExclusiveGroups يطبق التصحيح اليدوي على التجميع', () => {
    // بالسياسة: المدّان في مجموعة واحدة. التصحيح «مرتبطان» يمنع ضمهما.
    const { groups } = resolveExclusiveGroups([maddA, maddB], undefined, [
      { fromId: 'd-madd-a', toId: 'd-madd-b', relation: 'RELATED' },
    ]);
    expect(groups.get('d-madd-a')).not.toBe(groups.get('d-madd-b'));

    // وبالعكس: مد وفرش مستقلان بالسياسة، و«متنافيان» تجمعهما وجهين لموضع واحد.
    const { groups: flipped } = resolveExclusiveGroups([maddA, farsh], undefined, [
      { fromId: 'd-madd-a', toId: 'd-farsh', relation: 'MUTUALLY_EXCLUSIVE' },
    ]);
    expect(flipped.get('d-madd-a')).toBe(flipped.get('d-farsh'));
  });
});

// ==================== T4: التركيب — المتنافي لا يُضرب والمستقل معًا ====================

describe('T4 — محرك التراكيب: المتنافي لا يُضرب والمستقل يُطبق معًا', () => {
  const plan = buildReadingPlan(4);

  function combinationsOf(variants: Variant[], manualRelations: Parameters<typeof buildReadingCombinations>[2]['manualRelations']) {
    return buildReadingCombinations(variants, plan, {
      engine: DEFAULT_ENGINE_SETTINGS,
      manualRelations,
    });
  }

  it('مد ٢ + مد ٤ لنفس القارئ والكلمة: وجهان لموضع واحد لا يُضربان', () => {
    const [maddA, maddB] = referenceExample();
    const combos = combinationsOf([maddA, maddB], undefined);
    // وجهان لموضع واحد: تركيبان (سطر لكل وجه)، لا ٢×٢.
    expect(combos).toHaveLength(2);
    for (const combo of combos) {
      expect(combo.picks).toHaveLength(1);
    }
    const pickSources = combos.map((combo) => combo.picks[0]!.variant.id).sort();
    expect(pickSources).toEqual(['d-madd-a', 'd-madd-b']);
  });

  it('مد + صلة + فرش لنفس القارئ والكلمة (مستقلة): تُطبق معًا في سطر واحد', () => {
    const [, , silah, farsh] = referenceExample();
    const madd = referenceExample()[0]!;
    const combos = combinationsOf([madd, silah, farsh], undefined);
    expect(combos).toHaveLength(1);
    expect(combos[0]!.picks.map((pick) => pick.variant.id).sort()).toEqual(['d-farsh', 'd-madd-a', 'd-silah']);
  });

  it('المثال المرجعي: أربعة اختلافات — المدّان وجهان لموضع واحد والصلة والفرش معهما', () => {
    const combos = combinationsOf(referenceExample(), undefined);
    // سطران لقالون: (قصر × صلة × فرش) و(طويل × صلة × فرش).
    expect(combos).toHaveLength(2);
    for (const combo of combos) {
      expect(combo.picks).toHaveLength(3);
      const ids = combo.picks.map((pick) => pick.variant.id);
      // المتنافيان لا يجتمعان في تركيب واحد أبدًا.
      expect(ids.includes('d-madd-a') && ids.includes('d-madd-b')).toBe(false);
      // والمستقلان يظهران معًا في كل تركيب.
      expect(ids).toContain('d-silah');
      expect(ids).toContain('d-farsh');
    }
    // كل الكيانات الأربعة حية في المحرك: كل معرّف ظهر في تركيب ما.
    const seen = new Set(combos.flatMap((combo) => combo.picks.map((pick) => pick.variant.id)));
    for (const id of ['d-madd-a', 'd-madd-b', 'd-silah', 'd-farsh']) expect(seen.has(id)).toBe(true);
  });

  it('تصحيح يدوي «مرتبطان» بين المدّين يضربهما معًا (يتقدم على السياسة)', () => {
    const [maddA, maddB] = referenceExample();
    const combos = combinationsOf([maddA, maddB], [
      { fromId: 'd-madd-a', toId: 'd-madd-b', relation: 'RELATED' },
    ]);
    expect(combos).toHaveLength(1);
    expect(combos[0]!.picks.map((pick) => pick.variant.id).sort()).toEqual(['d-madd-a', 'd-madd-b']);
  });

  it('تصحيح يدوي «متنافيان» بين المد والفرش يمنع اجتماعهما في سطر', () => {
    const [madd, , , farsh] = referenceExample();
    const combos = combinationsOf([madd, farsh], [
      { fromId: 'd-madd-a', toId: 'd-farsh', relation: 'MUTUALLY_EXCLUSIVE' },
    ]);
    expect(combos).toHaveLength(2);
    for (const combo of combos) {
      expect(combo.picks).toHaveLength(1);
    }
  });

  it('الرسم الكلاسيكي: علامات الاختلافات الأربعة فوق كلمتها وسطور قالون بوجوه المدّين', () => {
    const layout = layoutAyah(ENGINE_AYAH, getAyahWords(1, 2), DEFAULT_LAYOUT_OPTIONS);
    const { lines } = generateClassicTashjeer(referenceExample(), layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
    });
    // سطران لقالون (وجه للمد الأول ووجه للثاني)، كل سطر يحمل الأحكام الثلاثة.
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.entries).toHaveLength(3);
      // كل حكم فوق الكلمة نفسها (ك٢) — بقواعد الرسم القائمة.
      for (const entry of line.entries) {
        expect(entry.marks.map((mark) => mark.position)).toEqual([2]);
      }
      const ruleLabels = line.entries.map((entry) => entry.ruleLabel).sort();
      expect(ruleLabels).toEqual(['صلة', 'فرش', 'مد'].sort());
    }
    // الوجهان المتنافيان في سطرين مختلفين لا سطر واحد.
    expect(new Set(lines.map((line) => line.entries.map((entry) => entry.variantId).sort().join(','))).size).toBe(2);
  });

  it('الرسم الكلاسيكي يطبق العلاقة اليدوية من روابط المستند (links)', () => {
    const layout = layoutAyah(ENGINE_AYAH, getAyahWords(1, 2), DEFAULT_LAYOUT_OPTIONS);
    const [maddA, maddB] = referenceExample();
    const links = [
      {
        id: 'rel-manual-1',
        ayahKey: ENGINE_AYAH,
        kind: 'DIFFERENCE_TO_DIFFERENCE' as const,
        relation: 'REFERENCE' as const,
        differenceRelation: 'RELATED' as const,
        from: { type: 'RULE' as const, id: 'd-madd-a' },
        to: { type: 'RULE' as const, id: 'd-madd-b' },
        origin: 'EDITOR' as const,
        createdAt: 't',
        updatedAt: 't',
      },
    ];
    const { lines } = generateClassicTashjeer([maddA, maddB], layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
      links,
    });
    // بالسياسة سطران (وجهان متنافيان)؛ التصحيح اليدوي يجمعهما في سطر واحد.
    expect(lines).toHaveLength(1);
    expect(lines[0]!.entries.map((entry) => entry.variantId).sort()).toEqual(['d-madd-a', 'd-madd-b']);
  });
});

// ==================== المخزن: الاستقلال والإشعار والتصحيح اليدوي ====================

async function loadStore() {
  const { useEditorStore } = await import('@/stores/editor-store');
  return useEditorStore;
}

function storeVariant(id: string, title: string, category: Variant['category']) {
  return {
    id,
    category,
    title,
    startPosition: 1,
    endPosition: 1,
    alternatives: [{ id: `${id}-face`, text: title, label: title, scope: qalun }],
    status: 'DRAFT' as const,
  };
}

describe('المخزن — الكيانات مستقلة ورسالة الحالة (AC-2)', () => {
  it('إضافة اختلاف ثانٍ لنفس القارئ والكلمة: رسالة «اختلافان لموضع واحد» ولا تغيير على الأول', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(STORE_AYAH);

    useEditorStore.getState().addVariant(storeVariant('d-first', 'مد أول', 'MADUD'));
    const firstSnapshot = JSON.stringify(useEditorStore.getState().document!.variants.find((v) => v.id === 'd-first'));

    useEditorStore.getState().addVariant(storeVariant('d-second', 'مد ثانٍ', 'MADUD'));

    const state = useEditorStore.getState();
    const document = state.document!;
    // الكيانان حيّان مستقلين.
    expect(document.variants.find((v) => v.id === 'd-first')).toBeDefined();
    expect(document.variants.find((v) => v.id === 'd-second')).toBeDefined();
    // الأول لم يتغير بايتًا واحدًا.
    expect(JSON.stringify(document.variants.find((v) => v.id === 'd-first'))).toBe(firstSnapshot);
    // رسالة الحالة (AC-2).
    expect(state.multiDifferenceNotice).toContain('اختلافان لموضع واحد');
    expect(state.multiDifferenceNotice).toContain('مد أول');
    expect(state.multiDifferenceNotice).toContain('مد ثانٍ');

    state.clearMultiDifferenceNotice();
    expect(useEditorStore.getState().multiDifferenceNotice).toBeNull();
  });

  it('إنشاء المعالج الذكي فوق موضع فيه اختلاف قائم يعرض الرسالة ولا يمسّ القائم', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(STORE_AYAH);
    useEditorStore.getState().addVariant(storeVariant('d-existing', 'مد قائم', 'MADUD'));
    const before = JSON.stringify(useEditorStore.getState().document!.variants.find((v) => v.id === 'd-existing'));

    const { buildSmartCreateBatch } = await import('@/lib/tashjeer/smart-create');
    const batch = buildSmartCreateBatch({
      ayahKey: STORE_AYAH,
      selection: [{ startPosition: 1, endPosition: 1 }],
      baseTitle: 'مد المعالج',
      types: ['MADUD'],
      scope: qalun,
      variants: { MADUD: [{ label: 'طويل' }] },
    });
    useEditorStore.getState().applySmartCreateBatch(batch);

    const state = useEditorStore.getState();
    expect(state.document!.variants.find((v) => v.id === 'd-existing')).toBeDefined();
    expect(JSON.stringify(state.document!.variants.find((v) => v.id === 'd-existing'))).toBe(before);
    expect(state.multiDifferenceNotice).toContain('اختلافان لموضع واحد');
  });

  it('حذف «اختلاف ٢» لا يمس «اختلاف ١» ولا علاقاته', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(STORE_AYAH);

    // الأربعة المرجعية: مد، مد آخر، صلة، فرش — لنفس القارئ والكلمة.
    useEditorStore.getState().addVariant(storeVariant('d-madd-1', 'مد أول', 'MADUD'));
    useEditorStore.getState().addVariant(storeVariant('d-madd-2', 'مد ثانٍ', 'MADUD'));
    useEditorStore.getState().addVariant(storeVariant('d-silah', 'صلة', 'USUL'));
    useEditorStore.getState().addVariant(storeVariant('d-farsh', 'فرش', 'FARSH'));

    // علاقة تخص الأول (وجه مركب مع وجه الصلة) تبقى بعد حذف الثاني.
    useEditorStore.getState().addLink({
      kind: 'FACE_TO_FACE',
      relation: 'REFERENCE',
      from: { type: 'FACE', id: 'd-madd-1::d-madd-1-face' },
      to: { type: 'FACE', id: 'd-silah::d-silah-face' },
    });
    const linksBefore = useEditorStore.getState().document!.links!;

    useEditorStore.getState().deleteVariant('d-madd-2');

    const document = useEditorStore.getState().document!;
    expect(document.variants.map((v) => v.id)).not.toContain('d-madd-2');
    expect(document.variants.map((v) => v.id)).toEqual(
      expect.arrayContaining(['d-madd-1', 'd-silah', 'd-farsh'])
    );
    // علاقة الأول باقية كما هي.
    const keptLink = document.links!.find((link) => link.from.id === 'd-madd-1::d-madd-1-face');
    expect(keptLink).toBeDefined();
    expect(linksBefore.find((link) => link.id === keptLink!.id)).toEqual(keptLink);
    // وأوجهه كاملة.
    expect(document.variants.find((v) => v.id === 'd-madd-1')!.alternatives).toHaveLength(1);
  });
});

describe('المخزن — التصحيح اليدوي لعلاقة التنافي (T2.2)', () => {
  it('تصحيح «مرتبطان» لمدّين متنافيين بالسياسة ينشئ علاقة وCorrection محفوظة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(STORE_AYAH);
    useEditorStore.getState().addVariant(storeVariant('d-madd-1', 'مد أول', 'MADUD'));
    useEditorStore.getState().addVariant(storeVariant('d-madd-2', 'مد ثانٍ', 'MADUD'));
    const correctionsBefore = useEditorStore.getState().document!.corrections?.length ?? 0;

    const notice = await useEditorStore.getState().setDifferenceRelation({
      fromId: 'd-madd-1',
      toId: 'd-madd-2',
      relation: 'RELATED',
      reason: 'بُعدان مستقلان في الحرفين',
    });

    // المحرك اقترح التنافي، والمحرر قرر الارتباط.
    expect(notice.allowed).toBe(true);
    expect(notice.policyStatus).toBe('EXCLUSIVE');
    expect(notice.overridesPolicy).toBe(true);
    expect(notice.correctionId).toBeDefined();

    const document = useEditorStore.getState().document!;
    const link = document.links!.find((item) => item.kind === 'DIFFERENCE_TO_DIFFERENCE');
    expect(link).toBeDefined();
    expect(link!.differenceRelation).toBe('RELATED');
    expect([link!.from.id, link!.to.id].sort()).toEqual(['d-madd-1', 'd-madd-2']);

    // Correction محفوظة (DM-05): المحرك A، المحرر B، النهائي = B.
    const correction = document.corrections!.find((item) => item.id === notice.correctionId);
    expect(correction).toBeDefined();
    expect((correction!.engineResult as { status: string }).status).toBe('EXCLUSIVE');
    expect((correction!.editorResult as { relation: string }).relation).toBe('RELATED');
    expect((correction!.finalResult as { relation: string }).relation).toBe('RELATED');
    expect(document.corrections!.length).toBe(correctionsBefore + 1);

    // ومحرك التراكيب يحترم التصحيح من روابط المستند: سطر واحد بالوجهين معًا.
    const layout = layoutAyah(STORE_AYAH, getAyahWords(1, 4), DEFAULT_LAYOUT_OPTIONS);
    const { lines } = generateClassicTashjeer(
      document.variants.filter((v) => v.id === 'd-madd-1' || v.id === 'd-madd-2'),
      layout,
      filter,
      DEFAULT_LAYOUT_OPTIONS,
      { engine: DEFAULT_ENGINE_SETTINGS, links: document.links }
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.entries.map((entry) => entry.variantId).sort()).toEqual(['d-madd-1', 'd-madd-2']);
  });

  it('تسجيل علاقة توافق السياسة يوثق الرابط بلا Correction (لا تصحيح بلا مخالفة)', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(STORE_AYAH);
    useEditorStore.getState().addVariant(storeVariant('d-madd', 'مد', 'MADUD'));
    useEditorStore.getState().addVariant(storeVariant('d-farsh', 'فرش', 'FARSH'));
    const correctionsBefore = useEditorStore.getState().document!.corrections?.length ?? 0;

    const notice = await useEditorStore.getState().setDifferenceRelation({
      fromId: 'd-madd',
      toId: 'd-farsh',
      relation: 'RELATED',
    });

    expect(notice.allowed).toBe(true);
    // السياسة تراهما غير متنافيين، وقرار المحرر «مرتبطان» لا يخالفها في التنافي.
    expect(notice.overridesPolicy).toBe(false);
    expect(notice.correctionId).toBeUndefined();
    expect(useEditorStore.getState().document!.corrections?.length ?? 0).toBe(correctionsBefore);
    const link = useEditorStore.getState().document!.links!.find((item) => item.kind === 'DIFFERENCE_TO_DIFFERENCE');
    expect(link?.differenceRelation).toBe('RELATED');
  });

  it('إعادة التسجيل بين الاختلافين نفسهما تحدّث العلاقة ولا تكررها', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(STORE_AYAH);
    useEditorStore.getState().addVariant(storeVariant('d-madd-1', 'مد أول', 'MADUD'));
    useEditorStore.getState().addVariant(storeVariant('d-madd-2', 'مد ثانٍ', 'MADUD'));

    await useEditorStore.getState().setDifferenceRelation({ fromId: 'd-madd-1', toId: 'd-madd-2', relation: 'RELATED' });
    await useEditorStore.getState().setDifferenceRelation({ fromId: 'd-madd-1', toId: 'd-madd-2', relation: 'MUTUALLY_EXCLUSIVE' });

    const links = useEditorStore.getState().document!.links!.filter((item) => item.kind === 'DIFFERENCE_TO_DIFFERENCE');
    expect(links).toHaveLength(1);
    expect(links[0]!.differenceRelation).toBe('MUTUALLY_EXCLUSIVE');
  });

  it('حذف أحد طرفي العلاقة اليدوية يزيلها (تنظيف الروابط القائم) ولا يمس الآخر', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(STORE_AYAH);
    useEditorStore.getState().addVariant(storeVariant('d-madd-1', 'مد أول', 'MADUD'));
    useEditorStore.getState().addVariant(storeVariant('d-madd-2', 'مد ثانٍ', 'MADUD'));
    await useEditorStore.getState().setDifferenceRelation({ fromId: 'd-madd-1', toId: 'd-madd-2', relation: 'RELATED' });

    useEditorStore.getState().deleteVariant('d-madd-2');

    const document = useEditorStore.getState().document!;
    expect(document.links!.some((item) => item.kind === 'DIFFERENCE_TO_DIFFERENCE')).toBe(false);
    expect(document.variants.find((v) => v.id === 'd-madd-1')).toBeDefined();
  });
});

// ==================== التصدير v8 وإعادة الاستيراد (T4.3) ====================

describe('التصدير v8 — كل اختلاف كيان مستقل بمعرّفه وفهرسه', () => {
  it('الأربعة المرجعية تُصدَّر مستقلة بفهارس ١..٤ والعلاقة اليدوية تُصدَّر بنوعها', async () => {
    const { createDocument, buildExportBundle } = await import('@/lib/storage/document-store');
    const document = createDocument(STORE_AYAH);
    const variants = [
      { ...storeVariant('d-madd-a', 'مد', 'MADUD'), ayahKey: STORE_AYAH },
      { ...storeVariant('d-madd-b', 'مد آخر', 'MADUD'), ayahKey: STORE_AYAH },
      { ...storeVariant('d-silah', 'صلة', 'USUL'), ayahKey: STORE_AYAH },
      { ...storeVariant('d-farsh', 'فرش', 'FARSH'), ayahKey: STORE_AYAH },
    ];
    const now = new Date().toISOString();
    const links = [
      {
        id: 'rel-export-1',
        ayahKey: STORE_AYAH,
        kind: 'DIFFERENCE_TO_DIFFERENCE' as const,
        relation: 'REFERENCE' as const,
        differenceRelation: 'MUTUALLY_EXCLUSIVE' as const,
        from: { type: 'RULE' as const, id: 'd-madd-a' },
        to: { type: 'RULE' as const, id: 'd-farsh' },
        origin: 'EDITOR' as const,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const bundle = buildExportBundle(
      [{ ...document, variants, links }],
      { engineConfig: null, exportedAt: '2026-01-01T00:00:00.000Z' }
    );

    const v8 = bundle.v8![0]!;
    expect(v8.differences).toHaveLength(4);
    expect(new Set(v8.differences.map((difference) => difference.id)).size).toBe(4);
    const byId = new Map(v8.differences.map((difference) => [difference.id, difference]));
    // الفهارس ١..٤ (الموضع والنطاق نفساهما) والأنواع كاملة.
    expect([...byId.values()].map((difference) => difference.occurrenceIndex).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(byId.get('d-madd-a')!.category).toBe('MADUD');
    expect(byId.get('d-silah')!.category).toBe('USUL');
    expect(byId.get('d-farsh')!.category).toBe('FARSH');
    // العلاقة اليدوية بنوعها الصريح في v8.
    const relation = v8.relations.find((item) => item.id === 'rel-export-1');
    expect(relation?.type).toBe('MUTUALLY_EXCLUSIVE');

    // إعادة الاستيراد تحفظ الكيانات الأربعة والعلاقة كما كانت.
    const store = await import('@/lib/storage/document-store');
    const json = JSON.stringify(bundle);
    const result = store.importDocuments(json, true);
    expect(result.imported).toBe(1);
    const restored = store.loadDocument(STORE_AYAH)!;
    expect(restored.variants.map((v) => v.id).sort()).toEqual(['d-farsh', 'd-madd-a', 'd-madd-b', 'd-silah']);
    const restoredLink = restored.links!.find((item) => item.id === 'rel-export-1');
    expect(restoredLink?.differenceRelation).toBe('MUTUALLY_EXCLUSIVE');
    // وإعادة تصدير ما استُورد تعطي الفهارس نفسها (حتمية الترحيل).
    const reexported = buildExportBundle([restored], {
      engineConfig: null,
      exportedAt: '2026-01-01T00:00:00.000Z',
    });
    const indices = reexported.v8![0]!.differences
      .map((difference) => `${difference.id}:${difference.occurrenceIndex}`)
      .sort();
    expect(indices).toEqual(['d-farsh:4', 'd-madd-a:1', 'd-madd-b:2', 'd-silah:3']);
  });
});

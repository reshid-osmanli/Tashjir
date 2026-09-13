// اختبارات تعدد الاختلافات للموضع الواحد: الفهرسة والتنافي والتصحيح والرحلة إلى v8
// (الحزمة 05 — FR-ED-03، DM-09)
//
// قاعدة الحزمة: الاختلاف الجديد كيان جديد دائما — معرّف جديد وفهرس تالٍ ضمن
// (قارئ × موضع) — لا استبدال ولا دمج تلقائي. والتنافي قرار المحرك وحده عبر
// مصفوفة الدمج والسياسات، وللمحرر تجاوزه بقرار موثق «متنافيان/مرتبطان».
//
// ملاحظة: «الصلة» في نص الحزمة حكم من الأصول (USUL) في هذا المستودع.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import { buildReadingCombinations } from '@/lib/tashjeer/combination-engine';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import {
  differencesAtPosition,
  locusPairKey,
  nextOccurrenceIndex,
  resolveOccurrenceIndices,
  sortDifferencesForLocus,
} from '@/lib/tashjeer/multi-difference';
import {
  locusRelationStatuses,
  manualLocusVerdictsFromLinks,
  resolveLocusExclusion,
} from '@/lib/tashjeer/decision/editor-bridge';
import { migrateDocumentToV8 } from '@/lib/tashjeer/migration/migrate-v7-v8';
import { buildExportBundle, importDocuments, loadDocument } from '@/lib/storage/document-store';
import type {
  TashjeerDocument,
  Variant,
  VariantAlternative,
  ViewFilter,
} from '@/types/tashjeer';

const AYAH_KEY = makeAyahKey(1, 2); // الحمد لله رب العالمين: أربع كلمات
const QALUN = 'narrator-qalun';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadStore() {
  const { useEditorStore } = await import('@/stores/editor-store');
  return useEditorStore;
}

function face(
  id: string,
  narratorIds: string[] = [QALUN],
  overrides: Partial<VariantAlternative> = {}
): VariantAlternative {
  return {
    id,
    text: id,
    label: id,
    scope: { kind: 'NARRATORS', narratorIds },
    ...overrides,
  };
}

function makeVariant(
  id: string,
  position: number,
  alternatives: VariantAlternative[],
  overrides: Partial<Variant> = {}
): Variant {
  return {
    id,
    ayahKey: AYAH_KEY,
    category: 'MADUD',
    title: id,
    startPosition: position,
    endPosition: position,
    status: 'DRAFT',
    alternatives,
    ...overrides,
  };
}

function maddPair(): Variant[] {
  return [
    makeVariant('madd-2', 2, [face('madd-2-f', [QALUN], { maddHarakat: 2 })], {
      title: 'مد حركتين',
    }),
    makeVariant('madd-4', 2, [face('madd-4-f', [QALUN], { maddHarakat: 4 })], {
      title: 'مد أربع',
    }),
  ];
}

const filter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

function openFreshDocument(): Promise<{ doc: () => TashjeerDocument }> {
  return loadStore().then((useEditorStore) => {
    useEditorStore.getState().openAyah(AYAH_KEY);
    return { doc: () => useEditorStore.getState().document! };
  });
}

// ==================== T1: فهرسة تابعة للموضع، لا استبدال ====================

describe('T1 — الاختلاف الجديد كيان جديد بفهرس تالٍ (DM-09)', () => {
  it('يمنح الموضع نفسه فهارس متتابعة، والموضع الآخر يبدأ من واحد', () => {
    const existing = [makeVariant('d1', 2, [face('d1-f')])];
    expect(nextOccurrenceIndex(existing, makeVariant('d2', 2, [face('d2-f')]))).toBe(2);
    expect(nextOccurrenceIndex(existing, makeVariant('d3', 3, [face('d3-f')]))).toBe(1);
  });

  it('addVariant مرتين للكلمة نفسها: فهرس 1 ثم 2 مع رسالة التعدد', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    useEditorStore.getState().addVariant({
      id: 't1-a',
      category: 'MADUD',
      title: 'أول',
      startPosition: 2,
      endPosition: 2,
      alternatives: [face('t1-a-f')],
      status: 'DRAFT',
    });
    useEditorStore.getState().addVariant({
      id: 't1-b',
      category: 'MADUD',
      title: 'ثانٍ',
      startPosition: 2,
      endPosition: 2,
      alternatives: [face('t1-b-f')],
      status: 'DRAFT',
    });

    const document = useEditorStore.getState().document!;
    expect(document.variants.find((v) => v.id === 't1-a')!.occurrenceIndex).toBe(1);
    expect(document.variants.find((v) => v.id === 't1-b')!.occurrenceIndex).toBe(2);
    const notice = useEditorStore.getState().lastMultiDifferenceNotice;
    expect(notice).not.toBeNull();
    expect(notice!.count).toBe(2);
    expect(notice!.variantIds).toContain('t1-a');
    expect(notice!.variantIds).toContain('t1-b');
  });

  it('حذف الثاني يُبقي الأول والثالث بمعرفيهما وفهرسيهما (لا إعادة ترقيم)', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    for (const id of ['t1d-1', 't1d-2', 't1d-3']) {
      useEditorStore.getState().addVariant({
        id,
        category: 'MADUD',
        title: id,
        startPosition: 2,
        endPosition: 2,
        alternatives: [face(`${id}-f`)],
        status: 'DRAFT',
      });
    }
    useEditorStore.getState().deleteVariant('t1d-2');

    const document = useEditorStore.getState().document!;
    expect(document.variants.find((v) => v.id === 't1d-1')!.occurrenceIndex).toBe(1);
    expect(document.variants.find((v) => v.id === 't1d-3')!.occurrenceIndex).toBe(3);
    expect(document.variants.find((v) => v.id === 't1d-2')).toBeUndefined();
  });

  it('ترتيب عرض الموضع: المحرك قبل المحرر، ثم الرتبة، ثم الفهرس', () => {
    const engine = makeVariant('ord-engine', 2, [face('ord-engine-f')], { origin: 'ENGINE' });
    const editorEarly = makeVariant('ord-editor-1', 2, [face('ord-editor-1-f')], { origin: 'EDITOR' });
    const editorLate = makeVariant('ord-editor-2', 2, [face('ord-editor-2-f')], {
      origin: 'EDITOR',
      orderRank: 9,
    });
    const indices = new Map([
      ['ord-engine', 3],
      ['ord-editor-1', 1],
      ['ord-editor-2', 2],
    ]);
    const ordered = sortDifferencesForLocus(
      [editorLate, editorEarly, engine],
      indices
    ).map((v) => v.id);
    // المحرك أولا رغم فهرسه الأعلى، ثم ذو الرتبة الصريحة، ثم غير المرتب —
    // كالترتيب العام الذي يقدّم الرتبة الصريحة دائما.
    expect(ordered).toEqual(['ord-engine', 'ord-editor-2', 'ord-editor-1']);
  });

  it('مفتاح الزوج مستقر لا يعتمد على ترتيب الطرفين', () => {
    expect(locusPairKey('a', 'b')).toBe(locusPairKey('b', 'a'));
    expect(locusPairKey('a', 'b')).toContain('a');
  });
});

// ==================== T2: التنافي قرار المحرك وحده ====================

describe('T2 — التنافي من مصفوفة الدمج والسياسات (لا من المحرر)', () => {
  it('مد + مد لنفس الراوي والموضع: متنافيان باقتراح السياسة', () => {
    const [madd2, madd4] = maddPair();
    const { decision } = resolveLocusExclusion(madd2, madd4);
    expect(decision.exclusive).toBe(true);
    expect(decision.reason).toBeTruthy();
  });

  it('فرش + مد: مستقلان (يُضربان معا)', () => {
    const madd = makeVariant('t2-madd', 2, [face('t2-madd-f')]);
    const farsh = makeVariant('t2-farsh', 2, [face('t2-farsh-f')], { category: 'FARSH' });
    const { decision } = resolveLocusExclusion(madd, farsh);
    expect(decision.exclusive).toBe(false);
  });

  it('حالات الموضع: متنافٍ افتراضيا، ومرتبط عند قرار يدوي', () => {
    const pair = maddPair();
    const plain = locusRelationStatuses(pair, undefined, []);
    expect(plain.get('madd-4')).toBe('EXCLUSIVE');
    const manual = locusRelationStatuses(pair, undefined, [
      { firstId: 'madd-2', secondId: 'madd-4', verdict: 'RELATED' },
    ]);
    expect(manual.get('madd-4')).toBe('RELATED');
    expect(manual.get('madd-2')).toBe('RELATED');
  });

  it('استخراج قرارات الروابط اليدوية من المستند', async () => {
    const useEditorStore = await loadStore();
    const { doc } = await openFreshDocument();
    for (const variant of maddPair()) {
      useEditorStore.getState().addVariant({
        id: variant.id,
        category: variant.category,
        title: variant.title,
        startPosition: variant.startPosition,
        endPosition: variant.endPosition,
        alternatives: variant.alternatives,
        status: 'DRAFT',
      });
    }
    useEditorStore.getState().setLocusRelation('madd-2', 'madd-4', 'EXCLUSIVE');
    const verdicts = manualLocusVerdictsFromLinks(doc().links ?? []);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]).toMatchObject({ firstId: 'madd-2', secondId: 'madd-4', verdict: 'EXCLUSIVE' });
  });
});

// ==================== T4: التركيب يحترم التنافي ====================

describe('T4 — سطور الراوي تحترم التنافي وتجمع المستقل', () => {
  const plan = () => buildReadingPlan(4, [], 'END_TO_START');

  it('مد ٢ + مد ٤: لا يجتمعان في تركيب واحد (لا يُضرَبان)', () => {
    const combinations = buildReadingCombinations(maddPair(), plan(), {
      engine: DEFAULT_ENGINE_SETTINGS,
    });
    const qalun = combinations.filter((combo) => combo.narratorIds.includes(QALUN));
    expect(qalun.length).toBeGreaterThan(0);
    for (const combo of qalun) {
      const picked = combo.picks.map((pick) => pick.variant.id);
      expect(picked.includes('madd-2') && picked.includes('madd-4')).toBe(false);
    }
  });

  it('مد + صلة (أصول) + فرش: تُطبَّق معا في سطر الراوي', () => {
    const variants = [
      makeVariant('t4-madd', 1, [face('t4-madd-f')]),
      makeVariant('t4-sila', 2, [face('t4-sila-f')], {
        category: 'USUL',
        title: 'صلة ميم الجمع',
      }),
      makeVariant('t4-farsh', 3, [face('t4-farsh-f')], { category: 'FARSH' }),
    ];
    const combinations = buildReadingCombinations(variants, plan(), {
      engine: DEFAULT_ENGINE_SETTINGS,
    });
    const qalun = combinations.filter((combo) => combo.narratorIds.includes(QALUN));
    expect(qalun).toHaveLength(1);
    expect(qalun[0].picks.map((pick) => pick.variant.id).sort()).toEqual(
      ['t4-farsh', 't4-madd', 't4-sila'].sort()
    );
  });

  it('مثال الكلمة × الراوي بأربعة اختلافات: مدّان متنافيان × فرش × أصل', () => {
    const variants = [
      ...maddPair(),
      makeVariant('xy-farsh', 2, [face('xy-farsh-f')], { category: 'FARSH' }),
      makeVariant('xy-usul', 2, [face('xy-usul-f')], { category: 'USUL' }),
    ];
    const combinations = buildReadingCombinations(variants, plan(), {
      engine: DEFAULT_ENGINE_SETTINGS,
    });
    const qalun = combinations.filter((combo) => combo.narratorIds.includes(QALUN));
    // تركيبان: (مد٢ + فرش + أصل) و(مد٤ + فرش + أصل).
    expect(qalun).toHaveLength(2);
    for (const combo of qalun) {
      const picked = combo.picks.map((pick) => pick.variant.id);
      expect(picked).toContain('xy-farsh');
      expect(picked).toContain('xy-usul');
      expect(picked.includes('madd-2') && picked.includes('madd-4')).toBe(false);
    }
  });

  it('قرار يدوي «مرتبطان» على المدّين يجمعهما في تركيب واحد', () => {
    const combinations = buildReadingCombinations(maddPair(), plan(), {
      engine: DEFAULT_ENGINE_SETTINGS,
      manualLocusRelations: [{ firstId: 'madd-2', secondId: 'madd-4', verdict: 'RELATED' }],
    });
    const qalun = combinations.filter((combo) => combo.narratorIds.includes(QALUN));
    expect(qalun).toHaveLength(1);
    expect(qalun[0].picks.map((pick) => pick.variant.id).sort()).toEqual(['madd-2', 'madd-4']);
  });

  it('قرار يدوي «متنافيان» على مد + فرش يفصل تركيبيهما', () => {
    const variants = [
      makeVariant('t4x-madd', 2, [face('t4x-madd-f')]),
      makeVariant('t4x-farsh', 2, [face('t4x-farsh-f')], { category: 'FARSH' }),
    ];
    const combinations = buildReadingCombinations(variants, plan(), {
      engine: DEFAULT_ENGINE_SETTINGS,
      manualLocusRelations: [{ firstId: 't4x-madd', secondId: 't4x-farsh', verdict: 'EXCLUSIVE' }],
    });
    const qalun = combinations.filter((combo) => combo.narratorIds.includes(QALUN));
    expect(qalun).toHaveLength(2);
    for (const combo of qalun) {
      const picked = combo.picks.map((pick) => pick.variant.id);
      expect(picked.includes('t4x-madd') && picked.includes('t4x-farsh')).toBe(false);
    }
  });

  it('التشجير الكلاسيكي يعلّم المدّين معا دون جمعهما في سطر', () => {
    const layout = layoutAyah(AYAH_KEY, getAyahWords(1, 2), DEFAULT_LAYOUT_OPTIONS);
    const classic = generateClassicTashjeer(maddPair(), layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: { ...DEFAULT_ENGINE_SETTINGS },
    });
    const marked = new Set(
      classic.lines.flatMap((line) => line.entries.map((entry) => entry.variantId))
    );
    expect(marked.has('madd-2')).toBe(true);
    expect(marked.has('madd-4')).toBe(true);
    for (const line of classic.lines) {
      const onLine = line.entries.map((entry) => entry.variantId);
      expect(onLine.includes('madd-2') && onLine.includes('madd-4')).toBe(false);
    }
  });
});

// ==================== التصحيح اليدوي يستمر موثقا ====================

describe('التصحيح اليدوي لعلاقة الموضع: رابط + سجل + ترحيل', () => {
  async function seedPair() {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    for (const variant of maddPair()) {
      useEditorStore.getState().addVariant({
        id: variant.id,
        category: variant.category,
        title: variant.title,
        startPosition: variant.startPosition,
        endPosition: variant.endPosition,
        alternatives: variant.alternatives,
        status: 'DRAFT',
      });
    }
    return useEditorStore;
  }

  it('setLocusRelation يسجّل الرابط وقراره مع سطر تصحيح في خطوة واحدة', async () => {
    const useEditorStore = await seedPair();
    const before = useEditorStore.getState().document!;
    const linkId = useEditorStore.getState().setLocusRelation(
      'madd-2',
      'madd-4',
      'EXCLUSIVE',
      'لا يجتمع الوجهان أداء'
    );
    expect(linkId).toBeTruthy();

    const document = useEditorStore.getState().document!;
    const link = document.links!.find((item) => item.id === linkId)!;
    expect(link.kind).toBe('DIFFERENCE_TO_DIFFERENCE');
    expect(link.locusVerdict).toBe('EXCLUSIVE');
    expect(link.relation).toBe('REFERENCE');
    const correction = document.editLog!.find(
      (entry) => entry.action === 'تصحيح علاقة التنافي' && entry.targetId === linkId
    )!;
    expect(correction).toBeDefined();
    const change = correction.changes!.find((item) => item.field === 'locusRelation')!;
    expect(change.before).toMatchObject({ verdict: 'EXCLUSIVE' });
    expect(change.after).toMatchObject({ verdict: 'EXCLUSIVE' });
    // إنشاء الرابط وسطر التصحيح خطوة تراجع واحدة: تاريخ خطوة واحدة زادت.
    expect(document.editLog!.length).toBe(before.editLog!.length + 2);
  });

  it('قلب القرار عبر updateLink يُلحِق تصحيحا جديدا ولا يمحو الأول', async () => {
    const useEditorStore = await seedPair();
    const linkId = useEditorStore.getState().setLocusRelation('madd-2', 'madd-4', 'RELATED')!;
    useEditorStore.getState().updateLink(linkId, {
      locusVerdict: 'EXCLUSIVE',
      relation: 'REFERENCE',
    });

    const document = useEditorStore.getState().document!;
    const corrections = document.editLog!.filter(
      (entry) => entry.action === 'تصحيح علاقة التنافي' && entry.targetId === linkId
    );
    expect(corrections).toHaveLength(2);
    const last = corrections[corrections.length - 1]!.changes!.find(
      (item) => item.field === 'locusRelation'
    )!;
    expect(last.after).toMatchObject({ verdict: 'EXCLUSIVE' });
    expect(document.links!.find((item) => item.id === linkId)!.locusVerdict).toBe('EXCLUSIVE');
  });

  it('إعادة القرار نفسه عملية خاملة لا تُكرِّر الرابط ولا السجل', async () => {
    const useEditorStore = await seedPair();
    const first = useEditorStore.getState().setLocusRelation('madd-2', 'madd-4', 'EXCLUSIVE')!;
    const linksBefore = useEditorStore.getState().document!.links!.length;
    const logBefore = useEditorStore.getState().document!.editLog!.length;
    const second = useEditorStore.getState().setLocusRelation('madd-4', 'madd-2', 'EXCLUSIVE');
    expect(second).toBe(first);
    expect(useEditorStore.getState().document!.links!.length).toBe(linksBefore);
    expect(useEditorStore.getState().document!.editLog!.length).toBe(logBefore);
  });

  it('differencesAtPosition يجمع اختلافَي الكلمة للواجهة', async () => {
    const useEditorStore = await seedPair();
    const document = useEditorStore.getState().document!;
    const atWord = differencesAtPosition(document.variants, 2);
    expect(atWord.map((v) => v.id).sort()).toEqual(['madd-2', 'madd-4']);
    const indices = resolveOccurrenceIndices(document.variants);
    expect(indices.get('madd-2')).toBe(1);
    expect(indices.get('madd-4')).toBe(2);
  });
});

// ==================== v8: تصدير مستقل واستدارة كاملة ====================

describe('v8 — اختلافات مستقلة بمعرف وفهرس، ذهابا وإيابا', () => {
  async function seedWithVerdict() {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    for (const variant of maddPair()) {
      useEditorStore.getState().addVariant({
        id: variant.id,
        category: variant.category,
        title: variant.title,
        startPosition: variant.startPosition,
        endPosition: variant.endPosition,
        alternatives: variant.alternatives,
        status: 'DRAFT',
      });
    }
    useEditorStore.getState().setLocusRelation('madd-2', 'madd-4', 'EXCLUSIVE');
    return useEditorStore.getState().document!;
  }

  it('التصدير: كل اختلاف بمعرفه وفهرسه وعلاقاته', async () => {
    const document = await seedWithVerdict();
    const v8 = migrateDocumentToV8(document);
    const second = v8.differences.find((diff) => diff.id === 'madd-2')!;
    const fourth = v8.differences.find((diff) => diff.id === 'madd-4')!;
    expect(second.occurrenceIndex).toBe(1);
    expect(fourth.occurrenceIndex).toBe(2);

    const relation = v8.relations.find((item) => item.type === 'MUTUALLY_EXCLUSIVE')!;
    expect(relation.fromId).toBe('DIFFERENCE:madd-2');
    expect(relation.toId).toBe('DIFFERENCE:madd-4');
    // العلاقة ملحقة بالاختلافين معا، لا بالأول وحده.
    expect(second.relations.map((item) => item.id)).toContain(relation.id);
    expect(fourth.relations.map((item) => item.id)).toContain(relation.id);

    const correction = v8.corrections.find((item) => item.targetId === relation.id)!;
    expect(correction).toBeDefined();
    expect(correction.finalResult).toMatchObject({ verdict: 'EXCLUSIVE' });
  });

  it('حزمة التصدير ثم الاستيراد: تُحفَظ المعرفات والفهارس والروابط', async () => {
    const document = await seedWithVerdict();
    const bundle = buildExportBundle([document], {
      exportedAt: '2026-09-13T00:00:00.000Z',
      includeDisplayOrder: false,
      engineConfig: null,
    });
    const v8doc = bundle.v8![0];
    expect(v8doc.differences.find((diff) => diff.id === 'madd-4')!.occurrenceIndex).toBe(2);

    const result = importDocuments(JSON.stringify(bundle), true);
    expect(result.errors).toHaveLength(0);
    const restored = loadDocument(AYAH_KEY)!;
    expect(restored.variants.find((v) => v.id === 'madd-2')!.occurrenceIndex).toBe(1);
    expect(restored.variants.find((v) => v.id === 'madd-4')!.occurrenceIndex).toBe(2);
    const link = restored.links!.find((item) => item.kind === 'DIFFERENCE_TO_DIFFERENCE')!;
    expect(link.locusVerdict).toBe('EXCLUSIVE');
  });
});

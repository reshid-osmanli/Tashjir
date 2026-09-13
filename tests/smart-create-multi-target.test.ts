// اختبارات الإنشاء متعدد الأهداف — Smart Create Multi-Target (FR-ED-09)
// مشروع التشجير - نظام القراءات العشر
//
// تحديد عدة كلمات وإسناد الاختلافات لها دفعة واحدة: البنية نفسها (أنواع +
// أوجه + علاقات) تُكرر لكل كلمة في عملية واحدة، والنتيجة كيانات مستقلة
// بمعرّف دفعة واحد — فيتراجع الكل بخطوة تراجع واحدة (T2 + T4).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';
import {
  buildSmartCreateBatch,
  buildSmartCreateMultiTargetBatch,
  mergeSelectionTargets,
  nextRangeClick,
  toggleWordTarget,
} from '@/lib/tashjeer/smart-create';

const AYAH_KEY = makeAyahKey(1, 4);

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

describe('تكرار البنية لكل هدف (FR-ED-09)', () => {
  it('أربع كلمات × نوع واحد = أربعة اختلافات مستقلة على كلماتها', () => {
    const result = buildSmartCreateMultiTargetBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 1, endPosition: 1 }],
      baseTitle: 'مد',
      types: ['MADUD'],
      scope: { kind: 'ALL' },
      targets: [
        [{ startPosition: 1, endPosition: 1 }],
        [{ startPosition: 2, endPosition: 2 }],
        [{ startPosition: 3, endPosition: 3 }],
        [{ startPosition: 4, endPosition: 4 }],
      ],
      titles: ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'],
    });

    expect(result.differences).toHaveLength(4);
    const ids = result.differences.map((d) => d.id);
    expect(new Set(ids).size).toBe(4);
    expect(result.differences.map((d) => d.locus.startPosition)).toEqual([1, 2, 3, 4]);
    // كل هدف عنوانه من نص كلمته لا من الأولى.
    expect(result.differences.map((d) => d.title)).toEqual([
      'الأولى — مد',
      'الثانية — مد',
      'الثالثة — مد',
      'الرابعة — مد',
    ]);
    // معرّف دفعة واحد للتتبع والتراجع الجماعي فقط.
    expect(result.differences.every((d) => d.createBatchId === result.batchId)).toBe(true);
  });

  it('العلاقات تُكرر داخل كل هدف ولا تعبر بين الأهداف', () => {
    const result = buildSmartCreateMultiTargetBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 1, endPosition: 1 }],
      baseTitle: 'مد',
      types: ['MADUD', 'USUL'],
      scope: { kind: 'ALL' },
      relations: [{ fromType: 'MADUD', toType: 'USUL', type: 'RELATED' }],
      targets: [[{ startPosition: 1, endPosition: 1 }], [{ startPosition: 5, endPosition: 5 }]],
    });

    expect(result.differences).toHaveLength(4);
    expect(result.relations).toHaveLength(2);
    // كل علاقة تربط مجموعتها وحدها: طرفاها على الموضع نفسه.
    for (const relation of result.relations) {
      const from = result.differences.find((d) => d.id === relation.fromId)!;
      const to = result.differences.find((d) => d.id === relation.toId)!;
      expect(from.locus.startPosition).toBe(to.locus.startPosition);
    }
    const loci = result.relations.map((relation) => {
      const from = result.differences.find((d) => d.id === relation.fromId)!;
      return from.locus.startPosition;
    });
    expect(loci.sort()).toEqual([1, 5]);
  });

  it('الأهداف الفارغة تُستبعد، وغيابها يعيد نتيجة فارغة', () => {
    const empty = buildSmartCreateMultiTargetBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 1, endPosition: 1 }],
      baseTitle: 'مد',
      types: ['MADUD'],
      scope: { kind: 'ALL' },
      targets: [[], [{ startPosition: 2, endPosition: 2 }]],
    });
    expect(empty.differences).toHaveLength(1);
    expect(empty.differences[0]!.locus.startPosition).toBe(2);

    const none = buildSmartCreateMultiTargetBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 1, endPosition: 1 }],
      baseTitle: 'مد',
      types: ['MADUD'],
      scope: { kind: 'ALL' },
      targets: [],
    });
    expect(none.differences).toHaveLength(0);
    expect(none.relations).toHaveLength(0);
  });
});

describe('السياق المستقل لكل نوع (الخطوة 7)', () => {
  it('يتجاوز السياق العام لذلك النوع وحده', () => {
    const { differences } = buildSmartCreateBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 2, endPosition: 2 }],
      baseTitle: 'مد',
      types: ['MADUD', 'WAQF'],
      scope: { kind: 'ALL' },
      context: 'ALWAYS',
      contextByType: { WAQF: 'WAQF_ONLY' },
    });
    expect(differences.find((d) => d.category === 'MADUD')!.context).toBe('ALWAYS');
    expect(differences.find((d) => d.category === 'WAQF')!.context).toBe('WAQF_ONLY');
  });
});

describe('درجة قوة الوجه مع الإنشاء (الخطوة 3)', () => {
  it('تُحفظ درجة القوة والنص المخصص على الوجه', () => {
    const { differences } = buildSmartCreateBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 2, endPosition: 2 }],
      baseTitle: 'مالك',
      types: ['MADUD'],
      scope: { kind: 'ALL' },
      variants: {
        MADUD: [{ label: 'بالألف', text: 'مٰالِكِ', strengthDegreeId: 'deg-strong', notes: 'ملاحظة' }],
      },
    });
    const face = differences[0]!.variants[1]!;
    expect(face.label).toBe('بالألف');
    expect(face.text).toBe('مٰالِكِ');
    expect(face.strengthDegreeId).toBe('deg-strong');
    expect(face.notes).toBe('ملاحظة');
  });
});

describe('آلة نقر المدى كلمة→كلمة (الخطوة 1 — اختبار منطقي)', () => {
  it('النقرة الأولى تثبت البداية غير مثبتة، والثانية تثبت المدى', () => {
    const first = nextRangeClick(null, 3);
    expect(first).toEqual({ start: 3, end: 3, pinned: false });
    const second = nextRangeClick(first, 6);
    expect(second).toEqual({ start: 3, end: 6, pinned: true });
  });

  it('النقرة الثانية قبل الأولى تُرتَّب تلقائيًا', () => {
    const first = nextRangeClick(null, 6);
    expect(nextRangeClick(first, 2)).toEqual({ start: 2, end: 6, pinned: true });
  });

  it('النقرة الثالثة بعد التثبيت تبدأ مدى جديدًا', () => {
    const pinned = nextRangeClick(nextRangeClick(null, 2), 5);
    expect(pinned.pinned).toBe(true);
    expect(nextRangeClick(pinned, 7)).toEqual({ start: 7, end: 7, pinned: false });
  });
});

describe('تبديل الأهداف بـ Ctrl+نقر (الخطوة 1 — اختبار منطقي)', () => {
  it('يضيف الهدف مرتبًا بموضعه ويزيله عند تكرار النقر', () => {
    let targets = toggleWordTarget([], 5);
    expect(targets).toEqual([{ startPosition: 5, endPosition: 5 }]);
    targets = toggleWordTarget(targets, 2);
    expect(targets.map((t) => t.startPosition)).toEqual([2, 5]);
    targets = toggleWordTarget(targets, 5);
    expect(targets.map((t) => t.startPosition)).toEqual([2]);
  });

  it('يدمج الرئيسي مع الإضافية مرتبة بلا تكرار', () => {
    const merged = mergeSelectionTargets(
      { startPosition: 4, endPosition: 6 },
      [
        { startPosition: 1, endPosition: 1 },
        { startPosition: 4, endPosition: 6 },
      ]
    );
    expect(merged).toEqual([
      { startPosition: 1, endPosition: 1 },
      { startPosition: 4, endPosition: 6 },
    ]);
  });
});

describe('تطبيق الدفعة متعددة الأهداف على المستند (FR-ED-09/T4)', () => {
  it('أربع كلمات ← أربعة اختلافات وعلاماتها، وتراجع واحد يزيلها كلها', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const beforeCount = useEditorStore.getState().document!.variants.length;
    const historyDepth = useEditorStore.getState().past.length;

    const batch = buildSmartCreateMultiTargetBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 1, endPosition: 1 }],
      baseTitle: 'مد',
      types: ['MADUD'],
      scope: { kind: 'ALL' },
      targets: [
        [{ startPosition: 1, endPosition: 1 }],
        [{ startPosition: 2, endPosition: 2 }],
        [{ startPosition: 3, endPosition: 3 }],
        [{ startPosition: 4, endPosition: 4 }],
      ],
      titles: ['ك١', 'ك٢', 'ك٣', 'ك٤'],
    });
    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    expect(document.variants.length).toBe(beforeCount + 4);
    for (const difference of batch.differences) {
      const created = document.variants.find((variant) => variant.id === difference.id);
      expect(created).toBeDefined();
      expect(created!.origin).toBe('EDITOR');
    }
    // خطوة تراجع واحدة رغم الكيانات الأربعة.
    expect(useEditorStore.getState().past.length).toBe(historyDepth + 1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document!.variants.length).toBe(beforeCount);
  });

  it('علاقات كل هدف تُنشأ بمعرّفات مجموعته', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    const batch = buildSmartCreateMultiTargetBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 1, endPosition: 1 }],
      baseTitle: 'مد',
      types: ['MADUD', 'USUL'],
      scope: { kind: 'ALL' },
      relations: [{ fromType: 'MADUD', toType: 'USUL', type: 'RELATED' }],
      targets: [[{ startPosition: 1, endPosition: 1 }], [{ startPosition: 3, endPosition: 3 }]],
    });
    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    expect(document.links?.length).toBe(2);
  });
});

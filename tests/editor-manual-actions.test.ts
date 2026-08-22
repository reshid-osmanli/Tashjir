// اختبارات إجراءات المحرر اليدوية - Editor Manual Actions Tests
//
// تحرس هذه الاختبارات دورة التصحيح اليدوي داخل مخزن المحرر نفسه:
// إنشاء العلاقات والأجزاء، تثبيت الترتيب اليدوي، وترسُّخ كل ذلك في سجل
// التعديل مع مصدره (EDITOR)، وقابلية التراجع.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';

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

describe('إجراءات التصحيح اليدوي', () => {
  it('إنشاء علاقة وجه بوجه يسجَّل في المستند وفي سجل التعديل معا', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().addLink({
      kind: 'FACE_TO_FACE',
      relation: 'MERGE',
      from: { type: 'FACE', id: 'v1::a1' },
      to: { type: 'FACE', id: 'v2::a2' },
      notes: 'وجهان متفقان',
    });

    const document = useEditorStore.getState().document!;
    expect(document.links).toHaveLength(1);
    expect(document.links![0].origin).toBe('EDITOR');
    expect(document.links![0].relation).toBe('MERGE');
    expect(useEditorStore.getState().isDirty).toBe(true);

    const entry = document.editLog?.[0];
    expect(entry?.targetType).toBe('FACE_LINK');
    expect(entry?.origin).toBe('EDITOR');
    expect(entry?.summary).toContain('دمج');
  });

  it('تعديل العلاقة وحذفها يسجَّلان ويؤثران على القائمة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().addLink({
      kind: 'LINE_TO_LINE',
      relation: 'MERGE',
      from: { type: 'LINE', id: 'combo::a' },
      to: { type: 'LINE', id: 'combo::b' },
    });
    const linkId = useEditorStore.getState().document!.links![0].id;

    useEditorStore.getState().updateLink(linkId, { relation: 'REFERENCE' });
    expect(useEditorStore.getState().document!.links![0].relation).toBe('REFERENCE');

    useEditorStore.getState().deleteLink(linkId);
    expect(useEditorStore.getState().document!.links).toHaveLength(0);
    // كل خطوة سجلت: إنشاء + تعديل + حذف.
    expect(useEditorStore.getState().document!.editLog).toHaveLength(3);
  });

  it('إنشاء جزء يربط بالكلمات المعلَّمة ويقبل رابطا لاحقا', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().toggleMarkedPosition(2);
    useEditorStore.getState().toggleMarkedPosition(3);

    const segment = useEditorStore.getState().addSegment({ title: 'صلة الهاء', startPosition: 2, endPosition: 3 });
    expect(segment).toBeDefined();
    expect(useEditorStore.getState().document!.segments).toHaveLength(1);

    useEditorStore.getState().addLink({
      kind: 'SEGMENT_TO_RULE',
      relation: 'MERGE',
      from: { type: 'SEGMENT', id: segment!.id },
      to: { type: 'RULE', id: 'variant-x' },
    });
    expect(useEditorStore.getState().document!.links).toHaveLength(1);

    // حذف الجزء يزيل روابطه فلا تبقى روابط معلقة.
    useEditorStore.getState().deleteSegment(segment!.id);
    expect(useEditorStore.getState().document!.segments).toHaveLength(0);
    expect(useEditorStore.getState().document!.links).toHaveLength(0);
  });

  it('تثبيت الترتيب اليدوي يسجَّل بالقيم قبل/بعد ويمكن التراجع عنه', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().setLineOrder(['combo::b', 'combo::a']);
    const document = useEditorStore.getState().document!;
    expect(document.lineOrder).toEqual(['combo::b', 'combo::a']);

    const entry = document.editLog?.[0];
    expect(entry?.targetType).toBe('LINE_ORDER');
    expect(entry?.changes?.[0]?.after).toEqual(['combo::b', 'combo::a']);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document!.lineOrder).toEqual([]);

    // إعادة الترتيب إلى المحرك تصفّر الترتيب وتسجَّل أيضا.
    useEditorStore.getState().setLineOrder(['combo::a']);
    useEditorStore.getState().resetLineOrder();
    expect(useEditorStore.getState().document!.lineOrder).toEqual([]);
  });

  it('تثبيت رقم ترتيب السطر من الخصائص يسجَّل في الاختلاف وفي السجل', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    const variantId = useEditorStore.getState().document!.variants[0]!.id;
    useEditorStore.getState().setEffectiveOrderRank(variantId, 3);

    const document = useEditorStore.getState().document!;
    const variant = document.variants.find((item) => item.id === variantId);
    expect(variant?.orderRank).toBe(3);
    expect(document.editLog?.some((entry) => entry.action === 'تعديل ترتيب الموضع')).toBe(true);

    useEditorStore.getState().setEffectiveOrderRank(variantId, null);
    expect(useEditorStore.getState().document!.variants.find((item) => item.id === variantId)?.orderRank).toBeUndefined();
  });

  it('ينسخ اختلافا كاملا بمعرّفات مستقلة ويمكن التراجع عن اللصق', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const original = useEditorStore.getState().document!.variants[0]!;
    const before = useEditorStore.getState().document!.variants.length;

    useEditorStore.getState().selectVariant(original.id);
    useEditorStore.getState().copySelection();
    useEditorStore.getState().pasteSelection();

    const after = useEditorStore.getState().document!;
    expect(after.variants).toHaveLength(before + 1);
    const copy = after.variants.find((item) => item.id !== original.id && item.title.includes('نسخة'))!;
    expect(copy.id).not.toBe(original.id);
    expect(copy.alternatives.map((item) => item.id)).not.toEqual(original.alternatives.map((item) => item.id));
    expect(copy.origin).toBe('EDITOR');

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document!.variants).toHaveLength(before);
  });

  it('ينسخ وجها وحده إلى اختلاف آخر من خلال سياق التحديد الموحد', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const owner = useEditorStore.getState().document!.variants[0]!;
    const face = owner.alternatives[0]!;
    const before = owner.alternatives.length;

    useEditorStore.getState().selectAlternative(owner.id, face.id);
    expect(useEditorStore.getState().selection?.kind).toBe('FACE');
    useEditorStore.getState().copySelection();
    useEditorStore.getState().selectVariant(owner.id);
    useEditorStore.getState().pasteSelection();

    const updated = useEditorStore.getState().document!.variants.find((item) => item.id === owner.id)!;
    expect(updated.alternatives).toHaveLength(before + 1);
    expect(updated.alternatives.at(-1)!.id).not.toBe(face.id);
  });

  it('إضافة اختلاف من المحرر توسم EDITOR وتسجَّل للتتبع', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    const before = useEditorStore.getState().document!.variants.length;
    useEditorStore.getState().addVariant({
      id: 'variant-manual-1',
      category: 'FARSH',
      title: 'إضافة يدوية للاختبار',
      startPosition: 1,
      endPosition: 1,
      alternatives: [
        {
          id: 'alt-1',
          text: 'وجه',
          label: 'وجه المحرر',
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
        },
      ],
      status: 'DRAFT',
    });

    const document = useEditorStore.getState().document!;
    expect(document.variants).toHaveLength(before + 1);
    // القائمة تُعاد فرزها بترتيب المرور، فنجد المضاف بمعرّفه.
    const added = document.variants.find((variant) => variant.id === 'variant-manual-1');
    expect(added?.origin).toBe('EDITOR');
    expect(document.editLog?.at(-1)?.summary).toContain('إضافة يدوية للاختبار');
  });
});

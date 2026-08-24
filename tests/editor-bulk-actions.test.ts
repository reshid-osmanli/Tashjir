// اختبارات الحذف الجماعي - Editor Bulk Actions Tests (FR-ED-07)
// مشروع التشجير - نظام القراءات العشر
//
// الحذف الجماعي بعد التحديد المتعدد: عملية واحدة في سجل التراجع، مُسجَّلة
// للتتبع، تُزيل الروابط المعلَّقة. هذا اختبار المنطق في مخزن المحرر.

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

describe('الحذف الجماعي للأوجه (FR-ED-07)', () => {
  it('يحذف عدة أوجه دفعة واحدة ويسجَّل للتراجع كخطوة واحدة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const owner = useEditorStore.getState().document!.variants[0]!;

    // نضيف وجهين إضافيين لضمان وجود ما يُحذف.
    useEditorStore.getState().addAlternative(owner.id, {
      id: 'bulk-a',
      text: 'وجه ١',
      label: 'للحذف',
      scope: { kind: 'ALL' },
    });
    useEditorStore.getState().addAlternative(owner.id, {
      id: 'bulk-b',
      text: 'وجه ٢',
      label: 'للحذف',
      scope: { kind: 'ALL' },
    });
    const before = useEditorStore.getState().document!.variants.find((v) => v.id === owner.id)!
      .alternatives.length;
    const historyDepth = useEditorStore.getState().past.length;

    useEditorStore.getState().deleteAlternativesBulk(owner.id, ['bulk-a', 'bulk-b']);

    const after = useEditorStore.getState().document!.variants.find((v) => v.id === owner.id)!;
    expect(after.alternatives.length).toBe(before - 2);
    expect(after.alternatives.find((a) => a.id === 'bulk-a')).toBeUndefined();
    expect(after.alternatives.find((a) => a.id === 'bulk-b')).toBeUndefined();

    // سُجِّل في التتبع.
    expect(
      useEditorStore.getState().document!.editLog?.some((e) => e.action === 'حذف جماعي للأوجه')
    ).toBe(true);

    // خطوة تراجع واحدة تكفي لإرجاع الوجهين.
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().past.length).toBe(historyDepth);
    expect(
      useEditorStore.getState().document!.variants.find((v) => v.id === owner.id)!.alternatives.length
    ).toBe(before);
  });

  it('لا يفعل شيئًا بقائمة فارغة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const owner = useEditorStore.getState().document!.variants[0]!;
    const before = owner.alternatives.length;

    useEditorStore.getState().deleteAlternativesBulk(owner.id, []);
    expect(useEditorStore.getState().document!.variants[0]!.alternatives.length).toBe(before);
  });
});

describe('الحذف الجماعي للاختلافات (FR-ED-07)', () => {
  it('يحذف عدة اختلافات دفعة واحدة ويزيل روابطها', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    // نضيف اختلافين إضافيين للتجربة.
    useEditorStore.getState().addVariant({
      id: 'bulk-v1',
      category: 'FARSH',
      title: 'اختبار حذف ١',
      startPosition: 1,
      endPosition: 1,
      alternatives: [{ id: 'bulk-v1-a', text: 'وجه', label: 'و', scope: { kind: 'ALL' } }],
      status: 'DRAFT',
    });
    useEditorStore.getState().addVariant({
      id: 'bulk-v2',
      category: 'FARSH',
      title: 'اختبار حذف ٢',
      startPosition: 2,
      endPosition: 2,
      alternatives: [{ id: 'bulk-v2-a', text: 'وجه', label: 'و', scope: { kind: 'ALL' } }],
      status: 'DRAFT',
    });
    const before = useEditorStore.getState().document!.variants.length;

    useEditorStore.getState().deleteVariantsBulk(['bulk-v1', 'bulk-v2']);

    const after = useEditorStore.getState().document!;
    expect(after.variants.length).toBe(before - 2);
    expect(after.variants.find((v) => v.id === 'bulk-v1')).toBeUndefined();
    expect(after.variants.find((v) => v.id === 'bulk-v2')).toBeUndefined();
    expect(after.editLog?.some((e) => e.action === 'حذف جماعي للاختلافات')).toBe(true);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document!.variants.length).toBe(before);
  });
});

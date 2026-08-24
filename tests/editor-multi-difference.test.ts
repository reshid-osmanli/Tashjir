// اختبارات تعدد الاختلافات لنفس القارئ والموضع - Multi-Difference (FR-ED-03، DM-09)
// مشروع التشجير - نظام القراءات العشر
//
// قاعدة P0: إضافة اختلاف ثاني لنفس القارئ والكلمة لا تغيّر الأول أو تحذفه،
// وتبقى الكيانات مستقلة قابلة للتعديل/الحذف كلٌّ على حدة. التنافي (مد ٢ ومد ٤
// لا يُضربان) يُحسم في المحرك، لا بإسقاط أحد الكيانين.

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

describe('تعدد الاختلافات لنفس القارئ والموضع (FR-ED-03، DM-09)', () => {
  it('إضافة اختلاف ثاني بنفس القارئ والكلمة لا يحذف الأول', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const before = useEditorStore.getState().document!.variants.length;

    useEditorStore.getState().addVariant({
      id: 'd-madd-a',
      category: 'MADUD',
      title: 'مد أول',
      startPosition: 1,
      endPosition: 1,
      alternatives: [
        { id: 'd-madd-a-f', text: 'مد', label: 'مد', scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] } },
      ],
      status: 'DRAFT',
    });
    useEditorStore.getState().addVariant({
      id: 'd-madd-b',
      category: 'MADUD',
      title: 'مد ثانٍ',
      startPosition: 1,
      endPosition: 1,
      alternatives: [
        { id: 'd-madd-b-f', text: 'مد', label: 'مد', scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] } },
      ],
      status: 'DRAFT',
    });

    const document = useEditorStore.getState().document!;
    expect(document.variants.length).toBe(before + 2);
    expect(document.variants.find((v) => v.id === 'd-madd-a')).toBeDefined();
    expect(document.variants.find((v) => v.id === 'd-madd-b')).toBeDefined();
  });

  it('حذف أحد الاختلافين لا يمسّ الآخر ولا بياناته', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    useEditorStore.getState().addVariant({
      id: 'd-keep',
      category: 'MADUD',
      title: 'يبقى',
      startPosition: 1,
      endPosition: 1,
      alternatives: [{ id: 'd-keep-f', text: 'مد', label: 'مد', scope: { kind: 'ALL' } }],
      status: 'DRAFT',
    });
    useEditorStore.getState().addVariant({
      id: 'd-drop',
      category: 'MADUD',
      title: 'يُحذف',
      startPosition: 1,
      endPosition: 1,
      alternatives: [{ id: 'd-drop-f', text: 'مد', label: 'مد', scope: { kind: 'ALL' } }],
      status: 'DRAFT',
    });

    useEditorStore.getState().deleteVariant('d-drop');

    const document = useEditorStore.getState().document!;
    expect(document.variants.find((v) => v.id === 'd-drop')).toBeUndefined();
    const kept = document.variants.find((v) => v.id === 'd-keep');
    expect(kept).toBeDefined();
    expect(kept!.alternatives).toHaveLength(1);
  });

  it('تعديل أحد الاختلافين لا يؤثر في الآخر', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    useEditorStore.getState().addVariant({
      id: 'd-a',
      category: 'MADUD',
      title: 'أ',
      startPosition: 1,
      endPosition: 1,
      alternatives: [{ id: 'd-a-f', text: 'مد', label: 'مد', scope: { kind: 'ALL' } }],
      status: 'DRAFT',
    });
    useEditorStore.getState().addVariant({
      id: 'd-b',
      category: 'MADUD',
      title: 'ب',
      startPosition: 1,
      endPosition: 1,
      alternatives: [{ id: 'd-b-f', text: 'مد', label: 'مد', scope: { kind: 'ALL' } }],
      status: 'DRAFT',
    });

    useEditorStore.getState().updateVariant('d-a', { title: 'أ — معدّل' });

    const document = useEditorStore.getState().document!;
    expect(document.variants.find((v) => v.id === 'd-a')!.title).toBe('أ — معدّل');
    expect(document.variants.find((v) => v.id === 'd-b')!.title).toBe('ب');
  });
});

// اختبارات تطبيق معالج الإنشاء الذكي على المستند — Smart Create Store (FR-ED-08)
// مشروع التشجير - نظام القراءات العشر
//
// «المعالج ينتج كيانات النموذج الموحّد فقط»: هذه الاختبارات تتحقق أن ناتج
// buildSmartCreateBatch يُطبّق على مستند المحرر في معاملة واحدة: اختلافات
// مستقلة + علاقات بمعرّفاتها + سياق الوقف/الوصل + تراجع واحد.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';
import { buildSmartCreateBatch } from '@/lib/tashjeer/smart-create';

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

function sampleBatch() {
  return buildSmartCreateBatch({
    ayahKey: AYAH_KEY,
    selection: [{ startPosition: 2, endPosition: 2 }],
    baseTitle: 'مالك',
    types: ['USUL', 'FARSH', 'MADUD'],
    scope: { kind: 'ALL' },
    context: 'WAQF_ONLY',
    relations: [
      { fromType: 'USUL', toType: 'MADUD', type: 'RELATED' },
      { fromType: 'MADUD', toType: 'FARSH', type: 'MUTUALLY_EXCLUSIVE' },
    ],
  });
}

describe('تطبيق معالج الإنشاء الذكي (FR-ED-08)', () => {
  it('يضيف اختلافات مستقلة بمعرّفاتها ورتبها وسياقها', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const batch = sampleBatch();

    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    for (const difference of batch.differences) {
      const created = document.variants.find((variant) => variant.id === difference.id);
      expect(created).toBeDefined();
      expect(created!.category).toBe(difference.category);
      expect(created!.origin).toBe('EDITOR');
      expect(created!.orderRank).toBe(difference.rank);
      expect(created!.recitationMode).toBe('WAQF_ONLY');
    }
  });

  it('ينشئ علاقات بين الأنواع بمعرّفاتها', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const batch = sampleBatch();

    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    expect(document.links?.length).toBe(2);
    const first = document.links![0]!;
    expect(first.kind).toBe('FACE_TO_FACE');
    expect(first.from.id.startsWith(`${batch.differences[0]!.id}::`)).toBe(true);
    expect(first.to.id.startsWith(`${batch.differences[2]!.id}::`)).toBe(true);
  });

  it('يسجّل عمليّة واحدة في سجل التتبع ويتراجع عنها دفعة واحدة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const batch = sampleBatch();
    const beforeCount = useEditorStore.getState().document!.variants.length;
    const historyDepth = useEditorStore.getState().past.length;

    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    expect(document.variants.length).toBe(beforeCount + batch.differences.length);
    expect(document.links?.length).toBe(2);
    expect(document.editLog?.some((entry) => entry.action === 'إنشاء مجموعة ذكية')).toBe(true);

    useEditorStore.getState().undo();
    const undone = useEditorStore.getState().document!;
    expect(undone.variants.length).toBe(beforeCount);
    expect(undone.links?.length ?? 0).toBe(0);
    expect(useEditorStore.getState().past.length).toBe(historyDepth);
  });

  it('لا يفعل شيئًا عند نتيجة فارغة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const before = useEditorStore.getState().document!;

    useEditorStore.getState().applySmartCreateBatch({ differences: [], relations: [], batchId: 'batch-x' });

    expect(useEditorStore.getState().document).toBe(before);
  });
});

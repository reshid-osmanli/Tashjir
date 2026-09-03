// اختبارات تكاملية لمعالج الإنشاء الذكي - Smart Create Wizard (FR-ED-08)
// مشروع التشجير - نظام القراءات العثر

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

describe('معالج الإنشاء الذكي (FR-ED-08)', () => {
  it('يولّد ٣ اختلافات مستقلة لـ ٣ أنواع بمعرّفات ورتب صريحة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    const before = useEditorStore.getState().document!.variants.length;
    const stamp = 'wiz-test-1';
    useEditorStore.getState().addVariantGroup([
      { ...variantFixture(`${stamp}-1`, 'USUL', 1, 1), orderRank: 1 },
      { ...variantFixture(`${stamp}-2`, 'FARSH', 1, 1), orderRank: 2 },
      { ...variantFixture(`${stamp}-3`, 'MADUD', 1, 1), orderRank: 3 },
    ]);

    const document = useEditorStore.getState().document!;
    const created = document.variants.filter((variant) => variant.id.startsWith(`v-${stamp}-`));
    expect(created).toHaveLength(3);
    // كل نوع له كيانه المستقل بمعرّف فريد (P-05)
    expect(new Set(created.map((v) => v.id)).size).toBe(3);
    // كل كيان يحتفظ بفئته (مهما كان ترتيب العرض، الفئات الثلاث كلها حاضرة)
    const categories = created.map((v) => v.category).sort();
    expect(categories).toEqual(['FARSH', 'MADUD', 'USUL']);
    // الرتب متتالية كما حددها المعالج (1، 2، 3 بدون فجوة)
    const ranks = created.map((v) => v.orderRank).sort();
    expect(ranks).toEqual([1, 2, 3]);
    // الحجم ازداد 3
    expect(document.variants.length).toBe(before + 3);
  });

  it('حذف أحد الأنواع لا يمس الباقي (P-05)', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().addVariantGroup([
      variantFixture('a-1', 'USUL', 1, 1),
      variantFixture('a-2', 'FARSH', 1, 1),
      variantFixture('a-3', 'MADUD', 1, 1),
    ]);
    useEditorStore.getState().deleteVariant('v-a-2');

    const document = useEditorStore.getState().document!;
    expect(document.variants.find((v) => v.id === 'v-a-2')).toBeUndefined();
    expect(document.variants.find((v) => v.id === 'v-a-1')).toBeDefined();
    expect(document.variants.find((v) => v.id === 'v-a-3')).toBeDefined();
  });

  it('سياق WAQF_ONLY يُحفظ على جميع الاختلافات المولّدة دفعة واحدة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().addVariantGroup([
      { ...variantFixture('ctx-1', 'FARSH', 1, 1), recitationMode: 'WAQF_ONLY' as const },
      { ...variantFixture('ctx-2', 'MADUD', 1, 1), recitationMode: 'WAQF_ONLY' as const },
    ]);

    const document = useEditorStore.getState().document!;
    const created = document.variants.filter((v) => v.id.startsWith('v-ctx-'));
    for (const variant of created) {
      expect(variant.recitationMode).toBe('WAQF_ONLY');
    }
  });
});

function variantFixture(stub: string, category: 'USUL' | 'FARSH' | 'MADUD', start: number, end: number) {
  return {
    id: `v-${stub}`,
    category,
    title: `fixture ${stub}`,
    startPosition: start,
    endPosition: end,
    status: 'DRAFT' as const,
    orderRank: Number(stub.split('-')[1] ?? 0),
    alternatives: [
      {
        id: `v-${stub}-base`,
        text: 'fixture',
        label: 'fixture',
        isBase: true,
        scope: { kind: 'ALL' as const },
      },
    ],
  };
}

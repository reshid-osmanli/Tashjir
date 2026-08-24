// اختبارات ممنوع الوصل على مستوى المحرر — Forbidden Wasl (FR-ED-11.3، DM-07)
// مشروع التشجير - نظام القراءات العشر
//
// قيد صلب: علامة ممنوع الوصل (NO_WASL) عند آخر الآية تمنع وصلها بالتالية. هذا
// اختبار السلوك الفعلي في مخزن المحرر (setLinkNextAyah)، لا فقط واجهة القرار.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
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

describe('ممنوع الوصل (FR-ED-11.3، DM-07)', () => {
  it('علامة NO_WASL عند آخر الآية ترفض الوصل بالتالية', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const document = useEditorStore.getState().document!;
    const endPosition = documentWindowWords({
      ...document,
      readingWindow: { ...(document.readingWindow ?? {}), linkNextAyah: false },
    }).length;

    useEditorStore.getState().addBoundary({ id: 'forbid', kind: 'NO_WASL', position: endPosition });
    useEditorStore.getState().setLinkNextAyah(true);

    expect(useEditorStore.getState().document!.readingWindow?.linkNextAyah).toBe(false);
  });

  it('إزالة العلامة تتيح الوصل مجددًا', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const document = useEditorStore.getState().document!;
    const endPosition = documentWindowWords({
      ...document,
      readingWindow: { ...(document.readingWindow ?? {}), linkNextAyah: false },
    }).length;

    useEditorStore.getState().addBoundary({ id: 'forbid', kind: 'NO_WASL', position: endPosition });
    useEditorStore.getState().setLinkNextAyah(true);
    expect(useEditorStore.getState().document!.readingWindow?.linkNextAyah).toBe(false);

    useEditorStore.getState().deleteBoundary('forbid');
    useEditorStore.getState().setLinkNextAyah(true);
    expect(useEditorStore.getState().document!.readingWindow?.linkNextAyah).toBe(true);
  });
});

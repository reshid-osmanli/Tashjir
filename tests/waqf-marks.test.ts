// اختبارات علامات الوقف والابتداء (DM-07، FR-ED-11).
// مشروع التشجير - نظام القراءات العشر
//
// قاعدة P0: علامة FORBIDDEN_WASL قيد صلب يمنع الوصل (لا اقتراح)، وأن
// نطاقات العرض المعزولة (RenderRange) تتيح بناء التشجير على جزء من الآية.

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

describe('علامات الوقف والابتداء (DM-07، FR-ED-11)', () => {
  it('addWaqfMark ينشئ علامة FORBIDDEN_WASL ويرفض الوصل اللاحق', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().addWaqfMark({
      kind: 'FORBIDDEN_WASL',
      position: 4, // منتصف آية الاختبار
      scope: 'INTERNAL',
    });

    const marks = useEditorStore.getState().document?.waqfMarks ?? [];
    expect(marks).toHaveLength(1);
    expect(marks[0].kind).toBe('FORBIDDEN_WASL');
    expect(marks[0].scope).toBe('INTERNAL');
    expect(marks[0].source).toBe('EDITOR');

    // الفحص المركزي: الوصل عبر هذا الموضع ممنوع
    expect(useEditorStore.getState().isConnectionForbidden(1, 4)).toBe(true);
    expect(useEditorStore.getState().isConnectionForbidden(5, 8)).toBe(false);
  });

  it('FORBIDDEN_WASL يكسر الوصل التلقائي بين آخر الآية والتي تليها', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    // فعّل الوصل أولا
    useEditorStore.getState().setLinkNextAyah(true);
    expect(useEditorStore.getState().document?.readingWindow?.linkNextAyah).toBe(true);

    // ثم ضع علامة ممنوع وصل في آخر موضع من الآية (طول النص)
    useEditorStore.getState().addWaqfMark({
      kind: 'FORBIDDEN_WASL',
      position: 100, // موضع نهائي افتراضي للآية
      scope: 'END_OF_AYAH',
      connectsToNextAyah: true,
    });

    expect(useEditorStore.getState().document?.readingWindow?.linkNextAyah).toBe(false);
  });

  it('حذف العلامة يسمح بالوصلة من جديد', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().addWaqfMark({
      kind: 'FORBIDDEN_WASL',
      position: 3,
      scope: 'INTERNAL',
    });
    const markId = useEditorStore.getState().document!.waqfMarks![0].id;
    useEditorStore.getState().deleteWaqfMark(markId);

    expect(useEditorStore.getState().document?.waqfMarks).toHaveLength(0);
    expect(useEditorStore.getState().isConnectionForbidden(1, 3)).toBe(false);
  });

  it('addRenderRange يعزل نطاقا معينا للعرض (FR-ED-11.2)', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().addRenderRange({
      fromPosition: 1,
      toPosition: 5,
      reason: 'WAQF_INTERNAL',
    });

    const ranges = useEditorStore.getState().document?.renderRanges ?? [];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].fromPosition).toBe(1);
    expect(ranges[0].toPosition).toBe(5);
    expect(ranges[0].reason).toBe('WAQF_INTERNAL');
  });

  it('addRenderRange يستبدل النطاقات السابقة من نفس السبب', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    useEditorStore.getState().addRenderRange({
      fromPosition: 1, toPosition: 3, reason: 'WAQF_INTERNAL',
    });
    useEditorStore.getState().addRenderRange({
      fromPosition: 4, toPosition: 7, reason: 'WAQF_INTERNAL',
    });

    // استُبدل السابق، فلم يبق إلا الأحدث من نفس السبب.
    const ranges = useEditorStore.getState().document?.renderRanges ?? [];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].fromPosition).toBe(4);
    expect(ranges[0].toPosition).toBe(7);
  });
});

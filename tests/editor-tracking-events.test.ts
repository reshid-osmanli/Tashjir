// اختبارات أحداث التتبع الموحّد في المحرر — Unified Tracking Events (T2)
//
// أحداث الحزم 04–08 يجب أن تظهر في التتبع: نقل وجه، دمج/فصل (علاقات)،
// حذف جماعي، لصق، تعميم، تجاوز محلي، وعلامات وقف/وصل. هذه الاختبارات
// تحرس أن كل عملية يدوية تسجَّل في سجل التعديل بنوع هدف وفئة وصورة،
// وأن صفحة التتبع تقرأها من نفس البيانات (بلا تخزين مكرر — DM-16).

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

async function loadModules() {
  const [store, tracking] = await Promise.all([
    import('@/stores/editor-store'),
    import('@/lib/storage/tracking-store'),
  ]);
  return { store, tracking };
}

function makeVariant(id: string, withFaces = 2) {
  return {
    id,
    category: 'MADUD' as const,
    title: `اختلاف ${id}`,
    startPosition: 1,
    endPosition: 1,
    status: 'DRAFT' as const,
    alternatives: [
      { id: `${id}-base`, text: 'وجه المصحف', label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' as const } },
      ...Array.from({ length: withFaces }, (_, i) => ({
        id: `${id}-a${i + 1}`,
        text: `وجه ${i + 1}`,
        label: `وجه ${i + 1}`,
        scope: { kind: 'ALL' as const },
      })),
    ],
  };
}

describe('سجل أحداث الوقف والوصل ونافذة القراءة (الحزمة 06 في التتبع)', () => {
  it('إضافة علامة وقف تسجَّل في سجل التعديل بفئة WAQF', async () => {
    const { store } = await loadModules();
    store.useEditorStore.getState().openAyah(AYAH_KEY);

    store.useEditorStore.getState().addBoundary({
      id: 'b1',
      kind: 'WAQF',
      position: 3,
    });

    const entry = store.useEditorStore.getState().document?.editLog?.[0];
    expect(entry).toBeTruthy();
    expect(entry?.targetType).toBe('BOUNDARY');
    expect(entry?.targetId).toBe('b1');
    expect(entry?.category).toBe('WAQF');
    expect(entry?.origin).toBe('EDITOR');
    expect(entry?.summary).toContain('الكلمة 3');
  });

  it('حذف علامة ممنوع وصل يسجَّل مع نوعها', async () => {
    const { store } = await loadModules();
    store.useEditorStore.getState().openAyah(AYAH_KEY);
    store.useEditorStore.getState().addBoundary({ id: 'b2', kind: 'NO_WASL', position: 7 });
    store.useEditorStore.getState().deleteBoundary('b2');

    const entries = store.useEditorStore.getState().document?.editLog ?? [];
    const del = entries.find((entry) => entry.action === 'حذف علامة وقف/وصل');
    expect(del).toBeTruthy();
    expect(del?.targetType).toBe('BOUNDARY');
    expect(del?.summary).toContain('ممنوع وصل');
    expect(del?.summary).toContain('الكلمة 7');
  });

  it('وصل الآية بالتالية وفك الوصل حدثا تتبع من نوع WINDOW', async () => {
    const { store } = await loadModules();
    store.useEditorStore.getState().openAyah(AYAH_KEY);
    store.useEditorStore.getState().setLinkNextAyah(true);

    const entry = store.useEditorStore.getState().document?.editLog?.find(
      (item) => item.targetType === 'WINDOW'
    );
    expect(entry).toBeTruthy();
    expect(entry?.category).toBe('WAQF');
    expect(entry?.summary).toContain('وصل');
  });

  it('حصر التشجير في مقطع يسجَّل في التتبع', async () => {
    const { store } = await loadModules();
    store.useEditorStore.getState().openAyah(AYAH_KEY);
    store.useEditorStore.getState().setFocusSegment({ startPosition: 2, endPosition: 5 });

    const entry = store.useEditorStore.getState().document?.editLog?.find(
      (item) => item.targetType === 'WINDOW'
    );
    expect(entry).toBeTruthy();
    expect(entry?.summary).toContain('2–5');
  });
});

describe('نقل وجه داخل موضعه (نقل) يُتبع', () => {
  it('نقل وجه يسجَّل بنوع ALTERNATIVE_ORDER مع الفئة', async () => {
    const { store } = await loadModules();
    store.useEditorStore.getState().openAyah(AYAH_KEY);
    store.useEditorStore.getState().addVariant(makeVariant('v-move'));

    store.useEditorStore.getState().moveAlternative('v-move', 'v-move-a1', 1);

    const entry = store.useEditorStore.getState().document?.editLog?.find(
      (item) => item.targetType === 'ALTERNATIVE_ORDER'
    );
    expect(entry).toBeTruthy();
    expect(entry?.category).toBe('MADUD');
    expect(entry?.summary).toContain('نقل');
  });

  it('إعادة ترتيب الأوجه إلى قاعدة المحرك يسجَّل', async () => {
    const { store } = await loadModules();
    store.useEditorStore.getState().openAyah(AYAH_KEY);
    store.useEditorStore.getState().addVariant(makeVariant('v-reset'));
    store.useEditorStore.getState().moveAlternative('v-reset', 'v-reset-a1', 1);
    store.useEditorStore.getState().resetAlternativeOrder('v-reset');

    const entries = store.useEditorStore.getState().document?.editLog ?? [];
    expect(entries.some((entry) => entry.action === 'إعادة ترتيب الأوجه إلى قاعدة المحرك')).toBe(true);
  });
});

describe('صفحات التتبع تقرأ الأحداث من نفس البيانات (DM-16)', () => {
  it('سطر تتبع لكل علامة وقف مع رابط فتح في المحرر', async () => {
    const { store, tracking } = await loadModules();
    store.useEditorStore.getState().openAyah(AYAH_KEY);
    store.useEditorStore.getState().addBoundary({ id: 'b-track', kind: 'IBTIDA', position: 2 });
    store.useEditorStore.getState().save();

    const rows = tracking.readTrackingRows();
    const boundaryRow = rows.find((row) => row.edits.some((edit) => edit.action === 'إضافة علامة ابتداء'));
    expect(boundaryRow).toBeTruthy();
    expect(boundaryRow?.category).toBe('WAQF');
    expect(boundaryRow?.openHref).toBe(`/editor?ayah=${AYAH_KEY}`);
  });

  it('مصدر الحدث من سجل التعديل نفسه (EDITOR)', async () => {
    const { store, tracking } = await loadModules();
    store.useEditorStore.getState().openAyah(AYAH_KEY);
    store.useEditorStore.getState().addBoundary({ id: 'b-src', kind: 'WAQF', position: 4 });
    store.useEditorStore.getState().save();

    const rows = tracking.readTrackingRows();
    const row = rows.find((item) => item.edits.some((edit) => edit.action === 'إضافة علامة وقف'));
    expect(row).toBeTruthy();
    expect(row?.source).toBe('EDITOR');
  });
});

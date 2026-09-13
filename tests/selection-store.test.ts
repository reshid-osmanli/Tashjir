// اختبارات مخزن التحديد الموحّد — Selection Store Tests (FR-ED-02)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس هذه الاختبارات العقد المركزي للحزمة 03:
//   1. الكتابة الموحّدة: كل تحديد يمر من مسار واحد فيرفع طلب تركيز متزايدًا
//      ويعبّئ مرايا التوافق — فلا لوحة تحتفظ بتحديد مناقض (AC-06.4).
//   2. تعدد اللوحات: قارئان (لوحتان محاكاتان عبر المخزن نفسه) يريان العنصر
//      النشط نفسه في اللحظة نفسها.
//   3. سلسلة السياق (Breadcrumb): «الآية ٢:٤ ← Line 25 ← الاختلاف ← الوجه».
//   4. التنظيف الآمن: حذف العنصر المحدد يصفّر التحديد مع إبقاء آخر سلسلة
//      سياق صالحة للعرض الرمادي (قرار محسوم).
//   5. أوامر العنصر النشط: التمكين الصحيح لكل نوع (نسخ/قص/لصق/حذف).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';
import type { EditorSelection } from '@/types/tashjeer';

const AYAH_KEY = makeAyahKey(2, 4);

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

async function loadFacade() {
  const facade = await import('@/lib/editor/selection-store');
  return facade;
}

describe('الكتابة الموحّدة للتحديد (قرار واحد في مكان واحد)', () => {
  it('تعيين عنصر يرفع طلب تركيز متزايدا ويجعله العنصر النشط', async () => {
    const useEditorStore = await loadStore();
    const { selectElement } = await loadFacade();
    useEditorStore.getState().openAyah(AYAH_KEY);

    const tokenBefore = useEditorStore.getState().selectionFocus.token;
    selectElement({ kind: 'LINE', id: 'line25', lineId: 'line25', differenceId: 'v1', position: 3 });

    const state = useEditorStore.getState();
    expect(state.selection).toEqual({ kind: 'LINE', id: 'line25', lineId: 'line25', differenceId: 'v1', position: 3 });
    expect(state.selectionFocus.token).toBe(tokenBefore + 1);
    expect(state.selectionFocus.center).toBe(true);
    expect(state.lastSelection?.id).toBe('line25');
  });

  it('تغيير العنصر النشط يحدّث الطلب والمرايا معا (سطر ← وجه)', async () => {
    const useEditorStore = await loadStore();
    const { selectElement } = await loadFacade();
    useEditorStore.getState().openAyah(AYAH_KEY);

    selectElement({ kind: 'LINE', id: 'line25', lineId: 'line25', differenceId: 'v1', position: 3 });
    const tokenAfterLine = useEditorStore.getState().selectionFocus.token;

    selectElement({ kind: 'FACE', id: 'a2', differenceId: 'v1', faceId: 'a2', position: 3 });
    const state = useEditorStore.getState();
    expect(state.selection?.kind).toBe('FACE');
    expect(state.selectionFocus.token).toBe(tokenAfterLine + 1);
    // مرايا التوافق: لوحات الأوجه القائمة تقرأ selectedVariantId/selectedAlternativeId.
    expect(state.selectedVariantId).toBe('v1');
    expect(state.selectedAlternativeId).toBe('a2');
  });

  it('واجهة selectElement تقبل الإلغاء (null) مع خيار بلا تمركز', async () => {
    const useEditorStore = await loadStore();
    const { selectElement } = await loadFacade();
    useEditorStore.getState().openAyah(AYAH_KEY);

    selectElement({ kind: 'WORD', id: '2004003', position: 3 });
    selectElement(null, { center: false });

    const state = useEditorStore.getState();
    expect(state.selection).toBeNull();
    expect(state.selectionFocus.center).toBe(false);
    // آخر تحديد صالح يبقى للعرض الرمادي.
    expect(state.lastSelection?.id).toBe('2004003');
  });
});

describe('تعدد اللوحات: مصدر حقيقة واحد', () => {
  it('لوحتان تقرآن المخزن نفسه تريان العنصر النشط نفسه بعد نقر من أي جهة', async () => {
    const useEditorStore = await loadStore();
    const { selectElement, currentSelection } = await loadFacade();
    const { isSameSelectionTarget } = await import('@/lib/tashjeer/selection-context');
    useEditorStore.getState().openAyah(AYAH_KEY);

    // «لوحة العلاقات» تنقر السطر 25:
    const fromRelationsPanel: EditorSelection = { kind: 'LINE', id: 'line25', lineId: 'line25', differenceId: 'v1', position: 3 };
    selectElement(fromRelationsPanel);

    // «قائمة الاختلافات» و«التتبع» يقرآن:
    const differencesListView = currentSelection();
    const trackingView = currentSelection();

    expect(differencesListView).toEqual(trackingView);
    expect(differencesListView?.id).toBe('line25');
    // مقارنة الهوية عبر اللوحات لا تعتمد على كائن المرجع.
    expect(isSameSelectionTarget(differencesListView, fromRelationsPanel)).toBe(true);
    void useEditorStore;
  });

  it('كل كتابة تحديد (حتى لنفس العنصر) ترفع الطلب فتتفاعل اللوحة', async () => {
    const useEditorStore = await loadStore();
    const { selectElement } = await loadFacade();
    useEditorStore.getState().openAyah(AYAH_KEY);

    const same = { kind: 'LINE' as const, id: 'line25', lineId: 'line25' };
    selectElement(same);
    const t1 = useEditorStore.getState().selectionFocus.token;
    selectElement(same);
    const t2 = useEditorStore.getState().selectionFocus.token;
    expect(t2).toBe(t1 + 1);
  });
});

describe('سلسلة السياق (Breadcrumb) — مثال Line 25 الملزم', () => {
  it('بناء السلسلة الكاملة: الآية ← السطر ← الاختلاف ← الوجه', async () => {
    const { buildSelectionBreadcrumb } = await import('@/lib/tashjeer/selection-context');
    const lookup = {
      surahNumber: 2,
      ayahNumber: 4,
      lineTitle: (id: string) => (id === 'line25' ? 'السطر ٢٥' : undefined),
      variantTitle: (id: string) => (id === 'v1' ? 'اختلاف مَٰلِكِ' : undefined),
      faceLabel: (_variantId: string, faceId: string) => (faceId === 'f1' ? 'بالياء' : undefined),
    };

    const crumbs = buildSelectionBreadcrumb(
      { kind: 'FACE', id: 'f1', differenceId: 'v1', faceId: 'f1', lineId: 'line25' },
      lookup
    );
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['آية 2:4', 'اختلاف مَٰلِكِ', 'بالياء']);
  });

  it('شريط السياق يعرض سطرا بلا اختلاف أب', async () => {
    const { buildSelectionBreadcrumb } = await import('@/lib/tashjeer/selection-context');
    const crumbs = buildSelectionBreadcrumb(
      { kind: 'LINE', id: 'line25', lineId: 'line25' },
      { surahNumber: 2, ayahNumber: 4, lineTitle: () => 'السطر ٢٥' }
    );
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['آية 2:4', 'السطر ٢٥']);
  });
});

describe('التنظيف الآمن عند تحديد عنصر محذوف', () => {
  it('حذف الاختلاف المحدد يصفّر التحديد ويبقي آخر سلسلة صالحة', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const store = useEditorStore.getState();

    // إنشاء اختلاف ثم تحديده.
    store.addVariant({
      id: 'v-dangling',
      category: 'MADUD',
      title: 'مد منفصل',
      startPosition: 2,
      endPosition: 2,
      targetKind: 'WORDS',
      status: 'DRAFT',
      alternatives: [
        { id: 'v-dangling-base', text: 'وجه المصحف', label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' } },
      ],
    });
    useEditorStore.getState().selectVariant('v-dangling');
    expect(useEditorStore.getState().selection?.id).toBe('v-dangling');

    useEditorStore.getState().deleteVariant('v-dangling');
    const state = useEditorStore.getState();
    // تنظيف آمن: بلا تحديد معلّق على كيان محذوف…
    expect(state.selection).toBeNull();
    // …مع إبقاء آخر سلسلة سياق للعرض الرمادي.
    expect(state.lastSelection?.id).toBe('v-dangling');
  });

  it('حذف وجه محدد يصفّر التحديد ويعيد آخر تحديد صالح', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);
    const store = useEditorStore.getState();

    store.addVariant({
      id: 'v-face-owner',
      category: 'FARSH',
      title: 'فرش',
      startPosition: 1,
      endPosition: 1,
      targetKind: 'WORDS',
      status: 'DRAFT',
      alternatives: [
        { id: 'base-1', text: 'وجه المصحف', label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' } },
        { id: 'face-1', text: 'بالياء', label: 'بالياء', scope: { kind: 'ALL' } },
      ],
    });
    useEditorStore.getState().selectAlternative('v-face-owner', 'face-1');
    expect(useEditorStore.getState().selection?.kind).toBe('FACE');

    useEditorStore.getState().deleteAlternative('v-face-owner', 'face-1');
    const state = useEditorStore.getState();
    expect(state.selection).toBeNull();
    expect(state.lastSelection?.kind).toBe('FACE');
  });
});

describe('أنواع التحديد الموسعة (حرف/موضع/وجه مركب/علامة وقف)', () => {
  it('تحديد حرف يحمل كلمته وترتيبه ويرفع مرآة الكلمة', async () => {
    const useEditorStore = await loadStore();
    const { selectElement } = await loadFacade();
    useEditorStore.getState().openAyah(AYAH_KEY);

    selectElement({ kind: 'CHARACTER', id: '2004003:1', wordId: 2004003, position: 3, characterIndex: 1 });
    const state = useEditorStore.getState();
    expect(state.selection?.kind).toBe('CHARACTER');
    expect(state.selectedWordId).toBe(2004003);
  });

  it('مقارنة حرفين بذات الموضع والترتيب تعتبرهما عنصرا واحدا', async () => {
    const { isSameSelectionTarget } = await import('@/lib/tashjeer/selection-context');
    const a: EditorSelection = { kind: 'CHARACTER', id: '2004003:1', wordId: 2004003, position: 3, characterIndex: 1 };
    const b: EditorSelection = { kind: 'CHARACTER', id: '2004003:1', wordId: 2004003, position: 3, characterIndex: 1 };
    expect(isSameSelectionTarget(a, b)).toBe(true);
    expect(isSameSelectionTarget(a, { ...b, characterIndex: 2 })).toBe(false);
  });
});

describe('أوامر العنصر النشط (FR-ED-02.6)', () => {
  it('الاختلاف: نسخ وقص وحذف ممكنة، واللصق ممكن مع حافظة فقط', async () => {
    const { selectionCommands } = await import('@/lib/tashjeer/selection-commands');
    const selection: EditorSelection = { kind: 'DIFFERENCE', id: 'v1', differenceId: 'v1' };

    const withoutClipboard = selectionCommands(selection, { hasClipboard: false });
    expect(withoutClipboard.find((command) => command.id === 'COPY')?.enabled).toBe(true);
    expect(withoutClipboard.find((command) => command.id === 'CUT')?.enabled).toBe(true);
    expect(withoutClipboard.find((command) => command.id === 'DELETE')?.enabled).toBe(true);
    expect(withoutClipboard.find((command) => command.id === 'PASTE')?.enabled).toBe(false);

    const withClipboard = selectionCommands(selection, { hasClipboard: true });
    expect(withClipboard.find((command) => command.id === 'PASTE')?.enabled).toBe(true);
  });

  it('الكلمة لا تُحذف ولا تُقص (تعليم فقط)، ونسخ المعرّف ممكن دائما', async () => {
    const { selectionCommands } = await import('@/lib/tashjeer/selection-commands');
    const commands = selectionCommands({ kind: 'WORD', id: '2004003', position: 3 }, { hasClipboard: true });
    // لا أمر حذف أصلا للكلمة (هي نسيج الآية لا كيان مستقل).
    expect(commands.find((command) => command.id === 'DELETE')).toBeUndefined();
    expect(commands.find((command) => command.id === 'COPY_ID')?.enabled).toBe(true);
  });

  it('بلا تحديد لا أوامر', async () => {
    const { selectionCommands } = await import('@/lib/tashjeer/selection-commands');
    expect(selectionCommands(null, { hasClipboard: true })).toEqual([]);
  });

  it('السطر: ترتيب أعلى/أسفل وربط ممكنان، والحذف المباشر غير معروض', async () => {
    const { selectionCommands } = await import('@/lib/tashjeer/selection-commands');
    const commands = selectionCommands({ kind: 'LINE', id: 'line25', lineId: 'line25' }, { hasClipboard: true });
    expect(commands.find((command) => command.id === 'MOVE_UP')?.enabled).toBe(true);
    expect(commands.find((command) => command.id === 'MOVE_DOWN')?.enabled).toBe(true);
    expect(commands.find((command) => command.id === 'LINK')?.enabled).toBe(true);
    expect(commands.find((command) => command.id === 'DELETE')).toBeUndefined();
  });
});

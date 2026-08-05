// حالة المحرر - Editor Store
// مشروع التشجير - نظام القراءات العشر
//
// هذا المخزن يحمل حالة المحرر كاملة: المستند المفتوح، والتحديد، والعرض،
// وتاريخ التراجع والإعادة.
//
// مبدأ التصميم:
//   التراجع (Undo) يعمل على المستند نفسه، لا على حالة الواجهة.
//   أي تعديل حقيقي (إضافة اختلاف، حذف وجه، تحريك خط) يُسجَّل لقطة كاملة
//   للمستند قبل التعديل. أما تغيير التكبير أو فتح لوحة، فلا يُسجَّل،
//   لأن المستخدم لا يتوقع أن يتراجع زر التراجع عن تكبير الشاشة.
//
// إعادة توليد الخطوط:
//   بعد أي تعديل على الاختلافات، تُعاد الخطوط تلقائيا عبر recomputeBranches،
//   مع الحفاظ على الخطوط التي عدّلها المستخدم يدويا (isManual).

import { create } from 'zustand';
import type { VariantCategory } from '@/types';
import type {
  ManualTashjeerLine,
  RecitationBoundary,
  TashjeerBranch,
  TashjeerDocument,
  Variant,
  VariantAlternative,
  VerificationStatus,
  ViewFilter,
} from '@/types/tashjeer';
import { getAyahWordsByKey, parseAyahKey } from '@/data/quran';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateBranches } from '@/lib/tashjeer/branch-engine';
import { readTransmissionCatalog } from '@/lib/transmissions/catalog';
import { readEngineSettings } from '@/lib/tashjeer/engine-settings';
import {
  createDocument,
  loadOrCreateDocument,
  saveDocument,
} from '@/lib/storage/document-store';

/** أدوات المحرر المتاحة في شريط الأدوات. */
export type EditorTool =
  /** تحديد وتفحص */
  | 'select'
  /** تعليم كلمات لإنشاء اختلاف جديد */
  | 'mark'
  /** حذف عنصر بالنقر عليه */
  | 'erase';

/** الحد الأقصى للقطات التراجع، لتفادي استهلاك الذاكرة. */
const MAX_HISTORY = 60;

/** التصفية الافتراضية: كل الفئات ظاهرة. */
const DEFAULT_FILTER: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

interface EditorState {
  // ---------- المستند ----------
  /** المستند المفتوح حاليا، أو null قبل التحميل */
  document: TashjeerDocument | null;
  /** هل توجد تعديلات غير محفوظة */
  isDirty: boolean;
  /** لقطات التراجع */
  past: TashjeerDocument[];
  /** لقطات الإعادة */
  future: TashjeerDocument[];

  // ---------- العرض ----------
  zoom: number;
  pan: { x: number; y: number };
  filter: ViewFilter;
  showPropertiesPanel: boolean;
  showVariantsPanel: boolean;

  // ---------- التحديد ----------
  /** الكلمات المعلّمة استعدادا لإنشاء اختلاف */
  markedPositions: number[];
  selectedWordId: number | null;
  selectedVariantId: string | null;
  selectedBranchId: string | null;
  currentTool: EditorTool;
  /** الفئة المستخدمة عند إنشاء اختلاف جديد */
  draftCategory: VariantCategory;

  // ---------- إجراءات المستند ----------
  openAyah: (ayahKey: number) => void;
  resetAyah: () => void;
  save: () => void;
  setDocumentStatus: (status: VerificationStatus) => void;
  replaceDocument: (document: TashjeerDocument) => void;

  // ---------- إجراءات الاختلافات ----------
  addVariant: (variant: Omit<Variant, 'ayahKey'>) => void;
  updateVariant: (variantId: string, patch: Partial<Variant>) => void;
  deleteVariant: (variantId: string) => void;
  addAlternative: (variantId: string, alternative: VariantAlternative) => void;
  updateAlternative: (
    variantId: string,
    alternativeId: string,
    patch: Partial<VariantAlternative>
  ) => void;
  deleteAlternative: (variantId: string, alternativeId: string) => void;
  /** يثبّت رتبة الموضع في ترتيب المرور، أو يزيلها بتمرير null. */
  setVariantOrderRank: (variantId: string, rank: number | null) => void;
  /** ينقل وجها داخل موضعه صعودا أو نزولا، فيثبّت ترتيب أوجه الموضع. */
  moveAlternative: (variantId: string, alternativeId: string, delta: number) => void;
  /** يعيد ترتيب أوجه الموضع إلى قاعدة المحرك. */
  resetAlternativeOrder: (variantId: string) => void;

  // ---------- إجراءات الخطوط ----------
  regenerateBranches: () => void;
  /** يعيد حساب الناتج المشتق بعد تغيير الكتالوج أو إعداد المحرك بلا سجل تراجع. */
  refreshDerivedBranches: () => void;
  toggleBranchVisibility: (branchId: string) => void;
  moveBranchLane: (branchId: string, delta: number) => void;
  setBranchLane: (branchId: string, lane: number) => void;
  setBranchRowOffset: (branchId: string, rowOffset: number) => void;
  resetBranchPosition: (branchId: string) => void;
  addManualLine: (line: ManualTashjeerLine) => void;
  updateManualLine: (lineId: string, patch: Partial<ManualTashjeerLine>) => void;
  deleteManualLine: (lineId: string) => void;

  // ---------- الوقف والابتداء وتخطيط النص ----------
  addBoundary: (boundary: RecitationBoundary) => void;
  updateBoundary: (boundaryId: string, patch: Partial<RecitationBoundary>) => void;
  deleteBoundary: (boundaryId: string) => void;
  toggleForcedLineBreak: (position: number) => void;
  setLineOffset: (lineIndex: number, offset: number) => void;

  // ---------- إجراءات التحديد ----------
  toggleMarkedPosition: (position: number) => void;
  clearMarks: () => void;
  selectWord: (wordId: number | null) => void;
  selectVariant: (variantId: string | null) => void;
  selectBranch: (branchId: string | null) => void;
  setTool: (tool: EditorTool) => void;
  setDraftCategory: (category: VariantCategory) => void;

  // ---------- إجراءات العرض ----------
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
  setFilter: (patch: Partial<ViewFilter>) => void;
  toggleCategory: (category: VariantCategory) => void;
  toggleNarrator: (narratorId: string) => void;
  togglePropertiesPanel: () => void;
  toggleVariantsPanel: () => void;

  // ---------- التراجع ----------
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: null,
  isDirty: false,
  past: [],
  future: [],

  zoom: 1,
  pan: { x: 0, y: 0 },
  filter: { ...DEFAULT_FILTER },
  showPropertiesPanel: true,
  showVariantsPanel: true,

  markedPositions: [],
  selectedWordId: null,
  selectedVariantId: null,
  selectedBranchId: null,
  currentTool: 'select',
  draftCategory: 'FARSH',

  // ==================== المستند ====================

  openAyah: (ayahKey) => {
    const document = loadOrCreateDocument(ayahKey);
    const withBranches = withRegeneratedBranches(document);

    set({
      document: withBranches,
      isDirty: false,
      past: [],
      future: [],
      markedPositions: [],
      selectedWordId: null,
      selectedVariantId: null,
      selectedBranchId: null,
    });
  },

  resetAyah: () => {
    const current = get().document;
    if (!current) return;

    const fresh = withRegeneratedBranches(createDocument(current.ayahKey, current.meta.author));
    set((state) => ({
      past: pushHistory(state.past, current),
      future: [],
      document: fresh,
      isDirty: true,
      markedPositions: [],
      selectedVariantId: null,
      selectedBranchId: null,
    }));
  },

  save: () => {
    const current = get().document;
    if (!current) return;

    // لا نعتمد على الخطوط المخزنة من جلسة سابقة أو من ملف مستورد؛ فهي ناتج
    // مشتق من الاختلافات وقد تكون قديمة. إعادة بنائها هنا تجعل ما يُحفظ هو
    // بالضبط ما سيظهر عند فتح الآية مرة أخرى.
    const normalized = withRegeneratedBranches(current);
    set({ document: saveDocument(normalized), isDirty: false });
  },

  setDocumentStatus: (status) => {
    mutate(set, get, (document) => ({
      ...document,
      meta: { ...document.meta, status },
    }));
  },

  replaceDocument: (document) => {
    set((state) => ({
      past: state.document ? pushHistory(state.past, state.document) : state.past,
      future: [],
      document: withRegeneratedBranches(document),
      isDirty: true,
    }));
  },

  // ==================== الاختلافات ====================

  addVariant: (variant) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: [...document.variants, { ...variant, ayahKey: document.ayahKey }].sort(
        compareVariants
      ),
    }));
    set({ markedPositions: [] });
  },

  updateVariant: (variantId, patch) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants
        .map((variant) => (variant.id === variantId ? { ...variant, ...patch } : variant))
        .sort(compareVariants),
    }));
  },

  deleteVariant: (variantId) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.filter((variant) => variant.id !== variantId),
      // الخطوط التابعة للاختلاف المحذوف تُزال معه.
      branches: document.branches.filter((branch) => branch.variantId !== variantId),
    }));
    set({ selectedVariantId: null });
  },

  addAlternative: (variantId, alternative) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.map((variant) =>
        variant.id === variantId
          ? { ...variant, alternatives: [...variant.alternatives, alternative] }
          : variant
      ),
    }));
  },

  updateAlternative: (variantId, alternativeId, patch) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.map((variant) => {
        if (variant.id !== variantId) return variant;
        return {
          ...variant,
          alternatives: variant.alternatives.map((alternative) =>
            alternative.id === alternativeId ? { ...alternative, ...patch } : alternative
          ),
        };
      }),
    }));
  },

  deleteAlternative: (variantId, alternativeId) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.map((variant) => {
        if (variant.id !== variantId) return variant;
        return {
          ...variant,
          alternatives: variant.alternatives.filter(
            (alternative) => alternative.id !== alternativeId
          ),
        };
      }),
      branches: document.branches.filter((branch) => branch.alternativeId !== alternativeId),
    }));
  },

  setVariantOrderRank: (variantId, rank) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.map((variant) =>
        variant.id === variantId
          ? { ...variant, orderRank: rank === null ? undefined : Math.max(1, Math.round(rank)) }
          : variant
      ),
    }));
  },

  moveAlternative: (variantId, alternativeId, delta) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.map((variant) => {
        if (variant.id !== variantId) return variant;

        // نبني الترتيب الصريح من الترتيب الظاهر الآن، ثم ننقل الوجه فيه.
        // هكذا لا يقفز بقية الأوجه عند أول نقلة يدوية.
        const current = orderedAlternativeIds(variant);
        const index = current.indexOf(alternativeId);
        if (index === -1) return variant;

        const target = index + delta;
        if (target < 0 || target >= current.length) return variant;

        const next = [...current];
        [next[index], next[target]] = [next[target], next[index]];
        return { ...variant, alternativeOrder: next };
      }),
    }));
  },

  resetAlternativeOrder: (variantId) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.map((variant) =>
        variant.id === variantId ? { ...variant, alternativeOrder: undefined } : variant
      ),
    }));
  },

  // ==================== الخطوط ====================

  regenerateBranches: () => {
    mutate(set, get, (document) => ({
      ...document,
      // إعادة توليد كاملة: تُلغى التعديلات اليدوية عمدا.
      branches: computeBranches(document, []),
    }));
  },

  refreshDerivedBranches: () => {
    const document = get().document;
    if (!document) return;
    // لا نسجل عملية اشتقاق في التراجع ولا نعلّم المستند «غير محفوظ»: لا
    // تتغير بيانات الوجه، بل تتغير طريقة تحويلها إلى خطوط بسبب كتالوج جديد.
    set({ document: withRegeneratedBranches(document) });
  },

  toggleBranchVisibility: (branchId) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId ? { ...branch, isHidden: !branch.isHidden } : branch
      ),
    }));
  },

  moveBranchLane: (branchId, delta) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId
          ? { ...branch, lane: Math.max(0, branch.lane + delta), isManual: true }
          : branch
      ),
    }));
  },

  setBranchLane: (branchId, lane) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId
          ? { ...branch, lane: Math.max(0, Math.round(lane)), isManual: true }
          : branch
      ),
    }));
  },

  setBranchRowOffset: (branchId, rowOffset) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId
          ? { ...branch, rowOffset: Math.round(rowOffset), isManual: true }
          : branch
      ),
    }));
  },

  resetBranchPosition: (branchId) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId
          ? { ...branch, lane: 0, rowOffset: undefined, isManual: false }
          : branch
      ),
    }));
  },

  addManualLine: (line) => {
    mutate(set, get, (document) => ({
      ...document,
      manualLines: [...document.manualLines, line],
    }));
  },

  updateManualLine: (lineId, patch) => {
    mutate(set, get, (document) => ({
      ...document,
      manualLines: document.manualLines.map((line) =>
        line.id === lineId ? { ...line, ...patch } : line
      ),
    }));
  },

  deleteManualLine: (lineId) => {
    mutate(set, get, (document) => ({
      ...document,
      manualLines: document.manualLines.filter((line) => line.id !== lineId),
    }));
  },

  // ==================== الوقف والابتداء وتخطيط النص ====================

  addBoundary: (boundary) => {
    mutate(set, get, (document) => ({
      ...document,
      boundaries: [...document.boundaries, boundary].sort((first, second) => first.position - second.position),
    }));
  },

  updateBoundary: (boundaryId, patch) => {
    mutate(set, get, (document) => ({
      ...document,
      boundaries: document.boundaries
        .map((boundary) => (boundary.id === boundaryId ? { ...boundary, ...patch } : boundary))
        .sort((first, second) => first.position - second.position),
    }));
  },

  deleteBoundary: (boundaryId) => {
    mutate(set, get, (document) => ({
      ...document,
      boundaries: document.boundaries.filter((boundary) => boundary.id !== boundaryId),
    }));
  },

  toggleForcedLineBreak: (position) => {
    mutate(set, get, (document) => {
      const forcedLineBreakAfter = document.layout.forcedLineBreakAfter.includes(position)
        ? document.layout.forcedLineBreakAfter.filter((item) => item !== position)
        : [...document.layout.forcedLineBreakAfter, position].sort((first, second) => first - second);
      return { ...document, layout: { ...document.layout, forcedLineBreakAfter } };
    });
  },

  setLineOffset: (lineIndex, offset) => {
    mutate(set, get, (document) => ({
      ...document,
      layout: {
        ...document.layout,
        lineOffsets: { ...document.layout.lineOffsets, [lineIndex]: Math.round(offset) },
      },
    }));
  },

  // ==================== التحديد ====================

  toggleMarkedPosition: (position) => {
    set((state) => {
      const exists = state.markedPositions.includes(position);
      const next = exists
        ? state.markedPositions.filter((item) => item !== position)
        : [...state.markedPositions, position];

      return { markedPositions: next.sort((a, b) => a - b) };
    });
  },

  clearMarks: () => set({ markedPositions: [] }),
  selectWord: (wordId) => set({ selectedWordId: wordId }),
  selectVariant: (variantId) => set({ selectedVariantId: variantId, selectedBranchId: null }),
  selectBranch: (branchId) => set({ selectedBranchId: branchId }),
  setTool: (tool) => set({ currentTool: tool, markedPositions: tool === 'mark' ? get().markedPositions : [] }),
  setDraftCategory: (category) => set({ draftCategory: category }),

  // ==================== العرض ====================

  setZoom: (zoom) => set({ zoom: clamp(zoom, 0.4, 3) }),
  zoomIn: () => set((state) => ({ zoom: clamp(state.zoom * 1.15, 0.4, 3) })),
  zoomOut: () => set((state) => ({ zoom: clamp(state.zoom / 1.15, 0.4, 3) })),
  setPan: (pan) => set({ pan }),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),

  setFilter: (patch) => set((state) => ({ filter: { ...state.filter, ...patch } })),

  toggleCategory: (category) => {
    set((state) => {
      const exists = state.filter.categories.includes(category);
      return {
        filter: {
          ...state.filter,
          categories: exists
            ? state.filter.categories.filter((item) => item !== category)
            : [...state.filter.categories, category],
        },
      };
    });
  },

  toggleNarrator: (narratorId) => {
    set((state) => {
      const exists = state.filter.narratorIds.includes(narratorId);
      return {
        filter: {
          ...state.filter,
          narratorIds: exists
            ? state.filter.narratorIds.filter((item) => item !== narratorId)
            : [...state.filter.narratorIds, narratorId],
        },
      };
    });
  },

  togglePropertiesPanel: () =>
    set((state) => ({ showPropertiesPanel: !state.showPropertiesPanel })),
  toggleVariantsPanel: () => set((state) => ({ showVariantsPanel: !state.showVariantsPanel })),

  // ==================== التراجع ====================

  undo: () => {
    const { past, document } = get();
    if (past.length === 0 || !document) return;

    set({
      document: past[past.length - 1],
      past: past.slice(0, -1),
      future: [document, ...get().future].slice(0, MAX_HISTORY),
      isDirty: true,
    });
  },

  redo: () => {
    const { future, document } = get();
    if (future.length === 0 || !document) return;

    set({
      document: future[0],
      future: future.slice(1),
      past: pushHistory(get().past, document),
      isDirty: true,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

// ==================== دوال داخلية ====================

/**
 * يطبّق تعديلا على المستند مع تسجيل لقطة تراجع وإعادة توليد الخطوط.
 *
 * @param updater دالة تُرجع النسخة الجديدة من المستند
 */
function mutate(
  set: (partial: Partial<EditorState>) => void,
  get: () => EditorState,
  updater: (document: TashjeerDocument) => TashjeerDocument
): void {
  const state = get();
  const current = state.document;
  if (!current) return;

  const next = withRegeneratedBranches(updater(current));

  set({
    past: pushHistory(state.past, current),
    future: [],
    document: next,
    isDirty: true,
  });
}

/** يعيد توليد الخطوط مع الحفاظ على التعديلات اليدوية. */
function withRegeneratedBranches(document: TashjeerDocument): TashjeerDocument {
  return { ...document, branches: computeBranches(document, document.branches) };
}

/** يحسب خطوط المستند اعتمادا على تخطيط الآية الحالي. */
function computeBranches(
  document: TashjeerDocument,
  existing: TashjeerBranch[]
): TashjeerBranch[] {
  const words = getAyahWordsByKey(document.ayahKey);
  if (words.length === 0) return existing;

  const layout = layoutAyah(document.ayahKey, words, document.layout);
  const engine = readEngineSettings();
  return generateBranches(document.variants, layout, existing, {
    catalog: readTransmissionCatalog(),
    traversal: engine.traversal,
    boundaries: document.boundaries,
    wordsCount: words.length,
  });
}

/**
 * ترتيب معرّفات أوجه موضع: الترتيب الصريح المحفوظ إن وُجد، وإلا ترتيب
 * الإدخال. نستثني وجه الأساس لأنه نص المصحف ولا يُرسم له سطر.
 */
function orderedAlternativeIds(variant: Variant): string[] {
  const drawable = variant.alternatives.filter((alternative) => !alternative.isBase);
  const explicit = variant.alternativeOrder ?? [];
  const known = new Set(drawable.map((alternative) => alternative.id));

  const ordered = explicit.filter((id) => known.has(id));
  for (const alternative of drawable) {
    if (!ordered.includes(alternative.id)) ordered.push(alternative.id);
  }
  return ordered;
}

/** ترتيب الاختلافات: من آخر الآية إلى أولها، موافقا لقاعدة التشجير. */
function compareVariants(a: Variant, b: Variant): number {
  // ارتكاز التشجير الصحيح هو آخر كلمة في المدى عند السير من آخر الآية.
  // استخدام startPosition هنا كان يقلب ترتيب اختلاف يمتد على أكثر من كلمة.
  if (a.endPosition !== b.endPosition) return b.endPosition - a.endPosition;
  if (a.startPosition !== b.startPosition) return b.startPosition - a.startPosition;
  return a.title.localeCompare(b.title, 'ar');
}

function pushHistory(past: TashjeerDocument[], document: TashjeerDocument): TashjeerDocument[] {
  return [...past, document].slice(-MAX_HISTORY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** أداة مساعدة للواجهة: معرّف السورة والآية من المستند المفتوح. */
export function getOpenAyahInfo(document: TashjeerDocument | null): {
  surahNumber: number;
  ayahNumber: number;
} | null {
  if (!document) return null;
  return parseAyahKey(document.ayahKey);
}

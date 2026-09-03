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
import {
  faceEndpointKey,
  type ManualTashjeerLine,
  type RecitationBoundary,
  type CharacterAnchor,
  type EditorSelection,
  type LinkEndpoint,
  type TashjeerBranch,
  type TashjeerDocument,
  type TashjeerLink,
  type TashjeerLinkKind,
  type TashjeerLinkRelation,
  type LineSegment,
  type Variant,
  type VariantAlternative,
  type VerificationStatus,
  type ViewFilter,
} from '@/types/tashjeer';
import { parseAyahKey } from '@/data/quran';
import type { SmartCreateResult } from '@/lib/tashjeer/smart-create';
import { relationTypeToLinkRelation } from '@/lib/tashjeer/model/v8';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateBranches } from '@/lib/tashjeer/branch-engine';
import { getEffectiveVariants, matchFromDerivedVariant } from '@/lib/quran-logic/global-rule-engine';
import { readTransmissionCatalog } from '@/lib/transmissions/catalog';
import { readEngineSettings } from '@/lib/tashjeer/engine-settings';
import { moveLineToIndex } from '@/lib/tashjeer/manual-links';
import { setOccurrenceOrderRank } from '@/lib/storage/rule-occurrences-store';
import {
  appendEditLog,
  createDocument,
  loadOrCreateDocument,
  makeEditEntry,
  saveDocument,
} from '@/lib/storage/document-store';

/** أدوات المحرر المتاحة في شريط الأدوات. */
/** نمط التعليم داخل أداة التعليم: كلمة كاملة أو حرف مرئي مع تشكيله. */
export type MarkingMode = 'WORDS' | 'CHARACTERS';

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
  /** الحروف المعلّمة عند اختيار نمط الحروف. */
  markedCharacters: CharacterAnchor[];
  /** هل ينشئ التعليم اختلاف كلمات أم اختلاف حروف. */
  markingMode: MarkingMode;
  /** المصدر الوحيد للتحديد بين المحرر وكل اللوحات. */
  selection: EditorSelection | null;
  selectedWordId: number | null;
  selectedVariantId: string | null;
  selectedAlternativeId: string | null;
  selectedBranchId: string | null;
  clipboard: { kind: 'DIFFERENCE'; value: Variant } | { kind: 'FACE'; value: VariantAlternative } | { kind: 'SEGMENT'; value: LineSegment } | null;
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
  /** إنشاء عدة اختلافات مستقلة في معاملة واحدة ولقطة تراجع واحدة. */
  addVariantGroup: (variants: Array<Omit<Variant, 'ayahKey'>>) => void;
  /**
   * يطبّق ناتج المعالج الذكي (FR-ED-08) على المستند في معاملة واحدة:
   * كل نوع كيان مستقل، وعلاقاته تُنشأ بمعرّفاتها، وكل ذلك خطوة تراجع واحدة.
   */
  applySmartCreateBatch: (result: SmartCreateResult) => void;
  updateVariant: (variantId: string, patch: Partial<Variant>) => void;
  deleteVariant: (variantId: string) => void;
  addAlternative: (variantId: string, alternative: VariantAlternative) => void;
  updateAlternative: (
    variantId: string,
    alternativeId: string,
    patch: Partial<VariantAlternative>
  ) => void;
  deleteAlternative: (variantId: string, alternativeId: string) => void;
  /** يحذف عدة أوجه من اختلاف واحد دفعة واحدة (قابلة للتراجع كخطوة واحدة). */
  deleteAlternativesBulk: (variantId: string, alternativeIds: string[]) => void;
  /** يحذف عدة اختلافات دفعة واحدة (قابلة للتراجع كخطوة واحدة). */
  deleteVariantsBulk: (variantIds: string[]) => void;
  /** يثبّت رتبة الموضع في ترتيب المرور، أو يزيلها بتمرير null. */
  setVariantOrderRank: (variantId: string, rank: number | null) => void;
  /**
   * يثبّت رقم ترتيب السطر لأي اختلاف ظاهر: المحفوظ في الآية، أو المشتق من
   * قاعدة عامة (تخصيص موضعي يسبق رتبة القاعدة). هذا هو مدخل لوحة الخصائص.
   */
  setEffectiveOrderRank: (variantId: string, rank: number | null) => void;
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

  // ---------- الروابط والأجزاء والترتيب اليدوي (تصحيح المحرك) ----------
  /** ينشئ علاقة يدوية بين عنصرين: وجهين، سطرين، أو جزء وسطر/قاعدة. */
  addLink: (link: {
    kind: TashjeerLinkKind;
    relation: TashjeerLinkRelation;
    from: LinkEndpoint;
    to: LinkEndpoint;
    notes?: string;
  }) => void;
  updateLink: (linkId: string, patch: Partial<Pick<TashjeerLink, 'relation' | 'notes' | 'from' | 'to'>>) => void;
  deleteLink: (linkId: string) => void;
  /** ينشئ جزءا من سطر: مدى كلمات/حروف له روابطه وقواعده الخاصة. */
  addSegment: (segment: {
    title: string;
    startPosition: number;
    endPosition: number;
    characterRange?: LineSegment['characterRange'];
    notes?: string;
  }) => LineSegment | undefined;
  updateSegment: (segmentId: string, patch: Partial<Pick<LineSegment, 'title' | 'startPosition' | 'endPosition' | 'notes'>>) => void;
  deleteSegment: (segmentId: string) => void;
  /** يثبّت ترتيب أسطر العرض يدويا (لقطة كاملة بترتيب المحرر). */
  setLineOrder: (order: string[]) => void;
  /** ينقل سطرا إلى موضع جديد بإزاحة المتأثرين، انطلاقا من لقطة الترتيب الحالية. */
  moveLineInOrder: (currentLineIds: string[], lineId: string, targetIndex: number) => void;
  /** يعيد الترتيب إلى قاعدة المحرك. */
  resetLineOrder: () => void;

  // ---------- الوقف والابتداء وتخطيط النص ----------
  addBoundary: (boundary: RecitationBoundary) => void;
  updateBoundary: (boundaryId: string, patch: Partial<RecitationBoundary>) => void;
  deleteBoundary: (boundaryId: string) => void;
  toggleForcedLineBreak: (position: number) => void;
  /** وصل الآية بالتي بعدها في نافذة عمل واحدة، أو فك الوصل. */
  setLinkNextAyah: (linked: boolean) => void;
  /** حصر التشجير في مقطع محدد، أو إلغاء الحصر بتمرير null. */
  setFocusSegment: (segment: { startPosition: number; endPosition: number } | null) => void;
  setLineOffset: (lineIndex: number, offset: number) => void;

  // ---------- إجراءات التحديد ----------
  toggleMarkedPosition: (position: number) => void;
  toggleMarkedCharacter: (anchor: CharacterAnchor) => void;
  clearMarks: () => void;
  setMarkingMode: (mode: MarkingMode) => void;
  selectWord: (wordId: number | null) => void;
  selectVariant: (variantId: string | null) => void;
  selectAlternative: (variantId: string, alternativeId: string) => void;
  selectSegment: (segmentId: string | null) => void;
  selectLine: (lineId: string, differenceId?: string, position?: number) => void;
  selectBranch: (branchId: string | null) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: () => void;
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
  markedCharacters: [],
  markingMode: 'WORDS',
  selection: null,
  selectedWordId: null,
  selectedVariantId: null,
  selectedAlternativeId: null,
  selectedBranchId: null,
  clipboard: null,
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
      markedCharacters: [],
      selection: null,
      selectedWordId: null,
      selectedVariantId: null,
      selectedAlternativeId: null,
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
      markedCharacters: [],
      selection: null,
      selectedVariantId: null,
      selectedAlternativeId: null,
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
    mutate(
      set,
      get,
      (document) => ({
        ...document,
        variants: [
          ...document.variants,
          { ...variant, ayahKey: document.ayahKey, origin: 'EDITOR' as const },
        ].sort(compareVariants),
      }),
      {
        action: 'إضافة اختلاف',
        targetType: 'VARIANT',
        targetId: variant.id,
        category: variant.category,
        summary: `أضاف المحرر اختلاف «${variant.title}» (${variant.startPosition}–${variant.endPosition})`,
      }
    );
    set({ markedPositions: [], markedCharacters: [] });
  },

  addVariantGroup: (variants) => {
    if (variants.length === 0) return;
    mutate(
      set,
      get,
      (document) => ({
        ...document,
        variants: [
          ...document.variants,
          ...variants.map((variant) => ({
            ...variant,
            ayahKey: document.ayahKey,
            origin: 'EDITOR' as const,
          })),
        ].sort(compareVariants),
      }),
      {
        action: 'إنشاء مجموعة اختلافات',
        targetType: 'VARIANT',
        targetId: variants.map((item) => item.id).join(','),
        summary: `أنشأ المحرر ${variants.length} اختلافات مستقلة في عملية واحدة`,
      }
    );
    set({ markedPositions: [], markedCharacters: [] });
  },

  applySmartCreateBatch: (result) => {
    if (result.differences.length === 0 || !get().document) return;

    mutate(set, get, (document) => {
      const variants: Variant[] = result.differences.map((difference) => {
        const hasCharacters = Boolean(
          difference.locus.characterRange || difference.locus.loci?.some((locus) => locus.characterRange)
        );
        const characterRange =
          difference.locus.characterRange ??
          (difference.locus.loci?.length === 1 ? difference.locus.loci[0]?.characterRange : undefined);
        return {
          id: difference.id,
          ayahKey: document.ayahKey,
          category: difference.category,
          title: difference.title,
          startPosition: difference.locus.startPosition,
          endPosition: difference.locus.endPosition,
          targetKind: hasCharacters ? ('CHARACTERS' as const) : ('WORDS' as const),
          characterRange,
          loci: difference.locus.loci && difference.locus.loci.length > 1
            ? difference.locus.loci.map((locus) => ({
                startPosition: locus.startPosition,
                endPosition: locus.endPosition,
                characterRange: locus.characterRange,
              }))
            : undefined,
          alternatives: [...difference.variants]
            .sort((first, second) => first.rank - second.rank)
            .map((variant) => ({
              id: variant.id,
              text: variant.text,
              label: variant.label,
              scope: variant.scope,
              isBase: variant.isBase,
              strengthDegreeId: variant.strengthDegreeId,
              strengthByNarrator: variant.strengthByNarrator,
              ruleLabel: variant.ruleLabel,
              maddHarakat: variant.maddHarakat,
              notes: variant.notes,
              evidences: variant.evidences,
            })),
          recitationMode: difference.context === 'ALWAYS' ? undefined : difference.context,
          engineSnapshot: undefined,
          editorModifiedAt: undefined,
          status: difference.status,
          origin: 'EDITOR' as const,
          orderRank: difference.rank,
          description: difference.description,
          sourceRef: difference.sourceRef,
          alternativeOrder: [...difference.variants]
            .sort((first, second) => first.rank - second.rank)
            .map((variant) => variant.id),
        };
      });

      const faceByDifference = new Map(
        result.differences.map((difference) => [difference.id, difference.variants[0]?.id])
      );
      const links: TashjeerLink[] = [];
      for (const relation of result.relations) {
        const fromFace = faceByDifference.get(relation.fromId);
        const toFace = faceByDifference.get(relation.toId);
        if (!fromFace || !toFace) continue;
        const now = new Date().toISOString();
        links.push({
          id: `link-${document.ayahKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          ayahKey: document.ayahKey,
          kind: 'FACE_TO_FACE',
          relation: relationTypeToLinkRelation(relation.type),
          from: { type: 'FACE', id: faceEndpointKey(relation.fromId, fromFace) },
          to: { type: 'FACE', id: faceEndpointKey(relation.toId, toFace) },
          notes: relation.note,
          origin: 'EDITOR',
          createdAt: now,
          updatedAt: now,
        });
      }

      return withLoggedEdit(
        {
          ...document,
          variants: [...document.variants, ...variants].sort(compareVariants),
          links: [...(document.links ?? []), ...links],
        },
        {
          action: 'إنشاء مجموعة ذكية',
          targetType: 'VARIANT',
          targetId: result.batchId,
          category: result.differences[0]?.category,
          summary: `أنشأ المحرر ${result.differences.length} اختلافات مستقلة بعلاقاتها في عملية معالج ذكي واحدة`,
        },
        document
      );
    });
    set({ markedPositions: [], markedCharacters: [] });
  },

  updateVariant: (variantId, patch) => {
    mutate(set, get, (document) => {
      const before = document.variants.find((variant) => variant.id === variantId);
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants
            .map((variant) => {
              if (variant.id !== variantId) return variant;
              const engineSnapshot =
                variant.origin !== 'EDITOR' && !variant.engineSnapshot
                  ? {
                      title: variant.title,
                      category: variant.category,
                      alternatives: JSON.parse(JSON.stringify(variant.alternatives)),
                      capturedAt: new Date().toISOString(),
                    }
                  : variant.engineSnapshot;
              return {
                ...variant,
                ...patch,
                engineSnapshot,
                editorModifiedAt: variant.origin !== 'EDITOR' ? new Date().toISOString() : variant.editorModifiedAt,
              };
            })
            .sort(compareVariants),
        },
        {
          action: 'تعديل اختلاف',
          targetType: 'VARIANT',
          targetId: variantId,
          category: before?.category,
          summary: `تعديل «${before?.title ?? variantId}»: ${Object.keys(patch).join('، ')}`,
          changes: Object.entries(patch).map(([field, after]) => ({
            field,
            before: before ? (before as unknown as Record<string, unknown>)[field] : undefined,
            after,
          })),
        },
        document
      );
    });
  },

  deleteVariant: (variantId) => {
    mutate(set, get, (document) => {
      const before = document.variants.find((variant) => variant.id === variantId);
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants.filter((variant) => variant.id !== variantId),
          // الخطوط التابعة للاختلاف المحذوف تُزال معه، وكذلك روابطه.
          branches: document.branches.filter((branch) => branch.variantId !== variantId),
          links: pruneLinksForVariant(document.links ?? [], variantId),
        },
        {
          action: 'حذف اختلاف',
          targetType: 'VARIANT',
          targetId: variantId,
          category: before?.category,
          summary: `حذف المحرر اختلاف «${before?.title ?? variantId}»`,
        },
        document
      );
    });
    set({ selection: null, selectedVariantId: null, selectedAlternativeId: null, selectedBranchId: null });
  },

  addAlternative: (variantId, alternative) => {
    mutate(set, get, (document) => {
      const owner = document.variants.find((variant) => variant.id === variantId);
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants.map((variant) =>
            variant.id === variantId
              ? { ...variant, alternatives: [...variant.alternatives, alternative] }
              : variant
          ),
        },
        {
          action: 'إضافة وجه',
          targetType: 'ALTERNATIVE',
          targetId: alternative.id,
          category: owner?.category,
          summary: `أضاف المحرر وجها («${alternative.label}») إلى «${owner?.title ?? variantId}»`,
        },
        document
      );
    });
  },

  updateAlternative: (variantId, alternativeId, patch) => {
    mutate(set, get, (document) => {
      const owner = document.variants.find((variant) => variant.id === variantId);
      const before = owner?.alternatives.find((item) => item.id === alternativeId);
      return withLoggedEdit(
        {
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
        },
        {
          action: 'تعديل وجه',
          targetType: 'ALTERNATIVE',
          targetId: alternativeId,
          category: owner?.category,
          summary: `تعديل الوجه «${before?.label ?? alternativeId}»: ${Object.keys(patch).join('، ')}`,
          changes: Object.entries(patch).map(([field, after]) => ({
            field,
            before: before ? (before as unknown as Record<string, unknown>)[field] : undefined,
            after,
          })),
        },
        document
      );
    });
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

  deleteAlternativesBulk: (variantId, alternativeIds) => {
    if (alternativeIds.length === 0) return;
    const doomed = new Set(alternativeIds);
    mutate(
      set,
      get,
      (document) => {
        const owner = document.variants.find((variant) => variant.id === variantId);
        return withLoggedEdit(
          {
            ...document,
            variants: document.variants.map((variant) =>
              variant.id === variantId
                ? { ...variant, alternatives: variant.alternatives.filter((alt) => !doomed.has(alt.id)) }
                : variant
            ),
            branches: document.branches.filter((branch) => !doomed.has(branch.alternativeId)),
          },
          {
            action: 'حذف جماعي للأوجه',
            targetType: 'ALTERNATIVE',
            targetId: alternativeIds.join(','),
            category: owner?.category,
            summary: `حذف المحرر ${alternativeIds.length} وجهًا دفعة واحدة`,
          },
          document
        );
      },
    );
    set((state) => ({
      selectedAlternativeId: state.selectedAlternativeId && doomed.has(state.selectedAlternativeId)
        ? null
        : state.selectedAlternativeId,
    }));
  },

  deleteVariantsBulk: (variantIds) => {
    if (variantIds.length === 0) return;
    const doomed = new Set(variantIds);
    mutate(
      set,
      get,
      (document) => {
        const removed = document.variants.filter((variant) => doomed.has(variant.id));
        const links = variantIds.reduce(
          (current, id) => pruneLinksForVariant(current, id),
          document.links ?? []
        );
        return withLoggedEdit(
          {
            ...document,
            variants: document.variants.filter((variant) => !doomed.has(variant.id)),
            branches: document.branches.filter((branch) => !doomed.has(branch.variantId)),
            links,
          },
          {
            action: 'حذف جماعي للاختلافات',
            targetType: 'VARIANT',
            targetId: variantIds.join(','),
            category: removed[0]?.category,
            summary: `حذف المحرر ${variantIds.length} اختلافًا دفعة واحدة`,
          },
          document
        );
      },
    );
    set((state) => ({
      selection: state.selectedVariantId && doomed.has(state.selectedVariantId) ? null : state.selection,
      selectedVariantId: state.selectedVariantId && doomed.has(state.selectedVariantId) ? null : state.selectedVariantId,
      selectedAlternativeId: state.selectedVariantId && doomed.has(state.selectedVariantId) ? null : state.selectedAlternativeId,
    }));
  },

  setVariantOrderRank: (variantId, rank) => {
    mutate(set, get, (document) => {
      const before = document.variants.find((variant) => variant.id === variantId);
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants.map((variant) =>
            variant.id === variantId
              ? { ...variant, orderRank: rank === null ? undefined : Math.max(1, Math.round(rank)) }
              : variant
          ),
        },
        {
          action: 'تعديل ترتيب الموضع',
          targetType: 'VARIANT',
          targetId: variantId,
          category: before?.category,
          summary:
            rank === null
              ? `إلغاء الرتبة اليدوية للموضع «${before?.title ?? variantId}»`
              : `تعديل رقم ترتيب السطر للموضع «${before?.title ?? variantId}» إلى ${rank}`,
          changes: [{ field: 'orderRank', before: before?.orderRank, after: rank ?? undefined }],
        },
        document
      );
    });
  },

  setEffectiveOrderRank: (variantId, rank) => {
    const document = get().document;
    if (!document) return;

    const local = document.variants.find((variant) => variant.id === variantId);
    if (local) {
      get().setVariantOrderRank(variantId, rank);
      return;
    }

    const derived = getEffectiveVariants(document).find((variant) => variant.id === variantId);
    if (!derived?.globalRuleId) return;
    const match = matchFromDerivedVariant(derived);
    if (!match) return;

    setOccurrenceOrderRank(derived.globalRuleId, match, rank);
    mutate(
      set,
      get,
      (current) => ({ ...current }),
      {
        action: 'تعديل ترتيب موضع قاعدة',
        targetType: 'RULE',
        targetId: variantId,
        category: derived.category,
        summary:
          rank === null
            ? `إلغاء ترتيب السطر اليدوي للموضع «${derived.title}»`
            : `تعديل رقم ترتيب السطر للموضع «${derived.title}» إلى ${rank}`,
        changes: [{ field: 'orderRank', before: derived.orderRank, after: rank ?? undefined }],
      }
    );
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

  // ==================== الروابط والأجزاء والترتيب اليدوي ====================

  addLink: ({ kind, relation, from, to, notes }) => {
    mutate(set, get, (document) => {
      const id = `link-${document.ayahKey}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const now = new Date().toISOString();
      const link: TashjeerLink = {
        id,
        ayahKey: document.ayahKey,
        kind,
        relation,
        from,
        to,
        notes: notes?.trim() || undefined,
        origin: 'EDITOR',
        createdAt: now,
        updatedAt: now,
      };
      return withLoggedEdit(
        { ...document, links: [...(document.links ?? []), link] },
        {
          action: 'إنشاء علاقة',
          targetType: linkTargetTypeOf(kind),
          targetId: id,
          summary: `${relation === 'MERGE' ? 'دمج' : 'ربط'} ${describeEndpoint(from)} مع ${describeEndpoint(to)}`,
        },
        document
      );
    });
  },

  updateLink: (linkId, patch) => {
    mutate(set, get, (document) => {
      const before = (document.links ?? []).find((link) => link.id === linkId);
      return withLoggedEdit(
        {
          ...document,
          links: (document.links ?? []).map((link) =>
            link.id === linkId ? { ...link, ...patch, updatedAt: new Date().toISOString() } : link
          ),
        },
        {
          action: 'تعديل علاقة',
          targetType: linkTargetTypeOf(before?.kind ?? 'LINE_TO_LINE'),
          targetId: linkId,
          summary: `تعديل العلاقة ${before ? `(${before.kind} ${before.relation})` : linkId}`,
          changes: Object.entries(patch).map(([field, after]) => ({
            field,
            before: before ? (before as unknown as Record<string, unknown>)[field] : undefined,
            after,
          })),
        },
        document
      );
    });
  },

  deleteLink: (linkId) => {
    mutate(set, get, (document) => {
      const before = (document.links ?? []).find((link) => link.id === linkId);
      return withLoggedEdit(
        {
          ...document,
          links: (document.links ?? []).filter((link) => link.id !== linkId),
        },
        {
          action: 'حذف علاقة',
          targetType: linkTargetTypeOf(before?.kind ?? 'LINE_TO_LINE'),
          targetId: linkId,
          summary: `حذف العلاقة بين ${describeEndpoint(before?.from)} و${describeEndpoint(before?.to)}`,
        },
        document
      );
    });
  },

  addSegment: ({ title, startPosition, endPosition, characterRange, notes }) => {
    const document = get().document;
    if (!document) return undefined;

    const segment: LineSegment = {
      id: `segment-${document.ayahKey}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      ayahKey: document.ayahKey,
      title: title.trim() || 'جزء من سطر',
      startPosition,
      endPosition,
      characterRange,
      notes: notes?.trim() || undefined,
      origin: 'EDITOR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mutate(
      set,
      get,
      (current) => ({
        ...current,
        segments: [...(current.segments ?? []), segment],
      }),
      {
        action: 'إنشاء جزء',
        targetType: 'SEGMENT',
        targetId: segment.id,
        summary: `إنشاء جزء «${segment.title}» (${segment.startPosition}–${segment.endPosition})`,
      }
    );

    return segment;
  },

  updateSegment: (segmentId, patch) => {
    mutate(set, get, (document) => {
      const before = (document.segments ?? []).find((segment) => segment.id === segmentId);
      return withLoggedEdit(
        {
          ...document,
          segments: (document.segments ?? []).map((segment) =>
            segment.id === segmentId
              ? { ...segment, ...patch, updatedAt: new Date().toISOString() }
              : segment
          ),
        },
        {
          action: 'تعديل جزء',
          targetType: 'SEGMENT',
          targetId: segmentId,
          summary: `تعديل الجزء «${before?.title ?? segmentId}»: ${Object.keys(patch).join('، ')}`,
          changes: Object.entries(patch).map(([field, after]) => ({
            field,
            before: before ? (before as unknown as Record<string, unknown>)[field] : undefined,
            after,
          })),
        },
        document
      );
    });
  },

  deleteSegment: (segmentId) => {
    mutate(set, get, (document) => {
      const before = (document.segments ?? []).find((segment) => segment.id === segmentId);
      return withLoggedEdit(
        {
          ...document,
          segments: (document.segments ?? []).filter((segment) => segment.id !== segmentId),
          // روابط الجزء المحذوف تُزال معه، فلا تبقى روابط معلقة.
          links: (document.links ?? []).filter(
            (link) => link.from.id !== segmentId && link.to.id !== segmentId
          ),
        },
        {
          action: 'حذف جزء',
          targetType: 'SEGMENT',
          targetId: segmentId,
          summary: `حذف الجزء «${before?.title ?? segmentId}» وروابطه`,
        },
        document
      );
    });
  },

  setLineOrder: (order) => {
    mutate(set, get, (document) => {
      const before = document.lineOrder ?? [];
      if (arraysEqual(before, order)) return document;
      return withLoggedEdit(
        { ...document, lineOrder: [...order] },
        {
          action: 'ترتيب الأسطر يدويا',
          targetType: 'LINE_ORDER',
          targetId: String(document.ayahKey),
          summary:
            order.length === 0
              ? 'إعادة الترتيب إلى قاعدة المحرك'
              : `تثبيت ترتيب ${order.length} سطرا يدويا`,
          changes: [{ field: 'lineOrder', before, after: [...order] }],
        },
        document
      );
    });
  },

  moveLineInOrder: (currentLineIds, lineId, targetIndex) => {
    get().setLineOrder(moveLineToIndex(currentLineIds, lineId, targetIndex));
  },

  resetLineOrder: () => {
    get().setLineOrder([]);
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

  setLinkNextAyah: (linked) => {
    mutate(set, get, (document) => {
      const baseWordsCount = documentWindowWords({
        ...document,
        readingWindow: { ...(document.readingWindow ?? {}), linkNextAyah: false },
      }).length;
      const isForbidden = document.boundaries.some(
        (boundary) => boundary.kind === 'NO_WASL' && boundary.position === baseWordsCount
      );
      const accepted = linked && !isForbidden;
      return {
        ...document,
        readingWindow: {
          ...(document.readingWindow ?? {}),
          linkNextAyah: accepted,
          // فك الوصل يبطل مقطعا قد يكون امتد إلى الآية الثانية.
          focusSegment: accepted ? (document.readingWindow?.focusSegment ?? null) : null,
        },
      };
    });
    set({ selectedWordId: null, markedPositions: [], markedCharacters: [] });
  },

  setFocusSegment: (segment) => {
    mutate(set, get, (document) => ({
      ...document,
      readingWindow: {
        ...(document.readingWindow ?? {}),
        focusSegment: segment
          ? {
              startPosition: Math.max(1, Math.min(segment.startPosition, segment.endPosition)),
              endPosition: Math.max(segment.startPosition, segment.endPosition),
            }
          : null,
      },
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

  toggleMarkedCharacter: (anchor) => {
    set((state) => {
      const exists = state.markedCharacters.some(
        (item) => item.position === anchor.position && item.characterIndex === anchor.characterIndex
      );
      const next = exists
        ? state.markedCharacters.filter(
            (item) => item.position !== anchor.position || item.characterIndex !== anchor.characterIndex
          )
        : [...state.markedCharacters, anchor];

      return {
        markedCharacters: next.sort(
          (first, second) =>
            first.position - second.position || first.characterIndex - second.characterIndex
        ),
      };
    });
  },

  clearMarks: () => set({ markedPositions: [], markedCharacters: [] }),
  setMarkingMode: (mode) => set({ markingMode: mode, markedPositions: [], markedCharacters: [] }),
  selectWord: (wordId) => {
    const word = wordId ? documentWindowWords(get().document).find((item) => item.id === wordId) : undefined;
    set({
      selection: wordId ? { kind: 'WORD', id: String(wordId), position: word?.position } : null,
      selectedWordId: wordId,
      selectedAlternativeId: null,
    });
  },
  selectVariant: (variantId) => {
    const currentDocument = get().document;
    const variant = variantId && currentDocument
      ? getEffectiveVariants(currentDocument).find((item) => item.id === variantId)
      : undefined;
    set({
      selection: variantId
        ? { kind: variant?.isGlobalDerived ? 'RULE' : 'DIFFERENCE', id: variantId, differenceId: variantId, position: variant?.startPosition }
        : null,
      selectedVariantId: variantId,
      selectedAlternativeId: null,
      selectedBranchId: null,
    });
  },
  selectAlternative: (variantId, alternativeId) => {
    const currentDocument = get().document;
    const variant = currentDocument
      ? getEffectiveVariants(currentDocument).find((item) => item.id === variantId)
      : undefined;
    set({
      selection: { kind: 'FACE', id: alternativeId, differenceId: variantId, faceId: alternativeId, position: variant?.startPosition },
      selectedVariantId: variantId,
      selectedAlternativeId: alternativeId,
      selectedBranchId: null,
    });
  },
  selectSegment: (segmentId) => {
    const segment = get().document?.segments?.find((item) => item.id === segmentId);
    set({
      selection: segmentId ? { kind: 'SEGMENT', id: segmentId, position: segment?.startPosition } : null,
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
    });
  },
  selectLine: (lineId, differenceId, position) => set({
    selection: { kind: 'LINE', id: lineId, lineId, differenceId, position },
    selectedVariantId: differenceId ?? null,
    selectedAlternativeId: null,
    selectedBranchId: lineId,
  }),
  selectBranch: (branchId) => set((state) => ({
    selectedBranchId: branchId,
    selection: branchId
      ? { kind: 'LINE', id: branchId, lineId: branchId, differenceId: state.selectedVariantId ?? undefined }
      : state.selectedVariantId
        ? { kind: 'DIFFERENCE', id: state.selectedVariantId, differenceId: state.selectedVariantId }
        : null,
  })),
  copySelection: () => {
    const state = get();
    const selection = state.selection;
    if (!selection || !state.document) return;
    if (selection.kind === 'DIFFERENCE') {
      const value = state.document.variants.find((item) => item.id === selection.id);
      if (value) set({ clipboard: { kind: 'DIFFERENCE', value: structuredClone(value) } });
    } else if (selection.kind === 'FACE' && selection.differenceId) {
      const value = state.document.variants
        .find((item) => item.id === selection.differenceId)
        ?.alternatives.find((item) => item.id === selection.id);
      if (value) set({ clipboard: { kind: 'FACE', value: structuredClone(value) } });
    } else if (selection.kind === 'SEGMENT') {
      const value = state.document.segments?.find((item) => item.id === selection.id);
      if (value) set({ clipboard: { kind: 'SEGMENT', value: structuredClone(value) } });
    }
  },
  cutSelection: () => {
    const state = get();
    state.copySelection();
    const selection = get().selection;
    if (!selection) return;
    if (selection.kind === 'DIFFERENCE') get().deleteVariant(selection.id);
    else if (selection.kind === 'FACE' && selection.differenceId) get().deleteAlternative(selection.differenceId, selection.id);
    else if (selection.kind === 'SEGMENT') get().deleteSegment(selection.id);
  },
  pasteSelection: () => {
    const state = get();
    const clipboard = state.clipboard;
    if (!clipboard || !state.document) return;
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    if (clipboard.kind === 'DIFFERENCE') {
      const source = structuredClone(clipboard.value);
      const id = `v-copy-${suffix}`;
      state.addVariant({
        ...source,
        id,
        title: `${source.title} — نسخة`,
        alternatives: source.alternatives.map((item, index) => ({ ...item, id: `${id}-face-${index + 1}-${suffix}` })),
        origin: 'EDITOR',
        engineSnapshot: undefined,
        editorModifiedAt: undefined,
      });
      get().selectVariant(id);
    } else if (clipboard.kind === 'FACE' && state.selectedVariantId) {
      const face = structuredClone(clipboard.value);
      const id = `face-copy-${suffix}`;
      state.addAlternative(state.selectedVariantId, { ...face, id, isBase: false });
      get().selectAlternative(state.selectedVariantId, id);
    } else if (clipboard.kind === 'SEGMENT') {
      const segment = clipboard.value;
      const created = state.addSegment({
        title: `${segment.title} — نسخة`,
        startPosition: segment.startPosition,
        endPosition: segment.endPosition,
        characterRange: segment.characterRange,
        notes: segment.notes,
      });
      if (created) get().selectSegment(created.id);
    }
  },
  setTool: (tool) =>
    set({
      currentTool: tool,
      markedPositions: tool === 'mark' ? get().markedPositions : [],
      markedCharacters: tool === 'mark' ? get().markedCharacters : [],
    }),
  setDraftCategory: (category) => set({ draftCategory: category }),

  // ==================== العرض ====================

  setZoom: (zoom) => set({ zoom: clamp(zoom, 0.2, 6) }),
  zoomIn: () => set((state) => ({ zoom: clamp(state.zoom * 1.2, 0.2, 6) })),
  zoomOut: () => set((state) => ({ zoom: clamp(state.zoom / 1.2, 0.2, 6) })),
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

/** وصف تعديل يُسجَّل في سجل المستند لأغراض التتبع. */
interface EditDescriptor {
  action: string;
  targetType: import('@/types/tashjeer').DocumentEditTargetType;
  targetId: string;
  summary: string;
  category?: VariantCategory;
  changes?: import('@/types/tashjeer').DocumentEditChange[];
}

/**
 * يطبّق تعديلا على المستند مع تسجيل لقطة تراجع وإعادة توليد الخطوط.
 *
 * @param updater دالة تُرجع النسخة الجديدة من المستند
 * @param edit وصف التعديل لسجل التتبع، اختياري لتعديلات العرض الصرفة
 */
function mutate(
  set: (partial: Partial<EditorState>) => void,
  get: () => EditorState,
  updater: (document: TashjeerDocument) => TashjeerDocument,
  edit?: EditDescriptor
): void {
  const state = get();
  const current = state.document;
  if (!current) return;

  const updated = updater(current);
  const next = withRegeneratedBranches(
    edit ? withLoggedEdit(updated, edit, current) : updated
  );

  set({
    past: pushHistory(state.past, current),
    future: [],
    document: next,
    isDirty: true,
  });
}

/** يلحق سطر سجل تعديل بالمستند إن كان التعديل حقيقيا (تغيرت بياناته). */
function withLoggedEdit(
  next: TashjeerDocument,
  edit: EditDescriptor,
  before: TashjeerDocument
): TashjeerDocument {
  if (next === before) return next;
  return appendEditLog(
    next,
    makeEditEntry({
      actor: next.meta.author,
      action: edit.action,
      targetType: edit.targetType,
      targetId: edit.targetId,
      category: edit.category,
      summary: edit.summary,
      changes: edit.changes,
    })
  );
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
  const words = documentWindowWords(document);
  if (words.length === 0) return existing;

  const layout = layoutAyah(document.ayahKey, words, document.layout);
  const engine = readEngineSettings();
  // القواعد العامة لا تُنسخ إلى كل مستند؛ تُحوّل هنا إلى اختلافات مشتقة
  // وقت الرسم، فتظل قاعدة واحدة هي مصدر الحقيقة للمصحف كله.
  const effectiveVariants = getEffectiveVariants(document);
  return generateBranches(effectiveVariants, layout, existing, {
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

/** نوع هدف الرابط في سجل التعديل بحسب نوع العلاقة. */
function linkTargetTypeOf(
  kind: import('@/types/tashjeer').TashjeerLinkKind
): import('@/types/tashjeer').DocumentEditTargetType {
  if (kind === 'FACE_TO_FACE') return 'FACE_LINK';
  if (kind === 'LINE_TO_LINE') return 'LINE_LINK';
  return 'SEGMENT';
}

/** وصف طرف العلاقة في صياغة عربية مفهومة للسجل والتتبع. */
function describeEndpoint(endpoint?: import('@/types/tashjeer').LinkEndpoint): string {
  if (!endpoint) return 'غير محدد';
  const labels: Record<string, string> = {
    FACE: 'وجه',
    LINE: 'سطر',
    SEGMENT: 'جزء',
    RULE: 'قاعدة',
  };
  return `${labels[endpoint.type] ?? endpoint.type} (${shortenId(endpoint.id)})`;
}

function shortenId(id: string): string {
  return id.length > 40 ? `${id.slice(0, 37)}…` : id;
}

/** يزيل روابط وجه اختفى اختلافه، فلا تبقى علاقات تشير إلى معدوم. */
function pruneLinksForVariant(links: TashjeerLink[], variantId: string): TashjeerLink[] {
  return links.filter((link) => {
    if (link.from.type === 'FACE' && link.from.id.startsWith(`${variantId}::`)) return false;
    if (link.to.type === 'FACE' && link.to.id.startsWith(`${variantId}::`)) return false;
    if (link.from.type === 'RULE' && link.from.id === variantId) return false;
    if (link.to.type === 'RULE' && link.to.id === variantId) return false;
    return true;
  });
}

function arraysEqual(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((item, index) => item === second[index]);
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

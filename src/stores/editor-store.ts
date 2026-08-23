// حالة المحرر - Editor Store v2 - بيئة احترافية للتحكم والقرار
// مشروع التشجير - نظام القراءات العشر
//
// التصميم الموحد:
//   Ayah → Line → Segment → Difference → Variant → Rule → Reader → Order → Relation → Source → Correction
// كل العمليات مبنية على نفس النموذج ونفس Selection Context.

import { create } from 'zustand';
import type { VariantCategory } from '@/types';
import type {
  ManualTashjeerLine,
  RecitationBoundary,
  CharacterAnchor,
  EditorSelection,
  LinkEndpoint,
  TashjeerBranch,
  TashjeerDocument,
  TashjeerLink,
  TashjeerLinkKind,
  TashjeerLinkRelation,
  LineSegment,
  Variant,
  VariantAlternative,
  VerificationStatus,
  ViewFilter,
  WaqfContext,
} from '@/types/tashjeer';
import { parseAyahKey } from '@/data/quran';
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

export type MarkingMode = 'WORDS' | 'CHARACTERS';

export type EditorTool = 'select' | 'mark' | 'erase';

const MAX_HISTORY = 80;

const DEFAULT_FILTER: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

type ClipboardContent =
  | { kind: 'DIFFERENCE'; value: Variant }
  | { kind: 'DIFFERENCES'; values: Variant[] }
  | { kind: 'FACE'; value: VariantAlternative; parentId?: string }
  | { kind: 'FACES'; values: Array<{ face: VariantAlternative; parentId: string }> }
  | { kind: 'SEGMENT'; value: LineSegment }
  | null;

interface EditorState {
  document: TashjeerDocument | null;
  isDirty: boolean;
  past: TashjeerDocument[];
  future: TashjeerDocument[];

  zoom: number;
  pan: { x: number; y: number };
  filter: ViewFilter;
  showPropertiesPanel: boolean;
  showVariantsPanel: boolean;

  // التحديد والتعليم
  markedPositions: number[];
  markedCharacters: CharacterAnchor[];
  markingMode: MarkingMode;
  selection: EditorSelection | null;
  selectedWordId: number | null;
  selectedVariantId: string | null;
  selectedAlternativeId: string | null;
  selectedBranchId: string | null;
  selectedFaceIds: string[];
  multiSelectedVariantIds: string[];
  clipboard: ClipboardContent;
  currentTool: EditorTool;
  draftCategory: VariantCategory;

  // أوضاع الواجهة
  focusMode: boolean;
  pinnedPanels: { properties: boolean; variants: boolean; toolbar: boolean };

  openAyah: (ayahKey: number) => void;
  resetAyah: () => void;
  save: () => void;
  setDocumentStatus: (status: VerificationStatus) => void;
  replaceDocument: (document: TashjeerDocument) => void;

  addVariant: (variant: Omit<Variant, 'ayahKey'>) => void;
  addVariantGroup: (variants: Array<Omit<Variant, 'ayahKey'>>) => void;
  addVariantGroupWithRelations: (input: {
    base: Omit<Variant, 'ayahKey'>;
    related: Array<Omit<Variant, 'ayahKey'>>;
    createLinks?: boolean;
    batchGroupId?: string;
  }) => void;
  updateVariant: (variantId: string, patch: Partial<Variant>) => void;
  deleteVariant: (variantId: string) => void;
  duplicateVariant: (variantId: string) => void;
  mergeVariants: (sourceId: string, targetId: string) => void;
  moveVariant: (variantId: string, targetIndex: number) => void;

  addAlternative: (variantId: string, alternative: VariantAlternative) => void;
  updateAlternative: (variantId: string, alternativeId: string, patch: Partial<VariantAlternative>) => void;
  deleteAlternative: (variantId: string, alternativeId: string) => void;
  duplicateAlternative: (variantId: string, alternativeId: string) => void;
  setVariantOrderRank: (variantId: string, rank: number | null) => void;
  setEffectiveOrderRank: (variantId: string, rank: number | null) => void;
  moveAlternative: (variantId: string, alternativeId: string, delta: number) => void;
  resetAlternativeOrder: (variantId: string) => void;

  // تحديد دقيق للاختلاف/الوجه
  toggleSelectedFace: (variantId: string, faceId: string) => void;
  clearFaceSelection: () => void;
  selectMultipleVariants: (ids: string[]) => void;
  toggleMultiVariant: (id: string) => void;

  regenerateBranches: () => void;
  refreshDerivedBranches: () => void;
  toggleBranchVisibility: (branchId: string) => void;
  moveBranchLane: (branchId: string, delta: number) => void;
  setBranchLane: (branchId: string, lane: number) => void;
  setBranchRowOffset: (branchId: string, rowOffset: number) => void;
  resetBranchPosition: (branchId: string) => void;
  addManualLine: (line: ManualTashjeerLine) => void;
  updateManualLine: (lineId: string, patch: Partial<ManualTashjeerLine>) => void;
  deleteManualLine: (lineId: string) => void;

  addLink: (link: { kind: TashjeerLinkKind; relation: TashjeerLinkRelation; from: LinkEndpoint; to: LinkEndpoint; notes?: string }) => void;
  addLinkGroup: (links: Array<{ kind: TashjeerLinkKind; relation: TashjeerLinkRelation; from: LinkEndpoint; to: LinkEndpoint; notes?: string }>) => void;
  updateLink: (linkId: string, patch: Partial<Pick<TashjeerLink, 'relation' | 'notes' | 'from' | 'to'>>) => void;
  deleteLink: (linkId: string) => void;
  addSegment: (segment: { title: string; startPosition: number; endPosition: number; characterRange?: LineSegment['characterRange']; notes?: string }) => LineSegment | undefined;
  updateSegment: (segmentId: string, patch: Partial<Pick<LineSegment, 'title' | 'startPosition' | 'endPosition' | 'notes'>>) => void;
  deleteSegment: (segmentId: string) => void;
  setLineOrder: (order: string[]) => void;
  moveLineInOrder: (currentLineIds: string[], lineId: string, targetIndex: number) => void;
  resetLineOrder: () => void;

  addBoundary: (boundary: RecitationBoundary) => void;
  updateBoundary: (boundaryId: string, patch: Partial<RecitationBoundary>) => void;
  deleteBoundary: (boundaryId: string) => void;
  toggleForcedLineBreak: (position: number) => void;
  setLinkNextAyah: (linked: boolean) => void;
  setFocusSegment: (segment: { startPosition: number; endPosition: number } | null) => void;
  setLineOffset: (lineIndex: number, offset: number) => void;
  setWaqfContext: (variantId: string, context: WaqfContext | null) => void;

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
  setFocusMode: (value: boolean) => void;
  setPinnedPanel: (panel: 'properties' | 'variants' | 'toolbar', pinned: boolean) => void;

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
  selectedFaceIds: [],
  multiSelectedVariantIds: [],
  clipboard: null,
  currentTool: 'select',
  draftCategory: 'FARSH',
  focusMode: false,
  pinnedPanels: { properties: true, variants: true, toolbar: true },

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
      selectedFaceIds: [],
      multiSelectedVariantIds: [],
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
      selectedFaceIds: [],
      multiSelectedVariantIds: [],
    }));
  },

  save: () => {
    const current = get().document;
    if (!current) return;
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

  addVariant: (variant) => {
    const batchId = (variant as any).batchGroupId;
    mutate(
      set,
      get,
      (document) => ({
        ...document,
        variants: [
          ...document.variants,
          {
            ...variant,
            ayahKey: document.ayahKey,
            origin: 'EDITOR' as const,
            source: 'EDITOR' as const,
            isIndependent: true,
            batchGroupId: batchId,
            correction: {
              final: variant.title,
              engine: variant.engineSnapshot?.title,
              editor: variant.title,
            },
          },
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
    const batchGroupId = `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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
            source: 'EDITOR' as const,
            isIndependent: true,
            batchGroupId: (variant as any).batchGroupId ?? batchGroupId,
            correction: {
              final: variant.title,
              editor: variant.title,
            },
          })),
        ].sort(compareVariants),
      }),
      {
        action: 'إنشاء مجموعة اختلافات',
        targetType: 'VARIANT',
        targetId: variants.map((item) => item.id).join(','),
        summary: `أنشأ المحرر ${variants.length} اختلافات مستقلة في عملية واحدة (المجموعة ${batchGroupId})`,
      }
    );
    set({ markedPositions: [], markedCharacters: [] });
  },

  addVariantGroupWithRelations: ({ base, related, createLinks = true, batchGroupId }) => {
    const doc = get().document;
    if (!doc) return;
    const groupId = batchGroupId ?? `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const allVariants = [base, ...related].map((variant, index) => ({
      ...variant,
      ayahKey: doc.ayahKey,
      origin: 'EDITOR' as const,
      source: 'EDITOR' as const,
      isIndependent: true,
      batchGroupId: groupId,
      orderRank: variant.orderRank ?? index + 1,
      correction: { final: variant.title, editor: variant.title },
    }));

    mutate(
      set,
      get,
      (document) => {
        let nextDoc = {
          ...document,
          variants: [...document.variants, ...allVariants].sort(compareVariants),
        };

        if (createLinks && related.length > 0) {
          const links: TashjeerLink[] = [];
          const now = new Date().toISOString();
          // ربط كل وجه في base بكل وجه في related إن وجدت، وإلا ربط الاختلافات نفسها كمرجع.
          const baseFaceId = base.alternatives.find((a) => !a.isBase)?.id;
          for (const rel of related) {
            const relFaceId = rel.alternatives.find((a) => !a.isBase)?.id;
            if (baseFaceId && relFaceId) {
              links.push({
                id: `link-${document.ayahKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
                ayahKey: document.ayahKey,
                kind: 'FACE_TO_FACE',
                relation: 'MERGE',
                from: { type: 'FACE', id: `${base.id}::${baseFaceId}` },
                to: { type: 'FACE', id: `${rel.id}::${relFaceId}` },
                origin: 'EDITOR',
                createdAt: now,
                updatedAt: now,
              });
            } else {
              links.push({
                id: `link-${document.ayahKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
                ayahKey: document.ayahKey,
                kind: 'LINE_TO_LINE',
                relation: 'REFERENCE',
                from: { type: 'RULE', id: base.id },
                to: { type: 'RULE', id: rel.id },
                origin: 'EDITOR',
                createdAt: now,
                updatedAt: now,
              });
            }
          }
          nextDoc = { ...nextDoc, links: [...(nextDoc.links ?? []), ...links] };
        }

        return nextDoc;
      },
      {
        action: 'إنشاء مجموعة اختلافات مترابطة',
        targetType: 'VARIANT',
        targetId: groupId,
        summary: `أنشأ المحرر مجموعة ${allVariants.length} اختلافات مستقلة مترابطة (${groupId})`,
      }
    );
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
              const correction = {
                engine: engineSnapshot?.title ?? variant.correction?.engine,
                editor: (patch.title as string) ?? variant.correction?.editor ?? variant.title,
                final: (patch.title as string) ?? variant.title,
              };
              return {
                ...variant,
                ...patch,
                engineSnapshot,
                editorModifiedAt: variant.origin !== 'EDITOR' ? new Date().toISOString() : variant.editorModifiedAt,
                modifiedBy: 'EDITOR' as const,
                correction,
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
    set({ selection: null, selectedVariantId: null, selectedAlternativeId: null, selectedBranchId: null, selectedFaceIds: [], multiSelectedVariantIds: [] });
  },

  duplicateVariant: (variantId) => {
    const state = get();
    const doc = state.document;
    if (!doc) return;
    const source = doc.variants.find((v) => v.id === variantId);
    if (!source) return;
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const id = `v-copy-${suffix}`;
    state.addVariant({
      ...structuredClone(source),
      id,
      title: `${source.title} — نسخة`,
      alternatives: source.alternatives.map((item, index) => ({ ...item, id: `${id}-face-${index + 1}-${suffix}` })),
      origin: 'EDITOR',
      source: 'EDITOR',
      engineSnapshot: undefined,
      editorModifiedAt: undefined,
      correction: { final: `${source.title} — نسخة`, editor: `${source.title} — نسخة` },
    } as any);
    get().selectVariant(id);
  },

  mergeVariants: (sourceId, targetId) => {
    mutate(set, get, (document) => {
      const source = document.variants.find((v) => v.id === sourceId);
      const target = document.variants.find((v) => v.id === targetId);
      if (!source || !target || sourceId === targetId) return document;
      // دمج الأوجه: كل أوجه المصدر تنقل إلى الهدف بمعرّفات جديدة مستقلة.
      const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`;
      const newAlts = source.alternatives
        .filter((a) => !a.isBase)
        .map((alt, idx) => ({ ...structuredClone(alt), id: `${target.id}-merged-${idx}-${suffix}` }));
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants
            .map((v) => (v.id === targetId ? { ...v, alternatives: [...v.alternatives, ...newAlts] } : v))
            .filter((v) => v.id !== sourceId),
          links: pruneLinksForVariant(document.links ?? [], sourceId),
        },
        {
          action: 'دمج اختلافين',
          targetType: 'VARIANT',
          targetId: `${sourceId}→${targetId}`,
          summary: `دمج «${source.title}» في «${target.title}» مع حفظ الاستقلال السابق في السجل`,
        },
        document
      );
    });
  },

  moveVariant: (variantId, targetIndex) => {
    mutate(set, get, (document) => {
      const sorted = [...document.variants].sort(compareVariants);
      const currentIndex = sorted.findIndex((v) => v.id === variantId);
      if (currentIndex === -1) return document;
      const without = sorted.filter((v) => v.id !== variantId);
      const clamped = Math.max(0, Math.min(targetIndex, without.length));
      const reordered = [...without.slice(0, clamped), sorted[currentIndex], ...without.slice(clamped)];
      // نثبت orderRank صريحا حسب الترتيب الجديد.
      const withRanks = reordered.map((v, idx) => ({ ...v, orderRank: idx + 1 }));
      return withLoggedEdit(
        { ...document, variants: withRanks },
        {
          action: 'إعادة ترتيب اختلاف',
          targetType: 'VARIANT',
          targetId: variantId,
          summary: `نقل الاختلاف إلى الموضع ${targetIndex + 1}`,
        },
        document
      );
    });
  },

  addAlternative: (variantId, alternative) => {
    mutate(set, get, (document) => {
      const owner = document.variants.find((variant) => variant.id === variantId);
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants.map((variant) =>
            variant.id === variantId ? { ...variant, alternatives: [...variant.alternatives, alternative] } : variant
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
          alternatives: variant.alternatives.filter((alternative) => alternative.id !== alternativeId),
        };
      }),
      branches: document.branches.filter((branch) => branch.alternativeId !== alternativeId),
    }));
  },

  duplicateAlternative: (variantId, alternativeId) => {
    const doc = get().document;
    if (!doc) return;
    const variant = doc.variants.find((v) => v.id === variantId);
    const alt = variant?.alternatives.find((a) => a.id === alternativeId);
    if (!alt) return;
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const id = `face-copy-${suffix}`;
    get().addAlternative(variantId, { ...structuredClone(alt), id, isBase: false, label: `${alt.label} — نسخة` });
    get().selectAlternative(variantId, id);
  },

  setVariantOrderRank: (variantId, rank) => {
    mutate(set, get, (document) => {
      const before = document.variants.find((variant) => variant.id === variantId);
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants.map((variant) =>
            variant.id === variantId ? { ...variant, orderRank: rank === null ? undefined : Math.max(1, Math.round(rank)) } : variant
          ),
        },
        {
          action: 'تعديل ترتيب الموضع',
          targetType: 'VARIANT',
          targetId: variantId,
          category: before?.category,
          summary: rank === null ? `إلغاء الرتبة اليدوية للموضع «${before?.title ?? variantId}»` : `تعديل رقم ترتيب السطر للموضع «${before?.title ?? variantId}» إلى ${rank}`,
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
        summary: rank === null ? `إلغاء ترتيب السطر اليدوي للموضع «${derived.title}»` : `تعديل رقم ترتيب السطر للموضع «${derived.title}» إلى ${rank}`,
        changes: [{ field: 'orderRank', before: derived.orderRank, after: rank ?? undefined }],
      }
    );
  },

  moveAlternative: (variantId, alternativeId, delta) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.map((variant) => {
        if (variant.id !== variantId) return variant;
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
      variants: document.variants.map((variant) => (variant.id === variantId ? { ...variant, alternativeOrder: undefined } : variant)),
    }));
  },

  toggleSelectedFace: (variantId, faceId) => {
    set((state) => {
      const exists = state.selectedFaceIds.includes(faceId);
      const next = exists ? state.selectedFaceIds.filter((id) => id !== faceId) : [...state.selectedFaceIds, faceId];
      return {
        selectedFaceIds: next,
        selection: next.length > 0 ? { kind: 'FACE', id: faceId, differenceId: variantId, faceId, position: state.document?.variants.find((v) => v.id === variantId)?.startPosition } : state.selection,
        selectedVariantId: variantId,
        selectedAlternativeId: faceId,
      };
    });
  },

  clearFaceSelection: () => set({ selectedFaceIds: [] }),

  selectMultipleVariants: (ids) => set({ multiSelectedVariantIds: ids, selectedFaceIds: [] }),

  toggleMultiVariant: (id) =>
    set((state) => {
      const exists = state.multiSelectedVariantIds.includes(id);
      return {
        multiSelectedVariantIds: exists ? state.multiSelectedVariantIds.filter((item) => item !== id) : [...state.multiSelectedVariantIds, id],
      };
    }),

  regenerateBranches: () => {
    mutate(set, get, (document) => ({
      ...document,
      branches: computeBranches(document, []),
    }));
  },

  refreshDerivedBranches: () => {
    const document = get().document;
    if (!document) return;
    set({ document: withRegeneratedBranches(document) });
  },

  toggleBranchVisibility: (branchId) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) => (branch.id === branchId ? { ...branch, isHidden: !branch.isHidden } : branch)),
    }));
  },

  moveBranchLane: (branchId, delta) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId ? { ...branch, lane: Math.max(0, branch.lane + delta), isManual: true } : branch
      ),
    }));
  },

  setBranchLane: (branchId, lane) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId ? { ...branch, lane: Math.max(0, Math.round(lane)), isManual: true } : branch
      ),
    }));
  },

  setBranchRowOffset: (branchId, rowOffset) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId ? { ...branch, rowOffset: Math.round(rowOffset), isManual: true } : branch
      ),
    }));
  },

  resetBranchPosition: (branchId) => {
    mutate(set, get, (document) => ({
      ...document,
      branches: document.branches.map((branch) =>
        branch.id === branchId ? { ...branch, lane: 0, rowOffset: undefined, isManual: false } : branch
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
      manualLines: document.manualLines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    }));
  },

  deleteManualLine: (lineId) => {
    mutate(set, get, (document) => ({
      ...document,
      manualLines: document.manualLines.filter((line) => line.id !== lineId),
    }));
  },

  addLink: ({ kind, relation, from, to, notes }) => {
    mutate(set, get, (document) => {
      const id = `link-${document.ayahKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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

  addLinkGroup: (linksInput) => {
    if (linksInput.length === 0) return;
    mutate(set, get, (document) => {
      const now = new Date().toISOString();
      const links: TashjeerLink[] = linksInput.map((input) => ({
        id: `link-${document.ayahKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        ayahKey: document.ayahKey,
        kind: input.kind,
        relation: input.relation,
        from: input.from,
        to: input.to,
        notes: input.notes?.trim() || undefined,
        origin: 'EDITOR' as const,
        createdAt: now,
        updatedAt: now,
      }));
      return withLoggedEdit(
        { ...document, links: [...(document.links ?? []), ...links] },
        {
          action: 'إنشاء مجموعة علاقات',
          targetType: 'FACE_LINK',
          targetId: links.map((l) => l.id).join(','),
          summary: `أنشأ المحرر ${links.length} علاقات دفعة واحدة`,
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
          links: (document.links ?? []).map((link) => (link.id === linkId ? { ...link, ...patch, updatedAt: new Date().toISOString() } : link)),
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
      id: `segment-${document.ayahKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
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
            segment.id === segmentId ? { ...segment, ...patch, updatedAt: new Date().toISOString() } : segment
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
          links: (document.links ?? []).filter((link) => link.from.id !== segmentId && link.to.id !== segmentId),
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
          summary: order.length === 0 ? 'إعادة الترتيب إلى قاعدة المحرك' : `تثبيت ترتيب ${order.length} سطرا يدويا`,
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

  addBoundary: (boundary) => {
    mutate(set, get, (document) => ({
      ...document,
      boundaries: [...document.boundaries, boundary].sort((first, second) => first.position - second.position),
    }));
  },

  updateBoundary: (boundaryId, patch) => {
    mutate(set, get, (document) => ({
      ...document,
      boundaries: document.boundaries.map((boundary) => (boundary.id === boundaryId ? { ...boundary, ...patch } : boundary)).sort((first, second) => first.position - second.position),
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
      const isForbidden = document.boundaries.some((boundary) => boundary.kind === 'NO_WASL' && boundary.position === baseWordsCount);
      const accepted = linked && !isForbidden;
      return {
        ...document,
        readingWindow: {
          ...(document.readingWindow ?? {}),
          linkNextAyah: accepted,
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

  setWaqfContext: (variantId, context) => {
    mutate(set, get, (document) => ({
      ...document,
      variants: document.variants.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              waqfContext: context ?? undefined,
              recitationMode: context ? context.mode : variant.recitationMode,
            }
          : variant
      ),
    }));
  },

  toggleMarkedPosition: (position) => {
    set((state) => {
      const exists = state.markedPositions.includes(position);
      const next = exists ? state.markedPositions.filter((item) => item !== position) : [...state.markedPositions, position];
      return { markedPositions: next.sort((a, b) => a - b) };
    });
  },

  toggleMarkedCharacter: (anchor) => {
    set((state) => {
      const exists = state.markedCharacters.some((item) => item.position === anchor.position && item.characterIndex === anchor.characterIndex);
      const next = exists
        ? state.markedCharacters.filter((item) => item.position !== anchor.position || item.characterIndex !== anchor.characterIndex)
        : [...state.markedCharacters, anchor];
      return {
        markedCharacters: next.sort((first, second) => first.position - second.position || first.characterIndex - second.characterIndex),
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
    const variant = variantId && currentDocument ? getEffectiveVariants(currentDocument).find((item) => item.id === variantId) : undefined;
    set({
      selection: variantId ? { kind: variant?.isGlobalDerived ? 'RULE' : 'DIFFERENCE', id: variantId, differenceId: variantId, position: variant?.startPosition } : null,
      selectedVariantId: variantId,
      selectedAlternativeId: null,
      selectedBranchId: null,
      selectedFaceIds: [],
    });
  },

  selectAlternative: (variantId, alternativeId) => {
    const currentDocument = get().document;
    const variant = currentDocument ? getEffectiveVariants(currentDocument).find((item) => item.id === variantId) : undefined;
    set({
      selection: { kind: 'FACE', id: alternativeId, differenceId: variantId, faceId: alternativeId, position: variant?.startPosition },
      selectedVariantId: variantId,
      selectedAlternativeId: alternativeId,
      selectedBranchId: null,
      selectedFaceIds: [alternativeId],
    });
  },

  selectSegment: (segmentId) => {
    const segment = get().document?.segments?.find((item) => item.id === segmentId);
    set({
      selection: segmentId ? { kind: 'SEGMENT', id: segmentId, position: segment?.startPosition } : null,
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
      selectedFaceIds: [],
    });
  },

  selectLine: (lineId, differenceId, position) =>
    set({
      selection: { kind: 'LINE', id: lineId, lineId, differenceId, position },
      selectedVariantId: differenceId ?? null,
      selectedAlternativeId: null,
      selectedBranchId: lineId,
    }),

  selectBranch: (branchId) =>
    set((state) => ({
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

    if (selection.kind === 'DIFFERENCE' || selection.kind === 'RULE') {
      const value = state.document.variants.find((item) => item.id === selection.id) ?? getEffectiveVariants(state.document).find((item) => item.id === selection.id);
      if (value) set({ clipboard: { kind: 'DIFFERENCE', value: structuredClone(value) } });
      // نسخ متعدد
      if (state.multiSelectedVariantIds.length > 1) {
        const values = state.multiSelectedVariantIds
          .map((id) => state.document!.variants.find((v) => v.id === id))
          .filter(Boolean) as Variant[];
        if (values.length > 1) set({ clipboard: { kind: 'DIFFERENCES', values: values.map((v) => structuredClone(v)) } });
      }
    } else if (selection.kind === 'FACE') {
      if (state.selectedFaceIds.length > 1 && selection.differenceId) {
        const parentId = selection.differenceId;
        const faces = state.selectedFaceIds
          .map((faceId) => {
            const face = state.document!.variants.find((v) => v.id === parentId)?.alternatives.find((a) => a.id === faceId);
            return face ? { face: structuredClone(face), parentId } : null;
          })
          .filter(Boolean) as Array<{ face: VariantAlternative; parentId: string }>;
        if (faces.length > 1) {
          set({ clipboard: { kind: 'FACES', values: faces } });
          return;
        }
      }
      if (selection.differenceId) {
        const value = state.document.variants.find((item) => item.id === selection.differenceId)?.alternatives.find((item) => item.id === selection.id);
        if (value) set({ clipboard: { kind: 'FACE', value: structuredClone(value), parentId: selection.differenceId } });
      }
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
    else if (selection.kind === 'FACE' && selection.differenceId) {
      if (get().selectedFaceIds.length > 1) {
        for (const faceId of get().selectedFaceIds) {
          get().deleteAlternative(selection.differenceId, faceId);
        }
      } else {
        get().deleteAlternative(selection.differenceId, selection.id);
      }
    } else if (selection.kind === 'SEGMENT') get().deleteSegment(selection.id);
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
        source: 'EDITOR',
        engineSnapshot: undefined,
        editorModifiedAt: undefined,
      } as any);
      get().selectVariant(id);
    } else if (clipboard.kind === 'DIFFERENCES') {
      const newIds: string[] = [];
      for (const src of clipboard.values) {
        const id = `v-copy-${suffix}-${Math.random().toString(36).slice(2, 4)}`;
        newIds.push(id);
        state.addVariant({
          ...structuredClone(src),
          id,
          title: `${src.title} — نسخة`,
          alternatives: src.alternatives.map((item, index) => ({ ...item, id: `${id}-face-${index + 1}-${suffix}` })),
          origin: 'EDITOR',
          source: 'EDITOR',
        } as any);
      }
      if (newIds[0]) get().selectVariant(newIds[0]);
    } else if (clipboard.kind === 'FACE' && state.selectedVariantId) {
      const face = structuredClone(clipboard.value);
      const id = `face-copy-${suffix}`;
      state.addAlternative(state.selectedVariantId, { ...face, id, isBase: false });
      get().selectAlternative(state.selectedVariantId, id);
    } else if (clipboard.kind === 'FACES' && state.selectedVariantId) {
      for (const item of clipboard.values) {
        const id = `face-copy-${suffix}-${Math.random().toString(36).slice(2, 4)}`;
        state.addAlternative(state.selectedVariantId, { ...structuredClone(item.face), id, isBase: false });
      }
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
          categories: exists ? state.filter.categories.filter((item) => item !== category) : [...state.filter.categories, category],
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
          narratorIds: exists ? state.filter.narratorIds.filter((item) => item !== narratorId) : [...state.filter.narratorIds, narratorId],
        },
      };
    });
  },

  togglePropertiesPanel: () => set((state) => ({ showPropertiesPanel: !state.showPropertiesPanel })),
  toggleVariantsPanel: () => set((state) => ({ showVariantsPanel: !state.showVariantsPanel })),
  setFocusMode: (value) => set({ focusMode: value }),
  setPinnedPanel: (panel, pinned) => set((state) => ({ pinnedPanels: { ...state.pinnedPanels, [panel]: pinned } })),

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

interface EditDescriptor {
  action: string;
  targetType: import('@/types/tashjeer').DocumentEditTargetType;
  targetId: string;
  summary: string;
  category?: VariantCategory;
  changes?: import('@/types/tashjeer').DocumentEditChange[];
}

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
  const next = withRegeneratedBranches(edit ? withLoggedEdit(updated, edit, current) : updated);
  set({
    past: pushHistory(state.past, current),
    future: [],
    document: next,
    isDirty: true,
  });
}

function withLoggedEdit(next: TashjeerDocument, edit: EditDescriptor, before: TashjeerDocument): TashjeerDocument {
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

function withRegeneratedBranches(document: TashjeerDocument): TashjeerDocument {
  return { ...document, branches: computeBranches(document, document.branches) };
}

function computeBranches(document: TashjeerDocument, existing: TashjeerBranch[]): TashjeerBranch[] {
  const words = documentWindowWords(document);
  if (words.length === 0) return existing;
  const layout = layoutAyah(document.ayahKey, words, document.layout);
  const engine = readEngineSettings();
  const effectiveVariants = getEffectiveVariants(document);
  return generateBranches(effectiveVariants, layout, existing, {
    catalog: readTransmissionCatalog(),
    traversal: engine.traversal,
    boundaries: document.boundaries,
    wordsCount: words.length,
  });
}

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

function compareVariants(a: Variant, b: Variant): number {
  if (typeof a.orderRank === 'number' && typeof b.orderRank === 'number' && a.orderRank !== b.orderRank) {
    return a.orderRank - b.orderRank;
  }
  if (typeof a.orderRank === 'number' && typeof b.orderRank !== 'number') return -1;
  if (typeof a.orderRank !== 'number' && typeof b.orderRank === 'number') return 1;
  if (a.endPosition !== b.endPosition) return b.endPosition - a.endPosition;
  if (a.startPosition !== b.startPosition) return b.startPosition - a.startPosition;
  return a.title.localeCompare(b.title, 'ar');
}

function pushHistory(past: TashjeerDocument[], document: TashjeerDocument): TashjeerDocument[] {
  return [...past, document].slice(-MAX_HISTORY);
}

function linkTargetTypeOf(kind: import('@/types/tashjeer').TashjeerLinkKind): import('@/types/tashjeer').DocumentEditTargetType {
  if (kind === 'FACE_TO_FACE') return 'FACE_LINK';
  if (kind === 'LINE_TO_LINE') return 'LINE_LINK';
  return 'SEGMENT';
}

function describeEndpoint(endpoint?: import('@/types/tashjeer').LinkEndpoint): string {
  if (!endpoint) return 'غير محدد';
  const labels: Record<string, string> = { FACE: 'وجه', LINE: 'سطر', SEGMENT: 'جزء', RULE: 'قاعدة' };
  return `${labels[endpoint.type] ?? endpoint.type} (${shortenId(endpoint.id)})`;
}

function shortenId(id: string): string {
  return id.length > 40 ? `${id.slice(0, 37)}…` : id;
}

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

export function getOpenAyahInfo(document: TashjeerDocument | null): { surahNumber: number; ayahNumber: number } | null {
  if (!document) return null;
  return parseAyahKey(document.ayahKey);
}

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
import { mergeLines, unmergeLines } from '@/lib/tashjeer/merge-operations';
import { resolveLineMerge } from '@/lib/tashjeer/decision/line-merge';
import { snapshotClipboard, pasteClipboard, clipboardCount, type EditorClipboard } from '@/lib/tashjeer/clipboard';
export type { EditorClipboard } from '@/lib/tashjeer/clipboard';
import { confirmAction } from '@/lib/ui/confirm-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { MultiSelection } from '@/lib/tashjeer/multi-selection';
import { deleteItems, deletionImpact } from '@/lib/tashjeer/bulk-operations';
import { applyLineRanks, captureLines } from '@/lib/tashjeer/line-operations';
import { generateClassicTashjeer, type ClassicLine } from '@/lib/tashjeer/classic-tashjeer';
import { readStrengthDegrees } from '@/lib/tashjeer/strength-degrees';
import { variantAppliesToRecitation } from '@/lib/tashjeer/reading-plan';
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
import { resolveLinkPolicy, type LinkPolicyDecision } from '@/lib/tashjeer/decision/editor-bridge';
import { loadEngineConfig } from '@/lib/tashjeer/engine-config-store';
import type { DecisionTraceStep } from '@/lib/tashjeer/decision/resolver';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateBranches } from '@/lib/tashjeer/branch-engine';
import { getEffectiveVariants, matchFromDerivedVariant } from '@/lib/quran-logic/global-rule-engine';
import { readTransmissionCatalog } from '@/lib/transmissions/catalog';
import { readEngineSettings } from '@/lib/tashjeer/engine-settings';
import { moveLineToIndex } from '@/lib/tashjeer/manual-links';
import {
  deleteOccurrence,
  exportOccurrenceData,
  overrideById,
  restoreOccurrence,
  restoreOccurrenceData,
  setLocalOverride,
  clearLocalOverride,
  setOccurrenceOrderRank,
  type LocalOverridePatch,
  type OccurrenceStoreShape,
} from '@/lib/storage/rule-occurrences-store';
import {
  exportGlobalRulesSnapshot,
  listGlobalRules,
  restoreGlobalRulesSnapshot,
  type GlobalRule,
} from '@/lib/storage/global-rules-store';
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

// ==================== سياق التحديد الموحّد (FR-ED-02) ====================
//
// «العنصر المحدد الآن» حقل `selection` أعلاه: مصدر حقيقة واحد تقرأه وتكتبه
// كل اللوحات. الكتابة تمر من مساعد واحد (`selectionWrite`) يحدّث الحقل،
// ويحتفظ بآخر تحديد صالح للعرض الرمادي، ويرفع طلب تركيز برقم متزايد تتفيعل
// له اللوحة (تمرير + تمييز ≤ 300ms) وكل اللوحات المفتوحة.

/** طلب تركيز واحد: كل كتابة تحديد تزيد `token` بمقدار واحد. */
export interface SelectionFocus {
  token: number;
  /** هل يُطلب وضع العنصر في منتصف منطقة الرؤية حيثما أمكن؟ */
  center: boolean;
  /** زمن الطلب، لقياس الالتزام بحد 300ms في التنقيح. */
  at: number;
}

/** خيارات كتابة التحديد الموحّدة. */
export interface SelectionWriteOptions {
  /** اجعل العنصر في منتصف الرؤية حيثما أمكن (افتراضيا true عند تحديد عنصر). */
  center?: boolean;
}

const INITIAL_SELECTION_FOCUS: SelectionFocus = { token: 0, center: false, at: 0 };

/**
 * الكتابة المركزية للتحديد — «قرار واحد في مكان واحد». كل إجراءات
 * select* تعود إليها، فلا لوحة تحتفظ بتحديد محلي مناقض ولا منطق مكرر.
 */
function selectionWrite(
  state: Pick<EditorState, 'selection' | 'selectionFocus'>,
  selection: EditorSelection | null,
  options?: SelectionWriteOptions
): Pick<EditorState, 'selection' | 'lastSelection' | 'selectionFocus'> {
  return {
    selection,
    // التحديد الجديد يصير «الأخير الصالح»؛ وعند التنظيف تبقى القديمة للعرض الرمادي.
    lastSelection: selection ?? state.selection,
    selectionFocus: {
      token: state.selectionFocus.token + 1,
      center: options?.center ?? selection !== null,
      at: Date.now(),
    },
  };
}

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

// ==================== تفضيلات مساحة العمل (FR-ED-01.4) ====================
//
// إظهار اللوحات وخيارات العرض (الشبكة/البطاقات/المساطر) تفضيلات شخصية لا
// تخص المستند، فتُحفظ محليا وتُستعاد عند فتح المحرر، ولا تدخل في التصدير.

export const WORKSPACE_PREFS_KEY = 'tashjeer:editor-workspace:v1';

interface WorkspacePrefs {
  showPropertiesPanel: boolean;
  showVariantsPanel: boolean;
  showLabels: boolean;
  showGrid: boolean;
  showRulers: boolean;
  showAnchors: boolean;
}

function readWorkspacePrefs(): Partial<WorkspacePrefs> {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(WORKSPACE_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkspacePrefs>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeWorkspacePrefs(state: Pick<EditorState, 'showPropertiesPanel' | 'showVariantsPanel' | 'filter'>): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  const prefs: WorkspacePrefs = {
    showPropertiesPanel: state.showPropertiesPanel,
    showVariantsPanel: state.showVariantsPanel,
    showLabels: state.filter.showLabels,
    showGrid: state.filter.showGrid,
    showRulers: state.filter.showRulers,
    showAnchors: state.filter.showAnchors,
  };
  try {
    window.localStorage.setItem(WORKSPACE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // امتلاء التخزين لا يعطل المحرر.
  }
}

const INITIAL_PREFS = readWorkspacePrefs();
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

/** قرار رابط يدوي كما يُعرض في الواجهة، مع أثره القابل للتفسير. */
export interface LinkDecisionNotice extends LinkPolicyDecision {
  linkId?: string;
  trace: DecisionTraceStep[];
  appliedRuleNames: string[];
  at: string;
}

/**
 * لقطة تراجع موحدة (FR-ED-10): المستند مع الاستثناءات والقواعد العامة
 * معًا، فالتراجع عن تحرير موضعي يعيد القيم الثلاث دفعة واحدة ولا يترك
 * أثرًا معلقًا في مخزن دون آخر.
 */
export interface EditorHistoryEntry {
  document: TashjeerDocument;
  occurrences: OccurrenceStoreShape;
  globalRules: GlobalRule[];
}

interface EditorState {
  // ---------- المستند ----------
  /** المستند المفتوح حاليا، أو null قبل التحميل */
  document: TashjeerDocument | null;
  /** هل توجد تعديلات غير محفوظة */
  isDirty: boolean;
  /** لقطات التراجع */
  past: EditorHistoryEntry[];
  /** لقطات الإعادة */
  future: EditorHistoryEntry[];

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
  /**
   * آخر تحديد صالح: يبقى بعد تنظيف تحديد عنصر حُذف حتى تُعرض سلسلة سياقه
   * رمادية بدل فراغ مفاجئ (قرار محسوم: تنظيف آمن بلا فقدان السياق).
   */
  lastSelection: EditorSelection | null;
  /**
   * طلب التركيز الموحّد (FR-ED-02.3): رقمه يزداد مع كل كتابة تحديد، فتتفاعل
   * اللوحة وكل اللوحات حتى لو لم يتغير العنصر نفسه. حالة واجهة صِرفة: لا
   * يدخل المستند ولا التصدير ولا التراجع.
   */
  selectionFocus: SelectionFocus;
  selectedWordId: number | null;
  selectedVariantId: string | null;
  selectedAlternativeId: string | null;
  selectedBranchId: string | null;
  clipboard: EditorClipboard;
  multiSelection: MultiSelection | null;
  setMultiSelection: (selection: MultiSelection | null) => void;
  requestDeleteItems: (selection: MultiSelection) => Promise<boolean>;
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
  /**
   * معاملة خارجية (FR-ED-10): تغيير في مخزن الاستثناءات أو القواعد العامة
   * يُنفَّذ داخل لقطة تراجع موحدة مع سطر تتبع في سجل المستند، فالتراجع
   * يعيد المستند والمخازن معًا.
   */
  transactExternal: (edit: EditDescriptor, fn: () => void) => void;
  /** يثبّت ترقيعًا محليًا على موضع مشتق من قاعدة عامة (FR-ED-10/T2). */
  setDerivedLocalOverride: (variantId: string, patch: LocalOverridePatch) => void;
  /** يلغي التجاوز المحلي لموضع مشتق فيعود مشتقًا خالصًا من قاعدته. */
  clearDerivedLocalOverride: (variantId: string, note?: string) => void;
  /** يحذف موضعًا واحدًا من قاعدة عامة دون المساس بسائر المواضع. */
  deleteDerivedOccurrence: (variantId: string, reason?: string) => void;
  /** يرجع موضعًا محذوفًا من قاعدة عامة. */
  restoreDerivedOccurrence: (variantId: string) => void;
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
  /**
   * آخر قرار أصدره Decision Resolver على رابط يدوي (مقبول/مرفوض/بتحذير)،
   * تعرضه لوحة العلاقات مع أثره (Why؟) بدل أن تحسم شيئا بنفسها (P-07).
   */
  lastLinkDecision: LinkDecisionNotice | null;
  clearLinkDecision: () => void;
  requestMergeLines: (rendered: ClassicLine[], fromId: string, toId: string) => Promise<string>;
  requestUnmergeLines: (relationId: string) => Promise<string>;
  /**
   * طلب فتح حوار «لماذا؟» من رابط عميق (/editor?ayah=&variant=&why=1) أو من
   * صفحة التتبع؛ لوحة الخصائص تستهلكه وتصفّره. قد يحمل معرّف قاعدة استوديو
   * لإبرازها في الأثر.
   */
  pendingWhy: { ruleId?: string } | null;
  requestWhy: (request: { ruleId?: string } | null) => void;
  /**
   * عدّاد طلبات فتح المعالج الذكي (FR-ED-08/T3): الاختصار N أو أي زر «إنشاء»
   * عام يرفعه، ولوحة الاختلافات تستهلكه فتفتح المعالج على التحديد الحالي —
   * باب إنشاء واحد لا أبواب متفرقة.
   */
  smartWizardRequest: number;
  requestSmartWizard: () => void;
  /**
   * ينشئ علاقة يدوية بين عنصرين: وجهين، سطرين، أو جزء وسطر/قاعدة.
   * يمرّ أولا على Decision Resolver: الرابط المحظور بقاعدة لا يُسجَّل، والمخالف
   * لمصفوفة الدمج يُسجَّل بتحذير (المحرر يقرر). يعيد القرار للمستدعي.
   */
  addLink: (link: {
    kind: TashjeerLinkKind;
    relation: TashjeerLinkRelation;
    from: LinkEndpoint;
    to: LinkEndpoint;
    notes?: string;
  }) => LinkDecisionNotice;
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
  setLineOrder: (order: string[], rendered?: ClassicLine[]) => void;
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
  /**
   * تحديد قاعدة عامة ككيان مستقل (FR-ED-15): نفس الـID الذي تستعمله كل
   * الواجهات (قائمة الاختلافات، التتبع، الفهرس). لا يمس selectedVariantId
   * كيلا يُفقد اختلاف محدد آخر.
   */
  selectRule: (ruleId: string | null) => void;
  selectAlternative: (variantId: string, alternativeId: string) => void;
  selectSegment: (segmentId: string | null) => void;
  selectLine: (lineId: string, differenceId?: string, position?: number) => void;
  selectBranch: (branchId: string | null) => void;
  /**
   * الكتابة الموحّدة للتحديد لأنواع لا يملكها إجراء مخصص (حرف، موضع، وجه
   * مركب، علامة وقف، قاعدة استوديو). كل اللوحات تستعملها عبر واجهة
   * `lib/editor/selection-store.ts` حتى يبقى القرار في مكان واحد.
   */
  setSelection: (selection: EditorSelection | null, options?: SelectionWriteOptions) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: () => void;
  requestPasteSelection: () => Promise<void>;
  clipboardNotice: string;
  /** ينسخ عدة أوجه من موضع واحد (تحديد بالنقر + Shift/Ctrl) — FR-ED-06. */
  copyFaces: (variantId: string, faceIds: string[]) => void;
  /**
   * ينسخ سطرا كاملا: كل الاختلافات التي يمر بها السطر بأوجهها التي تخص
   * قرّاءه. اللصق ينشئ نسخا مستقلة بمعرّفات جديدة (FR-ED-06.2).
   */
  copyLine: (lineId: string, label: string, variantIds: string[]) => void;
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
  filter: {
    ...DEFAULT_FILTER,
    showLabels: bool(INITIAL_PREFS.showLabels, DEFAULT_FILTER.showLabels),
    showGrid: bool(INITIAL_PREFS.showGrid, DEFAULT_FILTER.showGrid),
    showRulers: bool(INITIAL_PREFS.showRulers, DEFAULT_FILTER.showRulers),
    showAnchors: bool(INITIAL_PREFS.showAnchors, DEFAULT_FILTER.showAnchors),
  },
  showPropertiesPanel: bool(INITIAL_PREFS.showPropertiesPanel, true),
  showVariantsPanel: bool(INITIAL_PREFS.showVariantsPanel, true),

  markedPositions: [],
  markedCharacters: [],
  markingMode: 'WORDS',
  selection: null,
  lastSelection: null,
  selectionFocus: INITIAL_SELECTION_FOCUS,
  selectedWordId: null,
  selectedVariantId: null,
  selectedAlternativeId: null,
  selectedBranchId: null,
  clipboard: null,
  clipboardNotice: '',
  multiSelection: null,
  setMultiSelection: (multiSelection) => set({ multiSelection }),
  lastLinkDecision: null,
  pendingWhy: null,
  smartWizardRequest: 0,
  currentTool: 'select',
  draftCategory: 'FARSH',

  // ==================== المستند ====================

  openAyah: (ayahKey) => {
    const document = loadOrCreateDocument(ayahKey);
    const withBranches = withRegeneratedBranches(document);

    set((state) => ({
      document: withBranches,
      multiSelection: null,
      isDirty: false,
      past: [],
      future: [],
      markedPositions: [],
      markedCharacters: [],
      ...selectionWrite(state, null, { center: false }),
      // سلسلة «آخر تحديد» تخص آيتها؛ بفتح آية أخرى يُصفَّر كليا فلا يُعرض
      // تحديد قديم تحت مرجع آية جديدة.
      lastSelection: null,
      selectedWordId: null,
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
    }));
  },

  resetAyah: () => {
    const current = get().document;
    if (!current) return;

    const fresh = withRegeneratedBranches(createDocument(current.ayahKey, current.meta.author));
    const entry = captureHistoryEntry(current);
    set((state) => ({
      past: pushHistory(state.past, entry),
      future: [],
      document: fresh,
      multiSelection: null,
      isDirty: true,
      markedPositions: [],
      markedCharacters: [],
      ...selectionWrite(state, null, { center: false }),
      lastSelection: null,
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
    const current = get().document;
    set((state) => ({
      past: current ? pushHistory(state.past, captureHistoryEntry(current)) : state.past,
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
    // تنظيف آمن للتحديد الموحّد: يبقى آخر تحديد صالح للعرض الرمادي (قرار محسوم).
    set((state) => ({
      ...selectionWrite(state, null, { center: false }),
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
    }));
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
    const selection: MultiSelection = { kind: 'FACE', ownerId: variantId, ids: [alternativeId] };
    const owner = get().document?.variants.find((item) => item.id === variantId);
    const face = owner?.alternatives.find((item) => item.id === alternativeId);
    mutate(set, get, (document) => deleteItems(document, selection), {
      action: 'حذف وجه',
      targetType: 'ALTERNATIVE',
      targetId: alternativeId,
      category: owner?.category,
      summary: `حذف المحرر وجها («${face?.label ?? alternativeId}») من «${owner?.title ?? variantId}»`,
    });
    set({ multiSelection: null, selection: null, selectedAlternativeId: null });
  },

  deleteAlternativesBulk: (variantId, alternativeIds) => {
    const selection: MultiSelection = { kind: 'FACE', ownerId: variantId, ids: alternativeIds };
    mutate(set, get, (document) => deleteItems(document, selection), {
      action: 'حذف جماعي للأوجه', targetType: 'ALTERNATIVE', targetId: alternativeIds.join(','),
      summary: `حذف المحرر ${toArabicDigits(alternativeIds.length)} أوجه دفعة واحدة`,
      changes: [{ field: 'alternatives', before: get().document?.variants.find((item) => item.id === variantId)?.alternatives, after: get().document?.variants.find((item) => item.id === variantId)?.alternatives.filter((item) => !alternativeIds.includes(item.id)) }],
    });
    set({ multiSelection: null, selection: null, selectedAlternativeId: null });
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
            summary: `حذف المحرر ${toArabicDigits(variantIds.length)} اختلافًا دفعة واحدة`,
          },
          document
        );
      },
    );
    set((state) => ({
      ...selectionWrite(
        state,
        state.selectedVariantId && doomed.has(state.selectedVariantId) ? null : state.selection,
        { center: false }
      ),
      selectedVariantId: state.selectedVariantId && doomed.has(state.selectedVariantId) ? null : state.selectedVariantId,
      selectedAlternativeId: state.selectedVariantId && doomed.has(state.selectedVariantId) ? null : state.selectedAlternativeId,
    }));
  },

  /**
   * بوابة الحذف الموحّدة (FR-ED-04.2/NFR-05): تأكيد كمي بالأثر الحقيقي
   * (اختلافات/أوجه/روابط)، ثم تنفيذ ذري داخل التراجع. ترجع false عند الإلغاء.
   */
  requestDeleteItems: (selection) => {
    const document = get().document;
    if (!document) return Promise.resolve(false);
    const impact = deletionImpact(document, selection);
    if (impact.count === 0) return Promise.resolve(false);
    const category =
      selection.kind === 'DIFFERENCE'
        ? impact.differences[0]?.category
        : document.variants.find((item) => item.id === selection.ownerId)?.category;
    const headCount = selection.kind === 'DIFFERENCE' ? impact.differences.length : impact.faces.length;
    const impacts =
      selection.kind === 'DIFFERENCE'
        ? [
            { label: 'اختلاف', count: impact.differences.length },
            { label: 'رابط يدوي', count: impact.links.length },
            { label: 'وجه', count: impact.faces.length },
          ]
        : [
            { label: 'وجه', count: impact.faces.length },
            { label: 'رابط يدوي', count: impact.links.length },
          ];
    return confirmAction({
      title:
        selection.kind === 'DIFFERENCE'
          ? `حذف ${toArabicDigits(headCount)} اختلافات؟`
          : `حذف ${toArabicDigits(headCount)} أوجه؟`,
      message:
        selection.kind === 'DIFFERENCE'
          ? 'يُحذف كل اختلاف بما يليه من أوجه وخطوط، وتُزال الروابط اليدوية المتصلة.'
          : `تُحذف الأوجه من الاختلاف «${document.variants.find((item) => item.id === selection.ownerId)?.title ?? ''}» مع ما يتعلق بها من روابط.`,
      impacts,
      undoable: true,
      confirmLabel: 'حذف',
      tone: 'danger',
    }).then((ok) => {
      if (!ok) return false;
      mutate(set, get, (current) => deleteItems(current, selection), {
        action: selection.kind === 'DIFFERENCE' ? 'حذف اختلافات' : 'حذف أوجه',
        targetType: selection.kind === 'DIFFERENCE' ? 'VARIANT' : 'ALTERNATIVE',
        targetId: selection.ids.join(','),
        category,
        summary: `حذف المحرر ${toArabicDigits(impact.count)} عنصرًا (${impact.differences.length} اختلافًا و${impact.faces.length} وجهًا)`,
      });
      set((state) => ({
        multiSelection: null,
        ...selectionWrite(
          state,
          state.selection &&
          ((selection.kind === 'DIFFERENCE' && selection.ids.includes(state.selection.id)) ||
            (selection.kind === 'FACE' && state.selection.kind === 'FACE' && state.selection.differenceId === selection.ownerId && selection.ids.includes(state.selection.faceId ?? state.selection.id)))
            ? null
            : state.selection,
          { center: false }
        ),
        selectedVariantId:
          selection.kind === 'DIFFERENCE' && state.selectedVariantId && selection.ids.includes(state.selectedVariantId)
            ? null
            : state.selectedVariantId,
        selectedAlternativeId:
          selection.kind === 'FACE' && state.selectedAlternativeId && selection.ids.includes(state.selectedAlternativeId)
            ? null
            : state.selectedAlternativeId,
      }));
      return true;
    });
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

    get().transactExternal(
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
      },
      () => setOccurrenceOrderRank(derived.globalRuleId!, match, rank)
    );
  },

  transactExternal: (edit, fn) => {
    const state = get();
    const current = state.document;
    if (!current) {
      // بلا مستند مفتوح لا لقطة تراجع؛ يُنفَّذ التغيير وحده (صفحة المكتبة).
      fn();
      return;
    }
    // اللقطة قبل التنفيذ لا بعده، وإلا حفظ التراجع الحالة الجديدة نفسها.
    const entry = captureHistoryEntry(current);
    fn();
    set({
      past: pushHistory(state.past, entry),
      future: [],
      document: withRegeneratedBranches(withLoggedEdit({ ...current }, edit, current)),
      isDirty: true,
    });
  },

  setDerivedLocalOverride: (variantId, patch) => {
    const document = get().document;
    if (!document) return;
    const derived = getEffectiveVariants(document).find((variant) => variant.id === variantId);
    if (!derived?.globalRuleId) return;
    const match = matchFromDerivedVariant(derived);
    if (!match) return;

    get().transactExternal(
      {
        action: 'تجاوز محلي لموضع قاعدة',
        targetType: 'RULE',
        targetId: variantId,
        category: derived.category,
        summary: `تجاوز محلي للموضع «${derived.title}» في هذه الآية وحدها`,
        changes: Object.entries(patch).map(([field, after]) => ({ field, after })),
      },
      () => setLocalOverride(derived.globalRuleId!, match, patch)
    );
  },

  clearDerivedLocalOverride: (variantId, note) => {
    const document = get().document;
    if (!document) return;
    const derived = getEffectiveVariants(document).find((variant) => variant.id === variantId);
    if (!derived?.globalRuleId) return;

    get().transactExternal(
      {
        action: 'إلغاء التجاوز المحلي',
        targetType: 'RULE',
        targetId: variantId,
        category: derived.category,
        summary: `إلغاء التجاوز المحلي للموضع «${derived.title}»: عودة إلى قيم القاعدة الأمّ`,
      },
      () => clearLocalOverride(variantId, note)
    );
  },

  deleteDerivedOccurrence: (variantId, reason) => {
    const document = get().document;
    if (!document) return;
    const derived = getEffectiveVariants(document).find((variant) => variant.id === variantId);
    if (!derived?.globalRuleId) return;
    const match = matchFromDerivedVariant(derived);
    if (!match) return;

    get().transactExternal(
      {
        action: 'حذف موضعي من قاعدة',
        targetType: 'RULE',
        targetId: variantId,
        category: derived.category,
        summary: `حذف الموضع «${derived.title}» من هذه الآية وحدها (القاعدة باقية)`,
      },
      () => deleteOccurrence(derived.globalRuleId!, match, reason)
    );
  },

  restoreDerivedOccurrence: (variantId) => {
    const document = get().document;
    if (!document) return;
    const override = overrideById(variantId);
    if (!override) return;
    const ruleTitle = listGlobalRules().find((rule) => rule.id === override.ruleId)?.title ?? override.ruleId;

    get().transactExternal(
      {
        action: 'إرجاع موضع محذوف',
        targetType: 'RULE',
        targetId: variantId,
        summary: `إرجاع الموضع «${override.matchedText ?? ''}» من قاعدة «${ruleTitle}»`,
      },
      () => restoreOccurrence(variantId)
    );
  },

  moveAlternative: (variantId, alternativeId, delta) => {
    // نقل وجه داخل موضعه عملية يدوية تُتبع (الحزم 04–08): تسجَّل في سجل
    // التعديل حتى يراها التتبع الموحّد كحدث «نقل».
    mutate(set, get, (document) => {
      const owner = document.variants.find((variant) => variant.id === variantId);
      if (!owner) return document;

      // نبني الترتيب الصريح من الترتيب الظاهر الآن، ثم ننقل الوجه فيه.
      // هكذا لا يقفز بقية الأوجه عند أول نقلة يدوية.
      const current = orderedAlternativeIds(owner);
      const index = current.indexOf(alternativeId);
      const target = index + delta;
      if (index === -1 || target < 0 || target >= current.length) return document;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      const face = owner.alternatives.find((item) => item.id === alternativeId);
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants.map((variant) =>
            variant.id === variantId ? { ...variant, alternativeOrder: next } : variant
          ),
        },
        {
          action: 'نقل وجه داخل الموضع',
          targetType: 'ALTERNATIVE_ORDER',
          targetId: variantId,
          category: owner.category,
          summary: `نقل المحرر الوجه «${face?.label ?? alternativeId}» داخل الموضع «${owner.title}»`,
        },
        document
      );
    });
  },

  resetAlternativeOrder: (variantId) => {
    mutate(set, get, (document) => {
      const owner = document.variants.find((variant) => variant.id === variantId);
      if (!owner || !owner.alternativeOrder) return document;
      return withLoggedEdit(
        {
          ...document,
          variants: document.variants.map((variant) =>
            variant.id === variantId ? { ...variant, alternativeOrder: undefined } : variant
          ),
        },
        {
          action: 'إعادة ترتيب الأوجه إلى قاعدة المحرك',
          targetType: 'ALTERNATIVE_ORDER',
          targetId: variantId,
          category: owner.category,
          summary: `أعاد المحرر ترتيب أوجه «${owner.title}» إلى قاعدة المحرك`,
        },
        document
      );
    });
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

  requestMergeLines: async (rendered, fromId, toId) => {
    const document = get().document;
    const from = rendered.find((line) => line.id === fromId), to = rendered.find((line) => line.id === toId);
    if (!document || !from || !to || fromId === toId) return 'اختر سطرين مختلفين.';
    const profile = loadEngineConfig();
    const policy = resolveLineMerge(from, to, profile);
    const reason = policy.reasons.join('؛ ');
    const accepted = await confirmAction({
      title: policy.allowed ? 'دمج هذا السطر مع السطر المحدد؟' : 'السياسة تمنع الدمج — هل تريد تجاوزًا يدويًا موثقًا؟',
      message: toArabicDigits(`«${from.label}» مع «${to.label}». ${policy.allowed ? 'تُحفظ الأصول في سجل الدمج، ويمكن الفك أو التراجع.' : reason + '؛ القواعد: ' + policy.ruleNames.join('، ') + '. التأكيد ينشئ Correction بسبب التجاوز.'}`),
      impacts: [{ label: 'أسطر', count: 2 }, { label: 'أجزاء', count: from.entries.length + to.entries.length }, { label: 'أوجه فريدة', count: new Set([...from.entries, ...to.entries].map((entry) => `${entry.variantId}::${entry.alternativeId}`)).size }],
      undoable: true, confirmLabel: policy.allowed ? 'تأكيد' : 'تجاوز بقرار يدوي موثق', tone: 'default',
    });
    if (!accepted) return 'أُلغي الدمج؛ لم تتغير البيانات.';
    if (get().document !== document || JSON.stringify(loadEngineConfig()) !== JSON.stringify(profile)) return 'تغيّر المستند أو السياسة أثناء التأكيد؛ أعد الطلب.';
    const result = mergeLines(document, rendered, fromId, toId, profile, policy.allowed ? undefined : `تجاوز يدوي صريح من المحرر: ${reason}`);
    if (result.error) return result.error;
    mutate(set, get, () => result.document, { action: 'دمج سطرين', targetType: 'LINE_LINK', targetId: fromId,
      summary: 'دمج بالسحب مع حفظ الأصلين والعلاقات', changes: [{ field: 'lines', before: document.lines ?? captureLines(document, rendered), after: result.document.lines }, { field: 'decision', after: policy }],
    });
    set({ lastLinkDecision: { allowed: true, reason: policy.allowed ? 'دمج مسموح' : 'تجاوز يدوي موثق', warning: policy.allowed ? undefined : reason, trace: policy.trace, appliedRuleNames: policy.ruleNames, at: new Date().toISOString() } });
    return 'تم الدمج. الأصلان محفوظان؛ يمكن التراجع أو الفك من قائمة العلاقات.';
  },
  requestUnmergeLines: async (relationId) => {
    const document = get().document;
    if (!document) return 'لا مستند.';
    const result = unmergeLines(document, relationId);
    if (result.error) return result.error;
    if (!await confirmAction({ title: 'فك الدمج وإعادة الأصلين؟', impacts: [{ label: 'أسطر', count: 2 }], undoable: true, tone: 'default' })) return 'أُلغي الفك.';
    if (get().document !== document) return 'تغيّر المستند؛ أعد الطلب.';
    mutate(set, get, () => result.document, { action: 'فك دمج سطرين', targetType: 'LINE_LINK', targetId: relationId, summary: 'استعادة الأصلين من سجل الدمج', changes: [{ field: 'lines', before: document.lines, after: result.document.lines }] });
    return 'أُعيد الأصلان؛ يمكن التراجع عن الفك.';
  },

  clearLinkDecision: () => set({ lastLinkDecision: null }),
  requestWhy: (request) => set({ pendingWhy: request }),
  requestSmartWizard: () => set((state) => ({ smartWizardRequest: state.smartWizardRequest + 1 })),

  addLink: ({ kind, relation, from, to, notes }) => {
    const current = get().document;
    const rejected = (reason: string): LinkDecisionNotice => ({
      allowed: false,
      reason,
      trace: [],
      appliedRuleNames: [],
      at: new Date().toISOString(),
    });
    if (!current) return rejected('لا مستند مفتوح.');

    // القرار أولا (P-07): فئتا الطرفين إن كانا وجهين، لتقييم مصفوفة الدمج.
    const categoryOfEndpoint = (endpoint: LinkEndpoint): VariantCategory | undefined => {
      if (endpoint.type !== 'FACE') return undefined;
      const variantId = endpoint.id.split('::')[0];
      return current.variants.find((variant) => variant.id === variantId)?.category;
    };
    const policy = resolveLinkPolicy(
      {
        kind,
        relation,
        from,
        to,
        fromCategory: categoryOfEndpoint(from),
        toCategory: categoryOfEndpoint(to),
      },
      loadEngineConfig()
    );
    const notice: LinkDecisionNotice = {
      ...policy.decision,
      trace: policy.trace,
      appliedRuleNames: policy.appliedRules.map((rule) => rule.name),
      at: new Date().toISOString(),
    };
    if (!policy.decision.allowed) {
      set({ lastLinkDecision: notice });
      return notice;
    }

    const id = `link-${current.ayahKey}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    mutate(set, get, (document) => {
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
          summary:
            `${relation === 'MERGE' ? 'دمج' : 'ربط'} ${describeEndpoint(from)} مع ${describeEndpoint(to)}` +
            (policy.decision.warning ? ` (بخلاف سياسة المحرك)` : ''),
        },
        document
      );
    });
    const done = { ...notice, linkId: id };
    set({ lastLinkDecision: done });
    return done;
  },

  updateLink: (linkId, patch) => {
    if (get().document?.mergeRecords?.some((record) => record.relationId === linkId && !record.restoredAt)) return;
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
    if (get().document?.mergeRecords?.some((record) => record.relationId === linkId && !record.restoredAt)) return;
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
    // تحديد جزء محذوف يُنظَّف بأمان مع إبقاء سلسلة السياق الأخيرة (قرار محسوم).
    set((state) =>
      state.selection?.kind === 'SEGMENT' && state.selection.id === segmentId
        ? selectionWrite(state, null, { center: false })
        : {}
    );
  },

  setLineOrder: (order, rendered) => {
    mutate(set, get, (document) => {
      const before = document.lineOrder ?? [];
      if (arraysEqual(before, order)) return document;
      const previousLines = rendered ? captureLines(document, rendered) : document.lines ?? [];
      const lines = applyLineRanks(previousLines, order.length ? order : rendered?.map((line) => line.id) ?? []);
      return withLoggedEdit(
        { ...document, lineOrder: [...order], lines },
        {
          action: 'ترتيب الأسطر يدويا',
          targetType: 'LINE_ORDER',
          targetId: String(document.ayahKey),
          summary:
            order.length === 0
              ? 'إعادة الترتيب إلى قاعدة المحرك'
              : `تثبيت ترتيب ${toArabicDigits(order.length)} سطرا يدويا`,
          changes: [{ field: 'lineOrder', before, after: [...order] }, { field: 'lines', before: previousLines, after: lines }],
        },
        document
      );
    });
  },

  moveLineInOrder: (currentLineIds, lineId, targetIndex) => {
    get().setLineOrder(moveLineToIndex(currentLineIds, lineId, targetIndex));
  },

  resetLineOrder: () => {
    const document = get().document;
    if (!document) return;
    const words = documentWindowWords(document);
    const layout = layoutAyah(document.ayahKey, words, document.layout);
    const engineLines = generateClassicTashjeer(
      getEffectiveVariants(document).filter((variant) => variantAppliesToRecitation(variant, document.boundaries)),
      layout, DEFAULT_FILTER, document.layout, {
        catalog: readTransmissionCatalog(), engine: readEngineSettings(), engineConfig: loadEngineConfig(), strengthDegrees: readStrengthDegrees(),
        boundaries: document.boundaries, branchOverrides: document.branches, manualLines: document.manualLines,
        links: document.links ?? [], segments: document.segments ?? [], lineOrder: [], focusSegment: document.readingWindow?.focusSegment ?? null,
      }
    ).lines;
    get().setLineOrder([], engineLines);
  },

  // ==================== الوقف والابتداء وتخطيط النص ====================

  addBoundary: (boundary) => {
    // علامات الوقف/الوصل أحداث تتبع (الحزم 04–08): تسجَّل في سجل التعديل
    // بفئة WAQF حتى تظهر في التتبع الموحّد وتصنّف معه.
    mutate(set, get, (document) => ({
      ...document,
      boundaries: [...document.boundaries, boundary].sort((first, second) => first.position - second.position),
    }), {
      action: boundaryActionLabel(boundary.kind),
      targetType: 'BOUNDARY',
      targetId: boundary.id,
      category: 'WAQF',
      summary: `${boundaryActionLabel(boundary.kind)} عند الكلمة ${boundary.position}`,
    });
  },

  updateBoundary: (boundaryId, patch) => {
    mutate(set, get, (document) => {
      const before = document.boundaries.find((boundary) => boundary.id === boundaryId);
      if (!before) return document;
      return withLoggedEdit(
        {
          ...document,
          boundaries: document.boundaries
            .map((boundary) => (boundary.id === boundaryId ? { ...boundary, ...patch } : boundary))
            .sort((first, second) => first.position - second.position),
        },
        {
          action: 'تعديل علامة وقف/وصل',
          targetType: 'BOUNDARY',
          targetId: boundaryId,
          category: 'WAQF',
          summary: `تعديل علامة (${boundaryLabelOf(before.kind)}) عند الكلمة ${before.position}: ${Object.keys(patch).join('، ')}`,
          changes: Object.entries(patch).map(([field, after]) => ({
            field,
            before: (before as unknown as Record<string, unknown>)[field],
            after,
          })),
        },
        document
      );
    });
  },

  deleteBoundary: (boundaryId) => {
    mutate(set, get, (document) => {
      const before = document.boundaries.find((boundary) => boundary.id === boundaryId);
      if (!before) return document;
      return withLoggedEdit(
        {
          ...document,
          boundaries: document.boundaries.filter((boundary) => boundary.id !== boundaryId),
        },
        {
          action: 'حذف علامة وقف/وصل',
          targetType: 'BOUNDARY',
          targetId: boundaryId,
          category: 'WAQF',
          summary: `حذف المحرر علامة (${boundaryLabelOf(before.kind)}) عند الكلمة ${before.position}`,
        },
        document
      );
    });
    // المحذوف قد يكون المحدد الحالي (WAQF_MARK): يُصفَّر التحديد معه.
    set((state) =>
      state.selection?.kind === 'WAQF_MARK' && state.selection.id === boundaryId
        ? selectionWrite(state, null, { center: false })
        : {}
    );
  },

  setLinkNextAyah: (linked) => {
    // وصل/فك وصل نافذة القراءة حدث تتبع (الحزم 04–08): يسجَّل بفئة WAQF.
    const targetId = String(get().document?.ayahKey ?? '');
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
    }, {
      action: linked ? 'وصل الآية بالآية التالية' : 'فك وصل الآية عن التالية',
      targetType: 'WINDOW',
      targetId,
      category: 'WAQF',
      summary: linked
        ? 'وصل المحرر الآية بالآية التالية في نافذة عمل واحدة'
        : 'فك المحرر وصل الآية عن الآية التالية',
    });
    set({ selectedWordId: null, markedPositions: [], markedCharacters: [] });
  },

  setFocusSegment: (segment) => {
    const targetId = String(get().document?.ayahKey ?? '');
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
    }), {
      action: segment ? 'حصر التشجير في مقطع' : 'إلغاء حصر المقطع',
      targetType: 'WINDOW',
      targetId,
      category: 'WAQF',
      summary: segment
        ? `حصر المحرر التشجير في المقطع ${segment.startPosition}–${segment.endPosition}`
        : 'أعاد المحرر تشجير الآية كاملة بلا حصر',
    });
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
    set((state) => ({
      ...selectionWrite(state, wordId ? { kind: 'WORD', id: String(wordId), position: word?.position } : null),
      selectedWordId: wordId,
      selectedAlternativeId: null,
    }));
  },
  selectVariant: (variantId) => {
    const currentDocument = get().document;
    const variant = variantId && currentDocument
      ? getEffectiveVariants(currentDocument).find((item) => item.id === variantId)
      : undefined;
    set((state) => ({
      ...selectionWrite(
        state,
        variantId
          ? { kind: variant?.isGlobalDerived ? 'RULE' : 'DIFFERENCE', id: variantId, differenceId: variantId, position: variant?.startPosition }
          : null
      ),
      selectedVariantId: variantId,
      selectedAlternativeId: null,
      selectedBranchId: null,
    }));
  },
  selectRule: (ruleId) => {
    set({
      selection: ruleId ? { kind: 'RULE', id: ruleId } : null,
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
      selectedWordId: null,
    });
  },
  selectAlternative: (variantId, alternativeId) => {
    const currentDocument = get().document;
    const variant = currentDocument
      ? getEffectiveVariants(currentDocument).find((item) => item.id === variantId)
      : undefined;
    set((state) => ({
      ...selectionWrite(
        state,
        { kind: 'FACE', id: alternativeId, differenceId: variantId, faceId: alternativeId, position: variant?.startPosition }
      ),
      selectedVariantId: variantId,
      selectedAlternativeId: alternativeId,
      selectedBranchId: null,
    }));
  },
  selectSegment: (segmentId) => {
    const segment = get().document?.segments?.find((item) => item.id === segmentId);
    set((state) => ({
      ...selectionWrite(
        state,
        segmentId ? { kind: 'SEGMENT', id: segmentId, position: segment?.startPosition } : null
      ),
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
    }));
  },
  selectLine: (lineId, differenceId, position) =>
    set((state) => ({
      ...selectionWrite(state, { kind: 'LINE', id: lineId, lineId, differenceId, position }),
      selectedVariantId: differenceId ?? null,
      selectedAlternativeId: null,
      selectedBranchId: lineId,
    })),
  selectBranch: (branchId) => set((state) => ({
    selectedBranchId: branchId,
    ...selectionWrite(
      state,
      branchId
        ? { kind: 'LINE', id: branchId, lineId: branchId, differenceId: state.selectedVariantId ?? undefined }
        : state.selectedVariantId
          ? { kind: 'DIFFERENCE', id: state.selectedVariantId, differenceId: state.selectedVariantId }
          : null
    ),
  })),
  setSelection: (selection, options) =>
    set((state) => ({
      ...selectionWrite(state, selection, options),
      // مرايا التوافق مع اللوحات القائمة تُشتق هنا من كتابة واحدة، فلا لوحة
      // تحتفظ بتحديد محلي مناقض (القرار في مكان واحد).
      ...(selection?.kind === 'WORD'
        ? { selectedWordId: Number(selection.id) }
        : selection?.kind === 'CHARACTER' && selection.wordId
          ? { selectedWordId: selection.wordId }
          : {}),
      ...(selection?.kind === 'DIFFERENCE' || selection?.kind === 'RULE'
        ? { selectedVariantId: selection.id, selectedAlternativeId: null, selectedBranchId: null }
        : {}),
      ...(selection?.kind === 'FACE'
        ? { selectedVariantId: selection.differenceId ?? null, selectedAlternativeId: selection.faceId ?? selection.id, selectedBranchId: null }
        : {}),
      ...(selection?.kind === 'LINE'
        ? { selectedVariantId: selection.differenceId ?? null, selectedAlternativeId: null, selectedBranchId: selection.lineId ?? selection.id }
        : {}),
    })),
  copySelection: () => {
    const state = get();
    set({ clipboard: null }); const doc = state.document; const selection = state.selection;
    if (!doc) return;
    const multi = state.multiSelection;
    if (multi?.kind === 'FACE' && multi.ownerId && multi.ids.length) { state.copyFaces(multi.ownerId, multi.ids); return; }
    if (multi?.kind === 'DIFFERENCE' && multi.ids.length > 0) {
      const value = doc.variants.filter((item) => multi.ids.includes(item.id));
      if (value.length) set({ clipboard: snapshotClipboard(doc, value.length === 1 ? { kind: 'DIFFERENCE', value: value[0] } : { kind: 'DIFFERENCES', value }), clipboardNotice: 'نُسخت الاختلافات المحددة.' });
      return;
    }
    if (!selection) return;
    if (selection.kind === 'DIFFERENCE') {
      const value = doc.variants.find((item) => item.id === selection.id);
      if (value) set({ clipboard: snapshotClipboard(doc, { kind: 'DIFFERENCE', value }), clipboardNotice: 'نُسخ الاختلاف.' });
    } else if (selection.kind === 'FACE' && selection.differenceId) {
      state.copyFaces(selection.differenceId, [selection.id]);
    } else if (selection.kind === 'SEGMENT') {
      const value = doc.segments?.find((item) => item.id === selection.id);
      if (value) set({ clipboard: snapshotClipboard(doc, { kind: 'SEGMENT', value }), clipboardNotice: 'نُسخ الجزء.' });
    } else {
      set({ clipboard: null, clipboardNotice: 'النسخ بهذا المستوى غير متاح بعد؛ حُفظت البيانات دون تغيير.' });
    }
  },
  copyFaces: (variantId, faceIds) => {
    const doc = get().document;
    if (!doc) return;
    const faces = doc.variants.find((item) => item.id === variantId)?.alternatives.filter((item) => faceIds.includes(item.id)) ?? [];
    if (!faces.length) return;
    set({ clipboard: snapshotClipboard(doc, faces.length === 1 ? { kind: 'FACE', value: faces[0], sourceVariantId: variantId } : { kind: 'FACES', value: faces, sourceVariantId: variantId }), clipboardNotice: `نُسخ ${toArabicDigits(faces.length)} أوجه.` });
  },
  copyLine: (lineId, label, variantIds) => {
    const doc = get().document;
    if (!doc) return;
    const variants = doc.variants.filter((item) => variantIds.includes(item.id));
    if (variants.length) set({ clipboard: snapshotClipboard(doc, { kind: 'LINE', value: { lineId, label, variants } }), clipboardNotice: 'نُسخت اختلافات السطر؛ لا تُنشأ ملكية سطر مستقلة في نموذج التوافق.' });
  },
  cutSelection: () => {
    get().copySelection();
    const clipboard = get().clipboard;
    if (clipboard) set({ clipboard: { ...clipboard, mode: 'CUT' }, clipboardNotice: 'جاهز للنقل: المصدر يبقى كما هو حتى تأكيد لصق صالح. نقل الأوجه متاح داخل المستند.' });
  },
  requestPasteSelection: async () => {
    const { document, clipboard, selection, selectedVariantId } = get();
    if (!document || !clipboard) return;
    const target = document.variants.find((item) => item.id === selectedVariantId);
    const preview = pasteClipboard(document, clipboard, selectedVariantId ?? undefined);
    if (preview.error) { set({ clipboardNotice: preview.error }); return; }
    if (selection?.kind === 'LINE' && clipboard.kind !== 'FACE' && clipboard.kind !== 'FACES') {
      set({ clipboardNotice: 'اللصق الجزئي داخل سطر يحتاج ملكية أسطر مستقلة غير متاحة بعد. حدد اختلافًا للصق الأوجه أو وجهة المستند لنسخ الاختلافات.' }); return;
    }
    const accepted = await confirmAction({
      title: clipboard.mode === 'CUT' ? 'تأكيد نقل العناصر المقصوصة؟' : 'تأكيد لصق نسخة مستقلة؟',
      message: target && (clipboard.kind === 'FACE' || clipboard.kind === 'FACES') ? `في نهاية أوجه «${target.title}».` : 'إضافة الاختلافات/الأجزاء إلى المستند الحالي، دون تغيير بقية عناصره.',
      impacts: [{ label: 'عناصر', count: clipboardCount(clipboard) }, { label: 'علاقات ستُعلّق للمراجعة', count: (preview.document.suspendedLinks?.length ?? 0) - (document.suspendedLinks?.length ?? 0) }], undoable: true, confirmLabel: 'تأكيد', tone: 'default',
    });
    if (!accepted) return;
    if (get().document !== document || get().clipboard !== clipboard || get().selection !== selection) { set({ clipboardNotice: 'تغيّر المصدر أو الوجهة أثناء التأكيد؛ أعد طلب اللصق.' }); return; }
    get().pasteSelection();
  },
  pasteSelection: () => {
    const { document, clipboard, selectedVariantId } = get();
    if (!document || !clipboard) return;
    const result = pasteClipboard(document, clipboard, selectedVariantId ?? undefined);
    if (result.error) { set({ clipboardNotice: result.error }); return; }
    mutate(set, get, () => result.document, {
      action: clipboard.mode === 'CUT' ? 'نقل من الحافظة' : 'لصق من الحافظة', targetType: 'DOCUMENT', targetId: result.ids.join(','),
      summary: `${clipboard.mode === 'CUT' ? 'نقل' : 'لصق'} ${toArabicDigits(result.ids.length)} عناصر من الحافظة`,
      changes: [{ field: 'clipboard', before: { variants: document.variants, links: document.links, segments: document.segments }, after: { variants: result.document.variants, links: result.document.links, segments: result.document.segments } }],
    });
    set({ multiSelection: null, clipboard: clipboard.mode === 'CUT' ? null : clipboard, clipboardNotice: 'تم اللصق. العلاقات الخارجية معلّقة للمراجعة عند وجودها؛ يمكن التراجع.' });
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

  setFilter: (patch) => {
    set((state) => ({ filter: { ...state.filter, ...patch } }));
    writeWorkspacePrefs(get());
  },

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

  togglePropertiesPanel: () => {
    set((state) => ({ showPropertiesPanel: !state.showPropertiesPanel }));
    writeWorkspacePrefs(get());
  },
  toggleVariantsPanel: () => {
    set((state) => ({ showVariantsPanel: !state.showVariantsPanel }));
    writeWorkspacePrefs(get());
  },

  // ==================== التراجع ====================

  undo: () => {
    const { past, document } = get();
    if (past.length === 0 || !document) return;

    // الالتقاط قبل الاستعادة حتمًا: الاستعادة تكتب المخازن، وأي التقاط
    // بعدها يقرأ الحالة المستعادة نفسها فيفسد الإعادة.
    const entry = past[past.length - 1];
    const currentEntry = captureHistoryEntry(document);
    const restored = restoreHistoryEntry(entry);
    set({
      document: restored,
      past: past.slice(0, -1),
      future: [currentEntry, ...get().future].slice(0, MAX_HISTORY),
      isDirty: true,
    });
  },

  redo: () => {
    const { future, document } = get();
    if (future.length === 0 || !document) return;

    const entry = future[0];
    const currentEntry = captureHistoryEntry(document);
    const restored = restoreHistoryEntry(entry);
    set({
      document: restored,
      future: future.slice(1),
      past: pushHistory(get().past, currentEntry),
      isDirty: true,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

// ==================== دوال داخلية ====================

/** وصف تعديل يُسجَّل في سجل المستند لأغراض التتبع. */
export interface EditDescriptor {
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
  if (updated === current) return;
  const next = withRegeneratedBranches(
    edit ? withLoggedEdit(updated, edit, current) : updated
  );

  set({
    past: pushHistory(state.past, captureHistoryEntry(current)),
    future: [],
    document: next,
    isDirty: true,
  });
}

/**
 * يلتقط لقطة موحدة للحالة قبل التعديل: المستند والاستثناءات والقواعد.
 * تُستدعى دائمًا قبل كتابة أي مخزن، وإلا حفظ التراجع الحالة الجديدة.
 */
function captureHistoryEntry(document: TashjeerDocument): EditorHistoryEntry {
  return {
    document,
    occurrences: exportOccurrenceData(),
    globalRules: exportGlobalRulesSnapshot(),
  };
}

/**
 * يستعيد لقطة موحدة: المخازن أولا ثم المستند بخطوط مولّدة من القيم
 * المستعادة، فلا يبقى أثر معلق في مخزن دون آخر (FR-ED-10).
 * الاستعادة نفسها تبث أحداث التغيير فتتحدث كل اللوحات المستمعة.
 */
function restoreHistoryEntry(entry: EditorHistoryEntry): TashjeerDocument {
  restoreOccurrenceData(entry.occurrences);
  restoreGlobalRulesSnapshot(entry.globalRules);
  // الاستعادة حرفية: اللقطة هي الحالة كما كانت لحظة الالتقاط، وإعادة توليد
  // الخطوط هنا يفسد مقارنة «ما قبل/بعد» ويتعارض مع التراجع الحتمي.
  return entry.document;
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
  // الرتبة الصريحة (FR-ED-10) رقم لا اسم: تسبق كل قاعدة، والتعادل الأخير
  // بالمعرّف لا بالعنوان حتى لا يقلب التحرير اللفظي ترتيب القائمة.
  const aRank = a.orderRank;
  const bRank = b.orderRank;
  if (typeof aRank === 'number' && typeof bRank === 'number' && aRank !== bRank) {
    return aRank - bRank;
  }
  if (typeof aRank === 'number' && typeof bRank !== 'number') return -1;
  if (typeof aRank !== 'number' && typeof bRank === 'number') return 1;
  // ارتكاز التشجير الصحيح هو آخر كلمة في المدى عند السير من آخر الآية.
  // استخدام startPosition هنا كان يقلب ترتيب اختلاف يمتد على أكثر من كلمة.
  if (a.endPosition !== b.endPosition) return b.endPosition - a.endPosition;
  if (a.startPosition !== b.startPosition) return b.startPosition - a.startPosition;
  return a.id.localeCompare(b.id);
}

function pushHistory(past: EditorHistoryEntry[], entry: EditorHistoryEntry): EditorHistoryEntry[] {
  return [...past, entry].slice(-MAX_HISTORY);
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

/** اسم فعل تسجيل علامة وقف/وصل حسب نوعها، لسجل التعديل والتتبع. */
function boundaryActionLabel(kind: RecitationBoundary['kind']): string {
  switch (kind) {
    case 'WAQF':
      return 'إضافة علامة وقف';
    case 'IBTIDA':
      return 'إضافة علامة ابتداء';
    case 'WASL':
      return 'إضافة علامة وصل';
    default:
      return 'إضافة حاجز ممنوع وصل';
  }
}

/** تسمية مختصرة لنوع علامة، لتظهر في ملخصات السجل. */
function boundaryLabelOf(kind: RecitationBoundary['kind']): string {
  switch (kind) {
    case 'WAQF':
      return 'وقف';
    case 'IBTIDA':
      return 'ابتداء';
    case 'WASL':
      return 'وصل';
    default:
      return 'ممنوع وصل';
  }
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

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
  type LocusLinkVerdict,
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
import {
  resolveLinkPolicy,
  resolveLocusExclusion,
  type LinkPolicyDecision,
} from '@/lib/tashjeer/decision/editor-bridge';
import { differencesAtPosition, nextOccurrenceIndex } from '@/lib/tashjeer/multi-difference';
import { describeLoci, lociOfVariant } from '@/lib/tashjeer/loci';
import { LOCUS_RELATION_CORRECTION_ACTION } from '@/lib/tashjeer/migration/migrate-v7-v8';
import { loadEngineConfig } from '@/lib/tashjeer/engine-config-store';
import type { DecisionTraceStep } from '@/lib/tashjeer/decision/resolver';
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
 * رسالة حالة تعدد الاختلافات لموضع واحد (FR-ED-03): تظهر عند إنشاء اختلاف
 * جديد في موضع يحمل اختلافا آخر («اختلافان لموضع واحد»)، للتأكيد أن الأول
 * لم يتغير ولم يُدمَج. تُصفَّر صراحة من الواجهة.
 */
export interface MultiDifferenceNotice {
  at: string;
  /** عدد اختلافات الموضع بعد الإنشاء (٢ فأكثر). */
  count: number;
  /** وصف الموضع مختصرا («ك٣»)، تُعرَّب أرقامه في الواجهة. */
  locusLabel: string;
  /** معرّفات اختلافات الموضع بعد الإنشاء. */
  variantIds: string[];
  /** فئاتها، لبيان التنوع (مد، فرش...). */
  categories: VariantCategory[];
}

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
  /**
   * آخر رسالة «تعدد لموضع واحد» بعد إنشاء اختلاف في موضع مشغول.
   * الوجود وحده يعني أن الإنشاء الأخير صادف موضعا متعدد الاختلافات.
   */
  lastMultiDifferenceNotice: MultiDifferenceNotice | null;
  clearMultiDifferenceNotice: () => void;
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
    /**
     * قرار الموضع («متنافيان/مرتبطان») لروابط DIFFERENCE_TO_DIFFERENCE وحدها.
     * يُمرَّر للسياسة لمقارنته باقتراحها، ويُحفَظ على الرابط.
     */
    locusVerdict?: LocusLinkVerdict;
    /**
     * سطور سجل إضافية تُلحَق في خطوة التراجع نفسها (كتصحيح علاقة الموضع)،
     * تُبنى بمعرّف الرابط بعد توليده. داخلي: يستعمله setLocusRelation.
     */
    extraEdits?: (linkId: string) => EditDescriptor[];
  }) => LinkDecisionNotice;
  updateLink: (linkId: string, patch: Partial<Pick<TashjeerLink, 'relation' | 'notes' | 'from' | 'to' | 'locusVerdict'>>) => void;
  deleteLink: (linkId: string) => void;
  /**
   * قرار موضع يدوي على زوج اختلافين: «متنافيان» أو «مرتبطان» (FR-ED-03).
   * ينشئ رابط DIFFERENCE_TO_DIFFERENCE (أو يحدّث القائم للزوج نفسه) مع سطر
   * تصحيح «المحرك يقترح ← المحرر يقرر» يُرحَّل إلى Correction في v8.
   * يعيد معرّف الرابط، أو undefined إن تعذّر (لا مستند/لا اختلافان).
   */
  setLocusRelation: (
    firstVariantId: string,
    secondVariantId: string,
    verdict: LocusLinkVerdict,
    notes?: string
  ) => string | undefined;
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
  /** يعلّم مواضع كلمات برمجيا (لزر «اختلاف ثانٍ لهذا الموضع»)، بديلا للإبهام. */
  markPositions: (positions: number[]) => void;
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
  lastMultiDifferenceNotice: null,
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
    set((state) => ({
      past: pushHistory(state.past, current),
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
    set((state) => ({
      past: state.document ? pushHistory(state.past, state.document) : state.past,
      future: [],
      document: withRegeneratedBranches(document),
      isDirty: true,
    }));
  },

  // ==================== الاختلافات ====================

  clearMultiDifferenceNotice: () => set({ lastMultiDifferenceNotice: null }),

  addVariant: (variant) => {
    // إضافة اختلاف جديد لنفس (القارئ × الموضع) تُنشئ دائما كيانا جديدا
    // بمعرف جديد وفهرس تالٍ — لا استبدال ولا دمج ولا تحديث ضمني (FR-ED-03).
    const current = get().document;
    const staged: Variant[] = current
      ? assignOccurrenceIndices(current.variants, [
          { ...variant, ayahKey: current.ayahKey, origin: 'EDITOR' } as Variant,
        ])
      : [];
    mutate(
      set,
      get,
      (document) => ({
        ...document,
        variants: [...document.variants, ...staged].sort(compareVariants),
      }),
      {
        action: 'إضافة اختلاف',
        targetType: 'VARIANT',
        targetId: variant.id,
        category: variant.category,
        summary: `أضاف المحرر اختلاف «${variant.title}» (${variant.startPosition}–${variant.endPosition})`,
      }
    );
    const after = get().document;
    set({
      markedPositions: [],
      markedCharacters: [],
      lastMultiDifferenceNotice: after ? multiDifferenceNoticeFor(after, [variant.id]) : null,
    });
  },

  addVariantGroup: (variants) => {
    if (variants.length === 0) return;
    const current = get().document;
    const staged: Variant[] = current
      ? assignOccurrenceIndices(
          current.variants,
          variants.map((variant) => ({ ...variant, ayahKey: current.ayahKey, origin: 'EDITOR' }) as Variant)
        )
      : [];
    mutate(
      set,
      get,
      (document) => ({
        ...document,
        variants: [...document.variants, ...staged].sort(compareVariants),
      }),
      {
        action: 'إنشاء مجموعة اختلافات',
        targetType: 'VARIANT',
        targetId: variants.map((item) => item.id).join(','),
        summary: `أنشأ المحرر ${variants.length} اختلافات مستقلة في عملية واحدة`,
      }
    );
    const after = get().document;
    set({
      markedPositions: [],
      markedCharacters: [],
      lastMultiDifferenceNotice: after
        ? multiDifferenceNoticeFor(
            after,
            variants.map((item) => item.id)
          )
        : null,
    });
  },

  applySmartCreateBatch: (result) => {
    if (result.differences.length === 0 || !get().document) return;

    mutate(set, get, (document) => {
      const built: Variant[] = result.differences.map((difference) => {
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

      // فهرس الدفعة نسبي؛ النهائي يُسنَد نسبيا للمستند (التالي ضمن المجموعة).
      const variants = assignOccurrenceIndices(document.variants, built);

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
    const after = get().document;
    set({
      markedPositions: [],
      markedCharacters: [],
      lastMultiDifferenceNotice: after
        ? multiDifferenceNoticeFor(
            after,
            result.differences.map((item) => item.id)
          )
        : null,
    });
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

  addLink: ({ kind, relation, from, to, notes, locusVerdict, extraEdits }) => {
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
    // طرفا RULE يحملان معرّف اختلاف مباشرة (علاقة موضع أو ربط جزء بقاعدة).
    const categoryOfEndpoint = (endpoint: LinkEndpoint): VariantCategory | undefined => {
      if (endpoint.type === 'FACE') {
        const variantId = endpoint.id.split('::')[0];
        return current.variants.find((variant) => variant.id === variantId)?.category;
      }
      if (endpoint.type === 'RULE') {
        return current.variants.find((variant) => variant.id === endpoint.id)?.category;
      }
      return undefined;
    };
    // علاقة الموضع: زوج الاختلافين الفعليين للسياسة لتقارن القرار باقتراحها.
    const locusFirst =
      kind === 'DIFFERENCE_TO_DIFFERENCE' && from.type === 'RULE'
        ? current.variants.find((variant) => variant.id === from.id)
        : undefined;
    const locusSecond =
      kind === 'DIFFERENCE_TO_DIFFERENCE' && to.type === 'RULE'
        ? current.variants.find((variant) => variant.id === to.id)
        : undefined;
    const policy = resolveLinkPolicy(
      {
        kind,
        relation,
        from,
        to,
        fromCategory: categoryOfEndpoint(from),
        toCategory: categoryOfEndpoint(to),
        locusVerdict,
        locusPair: locusFirst && locusSecond ? { first: locusFirst, second: locusSecond } : undefined,
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
        ...(locusVerdict ? { locusVerdict } : {}),
        notes: notes?.trim() || undefined,
        origin: 'EDITOR',
        createdAt: now,
        updatedAt: now,
      };
      const withLink: TashjeerDocument = { ...document, links: [...(document.links ?? []), link] };
      const withExtras = (extraEdits?.(id) ?? []).reduce(
        (current, edit) =>
          appendEditLog(
            current,
            makeEditEntry({
              actor: current.meta.author,
              action: edit.action,
              targetType: edit.targetType,
              targetId: edit.targetId,
              category: edit.category,
              summary: edit.summary,
              changes: edit.changes,
            })
          ),
        withLink
      );
      return withLoggedEdit(
        withExtras,
        {
          action: 'إنشاء علاقة',
          targetType: linkTargetTypeOf(kind),
          targetId: id,
          summary:
            kind === 'DIFFERENCE_TO_DIFFERENCE'
              ? locusRelationSummary(from.id, to.id, locusVerdict, policy.decision.warning)
              : `${relation === 'MERGE' ? 'دمج' : 'ربط'} ${describeEndpoint(from)} مع ${describeEndpoint(to)}` +
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
      const next: TashjeerDocument = {
        ...document,
        links: (document.links ?? []).map((link) =>
          link.id === linkId ? { ...link, ...patch, updatedAt: new Date().toISOString() } : link
        ),
      };
      // قلب قرار الموضع تصحيح جديد (لا تعديل شكلي): يُلحَق بسطر تصحيح
      // «المحرك يقترح ← المحرر يقرر» في الخطوة نفسها.
      const flippedVerdict =
        before?.kind === 'DIFFERENCE_TO_DIFFERENCE' &&
        patch.locusVerdict &&
        patch.locusVerdict !== before.locusVerdict
          ? patch.locusVerdict
          : undefined;
      const withCorrection =
        flippedVerdict && before
          ? appendEditLog(next, locusCorrectionEntry(next, before, flippedVerdict))
          : next;
      return withLoggedEdit(
        withCorrection,
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

  setLocusRelation: (firstVariantId, secondVariantId, verdict, notes) => {
    const current = get().document;
    if (!current) return undefined;
    if (!firstVariantId || !secondVariantId || firstVariantId === secondVariantId) return undefined;
    const first = current.variants.find((variant) => variant.id === firstVariantId);
    const second = current.variants.find((variant) => variant.id === secondVariantId);
    if (!first || !second) return undefined;

    // الزوج الواحد رابط واحد: إعادة القرار نفسه عملية خاملة، وتغييره تحديث.
    const existing = (current.links ?? []).find(
      (link) =>
        link.kind === 'DIFFERENCE_TO_DIFFERENCE' &&
        link.from.type === 'RULE' &&
        link.to.type === 'RULE' &&
        ((link.from.id === firstVariantId && link.to.id === secondVariantId) ||
          (link.from.id === secondVariantId && link.to.id === firstVariantId))
    );
    if (existing) {
      if (existing.locusVerdict === verdict) return existing.id;
      get().updateLink(existing.id, {
        locusVerdict: verdict,
        relation: verdict === 'RELATED' ? 'MERGE' : 'REFERENCE',
        ...(notes !== undefined ? { notes } : {}),
      });
      return existing.id;
    }

    // اقتراح المحرك للزوج قبل التسجيل — «المحرك يقترح والمحرر يقرر».
    const suggestion = resolveLocusExclusion(first, second, loadEngineConfig()).decision;
    const notice = get().addLink({
      kind: 'DIFFERENCE_TO_DIFFERENCE',
      relation: verdict === 'RELATED' ? 'MERGE' : 'REFERENCE',
      from: { type: 'RULE', id: firstVariantId },
      to: { type: 'RULE', id: secondVariantId },
      notes,
      locusVerdict: verdict,
      // سطر التصحيح في الخطوة نفسها: يُرحَّل إلى Correction في v8.
      extraEdits: (linkId) => [
        locusCorrectionDescriptor({
          linkId,
          firstTitle: first.title,
          secondTitle: second.title,
          suggestion,
          verdict,
          notes,
        }),
      ],
    });
    if (!notice.allowed || !notice.linkId) return undefined;
    return notice.linkId;
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
    set((state) =>
      state.selection?.kind === 'WAQF_MARK' && state.selection.id === boundaryId
        ? selectionWrite(state, null, { center: false })
        : {}
    );
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

  markPositions: (positions) => {
    const valid = [...new Set(positions)].filter(
      (position) => Number.isInteger(position) && position > 0
    );
    set({ markedPositions: valid.sort((a, b) => a - b), markedCharacters: [] });
  },

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

      selectedWordId: wordId,
      selectedAlternativeId: null,
    }));
  },
  selectVariant: (variantId) => {
    const currentDocument = get().document;
    const variant = variantId && currentDocument
      ? getEffectiveVariants(currentDocument).find((item) => item.id === variantId)
      : undefined;

      selectedVariantId: variantId,
      selectedAlternativeId: null,
      selectedBranchId: null,
    }));
  },
  selectAlternative: (variantId, alternativeId) => {
    const currentDocument = get().document;
    const variant = currentDocument
      ? getEffectiveVariants(currentDocument).find((item) => item.id === variantId)
      : undefined;

      selectedVariantId: variantId,
      selectedAlternativeId: alternativeId,
      selectedBranchId: null,
    }));
  },
  selectSegment: (segmentId) => {
    const segment = get().document?.segments?.find((item) => item.id === segmentId);

      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
    }));
  },

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

    set({
      document: past[past.length - 1],
      multiSelection: null,
      selection: null,
      selectedWordId: null,
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
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
      multiSelection: null,
      selection: null,
      selectedWordId: null,
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
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
  if (kind === 'DIFFERENCE_TO_DIFFERENCE') return 'LOCUS_RELATION';
  return 'SEGMENT';
}

/**
 * يُسنِد فهرس التعدد (occurrenceIndex) للاختلافات الجديدة تباعا ضمن
 * مجموعاتها (قارئ × موضع)، دون مساس بالموجودين. من جاء بفهرس صالح صريح
 * (استعادة/ترحيل) احتُفظ به.
 */
function assignOccurrenceIndices(existing: Variant[], fresh: Variant[]): Variant[] {
  const running = [...existing];
  return fresh.map((variant) => {
    if (typeof variant.occurrenceIndex === 'number' && variant.occurrenceIndex > 0) {
      running.push(variant);
      return variant;
    }
    const assigned = { ...variant, occurrenceIndex: nextOccurrenceIndex(running, variant) };
    running.push(assigned);
    return assigned;
  });
}

/**
 * رسالة «تعدد لموضع واحد» بعد إنشاء اختلافات: تُبنى من أول موضع بلغ
 * اختلافين فأكثر بسبب هذا الإنشاء، وإلا فلا رسالة (لا ضجيج).
 */
function multiDifferenceNoticeFor(
  document: TashjeerDocument,
  addedVariantIds: string[]
): MultiDifferenceNotice | null {
  for (const addedId of addedVariantIds) {
    const added = document.variants.find((variant) => variant.id === addedId);
    if (!added) continue;
    const group = differencesAtPosition(document.variants, added.startPosition);
    if (group.length < 2) continue;
    return {
      at: new Date().toISOString(),
      count: group.length,
      locusLabel: describeLoci(lociOfVariant(added)),
      variantIds: group.map((variant) => variant.id),
      categories: group.map((variant) => variant.category),
    };
  }
  return null;
}

/** ملخص إنشاء علاقة الموضع لسجل التعديل. */
function locusRelationSummary(
  fromId: string,
  toId: string,
  verdict: LocusLinkVerdict | undefined,
  warning: string | undefined
): string {
  const label = verdict === 'RELATED' ? 'مرتبطان' : 'متنافيان';
  return (
    `قرار موضع يدوي: «${shortenId(fromId)}» و«${shortenId(toId)}» ${label}` +
    (warning ? ' (بخلاف اقتراح المحرك)' : '')
  );
}

/** وصف سطر تصحيح علاقة التنافي: اقتراح المحرك (قبل) ← قرار المحرر (بعد). */
function locusCorrectionDescriptor(args: {
  linkId: string;
  firstTitle: string;
  secondTitle: string;
  suggestion: { exclusive: boolean; reason: string };
  verdict: LocusLinkVerdict;
  notes?: string;
}): EditDescriptor {
  const verdictLabel = args.verdict === 'RELATED' ? 'مرتبطان' : 'متنافيان';
  const suggestionLabel = args.suggestion.exclusive ? 'متنافيان' : 'مستقلان';
  return {
    action: LOCUS_RELATION_CORRECTION_ACTION,
    targetType: 'LOCUS_RELATION',
    targetId: args.linkId,
    summary:
      `صحّح المحرر علاقة «${args.firstTitle}» و«${args.secondTitle}»: ` +
      `اقترح المحرك «${suggestionLabel}» (${args.suggestion.reason})، وقرر المحرر «${verdictLabel}»` +
      (args.notes?.trim() ? ` — ${args.notes.trim()}` : ''),
    changes: [
      {
        field: 'locusRelation',
        before: {
          verdict: args.suggestion.exclusive ? 'EXCLUSIVE' : 'INDEPENDENT',
          reason: args.suggestion.reason,
        },
        after: { verdict: args.verdict, reason: args.notes?.trim() || 'قرار المحقق' },
      },
    ],
  };
}

/** سطر تصحيح علاقة التنافي جاهزا للإلحاق (يُعاد حساب الاقتراح من المستند). */
function locusCorrectionEntry(
  document: TashjeerDocument,
  link: TashjeerLink,
  verdict: LocusLinkVerdict,
  notes?: string
): import('@/types/tashjeer').DocumentEditEntry {
  const first = document.variants.find((variant) => variant.id === link.from.id);
  const second = document.variants.find((variant) => variant.id === link.to.id);
  const suggestion =
    first && second
      ? resolveLocusExclusion(first, second, loadEngineConfig()).decision
      : { exclusive: verdict === 'EXCLUSIVE', reason: 'تعذّر حساب الاقتراح (طرف مفقود)' };
  return makeEditEntry({
    actor: document.meta.author,
    ...locusCorrectionDescriptor({
      linkId: link.id,
      firstTitle: first?.title ?? link.from.id,
      secondTitle: second?.title ?? link.to.id,
      suggestion,
      verdict,
      notes: notes ?? link.notes,
    }),
  });
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

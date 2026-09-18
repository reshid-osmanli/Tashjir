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
import { snapshotClipboard, pasteClipboard, clipboardCount, pasteAnchorFace, cloneRulesForClipboard, type EditorClipboard, type PasteLineAnchor } from '@/lib/tashjeer/clipboard';
export type { EditorClipboard } from '@/lib/tashjeer/clipboard';
import { confirmAction } from '@/lib/ui/confirm-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { MultiSelection } from '@/lib/tashjeer/multi-selection';
import { deleteItems, deletionImpact, exclusiveLineDifferences } from '@/lib/tashjeer/bulk-operations';
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
import { createEntityId, relationTypeToLinkRelation } from '@/lib/tashjeer/model/v8';
import { resolveLinkPolicy, resolveLocusRelation, type LinkPolicyDecision } from '@/lib/tashjeer/decision/editor-bridge';
import { multiDifferenceNotice } from '@/lib/tashjeer/difference-occurrences';
import { loadEngineConfig } from '@/lib/tashjeer/engine-config-store';
import type { DecisionTraceStep } from '@/lib/tashjeer/decision/resolver';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateBranches } from '@/lib/tashjeer/branch-engine';
import {
  findGlobalRuleMatches,
  getEffectiveVariants,
  matchFromDerivedVariant,
  type GlobalRuleMatch,
} from '@/lib/quran-logic/global-rule-engine';
import { readTransmissionCatalog } from '@/lib/transmissions/catalog';
import { readEngineSettings } from '@/lib/tashjeer/engine-settings';
import { moveLineToIndex } from '@/lib/tashjeer/manual-links';
import {
  deleteOccurrence,
  exportOccurrenceData,
  listOccurrenceOverrides,
  occurrenceIdFor,
  occurrenceStats,
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
  deleteGlobalRulesBatch,
  exportGlobalRulesSnapshot,
  listGlobalRules,
  restoreGlobalRulesSnapshot,
  saveGlobalRule,
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

/**
 * ما يلزم الحذف الجماعي من سياق لا يملكه المخزن (FR-ED-07): الأسطر المرسومة
 * عند حذف أسطر، لأن «الأسطر» كيانات مشتقة تُحسب من الاختلافات وقت الرسم.
 */
export interface BulkDeleteContext {
  rendered?: Array<{ id: string; entries: Array<{ variantId: string }> }>;
}

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
/**
 * مرساة «اللصق داخل سطر» من التحديد الموحد (AC-04): فقط حين يكون المحدد
 * سطرًا باختلاف مرسى صالح. تعيد undefined في بقية الحالات فيبقى اللصق
 * بسلوكه العام (وجهة الاختلاف للأوجه، أو وجهة المستند للاختلافات).
 */
function linePasteAnchorOf(
  document: TashjeerDocument,
  selection: EditorSelection | null
): PasteLineAnchor | undefined {
  if (selection?.kind !== 'LINE' || !selection.differenceId) return undefined;
  const faceKey = pasteAnchorFace(document, selection.differenceId);
  return faceKey ? { faceKey } : undefined;
}

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
 * قرار علاقة اختلافين (حزمة 05/T2): اقتراح المحرك (السياسة) وقرار المحرر
 * (متنافيان/مرتبطان) وحالهما، مع معرّف الرابط والتصحيح إن خُلفت السياسة.
 */
export interface DifferenceRelationNotice {
  allowed: boolean;
  relation: 'MUTUALLY_EXCLUSIVE' | 'RELATED';
  /** ما كانت السياسة ستقرره (A) — للحفظ في Correction والتتبع. */
  policyStatus: 'EXCLUSIVE' | 'RELATED' | 'INDEPENDENT';
  /** هل خالف قرار المحرر اقتراح المحرك فيُنشأ Correction موثق؟ */
  overridesPolicy: boolean;
  reason: string;
  warning?: string;
  trace: DecisionTraceStep[];
  appliedRuleNames: string[];
  linkId?: string;
  correctionId?: string;
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
  /**
   * حذف جماعي بتأكيد كمي (FR-ED-07): أوجه/اختلافات/أسطر من المستند، أو قواعد
   * عامة من مخزنها. `context.rendered` يلزم لتحديد الأسطر لأنه يحمل الأسطر
   * المرسومة التي تُحسب منها الاختلافات الحصرية.
   */
  requestDeleteItems: (selection: MultiSelection, context?: BulkDeleteContext) => Promise<boolean>;
  /**
   * حذف جماعي لمواضع قاعدة مشتقة: تجاوز محلي (localOverride) لكل موضع على
   * حدة في خطوة تراجع واحدة، والقاعدة الأم باقية (FR-ED-07.4).
   */
  requestDeleteOccurrencesBulk: (ruleId: string, matches: GlobalRuleMatch[], reason?: string) => Promise<boolean>;
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
  updateLink: (linkId: string, patch: Partial<Pick<TashjeerLink, 'relation' | 'notes' | 'from' | 'to' | 'differenceRelation'>>) => void;
  deleteLink: (linkId: string) => void;
  /**
   * يثبّت علاقة يدوية موثقة بين اختلافين (حزمة 05/T2 — تصحيح قرار التنافي):
   * «متنافيان» (وجهان لموضع واحد لا يُضربان) أو «مرتبطان» (بُعدان يجتمعان في
   * سطر الراوي). المحرك يقترح عبر السياسات (A)، والمحرر يقرر (B)؛ فإن خالف
   * اقتراح المحرك سُجِّلت Correction محفوظة (Engine/Editor/Final — DM-05).
   * العلاقة تسبق السياسة في محرك التراكيب عبر Resolver حصرا (P-07).
   */
  setDifferenceRelation: (input: {
    fromId: string;
    toId: string;
    relation: 'MUTUALLY_EXCLUSIVE' | 'RELATED';
    reason?: string;
  }) => Promise<DifferenceRelationNotice>;
  /** آخر قرار علاقة اختلافين (يعرض في لوحة التفاصيل مع أثره). */
  lastDifferenceRelationDecision: DifferenceRelationNotice | null;
  clearDifferenceRelationDecision: () => void;
  /**
   * رسالة حالة تعدد الاختلافات لموضع واحد (حزمة 05 — معيار القبول ٢):
   * «اختلافان لموضع واحد» عند إضافة ثانٍ لنفس القارئ والكلمة؛ إعلام بأن
   * الإضافة استقلت ولم تغيّر السابق. تُعرض في لوحة الاختلافات.
   */
  multiDifferenceNotice: string | null;
  clearMultiDifferenceNotice: () => void;
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
   * قرّاءه، وأجزاءه (LineSegment) المرتبطة به. اللصق ينشئ نسخا مستقلة
   * بمعرّفات جديدة (FR-ED-06.1/2).
   */
  copyLine: (lineId: string, label: string, variantIds: string[], segmentIds?: string[]) => void;
  /** ينسخ قواعد عامة إلى الحافظة (مستوى «قاعدة» في FR-ED-06). */
  copyRules: (ruleIds: string[]) => void;
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
  requestDeleteItems: async (selection, context) => {
    const document = get().document;
    if (!document) return false;

    // ---------- قواعد عامة (FR-ED-07 + القرار المحسوم «حذف القاعدة الأم») ----------
    // الحذف الجماعي للقواعد من مخزنها، في معاملة واحدة تلتقط القواعد ومخزن
    // المواضع معًا، فخطوة تراجع واحدة تعيد القواعد واستثناءاتها.
    if (selection.kind === 'RULE') {
      const wanted = new Set(selection.ids);
      const rules = listGlobalRules().filter((rule) => wanted.has(rule.id));
      if (!rules.length) return false;
      const stats = rules.map((rule) => ({
        matches: rule.pattern ? findGlobalRuleMatches(rule, { limit: 5000 }).length : 0,
        overrides: listOccurrenceOverrides(rule.id).length,
        deleted: occurrenceStats(rule.id).deleted,
      }));
      const total = (pick: (item: (typeof stats)[number]) => number) => stats.reduce((sum, item) => sum + pick(item), 0);
      const accepted = await confirmAction({
        title: rules.length === 1
          ? `حذف القاعدة العامة «${rules[0].title}»؟`
          : `حذف ${toArabicDigits(rules.length)} قواعد عامة؟`,
        message:
          'حذف الأمّ يمحو الحكم من المصحف كله مع كل ما سُجِّل على مواضعها. لحذف مواضع محدّدة دون المساس بالقاعدة، استعمل الحذف الموضعي من تتبّع المواضع.',
        impacts: [
          { label: 'قواعد عامة', count: rules.length },
          { label: 'مواضع مشتقة في المصحف', count: total((item) => item.matches) },
          { label: 'استثناءات موضعية مسجّلة', count: total((item) => item.overrides) },
          { label: 'منها محذوف موضعيًا', count: total((item) => item.deleted) },
        ],
        undoable: true,
        tone: 'danger',
        confirmLabel: rules.length === 1 ? 'حذف القاعدة كلها' : 'حذف القواعد المحددة',
      });
      if (!accepted) return false;
      const ids = rules.map((rule) => rule.id);
      get().transactExternal(
        {
          action: 'حذف جماعي لقواعد عامة',
          targetType: 'RULE',
          targetId: ids.join(','),
          summary: `حذف المحرر ${toArabicDigits(ids.length)} قواعد عامة مع استثناءات مواضعها`,
          changes: [{ field: 'globalRules', before: rules.map((rule) => rule.title), after: [] }],
        },
        () => deleteGlobalRulesBatch(ids)
      );
      set({ multiSelection: null });
      return true;
    }

    // ---------- أسطر (FR-ED-07): يُحذف ما تختص به وحدها ----------
    // السطر كيان مشتق، فالحذف يمسّ الاختلافات التي لا يعرضها سطر باقٍ، ويُبلَّغ
    // عن المشتركة فتبقى — لا تُحذف قراءة يعرضها سطر لم يُحدَّد.
    if (selection.kind === 'LINE') {
      const { exclusive, shared } = exclusiveLineDifferences(context?.rendered ?? [], selection.ids);
      const lineCount = selection.ids.length;
      if (!exclusive.length) {
        set({
          clipboardNotice: shared.length
            ? `الأسطر المحددة لا تملك اختلافات حصرية؛ ${toArabicDigits(shared.length)} اختلافات يشترك فيها سطر باقٍ فبقيت كلها. لم يُحذف شيء.`
            : 'الأسطر المحددة لا تحمل اختلافات قابلة للحذف. لم يُحذف شيء.',
        });
        return false;
      }
      const impact = deletionImpact(document, { kind: 'DIFFERENCE', ids: exclusive });
      const accepted = await confirmAction({
        title: lineCount === 1 ? 'حذف السطر؟' : `حذف ${toArabicDigits(lineCount)} أسطر؟`,
        message: shared.length
          ? `يُحذف ما تختص به هذه الأسطر وحدها؛ ${toArabicDigits(shared.length)} اختلافات يشترك فيها سطر باقٍ فتبقى كما هي. تُحفظ المحذوفات وروابطها في أرشيف المستند.`
          : 'تُحفظ المحذوفات وروابطها في أرشيف المستند، ويمكن التراجع فورًا.',
        impacts: [
          { label: 'أسطر', count: lineCount },
          { label: 'اختلافات حصرية', count: exclusive.length },
          { label: 'أوجه تُحذف معها', count: impact.differences.reduce((sum, item) => sum + item.alternatives.length, 0) },
          { label: 'روابط ستُؤرشف', count: impact.links.length },
          { label: 'اختلافات مشتركة تبقى', count: shared.length },
        ],
        undoable: true,
        tone: 'danger',
      });
      if (!accepted) return false;
      if (get().document !== document) return false;
      get().deleteVariantsBulk(exclusive);
      return true;
    }

    const impact = deletionImpact(document, selection);
    if (!impact.count) return false;
    const isFace = selection.kind === 'FACE';
    const count = isFace ? impact.faces.length : impact.differences.length;
    const unit = isFace
      ? count === 1 ? 'وجه' : count === 2 ? 'وجهين' : 'أوجه'
      : count === 1 ? 'اختلاف' : count === 2 ? 'اختلافين' : 'اختلافات';
    const accepted = await confirmAction({
      title: count <= 2 ? `حذف ${unit}؟` : `حذف ${toArabicDigits(count)} ${unit}؟`,
      message: 'تُحفظ المحذوفات وروابطها في أرشيف المستند، ويمكن التراجع فورًا.',
      impacts: [
        { label: isFace ? 'أوجه' : 'اختلافات', count },
        { label: 'روابط ستُؤرشف', count: impact.links.length },
      ],
      undoable: true,
      tone: 'danger',
    });
    if (!accepted) return false;
    // تغيّر المستند أثناء التأكيد يُبطل الطلب حتى لا يُحذف غير المقصود.
    if (get().document !== document) return false;
    if (isFace && selection.ownerId) {
      get().deleteAlternativesBulk(selection.ownerId, selection.ids);
    } else if (!isFace) {
      get().deleteVariantsBulk(selection.ids);
    } else {
      return false;
    }
    return true;
  },

  requestDeleteOccurrencesBulk: async (ruleId, matches, reason) => {
    const document = get().document;
    if (!matches.length) return false;
    const title = listGlobalRules().find((rule) => rule.id === ruleId)?.title ?? ruleId;
    // عدّ ما هو محذوف سابقًا بالمعرّف الرسمي للموضع (لا صيغة مُخمَّنة).
    const alreadyDeleted = matches.filter((match) => overrideById(occurrenceIdFor(ruleId, match))?.state === 'DELETED').length;
    const accepted = await confirmAction({
      title: matches.length === 1
        ? `حذف موضع من «${title}»؟`
        : matches.length === 2
          ? `حذف موضعين من «${title}»؟`
          : `حذف ${toArabicDigits(matches.length)} مواضع من «${title}»؟`,
      message:
        'حذف موضعي (تجاوز محلي) لكل موضع على حدة: القاعدة الأم باقية، وبقية مواضعها في المصحف لا تُمس، ويمكن إرجاع أي موضع من سجل التغييرات.',
      impacts: [
        { label: 'مواضع تُحذف محليًا', count: matches.length },
        { label: 'منها محذوف سابقًا', count: alreadyDeleted },
        { label: 'قواعد أم تبقى', count: 1 },
      ],
      undoable: true,
      tone: 'danger',
      confirmLabel: 'حذف المواضع المحددة',
    });
    if (!accepted) return false;
    const apply = () => {
      for (const match of matches) deleteOccurrence(ruleId, match, reason);
    };
    if (!document) {
      // بلا مستند مفتوح (صفحة المكتبة) لا لقطة تراجع؛ يُنفَّذ الحذف وحده.
      apply();
    } else {
      get().transactExternal(
        {
          action: 'حذف جماعي لمواضع قاعدة',
          targetType: 'RULE',
          targetId: ruleId,
          summary: `حذف المحرر ${toArabicDigits(matches.length)} مواضع من قاعدة «${title}» محليًا (القاعدة باقية)`,
          changes: [{ field: 'occurrences', before: matches.map((match) => match.matchedText), after: [] }],
        },
        apply
      );
    }
    set({ multiSelection: null });
    return true;
  },

  lastLinkDecision: null,
  pendingWhy: null,
  smartWizardRequest: 0,
  lastDifferenceRelationDecision: null,
  multiDifferenceNotice: null,
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
    // رسالة تعدد الاختلافات (حزمة 05 — معيار القبول ٢): إن كان في الموضع
    // نفسه ولنطاق القرّاء نفسه اختلاف قائم فالإضافة ثانٍ مستقل لا استبدال.
    const before = get().document;
    const notice = before
      ? multiDifferenceNotice(before.variants, [
          { ...variant, ayahKey: before.ayahKey, origin: 'EDITOR' as const },
        ])
      : null;
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
    set({ markedPositions: [], markedCharacters: [], multiDifferenceNotice: notice });
  },

  addVariantGroup: (variants) => {
    if (variants.length === 0) return;
    const before = get().document;
    const notice = before
      ? multiDifferenceNotice(
          before.variants,
          variants.map((variant) => ({ ...variant, ayahKey: before.ayahKey, origin: 'EDITOR' as const }))
        )
      : null;
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
    set({ markedPositions: [], markedCharacters: [], multiDifferenceNotice: notice });
  },

  applySmartCreateBatch: (result) => {
    if (result.differences.length === 0 || !get().document) return;

    // رسالة تعدد الاختلافات (حزمة 05 — معيار القبول ٢): تُحسب على المستند
    // قبل الإضافة داخل المعاملة نفسها، فتظهر متى صنع الإنشاء موضعًا متعددًا.
    let notice: string | null = null;
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

      notice = multiDifferenceNotice(document.variants, variants);
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
    set({ markedPositions: [], markedCharacters: [], multiDifferenceNotice: notice });
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
    const faceSelection: MultiSelection = { kind: 'FACE', ownerId: variantId, ids: [alternativeId] };
    const before = get().document?.variants.find((item) => item.id === variantId);
    mutate(set, get, (document) => deleteItems(document, faceSelection), {
      action: 'حذف وجه',
      targetType: 'ALTERNATIVE',
      targetId: alternativeId,
      category: before?.category,
      summary: `حذف المحرر وجهًا من «${before?.title ?? variantId}»`,
    });
    // تنظيف آمن للتحديد الموحّد: يبقى آخر تحديد صالح للعرض الرمادي (قرار محسوم).
    set((state) => ({
      ...selectionWrite(state, null, { center: false }),
      selectedAlternativeId: null,
      selectedBranchId: null,
    }));
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
    const selection: MultiSelection = { kind: 'DIFFERENCE', ids: variantIds };
    mutate(set, get, (document) => deleteItems(document, selection), {
      action: 'حذف جماعي للاختلافات',
      targetType: 'VARIANT',
      targetId: variantIds.join(','),
      summary: `حذف المحرر ${toArabicDigits(variantIds.length)} اختلافات دفعة واحدة`,
    });
    // تنظيف آمن للتحديد الموحّد: يبقى آخر تحديد صالح للعرض الرمادي (قرار محسوم).
    set((state) => ({
      ...selectionWrite(state, null, { center: false }),
      multiSelection: null,
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
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

  // ==================== علاقات الاختلافات (تعدد الموضع الواحد — حزمة 05) ====================

  setDifferenceRelation: async ({ fromId, toId, relation, reason }) => {
    const rejected = (why: string): DifferenceRelationNotice => ({
      allowed: false,
      relation,
      policyStatus: 'INDEPENDENT',
      overridesPolicy: false,
      reason: why,
      trace: [],
      appliedRuleNames: [],
      at: new Date().toISOString(),
    });
    const document = get().document;
    if (!document) return rejected('لا مستند مفتوح.');
    const first = document.variants.find((variant) => variant.id === fromId);
    const second = document.variants.find((variant) => variant.id === toId);
    if (!first || !second) return rejected('الاختلافان غير موجودين في هذه الآية.');
    if (first.id === second.id) return rejected('اختر اختلافين مختلفين للموضع نفسه.');

    // اقتراح المحرك (A) عبر Resolver حصرا (P-07): لا قرار خاص هنا.
    const profile = loadEngineConfig();
    const proposal = resolveLocusRelation(first, second, profile);
    const policyStatus = proposal.decision.status;
    const manualExclusive = relation === 'MUTUALLY_EXCLUSIVE';
    const overridesPolicy = (policyStatus === 'EXCLUSIVE') !== manualExclusive;
    const statusLabel =
      policyStatus === 'EXCLUSIVE' ? 'متنافيين (لا يُضربان)' : policyStatus === 'RELATED' ? 'مرتبطين (يجتمعان في سطر)' : 'مستقلين (يُطبقان معًا)';

    const accepted = await confirmAction({
      title: overridesPolicy
        ? 'تسجيل علاقة يدوية تخالف سياسة المحرك؟'
        : 'تسجيل علاقة يدوية بين اختلافين؟',
      message: toArabicDigits(
        `«${first.title}» و«${second.title}» في الموضع نفسه. سياسة المحرك تراهما ${statusLabel}.` +
          (overridesPolicy
            ? ` قرارك اليدوي (${manualExclusive ? 'متنافيان' : 'مرتبطان'}) يخالفها فيُحفظ مع Correction موثقة، ويسبق السياسة في محرك التراكيب.`
            : ' قرارك اليدوي يوثَّق كعلاقة صريحة تسبق السياسة عند العرض.')
      ),
      impacts: [
        { label: 'اختلافات', count: 2 },
        {
          label: 'أوجه الطرفين',
          count:
            first.alternatives.filter((alt) => !alt.isBase).length +
            second.alternatives.filter((alt) => !alt.isBase).length,
        },
        ...(overridesPolicy ? [{ label: 'تصحيح موثق (Correction)', count: 1 }] : []),
      ],
      undoable: true,
      confirmLabel: overridesPolicy ? 'تجاوز بقرار يدوي موثق' : 'تأكيد',
      tone: 'default',
    });
    if (!accepted) return rejected('أُلغي التسجيل؛ لم تتغير البيانات.');
    if (get().document !== document) return rejected('تغيّر المستند أثناء التأكيد؛ أعد الطلب.');

    const now = new Date().toISOString();
    let linkId: string | undefined;
    let correctionId: string | undefined;

    mutate(set, get, (current) => {
      // علاقة قائمة بين الاختلافين نفسهما تُحدَّث ولا تتكرر (قرار واحد لكل زوج).
      const existing = (current.links ?? []).find(
        (link) =>
          link.kind === 'DIFFERENCE_TO_DIFFERENCE' &&
          [link.from.id, link.to.id].includes(fromId) &&
          [link.from.id, link.to.id].includes(toId)
      );
      if (existing) {
        linkId = existing.id;
      } else {
        linkId = `rel-${current.ayahKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      }
      const link: TashjeerLink = {
        id: linkId,
        ayahKey: current.ayahKey,
        kind: 'DIFFERENCE_TO_DIFFERENCE',
        // ربط مرجعي: أثرها في محرك التراكيب عبر Resolver لا عبر دمج الأسطر.
        relation: 'REFERENCE',
        differenceRelation: relation,
        from: { type: 'RULE', id: fromId },
        to: { type: 'RULE', id: toId },
        notes: reason?.trim() || undefined,
        origin: 'EDITOR',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      // التصحيح الموثق (DM-05): المحرك اقترح A، والمحرر قرر B، والنهائي = B.
      let corrections = current.corrections ?? [];
      if (overridesPolicy) {
        correctionId = createEntityId('corr');
        corrections = [
          ...corrections,
          {
            id: correctionId,
            targetId: fromId,
            engineResult: {
              status: policyStatus,
              reason: proposal.decision.reason,
              trace: proposal.trace,
            },
            editorResult: { relation, reason: reason ?? null },
            finalResult: { relation, reason: reason ?? null },
            reason: reason?.trim() || 'تصحيح يدوي لعلاقة تنافي اختلافين في موضع واحد',
            at: now,
            source: 'editor' as const,
          },
        ];
      }

      return withLoggedEdit(
        {
          ...current,
          links: [
            ...(current.links ?? []).filter((item) => item.id !== linkId),
            link,
          ],
          corrections,
        },
        {
          action: 'تسجيل علاقة اختلافين',
          targetType: 'DIFFERENCE_LINK',
          targetId: linkId,
          summary: `${manualExclusive ? 'متنافيان' : 'مرتبطان'}: «${first.title}» و«${second.title}»` +
            (overridesPolicy ? ' (تصحيح يدوي يخالف سياسة المحرك)' : ''),
          changes: [
            { field: 'differenceRelation', before: existing?.differenceRelation, after: relation },
            { field: 'policyStatus', after: policyStatus },
          ],
        },
        current
      );
    });

    const notice: DifferenceRelationNotice = {
      allowed: true,
      relation,
      policyStatus,
      overridesPolicy,
      reason: overridesPolicy
        ? 'سُجّل التصحيح اليدوي مع Correction موثقة؛ يسبق سياسة المحرك في محرك التراكيب.'
        : 'سُجّلت العلاقة اليدوية؛ توثق العلاقة وتسبق السياسة عند العرض.',
      warning: overridesPolicy ? `سياسة المحرك كانت تراهما ${statusLabel}` : undefined,
      trace: proposal.trace,
      appliedRuleNames: proposal.appliedRules.map((rule) => rule.name),
      linkId,
      correctionId,
      at: now,
    };
    set({ lastDifferenceRelationDecision: notice });
    return notice;
  },

  clearDifferenceRelationDecision: () => set({ lastDifferenceRelationDecision: null }),

  clearMultiDifferenceNotice: () => set({ multiDifferenceNotice: null }),

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
      ...selectionWrite(state, word ? { kind: 'WORD', id: String(word.id), position: word.position } : null),
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
        variant ? { kind: 'DIFFERENCE', id: variant.id, differenceId: variant.id, position: variant.startPosition } : null
      ),
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
    set((state) => ({
      ...selectionWrite(state, {
        kind: 'FACE',
        id: alternativeId,
        differenceId: variantId,
        faceId: alternativeId,
        position: variant?.startPosition,
      }),
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
        segment ? { kind: 'SEGMENT', id: segment.id, position: segment.startPosition } : null
      ),
      selectedVariantId: null,
      selectedAlternativeId: null,
      selectedBranchId: null,
    }));
  },
  selectLine: (lineId, differenceId, position) => set((state) => ({
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
    if (multi?.kind === 'RULE' && multi.ids.length > 0) { state.copyRules(multi.ids); return; }
    if (!selection) return;
    if (selection.kind === 'DIFFERENCE') {
      const value = doc.variants.find((item) => item.id === selection.id);
      if (value) set({ clipboard: snapshotClipboard(doc, { kind: 'DIFFERENCE', value }), clipboardNotice: 'نُسخ الاختلاف.' });
    } else if (selection.kind === 'FACE' && selection.differenceId) {
      state.copyFaces(selection.differenceId, [selection.id]);
    } else if (selection.kind === 'SEGMENT') {
      const value = doc.segments?.find((item) => item.id === selection.id);
      if (value) set({ clipboard: snapshotClipboard(doc, { kind: 'SEGMENT', value }), clipboardNotice: 'نُسخ الجزء.' });
    } else if (selection.kind === 'RULE') {
      // مستوى «قاعدة» في الحافظة الموحّدة (FR-ED-06).
      state.copyRules([selection.id]);
    } else if (selection.kind === 'LINE' && selection.differenceId) {
      // تحديد سطر بلا تحديد متعدد: يُنسخ اختلاف المرساة فيه (الذي نقره
      // المستخدم)، ونسخ السطر كاملًا بكل اختلافاته من زر لوحة الخصائص.
      const value = doc.variants.find((item) => item.id === selection.differenceId);
      if (value) set({ clipboard: snapshotClipboard(doc, { kind: 'DIFFERENCE', value }), clipboardNotice: 'نُسخ اختلاف السطر المحدد. لنسخ السطر كاملًا استعمل «نسخ السطر» في لوحة الخصائص.' });
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
  copyLine: (lineId, label, variantIds, segmentIds) => {
    const doc = get().document;
    if (!doc) return;
    const variants = doc.variants.filter((item) => variantIds.includes(item.id));
    // أجزاء السطر المرتبطة به (FR-ED-06.1): تُنسخ معه فتأتي النسخة كاملة،
    // وروابطها تتبعها أو تُعلَّق للمراجعة بحسب أطرافها.
    const wantedSegments = new Set(segmentIds ?? []);
    const segments = (doc.segments ?? []).filter((item) => wantedSegments.has(item.id));
    if (variants.length) set({
      clipboard: snapshotClipboard(doc, { kind: 'LINE', value: { lineId, label, variants, segments } }),
      clipboardNotice: `نُسخت اختلافات السطر${segments.length ? ` وأجزاؤه (${toArabicDigits(segments.length)})` : ''}. حدد سطرًا آخر ثم الصق لإلحاق النسخة به، أو الصق بلا تحديد سطر لإضافتها للمستند.`,
    });
  },
  copyRules: (ruleIds) => {
    const doc = get().document;
    if (!doc) return;
    const wanted = new Set(ruleIds);
    const rules = listGlobalRules().filter((rule) => wanted.has(rule.id));
    if (!rules.length) return;
    set({
      clipboard: snapshotClipboard(doc, rules.length === 1 ? { kind: 'RULE', value: rules[0] } : { kind: 'RULES', value: rules }),
      clipboardNotice: rules.length === 1 ? `نُسخت القاعدة «${rules[0].title}». اللصق ينشئ نسخة مستقلة بمعرّف جديد.` : `نُسخت ${toArabicDigits(rules.length)} قواعد عامة. اللصق ينشئ نسخًا مستقلة بمعرّفات جديدة.`,
    });
  },
  cutSelection: () => {
    get().copySelection();
    const clipboard = get().clipboard;
    if (clipboard) set({ clipboard: { ...clipboard, mode: 'CUT' }, clipboardNotice: 'جاهز للنقل: المصدر يبقى كما هو حتى تأكيد لصق صالح. نقل الأوجه متاح داخل المستند.' });
  },
  requestPasteSelection: async () => {
    const { document, clipboard, selection, selectedVariantId } = get();
    if (!document || !clipboard) return;

    // ---------- لصق/نقل قواعد عامة (مستوى «قاعدة» في FR-ED-06) ----------
    // القواعد تسكن مخزنها لا المستند، فمسارها معاملة خارجية واحدة: لقطة
    // تراجع موحّدة تلتقط القواعد والمواضيع والمستند معًا (DM-15).
    if (clipboard.kind === 'RULE' || clipboard.kind === 'RULES') {
      const sources = clipboard.kind === 'RULE' ? [clipboard.value] : clipboard.value;
      const accepted = await confirmAction({
        title: clipboard.mode === 'CUT' ? 'تأكيد نقل القواعد العامة؟' : 'تأكيد لصق نسخ مستقلة من القواعد العامة؟',
        message: clipboard.mode === 'CUT'
          ? 'تُنشأ نسخ بمعرّفات جديدة ثم تُحذف القواعد الأصول ومخازن مواضعها؛ يمكن التراجع عن النقل كله دفعة واحدة.'
          : 'تُنشأ نسخ مستقلة بمعرّفات جديدة وحالة «مسودة» ووسم الأصل في copiedFrom، والقواعد الأم لا تُمس.',
        impacts: [{ label: 'قواعد عامة', count: sources.length }],
        undoable: true,
        confirmLabel: 'تأكيد',
        tone: 'default',
      });
      if (!accepted) return;
      if (get().clipboard !== clipboard) { set({ clipboardNotice: 'تغيّرت الحافظة أثناء التأكيد؛ أعد طلب اللصق.' }); return; }
      const clones = cloneRulesForClipboard(sources);
      get().transactExternal(
        {
          action: clipboard.mode === 'CUT' ? 'نقل قواعد من الحافظة' : 'لصق قواعد من الحافظة',
          targetType: 'RULE',
          targetId: clones.map((rule) => rule.id).join(','),
          summary: `${clipboard.mode === 'CUT' ? 'نقل' : 'لصق'} ${toArabicDigits(clones.length)} قواعد عامة بمعرّفات جديدة`,
          changes: [{ field: 'globalRules', before: clipboard.mode === 'CUT' ? sources.map((rule) => rule.title) : [], after: clones.map((rule) => rule.title) }],
        },
        () => {
          // حفظ قاعدة قاعدة: القواعد الوصفية بلا نمط آلي مقبولة هنا، ودفعة
          // saveGlobalRulesBatch ترفضها. الذرّية مؤمَّنة بلقطة التراجع.
          for (const rule of clones) saveGlobalRule(rule);
          if (clipboard.mode === 'CUT') deleteGlobalRulesBatch(sources.map((rule) => rule.id));
        }
      );
      set({
        multiSelection: null,
        clipboard: clipboard.mode === 'CUT' ? null : clipboard,
        clipboardNotice: clipboard.mode === 'CUT'
          ? 'نُقلت القواعد بمعرّفات جديدة وحُذفت الأصول؛ يمكن التراجع دفعة واحدة.'
          : 'لُصقت نسخ مستقلة من القواعد بمعرّفات جديدة وحالة مسودة؛ يمكن التراجع.',
      });
      return;
    }

    const target = document.variants.find((item) => item.id === selectedVariantId);
    // سطر الهدف من التحديد الموحد (AC-04): تحديد LINE باختلاف مرسى يفعّل
    // اللصق الجزئي داخل ذلك السطر عبر رابط DIFFERENCE_TO_LINE لا رميًا عامًا.
    const lineAnchor = linePasteAnchorOf(document, selection);
    const preview = pasteClipboard(document, clipboard, selectedVariantId ?? undefined, lineAnchor);
    if (preview.error) { set({ clipboardNotice: preview.error }); return; }
    const accepted = await confirmAction({
      title: clipboard.mode === 'CUT' ? 'تأكيد نقل العناصر المقصوصة؟' : 'تأكيد لصق نسخة مستقلة؟',
      message: target && (clipboard.kind === 'FACE' || clipboard.kind === 'FACES')
        ? `في نهاية أوجه «${target.title}».`
        : lineAnchor && selection?.kind === 'LINE' && selection.differenceId
          ? `في سطر اختلاف «${document.variants.find((item) => item.id === selection.differenceId)?.title ?? 'السطر المحدد'}» — تظهر العناصر في نهاية أحكامه ولا يتغيّر شيء آخر فيه${clipboard.mode === 'CUT' ? ' (نقل بلا نسخ؛ المعرّفات محفوظة)' : ''}.`
          : 'إضافة الاختلافات/الأجزاء إلى المستند الحالي، دون تغيير بقية عناصره.',
      impacts: [{ label: 'عناصر', count: clipboardCount(clipboard) }, { label: 'علاقات ستُعلّق للمراجعة', count: (preview.document.suspendedLinks?.length ?? 0) - (document.suspendedLinks?.length ?? 0) }], undoable: true, confirmLabel: 'تأكيد', tone: 'default',
    });
    if (!accepted) return;
    if (get().document !== document || get().clipboard !== clipboard || get().selection !== selection) { set({ clipboardNotice: 'تغيّر المصدر أو الوجهة أثناء التأكيد؛ أعد طلب اللصق.' }); return; }
    get().pasteSelection();
  },
  pasteSelection: () => {
    const { document, clipboard, selection, selectedVariantId } = get();
    if (!document || !clipboard) return;
    const lineAnchor = linePasteAnchorOf(document, selection);
    const result = pasteClipboard(document, clipboard, selectedVariantId ?? undefined, lineAnchor);
    if (result.error) { set({ clipboardNotice: result.error }); return; }
    mutate(set, get, () => result.document, {
      action: clipboard.mode === 'CUT' ? 'نقل من الحافظة' : 'لصق من الحافظة', targetType: 'DOCUMENT', targetId: result.ids.join(','),
      summary: `${clipboard.mode === 'CUT' ? 'نقل' : 'لصق'} ${toArabicDigits(result.ids.length)} عناصر من الحافظة${lineAnchor ? ' داخل السطر المحدد' : ''}`,
      changes: [{ field: 'clipboard', before: { variants: document.variants, links: document.links, segments: document.segments }, after: { variants: result.document.variants, links: result.document.links, segments: result.document.segments } }],
    });
    const doneNotice = lineAnchor
      ? clipboard.mode === 'CUT'
        ? 'نُقلت العناصر إلى السطر المحدد بلا نسخ — معرّفاتها محفوظة وعلاقاتها قائمة؛ يمكن التراجع.'
        : 'لُصقت النسخة في نهاية أحكام السطر المحدد بمعرّفات مستقلة؛ يمكن التراجع.'
      : 'تم اللصق. العلاقات الخارجية معلّقة للمراجعة عند وجودها؛ يمكن التراجع.';
    set({ multiSelection: null, clipboard: clipboard.mode === 'CUT' ? null : clipboard, clipboardNotice: doneNotice });
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
 * يستعيد لقطة موحدة: المخازن أولا ثم المستند نفسه كما لُقط حرفيًا، فلا
 * يبقى أثر معلق في مخزن دون آخر (FR-ED-10)، والتراجع/الإعادة يعيدان
 * المستند المطابق بايتًا لما كان (بلا إعادة توليد تغيّر الخطوط).
 * الاستعادة نفسها تبث أحداث التغيير فتتحدث كل اللوحات المستمعة.
 */
function restoreHistoryEntry(entry: EditorHistoryEntry): TashjeerDocument {
  restoreOccurrenceData(entry.occurrences);
  restoreGlobalRulesSnapshot(entry.globalRules);
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
  if (kind === 'DIFFERENCE_TO_DIFFERENCE') return 'DIFFERENCE_LINK';
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

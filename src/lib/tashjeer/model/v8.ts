// نموذج البيانات الموحّد (الإصدار v8) — Tashjeer Unified Data Model
//
// هذا الملف هو أساس المرحلة PH0. كل المتطلبات الأخرى (المحرر، Engine Studio،
// نواة المحرك) تُبنى فوق نفس النموذج. المبادئ الحاكمة المطبَّقة هنا:
//
//   P-01 البناء لا الحذف: النموذج يوسّع النموذج القائم في `@/types/tashjeer`
//        (Variant≈Difference، VariantAlternative≈Variant/الوجه) ولا يكسره.
//   P-03 المعرّفات ثابتة: كل كيان ID مستقل لا يتغير بإعادة الترتيب/النقل/الدمج.
//   P-04 ترتيب صريح رقمي: كل ما يُعرض له رتبة صريحة (rank/order/displayOrder).
//   P-05 الإنشاء الجماعي لا يلغي الاستقلال: كل عنصر كيان مستقل (createBatchId
//        للتتبع فقط).
//   DM-03 العلاقات تشير إلى معرّفات فقط.
//   DM-06 سياق الوقف/الوصل على الاختلاف.
//   DM-09 تعدد الاختلافات لنفس القارئ+الموضع (occurrenceIndex).
//
// هذه الأنواع «موحّدة»: تُستعمل من المحرر وEngine Studio ونواة المحرك وطبقة
// السياسة على السواء بلا نظام تحديد ولا منطق مكرر (P-07).

import type {
  ReadingScope,
  VerificationStatus,
  CharacterRange,
  VariantAlternative,
  TashjeerLinkKind,
  TashjeerLinkRelation,
} from '@/types/tashjeer';
import type { VariantCategory } from '@/types';

// ==================== المعرّفات ====================

/**
 * معرّف كيان: بادئة + ULID قصير. حتمي الشكل، فريد، ولا يُعاد استخدامه أبدا
 * (P-03). لا يعتمد الترتيب العددي للمعرّفات في أي منطق.
 */
export type EntityId = string;

/** يولّد معرّفا بصيغة `<prefix>-<shortULID>`. */
export function createEntityId(prefix: string): EntityId {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}${rand}`;
}

// ==================== السياق (الوقف/الوصل) ====================

/** سياق الأداء الذي يظهر فيه الاختلاف (DM-06). */
export type RecitationContext = 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY';

// ==================== الموضع (Locus) ====================

/**
 * موضع دقيق داخل الآية: كلمة واحدة، أو حرف، أو مدى من كلمة إلى كلمة.
 * يوحّد start/end القديمين و characterRange تحت نوع واحد (FR-ED-08 الخطوة 1:
 * التحديد البصري بدل أرقام الكلمات).
 */
export interface Locus {
  /** الكلمة الأولى (1-based داخل الآية). */
  startPosition: number;
  /** الكلمة الأخيرة (تساوي startPosition للكلمة الواحدة). */
  endPosition: number;
  /** تحديد حروف داخل الكلمات عند الحاجة. */
  characterRange?: CharacterRange;
  /** مواضع متباعدة في الكلمة الواحدة إن تعددت (بلا خط يملأ الفجوة). */
  loci?: Array<{ startPosition: number; endPosition: number; characterRange?: CharacterRange }>;
}

// ==================== الوجه (Variant / Face) ====================

/**
 * وجه قرائي مستقل داخل اختلاف (DM-02).
 * هو نفسه VariantAlternative القديم لكن ككيان مستقل له ID صريح ورتبة صريحة.
 */
export interface Variant {
  id: EntityId;
  /** نص الوجه المقروء بهذا الوجه (بالتشكيل). */
  text: string;
  /** وصف مختصر، مثل: بالألف، بالسين. */
  label: string;
  /** من يقرأ بهذا الوجه. */
  scope: ReadingScope;
  /** هل هو وجه رواية حفص (النص المطبوع)؟ لا يُرسم. */
  isBase?: boolean;
  /** درجة القوة العامة (معرّف من سلّم الدرجات). */
  strengthDegreeId?: string;
  /** درجة كل راوٍ على حدة: معرّف الراوي ← معرّف الدرجة. */
  strengthByNarrator?: Record<string, string>;
  /** رتبة صريحة داخل الاختلاف (DM-04). الأصغر يُقدَّم. */
  rank: number;
  /** نص الحكم المطبوع فوق الكلمة (إمالة، تقليل...). */
  ruleLabel?: string;
  /** عدد حركات المد (٢، ٤، ٥، ٦). */
  maddHarakat?: number;
  /** ملاحظات المحرر. */
  notes?: string;
  /** أدلة الوجه. */
  evidences?: VariantEvidence[];
  /** مصدر الوجه: المحرك أو المحرر. */
  source: 'engine' | 'editor';
  /** من عدّله إن كان مصدره المحرك. */
  modified_by?: 'editor';
  /** طابع زمني للإنشاء/التعديل (DM-14: مستقر عند التصدير). */
  createdAt: string;
  updatedAt: string;
}

/** دليل مرتبط بوجه. */
export interface VariantEvidence {
  id: EntityId;
  source: 'TAYYIBAH' | 'NASHR' | 'JANNAH' | 'OTHER';
  text: string;
  reference?: string;
  url?: string;
}

// ==================== العلاقات (Relation) ====================

/** أنواع العلاقات بين الكيانات (DM-03). */
export type RelationType =
  | 'MERGE'
  | 'COMPOSITE'
  | 'PART_OF'
  | 'RELATED'
  | 'MUTUALLY_EXCLUSIVE'
  | 'MANUAL_LINK';

/**
 * علاقة تشير إلى معرّفات فقط — لا إلى موضع مؤقت ولا فهرس عرض (DM-03).
 * تحلّ محل TashjeerLink القديم بأسماء ملزمة من المعجم.
 */
export interface Relation {
  id: EntityId;
  type: RelationType;
  fromId: EntityId;
  toId: EntityId;
  /** قابلية الوجهين للضرب معا (عند COMPOSITE): إن كانا متنافيين فلا يُضربان. */
  note?: string;
  source: 'engine' | 'editor';
  createdAt: string;
}

// ==================== الاختلاف (Difference) ====================

/**
 * اختلاف قرائي مستقل من الدرجة الأولى له ID مستقل كامل (DM-01).
 * يقابل Variant القديم لكنه: يوسّع العلاقات إلى Relation صريحة، يضيف
 * occurrenceIndex لتعدد الاختلافات في الموضع نفسه (DM-09)، وسياقا صريحا
 * (DM-06)، ورتبة صريحة (DM-04).
 */
export interface Difference {
  id: EntityId;
  ayahKey: number;
  /** فئة الاختلاف (أصول/فرش/مدود...). */
  category: VariantCategory;
  title: string;
  /** الموضع الموحّد (كلمة | حرف | مدى). */
  locus: Locus;
  /**
   * فهرس الاختلاف ضمن الموضع نفسه (الأول/الثاني...) عند تعدد الاختلافات
   * لنفس القارئ+الكلمة (DM-09). لا دمج تلقائي لمجرد التطابق.
   */
  occurrenceIndex: number;
  /** سياق الأداء (DM-06). */
  context: RecitationContext;
  /** نطاق القراء العام للاختلاف. */
  scope: ReadingScope;
  /** مصدر الاستقاء: المحرك أو المحرر (DM-05). */
  source: 'engine' | 'editor';
  modified_by?: 'editor';
  /** رتبة صريحة للعرض (DM-04). */
  rank: number;
  /** إصدار الكيان (للمراجعة والتراجع عن الترقية). */
  version: number;
  /** حالة التوثيق. */
  status: VerificationStatus;
  /** الأوجه المستقلة. */
  variants: Variant[];
  /** العلاقات بمعرّفاتها. */
  relations: Relation[];
  /** رتبة المرور اليدوية (تسبق أي قاعدة). */
  orderRank?: number;
  /** ترتيب الأوجه الصريح بعناوينها. */
  variantOrder?: EntityId[];
  /** لقطة اقتراح المحرك قبل التصحيح (للمقارنة Engine/Editor/Final). */
  engineSnapshot?: {
    title: string;
    category: VariantCategory;
    variants: Variant[];
    capturedAt: string;
  };
  /** وقت آخر تعديل يدوي لعنصر كان مصدره المحرك. */
  editorModifiedAt?: string;
  /** هل مشتق مؤقتا من قاعدة عامة؟ */
  isGlobalDerived?: boolean;
  /** معرّف القاعدة العامة إن كان مشتقا. */
  globalRuleId?: EntityId;
  /** معرّف الدفعة عند الإنشاء الجماعي (تتبع فقط — P-05). */
  createBatchId?: EntityId;
  /** مصدر عام إضافي (مثل مرجع القاعدة). */
  sourceRef?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== علامات الوقف (WaqfMark) ====================

/**
 * علامة وقف/ابتداء/ممنوع وصل (DM-07). تحلّ محل RecitationBoundary القديم
 * بأسماء ملزمة، وتضيف FORBIDDEN_WASL كقيد صلب.
 */
// يشمل WASL حفاظا على بيانات الـRecitationBoundary القديمة (P-13: لا تضيع
// البيانات)؛ القاعدة الصلبة في السياسات هي FORBIDDEN_WASL (DM-07).
export type WaqfMarkKind = 'WAQF' | 'IBTIDA' | 'FORBIDDEN_WASL' | 'WASL';

export interface WaqfMark {
  id: EntityId;
  ayahKey: number;
  /** ترتيب الكلمة (1-based). */
  position: number;
  characterIndex?: number;
  kind: WaqfMarkKind;
  /** نطاق العلامة: نهاية الآية أو داخلها. */
  scope: 'END_OF_AYAH' | 'INTERNAL';
  /** هل يربط نهاية الآية بأول الآية التالية؟ */
  connectsToNextAyah?: boolean;
  label?: string;
  notes?: string;
  source: 'engine' | 'editor';
  createdAt: string;
}

// ==================== التصحيح (Correction) ====================

/**
 * التثليث: المحرك يقترح ← المحرر يصحّح ← التصحيح يتحول إلى قاعدة مرشحة.
 * Engine = A (تُحفظ ولا تُحذف)، Editor = B، Final = B (P-06، DM-05).
 */
/** نوع الكيان الذي استهدفه التصحيح. */
export type CorrectionTargetType =
  | 'DIFFERENCE'
  | 'VARIANT'
  | 'FACE'
  | 'LINE'
  | 'SEGMENT'
  | 'RULE'
  | 'RELATION'
  | 'WAQF_MARK';

/**
 * بيانات السياق التي تسمح بتحويل التصحيحات المتكررة إلى قواعد مرشحة.
 * تبقى اختيارية لأن ملفات v7 لم تكن تسجلها كلها؛ لا يعني غيابها فقدان
 * الثلاثية Engine/Editor/Final.
 */
export interface CorrectionMetadata {
  category?: string;
  context?: RecitationContext;
  readerIds?: string[];
  narratorIds?: string[];
  pathIds?: string[];
  ayahKey?: number;
  locus?: Locus;
  [key: string]: unknown;
}

/**
 * التثليث: المحرك يقترح ← المحرر يصحّح ← التصحيح يتحول إلى قاعدة مرشحة.
 *
 * حقول v8 (`engineResult`/`editorResult`/`finalResult`/`at`) هي الشكل
 * المعتمد عند الحفظ. الحقول القديمة (`before`/`after`/`timestamp`) تُقرأ
 * فقط لتوافق ملفات وسجلات v7 ولتحويلها بأمان أثناء الاستيراد. لذلك جعلت
 * الحقول الأساسية اختيارية على مستوى TypeScript، ثم تُطبّع عند الحفظ؛ فلا
 * يتعذر فتح ملف قديم ولا تضيع النتيجة الأصلية للمحرك (P-06، DM-05).
 */
export interface Correction {
  id: EntityId;
  /** معرّف الكيان المصحَّح (Difference أو Variant أو Line). */
  targetId: EntityId;
  /** نتيجة المحرك الأصلية (A). */
  engineResult?: unknown;
  /** قرار المحرر (B). */
  editorResult?: unknown;
  /** النتيجة النهائية (= B). */
  finalResult?: unknown;
  /** سبب التصحيح. */
  reason?: string;
  /** هل وُلّدت منه قاعدة مرشحة؟ */
  promotedToRuleId?: EntityId;
  /** وقت قرار v8. */
  at?: string;
  source?: 'engine' | 'editor';

  // توافق v7 / سجل التحرير السابق. لا تكتبها منشئات v8 الجديدة.
  timestamp?: string;
  targetType?: CorrectionTargetType;
  before?: unknown;
  after?: unknown;
  metadata?: CorrectionMetadata;
}

/** يعيد نتيجة المحرك سواء كان التصحيح v8 أو سجلا قديما. */
export function correctionEngineResult(correction: Correction): unknown {
  return correction.engineResult ?? correction.before;
}

/** يعيد قرار المحرر سواء كان التصحيح v8 أو سجلا قديما. */
export function correctionEditorResult(correction: Correction): unknown {
  return correction.editorResult ?? correction.after;
}

/** يعيد النتيجة النهائية؛ قرار المحرر يتقدم دائما على اقتراح المحرك. */
export function correctionFinalResult(correction: Correction): unknown {
  return correction.finalResult ?? correctionEditorResult(correction) ?? correctionEngineResult(correction);
}

/** يعيد طابع التصحيح في الصيغتين. */
export function correctionTimestamp(correction: Correction): string | undefined {
  return correction.at ?? correction.timestamp;
}

// ==================== القاعدة العامة (GlobalRule) ====================

/** حالة القاعدة العامة (FR-ES-07). */
export type RuleStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'DEPRECATED' | 'CONFLICTED' | 'EXPERIMENTAL';

/**
 * قاعدة عامة على المصحف بنمط مطابقة حتمي (تطوير v7).
 * تُدرج في قائمة الاختلافات (FR-ED-15)، ولها أولوية/فئة/حالة/إصدار (FR-ES-07).
 */
export interface GlobalRule {
  id: EntityId;
  title: string;
  category: VariantCategory;
  /** نمط المطابقة الحتمي (CHARACTERS + مجموعات + قوالب). */
  pattern: unknown;
  scope: ReadingScope;
  ruleLabel?: string;
  evidences?: VariantEvidence[];
  priority: number;
  status: RuleStatus;
  version: number;
  /** هل القاعدة محمية (تحتاج تأكيدا إضافيا لتعديلها/حذفها)؟ */
  protected?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** موضع مشتق من قاعدة عامة + تجاوز محلي (DM-08). */
export interface RuleOccurrence {
  id: EntityId;
  globalRuleId: EntityId;
  ayahKey: number;
  locus: Locus;
  /** هل أكّده المحرر؟ */
  confirmed?: boolean;
  /** هل عدّله محليا؟ */
  modified?: boolean;
  /** هل ألغاه محليا؟ */
  cancelled?: boolean;
  /** التجاوز المحلي: تعديل/حذف محلي لا يمس القاعدة ولا بقية المواضع (DM-08). */
  localOverride?: {
    variantPatch?: Partial<Variant>;
    cancelled?: boolean;
    note?: string;
    by?: 'editor';
    at?: string;
  };
}

// ==================== السطر (Line) ====================

/**
 * سطر تشجير: رتبة صريحة + نطاق قارئ + أجزاء (DM-10).
 * إعادة الترتيب تغيّر `order` فقط ولا تمس `id` ولا العلاقات (P-03).
 */
export interface Line {
  id: EntityId;
  ayahKey: number;
  /** رتبة صريحة للعرض. */
  order: number;
  title: string;
  category: VariantCategory;
  readerScope: ReadingScope;
  /** الأجزاء (Line→Segment→Rule). */
  segments: LineSegment[];
  /** الأوجه المركبة المُشار إليها. */
  compositeFaceRefs?: EntityId[];
  source: 'engine' | 'editor';
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** جزء سطر مرتبط بموضع/قاعدة (Line→Segment→Rule). */
export interface LineSegment {
  id: EntityId;
  ayahKey: number;
  title: string;
  startPosition: number;
  endPosition: number;
  characterRange?: CharacterRange;
  notes?: string;
  origin: 'engine' | 'editor';
  createdAt: string;
  updatedAt: string;
}

/** نطاق عرض عند الوقف الداخلي (DM-11). */
export interface RenderRange {
  id: EntityId;
  ayahKey: number;
  fromPosition: number;
  toPosition: number;
  label?: string;
}

// ==================== القاعدة السياساتية (EngineRule) ====================

/** فئات قواعد Engine Studio (FR-ES-16).
 *
 * أضفنا فئات البيانات القديمة (`USUL`… إلخ) و`CORRECTION_BASED` للتوافق
 * مع ملفات التجارب السابقة. تبقى الفئات الأولى هي فئات السياسة المعتمدة؛
 * المترحل يحول القديمة إلى أقرب فئة سياسة عند الاعتماد.
 */
export type EngineRuleCategory =
  | 'DETECTION'
  | 'DIFFERENCE'
  | 'VARIANT'
  | 'MERGE'
  | 'SPLIT'
  | 'ORDERING'
  | 'RELATION'
  | 'CONTEXT'
  | 'WAQF'
  | 'WASL'
  | 'IBTIDA'
  | 'EXCEPTION'
  | 'OVERRIDE'
  | 'VALIDATION'
  | VariantCategory
  | 'CORRECTION_BASED';

/** نطاق تطبيق القاعدة. */
export type EngineRuleScope = 'CHARACTER' | 'WORD' | 'RANGE' | 'AYAH' | 'SURAH' | 'MUSHAF';

/** صلابة القاعدة (FR-ES-01). */
export type RuleHardness = 'HARD' | 'SOFT';

/** معاملات المقارنة المسموح بها في منشئ الشروط. */
export type RuleConditionOperator =
  | 'equals'
  | 'not-equals'
  | 'in'
  | 'not-in'
  | 'matches-pattern'
  | 'exists';

/** بنية شرط بلا كود (FR-ES-03).
 * `operator` اسم قديم مدعوم عند الاستيراد؛ `op` هو المفتاح المتسق في v8.
 */
export interface RuleCondition {
  field: string;
  op?: RuleConditionOperator;
  operator?: RuleConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  all?: Array<RuleCondition | ConditionGroup>;
  any?: Array<RuleCondition | ConditionGroup>;
  not?: Array<RuleCondition | ConditionGroup>;
}

/** إجراء جاهز اختياري بالنقر (FR-ES-03). */
export type RuleActionType =
  | 'CREATE_DIFFERENCE'
  | 'CREATE_VARIANT'
  | 'APPLY_RULE'
  | 'MERGE'
  | 'PREVENT_MERGE'
  | 'SPLIT'
  | 'CHANGE_ORDER'
  | 'SET_RANK'
  | 'CREATE_RELATION'
  | 'REMOVE_RELATION'
  | 'OVERRIDE_RESULT'
  | 'BLOCK_RESULT'
  | 'ASSIGN_CONTEXT'
  | 'GENERATE_CORRECTION';

/** أسماء إجراءات أقدم؛ تُقرأ ولا تنشئها واجهة v8 الجديدة. */
export type LegacyRuleActionType =
  | 'OVERRIDE_VARIANT'
  | 'MODIFY_VARIANT'
  | 'MERGE_VARIANTS'
  | 'SKIP_VARIANT';

export interface RuleAction {
  type: RuleActionType | LegacyRuleActionType;
  /** مفتاح v8 المعتمد. */
  params?: Record<string, unknown>;
  /** توافق مع ملفات الاختبارات/التجارب السابقة. */
  parameters?: Record<string, unknown>;
}

/** حالة تنفيذ القاعدة في ملف التصدير (Git-friendly — DM-13). */
export interface TestCase {
  name: string;
  input: unknown;
  expected: string;
}

/**
 * قاعدة سياسة في Engine Studio: شرط ← إجراء، بأولوية وخصوصية وحالة وإصدار
 * (FR-ES-02). لا يكتب المستخدم شروطا برمجية أبدا (FR-ES-02).
 */
export type EngineRuleType = 'DIFFERENCE' | 'ORDERING' | 'MERGE' | 'RELATION' | 'CONTEXT' | 'EXCEPTION';

/** بيانات وصفية قابلة للتوسع بلا منطق قرار مخفي. */
export interface EngineRuleMetadata {
  surahNumber?: number;
  ayahKeys?: number[];
  sourceCorrectionId?: EntityId;
  patternId?: EntityId;
  correctionCount?: number;
  [key: string]: unknown;
}

export interface EngineRule {
  id: EntityId;
  name: string;
  /** غياب الحقول الموروثة يعامل كقيمة افتراضية عند التطبيع. */
  type?: EngineRuleType;
  category: EngineRuleCategory;
  scope?: EngineRuleScope;
  conditions: ConditionGroup;
  actions: RuleAction[];
  /** أولوية رقمية صريحة (FR-ES-01). الأعلى أقوى. */
  priority: number;
  /** معرّف مجموعة الأولوية. */
  groupId?: string;
  /** مستوى الخصوصية (FR-ES-06): MUSHAF→SURAH→AYAH→SEGMENT→WORD→CHARACTER. */
  specificity?: SpecificityLevel;
  hardness?: RuleHardness;
  status?: RuleStatus;
  version?: number;
  protected?: boolean;
  description?: string;
  /** حقل توافقي؛ status=DISABLED يتقدم عليه في v8. */
  enabled?: boolean;
  source?: 'SYSTEM' | 'EDITOR' | 'CORRECTION' | 'CORRECTION_PATTERN' | 'IMPORT';
  metadata?: EngineRuleMetadata;
  /** معرّفات القواعد المعتمدة عليها/المتعارضة معها (FR-ES-07). */
  dependsOn?: EntityId[];
  overrides?: EntityId[];
  conflictsWith?: EntityId[];
  testCases?: TestCase[];
  createdAt: string;
  updatedAt: string;
}

/** القاعدة النشطة لا تكون معطلة صراحة ولا في حالة تعطيل/إهمال. */
export function isEngineRuleActive(rule: EngineRule): boolean {
  if (rule.enabled === false) return false;
  return rule.status === undefined || rule.status === 'ACTIVE' || rule.status === 'EXPERIMENTAL';
}

/** تطبيع قيم القاعدة القديمة إلى خيارات v8 الحتمية دون تعديل الأصل. */
export function normalizeEngineRule(rule: EngineRule): EngineRule {
  return {
    ...rule,
    type: rule.type ?? 'EXCEPTION',
    scope: rule.scope ?? 'MUSHAF',
    groupId: rule.groupId ?? 'fallback',
    specificity: rule.specificity ?? 'MUSHFAF',
    hardness: rule.hardness ?? 'SOFT',
    status: rule.status ?? (rule.enabled === false ? 'DISABLED' : 'ACTIVE'),
    version: rule.version ?? 1,
    enabled: rule.enabled ?? rule.status !== 'DISABLED',
  };
}

/** سلّم الخصوصية (FR-ES-06). */
export type SpecificityLevel = 'MUSHFAF' | 'SURAH' | 'AYAH' | 'SEGMENT' | 'WORD' | 'CHARACTER';

export const SPECIFICITY_RANK: Record<SpecificityLevel, number> = {
  MUSHFAF: 6,
  SURAH: 5,
  AYAH: 4,
  SEGMENT: 3,
  WORD: 2,
  CHARACTER: 1,
};

// ==================== الترتيب الصريح للقراء/الرواة/الطرق (DM-04, FR-ED-14) ====================

/** رتبة عرض صريحة للقارئ/الراوي/الطريق. */
export interface DisplayOrderEntry {
  id: EntityId;
  kind: 'IMAM' | 'NARRATOR' | 'PATH';
  /** الرقم الصريح: يسبق الاسم وتاريخ الإنشاء (P-04). */
  displayOrder: number;
}

// ==================== ملف المحرك (EngineConfig) ====================

/** مجموعة أولوية (FR-ES-01). */
export interface PriorityGroup {
  id: string;
  label: string;
  /** ترتيب المجموعة في السلم. */
  order: number;
}

/** سياسة حل التعارض (FR-ES-06). */
export type ConflictPolicyStep = 'MOST_SPECIFIC' | 'HIGHEST_PRIORITY' | 'EXPLICIT' | 'LOCAL' | 'READER' | 'MANUAL';

/** صف عنصر في مصفوفة الدمج (FR-ES-05). */
export interface MergeMatrixEntry {
  a: string;
  b: string;
  merge: boolean;
  /** conditional إذا تعلّق بالسياق. */
  conditional?: boolean;
  priority: number;
  reason: string;
}

/** سياقات الوقف/الوصل/ممنوع الوصل (FR-ES-16). */
export interface EngineContexts {
  waqf: EntityId[];
  wasl: EntityId[];
  ibtida: EntityId[];
  forbiddenConnection: EntityId[];
}

/**
 * ملف إعداد المحرك القابل للتصدير (DM-14، FR-ES-14، ملحق ب).
 * Git-friendly إلزامي (DM-13): ترتيب مفاتيح ثابت، معرّفات صريحة، إصدار.
 */
export interface EngineConfig {
  schemaVersion: 1;
  profile: string;
  priorityGroups: PriorityGroup[];
  rules: EngineRule[];
  /** سلم حل التعارض المرجَّح. */
  conflictPolicy: ConflictPolicyStep[];
  /** ترتيب التنفيذ (FR-ES-04). */
  executionOrder: string[];
  mergeMatrix: MergeMatrixEntry[];
  contexts: EngineContexts;
}

// ==================== المستند v8 ====================

/**
 * مستند تشجير آية واحد بالإصدار v8 (§5.3). يوسّع TashjeerDocument القديم:
 * differences بدل variants، relations صريحة، waqfMarks، corrections،
 * renderRanges، engineConfig محتمل.
 */
export interface TashjeerDocumentV8 {
  format: 'tashjeer-export';
  schemaVersion: 8;
  exportedAt: string;
  meta: { appVersion: string; profile: string };
  ayahKey: number;
  surahNumber: number;
  ayahNumber: number;
  /** الاختلافات (كانت variants). */
  differences: Difference[];
  /** خطوط العرض المشتقة/اليدوية. */
  lines: Line[];
  /** علاقات على مستوى المستند. */
  relations: Relation[];
  /** علامات الوقف/الابتداء/ممنوع الوصل. */
  waqfMarks: WaqfMark[];
  /** مواضع مشتقة من قواعد عامة + تجاوزاتها المحلية. */
  ruleOccurrences: RuleOccurrence[];
  /** نطاقات العرض عند الوقف الداخلي (DM-11). */
  renderRanges: RenderRange[];
  /** التصحيحات (Engine/Editor/Final). */
  corrections: Correction[];
  /** سجل التعديلات (قبل/بعد/سبب/مصدر). */
  auditLog: Array<{
    id: EntityId;
    at: string;
    actor: string;
    action: string;
    targetType: string;
    targetId: EntityId;
    summary: string;
    changes?: Array<{ field: string; before?: unknown; after?: unknown }>;
    source: 'engine' | 'editor';
  }>;
  /** وصل الآية بالتالية/المقطع المعزول. */
  readingWindow?: { linkNextAyah?: boolean; focusSegment?: { startPosition: number; endPosition: number } | null };
  /** ترتيب أسطر العرض اليدوي. */
  lineOrder?: EntityId[];
  createdAt: string;
  updatedAt: string;
}

// ==================== دوال مساعدة ====================

/** يبني موضعًا بسيطًا لكلمة واحدة. */
export function wordLocus(position: number): Locus {
  return { startPosition: position, endPosition: position };
}

/** يبني موضعًا لمدى من كلمة إلى كلمة (FR-ED-08 الخطوة 1). */
export function rangeLocus(startPosition: number, endPosition: number): Locus {
  return { startPosition, endPosition };
}

/** هل سياق الاختلاف نشط عند وصل مقطعين؟ */
export function isContextActive(context: RecitationContext, mode: 'WAQF' | 'WASL'): boolean {
  if (context === 'ALWAYS') return true;
  if (mode === 'WAQF') return context === 'WAQF_ONLY';
  return context === 'WASL_ONLY';
}

/** رتبة العلاقة القديمة مضمّنة في نوع العلاقة الجديد (DM-03). */
export function linkKindToRelationType(kind: TashjeerLinkKind): RelationType {
  switch (kind) {
    case 'FACE_TO_FACE':
      return 'COMPOSITE';
    case 'LINE_TO_LINE':
      return 'MERGE';
    case 'SEGMENT_TO_LINE':
    case 'SEGMENT_TO_RULE':
      return 'PART_OF';
    default:
      return 'MANUAL_LINK';
  }
}

/** يربط نوع علاقة جديد بعلاقة العرض القديمة (للتوافق). */
export function relationTypeToLinkRelation(type: RelationType): TashjeerLinkRelation {
  return type === 'MERGE' ? 'MERGE' : 'REFERENCE';
}

// إعادة تصدير الأنواع المعتمدة لسهولة الاستيراد من مكان واحد.
export type { ReadingScope, VariantCategory, VerificationStatus, CharacterRange, VariantAlternative };

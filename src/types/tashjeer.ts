// نموذج مجال التشجير - Tashjeer Domain Model
// مشروع التشجير - نظام القراءات العشر
//
// هذا الملف يعرّف النموذج الذي يعمل عليه المحرر فعليا.
// هو مستقل عن مخطط قاعدة البيانات (Prisma) عمدا، حتى يمكن للمحرر أن يعمل
// محليا بالكامل الآن، ثم يُربط بقاعدة البيانات لاحقا دون تغيير منطق الرسم.
//
// المفاهيم الأساسية:
//
//   الاختلاف (Variant)
//     موضع في الآية تختلف فيه القراءة. له فئة (أصول/فرش/مدود...) ومدى كلمات،
//     وقائمة أوجه (Alternatives). كل وجه له نطاق (Scope) يحدد من يقرأ به.
//
//   النطاق (Scope)
//     تعبير عن مجموعة من الرواة، إما بالتعداد أو بالاستثناء أو على مستوى الإمام.
//     الهدف ألا نكرر الحكم عشرين مرة عندما يقرأ به تسعة عشر راويا.
//
//   المستند (TashjeerDocument)
//     كل ما يخص تشجير آية واحدة: الاختلافات، والخطوط المرسومة، وبيانات التوثيق.
//
//   الخط (TashjeerLine) والعقدة (TashjeerNode)
//     الناتج البصري: مسار يربط موضع الكلمة بمسار أفقي (Lane) ثم ببطاقة الوجه.
//     الخطوط تُشتق تلقائيا من الاختلافات، ويمكن للمستخدم تعديلها يدويا.

import type { VariantCategory } from './index';

// ==================== النطاق ====================

/** نوع تعبير النطاق. */
export type ScopeKind =
  /** كل الرواة العشرين */
  | 'ALL'
  /** كل الرواة عدا المذكورين */
  | 'ALL_EXCEPT'
  /** قائمة رواة محددة */
  | 'NARRATORS'
  /** كل رواة إمام أو أئمة محددين */
  | 'IMAMS'
  /** طرق محددة داخل رواية */
  | 'PATHS';

/**
 * تعبير عن مجموعة قرّاء.
 *
 * الحقول تُملأ حسب `kind`:
 *   ALL          → لا شيء
 *   ALL_EXCEPT   → narratorIds (المستثنون)
 *   NARRATORS    → narratorIds
 *   IMAMS        → imamIds
 *   PATHS        → pathIds
 */
export interface ReadingScope {
  kind: ScopeKind;
  /** معرّفات الرواة، مثل: narrator-hafs */
  narratorIds?: string[];
  /** معرّفات الأئمة، مثل: imam-asim */
  imamIds?: string[];
  /** معرّفات الطرق، مثل: path-hafs-ubayd */
  pathIds?: string[];
}

// ==================== الاختلاف ====================

/** حالة التوثيق لأي عنصر يحتاج مراجعة علمية. */
export type VerificationStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED';

/** مصدر الدليل. */
export type EvidenceSource = 'TAYYIBAH' | 'NASHR' | 'JANNAH' | 'OTHER';

/** دليل مرتبط بوجه من أوجه الاختلاف. */
export interface VariantEvidence {
  id: string;
  /** المصدر: الطيبة، النشر، الجنة، أو غيرها */
  source: EvidenceSource;
  /** نص الدليل كما ورد */
  text: string;
  /** مرجع الدليل: رقم البيت أو الصفحة */
  reference?: string;
  /** رابط خارجي اختياري */
  url?: string;
}

/** وجه من أوجه الاختلاف: نص معيّن يقرأ به نطاق معيّن. */
export interface VariantAlternative {
  id: string;
  /** النص المقروء بهذا الوجه (بالتشكيل) */
  text: string;
  /** وصف مختصر للوجه، مثل: بالألف، بالسين، بالإشمام */
  label: string;
  /** من يقرأ بهذا الوجه */
  scope: ReadingScope;
  /** هل هذا هو وجه رواية حفص (النص المطبوع في المصحف) */
  isBase?: boolean;
  /** ملاحظات المحرر */
  notes?: string;
  /** أدلة هذا الوجه */
  evidences?: VariantEvidence[];
}

/** اختلاف قرائي في موضع محدد من الآية. */
export interface Variant {
  id: string;
  /** معرّف الآية: surah * 1000 + ayah */
  ayahKey: number;
  /** فئة الاختلاف */
  category: VariantCategory;
  /** عنوان الاختلاف، مثل: مالك / ملك */
  title: string;
  /** أول كلمة يشملها الاختلاف (1-based داخل الآية) */
  startPosition: number;
  /** آخر كلمة يشملها الاختلاف (1-based، وتساوي startPosition للكلمة الواحدة) */
  endPosition: number;
  /** الأوجه، ويجب أن يكون فيها وجه واحد على الأقل غير وجه الأساس */
  alternatives: VariantAlternative[];
  /** حالة التوثيق: البيانات الأولية مسودة حتى يعتمدها مختص */
  status: VerificationStatus;
  /** شرح إضافي */
  description?: string;
  /** مصدر الاستقاء العام للاختلاف */
  sourceRef?: string;
}

// ==================== التخطيط البصري ====================

/** موضع كلمة داخل لوحة الرسم بعد القياس والتوزيع على الأسطر. */
export interface WordBox {
  wordId: number;
  /** ترتيب الكلمة داخل الآية */
  position: number;
  /** نص الكلمة */
  text: string;
  /** رقم السطر داخل الآية (0-based) */
  lineIndex: number;
  /** إحداثي الحافة اليسرى في نظام اللوحة */
  x: number;
  /** إحداثي الحافة العليا لصندوق الكلمة */
  y: number;
  width: number;
  height: number;
  /** مركز الكلمة أفقيا: نقطة ارتباط خطوط التشجير */
  centerX: number;
  /** خط الأساس (baseline) الذي يُرسم عليه النص */
  baselineY: number;
  /** أعلى صندوق الكلمة: نقطة ربط خطوط الأصول */
  topY: number;
  /** أسفل صندوق الكلمة: نقطة ربط خطوط الفرش */
  bottomY: number;
}

/** ناتج تخطيط آية كاملة. */
export interface AyahLayout {
  ayahKey: number;
  /** صناديق الكلمات مرتبة حسب ترتيبها في الآية */
  boxes: WordBox[];
  /** فهرس سريع بالمعرّف */
  boxById: Map<number, WordBox>;
  /** فهرس سريع بالترتيب */
  boxByPosition: Map<number, WordBox>;
  /** عدد الأسطر التي احتاجتها الآية */
  lineCount: number;
  /** ارتفاع منطقة النص */
  textHeight: number;
  /** عرض اللوحة المستخدم في الحساب */
  canvasWidth: number;
}

/** إعدادات التخطيط القابلة للضبط من الواجهة. */
export interface LayoutOptions {
  /** عرض اللوحة الكلي */
  canvasWidth: number;
  /** هامش أيمن */
  paddingRight: number;
  /** هامش أيسر */
  paddingLeft: number;
  /** مسافة من أعلى اللوحة حتى أول سطر نص */
  textTop: number;
  /** حجم خط المصحف */
  fontSize: number;
  /** المسافة الأفقية بين الكلمات */
  wordGap: number;
  /** المسافة الرأسية بين أسطر النص */
  lineHeight: number;
  /** ارتفاع كل مسار (Lane) لخطوط التشجير */
  laneHeight: number;
  /** المسافة بين منطقة النص وأول مسار */
  laneGap: number;
}

// ==================== الخطوط والعقد ====================

/** موضع ربط الخط بالكلمة. */
export type AnchorSide = 'TOP' | 'BOTTOM';

/** عقدة: نقطة ارتباط خط تشجير بكلمة. */
export interface LineNode {
  id: string;
  /** معرّف الكلمة المرتبطة */
  wordId: number;
  /** ترتيب الكلمة داخل الآية */
  position: number;
  /** جهة الارتباط */
  anchor: AnchorSide;
}

/** خط تشجير واحد يمثل وجها من أوجه اختلاف. */
export interface TashjeerBranch {
  id: string;
  /** الاختلاف الذي ينتمي إليه هذا الخط */
  variantId: string;
  /** الوجه الذي يمثله */
  alternativeId: string;
  /** فئة الاختلاف، تحدد اللون والمنطقة */
  category: VariantCategory;
  /** العقد المرتبطة بالكلمات */
  nodes: LineNode[];
  /** رقم المسار الأفقي المخصص لهذا الخط */
  lane: number;
  /** جهة الرسم: الأصول أعلى النص، والفرش أسفله */
  side: AnchorSide;
  /** نص البطاقة الظاهرة في نهاية الخط */
  label: string;
  /** لون الخط */
  color: string;
  /** هل عدّل المستخدم هذا الخط يدويا (فلا يُعاد توليده تلقائيا) */
  isManual?: boolean;
  /** هل الخط مخفي في العرض الحالي */
  isHidden?: boolean;
}

/** الخط بعد الحساب الهندسي، جاهز للرسم في SVG. */
export interface RenderedBranch extends TashjeerBranch {
  /** مسار SVG الكامل */
  path: string;
  /** إحداثي المسار الأفقي */
  laneY: number;
  /** موضع بطاقة الوجه */
  labelX: number;
  labelY: number;
  /** نقاط ارتباط الخط بالكلمات بعد الحساب */
  points: Array<{ x: number; y: number; wordId: number }>;
}

// ==================== المستند ====================

/** بيانات توثيق المستند. */
export interface DocumentMeta {
  createdAt: string;
  updatedAt: string;
  /** من أنشأ المستند (اسم محلي في هذه المرحلة) */
  author: string;
  /** حالة المستند في دورة المراجعة */
  status: VerificationStatus;
  /** ملاحظات عامة */
  notes?: string;
}

/** مستند تشجير آية واحدة: وحدة الحفظ والتحميل والتصدير. */
export interface TashjeerDocument {
  /** إصدار صيغة الملف، لدعم الترقية لاحقا */
  schemaVersion: number;
  ayahKey: number;
  surahNumber: number;
  ayahNumber: number;
  /** الاختلافات المعتمدة في هذه الآية */
  variants: Variant[];
  /** الخطوط المرسومة */
  branches: TashjeerBranch[];
  meta: DocumentMeta;
}

// ==================== خيارات العرض ====================

/** تصفية العرض داخل المحرر. */
export interface ViewFilter {
  /** الفئات الظاهرة */
  categories: VariantCategory[];
  /** إن حُدد، تُعرض الخطوط التي يشترك فيها هؤلاء الرواة فقط */
  narratorIds: string[];
  /** إظهار بطاقات الأوجه */
  showLabels: boolean;
  /** إظهار الشبكة */
  showGrid: boolean;
  /** إظهار المساطر */
  showRulers: boolean;
  /** إظهار نقاط الارتباط على الكلمات */
  showAnchors: boolean;
}

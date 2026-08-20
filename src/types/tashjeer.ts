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
  /**
   * اسم الحكم الذي يُطبع تحت الكلمة تماما في الشجرة: إمالة، تقليل، سكت،
   * إدغام، تسهيل... إن غاب استُعمل `label`. هذا هو النص الذي يقرأه المستعمل
   * فوق السطر عند موضع الكلمة، لا في طرف السطر.
   */
  ruleLabel?: string;
  /**
   * عدد حركات المد (٢، ٤، ٥، ٦). يُطبع في الهامش الأيمن قبالة السطر كما في
   * المصاحف المشجّرة، ويميّز المنفصل عن المتصل عند تعدد الأوجه في الموضع.
   */
  maddHarakat?: number;
  /**
   * قوة الوجه كما في الكتاب المعتمد. الأصغر أقوى، فيأخذ السطر الأعلى تحت
   * الآية عند اعتماد ترتيب «قوة الوجه». يتركه المحقق فارغا إن لم يرجّح.
   *
   * @deprecated أُدمج هذا الحقل مع مفهوم «الوجه المقدَّم» في سلّم الدرجات
   * القابل للتحرير: استعمل `strengthDegreeId` و`strengthByNarrator`. يبقى
   * الحقل مقروءا لترتيب ما حُفظ قبل الترقية.
   */
  strength?: number;
  /**
   * درجة قوة الوجه العامة (معرّف من سلّم الدرجات)، تسري على كل راوٍ لم
   * تُخصَّص له درجة. أعلى الدرجات رتبةً هي «الوجه المقدَّم».
   */
  strengthDegreeId?: string;
  /**
   * درجة كل راوٍ على حدة: معرّف الراوي ← معرّف الدرجة.
   *
   * ضرورة علمية لا ترف: الوجه الواحد قد يكون مقدَّما عند راوٍ مؤخَّرا عند
   * آخر، فلا يصح حصر الترجيح في رقم واحد للوجه كله.
   */
  strengthByNarrator?: ReaderStrengthMap;
}

/** خريطة درجة القوة لكل راوٍ: معرّف الراوي ← معرّف الدرجة. */
export type ReaderStrengthMap = Record<string, string>;

/** طريقة تثبيت موضع الاختلاف: كلمات كاملة أو حروف مرئية داخل الكلمات. */
export type VariantTargetKind = 'WORDS' | 'CHARACTERS';

/** مرجع حرف مرئي داخل كلمة. الفهرس 1-based ويضم الحرف مع تشكيله التابع. */
export interface CharacterAnchor {
  /** ترتيب الكلمة داخل الآية (1-based). */
  position: number;
  /** ترتيب الحرف المرئي داخل الكلمة (1-based). */
  characterIndex: number;
}

/** نطاق متصل من الحروف، شامل للبداية والنهاية. */
export interface CharacterRange {
  start: CharacterAnchor;
  end: CharacterAnchor;
}

/**
 * موضع اختلاف واحد داخل الآية: كلمة أو مدى كلمات، أو حروف داخلها.
 *
 * الاختلاف الواحد قد يجمع مواضع متباعدة (صلة في كلمتين) دون أن يملأ ما
 * بينهما بخط. غياب القائمة يعني الاعتماد على start/end التقليدي.
 */
export interface VariantLocus {
  startPosition: number;
  endPosition: number;
  characterRange?: CharacterRange;
}

// ==================== قواعد المصحف العامة ====================

/**
 * سياسة مطابقة علامات الضبط عند تطبيق قاعدة نمطية.
 *
 * SAKIN حالة أداء لا مجرد علامة: يطابق الحرف الساكن بعلامة السكون بصورتيها
 * (ْ الحديثة و ۡ العثمانية) وكذلك الحرف «المعرّى» من الحركة، وهو رسم النون
 * والميم الساكنتين قبل الإدغام والإخفاء في الضبط العثماني.
 */
export type HarakaMatchMode = 'EXACT' | 'IGNORE' | 'NONE' | 'SAKIN';

/** موضع الحرف المطلوب داخل الكلمة، حتى لا تقيد القاعدة طول الكلمة بلا داع. */
export type PatternCharacterAnchor = 'START' | 'END' | 'INDEX';

/** مجموعات حروف معلومة يمكن اختيارها بدلا من حرف واحد، مثل حروف الإخفاء. */
export type GlobalCharacterSet =
  | 'EXACT'
  | 'IKHFAA'
  | 'IZHAR'
  | 'IDGHAM'
  | 'IQLAB'
  | 'QALQALAH'
  | 'GHUNNAH'
  | 'MAD';

/** قيد حرف واحد في قاعدة حروف عامة. */
export interface GlobalCharacterConstraint {
  /** الحرف الأساسي كما هو في الرسم العثماني. */
  baseLetter: string;
  /** إن لم تكن EXACT: المجموعة التي يجوز أن ينتمي إليها الحرف. */
  letterSet?: GlobalCharacterSet;
  /** علامات الضبط التابعة للحرف وقت إنشاء القاعدة. */
  marks: string;
  /** هل تطابق القاعدة الضبط، تتجاهله، أم تشترط غيابه؟ */
  harakaMode: HarakaMatchMode;
  /** تثبيت من بداية الكلمة أو نهايتها أو على رقم حرف مطلق. */
  anchor: PatternCharacterAnchor;
  /** إزاحة صفرية من البداية/النهاية، أو فهرس 1-based عند INDEX. */
  value: number;
}

/** نمط كلمة داخل قاعدة حروف متعددة الكلمات. */
export interface GlobalWordCharacterPattern {
  /** إزاحة الكلمة بالنسبة لأول كلمة في الموضع (0-based). */
  offset: number;
  /** الحروف التي يجب أن تتوافر في هذه الكلمة. */
  constraints: GlobalCharacterConstraint[];
  /** إن وُجد، يجب أن يساوي عدد الحروف المرئية في الكلمة تماما. */
  exactLength?: number;
}

/**
 * أين يُبحث عن تتابع الحروف؟
 *
 * القاعدة الصوتية الواحدة (كنون ساكنة قبل حرف إخفاء) تجري بين كلمتين
 * («مِنۡ ثَمَرَةٖ») وتجري داخل الكلمة الواحدة («أَنتُمۡ»، «يُنفِقُونَ»).
 * فالمحقق يختار: مطابقة عبر الكلمات كما حُدِّدت، أو داخل الكلمة الواحدة
 * حيث يُبحث عن التتابع نفسه حروفا متجاورة، أو الاثنين معا للدقة الكاملة.
 */
export type CharacterMatchScope = 'WORDS' | 'INSIDE_WORD' | 'BOTH';

/** قاعدة حروف: كلمات متجاورة داخل الآية نفسها، بلا عبور حد الآية افتراضيا. */
export interface GlobalCharacterPattern {
  kind: 'CHARACTERS';
  version: 1;
  wordCount: number;
  words: GlobalWordCharacterPattern[];
  sourceAyahKey?: number;
  sourceRange?: CharacterRange;
  /**
   * نطاق البحث عن التتابع. غيابه يعني WORDS (سلوك الإصدارات السابقة):
   * مطابقة الكلمات كما حُدِّدت بمراسي البداية/النهاية.
   */
  matchScope?: CharacterMatchScope;
}

/**
 * خاصية صرفية حتمية، تُفحص من الرسم والضبط وحدهما بلا معجم ولا تخمين.
 *
 * كل خاصية هنا لها علامة ظاهرة في الكلمة: تاء مربوطة، ألف مقصورة، ياء
 * مشددة... فما لا تظهر علامته لا يُدرج، حفاظا على حتمية النتيجة.
 */
export type MorphologyFeature =
  /** تاء التأنيث المربوطة: ـة */
  | 'TAA_MARBUTA'
  /** تاء التأنيث المبسوطة في آخر الكلمة: ـت */
  | 'TAA_MAFTUHA'
  /** ألف التأنيث المقصورة: ـى */
  | 'ALIF_MAQSURA'
  /** ألف التأنيث الممدودة: ـاء */
  | 'ALIF_MAMDUDA'
  /** ياء النسب المشددة: ـيّ */
  | 'NISBA_YAA'
  /** علامة التثنية: ـان أو ـين */
  | 'DUAL_SUFFIX'
  /** جمع المذكر السالم: ـون أو ـين */
  | 'SOUND_MASCULINE_PLURAL'
  /** جمع المؤنث السالم: ـات */
  | 'SOUND_FEMININE_PLURAL'
  /** معرّف بأل */
  | 'DEFINITE_AL'
  /** منوّن بأي تنوين */
  | 'TANWEEN'
  /** فيه حرف مشدد */
  | 'SHADDA'
  /** فيه همزة بأي صورة */
  | 'HAMZA'
  /** فيه حرف مد */
  | 'MADD_LETTER'
  /** آخره نون ساكنة (بعلامة السكون بصورتيها، أو نون معرّاة تُدغم) */
  | 'NOON_SAKINA_END'
  /** آخره ميم ساكنة (بعلامة السكون بصورتيها، أو ميم معرّاة) */
  | 'MEEM_SAKINA_END'
  /** واو الجماعة في الآخر: ـوا / ـواْ / ـوٓاْ */
  | 'PLURAL_WAW'
  /** يبدأ بهمزة الوصل ٱ كما في الرسم العثماني */
  | 'HAMZAT_WASL_START'
  /** معرّف بأل الشمسية (اللام غير المنطوقة وما بعدها مشدد) */
  | 'SHAMSI_AL'
  /** معرّف بأل القمرية (اللام الساكنة المنطوقة) */
  | 'QAMARI_AL'
  /** ينتهي بضمير متصل ظاهر من قائمة مغلقة: هم، هما، هن، كم، كما، كن، ها، نا */
  | 'ATTACHED_PRONOUN';

/**
 * فئة أداة نحوية مغلقة العدد.
 *
 * هذه هي الطريقة الوحيدة الأمينة لإدخال النحو في قاعدة آلية: الأدوات
 * محصورة معدودة، فالحكم على ما بعدها حتمي، بخلاف الإعراب المحتمِل الذي
 * يحتاج تحليلا لا يجوز أن يخمّنه المحرك.
 */
export type ParticleClass =
  /** حروف الجر */
  | 'JARR'
  /** نواصب الفعل المضارع */
  | 'NASB'
  /** جوازم الفعل المضارع */
  | 'JAZM'
  /** إنّ وأخواتها */
  | 'INNA'
  /** كان وأخواتها */
  | 'KANA'
  /** أدوات النداء */
  | 'NIDA'
  /** أدوات الاستفهام */
  | 'ISTIFHAM'
  /** أدوات الشرط */
  | 'SHART'
  /** حروف العطف */
  | 'ATF'
  /** أدوات النفي */
  | 'NAFY'
  /** الأسماء الموصولة */
  | 'MAWSUL';

/** حركة آخر حرف في الكلمة؛ علامة الإعراب الظاهرة كما رُسمت في المصحف. */
export type WordEndingHaraka =
  | 'DAMMA'
  | 'FATHA'
  | 'KASRA'
  | 'SUKUN'
  | 'TANWEEN_DAMM'
  | 'TANWEEN_FATH'
  | 'TANWEEN_KASR';

/** موقع الكلمة من الآية؛ يهم الوقف والابتداء. */
export type AyahWordPosition = 'ANY' | 'FIRST' | 'LAST' | 'NOT_LAST';

/**
 * نمط كلمة واحدة بمعايير صرفية ونحوية.
 *
 * كل المعايير المذكورة يجب أن تتحقق معا (AND). ترك المعيار فارغا يعني
 * عدم التقييد به.
 */
export interface GlobalMorphologyWordPattern {
  /** إزاحة الكلمة بالنسبة لأول كلمة في الموضع (0-based). */
  offset: number;
  /** قالب مثل «فَعْلَى»؛ ف وع ول حروف جذر بديلة، وما سواها حرف حرفي. */
  template?: string;
  /** بادئة أو لاحقة حرفية اختيارية، مثل «ال» أو «ة». */
  prefix?: string;
  suffix?: string;
  /** سياسة مطابقة علامات الضبط للقالب والبادئة واللاحقة. */
  harakaMode: HarakaMatchMode;
  /**
   * أول حرف في الكلمة من مجموعة تجويدية معلومة (حروف الإخفاء مثلا)،
   * بغضّ النظر عن حركته. يجعل قاعدة «كلمة تليها كلمة تبدأ بحرف إخفاء»
   * ممكنة بالمعايير لا بتعداد الحروف الخمسة عشر يدويا.
   */
  startsWithSet?: Exclude<GlobalCharacterSet, 'EXACT'>;
  /** آخر حرف في الكلمة من مجموعة تجويدية معلومة، بغضّ النظر عن حركته. */
  endsWithSet?: Exclude<GlobalCharacterSet, 'EXACT'>;
  /** خصائص صرفية يجب توافرها كلها في الكلمة. */
  morphologyFeatures?: MorphologyFeature[];
  /** خصائص صرفية يجب ألا تتوافر، لاستثناء ما يشبه المطلوب ولا يراد. */
  excludedMorphologyFeatures?: MorphologyFeature[];
  /** حركات آخر الكلمة المقبولة؛ تحقق واحدة منها يكفي. */
  endingHaraka?: WordEndingHaraka[];
  /** فئات الأداة التي تسبق الكلمة مباشرة؛ تحقق واحدة منها يكفي. */
  precededBy?: ParticleClass[];
  /** فئات الأداة التي تلي الكلمة مباشرة؛ تحقق واحدة منها يكفي. */
  followedBy?: ParticleClass[];
  /** موقع الكلمة من الآية. */
  ayahPosition?: AyahWordPosition;
  /** أقل عدد حروف مرئية في الكلمة. */
  minLength?: number;
  /** أكثر عدد حروف مرئية في الكلمة. */
  maxLength?: number;
}

/**
 * قاعدة على القواعد النحوية والصرفية.
 *
 * لا تدّعي إعرابا محتمِلا ولا تحليلا لغويا احتماليا: كل شرط فيها إما علامة
 * ظاهرة في الرسم، أو أداة من قائمة مغلقة معدودة.
 */
export interface GlobalMorphologyPattern {
  kind: 'MORPHOLOGY';
  version: 1;
  /**
   * عدد الكلمات المتجاورة التي تصفها القاعدة. كان 1 حصرا في الإصدارات
   * السابقة، وأصبح يقبل حتى 4 كلمات متتابعة داخل الآية الواحدة، فيمكن وصف
   * «كلمة تنتهي بنون ساكنة تليها كلمة تبدأ بحرف إخفاء» نحويا لا حرفيا فقط.
   */
  wordCount: number;
  words: GlobalMorphologyWordPattern[];
  sourceAyahKey?: number;
}

export type GlobalRulePattern = GlobalCharacterPattern | GlobalMorphologyPattern;

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
  /**
   * نوع التحديد. غيابه في ملفات الإصدار القديم يعني WORDS للحفاظ على التوافق.
   * عند CHARACTERS يبقى مدى الكلمات موجودا كي يستطيع محرك التشجير ترتيب السطر.
   */
  targetKind?: VariantTargetKind;
  /** البداية والنهاية الدقيقتان عند تحديد الحروف. */
  characterRange?: CharacterRange;
  /**
   * المواضع الفعلية للاختلاف إن تعددت وتباعدت.
   *
   * إن غابت فالمحرك يستعمل start/end (وcharacterRange) كما في الملفات القديمة.
   * إن وُجدت رُسمت علامة على كل موضع وحده، بلا خط غليظ يملأ الفجوة.
   */
  loci?: VariantLocus[];
  /** الأوجه، ويجب أن يكون فيها وجه واحد على الأقل غير وجه الأساس */
  alternatives: VariantAlternative[];
  /** حالة التوثيق: البيانات الأولية مسودة حتى يعتمدها مختص */
  status: VerificationStatus;
  /** هل هذا اختلاف مشتق مؤقتا من قاعدة عامة، وليس محفوظا في قائمة الآية؟ */
  isGlobalDerived?: boolean;
  /** معرّف القاعدة العامة التي اشتُق منها، عند العرض والتدقيق. */
  globalRuleId?: string;
  /** شرح إضافي */
  description?: string;
  /** مصدر الاستقاء العام للاختلاف */
  sourceRef?: string;
  /**
   * رتبة الموضع في ترتيب المرور، يحددها المحقق يدويا لهذه الآية.
   * الأصغر يُعالج أولا فيأخذ السطر الأعلى. غيابه يعني اعتماد قاعدة المحرك.
   */
  orderRank?: number;
  /**
   * ترتيب الأوجه داخل هذا الموضع بمعرّفاتها. ما ورد هنا يُقدَّم بترتيبه،
   * وما لم يرد يأتي بعده بقاعدة المحرك. هذا هو «التحكم في كل موضع».
   */
  alternativeOrder?: string[];
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
  /**
   * مواضع يُفرض بعدها الانتقال إلى سطر نصي جديد.
   * الموضع 1-based داخل الآية، وتبقى الأسطر التلقائية فعالة عند امتلاء العرض.
   */
  forcedLineBreakAfter?: number[];
  /** إزاحة رأسية اختيارية لكل سطر نصي (مفتاحها رقم السطر 0-based). */
  lineOffsets?: Record<number, number>;
  /**
   * نص الآية في سطر واحد مهما طال: لا التفاف ولا كسر تلقائي.
   *
   * عندها يتمدد عرض اللوحة ليسع الآية، ويتكفل التكبير/التصغير في المحرر
   * بعرضها. الالتفاف كان يقطع الآية سطرين فتنكسر أعمدة التشجير.
   */
  singleLine?: boolean;
}

/**
 * ضبط تخطيط خاص بآية واحدة. حفظه في المستند يجعل موضع السطر قابلا للمراجعة
 * والتصدير، بدلا من أن يكون أثرا عابرا في المتصفح.
 */
export interface DocumentLayoutSettings extends Partial<LayoutOptions> {
  forcedLineBreakAfter: number[];
  lineOffsets: Record<number, number>;
}

// ==================== الوقف والابتداء ====================

/** نوع العلامة التي يضبطها المحرر في مسار القراءة. */
export type RecitationBoundaryKind = 'WAQF' | 'IBTIDA' | 'WASL';

/**
 * علامة وقف أو ابتداء أو وصل داخل الآية.
 *
 * - WAQF: الوقف بعد الكلمة ذات `position`.
 * - IBTIDA: الابتداء قبل الكلمة ذات `position`.
 * - WASL: وصل بعد الكلمة؛ وعند آخر كلمة يمكن أن يصل بالآية التالية.
 */
export interface RecitationBoundary {
  id: string;
  kind: RecitationBoundaryKind;
  /** ترتيب الكلمة داخل الآية (1-based). */
  position: number;
  /** من يخصه هذا الوقف أو الابتداء؛ غيابه يعني الجميع. */
  scope?: ReadingScope;
  /** وصف ظاهر للمراجع، مثل: وقف كافٍ أو وصل أولى. */
  label?: string;
  notes?: string;
  /** لا يصح إلا عند آخر كلمة: يربط نهاية الآية بأول الآية التالية. */
  connectsToNextAyah?: boolean;
}

/**
 * نافذة العمل المحفوظة مع المستند.
 *
 * الوقف والابتداء لا يقفان عند حدود الآية: قد يوصل القارئ آخر الآية بأول
 * التي بعدها فيقع الحكم بينهما، وقد يقف المحقق في وسط الآية فيريد تشجير
 * المقطع وحده. وحفظ هذين الاختيارين في المستند يجعلهما قابلين للمراجعة
 * والتصدير، لا مجرد حالة عابرة في المتصفح.
 */
export interface ReadingWindowSettings {
  /** وصل هذه الآية بالتي بعدها في نافذة واحدة متصلة المواضع. */
  linkNextAyah?: boolean;
  /** تشجير مقطع محدد وحده (مواضع النافذة، شاملة الطرفين). */
  focusSegment?: { startPosition: number; endPosition: number } | null;
}

/** سطر يدوي دلالي، للحالات التي يحتاج فيها المحقق إلى إضافة سطر مستقل. */
/** جزء محدد من سطر؛ مرجعه ثابت حتى يمكن ربطه بقاعدة أو سطر آخر بلا نسخ للسطر. */
export interface LineSegment {
  id: string;
  lineId: string;
  startPosition: number;
  endPosition: number;
  characterRange?: CharacterRange;
  ruleId?: string;
  label?: string;
}

/** علاقة حرّة يصنعها المحرر، بين وجهين أو سطرين أو جزء وقاعدة. */
export interface EditorRelation {
  id: string;
  kind: 'COMPOSITE_FACE' | 'LINE_LINK' | 'SEGMENT_RULE';
  source: { ayahKey: number; lineId?: string; branchId?: string; alternativeId?: string; segmentId?: string };
  target: { ayahKey: number; lineId?: string; branchId?: string; alternativeId?: string; ruleId?: string };
  label?: string;
  createdAt: string;
}

/** سجل قابل للمراجعة يبيّن ما اقترحه المحرك وما غيّره المحرر. */
export interface ChangeRecord {
  id: string;
  at: string;
  source: 'ENGINE' | 'EDITOR' | 'IMPORT';
  action: string;
  entityType: 'variant' | 'branch' | 'line' | 'segment' | 'relation' | 'document';
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export interface ManualTashjeerLine {
  id: string;
  title: string;
  category: VariantCategory;
  startPosition: number;
  endPosition: number;
  /** ترتيب السطر (0 = الأقرب إلى النص). */
  lane: number;
  /** إزاحة دقيقة من موضع السطر، بوحدات SVG. */
  rowOffset?: number;
  /** نطاق السطر إن كان خاصا ببعض الرواة. */
  scope?: ReadingScope;
  /** نص مختصر يُطبع على السطر. */
  label?: string;
  /** الأجزاء القابلة لإعادة الاستخدام والربط داخل السطر. */
  segments?: LineSegment[];
  isHidden?: boolean;
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
  /** بداية الحروف التي ترتبط بها العقدة، إن كان الموضع حرفيا. */
  characterStart?: number;
  /** نهاية الحروف التي ترتبط بها العقدة، إن كان الموضع حرفيا. */
  characterEnd?: number;
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
  /**
   * إزاحة دقيقة من موضع المسار. لا تُستعمل إلا عندما يضبطها المحرر يدويا؛
   * تتيح تصحيح تزاحم بطاقة أو محاذاة شكل التشجير من دون تغيير بيانات الوجه.
   */
  rowOffset?: number;
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
  /** أسطر دلالية يضيفها المحرر عند الحاجة إلى بيان مستقل. */
  manualLines: ManualTashjeerLine[];
  /** مواضع الوقف والابتداء والوصل الخاصة بهذه الآية. */
  boundaries: RecitationBoundary[];
  /** ضبط مواضع أسطر النص لهذه الآية. */
  layout: DocumentLayoutSettings;
  /** وصل الآية بالتالية، والمقطع المشجَّر وحده. */
  readingWindow?: ReadingWindowSettings;
  /** علاقات يعرّفها المحرر، مستقلة عن افتراضات المحرك والقارئ. */
  relations: EditorRelation[];
  /** تاريخ التعديلات القابل للتدقيق والتصدير. */
  changeLog: ChangeRecord[];
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

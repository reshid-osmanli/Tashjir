// محرك التشجير الكلاسيكي - Classic Tashjeer Engine
//
// يحوّل الأوجه إلى الأسطر المعهودة في المصحف المشجّر، بالشكل المعتمد:
//
//   ┌──────────────────────────────────────────────────────────┐
//   │            نص الآية (رواية الأساس) في سطر واحد            │
//   └──────────────────────────────────────────────────────────┘
//                        │        │
//                     الحكم     الحكم        ← اسم الحكم فوق السطر عند الكلمة
//   ج ع  ├───────────────────────────────────────────────┤ ٥
//   ف    ├───────────────────────────────────────────────┤ ٤
//   ق    ├───────────────────────────────────────────────┤
//   ↑ رموز القراء في الطرف الأيسر        حركات المد في الهامش الأيمن ↑
//
// وإن خلت الآية من الخلاف رُسم سطر واحد وحده:
//
//   جمهور ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
//
// القواعد المطبّقة هنا:
//
//   1. كل الأسطر تحت الآية، متتالية تنازليا سطرا واحدا تلو الآخر. لا يُرسم
//      شيء فوق النص؛ كان وضع الأصول والمدود فوقه خطأ في الإصدار السابق.
//   2. السطر يمتد مع الآية كلها افتراضيا (LineSpanMode = FULL_AYAH)، لأن
//      امتداده يبيّن اتفاق الراوي مع السطر الذي قبله. الوصلة الرأسية وحدها
//      هي التي تشير إلى موضع الاختلاف.
//   3. اسم الحكم (إمالة، تقليل، سكت، إدغام...) يُطبع عند الكلمة المختلفة
//      تماما، ورموز القراء تُطبع في **الطرف الأيسر** من السطر: ترتيب قراءة
//      الاختلاف يبدأ من آخر كلمة في الآية، وآخر الآية يسارا في الرسم العربي.
//   4. حركات المد تُطبع في الهامش الأيمن قبالة السطر.
//   4.b مع كل سطر — اختلافا كان أو اتفاقا — خط توضيحي رفيع بطول الآية كلها،
//      منفصل عن خط الوجه، يقود العين من الكلمة إلى بطاقة قارئها.
//   4.c عند خلو الآية من الخلاف يُرسم سطر واحد عنوانه «جمهور» بلا اسم راوٍ.
//      تسميته «جمهور حفص» خطأ: حفص أحد القراء لا مرجع الاتفاق.
//   5. ترتيب المواضع: من آخر الآية إلى أولها، ما لم يثبّت المحقق رتبة
//      يدوية للموضع (`variant.orderRank`).
//   6. ترتيب أوجه الموضع الواحد: قوة الوجه من الكتاب افتراضيا، ويمكن
//      اعتماد ترتيب الطيبة أو ترتيب المحقق الصريح من لوحة التحكم.
//
// هذا المحرك لا يقرر صحة وجه أو وقف علميا. مهمته أن يرسم البيانات التي أدخلها
// المحقق بصورة حتمية، مع احترام الوقف والابتداء والمواضع اليدوية للأسطر.

import type { VariantCategory } from '@/types';
import type {
  AyahLayout,
  LayoutOptions,
  ManualTashjeerLine,
  RecitationBoundary,
  TashjeerBranch,
  Variant,
  VariantAlternative,
  ViewFilter,
} from '@/types/tashjeer';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import {
  createDefaultStrengthDegrees,
  resolveStrength,
  UNGRADED_RANK,
  type StrengthDegreeCatalog,
} from './strength-degrees';
import { CATEGORY_LABELS, CATEGORY_SIDE } from './branch-engine';
import { DEFAULT_ENGINE_SETTINGS, type TashjeerEngineSettings } from './engine-settings';
import {
  buildReadingPlan,
  readingSegmentIndex,
  variantTraversalAnchor,
  type ReadingPlan,
} from './reading-plan';
import { formatPathName, getNarratorName, resolveScope } from './scope';
import { getNarratorSymbol, narratorTayyibahOrder } from './symbols';
import {
  chipsForUnits,
  scopeToUnits,
  type ReaderChip,
  type ReadingUnit,
} from './reader-symbols';
import {
  buildReadingCombinations,
  type ReadingCombination,
} from './combination-engine';
import {
  compareAlternatives,
  compareVariantsForReading,
} from './ordering';
import { characterBoundsForWord, characterRangeCenterX } from '@/lib/quran-logic/characters';
import { getCategoryColor } from './color-system';
import { lociOfVariant, positionsOfVariant } from './loci';

// ==================== الإعدادات ====================

const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  canvasWidth: 1000,
  paddingRight: 56,
  paddingLeft: 56,
  textTop: 300,
  fontSize: 34,
  wordGap: 14,
  lineHeight: 96,
  laneHeight: 34,
  laneGap: 28,
};

/** خيارات تشغيل لا تُحفظ في الوجه نفسه، بل تأتي من المحرر ولوحة التحكم. */
export interface ClassicTashjeerOptions {
  catalog?: TransmissionCatalog;
  /** سلّم درجات قوة الوجه؛ يُستعمل في ترتيب أوجه الموضع الواحد وفي بطاقاتها. */
  strengthDegrees?: StrengthDegreeCatalog;
  engine?: Partial<TashjeerEngineSettings>;
  boundaries?: RecitationBoundary[];
  /** تعديلات يدوية محفوظة لخطوط الأوجه المولدة. */
  branchOverrides?: TashjeerBranch[];
  /** أسطر مستقلة أضافها المحقق للبيان أو التنظيم. */
  manualLines?: ManualTashjeerLine[];
  /**
   * مقطع العمل: حين يحدّد المحقق وقفا ويطلب تشجير ما قبله وحده، لا يُشجَّر
   * إلا ما وقع داخل هذا المدى من الكلمات، وتُحصر أطراف الأسطر فيه.
   */
  focusSegment?: { startPosition: number; endPosition: number } | null;
}

// ==================== النواتج ====================

/**
 * بطاقة راوٍ واحد على السطر: معرّفه واسمه ورمزه، مقترنة في عنصر واحد.
 *
 * كانت الرموز والأسماء مصفوفتين متوازيتين، والرموز تُصفّى من الفارغ (حفص)
 * فينكسر التقابل بينهما. الاقتران هنا هو ما يسمح بجعل كل رمز عنصرا قابلا
 * للنقر يعرف صاحبه.
 */
export interface ClassicReaderChip {
  /** مستوى البطاقة: إمام أو راوٍ أو طريق. */
  kind: ReaderChipKindCompat;
  /** معرّف العنصر نفسه: إمام أو راوٍ أو طريق. */
  id: string;
  /**
   * راوٍ يمثّل البطاقة، لفتح بطاقة التعريف عند النقر. في بطاقة الإمام هو
   * أول رواته، وفي بطاقة الطريق هو صاحب الطريق.
   */
  narratorId: string;
  /** كل الرواة الذين تمثلهم البطاقة. */
  narratorIds: string[];
  name: string;
  symbol: string;
}

/** نُسخة محلية من نوع البطاقة حتى لا يُستورد النوع في كل ملف واجهة. */
export type ReaderChipKindCompat = 'IMAM' | 'NARRATOR' | 'PATH';

/**
 * سطر الاتفاق: يُرسم حين لا يكون في الآية أي اختلاف، فيقرأ الجميع بوجه واحد.
 *
 * لا يُسمّى براوٍ بعينه. الوجه حينئذ وجه **الجمهور**، وتسميته «جمهور حفص»
 * خطأ منهجي: حفص أحد القراء لا مرجع الاتفاق، وإنما نص المصحف مكتوب بروايته.
 */
export interface ClassicAgreementLine {
  id: string;
  /** الكلمة المطبوعة في طرف السطر: «جمهور». */
  label: string;
  /** كل من قرأ بهذا الوجه، أي القراء جميعا عند الاتفاق. */
  readers: ClassicReaderChip[];
  rowY: number;
  guideStartX: number;
  guideEndX: number;
}

/** الكلمة المعتمدة في طرف سطر الاتفاق. */
export const AGREEMENT_LABEL = 'جمهور';

/** عقدة ربط الخط بكلمة مختلفة. */
export interface ClassicMark {
  wordId: number;
  position: number;
  /** مركز الكلمة أو الحرف المحدد أفقيا (نقطة الارتباط). */
  x: number;
  /** بداية الحروف التي يشير إليها السطر، إن كان الموضع حرفيا. */
  characterStart?: number;
  /** نهاية الحروف التي يشير إليها السطر، إن كان الموضع حرفيا. */
  characterEnd?: number;
  topY: number;
  bottomY: number;
  baselineY: number;
}

/**
 * حكم واحد داخل سطر مركّب: مدٌّ في أول الآية، أو فرشٌ في كلمة، أو إدغام.
 *
 * وجوده هو جوهر التصحيح: السطر الواحد يحمل الآن كل أحكام قراءة الراوي في
 * هذه الآية، كلٌّ مثبَّت على كلمته، بدل أن يُفرَد لكل حكم سطر مستقل يوهم أن
 * الراوي يقرأ الآية مرات.
 */
export interface ClassicLineEntry {
  variantId: string;
  alternativeId: string;
  category: VariantCategory;
  categoryLabel: string;
  /** اسم الحكم المطبوع فوق موضعه: مد، إدغام، سكت، تقليل... */
  ruleLabel: string;
  /** النص المقروء بهذا الحكم. */
  readingText: string;
  /** وصف الوجه إن وُجد. */
  readingLabel: string;
  /** عدد حركات المد لهذا الحكم بعينه. */
  maddHarakat?: number;
  /** لون فئة الحكم، فقد تختلف فئات الأحكام في السطر الواحد. */
  color: string;
  /** عقد ارتباط هذا الحكم بكلماته أو حروفه. */
  marks: ClassicMark[];
  startPosition: number;
  endPosition: number;
  /** طرفا التغليظ فوق السطر: مدى هذا الحكم وحده. */
  emphasisStartX: number;
  emphasisEndX: number;
  /** مركز الحكم أفقيا، حيث يُطبع اسمه. */
  labelX: number;
  /**
   * تغليظ مستقل لكل مجموعة كلمات متصلة.
   *
   * إن وقع الحكم في كلمتين متباعدتين لا يُمدّ خط غليظ بينهما؛ لكل كلمة
   * (أو مدى متصل) تغليظها واسم حكمها.
   */
  emphases: ClassicEmphasis[];
}

/** مدى تغليظ متصل فوق السطر. */
export interface ClassicEmphasis {
  startX: number;
  endX: number;
  labelX: number;
  marks: ClassicMark[];
}

/** خط تشجير كلاسيكي واحد = تركيب قراءة كامل، أو سطر يدوي دلالي. */
export interface ClassicLine {
  id: string;
  source: 'ALTERNATIVE' | 'MANUAL';
  variantId: string;
  alternativeId: string;
  manualLineId?: string;
  category: VariantCategory;
  categoryLabel: string;
  /** كل الأسطر تحت النص في التشجير المعتمد. */
  side: 'TOP' | 'BOTTOM';
  /** معرّفات كل القراء الذين يقرأون بهذا الوجه. */
  narratorIds: string[];
  /** رموزهم مرتّبة حسب طيبة النشر. */
  symbols: string[];
  /** رمز الرئيس (الأعلى ترتيبا). */
  primarySymbol: string;
  primaryNarratorName: string;
  /** أسماء القراء الذين اتفقوا معه، للتلميح. */
  readerNames: string[];
  /**
   * بطاقات القراء مقترنة: كل رمز بصاحبه واسمه.
   * تُطبع في **طرف السطر الأيسر**، لأن ترتيب قراءة الاختلاف يبدأ من آخر
   * كلمة في الآية، وآخر الآية في الرسم العربي هو الطرف الأيسر.
   */
  readers: ClassicReaderChip[];
  /** نص موجز في طرف السطر الأيسر، بحسب إعداد عرض الرموز. */
  label: string;
  /** طريقة إظهار بطاقة القارئ التي اختارها المشرف. */
  symbolDisplay: TashjeerEngineSettings['symbolDisplay'];
  /** النص المقروء بهذا الوجه (بالتشكيل)، أو عنوان السطر اليدوي. */
  readingText: string;
  /** وصف الوجه إن وُجد. */
  readingLabel: string;
  /** اسم الحكم الذي يُطبع تحت الكلمة تماما: إمالة، تقليل، سكت... */
  ruleLabel: string;
  /** عدد حركات المد، يُطبع في الهامش الأيمن. */
  maddHarakat?: number;
  /** قوة الوجه المعتمدة في الترتيب (كلما صغرت تقدّم السطر). */
  strength?: number;
  /** اسم درجة القوة كما تُعرض على البطاقة: مقدَّم، راجح... */
  strengthLabel?: string;
  /** اختصار الدرجة، لضيق المساحة. */
  strengthShortLabel?: string;
  /** لون الدرجة في الواجهة. */
  strengthColor?: string;
  /** هل هذه الدرجة هي «الوجه المقدَّم»؟ */
  isPreferred?: boolean;
  /** هل يختلف رواة هذا الوجه في درجته؟ */
  hasMixedStrength?: boolean;
  /** درجة كل راوٍ على حدة، للتلميح التفصيلي على البطاقة. */
  strengthByNarrator?: Array<{ narratorId: string; degreeLabel?: string }>;
  /**
   * أحكام هذا السطر مرتبة بترتيب المرور. في الوضع المركّب تكون أكثر من حكم،
   * وفي الوضع القديم (سطر لكل وجه) يكون فيها حكم واحد.
   */
  entries: ClassicLineEntry[];
  /** بصمة التركيب في الوضع المركّب، للتتبع والاختبار. */
  combinationId?: string;
  startPosition: number;
  endPosition: number;
  /** رقم السطر تحت الآية (0 = أول سطر مباشرة تحت النص). */
  lane: number;
  /** رقم مجموعة الموضع: كل أوجه الموضع الواحد تشترك فيه. */
  groupIndex: number;
  /** ترتيب الوجه داخل مجموعته (0 = أول وجه). */
  indexInGroup: number;
  /** هل هذا أول سطر في مجموعة موضعه؟ يفيد في ترقيم الهامش. */
  isGroupLeader: boolean;
  /** رقم مقطع الوقف/الابتداء في ترتيب الأداء. */
  segmentIndex: number;
  /** إزاحة دقيقة محفوظة للمحرر. */
  rowOffset?: number;
  /** هل اختار المحرر موضع السطر بدلا من التوزيع الآلي؟ */
  isManual?: boolean;
  /** الإحداثي الرأسي للخط بعد الحساب. */
  rowY: number;
  /** طرفا السطر الأفقيان بعد تطبيق إعداد الامتداد. */
  spanStartX: number;
  spanEndX: number;
  /**
   * الخط التوضيحي: خط رفيع بطول الآية كلها، مستقل عن خط الوجه نفسه.
   *
   * وظيفته أن يقود العين من نص الآية إلى بطاقة القارئ في الطرف الأيسر،
   * فيقرأ المحقق السطر ولو كان مدى الاختلاف كلمة واحدة في وسط الآية.
   * لذلك يمتد دائما بطول الآية ولا يتأثر بإعداد `lineSpan`.
   */
  guideStartX: number;
  guideEndX: number;
  marks: ClassicMark[];
}

/** ناتج التشجير الكلاسيكي الكامل لآية. */
export interface ClassicTashjeer {
  lines: ClassicLine[];
  /** أدنى نقطة لأسفل النص. */
  textBottom: number;
  /** أعلى نقطة في الشجرة. */
  topY: number;
  /** إحداثي أول خط اختلاف تحت النص. */
  firstRowY: number;
  /** ارتفاع كل مسار. */
  rowHeight: number;
  /** الارتفاع الكلي المطلوب للوحة. */
  totalHeight: number;
  /** حدود كتلة النص أفقيا، تُستخدم في امتداد الأسطر والهوامش. */
  textLeftX: number;
  textRightX: number;
  /** هل في الآية اختلافات أصلا؟ */
  hasDifferences: boolean;
  /**
   * سطر «جمهور»: يظهر وحده حين تخلو الآية من أي اختلاف.
   * غيابه عند وجود اختلاف مقصود: الاتفاق حينئذ يبيّنه امتداد أسطر الأوجه.
   */
  agreement: ClassicAgreementLine | null;
  /** خطة ترتيب الأداء التي استخدمها المحرك، للشرح والمراجعة. */
  readingPlan: ReadingPlan;
}

// ==================== التوليد ====================

interface RawAlternative {
  variant: Variant;
  alt: VariantAlternative;
}

/** مجموعة أوجه موضع واحد بعد الترتيب الداخلي. */
interface PositionGroup {
  variant: Variant;
  anchor: number;
  items: RawAlternative[];
}

/**
 * يولّد التشجير الكلاسيكي لآية من اختلافاتها.
 *
 * الترتيب لا يعتمد على ترتيب الإدخال في قائمة الاختلافات؛ يعتمد على خطة
 * القراءة ورتبة الموضع اليدوية. لذا لا يستطيع ترتيب واجهة المستخدم أو اسم
 * الوجه قلب قاعدة «آخر الآية أولا» سهوا.
 */
export function generateClassicTashjeer(
  variants: Variant[],
  layout: AyahLayout,
  filter: ViewFilter,
  options: Partial<LayoutOptions> = {},
  runtime: ClassicTashjeerOptions = {}
): ClassicTashjeer {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const engine: TashjeerEngineSettings = { ...DEFAULT_ENGINE_SETTINGS, ...runtime.engine };
  const catalog = runtime.catalog;
  const strengthDegrees = runtime.strengthDegrees ?? createDefaultStrengthDegrees();
  const wordsCount = Math.max(0, ...layout.boxes.map((box) => box.position));
  const readingPlan = buildReadingPlan(wordsCount, runtime.boundaries ?? [], engine.traversal);

  const textBottom = layout.boxes.length
    ? Math.max(...layout.boxes.map((box) => box.bottomY))
    : opts.textTop;
  const textTop = layout.boxes.length
    ? Math.min(...layout.boxes.map((box) => box.topY))
    : opts.textTop;

  // مقطع العمل: عند تحديد وقف يقتصر التشجير على مداه، فتُحصر أطراف الأسطر
  // في كلماته أيضا حتى لا يمتد السطر إلى ما لا يُشجَّر.
  const focus = normalizeFocusSegment(runtime.focusSegment, wordsCount);
  const focusedBoxes = focus
    ? layout.boxes.filter(
        (box) => box.position >= focus.startPosition && box.position <= focus.endPosition
      )
    : layout.boxes;
  const spanBoxes = focusedBoxes.length > 0 ? focusedBoxes : layout.boxes;

  const textLeftX = spanBoxes.length
    ? Math.min(...spanBoxes.map((box) => box.x))
    : opts.paddingLeft;
  const textRightX = spanBoxes.length
    ? Math.max(...spanBoxes.map((box) => box.x + box.width))
    : opts.canvasWidth - opts.paddingRight;

  // 1. تصفية المواضع: الفئة الظاهرة، ومقطع العمل، ووجود وجه غير أساسي يقرأ
  //    به أحد من المعروضين.
  const eligibleVariants = variants.filter((variant) => {
    if (!filter.categories.includes(variant.category)) return false;
    if (focus && !intersectsSegmentForVariant(variant, focus)) return false;
    return variant.alternatives.some((alt) => {
      if (alt.isBase) return false;
      const narratorIds = resolveScope(alt.scope, catalog);
      if (narratorIds.length === 0) return false;
      if (
        filter.narratorIds.length > 0 &&
        !filter.narratorIds.some((narratorId) => narratorIds.includes(narratorId))
      ) {
        return false;
      }
      return true;
    });
  });

  const overrideByKey = new Map(
    (runtime.branchOverrides ?? []).map((branch) => [
      `${branch.variantId}::${branch.alternativeId}`,
      branch,
    ])
  );

  const lines: ClassicLine[] =
    engine.lineComposition === 'PER_VARIANT'
      ? buildPerVariantLines(
          eligibleVariants,
          layout,
          filter,
          readingPlan,
          engine,
          catalog,
          strengthDegrees,
          overrideByKey
        )
      : buildCombinedLines(
          eligibleVariants,
          layout,
          filter,
          readingPlan,
          engine,
          catalog,
          strengthDegrees,
          overrideByKey
        );

  // الأسطر اليدوية لا تتجاوز التصفية؛ وهي تتبع نطاقها إن حُدد.
  for (const manualLine of runtime.manualLines ?? []) {
    if (manualLine.isHidden || !filter.categories.includes(manualLine.category)) continue;
    const scope = manualLine.scope ?? { kind: 'ALL' as const };
    const narratorIds = resolveScope(scope, catalog);
    if (
      filter.narratorIds.length > 0 &&
      !filter.narratorIds.some((narratorId) => narratorIds.includes(narratorId))
    ) {
      continue;
    }
    const line = manualToLine(manualLine, layout, catalog, engine);
    if (line) lines.push(line);
  }

  for (const line of lines) {
    const anchor = variantTraversalAnchor(line.startPosition, line.endPosition, readingPlan.traversal);
    line.segmentIndex = readingSegmentIndex(anchor, readingPlan);
  }

  assignClassicLanes(lines);

  // 3. الحساب الهندسي. كل الأسطر تنزل تحت النص واحدا تلو الآخر.
  const rowGap = Math.max(opts.fontSize * 1.3 * engine.textToTreeGap, 30 * engine.textToTreeGap);
  const rowHeight = Math.max(opts.fontSize * 1.15 * engine.rowSpacing, 30 * engine.rowSpacing);
  const firstRowY = textBottom + rowGap;
  const firstTopRowY = textTop - rowGap;

  for (const line of lines) {
    const automaticY = line.side === 'TOP'
      ? firstTopRowY - line.lane * rowHeight
      : firstRowY + line.lane * rowHeight;
    line.rowY = automaticY + (line.rowOffset ?? 0);
    const span = lineSpan(line, engine, textLeftX, textRightX);
    line.spanStartX = span.startX;
    line.spanEndX = span.endX;
    // الخط التوضيحي بطول الآية كلها دائما، حتى حين يقتصر خط الوجه على مدى
    // الاختلاف. هو المسطرة التي تصل الكلمة ببطاقة قارئها في الطرف الأيسر.
    line.guideStartX = textLeftX;
    line.guideEndX = textRightX;

    // تغليظ مستقل لكل حكم، ثم لكل مجموعة كلمات متصلة داخله: صلة في
    // كلمتين متباعدتين علامتان لا خطّا يملأ ما بينهما.
    for (const entry of line.entries) {
      entry.emphases = buildEmphases(entry.marks);
      const first = entry.emphases[0];
      if (!first) continue;
      entry.emphasisStartX = first.startX;
      entry.emphasisEndX = first.endX;
      entry.labelX = first.labelX;
    }
  }

  const topLines = lines.filter((line) => line.side === 'TOP');
  const bottomLines = lines.filter((line) => line.side === 'BOTTOM');
  const topY = topLines.length ? Math.min(...topLines.map((line) => line.rowY)) : textTop;
  const lowestLineY = bottomLines.length
    ? Math.max(...bottomLines.map((line) => line.rowY))
    : textBottom;
  const totalHeight = bottomLines.length
    ? lowestLineY + rowHeight + rowGap
    : textBottom + rowGap + 60;

  const hasDifferences = lines.length > 0;

  return {
    lines,
    textBottom,
    topY,
    firstRowY,
    rowHeight,
    totalHeight,
    textLeftX,
    textRightX,
    hasDifferences,
    agreement: hasDifferences
      ? null
      : buildAgreementLine(firstRowY, textLeftX, textRightX, catalog),
    readingPlan,
  };
}

/**
 * سطر الاتفاق حين لا يكون في الآية خلاف.
 *
 * الوجه هنا وجه **الجمهور**: اتفق عليه القراء العشرة جميعا. لا يُنسب إلى حفص
 * ولا إلى غيره؛ نص المصحف مكتوب برواية حفص لكن الوجه ليس وجهه وحده.
 * ورموز القراء تُحمل مع السطر ليكشفها العرض عند التمرير.
 */
function buildAgreementLine(
  rowY: number,
  textLeftX: number,
  textRightX: number,
  catalog?: TransmissionCatalog
): ClassicAgreementLine {
  const narratorIds = resolveScope({ kind: 'ALL' }, catalog);

  return {
    id: 'agreement',
    label: AGREEMENT_LABEL,
    readers: readerChips(narratorIds, catalog),
    rowY,
    guideStartX: textLeftX,
    guideEndX: textRightX,
  };
}

/**
 * يبني بطاقات القراء مقترنة: كل رمز باسم صاحبه ومعرّفه.
 *
 * لا نحذف الراوي الذي لا رمز له (حفص في البذرة) كما كان يفعل ترشيح الرموز؛
 * نضع له اسمه بديلا عن الرمز حتى لا يسقط من قائمة من قرأ بالوجه.
 */
function readerChips(
  narratorIds: string[],
  catalog?: TransmissionCatalog
): ClassicReaderChip[] {
  return unitChips(
    narratorIds.map((narratorId) => ({ narratorId })),
    catalog
  );
}

/**
 * بطاقات السطر من وحدات القراءة: ترتفع إلى رمز الإمام عند اجتماع راوييه،
 * وتنزل إلى اسم الطريق عند انفراده. هذا هو المطلوب في التشجير المعتمد بدل
 * طبع رموز الرواة دائما.
 */
function unitChips(units: ReadingUnit[], catalog?: TransmissionCatalog): ClassicReaderChip[] {
  return chipsForUnits(units, catalog).map((chip: ReaderChip) => ({
    kind: chip.kind,
    id: chip.id,
    narratorId: chip.narratorIds[0] ?? chip.id,
    narratorIds: chip.narratorIds,
    name: chip.name,
    symbol: chip.symbol,
  }));
}

/** يحوّل نطاق وجه إلى بطاقات مباشرة (يُستعمل في الوضع القديم والأسطر اليدوية). */
function scopeChips(
  scope: Parameters<typeof scopeToUnits>[0],
  catalog?: TransmissionCatalog
): ClassicReaderChip[] {
  return unitChips(scopeToUnits(scope, catalog), catalog);
}

/** مقطع العمل بعد التحقق من صلاحيته لهذه الآية. */
function normalizeFocusSegment(
  segment: ClassicTashjeerOptions['focusSegment'],
  wordsCount: number
): { startPosition: number; endPosition: number } | null {
  if (!segment || wordsCount <= 0) return null;

  const start = Math.max(1, Math.min(segment.startPosition, segment.endPosition));
  const end = Math.min(wordsCount, Math.max(segment.startPosition, segment.endPosition));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  // مقطع يغطي الآية كلها ليس تحديدا؛ نعامله كأنه لا تحديد.
  if (start === 1 && end === wordsCount) return null;
  return { startPosition: start, endPosition: end };
}

/** هل يتقاطع مدى الموضع مع مقطع العمل؟ */
function intersectsSegment(
  startPosition: number,
  endPosition: number,
  segment: { startPosition: number; endPosition: number }
): boolean {
  return startPosition <= segment.endPosition && endPosition >= segment.startPosition;
}

/** يتقاطع الاختلاف مع المقطع إن وقع أحد مواضعه الفعلية فيه. */
function intersectsSegmentForVariant(
  variant: Variant,
  segment: { startPosition: number; endPosition: number }
): boolean {
  return positionsOfVariant(variant).some(
    (position) => position >= segment.startPosition && position <= segment.endPosition
  );
}

/** يبني تغليظا لكل مجموعة كلمات متجاورة، ويفصل المتباعدة. */
export function buildEmphases(marks: ClassicMark[]): ClassicEmphasis[] {
  if (marks.length === 0) return [];

  const ordered = [...marks].sort((first, second) => first.position - second.position);
  const clusters: ClassicMark[][] = [[ordered[0]]];
  for (let index = 1; index < ordered.length; index++) {
    const mark = ordered[index];
    const cluster = clusters[clusters.length - 1];
    if (mark.position <= cluster[cluster.length - 1].position + 1) {
      cluster.push(mark);
    } else {
      clusters.push([mark]);
    }
  }

  const pad = 10;
  return clusters.map((cluster) => {
    const xs = cluster.map((mark) => mark.x);
    return {
      startX: Math.min(...xs) - pad,
      endX: Math.max(...xs) + pad,
      labelX: (Math.min(...xs) + Math.max(...xs)) / 2,
      marks: cluster,
    };
  });
}

/**
 * الوضع القديم: سطر مستقل لكل وجه في كل موضع.
 *
 * أُبقي عليه لأنه يفيد في المراجعة الموضعية («أرني أوجه هذا الموضع وحده»)،
 * وفي الاختبارات التي تحرس قواعد ترتيب المواضع مجردةً عن التركيب.
 */
function buildPerVariantLines(
  variants: Variant[],
  layout: AyahLayout,
  filter: ViewFilter,
  plan: ReadingPlan,
  engine: TashjeerEngineSettings,
  catalog: TransmissionCatalog | undefined,
  strengthDegrees: StrengthDegreeCatalog,
  overrideByKey: Map<string, TashjeerBranch>
): ClassicLine[] {
  const raw: RawAlternative[] = [];
  for (const variant of variants) {
    for (const alt of variant.alternatives) {
      if (alt.isBase) continue;
      const narratorIds = resolveScope(alt.scope, catalog);
      if (narratorIds.length === 0) continue;
      if (
        filter.narratorIds.length > 0 &&
        !filter.narratorIds.some((narratorId) => narratorIds.includes(narratorId))
      ) {
        continue;
      }
      raw.push({ variant, alt });
    }
  }

  const groups = buildPositionGroups(raw, plan, engine, catalog, strengthDegrees);
  const lines: ClassicLine[] = [];

  groups.forEach((group, groupIndex) => {
    group.items.forEach(({ variant, alt }, indexInGroup) => {
      const line = alternativeToLine(
        variant,
        alt,
        layout,
        catalog,
        engine,
        strengthDegrees,
        overrideByKey.get(`${variant.id}::${alt.id}`)
      );
      if (!line) return;
      line.groupIndex = groupIndex;
      line.indexInGroup = indexInGroup;
      line.isGroupLeader = indexInGroup === 0;
      lines.push(line);
    });
  });

  return lines;
}

/**
 * الوضع المعتمد: سطر لكل **تركيب قراءة**.
 *
 * كل سطر هنا قراءة كاملة لوحدة قراءة واحدة أو أكثر: يجتمع فيه المد والفرش
 * والإدغام معا إن كانت كلها في قراءة هذا الراوي، كلٌّ فوق كلمته. والسطور
 * مرتبة بترتيب الأمة: قالون ومن وافقه، ثم أوجه قالون الباقية، ثم من بعده.
 */
function buildCombinedLines(
  variants: Variant[],
  layout: AyahLayout,
  filter: ViewFilter,
  plan: ReadingPlan,
  engine: TashjeerEngineSettings,
  catalog: TransmissionCatalog | undefined,
  strengthDegrees: StrengthDegreeCatalog,
  overrideByKey: Map<string, TashjeerBranch>
): ClassicLine[] {
  const combinations = buildReadingCombinations(variants, plan, {
    catalog,
    engine,
    strengthDegrees,
  }).filter((combination) => {
    if (filter.narratorIds.length === 0) return true;
    return filter.narratorIds.some((narratorId) => combination.narratorIds.includes(narratorId));
  });

  const lines: ClassicLine[] = [];
  let groupIndex = -1;
  let currentLead = '';

  for (const combination of combinations) {
    const line = combinationToLine(
      combination,
      layout,
      catalog,
      engine,
      strengthDegrees,
      overrideByKey.get(
        `${combination.picks[0]?.variant.id}::${combination.picks[0]?.alternative.id}`
      )
    );
    if (!line) continue;

    // المجموعة هنا هي «القارئ الرائد»: سطوره كلها متتالية بلا فاصل، كما
    // يُقرأ في الطيبة: كل أوجه قالون، ثم كل أوجه ورش...
    const leadKey = combination.leadUnit.pathId ?? combination.leadUnit.narratorId;
    if (leadKey !== currentLead) {
      currentLead = leadKey;
      groupIndex += 1;
    }

    line.groupIndex = groupIndex;
    line.indexInGroup = combination.rankInLead;
    line.isGroupLeader = combination.rankInLead === 0;
    lines.push(line);
  }

  return lines;
}

/** يحوّل تركيب قراءة إلى سطر كامل بأحكامه كلها. */
function combinationToLine(
  combination: ReadingCombination,
  layout: AyahLayout,
  catalog: TransmissionCatalog | undefined,
  engine: TashjeerEngineSettings,
  strengthDegrees: StrengthDegreeCatalog,
  override?: TashjeerBranch
): ClassicLine | null {
  const entries: ClassicLineEntry[] = [];

  for (const pick of combination.picks) {
    const marks = marksForVariant(pick.variant, layout);
    if (marks.length === 0) continue;

    entries.push({
      variantId: pick.variant.id,
      alternativeId: pick.alternative.id,
      category: pick.variant.category,
      categoryLabel: CATEGORY_LABELS[pick.variant.category],
      ruleLabel:
        pick.alternative.ruleLabel?.trim() ||
        pick.alternative.label?.trim() ||
        CATEGORY_LABELS[pick.variant.category],
      readingText: pick.alternative.text,
      readingLabel: pick.alternative.label,
      maddHarakat: pick.alternative.maddHarakat,
      color: getCategoryColor(pick.variant.category),
      marks,
      startPosition: pick.variant.startPosition,
      endPosition: pick.variant.endPosition,
      emphasisStartX: 0,
      emphasisEndX: 0,
      labelX: 0,
      emphases: [],
    });
  }

  if (entries.length === 0) return null;

  const primary = entries[0];
  const primaryPick = combination.picks[0];
  const chips = unitChips(combination.units, catalog);
  const narratorIds = [...combination.narratorIds].sort(
    (first, second) => narratorTayyibahOrder(first, catalog) - narratorTayyibahOrder(second, catalog)
  );

  const strength = resolveStrength(
    primaryPick.alternative,
    primaryPick.alternative.scope,
    strengthDegrees,
    catalog
  );

  const marks = entries
    .flatMap((entry) => entry.marks)
    .sort((first, second) => first.position - second.position);

  const symbols = chips.map((chip) => chip.symbol).filter(Boolean);
  const readerNames = chips.map((chip) => chip.name);

  return {
    id: `combo::${combination.id}`,
    source: 'ALTERNATIVE',
    variantId: primary.variantId,
    alternativeId: primary.alternativeId,
    category: primary.category,
    categoryLabel: primary.categoryLabel,
    side: CATEGORY_SIDE[primary.category],
    narratorIds,
    symbols,
    primarySymbol: symbols[0] ?? '',
    primaryNarratorName: chips[0]?.name ?? 'الجميع',
    readerNames,
    readers: chips,
    label: chipsLabel(chips, engine),
    symbolDisplay: engine.symbolDisplay,
    readingText: entries.map((entry) => entry.readingText).join(' … '),
    readingLabel: entries.map((entry) => entry.readingLabel).filter(Boolean).join(' + '),
    ruleLabel: entries.map((entry) => entry.ruleLabel).join(' + '),
    maddHarakat: entries.find((entry) => typeof entry.maddHarakat === 'number')?.maddHarakat,
    strength: strength.rank === UNGRADED_RANK ? primaryPick.alternative.strength : strength.rank,
    strengthLabel: strength.degree?.label,
    strengthShortLabel: strength.degree?.shortLabel,
    strengthColor: strength.degree?.color,
    isPreferred: combination.rankInLead === 0,
    hasMixedStrength: strength.isMixed,
    strengthByNarrator: strength.isMixed
      ? strength.perNarrator.map((item) => ({
          narratorId: item.narratorId,
          degreeLabel: item.degree?.label,
        }))
      : undefined,
    entries,
    combinationId: combination.id,
    startPosition: Math.min(...entries.map((entry) => entry.startPosition)),
    endPosition: Math.max(...entries.map((entry) => entry.endPosition)),
    lane: override?.isManual ? override.lane : 0,
    groupIndex: 0,
    indexInGroup: 0,
    isGroupLeader: false,
    segmentIndex: 0,
    rowOffset: override?.isManual ? override.rowOffset : undefined,
    isManual: override?.isManual,
    rowY: 0,
    spanStartX: 0,
    spanEndX: 0,
    guideStartX: 0,
    guideEndX: 0,
    marks,
  };
}

/** نص بطاقة السطر بحسب إعداد عرض الرموز. */
function chipsLabel(chips: ClassicReaderChip[], engine: TashjeerEngineSettings): string {
  const names = chips.map((chip) => chip.name);
  const texts = chips.map((chip) => chip.symbol || chip.name);

  if (engine.symbolDisplay === 'NAMES') return names[0] ?? 'الجميع';
  if (engine.symbolDisplay === 'SYMBOLS') return texts.join(' ') || (names[0] ?? 'الجميع');
  return texts.length ? `${texts.join(' ')} · ${names[0] ?? ''}`.trim() : names[0] ?? 'الجميع';
}

/**
 * يبني مجموعات المواضع مرتبة، وداخل كل مجموعة الأوجه مرتبة.
 *
 * ترتيب المجموعات:
 *   1. الرتبة اليدوية `variant.orderRank` إن ثبّتها المحقق لهذه الآية.
 *   2. خطة القراءة (من آخر الآية إلى أولها) مع مراعاة الوقف والابتداء.
 *   3. المدى الأقصر أولا، ثم المعرّف حتى يكون الناتج حتميا.
 */
function buildPositionGroups(
  raw: RawAlternative[],
  plan: ReadingPlan,
  engine: TashjeerEngineSettings,
  catalog?: TransmissionCatalog,
  strengthDegrees?: StrengthDegreeCatalog
): PositionGroup[] {
  const byVariant = new Map<string, PositionGroup>();

  for (const item of raw) {
    const existing = byVariant.get(item.variant.id);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    byVariant.set(item.variant.id, {
      variant: item.variant,
      anchor: variantTraversalAnchor(
        item.variant.startPosition,
        item.variant.endPosition,
        plan.traversal
      ),
      items: [item],
    });
  }

  const groups = [...byVariant.values()];

  groups.sort((first, second) =>
    compareVariantsForReading(first.variant, second.variant, plan)
  );

  for (const group of groups) {
    group.items.sort((first, second) =>
      compareAlternatives(group.variant, first.alt, second.alt, engine, catalog, strengthDegrees)
    );
  }

  return groups;
}

/** طرفا السطر الأفقيان بحسب إعداد الامتداد. */
function lineSpan(
  line: ClassicLine,
  engine: TashjeerEngineSettings,
  textLeftX: number,
  textRightX: number
): { startX: number; endX: number } {
  if (engine.lineSpan === 'FULL_AYAH') {
    // السطر يمتد مع الآية كلها: هكذا يظهر اتفاق الراوي مع السطر الذي قبله،
    // وهو الشكل المعتمد في المصحف المشجّر.
    return { startX: textLeftX, endX: textRightX };
  }

  const xs = line.marks.map((mark) => mark.x);
  if (xs.length === 0) return { startX: textLeftX, endX: textRightX };
  const pad = 16;
  return { startX: Math.min(...xs) - pad, endX: Math.max(...xs) + pad };
}

function alternativeToLine(
  variant: Variant,
  alt: VariantAlternative,
  layout: AyahLayout,
  catalog: TransmissionCatalog | undefined,
  engine: TashjeerEngineSettings,
  strengthDegrees: StrengthDegreeCatalog,
  override?: TashjeerBranch
): ClassicLine | null {
  const narratorIds = resolveScope(alt.scope, catalog).sort(
    (first, second) => narratorTayyibahOrder(first, catalog) - narratorTayyibahOrder(second, catalog)
  );
  const marks = marksForVariant(variant, layout);
  if (marks.length === 0) return null;

  const display = displayReaders(narratorIds, catalog, engine);
  const strength = resolveStrength(alt, alt.scope, strengthDegrees, catalog);
  const pathNames = alt.scope.kind === 'PATHS' && alt.scope.pathIds?.length
    ? alt.scope.pathIds.map((pathId) => pathDisplayName(pathId, catalog))
    : [];
  const ruleLabel =
    alt.ruleLabel?.trim() || alt.label?.trim() || CATEGORY_LABELS[variant.category];
  const entries: ClassicLineEntry[] = [
    {
      variantId: variant.id,
      alternativeId: alt.id,
      category: variant.category,
      categoryLabel: CATEGORY_LABELS[variant.category],
      ruleLabel,
      readingText: alt.text,
      readingLabel: alt.label,
      maddHarakat: alt.maddHarakat,
      color: getCategoryColor(variant.category),
      marks,
      startPosition: variant.startPosition,
      endPosition: variant.endPosition,
      emphasisStartX: 0,
      emphasisEndX: 0,
      labelX: 0,
      emphases: [],
    },
  ];

  return {
    id: `${variant.id}::${alt.id}`,
    source: 'ALTERNATIVE',
    variantId: variant.id,
    alternativeId: alt.id,
    category: variant.category,
    categoryLabel: CATEGORY_LABELS[variant.category],
    side: CATEGORY_SIDE[variant.category],
    narratorIds,
    symbols: display.symbols,
    primarySymbol: display.symbols[0] ?? '',
    primaryNarratorName: pathNames.length ? pathNames.join(' و ') : display.primaryName,
    readerNames: pathNames.length ? pathNames : display.readerNames,
    readers: scopeChips(alt.scope, catalog),
    label: display.label,
    symbolDisplay: engine.symbolDisplay,
    readingText: alt.text,
    readingLabel: alt.label,
    // اسم الحكم المطبوع تحت الكلمة: الحقل المخصص، وإلا وصف الوجه، وإلا فئته.
    ruleLabel,
    entries,
    maddHarakat: alt.maddHarakat,
    strength: strength.rank === UNGRADED_RANK ? alt.strength : strength.rank,
    strengthLabel: strength.degree?.label,
    strengthShortLabel: strength.degree?.shortLabel,
    strengthColor: strength.degree?.color,
    isPreferred: strength.degree?.isPreferred === true,
    hasMixedStrength: strength.isMixed,
    strengthByNarrator: strength.isMixed
      ? strength.perNarrator.map((item) => ({
          narratorId: item.narratorId,
          degreeLabel: item.degree?.label,
        }))
      : undefined,
    startPosition: variant.startPosition,
    endPosition: variant.endPosition,
    lane: override?.isManual ? override.lane : 0,
    groupIndex: 0,
    indexInGroup: 0,
    isGroupLeader: false,
    segmentIndex: 0,
    rowOffset: override?.isManual ? override.rowOffset : undefined,
    isManual: override?.isManual,
    rowY: 0,
    spanStartX: 0,
    spanEndX: 0,
    guideStartX: 0,
    guideEndX: 0,
    marks,
  };
}

function manualToLine(
  manual: ManualTashjeerLine,
  layout: AyahLayout,
  catalog: TransmissionCatalog | undefined,
  engine: TashjeerEngineSettings
): ClassicLine | null {
  const marks = marksForRange(manual.startPosition, manual.endPosition, layout);
  if (marks.length === 0) return null;

  const narratorIds = resolveScope(manual.scope ?? { kind: 'ALL' }, catalog);
  const display = displayReaders(narratorIds, catalog, engine);

  return {
    id: `manual::${manual.id}`,
    source: 'MANUAL',
    variantId: '',
    alternativeId: '',
    manualLineId: manual.id,
    category: manual.category,
    categoryLabel: CATEGORY_LABELS[manual.category],
    side: CATEGORY_SIDE[manual.category],
    narratorIds,
    symbols: display.symbols,
    primarySymbol: display.symbols[0] ?? '',
    primaryNarratorName: display.primaryName,
    readerNames: display.readerNames,
    readers: scopeChips(manual.scope ?? { kind: 'ALL' }, catalog),
    label: manual.label || display.label,
    symbolDisplay: engine.symbolDisplay,
    readingText: manual.title,
    readingLabel: manual.label ?? 'سطر يدوي',
    ruleLabel: manual.label?.trim() || manual.title,
    entries: [
      {
        variantId: '',
        alternativeId: '',
        category: manual.category,
        categoryLabel: CATEGORY_LABELS[manual.category],
        ruleLabel: manual.label?.trim() || manual.title,
        readingText: manual.title,
        readingLabel: manual.label ?? 'سطر يدوي',
        color: getCategoryColor(manual.category),
        marks,
        startPosition: manual.startPosition,
        endPosition: manual.endPosition,
        emphasisStartX: 0,
        emphasisEndX: 0,
        labelX: 0,
        emphases: [],
      },
    ],
    startPosition: manual.startPosition,
    endPosition: manual.endPosition,
    lane: manual.lane,
    groupIndex: Number.MAX_SAFE_INTEGER,
    indexInGroup: 0,
    isGroupLeader: true,
    segmentIndex: 0,
    rowOffset: manual.rowOffset,
    isManual: true,
    rowY: 0,
    spanStartX: 0,
    spanEndX: 0,
    guideStartX: 0,
    guideEndX: 0,
    marks,
  };
}

function marksForVariant(variant: Variant, layout: AyahLayout): ClassicMark[] {
  const marks: ClassicMark[] = [];
  for (const locus of lociOfVariant(variant)) {
    marks.push(
      ...marksForRange(
        locus.startPosition,
        locus.endPosition,
        layout,
        locus.characterRange
      )
    );
  }

  const seen = new Set<string>();
  return marks.filter((mark) => {
    const key = `${mark.position}:${mark.characterStart ?? ''}:${mark.characterEnd ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function marksForRange(
  startPosition: number,
  endPosition: number,
  layout: AyahLayout,
  characterRange?: import('@/types/tashjeer').CharacterRange
): ClassicMark[] {
  const marks: ClassicMark[] = [];
  for (let position = startPosition; position <= endPosition; position++) {
    const box = layout.boxByPosition.get(position);
    if (!box) continue;
    const bounds = characterBoundsForWord(characterRange, position, box.text);
    marks.push({
      wordId: box.wordId,
      position,
      x: bounds
        ? characterRangeCenterX(box, bounds.start, bounds.end)
        : box.centerX,
      characterStart: bounds?.start,
      characterEnd: bounds?.end,
      topY: box.topY,
      bottomY: box.bottomY,
      baselineY: box.baselineY,
    });
  }
  return marks;
}

function displayReaders(
  narratorIds: string[],
  catalog: TransmissionCatalog | undefined,
  engine: TashjeerEngineSettings
): { symbols: string[]; primaryName: string; readerNames: string[]; label: string } {
  const readerNames = narratorIds.map((narratorId) => narratorName(narratorId, catalog));
  const symbols = narratorIds.map((narratorId) => getNarratorSymbol(narratorId, catalog)).filter(Boolean);
  const primaryName = readerNames[0] ?? 'الجميع';

  let label: string;
  if (engine.symbolDisplay === 'NAMES') {
    label = primaryName;
  } else if (engine.symbolDisplay === 'SYMBOLS') {
    label = symbols.join(' ') || primaryName;
  } else {
    label = symbols.length ? `${symbols.join(' ')} · ${primaryName}` : primaryName;
  }

  return { symbols, primaryName, readerNames, label };
}

/**
 * يوزّع الأسطر تنازليا: سطر واحد لكل وجه، واحدا تلو الآخر بلا تشارك.
 *
 * التشارك في المسار الواحد (interval packing) كان خطأ في الإصدار السابق:
 * المصحف المشجّر يضع كل وجه في سطر مستقل حتى يقرأه القارئ متتابعا. أما
 * السطر الذي ثبّت المحقق مساره فيبقى في موضعه تماما.
 */
function assignClassicLanes(lines: ClassicLine[]): void {
  for (const side of ['TOP', 'BOTTOM'] as const) {
    const sideLines = lines.filter((line) => line.side === side);
    const reserved = new Set(sideLines.filter((line) => line.isManual).map((line) => line.lane));
    let nextLane = 0;

    for (const line of sideLines) {
      if (line.isManual) continue;
      while (reserved.has(nextLane)) nextLane += 1;
      line.lane = nextLane;
      reserved.add(nextLane);
      nextLane += 1;
    }
  }
}

function narratorName(narratorId: string, catalog?: TransmissionCatalog): string {
  return narratorId ? getNarratorName(narratorId, catalog) : 'الجميع';
}

function pathDisplayName(pathId: string, catalog?: TransmissionCatalog): string {
  return formatPathName(pathId, catalog);
}

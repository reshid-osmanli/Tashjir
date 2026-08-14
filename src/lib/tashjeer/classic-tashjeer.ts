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
import { CATEGORY_LABELS, CATEGORY_SIDE } from './branch-engine';
import { DEFAULT_ENGINE_SETTINGS, type TashjeerEngineSettings } from './engine-settings';
import {
  buildReadingPlan,
  compareReadingPositions,
  readingSegmentIndex,
  variantTraversalAnchor,
  type ReadingPlan,
} from './reading-plan';
import { formatPathName, getNarratorName, resolveScope } from './scope';
import { getNarratorSymbol, narratorTayyibahOrder } from './symbols';

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
  engine?: Partial<TashjeerEngineSettings>;
  boundaries?: RecitationBoundary[];
  /** تعديلات يدوية محفوظة لخطوط الأوجه المولدة. */
  branchOverrides?: TashjeerBranch[];
  /** أسطر مستقلة أضافها المحقق للبيان أو التنظيم. */
  manualLines?: ManualTashjeerLine[];
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
  narratorId: string;
  name: string;
  symbol: string;
}

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
  /** مركز الكلمة أفقيا (نقطة الارتباط). */
  x: number;
  topY: number;
  bottomY: number;
  baselineY: number;
}

/** خط تشجير كلاسيكي واحد = وجه قرائي أو سطر يدوي دلالي. */
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
  const wordsCount = Math.max(0, ...layout.boxes.map((box) => box.position));
  const readingPlan = buildReadingPlan(wordsCount, runtime.boundaries ?? [], engine.traversal);

  const textBottom = layout.boxes.length
    ? Math.max(...layout.boxes.map((box) => box.bottomY))
    : opts.textTop;
  const textTop = layout.boxes.length
    ? Math.min(...layout.boxes.map((box) => box.topY))
    : opts.textTop;
  const textLeftX = layout.boxes.length
    ? Math.min(...layout.boxes.map((box) => box.x))
    : opts.paddingLeft;
  const textRightX = layout.boxes.length
    ? Math.max(...layout.boxes.map((box) => box.x + box.width))
    : opts.canvasWidth - opts.paddingRight;

  // 1. جمع الأوجه غير الأساسية وتطبيق التصفية العلمية/البصرية.
  const raw: RawAlternative[] = [];
  for (const variant of variants) {
    if (!filter.categories.includes(variant.category)) continue;
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

  // 2. تجميع الأوجه بمواضعها، ثم ترتيب المجموعات فيما بينها، ثم ترتيب
  //    الأوجه داخل كل مجموعة. الفصل بين المرحلتين مقصود: قاعدة المواضع
  //    (آخر الآية أولا) شيء، وقاعدة الأوجه (قوة الوجه) شيء آخر، ولا يجوز
  //    أن تتداخلا فينكسر الترتيب في الآيات المزدحمة.
  const groups = buildPositionGroups(raw, readingPlan, engine, catalog);

  const overrideByKey = new Map(
    (runtime.branchOverrides ?? []).map((branch) => [
      `${branch.variantId}::${branch.alternativeId}`,
      branch,
    ])
  );

  const lines: ClassicLine[] = [];
  groups.forEach((group, groupIndex) => {
    group.items.forEach(({ variant, alt }, indexInGroup) => {
      const line = alternativeToLine(
        variant,
        alt,
        layout,
        catalog,
        engine,
        overrideByKey.get(`${variant.id}::${alt.id}`)
      );
      if (!line) return;
      line.groupIndex = groupIndex;
      line.indexInGroup = indexInGroup;
      line.isGroupLeader = indexInGroup === 0;
      lines.push(line);
    });
  });

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
  return narratorIds
    .slice()
    .sort(
      (first, second) =>
        narratorTayyibahOrder(first, catalog) - narratorTayyibahOrder(second, catalog)
    )
    .map((narratorId) => ({
      narratorId,
      name: getNarratorName(narratorId, catalog),
      symbol: getNarratorSymbol(narratorId, catalog),
    }));
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
  catalog?: TransmissionCatalog
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

  groups.sort((first, second) => {
    // رتبة يدوية للموضع: قرار صريح من المحقق يسبق كل قاعدة آلية.
    const firstRank = first.variant.orderRank;
    const secondRank = second.variant.orderRank;
    if (typeof firstRank === 'number' && typeof secondRank === 'number' && firstRank !== secondRank) {
      return firstRank - secondRank;
    }
    if (typeof firstRank === 'number' && typeof secondRank !== 'number') return -1;
    if (typeof firstRank !== 'number' && typeof secondRank === 'number') return 1;

    const traversalDiff = compareReadingPositions(first.anchor, second.anchor, plan);
    if (traversalDiff !== 0) return traversalDiff;

    const spanDiff = plan.traversal === 'END_TO_START'
      ? second.variant.startPosition - first.variant.startPosition
      : first.variant.endPosition - second.variant.endPosition;
    if (spanDiff !== 0) return spanDiff;

    return first.variant.id.localeCompare(second.variant.id, 'ar');
  });

  for (const group of groups) {
    group.items.sort((first, second) =>
      compareAlternatives(group.variant, first.alt, second.alt, engine, catalog)
    );
  }

  return groups;
}

/**
 * ترتيب وجهين داخل الموضع الواحد.
 *
 * القاعدة المعتمدة من صاحب المشروع: **قوة الوجه في الكتاب**. لذلك يُقدَّم
 * الوجه ذو `strength` الأصغر. الوجه الذي لم تُسجَّل قوته يأتي بعد المسجّل،
 * فلا يتقدم وجه غير محقَّق على وجه رجّحه المحقق.
 */
function compareAlternatives(
  variant: Variant,
  first: VariantAlternative,
  second: VariantAlternative,
  engine: TashjeerEngineSettings,
  catalog?: TransmissionCatalog
): number {
  // ترتيب صريح للأوجه في هذا الموضع بعينه: أقوى من أي قاعدة عامة.
  const explicit = variant.alternativeOrder ?? [];
  if (explicit.length > 0) {
    const firstIndex = explicit.indexOf(first.id);
    const secondIndex = explicit.indexOf(second.id);
    if (firstIndex !== -1 && secondIndex !== -1 && firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }
    if (firstIndex !== -1 && secondIndex === -1) return -1;
    if (firstIndex === -1 && secondIndex !== -1) return 1;
  }

  if (engine.alternativeOrder === 'MANUAL') {
    // لا ترتيب صريح محفوظ: نسقط إلى الطيبة حتى يكون الناتج حتميا.
    return compareByTayyibah(first, second, catalog);
  }

  if (engine.alternativeOrder === 'STRENGTH') {
    const firstStrength = first.strength;
    const secondStrength = second.strength;
    if (
      typeof firstStrength === 'number' &&
      typeof secondStrength === 'number' &&
      firstStrength !== secondStrength
    ) {
      return firstStrength - secondStrength;
    }
    if (typeof firstStrength === 'number' && typeof secondStrength !== 'number') return -1;
    if (typeof firstStrength !== 'number' && typeof secondStrength === 'number') return 1;
  }

  return compareByTayyibah(first, second, catalog);
}

function compareByTayyibah(
  first: VariantAlternative,
  second: VariantAlternative,
  catalog?: TransmissionCatalog
): number {
  const firstOrder = leadNarratorOrder(first, catalog);
  const secondOrder = leadNarratorOrder(second, catalog);
  if (firstOrder !== secondOrder) return firstOrder - secondOrder;
  return first.id.localeCompare(second.id, 'ar');
}

function leadNarratorOrder(alt: VariantAlternative, catalog?: TransmissionCatalog): number {
  const narratorIds = resolveScope(alt.scope, catalog);
  if (narratorIds.length === 0) return 999;
  return Math.min(...narratorIds.map((id) => narratorTayyibahOrder(id, catalog)));
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
  override?: TashjeerBranch
): ClassicLine | null {
  const narratorIds = resolveScope(alt.scope, catalog).sort(
    (first, second) => narratorTayyibahOrder(first, catalog) - narratorTayyibahOrder(second, catalog)
  );
  const marks = marksForRange(variant.startPosition, variant.endPosition, layout);
  if (marks.length === 0) return null;

  const display = displayReaders(narratorIds, catalog, engine);
  const pathNames = alt.scope.kind === 'PATHS' && alt.scope.pathIds?.length
    ? alt.scope.pathIds.map((pathId) => pathDisplayName(pathId, catalog))
    : [];

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
    readers: readerChips(narratorIds, catalog),
    label: display.label,
    symbolDisplay: engine.symbolDisplay,
    readingText: alt.text,
    readingLabel: alt.label,
    // اسم الحكم المطبوع تحت الكلمة: الحقل المخصص، وإلا وصف الوجه، وإلا فئته.
    ruleLabel: alt.ruleLabel?.trim() || alt.label?.trim() || CATEGORY_LABELS[variant.category],
    maddHarakat: alt.maddHarakat,
    strength: alt.strength,
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
    readers: readerChips(narratorIds, catalog),
    label: manual.label || display.label,
    symbolDisplay: engine.symbolDisplay,
    readingText: manual.title,
    readingLabel: manual.label ?? 'سطر يدوي',
    ruleLabel: manual.label?.trim() || manual.title,
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

function marksForRange(startPosition: number, endPosition: number, layout: AyahLayout): ClassicMark[] {
  const marks: ClassicMark[] = [];
  for (let position = startPosition; position <= endPosition; position++) {
    const box = layout.boxByPosition.get(position);
    if (!box) continue;
    marks.push({
      wordId: box.wordId,
      position,
      x: box.centerX,
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

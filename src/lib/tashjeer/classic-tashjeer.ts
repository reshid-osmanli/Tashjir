// محرك التشجير الكلاسيكي - Classic Tashjeer Engine
//
// يحوّل الأوجه إلى الأسطر المعهودة في المصحف المشجّر. ترتيب الأداء الافتراضي
// هنا مقصود وصريح: يبدأ المحرك بآخر كلمة مختلفة في الآية، ثم يرجع إلى أولها.
// لذلك في «ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ» يكون ترتيب المواضع:
// العالمين ← رب ← لله ← الحمد، لا العكس.
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
  /** الأصول والمدود فوق النص، وبقية الفئات تحته. */
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
  /** نص موجز على بطاقة السطر، بحسب إعداد عرض الرموز. */
  label: string;
  /** طريقة إظهار بطاقة القارئ التي اختارها المشرف. */
  symbolDisplay: TashjeerEngineSettings['symbolDisplay'];
  /** النص المقروء بهذا الوجه (بالتشكيل)، أو عنوان السطر اليدوي. */
  readingText: string;
  /** وصف الوجه إن وُجد. */
  readingLabel: string;
  startPosition: number;
  endPosition: number;
  /** رقم المسار (0 = الأقرب للنص). */
  lane: number;
  /** رقم مقطع الوقف/الابتداء في ترتيب الأداء. */
  segmentIndex: number;
  /** إزاحة دقيقة محفوظة للمحرر. */
  rowOffset?: number;
  /** هل اختار المحرر موضع السطر بدلا من التوزيع الآلي؟ */
  isManual?: boolean;
  /** الإحداثي الرأسي للخط بعد الحساب. */
  rowY: number;
  marks: ClassicMark[];
}

/** ناتج التشجير الكلاسيكي الكامل لآية. */
export interface ClassicTashjeer {
  lines: ClassicLine[];
  /** أدنى نقطة لأسفل النص. */
  textBottom: number;
  /** أعلى نقطة في الشجرة، لاستيعاب الأصول والمدود فوق النص. */
  topY: number;
  /** إحداثي أول خط اختلاف تحت النص. */
  firstRowY: number;
  /** ارتفاع كل مسار. */
  rowHeight: number;
  /** الارتفاع الكلي المطلوب للوحة. */
  totalHeight: number;
  /** هل في الآية اختلافات أصلا؟ */
  hasDifferences: boolean;
  /** خطة ترتيب الأداء التي استخدمها المحرك، للشرح والمراجعة. */
  readingPlan: ReadingPlan;
}

// ==================== التوليد ====================

interface RawAlternative {
  variant: Variant;
  alt: VariantAlternative;
}

/**
 * يولّد التشجير الكلاسيكي لآية من اختلافاتها.
 *
 * الترتيب لا يعتمد على ترتيب الإدخال في قائمة الاختلافات؛ يعتمد على خطة
 * القراءة. لذا لا يستطيع ترتيب واجهة المستخدم أو اسم الوجه قلب قاعدة
 * «آخر الآية أولا» سهوا.
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

  const overrideByKey = new Map(
    (runtime.branchOverrides ?? []).map((branch) => [`${branch.variantId}::${branch.alternativeId}`, branch])
  );

  const lines: ClassicLine[] = raw
    .map(({ variant, alt }) =>
      alternativeToLine(variant, alt, layout, catalog, engine, overrideByKey.get(`${variant.id}::${alt.id}`))
    )
    .filter((line): line is ClassicLine => line !== null);

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

  // 2. الترتيب من آخر الآية إلى أولها (أو وضع الاختبار الذي اختاره المشرف).
  lines.sort((first, second) => compareLines(first, second, readingPlan, engine, catalog));
  for (const line of lines) {
    const anchor = variantTraversalAnchor(line.startPosition, line.endPosition, readingPlan.traversal);
    line.segmentIndex = readingSegmentIndex(anchor, readingPlan);
  }
  assignClassicLanes(lines);

  // 3. الحساب الهندسي. نستخدم أكبر lane لا طول القائمة، لأن المحقق قد يضع
  // سطرا يدويا في مسار بعيد عمدا. الأصول والمدود تصعد فوق النص، أما الفرش
  // والوقف ونحوه فتتنازل تحته.
  const rowGap = Math.max(opts.fontSize * 1.3 * engine.textToTreeGap, 30 * engine.textToTreeGap);
  const rowHeight = Math.max(opts.fontSize * 1.85 * engine.rowSpacing, 44 * engine.rowSpacing);
  const textTop = layout.boxes.length ? Math.min(...layout.boxes.map((box) => box.topY)) : opts.textTop;
  const firstRowY = textBottom + rowGap;
  const firstTopRowY = textTop - rowGap;

  for (const line of lines) {
    const automaticY = line.side === 'TOP'
      ? firstTopRowY - line.lane * rowHeight
      : firstRowY + line.lane * rowHeight;
    line.rowY = automaticY + (line.rowOffset ?? 0);
  }

  const topY = lines.filter((line) => line.side === 'TOP').length
    ? Math.min(...lines.filter((line) => line.side === 'TOP').map((line) => line.rowY))
    : textTop;
  const lowestLineY = lines.filter((line) => line.side === 'BOTTOM').length
    ? Math.max(...lines.filter((line) => line.side === 'BOTTOM').map((line) => line.rowY))
    : textBottom;
  const totalHeight = lines.some((line) => line.side === 'BOTTOM')
    ? lowestLineY + rowHeight + rowGap
    : textBottom + rowGap + 60;

  return {
    lines,
    textBottom,
    topY,
    firstRowY,
    rowHeight,
    totalHeight,
    hasDifferences: lines.length > 0,
    readingPlan,
  };
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
    label: display.label,
    symbolDisplay: engine.symbolDisplay,
    readingText: alt.text,
    readingLabel: alt.label,
    startPosition: variant.startPosition,
    endPosition: variant.endPosition,
    lane: override?.isManual ? override.lane : 0,
    segmentIndex: 0,
    rowOffset: override?.isManual ? override.rowOffset : undefined,
    isManual: override?.isManual,
    rowY: 0,
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
    label: manual.label || display.label,
    symbolDisplay: engine.symbolDisplay,
    readingText: manual.title,
    readingLabel: manual.label ?? 'سطر يدوي',
    startPosition: manual.startPosition,
    endPosition: manual.endPosition,
    lane: manual.lane,
    segmentIndex: 0,
    rowOffset: manual.rowOffset,
    isManual: true,
    rowY: 0,
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
    label = symbols.length ? symbols.join(' ') : primaryName;
  }

  return { symbols, primaryName, readerNames, label };
}

/**
 * ترتيب الأسطر: موضع الأداء أولا، ثم قاعدة كسر التعادل من لوحة التحكم.
 * `endPosition` هو مرساة الوضع الصحيح END_TO_START.
 */
function compareLines(
  first: ClassicLine,
  second: ClassicLine,
  plan: ReadingPlan,
  engine: TashjeerEngineSettings,
  catalog?: TransmissionCatalog
): number {
  const firstAnchor = variantTraversalAnchor(first.startPosition, first.endPosition, plan.traversal);
  const secondAnchor = variantTraversalAnchor(second.startPosition, second.endPosition, plan.traversal);
  const traversalDiff = compareReadingPositions(firstAnchor, secondAnchor, plan);
  if (traversalDiff !== 0) return traversalDiff;

  if (engine.tieBreakOrder === 'MANUAL') {
    const laneDiff = first.lane - second.lane;
    if (first.isManual && second.isManual && laneDiff !== 0) return laneDiff;
  }

  if (engine.tieBreakOrder === 'SYMBOL') {
    const symbolDiff = (first.primarySymbol || first.primaryNarratorName).localeCompare(
      second.primarySymbol || second.primaryNarratorName,
      'ar'
    );
    if (symbolDiff !== 0) return symbolDiff;
  } else {
    const orderDiff =
      narratorTayyibahOrder(first.narratorIds[0] ?? '', catalog) -
      narratorTayyibahOrder(second.narratorIds[0] ?? '', catalog);
    if (orderDiff !== 0) return orderDiff;
  }

  // نطاق أقصر في اتجاه الأداء قبل النطاق الأطول عند تساوي نقطة الارتكاز.
  const spanDiff = plan.traversal === 'END_TO_START'
    ? second.startPosition - first.startPosition
    : first.endPosition - second.endPosition;
  if (spanDiff !== 0) return spanDiff;

  return first.id.localeCompare(second.id, 'ar');
}

/**
 * يحجز المسارات اليدوية ثم يضع الأسطر التلقائية في أول مسار حر. السطر
 * اليدوي يبقى في موضعه تماما؛ حتى إن اختار المحرر التراكب فهو قرار ظاهر
 * ومقصود وليس أثرا لإعادة التوليد.
 */
function assignClassicLanes(lines: ClassicLine[]): void {
  for (const side of ['TOP', 'BOTTOM'] as const) {
    const sideLines = lines.filter((line) => line.side === side);
    const reserved = new Set(sideLines.filter((line) => line.isManual).map((line) => line.lane));
    let nextLane = 0;
    let previousSegment = -1;

    for (const line of sideLines) {
      if (line.isManual) continue;

      // عند الوقف/الابتداء نترك مسارا فاصلا قبل المقطع التالي، فيظهر أثر
      // قرار المحقق في شكل الشجرة لا في البيانات الخفية فقط.
      if (previousSegment !== -1 && line.segmentIndex !== previousSegment) nextLane += 1;
      while (reserved.has(nextLane)) nextLane += 1;
      line.lane = nextLane;
      reserved.add(nextLane);
      nextLane += 1;
      previousSegment = line.segmentIndex;
    }
  }
}

function narratorName(narratorId: string, catalog?: TransmissionCatalog): string {
  return narratorId ? getNarratorName(narratorId, catalog) : 'الجميع';
}

function pathDisplayName(pathId: string, catalog?: TransmissionCatalog): string {
  return formatPathName(pathId, catalog);
}

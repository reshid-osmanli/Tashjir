// محرك التشجير - Branch Engine
// مشروع التشجير - نظام القراءات العشر
//
// هذا هو قلب المشروع: تحويل الاختلافات القرائية (Variants) إلى خطوط مرسومة.
//
// القواعد المنهجية المطبّقة هنا:
//
//   1. النص المطبوع في اللوحة هو رواية حفص عن عاصم، لأنه المصحف المتداول.
//      لذلك أي وجه مطابق لحفص لا يُرسم له خط (وجه الأساس isBase).
//
//   2. ترتيب الخطوط: القاعدة المعتمدة في المشروع أن الاختلاف يُقرأ
//      "من آخر الآية إلى أولها". فالخط الذي تقع آخر عقدة له في موضع
//      متأخر من الآية يُرسم في مسار أقرب إلى النص، والذي ينتهي مبكرا
//      يُدفع إلى مسار أبعد. هذا يمنع قلب مدى الاختلافات المتعددة الكلمات.
//
//   3. توزيع المناطق:
//      - الأصول (USUL) والمدود (MADUD) فوق النص، لأنها أحكام عامة سارية.
//      - الفرش (FARSH) والهمز (HAMZ) والوقف (WAQF) والتجويد تحت النص،
//        لأنها مواضع جزئية مرتبطة بكلمة بعينها.
//
//   4. تعبئة المسارات (Lane packing): خطان لا يتقاطعان أفقيا يمكن أن
//      يتشاركا نفس المسار. هذه خوارزمية interval-graph coloring مبسطة،
//      تقلل ارتفاع اللوحة كثيرا في الآيات المزدحمة بالاختلافات.

import type {
  AnchorSide,
  AyahLayout,
  LayoutOptions,
  LineNode,
  RenderedBranch,
  TashjeerBranch,
  Variant,
  VariantAlternative,
  ViewFilter,
} from '@/types/tashjeer';
import type { VariantCategory } from '@/types';
import { getLaneY } from './layout-engine';
import { describeScope, resolveScope } from './scope';
import { getCategoryColor } from './color-system';
import { characterBoundsForWord, characterRangeCenterX } from '@/lib/quran-logic/characters';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import type { TraversalOrder } from './engine-settings';
import { buildReadingPlan, compareReadingPositions, variantTraversalAnchor } from './reading-plan';

// ==================== توزيع الفئات على الجهات ====================

/**
 * الجهة التي تُرسم فيها كل فئة من فئات الاختلاف.
 *
 * كل الفئات تحت النص. في المصحف المشجّر تنزل أسطر الأوجه جميعا تحت الآية
 * واحدا تلو الآخر — الأصول والمدود والفرش سواء. وضع الأصول والمدود فوق
 * النص كان خطأ في الإصدار السابق: يقطع تسلسل القراءة ويزاحم الحركات.
 */
export const CATEGORY_SIDE: Record<VariantCategory, AnchorSide> = {
  USUL: 'BOTTOM',
  MADUD: 'BOTTOM',
  FARSH: 'BOTTOM',
  HAMZ: 'BOTTOM',
  WAQF: 'BOTTOM',
  TAJWEED: 'BOTTOM',
};

/** أسماء الفئات بالعربية. */
export const CATEGORY_LABELS: Record<VariantCategory, string> = {
  USUL: 'أصول',
  FARSH: 'فرش',
  MADUD: 'مدود',
  HAMZ: 'همز',
  WAQF: 'وقف',
  TAJWEED: 'تجويد',
};

/**
 * أولوية الفئة داخل الجهة الواحدة.
 * الأقل رقما يُرسم أقرب إلى النص.
 */
const CATEGORY_PRIORITY: Record<VariantCategory, number> = {
  FARSH: 0,
  HAMZ: 1,
  MADUD: 0,
  USUL: 1,
  WAQF: 2,
  TAJWEED: 3,
};

// ==================== توليد الخطوط ====================

/** خيارات تشغيل المحرك؛ كلها اختيارية حتى تبقى ملفات التصدير القديمة صالحة. */
export interface BranchGenerationOptions {
  /** كتالوج القراء والرواة والطرق الذي اختاره المشرف. */
  catalog?: TransmissionCatalog;
  /** الاتجاه المعتمد في ترتيب التشجير. الافتراضي الصحيح: آخر الآية أولا. */
  traversal?: TraversalOrder;
  /** علامات الوقف والابتداء التي تقسم خطة المرور داخل الآية. */
  boundaries?: import('@/types/tashjeer').RecitationBoundary[];
  /** عدد كلمات الآية؛ يفيد مع الوقف عند موضع لا توجد عليه شعبة. */
  wordsCount?: number;
}

/**
 * يولّد خطوط التشجير من قائمة الاختلافات.
 *
 * لكل وجه غير أساسي يُنشأ خط واحد، عقده هي الكلمات التي يشملها الاختلاف.
 * الخطوط اليدوية الموجودة مسبقا تُحترم ولا يُعاد توليدها.
 *
 * @param variants اختلافات الآية
 * @param layout ناتج تخطيط الآية (لمعرفة الكلمات الموجودة فعلا)
 * @param existing الخطوط الحالية، لحفظ التعديلات اليدوية
 */
export function generateBranches(
  variants: Variant[],
  layout: AyahLayout,
  existing: TashjeerBranch[] = [],
  options: BranchGenerationOptions = {}
): TashjeerBranch[] {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  // لا نحتفظ من السطر اليدوي إلا بموضعه (lane/rowOffset) وحالة الإخفاء؛ أما
  // الفئة والعقد واللون والبطاقة فتعاد اشتقاقا من الوجه الحالي. بذلك لا يبقى
  // سطر يدوي تحت النص بعد تحويل الاختلاف إلى أصل مثلا.
  const manualBranches = existing
    .filter((branch) => branch.isManual)
    .flatMap((branch) => {
      const variant = variantById.get(branch.variantId);
      const alternative = variant?.alternatives.find((item) => item.id === branch.alternativeId);
      if (!variant || !alternative || alternative.isBase) return [];
      const nodes = buildNodes(variant, layout);
      if (nodes.length === 0) return [];
      return [{
        ...branch,
        category: variant.category,
        nodes,
        side: CATEGORY_SIDE[variant.category],
        // لا نفقد تسمية حررها المستخدم يدويا، أما البطاقة المولدة الفارغة
        // فتأخذ الوصف الحالي للوجه ونطاقه.
        label: branch.label || buildLabel(alternative, options.catalog),
        color: getCategoryColor(variant.category),
      }];
    });
  const manualKeys = new Set(manualBranches.map((branch) => branchKey(branch)));
  const hiddenKeys = new Set(
    existing.filter((branch) => branch.isHidden).map((branch) => branchKey(branch))
  );

  const generated: TashjeerBranch[] = [];

  for (const variant of variants) {
    for (const alternative of variant.alternatives) {
      // وجه الأساس هو نص المصحف المطبوع، فلا يُرسم له خط.
      if (alternative.isBase) continue;
      // إن كان الوجه لا يقرأ به أحد فهو بيانات ناقصة، نتجاهله في الرسم.
      if (resolveScope(alternative.scope, options.catalog).length === 0) continue;

      const key = `${variant.id}::${alternative.id}`;
      if (manualKeys.has(key)) continue;

      const nodes = buildNodes(variant, layout);
      if (nodes.length === 0) continue;

      generated.push({
        id: key,
        variantId: variant.id,
        alternativeId: alternative.id,
        category: variant.category,
        nodes,
        lane: 0, // يُحسب لاحقا في assignLanes
        side: CATEGORY_SIDE[variant.category],
        label: buildLabel(alternative, options.catalog),
        color: getCategoryColor(variant.category),
        isHidden: hiddenKeys.has(key),
      });
    }
  }

  return assignLanes([...manualBranches, ...generated], options);
}

/**
 * يبني عقد الخط من مدى الاختلاف. الموضع الحرفي يظل سطرا ذا مدى كلمات كي لا
 * تتغير قواعد ترتيب التشجير، لكن وصلة السطر تثبت على الحرف/الحروف المحددة
 * بدلا من مركز الكلمة كله.
 */
function buildNodes(variant: Variant, layout: AyahLayout): LineNode[] {
  const side = CATEGORY_SIDE[variant.category];
  const nodes: LineNode[] = [];
  const characterRange = variant.targetKind === 'CHARACTERS' ? variant.characterRange : undefined;

  for (let position = variant.startPosition; position <= variant.endPosition; position++) {
    const box = layout.boxByPosition.get(position);
    if (!box) continue;
    const bounds = characterBoundsForWord(characterRange, position, box.text);

    nodes.push({
      id: `${variant.id}-w${position}`,
      wordId: box.wordId,
      position,
      characterStart: bounds?.start,
      characterEnd: bounds?.end,
      anchor: side,
    });
  }

  return nodes;
}

/** نص بطاقة الوجه: الوصف ثم النطاق. */
function buildLabel(alternative: VariantAlternative, catalog?: TransmissionCatalog): string {
  const scopeText = describeScope(alternative.scope, { short: true, catalog });
  return alternative.label ? `${alternative.label} — ${scopeText}` : scopeText;
}

function branchKey(branch: TashjeerBranch): string {
  return `${branch.variantId}::${branch.alternativeId}`;
}

// ==================== توزيع المسارات ====================

/**
 * يوزّع الخطوط على مسارات أفقية: مسار مستقل لكل خط، تنازليا.
 *
 * الخوارزمية:
 *   1. تُقسم الخطوط حسب الجهة (وكلها تحت النص في التشجير المعتمد).
 *   2. تُرتب: «من آخر الآية إلى أولها» أولا، ثم أولوية الفئة عند تساوي
 *      موضع الارتكاز، حتى يكون الأقرب لنهاية الآية أقرب للنص.
 *   3. يأخذ كل خط أول مسار حر، والمسار الذي ثبّته المحرر يبقى محجوزا له.
 *
 * لا نتشارك المسار الواحد بين خطين متباعدين أفقيا. كان ذلك يقلل ارتفاع
 * اللوحة لكنه يخالف شكل المصحف المشجّر: كل وجه في سطر مستقل يقرؤه القارئ
 * متتابعا، وامتداد السطر مع الآية كلها هو ما يبيّن موافقة الوجه لما قبله.
 *
 * @returns نفس الخطوط بعد ضبط الحقل lane
 */
export function assignLanes(
  branches: TashjeerBranch[],
  options: BranchGenerationOptions = {}
): TashjeerBranch[] {
  const result: TashjeerBranch[] = [];

  for (const side of ['TOP', 'BOTTOM'] as const) {
    const sideBranches = branches
      .filter((branch) => branch.side === side)
      .sort((first, second) => compareBranchesForLanes(first, second, options));

    // المسار الذي اختاره المحرر يَجب أن يبقى كما هو بعد أي حفظ أو تعديل
    // للاختلافات. سابقا كانت assignLanes تعيد ترقيم الخط اليدوي، فتبدو عملية
    // التحريك ناجحة مؤقتا ثم تختفي عند الحفظ/إعادة التوليد.
    const reserved = new Set(
      sideBranches.filter((branch) => branch.isManual).map((branch) => branch.lane)
    );

    for (const branch of sideBranches) {
      if (branch.isManual) result.push(branch);
    }

    let nextLane = 0;
    for (const branch of sideBranches) {
      if (branch.isManual) continue;
      while (reserved.has(nextLane)) nextLane += 1;
      reserved.add(nextLane);
      result.push({ ...branch, lane: nextLane });
      nextLane += 1;
    }
  }

  return result;
}

/**
 * ترتيب الخطوط قبل توزيع المسارات.
 *
 * القاعدة المنهجية: "من آخر الآية إلى أولها" — الخط الذي يبدأ متأخرا
 * يأخذ مسارا أقرب إلى النص، لأنه يُقرأ أولا في ترتيب التشجير.
 */
function compareBranchesForLanes(
  first: TashjeerBranch,
  second: TashjeerBranch,
  options: BranchGenerationOptions
): number {
  const traversal = options.traversal ?? 'END_TO_START';
  const firstSpan = branchPositionSpan(first);
  const secondSpan = branchPositionSpan(second);

  // نقطة الارتكاز هي آخر كلمة في مدى الاختلاف في الاتجاه المعتمد، لا أول
  // عقدة فيه. هذا هو التصحيح الذي يجعل «العالمين» قبل «رب» ثم «لله» ثم
  // «الحمد» حتى إذا امتد اختلاف سابق على أكثر من كلمة.
  const firstAnchor = variantTraversalAnchor(firstSpan.start, firstSpan.end, traversal);
  const secondAnchor = variantTraversalAnchor(secondSpan.start, secondSpan.end, traversal);

  let readingDiff: number;
  if (options.boundaries?.length) {
    const wordsCount = Math.max(
      options.wordsCount ?? 0,
      firstSpan.end,
      secondSpan.end,
      ...options.boundaries.map((boundary) => boundary.position)
    );
    const plan = buildReadingPlan(wordsCount, options.boundaries, traversal);
    readingDiff = compareReadingPositions(firstAnchor, secondAnchor, plan);
  } else {
    readingDiff = traversal === 'END_TO_START'
      ? secondAnchor - firstAnchor
      : firstAnchor - secondAnchor;
  }
  if (readingDiff !== 0) return readingDiff;

  const priorityDiff = CATEGORY_PRIORITY[first.category] - CATEGORY_PRIORITY[second.category];
  if (priorityDiff !== 0) return priorityDiff;

  // عند تساوي موضع النهاية، يقدم المدى الأقرب إلى موضع البداية في اتجاه
  // القراءة، ثم نلجأ إلى المعرف حتى تكون النتيجة حتمية.
  const spanDiff = traversal === 'END_TO_START'
    ? secondSpan.start - firstSpan.start
    : firstSpan.end - secondSpan.end;
  if (spanDiff !== 0) return spanDiff;

  return first.id.localeCompare(second.id, 'ar');
}

/** مدى الخط بدلالة مواضع الكلمات، مع هامش لاستيعاب البطاقة. */
function branchPositionSpan(branch: TashjeerBranch): { start: number; end: number } {
  const positions = branch.nodes.map((node) => node.position);
  if (positions.length === 0) return { start: 0, end: 0 };
  return { start: Math.min(...positions), end: Math.max(...positions) };
}

// ==================== الحساب الهندسي ====================

/**
 * يحوّل الخطوط المنطقية إلى خطوط جاهزة للرسم في SVG.
 *
 * شكل المسار:
 *   من نقطة الارتباط بالكلمة، ننزل (أو نصعد) بمنحنى قصير إلى المسار الأفقي،
 *   ثم نسير أفقيا حتى نهاية المدى، ثم تُوضع البطاقة.
 *   عندما يشمل الاختلاف عدة كلمات، تُربط كل كلمة بالمسار بخط عمودي.
 *
 * @param branches الخطوط بعد توزيع المسارات
 * @param layout ناتج تخطيط الآية
 * @param options إعدادات التخطيط
 */
export function renderBranches(
  branches: TashjeerBranch[],
  layout: AyahLayout,
  options: Partial<LayoutOptions> = {}
): RenderedBranch[] {
  return branches
    .filter((branch) => !branch.isHidden)
    .map((branch) => renderBranch(branch, layout, options))
    .filter((branch): branch is RenderedBranch => branch !== null);
}

function renderBranch(
  branch: TashjeerBranch,
  layout: AyahLayout,
  options: Partial<LayoutOptions>
): RenderedBranch | null {
  const points = branch.nodes
    .map((node) => {
      const box = layout.boxById.get(node.wordId);
      if (!box) return null;
      return {
        x:
          typeof node.characterStart === 'number'
            ? characterRangeCenterX(box, node.characterStart, node.characterEnd ?? node.characterStart)
            : box.centerX,
        y: node.anchor === 'TOP' ? box.topY : box.bottomY,
        wordId: node.wordId,
      };
    })
    .filter((point): point is { x: number; y: number; wordId: number } => point !== null)
    // ترتيب من اليمين إلى اليسار، موافقا لاتجاه القراءة.
    .sort((a, b) => b.x - a.x);

  if (points.length === 0) return null;

  const laneY = getLaneY(branch.lane, branch.side, layout, options) + (branch.rowOffset ?? 0);
  const path = buildPath(points, laneY, branch.side);

  // البطاقة توضع عند الطرف الأيسر من المسار (نهاية الخط بصريا).
  const leftMostX = Math.min(...points.map((point) => point.x));

  return {
    ...branch,
    path,
    laneY,
    labelX: leftMostX - 18,
    labelY: laneY,
    points,
  };
}

/**
 * يبني مسار SVG.
 *
 * لكل نقطة ارتباط: منحنى تربيعي قصير من الكلمة إلى المسار الأفقي،
 * ثم خط أفقي على المسار يصل النقاط بعضها ببعض.
 */
function buildPath(
  points: Array<{ x: number; y: number }>,
  laneY: number,
  side: AnchorSide
): string {
  const first = points[0];
  const last = points[points.length - 1];

  // مقدار انحناء الوصلة بين الكلمة والمسار.
  const bend = Math.min(Math.abs(laneY - first.y) * 0.6, 22) * (side === 'TOP' ? -1 : 1);

  const segments: string[] = [];

  // النزول/الصعود من أول كلمة إلى المسار.
  segments.push(`M ${round(first.x)} ${round(first.y)}`);
  segments.push(`Q ${round(first.x)} ${round(first.y + bend)} ${round(first.x - 8)} ${round(laneY)}`);

  // وصلات الكلمات الوسيطة: خط عمودي قصير من كل كلمة إلى المسار.
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    segments.push(`M ${round(point.x)} ${round(point.y)}`);
    segments.push(`L ${round(point.x)} ${round(laneY)}`);
  }

  // الوصلة الأخيرة ثم السير على المسار حتى نهايته.
  if (points.length > 1) {
    segments.push(`M ${round(last.x)} ${round(last.y)}`);
    segments.push(`Q ${round(last.x)} ${round(last.y + bend)} ${round(last.x - 8)} ${round(laneY)}`);
  }

  segments.push(`M ${round(first.x - 8)} ${round(laneY)}`);
  segments.push(`L ${round(last.x - 8)} ${round(laneY)}`);

  return segments.join(' ');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// ==================== التصفية ====================

/**
 * يطبّق تصفية العرض على الخطوط.
 *
 * @param branches الخطوط
 * @param variants الاختلافات، للوصول إلى نطاق كل وجه
 * @param filter إعدادات التصفية
 */
export function filterBranches(
  branches: TashjeerBranch[],
  variants: Variant[],
  filter: ViewFilter,
  catalog?: TransmissionCatalog
): TashjeerBranch[] {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return branches.filter((branch) => {
    if (!filter.categories.includes(branch.category)) return false;
    if (filter.narratorIds.length === 0) return true;

    const variant = variantById.get(branch.variantId);
    const alternative = variant?.alternatives.find((item) => item.id === branch.alternativeId);
    if (!alternative) return false;

    const scopeNarrators = new Set(resolveScope(alternative.scope, catalog));
    return filter.narratorIds.some((narratorId) => scopeNarrators.has(narratorId));
  });
}

// ==================== إحصاءات ====================

/** ملخّص عددي لآية واحدة، يُعرض في شريط الحالة ولوحة الخصائص. */
export interface AyahTashjeerStats {
  variantsCount: number;
  alternativesCount: number;
  branchesCount: number;
  topLanes: number;
  bottomLanes: number;
  categories: Record<VariantCategory, number>;
  coveredWords: number;
}

/** يحسب ملخّص الآية من اختلافاتها وخطوطها. */
export function computeStats(
  variants: Variant[],
  branches: TashjeerBranch[]
): AyahTashjeerStats {
  const categories = Object.keys(CATEGORY_LABELS).reduce(
    (accumulator, key) => ({ ...accumulator, [key]: 0 }),
    {} as Record<VariantCategory, number>
  );

  for (const variant of variants) {
    categories[variant.category] += 1;
  }

  const coveredPositions = new Set<number>();
  for (const variant of variants) {
    for (let position = variant.startPosition; position <= variant.endPosition; position++) {
      coveredPositions.add(position);
    }
  }

  const topLanes = maxLane(branches, 'TOP');
  const bottomLanes = maxLane(branches, 'BOTTOM');

  return {
    variantsCount: variants.length,
    alternativesCount: variants.reduce((total, variant) => total + variant.alternatives.length, 0),
    branchesCount: branches.length,
    topLanes,
    bottomLanes,
    categories,
    coveredWords: coveredPositions.size,
  };
}

/** عدد المسارات المستخدمة في جهة معينة. */
export function maxLane(branches: TashjeerBranch[], side: AnchorSide): number {
  const sideBranches = branches.filter((branch) => branch.side === side && !branch.isHidden);
  if (sideBranches.length === 0) return 0;
  return Math.max(...sideBranches.map((branch) => branch.lane)) + 1;
}

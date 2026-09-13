// نواة الإنشاء الذكي — Smart Create Core (FR-ED-08 · FR-ED-09)
// مشروع التشجير - نظام القراءات العشر
//
// النواة النقيّة لمعالج الإنشاء الذكي الموحّد. تأخذ تحديدًا (مواضع) + أنواعًا
// مرغوبة + علاقات، وتُخرج كيانات النموذج الموحّد فقط (Difference/Variant/Relation):
//   - كل نوع يصبح اختلافًا مستقلًا بمعرّفه ورتبته (P-05: الإنشاء الجماعي لا يلغي
//     الاستقلال).
//   - الرتبة صريحة بترتيب الأنواع المختار (تحقيق=١، أصول=٢، فرش=٣…) (P-04).
//   - تُوسم كلها بمعرّف دفعة (createBatchId) للتتبع والتراجع الجماعي فقط.
//   - العلاقات بين الأنواع تُنشأ تلقائيًا بمعرّفاتها (لا رجوع لإنشاء كل وجه ثم
//     الدمج يدويًا).
//   - تعدد الأهداف (FR-ED-09): يمكن تكرار البنية نفسها (أنواع + أوجه +
//     علاقات) لكل كلمة محددة في عملية واحدة بدل موضع مركّب واحد.
//
// المعالج ينتج كيانات النموذج الموحّد فقط — لا هياكل خاصة بالواجهة (FR-ED-08).

import type {
  Difference,
  Variant,
  Relation,
  RelationType,
  RecitationContext,
} from '@/lib/tashjeer/model/v8';
import { createEntityId, wordLocus, rangeLocus } from '@/lib/tashjeer/model/v8';
import type { VariantCategory } from '@/types';
import type { ReadingScope } from '@/types/tashjeer';

/** موضع محدَّد بصريًا (كلمة أو مدى أو حروف) — مدخل الخطوة 1 من المعالج. */
export interface SmartSelectionLocus {
  startPosition: number;
  endPosition: number;
  characterRange?: Difference['locus']['characterRange'];
}

/** علاقة مطلوبة بين نوعين داخل المجموعة (الخطوة 5). */
export interface SmartRelationSpec {
  fromType: VariantCategory;
  toType: VariantCategory;
  type: RelationType;
}

/** وجهًا إضافيًا يدخل من المعالج إلى نوع واحد (الخطوة 2). */
export interface SmartVariantSpec {
  label: string;
  text?: string;
  ruleLabel?: string;
  maddHarakat?: number;
  /** درجة القوة من سلّم الدرجات (FR-ED-08 الخطوة 2: تُعبأ مع الوجه). */
  strengthDegreeId?: string;
  notes?: string;
}

/** مدخلات المعالج. */
export interface SmartCreateInput {
  ayahKey: number;
  selection: SmartSelectionLocus[];
  baseTitle: string;
  /** أنواع مستقلة تُنشأ دفعة واحدة (الخطوة 2). الترتيب يحدد الرتبة. */
  types: VariantCategory[];
  /** نطاق القراء (الخطوة 4). */
  scope: ReadingScope;
  /** سياق الوقف/الوصل لكل الأنواع (الخطوة 7). */
  context?: RecitationContext;
  /**
   * سياق مستقل لنوع واحد (الخطوة 7): يتجاوز السياق العام لذلك النوع وحده،
   * فقد يكون المد وقفًا ووصلًا والوقف وقفًا فقط في المجموعة نفسها.
   */
  contextByType?: Partial<Record<VariantCategory, RecitationContext>>;
  /** علاقات بين الأنواع تُنشأ تلقائيًا (الخطوة 5). */
  relations?: SmartRelationSpec[];
  /** أوجه مستقلة إضافية لكل نوع (الخطوة 2). */
  variants?: Partial<Record<VariantCategory, SmartVariantSpec[]>>;
}

/** ناتج المعالج: كيانات مستقلة + علاقاتها + معرّف الدفعة. */
export interface SmartCreateResult {
  differences: Difference[];
  relations: Relation[];
  batchId: string;
}

const CATEGORY_LABELS_SMART: Record<VariantCategory, string> = {
  USUL: 'أصول',
  FARSH: 'فرش',
  MADUD: 'مد',
  HAMZ: 'همز',
  WAQF: 'وقف',
  TAJWEED: 'تجويد',
};

/** يحوّل التحديد البصري إلى موضع v8 (كلمة واحدة أو مدى). */
function selectionToLocus(selection: SmartSelectionLocus[]): Difference['locus'] {
  if (selection.length === 0) return wordLocus(1);
  if (selection.length === 1) {
    const single = selection[0]!;
    const locus =
      single.startPosition === single.endPosition
        ? wordLocus(single.startPosition)
        : rangeLocus(single.startPosition, single.endPosition);
    if (single.characterRange) locus.characterRange = single.characterRange;
    return locus;
  }
  // مواضع متباعدة: نأخذ المدى الكلي ونثبت المواضع المنفصلة في loci.
  const starts = selection.map((item) => item.startPosition);
  const ends = selection.map((item) => item.endPosition);
  const base = rangeLocus(Math.min(...starts), Math.max(...ends));
  base.loci = selection.map((item) => ({
    startPosition: item.startPosition,
    endPosition: item.endPosition,
    characterRange: item.characterRange,
  }));
  return base;
}

interface BuiltGroup {
  differences: Difference[];
  relations: Relation[];
}

/** يبني مجموعة اختلافات واحدة (الأنواع + علاقاتها) على موضع واحد. */
function buildGroup(
  input: SmartCreateInput,
  locusSelection: SmartSelectionLocus[],
  batchId: string,
  now: string
): BuiltGroup {
  const locus = selectionToLocus(locusSelection);
  const defaultContext: RecitationContext = input.context ?? 'ALWAYS';
  const titleBase = input.baseTitle.trim() || 'اختلاف';

  const differences: Difference[] = input.types.map((category, index) => {
    const id = createEntityId('d');
    const context = input.contextByType?.[category] ?? defaultContext;
    const baseVariant: Variant = {
      id: createEntityId('v'),
      text: titleBase,
      label: 'وجه المصحف',
      scope: input.scope,
      isBase: true,
      rank: 1,
      source: 'editor',
      createdAt: now,
      updatedAt: now,
    };
    const customVariants: Variant[] = (input.variants?.[category] ?? []).map((spec, faceIndex) => ({
      id: createEntityId('v'),
      text: spec.text?.trim() || titleBase,
      label: spec.label.trim() || `وجه ${faceIndex + 2}`,
      scope: input.scope,
      rank: faceIndex + 2,
      ruleLabel: spec.ruleLabel?.trim() || undefined,
      maddHarakat: spec.maddHarakat,
      strengthDegreeId: spec.strengthDegreeId || undefined,
      notes: spec.notes?.trim() || undefined,
      source: 'editor',
      createdAt: now,
      updatedAt: now,
    }));
    return {
      id,
      ayahKey: input.ayahKey,
      category,
      title: `${titleBase} — ${CATEGORY_LABELS_SMART[category] ?? category}`,
      locus,
      occurrenceIndex: index + 1,
      context,
      scope: input.scope,
      source: 'editor',
      rank: index + 1,
      version: 1,
      status: 'DRAFT',
      variants: [baseVariant, ...customVariants],
      relations: [],
      createBatchId: batchId,
      createdAt: now,
      updatedAt: now,
    };
  });

  const byType = new Map(differences.map((difference) => [difference.category, difference]));
  const relations: Relation[] = [];
  for (const spec of input.relations ?? []) {
    const from = byType.get(spec.fromType);
    const to = byType.get(spec.toType);
    if (!from || !to) continue;
    relations.push({
      id: createEntityId('rel'),
      type: spec.type,
      fromId: from.id,
      toId: to.id,
      source: 'editor',
      createdAt: now,
    });
  }

  return { differences, relations };
}

/**
 * يبني مجموعة اختلافات مستقلة من المعالج. كل نوع كيان مستقل برتبته، وكلها
 * تُوسم بمعرّف الدفعة، والعلاقات بينها تُنشأ بمعرّفاتها.
 */
export function buildSmartCreateBatch(input: SmartCreateInput): SmartCreateResult {
  const batchId = createEntityId('batch');
  const now = new Date().toISOString();
  const group = buildGroup(input, input.selection, batchId, now);
  return { differences: group.differences, relations: group.relations, batchId };
}

/** مدخلات الإنشاء متعدد الأهداف: البنية نفسها تُكرر لكل هدف (FR-ED-09). */
export interface SmartCreateMultiTargetInput extends SmartCreateInput {
  /**
   * قائمة الأهداف: كل هدف تحديد مستقل (كلمة أو مدى) يُبنى عليه نسخة كاملة من
   * البنية (الأنواع + الأوجه + العلاقات داخل الهدف). تُبقى `selection` الأصلية
   * للعنوان المرجعي، والأهداف هي ما يُنشأ عليه فعلًا.
   */
  targets: SmartSelectionLocus[][];
  /**
   * عنوان أساس كل هدف (نص كلمته عادة): الهدف الأول بلا عنوان مخصص يأخذ
   * `baseTitle`. بدونه لتسمّت اختلافات الكلمات الأربع كلها باسم الأولى.
   */
  titles?: string[];
}

/**
 * يبني نسخة كاملة من البنية لكل هدف محدد في عملية واحدة (FR-ED-09):
 * أربع كلمات × ثلاثة أنواع = اثنا عشر اختلافًا مستقلًا، وعلاقات كل هدف تربط
 * مجموعته وحدها، والكل بمعرّف دفعة واحد — فيتراجع الكل بخطوة تراجع واحدة.
 */
export function buildSmartCreateMultiTargetBatch(input: SmartCreateMultiTargetInput): SmartCreateResult {
  const targets = input.targets.filter((target) => target.length > 0);
  if (targets.length === 0) {
    return { differences: [], relations: [], batchId: createEntityId('batch') };
  }
  const batchId = createEntityId('batch');
  const now = new Date().toISOString();
  const differences: Difference[] = [];
  const relations: Relation[] = [];
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index]!;
    const titled = { ...input, baseTitle: input.titles?.[index]?.trim() || input.baseTitle };
    const group = buildGroup(titled, target, batchId, now);
    differences.push(...group.differences);
    relations.push(...group.relations);
  }
  return { differences, relations, batchId };
}

/** هل المدخلات صالحة للإنشاء؟ (تحديد + نوع واحد على الأقل). */
export function isSmartCreateReady(input: Pick<SmartCreateInput, 'selection' | 'types'>): boolean {
  return input.selection.length > 0 && input.types.length > 0;
}

// ==================== منطق التحديد البصري (الخطوة 1) ====================
//
// آلة نقر نقيّة بلا DOM: تُختبر منطقيًا (T4)، ويستهلكها المعالج واللوحة معًا
// حتى لا يتفرق سلوك «النقر يحدد المدى» في مكانين.

/** مدى كلمة→كلمة أثناء بنائه بالنقر. */
export interface RangeClickState {
  start: number;
  end: number;
  /** هل اكتمل المدى بنقرتين (مثبت قبل الإنشاء) أم ما زال بنقرة واحدة؟ */
  pinned: boolean;
}

/**
 * النقرة التالية في بناء المدى «كلمة البداية ثم كلمة النهاية»:
 * لا شيء ← النقرة الأولى تثبت البداية؛ ثم النقرة الثانية تثبت النهاية
 * والمدى مكتملًا؛ والنقرة الثالثة تبدأ مدى جديدًا من موضعها.
 */
export function nextRangeClick(current: RangeClickState | null, position: number): RangeClickState {
  if (!current || current.pinned) {
    return { start: position, end: position, pinned: false };
  }
  return {
    start: Math.min(current.start, position),
    end: Math.max(current.start, position),
    pinned: true,
  };
}

/**
 * تبديل هدف بكلمة واحدة (Ctrl+نقر): يُضاف مرتبًا بموضعه أو يُزال إن وُجد.
 * تُستبعد المدى المركبة الأوسع من كلمة — هي للمدى الرئيسي لا للأهداف المبدَّلة.
 */
export function toggleWordTarget(targets: SmartSelectionLocus[], position: number): SmartSelectionLocus[] {
  const exists = targets.some((target) => target.startPosition === position && target.endPosition === position);
  const next = exists
    ? targets.filter((target) => !(target.startPosition === position && target.endPosition === position))
    : [...targets, { startPosition: position, endPosition: position }];
  return next.sort((a, b) => a.startPosition - b.startPosition || a.endPosition - b.endPosition);
}

/**
 * يدمج المدى الرئيسي مع الأهداف الإضافية مرتبة بمواضعها بلا تكرار —
 * الترتيب الظاهر في المراجعة هو ترتيب الكلمات في الآية لا ترتيب النقر.
 */
export function mergeSelectionTargets(
  primary: SmartSelectionLocus,
  extra: SmartSelectionLocus[]
): SmartSelectionLocus[] {
  const seen = new Set<string>();
  return [primary, ...extra]
    .filter((range) => {
      const key = `${range.startPosition}-${range.endPosition}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.startPosition - b.startPosition || a.endPosition - b.endPosition);
}

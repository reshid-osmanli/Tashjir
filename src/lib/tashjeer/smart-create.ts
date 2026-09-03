// نواة الإنشاء الذكي — Smart Create Core (FR-ED-08)
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

/**
 * يبني مجموعة اختلافات مستقلة من المعالج. كل نوع كيان مستقل برتبته، وكلها
 * تُوسم بمعرّف الدفعة، والعلاقات بينها تُنشأ بمعرّفاتها.
 */
export function buildSmartCreateBatch(input: SmartCreateInput): SmartCreateResult {
  const batchId = createEntityId('batch');
  const now = new Date().toISOString();
  const locus = selectionToLocus(input.selection);
  const context: RecitationContext = input.context ?? 'ALWAYS';
  const titleBase = input.baseTitle.trim() || 'اختلاف';

  const differences: Difference[] = input.types.map((category, index) => {
    const id = createEntityId('d');
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

  return { differences, relations, batchId };
}

/** هل المدخلات صالحة للإنشاء؟ (تحديد + نوع واحد على الأقل). */
export function isSmartCreateReady(input: Pick<SmartCreateInput, 'selection' | 'types'>): boolean {
  return input.selection.length > 0 && input.types.length > 0;
}

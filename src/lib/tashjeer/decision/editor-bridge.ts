// جسر المحرر إلى Decision Resolver — Editor Decision Bridge (FR-EN-03، P-07)
// مشروع التشجير - نظام القراءات العشر
//
// المحرر ومحرك التراكيب يعملان على نموذج الاختلاف القديم (Variant بفئة
// VariantCategory)، بينما تُكتب سياسات الاستوديو بأنواع الاختلاف الموحّدة
// (MADD/TAHQIQ/FARSH...). هذا الملف هو المكان الوحيد الذي يترجم بين
// المصطلحين ويقدّم للمحرر والمحرك قرارات جاهزة من Decision Resolver:
//
//   - تنافي موضعين في الآية (هل يُضربان وجها أم وجهان لموضع واحد؟)
//   - صلاحية رابط يدوي (هل تمنعه سياسة دمج/علاقة؟)
//
// لا منطق قرار هنا: كل شيء يمرّ عبر api.ts. الملف نقي وقابل للاختبار بلا
// متصفح، ويقرأ الملف المفعّل عند الطلب فقط.

import type { VariantCategory } from '@/types';
import type { LinkEndpoint, TashjeerLink, TashjeerLinkKind, TashjeerLinkRelation, Variant } from '@/types/tashjeer';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { variantsSharePosition } from '@/lib/tashjeer/loci';
import { resolveMerge, resolveRelation, resolveRelationExclusion } from './api';
import { DEFAULT_SYSTEM_PROFILE, type DecisionContext } from './policy';
import type { DecisionResult, DecisionTraceStep } from './resolver';

// ==================== ترجمة الفئات ====================

/** يحوّل فئة المحرر إلى نوع الاختلاف الذي تُكتب به سياسات الاستوديو. */
export function editorCategoryToStudioType(category: VariantCategory): string {
  switch (category) {
    case 'MADUD':
      return 'MADD';
    case 'USUL':
      return 'TAHQIQ';
    case 'HAMZ':
      return 'HAMZ';
    case 'WAQF':
      return 'FORBIDDEN_WASL';
    case 'TAJWEED':
      return 'TAJWEED';
    default:
      return 'FARSH';
  }
}

/** عكس الترجمة: نوع الاستوديو إلى فئة المحرر (للتتبع وربط القاعدة بالمحرر). */
export function studioTypeToEditorCategory(type: string): VariantCategory {
  switch (type) {
    case 'MADD':
      return 'MADUD';
    case 'TAHQIQ':
    case 'WASL':
      return 'USUL';
    case 'HAMZ':
      return 'HAMZ';
    case 'FORBIDDEN_WASL':
      return 'WAQF';
    case 'TAJWEED':
      return 'TAJWEED';
    default:
      return 'FARSH';
  }
}

// ==================== تنافي المواضع ====================

/**
 * حالة العلاقة بين اختلافين في الموضع الواحد (حزمة 05): المتنافي لا يُضرب
 * (وجهان لموضع واحد)، والمرتبطان يجتمعان في سطر الراوي، والمستقلان بُعدان
 * قائمان بذاتهما يُطبقان معًا. قرار واحد في مكان واحد: هنا.
 */
export type LocusRelationStatus = 'EXCLUSIVE' | 'RELATED' | 'INDEPENDENT';

/** قرار تنافٍ بين اختلافين في الآية. */
export interface LocusExclusionDecision {
  exclusive: boolean;
  reason: string;
  /** هل يتقاطع الموضعان في كلمة واحدة على الأقل؟ */
  sharePosition: boolean;
  /**
   * حالة العلاقة الثلاثية (حزمة 05/T3): متنافٍ (لا يُضربان) أو مرتبطان
   * (يجتمعان في سطر — كالمد مع التحقيق) أو مستقلان (كلٌّ بُعد قائم بذاته).
   */
  status: LocusRelationStatus;
}

/**
 * علاقة يدوية موثقة بين اختلافين — تصحيح المحرر لقرار التنافي (حزمة 05/T2):
 * المحرك يقترح عبر السياسات، والمحرر يقرر، والقرار اليدوي يسبق السياسة (P-06).
 */
export interface ManualDifferenceRelation {
  fromId: string;
  toId: string;
  relation: 'MUTUALLY_EXCLUSIVE' | 'RELATED';
  note?: string;
  /** معرّف الرابط في المستند إن وُجد (للتتبع والعرض). */
  linkId?: string;
}

/** يستخرج علاقات التنافي/الارتباط اليدوية من روابط المستند (دالة نقية). */
export function manualDifferenceRelationsOf(links: TashjeerLink[]): ManualDifferenceRelation[] {
  const relations: ManualDifferenceRelation[] = [];
  for (const link of links) {
    if (link.kind !== 'DIFFERENCE_TO_DIFFERENCE') continue;
    const relation = link.differenceRelation;
    if (relation !== 'MUTUALLY_EXCLUSIVE' && relation !== 'RELATED') continue;
    relations.push({
      fromId: link.from.id,
      toId: link.to.id,
      relation,
      note: link.notes,
      linkId: link.id,
    });
  }
  return relations;
}

/** مفتاح زوج معرّفات مرتّب: العلاقة بين طرفين لا تعتمد على ترتيبهما. */
function differencePairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/**
 * يفهرس العلاقات اليدوية بمفتاح الزوج. عند تكرار (ملف مستورد مثلًا) يفوز
 * الأخير في ترتيب المصفوفة — الأحدث إدراجًا هو الأحدث قرارًا، وحتمي دائمًا.
 */
export function manualRelationByPair(
  manuals: ManualDifferenceRelation[]
): Map<string, ManualDifferenceRelation> {
  const map = new Map<string, ManualDifferenceRelation>();
  for (const item of manuals) {
    map.set(differencePairKey(item.fromId, item.toId), item);
  }
  return map;
}

/**
 * هل الاختلافان وجهان متنافيان لموضع واحد (فلا يُضربان في المحرك) أم بُعدان
 * مستقلان يجتمعان في سطر؟
 *
 * الحسم للـ Resolver على ثلاث درجات:
 *   1) موضعان منفصلان: لا تنافي أبدا (قرار بنائي).
 *   2) الفئة نفسها في الموضع نفسه: وجهان لموضع واحد، متنافيان دائما (DM-09)،
 *      وهو ما تصرّح به قاعدة النظام «المدود المتعددة متنافية» ونظائرها.
 *   3) فئتان مختلفتان في الموضع نفسه: مستقلتان افتراضا (يجتمعان في سطر)، ما
 *      لم تُصرّح قاعدة مطابقة بتنافٍ صريح: إجراء PREVENT_MERGE مع
 *      params.exclusive = true. هكذا يملك الاستوديو رافعة حقيقية دون أن
 *      يخلط بين «لا تدمج في سطر واحد» و«لا تُضرب وجها».
 */
export function resolveLocusExclusion(
  first: Variant,
  second: Variant,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  ctx?: DecisionContext
): DecisionResult<LocusExclusionDecision> {
  const trace: DecisionTraceStep[] = [];
  const sharePosition = variantsSharePosition(first, second);

  if (!sharePosition) {
    trace.push({
      stage: 'LOCUS',
      message: 'موضعان منفصلان في كلمات مختلفة: بعدان مستقلان يُضربان',
      status: 'applied',
    });
    return {
      decision: { exclusive: false, reason: 'موضعان منفصلان', sharePosition, status: 'INDEPENDENT' },
      appliedRules: [],
      skippedRules: [],
      trace,
    };
  }

  const a = editorCategoryToStudioType(first.category);
  const b = editorCategoryToStudioType(second.category);
  trace.push({
    stage: 'LOCUS',
    message: `الموضعان يتقاطعان في كلمة؛ يُحسم التنافي بين ${a} و${b} من سياسات المحرك`,
    status: 'info',
  });

  if (first.category === second.category) {
    const inner = resolveRelationExclusion(a, b, profile);
    trace.push(...inner.trace);
    return {
      decision: {
        exclusive: true,
        reason: 'وجهان من فئة واحدة في موضع واحد',
        sharePosition,
        status: 'EXCLUSIVE',
      },
      appliedRules: inner.appliedRules,
      skippedRules: inner.skippedRules,
      trace,
    };
  }

  const merge = resolveMerge(a, b, profile, ctx);
  trace.push(...merge.trace.filter((step) => step.stage === 'MATCH' || step.stage === 'MERGE' || step.stage === 'CONFLICT'));

  const explicit = merge.appliedRules.filter((rule) =>
    rule.actions.some(
      (action) => action.type === 'PREVENT_MERGE' && action.params?.exclusive === true
    )
  );
  const exclusive = explicit.length > 0;
  const status: LocusRelationStatus = exclusive
    ? 'EXCLUSIVE'
    : merge.decision.merge
      ? 'RELATED'
      : 'INDEPENDENT';
  trace.push({
    stage: 'EXCLUSION',
    message: exclusive
      ? `تنافٍ صريح بقاعدة: ${explicit.map((rule) => rule.name).join(' + ')}`
      : `فئتان مختلفتان في موضع واحد: ${merge.decision.merge ? 'مرتبطان يجتمعان في سطر' : 'مستقلتان'} (${merge.decision.reason})`,
    status: exclusive ? 'blocked' : 'applied',
  });

  return {
    decision: {
      exclusive,
      reason: exclusive
        ? `تنافٍ صريح: ${explicit.map((rule) => rule.name).join(' + ')}`
        : merge.decision.merge
          ? `مرتبطان: ${merge.decision.reason}`
          : `مستقلتان: ${merge.decision.reason}`,
      sharePosition,
      status,
    },
    appliedRules: merge.appliedRules,
    skippedRules: merge.skippedRules,
    trace,
  };
}

/** قرار علاقة اختلافين بالحالة الثلاثية: متنافٍ/مرتبط/مستقل (حزمة 05/T3). */
export interface LocusRelationDecision {
  status: LocusRelationStatus;
  reason: string;
  sharePosition: boolean;
  /** هل حُسم القرار بتصحيح يدوي موثق يسبق السياسة؟ */
  manual: boolean;
}

/**
 * يحسم علاقة اختلافين في الموضع (متنافٍ/مرتبط/مستقل) — القرار الواحد الذي
 * تستهلكه شارات الواجهة ومحرك التراكيب على السواء:
 *
 *   1) علاقة يدوية موثقة بين الاختلافين تسبق السياسة (المحرر يقرر — P-06):
 *      متنافيان ← EXCLUSIVE، مرتبطان ← RELATED.
 *   2) وإلا فسياسة المحرك عبر `resolveLocusExclusion` (Resolver حصريًا).
 */
export function resolveLocusRelation(
  first: Variant,
  second: Variant,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  manual?: ManualDifferenceRelation,
  ctx?: DecisionContext
): DecisionResult<LocusRelationDecision> {
  if (manual) {
    const status: LocusRelationStatus =
      manual.relation === 'MUTUALLY_EXCLUSIVE' ? 'EXCLUSIVE' : 'RELATED';
    const label = status === 'EXCLUSIVE' ? 'متنافيان' : 'مرتبطان';
    const reason = manual.note?.trim()
      ? `علاقة يدوية موثقة (${label}): ${manual.note.trim()}`
      : `علاقة يدوية موثقة من المحرر: ${label}`;
    return {
      decision: {
        status,
        reason,
        sharePosition: variantsSharePosition(first, second),
        manual: true,
      },
      appliedRules: [],
      skippedRules: [],
      trace: [
        {
          stage: 'MANUAL_RELATION',
          message: `${reason} — تسبق سياسة المحرك`,
          status: status === 'EXCLUSIVE' ? 'blocked' : 'applied',
        },
      ],
    };
  }

  const inner = resolveLocusExclusion(first, second, profile, ctx);
  return {
    decision: {
      status: inner.decision.status,
      reason: inner.decision.reason,
      sharePosition: inner.decision.sharePosition,
      manual: false,
    },
    appliedRules: inner.appliedRules,
    skippedRules: inner.skippedRules,
    trace: inner.trace,
  };
}

/**
 * مجموعات التنافي في الآية عبر الـ Resolver: يعيد لكل اختلاف مفتاح مجموعته.
 * الاختلافات التي حكم الـ Resolver بتنافيها (في الموضع نفسه) تجتمع في مجموعة
 * واحدة (اتحاد-وجود)، والمستقلة تبقى كل واحدة بمفردها.
 *
 * علاقات التنافي/الارتباط اليدوية الموثقة (حزمة 05/T2) تُطبَّق قبل السياسة:
 * «متنافيان» يضم الاختلافين إلى مجموعة واحدة ولو خالفا السياسة، و«مرتبطان»
 * يمنع ضمهما ولو كانت السياسة تنافيهما (مثل مدّين مسجّلين اختلافين مستقلين).
 * العلاقة اليدوية بين موضعين منفصلين لا أثر لها هنا — التنافي لا معنى له
 * إلا بين اختلافين يتقاطعان في كلمة.
 *
 * البديل القديم `exclusiveGroupKeys` في loci.ts يبقى للاختبارات الهندسية،
 * لكن المحرك يمر من هنا كي لا يكون له قرار خاص (P-07).
 */
export function resolveExclusiveGroups(
  variants: Variant[],
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  manualRelations: ManualDifferenceRelation[] = []
): { groups: Map<string, string>; decisions: Array<{ firstId: string; secondId: string; result: DecisionResult<LocusExclusionDecision> }> } {
  const parent = new Map(variants.map((variant) => [variant.id, variant.id]));
  const manualByPair = manualRelationByPair(manualRelations);
  const decisions: Array<{ firstId: string; secondId: string; result: DecisionResult<LocusExclusionDecision> }> = [];

  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  for (let i = 0; i < variants.length; i += 1) {
    for (let j = i + 1; j < variants.length; j += 1) {
      const first = variants[i];
      const second = variants[j];
      // تحسين: لا نستدعي الـ Resolver لمواضع لا تتقاطع أصلا.
      if (!variantsSharePosition(first, second)) continue;
      const manual = manualByPair.get(differencePairKey(first.id, second.id));
      const base = resolveLocusExclusion(first, second, profile);
      let result = base;
      if (manual) {
        const exclusive = manual.relation === 'MUTUALLY_EXCLUSIVE';
        const label = exclusive ? 'متنافيان' : 'مرتبطان';
        result = {
          decision: {
            exclusive,
            status: exclusive ? 'EXCLUSIVE' : 'RELATED',
            reason: manual.note?.trim()
              ? `علاقة يدوية موثقة (${label}): ${manual.note.trim()}`
              : `علاقة يدوية موثقة من المحرر: ${label}`,
            sharePosition: base.decision.sharePosition,
          },
          appliedRules: [],
          skippedRules: base.appliedRules.map((rule) => ({ rule, reason: 'علاقة يدوية موثقة تسبق السياسة' })),
          trace: [
            {
              stage: 'MANUAL_RELATION',
              message: `تصحيح يدوي موثق: ${label}${manual.note ? ` — ${manual.note}` : ''} (يتقدم على قرار السياسة)`,
              status: exclusive ? 'blocked' : 'applied',
            },
            ...base.trace.map((step) => ({ ...step, status: 'skipped' as const })),
          ],
        };
      }
      decisions.push({ firstId: first.id, secondId: second.id, result });
      if (!result.decision.exclusive) continue;
      const a = find(first.id);
      const b = find(second.id);
      if (a !== b) parent.set(a, b);
    }
  }

  // مفتاح المجموعة من جذرها: فئة الجذر + معرّفه. لو وُضعت فئة كل عضو في
  // مفتاحه لانقسمت المجموعة الواحدة حين تجمع فئتين بقرار تنافٍ صريح.
  const categoryById = new Map(variants.map((variant) => [variant.id, variant.category]));
  const groups = new Map<string, string>();
  for (const variant of variants) {
    const root = find(variant.id);
    groups.set(variant.id, `${categoryById.get(root) ?? variant.category}::${root}`);
  }
  return { groups, decisions };
}

// ==================== صلاحية الروابط اليدوية ====================

export interface LinkPolicyInput {
  kind: TashjeerLinkKind;
  relation: TashjeerLinkRelation;
  from: LinkEndpoint;
  to: LinkEndpoint;
  /** فئتا الطرفين إن عُرفتا (وجهان أو سطران)، لتقييم مصفوفة الدمج. */
  fromCategory?: VariantCategory;
  toCategory?: VariantCategory;
}

export interface LinkPolicyDecision {
  allowed: boolean;
  reason: string;
  /** تحذير لا يمنع: المحرر يقرر (P-06)، لكن السياسة تقول غير ذلك. */
  warning?: string;
}

/**
 * يحسم صلاحية رابط يدوي قبل تسجيله:
 *   - قواعد RELATION/EXCEPTION قد تحظره صراحة (BLOCK_RESULT) فيُرفض،
 *   - دمج بين فئتين تقول مصفوفة الدمج إنهما مستقلتان يُسمح به مع تحذير
 *     (المحرر يقرر، والمحرك يقترح)، ويبقى الأثر مسجَّلا للتتبع.
 */
export function resolveLinkPolicy(
  input: LinkPolicyInput,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  ctx?: DecisionContext
): DecisionResult<LinkPolicyDecision> {
  const trace: DecisionTraceStep[] = [];
  const relationType = input.relation === 'MERGE' ? 'MERGE' : 'REFERENCE';

  const relation = resolveRelation(input.from.id, input.to.id, relationType, profile, {
    ...ctx,
    linkKind: input.kind,
    fromType: input.from.type,
    toType: input.to.type,
  });
  trace.push(...relation.trace);

  if (!relation.decision.valid) {
    return {
      decision: { allowed: false, reason: relation.decision.reason },
      appliedRules: relation.appliedRules,
      skippedRules: relation.skippedRules,
      trace,
    };
  }

  let warning: string | undefined;
  let appliedRules = relation.appliedRules;
  if (input.relation === 'MERGE' && input.fromCategory && input.toCategory && input.fromCategory !== input.toCategory) {
    const a = editorCategoryToStudioType(input.fromCategory);
    const b = editorCategoryToStudioType(input.toCategory);
    const merge = resolveMerge(a, b, profile, ctx);
    trace.push(...merge.trace);
    appliedRules = [...appliedRules, ...merge.appliedRules];
    if (!merge.decision.merge) {
      warning = `سياسة المحرك لا تدمج ${a} مع ${b} (${merge.decision.reason})؛ سُجّل الدمج قرارا يدويا.`;
      trace.push({ stage: 'OVERRIDE', message: 'المحرر تجاوز سياسة الدمج يدويا', status: 'info' });
    }
  }

  trace.push({ stage: 'LINK', message: 'الرابط مسموح', status: 'won' });
  return {
    decision: { allowed: true, reason: relation.decision.reason, warning },
    appliedRules,
    skippedRules: relation.skippedRules,
    trace,
  };
}

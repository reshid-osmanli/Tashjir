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
import {
  locusPairKey,
  type LocusVerdict,
  type ManualLocusRelation,
} from '@/lib/tashjeer/multi-difference';
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

/** قرار تنافٍ بين اختلافين في الآية. */
export interface LocusExclusionDecision {
  exclusive: boolean;
  reason: string;
  /** هل يتقاطع الموضعان في كلمة واحدة على الأقل؟ */
  sharePosition: boolean;
}

/**
 * هل الاختلافان وجهان متنافيان لموضع واحد (فلا يُضربان في المحرك) أم بُعدان
 * مستقلان يجتمعان في سطر؟
 *
 * الحسم للـ Resolver على ثلاث درجات:
 *   1) موضعان منفصلان: لا تنافي أبدا (قرار بنائي).
 *   2) الفئة نفسها في الموضع نفسه: يُحسم التنافي من سياسة الدمج/التنافي
 *      (المصفوفة + القواعد)، لا من حكم مثبّت. افتراضيا المدّان متنافيان لأن
 *      مدخل `MADD+MADD` يقول «لا دمج»، والاستوديو يملك تغييره (FR-ED-03).
 *   3) فئتان مختلفتان في الموضع نفسه: مستقلتان افتراضا (يجتمعان في سطر)، ما
 *      لم تُصرّح قاعدة مطابقة بتنافٍ صريح: إجراء PREVENT_MERGE مع
 *      params.exclusive = true. هكذا يملك الاستوديو رافعة حقيقية دون أن
 *      يخلط بين «لا تدمج في سطر واحد» و«لا تُضرب وجها».
 *
 * التصحيح اليدوي للزوج (قرار المحقق «متنافيان/مرتبطان») لا يمر من هنا بل من
 * `resolveExclusiveGroups` بخيار التجاوزات، فيبقى اقتراح السياسة ظاهرا في
 * الأثر ويُسجَّل التجاوز مرحلة MANUAL مستقلة.
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
      decision: { exclusive: false, reason: 'موضعان منفصلان', sharePosition },
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
    if (inner.decision.exclusive) {
      return {
        decision: { exclusive: true, reason: 'وجهان من فئة واحدة في موضع واحد', sharePosition },
        appliedRules: inner.appliedRules,
        skippedRules: inner.skippedRules,
        trace,
      };
    }
    return {
      decision: {
        exclusive: false,
        reason: `الفئة نفسها لكن السياسة تجمعهما: ${inner.decision.reason}`,
        sharePosition,
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
  trace.push({
    stage: 'EXCLUSION',
    message: exclusive
      ? `تنافٍ صريح بقاعدة: ${explicit.map((rule) => rule.name).join(' + ')}`
      : `فئتان مختلفتان في موضع واحد: مستقلتان (${merge.decision.merge ? 'تجتمعان في سطر' : 'كل واحدة في سطرها'})`,
    status: exclusive ? 'blocked' : 'applied',
  });

  return {
    decision: {
      exclusive,
      reason: exclusive
        ? `تنافٍ صريح: ${explicit.map((rule) => rule.name).join(' + ')}`
        : `مستقلتان: ${merge.decision.reason}`,
      sharePosition,
    },
    appliedRules: merge.appliedRules,
    skippedRules: merge.skippedRules,
    trace,
  };
}

/** خيارات تجميع التنافي: تجاوزات المحقق اليدوية على أزواج الموضع. */
export interface ExclusiveGroupsOptions {
  /**
   * قرارات يدوية («متنافيان/مرتبطان») تسبق السياسة في هذا الزوج وحده.
   * EXCLUSIVE يوحّد الزوج في مجموعة ولو قالت السياسة باستقلاله، وRELATED
   * يبقيه منفصلا ولو قالت بتنافيه. تُستخرج من روابط المستند اليدوية.
   */
  locusVerdicts?: ManualLocusRelation[];
}

/**
 * مجموعات التنافي في الآية عبر الـ Resolver: يعيد لكل اختلاف مفتاح مجموعته.
 * الاختلافات التي حكم الـ Resolver بتنافيها (في الموضع نفسه) تجتمع في مجموعة
 * واحدة (اتحاد-وجود)، والمستقلة تبقى كل واحدة بمفردها.
 *
 * البديل القديم `exclusiveGroupKeys` في loci.ts يبقى للاختبارات الهندسية،
 * لكن المحرك يمر من هنا كي لا يكون له قرار خاص (P-07).
 */
export function resolveExclusiveGroups(
  variants: Variant[],
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  options: ExclusiveGroupsOptions = {}
): { groups: Map<string, string>; decisions: Array<{ firstId: string; secondId: string; result: DecisionResult<LocusExclusionDecision> }> } {
  const parent = new Map(variants.map((variant) => [variant.id, variant.id]));
  const decisions: Array<{ firstId: string; secondId: string; result: DecisionResult<LocusExclusionDecision> }> = [];
  const manual = new Map<string, LocusVerdict>();
  for (const item of options.locusVerdicts ?? []) {
    manual.set(locusPairKey(item.firstId, item.secondId), item.verdict);
  }

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
      const result = resolveLocusExclusion(first, second, profile);
      const verdict = manual.get(locusPairKey(first.id, second.id));
      let exclusive = result.decision.exclusive;
      if (verdict) {
        exclusive = verdict === 'EXCLUSIVE';
        result.trace.push({
          stage: 'MANUAL',
          message:
            verdict === 'EXCLUSIVE'
              ? `تصحيح يدوي: متنافيان (اقتراح السياسة: ${result.decision.exclusive ? 'متنافيان' : 'مستقلان'})`
              : `تصحيح يدوي: مرتبطان (اقتراح السياسة: ${result.decision.exclusive ? 'متنافيان' : 'مستقلان'})`,
          status: 'info',
        });
        result.decision = {
          ...result.decision,
          exclusive,
          reason:
            verdict === 'EXCLUSIVE'
              ? 'تصحيح يدوي: متنافيان (قرار المحقق)'
              : 'تصحيح يدوي: مرتبطان (قرار المحقق)',
        };
      }
      decisions.push({ firstId: first.id, secondId: second.id, result });
      if (!exclusive) continue;
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

// ==================== علاقات الموضع اليدوية (FR-ED-03) ====================

/**
 * يستخرج قرارات الموضع اليدوية من روابط المستند: روابط
 * DIFFERENCE_TO_DIFFERENCE وحدها، وطرفاها RULE بمعرّفي الاختلافين، وتحمل
 * قرارا («متنافيان» أو «مرتبطان»). ما عداها يُتجاهل بصمت.
 */
export function manualLocusVerdictsFromLinks(links: TashjeerLink[]): ManualLocusRelation[] {
  const verdicts: ManualLocusRelation[] = [];
  for (const link of links) {
    if (link.kind !== 'DIFFERENCE_TO_DIFFERENCE') continue;
    if (!link.locusVerdict) continue;
    if (link.from.type !== 'RULE' || link.to.type !== 'RULE') continue;
    if (!link.from.id || !link.to.id || link.from.id === link.to.id) continue;
    verdicts.push({
      firstId: link.from.id,
      secondId: link.to.id,
      verdict: link.locusVerdict === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'RELATED',
      linkId: link.id,
    });
  }
  return verdicts;
}

/** حالة اختلاف داخل موضعه كما تُعرض شارةً في الواجهة. */
export type LocusRelationStatus = 'EXCLUSIVE' | 'RELATED' | 'INDEPENDENT';

/**
 * حالة كل اختلاف ضمن مجموعة موضعه: «متنافٍ» إن نافى واحدا من إخوته على
 * الأقل (بالسياسة أو بتصحيح يدوي)، وإلا «مرتبط» إن ارتبط يدويا بواحد منهم،
 * وإلا «مستقل». الحسم لكل زوج عبر `resolveLocusExclusion` + التجاوزات —
 * لا منطق خاص هنا (P-07).
 */
export function locusRelationStatuses(
  diffs: Variant[],
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  locusVerdicts: ManualLocusRelation[] = []
): Map<string, LocusRelationStatus> {
  const manual = new Map<string, LocusVerdict>();
  for (const item of locusVerdicts) manual.set(locusPairKey(item.firstId, item.secondId), item.verdict);

  const status = new Map<string, LocusRelationStatus>(diffs.map((diff) => [diff.id, 'INDEPENDENT']));
  for (let i = 0; i < diffs.length; i += 1) {
    for (let j = i + 1; j < diffs.length; j += 1) {
      const first = diffs[i];
      const second = diffs[j];
      if (!variantsSharePosition(first, second)) continue;
      const verdict = manual.get(locusPairKey(first.id, second.id));
      const exclusive =
        verdict !== undefined
          ? verdict === 'EXCLUSIVE'
          : resolveLocusExclusion(first, second, profile).decision.exclusive;
      if (exclusive) {
        status.set(first.id, 'EXCLUSIVE');
        status.set(second.id, 'EXCLUSIVE');
      } else if (verdict === 'RELATED') {
        if (status.get(first.id) === 'INDEPENDENT') status.set(first.id, 'RELATED');
        if (status.get(second.id) === 'INDEPENDENT') status.set(second.id, 'RELATED');
      }
    }
  }
  return status;
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
  /**
   * قرار الموضع اليدوي («متنافيان/مرتبطان») مع زوج الاختلافين الفعليين،
   * لروابط DIFFERENCE_TO_DIFFERENCE وحدها. تُحسم به المطابقة مع اقتراح
   * السياسة: الموافق يُقبَل بصمت، والمخالف يُقبَل بتحذير موثق (المحرر يقرر).
   */
  locusVerdict?: LocusVerdict;
  locusPair?: { first: Variant; second: Variant };
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
  // علاقة الموضع اليدوية تُقارَن باقتراح السياسة للزوج نفسه (لا بالمصفوفة
  // العامة): «مرتبطان» يوافق استقلال مد+فرش افتراضيا فلا تحذير، ويخالف تنافي
  // مد+مد فيُقبَل بتحذير — والعكس ل «متنافيان».
  if (input.kind === 'DIFFERENCE_TO_DIFFERENCE' && input.locusVerdict && input.locusPair) {
    const suggestion = resolveLocusExclusion(input.locusPair.first, input.locusPair.second, profile, ctx);
    trace.push(...suggestion.trace);
    appliedRules = [...appliedRules, ...suggestion.appliedRules];
    const engineExclusive = suggestion.decision.exclusive;
    const manualExclusive = input.locusVerdict === 'EXCLUSIVE';
    if (engineExclusive !== manualExclusive) {
      warning =
        `يقترح المحرك «${engineExclusive ? 'متنافيان' : 'مستقلان يجتمعان في السطر'}» (${suggestion.decision.reason})؛ ` +
        `سُجّل «${manualExclusive ? 'متنافيان' : 'مرتبطان'}» قرارا يدويا.`;
      trace.push({ stage: 'OVERRIDE', message: 'المحرر تجاوز اقتراح التنافي يدويا', status: 'info' });
    } else {
      trace.push({ stage: 'MANUAL', message: 'القرار اليدوي موافق لاقتراح السياسة', status: 'applied' });
    }
  } else if (input.relation === 'MERGE' && input.fromCategory && input.toCategory && input.fromCategory !== input.toCategory) {
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

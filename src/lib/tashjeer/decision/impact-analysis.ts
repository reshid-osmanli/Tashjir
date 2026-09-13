// تحليل الأثر ومعاينة حيّة — Impact Analysis + Live Preview (FR-ES-09.3+4)
// مشروع التشجير - نظام القراءات العشر

import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { resolveMerge } from './api';
import { DEFAULT_COMPARE_INPUTS, type CompareInput } from './profile-compare';
import { previewRuleEdit, type RuleEditPreview } from './rule-edit-preview';
import type { DecisionContext } from './policy';

export interface ImpactCounts {
  loci: number;
  differences: number;
  relations: number;
  corrections: number;
}

export interface ImpactReport {
  counts: ImpactCounts;
  warning: string;
  preview: RuleEditPreview | null;
}

/**
 * قبل تعديل قاعدة مستخدمة: عدد المواضع/الاختلافات/العلاقات/التصحيحات المتأثرة.
 * على مدخلات مرجعية (أزواج الأنواع) لأن التشغيل على 6236 آية يتم عبر Dry Run.
 */
export function analyzeRuleImpact(
  profile: EngineConfig,
  rule: EngineRule,
  inputs: CompareInput[] = DEFAULT_COMPARE_INPUTS
): ImpactReport {
  let loci = 0;
  let differences = 0;
  let relations = 0;
  for (const input of inputs) {
    const ctx: DecisionContext = { differenceType: input.differenceType, relatedType: input.relatedType, sameReader: true };
    const result = resolveMerge(input.differenceType, input.relatedType, profile, ctx);
    const used = result.appliedRules.some((item) => item.id === rule.id) || result.trace.some((step) => step.ruleId === rule.id);
    if (!used) continue;
    loci += 1;
    differences += 1;
    if (result.decision.merge) relations += 1;
  }
  const corrections = rule.testCases?.length ?? 0;
  const counts: ImpactCounts = { loci, differences, relations, corrections };
  const warning =
    loci > 0
      ? `هذه القاعدة تؤثر على: ${loci} موضعًا · ${differences} اختلافًا · ${relations} علاقة · ${corrections} تصحيحًا يدويًا`
      : 'هذه القاعدة غير مستخدمة على المدخلات المرجعية الحالية.';
  return { counts, warning, preview: null };
}

/** Before/After حيّ على زوج يعيّنه المستخدم. */
export function livePreviewMerge(
  profile: EngineConfig,
  currentRule: EngineRule,
  editedRule: EngineRule,
  a: string,
  b: string
): { before: boolean; after: boolean; preview: RuleEditPreview } {
  const before = resolveMerge(a, b, profile, { differenceType: a, relatedType: b }).decision.merge;
  const afterProfile: EngineConfig = {
    ...profile,
    rules: profile.rules.map((item) => (item.id === editedRule.id ? editedRule : item)),
  };
  const after = resolveMerge(a, b, afterProfile, { differenceType: a, relatedType: b }).decision.merge;
  return { before, after, preview: previewRuleEdit(profile, currentRule, editedRule) };
}

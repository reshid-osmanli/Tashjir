// ساحة الاختبار والتشغيل التجريبي - Testing Playground
// FR-ES-08..11: حالات الاختبار، التشغيل التجريبي، تحليل الأثر، المعاينة والمقارنة
//
// هذه الوحدة لا تعدل المستندات. هي طبقة حتمية فوق Decision/Policy كي تبقى
// المعاينات ونتائج المقارنة قابلة للتكرار ومفيدة في المراجعة العلمية.

import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { isEngineRuleActive } from '@/lib/tashjeer/model/v8';
import { evaluateGroup } from '@/lib/tashjeer/decision/conditions';
import type { Variant } from '@/types/tashjeer';

// ==================== أنواع البيانات ====================

/** مدخلات الاختبار. */
export interface TestInput {
  ayahKey: number;
  variants: Variant[];
  context?: 'WAQF' | 'WASL';
}

/** نتيجة اختبار قاعدة واحدة. */
export interface RuleTestResult {
  ruleId: string;
  ruleName: string;
  applied: boolean;
  priority: number;
  reason?: string;
  affectedVariants: string[];
}

/** تقرير التشغيل التجريبي. */
export interface DryRunReport {
  totalMatches: number;
  wouldCreate: number;
  wouldModify: number;
  wouldMerge: number;
  wouldSkip: number;
  conflicts: number;
  forbidden: number;
  details: Array<{
    ayahKey: number;
    action: 'CREATE' | 'MODIFY' | 'MERGE' | 'SKIP' | 'CONFLICT' | 'FORBIDDEN';
    description: string;
  }>;
}

/** تقرير تحليل الأثر. */
export interface ImpactAnalysisReport {
  affectedPositions: number;
  affectedDifferences: number;
  affectedRelations: number;
  affectedCorrections: number;
  warning?: string;
}

/** مقارنة قبل/بعد. */
export interface BeforeAfterComparison {
  before: Variant[];
  after: Variant[];
  added: Variant[];
  removed: Variant[];
  modified: Array<{
    before: Variant;
    after: Variant;
    changes: string[];
  }>;
}

/** مقارنة بروفايلين. */
export interface ProfileComparison {
  profileA: string;
  profileB: string;
  changed: number;
  same: number;
  improved: number;
  regressed: number;
  details: Array<{
    ayahKey: number;
    variantId: string;
    status: 'CHANGED' | 'SAME' | 'IMPROVED' | 'REGRESSED';
    description: string;
  }>;
}

type RelationReference = { fromId?: string; toId?: string };
type CorrectionReference = { targetId?: string };

// ==================== ساحة الاختبار ====================

/** يبني السياق الحتمي الذي يمر إلى منشئ الشروط. */
function contextForVariant(input: TestInput, variant?: Variant): Record<string, unknown> {
  const mode = input.context;
  return {
    ayahKey: input.ayahKey,
    context: mode,
    recitationMode: mode,
    // حقل السياق الموحّد في نموذج السياسة؛ يبقى `context` أعلاه متاحا
    // لملفات الإعداد الأقدم التي كانت تستعمل WAQF/WASL مباشرة.
    recitationContext: mode === 'WAQF' ? 'WAQF_ONLY' : mode === 'WASL' ? 'WASL_ONLY' : 'ALWAYS',
    category: variant?.category,
    differenceType: variant?.category,
    variantId: variant?.id,
    source: variant?.origin,
  };
}

/** يتحقق من أن القاعدة تنطبق على الاختلاف ضمن نطاقها المعلن. */
function matchesRuleScope(rule: EngineRule, variant: Variant): boolean {
  const scope = rule.scope ?? 'MUSHAF';
  const metadata = rule.metadata;

  if (scope === 'MUSHAF') return true;
  if (scope === 'SURAH') {
    return metadata?.surahNumber === undefined || Math.floor(variant.ayahKey / 1000) === metadata.surahNumber;
  }
  if (scope === 'AYAH') {
    return !metadata?.ayahKeys || metadata.ayahKeys.includes(variant.ayahKey);
  }
  // نطاقات الكلمة/الحرف/المدى تُحسم شروطها الحتمية، إذ إن Variant القديم
  // لا يحمل فهرس الحرف المفرد في هذه طبقة المعاينة.
  return true;
}

/** يقيم شروط قاعدة واحدة على مدخلات الاختبار دون تنفيذ كود مستخدم. */
function ruleMatchesInput(rule: EngineRule, input: TestInput, variant?: Variant): boolean {
  if (!isEngineRuleActive(rule)) return false;
  if (variant && !matchesRuleScope(rule, variant)) return false;
  return evaluateGroup(rule.conditions ?? { all: [] }, contextForVariant(input, variant));
}

/** يختبر قاعدة على مدخلات محددة. */
export function testRule(
  rule: EngineRule,
  input: TestInput,
  _profile: EngineConfig
): RuleTestResult {
  const applied = isEngineRuleActive(rule) && input.variants.some((variant) => ruleMatchesInput(rule, input, variant));
  const affectedVariants = applied
    ? input.variants.filter((variant) => ruleMatchesInput(rule, input, variant)).map((variant) => variant.id)
    : [];

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    applied,
    priority: rule.priority,
    reason: applied
      ? 'القاعدة مطابقة للشروط والنطاق'
      : rule.enabled === false || rule.status === 'DISABLED'
        ? 'القاعدة معطلة'
        : 'القاعدة غير مطابقة',
    affectedVariants,
  };
}

/** يختبر عدة قواعد على مدخلات. */
export function testMultipleRules(
  rules: EngineRule[],
  input: TestInput,
  profile: EngineConfig
): RuleTestResult[] {
  return rules.map((rule) => testRule(rule, input, profile));
}

// ==================== التشغيل التجريبي ====================

/** يترجم إجراء السياسة إلى نوع أثر التشغيل التجريبي. */
function determineRuleAction(
  rule: EngineRule
): 'CREATE' | 'MODIFY' | 'MERGE' | 'SKIP' | 'CONFLICT' | 'FORBIDDEN' {
  const action = rule.actions[0]?.type;
  switch (action) {
    case 'CREATE_DIFFERENCE':
    case 'CREATE_VARIANT':
      return 'CREATE';
    case 'MERGE':
    case 'MERGE_VARIANTS':
      return 'MERGE';
    case 'PREVENT_MERGE':
    case 'SKIP_VARIANT':
      return 'SKIP';
    case 'BLOCK_RESULT':
      return 'FORBIDDEN';
    case 'SPLIT':
      return 'CONFLICT';
    case 'OVERRIDE_RESULT':
    case 'OVERRIDE_VARIANT':
    case 'MODIFY_VARIANT':
    case 'CHANGE_ORDER':
    case 'SET_RANK':
    case 'ASSIGN_CONTEXT':
    case 'CREATE_RELATION':
    case 'REMOVE_RELATION':
    case 'APPLY_RULE':
    case 'GENERATE_CORRECTION':
    default:
      return 'MODIFY';
  }
}

/** ينفذ تشغيلًا تجريبيًا حتميًا لقاعدة على الاختلافات المتاحة. */
export function dryRunRule(
  rule: EngineRule,
  allVariants: Variant[],
  _profile: EngineConfig
): DryRunReport {
  const details: DryRunReport['details'] = [];
  let wouldCreate = 0;
  let wouldModify = 0;
  let wouldMerge = 0;
  let wouldSkip = 0;
  let conflicts = 0;
  let forbidden = 0;

  for (const variant of allVariants) {
    const input: TestInput = { ayahKey: variant.ayahKey, variants: [variant] };
    if (!ruleMatchesInput(rule, input, variant)) continue;

    const action = determineRuleAction(rule);
    details.push({ ayahKey: variant.ayahKey, action, description: `${action}: ${variant.title}` });
    if (action === 'CREATE') wouldCreate++;
    if (action === 'MODIFY') wouldModify++;
    if (action === 'MERGE') wouldMerge++;
    if (action === 'SKIP') wouldSkip++;
    if (action === 'CONFLICT') conflicts++;
    if (action === 'FORBIDDEN') forbidden++;
  }

  return {
    totalMatches: details.length,
    wouldCreate,
    wouldModify,
    wouldMerge,
    wouldSkip,
    conflicts,
    forbidden,
    details,
  };
}

// ==================== تحليل الأثر ====================

/** يحلل أثر تعديل قاعدة دون تغيير البيانات. */
export function analyzeRuleImpact(
  rule: EngineRule,
  allVariants: Variant[],
  allRelations: RelationReference[],
  allCorrections: CorrectionReference[]
): ImpactAnalysisReport {
  const affectedVariants = allVariants.filter((variant) =>
    ruleMatchesInput(rule, { ayahKey: variant.ayahKey, variants: [variant] }, variant)
  );
  const affectedIds = new Set(affectedVariants.map((variant) => variant.id));
  const affectedRelations = allRelations.filter(
    (relation) => affectedIds.has(relation.fromId ?? '') || affectedIds.has(relation.toId ?? '')
  );
  const affectedCorrections = allCorrections.filter((correction) => affectedIds.has(correction.targetId ?? ''));

  return {
    affectedPositions: affectedVariants.length,
    affectedDifferences: affectedVariants.length,
    affectedRelations: affectedRelations.length,
    affectedCorrections: affectedCorrections.length,
    warning:
      affectedCorrections.length > 0
        ? `تعديل هذه القاعدة يؤثر على ${affectedCorrections.length} تصحيح يدوي`
        : undefined,
  };
}

// ==================== المقارنة ====================

/** يقارن نتائج قبل وبعد تطبيق قاعدة. */
export function compareBeforeAfter(
  beforeVariants: Variant[],
  afterVariants: Variant[]
): BeforeAfterComparison {
  const beforeMap = new Map(beforeVariants.map((variant) => [variant.id, variant]));
  const afterMap = new Map(afterVariants.map((variant) => [variant.id, variant]));
  const added = afterVariants.filter((variant) => !beforeMap.has(variant.id));
  const removed = beforeVariants.filter((variant) => !afterMap.has(variant.id));
  const modified: BeforeAfterComparison['modified'] = [];

  for (const [id, after] of afterMap) {
    const before = beforeMap.get(id);
    if (!before) continue;
    const changes = compareVariantChanges(before, after);
    if (changes.length > 0) modified.push({ before, after, changes });
  }

  return { before: beforeVariants, after: afterVariants, added, removed, modified };
}

/** يقارن التغييرات بين نسختين من اختلاف. */
function compareVariantChanges(before: Variant, after: Variant): string[] {
  const changes: string[] = [];
  if (before.title !== after.title) changes.push(`العنوان: ${before.title} → ${after.title}`);
  if (before.category !== after.category) changes.push(`الفئة: ${before.category} → ${after.category}`);
  if (before.alternatives.length !== after.alternatives.length) {
    changes.push(`عدد الأوجه: ${before.alternatives.length} → ${after.alternatives.length}`);
  }
  return changes;
}

/** ملخص حتمي للنتيجة التي ستؤثر بها سياسة بروفايل على اختلاف. */
function profileDecisionSignature(profile: EngineConfig, variant: Variant): string {
  const rules = [...(profile.rules ?? [])]
    .filter((rule) => ruleMatchesInput(rule, { ayahKey: variant.ayahKey, variants: [variant] }, variant))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const winner = rules[0];
  if (!winner) return 'NO_POLICY_CHANGE';
  const action = winner.actions[0];
  return `${winner.id}:${action?.type ?? 'NO_ACTION'}:${JSON.stringify(action?.params ?? action?.parameters ?? {})}`;
}

/**
 * يقارن بروفايلين على المدخلات نفسها بلا عشوائية. لا نسمي تغييرا «تحسنا» أو
 * «تراجعا» من دون مرجع بشري؛ لذلك تبقى تلك الخانتان صفرا حتى يقدم الاستدعاء
 * طبقة Reference Validation مستقلة.
 */
export function compareProfiles(
  profileA: EngineConfig,
  profileB: EngineConfig,
  variants: Variant[]
): ProfileComparison {
  const details: ProfileComparison['details'] = [];
  let changed = 0;
  let same = 0;

  for (const variant of variants) {
    const before = profileDecisionSignature(profileA, variant);
    const after = profileDecisionSignature(profileB, variant);
    const status: 'CHANGED' | 'SAME' = before === after ? 'SAME' : 'CHANGED';
    if (status === 'SAME') same++;
    else changed++;
    details.push({
      ayahKey: variant.ayahKey,
      variantId: variant.id,
      status,
      description: status === 'SAME' ? `لا تغيير: ${variant.title}` : `تغير القرار: ${variant.title}`,
    });
  }

  return {
    profileA: profileA.profile,
    profileB: profileB.profile,
    changed,
    same,
    improved: 0,
    regressed: 0,
    details,
  };
}

// ==================== المعاينة الحية ====================

/** يولد معاينة حية غير محفوظة لتأثير قاعدة. */
export function generateLivePreview(
  rule: EngineRule,
  sampleVariants: Variant[],
  _profile: EngineConfig
): BeforeAfterComparison {
  const modifies = ['MODIFY_VARIANT', 'OVERRIDE_VARIANT', 'OVERRIDE_RESULT'].includes(
    rule.actions[0]?.type ?? ''
  );
  const after = sampleVariants.map((variant) =>
    modifies ? { ...variant, title: `${variant.title} (معدّل)` } : variant
  );
  return compareBeforeAfter(sampleVariants, after);
}

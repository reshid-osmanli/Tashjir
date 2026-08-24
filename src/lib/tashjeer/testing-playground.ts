// ساحة الاختبار والتشغيل التجريبي - Testing Playground
// FR-ES-09: Testing Playground + Dry Run + Impact Analysis + Live Preview

import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
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

// ==================== ساحة الاختبار ====================

/**
 * يختبر قاعدة على مدخلات محددة.
 */
export function testRule(
  rule: EngineRule,
  input: TestInput,
  profile: EngineConfig
): RuleTestResult {
  const applied = evaluateRuleConditions(rule, input);
  const affectedVariants = applied
    ? input.variants.filter((v) => matchesRuleScope(rule, v)).map((v) => v.id)
    : [];

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    applied,
    priority: rule.priority,
    reason: applied ? 'القاعدة مطابقة' : 'القاعدة غير مطابقة',
    affectedVariants,
  };
}

/**
 * يقيم شروط القاعدة.
 */
function evaluateRuleConditions(rule: EngineRule, input: TestInput): boolean {
  // تبسيط: في التطبيق الفعلي سيتم تقييم كل شرط.
  if (!rule.conditions || !rule.conditions.all) return true;

  for (const condition of rule.conditions.all) {
    if (condition.field === 'context' && condition.value !== input.context) {
      return false;
    }
  }

  return true;
}

/**
 * يتحقق من مطابقة الاختلاف لنطاق القاعدة.
 */
function matchesRuleScope(rule: EngineRule, variant: Variant): boolean {
  // تبسيط: في التطبيق الفعلي سيتم فحص النطاق بدقة.
  return true;
}

/**
 * يختبر عدة قواعد على مدخلات.
 */
export function testMultipleRules(
  rules: EngineRule[],
  input: TestInput,
  profile: EngineConfig
): RuleTestResult[] {
  return rules.map((rule) => testRule(rule, input, profile));
}

// ==================== التشغيل التجريبي ====================

/**
 * ينفذ تشغيل تجريبي لقاعدة على كل المصحف.
 */
export function dryRunRule(
  rule: EngineRule,
  allVariants: Variant[],
  profile: EngineConfig
): DryRunReport {
  const details: DryRunReport['details'] = [];
  let wouldCreate = 0;
  let wouldModify = 0;
  let wouldMerge = 0;
  let wouldSkip = 0;
  let conflicts = 0;
  let forbidden = 0;

  // تبسيط: في التطبيق الفعلي سيتم فحص كل آية.
  for (const variant of allVariants) {
    const matches = matchesRuleScope(rule, variant);

    if (matches) {
      const action = determineRuleAction(rule, variant);
      details.push({
        ayahKey: variant.ayahKey,
        action,
        description: `${action}: ${variant.title}`,
      });

      switch (action) {
        case 'CREATE':
          wouldCreate++;
          break;
        case 'MODIFY':
          wouldModify++;
          break;
        case 'MERGE':
          wouldMerge++;
          break;
        case 'SKIP':
          wouldSkip++;
          break;
        case 'CONFLICT':
          conflicts++;
          break;
        case 'FORBIDDEN':
          forbidden++;
          break;
      }
    }
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

/**
 * يحدد الإجراء الذي ستقوم به القاعدة.
 */
function determineRuleAction(
  rule: EngineRule,
  variant: Variant
): 'CREATE' | 'MODIFY' | 'MERGE' | 'SKIP' | 'CONFLICT' | 'FORBIDDEN' {
  // تبسيط: في التطبيق الفعلي سيتم فحص الإجراءات.
  if (rule.actions?.[0]?.type === 'CREATE_VARIANT') return 'CREATE';
  if (rule.actions?.[0]?.type === 'MODIFY_VARIANT') return 'MODIFY';
  if (rule.actions?.[0]?.type === 'MERGE_VARIANTS') return 'MERGE';
  return 'MODIFY';
}

// ==================== تحليل الأثر ====================

/**
 * يحلل أثر تعديل قاعدة.
 */
export function analyzeRuleImpact(
  rule: EngineRule,
  allVariants: Variant[],
  allRelations: any[],
  allCorrections: any[]
): ImpactAnalysisReport {
  const affectedVariants = allVariants.filter((v) => matchesRuleScope(rule, v));
  const affectedRelations = allRelations.filter((r) =>
    affectedVariants.some((v) => v.id === r.fromId || v.id === r.toId)
  );
  const affectedCorrections = allCorrections.filter((c) =>
    affectedVariants.some((v) => v.id === c.targetId)
  );

  const warning =
    affectedCorrections.length > 0
      ? `تعديل هذه القاعدة يؤثر على ${affectedCorrections.length} تصحيح يدوي`
      : undefined;

  return {
    affectedPositions: affectedVariants.length,
    affectedDifferences: affectedVariants.length,
    affectedRelations: affectedRelations.length,
    affectedCorrections: affectedCorrections.length,
    warning,
  };
}

// ==================== المقارنة ====================

/**
 * يقارن نتائج قبل وبعد تطبيق قاعدة.
 */
export function compareBeforeAfter(
  beforeVariants: Variant[],
  afterVariants: Variant[]
): BeforeAfterComparison {
  const beforeMap = new Map(beforeVariants.map((v) => [v.id, v]));
  const afterMap = new Map(afterVariants.map((v) => [v.id, v]));

  const added = afterVariants.filter((v) => !beforeMap.has(v.id));
  const removed = beforeVariants.filter((v) => !afterMap.has(v.id));
  const modified: BeforeAfterComparison['modified'] = [];

  for (const [id, after] of afterMap) {
    const before = beforeMap.get(id);
    if (before) {
      const changes = compareVariantChanges(before, after);
      if (changes.length > 0) {
        modified.push({ before, after, changes });
      }
    }
  }

  return { before: beforeVariants, after: afterVariants, added, removed, modified };
}

/**
 * يقارن التغييرات بين نسختين من اختلاف.
 */
function compareVariantChanges(before: Variant, after: Variant): string[] {
  const changes: string[] = [];

  if (before.title !== after.title) {
    changes.push(`العنوان: ${before.title} → ${after.title}`);
  }
  if (before.category !== after.category) {
    changes.push(`الفئة: ${before.category} → ${after.category}`);
  }
  if (before.alternatives.length !== after.alternatives.length) {
    changes.push(
      `عدد الأوجه: ${before.alternatives.length} → ${after.alternatives.length}`
    );
  }

  return changes;
}

/**
 * يقارن بروفايلين على نفس البيانات.
 */
export function compareProfiles(
  profileA: EngineConfig,
  profileB: EngineConfig,
  variants: Variant[]
): ProfileComparison {
  // تبسيط: في التطبيق الفعلي سيتم تشغيل كل بروفايل ومقارنة النتائج.
  const details: ProfileComparison['details'] = [];
  let changed = 0;
  let same = 0;
  let improved = 0;
  let regressed = 0;

  for (const variant of variants) {
    const status = Math.random() > 0.5 ? 'SAME' : 'CHANGED';
    details.push({
      ayahKey: variant.ayahKey,
      variantId: variant.id,
      status,
      description: `${status}: ${variant.title}`,
    });

    switch (status) {
      case 'CHANGED':
        changed++;
        break;
      case 'SAME':
        same++;
        break;
      case 'IMPROVED':
        improved++;
        break;
      case 'REGRESSED':
        regressed++;
        break;
    }
  }

  return {
    profileA: profileA.profile,
    profileB: profileB.profile,
    changed,
    same,
    improved,
    regressed,
    details,
  };
}

// ==================== المعاينة الحية ====================

/**
 * يولد معاينة حية لتأثير قاعدة.
 */
export function generateLivePreview(
  rule: EngineRule,
  sampleVariants: Variant[],
  profile: EngineConfig
): BeforeAfterComparison {
  const before = sampleVariants;
  const after = sampleVariants.map((v) => ({
    ...v,
    title: rule.actions?.[0]?.type === 'MODIFY_VARIANT' ? `${v.title} (معدّل)` : v.title,
  }));

  return compareBeforeAfter(before, after);
}

// حلّ القرار المركزي — Decision Resolver (FR-EN-02، FR-EN-03، FR-ES-01/05/06/10)
//
// هذا هو المكان الوحيد الذي يحسم الأولوية والتعارض والدمج. الواجهة تبني
// EngineConfig فقط؛ لا تنسخ هذه القواعد إلى مكوّناتها (P-07). كل نتيجة تحمل
// Trace قابلًا للعرض في «لماذا؟».

import type {
  ConflictPolicyStep,
  EngineConfig,
  EngineRule,
  MergeMatrixEntry,
  RelationPolicyEntry,
} from '@/lib/tashjeer/model/v8';
import { SPECIFICITY_RANK } from '@/lib/tashjeer/model/v8';
import { evaluateGroup } from './conditions';
import { DEFAULT_SYSTEM_PROFILE } from './policy';
import type { DecisionContext } from './policy';

export interface DecisionTraceStep {
  stage: string;
  ruleId?: string;
  message: string;
  status: 'applied' | 'skipped' | 'won' | 'lost' | 'blocked' | 'info';
  priority?: number;
}

export interface DecisionResult<T = unknown> {
  decision: T;
  appliedRules: EngineRule[];
  skippedRules: Array<{ rule: EngineRule; reason: string }>;
  trace: DecisionTraceStep[];
}

/**
 * ترتيب العرض التاريخي للقواعد. يبقى هذا التصدير متوافقًا مع أدوات PH0؛ أما
 * حسم «الأخص» الفعلي فيمر عبر `specificityScore` أدناه (Character أخص من
 * Mushaf) داخل Resolver نفسه.
 */
export function sortRulesByPrecedence(rules: EngineRule[]): EngineRule[] {
  return [...rules].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const sa = SPECIFICITY_RANK[a.specificity] ?? 0;
    const sb = SPECIFICITY_RANK[b.specificity] ?? 0;
    if (sa !== sb) return sb - sa;
    return a.id.localeCompare(b.id, 'ar');
  });
}

/** في سلم الخصوصية: المصحف أعم، والحرف أخص. */
function specificityScore(rule: EngineRule): number {
  return 7 - (SPECIFICITY_RANK[rule.specificity] ?? 0);
}

function groupOrder(rule: EngineRule, profile?: EngineConfig): number {
  return profile?.priorityGroups.find((group) => group.id === rule.groupId)?.order ?? Number.MAX_SAFE_INTEGER;
}

/** لا تؤثر المسودة/المعطلة في البيانات الرسمية. */
function isActive(rule: EngineRule): boolean {
  return rule.status === 'ACTIVE' || rule.status === 'EXPERIMENTAL';
}

/** يطابق القواعد الفاعلة فقط، مع إبقاء قائمة التقييم كاملة للتفسير. */
export function matchRules(
  profile: EngineConfig,
  ctx: DecisionContext
): { matched: EngineRule[]; evaluated: Array<{ rule: EngineRule; matched: boolean }> } {
  const evaluated = profile.rules.map((rule) => ({
    rule,
    matched: isActive(rule) && evaluateGroup(rule.conditions, ctx),
  }));
  const matched = sortRulesByPrecedence(evaluated.filter((item) => item.matched).map((item) => item.rule));
  return { matched, evaluated };
}

function isExplicitOverride(rule: EngineRule, target?: EngineRule): boolean {
  if (rule.actions.some((action) => action.type === 'OVERRIDE_RESULT' && action.params?.explicit === true)) return true;
  if (target && (rule.overrides ?? []).includes(target.id)) return true;
  return rule.category === 'OVERRIDE' && rule.hardness === 'HARD';
}

function actionOutcome(rule: EngineRule): boolean | undefined {
  const override = rule.actions.find((action) => action.type === 'OVERRIDE_RESULT');
  if (override) {
    const value = override.params?.result ?? override.params?.merge;
    if (value === true || value === 'MERGE' || value === 'ALLOW') return true;
    if (value === false || value === 'SEPARATE' || value === 'BLOCK') return false;
  }
  if (rule.actions.some((action) => action.type === 'BLOCK_RESULT' || action.type === 'PREVENT_MERGE')) return false;
  if (rule.actions.some((action) => action.type === 'MERGE')) return true;
  return undefined;
}

/**
 * مرحلة التنفيذ التابعة لإجراء القاعدة (FR-ES-04). منع الدمج جزء من مرحلة
 * MERGE؛ BLOCK_RESULT وحده قاعدة حجب عامة تسبقها.
 */
export function executionStageOf(rule: EngineRule): string {
  if (rule.actions.some((action) => action.type === 'BLOCK_RESULT')) return 'BLOCKING';
  if (rule.actions.some((action) => action.type === 'OVERRIDE_RESULT')) return 'EXCEPTIONS';
  if (rule.actions.some((action) => action.type === 'MERGE')) return 'MERGE';
  if (rule.category === 'ORDERING' || rule.type === 'ORDERING') return 'ORDERING';
  return rule.category;
}

function executionStageIndex(rule: EngineRule, profile: EngineConfig): number {
  const index = profile.executionOrder.indexOf(executionStageOf(rule));
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * أثر مبدئي بسيط لتبديل ترتيب التنفيذ (FR-ES-04): المراحل التي تغيّر موضعها
 * النسبي، وعدد القواعد التي إجراءاتها في تلك المراحل. يُعرض في تحذير ما
 * قبل الحفظ مع نتائج اختبارات القواعد على الترتيب الجديد.
 */
export function executionOrderImpact(
  config: EngineConfig,
  nextOrder: string[]
): { changedStages: string[]; affectedRules: EngineRule[] } {
  const oldPos = new Map(config.executionOrder.map((stage, index) => [stage, index]));
  const newPos = new Map(nextOrder.map((stage, index) => [stage, index]));
  const changedStages = nextOrder.filter(
    (stage) => oldPos.has(stage) && oldPos.get(stage) !== newPos.get(stage)
  );
  const changed = new Set(changedStages);
  const affectedRules = config.rules.filter((rule) => changed.has(executionStageOf(rule)));
  return { changedStages, affectedRules };
}

function precedenceForConflict(a: EngineRule, b: EngineRule, profile?: EngineConfig): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const sa = specificityScore(a);
  const sb = specificityScore(b);
  if (sa !== sb) return sb - sa;
  const ga = groupOrder(a, profile);
  const gb = groupOrder(b, profile);
  if (ga !== gb) return ga - gb;
  // المعرّف القديم/الأصغر هو كاسر التعادل الأخير الحتمي.
  return a.id.localeCompare(b.id, 'ar');
}

/**
 * يحسم التعارض حسب سلم السياسة. Hard لا يخسر أمام Soft إلا بقاعدة تجاوز
 * صريحة وموثقة (`OVERRIDE_RESULT` مع explicit=true أو overrides[]).
 */
export function resolveConflictPolicy(
  policy: ConflictPolicyStep[],
  candidates: EngineRule[],
  profile?: EngineConfig
): { winner?: EngineRule; reason: string } {
  const usable = candidates.filter(isActive);
  if (usable.length === 0) return { reason: 'لا مرشّحات فاعلة' };
  if (usable.length === 1) {
    const only = usable[0];
    // حتى المرشّح الوحيد يُفسَّر: تجاوز صريح موثق ليس «مصادفة» (T7/T6).
    if (isExplicitOverride(only)) return { winner: only, reason: `Explicit Override موثق (${only.name})` };
    return { winner: only, reason: 'مرشّح واحد' };
  }

  const sorted = [...usable].sort((a, b) => precedenceForConflict(a, b, profile));
  const hard = sorted.filter((rule) => rule.hardness === 'HARD');
  const explicitOverrides = sorted.filter((candidate) => hard.some((target) => candidate !== target && isExplicitOverride(candidate, target)));
  if (explicitOverrides.length > 0) {
    const winner = explicitOverrides[0];
    return { winner, reason: `Explicit Override موثق (${winner.name})` };
  }
  const protectedRules = hard;
  const pool = protectedRules.length > 0 ? protectedRules : sorted;
  if (protectedRules.length > 0) {
    const winner = protectedRules[0];
    return { winner, reason: `قاعدة صلبة محمية (${winner.name}) — لا تُتجاوز بلا Explicit Override` };
  }

  for (const step of policy) {
    if (step === 'MOST_SPECIFIC') {
      const top = Math.max(...pool.map(specificityScore));
      const matches = pool.filter((rule) => specificityScore(rule) === top);
      if (matches.length === 1) return { winner: matches[0], reason: `الأخص (${matches[0].specificity})` };
    }
    if (step === 'HIGHEST_PRIORITY') {
      const top = Math.max(...pool.map((rule) => rule.priority));
      const matches = pool.filter((rule) => rule.priority === top);
      if (matches.length === 1) return { winner: matches[0], reason: `أعلى أولوية (${matches[0].priority})` };
    }
    if (step === 'EXPLICIT') {
      const explicit = pool.filter((rule) => rule.hardness === 'HARD' || rule.category === 'EXCEPTION' || rule.category === 'OVERRIDE');
      if (explicit.length === 1) return { winner: explicit[0], reason: 'قاعدة صريحة' };
      if (explicit.length > 1) {
        const winner = [...explicit].sort((a, b) => precedenceForConflict(a, b, profile))[0];
        return { winner, reason: `قاعدة صريحة (${winner.name})` };
      }
    }
    if (step === 'LOCAL') {
      const local = pool.filter((rule) => rule.specificity !== 'MUSHAF');
      if (local.length > 0) {
        const winner = [...local].sort((a, b) => precedenceForConflict(a, b, profile))[0];
        return { winner, reason: `قاعدة محلية (${winner.specificity})` };
      }
    }
    if (step === 'READER') {
      const reader = pool.filter((rule) => rule.conditions.all?.some((item) => 'field' in item && ['readerId', 'narratorId', 'pathId'].includes(item.field)));
      if (reader.length > 0) {
        const winner = [...reader].sort((a, b) => precedenceForConflict(a, b, profile))[0];
        return { winner, reason: 'قاعدة قارئ/راوٍ/طريق' };
      }
    }
    if (step === 'MANUAL') {
      const manual = pool.find((rule) => rule.category === 'OVERRIDE' || rule.actions.some((action) => action.type === 'OVERRIDE_RESULT'));
      if (manual) return { winner: manual, reason: 'تجاوز يدوي موثق' };
    }
  }

  const winner = pool[0];
  return { winner, reason: `كاسر التعادل الحتمي: ${winner.priority} ثم المعرّف ${winner.id}` };
}

function matrixKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** يقرأ مصفوفة الدمج وحدها؛ لا يرث ترتيب JSON كقرار. */
export function resolveMergeDecision(
  a: string,
  b: string,
  profile: EngineConfig
): { merge: boolean; reason: string; priority: number; entry?: MergeMatrixEntry } {
  const entries = profile.mergeMatrix.filter((entry) => matrixKey(entry.a, entry.b) === matrixKey(a, b));
  if (entries.length === 0) return { merge: false, reason: 'لا مدخل في مصفوفة الدمج — افتراضيًا لا دمج', priority: 0 };
  const sorted = [...entries].sort(
    (x, y) => y.priority - x.priority || Number(x.merge) - Number(y.merge) || x.reason.localeCompare(y.reason, 'ar')
  );
  const entry = sorted[0];
  return {
    merge: entry.merge,
    reason: entries.length > 1 ? `${entry.reason} (الأولوية ${entry.priority})` : entry.reason,
    priority: entry.priority,
    entry,
  };
}

function traceEvaluated(trace: DecisionTraceStep[], evaluated: Array<{ rule: EngineRule; matched: boolean }>): void {
  for (const item of evaluated) {
    trace.push({
      stage: 'MATCH',
      ruleId: item.rule.id,
      message: item.matched ? `طابقت: ${item.rule.name}` : `تجاوزت: ${item.rule.name}`,
      status: item.matched ? 'applied' : 'skipped',
      priority: item.rule.priority,
    });
  }
}

/**
 * يحسم الدمج من المصفوفة والقواعد. المدخل المطلق في المصفوفة محمي من قاعدة
 * عادية؛ المدخل المشروط يسمح للقاعدة المطابقة أن تحسمه. هذا يفسر بوضوح في
 * Trace، ويمنع أن يغيّر Draft أو ترتيب JSON النتيجة.
 */
export function decideMerge(
  a: string,
  b: string,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  ctx?: DecisionContext
): DecisionResult<{ merge: boolean; reason: string; priority: number }> {
  const trace: DecisionTraceStep[] = [{ stage: 'INPUT', message: `تقييم الدمج بين ${a} و${b}`, status: 'info' }];
  const context: DecisionContext = { differenceType: a, relatedType: b, otherType: b, ...ctx };
  const { matched, evaluated } = matchRules(profile, context);
  traceEvaluated(trace, evaluated);

  const mergeRules = matched.filter((rule) => rule.category === 'MERGE' || rule.type === 'MERGE');
  const matrix = resolveMergeDecision(a, b, profile);
  let decision = matrix.merge;
  let reason = matrix.reason;
  trace.push({
    stage: 'MERGE',
    message: `مصفوفة الدمج: ${matrix.merge ? 'ادمج' : 'لا تدمج'} — ${matrix.reason}`,
    status: matrix.merge ? 'won' : 'blocked',
    priority: matrix.priority,
  });

  const actionable = mergeRules.filter((rule) => actionOutcome(rule) !== undefined);
  let decidingRules = actionable;
  if (matrix.entry && !matrix.entry.conditional) {
    // الصف المطلق هو سياسة الدمج نفسها؛ لا تنقلب بقاعدة عادية.
    decidingRules = actionable.filter((rule) => rule.actions.some((action) => action.type === 'OVERRIDE_RESULT' && action.params?.explicit === true));
    for (const rule of actionable) {
      if (!decidingRules.includes(rule)) {
        trace.push({ stage: 'CONFLICT', ruleId: rule.id, message: `تُركت النتيجة للمصفوفة المطلقة — ${rule.name}`, status: 'skipped', priority: rule.priority });
      }
    }
  }

  if (decidingRules.length > 0) {
    // ترتيب التنفيذ قابل للتهيئة: مرحلة المنع/الاستثناء قد تسبق الدمج، أو العكس.
    const earliestStage = Math.min(...decidingRules.map((rule) => executionStageIndex(rule, profile)));
    const stageRules = decidingRules.filter((rule) => executionStageIndex(rule, profile) === earliestStage);
    const { winner, reason: why } = resolveConflictPolicy(profile.conflictPolicy, stageRules, profile);
    if (winner) {
      const outcome = actionOutcome(winner);
      if (outcome !== undefined) {
        decision = outcome;
        reason = `${matrix.entry?.conditional ? 'مدخل مشروط؛ ' : ''}القاعدة «${winner.name}» — ${why}`;
        if (matrix.entry?.conditional) {
          trace.push({ stage: 'CONFLICT', ruleId: winner.id, message: reason, status: outcome ? 'won' : 'blocked', priority: winner.priority });
        }
      }
      for (const rule of decidingRules) {
        if (rule.id === winner.id) {
          trace.push({ stage: 'RULE_WON', ruleId: rule.id, message: `${rule.name} فازت: ${why}`, status: 'won', priority: rule.priority });
        } else {
          trace.push({ stage: 'RULE_SKIPPED', ruleId: rule.id, message: `${rule.name} تُركت: غلبتها القاعدة ${winner.name}`, status: 'lost', priority: rule.priority });
        }
      }
    }
  } else if (matrix.entry?.conditional) {
    trace.push({ stage: 'CONFLICT', message: 'مدخل مشروط بلا قاعدة حاسمة؛ بقيت قيمته الافتراضية', status: 'info', priority: matrix.priority });
  }

  trace.push({ stage: 'FINAL', message: `${decision ? 'ادمج' : 'لا تدمج'} — ${reason}`, status: decision ? 'won' : 'blocked' });
  const skippedRules = evaluated.filter((item) => !item.matched).map((item) => ({ rule: item.rule, reason: 'غير مطابقة أو غير فاعلة' }));
  return { decision: { merge: decision, reason, priority: matrix.priority }, appliedRules: mergeRules, skippedRules, trace };
}

/** يحل سياسة العلاقة الرسومية؛ ترتيب العنصرين غير مؤثر. */
export function resolveRelationPolicy(
  a: string,
  b: string,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): { entry?: RelationPolicyEntry; reason: string } {
  const candidates = (profile.relations ?? []).filter((entry) => matrixKey(entry.a, entry.b) === matrixKey(a, b));
  if (candidates.length === 0) return { reason: 'لا سياسة علاقة صريحة' };
  const entry = [...candidates].sort((x, y) => y.priority - x.priority || x.id.localeCompare(y.id, 'ar'))[0];
  return { entry, reason: entry.reason };
}

export function decideMutualExclusion(
  a: string,
  b: string,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ exclusive: boolean; reason: string }> {
  const relation = resolveRelationPolicy(a, b, profile);
  if (relation.entry) {
    const exclusive = relation.entry.relation === 'MUTUALLY_EXCLUSIVE' || relation.entry.relation === 'INDEPENDENT';
    return {
      decision: { exclusive, reason: relation.reason },
      appliedRules: [],
      skippedRules: [],
      trace: [{ stage: 'RELATION_POLICY', message: `${relation.entry.relation}: ${relation.reason}`, status: exclusive ? 'blocked' : 'won', priority: relation.entry.priority }],
    };
  }
  const merge = decideMerge(a, b, profile);
  const exclusive = a === b || !merge.decision.merge;
  return {
    decision: { exclusive, reason: exclusive ? 'متنافيان أو من نفس النوع' : 'مرتبطان' },
    appliedRules: merge.appliedRules,
    skippedRules: merge.skippedRules,
    trace: [...merge.trace, { stage: 'EXCLUSION', message: exclusive ? `${a} و${b} متنافيان` : `${a} و${b} غير متنافيين`, status: exclusive ? 'blocked' : 'applied' }],
  };
}

export function mergeContext(a: string, b: string, extra?: DecisionContext): DecisionContext {
  return { differenceType: a, relatedType: b, otherType: b, ...extra };
}

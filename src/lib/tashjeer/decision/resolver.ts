// حلّ القرار المركزي — Decision Resolver (FR-EN-02, FR-EN-03, FR-ES-05/06/10)
//
// مكوّن واحد يحسم كل القرارات: مطابقة القواعد، الأولوية، الخصوصية، التعارض،
// السياق (وقف/وصل)، الدمج، التنافي، الترتيب. لا تملك أي Feature تنفيذا خاصا
// لهذه القرارات (P-07). يقرأ السياسات من Profile المفعّل ويُخرج قرارات مرفقة
// بأثر قابل للتفسير (Trace) دائما (FR-ES-10، P-11).

import type {
  EngineConfig,
  EngineRule,
  MergeMatrixEntry,
  ConflictPolicyStep,
} from '@/lib/tashjeer/model/v8';
import { SPECIFICITY_RANK, isEngineRuleActive } from '@/lib/tashjeer/model/v8';
import { evaluateGroup } from './conditions';
import { DEFAULT_SYSTEM_PROFILE } from './policy';
import type { DecisionContext } from './policy';

/** خطوة في أثر القرار (لزر Why؟ وصفحة التتبع). */
export interface DecisionTraceStep {
  stage: string;
  ruleId?: string;
  message: string;
  status: 'applied' | 'skipped' | 'won' | 'lost' | 'blocked' | 'info';
  priority?: number;
}

/** نتيجة قرار موحّدة مع الأثر. */
export interface DecisionResult<T = unknown> {
  decision: T;
  appliedRules: EngineRule[];
  skippedRules: Array<{ rule: EngineRule; reason: string }>;
  trace: DecisionTraceStep[];
}

/** ترتيب القواعد المطابقة: الأولوية الأعلى، ثم الخصوصية الأعلى، ثم المعرّف. */
export function sortRulesByPrecedence(rules: EngineRule[]): EngineRule[] {
  return [...rules].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const sa = SPECIFICITY_RANK[a.specificity ?? 'MUSHFAF'] ?? 0;
    const sb = SPECIFICITY_RANK[b.specificity ?? 'MUSHFAF'] ?? 0;
    if (sa !== sb) return sb - sa;
    return a.id.localeCompare(b.id, 'ar');
  });
}

/** يُرجع القواعد المطابقة لسياق القرار، مرتبة بحسب الأسبقية. */
export function matchRules(
  profile: EngineConfig,
  ctx: DecisionContext
): { matched: EngineRule[]; evaluated: Array<{ rule: EngineRule; matched: boolean }> } {
  const evaluated = (profile.rules ?? []).map((rule) => ({
    rule,
    // لا تعمل المسودة أو القاعدة المعطلة في المحرك الحقيقي. تظل في الأثر
    // كقاعدة متجاهلة كي يكون Why؟ صادقا.
    matched: isEngineRuleActive(rule) && evaluateGroup(rule.conditions, ctx),
  }));
  const matched = sortRulesByPrecedence(evaluated.filter((item) => item.matched).map((item) => item.rule));
  return { matched, evaluated };
}

/**
 * يحسم التعارض بين قاعدتين متناقضتين (A→Merge، B→DoNotMerge) بلا اختيار
 * عشوائي أبدا: وفق سلم السياسة (FR-ES-06).
 */
export function resolveConflictPolicy(
  policy: ConflictPolicyStep[],
  candidates: EngineRule[]
): { winner?: EngineRule; reason: string } {
  if (candidates.length === 0) return { reason: 'لا مرشّحات' };
  if (candidates.length === 1) return { winner: candidates[0], reason: 'مرشّح واحد' };

  const sorted = sortRulesByPrecedence(candidates);

  for (const step of policy) {
    if (step === 'HIGHEST_PRIORITY') {
      const top = sorted[0];
      const samePriority = sorted.filter((rule) => rule.priority === top.priority);
      if (samePriority.length === 1) {
        return { winner: top, reason: `أعلى أولوية (${top.priority})` };
      }
    }
    if (step === 'MOST_SPECIFIC') {
      const topSpecificity = Math.max(...sorted.map((rule) => SPECIFICITY_RANK[rule.specificity ?? 'MUSHFAF'] ?? 0));
      const mostSpecific = sorted.filter(
        (rule) => (SPECIFICITY_RANK[rule.specificity ?? 'MUSHFAF'] ?? 0) === topSpecificity
      );
      if (mostSpecific.length === 1) {
        return { winner: mostSpecific[0], reason: `الأخص (${mostSpecific[0].specificity})` };
      }
    }
    if (step === 'EXPLICIT' || step === 'LOCAL') {
      // القاعدة الحرفية/المحلية تغلب عند وجودها.
      const explicit = sorted.find((rule) => rule.hardness === 'HARD');
      if (explicit) return { winner: explicit, reason: 'قاعدة صلبة صريحة' };
    }
  }

  // لم يحسم السلم: المرجّح الأول (الأعلى أولوية) يفوز، مع توثيق السبب.
  return { winner: sorted[0], reason: 'لم يحسم السلم — المرجّح الأول' };
}

/** يبني مفتاح بحث في مصفوفة الدمج (غير حسّاس لترتيب العنصرين). */
function matrixKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/**
 * يحسم قرار الدمج بين عنصرين انطلاقا من مصفوفة الدمج (FR-ES-05).
 * يرجع القرار + السبب + الأولوية، مع تطبيق سياسة التعارض عند تضارب المدخلات.
 */
export function resolveMergeDecision(
  a: string,
  b: string,
  profile: EngineConfig,
  options?: { conditionalContext?: 'WAQF_ONLY' | 'WASL_ONLY' }
): { merge: boolean; reason: string; priority: number; entry?: MergeMatrixEntry } {
  const key = matrixKey(a, b);
  const entries = (profile.mergeMatrix ?? []).filter((entry) => {
    if (matrixKey(entry.a, entry.b) !== key) return false;
    // المدخل المشروط لا يصلح خارج سياق الوقف/الوصل المعلن. ملفات أقدم لا
    // تحمل سياقا تبقى متوافقة: conditional وحده يعني أن المستدعي يحدده.
    if (entry.conditional && !options?.conditionalContext) return false;
    return true;
  });

  if (entries.length === 0) {
    return { merge: false, reason: 'لا مدخل في مصفوفة الدمج — افتراضيًا لا دمج', priority: 0 };
  }

  if (entries.length === 1) {
    const entry = entries[0];
    return { merge: entry.merge, reason: entry.reason, priority: entry.priority, entry };
  }

  // تضارب مدخلات: نطبّق سياسة التعارض على القواعد المماثلة.
  const candidates = entries.map((entry) => ({
    id: `matrix:${entry.a}:${entry.b}:${entry.reason}`,
    name: entry.reason,
    type: 'MERGE' as const,
    category: 'MERGE' as const,
    scope: 'MUSHAF' as const,
    conditions: { all: [] },
    actions: [],
    priority: entry.priority,
    groupId: 'merge',
    specificity: 'MUSHFAF' as const,
    hardness: (entry.merge ? 'SOFT' : 'HARD') as 'SOFT' | 'HARD',
    status: 'ACTIVE' as const,
    version: 1,
    createdAt: 'matrix',
    updatedAt: 'matrix',
  }));
  const { winner } = resolveConflictPolicy(profile.conflictPolicy ?? [], candidates as unknown as EngineRule[]);
  const chosen = entries.find((entry) => entry.priority === winner?.priority) ?? entries[0];
  return { merge: chosen.merge, reason: chosen.reason, priority: chosen.priority, entry: chosen };
}

// ==================== قرارات المستوى الأعلى ====================

/** حلّ دمج مركزي مع أثر كامل (يُستعمل من واجهة القرار). */
export function decideMerge(
  a: string,
  b: string,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  ctx?: DecisionContext
): DecisionResult<{ merge: boolean; reason: string; priority: number }> {
  const trace: DecisionTraceStep[] = [];
  trace.push({ stage: 'INPUT', message: `تقييم الدمج بين ${a} و${b}`, status: 'info' });

  // قواعد الدمج المطابقة من ملف المحرك. العلاقة بين العنصرين غير موجهة،
  // لذلك نختبر الاتجاهين؛ لا يختلف الحكم بمجرد أن يبدّل المستعمل A وB.
  const context: DecisionContext = { differenceType: a, relatedType: b, otherType: b, ...ctx };
  const reverseContext: DecisionContext = { differenceType: b, relatedType: a, otherType: a, ...ctx };
  const forward = matchRules(profile, context);
  const reverse = matchRules(profile, reverseContext);
  const matchedById = new Map<string, EngineRule>();
  for (const rule of [...forward.matched, ...reverse.matched]) matchedById.set(rule.id, rule);
  const matched = sortRulesByPrecedence([...matchedById.values()]);
  const evaluated = forward.evaluated.map((item) => ({
    ...item,
    matched: matchedById.has(item.rule.id),
  }));
  const mergeRules = matched.filter((rule) => rule.category === 'MERGE' || rule.type === 'MERGE');

  for (const item of evaluated) {
    if (!item.matched) {
      trace.push({ stage: 'MATCH', ruleId: item.rule.id, message: `لم تُطابق: ${item.rule.name}`, status: 'skipped' });
    }
  }
  for (const rule of mergeRules) {
    trace.push({ stage: 'MATCH', ruleId: rule.id, message: `طابقت: ${rule.name}`, status: 'applied', priority: rule.priority });
  }

  // مصفوفة الدمج هي نقطة البدء، ثم قواعد Engine Studio المطابقة هي
  // التجاوزات القابلة للتفسير عليها.
  const conditionalContext = ctx?.context === 'WAQF_ONLY' || ctx?.context === 'WASL_ONLY' ? ctx.context : undefined;
  const matrix = resolveMergeDecision(a, b, profile, { conditionalContext });
  trace.push({
    stage: 'MERGE',
    message: `مصفوفة الدمج: ${matrix.merge ? 'ادمج' : 'لا تدمج'} — ${matrix.reason}`,
    status: 'info',
    priority: matrix.priority,
  });

  const decisionRules = mergeRules.filter((rule) =>
    rule.actions.some((action) => action.type === 'PREVENT_MERGE' || action.type === 'MERGE')
  );
  let decision = matrix.merge;
  let reason = matrix.reason;
  let priority = matrix.priority;

  if (decisionRules.length > 0) {
    const { winner, reason: why } = resolveConflictPolicy(profile.conflictPolicy ?? [], decisionRules);
    const blocks = winner?.actions.some((action) => action.type === 'PREVENT_MERGE') ?? false;
    const allows = winner?.actions.some((action) => action.type === 'MERGE') ?? false;
    if (blocks || allows) {
      decision = !blocks;
      priority = winner?.priority ?? priority;
      reason = blocks
        ? `منع الدمج بقاعدة «${winner?.name}»: ${why}`
        : `سماح الدمج بقاعدة «${winner?.name}»: ${why}`;
      trace.push({
        stage: decisionRules.length > 1 ? 'CONFLICT' : 'RULE_OVERRIDE',
        ruleId: winner?.id,
        message: reason,
        status: decision ? 'won' : 'blocked',
        priority,
      });
    }
  }

  trace.push({
    stage: 'FINAL',
    message: decision ? 'النتيجة النهائية: ادمج' : 'النتيجة النهائية: لا تدمج',
    status: decision ? 'won' : 'blocked',
    priority,
  });

  return {
    decision: { merge: decision, reason, priority },
    appliedRules: mergeRules,
    skippedRules: evaluated.filter((item) => !item.matched).map((item) => ({ rule: item.rule, reason: 'غير مطابقة' })),
    trace,
  };
}

/** يحدّد ما إذا كان اختلافان متنافيين (لا يُضربان وجها) — FR-ED-03/DM-09. */
export function decideMutualExclusion(
  a: string,
  b: string,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ exclusive: boolean; reason: string }> {
  const trace: DecisionTraceStep[] = [];
  const { merge } = decideMerge(a, b, profile).decision;
  const exclusive = a === b || !merge;
  trace.push({
    stage: 'EXCLUSION',
    message: exclusive ? `${a} و${b} متنافيان (لا يُضربان)` : `${a} و${b} غير متنافيين`,
    status: exclusive ? 'blocked' : 'applied',
  });
  return {
    decision: { exclusive, reason: exclusive ? 'متنافيان أو من نفس النوع' : 'مرتبطان' },
    appliedRules: [],
    skippedRules: [],
    trace,
  };
}

/** يبني سياق قرار من أنواع العناصر المراد دمجها. */
export function mergeContext(a: string, b: string, extra?: DecisionContext): DecisionContext {
  return { differenceType: a, relatedType: b, otherType: b, ...extra };
}

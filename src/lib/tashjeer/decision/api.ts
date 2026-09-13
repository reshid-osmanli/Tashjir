// واجهة القرار الموحّدة — Decision API (FR-EN-03)
//
// واجهات موحّدة تستعملها كل المكوّنات (المحرر، /quran، التتبع، الاستوديو،
// الاختبارات). كل استدعاء يعيد: النتيجة + القواعد المطابقة والفائزة
// والمتجاهلة وأسبابها (لصالح Why؟/Trace). لا تنفّذ أي Feature قرارا خاصا
// (P-07) — كل شيء يمر هنا.

import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { DEFAULT_SYSTEM_PROFILE } from './policy';
import type { DecisionContext } from './policy';
import {
  decideMerge,
  decideMutualExclusion,
  matchRules,
  resolveConflictPolicy,
  type DecisionResult,
} from './resolver';

// ==================== الدمج ====================

/** يحسم دمج عنصرين (FR-ES-05). */
export function resolveMerge(
  a: string,
  b: string,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  ctx?: DecisionContext
): DecisionResult<{ merge: boolean; reason: string; priority: number }> {
  return decideMerge(a, b, profile, ctx);
}

// ==================== التنافي ====================

/** يحسم تنافي وجهين (لا يُضربان إن كانا متنافيين). */
export function resolveRelationExclusion(
  a: string,
  b: string,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ exclusive: boolean; reason: string }> {
  return decideMutualExclusion(a, b, profile);
}

// ==================== الاختلاف ====================

/** يحسم إن كان الموضع يستوجب إنشاء اختلاف (FR-ES-02/03). */
export function resolveDifference(
  ctx: DecisionContext,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ create: boolean; reason: string }> {
  const trace: DecisionResult<{ create: boolean; reason: string }>['trace'] = [];
  const { matched, evaluated } = matchRules(profile, ctx);
  const differenceRules = matched.filter((rule) => rule.category === 'DIFFERENCE' || rule.type === 'DIFFERENCE');

  for (const item of evaluated) {
    trace.push({
      stage: 'MATCH',
      ruleId: item.rule.id,
      message: item.matched ? `طابقت: ${item.rule.name}` : `لم تطابق: ${item.rule.name}`,
      status: item.matched ? 'applied' : 'skipped',
      priority: item.rule.priority,
    });
  }

  const actionable = differenceRules.filter((rule) =>
    rule.actions.some((action) => ['CREATE_DIFFERENCE', 'BLOCK_RESULT', 'OVERRIDE_RESULT'].includes(action.type))
  );
  const outcome = (rule: (typeof differenceRules)[number]): boolean | undefined => {
    const override = rule.actions.find((action) => action.type === 'OVERRIDE_RESULT');
    const value = override?.params?.result;
    if (value === true || value === 'CREATE' || value === 'ALLOW') return true;
    if (value === false || value === 'BLOCK' || value === 'SKIP') return false;
    if (rule.actions.some((action) => action.type === 'BLOCK_RESULT')) return false;
    if (rule.actions.some((action) => action.type === 'CREATE_DIFFERENCE')) return true;
    return undefined;
  };
  const candidates = actionable.filter((rule) => outcome(rule) !== undefined);
  const winner = candidates.length > 0 ? resolveConflictPolicy(profile.conflictPolicy, candidates, profile).winner : undefined;
  const create = winner ? outcome(winner) === true : differenceRules.length > 0;
  if (winner) {
    trace.push({ stage: 'DIFFERENCE', ruleId: winner.id, message: `القاعدة الفائزة: ${winner.name}`, status: create ? 'won' : 'blocked', priority: winner.priority });
    for (const rule of candidates.filter((item) => item.id !== winner.id)) {
      trace.push({ stage: 'RULE_SKIPPED', ruleId: rule.id, message: `تجاوزتها القاعدة ${winner.name}`, status: 'lost', priority: rule.priority });
    }
  } else {
    trace.push({ stage: 'DIFFERENCE', message: create ? `يُنشأ اختلاف (${differenceRules.length} قاعدة)` : 'لا قاعدة تستوجب اختلافا', status: create ? 'won' : 'info' });
  }

  return {
    decision: { create, reason: winner?.name ?? (create ? differenceRules.map((rule) => rule.name).join(' + ') : 'لا مطابقة') },
    appliedRules: differenceRules,
    skippedRules: evaluated.filter((item) => !item.matched).map((item) => ({ rule: item.rule, reason: 'غير مطابقة أو غير فاعلة' })),
    trace,
  };
}

// ==================== الوجه ====================

/** يحسم أي وجه يفوز في موضع (بالقوة ثم بالسياسات). */
export function resolveVariant(
  candidates: Array<{ id: string; strengthRank?: number }>,
  ctx: DecisionContext,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ winnerId?: string; orderedIds: string[] }> {
  const trace: DecisionResult<{ winnerId?: string; orderedIds: string[] }>['trace'] = [];
  const { matched } = matchRules(profile, { ...ctx, category: 'VARIANT' });
  for (const rule of matched) {
    trace.push({ stage: 'MATCH', ruleId: rule.id, message: `قاعدة وجه طابقت: ${rule.name}`, status: 'applied', priority: rule.priority });
  }

  const ordered = [...candidates].sort((x, y) => (x.strengthRank ?? 999) - (y.strengthRank ?? 999));
  trace.push({ stage: 'VARIANT', message: `الفائز بالقوة: ${ordered[0]?.id ?? 'لا شيء'}`, status: ordered[0] ? 'won' : 'info' });

  return {
    decision: { winnerId: ordered[0]?.id, orderedIds: ordered.map((item) => item.id) },
    appliedRules: matched.filter((rule) => rule.category === 'VARIANT'),
    skippedRules: [],
    trace,
  };
}

// ==================== الترتيب ====================

/** يحسم ترتيب عناصر بمراعاة الرتبة الصريحة ثم سياسات ORDERING (DM-04، FR-ES-01). */
export interface OrderableItem {
  id: string;
  explicitOrder?: number;
}

export function resolveOrder(
  items: OrderableItem[],
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  ctx?: DecisionContext
): DecisionResult<{ orderedIds: string[] }> {
  const trace: DecisionResult<{ orderedIds: string[] }>['trace'] = [];
  const { matched } = matchRules(profile, { ...ctx, category: 'ORDERING' });
  trace.push({ stage: 'ORDERING', message: `${matched.length} قاعدة ترتيب مطابقة`, status: 'info' });

  const ordered = [...items].sort((a, b) => {
    const ra = a.explicitOrder ?? Number.MAX_SAFE_INTEGER;
    const rb = b.explicitOrder ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.id.localeCompare(b.id, 'ar');
  });
  trace.push({ stage: 'ORDER', message: `الترتيب: ${ordered.map((item) => item.id).join(' ← ')}`, status: 'won' });

  return {
    decision: { orderedIds: ordered.map((item) => item.id) },
    appliedRules: matched.filter((rule) => rule.category === 'ORDERING'),
    skippedRules: [],
    trace,
  };
}

// ==================== العلاقة ====================

export type RelationValidation = { valid: boolean; reason: string };

/** يتحقق من صحة علاقة بين كيانين وفق قواعد RELATION/EXCEPTION. */
export function resolveRelation(
  fromId: string,
  toId: string,
  type: string,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE,
  ctx?: DecisionContext
): DecisionResult<RelationValidation> {
  const trace: DecisionResult<RelationValidation>['trace'] = [];
  const { matched, evaluated } = matchRules(profile, { ...ctx, relationType: type });
  for (const item of evaluated) {
    trace.push({
      stage: 'MATCH',
      ruleId: item.rule.id,
      message: item.matched ? `طابقت: ${item.rule.name}` : `لم تطابق: ${item.rule.name}`,
      status: item.matched ? 'applied' : 'skipped',
      priority: item.rule.priority,
    });
  }
  const blocking = matched.filter((rule) => rule.actions.some((action) => action.type === 'BLOCK_RESULT'));
  const valid = blocking.length === 0;
  trace.push({ stage: 'RELATION', message: valid ? 'العلاقة صحيحة' : 'العلاقة محظورة بقاعدة', status: valid ? 'won' : 'blocked' });

  return {
    decision: { valid, reason: valid ? 'لا قاعدة تمنع' : blocking.map((rule) => rule.name).join(' + ') },
    appliedRules: matched,
    skippedRules: [],
    trace,
  };
}

// ==================== الوصل/ممنوع الوصل ====================

/** يتحقق من السماح بالوصل بين حدّين (FR-ED-11، DM-07، FR-ES-16). */
export function resolveConnection(
  forbidden: boolean,
  _profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ allowed: boolean; reason: string }> {
  const trace: DecisionResult<{ allowed: boolean; reason: string }>['trace'] = [];
  if (forbidden) {
    trace.push({ stage: 'CONNECTION', message: 'علامة ممنوع الوصل present — الوصل مرفوض', status: 'blocked' });
    return {
      decision: { allowed: false, reason: 'الوصل ممنوع في هذا الموضع' },
      appliedRules: [],
      skippedRules: [],
      trace,
    };
  }
  trace.push({ stage: 'CONNECTION', message: 'لا مانع — الوصل مسموح', status: 'won' });
  return {
    decision: { allowed: true, reason: 'لا علامة ممنوع وصل' },
    appliedRules: [],
    skippedRules: [],
    trace,
  };
}

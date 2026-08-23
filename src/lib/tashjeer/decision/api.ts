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

  const create = differenceRules.length > 0;
  trace.push({
    stage: 'DIFFERENCE',
    message: create ? `يُنشأ اختلاف (${differenceRules.length} قاعدة)` : 'لا قاعدة تستوجب اختلافا',
    status: create ? 'won' : 'info',
  });

  return {
    decision: { create, reason: create ? differenceRules.map((rule) => rule.name).join(' + ') : 'لا مطابقة' },
    appliedRules: differenceRules,
    skippedRules: evaluated.filter((item) => !item.matched).map((item) => ({ rule: item.rule, reason: 'غير مطابقة' })),
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
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ allowed: boolean; reason: string }> {
  const trace: DecisionResult<{ allowed: boolean; reason: string }>['trace'] = [];
  const { matched, evaluated } = matchRules(profile, {
    connection: 'WASL',
    forbiddenConnection: forbidden,
    context: 'WASL_ONLY',
  });
  const policyBlocks = matched.filter((rule) =>
    rule.actions.some((action) => action.type === 'BLOCK_RESULT' || action.type === 'PREVENT_MERGE')
  );
  const allowed = !forbidden && policyBlocks.length === 0;
  const reason = forbidden
    ? 'الوصل ممنوع في هذا الموضع بعلامة صلبة'
    : policyBlocks.length > 0
      ? `الوصل محظور بقاعدة: ${policyBlocks.map((rule) => rule.name).join(' + ')}`
      : 'لا علامة ممنوع وصل ولا قاعدة مانعة';

  for (const item of evaluated) {
    trace.push({
      stage: 'MATCH', ruleId: item.rule.id,
      message: item.matched ? `طابقت: ${item.rule.name}` : `لم تطابق: ${item.rule.name}`,
      status: item.matched ? 'applied' : 'skipped', priority: item.rule.priority,
    });
  }
  trace.push({ stage: 'CONNECTION', message: reason, status: allowed ? 'won' : 'blocked' });
  return {
    decision: { allowed, reason },
    appliedRules: policyBlocks,
    skippedRules: evaluated.filter((item) => !item.matched).map((item) => ({ rule: item.rule, reason: 'غير مطابقة أو غير نشطة' })),
    trace,
  };
}

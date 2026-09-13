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

/** طلب وصل بين حدّين (FR-ED-11.3، DM-07، FR-ES-16). */
export interface ConnectionRequest {
  /** علامة المنع عند الحدّ، أو null. مرجعها (معرّفها وملاحظتها) يظهر في الرفض. */
  forbiddenMark?: { id: string; note?: string } | null;
  /** بديل مباشر: هل الوصل ممنوع؟ (يُستعمل عند غياب مرجع العلامة). */
  forbidden?: boolean;
  /** وصف الموضع للرسائل، مثل: «نهاية الآية (بعد الكلمة ٤)». */
  label?: string;
  /** حقول سياق إضافية لتقييم قواعد الاستوديو. */
  context?: DecisionContext;
}

/**
 * يتحقق من السماح بالوصل بين حدّين (FR-ED-11، DM-07، FR-ES-16).
 *
 * المنع قيدٌ صلب (Hard): علامة «ممنوع الوصل» ترفض العملية دائمًا ولا تُتجاوز
 * إلا بحذف العلامة نفسها. ثم تُقيَّم قواعد الاستوديو المفعّلة (ACTIVE):
 * قاعدة مطابقة بإجراء حجب (BLOCK_RESULT) ترفض الوصل باسمها — وهذا هو قالب
 * «IF Connection=FORBIDDEN THEN Block» من الحزمة 02. ما عداه مسموح.
 *
 * الصيغة القديمة `resolveConnection(forbidden, profile)` تبقى عاملة حرفيًا.
 */
export function resolveConnection(
  forbidden: boolean,
  profile?: EngineConfig
): DecisionResult<{ allowed: boolean; reason: string }>;
export function resolveConnection(
  request: ConnectionRequest,
  profile?: EngineConfig
): DecisionResult<{ allowed: boolean; reason: string }>;
export function resolveConnection(
  forbiddenOrRequest: boolean | ConnectionRequest,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ allowed: boolean; reason: string }> {
  const trace: DecisionResult<{ allowed: boolean; reason: string }>['trace'] = [];
  const request: ConnectionRequest =
    typeof forbiddenOrRequest === 'boolean' ? { forbidden: forbiddenOrRequest } : forbiddenOrRequest;
  const mark = request.forbiddenMark ?? null;
  const forbidden = mark !== null || request.forbidden === true;
  const where = request.label ? ` — ${request.label}` : '';

  if (forbidden) {
    const ref = mark ? ` (العلامة ${mark.id}${mark.note ? ` — ${mark.note}` : ''})` : '';
    trace.push({
      stage: 'CONNECTION',
      message: `علامة ممنوع الوصل حاضرة — الوصل مرفوض${where}${ref}`,
      status: 'blocked',
    });
    return {
      decision: { allowed: false, reason: `الوصل ممنوع في هذا الموضع${where}${ref}` },
      appliedRules: [],
      skippedRules: [],
      trace,
    };
  }

  // قواعد الاستوديو المفعّلة قد تحجب الوصل (قالب ممنوع الوصل).
  const ctx: DecisionContext = { forbiddenWasl: false, connection: 'ALLOWED', ...request.context };
  const { matched, evaluated } = matchRules(profile, ctx);
  const blocking = matched.filter(
    (rule) => rule.status === 'ACTIVE' && rule.actions.some((action) => action.type === 'BLOCK_RESULT')
  );
  for (const item of evaluated) {
    if (item.matched) {
      trace.push({
        stage: 'MATCH',
        ruleId: item.rule.id,
        message: `طابقت: ${item.rule.name}`,
        status: 'applied',
        priority: item.rule.priority,
      });
    }
  }
  if (blocking.length > 0) {
    const names = blocking.map((rule) => rule.name).join(' + ');
    trace.push({ stage: 'CONNECTION', message: `حجبته قاعدة مفعّلة: ${names}`, status: 'blocked' });
    return {
      decision: { allowed: false, reason: `حجب الوصل بقاعدة: ${names}` },
      appliedRules: blocking,
      skippedRules: evaluated
        .filter((item) => !item.matched)
        .map((item) => ({ rule: item.rule, reason: 'غير مطابقة' })),
      trace,
    };
  }

  trace.push({ stage: 'CONNECTION', message: `لا مانع — الوصل مسموح${where}`, status: 'won' });
  return {
    decision: { allowed: true, reason: 'لا علامة ممنوع وصل ولا قاعدة حاجبة' },
    appliedRules: matched.filter((rule) => rule.status === 'ACTIVE'),
    skippedRules: evaluated
      .filter((item) => !item.matched)
      .map((item) => ({ rule: item.rule, reason: 'غير مطابقة' })),
    trace,
  };
}

// ==================== سياق الاختلاف (وقفًا فقط/وصلًا فقط) ====================

/** طلب تقييم ظهور اختلاف مشروط في وضع أداء (FR-ED-11.1/11.2). */
export interface DifferenceContextRequest {
  /** سياق الاختلاف المثبت: دائمًا، وقفًا فقط، وصلًا فقط. */
  context: 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY';
  /** وضع الأداء الفعلي عند موضع الاختلاف. */
  mode: 'WAQF' | 'WASL';
  /** هل عند الموضع منع وصل صلب؟ */
  forbidden?: boolean;
  /** الموضع (بعد الكلمة N) للأثر والرسائل. */
  position?: number;
  /** حقول سياق إضافية لتقييم قواعد الاستوديو. */
  extra?: DecisionContext;
}

/**
 * يحسم ظهور اختلاف مشروط في سياق أداء: يطابق السياقُ الوضعَ أولًا
 * (وقفًا فقط ← وقف، وصلًا فقط ← وصل)، ثم تُقيَّم قواعد الاستوديو المفعّلة:
 * قاعدة حجب مطابقة (كقالب «ممنوع الوصل: احجب») تُسقط الاختلاف من العرض
 * مع ذكر اسمها في الأثر — والكيان نفسه لا يُحذف أبدًا.
 */
export function resolveDifferenceContext(
  request: DifferenceContextRequest,
  profile: EngineConfig = DEFAULT_SYSTEM_PROFILE
): DecisionResult<{ active: boolean; reason: string }> {
  const trace: DecisionResult<{ active: boolean; reason: string }>['trace'] = [];
  const { context, mode } = request;
  const where = typeof request.position === 'number' ? ` عند الموضع ${request.position}` : '';

  if (context !== 'ALWAYS') {
    const matches = mode === 'WAQF' ? context === 'WAQF_ONLY' : context === 'WASL_ONLY';
    trace.push({
      stage: 'CONTEXT',
      message:
        context === 'WAQF_ONLY'
          ? `السياق «وقفًا فقط» والوضع «${mode === 'WAQF' ? 'وقف' : 'وصل'}»${where}`
          : `السياق «وصلًا فقط» والوضع «${mode === 'WAQF' ? 'وقف' : 'وصل'}»${where}`,
      status: matches ? 'applied' : 'skipped',
    });
    if (!matches) {
      return {
        decision: {
          active: false,
          reason: mode === 'WAQF' ? 'يسقط بالوقف (وصلًا فقط)' : 'يسقط بالوصل (وقفًا فقط)',
        },
        appliedRules: [],
        skippedRules: [],
        trace,
      };
    }
  } else {
    trace.push({ stage: 'CONTEXT', message: `السياق «دائمًا» — ظاهر في الوقف والوصل${where}`, status: 'applied' });
  }

  const ctx: DecisionContext = {
    context,
    connection: mode,
    forbiddenWasl: request.forbidden === true,
    position: request.position !== undefined ? String(request.position) : undefined,
    ...request.extra,
  };
  const { matched, evaluated } = matchRules(profile, ctx);
  const blocking = matched.filter(
    (rule) => rule.status === 'ACTIVE' && rule.actions.some((action) => action.type === 'BLOCK_RESULT')
  );
  for (const rule of matched) {
    trace.push({
      stage: 'MATCH',
      ruleId: rule.id,
      message: `طابقت: ${rule.name}`,
      status: 'applied',
      priority: rule.priority,
    });
  }
  if (blocking.length > 0) {
    const names = blocking.map((rule) => rule.name).join(' + ');
    trace.push({ stage: 'CONTEXT', message: `أسقطته قاعدة مفعّلة: ${names}`, status: 'blocked' });
    return {
      decision: { active: false, reason: `أسقطه حجب بقاعدة: ${names}` },
      appliedRules: blocking,
      skippedRules: [],
      trace,
    };
  }

  trace.push({ stage: 'CONTEXT', message: 'الاختلاف ظاهر في هذا السياق', status: 'won' });
  return {
    decision: { active: true, reason: 'السياق يطابق الوضع ولا حجب' },
    appliedRules: matched.filter((rule) => rule.status === 'ACTIVE'),
    skippedRules: evaluated
      .filter((item) => !item.matched)
      .map((item) => ({ rule: item.rule, reason: 'غير مطابقة' })),
    trace,
  };
}

// مُقيِّم الشروط — Condition Evaluator (FR-ES-03)
//
// تقييم شجرة شروط بلا أي تنفيذ كود: كل شيء بيانات (field/op/value) تُقيَّم
// مقابل سياق القرار. يدعم AND/OR/NOT بتداخل مجموعات، ومعاملات equals/
// not-equals/in/not-in/matches-pattern/exists. لا يسمح بتعبيرات دالة (P-08).

import type { ConditionGroup, RuleCondition } from '@/lib/tashjeer/model/v8';

/** يقرأ حقلا من السياق عبر مسار نقطي (مثل 'scope.kind'). */
export function readField(ctx: Record<string, unknown>, field: string): unknown {
  if (field in ctx) return ctx[field];
  if (field.includes('.')) {
    return field.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, ctx);
  }
  return undefined;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

/** يقيم شرطا واحدا مقابل السياق. */
export function evaluateCondition(cond: RuleCondition, ctx: Record<string, unknown>): boolean {
  const actual = readField(ctx, cond.field);

  switch (cond.op) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'equals':
      return deepEqual(actual, cond.value);
    case 'not-equals':
      return !deepEqual(actual, cond.value);
    case 'in':
      return asArray(cond.value).some((item) => deepEqual(actual, item));
    case 'not-in':
      return !asArray(cond.value).some((item) => deepEqual(actual, item));
    case 'matches-pattern': {
      if (typeof cond.value !== 'string' || typeof actual !== 'string') return false;
      // نمط حرفي بسيط: * تطابق أي سلسلة فرعية، وإلا مطابقة كاملة.
      const pattern = cond.value.trim();
      if (pattern === '*') return actual.length > 0;
      if (pattern.startsWith('*') && pattern.endsWith('*')) {
        return actual.includes(pattern.slice(1, -1));
      }
      return actual === pattern;
    }
    default:
      return false;
  }
}

/** يقيم مجموعة شروط (all/any/not) بتداخل عودي. */
export function evaluateGroup(group: ConditionGroup, ctx: Record<string, unknown>): boolean {
  if (group.all && group.all.length > 0) {
    if (!group.all.every((item) => evaluateItem(item, ctx))) return false;
  }
  if (group.any && group.any.length > 0) {
    if (!group.any.some((item) => evaluateItem(item, ctx))) return false;
  }
  if (group.not && group.not.length > 0) {
    if (group.not.some((item) => evaluateItem(item, ctx))) return false;
  }
  return true;
}

function evaluateItem(item: RuleCondition | ConditionGroup, ctx: Record<string, unknown>): boolean {
  if ('field' in item && 'op' in item) return evaluateCondition(item, ctx);
  return evaluateGroup(item as ConditionGroup, ctx);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

// مشغّل اختبارات القواعد — Rule Test Runner (FR-ES-08)
// مشروع التشجير - نظام القراءات العشر
//
// لكل قاعدة يمكن إرفاق حالات اختبار (TestCase): { input → expected }. هذا
// المشغّل يُجريها على واجهة القرار الموحّدة (Decision API) فيُقرّر نجاحها أو
// فشلها، ويكشف الانحدار: تغيّر قاعدة فانقلبت نتيجة مرجعية. طبقة نقيّة بلا DOM
// قابلة للاختبار بمعزل عن الواجهة، وتُشغَّل في CI/Vitest.

import type { EngineConfig, EngineRule, TestCase } from '@/lib/tashjeer/model/v8';
import { evaluateGroup } from './conditions';
import { resolveMerge, resolveDifference, resolveRelationExclusion, resolveConnection } from './api';
import type { DecisionContext } from './policy';

/** الحكم الموحّد للنتيجة لتسهيل المقارنة مع `expected`. */
export type TestVerdict =
  | 'MERGE'
  | 'SEPARATE'
  | 'CREATE'
  | 'SKIP'
  | 'ALLOW'
  | 'BLOCK'
  | 'NOT_APPLIED';

/** نتيجة حالة اختبار واحدة. */
export interface RuleTestResult {
  ruleId: string;
  ruleName: string;
  caseName: string;
  passed: boolean;
  expected: string;
  actual: TestVerdict;
  reason: string;
}

/** تقرير اختبار قاعدة واحدة. */
export interface RuleTestReport {
  ruleId: string;
  ruleName: string;
  total: number;
  passed: number;
  failed: number;
  results: RuleTestResult[];
}

/** تقرير اختبار ملف المحرك كاملًا. */
export interface ProfileTestReport {
  total: number;
  passed: number;
  failed: number;
  rules: RuleTestReport[];
}

/** يطبّع نص «متوقَّع» إلى حكم موحّد يطابق مخرجات المحلّ. */
export function normalizeExpected(raw: string): TestVerdict | null {
  const value = raw.trim().toUpperCase().replace(/\s+/g, '_');
  const synonyms: Record<string, TestVerdict> = {
    MERGE: 'MERGE',
    YES: 'MERGE',
    ALLOWED: 'MERGE',
    SEPARATE: 'SEPARATE',
    DO_NOT_MERGE: 'SEPARATE',
    DONT_MERGE: 'SEPARATE',
    NO: 'SEPARATE',
    SPLIT: 'SEPARATE',
    CREATE: 'CREATE',
    CREATE_DIFFERENCE: 'CREATE',
    SKIP: 'SKIP',
    NONE: 'SKIP',
    ALLOW: 'ALLOW',
    BLOCK: 'BLOCK',
    FORBIDDEN: 'BLOCK',
  };
  return synonyms[value] ?? null;
}

/**
 * يحدّد الحكم الفعلي للقاعدة على مدخلات الحالة. ينفّذ عبر واجهة القرار الموحّدة
 * (لا منطق مكرر — P-07)، فيختبر سلوك المحرك الكامل لا القاعدة منفردة.
 */
export function evaluateVerdict(rule: EngineRule, input: unknown, profile: EngineConfig): TestVerdict {
  const ctx = (input ?? {}) as DecisionContext;

  // هل شرط القاعدة يطابق المدخلات أصلا؟ إن لم يطابق فالقاعدة لا تنطبق.
  const matches = evaluateGroup(rule.conditions, ctx);

  // اختيار المحلّ المناسب بحسب فئة/نوع القاعدة.
  if (rule.category === 'DIFFERENCE' || rule.type === 'DIFFERENCE') {
    const { decision } = resolveDifference(ctx, profile);
    return decision.create ? 'CREATE' : 'SKIP';
  }

  if (rule.category === 'MERGE' || rule.type === 'MERGE') {
    const a = (ctx.differenceType as string) ?? 'MADD';
    const b = (ctx.relatedType as string) ?? (ctx.otherType as string) ?? 'TAHQIQ';
    const { decision } = resolveMerge(a, b, profile, ctx);
    return decision.merge ? 'MERGE' : 'SEPARATE';
  }

  if (rule.category === 'RELATION' || rule.type === 'RELATION') {
    const a = (ctx.differenceType as string) ?? 'MADD';
    const b = (ctx.otherType as string) ?? 'TAHQIQ';
    const { decision } = resolveRelationExclusion(a, b, profile);
    return decision.exclusive ? 'SEPARATE' : 'MERGE';
  }

  if (rule.category === 'WAQF' || rule.category === 'WASL' || rule.category === 'IBTIDA') {
    const forbidden = Boolean(ctx.forbiddenWasl);
    const { decision } = resolveConnection(forbidden, profile);
    return decision.allowed ? 'ALLOW' : 'BLOCK';
  }

  // لأي فئة أخرى: إن طابقت القاعدة فقد «طُبّقت»، فنُبلغ عنها عبر CREATE/SKIP.
  return matches ? 'CREATE' : 'NOT_APPLIED';
}

/** يُجري حالة اختبار واحدة ويعيد نتيجتها. */
export function runTestCase(rule: EngineRule, testCase: TestCase, profile: EngineConfig): RuleTestResult {
  const expected = normalizeExpected(testCase.expected);
  const actual = evaluateVerdict(rule, testCase.input, profile);
  const passed = expected !== null && actual === expected;
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    caseName: testCase.name,
    passed,
    expected: testCase.expected,
    actual,
    reason: passed
      ? 'النتيجة مطابقة للمتوقَّع'
      : expected === null
        ? `قيمة متوقَّعة غير معروفة: «${testCase.expected}»`
        : `المتوقَّع ${expected} لكن الفعلي ${actual}`,
  };
}

/** يُجري كل اختبارات قاعدة واحدة. */
export function runRuleTests(rule: EngineRule, profile: EngineConfig): RuleTestReport {
  const cases = rule.testCases ?? [];
  const results = cases.map((testCase) => runTestCase(rule, testCase, profile));
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    results,
  };
}

/** يُجري اختبارات كل القواعد في ملف المحرك ويعيد ملخّصًا. */
export function runProfileTests(profile: EngineConfig): ProfileTestReport {
  const rules = profile.rules
    .filter((rule) => Array.isArray(rule.testCases) && rule.testCases.length > 0)
    .map((rule) => runRuleTests(rule, profile));
  const total = rules.reduce((sum, report) => sum + report.total, 0);
  const passed = rules.reduce((sum, report) => sum + report.passed, 0);
  const failed = rules.reduce((sum, report) => sum + report.failed, 0);
  return { total, passed, failed, rules };
}

/** قائمة القواعد التي فشل أحد اختباراتها (لمؤشر الانحدار في اللوحة). */
export function failingRules(report: ProfileTestReport): RuleTestReport[] {
  return report.rules.filter((item) => item.failed > 0);
}

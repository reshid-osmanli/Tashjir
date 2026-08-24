// اختبارات مشغّل اختبارات القواعد — Rule Test Runner (FR-ES-08)
// مشروع التشجير - نظام القراءات العشر

import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import {
  normalizeExpected,
  evaluateVerdict,
  runTestCase,
  runRuleTests,
  runProfileTests,
  failingRules,
} from '@/lib/tashjeer/decision/rule-test-runner';

function mergeRule(overrides: Partial<EngineRule> = {}): EngineRule {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'er-test',
    name: 'قاعدة اختبار',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }] },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 100,
    groupId: 'merge',
    specificity: 'MUSHFAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const profile: EngineConfig = {
  ...DEFAULT_SYSTEM_PROFILE,
  // مصفوفة الدمج الافتراضية: FARSH+MADD لا يُدمجان.
};

describe('تطبيع القيمة المتوقَّعة', () => {
  it('يحوّل المرادفات إلى أحكام موحّدة', () => {
    expect(normalizeExpected('merge')).toBe('MERGE');
    expect(normalizeExpected('SEPARATE')).toBe('SEPARATE');
    expect(normalizeExpected('do not merge')).toBe('SEPARATE');
    expect(normalizeExpected('CREATE')).toBe('CREATE');
    expect(normalizeExpected('block')).toBe('BLOCK');
  });

  it('يُرجع null للقيم غير المعروفة', () => {
    expect(normalizeExpected('ربما')).toBeNull();
  });
});

describe('تقييم حكم القاعدة (FR-ES-08)', () => {
  it('يُرجع SEPARATE لقاعدة تمنع دمج الفرش مع المد', () => {
    const rule = mergeRule();
    const verdict = evaluateVerdict(rule, { differenceType: 'FARSH', relatedType: 'MADD' }, profile);
    expect(verdict).toBe('SEPARATE');
  });

  it('يُرجع MERGE عندما تسمح مصفوفة الدمج بالدمج', () => {
    const rule = mergeRule({
      conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    });
    const verdict = evaluateVerdict(rule, { differenceType: 'MADD', relatedType: 'TAHQIQ' }, profile);
    expect(verdict).toBe('MERGE');
  });
});

describe('تشغيل حالات الاختبار', () => {
  it('يعتبر الحالة ناجحة حين يطابق الفعلي المتوقَّع', () => {
    const rule = mergeRule({
      testCases: [
        { name: 'فرش+مد', input: { differenceType: 'FARSH', relatedType: 'MADD' }, expected: 'SEPARATE' },
      ],
    });
    const result = runTestCase(rule, rule.testCases![0], profile);
    expect(result.passed).toBe(true);
  });

  it('يعتبر الحالة فاشلة عند الانقلاب (انحدار)', () => {
    const rule = mergeRule({
      testCases: [
        { name: 'مد+تحقيق', input: { differenceType: 'MADD', relatedType: 'TAHQIQ' }, expected: 'SEPARATE' },
      ],
    });
    // المحرك يدمج مد+تحقيق، فتوقّع SEPARATE = فشل (انحدار).
    const result = runTestCase(rule, rule.testCases![0], profile);
    expect(result.passed).toBe(false);
    expect(result.actual).toBe('MERGE');
  });
});

describe('تقارير القاعدة والملف', () => {
  it('يُجري كل اختبارات قاعدة ويعيد ملخصًا', () => {
    const rule = mergeRule({
      testCases: [
        { name: 'نجاح', input: { differenceType: 'FARSH', relatedType: 'MADD' }, expected: 'SEPARATE' },
        { name: 'فشل', input: { differenceType: 'MADD', relatedType: 'TAHQIQ' }, expected: 'SEPARATE' },
      ],
    });
    const report = runRuleTests(rule, profile);
    expect(report.total).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
  });

  it('يُجري اختبارات الملف كاملًا ويصنف الفاشلة', () => {
    const okRule = mergeRule({
      id: 'er-ok',
      testCases: [
        { name: 'نجاح', input: { differenceType: 'FARSH', relatedType: 'MADD' }, expected: 'SEPARATE' },
      ],
    });
    const badRule = mergeRule({
      id: 'er-bad',
      testCases: [
        { name: 'فشل', input: { differenceType: 'MADD', relatedType: 'TAHQIQ' }, expected: 'SEPARATE' },
      ],
    });
    const fileProfile: EngineConfig = { ...profile, rules: [okRule, badRule] };
    const report = runProfileTests(fileProfile);
    expect(report.total).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
    expect(failingRules(report).map((item) => item.ruleId)).toEqual(['er-bad']);
  });

  it('يتجاهل القواعد بلا اختبارات', () => {
    const report = runProfileTests({ ...profile, rules: [mergeRule()] });
    expect(report.total).toBe(0);
    expect(report.rules).toHaveLength(0);
  });
});

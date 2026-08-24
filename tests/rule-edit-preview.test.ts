// اختبارات معاينة أثر تعديل قاعدة — Rule Edit Preview (FR-ES-09.4)
// مشروع التشجير - نظام القراءات العشر

import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule, TestCase } from '@/lib/tashjeer/model/v8';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { previewRuleEdit, summarizePreview, type RuleEditPreview } from '@/lib/tashjeer/decision/rule-edit-preview';

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'er-preview',
    name: 'قاعدة معاينة',
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

const profile: EngineConfig = { ...DEFAULT_SYSTEM_PROFILE };

describe('معاينة أثر تعديل قاعدة (FR-ES-09.4)', () => {
  it('لا يبلغ عن انقلاب عند تعديل لا يغيّر النتيجة', () => {
    const current = rule({
      testCases: [{ name: 'فرش+مد', input: { differenceType: 'FARSH', relatedType: 'MADD' }, expected: 'SEPARATE' }],
    });
    const edited = rule({ name: 'اسم جديد' }); // تعديل الاسم فقط
    const preview = previewRuleEdit(profile, current, edited);
    expect(preview.flipped).toHaveLength(0);
    expect(preview.stable).toBe(1);
    expect(preview.introducesRegression).toBe(false);
  });

  it('يبلغ عن الانقلاب عند تغيّر النتيجة، ويكشف الانحدار', () => {
    // قاعدة اختلاف وحيدة في ملف خاص: مطابقتها تقرر CREATE/SKIP مباشرة.
    const diffRule = (conditions: EngineRule['conditions'], testCases: TestCase[]) =>
      ({
        id: 'er-diff',
        name: 'قاعدة اختلاف',
        type: 'DIFFERENCE',
        category: 'DIFFERENCE',
        scope: 'MUSHAF',
        conditions,
        actions: [{ type: 'CREATE_DIFFERENCE' }],
        priority: 50,
        groupId: 'difference',
        specificity: 'MUSHFAF',
        hardness: 'SOFT',
        status: 'ACTIVE',
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        testCases,
      }) as EngineRule;
    const cases: TestCase[] = [
      { name: 'قالون', input: { readerId: 'qalon' }, expected: 'CREATE' },
    ];
    const current = diffRule({ all: [{ field: 'readerId', op: 'equals', value: 'qalon' }] }, cases);
    const edited = diffRule({ all: [{ field: 'readerId', op: 'equals', value: 'other' }] }, cases);
    const diffProfile: EngineConfig = { ...DEFAULT_SYSTEM_PROFILE, rules: [current] };

    const preview = previewRuleEdit(diffProfile, current, edited);
    expect(preview.flipped.length).toBeGreaterThan(0);
    expect(preview.introducesRegression).toBe(true);
  });

  it('الملخص النصي يذكر عدد المتأثرات', () => {
    const preview: RuleEditPreview = {
      flipped: [{ name: 'حالة', before: 'MERGE', after: 'SEPARATE' }],
      stable: 2,
      introducesRegression: false,
    };
    expect(summarizePreview(preview)).toContain('1');
  });

  it('ملخص آمن عند غياب التأثير', () => {
    expect(summarizePreview({ flipped: [], stable: 3, introducesRegression: false })).toContain('آمن');
  });
});

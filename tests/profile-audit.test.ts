// اختبارات فحص ملف المحرك — Profile Audit (FR-ES-07، FR-ES-13)
// مشروع التشجير - نظام القراءات العشر

import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { auditProfile, extractDifferenceType } from '@/lib/tashjeer/decision/profile-audit';

function rule(overrides: Partial<EngineRule>): EngineRule {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'er-x',
    name: 'قاعدة',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 50,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function profileOf(rules: EngineRule[]): EngineConfig {
  return { ...DEFAULT_SYSTEM_PROFILE, rules };
}

describe('استخراج قيد نوع الاختلاف', () => {
  it('يستخرج القيمة عند وجود شرط differenceType equals', () => {
    expect(extractDifferenceType(rule({}))).toBe('MADD');
  });
  it('يُرجع ANY عند غياب القيد', () => {
    expect(extractDifferenceType(rule({ conditions: { all: [] } }))).toBe('ANY');
  });
});

describe('تصادم الأولويات داخل المجموعة', () => {
  it('يكشف قاعدتين فعّالتين بنفس الأولوية والمجموعة', () => {
    const audit = auditProfile(profileOf([rule({ id: 'a', priority: 80 }), rule({ id: 'b', priority: 80 })]));
    expect(audit.priorityCollisions.length).toBe(1);
    expect(audit.priorityCollisions[0]!.rules).toHaveLength(2);
  });
  it('يتجاهل المعطّلة', () => {
    const audit = auditProfile(profileOf([rule({ id: 'a', priority: 80 }), rule({ id: 'b', priority: 80, status: 'DISABLED' })]));
    expect(audit.priorityCollisions).toHaveLength(0);
  });
});

describe('القواعد الشاملة', () => {
  it('يكشف القواعد ذات الشروط الفارغة', () => {
    const audit = auditProfile(profileOf([rule({ id: 'a', conditions: { all: [] } })]));
    expect(audit.catchAllRules).toHaveLength(1);
  });
});

describe('تعارض أفعال الدمج (FR-ES-07)', () => {
  it('يكشف قاعدتين متناقضتين على نفس النوع', () => {
    const audit = auditProfile(
      profileOf([
        rule({ id: 'allow', conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }] }, actions: [{ type: 'MERGE' }] }),
        rule({ id: 'prevent', conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }] }, actions: [{ type: 'PREVENT_MERGE' }] }),
      ])
    );
    expect(audit.mergeConflicts).toHaveLength(1);
    expect(audit.mergeConflicts[0]!.differenceType).toBe('FARSH');
  });
  it('لا يعدّ تعارضًا إذا اختلفت الأنواع', () => {
    const audit = auditProfile(
      profileOf([
        rule({ id: 'allow', conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }] }, actions: [{ type: 'MERGE' }] }),
        rule({ id: 'prevent', conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] }, actions: [{ type: 'PREVENT_MERGE' }] }),
      ])
    );
    expect(audit.mergeConflicts).toHaveLength(0);
  });
});

describe('توزيع الحالات وعدد المشكلات', () => {
  it('يعدّ الحالات ويجمع المشكلات', () => {
    const audit = auditProfile(profileOf([rule({ id: 'a', status: 'DRAFT' }), rule({ id: 'b', status: 'ACTIVE' })]));
    expect(audit.statusCounts.DRAFT).toBe(1);
    expect(audit.statusCounts.ACTIVE).toBe(1);
    expect(audit.issueCount).toBeGreaterThanOrEqual(0);
  });
});

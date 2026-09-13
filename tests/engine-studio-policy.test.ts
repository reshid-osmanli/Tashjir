// اختبارات PH1 الإضافية: السياسة لا الواجهة هي التي تحسم القرار.
import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { createDefaultEngineConfig } from '@/lib/tashjeer/decision/policy';
import { resolveMerge, resolveRelationExclusion } from '@/lib/tashjeer/decision/api';
import { decideMerge, resolveConflictPolicy } from '@/lib/tashjeer/decision/resolver';
import { setRulePriority, serializeEngineConfig, validateEngineConfig } from '@/lib/tashjeer/engine-config-store';

function rule(overrides: Partial<EngineRule>): EngineRule {
  return {
    id: 'rule',
    name: 'قاعدة',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    actions: [{ type: 'MERGE' }],
    priority: 50,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    createdAt: 't',
    updatedAt: 't',
    ...overrides,
  };
}

function config(rules: EngineRule[], extra: Partial<EngineConfig> = {}): EngineConfig {
  return {
    ...createDefaultEngineConfig('test'),
    rules,
    mergeMatrix: [{ a: 'MADD', b: 'TAHQIQ', merge: false, conditional: true, priority: 1, reason: 'افتراض' }],
    ...extra,
  };
}

describe('سياسة Engine Studio عبر Decision API', () => {
  it('لا تطبق القاعدة Draft قبل الحفظ/التفعيل', () => {
    const draft = rule({ id: 'draft', status: 'DRAFT', actions: [{ type: 'MERGE' }], priority: 100 });
    const result = resolveMerge('MADD', 'TAHQIQ', config([draft]));
    expect(result.decision.merge).toBe(false);
    expect(result.trace.some((step) => step.ruleId === 'draft' && step.status === 'skipped')).toBe(true);
  });

  it('الأولوية الأعلى تحسم القاعدتين المتناقضتين وتظهر القاعدة الخاسرة', () => {
    const allow = rule({ id: 'allow', priority: 100, actions: [{ type: 'MERGE' }] });
    const block = rule({ id: 'block', priority: 80, actions: [{ type: 'PREVENT_MERGE' }] });
    const result = resolveMerge('MADD', 'TAHQIQ', config([allow, block]));
    expect(result.decision.merge).toBe(true);
    expect(result.trace.some((step) => step.ruleId === 'allow' && step.status === 'won')).toBe(true);
    expect(result.trace.some((step) => step.ruleId === 'block' && step.status === 'lost')).toBe(true);
  });

  it('القاعدة الأخص تفوز عند طلب سياسة الخصوصية', () => {
    const global = rule({ id: 'global', priority: 80, specificity: 'MUSHAF' });
    const local = rule({ id: 'local', priority: 80, specificity: 'CHARACTER', actions: [{ type: 'PREVENT_MERGE' }] });
    const result = resolveConflictPolicy(['MOST_SPECIFIC'], [global, local]);
    expect(result.winner?.id).toBe('local');
  });

  it('Hard لا تخسر أمام Soft، ويغيّر ترتيب المراحل نتيجة القرار', () => {
    const hardBlock = rule({ id: 'hard-block', priority: 10, hardness: 'HARD', actions: [{ type: 'PREVENT_MERGE' }] });
    const softAllow = rule({ id: 'soft-allow', priority: 100, actions: [{ type: 'MERGE' }] });
    const protectedResult = decideMerge('MADD', 'TAHQIQ', config([hardBlock, softAllow]));
    expect(protectedResult.decision.merge).toBe(false);

    const mergeFirst = decideMerge('MADD', 'TAHQIQ', config([rule({ id: 'block', actions: [{ type: 'BLOCK_RESULT' }] }), softAllow], { executionOrder: ['MERGE', 'BLOCKING'] }));
    expect(mergeFirst.decision.merge).toBe(true);
  });

  it('سياسة العلاقة تقرأها واجهة التنافي من EngineConfig', () => {
    const cfg = config([], { relations: [{ id: 'rel-1', a: 'MADD', b: 'FARSH', relation: 'MUTUALLY_EXCLUSIVE', priority: 90, reason: 'مستقلان' }] });
    const result = resolveRelationExclusion('FARSH', 'MADD', cfg);
    expect(result.decision.exclusive).toBe(true);
    expect(result.trace[0].stage).toBe('RELATION_POLICY');
  });

  it('إسناد أولوية مشغولة يزيح القاعدة الأخرى ولا يكرر الرقم', () => {
    const first = rule({ id: 'a', priority: 80 });
    const second = rule({ id: 'b', priority: 90 });
    const next = setRulePriority(config([first, second]), 'a', 90);
    expect(next.rules.find((item) => item.id === 'a')?.priority).toBe(90);
    expect(next.rules.find((item) => item.id === 'b')?.priority).toBe(91);
  });

  it('التصدير المنظم قابل للفحص ويحتفظ بمفاتيح الحزمة المطلوبة', () => {
    const parsed = JSON.parse(serializeEngineConfig(config([]))) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['schema-version', 'policies', 'rules', 'priorities', 'relations', 'contexts', 'merge-policies']);
    expect(validateEngineConfig(parsed).valid).toBe(true);
  });
});

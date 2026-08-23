// اختبارات حلّ القرار المركزي وطبقة السياسة (FR-EN-02/03، FR-ES-01/05/06/10)
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SYSTEM_PROFILE,
  DEFAULT_MERGE_MATRIX,
  createDefaultEngineConfig,
} from '@/lib/tashjeer/decision/policy';
import {
  decideMerge,
  decideMutualExclusion,
  matchRules,
  resolveConflictPolicy,
  resolveMergeDecision,
  sortRulesByPrecedence,
} from '@/lib/tashjeer/decision/resolver';
import {
  resolveMerge,
  resolveVariant,
  resolveOrder,
  resolveRelation,
  resolveConnection,
  resolveRelationExclusion,
} from '@/lib/tashjeer/decision/api';
import type { EngineRule, EngineConfig } from '@/lib/tashjeer/model/v8';

describe('مطابقة القواعد والأولوية (FR-ES-01)', () => {
  it('يرتّب القواعد المطابقة بأعلى أولوية ثم أخص خصوصية', () => {
    const rules: EngineRule[] = [
      { id: 'low', name: 'low', type: 'MERGE', category: 'MERGE', scope: 'MUSHAF', conditions: { all: [{ field: 'x', op: 'equals', value: 1 }] }, actions: [], priority: 50, groupId: 'merge', specificity: 'MUSHFAF', hardness: 'SOFT', status: 'ACTIVE', version: 1, createdAt: 't', updatedAt: 't' },
      { id: 'high', name: 'high', type: 'MERGE', category: 'MERGE', scope: 'MUSHAF', conditions: { all: [{ field: 'x', op: 'equals', value: 1 }] }, actions: [], priority: 100, groupId: 'merge', specificity: 'MUSHFAF', hardness: 'SOFT', status: 'ACTIVE', version: 1, createdAt: 't', updatedAt: 't' },
      { id: 'specific', name: 'specific', type: 'MERGE', category: 'MERGE', scope: 'WORD', conditions: { all: [{ field: 'x', op: 'equals', value: 1 }] }, actions: [], priority: 100, groupId: 'merge', specificity: 'WORD', hardness: 'SOFT', status: 'ACTIVE', version: 1, createdAt: 't', updatedAt: 't' },
    ];
    const { matched } = matchRules({ ...DEFAULT_SYSTEM_PROFILE, rules }, { x: 1 });
    const sorted = sortRulesByPrecedence(matched);
    // عند تساوي الأولوية يفوز الأخص خصوصية: MUSHFAF (high) أخص من WORD (specific).
    expect(sorted[0].id).toBe('high');
    expect(sorted.map((r) => r.id)).toContain('specific');
  });
});

describe('حل التعارض (FR-ES-06)', () => {
  it('لا اختيار عشوائي: الأعلى أولوية يفوز', () => {
    const a: EngineRule = { id: 'A', name: 'A Merge', type: 'MERGE', category: 'MERGE', scope: 'MUSHAF', conditions: { all: [] }, actions: [{ type: 'MERGE' }], priority: 100, groupId: 'merge', specificity: 'MUSHFAF', hardness: 'SOFT', status: 'ACTIVE', version: 1, createdAt: 't', updatedAt: 't' };
    const b: EngineRule = { id: 'B', name: 'B DoNotMerge', type: 'MERGE', category: 'MERGE', scope: 'MUSHAF', conditions: { all: [] }, actions: [{ type: 'PREVENT_MERGE' }], priority: 80, groupId: 'merge', specificity: 'MUSHFAF', hardness: 'SOFT', status: 'ACTIVE', version: 1, createdAt: 't', updatedAt: 't' };
    const { winner, reason } = resolveConflictPolicy(DEFAULT_SYSTEM_PROFILE.conflictPolicy, [a, b]);
    expect(winner?.id).toBe('A');
    expect(reason).toContain('أولوية');
  });
});

describe('مصفوفة الدمج (FR-ES-05)', () => {
  it('الفرش والمد لا يُدمجان (مستقلان)', () => {
    const r = resolveMergeDecision('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE);
    expect(r.merge).toBe(false);
    expect(r.priority).toBe(100);
  });
  it('المد والتحقيق يُدمجان (مرتبطان)', () => {
    const r = resolveMergeDecision('MADD', 'TAHQIQ', DEFAULT_SYSTEM_PROFILE);
    expect(r.merge).toBe(true);
  });
  it('قرار الدمج يُرجع أثرًا قابلاً للتفسير (FR-ES-10)', () => {
    const res = decideMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE, { sameReader: true });
    expect(res.decision.merge).toBe(false);
    expect(res.trace.some((s) => s.stage === 'MERGE')).toBe(true);
  });
});

describe('واجهة القرار الموحّدة (FR-EN-03)', () => {
  it('resolveMerge يلتف حول الحل المركزي', () => {
    const res = resolveMerge('MADD', 'TAHQIQ', DEFAULT_SYSTEM_PROFILE);
    expect(res.decision.merge).toBe(true);
  });

  it('resolveRelationExclusion: مدّان متنافيان', () => {
    const res = resolveRelationExclusion('MADD', 'MADD', DEFAULT_SYSTEM_PROFILE);
    expect(res.decision.exclusive).toBe(true);
  });

  it('resolveVariant: الفائز بالقوة الأضعف رتبة', () => {
    const res = resolveVariant(
      [
        { id: 'a', strengthRank: 3 },
        { id: 'b', strengthRank: 1 },
        { id: 'c', strengthRank: 2 },
      ],
      {},
      DEFAULT_SYSTEM_PROFILE
    );
    expect(res.decision.winnerId).toBe('b');
    expect(res.decision.orderedIds).toEqual(['b', 'c', 'a']);
  });

  it('resolveOrder: الرتبة الصريحة تسبق المعرّف (DM-04)', () => {
    const res = resolveOrder(
      [
        { id: 'x', explicitOrder: 3 },
        { id: 'y', explicitOrder: 1 },
        { id: 'z', explicitOrder: 2 },
      ],
      DEFAULT_SYSTEM_PROFILE
    );
    expect(res.decision.orderedIds).toEqual(['y', 'z', 'x']);
  });

  it('resolveConnection: ممنوع الوصل يرفض الوصل (FR-ED-11)', () => {
    const blocked = resolveConnection(true, DEFAULT_SYSTEM_PROFILE);
    expect(blocked.decision.allowed).toBe(false);
    const allowed = resolveConnection(false, DEFAULT_SYSTEM_PROFILE);
    expect(allowed.decision.allowed).toBe(true);
  });

  it('resolveRelation: قاعدة تحظر العلاقة تُبطلها', () => {
    const profile: EngineConfig = createDefaultEngineConfig('t');
    profile.rules.push({
      id: 'er-block', name: 'منع ربط X', type: 'RELATION', category: 'RELATION', scope: 'MUSHAF',
      conditions: { all: [{ field: 'relationType', op: 'equals', value: 'MERGE' }] },
      actions: [{ type: 'BLOCK_RESULT' }], priority: 90, groupId: 'exceptions', specificity: 'MUSHFAF',
      hardness: 'HARD', status: 'ACTIVE', version: 1, createdAt: 't', updatedAt: 't',
    });
    const res = resolveRelation('a', 'b', 'MERGE', profile);
    expect(res.decision.valid).toBe(false);
  });
});

describe('ملف المحرك الافتراضي', () => {
  it('يحوي مصفوفة دمج ومجموعات أولوية وسياسة تعارض', () => {
    expect(DEFAULT_MERGE_MATRIX.length).toBeGreaterThan(0);
    expect(DEFAULT_SYSTEM_PROFILE.priorityGroups.length).toBe(9);
    expect(DEFAULT_SYSTEM_PROFILE.conflictPolicy[0]).toBe('MOST_SPECIFIC');
  });
  it('createDefaultEngineConfig يعيد نسخة مستقلة', () => {
    const a = createDefaultEngineConfig('a');
    const b = createDefaultEngineConfig('b');
    a.mergeMatrix.push({ a: 'X', b: 'Y', merge: true, priority: 1, reason: 'test' });
    expect(b.mergeMatrix).not.toEqual(a.mergeMatrix);
    expect(b.profile).toBe('b');
  });
});

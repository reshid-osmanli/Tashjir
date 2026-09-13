// اختبارات رسم اعتمادات القواعد — Rule Dependency Graph (FR-ES-07.7.1)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس: اشتقاق الأنواع الأربعة (Depends On / Overrides / Conflicts With /
// Triggers) من الإعلان ومن بنية الشروط والإجراءات، وكشف الدورات، والإحداثيات
// الحتمية RTL، والرسم الجزئي للتنقل.

import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import {
  DEFAULT_CONFLICT_POLICY,
  DEFAULT_MERGE_MATRIX,
  DEFAULT_PRIORITY_GROUPS,
} from '@/lib/tashjeer/decision/policy';
import {
  GRAPH_NODE_WIDTH,
  GRAPH_PADDING,
  buildRuleGraph,
  consumedFields,
  findCycles,
  isolatedRuleIds,
  producedFields,
  relationsOf,
  subgraphAround,
  usageCounts,
} from '@/lib/tashjeer/rule-dependencies';

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'er-a',
    name: 'قاعدة أ',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    actions: [{ type: 'MERGE' }],
    priority: 80,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function config(rules: EngineRule[]): EngineConfig {
  return {
    schemaVersion: 1,
    profile: 'testing',
    priorityGroups: DEFAULT_PRIORITY_GROUPS,
    rules,
    conflictPolicy: DEFAULT_CONFLICT_POLICY,
    executionOrder: ['MERGE'],
    mergeMatrix: DEFAULT_MERGE_MATRIX,
    contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
  };
}

describe('الحواف المعلنة', () => {
  it('تُشتق من dependsOn/overrides/conflictsWith', () => {
    const graph = buildRuleGraph(
      config([
        rule({ id: 'er-child', dependsOn: ['er-parent'], overrides: ['er-old'] }),
        rule({ id: 'er-parent' }),
        rule({ id: 'er-old' }),
        rule({ id: 'er-rival', conflictsWith: ['er-child'] }),
      ])
    );
    const kinds = new Map(graph.edges.map((edge) => [edge.id, edge]));
    expect(kinds.has('DEPENDS_ON:er-child->er-parent')).toBe(true);
    expect(kinds.has('OVERRIDES:er-child->er-old')).toBe(true);
    // التعارض متناظر: يُرسم في الاتجاهين.
    expect(kinds.has('CONFLICTS_WITH:er-rival->er-child')).toBe(true);
    expect(kinds.has('CONFLICTS_WITH:er-child->er-rival')).toBe(true);
    expect(graph.edges.find((edge) => edge.kind === 'DEPENDS_ON')?.declared).toBe(true);
  });

  it('يتجاهل إحالات إلى قواعد غير موجودة (لا حواف معلّقة)', () => {
    const graph = buildRuleGraph(config([rule({ id: 'er-a', dependsOn: ['er-ghost'] })]));
    expect(graph.edges).toHaveLength(0);
  });
});

describe('الحواف المشتقة من البنية', () => {
  it('إجراء يُحيل إلى معرّف قاعدة ← تُطلقها (Triggers)', () => {
    const graph = buildRuleGraph(
      config([
        rule({
          id: 'er-caller',
          actions: [{ type: 'APPLY_RULE', params: { ruleId: 'er-target' } }],
        }),
        rule({ id: 'er-target' }),
      ])
    );
    const edge = graph.edges.find((item) => item.kind === 'TRIGGERS');
    expect(edge?.from).toBe('er-caller');
    expect(edge?.to).toBe('er-target');
    expect(edge?.declared).toBe(false);
    expect(edge?.reason).toContain('APPLY_RULE');
  });

  it('إجراء يكتب حقلًا تقرأه شروط قاعدة أخرى ← تُطلقها', () => {
    const writer = rule({
      id: 'er-writer',
      actions: [{ type: 'ASSIGN_CONTEXT', params: { field: 'context' } }],
    });
    const reader = rule({
      id: 'er-reader',
      conditions: { all: [{ field: 'context', op: 'equals', value: 'WAQF_ONLY' }] },
    });
    expect(producedFields(writer).has('context')).toBe(true);
    expect(consumedFields(reader).has('context')).toBe(true);

    const graph = buildRuleGraph(config([writer, reader]));
    const edge = graph.edges.find((item) => item.kind === 'TRIGGERS' && item.from === 'er-writer');
    expect(edge?.to).toBe('er-reader');
    expect(edge?.reason).toContain('context');
  });

  it('قراءة المجموعات المتداخلة (any/not) في الاشتقاق', () => {
    const nested = rule({
      id: 'er-nested',
      conditions: { all: [], any: [{ not: [{ field: 'pathId', op: 'exists' }] }] },
    });
    expect(consumedFields(nested).has('pathId')).toBe(true);
  });
});

describe('الدورات في الاعتمادات', () => {
  it('يكتشف دورة A ← B ← A', () => {
    const graph = buildRuleGraph(
      config([rule({ id: 'er-a', dependsOn: ['er-b'] }), rule({ id: 'er-b', dependsOn: ['er-a'] })])
    );
    expect(graph.cycles.length).toBeGreaterThan(0);
    expect(graph.cycles[0]).toEqual(['er-a', 'er-b', 'er-a']);
  });

  it('التعارض المتناظر لا يُعدّ دورة', () => {
    const cycles = findCycles([
      { id: 'c1', from: 'er-a', to: 'er-b', kind: 'CONFLICTS_WITH', declared: true, reason: '' },
      { id: 'c2', from: 'er-b', to: 'er-a', kind: 'CONFLICTS_WITH', declared: true, reason: '' },
    ]);
    expect(cycles).toHaveLength(0);
  });

  it('لا دورة في سلسلة خطية', () => {
    const graph = buildRuleGraph(
      config([
        rule({ id: 'er-a', dependsOn: ['er-b'] }),
        rule({ id: 'er-b', dependsOn: ['er-c'] }),
        rule({ id: 'er-c' }),
      ])
    );
    expect(graph.cycles).toHaveLength(0);
    // الأعمدة تتبع اتجاه الحافة: مصدرها أولًا (اليمين في RTL) ثم هدفها يسارًا.
    expect(graph.byId.get('er-a')?.col).toBe(0);
    expect(graph.byId.get('er-b')?.col).toBe(1);
    expect(graph.byId.get('er-c')?.col).toBe(2);
  });
});

describe('التخطيط الحتمي RTL', () => {
  it('العمود ٠ في أقصى اليمين (x الأكبر)', () => {
    const graph = buildRuleGraph(
      config([rule({ id: 'er-a', dependsOn: ['er-b'] }), rule({ id: 'er-b' })])
    );
    const a = graph.byId.get('er-a')!; // مصدر الحافة ← العمود ٠
    const b = graph.byId.get('er-b')!; // هدفها ← العمود ١ (أيسر)
    expect(a.col).toBe(0);
    expect(b.col).toBe(1);
    expect(a.x).toBeGreaterThan(b.x); // RTL: اليمين أولًا
    expect(a.x + GRAPH_NODE_WIDTH).toBe(graph.width - GRAPH_PADDING);
    expect(b.x).toBeGreaterThanOrEqual(GRAPH_PADDING);
  });

  it('نفس المدخلات تعطي نفس الإحداثيات (حتمية الرسم)', () => {
    const rules = [rule({ id: 'er-a', dependsOn: ['er-b'] }), rule({ id: 'er-b' }), rule({ id: 'er-c' })];
    const first = buildRuleGraph(config(rules));
    const second = buildRuleGraph(config([...rules].reverse()));
    expect(second.nodes.map((node) => [node.id, node.x, node.y])).toEqual(
      first.nodes.map((node) => [node.id, node.x, node.y])
    );
  });
});

describe('علاقات قاعدة واحدة والتنقل', () => {
  it('يفصل الاتجاهين (تعتمد على / يُعتمد عليها)', () => {
    const graph = buildRuleGraph(
      config([
        rule({ id: 'er-child', dependsOn: ['er-parent'] }),
        rule({ id: 'er-parent' }),
        rule({ id: 'er-unrelated' }),
      ])
    );
    const relations = relationsOf(graph, 'er-parent');
    expect(relations.dependedBy.map((edge) => edge.from)).toEqual(['er-child']);
    expect(relations.dependsOn).toHaveLength(0);
    expect(relationsOf(graph, 'er-unrelated').isolated).toBe(true);
    expect(isolatedRuleIds(graph)).toEqual(['er-unrelated']);
  });

  it('الرسم الجزئي يحفظ الجيران حتى العمق المطلوب', () => {
    const graph = buildRuleGraph(
      config([
        rule({ id: 'er-a', dependsOn: ['er-b'] }),
        rule({ id: 'er-b', dependsOn: ['er-c'] }),
        rule({ id: 'er-c' }),
        rule({ id: 'er-far' }),
      ])
    );
    const around = subgraphAround(graph, 'er-b', 1);
    expect(around.nodes.map((node) => node.id).sort()).toEqual(['er-a', 'er-b', 'er-c']);
    const deeper = subgraphAround(graph, 'er-a', 2);
    expect(deeper.nodes.map((node) => node.id).sort()).toEqual(['er-a', 'er-b', 'er-c']);
  });
});

describe('عدادات الاستخدام الخام (Metadata — FR-ES-07.4)', () => {
  it('يعدّ من يشير إلى القاعدة وحالات اختبارها', () => {
    const profile = config([
      rule({ id: 'er-target', testCases: [{ name: 'حالة', input: {}, expected: 'MERGE' }] }),
      rule({ id: 'er-d1', dependsOn: ['er-target'] }),
      rule({ id: 'er-d2', overrides: ['er-target'] }),
      rule({ id: 'er-d3', conflictsWith: ['er-target'] }),
    ]);
    const counts = usageCounts(profile);
    expect(counts.get('er-target')?.dependents).toBe(3);
    expect(counts.get('er-target')?.testCases).toBe(1);
    expect(buildRuleGraph(profile).byId.get('er-target')?.usage).toBe(3);
  });
});

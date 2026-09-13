// اختبارات أثر «تجاوزته» في قرار الدمج (FR-ES-15.4)
//
// عند تعارض قاعدتي دمج (أيدمج × لا أدمج) يحسم Decision Resolver الفائز،
// ويُدوّن الخاسرين خطوات «lost» في الأثر — فيعرض زر Why في المحرر:
//   Result ← Because (القاعدة الفائزة + أولويتها) ← Overrode (القواعد المتجاوزة).

import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { decideMerge } from '@/lib/tashjeer/decision/resolver';

function makeRule(overrides: {
  id: string;
  name: string;
  priority: number;
  action: 'MERGE' | 'PREVENT_MERGE';
}): EngineRule {
  return {
    id: overrides.id,
    name: overrides.name,
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: {
      all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }],
    },
    actions: [{ type: overrides.action }],
    priority: overrides.priority,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeProfile(rules: EngineRule[]): EngineConfig {
  return {
    schemaVersion: 1,
    profile: 'test-override',
    priorityGroups: [],
    rules,
    conflictPolicy: ['HIGHEST_PRIORITY'],
    executionOrder: [],
    mergeMatrix: [],
    contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
  };
}

describe('أثر تجاوز القواعد في قرار الدمج', () => {
  it('الفائز بالأولوية الأعلى يفوز، والمتجاوَز يسجَّل خطوة lost بأولويته', () => {
    const prevent = makeRule({ id: 'r-prevent', name: 'قاعدة منع (٧٠)', priority: 70, action: 'PREVENT_MERGE' });
    const allow = makeRule({ id: 'r-allow', name: 'قاعدة دمج (٩٠)', priority: 90, action: 'MERGE' });

    const result = decideMerge('FARSH', 'MADD', makeProfile([prevent, allow]));

    // القاعدة الفائزة (أعلى أولوية) تقرر الدمج
    expect(result.decision.merge).toBe(true);
    expect(result.decision.reason).toContain('أعلى أولوية');

    // الفائزة مسجلة في الأثر
    const won = result.trace.find((step) => step.ruleId === allow.id && step.status === 'won');
    expect(won).toBeTruthy();
    expect(won?.priority).toBe(90);

    // المتجاوَز خطوة lost بأولويته — أساس قسم «تجاوزته» في Why
    const lost = result.trace.find((step) => step.ruleId === prevent.id && step.status === 'lost');
    expect(lost).toBeTruthy();
    expect(lost?.priority).toBe(70);
    expect(lost?.message).toContain('قاعدة منع (٧٠)');
  });

  it('عند غياب التعارض لا خطوات lost', () => {
    const allow = makeRule({ id: 'r-only', name: 'قاعدة دمج وحيدة', priority: 90, action: 'MERGE' });
    const result = decideMerge('FARSH', 'MADD', makeProfile([allow]));
    expect(result.trace.filter((step) => step.status === 'lost')).toHaveLength(0);
  });
});

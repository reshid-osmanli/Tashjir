// اختبارات سجل إصدارات ملف المحرك وأدوات الأولوية (FR-ES-01، FR-ES-05، FR-ES-07، FR-ES-14)
//
//   1) diffEngineConfigs يصف التغييرات وصفا كميا دقيقا (تدقيق).
//   2) captureEngineVersion يتجاهل الحفظ المكرر ويرقّم تسلسليا ويطوي الأقدم.
//   3) مخزن الاستوديو: الحفظ يلتقط نسخة، والاسترجاع يعيد الملف ويُسجَّل بدوره.
//   4) renumberPriorities / moveItem: ترتيب مرئي = أرقام صريحة.
//   5) مدخل مصفوفة مشروط: القاعدة المطابقة تحسم حتى بلا تعارض.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { MemoryStorage } from './helpers/memory-storage';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  vi.resetModules();
});

function buildRule(overrides: Partial<EngineRule> = {}): EngineRule {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'er-a',
    name: 'قاعدة أ',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 80,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildConfig(rules: EngineRule[], overrides: Partial<EngineConfig> = {}): EngineConfig {
  return {
    schemaVersion: 1,
    profile: 'testing',
    priorityGroups: [
      { id: 'structural', label: 'بنائية', order: 10 },
      { id: 'merge', label: 'دمج', order: 80 },
    ],
    rules,
    conflictPolicy: ['MOST_SPECIFIC', 'HIGHEST_PRIORITY', 'EXPLICIT', 'LOCAL', 'MANUAL'],
    executionOrder: ['NORMALIZE', 'CONTEXT', 'BLOCKING', 'MERGE', 'ORDERING', 'FALLBACK'],
    mergeMatrix: [
      { a: 'MADD', b: 'TAHQIQ', merge: true, priority: 80, reason: 'مرتبطان' },
      { a: 'FARSH', b: 'MADD', merge: false, priority: 100, reason: 'مستقلان' },
    ],
    contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
    ...overrides,
  };
}

describe('تدقيق التغييرات بين ملفّين', () => {
  it('يصف الإضافة والحذف والتعديل مع تفاصيل الأولوية والحالة', async () => {
    const { diffEngineConfigs } = await import('@/lib/tashjeer/engine-config-history');
    const before = buildConfig([buildRule(), buildRule({ id: 'er-b', name: 'قاعدة ب' })]);
    const after = buildConfig([
      buildRule({ priority: 95, status: 'DRAFT', updatedAt: 'later', version: 2 }),
      buildRule({ id: 'er-c', name: 'قاعدة ج' }),
    ]);
    const audit = diffEngineConfigs(before, after);
    const kinds = audit.map((entry) => entry.kind).sort();
    expect(kinds).toEqual(['RULE_ADDED', 'RULE_CHANGED', 'RULE_REMOVED']);
    const changed = audit.find((entry) => entry.kind === 'RULE_CHANGED')!;
    expect(changed.ruleId).toBe('er-a');
    expect(changed.label).toContain('80 إلى 95');
    expect(changed.label).toContain('ACTIVE إلى DRAFT');
  });

  it('لا يعدّ تغيّر الطابع الزمني ورقم الإصدار وحدهما تعديلا', async () => {
    const { diffEngineConfigs } = await import('@/lib/tashjeer/engine-config-history');
    const before = buildConfig([buildRule()]);
    const after = buildConfig([buildRule({ updatedAt: '2030-01-01T00:00:00.000Z', version: 7 })]);
    expect(diffEngineConfigs(before, after)).toEqual([]);
  });

  it('يرصد تغيّر المصفوفة وسلم التعارض وترتيب التنفيذ', async () => {
    const { diffEngineConfigs } = await import('@/lib/tashjeer/engine-config-history');
    const before = buildConfig([]);
    const after = buildConfig([], {
      mergeMatrix: [...before.mergeMatrix, { a: 'X', b: 'Y', merge: true, priority: 1, reason: 'r' }],
      conflictPolicy: ['HIGHEST_PRIORITY'],
      executionOrder: [...before.executionOrder].reverse(),
    });
    const kinds = diffEngineConfigs(before, after).map((entry) => entry.kind);
    expect(kinds).toContain('MATRIX_CHANGED');
    expect(kinds).toContain('POLICY_CHANGED');
    expect(kinds).toContain('ORDER_CHANGED');
  });
});

describe('التقاط النسخ', () => {
  it('يرقّم تسلسليا ويتجاهل الحفظ المطابق', async () => {
    const history = await import('@/lib/tashjeer/engine-config-history');
    const config = buildConfig([buildRule()]);
    const first = history.captureEngineVersion(config, { note: 'أولى' });
    expect(first?.seq).toBe(1);
    expect(history.captureEngineVersion(config)).toBeNull();
    const second = history.captureEngineVersion(buildConfig([buildRule({ priority: 1 })]));
    expect(second?.seq).toBe(2);
    expect(second?.audit[0]?.kind).toBe('RULE_CHANGED');
    expect(history.listEngineVersions().map((version) => version.seq)).toEqual([2, 1]);
  });

  it('يطوي الأقدم عند تجاوز الحد', async () => {
    const history = await import('@/lib/tashjeer/engine-config-history');
    for (let index = 0; index < history.ENGINE_HISTORY_LIMIT + 5; index += 1) {
      history.captureEngineVersion(buildConfig([buildRule({ priority: index })]));
    }
    const versions = history.listEngineVersions();
    expect(versions).toHaveLength(history.ENGINE_HISTORY_LIMIT);
    expect(versions[0].seq).toBe(history.ENGINE_HISTORY_LIMIT + 5);
  });
});

describe('مخزن الاستوديو: حفظ واسترجاع', () => {
  it('الحفظ يلتقط نسخة والاسترجاع يعيد الملف ويُسجَّل بدوره', async () => {
    const { useEngineStudioStore } = await import('@/stores/engine-config-ui-store');
    const history = await import('@/lib/tashjeer/engine-config-history');
    const store = useEngineStudioStore.getState();
    store.hydrate();
    const baseCount = useEngineStudioStore.getState().config.rules.length;
    expect(useEngineStudioStore.getState().versions).toHaveLength(1); // نسخة الأساس

    store.addRule({ ...buildRule({ id: 'er-new', name: 'جديدة' }) });
    expect(useEngineStudioStore.getState().dirty).toBe(true);
    store.persist('أضفنا قاعدة');
    const afterSave = useEngineStudioStore.getState();
    expect(afterSave.dirty).toBe(false);
    expect(afterSave.versions).toHaveLength(2);
    expect(afterSave.versions[0].note).toBe('أضفنا قاعدة');
    expect(afterSave.versions[0].audit.some((entry) => entry.kind === 'RULE_ADDED' && entry.ruleId === 'er-new')).toBe(true);

    const baseVersion = afterSave.versions[1];
    expect(store.rollbackTo(baseVersion.id)).toBe(true);
    const afterRollback = useEngineStudioStore.getState();
    expect(afterRollback.config.rules).toHaveLength(baseCount);
    expect(afterRollback.versions[0].source).toBe('ROLLBACK');
    expect(afterRollback.versions[0].restoredFrom).toBe(baseVersion.id);
    // الملف الحي المحفوظ فعلا هو المسترجَع.
    const { loadEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    expect(loadEngineConfig().rules).toHaveLength(baseCount);
    expect(history.listEngineVersions()).toHaveLength(3);
  });

  it('تجاهل التغييرات يعود لآخر ملف محفوظ', async () => {
    const { useEngineStudioStore } = await import('@/stores/engine-config-ui-store');
    const store = useEngineStudioStore.getState();
    store.hydrate();
    const before = useEngineStudioStore.getState().config.rules.length;
    store.addRule({ ...buildRule({ id: 'er-tmp' }) });
    expect(useEngineStudioStore.getState().config.rules).toHaveLength(before + 1);
    store.discardChanges();
    expect(useEngineStudioStore.getState().config.rules).toHaveLength(before);
    expect(useEngineStudioStore.getState().dirty).toBe(false);
  });
});

describe('أدوات الترتيب في لوحة الأولويات', () => {
  it('moveItem ينقل عنصرا إلى موضع إدراج قبل أو بعد', async () => {
    const { moveItem } = await import('@/components/studio/PriorityPipeline');
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c', 'd'], 1, 1)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('renumberPriorities يعطي الأول أعلى رقما بفجوات ثابتة', async () => {
    const { renumberPriorities } = await import('@/components/studio/PriorityPipeline');
    expect(renumberPriorities(['x', 'y', 'z'])).toEqual([
      { ruleId: 'x', priority: 30 },
      { ruleId: 'y', priority: 20 },
      { ruleId: 'z', priority: 10 },
    ]);
  });
});

describe('مدخل مصفوفة مشروط (FR-ES-05)', () => {
  it('القاعدة المطابقة تحسم فوق قيمة المدخل المشروط، ولا تفعل مع المدخل المطلق', async () => {
    const { decideMerge } = await import('@/lib/tashjeer/decision/resolver');
    const allowRule = buildRule({
      id: 'er-allow',
      name: 'اسمح في الوقف',
      conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }] },
      actions: [{ type: 'MERGE' }],
    });
    const absolute = buildConfig([allowRule]);
    expect(decideMerge('FARSH', 'MADD', absolute).decision.merge).toBe(false);

    const conditional = buildConfig([allowRule], {
      mergeMatrix: [{ a: 'FARSH', b: 'MADD', merge: false, conditional: true, priority: 100, reason: 'افتراض' }],
    });
    const result = decideMerge('FARSH', 'MADD', conditional);
    expect(result.decision.merge).toBe(true);
    expect(result.decision.reason).toContain('مشروط');
    expect(result.trace.some((step) => step.stage === 'CONFLICT' && step.ruleId === 'er-allow')).toBe(true);
  });
});

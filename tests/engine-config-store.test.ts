// اختبارات مخزن إعداد المحرك — Engine Config Store
// مشروع التشجير - نظام القراءات العشر
//
// تختبر هذه الاختبارات الضمانات الجوهرية لـ FR-ES-14 و DM-13:
//   1) الحتمية: نفس المدخلات ← نفس الخرج بايتًا.
//   2) فرق دقيق: تعديل أولوية قاعدة يغيّر سطرها وحده لا ترتيب الكل.
//   3) الفحص والاستيراد: إصدار، تعارض معرّفات، سلامة الحقول.
//   4) الجولة الكاملة: تصدير ← استيراد ← تصدير مطابق.
//   5) العمليات النقيّة: إضافة/تعديل/حذف قاعدة وصف الدمج.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

function buildRule(overrides: Partial<EngineRule> = {}): EngineRule {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'er-test-a',
    name: 'قاعدة اختبار أ',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 80,
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

function buildConfig(rules: EngineRule[]): EngineConfig {
  return {
    schemaVersion: 1,
    profile: 'testing',
    priorityGroups: [
      { id: 'structural', label: 'بنائية', order: 10 },
      { id: 'merge', label: 'دمج', order: 80 },
      { id: 'fallback', label: 'احتياطية', order: 90 },
    ],
    rules,
    conflictPolicy: ['MOST_SPECIFIC', 'HIGHEST_PRIORITY', 'EXPLICIT', 'LOCAL', 'MANUAL'],
    executionOrder: ['NORMALIZE', 'CONTEXT', 'BLOCKING', 'MERGE', 'ORDERING', 'FALLBACK'],
    mergeMatrix: [
      { a: 'MADD', b: 'TAHQIQ', merge: true, priority: 80, reason: 'مرتبطان' },
      { a: 'FARSH', b: 'MADD', merge: false, priority: 100, reason: 'مستقلان' },
    ],
    contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
  };
}

describe('الحتمية والصداقة لـ Git (DM-13)', () => {
  it('يعيد نفس الخرج بايتًا عند تكرار التصدير لنفس المدخلات', async () => {
    const { serializeEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    const config = buildConfig([buildRule({ id: 'er-a', priority: 80 }), buildRule({ id: 'er-b', priority: 90 })]);
    const first = serializeEngineConfig(config);
    const second = serializeEngineConfig(config);
    expect(second).toBe(first);
  });

  it('لا يحتوي الخرج على طوابع زمنية متقلّبة', async () => {
    const { serializeEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    const config = buildConfig([buildRule({ createdAt: '2030-12-31T00:00:00.000Z' })]);
    const out = serializeEngineConfig(config);
    expect(out).not.toContain('createdAt');
    expect(out).not.toContain('updatedAt');
    expect(out).not.toContain('2030-12-31');
  });

  it('يعطي فرقًا دقيقًا: تغيير أولوية قاعدة يغيّر سطرها وحده', async () => {
    const { serializeEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    const before = buildConfig([
      buildRule({ id: 'er-a', name: 'القاعدة أ', priority: 80 }),
      buildRule({ id: 'er-b', name: 'القاعدة ب', priority: 90 }),
    ]);
    const after = buildConfig([
      buildRule({ id: 'er-a', name: 'القاعدة أ', priority: 100 }),
      buildRule({ id: 'er-b', name: 'القاعدة ب', priority: 90 }),
    ]);

    const beforeLines = serializeEngineConfig(before).split('\n');
    const afterLines = serializeEngineConfig(after).split('\n');

    // نفس عدد الأسطر (القواعد مرتبة بالمعرّف المستقر، فلا تقفز).
    expect(afterLines.length).toBe(beforeLines.length);

    // عدد الأسطر المتباينة محدود جدًا (السطر الذي تغيرت قيمته فقط).
    const diffs = beforeLines
      .map((line, index) => ({ line, index, other: afterLines[index] }))
      .filter((entry) => entry.line !== entry.other);
    expect(diffs.length).toBe(1);
    expect(diffs[0].line).toContain('80');
    expect(diffs[0].other).toContain('100');
  });

  it('يرتّب القواعد بمعرّفها المستقر لا بأولويتها', async () => {
    const { serializeEngineConfig, toCanonicalConfig } = await import(
      '@/lib/tashjeer/engine-config-store'
    );
    const config = buildConfig([
      buildRule({ id: 'er-zeta', priority: 100 }),
      buildRule({ id: 'er-alpha', priority: 10 }),
    ]);
    const canonical = toCanonicalConfig(config);
    expect(canonical.rules.map((rule) => rule.id)).toEqual(['er-alpha', 'er-zeta']);
    // الترتيب بالمعرّف رغم اختلاف الأولوية.
    expect(serializeEngineConfig(config).indexOf('er-alpha')).toBeLessThan(
      serializeEngineConfig(config).indexOf('er-zeta')
    );
  });
});

describe('الفحص والاستيراد (FR-ES-14)', () => {
  it('يقبل ملفًا سليمًا', async () => {
    const { validateEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    const result = validateEngineConfig(buildConfig([buildRule()]));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('يرفض إصدار مخطط غير متوافق', async () => {
    const { validateEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    const config = buildConfig([buildRule()]);
    (config as { schemaVersion: number }).schemaVersion = 99;
    const result = validateEngineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('إصدار المخطط'))).toBe(true);
  });

  it('يكشف المعرّفات المكررة كتعارض', async () => {
    const { importEngineConfigText, serializeEngineConfig } = await import(
      '@/lib/tashjeer/engine-config-store'
    );
    const config = buildConfig([buildRule({ id: 'er-dup' }), buildRule({ id: 'er-dup' })]);
    const text = serializeEngineConfig(config);
    const { validation } = importEngineConfigText(text);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes('مكرر'))).toBe(true);
  });

  it('يرفض نصًا ليس JSON صالحًا', async () => {
    const { importEngineConfigText } = await import('@/lib/tashjeer/engine-config-store');
    const { validation } = importEngineConfigText('{ هذا ليس JSON');
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes('JSON'))).toBe(true);
  });

  it('يطبّع المدخلات الناقصة ويملأ الافتراضي', async () => {
    const { importEngineConfigText } = await import('@/lib/tashjeer/engine-config-store');
    const { config } = importEngineConfigText(
      JSON.stringify({
        schemaVersion: 1,
        profile: 'minimal',
        priorityGroups: [{ id: 'merge', label: 'دمج', order: 80 }],
        rules: [
          {
            id: 'er-min',
            name: 'صغرى',
            type: 'MERGE',
            category: 'MERGE',
            scope: 'MUSHAF',
            conditions: { all: [] },
            actions: [],
            priority: 50,
            groupId: 'merge',
            specificity: 'MUSHFAF',
            hardness: 'SOFT',
            status: 'DRAFT',
          },
        ],
        conflictPolicy: ['HIGHEST_PRIORITY'],
        executionOrder: ['MERGE'],
        mergeMatrix: [],
        contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
      })
    );
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].version).toBe(1);
    expect(config.rules[0].createdAt).toBeDefined();
  });
});

describe('الجولة الكاملة تصدير/استيراد (DM-13، NFR-06)', () => {
  it('تصدير ← استيراد ← تصدير يعطي النص نفسه', async () => {
    const { serializeEngineConfig, importEngineConfigText } = await import(
      '@/lib/tashjeer/engine-config-store'
    );
    const config = buildConfig([
      buildRule({ id: 'er-a', priority: 80 }),
      buildRule({ id: 'er-b', priority: 90, actions: [{ type: 'MERGE' }] }),
    ]);
    const exported = serializeEngineConfig(config);
    const { config: imported } = importEngineConfigText(exported);
    const reexported = serializeEngineConfig(imported);
    expect(reexported).toBe(exported);
  });
});

describe('الحفظ والتحميل (FR-ES-14)', () => {
  it('يحفظ ثم يحمل الملف المطابق', async () => {
    const { saveEngineConfig, loadEngineConfig } = await import(
      '@/lib/tashjeer/engine-config-store'
    );
    const config = buildConfig([buildRule({ id: 'er-persist', priority: 77 })]);
    const { config: saved } = saveEngineConfig(config);
    const loaded = loadEngineConfig();
    expect(loaded.rules.find((rule) => rule.id === 'er-persist')?.priority).toBe(77);
    expect(loaded.profile).toBe('testing');
    expect(saved.profile).toBe('testing');
  });

  it('يعيد الافتراضي عند غياب التخزين', async () => {
    const { loadEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    const loaded = loadEngineConfig();
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.rules.length).toBeGreaterThan(0);
  });

  it('يعيد الضبط إلى سياسات النظام الافتراضية', async () => {
    const { resetEngineConfig, loadEngineConfig } = await import(
      '@/lib/tashjeer/engine-config-store'
    );
    resetEngineConfig();
    expect(loadEngineConfig().profile).toBe('default');
  });
});

describe('العمليات النقيّة على القواعد (FR-ES-01/02/07)', () => {
  it('يضيف قاعدة جديدة بمعرّف وحوابع', async () => {
    const { addEngineRule } = await import('@/lib/tashjeer/engine-config-store');
    const config = buildConfig([]);
    const next = addEngineRule(config, {
      id: 'er-new',
      name: 'جديدة',
      type: 'MERGE',
      category: 'MERGE',
      scope: 'MUSHAF',
      conditions: { all: [] },
      actions: [{ type: 'MERGE' }],
      priority: 60,
      groupId: 'merge',
      specificity: 'MUSHFAF',
      hardness: 'SOFT',
      status: 'DRAFT',
    });
    expect(next.rules).toHaveLength(1);
    expect(next.rules[0].id).toBe('er-new');
    expect(next.rules[0].createdAt).toBeDefined();
  });

  it('يزيد الإصدار عند التعديل ويثبّت الأولوية', async () => {
    const { updateEngineRule, setRulePriority, setRuleStatus } = await import(
      '@/lib/tashjeer/engine-config-store'
    );
    const config = buildConfig([buildRule({ id: 'er-x', priority: 50, version: 1, status: 'DRAFT' })]);
    const updated = updateEngineRule(config, 'er-x', { name: 'معدّلة' });
    expect(updated.rules[0].version).toBe(2);
    expect(setRulePriority(config, 'er-x', 99).rules[0].priority).toBe(99);
    expect(setRuleStatus(config, 'er-x', 'ACTIVE').rules[0].status).toBe('ACTIVE');
  });

  it('يحذف القاعدة بمعرّفها', async () => {
    const { removeEngineRule } = await import('@/lib/tashjeer/engine-config-store');
    const config = buildConfig([buildRule({ id: 'er-keep' }), buildRule({ id: 'er-drop' })]);
    expect(removeEngineRule(config, 'er-drop').rules).toHaveLength(1);
    expect(removeEngineRule(config, 'er-drop').rules[0].id).toBe('er-keep');
  });
});

describe('مصفوفة الدمج والسياسة (FR-ES-05/06)', () => {
  it('يضيف ويعدّل ويحذف صفوف مصفوفة الدمج', async () => {
    const { addMergeMatrixEntry, updateMergeMatrixEntry, removeMergeMatrixEntry } = await import(
      '@/lib/tashjeer/engine-config-store'
    );
    const config = { ...buildConfig([]), mergeMatrix: [] };
    const withRow = addMergeMatrixEntry(config, {
      a: 'MADD',
      b: 'FARSH',
      merge: false,
      priority: 90,
      reason: 'مستقلان',
    });
    expect(withRow.mergeMatrix).toHaveLength(1);
    const updated = updateMergeMatrixEntry(withRow, 0, { priority: 95 });
    expect(updated.mergeMatrix[0].priority).toBe(95);
    expect(removeMergeMatrixEntry(updated, 0).mergeMatrix).toHaveLength(0);
  });

  it('يضبط سلم التعارض وترتيب التنفيذ', async () => {
    const { setConflictPolicy, setExecutionOrder } = await import(
      '@/lib/tashjeer/engine-config-store'
    );
    const config = buildConfig([]);
    const changed = setConflictPolicy(config, ['MANUAL', 'MOST_SPECIFIC']);
    expect(changed.conflictPolicy).toEqual(['MANUAL', 'MOST_SPECIFIC']);
    const reordered = setExecutionOrder(changed, ['CONTEXT', 'MERGE']);
    expect(reordered.executionOrder).toEqual(['CONTEXT', 'MERGE']);
  });
});

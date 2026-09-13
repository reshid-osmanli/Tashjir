// اختبارات سجل تدقيق استوديو المحرك — Audit Trail (FR-ES-07.6)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس: اكتمال القيد (User/Action/Rule/Before/After/Reason/Timestamp)، والقيمة
// الافتراضية `local-editor` مع غياب المصادقة، والتصفية بكل الأوجه، وحتمية
// التصدير، وطيّ الأقدم عند الحدّ بلا فقدان آخر تغيير.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import type { EngineRule, StudioAuditEntry } from '@/lib/tashjeer/model/v8';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  vi.resetModules();
});

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'er-a',
    name: 'لا تدمج الفرش مع المد',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [] },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 100,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function entry(overrides: Partial<StudioAuditEntry> = {}): StudioAuditEntry {
  return {
    id: 'aud-1',
    at: '2026-02-01T10:00:00.000Z',
    actor: 'local-editor',
    action: 'RULE_UPDATED',
    ruleId: 'er-a',
    ruleName: 'قاعدة أ',
    summary: 'تعديل قاعدة «قاعدة أ»',
    ...overrides,
  };
}

describe('بناء القيد', () => {
  it('يكتمل بكل عناصر التدقيق المطلوبة', async () => {
    const { createAuditEntry } = await import('@/lib/tashjeer/rule-audit');
    const audit = createAuditEntry({
      action: 'RULE_UPDATED',
      before: rule({ priority: 80 }),
      after: rule({ priority: 100, version: 2 }),
      reason: 'تقديم القاعدة على مصفوفة الدمج',
      at: '2026-03-01T09:00:00.000Z',
    });
    expect(audit.actor).toBe('local-editor'); // User الافتراضي
    expect(audit.action).toBe('RULE_UPDATED'); // Action
    expect(audit.ruleId).toBe('er-a'); // Rule
    expect(audit.at).toBe('2026-03-01T09:00:00.000Z'); // Timestamp
    expect(audit.reason).toBe('تقديم القاعدة على مصفوفة الدمج'); // Reason
    // Before/After
    const priority = audit.changes?.find((change) => change.field === 'priority');
    expect(priority?.before).toBe(80);
    expect(priority?.after).toBe(100);
    expect(audit.summary).toContain('الأولوية');
    expect(audit.version).toBe(2);
  });

  it('يحترم منفّذًا صريحًا (بنية المصادقة جاهزة)', async () => {
    const { createAuditEntry, DEFAULT_AUDIT_ACTOR } = await import('@/lib/tashjeer/rule-audit');
    expect(DEFAULT_AUDIT_ACTOR).toBe('local-editor');
    expect(createAuditEntry({ action: 'RULE_DELETED', actor: 'muhaqqiq-1' }).actor).toBe('muhaqqiq-1');
  });

  it('يعلّم التجاوز حين يُتخطّى تحذير', async () => {
    const { createAuditEntry } = await import('@/lib/tashjeer/rule-audit');
    const audit = createAuditEntry({
      action: 'REGRESSION_OVERRIDE',
      ruleId: 'er-a',
      reason: 'الانحدار مقصود: تغيّرت السياسة',
      override: true,
    });
    expect(audit.override).toBe(true);
    expect(audit.summary).toContain('تجاوز انحدار');
  });
});

describe('التصفية (FR-ES-07.6: قابلة للتصفية)', () => {
  const entries: StudioAuditEntry[] = [
    entry({ id: 'a1', at: '2026-02-03T10:00:00.000Z', action: 'RULE_UPDATED', actor: 'local-editor', ruleId: 'er-a' }),
    entry({ id: 'a2', at: '2026-02-02T10:00:00.000Z', action: 'RULE_DELETED', actor: 'muhaqqiq', ruleId: 'er-b', ruleName: 'قاعدة ب' }),
    entry({ id: 'a3', at: '2026-02-01T10:00:00.000Z', action: 'REGRESSION_OVERRIDE', override: true, ruleId: 'er-a' }),
  ];

  it('بلا مرشّحات يعيد الكل', async () => {
    const { filterAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    expect(filterAuditEntries(entries)).toHaveLength(3);
  });

  it('بالمنفّذ والفعل والقاعدة', async () => {
    const { filterAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    expect(filterAuditEntries(entries, { actor: 'muhaqqiq' }).map((item) => item.id)).toEqual(['a2']);
    expect(filterAuditEntries(entries, { actions: ['RULE_UPDATED', 'RULE_DELETED'] })).toHaveLength(2);
    expect(filterAuditEntries(entries, { ruleId: 'er-a' }).map((item) => item.id)).toEqual(['a1', 'a3']);
  });

  it('بالمدى الزمني ونص البحث والتجاوز فقط', async () => {
    const { filterAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    expect(
      filterAuditEntries(entries, { from: '2026-02-02T00:00:00.000Z', to: '2026-02-02T23:59:59.000Z' })
    ).toHaveLength(1);
    expect(filterAuditEntries(entries, { query: 'قاعدة ب' }).map((item) => item.id)).toEqual(['a2']);
    expect(filterAuditEntries(entries, { overrideOnly: true }).map((item) => item.id)).toEqual(['a3']);
    expect(filterAuditEntries(entries, { limit: 2 })).toHaveLength(2);
  });

  it('يشتق أوجه التصفية وعدّادات الأفعال من السجل', async () => {
    const { auditFacets, countByAction } = await import('@/lib/tashjeer/rule-audit');
    const facets = auditFacets(entries);
    expect(facets.actors).toEqual(['local-editor', 'muhaqqiq']);
    expect(facets.rules.map((item) => item.id)).toEqual(['er-a', 'er-b']);
    expect(facets.days[0]).toBe('2026-02-03');
    // التعادل في العدد يُحسم أبجديًا (حتمية لا ترتيب اكتشاف).
    expect(countByAction(entries).map((item) => item.action)).toEqual([
      'REGRESSION_OVERRIDE',
      'RULE_DELETED',
      'RULE_UPDATED',
    ]);
  });
});

describe('التصدير الحتمي (DM-13)', () => {
  it('نفس السجل يعطي نفس النص بايتًا ولو اختلف ترتيب المدخلات', async () => {
    const { serializeAuditTrail } = await import('@/lib/tashjeer/rule-audit');
    const first = serializeAuditTrail(entries());
    const second = serializeAuditTrail(entries().reverse());
    expect(second).toBe(first);

    function entries(): StudioAuditEntry[] {
      return [
        entry({ id: 'a1', at: '2026-02-01T10:00:00.000Z', changes: [{ field: 'priority', label: 'الأولوية', before: 80, after: 100 }] }),
        entry({ id: 'a2', at: '2026-02-02T10:00:00.000Z' }),
      ];
    }
  });

  it('يرتّب بالوقت ثم المعرّف ويعرض الحقول بترتيب ثابت', async () => {
    const { toCanonicalAuditTrail } = await import('@/lib/tashjeer/rule-audit');
    const canonical = toCanonicalAuditTrail([
      entry({ id: 'b', at: '2026-02-05T10:00:00.000Z' }),
      entry({ id: 'a', at: '2026-02-01T10:00:00.000Z' }),
    ]);
    expect(canonical.map((item) => item.id)).toEqual(['a', 'b']);
    expect(Object.keys(canonical[0]!)).toEqual(['id', 'at', 'actor', 'action', 'ruleId', 'ruleName', 'summary']);
  });
});

describe('التخزين: الإضافة والطيّ', () => {
  it('يضيف الأحدث أولًا ويقرأ السجل', async () => {
    const { recordAudit, listAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    recordAudit({ action: 'RULE_CREATED', ruleId: 'er-a', at: '2026-01-01T00:00:00.000Z' });
    recordAudit({ action: 'RULE_UPDATED', ruleId: 'er-a', at: '2026-01-02T00:00:00.000Z' });
    const stored = listAuditEntries();
    expect(stored).toHaveLength(2);
    expect(stored[0]?.action).toBe('RULE_UPDATED');
  });

  it('يطوي الأقدم عند الحدّ فلا يضيع آخر تغيير', async () => {
    const { AUDIT_LIMIT, appendAuditEntry, listAuditEntries, clearAuditTrail } = await import(
      '@/lib/tashjeer/rule-audit'
    );
    clearAuditTrail();
    for (let index = 0; index < AUDIT_LIMIT + 25; index += 1) {
      appendAuditEntry(entry({ id: `a${index}`, at: `2026-03-01T00:00:${String(index % 60).padStart(2, '0')}.000Z` }));
    }
    const stored = listAuditEntries();
    expect(stored.length).toBe(AUDIT_LIMIT);
    // الأحدث (آخر ما أُضيف) يبقى أولًا.
    expect(stored[0]?.id).toBe(`a${AUDIT_LIMIT + 24}`);
  });

  it('يستبدل السجل عند استيراد حزمة حوكمة', async () => {
    const { recordAudit, replaceAuditTrail, listAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    recordAudit({ action: 'RULE_CREATED', ruleId: 'er-a' });
    replaceAuditTrail([entry({ id: 'imported' })]);
    expect(listAuditEntries().map((item) => item.id)).toEqual(['imported']);
  });
});

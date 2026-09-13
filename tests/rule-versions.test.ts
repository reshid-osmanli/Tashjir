// اختبارات سلسلة إصدارات القاعدة والرجوع — Rule Versioning (FR-ES-07.3)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس معيار القبول ٣ حرفيًا: تعديل قاعدة ٣ مرات ← ٣ إصدارات بالأسباب ←
// الرجوع لإصدار ١ يعمل ويُنشئ v4 موثّقًا ولا يفقد شيئًا. ومعها: الحفظ المكرر
// لا يُنفخ السلسلة، والفرق بين إصدارين، وحتمية التصدير.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import type { EngineRule, EngineRuleVersion } from '@/lib/tashjeer/model/v8';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  vi.resetModules();
});

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'er-merge-farsh',
    name: 'لا تدمج الفرش مع المد',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }] },
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

describe('التقاط الإصدارات', () => {
  it('كل حفظ يُنشئ إصدارًا جديدًا بالرقم التالي والسبب والمنفّذ', async () => {
    const { recordVersion } = await import('@/lib/tashjeer/rule-versions');
    let chain: EngineRuleVersion[] = [];

    const first = recordVersion(chain, {
      rule: rule({ version: 1 }),
      source: 'CREATE',
      by: 'local-editor',
      reason: 'إنشاء القاعدة',
      at: '2026-01-01T00:00:00.000Z',
    });
    chain = first.chain;
    expect(first.entry?.version).toBe(1);

    const second = recordVersion(chain, {
      rule: rule({ version: 2, priority: 90 }),
      source: 'EDIT',
      reason: 'خفض الأولوية تحت قاعدة المنع',
      at: '2026-01-02T00:00:00.000Z',
    });
    chain = second.chain;
    expect(second.entry?.version).toBe(2);
    expect(second.entry?.by).toBe('local-editor');
    expect(chain).toHaveLength(2);
  });

  it('حفظ مطابق لا يُضيف إصدارًا (لا نفخ للسلسلة)', async () => {
    const { recordVersion } = await import('@/lib/tashjeer/rule-versions');
    const first = recordVersion([], { rule: rule(), source: 'CREATE' });
    const again = recordVersion(first.chain, {
      rule: rule({ version: 5, updatedAt: '2026-05-05T00:00:00.000Z' }),
      source: 'EDIT',
    });
    expect(again.entry).toBeNull();
    expect(again.chain).toHaveLength(1);
  });

  it('اللقطة لا تتأثر بتغيير لاحق (غير قابلة للتغيير)', async () => {
    const { recordVersion } = await import('@/lib/tashjeer/rule-versions');
    const live = rule();
    const { chain, entry } = recordVersion([], { rule: live, source: 'CREATE' });
    live.priority = 10; // تغيير الكائن الحي بعد الالتقاط
    live.name = 'تغيّر الاسم';
    expect(entry?.rule.priority).toBe(100);
    expect(chain[0]?.rule.name).toBe('لا تدمج الفرش مع المد');
  });
});

describe('معيار القبول ٣: ثلاثة تعديلات ثم رجوع', () => {
  it('٣ تعديلات ← ٣ إصدارات بالأسباب ← الرجوع لإصدار ١ يُنشئ v4 ولا يفقد شيئًا', async () => {
    const { recordVersion, rollbackToVersion, diffVersions, isChainIntact } = await import(
      '@/lib/tashjeer/rule-versions'
    );

    let chain = recordVersion([], {
      rule: rule({ version: 1, priority: 100 }),
      source: 'CREATE',
      reason: 'إنشاء',
      at: '2026-01-01T00:00:00.000Z',
    }).chain;

    // التعديل الأول.
    chain = recordVersion(chain, {
      rule: rule({ version: 2, priority: 90 }),
      source: 'EDIT',
      reason: 'خفض الأولوية',
      at: '2026-01-02T00:00:00.000Z',
    }).chain;

    // التعديل الثاني.
    chain = recordVersion(chain, {
      rule: rule({ version: 3, priority: 90, status: 'DISABLED' }),
      source: 'STATUS',
      reason: 'تعطيل مؤقت للمراجعة',
      at: '2026-01-03T00:00:00.000Z',
    }).chain;

    // التعديل الثالث.
    chain = recordVersion(chain, {
      rule: rule({ version: 4, priority: 95, status: 'DISABLED', name: 'لا تدمج الفرش مع المد (معدّلة)' }),
      source: 'EDIT',
      reason: 'محاولة صياغة أعمّ',
      at: '2026-01-04T00:00:00.000Z',
    }).chain;

    expect(chain).toHaveLength(4); // v1 (إنشاء) + ٣ تعديلات
    expect(isChainIntact(chain)).toBe(true);
    expect(chain.every((entry) => Boolean(entry.reason))).toBe(true);
    expect(chain.map((entry) => entry.version)).toEqual([1, 2, 3, 4]);

    // الرجوع إلى الإصدار ١.
    const rollback = rollbackToVersion(chain, 1, {
      reason: 'الصياغة الأولى أدقّ — رجوع موثّق',
      at: '2026-01-05T00:00:00.000Z',
    });
    expect(rollback).not.toBeNull();
    expect(rollback!.entry.version).toBe(5);
    expect(rollback!.entry.source).toBe('ROLLBACK');
    expect(rollback!.entry.rollbackOf).toBe(1);
    expect(rollback!.entry.reason).toContain('رجوع موثّق');

    // المحتوى = محتوى الإصدار ١، ورقم الإصدار جديد.
    expect(rollback!.rule.priority).toBe(100);
    expect(rollback!.rule.status).toBe('ACTIVE');
    expect(rollback!.rule.name).toBe('لا تدمج الفرش مع المد');
    expect(rollback!.rule.version).toBe(5);
    expect(rollback!.rule.id).toBe('er-merge-farsh'); // المعرّف مقدّس لا يتغيّر

    // لا شيء فُقد: الإصدارات الوسيطة كلها باقية.
    expect(rollback!.chain).toHaveLength(5);
    expect(rollback!.chain.map((entry) => entry.version)).toEqual([1, 2, 3, 4, 5]);
    expect(rollback!.chain[1]?.rule.priority).toBe(90);
    expect(rollback!.chain[3]?.rule.name).toContain('(معدّلة)');

    // الفرق بين إصدارين بحقول القاعدة.
    const diff = diffVersions(rollback!.chain, 4, 5);
    expect(diff.from?.version).toBe(4);
    expect(diff.to?.version).toBe(5);
    expect(diff.changes.map((change) => change.field)).toEqual(
      expect.arrayContaining(['name', 'priority', 'status'])
    );
  });

  it('الرجوع لإصدار غير موجود يعيد null (لا تلف صامت)', async () => {
    const { recordVersion, rollbackToVersion } = await import('@/lib/tashjeer/rule-versions');
    const chain = recordVersion([], { rule: rule(), source: 'CREATE' }).chain;
    expect(rollbackToVersion(chain, 9)).toBeNull();
  });
});

describe('ملخّص السلسلة وتنبيه الحجم', () => {
  it('بلا حد أعلى للإصدارات، وتنبيه حجم بعد ٥٠', async () => {
    const { RULE_VERSION_SIZE_NOTICE, chainSummary, recordVersion } = await import(
      '@/lib/tashjeer/rule-versions'
    );
    expect(RULE_VERSION_SIZE_NOTICE).toBe(50);
    let chain: EngineRuleVersion[] = [];
    for (let index = 0; index < RULE_VERSION_SIZE_NOTICE + 1; index += 1) {
      chain = recordVersion(chain, { rule: rule({ version: index + 1, priority: index }), source: 'EDIT' }).chain;
    }
    const summary = chainSummary(chain);
    expect(summary.count).toBe(RULE_VERSION_SIZE_NOTICE + 1); // لم يُحذف شيء
    expect(summary.latest).toBe(RULE_VERSION_SIZE_NOTICE + 1);
    expect(summary.sizeNotice).toBe(true);
  });
});

describe('التخزين والتصدير', () => {
  it('يحفظ السلسلة ويقرأها ويضمن نسخة أساس', async () => {
    const { ensureBaseVersion, getRuleVersionChain, recordRuleVersion, rollbackRuleVersion } = await import(
      '@/lib/tashjeer/rule-versions'
    );
    expect(getRuleVersionChain('er-merge-farsh')).toHaveLength(0);
    ensureBaseVersion(rule());
    expect(getRuleVersionChain('er-merge-farsh')).toHaveLength(1);
    // إعادة الضمان لا تُكرّر الأساس.
    ensureBaseVersion(rule());
    expect(getRuleVersionChain('er-merge-farsh')).toHaveLength(1);

    recordRuleVersion({ rule: rule({ priority: 70 }), source: 'EDIT', reason: 'تعديل' });
    expect(getRuleVersionChain('er-merge-farsh')).toHaveLength(2);

    const rollback = rollbackRuleVersion('er-merge-farsh', 1, { reason: 'رجوع' });
    expect(rollback?.entry.version).toBe(3);
    expect(getRuleVersionChain('er-merge-farsh')).toHaveLength(3);
  });

  it('التصدير حتمي: نفس السلاسل تعطي نفس النص ولو اختلف ترتيب الإدخال', async () => {
    const { recordVersion, serializeRuleVersions, toCanonicalVersions } = await import(
      '@/lib/tashjeer/rule-versions'
    );
    const a = recordVersion([], { rule: rule({ id: 'er-a' }), source: 'CREATE', at: '2026-01-01T00:00:00.000Z' }).chain;
    const b = recordVersion([], { rule: rule({ id: 'er-b' }), source: 'CREATE', at: '2026-01-01T00:00:00.000Z' }).chain;
    const first = serializeRuleVersions([...a, ...b]);
    const second = serializeRuleVersions([...b, ...a]);
    expect(second).toBe(first);
    expect(toCanonicalVersions([...b, ...a]).map((item) => item.ruleId)).toEqual(['er-a', 'er-b']);
  });
});

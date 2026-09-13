// اختبارات حوكمة تعديل القواعد — Rule Governance (FR-ES-07.2/.3/.5/.6)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس الطريق الواحد لكل تغيير: إصدار جديد في السلسلة + قيد تدقيق كامل
// (قبل/بعد/سبب/زمن/منفّذ)، والانتقالات المحاكمة (ممنوع/ناقص سبب)، والحذف الذي
// لا يُمحو معه التاريخ (استرجاع من السلسلة)، والوسم التلقائي للتعارض.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import {
  DEFAULT_CONFLICT_POLICY,
  DEFAULT_MERGE_MATRIX,
  DEFAULT_PRIORITY_GROUPS,
} from '@/lib/tashjeer/decision/policy';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  vi.resetModules();
});

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'er-farsh-madd',
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

describe('التغيير المحكوم: إصدار + تدقيق في خطوة واحدة', () => {
  it('التعديل يُسجَّل إصدارًا وقيدًا كاملًا', async () => {
    const { governRuleChange } = await import('@/lib/tashjeer/rule-governance');
    const { listAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    const { getRuleVersionChain } = await import('@/lib/tashjeer/rule-versions');

    const before = rule();
    const result = governRuleChange(
      config([before]),
      before,
      rule({ priority: 90 }),
      { reason: 'خفض الأولوية تحت قاعدة المنع', at: '2026-02-01T00:00:00.000Z' }
    );

    expect(result.changed).toBe(true);
    expect(result.version?.version).toBe(1);
    expect(result.config.rules[0]?.priority).toBe(90);
    expect(result.config.rules[0]?.version).toBe(1);
    expect(getRuleVersionChain('er-farsh-madd')).toHaveLength(1);

    const [audit] = listAuditEntries();
    expect(audit?.action).toBe('RULE_PRIORITY_CHANGED');
    expect(audit?.actor).toBe('local-editor');
    expect(audit?.reason).toBe('خفض الأولوية تحت قاعدة المنع');
    expect(audit?.changes?.find((change) => change.field === 'priority')).toEqual({
      field: 'priority',
      label: 'الأولوية',
      before: 100,
      after: 90,
    });
  });

  it('ثلاثة تعديلات متتالية ← ثلاثة إصدارات متّسقة مع رقم القاعدة', async () => {
    const { governRuleChange } = await import('@/lib/tashjeer/rule-governance');
    const { getRuleVersionChain } = await import('@/lib/tashjeer/rule-versions');

    let current = config([rule()]);
    const edits: Array<Partial<EngineRule>> = [{ priority: 95 }, { priority: 90 }, { status: 'DISABLED' }];
    let live = current.rules[0]!;
    for (const [index, patch] of edits.entries()) {
      const result = governRuleChange(current, live, { ...live, ...patch }, {
        reason: `تعديل ${index + 1}`,
        at: `2026-02-0${index + 1}T00:00:00.000Z`,
      });
      current = result.config;
      live = result.rule!;
    }

    const chain = getRuleVersionChain('er-farsh-madd');
    expect(chain.map((entry) => entry.version)).toEqual([1, 2, 3]);
    expect(chain.map((entry) => entry.reason)).toEqual(['تعديل 1', 'تعديل 2', 'تعديل 3']);
    expect(chain.map((entry) => entry.source)).toEqual(['PRIORITY', 'PRIORITY', 'STATUS']);
    expect(live.version).toBe(3);
    expect(current.rules[0]?.status).toBe('DISABLED');
  });

  it('الإنشاء يُسجَّل RULE_CREATED وإصدارًا أولًا', async () => {
    const { governRuleCreate } = await import('@/lib/tashjeer/rule-governance');
    const { listAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    const created = rule({ id: 'er-new', name: 'قاعدة جديدة', version: 1 });
    const result = governRuleCreate(config([]), created, { reason: 'حاجة تحريرية' });
    expect(result.config.rules).toHaveLength(1);
    expect(result.version?.source).toBe('CREATE');
    expect(listAuditEntries()[0]?.action).toBe('RULE_CREATED');
  });

  it('حفظ مطابق لا يُسجَّل (لا ضجيج في السجل)', async () => {
    const { governRuleChange } = await import('@/lib/tashjeer/rule-governance');
    const { getRuleVersionChain } = await import('@/lib/tashjeer/rule-versions');
    const before = rule();
    governRuleChange(config([before]), null, before, { reason: 'إنشاء' });
    const again = governRuleChange(config([before]), before, { ...before }, { reason: 'بلا تغيير' });
    expect(again.changed).toBe(false);
    expect(again.version).toBeNull();
    expect(getRuleVersionChain('er-farsh-madd')).toHaveLength(1);
  });
});

describe('الرجوع الموثّق (FR-ES-07.3.2)', () => {
  it('يرفض الرجوع بلا سبب مكتوب', async () => {
    const { governRollback, governRuleChange } = await import('@/lib/tashjeer/rule-governance');
    const before = rule();
    const first = governRuleChange(config([before]), null, before, { reason: 'إنشاء' });
    const result = governRollback(first.config, 'er-farsh-madd', 1, {});
    expect('error' in result).toBe(true);
  });

  it('ينشئ إصدارًا جديدًا ولا يحذف الوسيط', async () => {
    const { governRollback, governRuleChange } = await import('@/lib/tashjeer/rule-governance');
    const { getRuleVersionChain } = await import('@/lib/tashjeer/rule-versions');
    const { listAuditEntries } = await import('@/lib/tashjeer/rule-audit');

    const v1 = rule({ priority: 100 });
    let result = governRuleChange(config([v1]), null, v1, { reason: 'إنشاء' });
    let live = result.rule!;
    result = governRuleChange(result.config, live, { ...live, priority: 90 }, { reason: 'خفض' });
    live = result.rule!;
    result = governRuleChange(result.config, live, { ...live, priority: 80 }, { reason: 'خفض آخر' });

    const rollback = governRollback(result.config, 'er-farsh-madd', 1, {
      reason: 'الأولوية الأصلية أدقّ',
      at: '2026-03-01T00:00:00.000Z',
    });
    expect('error' in rollback).toBe(false);
    if ('error' in rollback) return;

    expect(rollback.rule?.priority).toBe(100); // محتوى الإصدار ١
    expect(rollback.version?.version).toBe(4); // إصدار جديد
    expect(rollback.version?.source).toBe('ROLLBACK');
    expect(rollback.version?.rollbackOf).toBe(1);
    expect(rollback.config.rules[0]?.version).toBe(4);

    const chain = getRuleVersionChain('er-farsh-madd');
    expect(chain.map((entry) => entry.version)).toEqual([1, 2, 3, 4]); // لا حذف للوسيط
    expect(chain[1]?.rule.priority).toBe(90);
    expect(chain[2]?.rule.priority).toBe(80);

    const audit = listAuditEntries()[0];
    expect(audit?.action).toBe('RULE_ROLLED_BACK');
    expect(audit?.reason).toBe('الأولوية الأصلية أدقّ');
    expect(audit?.summary).toContain('دون حذف الإصدارات الوسيطة');
  });
});

describe('تغيير الحالة المحكوم', () => {
  it('يرفض انتقالًا غير مسموح', async () => {
    const { governStatusChange } = await import('@/lib/tashjeer/rule-governance');
    const result = governStatusChange(config([rule({ status: 'DRAFT' })]), 'er-farsh-madd', 'DEPRECATED');
    expect('error' in result && result.error).toBeTruthy();
  });

  it('يرفض انتقالًا يحتاج سببًا بلا سبب', async () => {
    const { governStatusChange } = await import('@/lib/tashjeer/rule-governance');
    const result = governStatusChange(config([rule()]), 'er-farsh-madd', 'DISABLED');
    expect('error' in result && result.error).toContain('سبب');
  });

  it('القاعدة المحمية لا تُغيَّر حالتها بلا سبب مكتوب', async () => {
    const { governStatusChange } = await import('@/lib/tashjeer/rule-governance');
    const protectedDraft = rule({ protected: true, status: 'DRAFT' });
    const blocked = governStatusChange(config([protectedDraft]), 'er-farsh-madd', 'ACTIVE', {});
    expect('error' in blocked && blocked.error).toContain('محمية');

    const allowed = governStatusChange(config([protectedDraft]), 'er-farsh-madd', 'ACTIVE', {
      reason: 'اعتماد موثّق بعد الاختبار',
    });
    expect('error' in allowed).toBe(false);
    if ('error' in allowed) return;
    expect(allowed.rule?.status).toBe('ACTIVE');
  });

  it('الاعتماد من مسودة إلى مفعّلة يُسجَّل إصدارًا وتدقيقًا', async () => {
    const { governStatusChange } = await import('@/lib/tashjeer/rule-governance');
    const { listAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    const result = governStatusChange(config([rule({ status: 'DRAFT' })]), 'er-farsh-madd', 'ACTIVE', {
      reason: 'نجحت اختبارات القاعدة',
      at: '2026-04-01T00:00:00.000Z',
    });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.rule?.status).toBe('ACTIVE');
    expect(result.version?.source).toBe('STATUS');
    const audit = listAuditEntries()[0];
    expect(audit?.action).toBe('RULE_STATUS_CHANGED');
    expect(audit?.changes?.find((change) => change.field === 'status')?.after).toBe('ACTIVE');
  });
});

describe('الحذف لا يمحو التاريخ (FR-ES-07.2.2)', () => {
  it('يُزيل القاعدة من الملف وتبقى سلسلتها، وتسترجع', async () => {
    const { governRuleChange, governRuleRemoval, restoreDeletedRule } = await import(
      '@/lib/tashjeer/rule-governance'
    );
    const { getRuleVersionChain } = await import('@/lib/tashjeer/rule-versions');
    const { listAuditEntries } = await import('@/lib/tashjeer/rule-audit');

    const created = governRuleChange(config([rule()]), null, rule(), { reason: 'إنشاء' });
    const removed = governRuleRemoval(created.config, created.rule!, { reason: 'قاعدة مكرّرة' });
    expect(removed.config.rules).toHaveLength(0);
    expect(getRuleVersionChain('er-farsh-madd')).toHaveLength(1); // التاريخ باقٍ
    expect(listAuditEntries()[0]?.action).toBe('RULE_DELETED');
    expect(listAuditEntries()[0]?.changes?.[0]).toEqual({
      field: 'presence',
      label: 'الوجود في ملف المحرك',
      before: 'موجودة',
      after: 'محذوفة',
    });

    const restored = restoreDeletedRule(removed.config, 'er-farsh-madd', { reason: 'تبيّن أنها لازمة' });
    expect(restored?.config.rules).toHaveLength(1);
    expect(restored?.rule?.status).toBe('DISABLED'); // لا تُفعَّل صامتة
    expect(restored?.version?.version).toBe(2);
  });
});

describe('الوسم التلقائي للتعارض', () => {
  it('يسم الطرفين المتعارضين ويُسجّل كل تغيير', async () => {
    const { governConflictSync } = await import('@/lib/tashjeer/rule-governance');
    const { listAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    // تعادل كامل (نفس الأولوية والخصوصية والصلابة المرنة): لا خطوة في السلم
    // تحسم، فيُرجَّح الأول بالمعرّف — وهذا هو التعارض غير المحسوم.
    const tie = [
      rule({ id: 'er-allow', name: 'ادمج', actions: [{ type: 'MERGE' }], priority: 80, hardness: 'SOFT' }),
      rule({ id: 'er-prevent', name: 'لا تدمج', actions: [{ type: 'PREVENT_MERGE' }], priority: 80, hardness: 'SOFT' }),
    ];
    const { config: tagged, result, audits } = governConflictSync(config(tie));
    expect(result.tagged).toHaveLength(2);
    expect(tagged.rules.every((item) => item.status === 'CONFLICTED')).toBe(true);
    expect(audits).toHaveLength(2);
    expect(listAuditEntries().every((entry) => entry.action === 'RULE_STATUS_CHANGED')).toBe(true);
    expect(listAuditEntries().every((entry) => entry.actor === 'engine-policy')).toBe(true);
    expect(tagged.rules).toHaveLength(2);
  });
});

describe('أفعال على مستوى الملف', () => {
  it('يسجّل النشر والاستيراد والاسترجاع', async () => {
    const { recordProfileAction } = await import('@/lib/tashjeer/rule-governance');
    const { listAuditEntries } = await import('@/lib/tashjeer/rule-audit');
    recordProfileAction('PROFILE_PUBLISHED', config([rule()]), { reason: 'نشر بعد الاختبار' });
    recordProfileAction('PROFILE_IMPORTED', config([rule()]));
    const entries = listAuditEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.action).toBe('PROFILE_IMPORTED');
    expect(entries[1]?.summary).toContain('نشر بعد الاختبار');
  });

  it('يضمن نسخة أساس لكل قاعدة (نقطة انطلاق للرجوع)', async () => {
    const { ensureRuleBaselines } = await import('@/lib/tashjeer/rule-governance');
    const { getRuleVersionChain } = await import('@/lib/tashjeer/rule-versions');
    ensureRuleBaselines([rule(), rule({ id: 'er-other' })]);
    expect(getRuleVersionChain('er-farsh-madd')).toHaveLength(1);
    expect(getRuleVersionChain('er-other')).toHaveLength(1);
    ensureRuleBaselines([rule()]);
    expect(getRuleVersionChain('er-farsh-madd')).toHaveLength(1);
  });
});

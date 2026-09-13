// اختبارات تكامل مخزن الاستوديو — Engine Studio Store Integration
// مشروع التشجير - نظام القراءات العشر
//
// تختبر **سير الصفحة كاملًا** كما ينفّذه المستخدم: تحميل ← إنشاء/تعديل ←
// تغيير حالة محكوم ← رجوع ← حذف واسترجاع ← تشغيل اختبارات ← تصدير حزمة
// الحوكمة. الوحدات النقيّة مختبرة وحدها؛ وهنا يُتحقق أن المخزن يربطها فعلًا
// وأن كل تغيير يمرّ طريق الحوكمة الواحد (إصدار + تدقيق).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import type { EngineRule } from '@/lib/tashjeer/model/v8';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  vi.resetModules();
});

async function store() {
  const module = await import('@/stores/engine-config-ui-store');
  return module.useEngineStudioStore;
}

function draft(overrides: Partial<EngineRule> = {}): Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'> {
  return {
    id: 'er-new',
    name: 'قاعدة جديدة',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 70,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'DRAFT',
    testCases: [{ name: 'مد + تحقيق ← دمج', input: { differenceType: 'MADD', relatedType: 'TAHQIQ' }, expected: 'MERGE' }],
    ...overrides,
  } as Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'>;
}

describe('التحميل ونسخ الأساس', () => {
  it('يحمّل سياسات النظام ويضمن إصدارًا أولًا لكل قاعدة ونسخة ملف أساس', async () => {
    const use = await store();
    use.getState().hydrate();
    const state = use.getState();

    expect(state.loaded).toBe(true);
    expect(state.config.rules.length).toBe(3); // قواعد النظام
    expect(state.versions.length).toBe(1); // نسخة الأساس للملف
    // لكل قاعدة سلسلة بإصدار أساس حتى يكون للرجوع نقطة انطلاق.
    for (const rule of state.config.rules) {
      expect(state.ruleVersions[rule.id]?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
    // إعادة التحميل لا تكرر العمل.
    use.getState().hydrate();
    expect(use.getState().config.rules.length).toBe(3);
  });

  it('يكشف التعارض غير المحسوم للعرض دون تعديل صامت', async () => {
    const use = await store();
    use.getState().hydrate();
    // قواعد النظام لا تتعارض (فروق أولوية وصلابة تحسمها).
    expect(use.getState().conflicts.size).toBe(0);
  });
});

describe('دورة التغيير المحكومة', () => {
  it('إنشاء ← تعديل ← تعديل: ثلاثة إصدارات وثلاثة قيود تدقيق', async () => {
    const use = await store();
    use.getState().hydrate();

    const created = use.getState().saveRule(draft(), { reason: 'حاجة تحريرية' });
    expect(created.ok).toBe(true);
    let state = use.getState();
    expect(state.config.rules.some((rule) => rule.id === 'er-new')).toBe(true);
    expect(state.ruleVersions['er-new']).toHaveLength(1);
    expect(state.audit[0]?.action).toBe('RULE_CREATED');
    expect(state.dirty).toBe(true);

    use.getState().updateRule('er-new', { priority: 65 }, { reason: 'خفض الأولوية' });
    state = use.getState();
    expect(state.ruleVersions['er-new']).toHaveLength(2);
    expect(state.config.rules.find((rule) => rule.id === 'er-new')?.version).toBe(2);
    expect(state.audit[0]?.action).toBe('RULE_PRIORITY_CHANGED');
    expect(state.audit[0]?.changes?.find((change) => change.field === 'priority')?.after).toBe(65);

    use.getState().updateRule('er-new', { name: 'قاعدة معدّلة' }, { reason: 'تصحيح الاسم' });
    state = use.getState();
    expect(state.ruleVersions['er-new']).toHaveLength(3);
    expect(state.audit[0]?.action).toBe('RULE_UPDATED');
    expect(state.audit.map((entry) => entry.reason)).toContain('تصحيح الاسم');
  });

  it('يرفض تغيير حالة غير مسموح أو ناقص السبب', async () => {
    const use = await store();
    use.getState().hydrate();
    use.getState().saveRule(draft());

    // DRAFT ← DEPRECATED ممنوع في دورة الحالة.
    const denied = use.getState().setRuleStatusAction('er-new', 'DEPRECATED');
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain('غير مسموح');

    // DRAFT ← ACTIVE اعتماد بلا سبب إلزامي: يُقبل.
    const approved = use.getState().setRuleStatusAction('er-new', 'ACTIVE');
    expect(approved.ok).toBe(true);
    expect(use.getState().config.rules.find((rule) => rule.id === 'er-new')?.status).toBe('ACTIVE');

    // ACTIVE ← DISABLED يحتاج سببًا إلزاميًا.
    const noReason = use.getState().setRuleStatusAction('er-new', 'DISABLED');
    expect(noReason.ok).toBe(false);
    expect(noReason.error).toContain('سبب');
    const withReason = use.getState().setRuleStatusAction('er-new', 'DISABLED', { reason: 'مراجعة' });
    expect(withReason.ok).toBe(true);
    expect(use.getState().audit[0]?.action).toBe('RULE_STATUS_CHANGED');
  });

  it('القاعدة المحمية تحتاج سببًا لتغيير حالتها', async () => {
    const use = await store();
    use.getState().hydrate();
    const systemRule = use.getState().config.rules.find((rule) => rule.protected)!;
    const blocked = use.getState().setRuleStatusAction(systemRule.id, 'DISABLED');
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toContain('سبب');
    const allowed = use.getState().setRuleStatusAction(systemRule.id, 'DISABLED', {
      reason: 'إيقاف موثّق للمراجعة',
    });
    expect(allowed.ok).toBe(true);
  });

  it('الرجوع الموثّق يُنشئ إصدارًا جديدًا ولا يحذف الوسيط', async () => {
    const use = await store();
    use.getState().hydrate();
    use.getState().saveRule(draft({ priority: 100 }));
    use.getState().updateRule('er-new', { priority: 90 }, { reason: 'أول تعديل' });
    use.getState().updateRule('er-new', { priority: 80 }, { reason: 'ثاني تعديل' });
    expect(use.getState().ruleVersions['er-new']).toHaveLength(3);

    const noReason = use.getState().rollbackRule('er-new', 1, {});
    expect(noReason.ok).toBe(false);

    const rollback = use.getState().rollbackRule('er-new', 1, { reason: 'الأولوية الأولى أدقّ' });
    expect(rollback.ok).toBe(true);
    const state = use.getState();
    expect(state.config.rules.find((rule) => rule.id === 'er-new')?.priority).toBe(100);
    expect(state.ruleVersions['er-new']).toHaveLength(4);
    expect(state.ruleVersions['er-new']![3]?.source).toBe('ROLLBACK');
    expect(state.ruleVersions['er-new']![3]?.rollbackOf).toBe(1);
    expect(state.audit[0]?.action).toBe('RULE_ROLLED_BACK');
  });

  it('الحذف يُبقي السلسلة، والاسترجاع يعيدها معطّلة', async () => {
    const use = await store();
    use.getState().hydrate();
    use.getState().saveRule(draft());
    use.getState().removeRule('er-new', { reason: 'مكرّرة' });

    let state = use.getState();
    expect(state.config.rules.some((rule) => rule.id === 'er-new')).toBe(false);
    expect(state.ruleVersions['er-new']?.length).toBeGreaterThan(0); // التاريخ باقٍ
    expect(state.audit[0]?.action).toBe('RULE_DELETED');

    const restored = use.getState().restoreRule('er-new', { reason: 'تبيّن أنها لازمة' });
    expect(restored.ok).toBe(true);
    state = use.getState();
    const rule = state.config.rules.find((item) => item.id === 'er-new');
    expect(rule?.status).toBe('DISABLED');
    expect(state.ruleVersions['er-new']).toHaveLength(2);
  });
});

describe('الوسم التلقائي للتعارض', () => {
  // شرط على نوع اختلاف لا تستعمله قواعد النظام المرجعية، حتى يبقى التعارض
  // الذي نقيسه هنا محصورًا في القاعدتين المُنشأتين (ولا يختلط بتعارض آخر
  // مشروع مع قاعدة نظام على «MADD» بنفس الأولوية والصلابة).
  const hamz = { all: [{ field: 'differenceType', op: 'equals', value: 'HAMZ' }] } as EngineRule['conditions'];

  it('يكتب CONFLICTED موثّقة ويرفعها عند الحسم', async () => {
    const use = await store();
    use.getState().hydrate();
    // الكشف يسري على القواعد **النافذة** فقط (المسودة لا تؤثر في المحرك).
    use.getState().saveRule(
      draft({
        id: 'er-allow',
        name: 'ادمج',
        conditions: hamz,
        actions: [{ type: 'MERGE' }],
        priority: 80,
        status: 'ACTIVE',
      })
    );
    use.getState().saveRule(
      draft({
        id: 'er-prevent',
        name: 'لا تدمج',
        conditions: hamz,
        actions: [{ type: 'PREVENT_MERGE' }],
        priority: 80,
        status: 'ACTIVE',
      })
    );
    // الكشف يظهر للعرض قبل أي كتابة: القاعدتان وحدهما متعارضتان.
    expect(use.getState().conflicts.size).toBe(2);
    expect([...use.getState().conflicts.keys()].sort()).toEqual(['er-allow', 'er-prevent']);

    const applied = use.getState().syncConflictTags({ reason: 'مزامنة تلقائية', actor: 'engine-policy' });
    expect(applied.tagged).toBe(2);
    expect(applied.cleared).toBe(0);
    const state = use.getState();
    expect(state.config.rules.filter((rule) => rule.status === 'CONFLICTED')).toHaveLength(2);
    expect(state.audit.filter((entry) => entry.action === 'RULE_STATUS_CHANGED')).toHaveLength(2);

    // الحسم (رفع أولوية إحداهما) يرفع الوسم تلقائيًا.
    use.getState().updateRule('er-prevent', { priority: 100 }, { reason: 'حسم التعارض بالأولوية' });
    const cleared = use.getState().syncConflictTags({ reason: 'مزامنة بعد الحسم', actor: 'engine-policy' });
    expect(cleared.cleared).toBe(2);
    expect(use.getState().config.rules.filter((rule) => rule.status === 'CONFLICTED')).toHaveLength(0);
  });

  it('يكشف تعارض قاعدة محرّر مع قاعدة نظام مرجعية (لا يُخفيه)', async () => {
    const use = await store();
    use.getState().hydrate();
    // قاعدة محرّر تمنع الدمج على «MADD» بنفس أولوية وصلابة قاعدة النظام التي
    // تدمج المد مع التحقيق ← تعارض حقيقي لا يحسمه السلم، فيُكشف للطرفين.
    use.getState().saveRule(
      draft({
        id: 'er-block-madd',
        name: 'لا تدمج المد إطلاقًا',
        conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
        actions: [{ type: 'PREVENT_MERGE' }],
        priority: 80,
        hardness: 'SOFT',
        status: 'ACTIVE',
      })
    );
    const conflicts = use.getState().conflicts;
    expect(conflicts.has('er-block-madd')).toBe(true);
    expect(conflicts.has('er-system-merge-madd-tahqiq')).toBe(true);
    expect(conflicts.get('er-block-madd')?.join(' ')).toContain('لم يحسم سلم السياسة');
  });
});

describe('الاختبارات والنشر والحزمة', () => {
  it('يشغّل الاختبارات ويسجّل التشغيل، والنشر يلتقط نسخة ويدقّق', async () => {
    const use = await store();
    use.getState().hydrate();
    const report = use.getState().runTests({ reason: 'تشغيل يدوي' });
    expect(report.total).toBeGreaterThan(0);
    expect(report.failed).toBe(0); // قواعد النظام المرجعية تنجح
    expect(use.getState().audit[0]?.action).toBe('TESTS_RUN');
    expect(use.getState().testReport?.passed).toBe(report.passed);

    use.getState().updateRule('er-system-merge-madd-tahqiq', { priority: 75 }, { reason: 'ضبط' });
    expect(use.getState().dirty).toBe(true);
    use.getState().persist('نشر بعد الاختبار');
    const state = use.getState();
    expect(state.dirty).toBe(false);
    expect(state.versions.length).toBeGreaterThanOrEqual(2);
    expect(state.audit[0]?.action).toBe('PROFILE_PUBLISHED');
    expect(state.audit[0]?.reason).toBe('نشر بعد الاختبار');
  });

  it('تصدير الحزمة واستيرادها يعيدان الإعداد والسجلين (جولة كاملة)', async () => {
    const use = await store();
    use.getState().hydrate();
    use.getState().saveRule(draft(), { reason: 'إنشاء' });
    use.getState().updateRule('er-new', { priority: 60 }, { reason: 'خفض' });
    const text = use.getState().exportBundleText();

    const { parseGovernanceBundle } = await import('@/lib/tashjeer/engine-governance');
    const parsed = parseGovernanceBundle(text);
    expect(parsed.validation.valid).toBe(true);
    expect(parsed.bundle!.config.rules.some((rule) => rule.id === 'er-new')).toBe(true);
    expect(parsed.bundle!.ruleVersions.length).toBeGreaterThan(0);
    expect(parsed.bundle!.auditTrail.length).toBeGreaterThan(0);
    expect(parsed.bundle!.testReport?.failed).toBe(0);

    // استيراد الحزمة في مخزن نظيف يعيد كل شيء.
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
    vi.resetModules();
    const fresh = await store();
    fresh.getState().hydrate();
    const result = fresh.getState().importText(text);
    expect(result.valid).toBe(true);
    const state = fresh.getState();
    expect(state.config.rules.some((rule) => rule.id === 'er-new')).toBe(true);
    expect(state.ruleVersions['er-new']?.length).toBeGreaterThan(0);
    expect(state.audit.some((entry) => entry.action === 'RULE_CREATED')).toBe(true);
    expect(state.audit[0]?.action).toBe('PROFILE_IMPORTED');
  });

  it('استيراد ملف إعداد مجرد ما يزال يعمل (لا يُكسر ملف قديم)', async () => {
    const use = await store();
    use.getState().hydrate();
    const plain = use.getState().exportText();
    expect(plain).not.toContain('tashjeer-engine-governance');

    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
    vi.resetModules();
    const fresh = await store();
    fresh.getState().hydrate();
    const result = fresh.getState().importText(plain);
    expect(result.valid).toBe(true);
    expect(fresh.getState().config.rules.length).toBe(3);
  });
});

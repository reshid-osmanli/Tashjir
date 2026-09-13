// اختبارات دورة حالة القاعدة — Rule Status Lifecycle (FR-ES-07.2)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس: الانتقالات المحكومة (لا قفزات)، والاعتماد والسبب الإلزامي، والحماية من
// التعديل بالخطأ (تحذير + عداد استخدام)، والوسم التلقائي CONFLICTED عند تعارض
// غير محسوم، ورفعه حين يُحسم — بلا حذف تاريخ ولا قواعد.

import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule, MergeMatrixEntry, RuleStatus } from '@/lib/tashjeer/model/v8';
import {
  DEFAULT_CONFLICT_POLICY,
  DEFAULT_MERGE_MATRIX,
  DEFAULT_PRIORITY_GROUPS,
} from '@/lib/tashjeer/decision/policy';
import {
  LIVE_STATUSES,
  allowedTransitions,
  buildEditGuard,
  canTransition,
  checkTransition,
  conflictedRuleReasons,
  findTransition,
  findUnresolvedConflicts,
  isLive,
  syncConflictTags,
} from '@/lib/tashjeer/rule-status-flow';

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'er-x',
    name: 'قاعدة',
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

function config(rules: EngineRule[], matrix: MergeMatrixEntry[] = DEFAULT_MERGE_MATRIX): EngineConfig {
  return {
    schemaVersion: 1,
    profile: 'testing',
    priorityGroups: DEFAULT_PRIORITY_GROUPS,
    rules,
    conflictPolicy: DEFAULT_CONFLICT_POLICY,
    executionOrder: ['MERGE'],
    mergeMatrix: matrix,
    contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
  };
}

describe('الانتقالات المحكومة', () => {
  it('المسودة تُعتمد إلى مفعّلة بخطوة اعتماد صريحة', () => {
    const transition = findTransition('DRAFT', 'ACTIVE');
    expect(transition?.label).toBe('اعتماد وتفعيل');
    expect(transition?.requiresApproval).toBe(true);
    expect(transition?.affectsEngine).toBe(true);
  });

  it('المفعّلة تُعطَّل وتُحال للتقاعد بسبب إلزامي', () => {
    expect(findTransition('ACTIVE', 'DISABLED')?.requiresReason).toBe(true);
    expect(findTransition('ACTIVE', 'DEPRECATED')?.requiresReason).toBe(true);
    expect(findTransition('ACTIVE', 'DEPRECATED')?.hint).toContain('لا تُحذف');
  });

  it('لا قفزات غير مسموحة', () => {
    expect(canTransition('DRAFT', 'DEPRECATED')).toBe(false);
    expect(canTransition('DEPRECATED', 'ACTIVE')).toBe(false); // تمرّ بالتعطيل أولًا
    expect(canTransition('ACTIVE', 'DRAFT')).toBe(false);
    expect(canTransition('ACTIVE', 'ACTIVE')).toBe(false);
  });

  it('المتقادمة تعود عبر المعطّلة لا مباشرة إلى التفعيل', () => {
    expect(canTransition('DEPRECATED', 'DISABLED')).toBe(true);
    expect(canTransition('DISABLED', 'ACTIVE')).toBe(true);
  });

  it('المتعارضة تُحسم ثم تُفعَّل بسبب موثّق', () => {
    const transition = findTransition('CONFLICTED', 'ACTIVE');
    expect(transition?.requiresApproval).toBe(true);
    expect(transition?.requiresReason).toBe(true);
  });

  it('يسرد الانتقالات المتاحة من كل حالة', () => {
    expect(allowedTransitions('DRAFT').map((item) => item.to)).toEqual(['ACTIVE', 'EXPERIMENTAL', 'DISABLED']);
    expect(allowedTransitions('DEPRECATED').map((item) => item.to)).toEqual(['DISABLED']);
  });
});

describe('فحص الانتقال قبل التنفيذ', () => {
  it('يمنع الانتقال غير المسموح ويعلّل', () => {
    const check = checkTransition('DRAFT', 'DEPRECATED');
    expect(check.allowed).toBe(false);
    expect(check.blockers[0]).toContain('غير مسموح');
  });

  it('يشترط السبب حين يلزم', () => {
    expect(checkTransition('ACTIVE', 'DISABLED').allowed).toBe(false);
    expect(checkTransition('ACTIVE', 'DISABLED', { reason: 'مراجعة' }).allowed).toBe(true);
  });

  it('القاعدة المحمية تحتاج سببًا وتأكيدًا إضافيًا', () => {
    const check = checkTransition('ACTIVE', 'DISABLED', { protected: true, reason: 'سبب مكتوب' });
    expect(check.requiresApproval).toBe(true);
    expect(check.requiresReason).toBe(true);
    expect(check.blockers.some((text) => text.includes('محمية'))).toBe(true);
  });

  it('الحالات النافذة معروفة (تُحتسب في التحذير)', () => {
    expect(LIVE_STATUSES).toEqual(['ACTIVE', 'EXPERIMENTAL', 'CONFLICTED']);
    expect(isLive(rule({ status: 'ACTIVE' }))).toBe(true);
    expect(isLive(rule({ status: 'DISABLED' }))).toBe(false);
    expect(isLive(rule({ status: 'DEPRECATED' }))).toBe(false);
  });
});

describe('كشف التعارض غير المحسوم', () => {
  // قاعدتان متناقضتان، نفس الأولوية والخصوصية، وكلتاهما مرنة: لا خطوة في السلم
  // تحسم بينهما، فيُرجَّح الأول بالمعرّف — وهذا هو «غير المحسوم».
  const tie = [
    rule({ id: 'er-allow', name: 'ادمج المد مع التحقيق', actions: [{ type: 'MERGE' }], priority: 80 }),
    rule({ id: 'er-prevent', name: 'لا تدمج المد', actions: [{ type: 'PREVENT_MERGE' }], priority: 80 }),
  ];

  it('يكتشف تعادلًا لا يحسمه سلم السياسة', () => {
    const conflicts = findUnresolvedConflicts(config(tie));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.kind).toBe('MERGE_ACTIONS');
    expect(conflicts[0]!.ruleIds).toEqual(['er-allow', 'er-prevent']);
    expect(conflicts[0]!.reason).toContain('لم يحسم سلم السياسة');
  });

  it('لا يسم تعارضًا حسمته الأولوية', () => {
    const resolved = [
      rule({ id: 'er-allow', actions: [{ type: 'MERGE' }], priority: 60 }),
      rule({ id: 'er-prevent', actions: [{ type: 'PREVENT_MERGE' }], priority: 100 }),
    ];
    expect(findUnresolvedConflicts(config(resolved))).toHaveLength(0);
  });

  it('لا يسم تعارضًا حسمته الصلابة (قاعدة صلبة صريحة)', () => {
    const resolved = [
      rule({ id: 'er-allow', actions: [{ type: 'MERGE' }], priority: 80, hardness: 'SOFT' }),
      rule({ id: 'er-prevent', actions: [{ type: 'PREVENT_MERGE' }], priority: 80, hardness: 'HARD' }),
    ];
    expect(findUnresolvedConflicts(config(resolved))).toHaveLength(0);
  });

  it('يكتشف التعارض المُعلن صراحةً بين قاعدتين نافذتين', () => {
    const declared = [
      rule({ id: 'er-a', conflictsWith: ['er-b'], actions: [{ type: 'MERGE' }] }),
      rule({ id: 'er-b', actions: [{ type: 'MERGE' }] }),
    ];
    const conflicts = findUnresolvedConflicts(config(declared));
    expect(conflicts.map((item) => item.kind)).toContain('DECLARED');
  });

  it('يتجاهل القواعد غير النافذة (معطّلة/متقادمة/مسودة)', () => {
    const inactive = [
      rule({ id: 'er-allow', actions: [{ type: 'MERGE' }], priority: 80 }),
      rule({ id: 'er-prevent', actions: [{ type: 'PREVENT_MERGE' }], priority: 80, status: 'DISABLED' }),
    ];
    expect(findUnresolvedConflicts(config(inactive))).toHaveLength(0);
  });

  it('يعيد سببًا مقروءًا لكل قاعدة موسومة', () => {
    const reasons = conflictedRuleReasons(config(tie));
    expect(reasons.get('er-allow')?.[0]).toContain('«لا تدمج المد»');
    expect(reasons.has('er-prevent')).toBe(true);
  });

  // تعادل الأولوية يُقاس بفعلَيْ النتيجة (لا بأفعال الدمج) حتى لا يلتقطه فحص
  // تعارض الدمج أولًا، فنعزل فرع PRIORITY_TIE وحده.
  const onType = (id: string, differenceType: string, action: 'OVERRIDE_RESULT' | 'BLOCK_RESULT') =>
    rule({
      id,
      name: id,
      type: 'CONTEXT',
      category: 'OVERRIDE',
      conditions: { all: [{ field: 'differenceType', op: 'equals', value: differenceType }] },
      actions: [{ type: action }],
      priority: 80,
      groupId: 'result',
    });

  it('تعادل الأولوية: يسم المتناقضين على نفس نوع الاختلاف', () => {
    const conflicts = findUnresolvedConflicts(
      config([onType('er-override', 'MADD', 'OVERRIDE_RESULT'), onType('er-block', 'MADD', 'BLOCK_RESULT')])
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.kind).toBe('PRIORITY_TIE');
    expect(conflicts[0]!.differenceType).toBe('MADD');
  });

  it('تعادل الأولوية: لا يسم قاعدتين على نوعين مختلفين (لا تتقابلان في المحرك)', () => {
    expect(
      findUnresolvedConflicts(
        config([onType('er-override', 'MADD', 'OVERRIDE_RESULT'), onType('er-block', 'HAMZ', 'BLOCK_RESULT')])
      )
    ).toHaveLength(0);
  });

  it('تعادل الأولوية: القاعدة الشاملة تتقاطع مع المقيّدة فتُوسم', () => {
    const conflicts = findUnresolvedConflicts(
      config([
        rule({
          id: 'er-any',
          name: 'شاملة',
          type: 'CONTEXT',
          category: 'OVERRIDE',
          conditions: { all: [] },
          actions: [{ type: 'OVERRIDE_RESULT' }],
          priority: 80,
          groupId: 'result',
        }),
        onType('er-block', 'HAMZ', 'BLOCK_RESULT'),
      ])
    );
    expect(conflicts.map((item) => item.kind)).toEqual(['PRIORITY_TIE']);
  });
});

describe('الوسم التلقائي ورفعه (FR-ES-07.2.2)', () => {
  const tie = () => [
    rule({ id: 'er-allow', name: 'ادمج', actions: [{ type: 'MERGE' }], priority: 80 }),
    rule({ id: 'er-prevent', name: 'لا تدمج', actions: [{ type: 'PREVENT_MERGE' }], priority: 80 }),
    rule({ id: 'er-other', name: 'مسودة', actions: [{ type: 'MERGE' }], status: 'DRAFT' as RuleStatus }),
  ];

  it('يسم الطرفين المتعارضين ولا يمسّ غيرهما', () => {
    const result = syncConflictTags(config(tie()), { now: '2026-04-01T00:00:00.000Z' });
    expect(result.tagged.map((item) => item.ruleId).sort()).toEqual(['er-allow', 'er-prevent']);
    const statuses = new Map(result.config.rules.map((item) => [item.id, item.status]));
    expect(statuses.get('er-allow')).toBe('CONFLICTED');
    expect(statuses.get('er-prevent')).toBe('CONFLICTED');
    expect(statuses.get('er-other')).toBe('DRAFT');
    // لا حذف: نفس عدد القواعد.
    expect(result.config.rules).toHaveLength(3);
  });

  it('مستقر: إعادة التزامن بعد الوسم لا ترفعه (لا تذبذب)', () => {
    const once = syncConflictTags(config(tie()));
    const twice = syncConflictTags(once.config);
    expect(twice.tagged).toHaveLength(0);
    expect(twice.cleared).toHaveLength(0);
    expect(twice.conflicts).toHaveLength(1); // التعارض ما يزال قائمًا
  });

  it('يرفع الوسم حين يُحسم التعارض (تعطيل أحد الطرفين)', () => {
    const once = syncConflictTags(config(tie()));
    const resolvedRules = once.config.rules.map((item) =>
      item.id === 'er-prevent' ? { ...item, status: 'DISABLED' as RuleStatus } : item
    );
    const twice = syncConflictTags({ ...once.config, rules: resolvedRules });
    expect(twice.cleared.map((item) => item.ruleId)).toEqual(['er-allow']);
    expect(twice.config.rules.find((item) => item.id === 'er-allow')?.status).toBe('ACTIVE');
    expect(twice.config.rules.find((item) => item.id === 'er-prevent')?.status).toBe('DISABLED');
  });

  it('كل تغيير موثّق بسبب (يُسجَّل إصدارًا وتدقيقًا)', () => {
    const result = syncConflictTags(config(tie()));
    expect(result.tagged.every((item) => item.reason.length > 0)).toBe(true);
    expect(result.tagged[0]?.from).toBe('ACTIVE');
    expect(result.tagged[0]?.to).toBe('CONFLICTED');
  });
});

describe('حارس التعديل: تحذير وعداد استخدام (FR-ES-07.2.3)', () => {
  it('القاعدة النافذة تُحذَّر قبل التعديل', () => {
    const target = rule({ id: 'er-target', name: 'لا تدمج الفرش مع المد' });
    const guard = buildEditGuard(config([target, rule({ id: 'er-other' })]), target);
    expect(guard.isLive).toBe(true);
    expect(guard.requiresReason).toBe(true);
    expect(guard.warnings[0]).toContain('نافذة في المحرك');
  });

  it('يعدّ القواعد التي تعتمد عليها ويظهر العدد قبل التأكيد', () => {
    const target = rule({ id: 'er-target' });
    const dependents = [
      rule({ id: 'er-d1', dependsOn: ['er-target'] }),
      rule({ id: 'er-d2', overrides: ['er-target'] }),
      rule({ id: 'er-d3', conflictsWith: ['er-target'] }),
    ];
    const guard = buildEditGuard(config([target, ...dependents]), target);
    expect(guard.dependentCount).toBe(3);
    expect(guard.warnings.some((text) => text.includes('3 قاعدة أخرى'))).toBe(true);
  });

  it('المحمية تطلب تأكيدًا إضافيًا بسبب مكتوب', () => {
    const target = rule({ id: 'er-target', protected: true });
    const guard = buildEditGuard(config([target]), target);
    expect(guard.isProtected).toBe(true);
    expect(guard.requiresReason).toBe(true);
    expect(guard.warnings.some((text) => text.includes('محمية'))).toBe(true);
  });

  it('يعدّ حالات الاختبار التي ستُشغَّل قبل الحفظ', () => {
    const target = rule({
      id: 'er-target',
      testCases: [{ name: 'حالة', input: {}, expected: 'MERGE' }],
    });
    expect(buildEditGuard(config([target]), target).testCaseCount).toBe(1);
  });

  it('المتقادمة يُنبَّه أن التعديل لا يعيد تفعيلها', () => {
    const target = rule({ id: 'er-target', status: 'DEPRECATED' });
    const guard = buildEditGuard(config([target]), target);
    expect(guard.isLive).toBe(false);
    expect(guard.warnings.some((text) => text.includes('متقادمة'))).toBe(true);
  });
});

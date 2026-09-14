// الحزمة 02 — نواة Engine Studio: اختبارات معايير القبول (FR-ES-01..06/10/14/16)
// مشروع التشجير - نظام القراءات العشر
//
// تثبت هذه الاختبارات معايير قبول الحزمة 02 آليًا عبر Decision API بمعزل
// عن الواجهة (NFR-09):
//   AC-1 بناء قاعدة كاملة بالنقر (وقف + راوٍ + فئة ← إجراء) واختبارها بلا حفظ.
//   AC-2 تعارض القواعد: الأولوية، الخصوصية، الصلابة — وكل حالة يشرحها Why.
//   AC-3 إعادة الترتيب بالسحب تغيّر الرقم الصريح وتقلب نتيجة القرار.
//   AC-4 تعديل صف في مصفوفة الدمج يمنع الدمج ويذكره الأثر.
//   AC-5 تصدير/استيراد حتمي وdiff دقيق (سطر واحد لتغيير أولوية).
//   T5  ترتيب التنفيذ: قياس الأثر المبدئي، وتبديل المراحل يغيّر النتيجة.
//   T6  قاعدة عامة + تجاوز محلي: الموضع المحلي لا يندمج والباقي يندمج.
//   T7  أثر القرار: يبدأ بمدخل وينتهي بـ FINAL ولكل خطوة سبب.
//   T9  الفئات الأربعة عشر وقوالب الوقف/الوصل بلا كود.

import { describe, expect, it } from 'vitest';
import type { ConditionGroup, EngineConfig, EngineRule, EngineRuleCategory } from '@/lib/tashjeer/model/v8';
import { createDefaultEngineConfig, type DecisionContext } from '@/lib/tashjeer/decision/policy';
import { resolveDifference, resolveMerge } from '@/lib/tashjeer/decision/api';
import {
  executionOrderImpact,
  executionStageOf,
  resolveConflictPolicy,
} from '@/lib/tashjeer/decision/resolver';
import { evaluateGroup } from '@/lib/tashjeer/decision/conditions';
import {
  applyPriorityShift,
  importEngineConfigText,
  serializeEngineConfig,
  setRulePriority,
  updateMergeMatrixEntry,
} from '@/lib/tashjeer/engine-config-store';
import { CATEGORY_LABELS, CONDITION_FIELDS, CONDITION_OPS } from '@/components/studio/labels';
import { WAQF_WASL_TEMPLATES } from '@/components/studio/templates';

function rule(overrides: Partial<EngineRule>): EngineRule {
  return {
    id: 'rule',
    name: 'قاعدة',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    actions: [{ type: 'MERGE' }],
    priority: 50,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    createdAt: 't',
    updatedAt: 't',
    ...overrides,
  };
}

/** ملف اختبار بمصفوفة دمج مشروطة (قيمتها افتراض) تسمح للقواعد أن تحسم. */
function configWith(rules: EngineRule[], extra: Partial<EngineConfig> = {}): EngineConfig {
  return {
    ...createDefaultEngineConfig('pkg02'),
    rules,
    mergeMatrix: [{ a: 'MADD', b: 'TAHQIQ', merge: false, conditional: true, priority: 1, reason: 'افتراض' }],
    ...extra,
  };
}

// ==================== AC-1 ====================

describe('AC-1: بناء قاعدة بالنقر واختبارها بلا حفظ', () => {
  const qalunWaqfMaddCtx: DecisionContext = {
    context: 'WAQF_ONLY',
    narratorId: 'narrator-qalun',
    differenceType: 'MADD',
    position: 'END_OF_AYAH',
  };

  it('«السياق وقف والراوِ قالون والفئة مد ← أنشئ اختلافًا» تُقيَّم على موضع حقيقي', () => {
    // الحقول كما يملؤها المنشئ بالنقر (لا كود ولا نص شرطي):
    const conditions: ConditionGroup = {
      all: [
        { field: 'context', op: 'equals', value: 'WAQF_ONLY' },
        { field: 'narratorId', op: 'equals', value: 'narrator-qalun' },
        { field: 'differenceType', op: 'equals', value: 'MADD' },
      ],
    };
    expect(evaluateGroup(conditions, qalunWaqfMaddCtx)).toBe(true);
    expect(evaluateGroup(conditions, { ...qalunWaqfMaddCtx, narratorId: 'narrator-warsh' })).toBe(false);
    expect(evaluateGroup(conditions, { ...qalunWaqfMaddCtx, context: 'WASL_ONLY' })).toBe(false);
  });

  it('المسودة لا تؤثر في الملف الرسمي، ونسخة مفعّلة في الذاكرة تُختبر دون حفظ', () => {
    const draft = rule({
      id: 'er-draft',
      name: 'وقفا عند قالون والفرش مد: أنشئ اختلافًا',
      type: 'DIFFERENCE',
      category: 'WAQF',
      conditions: {
        all: [
          { field: 'context', op: 'equals', value: 'WAQF_ONLY' },
          { field: 'narratorId', op: 'equals', value: 'narrator-qalun' },
          { field: 'differenceType', op: 'equals', value: 'MADD' },
        ],
      },
      actions: [{ type: 'CREATE_DIFFERENCE' }],
      status: 'DRAFT',
    });

    const official = createDefaultEngineConfig('official');
    const officialWithDraft = { ...official, rules: [...official.rules, draft] };
    expect(resolveDifference(qalunWaqfMaddCtx, officialWithDraft).decision.create).toBe(false);

    // المعاينة داخل المنشئ: نسخة مفعّلة في الذاكرة فقط — لا يُحفظ شيء.
    const activeCopy: EngineRule = { ...draft, status: 'ACTIVE' };
    const testProfile = { ...official, rules: [...official.rules, activeCopy] };
    const result = resolveDifference(qalunWaqfMaddCtx, testProfile);
    expect(result.decision.create).toBe(true);
    expect(result.trace.some((step) => step.ruleId === 'er-draft' && step.status === 'won')).toBe(true);
    // الملف الرسمي ما زال بلا أثر:
    expect(resolveDifference(qalunWaqfMaddCtx, officialWithDraft).decision.create).toBe(false);
  });
});

// ==================== AC-2 ====================

describe('AC-2: تعارض القواعد وتفسيره في Why', () => {
  it('قاعدتان متناقضتان A(100)=Merge وB(80)=DoNotMerge: A تفوز ويظهر الخاسر وسببه', () => {
    const allow = rule({ id: 'A', name: 'A Merge', priority: 100, actions: [{ type: 'MERGE' }] });
    const block = rule({ id: 'B', name: 'B DoNotMerge', priority: 80, actions: [{ type: 'PREVENT_MERGE' }] });
    const result = resolveMerge('MADD', 'TAHQIQ', configWith([allow, block]));
    expect(result.decision.merge).toBe(true);
    expect(result.decision.reason).toContain('A Merge');
    const won = result.trace.find((step) => step.ruleId === 'A' && step.status === 'won');
    expect(won).toBeDefined();
    const lost = result.trace.find((step) => step.ruleId === 'B' && step.status === 'lost');
    expect(lost).toBeDefined();
    expect(lost?.message).toContain('A Merge');
  });

  it('الأخص يغلب الأعم حتى مع أولوية أعلى للأعم (عبر API القرار كاملًا)', () => {
    const global = rule({ id: 'global', name: 'Global Merge', priority: 100, specificity: 'MUSHAF' });
    const local = rule({
      id: 'local',
      name: 'Local DoNotMerge',
      priority: 80,
      specificity: 'CHARACTER',
      actions: [{ type: 'PREVENT_MERGE' }],
    });
    const result = resolveMerge('MADD', 'TAHQIQ', configWith([global, local]));
    expect(result.decision.merge).toBe(false);
    expect(result.decision.reason).toContain('Local DoNotMerge');
  });

  it('تساوي الأولوية: الأخص ثم ترتيب المجموعة ثم الأقدم معرفًا (حتمي)', () => {
    const cfg = createDefaultEngineConfig('t');
    const mushaf = rule({ id: 'a', priority: 100, specificity: 'MUSHAF' });
    const word = rule({ id: 'b', priority: 100, specificity: 'WORD' });
    expect(resolveConflictPolicy(['HIGHEST_PRIORITY'], [mushaf, word], cfg).winner?.id).toBe('b');

    const fallbackGroup = rule({ id: 'c', priority: 100, groupId: 'fallback' });
    const structuralGroup = rule({ id: 'd', priority: 100, groupId: 'structural' });
    expect(resolveConflictPolicy(['HIGHEST_PRIORITY'], [fallbackGroup, structuralGroup], cfg).winner?.id).toBe('d');

    const x1 = rule({ id: 'x1', priority: 100 });
    const y2 = rule({ id: 'y2', priority: 100 });
    expect(resolveConflictPolicy(['HIGHEST_PRIORITY'], [y2, x1], cfg).winner?.id).toBe('x1');
  });

  it('Hard لا تخسر أمام Soft مهما علت أولوية الأخيرة', () => {
    const hardBlock = rule({ id: 'hard', priority: 10, hardness: 'HARD', actions: [{ type: 'PREVENT_MERGE' }] });
    const softAllow = rule({ id: 'soft', priority: 100, actions: [{ type: 'MERGE' }] });
    const result = resolveMerge('MADD', 'TAHQIQ', configWith([hardBlock, softAllow]));
    expect(result.decision.merge).toBe(false);
    expect(result.trace.some((step) => step.ruleId === 'hard' && step.status === 'won')).toBe(true);
  });

  it('Hard لا تُتجاوز إلا بتجاوز صريح موثق (Explicit Override)', () => {
    const hardBlock = rule({ id: 'hard', priority: 100, hardness: 'HARD', actions: [{ type: 'PREVENT_MERGE' }] });
    const ovr = rule({
      id: 'ovr',
      name: 'تجاوز موثق',
      priority: 50,
      actions: [{ type: 'OVERRIDE_RESULT', params: { result: true, explicit: true } }],
    });
    const result = resolveMerge('MADD', 'TAHQIQ', configWith([hardBlock, ovr]));
    expect(result.decision.merge).toBe(true);
    expect(result.decision.reason).toContain('Explicit Override');
  });
});

// ==================== AC-3 ====================

describe('AC-3: السحب يعيد الترقيم صراحةً ويقلب نتيجة القرار', () => {
  it('سحب B فوق A: يتغير الرقم الصريح وتنعكس النتيجة عبر Decision API', async () => {
    const { moveItem, renumberPriorities } = await import('@/components/studio/PriorityPipeline');

    let cfg = configWith([
      rule({ id: 'a', name: 'A Merge', priority: 100, actions: [{ type: 'MERGE' }] }),
      rule({ id: 'b', name: 'B DoNotMerge', priority: 80, actions: [{ type: 'PREVENT_MERGE' }] }),
    ]);
    expect(resolveMerge('MADD', 'TAHQIQ', cfg).decision.merge).toBe(true);

    // محاكاة السحب: القائمة مرتبة تنازليًا [a, b] ← إفلات b في أولها [b, a]
    const ordered = cfg.rules.slice().sort((x, y) => y.priority - x.priority || x.id.localeCompare(y.id));
    const reordered = moveItem(ordered, 0, 2);
    expect(reordered.map((item) => item.id)).toEqual(['b', 'a']);

    // ما تفعله الواجهة: إعادة ترقيم بفجوة ١٠ ثم تثبيت الرقم لكل قاعدة.
    for (const { ruleId, priority } of renumberPriorities(reordered.map((item) => item.id))) {
      cfg = setRulePriority(cfg, ruleId, priority);
    }

    // ترقيم حتمي نظيف بلا إزحات عرضية:
    expect(cfg.rules.find((item) => item.id === 'b')?.priority).toBe(20);
    expect(cfg.rules.find((item) => item.id === 'a')?.priority).toBe(10);

    const after = resolveMerge('MADD', 'TAHQIQ', cfg);
    expect(after.decision.merge).toBe(false);
    expect(after.trace.some((step) => step.ruleId === 'b' && step.status === 'won')).toBe(true);
  });

  it('إسناد أولوية متصادمة يزيح المتصادمات وحدها سلسلةً (لا إزاحة شاملة)', () => {
    const cfg = configWith([
      rule({ id: 'a', priority: 80 }),
      rule({ id: 'b', priority: 90 }),
      rule({ id: 'c', priority: 91 }),
      rule({ id: 'd', priority: 150 }),
    ]);
    const next = setRulePriority(cfg, 'a', 90);
    expect(next.rules.find((item) => item.id === 'a')?.priority).toBe(90);
    expect(next.rules.find((item) => item.id === 'b')?.priority).toBe(91);
    expect(next.rules.find((item) => item.id === 'c')?.priority).toBe(92);
    // d أعلى بلا تصادم: لم تتغير (حارس ضد الإزاحة الشاملة).
    expect(next.rules.find((item) => item.id === 'd')?.priority).toBe(150);

    const shifts = applyPriorityShift(cfg.rules, 'a', 90).shifts;
    expect(shifts.map((item) => item.ruleId).sort()).toEqual(['b', 'c']);
    expect(shifts.find((item) => item.ruleId === 'b')).toMatchObject({ from: 90, to: 91 });
  });

  it('إسناد أولوية بلا تصادم لا يزيح شيئًا', () => {
    const cfg = configWith([rule({ id: 'a', priority: 80 }), rule({ id: 'b', priority: 150 })]);
    const { shifts } = applyPriorityShift(cfg.rules, 'a', 95);
    expect(shifts).toHaveLength(0);
  });
});

// ==================== AC-4 ====================

describe('AC-4: صف مصفوفة الدمج يمنع الدمج ويذكره الأثر', () => {
  it('تغيير (فرش + مد) إلى «لا تدمج» يمنع دمجهما في قرار تالٍ ويذكر الصف', () => {
    let cfg = createDefaultEngineConfig('pkg02');
    const idx = cfg.mergeMatrix.findIndex((entry) => entry.a === 'FARSH' && entry.b === 'MADD');
    expect(idx).toBeGreaterThanOrEqual(0);

    // الحالة قبل التعديل: الصف «ادمج» (مطلق) فيندمج العنصران.
    cfg = updateMergeMatrixEntry(cfg, idx, { merge: true, reason: 'مرتبطان' });
    expect(resolveMerge('FARSH', 'MADD', cfg).decision.merge).toBe(true);

    // تحرير الصف: فرش + مد = No
    cfg = updateMergeMatrixEntry(cfg, idx, { merge: false, reason: 'مستقلان' });
    const after = resolveMerge('FARSH', 'MADD', cfg);
    expect(after.decision.merge).toBe(false);
    expect(after.decision.reason).toContain('مستقلان');
    const matrixStep = after.trace.find((step) => step.stage === 'MERGE');
    expect(matrixStep?.message).toContain('لا تدمج');
    expect(matrixStep?.message).toContain('مستقلان');
  });
});

// ==================== T6 ====================

describe('T6: قاعدة عامة + تجاوز محلي (خصوصية/تجاوز/توريث)', () => {
  it('«ادمج مد+وجه X» مع تجاوز محلي «لا تدمج هنا»: المحلي لا يندمج والباقي يندمج', () => {
    const base = createDefaultEngineConfig('pkg02');
    // المصفوفة الافتراضية: مدمج + تحقيق = ادمج (مطلق، أولوية 80).
    const global = rule({ id: 'global', name: 'ادمج المد مع التحقيق', priority: 100 });
    const local = rule({
      id: 'local',
      name: 'لا تدمج في هذا الموضع',
      priority: 60,
      specificity: 'AYAH',
      conditions: {
        all: [
          { field: 'differenceType', op: 'equals', value: 'MADD' },
          { field: 'relatedType', op: 'equals', value: 'TAHQIQ' },
          { field: 'position', op: 'equals', value: 'END_OF_AYAH' },
        ],
      },
      actions: [{ type: 'OVERRIDE_RESULT', params: { result: false, explicit: true } }],
    });
    const profile = { ...base, rules: [...base.rules, global, local] };

    const atLocal = resolveMerge('MADD', 'TAHQIQ', profile, { position: 'END_OF_AYAH' });
    expect(atLocal.decision.merge).toBe(false);

    // Why يشرح السلسلة: التجاوز المحلي فاز، والقاعدة العامة ذُكرت متروكة.
    const won = atLocal.trace.find((step) => step.ruleId === 'local' && step.status === 'won');
    expect(won).toBeDefined();
    expect(won?.message).toContain('Explicit Override');
    const globalSkipped = atLocal.trace.find((step) => step.ruleId === 'global' && step.status === 'skipped');
    expect(globalSkipped).toBeDefined();
    expect(globalSkipped?.message).toContain('ادمج المد مع التحقيق');

    // الموضع الآخر: القاعدة العامة والمصفوفة تعمل كالمعتاد.
    const elsewhere = resolveMerge('MADD', 'TAHQIQ', profile, { position: 'MIDDLE_OF_AYAH' });
    expect(elsewhere.decision.merge).toBe(true);
  });
});

// ==================== T5 ====================

describe('T5: خط أنابيب القرار وقياس الأثر', () => {
  it('executionOrderImpact يعدّ المراحل المتغيرة والقواعد المتأثرة', () => {
    const base = createDefaultEngineConfig('pkg02');
    const blocker = rule({ id: 'blk', name: 'حاجب', actions: [{ type: 'BLOCK_RESULT' }] });
    const merger = rule({ id: 'mrg', name: 'دامج', actions: [{ type: 'MERGE' }] });
    const profile = { ...base, rules: [...base.rules, blocker, merger] };
    expect(executionStageOf(blocker)).toBe('BLOCKING');
    expect(executionStageOf(merger)).toBe('MERGE');

    const next = [...profile.executionOrder];
    const i = next.indexOf('BLOCKING');
    const j = next.indexOf('MERGE');
    [next[i], next[j]] = [next[j], next[i]];
    const impact = executionOrderImpact(profile, next);
    expect(impact.changedStages).toContain('BLOCKING');
    expect(impact.changedStages).toContain('MERGE');
    expect(impact.affectedRules.map((item) => item.id)).toContain('blk');
    expect(impact.affectedRules.map((item) => item.id)).toContain('mrg');

    // نفس الترتيب = لا أثر.
    expect(executionOrderImpact(profile, profile.executionOrder).changedStages).toHaveLength(0);
    expect(executionOrderImpact(profile, profile.executionOrder).affectedRules).toHaveLength(0);
  });

  it('تبديل مرحلة المنع والدمج يقلب نتيجة القرار (مختبر عبر API)', () => {
    const blocker = rule({ id: 'blk', priority: 90, actions: [{ type: 'BLOCK_RESULT' }] });
    const softAllow = rule({ id: 'soft', priority: 100, actions: [{ type: 'MERGE' }] });
    const base = configWith([blocker, softAllow]);
    // الترتيب الافتراضي: BLOCKING تسبق MERGE ← الحجب يسبق.
    expect(resolveMerge('MADD', 'TAHQIQ', base).decision.merge).toBe(false);

    const next = [...base.executionOrder];
    const i = next.indexOf('BLOCKING');
    const j = next.indexOf('MERGE');
    [next[i], next[j]] = [next[j], next[i]];
    expect(resolveMerge('MADD', 'TAHQIQ', { ...base, executionOrder: next }).decision.merge).toBe(true);
  });
});

// ==================== AC-5 ====================

describe('AC-5: تصدير/استيراد حتمي وdiff دقيق', () => {
  it('تصدير نفس الإعداد مرتين متطابق بايتًا، والجولة تصدير ← استيراد ← تصدير مطابقة', () => {
    const cfg = createDefaultEngineConfig('default');
    const first = serializeEngineConfig(cfg);
    expect(serializeEngineConfig(cfg)).toBe(first);

    const { config, validation } = importEngineConfigText(first);
    expect(validation.valid).toBe(true);
    expect(serializeEngineConfig(config)).toBe(first);
  });

  it('تغيير أولوية عبر العملية الفعلية (setRulePriority) = سطر واحد في diff', () => {
    let cfg = createDefaultEngineConfig('default');
    const before = serializeEngineConfig(cfg);
    cfg = setRulePriority(cfg, 'er-system-merge-madd-tahqiq', 95);
    const after = serializeEngineConfig(cfg);

    const b = before.split('\n');
    const a = after.split('\n');
    expect(a.length).toBe(b.length);
    const diffs = b
      .map((line, index) => ({ line, other: a[index] }))
      .filter((entry) => entry.line !== entry.other);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].line).toContain('80');
    expect(diffs[0].other).toContain('95');
  });

  it('الاستيراد يرفض العبث: إصدار غير متوافق، معرّف مكرر، نص غير صالح', () => {
    const cfg = createDefaultEngineConfig('default');
    const text = serializeEngineConfig(cfg);

    expect(importEngineConfigText('{ هذا ليس JSON').validation.valid).toBe(false);

    const tampered = JSON.parse(text) as Record<string, unknown>;
    tampered['schema-version'] = 99;
    const wrongVersion = importEngineConfigText(JSON.stringify(tampered));
    expect(wrongVersion.validation.valid).toBe(false);
    expect(wrongVersion.validation.errors.some((error) => error.includes('إصدار المخطط'))).toBe(true);

    tampered['schema-version'] = 1;
    tampered.rules = [...(tampered.rules as object[]), { ...(tampered.rules as object[])[0] }];
    const duplicated = importEngineConfigText(JSON.stringify(tampered));
    expect(duplicated.validation.valid).toBe(false);
    expect(duplicated.validation.errors.some((error) => error.includes('مكرر'))).toBe(true);
  });
});

// ==================== T7 ====================

describe('T7: أثر القرار (Trace) مكتمل ومفسر', () => {
  it('كل قرار يبدأ بمدخل وينتهي بـ FINAL، ولكل خطوة سبب غير فارغ', () => {
    const result = resolveMerge('MADD', 'FARSH', createDefaultEngineConfig('t'));
    expect(result.trace.length).toBeGreaterThan(3);
    expect(result.trace[0].stage).toBe('INPUT');
    expect(result.trace[result.trace.length - 1].stage).toBe('FINAL');
    for (const step of result.trace) {
      expect(step.message.length).toBeGreaterThan(0);
    }
  });
});

// ==================== T9 ====================

describe('T9: فئات القواعد وقوالب الوقف/الوصل', () => {
  it('الفئات الأربعة عشر كلها مدعومة بتسميات عربية', () => {
    const expected: EngineRuleCategory[] = [
      'DETECTION', 'DIFFERENCE', 'VARIANT', 'MERGE', 'SPLIT', 'ORDERING',
      'RELATION', 'CONTEXT', 'WAQF', 'WASL', 'IBTIDA', 'EXCEPTION', 'OVERRIDE', 'VALIDATION',
    ];
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...expected].sort());
    for (const category of expected) {
      expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
  });

  it('حقول ومعاملات منشئ الشروط تغطي FR-ES-03', () => {
    for (const field of [
      'readerId', 'narratorId', 'pathId', 'category', 'differenceType',
      'context', 'position', 'forbiddenWasl', 'morphologicalCategory', 'literalPattern',
    ]) {
      expect(CONDITION_FIELDS).toContain(field);
    }
    for (const op of ['equals', 'not-equals', 'in', 'not-in', 'matches-pattern', 'exists']) {
      expect(CONDITION_OPS).toContain(op);
    }
  });

  it('قوالب الوقف/الوصل كاملة تُملأ بلا كود وتُقيَّم', () => {
    for (const template of WAQF_WASL_TEMPLATES) {
      expect(template.conditions.length).toBeGreaterThan(0);
      expect(template.actions.length).toBeGreaterThan(0);
      for (const condition of template.conditions) {
        expect(CONDITION_FIELDS).toContain(condition.field);
      }
    }
    const waqf = WAQF_WASL_TEMPLATES.find((template) => template.id === 'waqf-end-create');
    expect(waqf).toBeDefined();
    expect(evaluateGroup({ all: waqf!.conditions }, { context: 'WAQF_ONLY', position: 'END_OF_AYAH' })).toBe(true);
    expect(evaluateGroup({ all: waqf!.conditions }, { context: 'WASL_ONLY', position: 'END_OF_AYAH' })).toBe(false);
  });
});

// اختبارات الحزمة 07 — التعميم متعدد الأنواع والاستقلال المحلي (FR-ED-10)
//
// T1: الأنواع المعمَّمة تترتب بالرتبة الصريحة لا بالاسم.
// T2: التحرير المحلي ترقيع فوق المشتق: لا نسخ، لا مساس بالأمّ ولا بالجيران.
// T3: حذف الأمّ تحذير كمي + تراجع؛ تحريرها لا يطال المتجاوَز.
// T4: التراجع الموحد يعيد المستند والاستثناءات والقواعد معًا.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import type { GlobalRuleMatch } from '@/lib/quran-logic/global-rule-engine';
import type { GlobalRule } from '@/lib/storage/global-rules-store';
import type { TashjeerBranch, Variant } from '@/types/tashjeer';
import { MemoryStorage } from './helpers/memory-storage';

const AYAH_KEY = makeAyahKey(1, 2); // الحمد لله رب العالمين
const OTHER_AYAH = makeAyahKey(1, 3);

function makeRule(overrides: Partial<GlobalRule> & { id: string }): GlobalRule {
  return {
    title: 'قاعدة اختبار',
    category: 'MADUD',
    scope: { kind: 'ALL' },
    status: 'DRAFT',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMatch(startPosition = 1, ayahKey = AYAH_KEY): GlobalRuleMatch {
  return {
    ayahKey,
    startPosition,
    endPosition: startPosition,
    characterRange: {
      start: { position: startPosition, characterIndex: 1 },
      end: { position: startPosition, characterIndex: 3 },
    },
    matchedText: 'لْحَم',
  };
}

function makeBranch(id: string, orderRank: number | undefined, position = 2): TashjeerBranch {
  return {
    id,
    variantId: `variant-${id}`,
    alternativeId: `alt-${id}`,
    category: 'FARSH',
    nodes: [{ id: `${id}-w${position}`, wordId: position, position, anchor: 'BOTTOM' }],
    lane: 0,
    side: 'BOTTOM',
    label: id,
    color: '#000',
    ...(orderRank === undefined ? {} : { orderRank }),
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadStores() {
  const [rules, occurrences, engine] = await Promise.all([
    import('@/lib/storage/global-rules-store'),
    import('@/lib/storage/rule-occurrences-store'),
    import('@/lib/quran-logic/global-rule-engine'),
  ]);
  return { rules, occurrences, engine };
}

// ==================== T1: الرتبة الصريحة ====================

describe('T1 — ترتيب الأنواع المعمَّمة بالرتبة الصريحة', () => {
  it('الدفعة الواحدة: وسم دفعي مشترك ورتب متجاورة وقواعد مستقلة', async () => {
    const { rules } = await loadStores();
    const { rules: saved, batchId } = rules.saveGlobalRuleBatch([
      makeRule({ id: 'tahqiq', title: 'تحقيق الهمز' }),
      makeRule({ id: 'usul', title: 'أصل مطرد', category: 'USUL' }),
      makeRule({ id: 'farsh', title: 'فرش الكلمة', category: 'FARSH' }),
    ]);

    expect(batchId).toBeTruthy();
    expect(saved.map((rule) => rule.createBatchId)).toEqual([batchId, batchId, batchId]);
    expect(saved.map((rule) => rule.orderRank)).toEqual([1, 2, 3]);
    // استقلال: معرّفات متميزة وفئات محفوظة لكل قاعدة على حدة.
    expect(new Set(saved.map((rule) => rule.id)).size).toBe(3);
    expect(saved.map((rule) => rule.category)).toEqual(['MADUD', 'USUL', 'FARSH']);
  });

  it('إدراج الدفعة يزيح الرتب المشغولة ولا يكسر تجاور الكتلة', async () => {
    const { rules } = await loadStores();
    rules.saveGlobalRule(makeRule({ id: 'old-1', orderRank: 1 }));
    rules.saveGlobalRule(makeRule({ id: 'old-2', orderRank: 2 }));

    const { rules: saved } = rules.saveGlobalRuleBatch(
      [makeRule({ id: 'n1' }), makeRule({ id: 'n2' })],
      { startRank: 1 }
    );
    expect(saved.map((rule) => rule.orderRank)).toEqual([1, 2]);

    const byId = new Map(rules.listGlobalRules().map((rule) => [rule.id, rule.orderRank]));
    expect(byId.get('old-1')).toBe(3);
    expect(byId.get('old-2')).toBe(4);
  });

  it('المواضع الثلاثة (تحقيق/أصول/فرش) تترتب بالرتبة لا بالاسم ولا بالموضع', async () => {
    const { compareVariantsForReading } = await import('@/lib/tashjeer/ordering');
    const { buildReadingPlan } = await import('@/lib/tashjeer/reading-plan');
    const plan = buildReadingPlan(4, []);

    // الأسماء مرتبة أبجديًا عكس الرتب عمدًا، والمواضع متباينة.
    const variants = [
      { id: 'c', orderRank: 3, startPosition: 4, endPosition: 4, title: 'أصول' },
      { id: 'a', orderRank: 1, startPosition: 1, endPosition: 1, title: 'فرش' },
      { id: 'b', orderRank: 2, startPosition: 2, endPosition: 2, title: 'تحقيق' },
    ] as Variant[];

    const sorted = [...variants].sort((first, second) =>
      compareVariantsForReading(first, second, plan)
    );
    expect(sorted.map((variant) => variant.id)).toEqual(['a', 'b', 'c']);
  });

  it('المحرك القديم يقدّم الرتبة الصريحة على قاعدة آخر الآية', async () => {
    const { assignLanes } = await import('@/lib/tashjeer/branch-engine');
    // بلا رتب: المتأخر في الآية أقرب إلى النص (مسار أصغر).
    const unranked = assignLanes([makeBranch('early', undefined, 1), makeBranch('late', undefined, 4)]);
    expect(unranked.find((branch) => branch.id === 'late')!.lane).toBe(0);

    // برتبة صريحة: صاحب الرتبة ١ يتقدم ولو كان أول الآية.
    const ranked = assignLanes([makeBranch('early', 1, 1), makeBranch('late', 2, 4)]);
    expect(ranked.find((branch) => branch.id === 'early')!.lane).toBe(0);
    expect(ranked.find((branch) => branch.id === 'late')!.lane).toBe(1);

    // المرقّم يتقدم غير المرقّم.
    const mixed = assignLanes([makeBranch('plain', undefined, 4), makeBranch('ranked', 5, 1)]);
    expect(mixed.find((branch) => branch.id === 'ranked')!.lane).toBe(0);
  });
});

// ==================== T2: التجاوز المحلي ====================

describe('T2 — التحرير المحلي ترقيع لا نسخ', () => {
  it('الترقيع دمج: الحقول غير المذكورة تبقى، وundefined تحرّر الحقل', async () => {
    const { rules, occurrences } = await loadStores();
    rules.saveGlobalRule(makeRule({ id: 'r1' }));
    const match = makeMatch();

    occurrences.setLocalOverride('r1', match, { title: 'عنوان محلي', note: 'سبب' });
    let current = occurrences.overrideById(occurrences.occurrenceIdFor('r1', match))!;
    expect(current.patch?.title).toBe('عنوان محلي');

    occurrences.setLocalOverride('r1', match, { ruleLabel: 'حكم محلي' });
    current = occurrences.overrideById(current.id)!;
    expect(current.patch?.title).toBe('عنوان محلي');
    expect(current.patch?.ruleLabel).toBe('حكم محلي');

    occurrences.setLocalOverride('r1', match, { title: undefined });
    current = occurrences.overrideById(current.id)!;
    expect(current.patch?.title).toBeUndefined();
    expect(current.patch?.ruleLabel).toBe('حكم محلي');
  });

  it('المحرك يطبّق الترقيع والمعرّف ثابت والشارة مرفوعة', async () => {
    const { rules, occurrences, engine } = await loadStores();
    const rule = rules.saveGlobalRule(
      makeRule({ id: 'r1', title: 'الأمّ', ruleLabel: 'حكم الأمّ', maddHarakat: 2 })
    );
    const match = makeMatch();
    const plain = engine.variantFromGlobalMatch(rule, match);
    expect(plain.hasLocalOverride).toBe(false);

    const override = occurrences.setLocalOverride('r1', match, {
      title: 'عنوان · محلي',
      text: 'نص محلي',
      ruleLabel: 'حكم محلي',
      category: 'FARSH',
    });
    const patched = engine.variantFromGlobalMatch(rule, match, override);

    expect(patched.id).toBe(plain.id);
    expect(patched.hasLocalOverride).toBe(true);
    expect(patched.title).toBe('عنوان · محلي · نص محلي');
    expect(patched.category).toBe('FARSH');
    expect(patched.alternatives[0]!.ruleLabel).toBe('حكم محلي');
    // القاعدة الأمّ لم تُمسّ.
    expect(rules.listGlobalRules().find((item) => item.id === 'r1')!.title).toBe('الأمّ');
  });

  it('إعادة بناء المطابقة تنجو من فاصل «·» داخل العنوان المرقَّع', async () => {
    const { rules, occurrences, engine } = await loadStores();
    const rule = rules.saveGlobalRule(makeRule({ id: 'r1', title: 'الأمّ' }));
    const match = makeMatch();
    const override = occurrences.setLocalOverride('r1', match, { title: 'أ · ب' });
    const patched = engine.variantFromGlobalMatch(rule, match, override);

    const rebuilt = engine.matchFromDerivedVariant(patched)!;
    expect(rebuilt).not.toBeNull();
    expect(occurrences.occurrenceIdFor('r1', rebuilt)).toBe(patched.id);
  });

  it('التجاوز لا يمس الجيران: موضع آخر من القاعدة وآية أخرى يبقيان مشتقين', async () => {
    const { rules, occurrences, engine } = await loadStores();
    const rule = rules.saveGlobalRule(makeRule({ id: 'r1', title: 'الأمّ' }));
    const first = makeMatch(1);
    const second = makeMatch(2);
    const otherAyah = makeMatch(1, OTHER_AYAH);

    const override = occurrences.setLocalOverride('r1', first, { title: 'محلي' });

    const sibling = engine.variantFromGlobalMatch(rule, second);
    const distant = engine.variantFromGlobalMatch(rule, otherAyah);
    expect(sibling.hasLocalOverride).toBe(false);
    expect(sibling.title).toContain('الأمّ');
    expect(distant.hasLocalOverride).toBe(false);
    expect(occurrences.overrideById(occurrences.occurrenceIdFor('r1', second))).toBeUndefined();
    expect(override.ruleId).toBe('r1');
  });

  it('التعديل المحلي يُسجَّل قبل/بعد في سجل المواضع', async () => {
    const { rules, occurrences } = await loadStores();
    rules.saveGlobalRule(makeRule({ id: 'r1', title: 'الأمّ' }));
    occurrences.setLocalOverride('r1', makeMatch(), { title: 'محلي', note: 'للكتاب' });

    const log = occurrences.listOccurrenceLog('r1');
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('EDIT');
    expect(log[0]!.reason).toBe('للكتاب');
    const titleChange = log[0]!.changes?.find((change) => change.field === 'العنوان');
    expect(titleChange?.after).toBe('محلي');
  });

  it('إلغاء التجاوز يمحو الترقيع والتخصيصات ويُبقي الحالة', async () => {
    const { rules, occurrences } = await loadStores();
    rules.saveGlobalRule(makeRule({ id: 'r1' }));
    const match = makeMatch();
    const id = occurrences.occurrenceIdFor('r1', match);

    occurrences.setLocalOverride('r1', match, { title: 'محلي' });
    occurrences.setOccurrenceStrength('r1', match, { strengthDegreeId: 'd1' });
    occurrences.deleteOccurrence('r1', match, 'سبب الحذف');

    occurrences.clearLocalOverride(id);
    const cleared = occurrences.overrideById(id)!;
    expect(cleared.state).toBe('DELETED');
    expect(cleared.patch).toBeUndefined();
    expect(cleared.strengthDegreeId).toBeUndefined();
    expect(occurrences.hasLocalOverride(cleared)).toBe(false);
  });

  it('الحذف المحلي يحفظ القاعدة: سائر المواضع والقاعدة باقية', async () => {
    const { rules, occurrences, engine } = await loadStores();
    const rule = rules.saveGlobalRule(makeRule({ id: 'r1' }));
    occurrences.deleteOccurrence('r1', makeMatch(1), 'مستثنى');

    expect(rules.listGlobalRules().some((item) => item.id === 'r1')).toBe(true);
    const sibling = engine.variantFromGlobalMatch(rule, makeMatch(2));
    expect(sibling.title).toContain(rule.title);
    // والمحذوف نفسه يُرجَع فيعود مشتقًا.
    occurrences.restoreOccurrence(occurrences.occurrenceIdFor('r1', makeMatch(1)));
    expect(occurrences.deletedOccurrenceIds('r1').size).toBe(0);
  });
});

// ==================== T3: حماية الأمّ ====================

describe('T3 — حذف الأمّ وتحريرها', () => {
  it('لقطة حذف الأمّ تعيد القاعدة واستثناءاتها معًا', async () => {
    const { rules, occurrences } = await loadStores();
    rules.saveGlobalRule(makeRule({ id: 'r1', title: 'الأمّ' }));
    occurrences.setLocalOverride('r1', makeMatch(1), { title: 'محلي' });
    occurrences.deleteOccurrence('r1', makeMatch(2), 'سبب');

    const snapshot = rules.captureGlobalRuleDeletion('r1')!;
    expect(snapshot.rule.title).toBe('الأمّ');

    rules.deleteGlobalRule('r1');
    expect(rules.listGlobalRules()).toHaveLength(0);
    expect(occurrences.listOccurrenceOverrides('r1')).toHaveLength(0);

    rules.restoreGlobalRuleDeletion(snapshot);
    expect(rules.listGlobalRules().map((rule) => rule.id)).toEqual(['r1']);
    expect(occurrences.listOccurrenceOverrides('r1')).toHaveLength(2);
  });

  it('إحصاء التجاوزات يميز المعدَّل محليًا من المحذوف', async () => {
    const { rules, occurrences } = await loadStores();
    rules.saveGlobalRule(makeRule({ id: 'r1' }));
    occurrences.setLocalOverride('r1', makeMatch(1), { title: 'محلي' });
    occurrences.deleteOccurrence('r1', makeMatch(2));

    const stats = occurrences.occurrenceStats('r1');
    expect(stats.edited).toBe(1);
    expect(stats.deleted).toBe(1);
  });
});

// ==================== T4: التراجع الموحد ====================

describe('T4 — التراجع الموحد (مستند + استثناءات + قواعد)', () => {
  async function openEditorWithRule() {
    const { useEditorStore } = await import('@/stores/editor-store');
    const engine = await import('@/lib/quran-logic/global-rule-engine');
    const rules = await import('@/lib/storage/global-rules-store');

    const pattern = engine.buildCharacterPattern(AYAH_KEY, {
      start: { position: 1, characterIndex: 1 },
      end: { position: 1, characterIndex: 3 },
    });
    const rule = rules.saveGlobalRule(
      makeRule({ id: 'r1', title: 'الأمّ', pattern, orderRank: 1 })
    );

    useEditorStore.getState().openAyah(AYAH_KEY);
    const derived = engine
      .getEffectiveVariants(useEditorStore.getState().document!)
      .find((variant) => variant.isGlobalDerived);
    expect(derived).toBeDefined();
    return { useEditorStore, engine, rules, rule, derived: derived! };
  }

  it('التجاوز المحلي ثم التراجع يعيد المشتق الخالص، والإعادة تعيده', async () => {
    const { useEditorStore, engine } = await openEditorWithRule();
    const state = useEditorStore.getState();
    const derivedId = useEditorStore
      .getState()
      .document ? engine.getEffectiveVariants(useEditorStore.getState().document!).find((v) => v.isGlobalDerived)!.id : '';

    state.setDerivedLocalOverride(derivedId, { title: 'محلي' });
    const patched = engine
      .getEffectiveVariants(useEditorStore.getState().document!)
      .find((variant) => variant.id === derivedId)!;
    expect(patched.title).toContain('محلي');
    expect(patched.hasLocalOverride).toBe(true);

    // سطر تتبع في سجل المستند بهدف قاعدة.
    const log = useEditorStore.getState().document!.editLog ?? [];
    expect(log[log.length - 1]!.targetType).toBe('RULE');

    state.undo();
    const undone = engine
      .getEffectiveVariants(useEditorStore.getState().document!)
      .find((variant) => variant.id === derivedId)!;
    expect(undone.title).toContain('الأمّ');
    expect(undone.hasLocalOverride).toBe(false);

    state.redo();
    const redone = engine
      .getEffectiveVariants(useEditorStore.getState().document!)
      .find((variant) => variant.id === derivedId)!;
    expect(redone.title).toContain('محلي');
  });

  it('الحذف الموضعي ثم التراجع يعيد الموضع دون أن يمس القاعدة', async () => {
    const { useEditorStore, engine, rules } = await openEditorWithRule();
    const state = useEditorStore.getState();
    const derivedId = engine
      .getEffectiveVariants(useEditorStore.getState().document!)
      .find((variant) => variant.isGlobalDerived)!.id;

    state.deleteDerivedOccurrence(derivedId, 'مستثنى في هذه الآية');
    expect(
      engine.getEffectiveVariants(useEditorStore.getState().document!).some((v) => v.id === derivedId)
    ).toBe(false);
    expect(rules.listGlobalRules().some((rule) => rule.id === 'r1')).toBe(true);

    state.undo();
    expect(
      engine.getEffectiveVariants(useEditorStore.getState().document!).some((v) => v.id === derivedId)
    ).toBe(true);
  });

  it('تحرير القاعدة الأمّ ثم التراجع يعيد قيمتها', async () => {
    const { useEditorStore, rules } = await openEditorWithRule();
    const state = useEditorStore.getState();

    state.transactExternal(
      {
        action: 'تحرير قاعدة عامة',
        targetType: 'RULE',
        targetId: 'r1',
        summary: 'اختبار',
      },
      () => rules.saveGlobalRule(makeRule({ id: 'r1', title: 'معدَّلة' }))
    );
    expect(rules.listGlobalRules().find((rule) => rule.id === 'r1')!.title).toBe('معدَّلة');

    state.undo();
    expect(rules.listGlobalRules().find((rule) => rule.id === 'r1')!.title).toBe('الأمّ');

    state.redo();
    expect(rules.listGlobalRules().find((rule) => rule.id === 'r1')!.title).toBe('معدَّلة');
  });
});

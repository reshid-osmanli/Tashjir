import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRecitationCatalog,
  listFamilies,
  listTypes,
  listOptions,
  getRuleOption,
  getRuleType,
  saveRuleOption,
  generateChoiceGroupId,
  DEFAULT_FAMILIES,
  DEFAULT_TYPES,
  DEFAULT_OPTIONS,
} from '@/lib/tashjeer/recitation-rule-catalog';
import { buildReadingCombinations } from '@/lib/tashjeer/combination-engine';
import { resolveLocusExclusion, resolveExclusiveGroups } from '@/lib/tashjeer/decision/editor-bridge';
import type { Variant } from '@/types/tashjeer';
import { createDefaultEngineConfig } from '@/lib/tashjeer/decision/policy';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';

// Mock localStorage for catalog
beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

describe('Recitation Rule Catalog', () => {
  it('يجب أن يحتوي الكتالوج الافتراضي على عائلة المدود', () => {
    const families = listFamilies();
    const madd = families.find((f) => f.id === 'madd' || f.code === 'MADD');
    expect(madd).toBeDefined();
    expect(madd?.editorMode).toBe('RULE_DRIVEN');
  });

  it('يجب أن يحتوي المدود على نوعين: متصل ومنفصل', () => {
    const types = listTypes('madd');
    expect(types.length).toBeGreaterThanOrEqual(2);
    const muttasil = types.find((t) => t.id === 'madd_muttasil');
    const munfasil = types.find((t) => t.id === 'madd_munfasil');
    expect(muttasil).toBeDefined();
    expect(munfasil).toBeDefined();
  });

  it('يجب أن تأتي خيارات المد من الكتالوج وليس ثابتة في الكود', () => {
    const muttasilOptions = listOptions('madd_muttasil');
    const munfasilOptions = listOptions('madd_munfasil');
    expect(muttasilOptions.length).toBeGreaterThan(0);
    expect(munfasilOptions.length).toBeGreaterThan(0);
    // كل خيار له numericValue صحيح موجب
    for (const opt of [...muttasilOptions, ...munfasilOptions]) {
      expect(Number.isInteger(opt.numericValue)).toBe(true);
      expect(opt.numericValue).toBeGreaterThan(0);
      expect(opt.unit).toBe('HARAKAT');
    }
  });

  it('يجب ألا يسمح بقيمة مد غير صحيحة', () => {
    const invalid = {
      id: 'test-invalid',
      ruleTypeId: 'madd_muttasil',
      label: 'invalid',
      numericValue: -1,
      unit: 'HARAKAT',
      order: 99,
      status: 'ACTIVE' as const,
    };
    expect(() => saveRuleOption(invalid)).toThrow();
  });

  it('يجب أن يولد choiceGroupId حتميا من الموضع', () => {
    const id1 = generateChoiceGroupId({ ayahKey: 1001, startPosition: 3, endPosition: 3 });
    const id2 = generateChoiceGroupId({ ayahKey: 1001, startPosition: 3, endPosition: 3 });
    expect(id1).toBe(id2);
    const id3 = generateChoiceGroupId({ ayahKey: 1001, startPosition: 4, endPosition: 4 });
    expect(id1).not.toBe(id3);
  });

  it('يجب أن يولد choiceGroupId مختلفا لأنواع مختلفة في نفس الموضع', () => {
    const idMuttasil = generateChoiceGroupId({
      ayahKey: 1001,
      startPosition: 3,
      endPosition: 3,
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_muttasil',
    });
    const idMunfasil = generateChoiceGroupId({
      ayahKey: 1001,
      startPosition: 3,
      endPosition: 3,
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_munfasil',
    });
    expect(idMuttasil).not.toBe(idMunfasil);
  });
});

describe('Decision Resolver مع الهوية الدلالية', () => {
  const profile = createDefaultEngineConfig();

  it('موضعان منفصلان: لا تنافي (Spec §46)', () => {
    const v1: Variant = {
      id: 'v1',
      ayahKey: 1001,
      category: 'MADUD',
      title: 'مد متصل',
      startPosition: 1,
      endPosition: 1,
      alternatives: [],
      status: 'DRAFT',
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_muttasil',
      choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 1, endPosition: 1, ruleFamilyId: 'madd', ruleTypeId: 'madd_muttasil' }),
    } as any;
    const v2: Variant = {
      id: 'v2',
      ayahKey: 1001,
      category: 'MADUD',
      title: 'مد منفصل',
      startPosition: 5,
      endPosition: 5,
      alternatives: [],
      status: 'DRAFT',
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_munfasil',
      choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 5, endPosition: 5, ruleFamilyId: 'madd', ruleTypeId: 'madd_munfasil' }),
    } as any;

    const result = resolveLocusExclusion(v1, v2, profile);
    expect(result.decision.exclusive).toBe(false);
    expect(result.decision.status).toBe('INDEPENDENT');
  });

  it('نفس الموضع ونفس النوع بقيم مختلفة: متنافيان (Spec §47)', () => {
    const choiceId = generateChoiceGroupId({ ayahKey: 1001, startPosition: 3, endPosition: 3, ruleFamilyId: 'madd', ruleTypeId: 'madd_munfasil' });
    const v1: Variant = {
      id: 'v1',
      ayahKey: 1001,
      category: 'MADUD',
      title: 'منفصل 2',
      startPosition: 3,
      endPosition: 3,
      alternatives: [],
      status: 'DRAFT',
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_munfasil',
      choiceGroupId: choiceId,
    } as any;
    const v2: Variant = {
      id: 'v2',
      ayahKey: 1001,
      category: 'MADUD',
      title: 'منفصل 4',
      startPosition: 3,
      endPosition: 3,
      alternatives: [],
      status: 'DRAFT',
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_munfasil',
      choiceGroupId: choiceId,
    } as any;

    const result = resolveLocusExclusion(v1, v2, profile);
    expect(result.decision.exclusive).toBe(true);
    expect(result.decision.status).toBe('EXCLUSIVE');
  });

  it('نفس النوع في مواضع مختلفة: غير متنافيين (Spec §46)', () => {
    const v1: Variant = {
      id: 'v1',
      ayahKey: 1001,
      category: 'MADUD',
      title: 'منفصل 2 في A',
      startPosition: 2,
      endPosition: 2,
      alternatives: [],
      status: 'DRAFT',
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_munfasil',
      choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 2, endPosition: 2, ruleFamilyId: 'madd', ruleTypeId: 'madd_munfasil' }),
    } as any;
    const v2: Variant = {
      id: 'v2',
      ayahKey: 1001,
      category: 'MADUD',
      title: 'منفصل 4 في B',
      startPosition: 5,
      endPosition: 5,
      alternatives: [],
      status: 'DRAFT',
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_munfasil',
      choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 5, endPosition: 5, ruleFamilyId: 'madd', ruleTypeId: 'madd_munfasil' }),
    } as any;

    const result = resolveLocusExclusion(v1, v2, profile);
    expect(result.decision.exclusive).toBe(false);
  });

  it('متصل + منفصل في مواضع مختلفة: مرتبطان (Spec §48)', () => {
    const v1: Variant = {
      id: 'v1',
      ayahKey: 1001,
      category: 'MADUD',
      title: 'متصل 4 في A',
      startPosition: 1,
      endPosition: 1,
      alternatives: [],
      status: 'DRAFT',
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_muttasil',
      choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 1, endPosition: 1, ruleFamilyId: 'madd', ruleTypeId: 'madd_muttasil' }),
    } as any;
    const v2: Variant = {
      id: 'v2',
      ayahKey: 1001,
      category: 'MADUD',
      title: 'منفصل 2 في B',
      startPosition: 5,
      endPosition: 5,
      alternatives: [],
      status: 'DRAFT',
      ruleFamilyId: 'madd',
      ruleTypeId: 'madd_munfasil',
      choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 5, endPosition: 5, ruleFamilyId: 'madd', ruleTypeId: 'madd_munfasil' }),
    } as any;

    const result = resolveLocusExclusion(v1, v2, profile);
    // موضعان منفصلان => independent => can be merged
    expect(result.decision.exclusive).toBe(false);
  });
});

describe('Combination Engine مع Choice Group', () => {
  it('قارئ واحد: مد متصل 4 + مد منفصل 2 => تركيب واحد (Spec §45)', () => {
    const variants: Variant[] = [
      {
        id: 'var-muttasil',
        ayahKey: 1001,
        category: 'MADUD',
        title: 'متصل',
        startPosition: 1,
        endPosition: 1,
        alternatives: [
          {
            id: 'alt-muttasil-4',
            text: 'كلمة',
            label: '4 حركات',
            scope: { kind: 'NARRATORS', narratorIds: ['narrator-hafs'] },
            maddHarakat: 4,
            ruleFamilyId: 'madd',
            ruleTypeId: 'madd_muttasil',
            ruleOptionId: 'madd_muttasil_4',
          },
        ],
        status: 'DRAFT',
        ruleFamilyId: 'madd',
        ruleTypeId: 'madd_muttasil',
        choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 1, endPosition: 1, ruleFamilyId: 'madd', ruleTypeId: 'madd_muttasil' }),
      } as any,
      {
        id: 'var-munfasil',
        ayahKey: 1001,
        category: 'MADUD',
        title: 'منفصل',
        startPosition: 5,
        endPosition: 5,
        alternatives: [
          {
            id: 'alt-munfasil-2',
            text: 'كلمة',
            label: '2 حركات',
            scope: { kind: 'NARRATORS', narratorIds: ['narrator-hafs'] },
            maddHarakat: 2,
            ruleFamilyId: 'madd',
            ruleTypeId: 'madd_munfasil',
            ruleOptionId: 'madd_munfasil_2',
          },
        ],
        status: 'DRAFT',
        ruleFamilyId: 'madd',
        ruleTypeId: 'madd_munfasil',
        choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 5, endPosition: 5, ruleFamilyId: 'madd', ruleTypeId: 'madd_munfasil' }),
      } as any,
    ];

    const plan = buildReadingPlan(10, [], 'END_TO_START');
    const combinations = buildReadingCombinations(variants, plan, {
      engine: { traversal: 'END_TO_START', alternativeOrder: 'STRENGTH', lineSpan: 'FULL_AYAH', textToTreeGap: 1, rowSpacing: 1, symbolDisplay: 'SYMBOLS' } as any,
      engineConfig: DEFAULT_SYSTEM_PROFILE,
      maxPerUnit: 100,
    });

    // يجب أن يكون هناك تركيب واحد يجمع المدين
    expect(combinations.length).toBe(1);
    expect(combinations[0].picks.length).toBe(2);
  });

  it('موضع واحد: منفصل 2 + منفصل 4 => تركيبان وليس واحدا (Spec §47)', () => {
    const choiceId = generateChoiceGroupId({ ayahKey: 1001, startPosition: 3, endPosition: 3, ruleFamilyId: 'madd', ruleTypeId: 'madd_munfasil' });
    const variants: Variant[] = [
      {
        id: 'var-munfasil-2',
        ayahKey: 1001,
        category: 'MADUD',
        title: 'منفصل 2',
        startPosition: 3,
        endPosition: 3,
        alternatives: [
          {
            id: 'alt-2',
            text: 'كلمة',
            label: '2 حركات',
            scope: { kind: 'NARRATORS', narratorIds: ['narrator-hafs'] },
            maddHarakat: 2,
            ruleFamilyId: 'madd',
            ruleTypeId: 'madd_munfasil',
            ruleOptionId: 'madd_munfasil_2',
          },
        ],
        status: 'DRAFT',
        ruleFamilyId: 'madd',
        ruleTypeId: 'madd_munfasil',
        choiceGroupId: choiceId,
      } as any,
      {
        id: 'var-munfasil-4',
        ayahKey: 1001,
        category: 'MADUD',
        title: 'منفصل 4',
        startPosition: 3,
        endPosition: 3,
        alternatives: [
          {
            id: 'alt-4',
            text: 'كلمة',
            label: '4 حركات',
            scope: { kind: 'NARRATORS', narratorIds: ['narrator-hafs'] },
            maddHarakat: 4,
            ruleFamilyId: 'madd',
            ruleTypeId: 'madd_munfasil',
            ruleOptionId: 'madd_munfasil_4',
          },
        ],
        status: 'DRAFT',
        ruleFamilyId: 'madd',
        ruleTypeId: 'madd_munfasil',
        choiceGroupId: choiceId,
      } as any,
    ];

    const plan = buildReadingPlan(10, [], 'END_TO_START');
    const combinations = buildReadingCombinations(variants, plan, {
      engine: { traversal: 'END_TO_START', alternativeOrder: 'STRENGTH', lineSpan: 'FULL_AYAH', textToTreeGap: 1, rowSpacing: 1, symbolDisplay: 'SYMBOLS' } as any,
      engineConfig: DEFAULT_SYSTEM_PROFILE,
      maxPerUnit: 100,
    });

    // يجب أن يكون هناك تركيبان: واحد بـ 2 وواحد بـ 4
    expect(combinations.length).toBe(2);
    expect(combinations[0].picks.length).toBe(1);
    expect(combinations[1].picks.length).toBe(1);
  });

  it('اختبار القارئ: إمامان بأوجه مختلفة لا يختلطان (Spec §49)', () => {
    const variants: Variant[] = [
      {
        id: 'var-muttasil',
        ayahKey: 1001,
        category: 'MADUD',
        title: 'متصل',
        startPosition: 1,
        endPosition: 1,
        alternatives: [
          {
            id: 'alt-muttasil-hafs-4',
            text: 'كلمة',
            label: '4 حركات لحفص',
            scope: { kind: 'NARRATORS', narratorIds: ['narrator-hafs'] },
            maddHarakat: 4,
            ruleFamilyId: 'madd',
            ruleTypeId: 'madd_muttasil',
            ruleOptionId: 'madd_muttasil_4',
          },
          {
            id: 'alt-muttasil-warsh-5',
            text: 'كلمة',
            label: '5 حركات لورش',
            scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
            maddHarakat: 5,
            ruleFamilyId: 'madd',
            ruleTypeId: 'madd_muttasil',
            ruleOptionId: 'madd_muttasil_5',
          },
        ],
        status: 'DRAFT',
        ruleFamilyId: 'madd',
        ruleTypeId: 'madd_muttasil',
        choiceGroupId: generateChoiceGroupId({ ayahKey: 1001, startPosition: 1, endPosition: 1, ruleFamilyId: 'madd', ruleTypeId: 'madd_muttasil' }),
      } as any,
    ];

    const plan = buildReadingPlan(10, [], 'END_TO_START');
    const combinations = buildReadingCombinations(variants, plan, {
      engine: { traversal: 'END_TO_START', alternativeOrder: 'STRENGTH', lineSpan: 'FULL_AYAH', textToTreeGap: 1, rowSpacing: 1, symbolDisplay: 'SYMBOLS' } as any,
      engineConfig: DEFAULT_SYSTEM_PROFILE,
      maxPerUnit: 100,
    });

    // يجب أن يكون هناك تركيبان: واحد لحفص وواحد لورش
    expect(combinations.length).toBe(2);
    const hafsCombo = combinations.find((c) => c.narratorIds.includes('narrator-hafs'));
    const warshCombo = combinations.find((c) => c.narratorIds.includes('narrator-warsh'));
    expect(hafsCombo).toBeDefined();
    expect(warshCombo).toBeDefined();
    expect(hafsCombo?.picks[0].alternative.maddHarakat).toBe(4);
    expect(warshCombo?.picks[0].alternative.maddHarakat).toBe(5);
  });
});

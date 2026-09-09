// اختبارات جسر المحرر إلى Decision Resolver (P-07، FR-EN-03)
//
// المطلوب المعماري: لا قرار دمج/تنافٍ/علاقة خارج طبقة القرار. هذه الاختبارات
// تحرس ثلاثة أشياء:
//   1) محرك التراكيب يحسم التنافي عبر الجسر، وتُغيّره قاعدة في ملف المحرك
//      دون لمس كود المحرك،
//   2) مخزن المحرر يستشير الجسر قبل تسجيل رابط: المحظور يُرفض، والمخالف
//      لمصفوفة الدمج يُقبل بتحذير،
//   3) اختبار معماري نصي: الملفات المستهلكة تستورد طبقة القرار فعلا.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import { buildReadingCombinations } from '@/lib/tashjeer/combination-engine';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import { createDefaultEngineConfig, DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import {
  editorCategoryToStudioType,
  resolveExclusiveGroups,
  resolveLinkPolicy,
  resolveLocusExclusion,
  studioTypeToEditorCategory,
} from '@/lib/tashjeer/decision/editor-bridge';
import { exclusiveGroupKeys } from '@/lib/tashjeer/loci';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import type { Variant, VariantAlternative, ViewFilter } from '@/types/tashjeer';
import { MemoryStorage } from './helpers/memory-storage';

const ayahKey = makeAyahKey(1, 2);
const layout = layoutAyah(ayahKey, getAyahWords(1, 2), DEFAULT_LAYOUT_OPTIONS);

const filter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

function variant(
  id: string,
  start: number,
  end: number,
  alternatives: VariantAlternative[],
  overrides: Partial<Variant> = {}
): Variant {
  return { id, ayahKey, category: 'FARSH', title: id, startPosition: start, endPosition: end, status: 'DRAFT', alternatives, ...overrides };
}

const qalun = { kind: 'NARRATORS' as const, narratorIds: ['narrator-qalun'] };

const maddQasr = variant('madd-qasr', 1, 1, [{ id: 'q', text: 'قصر', label: 'قصر', maddHarakat: 2, scope: qalun }], { category: 'MADUD' });
const maddTawassut = variant('madd-tawassut', 1, 1, [{ id: 't', text: 'توسط', label: 'توسط', maddHarakat: 4, scope: qalun }], { category: 'MADUD' });
const farshSameWord = variant('farsh-1', 1, 1, [{ id: 'f', text: 'فرش', label: 'فرش', scope: qalun }]);
const farshFar = variant('farsh-3', 3, 3, [{ id: 'f3', text: 'فرش', label: 'فرش', scope: qalun }]);

/** قاعدة تنافٍ صريح بين المد والفرش في الموضع نفسه (params.exclusive). */
function exclusiveMaddFarshRule(): EngineRule {
  return {
    id: 'er-test-madd-farsh-exclusive',
    name: 'المد والفرش في موضع واحد متنافيان',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: {
      any: [
        { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }, { field: 'relatedType', op: 'equals', value: 'FARSH' }] },
        { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }, { field: 'relatedType', op: 'equals', value: 'MADD' }] },
      ],
    },
    actions: [{ type: 'PREVENT_MERGE', params: { exclusive: true } }],
    priority: 120,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    createdAt: 't',
    updatedAt: 't',
  };
}

function profileWith(rule: EngineRule): EngineConfig {
  const base = createDefaultEngineConfig('test');
  return { ...base, rules: [...base.rules, rule] };
}

describe('ترجمة الفئات بين المحرر والاستوديو', () => {
  it('تحويل ذهابا وإيابا يحافظ على الفئات الأساسية', () => {
    for (const category of ['MADUD', 'FARSH', 'HAMZ', 'WAQF', 'TAJWEED', 'USUL'] as const) {
      expect(studioTypeToEditorCategory(editorCategoryToStudioType(category))).toBe(category);
    }
  });
});

describe('تنافي المواضع عبر الـ Resolver', () => {
  it('موضعان منفصلان لا يتنافيان أبدا', () => {
    const result = resolveLocusExclusion(maddQasr, farshFar);
    expect(result.decision.exclusive).toBe(false);
    expect(result.decision.sharePosition).toBe(false);
  });

  it('مدّان في الموضع نفسه وجهان متنافيان (DM-09)', () => {
    const result = resolveLocusExclusion(maddQasr, maddTawassut);
    expect(result.decision.exclusive).toBe(true);
    expect(result.trace.some((step) => step.stage === 'EXCLUSION')).toBe(true);
  });

  it('فئتان مختلفتان في الموضع نفسه مستقلتان بالسياسة الافتراضية', () => {
    const result = resolveLocusExclusion(maddQasr, farshSameWord, DEFAULT_SYSTEM_PROFILE);
    expect(result.decision.exclusive).toBe(false);
  });

  it('قاعدة PREVENT_MERGE مع exclusive تجعل فئتين مختلفتين متنافيتين', () => {
    const result = resolveLocusExclusion(maddQasr, farshSameWord, profileWith(exclusiveMaddFarshRule()));
    expect(result.decision.exclusive).toBe(true);
    expect(result.appliedRules.map((rule) => rule.id)).toContain('er-test-madd-farsh-exclusive');
  });

  it('يطابق المفاتيح الهندسية القديمة عند السياسة الافتراضية', () => {
    const variants = [maddQasr, maddTawassut, farshSameWord, farshFar];
    const legacy = exclusiveGroupKeys(variants);
    const { groups } = resolveExclusiveGroups(variants);
    // المدّان في مجموعة واحدة، والفرشان كل واحد بمفرده.
    expect(groups.get('madd-qasr')).toBe(groups.get('madd-tawassut'));
    expect(groups.get('farsh-1')).not.toBe(groups.get('farsh-3'));
    expect(legacy.get('madd-qasr')).toBe(legacy.get('madd-tawassut'));
  });
});

describe('محرك التراكيب يمر بالـ Resolver', () => {
  it('السياسة الافتراضية: المد والفرش في الكلمة نفسها يجتمعان في سطر واحد', () => {
    const plan = buildReadingPlan(4);
    const combos = buildReadingCombinations([maddQasr, farshSameWord], plan, { engine: DEFAULT_ENGINE_SETTINGS });
    const qalunCombos = combos.filter((combo) => combo.narratorIds.includes('narrator-qalun'));
    expect(qalunCombos).toHaveLength(1);
    expect(qalunCombos[0].picks).toHaveLength(2);
  });

  it('قاعدة تنافٍ في ملف المحرك تفصلهما إلى سطرين دون تعديل المحرك', () => {
    const engineConfig = profileWith(exclusiveMaddFarshRule());
    const plan = buildReadingPlan(4);
    const combos = buildReadingCombinations([maddQasr, farshSameWord], plan, { engine: DEFAULT_ENGINE_SETTINGS, engineConfig });
    const qalunCombos = combos.filter((combo) => combo.narratorIds.includes('narrator-qalun'));
    expect(qalunCombos).toHaveLength(2);
    expect(qalunCombos.every((combo) => combo.picks.length === 1)).toBe(true);

    const classic = generateClassicTashjeer([maddQasr, farshSameWord], layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
      engineConfig,
    });
    expect(classic.lines.filter((line) => line.narratorIds.includes('narrator-qalun'))).toHaveLength(2);
  });
});

describe('سياسة الروابط اليدوية', () => {
  it('رابط دمج بين مد وفرش يُقبل بتحذير مخالفة مصفوفة الدمج', () => {
    const result = resolveLinkPolicy({
      kind: 'FACE_TO_FACE',
      relation: 'MERGE',
      from: { type: 'FACE', id: 'a::1' },
      to: { type: 'FACE', id: 'b::2' },
      fromCategory: 'MADUD',
      toCategory: 'FARSH',
    });
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.warning).toBeTruthy();
  });

  it('رابط دمج بين مد وتحقيق يُقبل بلا تحذير', () => {
    const result = resolveLinkPolicy({
      kind: 'FACE_TO_FACE',
      relation: 'MERGE',
      from: { type: 'FACE', id: 'a::1' },
      to: { type: 'FACE', id: 'b::2' },
      fromCategory: 'MADUD',
      toCategory: 'USUL',
    });
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.warning).toBeUndefined();
  });

  it('قاعدة RELATION حاظرة ترفض الرابط', () => {
    const blocking: EngineRule = {
      id: 'er-test-block-segment-rule',
      name: 'منع ربط الأجزاء بالقواعد',
      type: 'RELATION',
      category: 'RELATION',
      scope: 'MUSHAF',
      conditions: { all: [{ field: 'linkKind', op: 'equals', value: 'SEGMENT_TO_RULE' }] },
      actions: [{ type: 'BLOCK_RESULT' }],
      priority: 100,
      groupId: 'blocking',
      specificity: 'MUSHAF',
      hardness: 'HARD',
      status: 'ACTIVE',
      version: 1,
      createdAt: 't',
      updatedAt: 't',
    };
    const result = resolveLinkPolicy(
      { kind: 'SEGMENT_TO_RULE', relation: 'REFERENCE', from: { type: 'SEGMENT', id: 's' }, to: { type: 'RULE', id: 'r' } },
      profileWith(blocking)
    );
    expect(result.decision.allowed).toBe(false);
    expect(result.decision.reason).toContain('منع ربط الأجزاء');
  });
});

describe('مخزن المحرر يستشير الـ Resolver قبل تسجيل الرابط', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('الرابط المحظور لا يُسجَّل ويُحفظ القرار للواجهة', async () => {
    const { saveEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
    const base = createDefaultEngineConfig('default');
    saveEngineConfig({
      ...base,
      rules: [
        ...base.rules,
        {
          id: 'er-test-block-line-merge',
          name: 'منع دمج الأسطر يدويا',
          type: 'RELATION',
          category: 'RELATION',
          scope: 'MUSHAF',
          conditions: { all: [{ field: 'linkKind', op: 'equals', value: 'LINE_TO_LINE' }] },
          actions: [{ type: 'BLOCK_RESULT' }],
          priority: 100,
          groupId: 'blocking',
          specificity: 'MUSHAF',
          hardness: 'HARD',
          status: 'ACTIVE',
          version: 1,
          createdAt: 't',
          updatedAt: 't',
        },
      ],
    });

    const { useEditorStore } = await import('@/stores/editor-store');
    useEditorStore.getState().openAyah(ayahKey);
    const notice = useEditorStore.getState().addLink({
      kind: 'LINE_TO_LINE',
      relation: 'MERGE',
      from: { type: 'LINE', id: 'combo::a' },
      to: { type: 'LINE', id: 'combo::b' },
    });

    expect(notice.allowed).toBe(false);
    expect(useEditorStore.getState().document?.links ?? []).toHaveLength(0);
    expect(useEditorStore.getState().lastLinkDecision?.allowed).toBe(false);
    expect(useEditorStore.getState().lastLinkDecision?.appliedRuleNames).toContain('منع دمج الأسطر يدويا');
  });

  it('الرابط المسموح يُسجَّل ويعيد معرّفه', async () => {
    const { useEditorStore } = await import('@/stores/editor-store');
    useEditorStore.getState().openAyah(ayahKey);
    const notice = useEditorStore.getState().addLink({
      kind: 'LINE_TO_LINE',
      relation: 'MERGE',
      from: { type: 'LINE', id: 'combo::a' },
      to: { type: 'LINE', id: 'combo::b' },
    });
    expect(notice.allowed).toBe(true);
    expect(notice.linkId).toBeTruthy();
    expect(useEditorStore.getState().document?.links).toHaveLength(1);
  });
});

describe('الاختبار المعماري: لا قرار خارج طبقة القرار (P-07)', () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

  it('محرك التراكيب ومخزن المحرر يستوردان جسر القرار', () => {
    expect(read('src/lib/tashjeer/combination-engine.ts')).toContain("from './decision/editor-bridge'");
    expect(read('src/stores/editor-store.ts')).toContain("@/lib/tashjeer/decision/editor-bridge");
  });

  it('لا يستعمل المحرك المفاتيح الهندسية مباشرة في التنافي', () => {
    expect(read('src/lib/tashjeer/combination-engine.ts')).not.toContain('exclusiveGroupKeys(');
  });

  it('حوار «لماذا؟» لا يملك ترجمة فئات خاصة به', () => {
    const dialog = read('src/components/editor/WhyTraceDialog.tsx');
    expect(dialog).not.toContain('function editorTypeToStudioType');
    expect(dialog).toContain('editorCategoryToStudioType');
  });
});

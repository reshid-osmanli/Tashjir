// اختبارات سياق الوقف/الوصل على نهايات الآيات — Waqf/Wasl Context (FR-ED-11)
// مشروع التشجير - نظام القراءات العشر
//
// معايير القبول AC-03 للحزمة 08:
//   T1: اختلاف «وقفًا فقط»/«وصلًا فقط» عند نهاية الآية يظهر في سياقه ويسقط
//       خارج سياقه، من النتيجة فقط لا من البيانات.
//   T2: الحدود الداخلية وقفٌ إلا ما وُصل صراحة؛ الممنوع يغلب الوصل.
//   T3: «ممنوع الوصل» قيد صلب: يرفض بقرار مسمّى المرجع، ولا يُتجاوز إلا
//       بحذف العلامة نفسها.
//   T4: النموذج والتحديد والترحيل كما هي، موسّعة لا مكسورة.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { buildReadingCombinations } from '@/lib/tashjeer/combination-engine';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import { resolveConnection, resolveDifferenceContext } from '@/lib/tashjeer/decision/api';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { migrateBoundaryToWaqfMark } from '@/lib/tashjeer/migration/migrate-v7-v8';
import {
  buildReadingPlan,
  variantAppliesToRecitation,
} from '@/lib/tashjeer/reading-plan';
import {
  buildSelectionBreadcrumb,
  describeSelection,
} from '@/lib/tashjeer/selection-context';
import {
  differenceAppliesAt,
  jointAt,
  jointStateIcon,
  jointStateLabel,
  listJoints,
  resolvePositionMode,
  sanitizeSegmentWasl,
  wordsInSegment,
} from '@/lib/tashjeer/waqf-context';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import type {
  RecitationBoundary,
  Variant,
  VariantAlternative,
  ViewFilter,
} from '@/types/tashjeer';
import { MemoryStorage } from './helpers/memory-storage';

const ayahKey = makeAyahKey(1, 2); // أربع كلمات
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
  return {
    id,
    ayahKey,
    category: 'FARSH',
    title: id,
    startPosition: start,
    endPosition: end,
    status: 'DRAFT',
    alternatives,
    ...overrides,
  };
}

function qalunFace(id: string): VariantAlternative {
  return {
    id,
    text: 'وجه',
    label: 'وجه',
    ruleLabel: 'فرش',
    scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
  };
}

function blockingRule(status: EngineRule['status']): EngineRule {
  return {
    id: 'block-wasl',
    name: 'منع الوصل',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [] },
    actions: [{ type: 'BLOCK_RESULT' }],
    priority: 100,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'HARD',
    status,
    version: 1,
    createdAt: 't',
    updatedAt: 't',
  };
}

function profileWith(rule: EngineRule): EngineConfig {
  return { ...DEFAULT_SYSTEM_PROFILE, rules: [rule] };
}

describe('T1 — سياق آخر الآية (وقفًا فقط/وصلًا فقط)', () => {
  it('السلوك القديم بلا نافذة: وقفًا فقط يحتاج وقفًا صريحًا، ووصلًا فقط يحتاج غيابه', () => {
    const waqfOnly = { recitationMode: 'WAQF_ONLY' as const, endPosition: 4 };
    const waslOnly = { recitationMode: 'WASL_ONLY' as const, endPosition: 4 };
    const explicit: RecitationBoundary[] = [{ id: 'w', kind: 'WAQF', position: 4 }];

    expect(variantAppliesToRecitation(waqfOnly, [])).toBe(false);
    expect(variantAppliesToRecitation(waqfOnly, explicit)).toBe(true);
    expect(variantAppliesToRecitation(waslOnly, [])).toBe(true);
    expect(variantAppliesToRecitation(waslOnly, explicit)).toBe(false);
    expect(variantAppliesToRecitation({ endPosition: 4 }, [])).toBe(true);
  });

  it('نهاية الآية وقفٌ طبيعي: وقفًا فقط يظهر بلا علامة، ووصلًا فقط يسقط', () => {
    const waqfOnly = { recitationMode: 'WAQF_ONLY' as const, endPosition: 4 };
    const waslOnly = { recitationMode: 'WASL_ONLY' as const, endPosition: 4 };
    const opts = { wordsCount: 4 };

    expect(variantAppliesToRecitation(waqfOnly, [], opts)).toBe(true);
    expect(variantAppliesToRecitation(waslOnly, [], opts)).toBe(false);
  });

  it('وصل الآية يقلب الحدّ: وقفًا فقط يسقط عند الدرز، ووصلًا فقط يظهر', () => {
    const waqfOnly = { recitationMode: 'WAQF_ONLY' as const, endPosition: 4 };
    const waslOnly = { recitationMode: 'WASL_ONLY' as const, endPosition: 4 };
    const linked = { wordsCount: 9, linkNextAyah: true, firstAyahEndPosition: 4 };

    expect(variantAppliesToRecitation(waqfOnly, [], linked)).toBe(false);
    expect(variantAppliesToRecitation(waslOnly, [], linked)).toBe(true);
    // وآخر النافذة الموصولة يبقى وقفًا طبيعيًا.
    expect(
      variantAppliesToRecitation({ recitationMode: 'WAQF_ONLY', endPosition: 9 }, [], linked)
    ).toBe(true);
  });

  it('مصفوفة سياق الاختلاف: دائمًا في الحالين، والمشروط في سياقه فقط', () => {
    expect(resolveDifferenceContext({ context: 'ALWAYS', mode: 'WAQF' }).decision.active).toBe(true);
    expect(resolveDifferenceContext({ context: 'ALWAYS', mode: 'WASL' }).decision.active).toBe(true);
    expect(resolveDifferenceContext({ context: 'WAQF_ONLY', mode: 'WAQF' }).decision.active).toBe(true);
    expect(resolveDifferenceContext({ context: 'WAQF_ONLY', mode: 'WASL' }).decision.active).toBe(false);
    expect(resolveDifferenceContext({ context: 'WASL_ONLY', mode: 'WASL' }).decision.active).toBe(true);
    expect(resolveDifferenceContext({ context: 'WASL_ONLY', mode: 'WAQF' }).decision.active).toBe(false);
  });

  it('محرك التشجير الكلاسيكي يسقط المشروط الخارج عن سياقه من الأسطر', () => {
    const variants = [
      variant('end-waqf', 4, 4, [qalunFace('end-waqf-a')], { recitationMode: 'WAQF_ONLY' }),
    ];
    const waqf = generateClassicTashjeer(variants, layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
      recitation: { wordsCount: 4 },
    });
    expect(waqf.lines).toHaveLength(1);

    const wasl = generateClassicTashjeer(variants, layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
      recitation: { wordsCount: 9, linkNextAyah: true, firstAyahEndPosition: 4 },
    });
    expect(wasl.lines).toHaveLength(0);
    // والكيان نفسه باقٍ في البيانات (الأسطر وحدها نقصت).
    expect(variants).toHaveLength(1);
  });

  it('محرك التراكيب يسقط المشروط الخارج عن سياقه من التراكيب', () => {
    const variants = [
      variant('end-wasl', 4, 4, [qalunFace('end-wasl-a')], { recitationMode: 'WASL_ONLY' }),
    ];
    const plan = buildReadingPlan(4);
    const waqfOnly = buildReadingCombinations(variants, plan, {
      engine: DEFAULT_ENGINE_SETTINGS,
      recitation: { wordsCount: 4 },
    });
    expect(waqfOnly).toHaveLength(0);

    const linked = buildReadingCombinations(variants, plan, {
      engine: DEFAULT_ENGINE_SETTINGS,
      recitation: { wordsCount: 9, linkNextAyah: true, firstAyahEndPosition: 4 },
    });
    expect(linked.length).toBeGreaterThan(0);
  });
});

describe('T2 — الحدود الداخلية (وقف إلا ما وُصل)', () => {
  it('بلا علامات: الحدّ الوحيد آخر الآية وقفًا', () => {
    const joints = listJoints({ wordsCount: 4, boundaries: [] });
    expect(joints).toHaveLength(1);
    expect(joints[0]).toMatchObject({ position: 4, kind: 'AYAH_END', state: 'WAQF', connected: false });
  });

  it('العلامة الداخلية حدُّ وقفٍ افتراضًا، والوصل الصريح يقلبه وصلًا', () => {
    const boundaries: RecitationBoundary[] = [{ id: 'w', kind: 'WAQF', position: 2 }];
    const stopped = listJoints({ wordsCount: 4, boundaries });
    expect(stopped.map((joint) => joint.position)).toEqual([2, 4]);
    expect(stopped[0]).toMatchObject({ kind: 'INTERNAL', state: 'WAQF', connected: false });

    const connected = listJoints({ wordsCount: 4, boundaries, segmentWasl: [2] });
    expect(connected[0]).toMatchObject({ kind: 'INTERNAL', state: 'WASL', connected: true });
  });

  it('المنع يغلب الوصل الصريح: حدٌّ عليه ممنوع الوصل مرفوض ولو ذُكر في الوصل', () => {
    const boundaries: RecitationBoundary[] = [{ id: 'f', kind: 'NO_WASL', position: 2 }];
    const joints = listJoints({ wordsCount: 4, boundaries, segmentWasl: [2] });
    expect(joints[0]).toMatchObject({ kind: 'INTERNAL', state: 'FORBIDDEN', connected: false });
    expect(resolvePositionMode(2, { wordsCount: 4, boundaries, segmentWasl: [2] })).toBe('WAQF');
  });

  it('الدرز الموصول وصلٌ، وغير الموصول وقفٌ، وآخر النافذة وقفٌ دائمًا', () => {
    const linked = { wordsCount: 9, boundaries: [], linkNextAyah: true, firstAyahEndPosition: 4 };
    expect(resolvePositionMode(4, linked)).toBe('WASL');
    expect(resolvePositionMode(9, linked)).toBe('WAQF');
    // وبلا وصل: آخر الآية وحده وقفٌ، وما عداه استمرار.
    expect(resolvePositionMode(4, { wordsCount: 4, boundaries: [] })).toBe('WAQF');
    expect(resolvePositionMode(2, { wordsCount: 4, boundaries: [] })).toBe('WASL');
    const joints = listJoints(linked);
    expect(joints.find((joint) => joint.position === 4)).toMatchObject({ kind: 'AYAH_SEAM', state: 'WASL' });
  });

  it('لا حدَّ في موضع بلا علامة؛ والمواضع غير الحدّية وصلٌ', () => {
    expect(jointAt(3, { wordsCount: 4, boundaries: [] })).toBeNull();
    expect(resolvePositionMode(3, { wordsCount: 4, boundaries: [] })).toBe('WASL');
    expect(jointAt(4, { wordsCount: 4, boundaries: [] })).toMatchObject({ kind: 'AYAH_END' });
  });

  it('اختلاف داخل مقطع يتقوّم بحدِّ مقطعه لا بآخر الآية', () => {
    const boundaries: RecitationBoundary[] = [{ id: 'w', kind: 'WAQF', position: 2 }];
    // اختلاف «وقفًا فقط» ينتهي عند حدّ المقطع (2): ظاهر.
    expect(differenceAppliesAt('WAQF_ONLY', 2, { wordsCount: 4, boundaries })).toBe(true);
    // و«وصلًا فقط» عند الحدّ نفسه: ساقط حتى يُوصل المقطع.
    expect(differenceAppliesAt('WASL_ONLY', 2, { wordsCount: 4, boundaries })).toBe(false);
    expect(differenceAppliesAt('WASL_ONLY', 2, { wordsCount: 4, boundaries, segmentWasl: [2] })).toBe(true);
  });

  it('تطهير الوصل: إسقاط الزائف والمكرر وما تجاوز آخر حدّ', () => {
    expect(sanitizeSegmentWasl([3, 1, 3, 0, -2, 2.5, NaN, 9], 4)).toEqual([1, 3]);
    expect(sanitizeSegmentWasl(undefined)).toEqual([]);
  });

  it('كلمات المقطع: تصفية بالمدى الشامل', () => {
    const words = [1, 2, 3, 4].map((position) => ({ position, text: `ك${position}` }));
    expect(wordsInSegment(words, { startPosition: 2, endPosition: 3 }).map((word) => word.position)).toEqual([2, 3]);
    expect(wordsInSegment(words, { startPosition: 1, endPosition: 9 })).toHaveLength(4);
    expect(wordsInSegment(words, null)).toHaveLength(4);
  });
});

describe('T3 — ممنوع الوصل قيد صلب', () => {
  it('الصيغة القديمة باقية: المنع يرفض والغياب يسمح', () => {
    expect(resolveConnection(true).decision).toMatchObject({ allowed: false });
    expect(resolveConnection(true).decision.reason).toBe('الوصل ممنوع في هذا الموضع');
    expect(resolveConnection(false).decision.allowed).toBe(true);
  });

  it('الرفض يسمّي مرجع العلامة وموضعها في السبب والأثر', () => {
    const verdict = resolveConnection({
      forbiddenMark: { id: 'mark-7', note: 'وقف لازم' },
      label: 'نهاية الآية (بعد الكلمة ٤)',
    });
    expect(verdict.decision.allowed).toBe(false);
    expect(verdict.decision.reason).toContain('mark-7');
    expect(verdict.decision.reason).toContain('وقف لازم');
    expect(verdict.trace.some((step) => step.status === 'blocked')).toBe(true);
  });

  it('قاعدة مفعّلة حاجبة ترفض الوصل باسمها (قالب ممنوع الوصل)', () => {
    const verdict = resolveConnection({ label: 'حدّ داخلي' }, profileWith(blockingRule('ACTIVE')));
    expect(verdict.decision.allowed).toBe(false);
    expect(verdict.decision.reason).toContain('منع الوصل');
    expect(verdict.appliedRules.map((rule) => rule.id)).toContain('block-wasl');
  });

  it('القاعدة الحاجبة المسوّدة لا تحجب: القواعد المفعّلة وحدها تُقيَّم', () => {
    const verdict = resolveConnection({ label: 'حدّ داخلي' }, profileWith(blockingRule('DRAFT')));
    expect(verdict.decision.allowed).toBe(true);
  });

  it('قاعدة حاجبة تسقط اختلافًا في سياقه (تُقيَّم بعد مطابقة السياق)', () => {
    const verdict = resolveDifferenceContext(
      { context: 'WAQF_ONLY', mode: 'WAQF' },
      profileWith(blockingRule('ACTIVE'))
    );
    expect(verdict.decision.active).toBe(false);
    expect(verdict.decision.reason).toContain('منع الوصل');
  });
});

describe('T3 — الرفض على مستوى المخزن (يرفض ويسجّل ولا يغيّر)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadStore() {
    const { useEditorStore } = await import('@/stores/editor-store');
    return useEditorStore;
  }

  it('وصل الآية الممنوعة: false + رفض مسجّل + المستند ثابت', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(ayahKey);
    // آخر الآية الأولى: أربع كلمات.
    useEditorStore.getState().addBoundary({ id: 'forbid-end', kind: 'NO_WASL', position: 4 });

    const accepted = useEditorStore.getState().setLinkNextAyah(true);

    expect(accepted).toBe(false);
    expect(useEditorStore.getState().document!.readingWindow?.linkNextAyah).not.toBe(true);
    const rejection = useEditorStore.getState().lastConnectionRejection;
    expect(rejection).not.toBeNull();
    expect(rejection!.markId).toBe('forbid-end');
    expect(rejection!.reason).toContain('ممنوع');

    // حذف العلامة وحدها يفتح الباب (التراجع عن المنع = حذف العلامة).
    useEditorStore.getState().deleteBoundary('forbid-end');
    expect(useEditorStore.getState().setLinkNextAyah(true)).toBe(true);
    expect(useEditorStore.getState().document!.readingWindow?.linkNextAyah).toBe(true);
    expect(useEditorStore.getState().lastConnectionRejection).toBeNull();
  });

  it('وصل داخلي ممنوع: false + رفض، والفصل والحدّ المباح يعملان', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(ayahKey);
    useEditorStore.getState().addBoundary({ id: 'w2', kind: 'WAQF', position: 2 });
    useEditorStore.getState().addBoundary({ id: 'f3', kind: 'NO_WASL', position: 3 });

    expect(useEditorStore.getState().connectJoint(2)).toBe(true);
    expect(useEditorStore.getState().document!.readingWindow?.segmentWasl).toEqual([2]);

    expect(useEditorStore.getState().connectJoint(3)).toBe(false);
    expect(useEditorStore.getState().lastConnectionRejection!.markId).toBe('f3');
    // الفصل مباح دائمًا.
    useEditorStore.getState().disconnectJoint(2);
    expect(useEditorStore.getState().document!.readingWindow?.segmentWasl).toEqual([]);
  });
});

describe('T4 — النموذج والتحديد والترحيل', () => {
  it('ترحيل العلامة: النطاق والمصدر والضبط الحرفي', () => {
    const internal = migrateBoundaryToWaqfMark({ id: 'b1', kind: 'WAQF', position: 3 }, ayahKey, 9);
    expect(internal.scope).toBe('INTERNAL');

    const atEnd = migrateBoundaryToWaqfMark({ id: 'b2', kind: 'NO_WASL', position: 9 }, ayahKey, 9);
    expect(atEnd.kind).toBe('FORBIDDEN_WASL');
    expect(atEnd.scope).toBe('END_OF_AYAH');

    const engineMark = migrateBoundaryToWaqfMark(
      { id: 'b3', kind: 'WASL', position: 2, source: 'ENGINE', characterIndex: 5 },
      ayahKey,
      9
    );
    expect(engineMark.source).toBe('engine');
    expect(engineMark.characterIndex).toBe(5);
  });

  it('العلامة في التحديد الموحد: فتات ووصف', () => {
    const lookup = { boundaryLabel: (id: string) => (id === 'b1' ? 'وقف — ك2' : undefined) };
    const crumbs = buildSelectionBreadcrumb({ kind: 'BOUNDARY', id: 'b1', position: 2 }, lookup);
    expect(crumbs[crumbs.length - 1]).toMatchObject({ kind: 'BOUNDARY', label: 'وقف — ك2' });
    const summary = describeSelection({ kind: 'BOUNDARY', id: 'b1', position: 2 }, lookup);
    expect(summary).toMatchObject({ kind: 'BOUNDARY', label: 'وقف — ك2', leaf: true });
  });

  it('تسميات الحالات وأيقوناتها عربية غير فارغة', () => {
    for (const state of ['WAQF', 'WASL', 'FORBIDDEN'] as const) {
      expect(jointStateLabel(state).length).toBeGreaterThan(0);
      expect(jointStateIcon(state).length).toBeGreaterThan(0);
    }
  });
});

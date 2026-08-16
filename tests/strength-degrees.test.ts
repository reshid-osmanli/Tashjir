// اختبارات سلّم درجات قوة الوجه - Strength Degrees Tests
//
// السلّم صار بيانات محرَّرة من الإعدادات بعد أن كان أربع درجات ثابتة في
// الشيفرة، فصار لا بد من اختبار تسويته: لا معرّفات مكررة، والرتب متتابعة،
// و«الوجه المقدَّم» واحد لا يتعدد. وأهم من ذلك: الدرجة تُحسب لكل راوٍ على
// حدة، لأن الوجه قد يكون مقدَّما عند راوٍ مؤخَّرا عند غيره.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadDegrees() {
  return import('@/lib/tashjeer/strength-degrees');
}

describe('السلّم الافتراضي', () => {
  it('يبدأ بالدرجات الأربع المعهودة مرتَّبة، والمقدَّم أولها', async () => {
    const { createDefaultStrengthDegrees } = await loadDegrees();
    const catalog = createDefaultStrengthDegrees();

    expect(catalog.degrees.map((degree) => degree.id)).toEqual([
      'muqaddam',
      'rajih',
      'jaiz',
      'muakhkhar',
    ]);
    expect(catalog.degrees.map((degree) => degree.rank)).toEqual([1, 2, 3, 4]);
    expect(catalog.degrees.filter((degree) => degree.isPreferred)).toHaveLength(1);
    expect(catalog.degrees[0].isPreferred).toBe(true);
  });
});

describe('التسوية', () => {
  it('يعيد ترقيم الرتب متتابعة من واحد مهما كانت المدخلات', async () => {
    const { normalizeStrengthDegrees } = await loadDegrees();
    const catalog = normalizeStrengthDegrees({
      degrees: [
        { id: 'c', label: 'ثالثة', shortLabel: 'ث', rank: 90, color: '#000' },
        { id: 'a', label: 'أولى', shortLabel: 'أ', rank: 3, color: '#111' },
        { id: 'b', label: 'ثانية', shortLabel: 'ب', rank: 7, color: '#222' },
      ],
    });

    expect(catalog.degrees.map((degree) => degree.id)).toEqual(['a', 'b', 'c']);
    expect(catalog.degrees.map((degree) => degree.rank)).toEqual([1, 2, 3]);
  });

  it('يُسقط المعرّفات المكررة فلا تلتبس درجتان بمعرّف واحد', async () => {
    const { normalizeStrengthDegrees } = await loadDegrees();
    const catalog = normalizeStrengthDegrees({
      degrees: [
        { id: 'dup', label: 'أولى', shortLabel: 'أ', rank: 1, color: '#000' },
        { id: 'dup', label: 'مكررة', shortLabel: 'م', rank: 2, color: '#000' },
      ],
    });

    expect(catalog.degrees).toHaveLength(1);
    expect(catalog.degrees[0].label).toBe('أولى');
  });

  it('يجعل «المقدَّم» واحدا لا يتعدد', async () => {
    const { normalizeStrengthDegrees } = await loadDegrees();
    const catalog = normalizeStrengthDegrees({
      degrees: [
        { id: 'a', label: 'أ', shortLabel: 'أ', rank: 1, color: '#000', isPreferred: true },
        { id: 'b', label: 'ب', shortLabel: 'ب', rank: 2, color: '#000', isPreferred: true },
      ],
    });

    expect(catalog.degrees.filter((degree) => degree.isPreferred)).toHaveLength(1);
  });

  it('يعلّم الرتبة الأولى مقدَّمةً إن لم يُعلَّم شيء', async () => {
    const { normalizeStrengthDegrees } = await loadDegrees();
    const catalog = normalizeStrengthDegrees({
      degrees: [
        { id: 'a', label: 'أ', shortLabel: 'أ', rank: 1, color: '#000' },
        { id: 'b', label: 'ب', shortLabel: 'ب', rank: 2, color: '#000' },
      ],
    });

    expect(catalog.degrees[0].isPreferred).toBe(true);
  });
});

describe('التخزين', () => {
  it('يحفظ سلّما موسّعا ويقرأه كما هو، فيمكن جعل الدرجات خمسا فأكثر', async () => {
    const { createDefaultStrengthDegrees, readStrengthDegrees, saveStrengthDegrees } = await loadDegrees();
    const base = createDefaultStrengthDegrees();

    saveStrengthDegrees({
      degrees: [
        ...base.degrees,
        { id: 'shadh', label: 'شاذ لا يُقرأ به', shortLabel: 'شاذ', rank: 5, color: '#991b1b' },
      ],
    });

    const stored = readStrengthDegrees();
    expect(stored.degrees).toHaveLength(5);
    expect(stored.degrees[4].id).toBe('shadh');
    expect(stored.degrees[4].rank).toBe(5);
  });

  it('يستعيد الافتراضي بعد إعادة الضبط', async () => {
    const { resetStrengthDegrees, readStrengthDegrees, saveStrengthDegrees } = await loadDegrees();
    saveStrengthDegrees({ degrees: [{ id: 'only', label: 'وحيدة', shortLabel: 'و', rank: 1, color: '#000' }] });
    expect(readStrengthDegrees().degrees).toHaveLength(1);

    resetStrengthDegrees();
    expect(readStrengthDegrees().degrees).toHaveLength(4);
  });
});

describe('حساب القوة لكل راوٍ', () => {
  it('يأخذ رتبة الوجه بأقوى رتبة بين رواته، ويعلّم الاختلاف', async () => {
    const { createDefaultStrengthDegrees, resolveStrength } = await loadDegrees();
    const catalog = createDefaultStrengthDegrees();

    const resolved = resolveStrength(
      { strengthDegreeId: 'jaiz', strengthByNarrator: { 'narrator-warsh': 'muqaddam' } },
      { kind: 'NARRATORS', narratorIds: ['narrator-qalun', 'narrator-warsh'] },
      catalog
    );

    // ورش عنده مقدَّم (رتبة 1) وقالون على العام «جائز» (رتبة 3).
    expect(resolved.rank).toBe(1);
    expect(resolved.isMixed).toBe(true);
    const byNarrator = Object.fromEntries(
      resolved.perNarrator.map((item) => [item.narratorId, item.degree?.id])
    );
    expect(byNarrator['narrator-qalun']).toBe('jaiz');
    expect(byNarrator['narrator-warsh']).toBe('muqaddam');
  });

  it('لا يعدّه مختلفا إذا اتفق الرواة على درجة واحدة', async () => {
    const { createDefaultStrengthDegrees, resolveStrength } = await loadDegrees();
    const catalog = createDefaultStrengthDegrees();

    const resolved = resolveStrength(
      { strengthDegreeId: 'rajih' },
      { kind: 'NARRATORS', narratorIds: ['narrator-qalun', 'narrator-warsh'] },
      catalog
    );

    expect(resolved.isMixed).toBe(false);
    expect(resolved.degree?.id).toBe('rajih');
    expect(resolved.rank).toBe(2);
  });

  it('يؤخّر الوجه الذي لا درجة له عن كل مدرَّج', async () => {
    const { UNGRADED_RANK, createDefaultStrengthDegrees, resolveStrength } = await loadDegrees();
    const catalog = createDefaultStrengthDegrees();

    const ungraded = resolveStrength({}, { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] }, catalog);
    expect(ungraded.rank).toBe(UNGRADED_RANK);
    expect(ungraded.rank).toBeGreaterThan(resolveStrength({ strengthDegreeId: 'muakhkhar' }, { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] }, catalog).rank);
  });

  it('يقبل قوة الوجه الرقمية القديمة رتبةً احتياطية', async () => {
    const { createDefaultStrengthDegrees, resolveStrength } = await loadDegrees();
    const catalog = createDefaultStrengthDegrees();

    expect(resolveStrength({ strength: 2 }, { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] }, catalog).rank).toBe(2);
  });
});

describe('تنظيف تخصيصات الرواة', () => {
  it('يُسقط من خرج من نطاق الوجه ويعيد undefined إن لم يبق شيء', async () => {
    const { pruneStrengthMap } = await loadDegrees();

    expect(
      pruneStrengthMap({ 'narrator-warsh': 'muqaddam', 'narrator-qalun': 'jaiz' }, ['narrator-warsh'])
    ).toEqual({ 'narrator-warsh': 'muqaddam' });
    expect(pruneStrengthMap({ 'narrator-warsh': 'muqaddam' }, ['narrator-qalun'])).toBeUndefined();
    expect(pruneStrengthMap(undefined, ['narrator-warsh'])).toBeUndefined();
  });
});

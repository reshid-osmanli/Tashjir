// اختبارات نطاق تطبيق القاعدة العامة (FR-ED-08.6): سورة / مدى آيات / المصحف
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('ruleAppliesToAyah', () => {
  it('المصحف كله أو غياب النطاق يقبل أي آية', async () => {
    const { ruleAppliesToAyah } = await import('@/lib/storage/global-rules-store');
    expect(ruleAppliesToAyah(undefined, 2004)).toBe(true);
    expect(ruleAppliesToAyah({ kind: 'MUSHAF' }, 114006)).toBe(true);
  });

  it('السورة تحصر التطبيق فيها، والمدى يقبل حدّيه', async () => {
    const { ruleAppliesToAyah } = await import('@/lib/storage/global-rules-store');
    expect(ruleAppliesToAyah({ kind: 'SURAH', surahNumber: 2 }, 2004)).toBe(true);
    expect(ruleAppliesToAyah({ kind: 'SURAH', surahNumber: 2 }, 3004)).toBe(false);
    const range = { kind: 'AYAH_RANGE' as const, fromAyahKey: 2010, toAyahKey: 2020 };
    expect(ruleAppliesToAyah(range, 2010)).toBe(true);
    expect(ruleAppliesToAyah(range, 2020)).toBe(true);
    expect(ruleAppliesToAyah(range, 2021)).toBe(false);
    expect(ruleAppliesToAyah(range, 2009)).toBe(false);
  });
});

describe('المطابق يحترم نطاق التطبيق', () => {
  it('القاعدة نفسها تطابق في المصحف وتُقيَّد بالسورة', async () => {
    const { buildCharacterPattern, findGlobalRuleMatches, findGlobalRuleMatchesInAyah } = await import(
      '@/lib/quran-logic/global-rule-engine'
    );
    const { getAyahWordsByKey } = await import('@/data/quran');
    const ayahKey = 1002; // الحمد لله رب العالمين
    const words = getAyahWordsByKey(ayahKey);
    expect(words.length).toBeGreaterThan(0);
    // مدى حرفي داخل الكلمة الأولى (يُبنى النمط من رسمها).
    const pattern = buildCharacterPattern(ayahKey, {
      start: { position: 1, characterIndex: 1 },
      end: { position: 1, characterIndex: 3 },
    });
    const base = { id: 'rule-x', pattern };
    const everywhere = findGlobalRuleMatches(base, { limit: 5000 });
    expect(everywhere.length).toBeGreaterThan(0);

    const inSurah = findGlobalRuleMatches({ ...base, applyRange: { kind: 'SURAH', surahNumber: 1 } }, { limit: 5000 });
    expect(inSurah.length).toBeGreaterThan(0);
    expect(inSurah.length).toBeLessThanOrEqual(everywhere.length);
    expect(inSurah.every((match) => Math.floor((match.ayahKey ?? 0) / 1000) === 1)).toBe(true);

    expect(findGlobalRuleMatchesInAyah({ ...base, applyRange: { kind: 'SURAH', surahNumber: 2 } }, ayahKey)).toEqual([]);
  });

  it('saveGlobalRule يطبّع النطاق ويحذف MUSHAF الصريح', async () => {
    const { saveGlobalRule, listGlobalRules } = await import('@/lib/storage/global-rules-store');
    saveGlobalRule({
      id: 'r-range',
      title: 'اختبار',
      category: 'FARSH',
      scope: { kind: 'ALL' },
      status: 'DRAFT',
      isActive: true,
      applyRange: { kind: 'AYAH_RANGE', fromAyahKey: 2020, toAyahKey: 2010 },
    });
    saveGlobalRule({
      id: 'r-mushaf',
      title: 'اختبار',
      category: 'FARSH',
      scope: { kind: 'ALL' },
      status: 'DRAFT',
      isActive: true,
      applyRange: { kind: 'MUSHAF' },
    });
    const rules = listGlobalRules();
    expect(rules.find((rule) => rule.id === 'r-range')?.applyRange).toEqual({ kind: 'AYAH_RANGE', fromAyahKey: 2010, toAyahKey: 2020 });
    expect(rules.find((rule) => rule.id === 'r-mushaf')?.applyRange).toBeUndefined();
  });
});

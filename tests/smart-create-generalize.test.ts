// اختبارات تعميم المعالج — Smart Create Generalization (FR-ED-08 الخطوة 6)
// مشروع التشجير - نظام القراءات العشر
//
// التعميم متعدد الأنواع في عملية واحدة: كل نوع قاعدة عامة مستقلة برتبته،
// والنمط حتمي (من الحروف أو الكلمات كاملة)، والحفظ الدفعي ذري (كله أو لا
// شيء)، ومعاينة Dry-run تعدّ المواضع سورةً سورة بلا حجب للواجهة (NFR-02).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAyahWordsByKey, makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';
import {
  buildCharacterPattern,
  buildCharacterPatternForWords,
  countGlobalRuleMatchesInSurah,
  findGlobalRuleMatches,
  findGlobalRuleMatchesInAyah,
  mushafSurahIndex,
} from '@/lib/quran-logic/global-rule-engine';
import {
  createGlobalRuleId,
  deleteGlobalRulesBatch,
  isValidPattern,
  listGlobalRules,
  saveGlobalRulesBatch,
} from '@/lib/storage/global-rules-store';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const AYAH_KEY = makeAyahKey(1, 4);

describe('نمط التعميم من الكلمات كاملة', () => {
  it('يبني نمطًا حتميًا صالحًا يطابق موضعه المصدر', () => {
    const words = getAyahWordsByKey(AYAH_KEY);
    expect(words.length).toBeGreaterThanOrEqual(2);

    const pattern = buildCharacterPatternForWords(AYAH_KEY, 1, 1);
    expect(isValidPattern(pattern)).toBe(true);
    expect(pattern.kind).toBe('CHARACTERS');
    expect(pattern.wordCount).toBe(1);
    // الكلمة كلها قيود بطولها: لا تخمين ولا مطابقة جزئية.
    expect(pattern.words[0]!.exactLength).toBe(pattern.words[0]!.constraints.length);

    const matches = findGlobalRuleMatchesInAyah({ id: 'dry', pattern }, AYAH_KEY);
    expect(matches.some((match) => match.startPosition === 1 && match.endPosition === 1)).toBe(true);
  });

  it('يرفض المدى خارج كلمات الآية', () => {
    expect(() => buildCharacterPatternForWords(AYAH_KEY, 1, 999)).toThrow();
  });
});

describe('العدّ سورةً سورة للمعاينة غير الحاجبة (NFR-02)', () => {
  it('مجموع السور يساوي الفحص الكامل', () => {
    const pattern = buildCharacterPattern(AYAH_KEY, {
      start: { position: 1, characterIndex: 1 },
      end: { position: 1, characterIndex: 1 },
    });
    const rule = { id: 'dry', pattern };
    const full = findGlobalRuleMatches(rule, { limit: 100000 });
    let batched = 0;
    for (const surah of mushafSurahIndex()) {
      batched += countGlobalRuleMatchesInSurah(rule, surah.surahNumber);
    }
    expect(mushafSurahIndex()).toHaveLength(114);
    expect(batched).toBe(full.length);
  });

  it('نطاق السورة يقيّد العدّ', () => {
    const pattern = buildCharacterPattern(AYAH_KEY, {
      start: { position: 1, characterIndex: 1 },
      end: { position: 1, characterIndex: 1 },
    });
    const rule = { id: 'dry', pattern, applyRange: { kind: 'SURAH', surahNumber: 1 } as const };
    expect(countGlobalRuleMatchesInSurah(rule, 1)).toBeGreaterThanOrEqual(1);
    expect(countGlobalRuleMatchesInSurah(rule, 2)).toBe(0);
  });
});

describe('الحفظ الدفعي الذري للقواعد (كله أو لا شيء)', () => {
  it('يحفظ ثلاثة أنواع مستقلة برتبها في عملية واحدة', () => {
    const pattern = buildCharacterPatternForWords(AYAH_KEY, 1, 1);
    const saved = saveGlobalRulesBatch(
      (['USUL', 'FARSH', 'MADUD'] as const).map((category, index) => ({
        id: createGlobalRuleId(),
        title: `قاعدة ${category}`,
        category,
        scope: { kind: 'ALL' as const },
        pattern,
        status: 'DRAFT' as const,
        isActive: true,
        orderRank: index + 1,
      }))
    );
    expect(saved).toHaveLength(3);
    expect(saved.map((rule) => rule.orderRank)).toEqual([1, 2, 3]);
    expect(new Set(saved.map((rule) => rule.id)).size).toBe(3);
    expect(listGlobalRules()).toHaveLength(3);
  });

  it('عنصر فاسد واحد يرفض الدفعة كلها ولا يُحفظ شيء (محاكاة فشل جزئي)', () => {
    const pattern = buildCharacterPatternForWords(AYAH_KEY, 1, 1);
    expect(() =>
      saveGlobalRulesBatch([
        {
          id: createGlobalRuleId(),
          title: 'سليمة',
          category: 'USUL',
          scope: { kind: 'ALL' },
          pattern,
          status: 'DRAFT',
          isActive: true,
        },
        {
          id: createGlobalRuleId(),
          title: '   ',
          category: 'FARSH',
          scope: { kind: 'ALL' },
          pattern,
          status: 'DRAFT',
          isActive: true,
        },
      ])
    ).toThrow();
    expect(listGlobalRules()).toHaveLength(0);
  });

  it('النمط الفاسد يرفض الدفعة كلها', () => {
    expect(() =>
      saveGlobalRulesBatch([
        {
          id: createGlobalRuleId(),
          title: 'بلا نمط',
          category: 'USUL',
          scope: { kind: 'ALL' },
          pattern: { kind: 'CHARACTERS', version: 1, words: [] } as never,
          status: 'DRAFT',
          isActive: true,
        },
      ])
    ).toThrow();
    expect(listGlobalRules()).toHaveLength(0);
  });

  it('الحذف الدفعي يزيل الدفعة كاملة', () => {
    const pattern = buildCharacterPatternForWords(AYAH_KEY, 1, 1);
    const saved = saveGlobalRulesBatch(
      (['USUL', 'FARSH'] as const).map((category) => ({
        id: createGlobalRuleId(),
        title: `قاعدة ${category}`,
        category,
        scope: { kind: 'ALL' as const },
        pattern,
        status: 'DRAFT' as const,
        isActive: true,
      }))
    );
    expect(listGlobalRules()).toHaveLength(2);
    deleteGlobalRulesBatch(saved.map((rule) => rule.id));
    expect(listGlobalRules()).toHaveLength(0);
  });
});

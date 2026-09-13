// اختبارات مستكشف أخطاء المحرك — Engine Error Explorer (FR-ES-12.2)
//
// التجميع حتمي (فئة × تصنيف × سياق × مصدر): نفس المدخلات تعطي نفس
// المجموعات، والأكبر عددا يأتي أولا، وCorrect لا يدخل التجميع أبدا.

import { describe, expect, it } from 'vitest';
import type { ValidationPosition } from '@/lib/tashjeer/reference-validation';
import { groupEngineErrors } from '@/lib/tashjeer/engine-errors';

function makePosition(
  id: string,
  overrides: Partial<Pick<ValidationPosition, 'verdict' | 'context' | 'source' | 'category'>> = {}
): ValidationPosition {
  return {
    id,
    ayahKey: 1004,
    surahNumber: 1,
    ayahNumber: 4,
    verdict: 'WRONG',
    category: 'MADUD',
    title: `موضع ${id}`,
    reason: 'سبب اختبار',
    source: 'ENGINE',
    ...overrides,
  };
}

describe('تجميع أخطاء المحرك المتكررة (FR-ES-12.2)', () => {
  it('يجمع المواضع المتطابقة في نمط واحد بعدادها', () => {
    const patterns = groupEngineErrors([
      makePosition('a'),
      makePosition('b'),
      makePosition('c'),
    ]);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].count).toBe(3);
    expect(patterns[0].positions).toHaveLength(3);
  });

  it('يفرق بين سياقات مختلفة (وقف فقط ≠ وصل فقط) — مفتاح حتمي', () => {
    const patterns = groupEngineErrors([
      makePosition('a', { context: 'WAQF_ONLY' }),
      makePosition('b', { context: 'WASL_ONLY' }),
      makePosition('c'), // ALWAYS
    ]);
    expect(patterns).toHaveLength(3);
    expect(patterns.map((p) => p.context).sort()).toEqual(['ALWAYS', 'WAQF_ONLY', 'WASL_ONLY']);
  });

  it('يفرق بين الفئات والمصادر والتصنيفات', () => {
    const patterns = groupEngineErrors([
      makePosition('a', { category: 'MADUD', verdict: 'WRONG' }),
      makePosition('b', { category: 'FARSH', verdict: 'WRONG' }),
      makePosition('c', { category: 'MADUD', verdict: 'MISSING' }),
      makePosition('d', { category: 'MADUD', source: 'EDITOR' }),
    ]);
    expect(patterns).toHaveLength(4);
  });

  it('يستبعد Correct من التجميع (ليس خطأ)', () => {
    const patterns = groupEngineErrors([
      makePosition('a', { verdict: 'CORRECT' }),
      makePosition('b', { verdict: 'WRONG' }),
    ]);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].verdict).toBe('WRONG');
    expect(patterns[0].count).toBe(1);
  });

  it('يرتب الأنماط تنازليا بالعدد (النمط A — ٥٢ ثم النمط B — ٣١)', () => {
    const patterns = groupEngineErrors([
      makePosition('a', { category: 'MADUD', verdict: 'WRONG' }),
      makePosition('b', { category: 'MADUD', verdict: 'WRONG' }),
      makePosition('c', { category: 'MADUD', verdict: 'WRONG' }),
      makePosition('d', { category: 'FARSH', verdict: 'WRONG' }),
      makePosition('e', { category: 'FARSH', verdict: 'WRONG' }),
    ]);
    expect(patterns[0].count).toBe(3);
    expect(patterns[1].count).toBe(2);
    expect(patterns[0].category).toBe('MADUD');
  });

  it('المفتاح حتمي: كل نمط مفتاح فريد ومحدد الأبعاد', () => {
    const patterns = groupEngineErrors([
      makePosition('a'),
      makePosition('b', { context: 'WAQF_ONLY' }),
    ]);
    const keys = patterns.map((p) => p.key);
    expect(new Set(keys).size).toBe(2);
    expect(keys[0]).toContain('MADUD');
    expect(keys[0]).toContain('WRONG');
  });
});

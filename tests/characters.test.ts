import { describe, expect, it } from 'vitest';
import {
  characterBoundsForWord,
  characterHitBoxes,
  rangeFromCharacterAnchors,
  splitQuranCharacters,
  textForCharacterRange,
} from '@/lib/quran-logic/characters';

describe('Quran character selection', () => {
  it('keeps harakat attached to the preceding visible letter', () => {
    const characters = splitQuranCharacters('مَالِكِ');

    expect(characters).toHaveLength(4);
    expect(characters.map((character) => character.text)).toEqual(['مَ', 'ا', 'لِ', 'كِ']);
  });

  it('turns separate clicks into one deterministic inclusive range', () => {
    const range = rangeFromCharacterAnchors([
      { position: 2, characterIndex: 2 },
      { position: 1, characterIndex: 3 },
      { position: 1, characterIndex: 1 },
    ]);

    expect(range).toEqual({
      start: { position: 1, characterIndex: 1 },
      end: { position: 2, characterIndex: 2 },
    });
  });

  it('extracts exactly the requested visible letters across words', () => {
    const range = {
      start: { position: 1, characterIndex: 2 },
      end: { position: 2, characterIndex: 1 },
    };
    const words = [
      { position: 1, text: 'مَالِكِ' },
      { position: 2, text: 'يَوْمِ' },
    ];

    expect(textForCharacterRange(words, range)).toBe('الِكِ يَ');
    expect(characterBoundsForWord(range, 1, words[0].text)).toEqual({ start: 2, end: 4 });
    expect(characterBoundsForWord(range, 2, words[1].text)).toEqual({ start: 1, end: 1 });
  });

  it('builds one clickable cell per visible letter, RTL from the right edge', () => {
    const box = { x: 100, width: 80, text: 'مَالِكِ' };
    const cells = characterHitBoxes(box);

    expect(cells).toHaveLength(4);
    expect(cells.map((cell) => cell.index)).toEqual([1, 2, 3, 4]);
    expect(cells[0].x + cells[0].width).toBeCloseTo(180, 5);
    expect(cells[cells.length - 1].x).toBeCloseTo(100, 5);
    // الألف أضيق من الميم، فلا تتساوى الخلايا.
    expect(cells[1].width).toBeLessThan(cells[0].width);
  });

  it('keeps every letter independently addressable for exclusive clicks', () => {
    const cells = characterHitBoxes({ x: 0, width: 60, text: 'ٱلۡحَمۡدُ' });
    const indexes = new Set(cells.map((cell) => cell.index));

    expect(indexes.size).toBe(cells.length);
    expect(cells.every((cell) => cell.width > 0)).toBe(true);
  });
});

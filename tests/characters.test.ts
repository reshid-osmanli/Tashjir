import { describe, expect, it } from 'vitest';
import {
  characterBoundsForWord,
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
});

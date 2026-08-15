import { describe, expect, it } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import {
  buildCharacterPattern,
  matchCharacterPatternInWords,
  matchMorphologyPatternInWord,
  matchPatternInAyah,
} from '@/lib/quran-logic/global-rule-engine';
import type { RuleEngineWord } from '@/lib/quran-logic/global-rule-engine';
import type {
  GlobalCharacterPattern,
  GlobalMorphologyWordPattern,
} from '@/types/tashjeer';

describe('محرك القواعد العامة الحرفية', () => {
  it('يثبت النون الساكنة في نهاية الكلمة ويتجاهل حركة حرف الإخفاء عند الطلب', () => {
    const words: RuleEngineWord[] = [
      { position: 1, text: 'مِنْ' },
      { position: 2, text: 'تَابَ' },
      { position: 3, text: 'قَالَ' },
    ];
    const pattern: GlobalCharacterPattern = {
      kind: 'CHARACTERS',
      version: 1,
      wordCount: 2,
      words: [
        {
          offset: 0,
          constraints: [
            { baseLetter: 'ن', marks: 'ْ', harakaMode: 'EXACT', anchor: 'END', value: 0 },
          ],
        },
        {
          offset: 1,
          constraints: [
            { baseLetter: 'ت', marks: 'َ', harakaMode: 'IGNORE', anchor: 'START', value: 0 },
          ],
        },
      ],
    };

    const match = matchCharacterPatternInWords(words, pattern, 0, 10);
    expect(match?.startPosition).toBe(1);
    expect(match?.endPosition).toBe(2);
    expect(match?.matchedText).toBe('نْ تَ');

    expect(matchCharacterPatternInWords([{ position: 1, text: 'مِنَ' }, words[1]], pattern, 0, 10)).toBeNull();
    expect(matchCharacterPatternInWords([words[0], { position: 2, text: 'تُبْ' }], pattern, 0, 10)).not.toBeNull();
  });

  it('يستطيع توسيع القيد إلى مجموعة حروف الإخفاء دون توسيع النون نفسها', () => {
    const pattern: GlobalCharacterPattern = {
      kind: 'CHARACTERS',
      version: 1,
      wordCount: 2,
      words: [
        { offset: 0, constraints: [{ baseLetter: 'ن', letterSet: 'EXACT', marks: 'ْ', harakaMode: 'EXACT', anchor: 'END', value: 0 }] },
        { offset: 1, constraints: [{ baseLetter: 'ت', letterSet: 'IKHFAA', marks: '', harakaMode: 'IGNORE', anchor: 'START', value: 0 }] },
      ],
    };

    expect(matchCharacterPatternInWords([{ position: 1, text: 'مِنْ' }, { position: 2, text: 'صَبَرَ' }], pattern, 0)).not.toBeNull();
    expect(matchCharacterPatternInWords([{ position: 1, text: 'مِنْ' }, { position: 2, text: 'أَكَلَ' }], pattern, 0)).toBeNull();
  });

  it('لا يطابق كلمتين غير متجاورتين ولو وافقتا الحروف', () => {
    const pattern: GlobalCharacterPattern = {
      kind: 'CHARACTERS',
      version: 1,
      wordCount: 2,
      words: [
        { offset: 0, constraints: [{ baseLetter: 'ن', marks: '', harakaMode: 'IGNORE', anchor: 'END', value: 0 }] },
        { offset: 1, constraints: [{ baseLetter: 'ت', marks: '', harakaMode: 'IGNORE', anchor: 'START', value: 0 }] },
      ],
    };

    expect(
      matchCharacterPatternInWords(
        [
          { position: 1, text: 'مِنْ', ayahKey: 1 },
          { position: 3, text: 'تَابَ', ayahKey: 1 },
        ],
        pattern,
        0,
        1
      )
    ).toBeNull();
  });

  it('يبني علاقة الحرف بالطرف بدلا من تثبيت طول الكلمة', () => {
    const pattern = buildCharacterPattern(makeAyahKey(1, 4), {
      start: { position: 1, characterIndex: 3 },
      end: { position: 1, characterIndex: 3 },
    });

    expect(pattern.words[0].constraints[0]).toMatchObject({
      baseLetter: 'ك',
      anchor: 'END',
      value: 0,
      harakaMode: 'EXACT',
    });
    expect(pattern.words[0].exactLength).toBeUndefined();
  });

  it('يطابق القالب الصرفي فَعْلَى بخانات الجذر، دون ذكاء اصطناعي', () => {
    const pattern: GlobalMorphologyWordPattern = {
      offset: 0,
      template: 'فَعْلَى',
      harakaMode: 'IGNORE',
    };

    expect(matchMorphologyPatternInWord({ position: 1, text: 'كُبْرَى' }, pattern)).toBe(true);
    expect(matchMorphologyPatternInWord({ position: 1, text: 'صُغْرَى' }, pattern)).toBe(true);
    expect(matchMorphologyPatternInWord({ position: 1, text: 'كَبِيرَة' }, pattern)).toBe(false);
  });

  it('يتيح قاعدة لاحقة حتمية مثل التاء المربوطة', () => {
    const pattern: GlobalMorphologyWordPattern = {
      offset: 0,
      suffix: 'ة',
      harakaMode: 'IGNORE',
    };

    expect(matchMorphologyPatternInWord({ position: 1, text: 'رَحْمَةٌ' }, pattern)).toBe(true);
    expect(matchMorphologyPatternInWord({ position: 1, text: 'رَحْمَنٌ' }, pattern)).toBe(false);
  });

  it('يعيد كل المواضع في الآية للنمط الصرفي', () => {
    const matches = matchPatternInAyah(
      [
        { position: 1, text: 'كُبْرَى' },
        { position: 2, text: 'وَ' },
        { position: 3, text: 'صُغْرَى' },
      ],
      {
        kind: 'MORPHOLOGY',
        version: 1,
        wordCount: 1,
        words: [{ offset: 0, template: 'فَعْلَى', harakaMode: 'IGNORE' }],
      }
    );

    expect(matches.map((match) => match.startPosition)).toEqual([1, 3]);
  });
});

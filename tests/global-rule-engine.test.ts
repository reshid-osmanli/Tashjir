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

// ==================== الإضافات: النطاق داخل الكلمة، السلاسل الصرفية، السكون ====================

import {
  matchCharacterPatternInsideWord,
  findGlobalRuleMatchesInAyah,
} from '@/lib/quran-logic/global-rule-engine';
import type { GlobalCharacterConstraint } from '@/types/tashjeer';

const noonSakinConstraint: GlobalCharacterConstraint = {
  baseLetter: 'ن',
  marks: '',
  harakaMode: 'SAKIN',
  anchor: 'END',
  value: 0,
};

describe('وضع «ساكن» في مطابقة الحركة', () => {
  it('يطابق السكون الحديث والعثماني والحرف المعرّى، ويرد المتحرك', () => {
    const pattern: GlobalCharacterPattern = {
      kind: 'CHARACTERS',
      version: 1,
      wordCount: 2,
      words: [
        { offset: 0, constraints: [noonSakinConstraint] },
        {
          offset: 1,
          constraints: [
            { baseLetter: 'ت', letterSet: 'IKHFAA', marks: '', harakaMode: 'IGNORE', anchor: 'START', value: 0 },
          ],
        },
      ],
    };

    // سكون حديث U+0652
    expect(matchCharacterPatternInWords([{ position: 1, text: 'مِنْ' }, { position: 2, text: 'ثَمَرَةٍ' }], pattern, 0)).not.toBeNull();
    // سكون عثماني U+06E1 (رأس خاء صغيرة)
    expect(matchCharacterPatternInWords([{ position: 1, text: 'مِن\u06E1' }, { position: 2, text: 'ثَمَرَةٍ' }], pattern, 0)).not.toBeNull();
    // نون معرّاة (رسم الإدغام والإخفاء العثماني)
    expect(matchCharacterPatternInWords([{ position: 1, text: 'مِن' }, { position: 2, text: 'ثَمَرَةٍ' }], pattern, 0)).not.toBeNull();
    // نون متحركة: لا سكون فلا مطابقة
    expect(matchCharacterPatternInWords([{ position: 1, text: 'مِنَ' }, { position: 2, text: 'ثَمَرَةٍ' }], pattern, 0)).toBeNull();
  });
});

describe('المطابقة داخل الكلمة الواحدة (INSIDE_WORD)', () => {
  const insidePattern: GlobalCharacterPattern = {
    kind: 'CHARACTERS',
    version: 1,
    wordCount: 2,
    matchScope: 'INSIDE_WORD',
    words: [
      { offset: 0, constraints: [noonSakinConstraint] },
      {
        offset: 1,
        constraints: [
          { baseLetter: 'ت', letterSet: 'IKHFAA', marks: '', harakaMode: 'IGNORE', anchor: 'START', value: 0 },
        ],
      },
    ],
  };

  it('يجد النون الساكنة مع حرف الإخفاء في جوف الكلمة: أَنتُمْ ويُنفِقُونَ', () => {
    const matchesAntum = matchCharacterPatternInsideWord({ position: 1, text: 'أَنتُمۡ' }, insidePattern);
    expect(matchesAntum).toHaveLength(1);
    expect(matchesAntum[0].characterRange).toEqual({
      start: { position: 1, characterIndex: 2 },
      end: { position: 1, characterIndex: 3 },
    });

    const matchesYunfiqun = matchCharacterPatternInsideWord({ position: 1, text: 'يُنفِقُونَ' }, insidePattern);
    expect(matchesYunfiqun).toHaveLength(1);
  });

  it('لا يدّعي مطابقة عند غياب التجاور أو غياب السكون', () => {
    // نون متحركة داخل الكلمة
    expect(matchCharacterPatternInsideWord({ position: 1, text: 'نَتَقَبَّلُ' }, insidePattern)).toHaveLength(0);
    // لا نون أصلا
    expect(matchCharacterPatternInsideWord({ position: 1, text: 'قَالُوا' }, insidePattern)).toHaveLength(0);
  });

  it('BOTH يجمع بين الكلمات وداخلها في الآية الواحدة', () => {
    const bothPattern: GlobalCharacterPattern = { ...insidePattern, matchScope: 'BOTH' };
    const matches = matchPatternInAyah(
      [
        { position: 1, text: 'مِنْ' },
        { position: 2, text: 'ثَمَرَةٍ' },
        { position: 3, text: 'أَنتُمۡ' },
      ],
      bothPattern
    );
    // موضعان: بين الكلمتين 1-2، وداخل الكلمة 3.
    expect(matches).toHaveLength(2);
    expect(matches[0].startPosition).toBe(1);
    expect(matches[1].startPosition).toBe(3);
  });

  it('WORDS وحده لا يرى ما في جوف الكلمة، وINSIDE_WORD وحده لا يرى ما بين الكلمات', () => {
    const words = [
      { position: 1, text: 'مِنْ' },
      { position: 2, text: 'ثَمَرَةٍ' },
      { position: 3, text: 'أَنتُمۡ' },
    ];
    const wordsOnly = matchPatternInAyah(words, { ...insidePattern, matchScope: 'WORDS' });
    expect(wordsOnly).toHaveLength(1);
    expect(wordsOnly[0].startPosition).toBe(1);

    const insideOnly = matchPatternInAyah(words, insidePattern);
    expect(insideOnly).toHaveLength(1);
    expect(insideOnly[0].startPosition).toBe(3);
  });
});

describe('السلسلة الصرفية متعددة الكلمات', () => {
  it('نون ساكنة في آخر كلمة + حرف إخفاء في أول التالية، بالمعايير لا بالحروف', () => {
    const matches = matchPatternInAyah(
      [
        { position: 1, text: 'مِن' },
        { position: 2, text: 'ثَمَرَةٖ' },
        { position: 3, text: 'قَالَ' },
        { position: 4, text: 'مَن' },
        { position: 5, text: 'أَحۡسَنَ' },
      ],
      {
        kind: 'MORPHOLOGY',
        version: 1,
        wordCount: 2,
        words: [
          { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['NOON_SAKINA_END'] },
          { offset: 1, harakaMode: 'IGNORE', startsWithSet: 'IKHFAA' },
        ],
      }
    );

    // «مِن ثَمَرَةٖ» تطابق؛ أما «مَن أَحۡسَنَ» فأولها همزة وهي من حروف الإظهار.
    expect(matches).toHaveLength(1);
    expect(matches[0].startPosition).toBe(1);
    expect(matches[0].endPosition).toBe(2);
    // التعليم: آخر حرف من الأولى إلى أول حرف من الثانية.
    expect(matches[0].characterRange.start.characterIndex).toBe(2);
    expect(matches[0].characterRange.end.characterIndex).toBe(1);
  });

  it('همزة الوصل تُتخطى عند فحص أول الكلمة، فالمنطوق بعدها هو المعتبر', () => {
    // «ٱصۡبِرۡ»: أولها همزة وصل، والمنطوق بعدها صاد وهي من حروف الإخفاء.
    const matched = matchMorphologyPatternInWord(
      { position: 2, text: 'ٱصۡبِرۡ' },
      { offset: 0, harakaMode: 'IGNORE', startsWithSet: 'IKHFAA' }
    );
    expect(matched).toBe(true);

    // «ٱلَّذِينَ»: بعد همزة الوصل لام، واللام ليست من حروف الإخفاء.
    const notMatched = matchMorphologyPatternInWord(
      { position: 2, text: 'ٱلَّذِينَ' },
      { offset: 0, harakaMode: 'IGNORE', startsWithSet: 'IKHFAA' }
    );
    expect(notMatched).toBe(false);
  });

  it('يرفض النافذة غير المتجاورة في المواقع', () => {
    const matches = matchPatternInAyah(
      [
        { position: 1, text: 'مِن' },
        { position: 3, text: 'ثَمَرَةٖ' },
      ],
      {
        kind: 'MORPHOLOGY',
        version: 1,
        wordCount: 2,
        words: [
          { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['NOON_SAKINA_END'] },
          { offset: 1, harakaMode: 'IGNORE', startsWithSet: 'IKHFAA' },
        ],
      }
    );
    expect(matches).toHaveLength(0);
  });

  it('يعمل على آية حقيقية من المصحف: البقرة 3 فيها يُنفِقُونَ', () => {
    const rule = {
      id: 'test-ikhfa-inside',
      pattern: {
        kind: 'CHARACTERS',
        version: 1,
        wordCount: 2,
        matchScope: 'BOTH',
        words: [
          { offset: 0, constraints: [{ baseLetter: 'ن', marks: '', harakaMode: 'SAKIN', anchor: 'END', value: 0 }] },
          { offset: 1, constraints: [{ baseLetter: 'ف', letterSet: 'IKHFAA', marks: '', harakaMode: 'IGNORE', anchor: 'START', value: 0 }] },
        ],
      } as GlobalCharacterPattern,
    };
    const matches = findGlobalRuleMatchesInAyah(rule, makeAyahKey(2, 3));
    // «يُنفِقُونَ» في آخر الآية: نون معرّاة بعدها فاء (إخفاء داخل الكلمة).
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((match) => match.matchedText.includes('ن'))).toBe(true);
  });
});

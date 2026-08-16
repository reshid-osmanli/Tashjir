// اختبارات المعايير النحوية والصرفية - Arabic Grammar Criteria Tests
//
// هذه الطبقة هي أساس «القاعدة حسب القواعد النحوية»: تحديد الكلمات المستهدفة
// بخصائصها لا بأعيانها، مثل «كل كلمة تنتهي بتاء التأنيث» أو «كل ما جاء على
// وزن فُعْلَى». وشرطها الذي لا تفرّط فيه: ألا تحكم إلا بعلامة ظاهرة في الرسم
// أو الضبط، أو بأداة من قائمة مغلقة معدودة. فلا تخمين ولا إعراب محتمِل.

import { describe, expect, it } from 'vitest';
import {
  MORPHOLOGY_FEATURE_HINTS,
  MORPHOLOGY_FEATURE_LABELS,
  PARTICLE_CLASS_LABELS,
  PARTICLES,
  WORD_ENDING_HARAKA_LABELS,
  endingHarakaOf,
  hasMorphologyFeature,
  isParticleOfClass,
  morphologyFeaturesOf,
  particleClassesOf,
  stripDiacritics,
} from '@/lib/quran-logic/arabic-grammar';
import {
  hasGrammarCriteria,
  matchMorphologyPatternInWord,
} from '@/lib/quran-logic/global-rule-engine';
import type { RuleEngineWord } from '@/lib/quran-logic/global-rule-engine';
import type { GlobalMorphologyWordPattern } from '@/types/tashjeer';
import { getAyahWords, makeAyahKey } from '@/data/quran';

function word(text: string, position = 1): RuleEngineWord {
  return { position, text };
}

function pattern(extra: Partial<GlobalMorphologyWordPattern> = {}): GlobalMorphologyWordPattern {
  return { offset: 0, harakaMode: 'IGNORE', ...extra };
}

describe('تجريد الضبط', () => {
  it('يحذف الحركات والتطويل ويوحّد صور الهمزة', () => {
    expect(stripDiacritics('ٱلْحَمْدُ')).toBe('الحمد');
    expect(stripDiacritics('أَنْعَمْتَ')).toBe('انعمت');
    expect(stripDiacritics('إِيَّاكَ')).toBe('اياك');
  });
});

describe('الخصائص الصرفية', () => {
  it('تاء التأنيث المربوطة: تُقرأ آخرا وإن تبعتها علامة ضبط', () => {
    expect(hasMorphologyFeature('رَحْمَةٌ', 'TAA_MARBUTA')).toBe(true);
    expect(hasMorphologyFeature('ٱلْجَنَّةِ', 'TAA_MARBUTA')).toBe(true);
    expect(hasMorphologyFeature('بَقَرَةٌ', 'TAA_MARBUTA')).toBe(true);
    expect(hasMorphologyFeature('ٱلْكِتَابُ', 'TAA_MARBUTA')).toBe(false);
  });

  it('التاء المبسوطة في الآخر: رحمت ونعمت في الرسم العثماني', () => {
    expect(hasMorphologyFeature('رَحْمَتَ', 'TAA_MAFTUHA')).toBe(true);
    expect(hasMorphologyFeature('نِعْمَتَ', 'TAA_MAFTUHA')).toBe(true);
    // «أنت» ثلاثة أحرف فتُقبل، أما ما دونها فتاؤه ليست تاء تأنيث ظاهرة.
    expect(hasMorphologyFeature('لَتْ', 'TAA_MAFTUHA')).toBe(false);
    expect(hasMorphologyFeature('رَحْمَةٌ', 'TAA_MAFTUHA')).toBe(false);
  });

  it('الألف المقصورة: المرسومة ياءً والمرسومة ألفا خنجرية', () => {
    expect(hasMorphologyFeature('ٱلْكُبْرَىٰ', 'ALIF_MAQSURA')).toBe(true);
    expect(hasMorphologyFeature('مُوسَىٰ', 'ALIF_MAQSURA')).toBe(true);
    expect(hasMorphologyFeature('ٱلْكِتَابُ', 'ALIF_MAQSURA')).toBe(false);
  });

  it('الألف الممدودة والياء المشددة', () => {
    expect(hasMorphologyFeature('ٱلسَّمَاءِ', 'ALIF_MAMDUDA')).toBe(true);
    expect(hasMorphologyFeature('ٱلنَّبِيِّ', 'NISBA_YAA')).toBe(true);
    expect(hasMorphologyFeature('ٱلسَّمَاءِ', 'NISBA_YAA')).toBe(false);
  });

  it('جمع المؤنث السالم يشترط طولا يمنع «آت» ونحوها', () => {
    expect(hasMorphologyFeature('ٱلصَّالِحَاتِ', 'SOUND_FEMININE_PLURAL')).toBe(true);
    expect(hasMorphologyFeature('بَاتَ', 'SOUND_FEMININE_PLURAL')).toBe(false);
  });

  it('جمع المذكر السالم والتثنية يشتركان في ـين', () => {
    expect(hasMorphologyFeature('ٱلْمُؤْمِنُونَ', 'SOUND_MASCULINE_PLURAL')).toBe(true);
    expect(hasMorphologyFeature('ٱلصَّابِرِينَ', 'SOUND_MASCULINE_PLURAL')).toBe(true);
    // ـين محتملة للتثنية والجمع، فتُعدّ لهما معا ولا يُرجَّح بلا دليل ظاهر.
    expect(hasMorphologyFeature('ٱلصَّابِرِينَ', 'DUAL_SUFFIX')).toBe(true);
    expect(hasMorphologyFeature('رَجُلَانِ', 'DUAL_SUFFIX')).toBe(true);
  });

  it('التعريف والتنوين والشدة والهمزة والمد', () => {
    expect(hasMorphologyFeature('ٱلْحَمْدُ', 'DEFINITE_AL')).toBe(true);
    expect(hasMorphologyFeature('هُدًى', 'DEFINITE_AL')).toBe(false);
    expect(hasMorphologyFeature('هُدًى', 'TANWEEN')).toBe(true);
    expect(hasMorphologyFeature('ٱلرَّحْمَٰنِ', 'SHADDA')).toBe(true);
    expect(hasMorphologyFeature('أَنْعَمْتَ', 'HAMZA')).toBe(true);
    expect(hasMorphologyFeature('قَالُوا', 'MADD_LETTER')).toBe(true);
  });

  it('يجمع خصائص الكلمة الواحدة للعرض في الواجهة', () => {
    const features = morphologyFeaturesOf('ٱلصَّالِحَاتِ');
    expect(features).toContain('DEFINITE_AL');
    expect(features).toContain('SHADDA');
    expect(features).toContain('SOUND_FEMININE_PLURAL');
  });

  it('لكل خاصية عنوان وتمثيل قرآني في الواجهة', () => {
    for (const key of Object.keys(MORPHOLOGY_FEATURE_LABELS)) {
      expect(MORPHOLOGY_FEATURE_LABELS[key as keyof typeof MORPHOLOGY_FEATURE_LABELS]).toBeTruthy();
      expect(MORPHOLOGY_FEATURE_HINTS[key as keyof typeof MORPHOLOGY_FEATURE_HINTS]).toBeTruthy();
    }
  });
});

describe('حركة آخر الكلمة', () => {
  it('يقرأ الحركة الظاهرة على آخر حرف منطوق', () => {
    expect(endingHarakaOf('ٱلْحَمْدُ')).toBe('DAMMA');
    expect(endingHarakaOf('ٱلْعَالَمِينَ')).toBe('FATHA');
    expect(endingHarakaOf('ٱلرَّحِيمِ')).toBe('KASRA');
  });

  it('يتخطى حرف المد الأخير غير المضبوط إلى ما قبله', () => {
    expect(endingHarakaOf('قَالُوا')).toBe('DAMMA');
  });

  it('يقرأ التنوين تنوينا لا حركة مفردة', () => {
    expect(endingHarakaOf('هُدًى')).toBe('TANWEEN_FATH');
    expect(endingHarakaOf('رَحْمَةٌ')).toBe('TANWEEN_DAMM');
  });

  it('لكل حركة عنوان معروض', () => {
    expect(Object.keys(WORD_ENDING_HARAKA_LABELS)).toHaveLength(7);
  });
});

describe('الأدوات النحوية', () => {
  it('يعرف الأداة المستقلة من فئتها', () => {
    expect(isParticleOfClass('مِن', 'JARR')).toBe(true);
    expect(isParticleOfClass('لَمْ', 'JAZM')).toBe(true);
    expect(isParticleOfClass('يَا', 'NIDA')).toBe(true);
    expect(isParticleOfClass('ٱلَّذِينَ', 'MAWSUL')).toBe(true);
  });

  it('يعرف الأداة الملتصقة برسمها في المصحف', () => {
    // الباء واللام والكاف تُرسم موصولة، فهي في الرسم بادئة لا كلمة مستقلة.
    expect(isParticleOfClass('بِسْمِ', 'JARR')).toBe(true);
    expect(isParticleOfClass('لِلَّهِ', 'JARR')).toBe(true);
    expect(isParticleOfClass('ب', 'JARR')).toBe(true);
  });

  it('لا يعدّ كل ما بدأ بحرف أداةً بلا قرينة رسم', () => {
    expect(isParticleOfClass('ٱلْحَمْدُ', 'JARR')).toBe(false);
    expect(isParticleOfClass('صِرَاطَ', 'NIDA')).toBe(false);
  });

  it('الأداة الواحدة قد تصلح لعدة فئات، فتُذكر كلها', () => {
    const classes = particleClassesOf('مَا');
    expect(classes).toContain('NAFY');
    expect(classes).toContain('SHART');
  });

  it('لكل فئة أدوات معدودة وعنوان معروض', () => {
    for (const key of Object.keys(PARTICLE_CLASS_LABELS)) {
      const particleClass = key as keyof typeof PARTICLE_CLASS_LABELS;
      expect(PARTICLE_CLASS_LABELS[particleClass]).toBeTruthy();
      expect(PARTICLES[particleClass].length).toBeGreaterThan(0);
    }
  });
});

describe('كشف وجود معايير نحوية في النمط', () => {
  it('ينفي عن النمط الحرفي المجرد ويثبت لنمط فيه معيار', () => {
    // القالب واللاحقة مطابقة نصية لا معيار نحوي، فلا تُحسب.
    expect(hasGrammarCriteria(pattern({ suffix: 'ة' }))).toBe(false);
    expect(hasGrammarCriteria(pattern({ template: 'فُعْلَى' }))).toBe(false);

    expect(hasGrammarCriteria(pattern({ morphologyFeatures: ['TAA_MARBUTA'] }))).toBe(true);
    expect(hasGrammarCriteria(pattern({ precededBy: ['JARR'] }))).toBe(true);
    expect(hasGrammarCriteria(pattern({ ayahPosition: 'LAST' }))).toBe(true);
    // «أي موقع» ليس تقييدا، فلا يُعدّ معيارا.
    expect(hasGrammarCriteria(pattern({ ayahPosition: 'ANY' }))).toBe(false);
  });
});

describe('مطابقة الكلمة بالمعايير', () => {
  it('تاء التأنيث: تطابق كل ما ختم بها وتردّ ما سواه', () => {
    const target = pattern({ morphologyFeatures: ['TAA_MARBUTA'] });
    expect(matchMorphologyPatternInWord(word('رَحْمَةٌ'), target)).toBe(true);
    expect(matchMorphologyPatternInWord(word('ٱلْكِتَابُ'), target)).toBe(false);
  });

  it('تشترط تحقق كل الخصائص المطلوبة معا', () => {
    const target = pattern({ morphologyFeatures: ['TAA_MARBUTA', 'DEFINITE_AL'] });
    expect(matchMorphologyPatternInWord(word('ٱلْجَنَّةَ'), target)).toBe(true);
    // فيها التاء ولا تعريف فيها، فسقط أحد الشرطين فسقطت المطابقة.
    expect(matchMorphologyPatternInWord(word('رَحْمَةٌ'), target)).toBe(false);
    // فيها التعريف ولا تاء في آخرها.
    expect(matchMorphologyPatternInWord(word('ٱلْكِتَابَ'), target)).toBe(false);
  });

  it('تستثني بالخصائص الممنوعة', () => {
    const target = pattern({
      morphologyFeatures: ['TAA_MARBUTA'],
      excludedMorphologyFeatures: ['DEFINITE_AL'],
    });
    expect(matchMorphologyPatternInWord(word('رَحْمَةٌ'), target)).toBe(true);
    expect(matchMorphologyPatternInWord(word('ٱلرَّحْمَةَ'), target)).toBe(false);
  });

  it('تقيّد بحركة الآخر، ويكفي تحقق واحدة من المذكورات', () => {
    const target = pattern({ endingHaraka: ['KASRA', 'TANWEEN_KASR'] });
    expect(matchMorphologyPatternInWord(word('ٱلرَّحِيمِ'), target)).toBe(true);
    expect(matchMorphologyPatternInWord(word('ٱلْحَمْدُ'), target)).toBe(false);
  });

  it('تقيّد بالأداة السابقة واللاحقة', () => {
    const precededByJarr = pattern({ precededBy: ['JARR'] });
    expect(
      matchMorphologyPatternInWord(word('ٱلرَّحِيمِ', 2), precededByJarr, {
        previous: word('مِنَ', 1),
      })
    ).toBe(true);
    expect(
      matchMorphologyPatternInWord(word('ٱلرَّحِيمِ', 2), precededByJarr, {
        previous: word('قَالَ', 1),
      })
    ).toBe(false);
    // بلا سياق لا تُدّعى مطابقة: الشرط لم يتحقق، فلا يُفترض تحققه.
    expect(matchMorphologyPatternInWord(word('ٱلرَّحِيمِ'), precededByJarr)).toBe(false);

    const followedByMawsul = pattern({ followedBy: ['MAWSUL'] });
    expect(
      matchMorphologyPatternInWord(word('صِرَاطَ', 1), followedByMawsul, {
        next: word('ٱلَّذِينَ', 2),
      })
    ).toBe(true);
  });

  it('تقيّد بموقع الكلمة من الآية', () => {
    const first = pattern({ ayahPosition: 'FIRST' });
    expect(matchMorphologyPatternInWord(word('ٱلْحَمْدُ'), first, { isFirst: true })).toBe(true);
    expect(matchMorphologyPatternInWord(word('ٱلْحَمْدُ'), first, { isFirst: false })).toBe(false);

    const notLast = pattern({ ayahPosition: 'NOT_LAST' });
    expect(matchMorphologyPatternInWord(word('ٱلْحَمْدُ'), notLast, { isLast: false })).toBe(true);
    expect(matchMorphologyPatternInWord(word('ٱلْحَمْدُ'), notLast, { isLast: true })).toBe(false);
  });

  it('تقيّد بطول الكلمة بالحروف المرئية', () => {
    expect(matchMorphologyPatternInWord(word('ٱلْحَمْدُ'), pattern({ minLength: 8 }))).toBe(false);
    expect(matchMorphologyPatternInWord(word('ٱلْحَمْدُ'), pattern({ minLength: 3 }))).toBe(true);
    expect(matchMorphologyPatternInWord(word('ٱلْحَمْدُ'), pattern({ maxLength: 3 }))).toBe(false);
  });

  it('تجمع القالب الصرفي مع المعايير النحوية في نمط واحد', () => {
    const target = pattern({
      template: 'فُعْلَى',
      morphologyFeatures: ['ALIF_MAQSURA'],
      excludedMorphologyFeatures: ['DEFINITE_AL'],
    });
    expect(matchMorphologyPatternInWord(word('كُبْرَىٰ'), target)).toBe(true);
    expect(matchMorphologyPatternInWord(word('ٱلْكُبْرَىٰ'), target)).toBe(false);
    expect(matchMorphologyPatternInWord(word('كَبِيرَةٌ'), target)).toBe(false);
  });
});

describe('على نص المصحف', () => {
  it('يلتقط تاء التأنيث في «الحمد لله رب العالمين» فلا يجد شيئا، ويجدها في غيرها', () => {
    const fatiha = getAyahWords(1, 2) ?? [];
    const withTaa = fatiha.filter((item) => hasMorphologyFeature(item.text, 'TAA_MARBUTA'));
    expect(withTaa).toHaveLength(0);

    const baqara = getAyahWords(2, 2) ?? [];
    expect(baqara.length).toBeGreaterThan(0);
  });

  it('يطابق «الصراط» في الفاتحة بمعياري التعريف وحركة الآخر', () => {
    const words = getAyahWords(1, 6) ?? [];
    expect(words.length).toBeGreaterThan(0);

    const matched = words.filter((item, index) =>
      matchMorphologyPatternInWord(
        { position: index + 1, text: item.text, ayahKey: makeAyahKey(1, 6) },
        pattern({ morphologyFeatures: ['DEFINITE_AL'] }),
        { isFirst: index === 0, isLast: index === words.length - 1 }
      )
    );

    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((item) => hasMorphologyFeature(item.text, 'DEFINITE_AL'))).toBe(true);
  });
});

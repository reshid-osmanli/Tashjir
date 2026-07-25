// اختبارات بيانات المصحف - Quran Data Tests
// مشروع التشجير - نظام القراءات العشر
//
// هذه أهم اختبارات المشروع: أي خلل في النص القرآني أو في حتمية المعرّفات
// يفسد كل ما بُني فوقه من تشجير محفوظ.

import { describe, expect, it } from 'vitest';
import {
  SURAHS,
  TOTAL_AYAHS,
  getAyah,
  getAyahCount,
  getAyahWords,
  getSurah,
  getWordById,
  makeAyahKey,
  makeWordId,
  normalizeForSearch,
  parseAyahKey,
  parseWordId,
  searchQuran,
  stripHarakat,
} from '@/data/quran';

describe('سلامة بيانات المصحف', () => {
  it('يحتوي على 114 سورة', () => {
    expect(SURAHS).toHaveLength(114);
  });

  it('مجموع الآيات 6236', () => {
    const sum = SURAHS.reduce((total, surah) => total + surah.ayahsCount, 0);
    expect(sum).toBe(6236);
    expect(TOTAL_AYAHS).toBe(6236);
  });

  it('أرقام السور متسلسلة من 1 إلى 114', () => {
    SURAHS.forEach((surah, index) => expect(surah.number).toBe(index + 1));
  });

  it('عدد آيات السور المشهورة صحيح', () => {
    expect(getAyahCount(1)).toBe(7); // الفاتحة
    expect(getAyahCount(2)).toBe(286); // البقرة
    expect(getAyahCount(9)).toBe(129); // التوبة
    expect(getAyahCount(112)).toBe(4); // الإخلاص
    expect(getAyahCount(114)).toBe(6); // الناس
  });

  it('لا توجد آية بنص فارغ في المصحف كله', () => {
    for (const surah of SURAHS) {
      for (let number = 1; number <= surah.ayahsCount; number++) {
        const ayah = getAyah(surah.number, number);
        expect(ayah?.text.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('يعيد نص الفاتحة الأولى صحيحا', () => {
    const ayah = getAyah(1, 1);
    expect(ayah?.wordsCount).toBe(4);
    expect(stripHarakat(ayah!.text)).toContain('بسم');
  });

  it('يعيد undefined للمواضع غير الموجودة', () => {
    expect(getAyah(1, 8)).toBeUndefined();
    expect(getAyah(115, 1)).toBeUndefined();
    expect(getSurah(0)).toBeUndefined();
  });
});

describe('حتمية المعرّفات', () => {
  it('بناء وتفكيك معرّف الآية متطابقان', () => {
    for (const [surah, ayah] of [
      [1, 1],
      [2, 255],
      [114, 6],
    ] as const) {
      const key = makeAyahKey(surah, ayah);
      expect(parseAyahKey(key)).toEqual({ surahNumber: surah, ayahNumber: ayah });
    }
  });

  it('بناء وتفكيك معرّف الكلمة متطابقان', () => {
    const key = makeAyahKey(2, 10);
    const wordId = makeWordId(key, 7);
    expect(parseWordId(wordId)).toEqual({ ayahKey: key, position: 7 });
  });

  it('معرّفات الكلمات فريدة عالميا ولا تتصادم بين الآيات', () => {
    const ids = new Set<number>();
    // عينة كافية: أول ثلاث سور، وفيها آيات طويلة.
    for (const surahNumber of [1, 2, 3]) {
      for (let ayah = 1; ayah <= getAyahCount(surahNumber); ayah++) {
        for (const word of getAyahWords(surahNumber, ayah)) {
          expect(ids.has(word.id)).toBe(false);
          ids.add(word.id);
        }
      }
    }
    expect(ids.size).toBeGreaterThan(3000);
  });

  it('يسترجع الكلمة بمعرّفها', () => {
    const words = getAyahWords(1, 4);
    const word = getWordById(words[0].id);
    expect(word?.text).toBe(words[0].text);
    expect(word?.position).toBe(1);
  });

  it('تقسيم الكلمات مستقر عبر النداءات المتكررة', () => {
    const first = getAyahWords(2, 255);
    const second = getAyahWords(2, 255);
    expect(first.map((word) => word.id)).toEqual(second.map((word) => word.id));
  });
});

describe('التطبيع والبحث', () => {
  it('يزيل الحركات وعلامات الضبط', () => {
    // الألف الخنجرية (U+0670) علامة ضبط لا حرف مرسوم، فتُزال مع الحركات.
    // لذلك «مَٰلِكِ» تصير «ملك» في الرسم المجرد، وهذا هو السلوك الصحيح.
    expect(stripHarakat('مَٰلِكِ')).toBe('ملك');
    expect(stripHarakat('ٱلرَّحۡمَٰنِ')).toBe('ٱلرحمن');
    expect(stripHarakat('ٱلۡحَمۡدُ')).toBe('ٱلحمد');
  });

  it('يوحّد الهمزات والألف المقصورة والتاء المربوطة', () => {
    expect(normalizeForSearch('أَحَد')).toBe('احد');
    expect(normalizeForSearch('إِلَىٰ')).toBe('الي');
    expect(normalizeForSearch('صَلَاة')).toBe('صلاه');
  });

  it('يجد آيات بالبحث بلا تشكيل', () => {
    const hits = searchQuran('الرحمن الرحيم', 10);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].surahNumber).toBe(1);
  });

  it('يتجاهل البحث القصير جدا', () => {
    expect(searchQuran('ا')).toHaveLength(0);
  });

  it('يحترم حد النتائج', () => {
    expect(searchQuran('الله', 5)).toHaveLength(5);
  });
});

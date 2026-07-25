// بيانات مصحف محلية أولية - Local Quran Data
// مشروع التشجير - نظام القراءات العشر

export type LocalQuranSurah = {
  number: number;
  name: string;
  page: number;
  ayahs: string[];
};

export type LocalAyahWord = {
  id: number;
  text: string;
  position: number;
};

export const LOCAL_QURAN_SURAHS: LocalQuranSurah[] = [
  {
    number: 1,
    name: 'الفاتحة',
    page: 1,
    ayahs: [
      'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
      'الرَّحْمَٰنِ الرَّحِيمِ',
      'مَالِكِ يَوْمِ الدِّينِ',
      'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
      'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    ],
  },
  {
    number: 112,
    name: 'الإخلاص',
    page: 604,
    ayahs: [
      'قُلْ هُوَ اللَّهُ أَحَدٌ',
      'اللَّهُ الصَّمَدُ',
      'لَمْ يَلِدْ وَلَمْ يُولَدْ',
      'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
    ],
  },
  {
    number: 113,
    name: 'الفلق',
    page: 604,
    ayahs: [
      'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ',
      'مِن شَرِّ مَا خَلَقَ',
      'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
      'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ',
      'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    ],
  },
  {
    number: 114,
    name: 'الناس',
    page: 604,
    ayahs: [
      'قُلْ أَعُوذُ بِرَبِّ النَّاسِ',
      'مَلِكِ النَّاسِ',
      'إِلَٰهِ النَّاسِ',
      'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ',
      'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ',
      'مِنَ الْجِنَّةِ وَالنَّاسِ',
    ],
  },
];

const LOCAL_AYAH_TEXT_BY_ID: Record<number, string> = {
  1: LOCAL_QURAN_SURAHS[0].ayahs[0],
  2: LOCAL_QURAN_SURAHS[0].ayahs[1],
  3: LOCAL_QURAN_SURAHS[0].ayahs[2],
  4: LOCAL_QURAN_SURAHS[0].ayahs[3],
  5: LOCAL_QURAN_SURAHS[0].ayahs[4],
  6: LOCAL_QURAN_SURAHS[0].ayahs[5],
  7: LOCAL_QURAN_SURAHS[0].ayahs[6],
};

export function getLocalSurah(surahNumber: number): LocalQuranSurah {
  return LOCAL_QURAN_SURAHS.find((surah) => surah.number === surahNumber) ?? LOCAL_QURAN_SURAHS[0];
}

export function getLocalAyahText(ayahId: number, surahNumber = 1): string {
  if (surahNumber === 1) {
    return LOCAL_AYAH_TEXT_BY_ID[ayahId] ?? LOCAL_QURAN_SURAHS[0].ayahs[0];
  }

  const surah = getLocalSurah(surahNumber);
  return surah.ayahs[ayahId - 1] ?? surah.ayahs[0] ?? LOCAL_QURAN_SURAHS[0].ayahs[0];
}

export function getLocalAyahWords(ayahId: number, surahNumber = 1): LocalAyahWord[] {
  const text = getLocalAyahText(ayahId, surahNumber);
  const firstWordId = getFirstWordId(ayahId, surahNumber);

  return text.split(/\s+/).map((word, index) => ({
    id: firstWordId + index,
    text: word,
    position: index + 1,
  }));
}

function getFirstWordId(ayahId: number, surahNumber: number): number {
  if (surahNumber === 1 && ayahId === 1) return 1;
  if (surahNumber === 1 && ayahId === 2) return 5;
  if (surahNumber === 1) return ayahId * 10 + 1;
  return surahNumber * 1000 + ayahId * 100 + 1;
}

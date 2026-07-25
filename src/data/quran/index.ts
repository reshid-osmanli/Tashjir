// طبقة بيانات المصحف - Mushaf Data Layer
// مشروع التشجير - نظام القراءات العشر
//
// هذه الطبقة هي المصدر الوحيد للحقيقة بخصوص نص المصحف داخل التطبيق.
// النص عثماني كامل (114 سورة / 6236 آية) مولّد عبر: npm run data:quran
//
// المبادئ:
//   1. المعرّفات حتمية (deterministic) ولا تُخزَّن في الملف، بل تُحسب.
//      - معرّف الآية : ayahKey = surah * 1000 + ayah
//      - معرّف الكلمة: wordId  = ayahKey * 1000 + position
//      هذا يجعل أي خط تشجير محفوظ قابلا لإعادة الربط بنفس الكلمة دائما.
//   2. لا نحمّل الكلمات مسبقا لكل المصحف (77 ألف كلمة)، بل نشتقها عند الطلب
//      ونخزنها في ذاكرة مؤقتة (Map) لتفادي إعادة الحساب.
//   3. كل الدوال نقية (pure) وقابلة للاختبار.

import rawMushaf from './mushaf.json';

// ==================== الأنواع ====================

/** سورة كما تُقرأ من الملف الخام (أسماء حقول مختصرة لتقليل الحجم). */
interface RawSurah {
  /** رقم السورة */
  i: number;
  /** اسم السورة بالعربية */
  n: string;
  /** الاسم اللاتيني */
  t: string;
  /** نوع النزول */
  r: 'MECCAN' | 'MEDINAN';
  /** نصوص الآيات مرتبة */
  v: string[];
}

interface RawMushaf {
  version: number;
  source: string;
  script: string;
  totalSurahs: number;
  totalAyahs: number;
  totalWords: number;
  surahs: RawSurah[];
}

/** بيانات سورة معروضة للتطبيق. */
export interface MushafSurah {
  /** رقم السورة (1..114) */
  number: number;
  /** اسم السورة بالعربية */
  name: string;
  /** الاسم اللاتيني */
  transliteration: string;
  /** مكية أو مدنية */
  revelationType: 'MECCAN' | 'MEDINAN';
  /** عدد الآيات */
  ayahsCount: number;
  /** أول صفحة تقريبية في مصحف المدينة */
  page: number;
}

/** آية كاملة مع معرّفها الحتمي. */
export interface MushafAyah {
  /** المعرّف العالمي: surah * 1000 + ayah */
  key: number;
  /** رقم السورة */
  surahNumber: number;
  /** رقم الآية داخل السورة */
  ayahNumber: number;
  /** الترتيب المطلق للآية في المصحف (1..6236) */
  absoluteIndex: number;
  /** النص العثماني الكامل بالحركات */
  text: string;
  /** النص بلا حركات (للبحث والمقارنة) */
  plainText: string;
  /** عدد الكلمات */
  wordsCount: number;
}

/** كلمة داخل آية. */
export interface MushafWord {
  /** المعرّف الحتمي: ayahKey * 1000 + position */
  id: number;
  /** معرّف الآية */
  ayahKey: number;
  /** ترتيب الكلمة داخل الآية (1-based) */
  position: number;
  /** نص الكلمة بالحركات */
  text: string;
  /** نص الكلمة بلا حركات */
  plainText: string;
}

// ==================== تحميل البيانات ====================

const MUSHAF = rawMushaf as RawMushaf;

/** رمز التشكيل العربي: حركات + علامات ضبط المصحف. */
const HARAKAT_PATTERN = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

/** مجموع الآيات في المصحف. */
export const TOTAL_AYAHS = MUSHAF.totalAyahs;

/** مجموع الكلمات في المصحف (حسب التقسيم بالمسافات). */
export const TOTAL_WORDS = MUSHAF.totalWords;

/** مصدر النص ورخصته، يُعرض في صفحة الإعدادات. */
export const MUSHAF_SOURCE = MUSHAF.source;

/**
 * فهرس السور مع أرقام صفحات تقريبية.
 *
 * ملاحظة منهجية: أرقام الصفحات هنا تقريبية ومشتقة من توزيع الآيات،
 * وليست أرقام مصحف المدينة الرسمية. تُستخدم للعرض فقط ولا يُبنى عليها حكم.
 */
export const SURAHS: MushafSurah[] = buildSurahIndex();

const surahByNumber = new Map<number, RawSurah>(MUSHAF.surahs.map((surah) => [surah.i, surah]));
const surahMetaByNumber = new Map<number, MushafSurah>(SURAHS.map((surah) => [surah.number, surah]));

/** ذاكرة مؤقتة لكلمات الآيات المطلوبة فقط. */
const wordsCache = new Map<number, MushafWord[]>();

/** ذاكرة مؤقتة لأول معرّف آية في كل سورة (للترتيب المطلق). */
const absoluteOffsetBySurah = buildAbsoluteOffsets();

// ==================== دوال المعرّفات ====================

/** يبني معرّف الآية العالمي من رقم السورة ورقم الآية. */
export function makeAyahKey(surahNumber: number, ayahNumber: number): number {
  return surahNumber * 1000 + ayahNumber;
}

/** يفكّك معرّف الآية إلى رقم سورة ورقم آية. */
export function parseAyahKey(ayahKey: number): { surahNumber: number; ayahNumber: number } {
  return {
    surahNumber: Math.floor(ayahKey / 1000),
    ayahNumber: ayahKey % 1000,
  };
}

/** يبني معرّف الكلمة من معرّف الآية وترتيب الكلمة. */
export function makeWordId(ayahKey: number, position: number): number {
  return ayahKey * 1000 + position;
}

/** يفكّك معرّف الكلمة إلى معرّف آية وترتيب. */
export function parseWordId(wordId: number): { ayahKey: number; position: number } {
  return {
    ayahKey: Math.floor(wordId / 1000),
    position: wordId % 1000,
  };
}

// ==================== الوصول للسور ====================

/** يعيد بيانات سورة أو undefined إن كان الرقم خارج المدى. */
export function getSurah(surahNumber: number): MushafSurah | undefined {
  return surahMetaByNumber.get(surahNumber);
}

/** يعيد بيانات سورة، وإن لم توجد يعيد الفاتحة (سلوك آمن للواجهة). */
export function getSurahOrFirst(surahNumber: number): MushafSurah {
  return surahMetaByNumber.get(surahNumber) ?? SURAHS[0];
}

/** يعيد عدد آيات سورة. */
export function getAyahCount(surahNumber: number): number {
  return surahByNumber.get(surahNumber)?.v.length ?? 0;
}

/** بحث في أسماء السور بالعربية أو اللاتينية أو الرقم. */
export function searchSurahs(query: string): MushafSurah[] {
  const normalized = normalizeForSearch(query);
  if (!normalized) return SURAHS;

  return SURAHS.filter((surah) => {
    if (String(surah.number) === normalized) return true;
    if (normalizeForSearch(surah.name).includes(normalized)) return true;
    return surah.transliteration.toLowerCase().includes(normalized);
  });
}

// ==================== الوصول للآيات ====================

/** يعيد آية كاملة، أو undefined إن لم توجد. */
export function getAyah(surahNumber: number, ayahNumber: number): MushafAyah | undefined {
  const surah = surahByNumber.get(surahNumber);
  const text = surah?.v[ayahNumber - 1];
  if (!surah || !text) return undefined;

  const key = makeAyahKey(surahNumber, ayahNumber);

  return {
    key,
    surahNumber,
    ayahNumber,
    absoluteIndex: (absoluteOffsetBySurah.get(surahNumber) ?? 0) + ayahNumber,
    text,
    plainText: stripHarakat(text),
    wordsCount: text.split(' ').length,
  };
}

/** يعيد الآية بمعرّفها العالمي. */
export function getAyahByKey(ayahKey: number): MushafAyah | undefined {
  const { surahNumber, ayahNumber } = parseAyahKey(ayahKey);
  return getAyah(surahNumber, ayahNumber);
}

/** يعيد كل آيات سورة. */
export function getSurahAyahs(surahNumber: number): MushafAyah[] {
  const surah = surahByNumber.get(surahNumber);
  if (!surah) return [];

  return surah.v.map((_, index) => getAyah(surahNumber, index + 1)!).filter(Boolean);
}

/** يعيد نص الآية فقط (يعيد نصا فارغا إن لم توجد). */
export function getAyahText(surahNumber: number, ayahNumber: number): string {
  return surahByNumber.get(surahNumber)?.v[ayahNumber - 1] ?? '';
}

// ==================== الوصول للكلمات ====================

/**
 * يعيد كلمات آية مع معرّفات حتمية.
 * النتيجة مخزّنة مؤقتا: أول نداء يحسب، والنداءات التالية ترجع نفس المرجع.
 */
export function getAyahWords(surahNumber: number, ayahNumber: number): MushafWord[] {
  const ayahKey = makeAyahKey(surahNumber, ayahNumber);
  const cached = wordsCache.get(ayahKey);
  if (cached) return cached;

  const text = getAyahText(surahNumber, ayahNumber);
  if (!text) return [];

  const words: MushafWord[] = text.split(' ').map((word, index) => ({
    id: makeWordId(ayahKey, index + 1),
    ayahKey,
    position: index + 1,
    text: word,
    plainText: stripHarakat(word),
  }));

  wordsCache.set(ayahKey, words);
  return words;
}

/** يعيد كلمات آية بمعرّفها العالمي. */
export function getAyahWordsByKey(ayahKey: number): MushafWord[] {
  const { surahNumber, ayahNumber } = parseAyahKey(ayahKey);
  return getAyahWords(surahNumber, ayahNumber);
}

/** يعيد كلمة واحدة بمعرّفها. */
export function getWordById(wordId: number): MushafWord | undefined {
  const { ayahKey, position } = parseWordId(wordId);
  return getAyahWordsByKey(ayahKey)[position - 1];
}

// ==================== أدوات نصية ====================

/** يزيل الحركات وعلامات الضبط من النص العثماني. */
export function stripHarakat(text: string): string {
  return text.replace(HARAKAT_PATTERN, '');
}

/**
 * تطبيع النص للبحث:
 * إزالة الحركات، وتوحيد الهمزات والألف المقصورة والتاء المربوطة،
 * وإزالة الألف الخنجرية والتطويل.
 */
export function normalizeForSearch(text: string): string {
  return stripHarakat(text)
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, 'ا')
    .replace(/\u0624/g, 'و')
    .replace(/\u0626/g, 'ي')
    .replace(/\u0649/g, 'ي')
    .replace(/\u0629/g, 'ه')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** نتيجة بحث في نص المصحف. */
export interface QuranSearchHit {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  ayahKey: number;
  text: string;
}

/**
 * بحث نصي في المصحف كاملا مع تجاهل التشكيل.
 * @param query عبارة البحث
 * @param limit الحد الأقصى للنتائج (افتراضي 50)
 */
export function searchQuran(query: string, limit = 50): QuranSearchHit[] {
  const normalized = normalizeForSearch(query);
  if (normalized.length < 2) return [];

  const hits: QuranSearchHit[] = [];

  for (const surah of MUSHAF.surahs) {
    for (let index = 0; index < surah.v.length; index++) {
      if (!normalizeForSearch(surah.v[index]).includes(normalized)) continue;

      hits.push({
        surahNumber: surah.i,
        surahName: surah.n,
        ayahNumber: index + 1,
        ayahKey: makeAyahKey(surah.i, index + 1),
        text: surah.v[index],
      });

      if (hits.length >= limit) return hits;
    }
  }

  return hits;
}

// ==================== بناء الفهارس ====================

function buildSurahIndex(): MushafSurah[] {
  // توزيع تقريبي: 604 صفحة على 6236 آية.
  const ayahsPerPage = MUSHAF.totalAyahs / 604;
  let consumed = 0;

  return MUSHAF.surahs.map((surah) => {
    const page = Math.min(604, Math.floor(consumed / ayahsPerPage) + 1);
    consumed += surah.v.length;

    return {
      number: surah.i,
      name: surah.n,
      transliteration: surah.t,
      revelationType: surah.r,
      ayahsCount: surah.v.length,
      page,
    };
  });
}

function buildAbsoluteOffsets(): Map<number, number> {
  const offsets = new Map<number, number>();
  let running = 0;

  for (const surah of MUSHAF.surahs) {
    offsets.set(surah.i, running);
    running += surah.v.length;
  }

  return offsets;
}

// أدوات عربية - Arabic Utilities
// مشروع التشجير - نظام القراءات العشر

// ==================== الحروف العربية ====================

export const ARABIC_LETTERS = {
  ALIF: 'ا',
  BA: 'ب',
  TA: 'ت',
  THA: 'ث',
  JEEM: 'ج',
  HAH: 'ح',
  KHA: 'خ',
  DAL: 'د',
  THAL: 'ذ',
  RA: 'ر',
  ZAY: 'ز',
  SEEN: 'س',
  SHEEN: 'ش',
  SAD: 'ص',
  DAD: 'ض',
  TAH: 'ط',
  ZAH: 'ظ',
  AIN: 'ع',
  GHAIN: 'غ',
  FA: 'ف',
  QAF: 'ق',
  KAF: 'ك',
  LAM: 'ل',
  MEEM: 'م',
  NOON: 'ن',
  HA: 'ه',
  WAW: 'و',
  YA: 'ي',
  ALIF_MAQSURA: 'ى',
  TA_MARBUTA: 'ة',
  HAMZA: 'ء',
  ALIF_HAMZA_ABOVE: 'أ',
  ALIF_HAMZA_BELOW: 'إ',
  WAW_HAMZA: 'ؤ',
  YA_HAMZA: 'ئ',
  ALIF_MADDA: 'آ',
};

export const HARAKAT = {
  FATHA: '\u064E',
  DAMMA: '\u064F',
  KASRA: '\u0650',
  SHADDA: '\u0651',
  SUKUN: '\u0652',
  MAD: '\u0653',
  TANWEEN_FATH: '\u064B',
  TANWEEN_DAMM: '\u064C',
  TANWEEN_KASR: '\u064D',
  ALIF_KHANJARIYYA: '\u0657',
  WAQF_LAZIM: '\u06D6',
  WAJF_JAIZ: '\u06D7',
  WAQF_MURAKKAB: '\u06D8',
  WAQF_MUANAQAH: '\u06D9',
  RABBA: '\u06DA',
  SALLA: '\u06DB',
  QALA: '\u06DC',
  SALLALLAHU: '\u06DD',
  ALLI: '\u06DE',
  AKBAR: '\u06E0',
  MUHAAF: '\u06E2',
  TAA_ALEEN: '\u06E3',
  SAKTA: '\u06E5',
};

// ==================== أرقام عربية ====================

export const ARABIC_NUMBERS: Record<number, string> = {
  0: '٠',
  1: '١',
  2: '٢',
  3: '٣',
  4: '٤',
  5: '٥',
  6: '٦',
  7: '٧',
  8: '٨',
  9: '٩',
};

/**
 * تحويل الرقم إلى رقم عربي
 */
export function toArabicNumber(num: number): string {
  return num
    .toString()
    .split('')
    .map(digit => ARABIC_NUMBERS[parseInt(digit)] || digit)
    .join('');
}

/**
 * تحويل الرقم العربي إلى رقم إنجليزي
 */
export function fromArabicNumber(arabicNum: string): number {
  const reverseMap: Record<string, string> = {};
  Object.entries(ARABIC_NUMBERS).forEach(([k, v]) => {
    reverseMap[v] = k;
  });

  return parseInt(
    arabicNum
      .split('')
      .map(char => reverseMap[char] || char)
      .join('')
  );
}

// ==================== تشكيل النص ====================

/**
 * تشكيل الحرف بالفتحة
 */
export function addFatha(char: string): string {
  return char + HARAKAT.FATHA;
}

/**
 * تشكيل الحرف بالضمة
 */
export function addDamma(char: string): string {
  return char + HARAKAT.DAMMA;
}

/**
 * تشكيل الحرف بالكسرة
 */
export function addKasra(char: string): string {
  return char + HARAKAT.KASRA;
}

/**
 * إضافة الشدة
 */
export function addShadda(char: string): string {
  return char + HARAKAT.SHADDA;
}

/**
 * إضافة السكون
 */
export function addSukun(char: string): string {
  return char + HARAKAT.SUKUN;
}

/**
 * إضافة التنوين بالفتح
 */
export function addTanweenFath(char: string): string {
  return char + HARAKAT.TANWEEN_FATH;
}

/**
 * إضافة التنوين بالضم
 */
export function addTanweenDamm(char: string): string {
  return char + HARAKAT.TANWEEN_DAMM;
}

/**
 * إضافة التنوين بالكسر
 */
export function addTanweenKasr(char: string): string {
  return char + HARAKAT.TANWEEN_KASR;
}

// ==================== معالجة النص ====================

/**
 * عكس النص العربي (للعرض من اليمين لليسار)
 */
export function reverseArabic(text: string): string {
  return text.split('').reverse().join('');
}

/**
 * تقسيم النص إلى كلمات
 */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(word => word.length > 0);
}

/**
 * تقسيم النص إلى أحرف
 */
export function splitChars(text: string): string[] {
  return [...text];
}

/**
 * عد الأحرف العربية في النص
 */
export function countArabicChars(text: string): number {
  return [...text].filter(char => isArabicLetter(char)).length;
}

/**
 * عد الحركات في النص
 */
export function countHarakat(text: string): number {
  return [...text].filter(char => isHaraka(char)).length;
}

/**
 * التحقق من أن النص عربي
 */
export function isArabicText(text: string): boolean {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicPattern.test(text);
}

/**
 * التحقق من أن الحرف حرف عربي
 */
export function isArabicLetter(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x0600 && code <= 0x06FF) ||
    (code >= 0x0750 && code <= 0x077F) ||
    (code >= 0xFB50 && code <= 0xFDFF) ||
    (code >= 0xFE70 && code <= 0xFEFF)
  );
}

/**
 * التحقق من أن الحرف حركة
 */
export function isHaraka(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x064B && code <= 0x065F;
}

/**
 * التحقق من أن الحرف حرف مد
 */
export function isMadLetter(char: string): boolean {
  return [ARABIC_LETTERS.ALIF, ARABIC_LETTERS.WAW, ARABIC_LETTERS.YA, ARABIC_LETTERS.ALIF_MAQSURA].includes(char);
}

/**
 * التحقق من أن الحرف همزة
 */
export function isHamza(char: string): boolean {
  return [
    ARABIC_LETTERS.HAMZA,
    ARABIC_LETTERS.ALIF_HAMZA_ABOVE,
    ARABIC_LETTERS.ALIF_HAMZA_BELOW,
    ARABIC_LETTERS.WAW_HAMZA,
    ARABIC_LETTERS.YA_HAMZA,
    ARABIC_LETTERS.ALIF_MADDA,
  ].includes(char);
}

// ==================== تنسيق العرض ====================

/**
 * تنسيق رقم الآية
 */
export function formatAyahNumber(surahNumber: number, ayahNumber: number): string {
  return `${toArabicNumber(surahNumber)}:${toArabicNumber(ayahNumber)}`;
}

/**
 * تنسيق رقم الصفحة
 */
export function formatPageNumber(page: number): string {
  return toArabicNumber(page);
}

/**
 * تنسيق اسم السورة
 */
export function formatSurahName(name: string, ayahCount: number): string {
  return `${name} (${toArabicNumber(ayahCount)} آية)`;
}

// ==================== البحث ====================

/**
 * البحث في النص القرآني
 */
export function searchInQuran(query: string, text: string): boolean {
  const normalizedQuery = normalizeArabic(query);
  const normalizedText = normalizeArabic(text);
  return normalizedText.includes(normalizedQuery);
}

/**
 * تطبيع النص العربي (إزالة الحركات والهمزات)
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة الحركات
    .replace(/[أإآ]/g, 'ا') // تطبيع الهمزات على الألف
    .replace(/ؤ/g, 'و') // تطبيع الهمزة على الواو
    .replace(/ئ/g, 'ي') // تطبيع الهمزة على الياء
    .replace(/ة/g, 'ه'); // تطبيع التاء المربوطة
}

/**
 * البحث الضبابي في النص العربي
 */
export function fuzzySearch(query: string, text: string): boolean {
  const normalizedQuery = normalizeArabic(query);
  const normalizedText = normalizeArabic(text);

  // البحث المباشر
  if (normalizedText.includes(normalizedQuery)) return true;

  // البحث بالتطبيع الإضافي
  const extraNormalized = normalizedText
    .replace(/ى/g, 'ي')
    .replace(/ه/g, 'ة');

  return extraNormalized.includes(normalizedQuery);
}

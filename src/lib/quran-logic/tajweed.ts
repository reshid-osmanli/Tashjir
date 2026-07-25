// أحكام التجويد - Tajweed Rules
// مشروع التشجير - نظام القراءات العشر

import { TajweedRule } from '@/types';

// ==================== حروف التجويد ====================

export const HURUF_ALQALAQAH = ['ق', 'ط', 'ب', 'ج', 'د'];

export const HURUF_ALIYYAH = ['ح', 'خ', 'ع', 'غ', 'ه', 'ء'];

export const HURUF_ALIQLAB = ['ب'];

export const HURUF_ALIDGHAM = ['ي', 'ر', 'م', 'ل', 'و', 'ن'];

export const HURUF_ALIKHFAA = [
  'ت', 'ث', 'ج', 'د', 'ذ', 'ز', 'س', 'ش',
  'ص', 'ض', 'ط', 'ظ', 'ف', 'ق', 'ك',
];

export const HURUF_IZHAR = ['ح', 'خ', 'ع', 'غ', 'ه', 'ء'];

export const HURUF_MAD = ['ا', 'و', 'ي', 'ى'];

export const HURUF_GHUNNAH = ['ن', 'م'];

export const HURUF_QALQALAH = ['ق', 'ط', 'ب', 'ج', 'د'];

export const HURUF_LIYYIN = ['و', 'ي'];

export const HURUF_SAFEER = ['ص', 'ز', 'س'];

// ==================== أحكام النون الساكنة والتنوين ====================

/**
 * كشف حكم النون الساكنة أو التنوين
 */
export function detectNunSaakinahRule(
  currentWord: string,
  nextWord: string
): TajweedRule | null {
  const nextLetter = getFirstLetter(nextWord);

  if (!nextLetter) return null;

  // الإظهار: حروف الحلق
  if (HURUF_IZHAR.includes(nextLetter)) {
    return 'IZHAR';
  }

  // الإقلاب: الباء
  if (HURUF_ALIQLAB.includes(nextLetter)) {
    return 'IQLAB';
  }

  // الإدغام: يرملون
  if (HURUF_ALIDGHAM.includes(nextLetter)) {
    return 'IDGHAM';
  }

  // الإخفاء: باقي الحروف
  if (HURUF_ALIKHFAA.includes(nextLetter)) {
    return 'IKHFAA';
  }

  return null;
}

/**
 * الحصول على اسم الحكم بالعربية
 */
export function getTajweedRuleName(rule: TajweedRule): string {
  const names: Record<TajweedRule, string> = {
    IDGHAM: 'إدغام',
    IKHFAA: 'إخفاء',
    IQLAB: 'إقلاب',
    IZHAR: 'إظهار',
  };
  return names[rule];
}

/**
 * الحصول على وصف الحكم
 */
export function getTajweedRuleDescription(rule: TajweedRule): string {
  const descriptions: Record<TajweedRule, string> = {
    IDGHAM: 'إدغام النون الساكنة أو التنوين في الحرف التالي مع غنة',
    IKHFAA: 'إخفاء النون الساكنة أو التنوين عند الحرف التالي مع غنة',
    IQLAB: 'قلب النون الساكنة أو التنوين ميماً عند الباء مع غنة',
    IZHAR: 'إظهار النون الساكنة أو التنوين عند حروف الحلق',
  };
  return descriptions[rule];
}

// ==================== أحكام الميم الساكنة ====================

export type MeemSaakinahRule = 'IDGHAM_MITHLAYN' | 'IKHFAA_SHAFAWI' | 'IZHAR_SHAFAWI';

/**
 * كشف حكم الميم الساكنة
 */
export function detectMeemSaakinahRule(
  currentWord: string,
  nextWord: string
): MeemSaakinahRule | null {
  const nextLetter = getFirstLetter(nextWord);

  if (!nextLetter) return null;

  // إدغام مثلين: الميم
  if (nextLetter === 'م') {
    return 'IDGHAM_MITHLAYN';
  }

  // إخفاء شفوي: الباء
  if (nextLetter === 'ب') {
    return 'IKHFAA_SHAFAWI';
  }

  // إظهار شفوي: باقي الحروف
  return 'IZHAR_SHAFAWI';
}

/**
 * الحصول على اسم حكم الميم
 */
export function getMeemSaakinahRuleName(rule: MeemSaakinahRule): string {
  const names: Record<MeemSaakinahRule, string> = {
    IDGHAM_MITHLAYN: 'إدغام مثلين',
    IKHFAA_SHAFAWI: 'إخفاء شفوي',
    IZHAR_SHAFAWI: 'إظهار شفوي',
  };
  return names[rule];
}

// ==================== أحكام المد ====================

export type MadType =
  | 'TABII'        // مد طبيعي
  | 'MUTTASIL'     // مد متصل
  | 'MUNFASIL'     // مد منفصل
  | 'LAZIM'        // مد لازم
  | 'ARID_LISSUKUN' // مد عارض للسكون
  | 'BADAL'        // مد بدل
  | 'AARID';       // مد عارض

/**
 * كشف نوع المد
 */
export function detectMadType(
  word: string,
  position: number
): MadType | null {
  const char = word[position];
  const nextChar = word[position + 1];

  if (!char || !isMadLetter(char)) return null;

  // المد الطبيعي: حرف مد لا يتبعه همز أو سكون
  if (!nextChar || (!isHamza(nextChar) && !isSukun(nextChar))) {
    return 'TABII';
  }

  // المد المتصل: حرف مد يتبعه همز في نفس الكلمة
  if (isHamza(nextChar) && isSameWord(word, position, position + 1)) {
    return 'MUTTASIL';
  }

  // المد المنفصل: حرف مد يتبعه همز في كلمة أخرى
  if (isHamza(nextChar)) {
    return 'MUNFASIL';
  }

  return 'TABII';
}

/**
 * الحصول على اسم نوع المد
 */
export function getMadTypeName(type: MadType): string {
  const names: Record<MadType, string> = {
    TABII: 'مد طبيعي',
    MUTTASIL: 'مد متصل',
    MUNFASIL: 'مد منفصل',
    LAZIM: 'مد لازم',
    ARID_LISSUKUN: 'مد عارض للسكون',
    BADAL: 'مد بدل',
    AARID: 'مد عارض',
  };
  return names[type];
}

/**
 * حساب مقدار المد بالحركات
 */
export function getMadLength(type: MadType): number {
  const lengths: Record<MadType, number> = {
    TABII: 2,
    MUTTASIL: 4,
    MUNFASIL: 4,
    LAZIM: 6,
    ARID_LISSUKUN: 6,
    BADAL: 2,
    AARID: 6,
  };
  return lengths[type];
}

// ==================== أحكام الوقف ====================

export type WaqfType =
  | 'TAAM'         // وقف تام
  | 'KAFI'         // وقف كاف
  | 'HASAN'       // وقف حسن
  | 'QABIH'       // وقف قبيح
  | 'MURAKKAB';   // وقف مركب

/**
 * كشف نوع الوقف
 */
export function detectWaqfType(
  word: string,
  nextWord: string,
  ayahEnd: boolean
): WaqfType | null {
  if (ayahEnd) return 'TAAM';

  const lastLetter = getLastLetter(word);
  const firstLetter = getFirstLetter(nextWord);

  // وقف تام: عند نهاية الآية أو عند اكتمال المعنى
  if (ayahEnd) return 'TAAM';

  // وقف حسن: عند اكتمال المعنى دون ارتباط بما بعده
  if (isCompleteMeaning(word)) return 'HASAN';

  // وقف كاف: عند كفاية المعنى مع ارتباط بما بعده
  if (isKafiMeaning(word)) return 'KAFI';

  return 'HASAN';
}

// ==================== دوال مساعدة ====================

/**
 * الحصول على أول حرف من الكلمة
 */
function getFirstLetter(word: string): string {
  for (const char of word) {
    if (isArabicLetter(char) && !isHaraka(char)) {
      return char;
    }
  }
  return '';
}

/**
 * الحصول على آخر حرف من الكلمة
 */
function getLastLetter(word: string): string {
  const letters = [...word].filter(char => isArabicLetter(char) && !isHaraka(char));
  return letters[letters.length - 1] || '';
}

/**
 * التحقق من أن الحرف حرف مد
 */
function isMadLetter(char: string): boolean {
  return HURUF_MAD.includes(char);
}

/**
 * التحقق من أن الحرف همزة
 */
function isHamza(char: string): boolean {
  return ['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ'].includes(char);
}

/**
 * التحقق من أن الحرف سكون
 */
function isSukun(char: string): boolean {
  return char === '\u0652';
}

/**
 * التحقق من أن الحرفين في نفس الكلمة
 */
function isSameWord(word: string, pos1: number, pos2: number): boolean {
  // التحقق من عدم وجود مسافة بين الحرفين
  for (let i = pos1 + 1; i < pos2; i++) {
    if (word[i] === ' ') return false;
  }
  return true;
}

/**
 * التحقق من اكتمال المعنى
 */
function isCompleteMeaning(word: string): boolean {
  // منطق التحقق من اكتمال المعنى
  // يمكن تطويره لاحقاً
  return false;
}

/**
 * التحقق من كفاية المعنى
 */
function isKafiMeaning(word: string): boolean {
  // منطق التحقق من كفاية المعنى
  // يمكن تطويره لاحقاً
  return false;
}

/**
 * التحقق من أن الحرف حرف عربي
 */
function isArabicLetter(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0600 && code <= 0x06FF;
}

/**
 * التحقق من أن الحرف حركة
 */
function isHaraka(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x064B && code <= 0x065F;
}

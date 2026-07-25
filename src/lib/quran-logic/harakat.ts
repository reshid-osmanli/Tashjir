// معالجة الحركات - Harakat Processing
// مشروع التشجير - نظام القراءات العشر

import { Haraka, HarakaAnalysis, HarakaType } from '@/types';

// ==================== ثوابت الحركات ====================

export const HARAKAT_UNICODE: Record<string, HarakaType> = {
  '\u064E': 'fatha',       // فتحة ً
  '\u064F': 'damma',       // ضمة ُ
  '\u0650': 'kasra',       // كسرة ِ
  '\u0651': 'shadda',      // شدة ّ
  '\u0652': 'sukun',       // سكون ْ
  '\u0653': 'madd',        // مد ٓ
  '\u064B': 'tanween',     // تنوين فتح ً
  '\u064C': 'tanween',     // تنوين ضم ٌ
  '\u064D': 'tanween',     // تنوين كسر ٍ
  '\u0654': 'hamza_above', // همزة على الألف ٔ
  '\u0655': 'hamza_below', // همزة تحت الألف ٕ
  '\u0656': 'hamza_above', // همزة على الواو ٖ
  '\u0657': 'hamza_below', // همزة على الياء ٗ
};

export const HARAKAT_NAMES: Record<HarakaType, string> = {
  fatha: 'فتحة',
  damma: 'ضمة',
  kasra: 'كسرة',
  shadda: 'شدة',
  sukun: 'سكون',
  madd: 'مد',
  tanween: 'تنوين',
  hamza_above: 'همزة أعلاه',
  hamza_below: 'همزة أسفله',
};

// ==================== تحليل الحركات ====================

/**
 * تحليل النص واستخراج الحركات
 */
export function analyzeHarakat(text: string): HarakaAnalysis {
  const harakat: Haraka[] = [];
  const baseLetters: string[] = [];
  let totalWidth = 0;
  let maxHeight = 0;

  for (const char of text) {
    if (isHaraka(char)) {
      const haraka = getHarakaInfo(char);
      harakat.push(haraka);
      totalWidth += haraka.width;
      maxHeight = Math.max(maxHeight, haraka.height);
    } else if (isArabicLetter(char)) {
      baseLetters.push(char);
      totalWidth += getLetterWidth(char);
    }
  }

  return {
    harakat,
    baseLetters,
    totalWidth,
    maxHeight,
  };
}

/**
 * التحقق من أن الحرف حركة
 */
export function isHaraka(char: string): boolean {
  return char in HARAKAT_UNICODE;
}

/**
 * التحقق من أن الحرف حرف عربي
 */
export function isArabicLetter(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0600 && code <= 0x06FF;
}

/**
 * الحصول على معلومات الحركة
 */
export function getHarakaInfo(char: string): Haraka {
  const type = HARAKAT_UNICODE[char] || 'fatha';

  return {
    type,
    position: getHarakaPosition(type),
    character: char,
    width: getHarakaWidth(type),
    height: getHarakaHeight(type),
  };
}

/**
 * تحديد موقع الحركة (فوق/أسفل/على الحرف)
 */
function getHarakaPosition(type: HarakaType): 'above' | 'below' | 'on' {
  switch (type) {
    case 'fatha':
    case 'damma':
    case 'shadda':
    case 'madd':
    case 'tanween':
    case 'hamza_above':
      return 'above';
    case 'kasra':
    case 'hamza_below':
      return 'below';
    case 'sukun':
    default:
      return 'on';
  }
}

/**
 * حساب عرض الحركة
 */
function getHarakaWidth(type: HarakaType): number {
  const widths: Record<HarakaType, number> = {
    fatha: 8,
    damma: 10,
    kasra: 8,
    shadda: 12,
    sukun: 10,
    madd: 15,
    tanween: 12,
    hamza_above: 12,
    hamza_below: 12,
  };
  return widths[type] || 10;
}

/**
 * حساب ارتفاع الحركة
 */
function getHarakaHeight(type: HarakaType): number {
  const heights: Record<HarakaType, number> = {
    fatha: 15,
    damma: 18,
    kasra: 15,
    shadda: 15,
    sukun: 12,
    madd: 20,
    tanween: 15,
    hamza_above: 20,
    hamza_below: 20,
  };
  return heights[type] || 15;
}

/**
 * حساب عرض الحرف
 */
function getLetterWidth(char: string): number {
  const widths: Record<string, number> = {
    'ا': 15,
    'ب': 25,
    'ت': 25,
    'ث': 25,
    'ج': 20,
    'ح': 20,
    'خ': 20,
    'د': 15,
    'ذ': 15,
    'ر': 15,
    'ز': 15,
    'س': 30,
    'ش': 30,
    'ص': 30,
    'ض': 30,
    'ط': 25,
    'ظ': 25,
    'ع': 20,
    'غ': 20,
    'ف': 25,
    'ق': 25,
    'ك': 25,
    'ل': 20,
    'م': 25,
    'ن': 25,
    'ه': 20,
    'و': 15,
    'ي': 25,
    'ى': 25,
    'ء': 15,
    'ة': 20,
    'آ': 18,
    'أ': 18,
    'إ': 18,
    'ؤ': 18,
    'ئ': 18,
    ' ': 10,
  };
  return widths[char] || 20;
}

// ==================== إزالة الحركات ====================

/**
 * إزالة الحركات من النص
 */
export function removeHarakat(text: string): string {
  return text.replace(/[\u064B-\u065F\u0670]/g, '');
}

/**
 * إزالة الحركات مع الاحتفاظ بالشدة
 */
export function removeHarakatKeepShadda(text: string): string {
  return text.replace(/[\u064B-\u064F\u0651-\u065F\u0670]/g, '');
}

/**
 * إزالة التنوين فقط
 */
export function removeTanween(text: string): string {
  return text.replace(/[\u064B\u064C\u064D]/g, '');
}

// ==================== مقارنة النصوص ====================

/**
 * مقارنة نصين مع تجاهل الحركات
 */
export function compareIgnoreHarakat(text1: string, text2: string): boolean {
  return removeHarakat(text1) === removeHarakat(text2);
}

/**
 * تحديد الاختلافات بين نصين
 */
export function findDifferences(text1: string, text2: string): Difference[] {
  const differences: Difference[] = [];
  const maxLength = Math.max(text1.length, text2.length);

  for (let i = 0; i < maxLength; i++) {
    const char1 = text1[i] || '';
    const char2 = text2[i] || '';

    if (char1 !== char2) {
      differences.push({
        position: i,
        char1,
        char2,
        type: getDifferenceType(char1, char2),
      });
    }
  }

  return differences;
}

interface Difference {
  position: number;
  char1: string;
  char2: string;
  type: 'haraka' | 'letter' | 'missing' | 'extra';
}

function getDifferenceType(char1: string, char2: string): Difference['type'] {
  if (!char1) return 'missing';
  if (!char2) return 'extra';
  if (isHaraka(char1) || isHaraka(char2)) return 'haraka';
  return 'letter';
}

// ==================== حساب عرض الكلمة ====================

/**
 * حساب عرض الكلمة بالحركات
 */
export function calculateWordWidth(
  text: string,
  fontSize: number = 24
): number {
  const analysis = analyzeHarakat(text);
  const scale = fontSize / 24;
  return analysis.totalWidth * scale;
}

/**
 * حساب ارتفاع الكلمة بالحركات
 */
export function calculateWordHeight(
  text: string,
  fontSize: number = 24
): number {
  const analysis = analyzeHarakat(text);
  const scale = fontSize / 24;
  return (fontSize + analysis.maxHeight) * scale;
}

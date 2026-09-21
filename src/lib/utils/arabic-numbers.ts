// أرقام عربية - Arabic-Indic Numerals
//
// أرقام المحرر تُقرأ مع نص المصحف وفي هوامشه: مقدار حركات المد، ورقم الآية،
// وترتيب الكلمة. فطبعها بالأرقام اللاتينية يكسر صورة الصفحة ويخالف المطلوب.
// هذه الوحدة هي المرجع الوحيد للتحويل، حتى لا تتناثر خرائط الأرقام في
// المكوّنات فيختلف شكل الرقم بين لوحة وأخرى.

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** يحوّل أي رقم أو نص فيه أرقام إلى الأرقام العربية (الهندية). */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

/** «٢:٣٧» لموضع الآية في المصحف. */
export function formatAyahRef(surahNumber: number, ayahNumber: number): string {
  return `${toArabicDigits(surahNumber)}:${toArabicDigits(ayahNumber)}`;
}

/** نسبة مئوية بالأرقام العربية: «١٢٠٪». */
export function formatPercent(ratio: number): string {
  return `${toArabicDigits(Math.round(ratio * 100))}٪`;
}

/** مقدار المد بالحركات كما يُطبع في الهامش: «٤». */
export function formatHarakat(count: number): string {
  return toArabicDigits(count);
}

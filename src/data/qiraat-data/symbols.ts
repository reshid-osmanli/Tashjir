// رموز الرواة في التشجير الكلاسيكي
//
// تبقى هذه الخريطة هي البذرة المعتمدة للمصحف المشجّر. يمكن للمشرف تعديل
// الرمز في «لوحة التحكم»؛ عندئذ يُحفظ الرمز مع بيانات الراوي في الكتالوج
// المحلي ولا تُعدّل هذه البذرة.

/** رمز كل راوٍ في البذرة الافتراضية. */
export const DEFAULT_NARRATOR_SYMBOLS: Record<string, string> = {
  'narrator-qalun': 'ب',
  'narrator-warsh': 'ج',
  'narrator-al-bazzi': 'د',
  'narrator-qunbul': 'هـ',
  'narrator-al-duri-abu-amr': 'و',
  'narrator-al-susi': 'ز',
  'narrator-hisham': 'ح',
  'narrator-ibn-dhakwan': 'ط',
  // حفص هو وجه المصحف الافتراضي، ولذلك لا يحتاج إلى رمز في الوضع الكلاسيكي.
  'narrator-hafs': '',
  'narrator-shubah': 'ي',
  'narrator-khalaf-hamzah': 'ك',
  'narrator-khallad': 'ل',
  'narrator-al-layth': 'م',
  'narrator-al-duri-kisai': 'ن',
  'narrator-ibn-wardan': 'س',
  'narrator-ibn-jammaz': 'ع',
  'narrator-ruways': 'ف',
  'narrator-rawh': 'ص',
  'narrator-idris': 'ق',
  'narrator-ishaq': 'ر',
};

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

/**
 * رمز كل إمام في البذرة الافتراضية.
 *
 * الرمز للإمام ضرورة في التشجير لا زينة: إذا قرأ راويا الإمام بالوجه نفسه
 * فالصواب أن يُرمَز للإمام مرة واحدة، لا أن يُكرَّر رمزا راوييه. وكذلك إن
 * اجتمع طريقا الراوي رُمِز للراوي، وإن انفرد طريق ذُكر اسمه.
 *
 * الحروف هنا مختارة بحيث لا تصطدم برموز الرواة في البذرة (ب ج د هـ و ز ح ط
 * ي ك ل م ن س ع ف ص ق ر)، ويستطيع المشرف تغييرها كلها من لوحة التحكم.
 */
export const DEFAULT_IMAM_SYMBOLS: Record<string, string> = {
  'imam-nafi': 'أ',
  'imam-ibn-kathir': 'ت',
  'imam-abu-amr': 'ث',
  'imam-ibn-amir': 'خ',
  'imam-asim': 'ذ',
  'imam-hamzah': 'ض',
  'imam-al-kisai': 'ظ',
  'imam-abu-jafar': 'غ',
  'imam-yaqub': 'ش',
  'imam-khalaf': 'خل',
};

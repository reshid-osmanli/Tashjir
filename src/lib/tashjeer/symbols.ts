// رموز القراء في التشجير الكلاسيكي - Reader Symbols
// مشروع التشجير - نظام القراءات العشر
//
// في التشجير الكلاسيكي (المصحف المشجّر) يُختصر كل راوٍ برمزٍ واحد يُكتب
// تحت الكلمة المختلفة. النظام المعتمد هنا هو المتّبع في المصاحف المشجّرة:
//
//   قالون (نافع)      → ب        ورش (نافع)        → ج
//   البزي (ابن كثير)  → د        قنبل (ابن كثير)   → هـ
//   الدوري (أبو عمرو) → و        السوسي (أبو عمرو) → ز
//   هشام (ابن عامر)  → ح        ابن ذكوان (ابن عامر) → ط
//   شعبة (عاصم)      → ي        حفص (عاصم)        → (الأصل، بلا رمز)
//   خلف (حمزة)       → ك        خلاد (حمزة)       → ل
//   الليث (الكسائي)  → م        الدوري (الكسائي)  → ن
//   ابن وردان (أبو جعفر) → س    ابن جماز (أبو جعفر) → ع
//   رويس (يعقوب)     → ف        روح (يعقوب)       → ص
//   إدريس (خلف)      → ق        إسحاق (خلف)       → ر
//
// الرمز يدل على الراوي، والمجموعة المشتركة تُكتب رموزها مجتمعة.

import { NARRATORS } from '@/data/qiraat-data/qiraat';

/** رمز كل راوٍ حسب الترتيب المعتمد في التشجير الكلاسيكي. */
export const NARRATOR_SYMBOLS: Record<string, string> = {
  'narrator-qalun': 'ب',
  'narrator-warsh': 'ج',
  'narrator-al-bazzi': 'د',
  'narrator-qunbul': 'هـ',
  'narrator-al-duri-abu-amr': 'و',
  'narrator-al-susi': 'ز',
  'narrator-hisham': 'ح',
  'narrator-ibn-dhakwan': 'ط',
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

/** يرجع رمز الراوي، أو سلسلة فارغة إن كان هو الأصل (حفص). */
export function getNarratorSymbol(narratorId: string): string {
  return NARRATOR_SYMBOLS[narratorId] ?? '';
}

/** ترتيب الراوي في طيبة النشر (1..20)، أو 99 إن كان مجهولا. */
const tayyibahOrderById = new Map(
  NARRATORS.map((narrator) => [narrator.id, narrator.legacyOrderInTayyibah ?? 99])
);

export function narratorTayyibahOrder(narratorId: string): number {
  return tayyibahOrderById.get(narratorId) ?? 99;
}

/** أسماء القراء مرتّبة حسب طيبة النشر، مع رموزها، للوحة الرموز. */
export const NARRATORS_BY_TAYYIBAH = [...NARRATORS]
  .sort((a, b) => (a.legacyOrderInTayyibah ?? 99) - (b.legacyOrderInTayyibah ?? 99))
  .map((narrator) => ({
    id: narrator.id,
    name: narrator.name,
    symbol: getNarratorSymbol(narrator.id),
  }));

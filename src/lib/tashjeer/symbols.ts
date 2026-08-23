// رموز القراء في التشجير الكلاسيكي - Reader Symbols
//
// الرمز الافتراضي محفوظ في data/qiraat-data/symbols. عند تحرير الرمز من لوحة
// التحكم يمر الكتالوج إلى هذه الدوال، فيظهر الرمز الجديد في السطر وفي الدليل
// وفي ترتيب الرموز من دون الحاجة إلى تعديل مصدر المشروع.
//
// القاعدة الصارمة: Display Order ≠ Creation Order ≠ Name Order
// الترتيب يجب أن يكون Explicit Numeric Order من الحقل order نفسه.

import { NARRATORS } from '@/data/qiraat-data/qiraat';
import { DEFAULT_NARRATOR_SYMBOLS } from '@/data/qiraat-data/symbols';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import { narratorExplicitOrder } from './explicit-order';

/** اسم متوافق مع الإصدارات السابقة من المحرك. */
export const NARRATOR_SYMBOLS = DEFAULT_NARRATOR_SYMBOLS;

/** يرجع رمز الراوي، أو سلسلة فارغة إن كان هو الأصل (حفص في البذرة). */
export function getNarratorSymbol(narratorId: string, catalog?: TransmissionCatalog): string {
  const custom = catalog?.narrators.find((narrator) => narrator.id === narratorId)?.symbol;
  return custom ?? NARRATOR_SYMBOLS[narratorId] ?? '';
}

/** ترتيب الراوي في طيبة النشر (1..20)، أو 99 إن كان مجهولا. */
export function narratorTayyibahOrder(narratorId: string, catalog?: TransmissionCatalog): number {
  return narratorExplicitOrder(narratorId, catalog);
}

/** أسماء القراء مرتّبة حسب الترتيب الصريح، مع رموزها، للوحة الرموز. */
export function getNarratorsByTayyibah(catalog?: TransmissionCatalog): Array<{
  id: string;
  name: string;
  symbol: string;
}> {
  const narrators = catalog?.narrators ?? NARRATORS;
  return [...narrators]
    .sort((a, b) => narratorExplicitOrder(a.id, catalog) - narratorExplicitOrder(b.id, catalog))
    .map((narrator) => ({
      id: narrator.id,
      name: narrator.name,
      symbol: getNarratorSymbol(narrator.id, catalog),
    }));
}

/** ثابت توافق للواجهات التي لا تمرر كتالوجا. */
export const NARRATORS_BY_TAYYIBAH = getNarratorsByTayyibah();

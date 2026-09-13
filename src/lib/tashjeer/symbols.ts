// رموز القراء في التشجير الكلاسيكي - Reader Symbols
//
// الرمز الافتراضي محفوظ في data/qiraat-data/symbols. عند تحرير الرمز من لوحة
// التحكم يمر الكتالوج إلى هذه الدوال، فيظهر الرمز الجديد في السطر وفي الدليل
// وفي ترتيب الرموز من دون الحاجة إلى تعديل مصدر المشروع.
//
// **الرمز لا يحكم الترتيب.** ترتيب الظهور مصدره الوحيد الرقم الصريح في
// `lib/tashjeer/display-order`؛ فلو حكم الرمز أو الاسم الترتيب لتغير ظهور
// القراء بتحرير رمز أو إعادة تسمية (FR-ED-14).

import { NARRATORS } from '@/data/qiraat-data/qiraat';
import { DEFAULT_NARRATOR_SYMBOLS } from '@/data/qiraat-data/symbols';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import {
  displayOrderOfNarrator,
  sortNarratorsByDisplayOrder,
} from './display-order';

/** اسم متوافق مع الإصدارات السابقة من المحرك. */
export const NARRATOR_SYMBOLS = DEFAULT_NARRATOR_SYMBOLS;

/** يرجع رمز الراوي، أو سلسلة فارغة إن كان هو الأصل (حفص في البذرة). */
export function getNarratorSymbol(narratorId: string, catalog?: TransmissionCatalog): string {
  const custom = catalog?.narrators.find((narrator) => narrator.id === narratorId)?.symbol;
  return custom ?? NARRATOR_SYMBOLS[narratorId] ?? '';
}

/**
 * رقم الترتيب الصريح للراوي بين كل الرواة (١..ن)، أو ٩٩٩ إن كان مجهولا.
 *
 * هذا هو الرقم الذي يفرز به المحرك سطور الأمة ويرتب بطاقات الرموز. كان اسمه
 * «ترتيب الطيبة» حين كان ترتيب الطيبة هو المصدر الوحيد؛ وبقي الاسم القديم
 * أدناه للتوافق، أما الحاكم الآن فهو الرقم الصريح القابل للتعديل من لوحة
 * التحكم، وافتراضيه ترتيب الطيبة القائم.
 */
export function narratorDisplayOrder(narratorId: string, catalog?: TransmissionCatalog): number {
  return displayOrderOfNarrator(narratorId, catalog);
}

/** @deprecated الاسم القديم لـ`narratorDisplayOrder`؛ بقية للتوافق مع المحرك. */
export function narratorTayyibahOrder(narratorId: string, catalog?: TransmissionCatalog): number {
  return narratorDisplayOrder(narratorId, catalog);
}

/** أسماء الرواة مرتّبة بالرقم الصريح للظهور، مع رموزها، للوحة الرموز. */
export function getNarratorsByDisplayOrder(catalog?: TransmissionCatalog): Array<{
  id: string;
  name: string;
  symbol: string;
  /** الرقم الصريح نفسه، ليُطبع بجانب الاسم في اللوحات الإدارية. */
  order: number;
}> {
  const narrators = catalog?.narrators ?? NARRATORS;
  return sortNarratorsByDisplayOrder(narrators, catalog).map((narrator) => ({
    id: narrator.id,
    name: narrator.name,
    symbol: getNarratorSymbol(narrator.id, catalog),
    order: displayOrderOfNarrator(narrator.id, catalog),
  }));
}

/** @deprecated الاسم القديم لـ`getNarratorsByDisplayOrder`. */
export function getNarratorsByTayyibah(catalog?: TransmissionCatalog) {
  return getNarratorsByDisplayOrder(catalog);
}

/** ثابت توافق للواجهات التي لا تمرر كتالوجا. */
export const NARRATORS_BY_TAYYIBAH = getNarratorsByDisplayOrder();

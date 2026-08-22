// ترتيب صريح للقراء والرواة والطرق - Explicit Numeric Order
// مشروع التشجير - نظام القراءات العشر
//
// القاعدة الصارمة: Display Order ≠ Creation Order ≠ Name Order
// الترتيب يجب أن يكون Explicit Numeric Order من الحقل order نفسه.

import type { ReadingImam, Narrator, TransmissionPath } from '@/types';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import { READING_IMAMS, NARRATORS } from '@/data/qiraat-data/qiraat';

/**
 * رتبة الإمام الصريحة: من حقل order في الكتالوج، وإلا من البذرة، وإلا 999.
 */
export function imamExplicitOrder(imamId: string, catalog?: TransmissionCatalog): number {
  const imam =
    catalog?.imams.find((item) => item.id === imamId) ??
    READING_IMAMS.find((item) => item.id === imamId);
  return typeof imam?.order === 'number' && Number.isFinite(imam.order) ? imam.order : 999;
}

/**
 * رتبة الراوي الصريحة: ترتيب إمامه * 100 + ترتيبه داخل الإمام.
 * هذا يضمن أن رواة الإمام يبقون متجاورين، وترتيب الأئمة يسبق ترتيب الرواة.
 */
export function narratorExplicitOrder(narratorId: string, catalog?: TransmissionCatalog): number {
  const narrator =
    catalog?.narrators.find((item) => item.id === narratorId) ??
    NARRATORS.find((item) => item.id === narratorId);
  if (!narrator) return 99999;
  const imamOrder = imamExplicitOrder(narrator.imamId, catalog);
  const ownOrder = typeof narrator.order === 'number' ? narrator.order : 99;
  // legacyOrderInTayyibah يبقى مرجعا ثانويا عند تساوي الرتبة الصريحة.
  const tayyibah = typeof narrator.legacyOrderInTayyibah === 'number' ? narrator.legacyOrderInTayyibah : 99;
  return imamOrder * 1000 + ownOrder * 10 + tayyibah * 0.01;
}

/**
 * رتبة الطريق الصريحة: رتبة راويه + ترتيبه داخل الراوي.
 */
export function pathExplicitOrder(pathId: string, catalog?: TransmissionCatalog): number {
  const path = catalog?.paths.find((item) => item.id === pathId);
  if (!path) return 999999;
  const narratorOrder = narratorExplicitOrder(path.narratorId, catalog);
  const ownOrder = typeof path.order === 'number' ? path.order : 99;
  return narratorOrder * 1000 + ownOrder;
}

/**
 * مقارنة راويين حسب الترتيب الصريح، لا حسب الاسم ولا تاريخ الإنشاء.
 */
export function compareNarratorsByExplicitOrder(
  a: string,
  b: string,
  catalog?: TransmissionCatalog
): number {
  const diff = narratorExplicitOrder(a, catalog) - narratorExplicitOrder(b, catalog);
  if (diff !== 0) return diff;
  return a.localeCompare(b, 'ar');
}

/**
 * مقارنة طريقين حسب الترتيب الصريح.
 */
export function comparePathsByExplicitOrder(
  a: string,
  b: string,
  catalog?: TransmissionCatalog
): number {
  const diff = pathExplicitOrder(a, catalog) - pathExplicitOrder(b, catalog);
  if (diff !== 0) return diff;
  return a.localeCompare(b, 'ar');
}

/**
 * ترتيب مصفوفة رواة حسب الترتيب الصريح.
 */
export function sortNarratorIdsExplicit(
  ids: string[],
  catalog?: TransmissionCatalog
): string[] {
  return [...ids].sort((a, b) => compareNarratorsByExplicitOrder(a, b, catalog));
}

/**
 * ترتيب مصفوفة طرق حسب الترتيب الصريح.
 */
export function sortPathIdsExplicit(ids: string[], catalog?: TransmissionCatalog): string[] {
  return [...ids].sort((a, b) => comparePathsByExplicitOrder(a, b, catalog));
}

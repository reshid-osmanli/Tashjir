// الترتيب الصريح للظهور - Explicit Display Order (FR-ED-14، DM-04، DM-17)
//
// ============================ لماذا هذا الملف؟ ============================
//
// الشكوى التي يعالجها: «عند تعديل رموز القراء أو الرواة أو الطرق من الإعدادات
// يتغير ترتيب ظهورهم عشوائيا بحسب الاسم أو ترتيب الإدخال أو تاريخ الإضافة».
//
// السبب التاريخي في هذا المشروع أن ترتيب الظهور كان مشتتا على ثلاث قيم:
//
//   1. `Narrator.legacyOrderInTayyibah` — ترتيب الطيبة، وكان الحاكم الفعلي.
//   2. `Narrator.order` — وكان يعني «ترتيبه داخل إمامه» (١ أو ٢).
//   3. كسر تعادل بالاسم `name.localeCompare(...)` في كل دوال الفرز.
//
// والثالثة هي أخطرهن: عند تساوي رقمين كان **الاسم** يحسم، فتغيير اسم قارئ من
// «عاصم» إلى «زميل عاصم» كان يقلب موضعه. وهذا منفيّ صراحة في المتطلب:
// Display Order ≠ Creation Order ≠ Name Order.
//
// القاعدة المعتمدة الآن، ومصدرها الوحيد هذا الملف:
//
//   • كل كيان له **رقم صريح واحد** محفوظ في حقل `order` (هو displayOrder).
//   • أقران الإمام = كل الأئمة. أقران الراوي = **كل الرواة** (لا رواة إمامه).
//     أقران الطريق = طرق راويه.
//   • الفرز دائمًا: الرقم الصريح تصاعديا، ثم **المعرّف** أبجديًا لكسر التعادل
//     (حتمي ولا يتأثر بالاسم ولا بالرمز ولا بتاريخ الإضافة).
//   • ترتيب الأسطر (`Line.order`/`orderRank`) شيء آخر مستقل تمامًا: هذا الملف
//     يحكم ترتيب **الظهور البشري** للرموز والكتالوج فقط.
//
// أي واجهة أو محرك يحتاج ترتيب قارئ/راوٍ/طريق يقرأ من هنا، فلا يعود هناك
// ترتيبان مختلفان لبيانة واحدة.

import { NARRATORS, READING_IMAMS, TRANSMISSION_PATH_SEEDS } from '@/data/qiraat-data/qiraat';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import type { Narrator, ReadingImam, TransmissionPath } from '@/types';
import type { ReadingUnit } from './reader-symbols';

/** نوع الكيان الذي له رقم ترتيب صريح. */
export type DisplayOrderKind = 'IMAM' | 'NARRATOR' | 'PATH';

/**
 * رقم يُعطى لمن لا رقم له (كيان مجهول أو محذوف من الكتالوج).
 *
 * كبير بما يكفي ليأتي المجهول آخرًا، وثابت حتى يبقى الناتج حتميا.
 */
export const UNKNOWN_DISPLAY_ORDER = 999;

/**
 * سماحة كسر التعادل بين طرق الراوي الواحد.
 *
 * مفتاح الطريق = ترتيب راويه + كسر من ترتيب الطريق، فيبقى الأزرق قبل
 * الأصبهاني داخل ورش، ولا يتجاوز طريقٌ راويًا يليه (لأن الكسر < ١).
 */
const PATH_FRACTION_SPAN = 0.9;

// ============================ القراءة ============================

interface OrderContext {
  imams: readonly ReadingImam[];
  narrators: readonly Narrator[];
  paths: readonly TransmissionPath[];
}

/**
 * سياق الأرقام: الكتالوج الممرَّر إن وُجد، وإلا بذرة المشروع.
 *
 * البذرة نفسها تحمل أرقاما صريحة (١..٢٠ للرواة)، فلا يختلف الناتج بين
 * «بلا كتالوج» و«كتالوج افتراضي» — وهذا شرط الحتمية في الاختبارات.
 */
export function orderContext(catalog?: TransmissionCatalog | null): OrderContext {
  return {
    imams: catalog?.imams ?? READING_IMAMS,
    narrators: catalog?.narrators ?? NARRATORS,
    paths: catalog?.paths ?? TRANSMISSION_PATH_SEEDS,
  };
}

/** الرقم الصريح للإمام، أو `UNKNOWN_DISPLAY_ORDER` إن كان مجهولا. */
export function displayOrderOfImam(imamId: string, catalog?: TransmissionCatalog | null): number {
  const imam = orderContext(catalog).imams.find((item) => item.id === imamId);
  return explicitOrderOf(imam);
}

/**
 * الرقم الصريح للراوي بين **كل الرواة**، أو `UNKNOWN_DISPLAY_ORDER` إن كان مجهولا.
 *
 * عند غياب الرقم (بيانات قديمة جدًا لم تمر على التطبيع) يسقط إلى ترتيب الطيبة
 * التاريخي، فالافتراضي الموثق هو «ترتيب الطيبة القائم».
 */
export function displayOrderOfNarrator(
  narratorId: string,
  catalog?: TransmissionCatalog | null
): number {
  const narrator = orderContext(catalog).narrators.find((item) => item.id === narratorId);
  if (!narrator) return UNKNOWN_DISPLAY_ORDER;
  const explicit = explicitOrderOf(narrator);
  if (explicit !== UNKNOWN_DISPLAY_ORDER) return explicit;
  return positiveOr(narrator.legacyOrderInTayyibah, UNKNOWN_DISPLAY_ORDER);
}

/** الرقم الصريح للطريق بين طرق راويه، أو `UNKNOWN_DISPLAY_ORDER` إن كان مجهولا. */
export function displayOrderOfPath(pathId: string, catalog?: TransmissionCatalog | null): number {
  const path = orderContext(catalog).paths.find((item) => item.id === pathId);
  return explicitOrderOf(path);
}

/**
 * مفتاح الترتيب العام للطريق: ترتيب راويه الصريح ثم كسر ترتيب الطريق.
 *
 * هذا هو الرقم الذي تُفرَز به بطاقات الطرق على السطر، فيظهر طريق ورش قبل
 * إمام عاصم لأن **راويه** قبله، لا لأن اسم الطريق أقصر أو أبجديًا أسبق.
 */
export function pathDisplayKey(pathId: string, catalog?: TransmissionCatalog | null): number {
  const ctx = orderContext(catalog);
  const path = ctx.paths.find((item) => item.id === pathId);
  if (!path) return UNKNOWN_DISPLAY_ORDER;

  const base = displayOrderOfNarrator(path.narratorId, catalog);
  const siblings = pathsOfNarratorSorted(path.narratorId, catalog);
  const index = siblings.findIndex((item) => item.id === pathId);
  if (index === -1 || siblings.length === 0) return base;

  return base + ((index + 1) / (siblings.length + 1)) * PATH_FRACTION_SPAN;
}

/**
 * مفتاح الترتيب العام لوحدة قراءة (راوٍ كامل أو طريق بعينه).
 *
 * مصدر واحد لترتيب الأمة يستعمله محرك التركيب وبطاقات الرموز معًا، فلا
 * يختلف ترتيب السطور عن ترتيب البطاقات المطبوعة في طرفها.
 */
export function readingUnitDisplayOrder(
  unit: ReadingUnit,
  catalog?: TransmissionCatalog | null
): number {
  if (!unit.pathId) return displayOrderOfNarrator(unit.narratorId, catalog);
  return pathDisplayKey(unit.pathId, catalog);
}

/**
 * ترتيب بطاقة إمام: أصغر الأرقام الصريحة لرواته.
 *
 * البطاقة المختصرة لإمام تحل محل بطاقتي رواته، فتأخذ موضع أولهما، وبذلك يبقى
 * الاختصار في مكانه البصري ولا يقفز الإمام إلى آخر السطر.
 *
 * يُقاس بمقياس **الرواة** وحدهم (لا برقم الإمام بين الأئمة) لأن بطاقات السطر
 * كلها تُفرَز في سلم واحد؛ فلو خلطنا مقياس الأئمة (١..١٠) بمقياس الرواة
 * (١..٢٠) لتغير ترتيب البطاقات بتغيير لا علاقة له بالظهور.
 */
export function imamChipDisplayOrder(
  imamId: string,
  narratorIds: readonly string[],
  catalog?: TransmissionCatalog | null
): number {
  const ctx = orderContext(catalog);
  const related = ctx.narrators.filter(
    (narrator) => narrator.imamId === imamId || narratorIds.includes(narrator.id)
  );
  if (related.length === 0) return UNKNOWN_DISPLAY_ORDER;
  return Math.min(...related.map((narrator) => displayOrderOfNarrator(narrator.id, catalog)));
}

// ============================ الفرز ============================

/**
 * المقارنة المعتمدة بين رقمين صريحين مع كسر تعادل **بالمعرّف**.
 *
 * لا اسم ولا رمز ولا تاريخ إضافة: المعرّف ثابت لا يتغير بإعادة التسمية، فيبقى
 * الترتيب حتميا عبر إعادة التحميل والتصدير والاستيراد.
 */
export function compareExplicitOrder(
  first: { id: string; order: number },
  second: { id: string; order: number }
): number {
  if (first.order !== second.order) return first.order - second.order;
  return first.id.localeCompare(second.id);
}

/** الأئمة مرتبين بالرقم الصريح. */
export function sortImamsByDisplayOrder(
  imams: readonly ReadingImam[],
  catalog?: TransmissionCatalog | null
): ReadingImam[] {
  return [...imams].sort(
    (first, second) =>
      displayOrderOfImam(first.id, catalog) - displayOrderOfImam(second.id, catalog) ||
      first.id.localeCompare(second.id)
  );
}

/** الرواة مرتبين بالرقم الصريح. */
export function sortNarratorsByDisplayOrder(
  narrators: readonly Narrator[],
  catalog?: TransmissionCatalog | null
): Narrator[] {
  return [...narrators].sort(
    (first, second) =>
      displayOrderOfNarrator(first.id, catalog) - displayOrderOfNarrator(second.id, catalog) ||
      first.id.localeCompare(second.id)
  );
}

/** الطرق مرتبة بالرقم الصريح داخل راويها. */
export function sortPathsByDisplayOrder(
  paths: readonly TransmissionPath[],
  catalog?: TransmissionCatalog | null
): TransmissionPath[] {
  return [...paths].sort(
    (first, second) =>
      displayOrderOfPath(first.id, catalog) - displayOrderOfPath(second.id, catalog) ||
      first.id.localeCompare(second.id)
  );
}

/** كل طرق راوٍ مرتبة بالرقم الصريح. */
export function pathsOfNarratorSorted(
  narratorId: string,
  catalog?: TransmissionCatalog | null
): TransmissionPath[] {
  return sortPathsByDisplayOrder(
    orderContext(catalog).paths.filter((path) => path.narratorId === narratorId),
    catalog
  );
}

/** ترتيب قائمة معرّفات رواة بالرقم الصريح (مستعمل في النطاقات والتركيب). */
export function sortNarratorIds(
  narratorIds: readonly string[],
  catalog?: TransmissionCatalog | null
): string[] {
  return [...narratorIds].sort(
    (first, second) =>
      displayOrderOfNarrator(first, catalog) - displayOrderOfNarrator(second, catalog) ||
      first.localeCompare(second)
  );
}

/**
 * هل الرقم الصريح هو الحاكم؟ فحص دفاعي يستعمله الاختبار الحتمي.
 *
 * يعيد `true` إن كانت القائمة مرتبة فعليًا بالرقم الصريح والمعرّف.
 */
export function isSortedByDisplayOrder(
  items: readonly { id: string; order: number }[]
): boolean {
  for (let index = 1; index < items.length; index += 1) {
    if (compareExplicitOrder(items[index - 1], items[index]) > 0) return false;
  }
  return true;
}

// ============================ التعارضات (DM-04) ============================

/** تعارض رقم ترتيب صريح: رقمان متساويان في مجموعة أقران واحدة. */
export interface DisplayOrderConflict {
  kind: DisplayOrderKind;
  /** معرّف مجموعة الأقران: فارغ للأئمة والرواة، ومعرّف الراوي للطرق. */
  group: string;
  /** الرقم المتنازَع عليه. */
  order: number;
  /** المعرّفات التي تشغله، مرتبة أبجديًا (الأصغر أولًا = الفائز الحتمي). */
  ids: string[];
}

/**
 * يفحص الأرقام الصريحة في كتالوج **خام** (قبل التطبيع) ويعيد تعارضاته.
 *
 * يُستعمل لعرض التحذير في لوحة التحكم وعند الاستيراد: التطبيع يصلح التعارض
 * حتميا، لكن المستخدم يجب أن يرى أن تصحيحًا تلقائيًا وقع.
 */
export function detectDisplayOrderConflicts(
  catalog: Pick<Partial<TransmissionCatalog>, 'imams' | 'narrators' | 'paths'> | null | undefined
): DisplayOrderConflict[] {
  const conflicts: DisplayOrderConflict[] = [
    ...conflictsAmong('IMAM', '', catalog?.imams ?? []),
    ...conflictsAmong('NARRATOR', '', catalog?.narrators ?? []),
  ];

  const pathsByNarrator = new Map<string, Array<{ id: string; order: number }>>();
  for (const path of catalog?.paths ?? []) {
    if (!path?.id) continue;
    const group = path.narratorId ?? '';
    const list = pathsByNarrator.get(group) ?? [];
    list.push({ id: path.id, order: positiveOr(path.order, UNKNOWN_DISPLAY_ORDER) });
    pathsByNarrator.set(group, list);
  }
  for (const [group, peers] of pathsByNarrator) {
    conflicts.push(...conflictsAmong('PATH', group, peers));
  }

  return conflicts.sort(
    (first, second) =>
      first.kind.localeCompare(second.kind) ||
      first.group.localeCompare(second.group) ||
      first.order - second.order
  );
}

/**
 * يفضّ التعارضات حتميا: فرز بـ(الرقم، ثم المعرّف الأبجدي) وإعادة ترقيم ١..ن.
 *
 * القرار المحسوم سلفًا: «الأصغر معرفًا (بالترتيب الأبجدي للـID) أولاً». لا
 * يُعاد الترقيم إن لم يكن ثمة تعارض، فتبقى الأرقام كما وضعها المشرف (بما فيها
 * الفجوات المقصودة) وتبقى مراجع الكائنات غير المتغيرة كما هي.
 */
export function resolveDisplayOrderConflicts<T extends { id: string; order: number }>(
  peers: readonly T[]
): T[] {
  const seen = new Set<number>();
  let duplicated = false;
  for (const peer of peers) {
    const order = positiveOr(peer.order, UNKNOWN_DISPLAY_ORDER);
    if (seen.has(order)) {
      duplicated = true;
      break;
    }
    seen.add(order);
  }
  if (!duplicated) return [...peers];

  return [...peers]
    .sort((first, second) => compareExplicitOrder(first, second))
    .map((peer, index) => (peer.order === index + 1 ? peer : { ...peer, order: index + 1 }));
}

/** وصف عربي للتعارضات، يُعرض في التحذيرات. */
export function describeDisplayOrderConflicts(conflicts: DisplayOrderConflict[]): string {
  if (conflicts.length === 0) return '';
  return conflicts
    .map((conflict) => {
      const kindLabel =
        conflict.kind === 'IMAM' ? 'قارئ' : conflict.kind === 'NARRATOR' ? 'راوٍ' : 'طريق';
      return `${kindLabel} بالرقم ${conflict.order}: ${conflict.ids.join('، ')}`;
    })
    .join(' | ');
}

// ============================ أدوات داخلية ============================

function conflictsAmong(
  kind: DisplayOrderKind,
  group: string,
  peers: readonly { id: string; order?: number }[]
): DisplayOrderConflict[] {
  const byOrder = new Map<number, string[]>();
  for (const peer of peers) {
    if (!peer?.id) continue;
    const order = positiveOr(peer.order, UNKNOWN_DISPLAY_ORDER);
    const list = byOrder.get(order) ?? [];
    list.push(peer.id);
    byOrder.set(order, list);
  }

  const conflicts: DisplayOrderConflict[] = [];
  for (const [order, ids] of byOrder) {
    if (ids.length < 2) continue;
    conflicts.push({ kind, group, order, ids: [...ids].sort((a, b) => a.localeCompare(b)) });
  }
  return conflicts;
}

/** الرقم الصريح إن كان عددًا موجبًا صالحًا، وإلا رقم المجهول. */
function explicitOrderOf(item: { order?: number } | undefined): number {
  return positiveOr(item?.order, UNKNOWN_DISPLAY_ORDER);
}

function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

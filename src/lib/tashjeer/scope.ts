// محلّل النطاقات - Reading Scope Resolver
// مشروع التشجير - نظام القراءات العشر
//
// المشكلة التي يحلها هذا الملف:
//   الحكم القرائي الواحد قد يقرأ به راو واحد، وقد يقرأ به تسعة عشر راويا،
//   وقد يقرأ به إمام بكل رواته. تخزين الحكم مكررا لكل راو خطأ منهجي وتقني:
//   يضخّم البيانات، ويجعل التصحيح في موضع واحد لا ينعكس على البقية.
//
// الحل:
//   نخزّن الحكم مرة واحدة، ومعه تعبير نطاق (ReadingScope). هذا الملف يحوّل
//   التعبير إلى قائمة رواة صريحة عند الحاجة فقط (وقت العرض أو التحقق).
//
// أمثلة:
//   { kind: 'ALL' }                                   → الرواة العشرون
//   { kind: 'ALL_EXCEPT', narratorIds: ['hafs'] }     → تسعة عشر راويا
//   { kind: 'IMAMS', imamIds: ['imam-asim'] }         → حفص وشعبة
//   { kind: 'NARRATORS', narratorIds: [...] }         → قائمة صريحة

import { NARRATORS, READING_IMAMS, TRANSMISSION_PATH_SEEDS } from '@/data/qiraat-data/qiraat';
import type { ReadingScope } from '@/types/tashjeer';

/** كل معرّفات الرواة مرتبة حسب ترتيب طيبة النشر. */
export const ALL_NARRATOR_IDS: string[] = [...NARRATORS]
  .sort((a, b) => (a.legacyOrderInTayyibah ?? 0) - (b.legacyOrderInTayyibah ?? 0))
  .map((narrator) => narrator.id);

const narratorById = new Map(NARRATORS.map((narrator) => [narrator.id, narrator]));
const imamById = new Map(READING_IMAMS.map((imam) => [imam.id, imam]));
const pathById = new Map(TRANSMISSION_PATH_SEEDS.map((path) => [path.id, path]));

/**
 * يحوّل تعبير النطاق إلى قائمة معرّفات رواة، مرتبة حسب طيبة النشر وبلا تكرار.
 *
 * @param scope تعبير النطاق
 * @returns قائمة معرّفات الرواة المشمولين
 */
export function resolveScope(scope: ReadingScope): string[] {
  switch (scope.kind) {
    case 'ALL':
      return [...ALL_NARRATOR_IDS];

    case 'ALL_EXCEPT': {
      const excluded = new Set(scope.narratorIds ?? []);
      return ALL_NARRATOR_IDS.filter((id) => !excluded.has(id));
    }

    case 'NARRATORS':
      return sortByTayyibah(unique(scope.narratorIds ?? []).filter((id) => narratorById.has(id)));

    case 'IMAMS': {
      const imamIds = new Set(scope.imamIds ?? []);
      return ALL_NARRATOR_IDS.filter((id) => imamIds.has(narratorById.get(id)?.imamId ?? ''));
    }

    case 'PATHS': {
      const narratorIds = (scope.pathIds ?? [])
        .map((pathId) => pathById.get(pathId)?.narratorId)
        .filter((value): value is string => Boolean(value));
      return sortByTayyibah(unique(narratorIds));
    }

    default:
      return [];
  }
}

/** عدد الرواة الذين يشملهم النطاق. */
export function scopeSize(scope: ReadingScope): number {
  return resolveScope(scope).length;
}

/** هل يشمل النطاق راويا معينا؟ */
export function scopeIncludes(scope: ReadingScope, narratorId: string): boolean {
  return resolveScope(scope).includes(narratorId);
}

/** هل يتقاطع نطاقان؟ يُستخدم لكشف تعارض الأوجه في الاختلاف الواحد. */
export function scopesOverlap(a: ReadingScope, b: ReadingScope): boolean {
  const first = new Set(resolveScope(a));
  return resolveScope(b).some((id) => first.has(id));
}

/**
 * يبني وصفا عربيا مختصرا للنطاق، صالحا للعرض على بطاقة الوجه.
 *
 * القاعدة:
 *   - النطاق العام  → "الجميع"
 *   - الاستثناء     → "الجميع إلا فلانا"
 *   - إمام كامل     → اسم الإمام مع كلمة "بكماله"
 *   - راو أو راويان → أسماء الرواة
 *   - أكثر من ثلاثة → أول اسمين ثم "و N آخرين"
 */
export function describeScope(scope: ReadingScope, options?: { short?: boolean }): string {
  const short = options?.short ?? false;
  const narratorIds = resolveScope(scope);

  if (narratorIds.length === 0) return 'لا أحد';
  if (narratorIds.length === ALL_NARRATOR_IDS.length) return 'الجميع';

  if (scope.kind === 'ALL_EXCEPT' && scope.narratorIds?.length) {
    const excludedNames = scope.narratorIds.map(getNarratorName);
    return `الجميع إلا ${joinArabic(excludedNames)}`;
  }

  if (scope.kind === 'PATHS' && scope.pathIds?.length) {
    const pathNames = scope.pathIds.map(formatPathName);
    return joinArabic(pathNames);
  }

  // هل تغطي المجموعة أئمة كاملين؟ عندها الوصف بالإمام أدق وأقصر.
  const coverage = findFullyCoveredImams(narratorIds);
  if (coverage.imamIds.length > 0 && coverage.coveredNarrators === narratorIds.length) {
    const names = coverage.imamIds.map((imamId) => imamById.get(imamId)?.name ?? imamId);
    return names.length === 1 ? `${names[0]} بكماله` : joinArabic(names);
  }

  const names = narratorIds.map(getNarratorName);
  // في الوضع المختصر نكتفي باسمين ثم نشير إلى العدد الباقي،
  // حتى لا تتضخم بطاقة الوجه على اللوحة.
  if (!short || names.length <= 2) return joinArabic(names);

  return `${names[0]} و${names[1]} و${names.length - 2} آخرين`;
}

/** اسم الطريق منسوبًا لراويه، مثل: الأزرق عن ورش */
export function formatPathName(pathId: string): string {
  const path = pathById.get(pathId);
  if (!path) return pathId;
  const parts = path.shortName.split(' / ');
  if (parts.length === 2) {
    return `${parts[1]} عن ${parts[0]}`;
  }
  return path.shortName;
}

/** اسم الراوي بالعربية، مع اسم إمامه للتمييز عند تكرار الاسم (الدوري). */
export function getNarratorName(narratorId: string): string {
  const narrator = narratorById.get(narratorId);
  if (!narrator) return narratorId;

  const duplicated = NARRATORS.filter((item) => item.name === narrator.name).length > 1;
  if (!duplicated) return narrator.name;

  const imam = imamById.get(narrator.imamId);
  return imam ? `${narrator.name} (${imam.name})` : narrator.name;
}

/** اسم الراوي مع صيغة "عن إمامه". */
export function getFullNarratorName(narratorId: string): string {
  const narrator = narratorById.get(narratorId);
  if (!narrator) return narratorId;

  const imam = imamById.get(narrator.imamId);
  return imam ? `${narrator.name} عن ${imam.name}` : narrator.name;
}

/** ترتيب الراوي في طيبة النشر (1..20)، أو 999 إن كان غير معروف. */
export function getNarratorOrder(narratorId: string): number {
  return narratorById.get(narratorId)?.legacyOrderInTayyibah ?? 999;
}

/**
 * يبني نطاقا مكمّلا: كل من لم يشمله النطاق المعطى.
 * يُستخدم لتوليد وجه الأساس تلقائيا عند إضافة وجه جديد.
 */
export function complementScope(scope: ReadingScope): ReadingScope {
  const included = new Set(resolveScope(scope));
  const rest = ALL_NARRATOR_IDS.filter((id) => !included.has(id));

  if (rest.length === ALL_NARRATOR_IDS.length) return { kind: 'ALL' };
  if (included.size <= rest.length) {
    return { kind: 'ALL_EXCEPT', narratorIds: [...included] };
  }

  return { kind: 'NARRATORS', narratorIds: rest };
}

/**
 * يختصر قائمة رواة إلى أبسط تعبير نطاق ممكن.
 * الهدف: تخزين "IMAMS: عاصم" بدل "NARRATORS: حفص، شعبة".
 */
export function normalizeScope(narratorIds: string[]): ReadingScope {
  const ids = sortByTayyibah(unique(narratorIds.filter((id) => narratorById.has(id))));

  if (ids.length === 0) return { kind: 'NARRATORS', narratorIds: [] };
  if (ids.length === ALL_NARRATOR_IDS.length) return { kind: 'ALL' };

  const coverage = findFullyCoveredImams(ids);
  if (coverage.imamIds.length > 0 && coverage.coveredNarrators === ids.length) {
    return { kind: 'IMAMS', imamIds: coverage.imamIds };
  }

  // إن كان المستثنون أقل عددا، فالتعبير بالاستثناء أوضح وأقصر.
  const excluded = ALL_NARRATOR_IDS.filter((id) => !ids.includes(id));
  if (excluded.length > 0 && excluded.length < ids.length / 2) {
    return { kind: 'ALL_EXCEPT', narratorIds: excluded };
  }

  return { kind: 'NARRATORS', narratorIds: ids };
}

// ==================== دوال داخلية ====================

/**
 * يجد الأئمة الذين شُمل كل رواتهم في القائمة.
 *
 * @returns معرّفات هؤلاء الأئمة، وعدد الرواة الذين غطّوهم.
 *          مقارنة `coveredNarrators` بطول القائمة تكشف هل المجموعة
 *          كلها أئمة كاملون أم فيها رواة متفرقون.
 */
function findFullyCoveredImams(narratorIds: string[]): {
  imamIds: string[];
  coveredNarrators: number;
} {
  const set = new Set(narratorIds);
  const imamIds: string[] = [];
  let coveredNarrators = 0;

  for (const imam of READING_IMAMS) {
    const imamNarrators = NARRATORS.filter((narrator) => narrator.imamId === imam.id);
    if (imamNarrators.length > 0 && imamNarrators.every((narrator) => set.has(narrator.id))) {
      imamIds.push(imam.id);
      coveredNarrators += imamNarrators.length;
    }
  }

  return { imamIds, coveredNarrators };
}

function sortByTayyibah(ids: string[]): string[] {
  return [...ids].sort((a, b) => getNarratorOrder(a) - getNarratorOrder(b));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function joinArabic(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join('، ')} و${names[names.length - 1]}`;
}

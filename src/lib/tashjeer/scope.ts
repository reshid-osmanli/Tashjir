// محلّل النطاقات - Reading Scope Resolver
//
// الحكم القرائي يخزّن مرة واحدة مع نطاقه، ثم يحوله هذا الملف إلى رواة صرحاء
// وقت الرسم أو التدقيق. يقبل كل تابع كتالوجا اختياريا حتى تعمل الإضافات التي
// يجريها المشرف (قارئ/راو/طريق) فورا في المحرر، مع بقاء البذرة الافتراضية
// متوافقة مع الاختبارات والاستيراد القديم.

import { NARRATORS, READING_IMAMS, TRANSMISSION_PATH_SEEDS } from '@/data/qiraat-data/qiraat';
import type { Narrator, ReadingImam, TransmissionPath } from '@/types';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import type { ReadingScope } from '@/types/tashjeer';

/** كل معرّفات الرواة في البذرة مرتبة حسب ترتيب طيبة النشر. */
export const ALL_NARRATOR_IDS: string[] = [...NARRATORS]
  .sort((a, b) => (a.legacyOrderInTayyibah ?? 0) - (b.legacyOrderInTayyibah ?? 0))
  .map((narrator) => narrator.id);

/** كل معرّفات الرواة في الكتالوج الذي يعمل عليه المحرك. */
export function allNarratorIds(catalog?: TransmissionCatalog): string[] {
  return [...(catalog?.narrators ?? NARRATORS)]
    .sort(
      (a, b) =>
        (a.legacyOrderInTayyibah ?? 999) - (b.legacyOrderInTayyibah ?? 999) ||
        a.order - b.order ||
        a.name.localeCompare(b.name, 'ar')
    )
    .map((narrator) => narrator.id);
}

/** يحوّل تعبير النطاق إلى قائمة رواة صريحة مرتبة وبلا تكرار. */
export function resolveScope(scope: ReadingScope, catalog?: TransmissionCatalog): string[] {
  const context = makeContext(catalog);

  switch (scope.kind) {
    case 'ALL':
      return [...context.narratorIds];

    case 'ALL_EXCEPT': {
      const excluded = new Set(scope.narratorIds ?? []);
      return context.narratorIds.filter((id) => !excluded.has(id));
    }

    case 'NARRATORS':
      return sortByTayyibah(
        unique(scope.narratorIds ?? []).filter((id) => context.narratorById.has(id)),
        context
      );

    case 'IMAMS': {
      const imamIds = new Set(scope.imamIds ?? []);
      return context.narratorIds.filter((id) => imamIds.has(context.narratorById.get(id)?.imamId ?? ''));
    }

    case 'PATHS': {
      const narratorIds = (scope.pathIds ?? [])
        .map((pathId) => context.pathById.get(pathId)?.narratorId)
        .filter((value): value is string => Boolean(value));
      return sortByTayyibah(unique(narratorIds), context);
    }

    default:
      return [];
  }
}

/** عدد الرواة الذين يشملهم النطاق. */
export function scopeSize(scope: ReadingScope, catalog?: TransmissionCatalog): number {
  return resolveScope(scope, catalog).length;
}

/** هل يشمل النطاق راويا معينا؟ */
export function scopeIncludes(
  scope: ReadingScope,
  narratorId: string,
  catalog?: TransmissionCatalog
): boolean {
  return resolveScope(scope, catalog).includes(narratorId);
}

/** هل يتقاطع نطاقان؟ يُستخدم لكشف تعارض الأوجه في الاختلاف الواحد. */
export function scopesOverlap(
  firstScope: ReadingScope,
  secondScope: ReadingScope,
  catalog?: TransmissionCatalog
): boolean {
  const first = new Set(resolveScope(firstScope, catalog));
  return resolveScope(secondScope, catalog).some((id) => first.has(id));
}

/** يبني وصفا عربيا مختصرا للنطاق، صالحا للعرض على بطاقة الوجه. */
export function describeScope(
  scope: ReadingScope,
  options?: { short?: boolean; catalog?: TransmissionCatalog }
): string {
  const short = options?.short ?? false;
  const context = makeContext(options?.catalog);
  const narratorIds = resolveScope(scope, options?.catalog);

  if (narratorIds.length === 0) return 'لا أحد';
  if (narratorIds.length === context.narratorIds.length) return 'الجميع';

  if (scope.kind === 'ALL_EXCEPT' && scope.narratorIds?.length) {
    const excludedNames = scope.narratorIds.map((id) => getNarratorName(id, options?.catalog));
    return `الجميع إلا ${joinArabic(excludedNames)}`;
  }

  if (scope.kind === 'PATHS' && scope.pathIds?.length) {
    const pathNames = scope.pathIds.map((id) => formatPathName(id, options?.catalog));
    return joinArabic(pathNames);
  }

  // هل تغطي المجموعة أئمة كاملين؟ عندها الوصف بالإمام أدق وأقصر.
  const coverage = findFullyCoveredImams(narratorIds, context);
  if (coverage.imamIds.length > 0 && coverage.coveredNarrators === narratorIds.length) {
    const names = coverage.imamIds.map((imamId) => context.imamById.get(imamId)?.name ?? imamId);
    return names.length === 1 ? `${names[0]} بكماله` : joinArabic(names);
  }

  const names = narratorIds.map((id) => getNarratorName(id, options?.catalog));
  if (!short || names.length <= 2) return joinArabic(names);

  return `${names[0]} و${names[1]} و${names.length - 2} آخرين`;
}

/** اسم الطريق منسوبًا لراويه، مثل: الأزرق عن ورش */
export function formatPathName(pathId: string, catalog?: TransmissionCatalog): string {
  const context = makeContext(catalog);
  const path = context.pathById.get(pathId);
  if (!path) return pathId;

  const parts = path.shortName.split(' / ');
  if (parts.length === 2) return `${parts[1]} عن ${parts[0]}`;

  const narrator = context.narratorById.get(path.narratorId);
  return narrator ? `${path.shortName} عن ${narrator.name}` : path.shortName;
}

/** اسم الراوي، مع اسم إمامه للتمييز عند تكرار الاسم (الدوري). */
export function getNarratorName(narratorId: string, catalog?: TransmissionCatalog): string {
  const context = makeContext(catalog);
  const narrator = context.narratorById.get(narratorId);
  if (!narrator) return narratorId;

  const duplicated = context.narrators.filter((item) => item.name === narrator.name).length > 1;
  if (!duplicated) return narrator.name;

  const imam = context.imamById.get(narrator.imamId);
  return imam ? `${narrator.name} (${imam.name})` : narrator.name;
}

/** اسم الراوي مع صيغة «عن إمامه». */
export function getFullNarratorName(narratorId: string, catalog?: TransmissionCatalog): string {
  const context = makeContext(catalog);
  const narrator = context.narratorById.get(narratorId);
  if (!narrator) return narratorId;

  const imam = context.imamById.get(narrator.imamId);
  return imam ? `${narrator.name} عن ${imam.name}` : narrator.name;
}

/** ترتيب الراوي في طيبة النشر (1..20)، أو 999 إن كان غير معروف. */
export function getNarratorOrder(narratorId: string, catalog?: TransmissionCatalog): number {
  return makeContext(catalog).narratorById.get(narratorId)?.legacyOrderInTayyibah ?? 999;
}

/** يبني نطاقا مكملا: كل من لم يشمله النطاق المعطى. */
export function complementScope(scope: ReadingScope, catalog?: TransmissionCatalog): ReadingScope {
  const context = makeContext(catalog);
  const included = new Set(resolveScope(scope, catalog));
  const rest = context.narratorIds.filter((id) => !included.has(id));

  if (rest.length === context.narratorIds.length) return { kind: 'ALL' };
  if (included.size <= rest.length) return { kind: 'ALL_EXCEPT', narratorIds: [...included] };

  return { kind: 'NARRATORS', narratorIds: rest };
}

/** يختصر قائمة رواة إلى أبسط تعبير نطاق ممكن. */
export function normalizeScope(narratorIds: string[], catalog?: TransmissionCatalog): ReadingScope {
  const context = makeContext(catalog);
  const ids = sortByTayyibah(
    unique(narratorIds.filter((id) => context.narratorById.has(id))),
    context
  );

  if (ids.length === 0) return { kind: 'NARRATORS', narratorIds: [] };
  if (ids.length === context.narratorIds.length) return { kind: 'ALL' };

  const coverage = findFullyCoveredImams(ids, context);
  if (coverage.imamIds.length > 0 && coverage.coveredNarrators === ids.length) {
    return { kind: 'IMAMS', imamIds: coverage.imamIds };
  }

  const excluded = context.narratorIds.filter((id) => !ids.includes(id));
  if (excluded.length > 0 && excluded.length < ids.length / 2) {
    return { kind: 'ALL_EXCEPT', narratorIds: excluded };
  }

  return { kind: 'NARRATORS', narratorIds: ids };
}

// ==================== دوال داخلية ====================

interface ScopeContext {
  narrators: Narrator[];
  imams: ReadingImam[];
  paths: TransmissionPath[];
  narratorIds: string[];
  narratorById: Map<string, Narrator>;
  imamById: Map<string, ReadingImam>;
  pathById: Map<string, TransmissionPath>;
}

function makeContext(catalog?: TransmissionCatalog): ScopeContext {
  const narrators = catalog?.narrators ?? NARRATORS;
  const imams = catalog?.imams ?? READING_IMAMS;
  const paths = catalog?.paths ?? TRANSMISSION_PATH_SEEDS;
  const narratorIds = [...narrators]
    .sort(
      (a, b) =>
        (a.legacyOrderInTayyibah ?? 999) - (b.legacyOrderInTayyibah ?? 999) ||
        a.order - b.order ||
        a.name.localeCompare(b.name, 'ar')
    )
    .map((narrator) => narrator.id);

  return {
    narrators,
    imams,
    paths,
    narratorIds,
    narratorById: new Map(narrators.map((narrator) => [narrator.id, narrator])),
    imamById: new Map(imams.map((imam) => [imam.id, imam])),
    pathById: new Map(paths.map((path) => [path.id, path])),
  };
}

function findFullyCoveredImams(
  narratorIds: string[],
  context: ScopeContext
): { imamIds: string[]; coveredNarrators: number } {
  const set = new Set(narratorIds);
  const imamIds: string[] = [];
  let coveredNarrators = 0;

  for (const imam of context.imams) {
    const imamNarrators = context.narrators.filter((narrator) => narrator.imamId === imam.id);
    if (imamNarrators.length > 0 && imamNarrators.every((narrator) => set.has(narrator.id))) {
      imamIds.push(imam.id);
      coveredNarrators += imamNarrators.length;
    }
  }

  return { imamIds, coveredNarrators };
}

function sortByTayyibah(ids: string[], context: ScopeContext): string[] {
  return [...ids].sort(
    (first, second) =>
      (context.narratorById.get(first)?.legacyOrderInTayyibah ?? 999) -
      (context.narratorById.get(second)?.legacyOrderInTayyibah ?? 999)
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function joinArabic(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join('، ')} و${names[names.length - 1]}`;
}

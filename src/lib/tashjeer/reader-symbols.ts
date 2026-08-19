// بطاقات القراء على السطر - Reader Chips (إمام / راوٍ / طريق)
//
// المسألة التي يعالجها هذا الملف منهجية لا تجميلية:
//
//   في المصحف المشجّر لا يُكتب في طرف السطر «كل من قرأ به» مفصّلا، بل
//   يُختصر بأعلى مستوى يصح الاختصار إليه:
//
//     • اجتمع راويا الإمام على الوجه            → رمز الإمام.
//     • انفرد راوٍ (أو اجتمع طريقاه)             → رمز الراوي.
//     • انفرد طريق واحد من طرق الراوي           → اسم الطريق مكتوبا.
//
//   وكان المحرك السابق يطبع رموز الرواة دائما، فيظهر السطر برمزين لإمام
//   واحد، ولا يظهر للطريق أثر أصلا. هذا الملف يصحّح ذلك.
//
// قاعدة الطريق: لا رمز له. الطريق يُذكر باسمه («الأزرق»، «الأصبهاني»)، لأن
// الطرق مئات ولا تحتمل ترميزا مختصرا يُحفظ. أما الإمام والراوي فلهما رمزان
// قابلان للتحرير من لوحة التحكم.

import type { ReadingScope } from '@/types/tashjeer';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import { NARRATORS, READING_IMAMS, TRANSMISSION_PATH_SEEDS } from '@/data/qiraat-data/qiraat';
import { DEFAULT_IMAM_SYMBOLS, DEFAULT_NARRATOR_SYMBOLS } from '@/data/qiraat-data/symbols';
import { resolveScope } from './scope';

/** مستوى البطاقة: إمام، أو راوٍ، أو طريق. */
export type ReaderChipKind = 'IMAM' | 'NARRATOR' | 'PATH';

/**
 * وحدة قراءة: راوٍ كامل، أو طريق بعينه من طرقه.
 *
 * هي ذرّة المحرك المركّب: الأوجه تُنسب إلى وحدات، ثم تُجمع الوحدات في
 * بطاقات مختصرة عند الطباعة.
 */
export interface ReadingUnit {
  narratorId: string;
  /** غيابه يعني الراوي بكل طرقه. */
  pathId?: string;
}

/**
 * بطاقة واحدة في طرف السطر.
 *
 * `symbol` فارغ في الطريق دائما، وفي الراوي الذي لم يُوضع له رمز (حفص في
 * البذرة). عندئذ يُطبع `name`، فلا يبقى السطر مجهول النسبة.
 */
export interface ReaderChip {
  kind: ReaderChipKind;
  /** معرّف الإمام أو الراوي أو الطريق. */
  id: string;
  /** الاسم الكامل الظاهر في التلميح، ومطبوعا حين لا رمز. */
  name: string;
  /** الرمز المختصر، أو فراغ إن لم يكن للعنصر رمز (الطرق كلها). */
  symbol: string;
  /** النص الذي يُطبع فعلا: الرمز إن وُجد، وإلا الاسم. */
  text: string;
  /** ترتيب البطاقة في طيبة النشر، لضبط تسلسل الرموز على السطر. */
  order: number;
  /** الرواة الذين تمثلهم هذه البطاقة، للتلميح والتصفية. */
  narratorIds: string[];
}

interface SymbolContext {
  imams: TransmissionCatalog['imams'];
  narrators: TransmissionCatalog['narrators'];
  paths: TransmissionCatalog['paths'];
}

function context(catalog?: TransmissionCatalog): SymbolContext {
  return {
    imams: catalog?.imams ?? READING_IMAMS,
    narrators: catalog?.narrators ?? NARRATORS,
    paths: catalog?.paths ?? TRANSMISSION_PATH_SEEDS,
  };
}

/** رمز الإمام بعد تعديلات لوحة التحكم، أو بذرة المشروع. */
export function getImamSymbol(imamId: string, catalog?: TransmissionCatalog): string {
  const imam = context(catalog).imams.find((item) => item.id === imamId);
  return imam?.symbol ?? DEFAULT_IMAM_SYMBOLS[imamId] ?? '';
}

/** اسم الإمام كما يظهر في البطاقة. */
export function getImamName(imamId: string, catalog?: TransmissionCatalog): string {
  return context(catalog).imams.find((item) => item.id === imamId)?.name ?? imamId;
}

/** الأئمة مرتبين مع رموزهم، للوحة الرموز ولوحة التحكم. */
export function getImamsWithSymbols(catalog?: TransmissionCatalog): Array<{
  id: string;
  name: string;
  symbol: string;
}> {
  return [...context(catalog).imams]
    .sort((first, second) => first.order - second.order)
    .map((imam) => ({
      id: imam.id,
      name: imam.name,
      symbol: getImamSymbol(imam.id, catalog),
    }));
}

/** اسم الطريق وحده كما يُطبع على السطر: «الأزرق»، «أبو نشيط». */
export function getPathShortName(pathId: string, catalog?: TransmissionCatalog): string {
  const path = context(catalog).paths.find((item) => item.id === pathId);
  if (!path) return pathId;

  // البذرة تكتب الاسم المركّب «ورش / الأزرق»؛ والمطلوب على السطر اسم الطريق.
  const parts = path.shortName.split('/').map((part) => part.trim());
  return parts.length === 2 ? parts[1] : path.shortName;
}

/** كل طرق راوٍ في الكتالوج، مرتبة. */
export function pathsOfNarrator(narratorId: string, catalog?: TransmissionCatalog) {
  return context(catalog)
    .paths.filter((path) => path.narratorId === narratorId)
    .sort((first, second) => first.order - second.order);
}

/** يحوّل نطاق وجه إلى وحدات قراءة: طرقا إن ذُكرت الطرق، وإلا رواة. */
export function scopeToUnits(scope: ReadingScope, catalog?: TransmissionCatalog): ReadingUnit[] {
  const ctx = context(catalog);

  if (scope.kind === 'PATHS' && scope.pathIds?.length) {
    return scope.pathIds
      .map((pathId) => ctx.paths.find((path) => path.id === pathId))
      .filter((path): path is NonNullable<typeof path> => Boolean(path))
      .map((path) => ({ narratorId: path.narratorId, pathId: path.id }));
  }

  return resolveScope(scope, catalog).map((narratorId) => ({ narratorId }));
}

/**
 * يبني بطاقات السطر من وحدات القراءة.
 *
 * الخوارزمية:
 *   1. الطرق: إن غطّت كل طرق الراوي ارتفعنا إلى الراوي، وإلا طُبع اسم الطريق.
 *   2. الرواة: إن اجتمع كل رواة الإمام ارتفعنا إلى الإمام.
 *   3. ما بقي يُطبع برمز الراوي، أو باسمه إن لم يكن له رمز.
 */
export function chipsForUnits(units: ReadingUnit[], catalog?: TransmissionCatalog): ReaderChip[] {
  const ctx = context(catalog);
  const chips: ReaderChip[] = [];

  // 1. تجميع الوحدات براويها.
  const byNarrator = new Map<string, { whole: boolean; pathIds: Set<string> }>();
  for (const unit of units) {
    const entry = byNarrator.get(unit.narratorId) ?? { whole: false, pathIds: new Set<string>() };
    if (unit.pathId) entry.pathIds.add(unit.pathId);
    else entry.whole = true;
    byNarrator.set(unit.narratorId, entry);
  }

  // 2. من غطّى طرقه كلها فهو راوٍ كامل.
  const wholeNarrators = new Set<string>();
  const pathChips: ReaderChip[] = [];

  for (const [narratorId, entry] of byNarrator) {
    const allPaths = pathsOfNarrator(narratorId, catalog);
    const coversAll =
      entry.whole || (allPaths.length > 0 && allPaths.every((path) => entry.pathIds.has(path.id)));

    if (coversAll) {
      wholeNarrators.add(narratorId);
      continue;
    }

    for (const pathId of [...entry.pathIds].sort()) {
      pathChips.push({
        kind: 'PATH',
        id: pathId,
        name: getPathShortName(pathId, catalog),
        symbol: '',
        text: getPathShortName(pathId, catalog),
        order: narratorOrder(narratorId, ctx),
        narratorIds: [narratorId],
      });
    }
  }

  // 3. ارتفاع إلى الإمام: كل رواة الإمام حاضرون كاملين في هذا الوجه.
  const remaining = new Set(wholeNarrators);
  for (const imam of ctx.imams) {
    const imamNarrators = ctx.narrators.filter((narrator) => narrator.imamId === imam.id);
    if (imamNarrators.length === 0) continue;
    if (!imamNarrators.every((narrator) => remaining.has(narrator.id))) continue;

    const symbol = getImamSymbol(imam.id, catalog);
    chips.push({
      kind: 'IMAM',
      id: imam.id,
      name: imam.name,
      symbol,
      text: symbol || imam.name,
      order: Math.min(...imamNarrators.map((narrator) => narrator.legacyOrderInTayyibah ?? 999)),
      narratorIds: imamNarrators.map((narrator) => narrator.id),
    });

    for (const narrator of imamNarrators) remaining.delete(narrator.id);
  }

  for (const narratorId of remaining) {
    const narrator = ctx.narrators.find((item) => item.id === narratorId);
    const symbol = narrator?.symbol ?? DEFAULT_NARRATOR_SYMBOLS[narratorId] ?? '';
    chips.push({
      kind: 'NARRATOR',
      id: narratorId,
      name: narrator?.name ?? narratorId,
      symbol,
      text: symbol || narrator?.name || narratorId,
      order: narrator?.legacyOrderInTayyibah ?? 999,
      narratorIds: [narratorId],
    });
  }

  return [...chips, ...pathChips].sort(
    (first, second) => first.order - second.order || first.id.localeCompare(second.id, 'ar')
  );
}

/** بطاقات السطر انطلاقا من نطاق الوجه مباشرة. */
export function resolveReaderChips(
  scope: ReadingScope,
  catalog?: TransmissionCatalog
): ReaderChip[] {
  return chipsForUnits(scopeToUnits(scope, catalog), catalog);
}

/** وصف نصي مختصر للبطاقات، يُستعمل في التلميحات والتقارير. */
export function describeReaderChips(chips: ReaderChip[]): string {
  return chips
    .map((chip) => {
      if (chip.kind === 'IMAM') return `${chip.name} (بكماله)`;
      if (chip.kind === 'PATH') return `طريق ${chip.name}`;
      return chip.name;
    })
    .join('، ');
}

function narratorOrder(narratorId: string, ctx: SymbolContext): number {
  return ctx.narrators.find((narrator) => narrator.id === narratorId)?.legacyOrderInTayyibah ?? 999;
}

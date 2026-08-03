// كتالوج القراءات المحلي - Transmission Catalog
//
// البيانات الثابتة في data/qiraat-data هي «البذرة» فقط. هذا الملف يوفّر
// طبقة تحرير محلية فوقها: يستطيع المشرف إضافة قارئ أو راو أو طريق وتعديل
// ترتيبه ورمزه، ثم يقرأ محرك التشجير الكتالوج نفسه عند الرسم.
//
// لا يُستورد localStorage مباشرة في المكوّنات؛ فالكتالوج يمر من هذه الواجهة
// حتى يسهل استبداله بواجهة API/Prisma عند الانتقال إلى التخزين المركزي.

import type { Narrator, ReadingImam, TransmissionPath } from '@/types';
import {
  NARRATORS,
  READING_IMAMS,
  TRANSMISSION_PATH_SEEDS,
} from '@/data/qiraat-data/qiraat';
import { DEFAULT_NARRATOR_SYMBOLS } from '@/data/qiraat-data/symbols';

export const TRANSMISSION_CATALOG_VERSION = 1;
export const TRANSMISSION_CATALOG_STORAGE_KEY = 'tashjeer:transmissions:v1';
export const TRANSMISSION_CATALOG_EVENT = 'tashjeer:transmissions-change';

/** مجموعة القراء والرواة والطرق التي يعتمد عليها المحرك في جلسة العمل. */
export interface TransmissionCatalog {
  schemaVersion: number;
  updatedAt: string;
  imams: ReadingImam[];
  narrators: Narrator[];
  paths: TransmissionPath[];
}

/** يبني نسخة مستقلة من البذرة حتى لا تتغير الثوابت المشتركة. */
export function createDefaultTransmissionCatalog(): TransmissionCatalog {
  return normalizeTransmissionCatalog({
    schemaVersion: TRANSMISSION_CATALOG_VERSION,
    updatedAt: new Date().toISOString(),
    imams: READING_IMAMS.map((imam) => ({ ...imam })),
    narrators: NARRATORS.map((narrator) => ({
      ...narrator,
      symbol: narrator.symbol ?? DEFAULT_NARRATOR_SYMBOLS[narrator.id] ?? '',
    })),
    paths: TRANSMISSION_PATH_SEEDS.map(({ nodeNames: _nodeNames, ...path }) => ({ ...path })),
  });
}

/**
 * يجعل الكتالوج صالحا للرسم حتى لو كان قديمًا أو عُدّل يدويا في التخزين.
 * لا يحذف الطريق اليتيم عمدا: تظهره لوحة التحكم ليتم إصلاح نسبته، لكن محلل
 * النطاق لن ينسبه إلى راو غير موجود.
 */
export function normalizeTransmissionCatalog(
  value: Partial<TransmissionCatalog> | null | undefined
): TransmissionCatalog {
  const fallback = createSeedWithoutNormalization();
  const rawImams = Array.isArray(value?.imams) ? value!.imams : fallback.imams;
  const rawNarrators = Array.isArray(value?.narrators) ? value!.narrators : fallback.narrators;
  const rawPaths = Array.isArray(value?.paths) ? value!.paths : fallback.paths;

  const imams = uniqueById(rawImams)
    .filter(isImam)
    .map((imam, index) => ({
      ...imam,
      order: positiveInteger(imam.order, index + 1),
      slug: imam.slug || slugFromId(imam.id),
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ar'));

  const narrators = uniqueById(rawNarrators)
    .filter(isNarrator)
    .map((narrator, index) => ({
      ...narrator,
      order: positiveInteger(narrator.order, index + 1),
      legacyOrderInTayyibah: positiveInteger(narrator.legacyOrderInTayyibah, index + 1),
      slug: narrator.slug || slugFromId(narrator.id),
      symbol: narrator.symbol ?? DEFAULT_NARRATOR_SYMBOLS[narrator.id] ?? '',
    }))
    .sort(
      (a, b) =>
        (a.legacyOrderInTayyibah ?? 999) - (b.legacyOrderInTayyibah ?? 999) ||
        a.order - b.order ||
        a.name.localeCompare(b.name, 'ar')
    );

  const paths = uniqueById(rawPaths)
    .filter(isPath)
    .map((path, index) => ({
      ...path,
      order: positiveInteger(path.order, index + 1),
      depth: positiveInteger(path.depth, 1),
      code: path.code || slugFromId(path.id),
      shortName: path.shortName || path.fullName || path.id,
      fullName: path.fullName || path.shortName || path.id,
      isCanonical: path.isCanonical ?? false,
    }))
    .sort((a, b) => a.order - b.order || a.shortName.localeCompare(b.shortName, 'ar'));

  return {
    schemaVersion: TRANSMISSION_CATALOG_VERSION,
    updatedAt: value?.updatedAt || new Date().toISOString(),
    imams,
    narrators,
    paths,
  };
}

/** يقرأ الكتالوج المحفوظ، أو البذرة في SSR/أول استخدام. */
export function readTransmissionCatalog(): TransmissionCatalog {
  if (!isBrowser()) return createDefaultTransmissionCatalog();

  try {
    const raw = window.localStorage.getItem(TRANSMISSION_CATALOG_STORAGE_KEY);
    if (!raw) return createDefaultTransmissionCatalog();
    return normalizeTransmissionCatalog(JSON.parse(raw) as Partial<TransmissionCatalog>);
  } catch {
    return createDefaultTransmissionCatalog();
  }
}

/** يحفظ الكتالوج ويرسل حدثا لتحديث المحرر المفتوح وصفحات الإدارة. */
export function saveTransmissionCatalog(catalog: TransmissionCatalog): TransmissionCatalog {
  const normalized = normalizeTransmissionCatalog({
    ...catalog,
    updatedAt: new Date().toISOString(),
  });

  if (isBrowser()) {
    window.localStorage.setItem(TRANSMISSION_CATALOG_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(TRANSMISSION_CATALOG_EVENT, { detail: normalized }));
  }

  return normalized;
}

/** يعيد الكتالوج إلى بذرة المشروع المعتمدة. */
export function resetTransmissionCatalog(): TransmissionCatalog {
  const fresh = createDefaultTransmissionCatalog();
  return saveTransmissionCatalog(fresh);
}

/** أدوات استعلام صغيرة حتى لا تكرر الواجهات الترتيب والفلترة. */
export function catalogNarratorsInOrder(catalog: TransmissionCatalog): Narrator[] {
  return [...catalog.narrators].sort(
    (a, b) =>
      (a.legacyOrderInTayyibah ?? 999) - (b.legacyOrderInTayyibah ?? 999) ||
      a.order - b.order ||
      a.name.localeCompare(b.name, 'ar')
  );
}

export function catalogImamsInOrder(catalog: TransmissionCatalog): ReadingImam[] {
  return [...catalog.imams].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ar'));
}

export function catalogPathsForNarrator(
  catalog: TransmissionCatalog,
  narratorId: string
): TransmissionPath[] {
  return catalog.paths
    .filter((path) => path.narratorId === narratorId)
    .sort((a, b) => a.order - b.order || a.shortName.localeCompare(b.shortName, 'ar'));
}

/** معرّف محلي آمن للكيانات التي يضيفها المشرف. */
export function createTransmissionId(prefix: 'imam' | 'narrator' | 'path'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSeedWithoutNormalization(): TransmissionCatalog {
  return {
    schemaVersion: TRANSMISSION_CATALOG_VERSION,
    updatedAt: new Date().toISOString(),
    imams: READING_IMAMS.map((imam) => ({ ...imam })),
    narrators: NARRATORS.map((narrator) => ({
      ...narrator,
      symbol: narrator.symbol ?? DEFAULT_NARRATOR_SYMBOLS[narrator.id] ?? '',
    })),
    paths: TRANSMISSION_PATH_SEEDS.map(({ nodeNames: _nodeNames, ...path }) => ({ ...path })),
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function isImam(value: unknown): value is ReadingImam {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ReadingImam).id === 'string' &&
      typeof (value as ReadingImam).name === 'string'
  );
}

function isNarrator(value: unknown): value is Narrator {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Narrator).id === 'string' &&
      typeof (value as Narrator).imamId === 'string' &&
      typeof (value as Narrator).name === 'string'
  );
}

function isPath(value: unknown): value is TransmissionPath {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as TransmissionPath).id === 'string' &&
      typeof (value as TransmissionPath).narratorId === 'string'
  );
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function slugFromId(id: string): string {
  return id.replace(/^(imam|narrator|path)-/, '');
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

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
import { DEFAULT_IMAM_SYMBOLS, DEFAULT_NARRATOR_SYMBOLS } from '@/data/qiraat-data/symbols';
import {
  compareExplicitOrder,
  detectDisplayOrderConflicts,
  resolveDisplayOrderConflicts,
  type DisplayOrderConflict,
} from '@/lib/tashjeer/display-order';

/**
 * إصدار مخطط الكتالوج.
 *
 * **٢ (الحزمة ١٠، FR-ED-14):** حقل `order` في الراوي صار **رقم الترتيب الصريح
 * للظهور بين كل الرواة** بعد أن كان «ترتيبه داخل إمامه» (١ أو ٢). كل كتالوج
 * محفوظ بإصدار أقدم يُرحَّل عند القراءة: يُعبَّأ الرقم الصريح من ترتيب الطيبة
 * القائم، فلا يتغير الظهور المعتاد ولا يفقد أحد ترتيبه (انظر
 * `migrateLegacyDisplayOrders`).
 */
export const TRANSMISSION_CATALOG_VERSION = 2;
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
    imams: READING_IMAMS.map((imam) => ({
      ...imam,
      symbol: imam.symbol ?? DEFAULT_IMAM_SYMBOLS[imam.id] ?? '',
    })),
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
 *
 * **ضمانات الترتيب الصريح (FR-ED-14، DM-04):**
 *
 *   1. كل كيان يخرج برقم ترتيب صريح موجب (يُعبَّأ من الافتراضي الموثق عند الغياب).
 *   2. **لا رقمان متساويان أبدًا** داخل مجموعة أقران واحدة؛ التعارض يُفضّ حتميا
 *      بالأصغر معرفًا (الترتيب الأبجدي للـID) ثم بإعادة ترقيم ١..ن.
 *   3. الفرز بالرقم الصريح ثم **المعرّف** — لا بالاسم ولا بالرمز ولا بتاريخ
 *      الإضافة، فتغيير الاسم لا يحرّك صاحبه من موضعه.
 */
export function normalizeTransmissionCatalog(
  value: Partial<TransmissionCatalog> | null | undefined
): TransmissionCatalog {
  const fallback = createSeedWithoutNormalization();
  const rawImams = Array.isArray(value?.imams) ? value!.imams : fallback.imams;
  const rawNarrators = Array.isArray(value?.narrators) ? value!.narrators : fallback.narrators;
  const rawPaths = Array.isArray(value?.paths) ? value!.paths : fallback.paths;

  // الترحيل اللطيف: بيانات الإصدار ١ كانت تحمل للراوي رقمًا محليًا داخل إمامه،
  // فيُعبَّأ رقمه الصريح العام من ترتيب الطيبة القائم قبل أي فرز أو فضّ تعارض.
  const migratedNarrators = migrateLegacyDisplayOrders(
    rawNarrators,
    typeof value?.schemaVersion === 'number' ? value.schemaVersion : TRANSMISSION_CATALOG_VERSION
  );

  const imams = resolveDisplayOrderConflicts(
    uniqueById(rawImams)
      .filter(isImam)
      .map((imam, index) => ({
        ...imam,
        order: positiveInteger(imam.order, index + 1),
        slug: imam.slug || slugFromId(imam.id),
        // رمز الإمام: ما حفظه المشرف، وإلا بذرة المشروع، وإلا فراغ يظهر بالاسم.
        symbol: imam.symbol ?? DEFAULT_IMAM_SYMBOLS[imam.id] ?? '',
      }))
  ).sort(compareExplicitOrder);

  const narrators = resolveDisplayOrderConflicts(
    uniqueById(migratedNarrators)
      .filter(isNarrator)
      .map((narrator, index) => ({
        ...narrator,
        // الرقم الصريح بين كل الرواة؛ افتراضيه ترتيب الطيبة ثم موضع الإدخال.
        order: positiveInteger(
          narrator.order,
          positiveInteger(narrator.legacyOrderInTayyibah, index + 1)
        ),
        slug: narrator.slug || slugFromId(narrator.id),
        symbol: narrator.symbol ?? DEFAULT_NARRATOR_SYMBOLS[narrator.id] ?? '',
      }))
  ).sort(compareExplicitOrder);

  // أقران الطريق هم طرق راويه، ففضّ التعارض يقع داخل كل راوٍ على حدة.
  const normalizedPaths = uniqueById(rawPaths)
    .filter(isPath)
    .map((path, index) => ({
      ...path,
      order: positiveInteger(path.order, index + 1),
      depth: positiveInteger(path.depth, 1),
      code: path.code || slugFromId(path.id),
      shortName: path.shortName || path.fullName || path.id,
      fullName: path.fullName || path.shortName || path.id,
      isCanonical: path.isCanonical ?? false,
      symbol: typeof path.symbol === 'string' ? path.symbol.trim() : '',
    }));

  const paths = resolvePathOrdersPerNarrator(normalizedPaths).sort(
    (a, b) => a.narratorId.localeCompare(b.narratorId) || compareExplicitOrder(a, b)
  );

  return {
    schemaVersion: TRANSMISSION_CATALOG_VERSION,
    updatedAt: value?.updatedAt || new Date().toISOString(),
    imams,
    narrators,
    paths,
  };
}

/**
 * ترحيل الأرقام الصريحة من كتالوج بإصدار أقدم (DM-17: ترحيل لطيف موثق).
 *
 * في الإصدار ١ كان `Narrator.order` ترتيبًا داخل الإمام (١ أو ٢) بينما كان
 * ترتيب الظهور الفعلي هو `legacyOrderInTayyibah`. فلو قرأنا تلك البيانات
 * بالميزة الجديدة لتساوى عشرون راويًا في رقمين ولانعكس ترتيب الأمة. لذلك
 * يُعبَّأ الرقم الصريح من ترتيب الطيبة القائم، ومن لا ترتيب له يُرقَّم بعد
 * آخر معروف بترتيب ظهوره في الملف (حتمي بلا عشوائية).
 *
 * البيانات بإصدار ٢ أو أحدث تُترك كما هي: رقم المشرف الصريح مقدَّس.
 */
export function migrateLegacyDisplayOrders(
  narrators: readonly Narrator[],
  schemaVersion: number
): Narrator[] {
  if (schemaVersion >= TRANSMISSION_CATALOG_VERSION) return [...narrators];

  let nextFree = narrators.reduce(
    (max, narrator) => Math.max(max, positiveInteger(narrator.legacyOrderInTayyibah, 0)),
    0
  );

  return narrators.map((narrator) => {
    const tayyibah = positiveInteger(narrator.legacyOrderInTayyibah, 0);
    const order = tayyibah > 0 ? tayyibah : (nextFree += 1);
    return order === narrator.order ? narrator : { ...narrator, order };
  });
}

/** تعارضات الأرقام الصريحة في الكتالوج المحفوظ **قبل** تصحيحها تلقائيا. */
export function auditCatalogDisplayOrders(
  value: Partial<TransmissionCatalog> | null | undefined
): DisplayOrderConflict[] {
  return detectDisplayOrderConflicts(value);
}

/** نتيجة فحص الكتالوج المحفوظ: ما الذي صُحّح تلقائيًا عند قراءته. */
export interface CatalogAudit {
  /** تعارضات أرقام الترتيب كما هي في التخزين قبل فضّها حتميا. */
  conflicts: DisplayOrderConflict[];
  /** إصدار المخطط المحفوظ، أو null إن لم يوجد كتالوج محفوظ. */
  storedVersion: number | null;
  /** هل البيانات أقدم من الإصدار الحالي فاحتاجت ترحيل الأرقام الصريحة. */
  legacySchema: boolean;
  /** عدد الرواة الذين عُّبئ رقمهم الصريح من ترتيب الطيبة أثناء الترحيل. */
  migratedNarrators: number;
}

/**
 * يفحص الكتالوج **المحفوظ** ويخبر بما صحّحه التطبيع تلقائيًا.
 *
 * التطبيع يضمن «لا رقمان متساويان أبدًا» ويرحّل بيانات الإصدار الأقدم، لكن
 * المشرف يجب أن يرى أن ذلك وقع ليراجعه (DM-04: تحذير يعرض التعارض للتصحيح).
 */
export function auditStoredCatalog(): CatalogAudit | null {
  const raw = readRawTransmissionCatalog();
  if (!raw) return null;

  const storedVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : null;
  const legacySchema = storedVersion === null || storedVersion < TRANSMISSION_CATALOG_VERSION;
  const rawNarrators = Array.isArray(raw.narrators) ? raw.narrators : [];
  const migrated = legacySchema
    ? migrateLegacyDisplayOrders(rawNarrators, storedVersion ?? 0).filter(
        (narrator, index) => narrator.order !== rawNarrators[index]?.order
      ).length
    : 0;

  return {
    conflicts: detectDisplayOrderConflicts(raw),
    storedVersion,
    legacySchema,
    migratedNarrators: migrated,
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

/**
 * يقرأ الكتالوج المحفوظ **كما هو في التخزين** بلا تطبيع ولا ترحيل.
 *
 * للتشخيص فقط: لوحة التحكم تقارنه بالمطبَّع لتخبر المشرف أن تعارض أرقام أو
 * بيانات إصدار قديم صُحّحت تلقائيًا عند القراءة. لا يُستعمل للرسم أبدًا.
 */
export function readRawTransmissionCatalog(): Partial<TransmissionCatalog> | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(TRANSMISSION_CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TransmissionCatalog>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
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
    // بعض البيئات (اختبارات/عمال) توفّر localStorage بلا DOM كامل.
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TRANSMISSION_CATALOG_EVENT, { detail: normalized }));
    }
  }

  return normalized;
}

/** يعيد الكتالوج إلى بذرة المشروع المعتمدة. */
export function resetTransmissionCatalog(): TransmissionCatalog {
  const fresh = createDefaultTransmissionCatalog();
  return saveTransmissionCatalog(fresh);
}

/**
 * أدوات استعلام صغيرة حتى لا تكرر الواجهات الترتيب والفلترة.
 *
 * كلها تفرز بالرقم الصريح ثم المعرّف (لا بالاسم): نفس الكتالوج يعطي نفس
 * الترتيب في كل الواجهات وفي التصدير (FR-ED-14).
 */
export function catalogNarratorsInOrder(catalog: TransmissionCatalog): Narrator[] {
  return [...catalog.narrators].sort(compareExplicitOrder);
}

export function catalogImamsInOrder(catalog: TransmissionCatalog): ReadingImam[] {
  return [...catalog.imams].sort(compareExplicitOrder);
}

export function catalogPathsForNarrator(
  catalog: TransmissionCatalog,
  narratorId: string
): TransmissionPath[] {
  return catalog.paths
    .filter((path) => path.narratorId === narratorId)
    .sort(compareExplicitOrder);
}

/** معرّف محلي آمن للكيانات التي يضيفها المشرف. */
export function createTransmissionId(prefix: 'imam' | 'narrator' | 'path'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSeedWithoutNormalization(): TransmissionCatalog {
  return {
    schemaVersion: TRANSMISSION_CATALOG_VERSION,
    updatedAt: new Date().toISOString(),
    imams: READING_IMAMS.map((imam) => ({
      ...imam,
      symbol: imam.symbol ?? DEFAULT_IMAM_SYMBOLS[imam.id] ?? '',
    })),
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

/**
 * يفضّ تعارضات أرقام الطرق **داخل كل راوٍ** على حدة.
 *
 * أقران الطريق هم طرق راويه لا كل طرق الكتالوج، فلو فُضّت التعارضات عالميًا
 * لتحول «الأزرق ١» و«ابن الحصين ١» إلى رقمين مختلفين بلا معنى.
 */
function resolvePathOrdersPerNarrator(paths: TransmissionPath[]): TransmissionPath[] {
  const groups = new Map<string, TransmissionPath[]>();
  for (const path of paths) {
    const list = groups.get(path.narratorId) ?? [];
    list.push(path);
    groups.set(path.narratorId, list);
  }

  const result: TransmissionPath[] = [];
  for (const group of groups.values()) result.push(...resolveDisplayOrderConflicts(group));
  return result;
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

// ==================== الترتيب الصريح وتعارضاته (FR-ED-14، DM-04) ====================

/** نتيجة فحص رقم ترتيب مقترح داخل مجموعة أقران. */
export interface OrderConflict<T extends { id: string; order: number }> {
  /** العنصر الذي يشغل الرقم نفسه (غير العنصر المعدَّل). */
  occupant: T;
  /** الرقم المتنازَع عليه. */
  order: number;
}

/** يجد من يشغل رقم الترتيب المقترح بين الأقران، إن وُجد. */
export function findOrderConflict<T extends { id: string; order: number }>(
  peers: T[],
  candidateId: string | undefined,
  order: number
): OrderConflict<T> | null {
  const occupant = peers.find((peer) => peer.id !== candidateId && peer.order === order);
  return occupant ? { occupant, order } : null;
}

/**
 * يُدرج عنصرا في رقم ترتيب معيّن ويزيح من بعده بمقدار واحد حتى لا يتكرر
 * رقم (إدراج مع إزاحة). العناصر الأخرى تحتفظ بترتيبها النسبي. المعرّفات لا
 * تتغير أبدا.
 */
export function insertWithShift<T extends { id: string; order: number }>(peers: T[], item: T, order: number): T[] {
  const others = peers.filter((peer) => peer.id !== item.id).sort((a, b) => a.order - b.order);
  const result: T[] = [];
  let next = 1;
  let inserted = false;
  for (const peer of others) {
    if (!inserted && next >= order) {
      result.push({ ...item, order: next });
      inserted = true;
      next += 1;
    }
    result.push(peer.order === next ? peer : { ...peer, order: next });
    next += 1;
  }
  if (!inserted) result.push({ ...item, order: Math.max(order, next) });
  return result;
}

/** يعيد ترقيم الأقران 1..n وفق ترتيب المصفوفة المعطى (بعد سحب وإفلات). */
export function renumberByPosition<T extends { id: string; order: number }>(ordered: T[]): T[] {
  return ordered.map((peer, index) => (peer.order === index + 1 ? peer : { ...peer, order: index + 1 }));
}

/** ينقل عنصرا بين أقرانه إلى فهرس جديد ويرقّم الكل 1..n. */
export function movePeer<T extends { id: string; order: number }>(peers: T[], id: string, toIndex: number): T[] {
  const sorted = [...peers].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((peer) => peer.id === id);
  if (from === -1) return peers;
  const target = Math.max(0, Math.min(sorted.length - 1, toIndex));
  const next = [...sorted];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return renumberByPosition(next);
}

/** يستبدل مجموعة أقران معدَّلة داخل قائمة أكبر (مثل رواة إمام واحد داخل كل الرواة). */
export function replacePeers<T extends { id: string }>(all: T[], updated: T[]): T[] {
  const byId = new Map(updated.map((item) => [item.id, item]));
  return all.map((item) => byId.get(item.id) ?? item);
}

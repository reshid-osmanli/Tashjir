// مخزن مستندات التشجير - Document Store
// مشروع التشجير - نظام القراءات العشر
//
// التخزين في هذه المرحلة محلي بالكامل (localStorage)، بقرار من صاحب المشروع،
// حتى يستقر أساس المحرر قبل الانتقال إلى قاعدة بيانات.
//
// لذلك صُمّم هذا الملف كواجهة (facade) مغلقة:
//   لا يتعامل أي مكوّن مع localStorage مباشرة، بل يمر من هنا.
//   عند الانتقال إلى Prisma لاحقا، تُستبدل الدوال الأربع الأساسية فقط:
//     loadDocument / saveDocument / listDocuments / deleteDocument
//   دون تعديل أي مكوّن في المحرر.
//
// صيغة المفتاح: tashjeer:doc:v2:{ayahKey}
// إصدار الصيغة داخل المستند (schemaVersion) يسمح بالترقية التدريجية.

import type {
  DocumentEditEntry,
  DocumentEditTargetType,
  DocumentMeta,
  TashjeerBranch,
  TashjeerDocument,
  TashjeerLink,
  LineSegment,
  Variant,
  VerificationStatus,
} from '@/types/tashjeer';
import { getAyahByKey, getAyahWordsByKey } from '@/data/quran';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { listGlobalRules, upsertGlobalRules, type GlobalRule } from './global-rules-store';
import {
  exportOccurrenceData,
  upsertOccurrenceOverrides,
  type OccurrenceLogEntry,
  type RuleOccurrenceOverride,
} from './rule-occurrences-store';
import {
  normalizeStrengthDegrees,
  readStrengthDegrees,
  saveStrengthDegrees,
  type StrengthDegreeCatalog,
} from '@/lib/tashjeer/strength-degrees';
import { characterCount, compareCharacterAnchors } from '@/lib/quran-logic/characters';
import { boundsOfLoci, normalizeLocus } from '@/lib/tashjeer/loci';
import { getSeedVariants } from '@/data/variants/seed-variants';
import { parseAyahKey } from '@/data/quran';
import {
  backupBeforeMigration,
  migrateDocumentToV8,
} from '@/lib/tashjeer/migration/migrate-v7-v8';
import type { DisplayOrderEntry, EngineConfig, TashjeerDocumentV8 } from '@/lib/tashjeer/model/v8';
import { loadEngineConfig, toCanonicalConfig } from '@/lib/tashjeer/engine-config-store';
import {
  readTransmissionCatalog,
  saveTransmissionCatalog,
  type TransmissionCatalog,
} from '@/lib/transmissions/catalog';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

/**
 * إصدار صيغة المستند الحالي.
 *
 * v5: القواعد العامة النمطية تُحفظ في الحزمة.
 * v6: درجات قوة الوجه لكل راوٍ، واستثناءات مواضع القواعد وسجلّها.
 * v7: التحكم اليدوي الكامل: روابط الأوجه والأسطر، أجزاء الأسطر، ترتيب
 *     الأسطر اليدوي، وسجل تعديلات المحرر (المصدر: محرك/محرر).
 * v8: شروط الوقف/الوصل، منع الوصل، ولقطة نتيجة المحرك قبل التصحيح.
 */
export const SCHEMA_VERSION = 8;

// نحتفظ بمفاتيح v2 كي تُقرأ مستندات المستخدمين القديمة ثم تُرقّى عند الحفظ.
const DOC_PREFIX = 'tashjeer:doc:v2:';
const INDEX_KEY = 'tashjeer:doc-index:v2';

/** عنصر في فهرس المستندات المحفوظة. */
export interface DocumentIndexEntry {
  ayahKey: number;
  surahNumber: number;
  ayahNumber: number;
  variantsCount: number;
  /** عدد المواضع المحددة بالحروف، مفيد لفهرس العمل والمراجعة. */
  characterVariantsCount?: number;
  branchesCount: number;
  status: VerificationStatus;
  updatedAt: string;
}

// ==================== إنشاء ====================

/**
 * ينشئ مستندا جديدا لآية، مبدوءا بالاختلافات الأولية إن وُجدت.
 *
 * @param ayahKey معرّف الآية
 * @param author اسم المحرر الحالي
 */
export function createDocument(ayahKey: number, author = 'محرر محلي'): TashjeerDocument {
  const { surahNumber, ayahNumber } = parseAyahKey(ayahKey);
  const now = new Date().toISOString();

  return {
    schemaVersion: SCHEMA_VERSION,
    ayahKey,
    surahNumber,
    ayahNumber,
    // نسخة عميقة من البذرة حتى لا يعدّل المستخدم البيانات المشتركة.
    variants: cloneVariants(getSeedVariants(ayahKey)),
    branches: [],
    manualLines: [],
    boundaries: [],
    layout: { forcedLineBreakAfter: [], lineOffsets: {} },
    lineOrder: [],
    links: [],
    segments: [],
    editLog: [],
    readingWindow: { linkNextAyah: false, focusSegment: null },
    meta: {
      createdAt: now,
      updatedAt: now,
      author,
      status: 'DRAFT',
    },
  };
}

// ==================== قراءة وكتابة ====================

/**
 * يحمّل مستند آية من التخزين المحلي.
 * @returns المستند، أو null إن لم يكن محفوظا.
 */
export function loadDocument(ayahKey: number): TashjeerDocument | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(DOC_PREFIX + ayahKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TashjeerDocument;
    return migrateDocument(parsed);
  } catch {
    return null;
  }
}

/**
 * يحمّل مستند آية، وإن لم يوجد ينشئ واحدا جديدا (بلا حفظ).
 */
export function loadOrCreateDocument(ayahKey: number, author?: string): TashjeerDocument {
  return loadDocument(ayahKey) ?? createDocument(ayahKey, author);
}

/**
 * يحفظ المستند ويحدّث الفهرس وتاريخ التعديل.
 * @returns المستند بعد تحديث الطابع الزمني.
 */
export function saveDocument(document: TashjeerDocument): TashjeerDocument {
  const updated: TashjeerDocument = {
    ...document,
    schemaVersion: SCHEMA_VERSION,
    meta: { ...document.meta, updatedAt: new Date().toISOString() },
  };

  if (!isBrowser()) return updated;

  window.localStorage.setItem(DOC_PREFIX + updated.ayahKey, JSON.stringify(updated));
  updateIndex(updated);

  return updated;
}

/** يحذف مستند آية ويزيله من الفهرس. */
export function deleteDocument(ayahKey: number): void {
  if (!isBrowser()) return;

  window.localStorage.removeItem(DOC_PREFIX + ayahKey);
  writeIndex(readIndex().filter((entry) => entry.ayahKey !== ayahKey));
}

/** يعيد فهرس كل المستندات المحفوظة، مرتبا بالأحدث تعديلا. */
export function listDocuments(): DocumentIndexEntry[] {
  return [...readIndex()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** هل للآية مستند محفوظ؟ */
export function hasDocument(ayahKey: number): boolean {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(DOC_PREFIX + ayahKey) !== null;
}

// ==================== التصدير والاستيراد ====================

/** صيغة ملف التصدير: مستند واحد أو عدة مستندات. */
export interface ExportedAyahSnapshot {
  ayahKey: number;
  surahNumber: number;
  ayahNumber: number;
  text: string;
  words: Array<{ id: number; position: number; text: string }>;
}

export interface ExportBundle {
  format: 'tashjeer-export';
  schemaVersion: number;
  exportedAt: string;
  /** كل قواعد المصحف العامة، حتى يكون ملف آية واحدة مفهوما بذاته. */
  globalRules: GlobalRule[];
  /**
   * سلّم درجات قوة الوجه. بدونه تُقرأ معرّفات الدرجات في ملف مستورد على
   * جهاز آخر بلا معنى، فيضيع ترجيح المحقق.
   */
  strengthDegrees?: StrengthDegreeCatalog;
  /** استثناءات مواضع القواعد: ما حُذف موضعيا وما خُصِّصت درجته. */
  ruleOccurrences?: RuleOccurrenceOverride[];
  /** سجل ما جرى على المواضع، لتتبع أين حُذفت القاعدة ومتى. */
  occurrenceLog?: OccurrenceLogEntry[];
  /** لقطة النص والكلمات التي استند إليها كل مستند، للقراءة بلا التطبيق. */
  ayahs: ExportedAyahSnapshot[];
  documents: TashjeerDocument[];
  /**
   * v8: الصورة الموحّدة لكل مستند (اختلافات/أوجه/علاقات/علامات وقف/تصحيحات/
   * نطاقات عرض/سجل تدقيق) مشتقة من `documents` بدالة نقية. تُكتب للقراءة
   * الخارجية ولملفات Git، ولا يُعتمد عليها في الاستيراد لأن `documents` هي
   * المصدر الأصلي (DM-13).
   */
  v8?: TashjeerDocumentV8[];
  /** v8: ملف سياسات المحرك المفعّل وقت التصدير بصيغة قانونية مرتّبة. */
  engineConfig?: ReturnType<typeof toCanonicalConfig>;
  /**
   * v8 (DM-04): رتب العرض الصريحة للقراء والرواة والطرق وقت التصدير، مرتبة
   * بالنوع ثم بالمعرّف. بدونها يفقد ملف مستورد على جهاز آخر ترتيب الأعمدة
   * الذي اعتمده المحقق (Display Order != Creation Order != Name Order).
   */
  displayOrder?: DisplayOrderEntry[];
}

/** خيارات التصدير: تثبيت الطابع الزمني يجعل الملف مستقرا بايتا ببايت (DM-13). */
export interface ExportOptions {
  exportedAt?: string;
  engineConfig?: EngineConfig | null;
  /** إدراج الصورة v8 (افتراضيا نعم). */
  includeV8?: boolean;
  /** إدراج رتب العرض الصريحة للقراء/الرواة/الطرق (افتراضيا نعم) — DM-04. */
  includeDisplayOrder?: boolean;
  /** كتالوج بديل لاشتقاق رتب العرض (للاختبارات والتصدير الحتمي). */
  catalog?: TransmissionCatalog | null;
}

/**
 * يصدّر مستندات إلى نص JSON منسّق، صالح للحفظ كملف أو للمشاركة للمراجعة.
 * @param ayahKeys معرّفات الآيات، أو undefined لتصدير كل المحفوظ.
 */
export function exportDocuments(ayahKeys?: number[], options: ExportOptions = {}): string {
  const keys = ayahKeys ?? listDocuments().map((entry) => entry.ayahKey);
  const documents = keys
    .map((key) => loadDocument(key))
    .filter((document): document is TashjeerDocument => document !== null);

  return exportDocumentBundle(documents, options);
}

/**
 * يصدّر مستندا موجودا في ذاكرة المحرر، حتى قبل الضغط على «حفظ». هذا مهم
 * لتسليم JSON لكل آية: لا يصبح الملف فارغا عند تصدير آية جديدة أو مسودة.
 */
export function exportDocument(document: TashjeerDocument, options: ExportOptions = {}): string {
  return exportDocumentBundle([migrateDocument(document)], options);
}

/** يصدر آية من فهرس المصحف حتى إن لم يسبق حفظ مستند لها. */
export function exportAyahDocument(ayahKey: number, options: ExportOptions = {}): string {
  return exportDocumentBundle([loadDocument(ayahKey) ?? createDocument(ayahKey)], options);
}

/**
 * يبني حزمة التصدير كائنا (قبل التسلسل). تُستعمل في الاختبارات وفي التصدير
 * القانوني: المعرّفات المولّدة للصورة v8 (تصحيحات/نطاقات) تُشتق من معرّف
 * المستند لا من الوقت، فيعطي المستند نفسه الملف نفسه بايتا ببايت (DM-13).
 */
export function buildExportBundle(documents: TashjeerDocument[], options: ExportOptions = {}): ExportBundle {
  // قراءة واحدة للمخزن: الاستثناءات وسجلها يخرجان معا فلا يُقرأ المخزن مرتين.
  const occurrences = exportOccurrenceData();
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const engineConfig = options.engineConfig === null ? null : (options.engineConfig ?? safeLoadEngineConfig());

  const bundle: ExportBundle = {
    format: 'tashjeer-export',
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    globalRules: listGlobalRules(),
    strengthDegrees: readStrengthDegrees(),
    ruleOccurrences: occurrences.overrides,
    occurrenceLog: occurrences.log,
    ayahs: documents.map(makeAyahSnapshot),
    documents,
  };

  if (options.includeV8 !== false) {
    bundle.v8 = documents.map((document) => toStableV8(document, exportedAt));
  }
  if (engineConfig) bundle.engineConfig = toCanonicalConfig(engineConfig);
  if (options.includeDisplayOrder !== false) {
    bundle.displayOrder = displayOrderOfCatalog(options.catalog ?? safeReadCatalog());
  }

  return bundle;
}

function safeReadCatalog(): TransmissionCatalog | null {
  if (!isBrowser()) return null;
  try {
    return readTransmissionCatalog();
  } catch {
    return null;
  }
}

/** يشتق قائمة رتب العرض الصريحة من الكتالوج بترتيب حتمي (DM-04، DM-13). */
export function displayOrderOfCatalog(catalog: TransmissionCatalog | null): DisplayOrderEntry[] {
  if (!catalog) return [];
  const entries: DisplayOrderEntry[] = [
    ...catalog.imams.map((imam) => ({ id: imam.id, kind: 'IMAM' as const, displayOrder: imam.order })),
    ...catalog.narrators.map((narrator) => ({ id: narrator.id, kind: 'NARRATOR' as const, displayOrder: narrator.order })),
    ...catalog.paths.map((path) => ({ id: path.id, kind: 'PATH' as const, displayOrder: path.order })),
  ];
  const kindRank = { IMAM: 0, NARRATOR: 1, PATH: 2 } as const;
  return entries.sort((a, b) => kindRank[a.kind] - kindRank[b.kind] || a.id.localeCompare(b.id));
}

/**
 * يطبّق رتب عرض مستوردة على الكتالوج المحلي: العناصر المعروفة فقط تتغير
 * رتبتها، والمجهولة تُتجاهل وتُحصى (لا تُنشأ كيانات من رتبة وحدها).
 */
export function applyDisplayOrder(
  catalog: TransmissionCatalog,
  entries: DisplayOrderEntry[]
): { catalog: TransmissionCatalog; applied: number; unknown: number } {
  const byId = new Map(entries.filter((entry) => typeof entry?.displayOrder === 'number').map((entry) => [entry.id, entry]));
  let applied = 0;
  const pick = <T extends { id: string; order: number }>(item: T, kind: DisplayOrderEntry['kind']): T => {
    const entry = byId.get(item.id);
    if (!entry || entry.kind !== kind || entry.displayOrder === item.order) return item;
    applied += 1;
    return { ...item, order: entry.displayOrder };
  };
  const next: TransmissionCatalog = {
    ...catalog,
    imams: catalog.imams.map((imam) => pick(imam, 'IMAM')),
    narrators: catalog.narrators.map((narrator) => pick(narrator, 'NARRATOR')),
    paths: catalog.paths.map((path) => pick(path, 'PATH')),
  };
  const known = new Set([...catalog.imams, ...catalog.narrators, ...catalog.paths].map((item) => item.id));
  const unknown = entries.filter((entry) => !known.has(entry.id)).length;
  return { catalog: next, applied, unknown };
}

function exportDocumentBundle(documents: TashjeerDocument[], options: ExportOptions = {}): string {
  return JSON.stringify(buildExportBundle(documents, options), null, 2);
}

/** يحمّل ملف المحرك المفعّل، أو لا شيء خارج المتصفح أو عند تلف التخزين. */
function safeLoadEngineConfig(): EngineConfig | null {
  if (!isBrowser()) return null;
  try {
    return loadEngineConfig();
  } catch {
    return null;
  }
}

/**
 * الصورة v8 بمعرّفات حتمية: دالة الترحيل تولّد معرّفات عشوائية للتصحيحات
 * ونطاقات العرض، وهنا تُستبدل بمعرّفات مشتقة من الآية والهدف حتى يكون
 * التصدير مستقرا (يمكن مقارنة ملفين في Git دون ضجيج).
 */
function toStableV8(document: TashjeerDocument, exportedAt: string): TashjeerDocumentV8 {
  const v8 = migrateDocumentToV8(document);
  return {
    ...v8,
    exportedAt,
    corrections: v8.corrections.map((correction, index) => ({
      ...correction,
      id: `corr-${document.ayahKey}-${correction.targetId}-${index + 1}`,
    })),
    renderRanges: v8.renderRanges.map((range, index) => ({
      ...range,
      id: `range-${document.ayahKey}-${range.fromPosition}-${range.toPosition}-${index + 1}`,
    })),
  };
}

function makeAyahSnapshot(document: TashjeerDocument): ExportedAyahSnapshot {
  const ayah = getAyahByKey(document.ayahKey);
  return {
    ayahKey: document.ayahKey,
    surahNumber: document.surahNumber,
    ayahNumber: document.ayahNumber,
    text: ayah?.text ?? '',
    // كلمات نافذة العمل: تشمل الآية التالية إن وصلها المحقق، فيبقى الملف
    // المصدَّر مفهوما بذاته ولو كان الحكم واقعا بين آيتين.
    words: documentWindowWords(document).map((word) => ({
      id: word.id,
      position: word.position,
      text: word.text,
    })),
  };
}

/** تقرير ترحيل مستند واحد أثناء الاستيراد (NFR-04). */
export interface ImportMigrationReport {
  ayahKey: number;
  /** الإصدار الذي جاء به المستند (أو 0 إن كان بلا إصدار). */
  fromVersion: number;
  toVersion: number;
  /** مفتاح النسخة الاحتياطية في التخزين المحلي، إن حُفظت. */
  backupKey: string | null;
}

/** نتيجة عملية استيراد. */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  /** المستندات التي رُقّيت من إصدار أقدم، مع مفاتيح نسخها الاحتياطية. */
  migrated: ImportMigrationReport[];
  /** تحذيرات لا تمنع الاستيراد (نسخة أحدث من المدعوم، حقول متجاهلة...). */
  warnings: string[];
}

/** بادئة مفاتيح النسخ الاحتياطية قبل الترحيل. */
export const BACKUP_PREFIX = 'tashjeer:backup:';

/**
 * يصوغ تقرير الاستيراد جملة عربية واحدة للواجهات (بالأرقام العربية)، حتى
 * يكون النص واحدا في المحرر والإعدادات ولا يُنسى ذكر الترحيل والنسخ.
 */
export function describeImportResult(result: ImportResult): string {
  if (result.errors.length > 0) return result.errors[0];
  const parts = [`تم استيراد ${toArabicDigits(result.imported)} مستندا`];
  if (result.skipped > 0) parts.push(`وتخطي ${toArabicDigits(result.skipped)}`);
  if (result.migrated.length > 0) {
    const backedUp = result.migrated.filter((item) => item.backupKey).length;
    parts.push(
      `ورُقّي ${toArabicDigits(result.migrated.length)} من إصدار أقدم إلى الإصدار ${toArabicDigits(SCHEMA_VERSION)}` +
        (backedUp > 0 ? ` مع ${toArabicDigits(backedUp)} نسخة احتياطية` : '')
    );
  }
  const sentence = `${parts.join(' ')}.`;
  return result.warnings.length > 0 ? `${sentence} ${result.warnings[0]}` : sentence;
}

/** يسرد النسخ الاحتياطية المحفوظة قبل الترحيل، الأحدث أولا. */
export function listMigrationBackups(): Array<{ key: string; ayahKey: number; backedUpAt: string; schemaVersion: number }> {
  if (!isBrowser()) return [];
  const result: Array<{ key: string; ayahKey: number; backedUpAt: string; schemaVersion: number }> = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(BACKUP_PREFIX)) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
        backedUpAt?: string;
        schemaVersion?: number;
        payload?: { ayahKey?: number };
      };
      result.push({
        key,
        ayahKey: parsed.payload?.ayahKey ?? 0,
        backedUpAt: parsed.backedUpAt ?? '',
        schemaVersion: parsed.schemaVersion ?? 0,
      });
    } catch {
      // نسخة تالفة: تُتجاهل في القائمة ولا تُحذف تلقائيا.
    }
  }
  return result.sort((first, second) => second.backedUpAt.localeCompare(first.backedUpAt));
}

/** يقرأ نسخة احتياطية بمفتاحها ويعيد المستند الأصلي كما جاء قبل الترحيل. */
export function readMigrationBackup(key: string): TashjeerDocument | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload?: TashjeerDocument };
    return parsed.payload ?? null;
  } catch {
    return null;
  }
}

/** يحذف نسخة احتياطية واحدة (بعد تأكيد المستخدم في الواجهة). */
export function deleteMigrationBackup(key: string): void {
  if (!isBrowser()) return;
  if (!key.startsWith(BACKUP_PREFIX)) return;
  window.localStorage.removeItem(key);
}

/**
 * يحفظ نسخة احتياطية من مستند قديم قبل ترقيته. يعيد المفتاح، أو null خارج
 * المتصفح. لا يرمي: فشل الحفظ (امتلاء التخزين) لا يجب أن يوقف الاستيراد،
 * لكنه يُبلَّغ في التحذيرات.
 */
function persistMigrationBackup(document: TashjeerDocument, warnings: string[]): string | null {
  if (!isBrowser()) return null;
  const key = `${BACKUP_PREFIX}${document.ayahKey}:${Date.now()}`;
  try {
    window.localStorage.setItem(key, backupBeforeMigration(document));
    return key;
  } catch {
    warnings.push(`تعذر حفظ نسخة احتياطية للآية ${document.ayahKey} قبل الترحيل.`);
    return null;
  }
}

/** هل يحتاج المستند إلى ترحيل؟ (إصدار أقدم أو حقول v7/v8 ناقصة). */
export function needsMigration(document: Partial<TashjeerDocument>): boolean {
  const version = typeof document.schemaVersion === 'number' ? document.schemaVersion : 0;
  if (version < SCHEMA_VERSION) return true;
  if (!document.meta) return true;
  if (!Array.isArray(document.links) || !Array.isArray(document.segments)) return true;
  if (!Array.isArray(document.editLog) || !Array.isArray(document.lineOrder)) return true;
  if (!document.readingWindow) return true;
  return false;
}

/**
 * يستورد مستندات من نص JSON.
 *
 * @param json نص الملف
 * @param overwrite هل يُستبدل المستند الموجود؟ الافتراضي لا، حفاظا على عمل المستخدم.
 */
export function importDocuments(json: string, overwrite = false): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [], migrated: [], warnings: [] };

  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(json) as ExportBundle;
  } catch {
    result.errors.push('الملف ليس بصيغة JSON صالحة.');
    return result;
  }

  if (bundle.format !== 'tashjeer-export' || !Array.isArray(bundle.documents)) {
    result.errors.push('الملف ليس ملف تصدير تشجير.');
    return result;
  }

  if (typeof bundle.schemaVersion === 'number' && bundle.schemaVersion > SCHEMA_VERSION) {
    result.warnings.push(
      `الملف بإصدار ${bundle.schemaVersion} وهو أحدث من المدعوم (${SCHEMA_VERSION})؛ قد تُتجاهل حقول غير معروفة.`
    );
  }

  // ملفات الإصدار 4 تحمل القواعد العامة أيضا؛ الملف الأقدم يبقى صالحا من
  // دونها. لا نعطل استيراد آية بسبب قاعدة عامة فيها نقص.
  if (Array.isArray(bundle.globalRules)) upsertGlobalRules(bundle.globalRules);

  // سلّم الدرجات يُستورد قبل الاستثناءات، لأن معرّفات الدرجات فيها تشير إليه.
  if (bundle.strengthDegrees && Array.isArray(bundle.strengthDegrees.degrees)) {
    saveStrengthDegrees(normalizeStrengthDegrees(bundle.strengthDegrees));
  }
  if (Array.isArray(bundle.ruleOccurrences)) {
    upsertOccurrenceOverrides(bundle.ruleOccurrences, bundle.occurrenceLog ?? []);
  }

  // رتب العرض (DM-04): تُطبَّق على الكيانات المعروفة فقط؛ المجهولة تُذكر.
  if (Array.isArray(bundle.displayOrder) && bundle.displayOrder.length > 0 && isBrowser()) {
    const { catalog, applied, unknown } = applyDisplayOrder(readTransmissionCatalog(), bundle.displayOrder);
    if (applied > 0) saveTransmissionCatalog(catalog);
    if (unknown > 0) result.warnings.push(`رتب عرض لكيانات غير معروفة محليا تم تجاهلها: ${toArabicDigits(unknown)}.`);
  }

  for (const document of bundle.documents) {
    if (typeof document?.ayahKey !== 'number') {
      result.errors.push('مستند بلا معرّف آية صالح، تم تجاهله.');
      continue;
    }

    if (!overwrite && hasDocument(document.ayahKey)) {
      result.skipped += 1;
      continue;
    }

    // ترحيل تلقائي مع نسخة احتياطية: الملفات القديمة (v7 وما قبلها) تُحفظ
    // كما جاءت قبل أي تغيير، ثم تُرقّى إلى v8 (NFR-04، AC-04).
    const fromVersion = typeof document.schemaVersion === 'number' ? document.schemaVersion : 0;
    if (needsMigration(document)) {
      const backupKey = persistMigrationBackup(document, result.warnings);
      result.migrated.push({
        ayahKey: document.ayahKey,
        fromVersion,
        toVersion: SCHEMA_VERSION,
        backupKey,
      });
    }

    saveDocument(migrateDocument(document));
    result.imported += 1;
  }

  return result;
}

// ==================== الفهرس ====================

function readIndex(): DocumentIndexEntry[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as DocumentIndexEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: DocumentIndexEntry[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

function updateIndex(document: TashjeerDocument): void {
  const entries = readIndex().filter((entry) => entry.ayahKey !== document.ayahKey);

  entries.push({
    ayahKey: document.ayahKey,
    surahNumber: document.surahNumber,
    ayahNumber: document.ayahNumber,
    variantsCount: document.variants.length,
    characterVariantsCount: document.variants.filter((variant) => variant.targetKind === 'CHARACTERS').length,
    branchesCount: document.branches.length,
    status: document.meta.status,
    updatedAt: document.meta.updatedAt,
  });

  writeIndex(entries);
}

// ==================== الترقية والنسخ ====================

/**
 * يرقّي مستندا قديما إلى الصيغة الحالية.
 * حاليا يضمن وجود الحقول المطلوبة فقط، وسيتوسع مع تطور الصيغة.
 */
function migrateDocument(document: TashjeerDocument): TashjeerDocument {
  const meta: DocumentMeta = {
    createdAt: document.meta?.createdAt ?? new Date().toISOString(),
    updatedAt: document.meta?.updatedAt ?? new Date().toISOString(),
    author: document.meta?.author ?? 'محرر محلي',
    status: document.meta?.status ?? 'DRAFT',
    notes: document.meta?.notes,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    ayahKey: document.ayahKey,
    surahNumber: document.surahNumber ?? parseAyahKey(document.ayahKey).surahNumber,
    ayahNumber: document.ayahNumber ?? parseAyahKey(document.ayahKey).ayahNumber,
    variants: Array.isArray(document.variants)
      ? document.variants.map((variant) => migrateVariant(variant, document.ayahKey))
      : [],
    branches: Array.isArray(document.branches) ? document.branches : [],
    manualLines: Array.isArray(document.manualLines) ? document.manualLines : [],
    boundaries: Array.isArray(document.boundaries) ? document.boundaries : [],
    layout: {
      forcedLineBreakAfter: Array.isArray(document.layout?.forcedLineBreakAfter)
        ? document.layout.forcedLineBreakAfter.filter((position) => Number.isInteger(position) && position > 0)
        : [],
      lineOffsets:
        document.layout?.lineOffsets && typeof document.layout.lineOffsets === 'object'
          ? document.layout.lineOffsets
          : {},
    },
    // v7: حقول التحكم اليدوي. المستندات القديمة تبدأ فارغة الجيوب: لا روابط
    // ولا ترتيبا يدويا، فيعمل المحرك كما كان ثم يضيف المحرر تصحيحاته.
    lineOrder: sanitizeIdList(document.lineOrder),
    links: (Array.isArray(document.links) ? document.links : []).filter(isValidLink),
    segments: (Array.isArray(document.segments) ? document.segments : []).filter(isValidSegment),
    editLog: (Array.isArray(document.editLog) ? document.editLog : []).filter(isValidEditEntry),
    readingWindow: {
      linkNextAyah: document.readingWindow?.linkNextAyah === true,
      focusSegment: normalizeFocusSegmentValue(document.readingWindow?.focusSegment),
    },
    meta,
  };
}

/** يقبل المقطع المحفوظ إن كان مدى صحيحا، وإلا أسقطه بلا ضجيج. */
function normalizeFocusSegmentValue(
  value: { startPosition?: number; endPosition?: number } | null | undefined
): { startPosition: number; endPosition: number } | null {
  if (!value) return null;
  const start = Math.round(value.startPosition ?? 0);
  const end = Math.round(value.endPosition ?? 0);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 1 || end < start) return null;
  return { startPosition: start, endPosition: end };
}

/** يطبع موضع الحروف القديم/المستورد إلى نطاق صالح أو يعيده إلى كلمات بأمان. */
function migrateVariant(variant: Variant, ayahKey: number): Variant {
  const recitationMode =
    variant.recitationMode === 'WAQF_ONLY' || variant.recitationMode === 'WASL_ONLY'
      ? variant.recitationMode
      : undefined;
  const loci = Array.isArray(variant.loci)
    ? variant.loci.map(normalizeLocus).filter((locus) => locus.endPosition >= locus.startPosition)
    : undefined;
  const locusBounds = loci && loci.length > 0 ? boundsOfLoci(loci) : null;
  const startPosition = Math.max(1, Math.round(locusBounds?.startPosition ?? variant.startPosition ?? 1));
  const endPosition = Math.max(startPosition, Math.round(locusBounds?.endPosition ?? variant.endPosition ?? startPosition));
  const candidate = variant.characterRange;

  if (variant.targetKind === 'CHARACTERS' && candidate) {
    const words = getAyahWordsByKey(ayahKey);
    const startText = words.find((word) => word.position === candidate.start?.position)?.text;
    const endText = words.find((word) => word.position === candidate.end?.position)?.text;
    const start = {
      position: Math.max(startPosition, Math.round(candidate.start?.position ?? startPosition)),
      characterIndex: Math.max(1, Math.round(candidate.start?.characterIndex ?? 1)),
    };
    const end = {
      position: Math.min(endPosition, Math.round(candidate.end?.position ?? endPosition)),
      characterIndex: Math.max(1, Math.round(candidate.end?.characterIndex ?? 1)),
    };

    if (startText && endText && compareCharacterAnchors(start, end) <= 0) {
      const safeStart = Math.min(start.characterIndex, characterCount(startText));
      const safeEnd = Math.min(end.characterIndex, characterCount(endText));
      if (safeStart > 0 && safeEnd > 0) {
        return {
          ...variant,
          ayahKey,
          recitationMode,
          startPosition: start.position,
          endPosition: end.position,
          targetKind: 'CHARACTERS',
          characterRange: {
            start: { ...start, characterIndex: safeStart },
            end: { ...end, characterIndex: safeEnd },
          },
          loci: loci && loci.length > 1 ? loci : undefined,
        };
      }
    }
  }

  // لا نضيف حقول WORDS إلى المستندات القديمة: غيابها هو القيمة المتوافقة
  // تاريخيا، ويحافظ على ثبات ملف التصدير عند دورة استيراد/تصدير قديمة.
  const { characterRange: _ignoredCharacterRange, targetKind, ...legacy } = variant;
  const withLoci = loci && loci.length > 1 ? { loci } : {};
  return targetKind === 'WORDS'
    ? { ...legacy, ayahKey, recitationMode, startPosition, endPosition, targetKind: 'WORDS', ...withLoci }
    : { ...legacy, ayahKey, recitationMode, startPosition, endPosition, ...withLoci };
}

function cloneVariants(variants: Variant[]): Variant[] {
  return JSON.parse(JSON.stringify(variants)) as Variant[];
}

/** نسخة عميقة من قائمة خطوط، تُستخدم عند إعادة التوليد. */
export function cloneBranches(branches: TashjeerBranch[]): TashjeerBranch[] {
  return JSON.parse(JSON.stringify(branches)) as TashjeerBranch[];
}

// ==================== سجل التعديلات والروابط (v7) ====================

/** أقصى عدد أسطر في سجل التعديل، حفاظا على حد التخزين المحلي. */
export const MAX_EDIT_LOG = 500;

/** يبني سطر سجل تعديل جاهزا للإلحاق بالمستند. */
export function makeEditEntry(entry: {
  action: string;
  targetType: DocumentEditTargetType;
  targetId: string;
  summary: string;
  category?: Variant['category'];
  changes?: DocumentEditEntry['changes'];
  actor?: string;
  origin?: 'ENGINE' | 'EDITOR';
}): DocumentEditEntry {
  return {
    id: `edit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    actor: entry.actor ?? 'محرر محلي',
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    category: entry.category,
    summary: entry.summary,
    changes: entry.changes,
    origin: entry.origin ?? 'EDITOR',
  };
}

/** يضيف سطر سجل إلى مستند مع الاحتفاظ بالحد الأقصى (الأحدث آخرا). */
export function appendEditLog(
  document: TashjeerDocument,
  entry: DocumentEditEntry
): TashjeerDocument {
  const log = [...(document.editLog ?? []), entry].slice(-MAX_EDIT_LOG);
  return { ...document, editLog: log };
}

/** قائمة معرّفات نظيفة بلا تكرار ولا فراغات. */
function sanitizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && item.trim() && !seen.has(item)) seen.add(item);
  }
  return [...seen];
}

function isValidLink(value: unknown): value is TashjeerLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as TashjeerLink;
  return (
    typeof link.id === 'string' &&
    typeof link.ayahKey === 'number' &&
    typeof link.kind === 'string' &&
    typeof link.relation === 'string' &&
    Boolean(link.from) &&
    typeof link.from.id === 'string' &&
    Boolean(link.to) &&
    typeof link.to.id === 'string'
  );
}

function isValidSegment(value: unknown): value is LineSegment {
  if (!value || typeof value !== 'object') return false;
  const segment = value as LineSegment;
  return (
    typeof segment.id === 'string' &&
    typeof segment.ayahKey === 'number' &&
    typeof segment.startPosition === 'number' &&
    typeof segment.endPosition === 'number' &&
    segment.endPosition >= segment.startPosition &&
    segment.startPosition >= 1
  );
}

function isValidEditEntry(value: unknown): value is DocumentEditEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as DocumentEditEntry;
  return (
    typeof entry.id === 'string' &&
    typeof entry.at === 'string' &&
    typeof entry.summary === 'string' &&
    typeof entry.targetType === 'string'
  );
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

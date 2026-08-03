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
  DocumentMeta,
  TashjeerBranch,
  TashjeerDocument,
  Variant,
  VerificationStatus,
} from '@/types/tashjeer';
import { getSeedVariants } from '@/data/variants/seed-variants';
import { parseAyahKey } from '@/data/quran';

/** إصدار صيغة المستند الحالي. */
export const SCHEMA_VERSION = 3;

// نحتفظ بمفاتيح v2 كي تُقرأ مستندات المستخدمين القديمة ثم تُرقّى عند الحفظ.
const DOC_PREFIX = 'tashjeer:doc:v2:';
const INDEX_KEY = 'tashjeer:doc-index:v2';

/** عنصر في فهرس المستندات المحفوظة. */
export interface DocumentIndexEntry {
  ayahKey: number;
  surahNumber: number;
  ayahNumber: number;
  variantsCount: number;
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
export interface ExportBundle {
  format: 'tashjeer-export';
  schemaVersion: number;
  exportedAt: string;
  documents: TashjeerDocument[];
}

/**
 * يصدّر مستندات إلى نص JSON منسّق، صالح للحفظ كملف أو للمشاركة للمراجعة.
 * @param ayahKeys معرّفات الآيات، أو undefined لتصدير كل المحفوظ.
 */
export function exportDocuments(ayahKeys?: number[]): string {
  const keys = ayahKeys ?? listDocuments().map((entry) => entry.ayahKey);
  const documents = keys
    .map((key) => loadDocument(key))
    .filter((document): document is TashjeerDocument => document !== null);

  const bundle: ExportBundle = {
    format: 'tashjeer-export',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    documents,
  };

  return JSON.stringify(bundle, null, 2);
}

/** نتيجة عملية استيراد. */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * يستورد مستندات من نص JSON.
 *
 * @param json نص الملف
 * @param overwrite هل يُستبدل المستند الموجود؟ الافتراضي لا، حفاظا على عمل المستخدم.
 */
export function importDocuments(json: string, overwrite = false): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

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

  for (const document of bundle.documents) {
    if (typeof document?.ayahKey !== 'number') {
      result.errors.push('مستند بلا معرّف آية صالح، تم تجاهله.');
      continue;
    }

    if (!overwrite && hasDocument(document.ayahKey)) {
      result.skipped += 1;
      continue;
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
    variants: Array.isArray(document.variants) ? document.variants : [],
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
    meta,
  };
}

function cloneVariants(variants: Variant[]): Variant[] {
  return JSON.parse(JSON.stringify(variants)) as Variant[];
}

/** نسخة عميقة من قائمة خطوط، تُستخدم عند إعادة التوليد. */
export function cloneBranches(branches: TashjeerBranch[]): TashjeerBranch[] {
  return JSON.parse(JSON.stringify(branches)) as TashjeerBranch[];
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

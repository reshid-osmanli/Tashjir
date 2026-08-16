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
import { getAyahByKey, getAyahWordsByKey } from '@/data/quran';
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
import { getSeedVariants } from '@/data/variants/seed-variants';
import { parseAyahKey } from '@/data/quran';

/**
 * إصدار صيغة المستند الحالي.
 *
 * v5: القواعد العامة النمطية تُحفظ في الحزمة.
 * v6: درجات قوة الوجه لكل راوٍ، واستثناءات مواضع القواعد وسجلّها.
 */
export const SCHEMA_VERSION = 6;

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

  return exportDocumentBundle(documents);
}

/**
 * يصدّر مستندا موجودا في ذاكرة المحرر، حتى قبل الضغط على «حفظ». هذا مهم
 * لتسليم JSON لكل آية: لا يصبح الملف فارغا عند تصدير آية جديدة أو مسودة.
 */
export function exportDocument(document: TashjeerDocument): string {
  return exportDocumentBundle([migrateDocument(document)]);
}

/** يصدر آية من فهرس المصحف حتى إن لم يسبق حفظ مستند لها. */
export function exportAyahDocument(ayahKey: number): string {
  return exportDocumentBundle([loadDocument(ayahKey) ?? createDocument(ayahKey)]);
}

function exportDocumentBundle(documents: TashjeerDocument[]): string {
  // قراءة واحدة للمخزن: الاستثناءات وسجلها يخرجان معا فلا يُقرأ المخزن مرتين.
  const occurrences = exportOccurrenceData();
  const bundle: ExportBundle = {
    format: 'tashjeer-export',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    globalRules: listGlobalRules(),
    strengthDegrees: readStrengthDegrees(),
    ruleOccurrences: occurrences.overrides,
    occurrenceLog: occurrences.log,
    ayahs: documents.map(makeAyahSnapshot),
    documents,
  };

  return JSON.stringify(bundle, null, 2);
}

function makeAyahSnapshot(document: TashjeerDocument): ExportedAyahSnapshot {
  const ayah = getAyahByKey(document.ayahKey);
  return {
    ayahKey: document.ayahKey,
    surahNumber: document.surahNumber,
    ayahNumber: document.ayahNumber,
    text: ayah?.text ?? '',
    words: getAyahWordsByKey(document.ayahKey).map((word) => ({
      id: word.id,
      position: word.position,
      text: word.text,
    })),
  };
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
    meta,
  };
}

/** يطبع موضع الحروف القديم/المستورد إلى نطاق صالح أو يعيده إلى كلمات بأمان. */
function migrateVariant(variant: Variant, ayahKey: number): Variant {
  const startPosition = Math.max(1, Math.round(variant.startPosition ?? 1));
  const endPosition = Math.max(startPosition, Math.round(variant.endPosition ?? startPosition));
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
          startPosition: start.position,
          endPosition: end.position,
          targetKind: 'CHARACTERS',
          characterRange: {
            start: { ...start, characterIndex: safeStart },
            end: { ...end, characterIndex: safeEnd },
          },
        };
      }
    }
  }

  // لا نضيف حقول WORDS إلى المستندات القديمة: غيابها هو القيمة المتوافقة
  // تاريخيا، ويحافظ على ثبات ملف التصدير عند دورة استيراد/تصدير قديمة.
  const { characterRange: _ignoredCharacterRange, targetKind, ...legacy } = variant;
  return targetKind === 'WORDS'
    ? { ...legacy, ayahKey, startPosition, endPosition, targetKind: 'WORDS' }
    : { ...legacy, ayahKey, startPosition, endPosition };
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

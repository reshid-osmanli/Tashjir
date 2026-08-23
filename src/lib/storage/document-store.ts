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

/**
 * إصدار صيغة المستند الحالي.
 *
 * v5: القواعد العامة النمطية تُحفظ في الحزمة.
 * v6: درجات قوة الوجه لكل راوٍ، واستثناءات مواضع القواعد وسجلّها.
 * v7: التحكم اليدوي الكامل: روابط الأوجه والأسطر، أجزاء الأسطر، ترتيب
 *     الأسطر اليدوي، وسجل تعديلات المحرر (المصدر: محرك/محرر).
 * v8: شروط الوقف/الوصل، منع الوصل، ولقطة نتيجة المحرك قبل التصحيح.
 * v9: بيئة احترافية: استقلال الاختلافات لنفس القارئ/الكلمة، مجموعات مستقلة،
 *     ترتيب صريح للقراء، وقفا فقط/وصلا فقط، منع وصل، وقف وابتداء احترافي،
 *     مصدر Engine/Editor/Final، ونظام تحديد موحد.
 */
export const SCHEMA_VERSION = 9;

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
    // كلمات نافذة العمل: تشمل الآية التالية إن وصلها المحقق، فيبقى الملف
    // المصدَّر مفهوما بذاته ولو كان الحكم واقعا بين آيتين.
    words: documentWindowWords(document).map((word) => ({
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
    variant.recitationMode === 'WAQF_ONLY' || variant.recitationMode === 'WASL_ONLY' ? variant.recitationMode : undefined;
  const loci = Array.isArray(variant.loci)
    ? variant.loci.map(normalizeLocus).filter((locus) => locus.endPosition >= locus.startPosition)
    : undefined;
  const locusBounds = loci && loci.length > 0 ? boundsOfLoci(loci) : null;
  const startPosition = Math.max(1, Math.round(locusBounds?.startPosition ?? variant.startPosition ?? 1));
  const endPosition = Math.max(startPosition, Math.round(locusBounds?.endPosition ?? variant.endPosition ?? startPosition));
  const candidate = variant.characterRange;

  let migrated: Variant = variant as Variant;

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
        migrated = {
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
        } as Variant;
      }
    }
  }

  if (migrated === variant) {
    const { characterRange: _ignored, targetKind, ...legacy } = variant as any;
    const withLoci = loci && loci.length > 1 ? { loci } : {};
    migrated =
      targetKind === 'WORDS'
        ? ({ ...legacy, ayahKey, recitationMode, startPosition, endPosition, targetKind: 'WORDS', ...withLoci } as Variant)
        : ({ ...legacy, ayahKey, recitationMode, startPosition, endPosition, ...withLoci } as Variant);
  }

  // v9 حقول جديدة - قيم افتراضية آمنة
  // البذرة القديمة بلا origin تعتبر ENGINE، أما الجديد بلا origin من المحرر فيُعامل EDITOR عبر addVariant.
  // هنا في الترقية، نحافظ على سلوك التتبع القديم: ما لا origin له = ENGINE.
  const defaultOrigin = (migrated as any).origin ?? (migrated as any).source ?? (migrated.status === 'DRAFT' && (migrated as any).id?.startsWith('v-') ? 'ENGINE' : undefined);
  return {
    ...migrated,
    source: (migrated as any).source ?? defaultOrigin ?? 'ENGINE',
    origin: (migrated as any).origin ?? defaultOrigin ?? 'ENGINE',
    isIndependent: (migrated as any).isIndependent ?? true,
    batchGroupId: (migrated as any).batchGroupId,
    subType: (migrated as any).subType,
    waqfContext: (migrated as any).waqfContext ?? (recitationMode ? { mode: recitationMode } : undefined),
    correction: (migrated as any).correction ?? {
      final: migrated.title,
      engine: (migrated as any).engineSnapshot?.title,
      editor: (migrated as any).origin === 'EDITOR' ? migrated.title : undefined,
    },
  } as Variant;
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

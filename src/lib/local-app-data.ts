// بيانات التطبيق المحلية - Local App Data
// مشروع التشجير - نظام القراءات العشر
//
// هذا الملف يخدم الصفحات المساندة (المراجعة، القراء، الإحصاءات، الإعدادات).
// أما مستندات التشجير نفسها فمخزنها الوحيد هو @/lib/storage/document-store،
// وهذا الملف يقرأ منه ولا يكتب فيه، حتى لا يوجد مصدران للحقيقة.

import type { VariantCategory } from '@/types';
import type { ReadingScope, VerificationStatus } from '@/types/tashjeer';
import { listDocuments, loadDocument } from '@/lib/storage/document-store';
import { readTransmissionCatalog } from '@/lib/transmissions/catalog';
import { resolveScope } from '@/lib/tashjeer/scope';
import { getSurahOrFirst } from '@/data/quran';

const REVIEW_STORAGE_KEY = 'tashjeer:reviews:v2';
const READERS_STORAGE_KEY = 'tashjeer:readers:v2';
const SETTINGS_STORAGE_KEY = 'tashjeer:settings:v2';

// ==================== المراجعة ====================

/** قرار مراجعة على وجه واحد من أوجه اختلاف. */
export type LocalReviewDecision = {
  status: VerificationStatus;
  comment: string;
  reviewer: string;
  updatedAt: string;
};

/** عنصر قابل للمراجعة: وجه واحد داخل اختلاف داخل آية. */
export type ReviewableItem = {
  /** مفتاح فريد: ayahKey:variantId:alternativeId */
  key: string;
  ayahKey: number;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  variantId: string;
  variantTitle: string;
  category: VariantCategory;
  alternativeId: string;
  alternativeLabel: string;
  alternativeText: string;
  /** عدد الرواة الذين يقرأون بهذا الوجه */
  narratorsCount: number;
  /** عدد الأدلة المسجّلة */
  evidencesCount: number;
  /** حالة الاختلاف كما سجّلها المحرر */
  authorStatus: VerificationStatus;
  updatedAt: string;
  review: LocalReviewDecision;
};

/**
 * يبني قائمة العناصر القابلة للمراجعة من كل المستندات المحفوظة.
 * كل وجه غير أساسي هو وحدة مراجعة مستقلة، لأن الاعتماد يقع على الوجه لا الاختلاف.
 */
export function readReviewableItems(): ReviewableItem[] {
  const reviews = readReviewStatuses();
  const items: ReviewableItem[] = [];

  for (const entry of listDocuments()) {
    const document = loadDocument(entry.ayahKey);
    if (!document) continue;

    const surahName = getSurahOrFirst(document.surahNumber).name;

    for (const variant of document.variants) {
      for (const alternative of variant.alternatives) {
        if (alternative.isBase) continue;

        const key = `${document.ayahKey}:${variant.id}:${alternative.id}`;

        items.push({
          key,
          ayahKey: document.ayahKey,
          surahNumber: document.surahNumber,
          surahName,
          ayahNumber: document.ayahNumber,
          variantId: variant.id,
          variantTitle: variant.title,
          category: variant.category,
          alternativeId: alternative.id,
          alternativeLabel: alternative.label,
          alternativeText: alternative.text,
          narratorsCount: countScopeNarrators(alternative.scope),
          evidencesCount: alternative.evidences?.length ?? 0,
          authorStatus: variant.status,
          updatedAt: document.meta.updatedAt,
          review: reviews[key] ?? createPendingReview(),
        });
      }
    }
  }

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** يقرأ كل قرارات المراجعة المخزّنة. */
export function readReviewStatuses(): Record<string, LocalReviewDecision> {
  return readJson<Record<string, LocalReviewDecision>>(REVIEW_STORAGE_KEY, {});
}

/** يحفظ قرار مراجعة على عنصر. */
export function saveReviewDecision(
  key: string,
  decision: Omit<LocalReviewDecision, 'updatedAt'>
): void {
  const reviews = readReviewStatuses();
  reviews[key] = { ...decision, updatedAt: new Date().toISOString() };
  writeJson(REVIEW_STORAGE_KEY, reviews);
}

// ==================== القراء والإجازات ====================

export type LocalIjazah = {
  id: string;
  qiraahName: string;
  narratorName: string;
  granter: string;
  grantedAt: string;
  paths: string[];
};

export type LocalReader = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  ijazat: LocalIjazah[];
};

/** يقرأ قائمة القراء المسجّلين محليا. */
export function readStoredReaders(): LocalReader[] {
  return readJson<LocalReader[]>(READERS_STORAGE_KEY, []);
}

/** يحفظ قائمة القراء. */
export function saveStoredReaders(readers: LocalReader[]): void {
  writeJson(READERS_STORAGE_KEY, readers);
}

// ==================== الإعدادات ====================

export type LocalAppSettings = {
  appName: string;
  /** حجم خط المصحف الافتراضي في المحرر */
  fontSize: number;
  /** التكبير الافتراضي */
  defaultZoom: number;
  /** إظهار الشبكة عند فتح المحرر */
  showGrid: boolean;
  /** إظهار المساطر عند فتح المحرر */
  showRulers: boolean;
  /** إظهار بطاقات الأوجه */
  showLabels: boolean;
  /** اسم المحرر، يُسجَّل في بيانات المستند */
  authorName: string;
};

export const DEFAULT_APP_SETTINGS: LocalAppSettings = {
  appName: 'مشروع التشجير',
  fontSize: 34,
  defaultZoom: 1,
  showGrid: false,
  showRulers: false,
  showLabels: true,
  authorName: 'محرر محلي',
};

/** يقرأ الإعدادات مدموجة مع الافتراضيات. */
export function readStoredSettings(): LocalAppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...readJson<Partial<LocalAppSettings>>(SETTINGS_STORAGE_KEY, {}),
  };
}

/** يحفظ الإعدادات. */
export function saveStoredSettings(settings: LocalAppSettings): void {
  writeJson(SETTINGS_STORAGE_KEY, settings);
}

// ==================== أدوات ====================

/** يولّد معرّفا محليا فريدا بما يكفي داخل متصفح واحد. */
export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** يصوغ تاريخا بصيغة عربية قصيرة. */
export function formatLocalDate(value?: string): string {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value)
    );
  } catch {
    return '—';
  }
}

function countScopeNarrators(scope: ReadingScope): number {
  // نفس الكتالوج الذي يرسم به المحرر، حتى تظهر إضافة راو جديد في المراجعة
  // والإحصاءات ولا تبقى الأرقام محصورة في الرواة العشرين الافتراضيين.
  return resolveScope(scope, readTransmissionCatalog()).length;
}

function createPendingReview(): LocalReviewDecision {
  return { status: 'DRAFT', comment: '', reviewer: '', updatedAt: '' };
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

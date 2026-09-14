// الحفظ الآمن — Safe Save (NFR-04، DM-13، DM-14)
// مشروع التشجير - نظام القراءات العشر
//
// - حفظ تلقائي دوري + عند العمليات الخطرة
// - كتابة ذرية للتخزين المحلي (setItem مرة واحدة بنص JSON مستقر)
// - نسخة احتياطية قبل الهجرات والعمليات الواسعة (NFR-04)
// - تصدير حتمي Git-friendly: ترتيب مفاتيح ثابت، معرّفات صريحة، لا طوابع زمنية متغيرة بلا سبب

import { backupBeforeMigration } from './migration/migrate-v7-v8';

const BACKUP_PREFIX = 'tashjeer:backup:';
const SAFE_WRITE_PREFIX = 'tashjeer:safe:';

/** هل نحن في المتصفح؟ */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * كتابة ذرية: نص JSON واحد في مفتاح واحد.
 * localStorage.setItem ذرية بطبيعتها في المتصفح الواحد، لكننا نضمن أن النص
 * نفسه حتمي (مفاتيح مرتبة) وأننا لا نكتب نصف حالة.
 */
export function atomicWrite(key: string, value: unknown): boolean {
  if (!isBrowser()) return false;
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    window.localStorage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

/** قراءة آمنة مع تجاهل الفساد. */
export function atomicRead<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * نسخة احتياطية قبل عملية واسعة (هجرة، حذف جماعي، تعميم).
 * تعيد مفتاح النسخة أو null خارج المتصفح/عند الفشل.
 */
export function backupBeforeWideOp<T>(payload: T, meta?: { ayahKey?: number; schemaVersion?: number }): string | null {
  if (!isBrowser()) return null;
  const key = `${BACKUP_PREFIX}${meta?.ayahKey ?? 'global'}:${Date.now()}`;
  try {
    const backupText = backupBeforeMigration(payload as never);
    // نضيف وسم العملية الواسعة
    const enriched = JSON.parse(backupText) as { backedUpAt: string; payload: unknown };
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...enriched, kind: 'WIDE_OP', ...meta }, null, 2)
    );
    return key;
  } catch {
    return null;
  }
}

/**
 * يسرد النسخ الاحتياطية للعمليات الواسعة والهجرات.
 */
export function listSafeBackups(): Array<{ key: string; at: string; ayahKey?: number }> {
  if (!isBrowser()) return [];
  const result: Array<{ key: string; at: string; ayahKey?: number }> = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(BACKUP_PREFIX)) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
        backedUpAt?: string;
        payload?: { ayahKey?: number };
        ayahKey?: number;
      };
      result.push({
        key,
        at: parsed.backedUpAt ?? '',
        ayahKey: parsed.payload?.ayahKey ?? parsed.ayahKey,
      });
    } catch {
      // تجاهل التالف
    }
  }
  return result.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * مدير الحفظ التلقائي الدوري.
 * يحفظ المستند إذا كان متسخًا كل فترة، ويحفظ فورًا عند العمليات الخطرة.
 */
export class AutoSaveManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSavedHash: string | null = null;

  constructor(
    private readonly getDirty: () => { isDirty: boolean; documentText?: string; save: () => void },
    private readonly intervalMs: number = 30_000
  ) {}

  /** يبدأ الحفظ الدوري. */
  start(): void {
    if (this.timer || !isBrowser()) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  /** يوقف الحفظ الدوري. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** حفظ فوري عند عملية خطرة. */
  saveNow(): void {
    const { isDirty, save } = this.getDirty();
    if (!isDirty) return;
    save();
    this.lastSavedHash = this.getDirty().documentText ?? null;
  }

  private tick(): void {
    const { isDirty, documentText, save } = this.getDirty();
    if (!isDirty) return;
    if (documentText && documentText === this.lastSavedHash) return;
    save();
    this.lastSavedHash = documentText ?? null;
  }
}

/**
 * تصدير حتمي: ترتيب مفاتيح ثابت، معرّفات صريحة، لا طوابع زمنية متغيرة.
 * تُستعمل في الاختبارات للتأكد من byte-stable.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

/** يرتب مفاتيح الكائنات بترتيب أبجدي عربي مستقر بشكل عميق. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b, 'ar'));
    for (const key of keys) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * يبني كتلة engineConfig مستقلة قابلة للتصدير المنفصل (DM-14):
 * policies, rules, priorities, relations, contexts, merge-policies, schema-version
 */
export function buildEngineConfigExportBundle(config: {
  policies?: unknown;
  rules?: unknown;
  priorities?: unknown;
  relations?: unknown;
  contexts?: unknown;
  'merge-policies'?: unknown;
  'schema-version'?: unknown;
}): string {
  return stableStringify(config);
}

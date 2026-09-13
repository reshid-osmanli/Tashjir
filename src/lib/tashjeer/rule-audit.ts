// سجل تدقيق استوديو المحرك — Engine Studio Audit Trail (FR-ES-07.6)
// مشروع التشجير - نظام القراءات العشر
//
// كل تعديل في Engine Studio يُسجَّل: `User, Action, Rule, Before, After,
// Reason, Timestamp`. السجل قابل للتصفية والعرض في لوحة تدقيق، ويدخل التصدير
// ضمن حزمة الحوكمة الحتمية (DM-13).
//
// مبدأ «لا يُفقد تاريخ أبدًا» يسري على السجل نفسه: الإضافة فقط، والحدّ
// AUDIT_LIMIT يطوي الأقدم عند الامتلاء (موثّق، لا حذف صامت للتغيير الأخير).
//
// الطبقة النقيّة (بناء القيود/التصفية/التسلسل) منفصلة عن طبقة التخزين حتى
// تُختبر بلا متصفح، والدوال تقبل حقن الوقت والمعرّف للاختبارات الحتمية.

import type { AuditChange, EngineRule, StudioAuditAction, StudioAuditEntry } from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';
import { diffRuleFields, stableStringify, summarizeChanges } from './rule-diff';

export const AUDIT_STORAGE_KEY = 'tashjeer:rule-audit:v1';
export const AUDIT_EVENT = 'tashjeer:rule-audit-change';
/** الحد الأعلى للقيود المحفوظة؛ الأقدم يُطوى أولًا. */
export const AUDIT_LIMIT = 500;
/**
 * من «User» مع غياب المصادقة؟ قيمة افتراضية ثابتة حتى تفعيل المصادقة لاحقًا؛
 * البنية (`actor`) جاهزة فلا يلزم ترحيل عند وصولها.
 */
export const DEFAULT_AUDIT_ACTOR = 'local-editor';

/** تسميات عربية لأفعال التدقيق (تُستعمل في الملخّص وفي لوحة التصفية). */
export const AUDIT_ACTION_LABELS: Record<StudioAuditAction, string> = {
  RULE_CREATED: 'إنشاء قاعدة',
  RULE_UPDATED: 'تعديل قاعدة',
  RULE_STATUS_CHANGED: 'تغيير حالة',
  RULE_PRIORITY_CHANGED: 'تغيير أولوية',
  RULE_PROTECTED_TOGGLED: 'تغيير وسم الحماية',
  RULE_ROLLED_BACK: 'رجوع لإصدار',
  RULE_DELETED: 'حذف قاعدة',
  CONFLICT_TAGGED: 'وسم تعارض',
  CONFLICT_CLEARED: 'رفع وسم تعارض',
  TESTS_RUN: 'تشغيل الاختبارات',
  REGRESSION_OVERRIDE: 'تجاوز انحدار',
  PROFILE_PUBLISHED: 'نشر الملف',
  PROFILE_ROLLED_BACK: 'استرجاع نسخة الملف',
  PROFILE_IMPORTED: 'استيراد ملف',
  PROFILE_RESET: 'إعادة ضبط الملف',
};

/** الأفعال التي تُعدّ «خطِرة» فتُبرز في لوحة التدقيق. */
export const AUDIT_DANGER_ACTIONS: StudioAuditAction[] = [
  'RULE_DELETED',
  'RULE_ROLLED_BACK',
  'REGRESSION_OVERRIDE',
  'CONFLICT_TAGGED',
  'PROFILE_RESET',
];

/** مدخلات بناء قيد تدقيق. */
export interface AuditInput {
  action: StudioAuditAction;
  ruleId?: string;
  ruleName?: string;
  /** before/after: تُحسب منهما التغييرات تلقائيًا إن لم تُمرَّر `changes`. */
  before?: EngineRule | null;
  after?: EngineRule | null;
  changes?: AuditChange[];
  reason?: string;
  actor?: string;
  version?: number;
  summary?: string;
  override?: boolean;
  /** حقن الوقت والمعرّف (للاختبارات الحتمية). */
  at?: string;
  id?: string;
}

/** يبني قيد تدقيق كاملًا من المدخلات (دالة نقيّة). */
export function createAuditEntry(input: AuditInput): StudioAuditEntry {
  const at = input.at ?? new Date().toISOString();
  const changes =
    input.changes ??
    (input.after ? diffRuleFields(input.before ?? null, input.after) : undefined);
  const ruleName = input.ruleName ?? input.after?.name ?? input.before?.name;
  const detail = changes && changes.length > 0 ? summarizeChanges(changes) : undefined;

  const summary =
    input.summary ??
    [
      AUDIT_ACTION_LABELS[input.action],
      ruleName ? `«${ruleName}»` : undefined,
      detail ? `(${detail})` : undefined,
    ]
      .filter(Boolean)
      .join(' ');

  const entry: StudioAuditEntry = {
    id: input.id ?? createEntityId('aud'),
    at,
    actor: input.actor ?? DEFAULT_AUDIT_ACTOR,
    action: input.action,
    summary,
  };
  const ruleId = input.ruleId ?? input.after?.id ?? input.before?.id;
  if (ruleId) entry.ruleId = ruleId;
  if (ruleName) entry.ruleName = ruleName;
  const version = input.version ?? input.after?.version;
  if (typeof version === 'number') entry.version = version;
  if (changes && changes.length > 0) entry.changes = changes;
  const reason = input.reason?.trim();
  if (reason) entry.reason = reason;
  if (input.override) entry.override = true;
  return entry;
}

// ==================== التصفية والعرض ====================

/** مرشّحات لوحة التدقيق (FR-ES-07.6: قابلة للتصفية). */
export interface AuditFilter {
  actor?: string | 'ALL';
  actions?: StudioAuditAction[];
  ruleId?: string | 'ALL';
  /** بداية ونهاية المدى الزمني (ISO). */
  from?: string;
  to?: string;
  query?: string;
  overrideOnly?: boolean;
  limit?: number;
}

const EMPTY_FILTER: AuditFilter = { actor: 'ALL', ruleId: 'ALL' };

/** يطبّع نص البحث (بلا حساسية لحالة الأحرف ولا للمسافات الزائدة). */
function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** هل القيد داخل المدى الزمني؟ */
function withinRange(entry: StudioAuditEntry, from?: string, to?: string): boolean {
  if (from && entry.at < from) return false;
  if (to && entry.at > to) return false;
  return true;
}

/** يصفّي قيود التدقيق (نقيّة، الأحدث أولًا كما يُخزَّن). */
export function filterAuditEntries(
  entries: StudioAuditEntry[],
  filter: AuditFilter = EMPTY_FILTER
): StudioAuditEntry[] {
  const query = filter.query ? normalizeQuery(filter.query) : '';
  const actions = filter.actions && filter.actions.length > 0 ? new Set(filter.actions) : null;

  const result = entries.filter((entry) => {
    if (filter.actor && filter.actor !== 'ALL' && entry.actor !== filter.actor) return false;
    if (filter.ruleId && filter.ruleId !== 'ALL' && entry.ruleId !== filter.ruleId) return false;
    if (actions && !actions.has(entry.action)) return false;
    if (filter.overrideOnly && !entry.override) return false;
    if (!withinRange(entry, filter.from, filter.to)) return false;
    if (query) {
      const haystack = normalizeQuery(
        [entry.summary, entry.ruleName ?? '', entry.ruleId ?? '', entry.reason ?? '', AUDIT_ACTION_LABELS[entry.action]].join(' ')
      );
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return typeof filter.limit === 'number' && filter.limit > 0 ? result.slice(0, filter.limit) : result;
}

/** أوجه التصفية المتاحة من السجل نفسه (لبناء قوائم اللوحة). */
export function auditFacets(entries: StudioAuditEntry[]): {
  actors: string[];
  actions: StudioAuditAction[];
  rules: Array<{ id: string; name: string }>;
  days: string[];
} {
  const actors = new Set<string>();
  const actions = new Set<StudioAuditAction>();
  const rules = new Map<string, string>();
  const days = new Set<string>();
  for (const entry of entries) {
    actors.add(entry.actor);
    actions.add(entry.action);
    if (entry.ruleId) rules.set(entry.ruleId, entry.ruleName ?? entry.ruleId);
    days.add(entry.at.slice(0, 10));
  }
  return {
    actors: Array.from(actors).sort(),
    actions: Array.from(actions).sort(),
    rules: Array.from(rules.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    days: Array.from(days).sort().reverse(),
  };
}

/** عدد القيود لكل فعل (لشارة العدّاد في لوحة التدقيق). */
export function countByAction(entries: StudioAuditEntry[]): Array<{ action: StudioAuditAction; count: number }> {
  const counts = new Map<StudioAuditAction, number>();
  for (const entry of entries) counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}

// ==================== التصدير الحتمي (DM-13) ====================

/**
 * صيغة كنسية لقيد تدقيق: ترتيب مفاتيح ثابت وتغييرات مرتبة بأسماء حقولها،
 * فيعطي نفس السجل نفس النص بايتًا ويظهر فرق Git سطرًا لكل قيد جديد.
 */
export function toCanonicalAuditEntry(entry: StudioAuditEntry): Record<string, unknown> {
  const canonical: Record<string, unknown> = {
    id: entry.id,
    at: entry.at,
    actor: entry.actor,
    action: entry.action,
  };
  if (entry.ruleId) canonical.ruleId = entry.ruleId;
  if (entry.ruleName) canonical.ruleName = entry.ruleName;
  if (typeof entry.version === 'number') canonical.version = entry.version;
  canonical.summary = entry.summary;
  if (entry.reason) canonical.reason = entry.reason;
  if (entry.override) canonical.override = true;
  if (entry.changes && entry.changes.length > 0) {
    canonical.changes = [...entry.changes]
      .sort((a, b) => a.field.localeCompare(b.field))
      .map((change) => {
        const item: Record<string, unknown> = { field: change.field, label: change.label };
        if (change.before !== undefined) item.before = change.before;
        if (change.after !== undefined) item.after = change.after;
        return item;
      });
  }
  return canonical;
}

/** يرتّب السجل ترتيبًا حتميًا (بالوقت ثم المعرّف) للتصدير. */
export function toCanonicalAuditTrail(entries: StudioAuditEntry[]): Array<Record<string, unknown>> {
  return [...entries]
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .map(toCanonicalAuditEntry);
}

/** يُسلسل سجل التدقيق نصًا حتميًا (جزء من حزمة الحوكمة). */
export function serializeAuditTrail(entries: StudioAuditEntry[]): string {
  return JSON.stringify(toCanonicalAuditTrail(entries), null, 2) + '\n';
}

// ==================== التخزين (المتصفح) ====================

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** يقرأ السجل كاملًا (الأحدث أولًا). */
export function listAuditEntries(): StudioAuditEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioAuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: StudioAuditEntry[]): StudioAuditEntry[] {
  const trimmed = entries.slice(0, AUDIT_LIMIT);
  if (isBrowser()) {
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(AUDIT_EVENT, { detail: trimmed }));
    }
  }
  return trimmed;
}

/** يضيف قيدًا إلى السجل ويعيد السجل الجديد (الأحدث أولًا). */
export function appendAuditEntry(entry: StudioAuditEntry): StudioAuditEntry[] {
  return writeEntries([entry, ...listAuditEntries()]);
}

/** يبني قيدًا ويضيفه في خطوة واحدة (الطريق المعتاد من الواجهة والمخزن). */
export function recordAudit(input: AuditInput): StudioAuditEntry {
  const entry = createAuditEntry(input);
  appendAuditEntry(entry);
  return entry;
}

/** يضيف عدة قيود دفعة واحدة (وسم تعارض على عدة قواعد مثلًا). */
export function recordAuditBatch(inputs: AuditInput[]): StudioAuditEntry[] {
  const entries = inputs.map(createAuditEntry);
  writeEntries([...entries.reverse(), ...listAuditEntries()]);
  return entries.reverse();
}

/** يمسح السجل (يُستعمل عند استيراد حزمة حوكمة تحلّ محلّه). */
export function clearAuditTrail(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(AUDIT_STORAGE_KEY);
}

/** يستبدل السجل كاملًا (استيراد حزمة حوكمة). */
export function replaceAuditTrail(entries: StudioAuditEntry[]): StudioAuditEntry[] {
  return writeEntries(entries);
}

/** بصمة حتمية للسجل (لمقارنة «هل تغيّر؟» قبل التصدير). */
export function auditFingerprint(entries: StudioAuditEntry[]): string {
  return stableStringify(toCanonicalAuditTrail(entries));
}

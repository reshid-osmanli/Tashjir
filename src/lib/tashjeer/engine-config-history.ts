// سجل إصدارات ملف المحرك — Engine Config History (FR-ES-07، FR-ES-14، NFR-05)
// مشروع التشجير - نظام القراءات العشر
//
// كل «حفظ» في الاستوديو يلتقط نسخة كاملة من الملف قبل التغيير، مع سجل تدقيق
// موجز: ماذا تغيّر (قواعد أُضيفت/عُدّلت/حُذفت، صفوف مصفوفة، سلم التعارض،
// ترتيب التنفيذ) ومتى ولماذا (ملاحظة اختيارية). التراجع (rollback) يعيد
// نسخة بعينها إلى الملف الحي عبر نفس مسار الحفظ، فلا منطق مكرر.
//
// طبقة نقيّة فوق localStorage تُحقن كأي مخزن آخر في الاختبارات.

import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { normalizeEngineConfig, serializeEngineConfig } from '@/lib/tashjeer/engine-config-store';

export const ENGINE_HISTORY_STORAGE_KEY = 'tashjeer:engine-config-history:v1';
/** الحد الأعلى للنسخ المحفوظة؛ الأقدم يُطوى أولا. */
export const ENGINE_HISTORY_LIMIT = 40;

/** تغيير واحد في سجل التدقيق. */
export interface EngineAuditEntry {
  kind:
    | 'RULE_ADDED'
    | 'RULE_REMOVED'
    | 'RULE_CHANGED'
    | 'MATRIX_CHANGED'
    | 'POLICY_CHANGED'
    | 'ORDER_CHANGED'
    | 'GROUPS_CHANGED'
    | 'CONTEXTS_CHANGED'
    | 'PROFILE_RENAMED';
  /** وصف عربي مختصر يُعرض في القائمة. */
  label: string;
  /** معرّف القاعدة المعنية إن وُجد (للرابط العميق). */
  ruleId?: string;
}

/** نسخة محفوظة من الملف. */
export interface EngineConfigVersion {
  id: string;
  /** رقم متسلسل تصاعدي داخل السجل (١، ٢، ٣...). */
  seq: number;
  createdAt: string;
  /** سبب الالتقاط: حفظ، استرجاع، استيراد، إعادة ضبط. */
  source: 'SAVE' | 'ROLLBACK' | 'IMPORT' | 'RESET';
  note?: string;
  /** إن كان استرجاعا: النسخة التي استُرجعت. */
  restoredFrom?: string;
  /** ملخّص التغييرات مقارنة بالنسخة السابقة. */
  audit: EngineAuditEntry[];
  /** ملخّص كمي للنسخة نفسها. */
  stats: { rules: number; active: number; matrix: number };
  /** الملف الكامل (مطبّع). */
  config: EngineConfig;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function newId(): string {
  return `ecv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** يقرأ السجل كاملا (الأحدث أولا). */
export function listEngineVersions(): EngineConfigVersion[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ENGINE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EngineConfigVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVersions(versions: EngineConfigVersion[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ENGINE_HISTORY_STORAGE_KEY, JSON.stringify(versions.slice(0, ENGINE_HISTORY_LIMIT)));
}

/** يمسح السجل (يُستعمل عند إعادة ضبط شاملة مؤكَّدة). */
export function clearEngineVersions(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ENGINE_HISTORY_STORAGE_KEY);
}

function ruleFingerprint(rule: EngineRule): string {
  // نستبعد الطوابع الزمنية ورقم الإصدار حتى لا يُعدّ الحفظ المكرر تغييرا.
  const { updatedAt: _u, createdAt: _c, version: _v, ...rest } = rule;
  void _u;
  void _c;
  void _v;
  return JSON.stringify(rest);
}

/** يحسب سجل التدقيق بين ملفّين (قبل/بعد). دالة نقيّة. */
export function diffEngineConfigs(before: EngineConfig | null, after: EngineConfig): EngineAuditEntry[] {
  const entries: EngineAuditEntry[] = [];
  if (!before) {
    entries.push({ kind: 'RULE_ADDED', label: `نسخة أولى: ${after.rules.length} قاعدة` });
    return entries;
  }
  const beforeRules = new Map(before.rules.map((rule) => [rule.id, rule]));
  const afterRules = new Map(after.rules.map((rule) => [rule.id, rule]));
  for (const [id, rule] of afterRules) {
    const previous = beforeRules.get(id);
    if (!previous) entries.push({ kind: 'RULE_ADDED', label: `أُضيفت قاعدة «${rule.name}»`, ruleId: id });
    else if (ruleFingerprint(previous) !== ruleFingerprint(rule)) {
      const details: string[] = [];
      if (previous.priority !== rule.priority) details.push(`الأولوية ${previous.priority} إلى ${rule.priority}`);
      if (previous.status !== rule.status) details.push(`الحالة ${previous.status} إلى ${rule.status}`);
      if (previous.name !== rule.name) details.push('الاسم');
      if (JSON.stringify(previous.conditions) !== JSON.stringify(rule.conditions)) details.push('الشروط');
      if (JSON.stringify(previous.actions) !== JSON.stringify(rule.actions)) details.push('الإجراءات');
      if (previous.groupId !== rule.groupId) details.push('المجموعة');
      entries.push({
        kind: 'RULE_CHANGED',
        label: `عُدّلت قاعدة «${rule.name}»${details.length > 0 ? `: ${details.join('، ')}` : ''}`,
        ruleId: id,
      });
    }
  }
  for (const [id, rule] of beforeRules) {
    if (!afterRules.has(id)) entries.push({ kind: 'RULE_REMOVED', label: `حُذفت قاعدة «${rule.name}»`, ruleId: id });
  }
  if (JSON.stringify(before.mergeMatrix) !== JSON.stringify(after.mergeMatrix)) {
    entries.push({
      kind: 'MATRIX_CHANGED',
      label: `تغيّرت مصفوفة الدمج (${before.mergeMatrix.length} إلى ${after.mergeMatrix.length} صفا)`,
    });
  }
  if (before.conflictPolicy.join('|') !== after.conflictPolicy.join('|')) {
    entries.push({ kind: 'POLICY_CHANGED', label: `تغيّر سلم حل التعارض: ${after.conflictPolicy.join(' ← ')}` });
  }
  if (before.executionOrder.join('|') !== after.executionOrder.join('|')) {
    entries.push({ kind: 'ORDER_CHANGED', label: `تغيّر ترتيب التنفيذ: ${after.executionOrder.join(' ← ')}` });
  }
  if (JSON.stringify(before.priorityGroups) !== JSON.stringify(after.priorityGroups)) {
    entries.push({ kind: 'GROUPS_CHANGED', label: 'تغيّرت مجموعات الأولوية' });
  }
  if (JSON.stringify(before.contexts) !== JSON.stringify(after.contexts)) {
    entries.push({ kind: 'CONTEXTS_CHANGED', label: 'تغيّرت سياقات الوقف/الوصل/الابتداء' });
  }
  if (before.profile !== after.profile) {
    entries.push({ kind: 'PROFILE_RENAMED', label: `أُعيدت تسمية الملف من «${before.profile}» إلى «${after.profile}»` });
  }
  return entries;
}

/**
 * يلتقط نسخة جديدة من الملف. إن لم يختلف الملف عن آخر نسخة (بالمقارنة
 * الحتمية)، لا يُضاف شيء ويُعاد null حتى لا يمتلئ السجل بحفظ مكرر.
 */
export function captureEngineVersion(
  config: EngineConfig,
  options: { source?: EngineConfigVersion['source']; note?: string; restoredFrom?: string } = {}
): EngineConfigVersion | null {
  const normalized = normalizeEngineConfig(config);
  const versions = listEngineVersions();
  const latest = versions[0] ?? null;
  if (latest && serializeEngineConfig(latest.config) === serializeEngineConfig(normalized) && options.source !== 'ROLLBACK') {
    return null;
  }
  const version: EngineConfigVersion = {
    id: newId(),
    seq: (latest?.seq ?? 0) + 1,
    createdAt: new Date().toISOString(),
    source: options.source ?? 'SAVE',
    note: options.note?.trim() || undefined,
    restoredFrom: options.restoredFrom,
    audit: diffEngineConfigs(latest?.config ?? null, normalized),
    stats: {
      rules: normalized.rules.length,
      active: normalized.rules.filter((rule) => rule.status === 'ACTIVE').length,
      matrix: normalized.mergeMatrix.length,
    },
    config: normalized,
  };
  writeVersions([version, ...versions]);
  return version;
}

/** يجلب نسخة بعينها. */
export function getEngineVersion(id: string): EngineConfigVersion | null {
  return listEngineVersions().find((version) => version.id === id) ?? null;
}

/** يحذف نسخة واحدة من السجل. */
export function deleteEngineVersion(id: string): void {
  writeVersions(listEngineVersions().filter((version) => version.id !== id));
}

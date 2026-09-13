// سلسلة إصدارات القاعدة والرجوع الموثّق — Rule Versioning & Rollback (FR-ES-07.3)
// مشروع التشجير - نظام القراءات العشر
//
// القيد الحاكم: **لا يُفقد تاريخ أبدًا**. كل حفظ يُنشئ إصدارًا جديدًا
// (v1 ← v2 ← v3) بلقطة كاملة غير قابلة للتغيير من القاعدة، مع
// `Created / Modified / By / Reason`. والرجوع إلى نسخة أقدم **ينشئ إصدارًا
// جديدًا** (v4 من v1) ولا يحذف الإصدارات الوسيطة (v2، v3 تبقى في السلسلة).
//
// المعرّفات مقدّسة: كل إصدارات القاعدة تحمل نفس `ruleId`؛ الرقم وحده يتغيّر.
// بلا حد أعلى للإصدارات، مع تنبيه حجم بعد RULE_VERSION_SIZE_NOTICE إصدارًا
// (تنبيه فقط — لا حذف تلقائي).
//
// الطبقة النقيّة (بناء السلسلة/الرجوع/الفرق) منفصلة عن التخزين، والدوال تقبل
// حقن الوقت والمعرّف فتُختبر حتميًا بلا متصفح.

import type {
  AuditChange,
  EngineRule,
  EngineRuleVersion,
  RuleVersionSource,
} from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';
import { canonicalClone, diffRuleFields, stableStringify } from './rule-diff';

export const RULE_VERSIONS_STORAGE_KEY = 'tashjeer:rule-versions:v1';
export const RULE_VERSIONS_EVENT = 'tashjeer:rule-versions-change';
/**
 * عتبة تنبيه الحجم: بعد هذا العدد من إصدارات القاعدة الواحدة تظهر ملاحظة حجم
 * في اللوحة (لا حذف تلقائي — القرار محسوم: بلا حد).
 */
export const RULE_VERSION_SIZE_NOTICE = 50;

/** تسميات عربية لمصادر الإصدار (تُعرض في الخط الزمني). */
export const VERSION_SOURCE_LABELS: Record<RuleVersionSource, string> = {
  CREATE: 'إنشاء',
  EDIT: 'تعديل',
  STATUS: 'تغيير حالة',
  PRIORITY: 'تغيير أولوية',
  PROTECT: 'وسم الحماية',
  ROLLBACK: 'رجوع لإصدار',
  IMPORT: 'استيراد',
};

/** سلسلة إصدارات قاعدة واحدة: الأقدم أولًا، الأحدث آخرًا. */
export type RuleVersionChain = EngineRuleVersion[];

/** مدخلات التقاط إصدار. */
export interface RecordVersionInput {
  rule: EngineRule;
  source: RuleVersionSource;
  /** By: من نفّذ التغيير. */
  by?: string;
  /** Reason: سبب التغيير (إلزامي في الواجهة للمحمية ولتجاوز الانحدار). */
  reason?: string;
  /** Modified from: الإصدار المسترجَع عند الرجوع. */
  rollbackOf?: number;
  /** حقن الوقت والمعرّف ورقم الإصدار (للاختبارات الحتمية). */
  at?: string;
  id?: string;
  version?: number;
}

/** رقم الإصدار التالي في السلسلة (١ للسلسلة الفارغة). */
export function nextVersionNumber(chain: RuleVersionChain): number {
  return chain.reduce((max, entry) => Math.max(max, entry.version), 0) + 1;
}

/** يبني قيد إصدار واحد (نقيّة). */
export function createVersionEntry(input: RecordVersionInput): EngineRuleVersion {
  const chainVersion = input.version;
  const entry: EngineRuleVersion = {
    id: input.id ?? createEntityId('erv'),
    ruleId: input.rule.id,
    version: typeof chainVersion === 'number' ? chainVersion : input.rule.version,
    at: input.at ?? new Date().toISOString(),
    by: input.by ?? 'local-editor',
    source: input.source,
    // لقطة عميقة كنسية: لا تُعدَّل لاحقًا ولو تغيّرت القاعدة الحية.
    rule: canonicalClone(input.rule),
  };
  const reason = input.reason?.trim();
  if (reason) entry.reason = reason;
  if (typeof input.rollbackOf === 'number') entry.rollbackOf = input.rollbackOf;
  return entry;
}

/**
 * يلتقط إصدارًا جديدًا للقاعدة ويضيفه إلى السلسلة. إن كانت القاعدة مطابقة
 * تمامًا لآخر إصدار (بالمقارنة الحتمية) لا يُضاف شيء ويُعاد `null` — حفظ
 * مكرر لا ينفخ السلسلة (نفس مبدأ سجل إصدارات الملف).
 */
export function recordVersion(
  chain: RuleVersionChain,
  input: RecordVersionInput
): { chain: RuleVersionChain; entry: EngineRuleVersion | null } {
  const latest = chain[chain.length - 1];
  const version = input.version ?? nextVersionNumber(chain);
  const snapshot = canonicalClone(input.rule);
  if (latest && latest.source !== 'ROLLBACK' && sameSnapshot(latest.rule, snapshot, version)) {
    return { chain, entry: null };
  }
  const entry = createVersionEntry({ ...input, version });
  return { chain: [...chain, entry], entry };
}

/** هل اللقطتان متطابقتان محتوىً (بلا الطوابع الزمنية ورقم الإصدار)؟ */
export function sameSnapshot(a: EngineRule, b: EngineRule, _version?: number): boolean {
  void _version;
  const strip = (rule: EngineRule) => {
    const { createdAt: _c, updatedAt: _u, version: _v, ...rest } = rule;
    void _c;
    void _u;
    void _v;
    return stableStringify(rest);
  };
  return strip(a) === strip(b);
}

/** نتيجة عملية رجوع لإصدار أقدم. */
export interface RollbackResult {
  chain: RuleVersionChain;
  /** القاعدة بعد الرجوع (بإصدار جديد — تُكتب في ملف المحرك الحي). */
  rule: EngineRule;
  /** الإصدار الجديد الموثّق. */
  entry: EngineRuleVersion;
}

/**
 * الرجوع الموثّق (FR-ES-07.3.2): يأخذ لقطة الإصدار المستهدف ويُصدرها
 * **كإصدار جديد** في نهاية السلسلة. لا يُحذف أي إصدار وسيط، والسبب يُسجَّل.
 *
 * مثال: سلسلة v1 ← v2 ← v3، الرجوع إلى v1 يُنتج v4 (= محتوى v1) ويبقى
 * v2 وv3 في السلسلة، مع `rollbackOf = 1`.
 */
export function rollbackToVersion(
  chain: RuleVersionChain,
  targetVersion: number,
  options: { by?: string; reason?: string; at?: string; id?: string } = {}
): RollbackResult | null {
  const target = chain.find((entry) => entry.version === targetVersion);
  if (!target) return null;

  const at = options.at ?? new Date().toISOString();
  const version = nextVersionNumber(chain);
  const rule: EngineRule = {
    // اللقطة كاملة كما هي (المعرّف مقدّس لا يتغيّر)، مع تحديث رقم الإصدار
    // وطابع التعديل فقط — فيبقى «آخر تعديل» صادقًا دون فقدان المحتوى.
    ...target.rule,
    version,
    updatedAt: at,
  };
  const entry = createVersionEntry({
    rule,
    source: 'ROLLBACK',
    by: options.by,
    reason: options.reason,
    rollbackOf: targetVersion,
    at,
    id: options.id,
    version,
  });
  return { chain: [...chain, entry], rule, entry };
}

/** يجلب إصدارًا بعينه من السلسلة. */
export function getVersion(chain: RuleVersionChain, version: number): EngineRuleVersion | null {
  return chain.find((entry) => entry.version === version) ?? null;
}

/** أحدث إصدار في السلسلة. */
export function latestVersion(chain: RuleVersionChain): EngineRuleVersion | null {
  return chain.length > 0 ? chain[chain.length - 1] : null;
}

/**
 * الفرق بين إصدارين بحقول القاعدة (FR-ES-07.3.3) — نفس فرق الحقول الذي
 * يُحسب لسجل التدقيق وللتصدير الحتمي، فلا منطق مكرر (P-07).
 */
export function diffVersions(
  chain: RuleVersionChain,
  fromVersion: number,
  toVersion: number
): { changes: AuditChange[]; from: EngineRuleVersion | null; to: EngineRuleVersion | null } {
  const from = getVersion(chain, fromVersion);
  const to = getVersion(chain, toVersion);
  if (!from || !to) return { changes: [], from, to };
  return { changes: diffRuleFields(from.rule, to.rule), from, to };
}

/** ملخّص السلسلة للعرض: العدد، الأحدث، ملاحظة الحجم. */
export function chainSummary(chain: RuleVersionChain): {
  count: number;
  latest: number | null;
  sizeNotice: boolean;
  reasons: number;
} {
  const latest = latestVersion(chain);
  return {
    count: chain.length,
    latest: latest ? latest.version : null,
    sizeNotice: chain.length > RULE_VERSION_SIZE_NOTICE,
    reasons: chain.filter((entry) => Boolean(entry.reason)).length,
  };
}

/** هل السلسلة تحفظ كل الأرقام بلا فجوات (حارس «لا يضيع تاريخ»)؟ */
export function isChainIntact(chain: RuleVersionChain): boolean {
  const versions = chain.map((entry) => entry.version);
  return versions.every((version, index) => version === index + 1);
}

// ==================== التصدير الحتمي (DM-13) ====================

/** صيغة كنسية لإصدار: ترتيب مفاتيح ثابت، فتدخل حزمة التصدير بلا ضجيج. */
export function toCanonicalVersion(entry: EngineRuleVersion): Record<string, unknown> {
  const canonical: Record<string, unknown> = {
    id: entry.id,
    ruleId: entry.ruleId,
    version: entry.version,
    at: entry.at,
    by: entry.by,
    source: entry.source,
  };
  if (entry.reason) canonical.reason = entry.reason;
  if (typeof entry.rollbackOf === 'number') canonical.rollbackOf = entry.rollbackOf;
  canonical.rule = canonicalClone(entry.rule);
  return canonical;
}

/** يرتّب كل الإصدارات ترتيبًا حتميًا (بالمعرّف ثم رقم الإصدار). */
export function toCanonicalVersions(entries: EngineRuleVersion[]): Array<Record<string, unknown>> {
  return [...entries]
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.version - b.version || a.id.localeCompare(b.id))
    .map(toCanonicalVersion);
}

/** يُسلسل سلاسل الإصدارات نصًا حتميًا. */
export function serializeRuleVersions(entries: EngineRuleVersion[]): string {
  return JSON.stringify(toCanonicalVersions(entries), null, 2) + '\n';
}

// ==================== التخزين (المتصفح) ====================

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** خريطة التخزين: معرّف القاعدة ← سلسلته (الأقدم أولًا). */
export type RuleVersionsMap = Record<string, EngineRuleVersion[]>;

/** يقرأ كل السلاسل. */
export function listRuleVersions(): RuleVersionsMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(RULE_VERSIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RuleVersionsMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeVersions(map: RuleVersionsMap): void {
  if (!isBrowser()) return;
  // ترتيب المفاتيح ثابت حتى لا يتغيّر نص التخزين بلا سبب.
  const ordered: RuleVersionsMap = {};
  for (const ruleId of Object.keys(map).sort()) {
    ordered[ruleId] = [...map[ruleId]].sort((a, b) => a.version - b.version);
  }
  window.localStorage.setItem(RULE_VERSIONS_STORAGE_KEY, JSON.stringify(ordered));
  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(RULE_VERSIONS_EVENT, { detail: ordered }));
  }
}

/** سلسلة إصدارات قاعدة واحدة. */
export function getRuleVersionChain(ruleId: string): RuleVersionChain {
  return listRuleVersions()[ruleId] ?? [];
}

/** يحفظ سلسلة قاعدة واحدة (يستبدل ما قبلها). */
export function saveRuleVersionChain(ruleId: string, chain: RuleVersionChain): RuleVersionsMap {
  const map = listRuleVersions();
  map[ruleId] = [...chain].sort((a, b) => a.version - b.version);
  writeVersions(map);
  return map;
}

/** يلتقط إصدارًا لقاعدة في التخزين مباشرة (الطريق المعتاد من المخزن). */
export function recordRuleVersion(input: RecordVersionInput): EngineRuleVersion | null {
  const chain = getRuleVersionChain(input.rule.id);
  const { chain: next, entry } = recordVersion(chain, input);
  if (entry) saveRuleVersionChain(input.rule.id, next);
  return entry;
}

/** ينفّذ رجوعًا في التخزين ويعيد نتيجته. */
export function rollbackRuleVersion(
  ruleId: string,
  targetVersion: number,
  options: { by?: string; reason?: string; at?: string; id?: string } = {}
): RollbackResult | null {
  const result = rollbackToVersion(getRuleVersionChain(ruleId), targetVersion, options);
  if (result) saveRuleVersionChain(ruleId, result.chain);
  return result;
}

/** يضمن أن للقاعدة إصدارًا أولًا (يُستعمل عند التحميل والترحيل). */
export function ensureBaseVersion(rule: EngineRule, options: { by?: string; at?: string } = {}): EngineRuleVersion | null {
  const chain = getRuleVersionChain(rule.id);
  if (chain.length > 0) return null;
  const entry = createVersionEntry({
    rule,
    source: 'CREATE',
    by: options.by,
    at: options.at,
    reason: 'نسخة الأساس',
    version: rule.version,
  });
  saveRuleVersionChain(rule.id, [entry]);
  return entry;
}

/** يحذف سلسلة قاعدة (عند حذف القاعدة نهائيًا — السجل يبقى في التدقيق). */
export function deleteRuleVersionChain(ruleId: string): void {
  const map = listRuleVersions();
  delete map[ruleId];
  writeVersions(map);
}

/** يمسح كل السلاسل (استيراد حزمة حوكمة تحلّ محلّها). */
export function clearRuleVersions(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(RULE_VERSIONS_STORAGE_KEY);
}

/** يستبدل كل السلاسل (استيراد). */
export function replaceRuleVersions(map: RuleVersionsMap): RuleVersionsMap {
  writeVersions(map);
  return listRuleVersions();
}

/** كل الإصدارات مسطّحة (لحزمة التصدير). */
export function allVersionEntries(): EngineRuleVersion[] {
  const map = listRuleVersions();
  const entries: EngineRuleVersion[] = [];
  for (const ruleId of Object.keys(map).sort()) entries.push(...map[ruleId]);
  return entries;
}

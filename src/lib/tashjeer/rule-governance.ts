// حوكمة تعديل القواعد — Rule Governance (FR-ES-07.2/.3/.4/.5/.6)
// مشروع التشجير - نظام القراءات العشر
//
// **كل** تغيير على قاعدة يمرّ من هنا: يلتقط إصدارًا جديدًا في سلسلة القاعدة
// (لا يضيع تاريخ)، ويكتب قيدًا في سجل التدقيق (User/Action/Rule/Before/After/
// Reason/Timestamp)، ويُعيد الملف الحي معدَّلًا برقم إصدار متّسق مع السلسلة.
// فبدل أن تكتب كل لوحة في الاستوديو تدقيقها الخاص، صار للتغيير طريق واحد
// (P-07) — ومعه يصحّ الوعد: «لا يُفقد تاريخ أبدًا».
//
// الطبقة تكتب في التخزين المحلي (كالمخازن القائمة) لكن كل منطقها دوال نقية
// قابلة للاختبار: تُمرَّر لها اللقطات وتُعيد القيود والملفات.

import type {
  AuditChange,
  EngineConfig,
  EngineRule,
  EngineRuleVersion,
  RuleVersionSource,
  StudioAuditAction,
  StudioAuditEntry,
} from '@/lib/tashjeer/model/v8';
import { updateEngineRule } from '@/lib/tashjeer/engine-config-store';
import {
  createAuditEntry,
  appendAuditEntry,
  DEFAULT_AUDIT_ACTOR,
  AUDIT_ACTION_LABELS,
} from './rule-audit';
import { diffRuleFields, changedFieldLabels } from './rule-diff';
import {
  getRuleVersionChain,
  nextVersionNumber,
  recordVersion,
  rollbackRuleVersion,
  saveRuleVersionChain,
  ensureBaseVersion,
  type RollbackResult,
} from './rule-versions';
import { findTransition, syncConflictTags, type ConflictTagResult } from './rule-status-flow';

/** سياق تنفيذ التغيير: من، ولماذا، ومتى (للحتمية في الاختبارات). */
export interface GovernanceMeta {
  /** By: منفّذ التغيير (افتراضيًا `local-editor`). */
  actor?: string;
  /** Reason: سبب صريح — إلزامي للمحمية ولتجاوز الانحدار والانتقالات المحكومة. */
  reason?: string;
  at?: string;
  /** هل التغيير يتجاوز تحذيرًا (قاعدة محمية/انحدار)؟ يُبرز في السجل. */
  override?: boolean;
  /** عدد المواضع/القواعد المتأثرة (يُعرض في الملخّص). */
  usageCount?: number;
}

/** نتيجة تغيير محكوم: الملف الجديد + قيد الإصدار + قيد التدقيق. */
export interface GovernanceResult {
  config: EngineConfig;
  rule: EngineRule | null;
  version: EngineRuleVersion | null;
  audit: StudioAuditEntry | null;
  /** هل تغيّر شيء فعلًا (حفظ مكرر لا يُسجَّل)؟ */
  changed: boolean;
}

/** فعل تدقيق مناسب لنوع التغيير. */
function actionForChange(before: EngineRule, after: EngineRule): StudioAuditAction {
  if (before.status !== after.status) return 'RULE_STATUS_CHANGED';
  if (before.priority !== after.priority) return 'RULE_PRIORITY_CHANGED';
  if (Boolean(before.protected) !== Boolean(after.protected)) return 'RULE_PROTECTED_TOGGLED';
  return 'RULE_UPDATED';
}

/** مصدر إصدار مناسب لنوع التغيير. */
function sourceForChange(before: EngineRule, after: EngineRule): RuleVersionSource {
  if (before.status !== after.status) return 'STATUS';
  if (before.priority !== after.priority) return 'PRIORITY';
  if (Boolean(before.protected) !== Boolean(after.protected)) return 'PROTECT';
  return 'EDIT';
}

/**
 * يضع قاعدة في ملف: بديل مطابق بالمعرّف، أو إضافة إن لم تكن موجودة (استرجاع
 * قاعدة حُذفت). الترتيب يبقى بترتيب الملف، والقاعدة الجديدة تُلحق آخرًا
 * (الترتيب الحتمي للتصدير يُعاد عند التسلسل — DM-13).
 */
function withRule(config: EngineConfig, rule: EngineRule): EngineConfig {
  const exists = config.rules.some((item) => item.id === rule.id);
  return {
    ...config,
    rules: exists
      ? config.rules.map((item) => (item.id === rule.id ? rule : item))
      : [...config.rules, rule],
  };
}

/**
 * يلتقط إصدارًا لقاعدة ويكتب قيد التدقيق، ويُعيد الملف برقم إصدار متّسق مع
 * السلسلة. الحفظ المكرر (لا فرق في الحقول) لا يُسجَّل: `changed = false`.
 */
export function governRuleChange(
  config: EngineConfig,
  before: EngineRule | null,
  after: EngineRule,
  meta: GovernanceMeta = {}
): GovernanceResult {
  const at = meta.at ?? new Date().toISOString();
  const actor = meta.actor ?? DEFAULT_AUDIT_ACTOR;

  // رقم الإصدار تُسنده السلسلة (لا عدّاد القاعدة) فيبقى ١، ٢، ٣ بلا فجوات.
  const chain = getRuleVersionChain(after.id);
  const assigned = chain.length > 0 ? nextVersionNumber(chain) : Math.max(after.version, 1);
  const normalized: EngineRule = { ...after, version: assigned, updatedAt: at };

  const { chain: nextChain, entry } = recordVersion(chain, {
    rule: normalized,
    source: before ? sourceForChange(before, normalized) : 'CREATE',
    by: actor,
    reason: meta.reason,
    at,
    version: assigned,
  });

  const changes = before ? diffRuleFields(before, normalized) : diffRuleFields(null, normalized);
  const action: StudioAuditAction = before ? actionForChange(before, normalized) : 'RULE_CREATED';

  const audit = createAuditEntry({
    action,
    ruleId: normalized.id,
    ruleName: normalized.name,
    before,
    after: normalized,
    changes,
    reason: meta.reason,
    actor,
    at,
    version: assigned,
    override: meta.override,
    summary: buildSummary(action, normalized, changes, meta),
  });

  if (entry) saveRuleVersionChain(normalized.id, nextChain);
  appendAuditEntry(audit);

  return {
    config: withRule(config, normalized),
    rule: normalized,
    version: entry,
    audit,
    changed: Boolean(entry) || !before,
  };
}

/** ملخّص عربي للقيد: الفعل + القاعدة + الحقول المتغيّرة + السبب. */
function buildSummary(
  action: StudioAuditAction,
  rule: EngineRule,
  changes: AuditChange[],
  meta: GovernanceMeta
): string {
  const parts = [AUDIT_ACTION_LABELS[action], `«${rule.name}»`];
  if (changes.length > 0) parts.push(`(${changedFieldLabels(changes).join('، ')})`);
  if (meta.reason?.trim()) parts.push(`— السبب: ${meta.reason.trim()}`);
  if (meta.override) parts.push('[تجاوز تحذير]');
  return parts.join(' ');
}

/** يسجّل إنشاء قاعدة جديدة (إصدار أول + تدقيق). */
export function governRuleCreate(config: EngineConfig, rule: EngineRule, meta: GovernanceMeta = {}): GovernanceResult {
  return governRuleChange(config, null, rule, meta);
}

/**
 * يسجّل حذف قاعدة. **التاريخ لا يُحذف**: تُزال القاعدة من الملف الحي لكن
 * سلسلة إصداراتها تبقى، فيمكن استرجاعها (restoreDeletedRule).
 */
export function governRuleRemoval(
  config: EngineConfig,
  rule: EngineRule,
  meta: GovernanceMeta = {}
): { config: EngineConfig; audit: StudioAuditEntry } {
  const at = meta.at ?? new Date().toISOString();
  const audit = createAuditEntry({
    action: 'RULE_DELETED',
    ruleId: rule.id,
    ruleName: rule.name,
    before: rule,
    after: null,
    // Before/After صريحان: الحذف يُسجَّل خروجًا من الملف، واللقطة الكاملة
    // تبقى في سلسلة الإصدارات (ruleId + version) فلا يضيع التاريخ.
    changes: [{ field: 'presence', label: 'الوجود في ملف المحرك', before: 'موجودة', after: 'محذوفة' }],
    reason: meta.reason,
    actor: meta.actor,
    at,
    version: rule.version,
    override: meta.override,
    summary: [
      AUDIT_ACTION_LABELS.RULE_DELETED,
      `«${rule.name}»`,
      meta.reason?.trim() ? `— السبب: ${meta.reason.trim()}` : '',
      '(سلسلة إصداراتها محفوظة ويمكن استرجاعها)',
    ]
      .filter(Boolean)
      .join(' '),
  });
  appendAuditEntry(audit);
  return { config: { ...config, rules: config.rules.filter((item) => item.id !== rule.id) }, audit };
}

/**
 * استرجاع قاعدة حُذفت: يعيد آخر إصدار محفوظ منها إلى الملف الحي بإصدار جديد
 * موثّق. الحذف إذن قابل للتراجع ما دامت السلسلة محفوظة.
 */
export function restoreDeletedRule(config: EngineConfig, ruleId: string, meta: GovernanceMeta = {}): GovernanceResult | null {
  const chain = getRuleVersionChain(ruleId);
  const latest = chain[chain.length - 1];
  if (!latest || config.rules.some((rule) => rule.id === ruleId)) return null;
  const restored: EngineRule = { ...latest.rule, status: 'DISABLED' };
  return governRuleChange(config, null, restored, {
    ...meta,
    reason: meta.reason ?? `استرجاع من الإصدار ${latest.version} بعد الحذف`,
  });
}

/**
 * تغيير حالة محكوم (FR-ES-07.2): يفحص الانتقال أولًا، فإن كان ممنوعًا أو
 * ناقص السبب أعاد الخطأ بلا تعديل. النجاح يُسجَّل إصدارًا وتدقيقًا.
 */
export function governStatusChange(
  config: EngineConfig,
  ruleId: string,
  status: EngineRule['status'],
  meta: GovernanceMeta = {}
): GovernanceResult & { error?: string } {
  const rule = config.rules.find((item) => item.id === ruleId);
  if (!rule) return { config, rule: null, version: null, audit: null, changed: false, error: 'القاعدة غير موجودة' };

  const transition = findTransition(rule.status, status);
  if (!transition) {
    return {
      config,
      rule,
      version: null,
      audit: null,
      changed: false,
      error:
        rule.status === status
          ? 'القاعدة في هذه الحالة أصلًا.'
          : `الانتقال من «${rule.status}» إلى «${status}» غير مسموح في دورة الحالة المحكومة.`,
    };
  }
  const reason = meta.reason?.trim();
  if (transition.requiresReason && !reason) {
    return {
      config,
      rule,
      version: null,
      audit: null,
      changed: false,
      error: 'هذا الانتقال يحتاج سببًا نصيًا إلزاميًا.',
    };
  }
  if (rule.protected && !reason) {
    return {
      config,
      rule,
      version: null,
      audit: null,
      changed: false,
      error: 'القاعدة محمية: تغيير حالتها يحتاج سببًا مكتوبًا.',
    };
  }

  return governRuleChange(config, rule, { ...rule, status }, { ...meta, reason });
}

/** رجوع موثّق لإصدار أقدم (FR-ES-07.3.2): يُنشئ إصدارًا جديدًا ولا يحذف. */
export function governRollback(
  config: EngineConfig,
  ruleId: string,
  targetVersion: number,
  meta: GovernanceMeta = {}
): (GovernanceResult & { rollback?: RollbackResult }) | { error: string } {
  const at = meta.at ?? new Date().toISOString();
  const reason = meta.reason?.trim();
  if (!reason) return { error: 'الرجوع لإصدار أقدم يحتاج سببًا مكتوبًا (رجوع موثّق).' };

  const rollback = rollbackRuleVersion(ruleId, targetVersion, {
    by: meta.actor,
    reason,
    at,
  });
  if (!rollback) return { error: `لا إصدار بالرقم ${targetVersion} في سلسلة هذه القاعدة.` };

  const audit = createAuditEntry({
    action: 'RULE_ROLLED_BACK',
    ruleId,
    ruleName: rollback.rule.name,
    reason,
    actor: meta.actor,
    at,
    version: rollback.entry.version,
    summary: `رجوع بالقاعدة «${rollback.rule.name}» إلى محتوى الإصدار ${targetVersion}، وأُصدر كإصدار جديد v${rollback.entry.version} دون حذف الإصدارات الوسيطة — السبب: ${reason}`,
  });
  appendAuditEntry(audit);

  return {
    config: withRule(config, rollback.rule),
    rule: rollback.rule,
    version: rollback.entry,
    audit,
    changed: true,
    rollback,
  };
}

/**
 * وسم التعارض التلقائي (FR-ES-07.2.2): يكشف التعارضات غير المحسومة، يسم
 * القواعد المعنية `CONFLICTED` ويرفع الوسم عمن حُسم تعارضها، ويُسجّل كل تغيير
 * إصدارًا وتدقيقًا.
 */
export function governConflictSync(
  config: EngineConfig,
  meta: GovernanceMeta = {}
): { config: EngineConfig; result: ConflictTagResult; audits: StudioAuditEntry[] } {
  const outcome = syncConflictTags(config, { now: meta.at });
  let next = outcome.config;
  const audits: StudioAuditEntry[] = [];

  for (const change of outcome.tagged) {
    const rule = next.rules.find((item) => item.id === change.ruleId);
    if (!rule) continue;
    const governed = governRuleChange(next, { ...rule, status: change.from }, rule, {
      ...meta,
      reason: change.reason,
      actor: meta.actor ?? 'engine-policy',
    });
    next = governed.config;
    if (governed.audit) audits.push(governed.audit);
  }
  for (const change of outcome.cleared) {
    const rule = next.rules.find((item) => item.id === change.ruleId);
    if (!rule) continue;
    const governed = governRuleChange(next, { ...rule, status: change.from }, rule, {
      ...meta,
      reason: change.reason,
      actor: meta.actor ?? 'engine-policy',
    });
    next = governed.config;
    if (governed.audit) audits.push(governed.audit);
  }

  return { config: next, result: { ...outcome, config: next }, audits };
}

/** قيود تدقيق لأفعال على مستوى الملف (نشر/استيراد/استرجاع/إعادة ضبط). */
export function recordProfileAction(
  action: StudioAuditAction,
  config: EngineConfig,
  meta: GovernanceMeta = {}
): StudioAuditEntry {
  const at = meta.at ?? new Date().toISOString();
  const audit = createAuditEntry({
    action,
    reason: meta.reason,
    actor: meta.actor,
    at,
    summary: [
      AUDIT_ACTION_LABELS[action],
      `«${config.profile}»`,
      `(${config.rules.length} قاعدة)`,
      meta.reason?.trim() ? `— ${meta.reason.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  });
  appendAuditEntry(audit);
  return audit;
}

/**
 * يضمن أن لكل قاعدة في الملف إصدارًا أولًا (نسخة أساس) حتى يكون للرجوع نقطة
 * انطلاق دائمًا — نفس مبدأ لقطة الأساس في سجل إصدارات الملف.
 */
export function ensureRuleBaselines(rules: EngineRule[], actor?: string): void {
  for (const rule of rules) ensureBaseVersion(rule, { by: actor ?? DEFAULT_AUDIT_ACTOR });
}

/** إعادة تصدير مريحة للواجهة. */
export { getRuleVersionChain, nextVersionNumber, updateEngineRule };

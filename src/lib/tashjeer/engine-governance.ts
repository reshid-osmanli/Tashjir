// حزمة الحوكمة: التصدير والاستيراد — Governance Bundle (FR-ES-07.3/.6، FR-ES-08.3)
// مشروع التشجير - نظام القراءات العشر
//
// ملف إعداد المحرك وحده لا يكفي للتدقيق: معه **سلاسل إصدارات القواعد** و**سجل
// التدقيق** و**ملخّص اختبارات القواعد**. هذه الوحدة تجمع الأربعة في حزمة واحدة
// حتمية صديقة لـ Git (DM-13) وتعيد تفكيكها عند الاستيراد.
//
// لماذا حزمة مستقلة ولا تُدمج في `EngineConfig`؟ لأن تضمين السجل في لقطة كل
// إصدار من إصدارات الملف يجعل التخزين تربيعي النمو (٤٠ نسخة × ن قيد) ويكسر
// قاعدة «الحفظ المطابق لا يُكرَّر». فبقي `schemaVersion: 1` لملف الإعداد كما
// هو، وصار السجل في حزمة تعلوه — القرار موثّق في PROGRESS.md.

import type {
  EngineConfig,
  EngineGovernanceBundle,
  EngineRuleVersion,
  EngineTestReportSummary,
  StudioAuditEntry,
} from '@/lib/tashjeer/model/v8';
import { serializeEngineConfig, toCanonicalConfig, validateEngineConfig } from '@/lib/tashjeer/engine-config-store';
import { runProfileTests, failingRules } from './decision/rule-test-runner';
import { toCanonicalAuditTrail } from './rule-audit';
import { toCanonicalVersions } from './rule-versions';

export const GOVERNANCE_BUNDLE_FORMAT = 'tashjeer-engine-governance';
export const GOVERNANCE_BUNDLE_VERSION = 1;

/** نتيجة فحص حزمة مستوردة. */
export interface GovernanceValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** يبني ملخّص اختبارات القواعد للحزمة (FR-ES-08.3). */
export function buildTestReport(config: EngineConfig): EngineTestReportSummary {
  const report = runProfileTests(config);
  return {
    total: report.total,
    passed: report.passed,
    failed: report.failed,
    failingRuleIds: failingRules(report)
      .map((item) => item.ruleId)
      .sort(),
  };
}

/** يبني حزمة الحوكمة من أجزائها. */
export function buildGovernanceBundle(
  config: EngineConfig,
  options: {
    ruleVersions?: EngineRuleVersion[];
    auditTrail?: StudioAuditEntry[];
    exportedAt?: string;
    withTestReport?: boolean;
  } = {}
): EngineGovernanceBundle {
  const bundle: EngineGovernanceBundle = {
    format: GOVERNANCE_BUNDLE_FORMAT,
    bundleVersion: GOVERNANCE_BUNDLE_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    config,
    ruleVersions: options.ruleVersions ?? [],
    auditTrail: options.auditTrail ?? [],
  };
  if (options.withTestReport !== false) bundle.testReport = buildTestReport(config);
  return bundle;
}

/**
 * الصيغة الكنسية للحزمة: ترتيب مفاتيح ثابت، والإصدارات مرتبة بالمعرّف ثم
 * الرقم، والتدقيق بالوقت ثم المعرّف — نفس المدخلات تعطي نفس النص بايتًا.
 */
export function toCanonicalGovernanceBundle(bundle: EngineGovernanceBundle): Record<string, unknown> {
  const canonical: Record<string, unknown> = {
    format: GOVERNANCE_BUNDLE_FORMAT,
    bundleVersion: GOVERNANCE_BUNDLE_VERSION,
    exportedAt: bundle.exportedAt,
    config: toCanonicalConfig(bundle.config),
    ruleVersions: toCanonicalVersions(bundle.ruleVersions ?? []),
    auditTrail: toCanonicalAuditTrail(bundle.auditTrail ?? []),
  };
  if (bundle.testReport) {
    canonical.testReport = {
      total: bundle.testReport.total,
      passed: bundle.testReport.passed,
      failed: bundle.testReport.failed,
      failingRuleIds: [...bundle.testReport.failingRuleIds].sort(),
    };
  }
  return canonical;
}

/** يُسلسل الحزمة نصًا حتميًا. */
export function serializeGovernanceBundle(bundle: EngineGovernanceBundle): string {
  return JSON.stringify(toCanonicalGovernanceBundle(bundle), null, 2) + '\n';
}

/** هل النص حزمة حوكمة (لا ملف إعداد مجرد)؟ */
export function isGovernanceBundleText(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { format?: string };
    return parsed?.format === GOVERNANCE_BUNDLE_FORMAT;
  } catch {
    return false;
  }
}

/** يفحص بنية قيد إصدار مستورد. */
function validateVersionEntry(entry: unknown, index: number, errors: string[]): void {
  if (!entry || typeof entry !== 'object') {
    errors.push(`إصدار غير صالح في الموضع ${index + 1}`);
    return;
  }
  const item = entry as Partial<EngineRuleVersion>;
  if (typeof item.ruleId !== 'string' || !item.ruleId) errors.push(`إصدار بلا معرّف قاعدة (${index + 1})`);
  if (typeof item.version !== 'number') errors.push(`إصدار بلا رقم (${index + 1})`);
  if (!item.rule || typeof item.rule !== 'object') errors.push(`إصدار بلا لقطة قاعدة (${index + 1})`);
  if (typeof item.at !== 'string') errors.push(`إصدار بلا طابع زمني (${index + 1})`);
}

/** يفحص بنية قيد تدقيق مستورد. */
function validateAuditEntry(entry: unknown, index: number, errors: string[]): void {
  if (!entry || typeof entry !== 'object') {
    errors.push(`قيد تدقيق غير صالح في الموضع ${index + 1}`);
    return;
  }
  const item = entry as Partial<StudioAuditEntry>;
  if (typeof item.id !== 'string' || !item.id) errors.push(`قيد تدقيق بلا معرّف (${index + 1})`);
  if (typeof item.action !== 'string' || !item.action) errors.push(`قيد تدقيق بلا فعل (${index + 1})`);
  if (typeof item.at !== 'string') errors.push(`قيد تدقيق بلا طابع زمني (${index + 1})`);
  if (typeof item.actor !== 'string') errors.push(`قيد تدقيق بلا منفّذ (${index + 1})`);
}

/** يفحص حزمة كاملة (الإعداد + الإصدارات + التدقيق) قبل التطبيق. */
export function validateGovernanceBundle(value: unknown): GovernanceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!value || typeof value !== 'object') {
    return { valid: false, errors: ['الحزمة ليست كائنًا صالحًا'], warnings };
  }
  const bundle = value as Partial<EngineGovernanceBundle>;
  if (bundle.format !== GOVERNANCE_BUNDLE_FORMAT) {
    errors.push(`صيغة غير معروفة: متوقع ${GOVERNANCE_BUNDLE_FORMAT}`);
  }
  if (bundle.bundleVersion !== GOVERNANCE_BUNDLE_VERSION) {
    errors.push(`إصدار الحزمة غير متوافق: متوقع ${GOVERNANCE_BUNDLE_VERSION}`);
  }
  const configValidation = validateEngineConfig(bundle.config);
  errors.push(...configValidation.errors.map((error) => `الإعداد: ${error}`));
  warnings.push(...configValidation.warnings.map((warning) => `الإعداد: ${warning}`));

  if (bundle.ruleVersions !== undefined && !Array.isArray(bundle.ruleVersions)) {
    errors.push('سلاسل الإصدارات ليست قائمة');
  }
  (bundle.ruleVersions ?? []).forEach((entry, index) => validateVersionEntry(entry, index, errors));

  if (bundle.auditTrail !== undefined && !Array.isArray(bundle.auditTrail)) {
    errors.push('سجل التدقيق ليس قائمة');
  }
  (bundle.auditTrail ?? []).forEach((entry, index) => validateAuditEntry(entry, index, errors));

  // تنبيهات لا تمنع: سلسلة بإصدارات غير متتابعة، أو تدقيق بلا قيود.
  const byRule = new Map<string, number[]>();
  for (const entry of bundle.ruleVersions ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const list = byRule.get(entry.ruleId) ?? [];
    list.push(entry.version);
    byRule.set(entry.ruleId, list);
  }
  for (const [ruleId, versions] of byRule) {
    const sorted = [...versions].sort((a, b) => a - b);
    const intact = sorted.every((version, index) => version === index + 1);
    if (!intact) warnings.push(`سلسلة إصدارات «${ruleId}» فيها فجوة: ${sorted.join('، ')}`);
  }
  if ((bundle.auditTrail ?? []).length === 0) warnings.push('الحزمة بلا قيود تدقيق.');

  return { valid: errors.length === 0, errors, warnings };
}

/** نتيجة تفكيك حزمة مستوردة. */
export interface GovernanceImportResult {
  bundle: EngineGovernanceBundle | null;
  validation: GovernanceValidation;
}

/** يفكّك نص حزمة مع فحصه (لا يُطبَّق شيء هنا — المستدعي يقرر). */
export function parseGovernanceBundle(text: string): GovernanceImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { bundle: null, validation: { valid: false, errors: ['النص ليس JSON صالحًا'], warnings: [] } };
  }
  const validation = validateGovernanceBundle(parsed);
  if (!validation.valid) return { bundle: null, validation };
  const raw = parsed as EngineGovernanceBundle;
  return {
    bundle: {
      format: GOVERNANCE_BUNDLE_FORMAT,
      bundleVersion: GOVERNANCE_BUNDLE_VERSION,
      exportedAt: raw.exportedAt,
      config: raw.config,
      ruleVersions: [...(raw.ruleVersions ?? [])].sort(
        (a, b) => a.ruleId.localeCompare(b.ruleId) || a.version - b.version
      ),
      auditTrail: [...(raw.auditTrail ?? [])].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)),
      ...(raw.testReport ? { testReport: raw.testReport } : {}),
    },
    validation,
  };
}

/**
 * يقبل نصًا قد يكون حزمة حوكمة أو ملف إعداد مجردًا، ويعيد تمييزه:
 * المستورد في الواجهة واحدة لكلا الصيغتين (لا يُكسر ملف قديم).
 */
export function detectStudioImport(text: string): 'GOVERNANCE' | 'CONFIG' | 'UNKNOWN' {
  if (isGovernanceBundleText(text)) return 'GOVERNANCE';
  try {
    const parsed = JSON.parse(text) as { schemaVersion?: number; rules?: unknown };
    if (parsed?.schemaVersion === 1 && Array.isArray(parsed.rules)) return 'CONFIG';
  } catch {
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

/** بصمة حتمية لملف الإعداد وحده (لمقارنة سريعة بلا سجل). */
export function configFingerprint(config: EngineConfig): string {
  return serializeEngineConfig(config);
}

/** ملخّص ما في الحزمة (للعرض قبل التطبيق). */
export function summarizeBundle(bundle: EngineGovernanceBundle): {
  rules: number;
  versions: number;
  auditEntries: number;
  rulesWithVersions: number;
  tests: string;
} {
  const ruleIds = new Set((bundle.ruleVersions ?? []).map((entry) => entry.ruleId));
  const report = bundle.testReport;
  return {
    rules: bundle.config.rules.length,
    versions: (bundle.ruleVersions ?? []).length,
    auditEntries: (bundle.auditTrail ?? []).length,
    rulesWithVersions: ruleIds.size,
    tests: report ? `${report.passed}/${report.total} ناجحة (${report.failed} فشل)` : 'بلا ملخّص اختبارات',
  };
}

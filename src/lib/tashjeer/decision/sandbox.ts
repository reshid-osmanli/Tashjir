// مسار الساندبوكس وسير الاعتماد — Sandbox & Approval (FR-ES-11.2+4)
// مشروع التشجير - نظام القراءات العشر
//
// قاعدة DRAFT/EXPERIMENTAL تعمل في مسار تجريبي ولا تمسّ الرسم الرسمي حتى
// Activate. الانتقال Active → Deprecated يبقي التاريخ. طبقة نقيّة.

import type { EngineConfig, EngineRule, RuleStatus } from '@/lib/tashjeer/model/v8';

/** خطوات سير الاعتماد الظاهرة في الواجهة. */
export const APPROVAL_STEPS = ['DRAFT', 'TEST', 'PREVIEW', 'COMPARE', 'APPROVE', 'ACTIVATE'] as const;
export type ApprovalStep = (typeof APPROVAL_STEPS)[number];

export const SANDBOX_STATUSES: RuleStatus[] = ['DRAFT', 'EXPERIMENTAL'];
export const OFFICIAL_STATUSES: RuleStatus[] = ['ACTIVE'];

/** ملف رسمي: القواعد النشطة وحدها. */
export function officialProfile(config: EngineConfig): EngineConfig {
  return { ...config, rules: config.rules.filter((rule) => OFFICIAL_STATUSES.includes(rule.status)) };
}

/** ملف ساندبوكس: النشطة + المسودة/التجريبية تُعامل نشطة للتقييم فقط دون حفظ. */
export function sandboxProfile(config: EngineConfig): EngineConfig {
  return {
    ...config,
    rules: config.rules
      .filter((rule) => rule.status === 'ACTIVE' || SANDBOX_STATUSES.includes(rule.status))
      .map((rule) => ({ ...rule, status: 'ACTIVE' as const })),
  };
}

/** هل القاعدة تمسّ الرسم الرسمي؟ */
export function affectsOfficialData(rule: EngineRule): boolean {
  return rule.status === 'ACTIVE';
}

/** الخطوة التالية في سير الاعتماد. */
export function nextApprovalStatus(status: RuleStatus): RuleStatus {
  if (status === 'DRAFT' || status === 'EXPERIMENTAL') return 'ACTIVE';
  if (status === 'ACTIVE') return 'DEPRECATED';
  if (status === 'DISABLED') return 'ACTIVE';
  return status;
}

/** عزل دون حذف تاريخي. */
export function deprecateRuleStatus(status: RuleStatus): RuleStatus {
  if (status === 'ACTIVE' || status === 'EXPERIMENTAL') return 'DEPRECATED';
  return status;
}

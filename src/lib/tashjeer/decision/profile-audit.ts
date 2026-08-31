// فحص ملف المحرك — Profile Audit (FR-ES-07، FR-ES-13)
// مشروع التشجير - نظام القراءات العشر
//
// يفحص ملف المحرك ويكشف المشكلات المحتملة قبل أن تؤثر في القرارات:
//   - تصادم الأولويات داخل المجموعة (تعادل قد يُحل عشوائيًا).
//   - القواعد الشاملة (شروط فارغة تطابق كل سياق).
//   - تعارض أفعال الدمج (قاعدة تسمح وأخرى تمنع على نفس النوع).
//   - توزيع الحالات.
// طبقة نقيّة بلا DOM، تركّب فوق النموذج والمُقيِّم الموجودين (لا منطق مكرر).

import type { EngineConfig, EngineRule, RuleStatus } from '@/lib/tashjeer/model/v8';

/** زوج قاعدتين يتعارض فعلا الدمج بينهما. */
export interface MergeConflict {
  allowRule: EngineRule;
  preventRule: EngineRule;
  differenceType: string;
}

/** تقرير فحص الملف. */
export interface ProfileAudit {
  /** تصادم أولويات داخل المجموعة الواحدة. */
  priorityCollisions: Array<{ groupId: string; priority: number; rules: EngineRule[] }>;
  /** قواعد شاملة (شروط فارغة). */
  catchAllRules: EngineRule[];
  /** تعارض أفعال الدمج. */
  mergeConflicts: MergeConflict[];
  /** توزيع الحالات. */
  statusCounts: Record<RuleStatus, number>;
  /** إجمالي عدد المشكلات. */
  issueCount: number;
}

/** يستخرج قيد نوع الاختلاف من شروط القاعدة (إن وُجد)، وإلا «ANY». */
export function extractDifferenceType(rule: EngineRule): string {
  const all = rule.conditions.all ?? [];
  for (const item of all) {
    if ('field' in item && item.field === 'differenceType' && item.op === 'equals') {
      return String(item.value ?? 'ANY');
    }
  }
  return 'ANY';
}

const hasAction = (rule: EngineRule, action: string) => rule.actions.some((item) => item.type === action);

/** هل يمكن لقاعدتين أن تطابقا نفس نوع الاختلاف؟ */
function typesOverlap(a: string, b: string): boolean {
  return a === 'ANY' || b === 'ANY' || a === b;
}

/** يفحص ملف المحرك ويعيد تقرير المشكلات. */
export function auditProfile(profile: EngineConfig): ProfileAudit {
  const activeRules = profile.rules.filter((rule) => rule.status === 'ACTIVE');

  // تصادم الأولويات داخل المجموعة.
  const byGroupPriority = new Map<string, EngineRule[]>();
  for (const rule of activeRules) {
    const key = `${rule.groupId}::${rule.priority}`;
    const list = byGroupPriority.get(key) ?? [];
    list.push(rule);
    byGroupPriority.set(key, list);
  }
  const priorityCollisions = Array.from(byGroupPriority.entries())
    .filter(([, rules]) => rules.length > 1)
    .map(([key, rules]) => {
      const [groupId, priority] = key.split('::');
      return { groupId: groupId ?? '', priority: Number(priority), rules };
    });

  // القواعد الشاملة: لا شروط فعّالة.
  const catchAllRules = activeRules.filter((rule) => {
    const all = rule.conditions.all ?? [];
    return all.length === 0;
  });

  // تعارض أفعال الدمج.
  const mergeRules = activeRules.filter((rule) => rule.category === 'MERGE' || rule.type === 'MERGE');
  const mergeConflicts: MergeConflict[] = [];
  for (let i = 0; i < mergeRules.length; i++) {
    for (let j = i + 1; j < mergeRules.length; j++) {
      const a = mergeRules[i]!;
      const b = mergeRules[j]!;
      const aAllows = hasAction(a, 'MERGE');
      const aPrevents = hasAction(a, 'PREVENT_MERGE');
      const bAllows = hasAction(b, 'MERGE');
      const bPrevents = hasAction(b, 'PREVENT_MERGE');
      const contradictory = (aAllows && bPrevents) || (aPrevents && bAllows);
      if (!contradictory) continue;
      const dtA = extractDifferenceType(a);
      const dtB = extractDifferenceType(b);
      if (typesOverlap(dtA, dtB)) {
        mergeConflicts.push({
          allowRule: aAllows ? a : b,
          preventRule: aPrevents ? a : b,
          differenceType: dtA === 'ANY' ? dtB : dtA,
        });
      }
    }
  }

  // توزيع الحالات.
  const statusCounts = {
    DRAFT: 0,
    ACTIVE: 0,
    DISABLED: 0,
    DEPRECATED: 0,
    CONFLICTED: 0,
    EXPERIMENTAL: 0,
  } as Record<RuleStatus, number>;
  for (const rule of profile.rules) {
    statusCounts[rule.status] += 1;
  }

  const issueCount = priorityCollisions.length + catchAllRules.length + mergeConflicts.length;

  return { priorityCollisions, catchAllRules, mergeConflicts, statusCounts, issueCount };
}

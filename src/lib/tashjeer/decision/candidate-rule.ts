// القواعد المرشحة من التصحيحات — Candidate Rules (FR-ES-12.3/.4، AC-02)
// مشروع التشجير - نظام القراءات العشر
//
// حلقة التعلم: المحرك يقترح ← المحرر يصحّح ← التصحيح يتحول إلى قاعدة مرشحة.
// هذه الوحدة النقيّة تحوّل تصحيحًا (Engine=A / Editor=B) إلى قاعدة EngineRule
// مرشحة (DRAFT) يراجعها المستخدم قبل الاعتماد — لا إنشاء تلقائي. كما تكتشف
// الأنماط المتكررة لتقترح قاعدة من عدة تصحيحات (FR-ES-12.3).
//
// المبدأ: المحرك يقترح والمحرر يقرر (P-06). النتيجة مرشحة فقط، والاعتماد بيد
// المستخدم عبر سير: Draft → Test → Approve → Active (FR-ES-11).

import type { EngineRule, EngineRuleScope, SpecificityLevel } from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';

/** سياق تصحيح منظّم يُستخرج من Correction أو من تفاعل المحرر. */
export interface CorrectionContext {
  /** نوع الاختلاف الأول. */
  differenceType: string;
  /** النوع المرتبط (إن كان القرار دمجًا). */
  relatedType?: string;
  /** ماذا قرر المحرك: دمج (true) أم فصل (false). Engine = A. */
  engineMerged: boolean;
  /** ماذا يريد المحرر: دمج (true) أم فصل (false). Editor/Final = B. */
  editorWantsMerge: boolean;
  readerId?: string;
  scope?: EngineRuleScope;
  reason?: string;
}

/** حدّ التكرار لاقتراح قاعدة من نمط متكرر (FR-ES-12.3). */
export const PATTERN_REPEAT_THRESHOLD = 3;

/**
 * يقترح قاعدة EngineRule مرشحة من تصحيح واحد. القاعدة:
 *   - شرطها يطابق أنواع العناصر (والقارئ إن وُجد).
 *   - إجراءها يفرض رغبة المحرر (MERGE أو PREVENT_MERGE).
 *   - حالتها DRAFT (لا تؤثر حتى الاعتماد).
 *   - خصوصيتها أعلى (AYAH) حتى تقدر على التجاوز المحلي إن رغب المستخدم.
 */
export function proposeCandidateRule(ctx: CorrectionContext): EngineRule {
  const now = new Date().toISOString();
  const id = createEntityId('er-cand');
  const action = ctx.editorWantsMerge ? 'MERGE' : 'PREVENT_MERGE';
  const direction = ctx.editorWantsMerge ? 'ادمج' : 'لا تدمج';

  const conditions: EngineRule['conditions'] = {
    all: [
      { field: 'differenceType', op: 'equals', value: ctx.differenceType },
      ...(ctx.relatedType ? [{ field: 'relatedType', op: 'equals' as const, value: ctx.relatedType }] : []),
      ...(ctx.readerId ? [{ field: 'readerId', op: 'equals' as const, value: ctx.readerId }] : []),
    ],
  };

  return {
    id,
    name: `مرشحة: ${direction} ${ctx.differenceType}${ctx.relatedType ? ` مع ${ctx.relatedType}` : ''}`,
    type: 'MERGE',
    category: 'MERGE',
    scope: ctx.scope ?? 'MUSHAF',
    conditions,
    actions: [{ type: action }],
    priority: 90,
    groupId: 'merge',
    // خصوصية الآية افتراضيًا حتى تقدر القاعدة المرشحة على التجاوز المحلي إن لزم.
    specificity: (ctx.scope === 'AYAH' ? 'AYAH' : 'MUSHAF') as SpecificityLevel,
    hardness: 'SOFT',
    status: 'DRAFT',
    version: 1,
    testCases: [
      {
        name: 'حالة التصحيح الأصلية',
        input: { differenceType: ctx.differenceType, relatedType: ctx.relatedType ?? ctx.differenceType },
        expected: ctx.editorWantsMerge ? 'MERGE' : 'SEPARATE',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/** مفتاح نمط لتجميع التصحيحات المتشابهة. */
function patternKey(ctx: CorrectionContext): string {
  const pair = [ctx.differenceType, ctx.relatedType ?? ''].sort().join('|');
  const flip = ctx.engineMerged === ctx.editorWantsMerge ? 'same' : 'flip';
  return `${pair}::${ctx.editorWantsMerge ? 'merge' : 'separate'}::${flip}`;
}

/** اقتراح نمط متكرر من مجموعة تصحيحات (FR-ES-12.3). */
export interface CandidatePattern {
  key: string;
  differenceType: string;
  relatedType?: string;
  editorWantsMerge: boolean;
  count: number;
  rule: EngineRule;
}

/**
 * يفحص مجموعة تصحيحات ويُرجع الأنماط التي تكرّرت بما يكفي (≥ الحدّ) لاقتراح
 * قاعدة منها. لا يُنشئ قاعدة تلقائيًا — يعرض المقترح للمراجعة (P-06).
 */
export function detectRecurringPatterns(
  corrections: CorrectionContext[],
  threshold: number = PATTERN_REPEAT_THRESHOLD
): CandidatePattern[] {
  const groups = new Map<string, CorrectionContext[]>();
  for (const correction of corrections) {
    const key = patternKey(correction);
    const list = groups.get(key) ?? [];
    list.push(correction);
    groups.set(key, list);
  }

  const patterns: CandidatePattern[] = [];
  for (const [key, list] of groups) {
    if (list.length < threshold) continue;
    const first = list[0];
    patterns.push({
      key,
      differenceType: first.differenceType,
      relatedType: first.relatedType,
      editorWantsMerge: first.editorWantsMerge,
      count: list.length,
      rule: proposeCandidateRule(first),
    });
  }
  return patterns.sort((a, b) => b.count - a.count);
}

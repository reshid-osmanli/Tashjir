// ساحة اختبار المحرك على موضع — Testing Playground (FR-ES-09.1)
// مشروع التشجير - نظام القراءات العشر
//
// Input → Rules Applied → Conflicts → Merge Decisions → Variants → Final Result
// مبني كليًا على Decision API وTrace — لا مسار حساب ثانٍ.

import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { resolveDifference, resolveMerge, resolveVariant } from './api';
import type { DecisionContext } from './policy';
import type { DecisionTraceStep } from './resolver';

export interface PlaygroundInput {
  differenceType: string;
  relatedType: string;
  variants?: Array<{ id: string; strengthRank?: number }>;
  sameReader?: boolean;
}

export interface PlaygroundReport {
  input: PlaygroundInput;
  rulesApplied: Array<{ id: string; name: string; priority: number; status: string }>;
  conflicts: DecisionTraceStep[];
  merge: { merge: boolean; reason: string };
  variants: { winnerId?: string; orderedIds: string[] };
  difference: { create: boolean; reason: string };
  finalLabel: string;
  trace: DecisionTraceStep[];
}

export function testEngineAtPosition(input: PlaygroundInput, profile: EngineConfig): PlaygroundReport {
  const ctx: DecisionContext = {
    differenceType: input.differenceType,
    relatedType: input.relatedType,
    sameReader: input.sameReader ?? true,
  };
  const merge = resolveMerge(input.differenceType, input.relatedType, profile, ctx);
  const difference = resolveDifference(ctx, profile);
  const variants = resolveVariant(input.variants ?? [{ id: 'A', strengthRank: 2 }, { id: 'B', strengthRank: 1 }], ctx, profile);

  const rulesApplied = merge.appliedRules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    status: 'applied',
  }));
  for (const skipped of merge.skippedRules) {
    rulesApplied.push({
      id: skipped.rule.id,
      name: skipped.rule.name,
      priority: skipped.rule.priority,
      status: 'skipped',
    });
  }

  const conflicts = merge.trace.filter((step) => step.stage === 'CONFLICT' || step.status === 'blocked');
  const finalLabel = merge.decision.merge
    ? `النهائي: دمج ${input.differenceType}+${input.relatedType} · الوجه ${variants.decision.winnerId ?? '—'}`
    : `النهائي: فصل · الوجه ${variants.decision.winnerId ?? '—'}`;

  return {
    input,
    rulesApplied,
    conflicts,
    merge: merge.decision,
    variants: variants.decision,
    difference: difference.decision,
    finalLabel,
    trace: [...merge.trace, ...difference.trace, ...variants.trace],
  };
}

// تشغيل جاف لقاعدة سياسة — Dry Run (FR-ES-09.2)
// مشروع التشجير - نظام القراءات العشر
//
// قراءة فقط حتى Apply صريح. يعيد الأرقام السبعة:
// Matched / Would Create / Would Modify / Would Merge / Would Skip / Conflicts / Forbidden

import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { resolveDifference, resolveMerge } from './api';
import type { DecisionContext } from './policy';
import { DEFAULT_COMPARE_INPUTS, type CompareInput } from './profile-compare';
import { officialProfile, sandboxProfile } from './sandbox';

export interface DryRunLocus {
  id: string;
  differenceType: string;
  relatedType: string;
  classification: 'create' | 'modify' | 'merge' | 'skip' | 'conflict' | 'forbidden';
  officialMerge: boolean;
  sandboxMerge: boolean;
}

export interface DryRunReport {
  matched: number;
  wouldCreate: number;
  wouldModify: number;
  wouldMerge: number;
  wouldSkip: number;
  conflicts: number;
  forbidden: number;
  items: DryRunLocus[];
}

export interface DryRunOptions {
  inputs?: CompareInput[];
  cancelled?: () => boolean;
}

function withCandidate(config: EngineConfig, rule?: EngineRule): EngineConfig {
  if (!rule) return config;
  if (config.rules.some((item) => item.id === rule.id)) {
    return { ...config, rules: config.rules.map((item) => (item.id === rule.id ? rule : item)) };
  }
  return { ...config, rules: [...config.rules, rule] };
}

export function dryRunRule(config: EngineConfig, rule?: EngineRule, options: DryRunOptions = {}): DryRunReport {
  const inputs = options.inputs ?? DEFAULT_COMPARE_INPUTS;
  const candidateConfig = withCandidate(config, rule);
  const official = officialProfile(config);
  const sandbox = sandboxProfile(candidateConfig);

  const items: DryRunLocus[] = [];
  for (const input of inputs) {
    if (options.cancelled?.()) break;
    const ctx: DecisionContext = { differenceType: input.differenceType, relatedType: input.relatedType, sameReader: true };
    const officialMerge = resolveMerge(input.differenceType, input.relatedType, official, ctx).decision.merge;
    const sandboxMerge = resolveMerge(input.differenceType, input.relatedType, sandbox, ctx).decision.merge;
    const create = resolveDifference(ctx, sandbox).decision.create;
    const forbidden = input.id.includes('forbidden');

    let classification: DryRunLocus['classification'];
    if (forbidden) classification = 'forbidden';
    else if (officialMerge !== sandboxMerge) classification = 'conflict';
    else if (create) classification = 'create';
    else if (sandboxMerge) classification = 'merge';
    else classification = 'skip';

    items.push({
      id: input.id,
      differenceType: input.differenceType,
      relatedType: input.relatedType,
      classification,
      officialMerge,
      sandboxMerge,
    });
  }

  const count = (kind: DryRunLocus['classification']) => items.filter((item) => item.classification === kind).length;
  const wouldModify = items.filter((item) => item.officialMerge !== item.sandboxMerge && item.classification !== 'forbidden').length;

  return {
    matched: items.length,
    wouldCreate: count('create'),
    wouldModify,
    wouldMerge: count('merge'),
    wouldSkip: count('skip'),
    conflicts: count('conflict'),
    forbidden: count('forbidden'),
    items,
  };
}

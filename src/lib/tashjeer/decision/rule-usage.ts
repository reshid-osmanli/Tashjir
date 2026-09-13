// مؤشرات الاستخدام والجودة — Rule Usage & Quality (FR-ES-13)
// بيانات وصفية لا تغيّر النتيجة تلقائيًا أبدًا.

import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { resolveMerge } from './api';
import { DEFAULT_COMPARE_INPUTS, type CompareInput } from './profile-compare';
import { runProfileTests } from './rule-test-runner';

export interface RuleUsageStats {
  ruleId: string;
  used: number;
  correct: number;
  corrected: number;
  conflict: number;
}

export interface QualityIndicators {
  accuracyAgainstReference: number;
  correctionRate: number;
  conflictRate: number;
  usageCount: number;
}

export interface EngineDashboardStats {
  totalRules: number;
  active: number;
  conflicts: number;
  engineErrors: number;
  manualCorrections: number;
  referenceMismatches: number;
  candidates: number;
  recentChanges: number;
  problematic: Array<{ ruleId: string; name: string; conflicts: number }>;
  usage: RuleUsageStats[];
  quality: QualityIndicators;
}

export function computeRuleUsage(profile: EngineConfig, inputs: CompareInput[] = DEFAULT_COMPARE_INPUTS): RuleUsageStats[] {
  return profile.rules.map((rule) => {
    let used = 0;
    let correct = 0;
    let corrected = 0;
    let conflict = 0;
    for (const input of inputs) {
      const result = resolveMerge(input.differenceType, input.relatedType, profile, {
        differenceType: input.differenceType,
        relatedType: input.relatedType,
        sameReader: true,
      });
      const applied = result.appliedRules.some((item) => item.id === rule.id);
      if (!applied) continue;
      used += 1;
      if (typeof input.referenceMerge === 'boolean') {
        if (result.decision.merge === input.referenceMerge) correct += 1;
        else {
          corrected += 1;
          conflict += 1;
        }
      } else {
        correct += 1;
      }
    }
    return { ruleId: rule.id, used, correct, corrected, conflict };
  });
}

export function computeDashboardStats(profile: EngineConfig, inputs: CompareInput[] = DEFAULT_COMPARE_INPUTS): EngineDashboardStats {
  const usage = computeRuleUsage(profile, inputs);
  const tests = runProfileTests(profile);
  const active = profile.rules.filter((rule) => rule.status === 'ACTIVE').length;
  const candidates = profile.rules.filter((rule) => rule.status === 'DRAFT').length;
  const totalUsed = usage.reduce((sum, item) => sum + item.used, 0);
  const totalCorrect = usage.reduce((sum, item) => sum + item.correct, 0);
  const totalCorrected = usage.reduce((sum, item) => sum + item.corrected, 0);
  const totalConflict = usage.reduce((sum, item) => sum + item.conflict, 0);
  const problematic = usage
    .filter((item) => item.conflict > 0)
    .sort((a, b) => b.conflict - a.conflict)
    .slice(0, 5)
    .map((item) => {
      const rule = profile.rules.find((entry) => entry.id === item.ruleId) as EngineRule;
      return { ruleId: item.ruleId, name: rule?.name ?? item.ruleId, conflicts: item.conflict };
    });

  const quality: QualityIndicators = {
    accuracyAgainstReference: totalUsed === 0 ? 1 : totalCorrect / totalUsed,
    correctionRate: totalUsed === 0 ? 0 : totalCorrected / totalUsed,
    conflictRate: totalUsed === 0 ? 0 : totalConflict / totalUsed,
    usageCount: totalUsed,
  };

  return {
    totalRules: profile.rules.length,
    active,
    conflicts: totalConflict,
    engineErrors: tests.failed,
    manualCorrections: totalCorrected,
    referenceMismatches: totalCorrected,
    candidates,
    recentChanges: profile.rules.filter((rule) => rule.updatedAt !== rule.createdAt).length,
    problematic,
    usage,
    quality,
  };
}

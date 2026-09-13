// اختبارات الحزمة 12 — Playground / Dry Run / Sandbox / Profiles / Usage
import { describe, expect, it } from 'vitest';
import { DEFAULT_SYSTEM_PROFILE, createDefaultEngineConfig } from '@/lib/tashjeer/decision/policy';
import { resolveMerge } from '@/lib/tashjeer/decision/api';
import { testEngineAtPosition } from '@/lib/tashjeer/decision/playground';
import { dryRunRule } from '@/lib/tashjeer/decision/dry-run';
import { analyzeRuleImpact, livePreviewMerge } from '@/lib/tashjeer/decision/impact-analysis';
import { computeDashboardStats } from '@/lib/tashjeer/decision/rule-usage';
import { affectsOfficialData, nextApprovalStatus, officialProfile, sandboxProfile } from '@/lib/tashjeer/decision/sandbox';
import { compareProfiles } from '@/lib/tashjeer/decision/profile-compare';
import { rerunEngine } from '@/lib/tashjeer/decision/engine-rerun';
import type { EngineRule } from '@/lib/tashjeer/model/v8';

const draftPrevent: EngineRule = {
  id: 'er-draft-prevent',
  name: 'مسودة منع مد+تحقيق',
  type: 'MERGE',
  category: 'MERGE',
  scope: 'MUSHAF',
  conditions: {
    all: [
      { field: 'differenceType', op: 'equals', value: 'MADD' },
      { field: 'relatedType', op: 'equals', value: 'TAHQIQ' },
    ],
  },
  actions: [{ type: 'PREVENT_MERGE' }],
  priority: 200,
  groupId: 'merge',
  specificity: 'MUSHAF',
  hardness: 'HARD',
  status: 'DRAFT',
  version: 1,
  createdAt: 't',
  updatedAt: 't',
};

describe('ساحة الاختبار (FR-ES-09.1)', () => {
  it('يعيد أثرًا كاملًا عبر Decision API', () => {
    const report = testEngineAtPosition({ differenceType: 'MADD', relatedType: 'TAHQIQ' }, DEFAULT_SYSTEM_PROFILE);
    expect(report.trace.length).toBeGreaterThan(0);
    expect(report.merge.merge).toBe(true);
    expect(report.finalLabel).toContain('النهائي');
  });
});

describe('Dry Run (FR-ES-09.2)', () => {
  it('يعيد الأرقام السبعة دون كتابة', () => {
    const report = dryRunRule(DEFAULT_SYSTEM_PROFILE);
    expect(report.matched).toBeGreaterThan(0);
    expect(report).toHaveProperty('wouldCreate');
    expect(report).toHaveProperty('wouldModify');
    expect(report).toHaveProperty('wouldMerge');
    expect(report).toHaveProperty('wouldSkip');
    expect(report).toHaveProperty('conflicts');
    expect(report).toHaveProperty('forbidden');
  });
});

describe('Sandbox (FR-ES-11.2)', () => {
  it('المسودة لا تمسّ القرار الرسمي', () => {
    const config = createDefaultEngineConfig('experimental');
    config.rules.push(draftPrevent);
    const official = resolveMerge('MADD', 'TAHQIQ', officialProfile(config)).decision.merge;
    const sandbox = resolveMerge('MADD', 'TAHQIQ', sandboxProfile(config), {
      differenceType: 'MADD',
      relatedType: 'TAHQIQ',
    }).decision.merge;
    expect(official).toBe(true);
    expect(affectsOfficialData(draftPrevent)).toBe(false);
    expect(nextApprovalStatus('DRAFT')).toBe('ACTIVE');
    // الساندبوكس يرى المسودة ذات الأولوية الأعلى فتمنع الدمج.
    expect(sandbox).toBe(false);
  });
});

describe('Impact + Live Preview (FR-ES-09.3+4)', () => {
  it('يحسب أثر قاعدة مستخدمة ويعرض قبل/بعد', () => {
    const rule = DEFAULT_SYSTEM_PROFILE.rules[1]!;
    const impact = analyzeRuleImpact(DEFAULT_SYSTEM_PROFILE, rule);
    expect(impact.counts.loci).toBeGreaterThanOrEqual(0);
    expect(impact.warning.length).toBeGreaterThan(0);
    const live = livePreviewMerge(DEFAULT_SYSTEM_PROFILE, rule, { ...rule, priority: 10 }, 'MADD', 'TAHQIQ');
    expect(typeof live.before).toBe('boolean');
    expect(typeof live.after).toBe('boolean');
  });
});

describe('مقارنة الملفات وإعادة التشغيل', () => {
  it('يصنّف Changed/Same/Improved/Regressed', () => {
    const a = createDefaultEngineConfig('a');
    const b = createDefaultEngineConfig('b');
    const report = compareProfiles(a, b);
    expect(report.same + report.changed + report.improved + report.regressed).toBe(report.total);
    const rerun = rerunEngine(a, b, 'mushaf');
    expect(rerun.preservedManual).toBe(true);
  });
});

describe('لوحة المعلومات Usage/Quality (FR-ES-13)', () => {
  it('مؤشرات وصفية لا تغيّر القرار', () => {
    const before = resolveMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE).decision.merge;
    const stats = computeDashboardStats(DEFAULT_SYSTEM_PROFILE);
    const after = resolveMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE).decision.merge;
    expect(before).toBe(after);
    expect(stats.totalRules).toBe(DEFAULT_SYSTEM_PROFILE.rules.length);
    expect(stats.quality.usageCount).toBeGreaterThanOrEqual(0);
  });
});

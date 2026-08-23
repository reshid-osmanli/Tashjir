// اختبارات PH10 - Testing Playground + Sandbox + Dashboard
// FR-ES-07..13

import { describe, it, expect } from 'vitest';
import {
  testRule,
  testMultipleRules,
  dryRunRule,
  analyzeRuleImpact,
  compareBeforeAfter,
  compareProfiles,
  generateLivePreview,
} from '@/lib/tashjeer/testing-playground';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import type { Variant } from '@/types/tashjeer';

// Helper to create test variants
function makeVariant(
  id: string,
  ayahKey: number,
  title: string,
  category: 'USUL' | 'FARSH' | 'MADUD' = 'USUL'
): Variant {
  return {
    id,
    ayahKey,
    category,
    title,
    startPosition: 1,
    endPosition: 1,
    targetKind: 'WORDS',
    status: 'DRAFT',
    origin: 'EDITOR',
    alternatives: [],
  };
}

// Helper to create test rules
function makeRule(
  id: string,
  name: string,
  priority: number,
  actionType: string = 'MODIFY_VARIANT'
): EngineRule {
  return {
    id,
    name,
    category: 'USUL',
    description: name,
    conditions: { all: [] },
    actions: [{ type: actionType as any, parameters: {} }],
    priority,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('PH10 - Testing Playground (FR-ES-09)', () => {
  describe('Rule Testing', () => {
    it('tests single rule on input', () => {
      const rule = makeRule('r1', 'Test Rule', 100);
      const input = {
        ayahKey: 1001,
        variants: [makeVariant('v1', 1001, 'مد')],
        context: 'WAQF' as const,
      };
      const profile = {} as EngineConfig;

      const result = testRule(rule, input, profile);

      expect(result.ruleId).toBe('r1');
      expect(result.ruleName).toBe('Test Rule');
      expect(result.priority).toBe(100);
    });

    it('tests multiple rules', () => {
      const rules = [
        makeRule('r1', 'Rule 1', 100),
        makeRule('r2', 'Rule 2', 80),
      ];
      const input = {
        ayahKey: 1001,
        variants: [makeVariant('v1', 1001, 'مد')],
      };
      const profile = {} as EngineConfig;

      const results = testMultipleRules(rules, input, profile);

      expect(results.length).toBe(2);
      expect(results[0].ruleId).toBe('r1');
      expect(results[1].ruleId).toBe('r2');
    });
  });

  describe('Dry Run', () => {
    it('performs dry run on all variants', () => {
      const rule = makeRule('r1', 'Test Rule', 100, 'CREATE_VARIANT');
      const variants = [
        makeVariant('v1', 1001, 'مد'),
        makeVariant('v2', 1002, 'همز'),
      ];
      const profile = {} as EngineConfig;

      const report = dryRunRule(rule, variants, profile);

      expect(report.totalMatches).toBe(2);
      expect(report.wouldCreate).toBe(2);
    });

    it('counts different action types', () => {
      const rule = makeRule('r1', 'Modify Rule', 100, 'MODIFY_VARIANT');
      const variants = [
        makeVariant('v1', 1001, 'مد'),
        makeVariant('v2', 1002, 'همز'),
        makeVariant('v3', 1003, 'إدغام'),
      ];
      const profile = {} as EngineConfig;

      const report = dryRunRule(rule, variants, profile);

      expect(report.wouldModify).toBe(3);
      expect(report.wouldCreate).toBe(0);
    });
  });

  describe('Impact Analysis', () => {
    it('analyzes rule impact on variants', () => {
      const rule = makeRule('r1', 'Test Rule', 100);
      const variants = [
        makeVariant('v1', 1001, 'مد'),
        makeVariant('v2', 1002, 'همز'),
      ];
      const relations: any[] = [];
      const corrections: any[] = [];

      const report = analyzeRuleImpact(rule, variants, relations, corrections);

      expect(report.affectedPositions).toBe(2);
      expect(report.affectedDifferences).toBe(2);
    });

    it('warns about affected corrections', () => {
      const rule = makeRule('r1', 'Test Rule', 100);
      const variants = [makeVariant('v1', 1001, 'مد')];
      const relations: any[] = [];
      const corrections = [{ targetId: 'v1' }];

      const report = analyzeRuleImpact(rule, variants, relations, corrections);

      expect(report.affectedCorrections).toBe(1);
      expect(report.warning).toContain('تصحيح يدوي');
    });

    it('counts affected relations', () => {
      const rule = makeRule('r1', 'Test Rule', 100);
      const variants = [
        makeVariant('v1', 1001, 'مد'),
        makeVariant('v2', 1002, 'همز'),
      ];
      const relations = [
        { fromId: 'v1', toId: 'v2' },
        { fromId: 'v1', toId: 'v3' },
      ];
      const corrections: any[] = [];

      const report = analyzeRuleImpact(rule, variants, relations, corrections);

      expect(report.affectedRelations).toBe(2);
    });
  });

  describe('Before/After Comparison', () => {
    it('identifies added variants', () => {
      const before = [makeVariant('v1', 1001, 'مد')];
      const after = [
        makeVariant('v1', 1001, 'مد'),
        makeVariant('v2', 1002, 'همز'),
      ];

      const comparison = compareBeforeAfter(before, after);

      expect(comparison.added.length).toBe(1);
      expect(comparison.added[0].id).toBe('v2');
    });

    it('identifies removed variants', () => {
      const before = [
        makeVariant('v1', 1001, 'مد'),
        makeVariant('v2', 1002, 'همز'),
      ];
      const after = [makeVariant('v1', 1001, 'مد')];

      const comparison = compareBeforeAfter(before, after);

      expect(comparison.removed.length).toBe(1);
      expect(comparison.removed[0].id).toBe('v2');
    });

    it('identifies modified variants', () => {
      const before = [makeVariant('v1', 1001, 'مد')];
      const after = [makeVariant('v1', 1001, 'مد طبيعي')];

      const comparison = compareBeforeAfter(before, after);

      expect(comparison.modified.length).toBe(1);
      expect(comparison.modified[0].changes).toContain('العنوان: مد → مد طبيعي');
    });

    it('handles no changes', () => {
      const variants = [makeVariant('v1', 1001, 'مد')];

      const comparison = compareBeforeAfter(variants, variants);

      expect(comparison.added.length).toBe(0);
      expect(comparison.removed.length).toBe(0);
      expect(comparison.modified.length).toBe(0);
    });
  });

  describe('Profile Comparison', () => {
    it('compares two profiles', () => {
      const profileA = { profile: 'default' } as EngineConfig;
      const profileB = { profile: 'experimental' } as EngineConfig;
      const variants = [
        makeVariant('v1', 1001, 'مد'),
        makeVariant('v2', 1002, 'همز'),
      ];

      const comparison = compareProfiles(profileA, profileB, variants);

      expect(comparison.profileA).toBe('default');
      expect(comparison.profileB).toBe('experimental');
      expect(comparison.details.length).toBe(2);
    });

    it('counts status categories', () => {
      const profileA = { profile: 'default' } as EngineConfig;
      const profileB = { profile: 'experimental' } as EngineConfig;
      const variants = [
        makeVariant('v1', 1001, 'مد'),
        makeVariant('v2', 1002, 'همز'),
        makeVariant('v3', 1003, 'إدغام'),
      ];

      const comparison = compareProfiles(profileA, profileB, variants);

      const total =
        comparison.changed +
        comparison.same +
        comparison.improved +
        comparison.regressed;
      expect(total).toBe(3);
    });
  });

  describe('Live Preview', () => {
    it('generates live preview for rule', () => {
      const rule = makeRule('r1', 'Modify Rule', 100, 'MODIFY_VARIANT');
      const variants = [makeVariant('v1', 1001, 'مد')];
      const profile = {} as EngineConfig;

      const preview = generateLivePreview(rule, variants, profile);

      expect(preview.before.length).toBe(1);
      expect(preview.after.length).toBe(1);
      expect(preview.after[0].title).toContain('معدّل');
    });

    it('shows no changes for non-modify rules', () => {
      const rule = makeRule('r1', 'Skip Rule', 100, 'SKIP_VARIANT');
      const variants = [makeVariant('v1', 1001, 'مد')];
      const profile = {} as EngineConfig;

      const preview = generateLivePreview(rule, variants, profile);

      expect(preview.modified.length).toBe(0);
    });
  });
});

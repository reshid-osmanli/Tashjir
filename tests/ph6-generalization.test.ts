import { describe, it, expect } from 'vitest';
import {
  getCategoryRank,
  sortCategoriesByRank,
  createMultiTypeGeneralization,
  validateLocalOverride,
  applyLocalOverride,
  calculateDeletionImpact,
  groupIndependentTypes,
} from '@/lib/tashjeer/generalization';
import type { VariantCategory } from '@/types';
import type { RuleOccurrence, GlobalRule, Variant as V8Variant } from '@/lib/tashjeer/model/v8';
import type { Variant } from '@/types/tashjeer';

describe('PH6 - Generalization and Local Independence', () => {
  describe('getCategoryRank', () => {
    it('returns correct rank for known categories', () => {
      expect(getCategoryRank('USUL')).toBe(1);
      expect(getCategoryRank('FARSH')).toBe(3);
      expect(getCategoryRank('MADUD')).toBe(2);
      expect(getCategoryRank('HAMZ')).toBe(2);
    });

    it('returns 99 for unknown categories', () => {
      expect(getCategoryRank('UNKNOWN' as VariantCategory)).toBe(99);
    });
  });

  describe('sortCategoriesByRank', () => {
    it('sorts categories by rank', () => {
      const categories: VariantCategory[] = ['FARSH', 'USUL', 'MADUD'];
      const sorted = sortCategoriesByRank(categories);
      expect(sorted).toEqual(['USUL', 'MADUD', 'FARSH']);
    });

    it('handles categories with same rank', () => {
      const categories: VariantCategory[] = ['HAMZ', 'MADUD', 'USUL'];
      const sorted = sortCategoriesByRank(categories);
      expect(sorted[0]).toBe('USUL');
      expect(sorted.slice(1)).toContain('MADUD');
      expect(sorted.slice(1)).toContain('HAMZ');
    });
  });

  describe('createMultiTypeGeneralization', () => {
    it('creates rules for each category', () => {
      const result = createMultiTypeGeneralization(
        {
          categories: ['USUL', 'FARSH', 'MADUD'],
          pattern: { type: 'CHARACTERS', value: 'test' },
          scope: { kind: 'ALL' },
          locus: { startPosition: 1, endPosition: 3 },
          titles: {
            USUL: 'أصول',
            FARSH: 'فرش',
            MADUD: 'مدود',
          },
          ruleLabels: {
            USUL: 'حكم أصول',
            FARSH: 'حكم فرش',
            MADUD: 'حكم مد',
          },
          batchId: 'batch-1',
        },
        10
      );

      expect(result.rules).toHaveLength(3);
      expect(result.batchId).toBe('batch-1');
      
      // Check rules are sorted by rank
      expect(result.rules[0].category).toBe('USUL');
      expect(result.rules[1].category).toBe('MADUD');
      expect(result.rules[2].category).toBe('FARSH');
    });

    it('assigns correct priority based on rank', () => {
      const result = createMultiTypeGeneralization(
        {
          categories: ['USUL', 'FARSH'],
          pattern: {},
          scope: { kind: 'ALL' },
          locus: { startPosition: 1, endPosition: 1 },
          titles: {},
          ruleLabels: {},
          batchId: 'batch-2',
        },
        5
      );

      expect(result.rules[0].priority).toBe(10); // USUL rank 1 * 10
      expect(result.rules[1].priority).toBe(30); // FARSH rank 3 * 10
    });
  });

  describe('validateLocalOverride', () => {
    it('validates occurrence exists', () => {
      const occurrences: RuleOccurrence[] = [
        {
          id: 'occ-1',
          globalRuleId: 'rule-1',
          ayahKey: 1001,
          locus: { startPosition: 1, endPosition: 1 },
        },
      ];

      const result = validateLocalOverride(
        {
          globalRuleId: 'rule-1',
          occurrenceId: 'occ-1',
          type: 'MODIFY',
        },
        occurrences
      );

      expect(result.valid).toBe(true);
    });

    it('rejects non-existent occurrence', () => {
      const result = validateLocalOverride(
        {
          globalRuleId: 'rule-1',
          occurrenceId: 'occ-999',
          type: 'MODIFY',
        },
        []
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('غير موجود');
    });

    it('rejects occurrence from different rule', () => {
      const occurrences: RuleOccurrence[] = [
        {
          id: 'occ-1',
          globalRuleId: 'rule-2',
          ayahKey: 1001,
          locus: { startPosition: 1, endPosition: 1 },
        },
      ];

      const result = validateLocalOverride(
        {
          globalRuleId: 'rule-1',
          occurrenceId: 'occ-1',
          type: 'MODIFY',
        },
        occurrences
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('لا ينتمي');
    });
  });

  describe('applyLocalOverride', () => {
    it('applies MODIFY override', () => {
      const occurrence: RuleOccurrence = {
        id: 'occ-1',
        globalRuleId: 'rule-1',
        ayahKey: 1001,
        locus: { startPosition: 1, endPosition: 1 },
      };

      const result = applyLocalOverride(occurrence, {
        globalRuleId: 'rule-1',
        occurrenceId: 'occ-1',
        type: 'MODIFY',
        patch: { label: 'Modified' } as Partial<V8Variant>,
        note: 'Test modification',
      });

      expect(result.modified).toBe(true);
      expect(result.localOverride?.variantPatch?.label).toBe('Modified');
      expect(result.localOverride?.note).toBe('Test modification');
    });

    it('applies DELETE override', () => {
      const occurrence: RuleOccurrence = {
        id: 'occ-1',
        globalRuleId: 'rule-1',
        ayahKey: 1001,
        locus: { startPosition: 1, endPosition: 1 },
      };

      const result = applyLocalOverride(occurrence, {
        globalRuleId: 'rule-1',
        occurrenceId: 'occ-1',
        type: 'DELETE',
      });

      expect(result.cancelled).toBe(true);
      expect(result.localOverride?.cancelled).toBe(true);
    });

    it('applies RESTORE override', () => {
      const occurrence: RuleOccurrence = {
        id: 'occ-1',
        globalRuleId: 'rule-1',
        ayahKey: 1001,
        locus: { startPosition: 1, endPosition: 1 },
        modified: true,
        localOverride: { variantPatch: { label: 'Modified' } as Partial<V8Variant> },
      };

      const result = applyLocalOverride(occurrence, {
        globalRuleId: 'rule-1',
        occurrenceId: 'occ-1',
        type: 'RESTORE',
      });

      expect(result.modified).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.localOverride).toBeUndefined();
    });
  });

  describe('calculateDeletionImpact', () => {
    it('calculates impact correctly', () => {
      const rule: GlobalRule = {
        id: 'rule-1',
        title: 'Test Rule',
        category: 'USUL',
        pattern: {},
        scope: { kind: 'ALL' },
        priority: 10,
        status: 'ACTIVE',
        version: 1,
        createdAt: '',
        updatedAt: '',
      };

      const occurrences: RuleOccurrence[] = [
        {
          id: 'occ-1',
          globalRuleId: 'rule-1',
          ayahKey: 1001,
          locus: { startPosition: 1, endPosition: 1 },
          confirmed: true,
        },
        {
          id: 'occ-2',
          globalRuleId: 'rule-1',
          ayahKey: 1002,
          locus: { startPosition: 2, endPosition: 2 },
          localOverride: { variantPatch: {} },
        },
        {
          id: 'occ-3',
          globalRuleId: 'rule-2',
          ayahKey: 1003,
          locus: { startPosition: 3, endPosition: 3 },
        },
      ];

      const allRules: GlobalRule[] = [
        rule,
        {
          id: 'rule-2',
          title: 'Other Rule',
          category: 'FARSH',
          pattern: {},
          scope: { kind: 'ALL' },
          priority: 30,
          status: 'ACTIVE',
          version: 1,
          createdAt: '',
          updatedAt: '',
        },
      ];

      const impact = calculateDeletionImpact(rule, occurrences, allRules);

      expect(impact.derivedOccurrences).toBe(2);
      expect(impact.overriddenOccurrences).toBe(1);
      expect(impact.confirmedOccurrences).toBe(1);
      expect(impact.relatedCategories).toContain('FARSH');
    });
  });

  describe('groupIndependentTypes', () => {
    it('groups variants by locus', () => {
      const variants: Variant[] = [
        {
          id: 'v1',
          ayahKey: 1001,
          category: 'USUL',
          title: 'Variant 1',
          startPosition: 1,
          endPosition: 3,
          targetKind: 'WORDS',
          status: 'DRAFT',
          origin: 'EDITOR',
          alternatives: [],
        },
        {
          id: 'v2',
          ayahKey: 1001,
          category: 'FARSH',
          title: 'Variant 2',
          startPosition: 1,
          endPosition: 3,
          targetKind: 'WORDS',
          status: 'DRAFT',
          origin: 'EDITOR',
          alternatives: [],
        },
        {
          id: 'v3',
          ayahKey: 1001,
          category: 'MADUD',
          title: 'Variant 3',
          startPosition: 5,
          endPosition: 5,
          targetKind: 'WORDS',
          status: 'DRAFT',
          origin: 'EDITOR',
          alternatives: [],
        },
      ];

      const groups = groupIndependentTypes(variants, new Map());

      expect(groups).toHaveLength(2);
      expect(groups[0].types).toHaveLength(2); // USUL and FARSH at position 1-3
      expect(groups[1].types).toHaveLength(1); // MADUD at position 5
    });

    it('sorts types by rank within group', () => {
      const variants: Variant[] = [
        {
          id: 'v1',
          ayahKey: 1001,
          category: 'FARSH',
          title: 'Variant 1',
          startPosition: 1,
          endPosition: 1,
          targetKind: 'WORDS',
          status: 'DRAFT',
          origin: 'EDITOR',
          alternatives: [],
        },
        {
          id: 'v2',
          ayahKey: 1001,
          category: 'USUL',
          title: 'Variant 2',
          startPosition: 1,
          endPosition: 1,
          targetKind: 'WORDS',
          status: 'DRAFT',
          origin: 'EDITOR',
          alternatives: [],
        },
      ];

      const groups = groupIndependentTypes(variants, new Map());

      expect(groups[0].types[0].category).toBe('USUL'); // rank 1
      expect(groups[0].types[1].category).toBe('FARSH'); // rank 3
    });

    it('detects local overrides', () => {
      const variants: Variant[] = [
        {
          id: 'v1',
          ayahKey: 1001,
          category: 'USUL',
          title: 'Variant 1',
          startPosition: 1,
          endPosition: 1,
          targetKind: 'WORDS',
          status: 'DRAFT',
          origin: 'EDITOR',
          alternatives: [],
          isGlobalDerived: true,
          globalRuleId: 'rule-1',
        },
      ];

      const overrides = new Map([['rule-1', { modified: true }]]);
      const groups = groupIndependentTypes(variants, overrides);

      expect(groups[0].types[0].hasLocalOverride).toBe(true);
    });
  });
});

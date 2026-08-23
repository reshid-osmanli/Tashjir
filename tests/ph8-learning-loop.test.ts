// اختبارات حلقة التعلم - Learning Loop Tests
// FR-ES-12, FR-ES-15

import { describe, it, expect } from 'vitest';
import {
  validateAgainstReference,
  discoverCorrectionPatterns,
  createCandidateFromCorrection,
  createCandidateFromPattern,
  summarizeEngineErrors,
  generateEditorToStudioLink,
  generateStudioToEditorLink,
  parseEditorLink,
  parseStudioLink,
} from '@/lib/tashjeer/learning-loop';
import type { Variant } from '@/types/tashjeer';
import type { Correction, EngineConfig } from '@/lib/tashjeer/model/v8';

// Helper to create test variants
function makeVariant(
  id: string,
  ayahKey: number,
  title: string,
  startPos: number,
  endPos: number,
  origin: 'ENGINE' | 'EDITOR' = 'ENGINE',
  status: 'DRAFT' | 'APPROVED' = 'DRAFT'
): Variant {
  return {
    id,
    ayahKey,
    category: 'USUL',
    title,
    startPosition: startPos,
    endPosition: endPos,
    targetKind: 'WORDS',
    status,
    origin,
    alternatives: [],
  };
}

describe('PH8 - Learning Loop (FR-ES-12, FR-ES-15)', () => {
  describe('Reference Validation', () => {
    it('identifies CORRECT items (engine matches reference)', () => {
      const engineVariants = [makeVariant('v1', 1001, 'مد', 1, 1)];
      const referenceVariants = [makeVariant('v1', 1001, 'مد', 1, 1, 'ENGINE', 'APPROVED')];
      const editorVariants: Variant[] = [];

      const report = validateAgainstReference(engineVariants, referenceVariants, editorVariants);

      expect(report.correct).toBe(1);
      expect(report.items[0].status).toBe('CORRECT');
    });

    it('identifies WRONG items (engine has but reference does not)', () => {
      const engineVariants = [makeVariant('v1', 1001, 'مد', 1, 1)];
      const referenceVariants: Variant[] = [];
      const editorVariants: Variant[] = [];

      const report = validateAgainstReference(engineVariants, referenceVariants, editorVariants);

      expect(report.wrong).toBe(1);
      expect(report.items[0].status).toBe('WRONG');
    });

    it('identifies MISSING items (reference has but engine does not)', () => {
      const engineVariants: Variant[] = [];
      const referenceVariants = [makeVariant('v1', 1001, 'مد', 1, 1, 'ENGINE', 'APPROVED')];
      const editorVariants: Variant[] = [];

      const report = validateAgainstReference(engineVariants, referenceVariants, editorVariants);

      expect(report.missing).toBe(1);
      expect(report.items[0].status).toBe('MISSING');
    });

    it('identifies EXTRA items (editor added but not in reference)', () => {
      const engineVariants: Variant[] = [];
      const referenceVariants = [makeVariant('v1', 1001, 'مد', 1, 1, 'ENGINE', 'APPROVED')];
      const editorVariants = [makeVariant('v2', 1001, 'مد', 1, 1, 'EDITOR')];

      const report = validateAgainstReference(engineVariants, referenceVariants, editorVariants);

      expect(report.extra).toBe(1);
    });

    it('calculates accuracy correctly', () => {
      const engineVariants = [
        makeVariant('v1', 1001, 'مد', 1, 1),
        makeVariant('v2', 1001, 'همز', 2, 2),
      ];
      const referenceVariants = [
        makeVariant('v1', 1001, 'مد', 1, 1, 'ENGINE', 'APPROVED'),
        makeVariant('v2', 1001, 'همز', 2, 2, 'ENGINE', 'APPROVED'),
      ];
      const editorVariants: Variant[] = [];

      const report = validateAgainstReference(engineVariants, referenceVariants, editorVariants);

      expect(report.accuracy).toBe(100);
      expect(report.totalItems).toBe(2);
    });

    it('handles empty inputs', () => {
      const report = validateAgainstReference([], [], []);

      expect(report.totalItems).toBe(0);
      expect(report.accuracy).toBe(0);
    });
  });

  describe('Correction Pattern Discovery', () => {
    it('discovers patterns from repeated corrections', () => {
      const corrections: Correction[] = [
        {
          id: 'c1',
          timestamp: new Date().toISOString(),
          targetType: 'VARIANT',
          targetId: 'v1',
          before: { title: 'مد' },
          after: { title: 'مد طبيعي' },
          metadata: {
            category: 'MADD',
            context: 'WAQF_ONLY',
            readerIds: ['reader1'],
          },
        },
        {
          id: 'c2',
          timestamp: new Date().toISOString(),
          targetType: 'VARIANT',
          targetId: 'v2',
          before: { title: 'مد' },
          after: { title: 'مد طبيعي' },
          metadata: {
            category: 'MADD',
            context: 'WAQF_ONLY',
            readerIds: ['reader1'],
          },
        },
      ];

      const patterns = discoverCorrectionPatterns(corrections);

      expect(patterns.length).toBe(1);
      expect(patterns[0].count).toBe(2);
      expect(patterns[0].commonCategory).toBe('MADD');
      expect(patterns[0].commonContext).toBe('WAQF_ONLY');
    });

    it('ignores single corrections (not patterns)', () => {
      const corrections: Correction[] = [
        {
          id: 'c1',
          timestamp: new Date().toISOString(),
          targetType: 'VARIANT',
          targetId: 'v1',
          before: { title: 'مد' },
          after: { title: 'مد طبيعي' },
          metadata: { category: 'MADD' },
        },
      ];

      const patterns = discoverCorrectionPatterns(corrections);

      expect(patterns.length).toBe(0);
    });

    it('sorts patterns by count (descending)', () => {
      const corrections: Correction[] = [
        {
          id: 'c1',
          timestamp: new Date().toISOString(),
          targetType: 'VARIANT',
          targetId: 'v1',
          before: {},
          after: {},
          metadata: { category: 'MADD' },
        },
        {
          id: 'c2',
          timestamp: new Date().toISOString(),
          targetType: 'VARIANT',
          targetId: 'v2',
          before: {},
          after: {},
          metadata: { category: 'MADD' },
        },
        {
          id: 'c3',
          timestamp: new Date().toISOString(),
          targetType: 'VARIANT',
          targetId: 'v3',
          before: {},
          after: {},
          metadata: { category: 'HAMZ' },
        },
        {
          id: 'c4',
          timestamp: new Date().toISOString(),
          targetType: 'VARIANT',
          targetId: 'v4',
          before: {},
          after: {},
          metadata: { category: 'HAMZ' },
        },
        {
          id: 'c5',
          timestamp: new Date().toISOString(),
          targetType: 'VARIANT',
          targetId: 'v5',
          before: {},
          after: {},
          metadata: { category: 'HAMZ' },
        },
      ];

      const patterns = discoverCorrectionPatterns(corrections);

      expect(patterns[0].commonCategory).toBe('HAMZ');
      expect(patterns[0].count).toBe(3);
      expect(patterns[1].commonCategory).toBe('MADD');
      expect(patterns[1].count).toBe(2);
    });
  });

  describe('Candidate Rule Creation', () => {
    it('creates candidate from single correction', () => {
      const correction: Correction = {
        id: 'c1',
        timestamp: new Date().toISOString(),
        targetType: 'VARIANT',
        targetId: 'v1',
        before: { title: 'مد' },
        after: { title: 'مد طبيعي' },
        metadata: {
          category: 'MADD',
          context: 'WAQF_ONLY',
        },
      };

      const profile = {} as EngineConfig;
      const candidate = createCandidateFromCorrection(correction, profile);

      expect(candidate.id).toBeTruthy();
      expect(candidate.status).toBe('PENDING');
      expect(candidate.suggestedRule.priority).toBe(100);
      expect(candidate.suggestedRule.enabled).toBe(false);
    });

    it('creates candidate from pattern', () => {
      const pattern = {
        id: 'p1',
        description: 'نمط متكرر',
        count: 5,
        commonReaders: ['reader1'],
        commonCategory: 'MADD',
        commonContext: 'WAQF_ONLY' as const,
        suggestedConditions: { all: [] },
        suggestedAction: { type: 'OVERRIDE_VARIANT', parameters: {} },
        correctionIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
      };

      const profile = {} as EngineConfig;
      const candidate = createCandidateFromPattern(pattern, profile);

      expect(candidate.id).toBeTruthy();
      expect(candidate.pattern.count).toBe(5);
      expect(candidate.suggestedRule.metadata?.correctionCount).toBe(5);
    });
  });

  describe('Engine Error Summary', () => {
    it('summarizes errors by type', () => {
      const report = {
        totalItems: 5,
        correct: 2,
        wrong: 1,
        missing: 1,
        extra: 1,
        conflict: 0,
        accuracy: 40,
        items: [
          { ayahKey: 1001, variantId: 'v1', variantTitle: 'مد', status: 'CORRECT' as const },
          { ayahKey: 1001, variantId: 'v2', variantTitle: 'همز', status: 'WRONG' as const },
          { ayahKey: 1002, variantId: 'v3', variantTitle: 'إدغام', status: 'MISSING' as const },
          { ayahKey: 1002, variantId: 'v4', variantTitle: 'إخفاء', status: 'EXTRA' as const },
          { ayahKey: 1003, variantId: 'v5', variantTitle: 'مد', status: 'CORRECT' as const },
        ],
      };

      const summary = summarizeEngineErrors(report);

      expect(summary.totalErrors).toBe(3);
      expect(summary.byType.get('WRONG')).toBe(1);
      expect(summary.byType.get('MISSING')).toBe(1);
      expect(summary.byType.get('EXTRA')).toBe(1);
    });

    it('identifies most common error type', () => {
      const report = {
        totalItems: 4,
        correct: 1,
        wrong: 2,
        missing: 1,
        extra: 0,
        conflict: 0,
        accuracy: 25,
        items: [
          { ayahKey: 1001, variantId: 'v1', variantTitle: 'مد', status: 'WRONG' as const },
          { ayahKey: 1001, variantId: 'v2', variantTitle: 'همز', status: 'WRONG' as const },
          { ayahKey: 1002, variantId: 'v3', variantTitle: 'إدغام', status: 'MISSING' as const },
          { ayahKey: 1003, variantId: 'v4', variantTitle: 'مد', status: 'CORRECT' as const },
        ],
      };

      const summary = summarizeEngineErrors(report);

      expect(summary.mostCommonError).toBe('WRONG');
    });

    it('categorizes errors by variant type', () => {
      const report = {
        totalItems: 3,
        correct: 0,
        wrong: 2,
        missing: 1,
        extra: 0,
        conflict: 0,
        accuracy: 0,
        items: [
          { ayahKey: 1001, variantId: 'v1', variantTitle: 'مد طبيعي', status: 'WRONG' as const },
          { ayahKey: 1001, variantId: 'v2', variantTitle: 'مد منفصل', status: 'WRONG' as const },
          { ayahKey: 1002, variantId: 'v3', variantTitle: 'همزة قطع', status: 'MISSING' as const },
        ],
      };

      const summary = summarizeEngineErrors(report);

      expect(summary.byCategory.get('MADD')).toBe(2);
      expect(summary.byCategory.get('HAMZ')).toBe(1);
    });
  });

  describe('Bidirectional Linking', () => {
    it('generates editor to studio link', () => {
      const link = generateEditorToStudioLink('v1', 'c1');

      expect(link).toContain('/studio');
      expect(link).toContain('variantId=v1');
      expect(link).toContain('correctionId=c1');
    });

    it('generates editor to studio link without correction', () => {
      const link = generateEditorToStudioLink('v1');

      expect(link).toContain('/studio');
      expect(link).toContain('variantId=v1');
      expect(link).not.toContain('correctionId');
    });

    it('generates studio to editor link', () => {
      const link = generateStudioToEditorLink('r1', 1001);

      expect(link).toContain('/editor');
      expect(link).toContain('ruleId=r1');
      expect(link).toContain('ayahKey=1001');
    });

    it('generates studio to editor link without ayahKey', () => {
      const link = generateStudioToEditorLink('r1');

      expect(link).toContain('/editor');
      expect(link).toContain('ruleId=r1');
      expect(link).not.toContain('ayahKey');
    });

    it('parses editor link', () => {
      const link = '/studio?variantId=v1&correctionId=c1';
      const parsed = parseEditorLink(link);

      expect(parsed.variantId).toBe('v1');
      expect(parsed.correctionId).toBe('c1');
    });

    it('parses studio link', () => {
      const link = '/editor?ruleId=r1&ayahKey=1001';
      const parsed = parseStudioLink(link);

      expect(parsed.ruleId).toBe('r1');
      expect(parsed.ayahKey).toBe(1001);
    });

    it('handles missing parameters', () => {
      const link = '/studio';
      const parsed = parseEditorLink(link);

      expect(parsed.variantId).toBeUndefined();
      expect(parsed.correctionId).toBeUndefined();
    });
  });
});

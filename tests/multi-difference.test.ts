// اختبارات تعدد الاختلافات المستقلة - Multi-Difference Tests
// FR-ED-03، DM-09

import { describe, it, expect } from 'vitest';
import {
  buildGroupKey,
  groupDifferencesByLocus,
  computeOccurrenceIndices,
  formatOccurrenceLabel,
  detectImplicitReplacement,
  computeVariantOccurrenceIndices,
} from '@/lib/tashjeer/multi-difference';
import type { Difference } from '@/lib/tashjeer/model/v8';

// ==================== أدوات مساعدة ====================

function makeDifference(
  id: string,
  startPos: number,
  endPos: number,
  category: string,
  rank: number
): Difference {
  return {
    id,
    ayahKey: 2004,
    category: category as Difference['category'],
    title: `اختلاف ${id}`,
    locus: { startPosition: startPos, endPosition: endPos },
    occurrenceIndex: 1,
    context: 'ALWAYS',
    scope: { kind: 'ALL' },
    source: 'editor',
    rank,
    version: 1,
    status: 'DRAFT',
    variants: [],
    relations: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ==================== الاختبارات ====================

describe('Multi-Difference (FR-ED-03, DM-09)', () => {
  describe('Group Key', () => {
    it('يبني مفتاح تجميع فريد', () => {
      const key1 = buildGroupKey(3, 3, { kind: 'ALL' });
      const key2 = buildGroupKey(3, 3, { kind: 'ALL' });
      expect(key1).toBe(key2);
    });

    it('يميز المواضع المختلفة', () => {
      const key1 = buildGroupKey(3, 3, { kind: 'ALL' });
      const key2 = buildGroupKey(4, 4, { kind: 'ALL' });
      expect(key1).not.toBe(key2);
    });

    it('يميز النطاقات المختلفة', () => {
      const key1 = buildGroupKey(3, 3, { kind: 'ALL' });
      const key2 = buildGroupKey(3, 3, { kind: 'NARRATORS', narratorIds: ['n-hafs'] });
      expect(key1).not.toBe(key2);
    });

    it('يتجاهل ترتيب المعرفات في النطاق', () => {
      const key1 = buildGroupKey(3, 3, {
        kind: 'NARRATORS',
        narratorIds: ['n-hafs', 'n-shuba'],
      });
      const key2 = buildGroupKey(3, 3, {
        kind: 'NARRATORS',
        narratorIds: ['n-shuba', 'n-hafs'],
      });
      expect(key1).toBe(key2);
    });
  });

  describe('Grouping', () => {
    it('يجمع الاختلافات في نفس الموضع', () => {
      const diffs = [
        makeDifference('d1', 3, 3, 'MADUD', 1),
        makeDifference('d2', 3, 3, 'MADUD', 2),
        makeDifference('d3', 5, 5, 'FARSH', 1),
      ];
      const groups = groupDifferencesByLocus(diffs);
      expect(groups.length).toBe(2);
      const group3 = groups.find((g) => g.startPosition === 3);
      expect(group3?.count).toBe(2);
    });

    it('يفصل الاختلافات في مواضع مختلفة', () => {
      const diffs = [
        makeDifference('d1', 3, 3, 'MADUD', 1),
        makeDifference('d2', 5, 5, 'MADUD', 1),
      ];
      const groups = groupDifferencesByLocus(diffs);
      expect(groups.length).toBe(2);
    });

    it('يتعامل مع قائمة فارغة', () => {
      expect(groupDifferencesByLocus([]).length).toBe(0);
    });
  });

  describe('Occurrence Index', () => {
    it('يحسب الفهرس لكل اختلاف', () => {
      const diffs = [
        makeDifference('d1', 3, 3, 'MADUD', 2),
        makeDifference('d2', 3, 3, 'MADUD', 1),
        makeDifference('d3', 3, 3, 'FARSH', 3),
      ];
      const indices = computeOccurrenceIndices(diffs);
      // d2 (rank 1) → index 1, d1 (rank 2) → index 2, d3 (rank 3) → index 3
      expect(indices.get('d2')).toBe(1);
      expect(indices.get('d1')).toBe(2);
      expect(indices.get('d3')).toBe(3);
    });

    it('يرتب بالمعرف عند تساوي الرتب', () => {
      const diffs = [
        makeDifference('b', 3, 3, 'MADUD', 1),
        makeDifference('a', 3, 3, 'MADUD', 1),
      ];
      const indices = computeOccurrenceIndices(diffs);
      expect(indices.get('a')).toBe(1);
      expect(indices.get('b')).toBe(2);
    });

    it('يعيد 1 لاختلاف وحيد', () => {
      const diffs = [makeDifference('d1', 3, 3, 'MADUD', 1)];
      const indices = computeOccurrenceIndices(diffs);
      expect(indices.get('d1')).toBe(1);
    });
  });

  describe('Occurrence Label', () => {
    it('يعرض label فارغ لاختلاف وحيد', () => {
      expect(formatOccurrenceLabel(1, 1)).toBe('');
    });

    it('يعرض label بالأرقام العربية', () => {
      const label = formatOccurrenceLabel(1, 3);
      expect(label).toContain('١');
      expect(label).toContain('٣');
    });

    it('يعرض label صحيح للفهرس الثاني', () => {
      const label = formatOccurrenceLabel(2, 4);
      expect(label).toContain('٢');
      expect(label).toContain('٤');
    });
  });

  describe('Implicit Replacement Detection', () => {
    it('لا يحذّر عند إضافة اختلاف في موضع جديد', () => {
      const newDiff = makeDifference('new', 3, 3, 'MADUD', 1);
      const existing = [makeDifference('d1', 5, 5, 'FARSH', 1)];
      const result = detectImplicitReplacement(newDiff, existing);
      expect(result.warning).toBe(false);
    });

    it('يحذّر عند إضافة اختلاف بنفس الفئة في نفس الموضع', () => {
      const newDiff = makeDifference('new', 3, 3, 'MADUD', 2);
      const existing = [makeDifference('d1', 3, 3, 'MADUD', 1)];
      const result = detectImplicitReplacement(newDiff, existing);
      expect(result.warning).toBe(true);
      expect(result.conflictingId).toBe('d1');
    });

    it('لا يحذّر عند إضافة اختلاف بفئة مختلفة في نفس الموضع', () => {
      const newDiff = makeDifference('new', 3, 3, 'FARSH', 2);
      const existing = [makeDifference('d1', 3, 3, 'MADUD', 1)];
      const result = detectImplicitReplacement(newDiff, existing);
      expect(result.warning).toBe(false);
    });
  });

  describe('Variant Occurrence Indices (Legacy)', () => {
    it('يحسب الفهرس للنموذج القديم', () => {
      const variants = [
        {
          id: 'v1',
          ayahKey: 2004,
          category: 'MADUD' as const,
          title: 'مد',
          startPosition: 3,
          endPosition: 3,
          targetKind: 'WORDS' as const,
          status: 'DRAFT' as const,
          origin: 'EDITOR' as const,
          alternatives: [],
          orderRank: 2,
        },
        {
          id: 'v2',
          ayahKey: 2004,
          category: 'MADUD' as const,
          title: 'مد آخر',
          startPosition: 3,
          endPosition: 3,
          targetKind: 'WORDS' as const,
          status: 'DRAFT' as const,
          origin: 'EDITOR' as const,
          alternatives: [],
          orderRank: 1,
        },
      ];
      const indices = computeVariantOccurrenceIndices(variants);
      expect(indices.get('v2')).toBe(1); // orderRank 1 → index 1
      expect(indices.get('v1')).toBe(2); // orderRank 2 → index 2
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  shouldDisplayInMode,
  filterVariantsByMode,
  countWaqfOnlyVariants,
  countWaslOnlyVariants,
  hasForbiddenConnection,
  canConnectAyahs,
  getForbiddenConnections,
  createIsolatedRenderRange,
  findWaqfAtPosition,
  findIbtidaAtPosition,
  calculateIsolatedSegments,
  isPositionInRenderRange,
  filterVariantsByRenderRange,
  boundaryToWaqfMark,
  boundariesToWaqfMarks,
  calculateDisplayModeState,
  describeDisplayMode,
} from '@/lib/tashjeer/waqf-wasl';
import type { Variant, RecitationBoundary } from '@/types/tashjeer';
import type { RenderRange } from '@/lib/tashjeer/model/v8';

// Helper to create test variants
function makeVariant(
  id: string,
  recitationMode: 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY' = 'ALWAYS',
  startPos = 1,
  endPos = 1
): Variant {
  return {
    id,
    ayahKey: 1001,
    category: 'USUL',
    title: `Variant ${id}`,
    startPosition: startPos,
    endPosition: endPos,
    targetKind: 'WORDS',
    status: 'DRAFT',
    origin: 'EDITOR',
    alternatives: [],
    recitationMode,
  };
}

// Helper to create test boundaries
function makeBoundary(
  id: string,
  kind: 'WAQF' | 'IBTIDA' | 'WASL' | 'NO_WASL',
  position: number,
  connectsToNextAyah = false
): RecitationBoundary {
  return {
    id,
    kind,
    position,
    connectsToNextAyah,
  };
}

describe('PH7 - Waqf, Wasl, and Forbidden Connection', () => {
  describe('shouldDisplayInMode', () => {
    it('ALWAYS variants display in both modes', () => {
      const v = makeVariant('v1', 'ALWAYS');
      expect(shouldDisplayInMode(v, 'WAQF')).toBe(true);
      expect(shouldDisplayInMode(v, 'WASL')).toBe(true);
    });

    it('WAQF_ONLY variants display only in WAQF mode', () => {
      const v = makeVariant('v1', 'WAQF_ONLY');
      expect(shouldDisplayInMode(v, 'WAQF')).toBe(true);
      expect(shouldDisplayInMode(v, 'WASL')).toBe(false);
    });

    it('WASL_ONLY variants display only in WASL mode', () => {
      const v = makeVariant('v1', 'WASL_ONLY');
      expect(shouldDisplayInMode(v, 'WAQF')).toBe(false);
      expect(shouldDisplayInMode(v, 'WASL')).toBe(true);
    });

    it('variants without recitationMode default to ALWAYS', () => {
      const v = makeVariant('v1');
      delete (v as any).recitationMode;
      expect(shouldDisplayInMode(v, 'WAQF')).toBe(true);
      expect(shouldDisplayInMode(v, 'WASL')).toBe(true);
    });
  });

  describe('filterVariantsByMode', () => {
    it('filters WAQF_ONLY in WASL mode', () => {
      const variants = [
        makeVariant('v1', 'ALWAYS'),
        makeVariant('v2', 'WAQF_ONLY'),
        makeVariant('v3', 'WASL_ONLY'),
      ];
      const filtered = filterVariantsByMode(variants, 'WASL');
      expect(filtered).toHaveLength(2);
      expect(filtered.map((v) => v.id)).toEqual(['v1', 'v3']);
    });

    it('filters WASL_ONLY in WAQF mode', () => {
      const variants = [
        makeVariant('v1', 'ALWAYS'),
        makeVariant('v2', 'WAQF_ONLY'),
        makeVariant('v3', 'WASL_ONLY'),
      ];
      const filtered = filterVariantsByMode(variants, 'WAQF');
      expect(filtered).toHaveLength(2);
      expect(filtered.map((v) => v.id)).toEqual(['v1', 'v2']);
    });
  });

  describe('countWaqfOnlyVariants / countWaslOnlyVariants', () => {
    it('counts WAQF_ONLY variants', () => {
      const variants = [
        makeVariant('v1', 'ALWAYS'),
        makeVariant('v2', 'WAQF_ONLY'),
        makeVariant('v3', 'WAQF_ONLY'),
      ];
      expect(countWaqfOnlyVariants(variants)).toBe(2);
    });

    it('counts WASL_ONLY variants', () => {
      const variants = [
        makeVariant('v1', 'ALWAYS'),
        makeVariant('v2', 'WASL_ONLY'),
      ];
      expect(countWaslOnlyVariants(variants)).toBe(1);
    });
  });

  describe('Forbidden Connection', () => {
    it('detects forbidden connection at ayah end', () => {
      const boundaries = [
        makeBoundary('b1', 'WAQF', 5),
        makeBoundary('b2', 'NO_WASL', 10, true),
      ];
      expect(hasForbiddenConnection(1001, boundaries)).toBe(true);
    });

    it('returns false when no forbidden connection', () => {
      const boundaries = [makeBoundary('b1', 'WAQF', 5)];
      expect(hasForbiddenConnection(1001, boundaries)).toBe(false);
    });

    it('canConnectAyahs returns blocked when forbidden', () => {
      const boundaries = [makeBoundary('b1', 'NO_WASL', 10, true)];
      const result = canConnectAyahs(1001, boundaries);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('ممنوع وصل');
    });

    it('canConnectAyahs returns allowed when no forbidden', () => {
      const boundaries = [makeBoundary('b1', 'WAQF', 5)];
      const result = canConnectAyahs(1001, boundaries);
      expect(result.allowed).toBe(true);
    });

    it('getForbiddenConnections returns only NO_WASL boundaries', () => {
      const boundaries = [
        makeBoundary('b1', 'WAQF', 5),
        makeBoundary('b2', 'NO_WASL', 10, true),
        makeBoundary('b3', 'IBTIDA', 11),
      ];
      const forbidden = getForbiddenConnections(boundaries);
      expect(forbidden).toHaveLength(1);
      expect(forbidden[0].kind).toBe('NO_WASL');
    });
  });

  describe('Isolated Segments', () => {
    it('creates isolated render range', () => {
      const range = createIsolatedRenderRange(1001, 3, 7, 'Test Range');
      expect(range.ayahKey).toBe(1001);
      expect(range.fromPosition).toBe(3);
      expect(range.toPosition).toBe(7);
      expect(range.label).toBe('Test Range');
    });

    it('findWaqfAtPosition', () => {
      const boundaries = [
        makeBoundary('b1', 'WAQF', 5),
        makeBoundary('b2', 'IBTIDA', 6),
      ];
      const waqf = findWaqfAtPosition(boundaries, 5);
      expect(waqf?.id).toBe('b1');
      expect(findWaqfAtPosition(boundaries, 6)).toBeUndefined();
    });

    it('findIbtidaAtPosition', () => {
      const boundaries = [
        makeBoundary('b1', 'WAQF', 5),
        makeBoundary('b2', 'IBTIDA', 6),
      ];
      const ibtida = findIbtidaAtPosition(boundaries, 6);
      expect(ibtida?.id).toBe('b2');
    });

    it('calculates isolated segments with no boundaries', () => {
      const segments = calculateIsolatedSegments([], 10);
      expect(segments).toHaveLength(1);
      expect(segments[0].start).toBe(1);
      expect(segments[0].end).toBe(10);
    });

    it('calculates isolated segments with waqf', () => {
      const boundaries = [
        makeBoundary('b1', 'WAQF', 5),
        makeBoundary('b2', 'WAQF', 10),
      ];
      const segments = calculateIsolatedSegments(boundaries, 10);
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({ start: 1, end: 5, label: 'من 1 إلى 5' });
      expect(segments[1]).toEqual({ start: 6, end: 10, label: 'من 6 إلى 10' });
    });

    it('calculates segments with waqf and ibtida', () => {
      const boundaries = [
        makeBoundary('b1', 'WAQF', 3),
        makeBoundary('b2', 'IBTIDA', 5),
        makeBoundary('b3', 'WAQF', 8),
      ];
      const segments = calculateIsolatedSegments(boundaries, 10);
      expect(segments.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Render Range Filtering', () => {
    it('isPositionInRenderRange with null range returns true', () => {
      expect(isPositionInRenderRange(5, null)).toBe(true);
    });

    it('isPositionInRenderRange checks bounds', () => {
      const range: RenderRange = {
        id: 'r1',
        ayahKey: 1001,
        fromPosition: 3,
        toPosition: 7,
      };
      expect(isPositionInRenderRange(5, range)).toBe(true);
      expect(isPositionInRenderRange(1, range)).toBe(false);
      expect(isPositionInRenderRange(10, range)).toBe(false);
      expect(isPositionInRenderRange(3, range)).toBe(true);
      expect(isPositionInRenderRange(7, range)).toBe(true);
    });

    it('filterVariantsByRenderRange with null returns all', () => {
      const variants = [makeVariant('v1', 'ALWAYS', 1, 5)];
      expect(filterVariantsByRenderRange(variants, null)).toHaveLength(1);
    });

    it('filterVariantsByRenderRange filters correctly', () => {
      const variants = [
        makeVariant('v1', 'ALWAYS', 1, 3),
        makeVariant('v2', 'ALWAYS', 5, 7),
        makeVariant('v3', 'ALWAYS', 10, 12),
      ];
      const range: RenderRange = {
        id: 'r1',
        ayahKey: 1001,
        fromPosition: 4,
        toPosition: 8,
      };
      const filtered = filterVariantsByRenderRange(variants, range);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('v2');
    });

    it('includes partially overlapping variants', () => {
      const variants = [
        makeVariant('v1', 'ALWAYS', 1, 5), // overlaps at 4-5
        makeVariant('v2', 'ALWAYS', 7, 12), // overlaps at 7-8
      ];
      const range: RenderRange = {
        id: 'r1',
        ayahKey: 1001,
        fromPosition: 4,
        toPosition: 8,
      };
      const filtered = filterVariantsByRenderRange(variants, range);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Boundary to WaqfMark Conversion', () => {
    it('converts WAQF boundary', () => {
      const boundary = makeBoundary('b1', 'WAQF', 5);
      const mark = boundaryToWaqfMark(boundary, 1001);
      expect(mark.kind).toBe('WAQF');
      expect(mark.scope).toBe('INTERNAL');
      expect(mark.position).toBe(5);
    });

    it('converts NO_WASL boundary to FORBIDDEN_WASL', () => {
      const boundary = makeBoundary('b1', 'NO_WASL', 10, true);
      const mark = boundaryToWaqfMark(boundary, 1001);
      expect(mark.kind).toBe('FORBIDDEN_WASL');
      expect(mark.scope).toBe('END_OF_AYAH');
      expect(mark.connectsToNextAyah).toBe(true);
    });

    it('converts IBTIDA boundary', () => {
      const boundary = makeBoundary('b1', 'IBTIDA', 6);
      const mark = boundaryToWaqfMark(boundary, 1001);
      expect(mark.kind).toBe('IBTIDA');
    });

    it('converts multiple boundaries', () => {
      const boundaries = [
        makeBoundary('b1', 'WAQF', 5),
        makeBoundary('b2', 'IBTIDA', 6),
        makeBoundary('b3', 'NO_WASL', 10, true),
      ];
      const marks = boundariesToWaqfMarks(boundaries, 1001);
      expect(marks).toHaveLength(3);
    });
  });

  describe('Display Mode State', () => {
    it('calculates display mode state correctly', () => {
      const variants = [
        makeVariant('v1', 'ALWAYS', 1, 3),
        makeVariant('v2', 'WAQF_ONLY', 5, 5),
        makeVariant('v3', 'WASL_ONLY', 7, 7),
      ];

      const state = calculateDisplayModeState(variants, 'WAQF', false, null);
      expect(state.mode).toBe('WAQF');
      expect(state.visibleCount).toBe(2); // ALWAYS + WAQF_ONLY
      expect(state.hiddenCount).toBe(1); // WASL_ONLY
    });

    it('applies render range filter', () => {
      const variants = [
        makeVariant('v1', 'ALWAYS', 1, 3),
        makeVariant('v2', 'ALWAYS', 5, 7),
        makeVariant('v3', 'ALWAYS', 10, 12),
      ];
      const range: RenderRange = {
        id: 'r1',
        ayahKey: 1001,
        fromPosition: 4,
        toPosition: 8,
      };

      const state = calculateDisplayModeState(variants, 'WAQF', false, range);
      expect(state.visibleCount).toBe(1); // only v2
      expect(state.hiddenCount).toBe(2);
    });

    it('describeDisplayMode includes mode', () => {
      const state = calculateDisplayModeState([], 'WAQF', false, null);
      expect(describeDisplayMode(state)).toContain('وقفا');
    });

    it('describeDisplayMode includes link status', () => {
      const state = calculateDisplayModeState([], 'WASL', true, null);
      expect(describeDisplayMode(state)).toContain('وصلا');
      expect(describeDisplayMode(state)).toContain('موصولة');
    });

    it('describeDisplayMode includes hidden count', () => {
      const variants = [
        makeVariant('v1', 'WAQF_ONLY'),
        makeVariant('v2', 'ALWAYS'),
      ];
      const state = calculateDisplayModeState(variants, 'WASL', false, null);
      expect(describeDisplayMode(state)).toContain('1');
      expect(describeDisplayMode(state)).toContain('مخفية');
    });
  });
});

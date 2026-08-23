// اختبارات أدوات PH3 - Drag & Drop, Clipboard, Bulk Operations
// FR-ED-04..07

import { describe, it, expect } from 'vitest';
import {
  copyDifference,
  copyFace,
  copySegment,
  copyMultipleDifferences,
  prepareDifferenceForPaste,
  prepareFaceForPaste,
  prepareSegmentForPaste,
  prepareMultipleDifferencesForPaste,
  summarizePaste,
} from '@/lib/tashjeer/clipboard-service';
import {
  calculateDropPosition,
  calculateReorder,
  canMergeLines,
  buildMergeConfirmation,
  findMergeLinkId,
} from '@/lib/tashjeer/drag-drop';
import {
  calculateBulkDeleteConfirmation,
  applyBulkDeleteDifferences,
  applyBulkDeleteFaces,
  pruneOrphanedLinks,
  buildConfirmationMessage,
  validateBulkDelete,
} from '@/lib/tashjeer/bulk-operations';
import type { Variant, VariantAlternative, LineSegment } from '@/types/tashjeer';

// ==================== أدوات مساعدة ====================

function makeVariant(id: string, title: string): Variant {
  return {
    id,
    ayahKey: 2004,
    category: 'FARSH',
    title,
    startPosition: 3,
    endPosition: 3,
    targetKind: 'WORDS',
    status: 'DRAFT',
    origin: 'EDITOR',
    alternatives: [
      { id: `${id}-base`, text: title, label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' } },
      { id: `${id}-face-1`, text: `${title} وجه 1`, label: 'وجه 1', isBase: false, scope: { kind: 'ALL' } },
    ],
  };
}

function makeSegment(id: string): LineSegment {
  return {
    id,
    ayahKey: 2004,
    title: 'جزء',
    startPosition: 1,
    endPosition: 3,
    origin: 'EDITOR',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ==================== Clipboard Service ====================

describe('Clipboard Service (FR-ED-06)', () => {
  describe('Copy Difference', () => {
    it('ينسخ اختلافا بمعرفات جديدة', () => {
      const variant = makeVariant('v-1', 'مد');
      const item = copyDifference(variant);
      expect(item.kind).toBe('DIFFERENCE');
      expect(item.data.id).not.toBe('v-1');
      expect(item.data.id).toMatch(/^v-copy-/);
      expect(item.data.title).toContain('نسخة');
      expect(item.copiedFrom).toBe('v-1');
    });

    it('يولّد معرفات جديدة للأوجه', () => {
      const variant = makeVariant('v-1', 'مد');
      const item = copyDifference(variant);
      const pasted = prepareDifferenceForPaste(item);
      expect(pasted.alternatives[0].id).not.toBe('v-1-base');
      expect(pasted.alternatives[1].id).not.toBe('v-1-face-1');
    });

    it('يمسح engineSnapshot', () => {
      const variant = makeVariant('v-1', 'مد');
      const item = copyDifference(variant);
      expect(item.data.engineSnapshot).toBeUndefined();
    });
  });

  describe('Copy Face', () => {
    it('ينسخ وجها مع معرّف الاختلاف الأب', () => {
      const alt: VariantAlternative = {
        id: 'face-1',
        text: 'بالألف',
        label: 'بالألف',
        isBase: false,
        scope: { kind: 'ALL' },
      };
      const item = copyFace(alt, 'v-1');
      expect(item.kind).toBe('FACE');
      expect(item.parentDifferenceId).toBe('v-1');
      expect(item.copiedFrom).toBe('face-1');
    });

    it('يلصق الوجه بمعرف جديد', () => {
      const alt: VariantAlternative = {
        id: 'face-1',
        text: 'بالألف',
        label: 'بالألف',
        isBase: false,
        scope: { kind: 'ALL' },
      };
      const item = copyFace(alt, 'v-1');
      const pasted = prepareFaceForPaste(item);
      expect(pasted.id).not.toBe('face-1');
      expect(pasted.isBase).toBe(false);
    });
  });

  describe('Copy Segment', () => {
    it('ينسخ جزء سطر', () => {
      const segment = makeSegment('seg-1');
      const item = copySegment(segment);
      expect(item.kind).toBe('SEGMENT');
      const pasted = prepareSegmentForPaste(item);
      expect(pasted.id).not.toBe('seg-1');
      expect(pasted.origin).toBe('EDITOR');
    });
  });

  describe('Copy Multiple', () => {
    it('ينسخ عدة اختلافات', () => {
      const variants = [makeVariant('v-1', 'مد'), makeVariant('v-2', 'فرش')];
      const item = copyMultipleDifferences(variants);
      expect(item.kind).toBe('MULTI_DIFFERENCE');
      const pasted = prepareMultipleDifferencesForPaste(item);
      expect(pasted.length).toBe(2);
      expect(pasted[0].id).not.toBe('v-1');
      expect(pasted[1].id).not.toBe('v-2');
    });
  });

  describe('Summarize', () => {
    it('يلخّص اختلاف واحد', () => {
      const item = copyDifference(makeVariant('v-1', 'مد'));
      const summary = summarizePaste(item);
      expect(summary.kind).toBe('اختلاف');
      expect(summary.count).toBe(1);
    });

    it('يلخّص عدة اختلافات', () => {
      const item = copyMultipleDifferences([makeVariant('v-1', 'مد'), makeVariant('v-2', 'فرش')]);
      const summary = summarizePaste(item);
      expect(summary.kind).toBe('اختلافات');
      expect(summary.count).toBe(2);
    });
  });
});

// ==================== Drag & Drop ====================

describe('Drag & Drop (FR-ED-04/05)', () => {
  describe('Drop Position', () => {
    const rect = { top: 100, height: 60, bottom: 160, left: 0, right: 200, width: 200, x: 0, y: 100 } as DOMRect;

    it('يحسب BEFORE في الثلث العلوي', () => {
      expect(calculateDropPosition(110, rect, true)).toBe('BEFORE');
    });

    it('يحسب AFTER في الثلث السفلي', () => {
      expect(calculateDropPosition(150, rect, true)).toBe('AFTER');
    });

    it('يحسب ON_TOP في الوسط عند السماح بالدمج', () => {
      expect(calculateDropPosition(130, rect, true)).toBe('ON_TOP');
    });

    it('لا يحسب ON_TOP عند عدم السماح بالدمج', () => {
      const result = calculateDropPosition(130, rect, false);
      expect(result).not.toBe('ON_TOP');
    });
  });

  describe('Reorder', () => {
    it('ينقل سطرا إلى موضع جديد', () => {
      const order = ['A', 'B', 'C', 'D', 'E'];
      const result = calculateReorder(order, 'A', 'D', 'AFTER');
      expect(result.newOrder).toEqual(['B', 'C', 'D', 'A', 'E']);
      expect(result.affectedCount).toBeGreaterThan(0);
    });

    it('ينقل سطرا إلى قبل هدف', () => {
      const order = ['A', 'B', 'C', 'D', 'E'];
      const result = calculateReorder(order, 'E', 'B', 'BEFORE');
      expect(result.newOrder).toEqual(['A', 'E', 'B', 'C', 'D']);
    });

    it('يرجع الترتيب نفسه عند نقل سطر إلى موضعه', () => {
      const order = ['A', 'B', 'C'];
      const result = calculateReorder(order, 'B', 'B', 'BEFORE');
      // B قبل B = لا تغيير فعليا
      expect(result.newOrder.length).toBe(3);
    });
  });

  describe('Merge Check', () => {
    it('يرفض دمج سطر مع نفسه', () => {
      const result = canMergeLines('line-1', 'line-1');
      expect(result.allowed).toBe(false);
    });

    it('يسمح بدمج سطرين مختلفين', () => {
      const result = canMergeLines('line-1', 'line-2');
      expect(result.allowed).toBe(true);
    });

    it('يرفض الدمج عند المنع بسياسة', () => {
      const result = canMergeLines('line-1', 'line-2', {
        allowMerge: false,
        reason: 'الفرش لا يُدمج مع المد',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('الفرش');
    });
  });

  describe('Merge Confirmation', () => {
    it('يبني رسالة تأكيد الدمج', () => {
      const conf = buildMergeConfirmation('src', 'tgt', 'سطر 1', 'سطر 2', 3, 5);
      expect(conf.description).toContain('سطر 1');
      expect(conf.description).toContain('سطر 2');
      expect(conf.summary.mergedDifferences).toBe(3);
    });
  });

  describe('Find Merge Link', () => {
    it('يجد رابط الدمج بين سطرين', () => {
      const links = [
        { id: 'link-1', from: { id: 'A', type: 'LINE' as const }, to: { id: 'B', type: 'LINE' as const }, relation: 'MERGE', kind: 'LINE_TO_LINE' as const, createdAt: '', updatedAt: '' },
      ];
      expect(findMergeLinkId(links, 'A', 'B')).toBe('link-1');
      expect(findMergeLinkId(links, 'B', 'A')).toBe('link-1');
    });

    it('يرجع null عند عدم وجود رابط', () => {
      expect(findMergeLinkId([], 'A', 'B')).toBeNull();
    });
  });
});

// ==================== Bulk Operations ====================

describe('Bulk Operations (FR-ED-07)', () => {
  describe('Confirmation', () => {
    it('يحسب ملخص الحذف', () => {
      const targets = [
        { kind: 'DIFFERENCE' as const, id: 'v-1', label: 'مد' },
        { kind: 'DIFFERENCE' as const, id: 'v-2', label: 'فرش' },
        { kind: 'FACE' as const, id: 'face-1', label: 'وجه' },
      ];
      const conf = calculateBulkDeleteConfirmation(targets, [], []);
      expect(conf.totalCount).toBe(3);
      expect(conf.summary.DIFFERENCE).toBe(2);
      expect(conf.summary.FACE).toBe(1);
      expect(conf.warning).toBeNull();
    });

    it('يكشف العلاقات اليتيمة', () => {
      const targets = [{ kind: 'DIFFERENCE' as const, id: 'v-1', label: 'مد' }];
      const links = [
        {
          id: 'link-1',
          ayahKey: 2004,
          kind: 'FACE_TO_FACE' as const,
          relation: 'MERGE' as const,
          from: { type: 'FACE' as const, id: 'v-1' },
          to: { type: 'FACE' as const, id: 'v-2' },
          origin: 'EDITOR' as const,
          createdAt: '',
          updatedAt: '',
        },
      ];
      const conf = calculateBulkDeleteConfirmation(targets, links, []);
      expect(conf.orphanedRelations.length).toBe(1);
      expect(conf.warning).toContain('علاقة');
    });
  });

  describe('Apply Delete', () => {
    it('يحذف اختلافات محددة', () => {
      const variants = [makeVariant('v-1', 'مد'), makeVariant('v-2', 'فرش'), makeVariant('v-3', 'أصول')];
      const result = applyBulkDeleteDifferences(variants, ['v-1', 'v-3']);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('v-2');
    });

    it('يحذف أوجه محددة من اختلافاتها', () => {
      const variants = [makeVariant('v-1', 'مد')];
      const result = applyBulkDeleteFaces(variants, [
        { variantId: 'v-1', alternativeId: 'v-1-face-1' },
      ]);
      expect(result[0].alternatives.length).toBe(1); // بقي وجه المصحف فقط
      expect(result[0].alternatives[0].isBase).toBe(true);
    });
  });

  describe('Prune Links', () => {
    it('يزيل الروابط اليتيمة', () => {
      const links = [
        {
          id: 'link-1',
          ayahKey: 2004,
          kind: 'LINE_TO_LINE' as const,
          relation: 'MERGE' as const,
          from: { type: 'LINE' as const, id: 'line-1' },
          to: { type: 'LINE' as const, id: 'line-2' },
          origin: 'EDITOR' as const,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'link-2',
          ayahKey: 2004,
          kind: 'LINE_TO_LINE' as const,
          relation: 'REFERENCE' as const,
          from: { type: 'LINE' as const, id: 'line-3' },
          to: { type: 'LINE' as const, id: 'line-4' },
          origin: 'EDITOR' as const,
          createdAt: '',
          updatedAt: '',
        },
      ];
      const result = pruneOrphanedLinks(links, ['line-1']);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('link-2');
    });
  });

  describe('Confirmation Message', () => {
    it('يبني رسالة تأكيد', () => {
      const conf = calculateBulkDeleteConfirmation(
        [
          { kind: 'DIFFERENCE', id: 'v-1', label: 'مد' },
          { kind: 'FACE', id: 'f-1', label: 'وجه' },
        ],
        [],
        []
      );
      const msg = buildConfirmationMessage(conf);
      expect(msg).toContain('اختلاف');
      expect(msg).toContain('وجه');
    });

    it('يتضمن تحذيرا عند وجود علاقات يتيمة', () => {
      const conf: ReturnType<typeof calculateBulkDeleteConfirmation> = {
        totalCount: 1,
        summary: { DIFFERENCE: 1, FACE: 0, SEGMENT: 0, LINE: 0 },
        orphanedRelations: [{ linkId: 'l-1', description: 'علاقة يتيمة' }],
        warning: '1 علاقة ستفقد مرجعها',
      };
      const msg = buildConfirmationMessage(conf);
      expect(msg).toContain('تحذير');
    });
  });

  describe('Validation', () => {
    it('يرفض حذف عناصر محمية', () => {
      const targets = [
        { kind: 'DIFFERENCE' as const, id: 'v-1', label: 'مد' },
        { kind: 'DIFFERENCE' as const, id: 'v-2', label: 'محمي' },
      ];
      const protectedIds = new Set(['v-2']);
      const result = validateBulkDelete(targets, protectedIds);
      expect(result.valid).toBe(false);
      expect(result.blockedIds).toEqual(['v-2']);
    });

    it('يسمح بحذف غير المحمية', () => {
      const targets = [{ kind: 'DIFFERENCE' as const, id: 'v-1', label: 'مد' }];
      const result = validateBulkDelete(targets, new Set());
      expect(result.valid).toBe(true);
    });
  });
});

// هندسة السحب: موضع الإدراج، التمرير التلقائي، تحويل المعاينة، وصف الحوار
import { describe, expect, it } from 'vitest';
import {
  autoScrollDelta,
  describeLineOrderMove,
  insertionGapAt,
  isNoOpInsertion,
  previewTransform,
  type RowBox,
  type ViewportBox,
} from '@/lib/editor/line-drag-geometry';
import { resolveLineDragConfig, DEFAULT_LINE_DRAG_CONFIG } from '@/lib/editor/drag-config';
import { planLineInsertion } from '@/lib/tashjeer/line-operations';

const rows = (count: number, height = 40): RowBox[] =>
  Array.from({ length: count }, (_, index) => ({ id: `l${index + 1}`, top: index * height, bottom: (index + 1) * height }));

const viewport = (overrides: Partial<ViewportBox> = {}): ViewportBox => ({
  top: 100, bottom: 400, scrollTop: 0, scrollHeight: 1000, clientHeight: 300, ...overrides,
});

describe('insertionGapAt', () => {
  it('بداية القائمة ونهايتها وبين الصفوف', () => {
    expect(insertionGapAt(-5, rows(5))).toEqual({ gap: 0, targetId: 'l1' });
    expect(insertionGapAt(10, rows(5))).toEqual({ gap: 0, targetId: 'l1' }); // أعلى نصف الصف ١
    expect(insertionGapAt(30, rows(5))).toEqual({ gap: 1, targetId: 'l1' }); // أسفل نصف الصف ١
    expect(insertionGapAt(70, rows(5))).toEqual({ gap: 2, targetId: 'l2' });
    expect(insertionGapAt(205, rows(5))).toEqual({ gap: 5, targetId: 'l5' });
  });

  it('خارج القائمة لا ينتج موضعًا ولا هدفًا', () => {
    expect(insertionGapAt(-100, rows(5)).gap).toBeNull();
    expect(insertionGapAt(999, rows(5)).gap).toBeNull();
    expect(insertionGapAt(50, [])).toEqual({ gap: null, targetId: null });
  });
});

describe('isNoOpInsertion', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('الموضع الحالي والمجاور له لا يُغيران الترتيب', () => {
    expect(isNoOpInsertion(ids, 'b', null)).toBe(true);
    expect(isNoOpInsertion(ids, 'b', 1)).toBe(true); // قبل b مباشرة
    expect(isNoOpInsertion(ids, 'b', 2)).toBe(true); // بعد b مباشرة
    expect(planLineInsertion(ids, 'b', 1)).toBeNull();
    expect(planLineInsertion(ids, 'b', 2)).toBeNull();
  });
  it('المواضع البعيدة تُنتج خطة حقيقية', () => {
    expect(isNoOpInsertion(ids, 'b', 0)).toBe(false);
    expect(isNoOpInsertion(ids, 'b', 4)).toBe(false);
  });
});

describe('autoScrollDelta', () => {
  it('صفر في المنتصف، سالب أعلى، موجب أسفل، وبلا تجاوز للحدود', () => {
    expect(autoScrollDelta(250, viewport(), 72, 22)).toBe(0);
    expect(autoScrollDelta(110, viewport({ scrollTop: 100 }), 72, 22)).toBeLessThan(0);
    expect(autoScrollDelta(390, viewport(), 72, 22)).toBeGreaterThan(0);
    expect(autoScrollDelta(110, viewport({ scrollTop: 0 }), 72, 22)).toBe(0); // أعلى القائمة بالفعل
    expect(autoScrollDelta(390, viewport({ scrollTop: 700 }), 72, 22)).toBe(0);
  });
  it('السرعة تتدرج مع القرب من الحافة', () => {
    const far = autoScrollDelta(140, viewport({ scrollTop: 100 }), 72, 22);
    const near = autoScrollDelta(101, viewport({ scrollTop: 100 }), 72, 22);
    expect(Math.abs(near)).toBeGreaterThan(Math.abs(far));
    expect(Math.abs(near)).toBeLessThanOrEqual(22);
  });
});

describe('previewTransform', () => {
  it('يتبع المؤشر مع إزاحة المقبض ويستعمل translate3d', () => {
    expect(previewTransform({ x: 320, y: 180 }, { x: 12, y: 9 })).toBe('translate3d(308px, 171px, 0)');
    expect(previewTransform({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe('translate3d(0px, 0px, 0)');
  });
});

describe('describeLineOrderMove', () => {
  it('يبين الرتبتين والجارين وعدد المتأثرين بلا معرفات جديدة', () => {
    const before = ['a', 'b', 'c', 'd'];
    const result = describeLineOrderMove(before, ['a', 'c', 'd', 'b'], 'b');
    expect(result).toEqual({ fromRank: 2, rank: 4, previousId: 'd', nextId: undefined, affected: 3 });
    expect(before).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('resolveLineDragConfig', () => {
  it('الفأرة بلا انتظار 350ms، واللمس بضغطة قصيرة، والقيم محمية', () => {
    expect(DEFAULT_LINE_DRAG_CONFIG.thresholdPx).toBe(7);
    expect(DEFAULT_LINE_DRAG_CONFIG.touchLongPressMs).toBeLessThan(350);
    const config = resolveLineDragConfig({ thresholdPx: -2, autoScrollMaxSpeed: 999 });
    expect(config.thresholdPx).toBe(2);
    expect(config.autoScrollMaxSpeed).toBe(60);
    expect(config.autoScrollEdgePx).toBe(DEFAULT_LINE_DRAG_CONFIG.autoScrollEdgePx);
  });
});

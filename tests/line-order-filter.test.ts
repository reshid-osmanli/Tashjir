// حماية ترتيب الأسطر المخفية: الفئات الافتراضية سبع لا ست
import { describe, expect, it } from 'vitest';
import { lineOrderIsFiltered } from '@/lib/editor/line-order-filter';
import { ORDERED_VARIANT_CATEGORIES } from '@/lib/tashjeer/type-ranks';
import type { ViewFilter } from '@/types/tashjeer';

const all: ViewFilter = {
  categories: [...ORDERED_VARIANT_CATEGORIES],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

describe('lineOrderIsFiltered', () => {
  it('كل الفئات السبع بلا تصفية رواة ولا نافذة = قائمة كاملة', () => {
    expect(ORDERED_VARIANT_CATEGORIES).toHaveLength(7);
    expect(lineOrderIsFiltered(all, null)).toBe(false);
    expect(lineOrderIsFiltered(all, { readingWindow: undefined })).toBe(false);
  });

  it('إخفاء فئة واحدة، أو تصفية راوٍ، أو نافذة قراءة = صفوف مخفية', () => {
    expect(lineOrderIsFiltered({ ...all, categories: all.categories.slice(0, 6) }, null)).toBe(true);
    expect(lineOrderIsFiltered({ ...all, narratorIds: ['qalun'] }, null)).toBe(true);
    expect(lineOrderIsFiltered(all, { readingWindow: { focusSegment: 's1' } as never })).toBe(true);
  });

  it('لا يعتمد على عدد سحري: تكرار فئة لا يعوّض فئة ناقصة', () => {
    expect(lineOrderIsFiltered({ ...all, categories: [...all.categories.slice(0, 6), 'TAHQIQ'] }, null)).toBe(true);
  });

  it('ترتيب الفئات لا يؤثر على الحكم', () => {
    expect(lineOrderIsFiltered({ ...all, categories: [...all.categories].reverse() }, null)).toBe(false);
  });
});

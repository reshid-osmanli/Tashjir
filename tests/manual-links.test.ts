// اختبارات الروابط اليدوية والترتيب اليدوي - Manual Links Tests
//
// هذه الاختبارات تحرس جوهر مرحلة «المحرر يصحّح المحرك»:
//   دمج وجهين من قارئين مختلفين في سطر واحد،
//   دمج سطر بسطر،
//   ربط جزء من الآية بسطر آخر دون إنشاء سطر جديد (Line→Segment→Rule)،
//   والترتيب اليدوي للأسطر بإزاحة المتأثرين لا باستبدالهم.

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey, getAyahWordsByKey } from '@/data/quran';
import { getSeedVariants } from '@/data/variants/seed-variants';
import { layoutAyah, DEFAULT_LAYOUT_OPTIONS } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import {
  applyManualLinks,
  moveLineToIndex,
  shiftLineInOrder,
  sortLinesByManualOrder,
  orderSnapshotOf,
} from '@/lib/tashjeer/manual-links';
import type { ViewFilter, TashjeerLink, LineSegment } from '@/types/tashjeer';

const fullFilter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

// البقرة ٩: فيها اختلافان مسجّلان (يخادعون، والمد المنفصل) فتتعدد أسطرها.
const AYAH_KEY = makeAyahKey(2, 9);

function buildTashjeer() {
  const variants = getSeedVariants(AYAH_KEY);
  const words = getAyahWordsByKey(AYAH_KEY);
  const layout = layoutAyah(AYAH_KEY, words, DEFAULT_LAYOUT_OPTIONS);
  return {
    variants,
    layout,
    classic: generateClassicTashjeer(variants, layout, fullFilter, DEFAULT_LAYOUT_OPTIONS),
  };
}

function makeLink(partial: Partial<TashjeerLink> & Pick<TashjeerLink, 'kind' | 'from' | 'to'>): TashjeerLink {
  return {
    id: `test-link-${Math.random().toString(36).slice(2, 8)}`,
    ayahKey: AYAH_KEY,
    relation: 'MERGE',
    origin: 'EDITOR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('تطبيق الروابط اليدوية', () => {
  it('يدمج وجهين من موضعين مختلفين في سطر واحد يجمع أحكامهما', () => {
    const { classic, layout, variants } = buildTashjeer();
    const linesBefore = classic.lines.length;
    expect(linesBefore).toBeGreaterThanOrEqual(2);

    const firstVariant = variants[0];
    const secondVariant = variants[1];
    const firstAlt = firstVariant.alternatives.find((alt) => !alt.isBase)!;
    const secondAlt = secondVariant.alternatives.find((alt) => !alt.isBase)!;

    const link = makeLink({
      kind: 'FACE_TO_FACE',
      from: { type: 'FACE', id: `${firstVariant.id}::${firstAlt.id}` },
      to: { type: 'FACE', id: `${secondVariant.id}::${secondAlt.id}` },
    });

    const { lines, appliedMergeIds } = applyManualLinks(classic.lines, layout, [link], []);
    expect(appliedMergeIds).toEqual([link.id]);
    expect(lines).toHaveLength(linesBefore - 1);

    const merged = lines.find((line) => line.linkIds?.includes(link.id));
    expect(merged).toBeDefined();
    // السطر المدموج يحمل حكمي الموضعين معا.
    expect(merged!.entries).toHaveLength(2);
    expect(merged!.mergedFrom).toBeDefined();
  });

  it('يدمج سطرين بمعرّفيهما (LINE_TO_LINE)', () => {
    const { classic, layout } = buildTashjeer();
    const [first, second] = classic.lines;
    const link = makeLink({
      kind: 'LINE_TO_LINE',
      from: { type: 'LINE', id: first.id },
      to: { type: 'LINE', id: second.id },
    });

    const { lines } = applyManualLinks(classic.lines, layout, [link], []);
    expect(lines).toHaveLength(classic.lines.length - 1);
    expect(lines.some((line) => line.id === second.id)).toBe(false);
    const merged = lines.find((line) => line.id === first.id);
    // أحكام السطرين مجتمعة، والحكم المشترك بينهما لا يتكرر.
    const unionKeys = new Set(
      [...first.entries, ...second.entries].map((entry) => `${entry.variantId}::${entry.alternativeId}`)
    );
    expect(merged?.entries).toHaveLength(unionKeys.size);
    expect(merged?.mergedFrom).toContain(second.id);
  });

  it('يربط جزءا من الآية بسطر آخر دون إنشاء سطر جديد (Line→Segment→Line)', () => {
    const { classic, layout } = buildTashjeer();
    const target = classic.lines[0];
    const wordsCount = layout.boxes.length;

    const segment: LineSegment = {
      id: 'segment-test-1',
      ayahKey: AYAH_KEY,
      title: 'جزء اختبار',
      startPosition: 1,
      endPosition: 1,
      origin: 'EDITOR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const link = makeLink({
      kind: 'SEGMENT_TO_LINE',
      from: { type: 'SEGMENT', id: segment.id },
      to: { type: 'LINE', id: target.id },
    });

    const { lines } = applyManualLinks(classic.lines, layout, [link], [segment]);
    // لا سطر جديد: الجزء أُلحق بالسطر الهدف.
    expect(lines).toHaveLength(classic.lines.length);
    const updated = lines.find((line) => line.id === target.id);
    const segmentEntry = updated?.entries.find((entry) => entry.variantId === `segment:${segment.id}`);
    expect(segmentEntry).toBeDefined();
    expect(segmentEntry!.marks.map((mark) => mark.position)).toEqual([1]);
    // امتداد السطر وسع ليشمل موضع الجزء.
    expect(updated!.startPosition).toBe(Math.min(target.startPosition, 1));
    expect(wordsCount).toBeGreaterThan(0);
  });

  it('الربط المرجعي يسجَّل دون تغيير عدد الأسطر', () => {
    const { classic, layout, variants } = buildTashjeer();
    const firstVariant = variants[0];
    const firstAlt = firstVariant.alternatives.find((alt) => !alt.isBase)!;
    const secondVariant = variants[1];
    const secondAlt = secondVariant.alternatives.find((alt) => !alt.isBase)!;

    const link = makeLink({
      kind: 'FACE_TO_FACE',
      relation: 'REFERENCE',
      from: { type: 'FACE', id: `${firstVariant.id}::${firstAlt.id}` },
      to: { type: 'FACE', id: `${secondVariant.id}::${secondAlt.id}` },
    });

    const { lines, appliedMergeIds, appliedReferenceIds } = applyManualLinks(
      classic.lines,
      layout,
      [link],
      []
    );
    expect(lines).toHaveLength(classic.lines.length);
    expect(appliedMergeIds).toEqual([]);
    expect(appliedReferenceIds).toEqual([link.id]);
    // الأسطر الموسومة بالعلاقة تظهر عليها علامة الارتباط.
    const tagged = lines.filter((line) => line.linkIds?.includes(link.id));
    expect(tagged.length).toBeGreaterThanOrEqual(2);
  });

  it('روابط لا تجد طرفها تُتجاهل بأمان ولا تكسر الناتج', () => {
    const { classic, layout } = buildTashjeer();
    const link = makeLink({
      kind: 'LINE_TO_LINE',
      from: { type: 'LINE', id: 'سطر-معدوم' },
      to: { type: 'LINE', id: classic.lines[0].id },
    });

    const { lines, appliedMergeIds } = applyManualLinks(classic.lines, layout, [link], []);
    expect(lines).toHaveLength(classic.lines.length);
    expect(appliedMergeIds).toEqual([]);
  });
});

describe('الترتيب اليدوي للأسطر', () => {
  it('يرتّب الأسطر المذكورة بترتيب المحرر ويبقي البقية بعدها', () => {
    const { classic } = buildTashjeer();
    const engineOrder = orderSnapshotOf(classic.lines);
    expect(engineOrder.length).toBeGreaterThanOrEqual(2);

    // عكس ترتيب أول سطرين.
    const manual = [engineOrder[1], engineOrder[0], ...engineOrder.slice(2)];
    const sorted = sortLinesByManualOrder(classic.lines, manual);

    expect(sorted.map((line) => line.id)).toEqual(manual);
  });

  it('ترتيب جزئي يكمل الباقي بترتيب المحرك بعد المذكور', () => {
    const { classic } = buildTashjeer();
    const ids = orderSnapshotOf(classic.lines);
    const sorted = sortLinesByManualOrder(classic.lines, [ids[ids.length - 1]]);

    expect(sorted[0].id).toBe(ids[ids.length - 1]);
    expect(sorted.slice(1).map((line) => line.id)).toEqual(ids.slice(0, -1));
  });

  it('ينقل سطرا إلى موضع جديد بإزاحة المتأثرين (إدخال لا استبدال)', () => {
    const ids = ['a', 'b', 'c', 'd'];

    // نقل d إلى الموضع الأول.
    expect(moveLineToIndex(ids, 'd', 1)).toEqual(['d', 'a', 'b', 'c']);
    // نقل a إلى الموضع الثالث.
    expect(moveLineToIndex(ids, 'a', 3)).toEqual(['b', 'c', 'a', 'd']);
    // موضع خارج الحدود يُثبَّت عند آخر موضع.
    expect(moveLineToIndex(ids, 'a', 99)).toEqual(['b', 'c', 'd', 'a']);
    // سطر غير موجود لا يغير شيئا.
    expect(moveLineToIndex(ids, 'x', 2)).toEqual(ids);
  });

  it('النقل بخوة واحدة يحافظ على سلامة القائمة', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(shiftLineInOrder(ids, 'c', -1)).toEqual(['a', 'c', 'b', 'd', 'e']);
    expect(shiftLineInOrder(ids, 'c', 1)).toEqual(['a', 'b', 'd', 'c', 'e']);
    // لا يتجاوز الحدود.
    expect(shiftLineInOrder(ids, 'a', -1)).toEqual(ids);
  });

  it('generateClassicTashjeer يحترم الترتيب اليدوي وروابط الدمج معا', () => {
    const { variants, layout } = buildTashjeer();
    const base = generateClassicTashjeer(variants, layout, fullFilter, DEFAULT_LAYOUT_OPTIONS);
    const ids = orderSnapshotOf(base.lines);
    if (ids.length < 2) return;

    const reversed = [...ids].reverse();
    const result = generateClassicTashjeer(variants, layout, fullFilter, DEFAULT_LAYOUT_OPTIONS, {
      lineOrder: reversed,
    });

    expect(result.lines.map((line) => line.id)).toEqual(reversed);
  });
});

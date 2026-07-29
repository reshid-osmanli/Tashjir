// اختبارات محرك التشجير الكلاسيكي
// مشروع التشجير - نظام القراءات العشر

import { describe, it, expect } from 'vitest';
import { makeAyahKey, getAyahWordsByKey } from '@/data/quran';
import { getSeedVariants } from '@/data/variants/seed-variants';
import { layoutAyah, DEFAULT_LAYOUT_OPTIONS } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import type { ViewFilter } from '@/types/tashjeer';

const fullFilter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

function build(ayahKey: number) {
  const variants = getSeedVariants(ayahKey);
  const words = getAyahWordsByKey(ayahKey);
  const layout = layoutAyah(ayahKey, words, DEFAULT_LAYOUT_OPTIONS);
  return generateClassicTashjeer(variants, layout, fullFilter, DEFAULT_LAYOUT_OPTIONS);
}

describe('generateClassicTashjeer', () => {
  it('لا يولّد خطا للوجه الأساس (حفص) ويولّد خطا لكل وجه مختلف', () => {
    const { lines } = build(makeAyahKey(1, 4));

    // في الفاتحة 4 اختلاف واحد (ملك/مالك) → سطر واحد.
    expect(lines).toHaveLength(1);

    const line = lines[0];
    expect(line.category).toBe('FARSH');
    // الرئيس هو قالون (الأعلى ترتيبا في طيبة) ورمزه ب.
    expect(line.primarySymbol).toBe('ب');
    expect(line.primaryNarratorName).toBe('قالون');
    // رموز كل القراء الذين يقرؤون «ملك» بلا ألف (نافع وابن كثير وأبو عمرو
    // وابن عامر وحمزة وأبو جعفر = ١٢ راويا).
    expect(line.symbols).toEqual([
      'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ك', 'ل', 'س', 'ع',
    ]);
    // عقدة واحدة عند الكلمة الأولى.
    expect(line.marks.map((m) => m.position)).toEqual([1]);
    expect(line.readingText).toContain('مَلِك');
  });

  it('يرتّب الخطوط من آخر الآية إلى أولها', () => {
    // البقرة 9 فيها اختلافان: يخدعون (كلمة 6) والمد المنفصل (كلمتا 7-8).
    const { lines } = build(makeAyahKey(2, 9));
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // الخط الذي عقدته المتأخرة أقرب لنهاية الآية يأخذ المسار 0 (أقرب للنص).
    const nearest = lines.find((l) => l.lane === 0);
    expect(nearest).toBeDefined();
    expect(nearest!.endPosition).toBe(Math.max(...lines.map((l) => l.endPosition)));
  });

  it('يحسب إحداثيات الخطوط تصاعديا حسب المسار', () => {
    const { lines, firstRowY, rowHeight } = build(makeAyahKey(2, 9));
    expect(lines.length).toBeGreaterThan(1);

    lines.forEach((line) => {
      expect(line.rowY).toBeCloseTo(firstRowY + line.lane * rowHeight, 5);
    });
  });

  it('يصفّي حسب الفئة والراوي', () => {
    const base = build(makeAyahKey(2, 9));
    const baseCount = base.lines.length;

    const farshOnly: ViewFilter = { ...fullFilter, categories: ['FARSH'] };
    const words = getAyahWordsByKey(makeAyahKey(2, 9));
    const layout = layoutAyah(makeAyahKey(2, 9), words, DEFAULT_LAYOUT_OPTIONS);
    const filtered = generateClassicTashjeer(
      getSeedVariants(makeAyahKey(2, 9)),
      layout,
      farshOnly,
      DEFAULT_LAYOUT_OPTIONS
    );
    expect(filtered.lines.every((l) => l.category === 'FARSH')).toBe(true);
    expect(filtered.lines.length).toBeLessThan(baseCount);

    // تصفية براوٍ واحد: تبقى الخطوط التي يشارك فيها.
    const qalunOnly: ViewFilter = {
      ...fullFilter,
      narratorIds: ['narrator-qalun'],
    };
    const byQalun = generateClassicTashjeer(
      getSeedVariants(makeAyahKey(2, 9)),
      layout,
      qalunOnly,
      DEFAULT_LAYOUT_OPTIONS
    );
    expect(
      byQalun.lines.every((l) => l.narratorIds.includes('narrator-qalun'))
    ).toBe(true);
  });

  it('يعلم بعدم وجود اختلافات عند غياب الاختلافات', () => {
    const { hasDifferences, lines } = build(makeAyahKey(2, 1));
    expect(hasDifferences).toBe(false);
    expect(lines).toHaveLength(0);
  });
});

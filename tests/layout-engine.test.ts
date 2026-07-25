// اختبارات محرك التخطيط - Layout Engine Tests
// مشروع التشجير - نظام القراءات العشر
//
// التخطيط يجب أن يكون حتميا (نفس المدخل ينتج نفس المخرج) ومتوافقا مع
// اتجاه الكتابة من اليمين إلى اليسار.

import { describe, expect, it } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import {
  DEFAULT_LAYOUT_OPTIONS,
  computeCanvasHeight,
  getLaneY,
  layoutAyah,
  measureWordExtents,
  measureWordWidth,
} from '@/lib/tashjeer/layout-engine';

describe('قياس النص', () => {
  it('الكلمة الأطول أعرض من الأقصر', () => {
    const short = measureWordWidth('مِن', 34);
    const long = measureWordWidth('ٱلۡمُسۡتَقِيمَ', 34);
    expect(long).toBeGreaterThan(short);
  });

  it('الحركات لا تزيد العرض الأفقي', () => {
    // نقارن الحروف نفسها مشكّلة وغير مشكّلة: العرض يجب أن يتطابق تماما،
    // لأن الحركات تُرسم فوق الحرف أو تحته ولا تشغل مساحة أفقية.
    expect(measureWordWidth('مَلِكِ', 34)).toBe(measureWordWidth('ملك', 34));
    expect(measureWordWidth('ٱلرَّحِيمِ', 34)).toBe(measureWordWidth('ٱلرحيم', 34));
  });

  it('الألف الخنجرية لا تشغل عرضا', () => {
    // «مَٰلِكِ» رسمها ثلاثة حروف والألف فيها خنجرية، فعرضها أقل من «مالك».
    expect(measureWordWidth('مَٰلِكِ', 34)).toBeLessThan(measureWordWidth('مَالِكِ', 34));
  });

  it('العرض يتناسب طرديا مع حجم الخط', () => {
    const small = measureWordWidth('ٱلرَّحِيمِ', 20);
    const large = measureWordWidth('ٱلرَّحِيمِ', 40);
    expect(large / small).toBeCloseTo(2, 1);
  });

  it('لا يعطي عرضا صفريا لأي كلمة', () => {
    expect(measureWordWidth('ٱ', 34)).toBeGreaterThan(0);
    expect(measureWordWidth('', 34)).toBeGreaterThan(0);
  });

  it('الكلمة ذات الحركة العلوية أعلى امتدادا', () => {
    const plain = measureWordExtents('مالك', 34);
    const marked = measureWordExtents('مَٰلِكِ', 34);
    expect(marked.ascent).toBeGreaterThanOrEqual(plain.ascent);
  });
});

describe('تخطيط الآية', () => {
  const ayahKey = makeAyahKey(1, 7);
  const words = getAyahWords(1, 7);

  it('يعطي صندوقا لكل كلمة', () => {
    const layout = layoutAyah(ayahKey, words);
    expect(layout.boxes).toHaveLength(words.length);
    expect(layout.boxById.size).toBe(words.length);
    expect(layout.boxByPosition.size).toBe(words.length);
  });

  it('يتقدم من اليمين إلى اليسار', () => {
    const layout = layoutAyah(ayahKey, words);
    const sameLine = layout.boxes.filter((box) => box.lineIndex === 0);

    for (let index = 1; index < sameLine.length; index++) {
      expect(sameLine[index].centerX).toBeLessThan(sameLine[index - 1].centerX);
    }
  });

  it('يبدأ الكلمة الأولى قرب الهامش الأيمن', () => {
    const layout = layoutAyah(ayahKey, words);
    const first = layout.boxes[0];
    const rightEdge = DEFAULT_LAYOUT_OPTIONS.canvasWidth - DEFAULT_LAYOUT_OPTIONS.paddingRight;

    expect(first.x + first.width).toBeCloseTo(rightEdge, 0);
  });

  it('لا تتجاوز أي كلمة الهامش الأيسر', () => {
    const layout = layoutAyah(ayahKey, words);
    for (const box of layout.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(DEFAULT_LAYOUT_OPTIONS.paddingLeft - 1);
    }
  });

  it('يلتف إلى سطر جديد في الآيات الطويلة', () => {
    const longWords = getAyahWords(2, 282); // أطول آية في المصحف
    const layout = layoutAyah(makeAyahKey(2, 282), longWords);

    expect(layout.lineCount).toBeGreaterThan(1);
    expect(layout.textHeight).toBeGreaterThan(DEFAULT_LAYOUT_OPTIONS.lineHeight);
  });

  it('الأسطر تتنازل للأسفل', () => {
    const longWords = getAyahWords(2, 282);
    const layout = layoutAyah(makeAyahKey(2, 282), longWords);

    const firstLine = layout.boxes.find((box) => box.lineIndex === 0)!;
    const secondLine = layout.boxes.find((box) => box.lineIndex === 1)!;

    expect(secondLine.baselineY).toBeGreaterThan(firstLine.baselineY);
  });

  it('التخطيط حتمي: نفس المدخل ينتج نفس المخرج', () => {
    const first = layoutAyah(ayahKey, words);
    const second = layoutAyah(ayahKey, words);

    expect(first.boxes.map((box) => box.x)).toEqual(second.boxes.map((box) => box.x));
  });

  it('حجم خط أكبر يعطي أسطرا أكثر', () => {
    const small = layoutAyah(ayahKey, words, { fontSize: 20 });
    const large = layoutAyah(ayahKey, words, { fontSize: 52 });

    expect(large.lineCount).toBeGreaterThanOrEqual(small.lineCount);
  });

  it('نقاط الارتباط أعلى وأسفل صندوق الكلمة', () => {
    const layout = layoutAyah(ayahKey, words);
    for (const box of layout.boxes) {
      expect(box.topY).toBeLessThan(box.baselineY);
      expect(box.bottomY).toBeGreaterThan(box.baselineY);
    }
  });

  it('يتعامل مع آية بلا كلمات دون خطأ', () => {
    const layout = layoutAyah(0, []);
    expect(layout.boxes).toHaveLength(0);
    expect(layout.lineCount).toBe(1);
  });
});

describe('المسارات', () => {
  const words = getAyahWords(1, 4);
  const layout = layoutAyah(makeAyahKey(1, 4), words);

  it('مسارات الأعلى تصعد كلما زاد رقمها', () => {
    const lane0 = getLaneY(0, 'TOP', layout);
    const lane1 = getLaneY(1, 'TOP', layout);
    expect(lane1).toBeLessThan(lane0);
  });

  it('مسارات الأسفل تنزل كلما زاد رقمها', () => {
    const lane0 = getLaneY(0, 'BOTTOM', layout);
    const lane1 = getLaneY(1, 'BOTTOM', layout);
    expect(lane1).toBeGreaterThan(lane0);
  });

  it('مسارات الأعلى فوق النص ومسارات الأسفل تحته', () => {
    const top = Math.min(...layout.boxes.map((box) => box.topY));
    const bottom = Math.max(...layout.boxes.map((box) => box.bottomY));

    expect(getLaneY(0, 'TOP', layout)).toBeLessThan(top);
    expect(getLaneY(0, 'BOTTOM', layout)).toBeGreaterThan(bottom);
  });

  it('ارتفاع اللوحة يتسع لكل المسارات', () => {
    const height = computeCanvasHeight(layout, 3, 6);
    expect(height).toBeGreaterThan(getLaneY(5, 'BOTTOM', layout));
  });
});

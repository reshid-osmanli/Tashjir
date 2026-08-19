// اختبارات نافذة العمل والسطر الواحد ودقة مواضع الحروف
//
// ثلاثة مطالب يحرسها هذا الملف:
//   1. نص الآية على خط واحد مهما طال، مع تمدد اللوحة لا التفاف النص.
//   2. مواضع الحروف مقيسة بعرض الحرف الحقيقي لا بقسمة الكلمة بالتساوي،
//      فتقع الوصلة والتحديد على الحرف المقصود.
//   3. وصل الآية بالتي بعدها في نافذة واحدة متصلة المواضع.

import { describe, expect, it } from 'vitest';
import { getAyahWordsByKey, makeAyahKey } from '@/data/quran';
import {
  DEFAULT_LAYOUT_OPTIONS,
  layoutAyah,
  measureCharacterOffsets,
} from '@/lib/tashjeer/layout-engine';
import {
  buildReadingWindow,
  documentWindowWords,
  nextAyahKeyInSurah,
} from '@/lib/tashjeer/reading-window';
import {
  characterCellBounds,
  characterRangeCenterX,
  characterCount,
} from '@/lib/quran-logic/characters';

const longAyahKey = makeAyahKey(2, 20);

describe('نص الآية في سطر واحد', () => {
  it('يلتف النص في الوضع القديم ولا يلتف في وضع السطر الواحد', () => {
    const words = getAyahWordsByKey(longAyahKey);

    const wrapped = layoutAyah(longAyahKey, words, DEFAULT_LAYOUT_OPTIONS);
    expect(wrapped.lineCount).toBeGreaterThan(1);

    const single = layoutAyah(longAyahKey, words, {
      ...DEFAULT_LAYOUT_OPTIONS,
      singleLine: true,
    });
    expect(single.lineCount).toBe(1);
    expect(new Set(single.boxes.map((box) => box.lineIndex)).size).toBe(1);
  });

  it('يمدّ عرض اللوحة حتى تسع الآية كلها بدل قطعها', () => {
    const words = getAyahWordsByKey(longAyahKey);
    const single = layoutAyah(longAyahKey, words, {
      ...DEFAULT_LAYOUT_OPTIONS,
      singleLine: true,
    });

    expect(single.canvasWidth).toBeGreaterThan(DEFAULT_LAYOUT_OPTIONS.canvasWidth);
    // آخر كلمة (وهي في أقصى اليسار) تبقى داخل اللوحة.
    const leftMost = Math.min(...single.boxes.map((box) => box.x));
    expect(leftMost).toBeGreaterThanOrEqual(0);
  });

  it('يتجاهل كسر السطر اليدوي ما دام النص على خط واحد', () => {
    const words = getAyahWordsByKey(longAyahKey);
    const single = layoutAyah(longAyahKey, words, {
      ...DEFAULT_LAYOUT_OPTIONS,
      singleLine: true,
      forcedLineBreakAfter: [3, 7],
    });

    expect(single.lineCount).toBe(1);
  });
});

describe('دقة مواضع الحروف', () => {
  const word = 'ٱلرَّحِيمُ';

  it('يعطي كل حرف عرضه لا حصة متساوية من الكلمة', () => {
    const offsets = measureCharacterOffsets(word, 34);
    const count = characterCount(word);

    expect(offsets).toHaveLength(count + 1);
    // متزايدة دائما، فالحرف لا يبدأ قبل الذي سبقه.
    for (let index = 1; index < offsets.length; index++) {
      expect(offsets[index]).toBeGreaterThan(offsets[index - 1]);
    }

    const widths = offsets.slice(1).map((offset, index) => offset - offsets[index]);
    const uniform = offsets[offsets.length - 1] / count;
    // «اللام» و«الميم» ليستا بعرض واحد؛ لو تساوت كل العروض لكان القياس وهما.
    expect(widths.some((width) => Math.abs(width - uniform) > 0.5)).toBe(true);
  });

  it('يضع خلية الحرف على موضعه الحقيقي داخل الصندوق', () => {
    const layout = layoutAyah(makeAyahKey(1, 1), getAyahWordsByKey(makeAyahKey(1, 1)), {
      ...DEFAULT_LAYOUT_OPTIONS,
      singleLine: true,
    });
    const box = layout.boxes[0];
    expect(box.characterOffsets).toBeDefined();

    const first = characterCellBounds(box, 1);
    const last = characterCellBounds(box, characterCount(box.text));

    // أول حرف عند الحافة اليمنى، وآخر حرف عند الحافة اليسرى (الكتابة RTL).
    expect(first.rightX).toBeCloseTo(box.x + box.width, 5);
    expect(last.leftX).toBeCloseTo(box.x, 5);
    expect(first.centerX).toBeGreaterThan(last.centerX);
  });

  it('يجعل مركز نطاق الحروف داخل حدود النطاق نفسه', () => {
    const layout = layoutAyah(makeAyahKey(1, 1), getAyahWordsByKey(makeAyahKey(1, 1)), {
      ...DEFAULT_LAYOUT_OPTIONS,
      singleLine: true,
    });
    const box = layout.boxes[0];
    const count = characterCount(box.text);

    const center = characterRangeCenterX(box, 1, count);
    expect(center).toBeLessThanOrEqual(box.x + box.width);
    expect(center).toBeGreaterThanOrEqual(box.x);
  });
});

describe('وصل الآيتين في نافذة عمل واحدة', () => {
  const ayahKey = makeAyahKey(2, 37);

  it('يبقي الآية وحدها إن لم يطلب المحقق الوصل', () => {
    const window = buildReadingWindow(ayahKey, false);

    expect(window.isLinked).toBe(false);
    expect(window.ayahKeys).toEqual([ayahKey]);
    expect(window.words).toHaveLength(getAyahWordsByKey(ayahKey).length);
  });

  it('يتابع ترقيم المواضع عبر الآيتين عند الوصل', () => {
    const window = buildReadingWindow(ayahKey, true);
    const first = getAyahWordsByKey(ayahKey);
    const second = getAyahWordsByKey(makeAyahKey(2, 38));

    expect(window.isLinked).toBe(true);
    expect(window.firstAyahEndPosition).toBe(first.length);
    expect(window.words).toHaveLength(first.length + second.length);

    // المواضع متسلسلة بلا فجوة ولا تكرار.
    expect(window.words.map((word) => word.position)).toEqual(
      window.words.map((_, index) => index + 1)
    );
    // ومعرّف كل كلمة يبقى معرّفها في آيتها، فلا يلتبس التخزين.
    expect(window.words[first.length].id).toBe(second[0].id);
    expect(window.words[first.length].ayahPosition).toBe(1);
  });

  it('لا يصل في آخر السورة', () => {
    const lastKey = makeAyahKey(1, 7);
    expect(nextAyahKeyInSurah(lastKey)).toBeNull();
    expect(buildReadingWindow(lastKey, true).isLinked).toBe(false);
  });

  it('يقرأ إعداد الوصل من المستند مباشرة', () => {
    const linked = documentWindowWords({ ayahKey, readingWindow: { linkNextAyah: true } });
    const alone = documentWindowWords({ ayahKey, readingWindow: { linkNextAyah: false } });

    expect(linked.length).toBeGreaterThan(alone.length);
  });
});

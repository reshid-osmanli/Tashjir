// اختبارات تركيز اللوحة — Canvas Focus Protocol Tests (FR-ED-02.3, AC-06)
// مشروع التشجير - نظام القراءات العشر
//
// «الضغط على Line 25 في لوحة العلاقات يجعل المحرر ينتقل إلى Line 25 ويميزه».
// هذه الاختبارات تحرس الحساب النقي لذلك الانتقال: محدد العنصر الهدف داخل
// لوحة SVG، وكشف خروجه عن مجال الرؤية، وحساب pan الذي يُمركزه — كلها دوال
// نقية بلا DOM فيُثبت سلوكها الاختبار لا الصدفة.

import { describe, expect, it } from 'vitest';
import {
  computeFocusPan,
  isRectOutsideViewport,
  selectionTargetSelector,
  toMeasuredRect,
  FOCUS_BUDGET_MS,
} from '@/lib/editor/selection-store';
import { makeAyahKey, makeWordId } from '@/data/quran';
import type { EditorSelection } from '@/types/tashjeer';

const AYAH_KEY = makeAyahKey(2, 4);

describe('محدد الهدف في اللوحة لكل نوع تحديد', () => {
  it('الكلمة تستهدف صندوقها بمعرّفها الحتمي', () => {
    const selection: EditorSelection = { kind: 'WORD', id: '2004003', position: 3 };
    expect(selectionTargetSelector(selection)).toBe('[data-word-id="2004003"]');
  });

  it('السطر Line 25 يستهدف سطره البصري (مثال AC-06 الملزم)', () => {
    const selection: EditorSelection = { kind: 'LINE', id: 'line25', lineId: 'line25', differenceId: 'v1' };
    expect(selectionTargetSelector(selection)).toBe('[data-line-id="line25"]');
  });

  it('الاختلاف والقاعدة المشتقة تستهدفان سطر الاختلاف', () => {
    const difference: EditorSelection = { kind: 'DIFFERENCE', id: 'v1', differenceId: 'v1' };
    const rule: EditorSelection = { kind: 'RULE', id: 'global:r1', differenceId: 'global:r1' };
    expect(selectionTargetSelector(difference)).toBe('[data-variant-ids~="v1"]');
    expect(selectionTargetSelector(rule)).toBe('[data-variant-ids~="global:r1"]');
  });

  it('الوجه يستهدف سطر اختلافه (والنبضة على الأداة نفسها)', () => {
    const selection: EditorSelection = { kind: 'FACE', id: 'a2', differenceId: 'v1', faceId: 'a2' };
    expect(selectionTargetSelector(selection)).toBe('[data-variant-ids~="v1"]');
  });

  it('الجزء والموضع وعلامة الوقف يستهدفون كلمة الإرشاد بمفتاح الآية', () => {
    const segment: EditorSelection = { kind: 'SEGMENT', id: 'seg1', position: 3 };
    const locus: EditorSelection = { kind: 'LOCUS', id: '3:5', position: 5 };
    const waqf: EditorSelection = { kind: 'WAQF_MARK', id: 'b1', position: 7 };
    const wordId3 = String(makeWordId(AYAH_KEY, 3));
    expect(selectionTargetSelector(segment, AYAH_KEY)).toBe(`[data-word-id="${wordId3}"]`);
    expect(selectionTargetSelector(locus, AYAH_KEY)).toBe(`[data-word-id="${String(makeWordId(AYAH_KEY, 5))}"]`);
    expect(selectionTargetSelector(waqf, AYAH_KEY)).toBe(`[data-word-id="${String(makeWordId(AYAH_KEY, 7))}"]`);
    // بلا مفتاح الآية لا يُبنى محدد خاطئ.
    expect(selectionTargetSelector(segment)).toBeNull();
  });

  it('الحرف يستهدف كلمته الحاضنة، والوجه المركب بلا هدف مباشر', () => {
    const character: EditorSelection = { kind: 'CHARACTER', id: '2004003:1', wordId: 2004003, characterIndex: 1 };
    expect(selectionTargetSelector(character)).toBe('[data-word-id="2004003"]');
    expect(
      selectionTargetSelector({ kind: 'CHARACTER', id: 'x', characterIndex: 1 })
    ).toBeNull();
    expect(selectionTargetSelector({ kind: 'COMPOSITE_FACE', id: 'link1' })).toBeNull();
  });
});

describe('كشف الخروج عن مجال الرؤية (هامش الأمان)', () => {
  const viewport = toMeasuredRect({ left: 0, top: 0, width: 800, height: 600 });
  const margin = 24;

  it('عنصر داخل الهامش لا يحتاج تحريك اللوحة', () => {
    const target = toMeasuredRect({ left: 200, top: 150, width: 120, height: 40 });
    expect(isRectOutsideViewport(target, viewport, margin)).toBe(false);
  });

  it('عنصر ملاصق للحافة بقدر الهامش بالضبط يُعدّ داخلًا', () => {
    const target = toMeasuredRect({ left: 24, top: 24, width: 700, height: 552 });
    expect(isRectOutsideViewport(target, viewport, margin)).toBe(false);
  });

  it('خروج من أي جهة (أعلى/أسفل/يمين/يسار) يكشف', () => {
    expect(
      isRectOutsideViewport(toMeasuredRect({ left: 200, top: -80, width: 120, height: 40 }), viewport, margin)
    ).toBe(true);
    expect(
      isRectOutsideViewport(toMeasuredRect({ left: 200, top: 590, width: 120, height: 60 }), viewport, margin)
    ).toBe(true);
    expect(
      isRectOutsideViewport(toMeasuredRect({ left: 790, top: 100, width: 120, height: 40 }), viewport, margin)
    ).toBe(true);
    expect(
      isRectOutsideViewport(toMeasuredRect({ left: -120, top: 100, width: 120, height: 40 }), viewport, margin)
    ).toBe(true);
  });
});

describe('حساب pan التمركز (بلا تغيير التكبير)', () => {
  it('مركز العنصر البعيد يُعاد إلى مركز اللوحة (اللوحة تتحرك عكس العنصر)', () => {
    const next = computeFocusPan({ x: 1600, y: 900 }, { x: 400, y: 300 }, 2, { x: 0, y: 0 });
    expect(next).toEqual({ x: -2400, y: -1200 });
  });

  it('عنصر مركزي أصلًا لا يحرّك المشهد', () => {
    const center = { x: 400, y: 300 };
    expect(computeFocusPan(center, center, 2, { x: 40, y: -30 })).toEqual({ x: 40, y: -30 });
  });

  it('المقياس يحوّل بكسلات الشاشة إلى وحدات اللوحة', () => {
    const next = computeFocusPan({ x: 500, y: 300 }, { x: 400, y: 300 }, 10, { x: 0, y: 0 });
    expect(next.x).toBe(-1000);
  });
});

describe('ميزانية الزمن (AC-06: ≤ 300ms)', () => {
  it('الثابت الموثق لا يتجاوز 300ms', () => {
    expect(FOCUS_BUDGET_MS).toBeLessThanOrEqual(300);
  });
});

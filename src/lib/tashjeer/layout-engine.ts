// محرك التخطيط - Layout Engine
// مشروع التشجير - نظام القراءات العشر
//
// مسؤولية هذا الملف: تحويل كلمات الآية إلى صناديق (WordBox) لها إحداثيات دقيقة
// داخل لوحة الرسم، مع مراعاة:
//   1. اتجاه الكتابة من اليمين إلى اليسار.
//   2. أثر الحركات وعلامات الضبط على العرض والارتفاع.
//   3. الالتفاف التلقائي إلى سطر جديد عند بلوغ الهامش الأيسر.
//
// لماذا لا نستخدم قياس المتصفح مباشرة؟
//   لأن المحرر يجب أن يعطي نفس الناتج على الخادم وفي الاختبارات (SSR + Vitest).
//   لذلك نقيس بنموذج رياضي حتمي، ثم يمكن للواجهة تحسين القياس لاحقا عبر
//   Canvas measureText دون تغيير أي منطق آخر.

import type { AyahLayout, LayoutOptions, WordBox } from '@/types/tashjeer';
import type { MushafWord } from '@/data/quran';

// ==================== الإعدادات الافتراضية ====================

/**
 * إعدادات التخطيط الافتراضية.
 * العرض 1000 وحدة يوافق نسبة عرض مريحة للوحة SVG ذات viewBox.
 */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  canvasWidth: 1000,
  paddingRight: 56,
  paddingLeft: 56,
  textTop: 300,
  fontSize: 34,
  wordGap: 14,
  lineHeight: 96,
  laneHeight: 34,
  laneGap: 28,
};

// ==================== قياس النص ====================

/**
 * معاملات عرض الحروف العربية نسبة إلى حجم الخط.
 * القيم مستخرجة من متوسط نسب خط أميري القرآني، ومضبوطة يدويا
 * للحروف ذات العرض الشاذ (السين، الشين، الصاد، الميم...).
 */
const LETTER_WIDTH_RATIO: Record<string, number> = {
  ا: 0.26, أ: 0.26, إ: 0.26, آ: 0.3, ٱ: 0.26,
  ب: 0.5, ت: 0.5, ث: 0.5, ن: 0.5, ي: 0.55, ى: 0.55, ئ: 0.5,
  ج: 0.52, ح: 0.52, خ: 0.52,
  د: 0.36, ذ: 0.36, ر: 0.34, ز: 0.34,
  س: 0.72, ش: 0.72, ص: 0.7, ض: 0.7,
  ط: 0.6, ظ: 0.6,
  ع: 0.5, غ: 0.5,
  ف: 0.54, ق: 0.54,
  ك: 0.56, ل: 0.36, م: 0.42, ه: 0.42, ة: 0.42,
  و: 0.4, ؤ: 0.4, ء: 0.3,
  // الألف الخنجرية والسكون العثماني: علامات لا تشغل عرضا مستقلا.
  '\u0670': 0, '\u06E1': 0,
};

/** عرض افتراضي لأي حرف غير مذكور أعلاه. */
const DEFAULT_LETTER_RATIO = 0.48;

/**
 * علامات لا تشغل عرضا أفقيا لأنها تُرسم فوق الحرف أو تحته:
 * الحركات، والتنوين، والسكون، والشدة، وعلامات الوقف، والألف الخنجرية.
 */
const ZERO_WIDTH_PATTERN = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/;

/** علامات تُرسم فوق الحرف وترفع أعلى صندوق الكلمة. */
const ABOVE_MARK_PATTERN = /[\u064B\u064C\u064E\u064F\u0651\u0652\u0653\u0654\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EB\u06EC]/;

/** علامات تُرسم تحت الحرف وتخفض أسفل صندوق الكلمة. */
const BELOW_MARK_PATTERN = /[\u064D\u0650\u0655\u0656\u06E5\u06E6\u06ED]/;

/**
 * يقيس عرض كلمة بالوحدات، اعتمادا على حجم الخط.
 *
 * @param text نص الكلمة بالتشكيل
 * @param fontSize حجم الخط
 * @returns العرض التقريبي بالوحدات
 */
export function measureWordWidth(text: string, fontSize: number): number {
  let ratioSum = 0;

  for (const char of text) {
    if (ZERO_WIDTH_PATTERN.test(char)) continue;
    ratioSum += LETTER_WIDTH_RATIO[char] ?? DEFAULT_LETTER_RATIO;
  }

  // حد أدنى حتى لا تنعدم مساحة الكلمات القصيرة جدا مثل "ٱ".
  return Math.max(ratioSum * fontSize, fontSize * 0.4);
}

/**
 * يحسب امتداد الكلمة رأسيا: كم ترتفع فوق خط الأساس وكم تنزل تحته.
 * يُستخدم لضبط نقاط ربط خطوط التشجير حتى لا تلامس الحركات.
 */
export function measureWordExtents(
  text: string,
  fontSize: number
): { ascent: number; descent: number } {
  const hasAbove = ABOVE_MARK_PATTERN.test(text);
  const hasBelow = BELOW_MARK_PATTERN.test(text);
  // حروف تنزل تحت خط الأساس بطبيعتها.
  const hasDescender = /[جحخعغمنيىسشصضقؤئ]/.test(text);

  const ascent = fontSize * (hasAbove ? 1.05 : 0.85);
  const descent = fontSize * (hasBelow || hasDescender ? 0.55 : 0.3);

  return { ascent, descent };
}

// ==================== تخطيط الآية ====================

/**
 * يوزّع كلمات الآية على أسطر داخل اللوحة ويعطي كل كلمة صندوقا بإحداثيات.
 *
 * الاتجاه من اليمين إلى اليسار: نبدأ من `canvasWidth - paddingRight`
 * ونتقدم نحو اليسار. عند تجاوز `paddingLeft` ننتقل لسطر جديد.
 *
 * @param ayahKey معرّف الآية
 * @param words كلمات الآية مرتبة
 * @param options إعدادات التخطيط (اختيارية)
 */
export function layoutAyah(
  ayahKey: number,
  words: MushafWord[],
  options: Partial<LayoutOptions> = {}
): AyahLayout {
  const config: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const boxes: WordBox[] = [];

  const leftLimit = config.paddingLeft;
  const rightStart = config.canvasWidth - config.paddingRight;

  let cursorX = rightStart;
  let lineIndex = 0;

  for (const word of words) {
    const width = measureWordWidth(word.text, config.fontSize);
    const { ascent, descent } = measureWordExtents(word.text, config.fontSize);

    // التفاف: إن لم تعد الكلمة تتسع في السطر الحالي ننتقل لسطر جديد.
    // نتجاهل الالتفاف لأول كلمة في السطر حتى لا ندخل في حلقة لا نهائية
    // لو كانت كلمة واحدة أعرض من السطر كله.
    const isLineStart = Math.abs(cursorX - rightStart) < 0.001;
    if (!isLineStart && cursorX - width < leftLimit) {
      lineIndex += 1;
      cursorX = rightStart;
    }

    const baselineY = config.textTop + lineIndex * config.lineHeight;
    const x = cursorX - width;

    boxes.push({
      wordId: word.id,
      position: word.position,
      text: word.text,
      lineIndex,
      x,
      y: baselineY - ascent,
      width,
      height: ascent + descent,
      centerX: x + width / 2,
      baselineY,
      topY: baselineY - ascent,
      bottomY: baselineY + descent,
    });

    cursorX = x - config.wordGap;
  }

  return {
    ayahKey,
    boxes,
    boxById: new Map(boxes.map((box) => [box.wordId, box])),
    boxByPosition: new Map(boxes.map((box) => [box.position, box])),
    lineCount: lineIndex + 1,
    textHeight: (lineIndex + 1) * config.lineHeight,
    canvasWidth: config.canvasWidth,
  };
}

// ==================== حساب المسارات ====================

/**
 * يحسب الإحداثي الرأسي لمسار (Lane) خطوط التشجير.
 *
 * المسارات فوق النص (الأصول) تتصاعد للأعلى،
 * والمسارات تحت النص (الفرش وغيرها) تتنازل للأسفل.
 *
 * @param lane رقم المسار (0-based)
 * @param side الجهة
 * @param layout ناتج تخطيط الآية
 * @param options إعدادات التخطيط
 */
export function getLaneY(
  lane: number,
  side: 'TOP' | 'BOTTOM',
  layout: AyahLayout,
  options: Partial<LayoutOptions> = {}
): number {
  const config: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };

  if (side === 'TOP') {
    const firstLineTop = Math.min(...layout.boxes.map((box) => box.topY), config.textTop);
    return firstLineTop - config.laneGap - lane * config.laneHeight;
  }

  const lastLineBottom = Math.max(
    ...layout.boxes.map((box) => box.bottomY),
    config.textTop
  );
  return lastLineBottom + config.laneGap + lane * config.laneHeight;
}

/**
 * يحسب الارتفاع الكلي المطلوب للوحة بحيث تتسع للنص وكل المسارات.
 *
 * @param layout ناتج التخطيط
 * @param topLanes عدد المسارات فوق النص
 * @param bottomLanes عدد المسارات تحت النص
 */
export function computeCanvasHeight(
  layout: AyahLayout,
  topLanes: number,
  bottomLanes: number,
  options: Partial<LayoutOptions> = {}
): number {
  const config: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };

  const bottomY = getLaneY(Math.max(bottomLanes - 1, 0), 'BOTTOM', layout, config);
  return bottomY + config.laneHeight + 80;
}

/**
 * يحسب أعلى نقطة تحتاجها اللوحة، لضبط viewBox حين تكثر مسارات الأصول.
 */
export function computeCanvasTop(
  layout: AyahLayout,
  topLanes: number,
  options: Partial<LayoutOptions> = {}
): number {
  const config: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  if (topLanes === 0) return 0;

  const topY = getLaneY(topLanes - 1, 'TOP', layout, config);
  return Math.max(0, topY - config.laneHeight);
}

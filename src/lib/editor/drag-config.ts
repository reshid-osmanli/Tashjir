// إعدادات إيماءة سحب ترتيب الأسطر — قابلة للضبط من مكان واحد
//
// الفأرة/القلم يبدأ السحب بعد تجاوز عتبة حركة قصيرة (٧px) بلا أي انتظار
// زمني؛ اللمس يستعمل ضغطة مطولة قصيرة تحافظ على التمرير الطبيعي قبلها.
// السرعات بالبكسل لكل إطار، وتُضاعَف تدريجيًا بحسب القرب من حافة القائمة.

export interface LineDragConfig {
  /** حركة لازمة قبل بدء سحب الفأرة/القلم (تمنع النقرة العارضة). */
  thresholdPx: number;
  /** مدة الضغطة المطولة للمس فقط؛ لا تُستعمل للفأرة ولا للقلم. */
  touchLongPressMs: number;
  /** عرض منطقة الحافة التي يبدأ عندها التمرير التلقائي. */
  autoScrollEdgePx: number;
  /** أقصى سرعة تمرير تلقائي عند الحافة نفسها. */
  autoScrollMaxSpeed: number;
  /** ارتفاع الفجوة المنطقية التي تفتحها القائمة أثناء السحب. */
  placeholderPx: number;
  /** مدة انتقال ما بعد الإفلات (FLIP). */
  transitionMs: number;
}

export const DEFAULT_LINE_DRAG_CONFIG: LineDragConfig = {
  thresholdPx: 7,
  touchLongPressMs: 260,
  autoScrollEdgePx: 72,
  autoScrollMaxSpeed: 22,
  placeholderPx: 30,
  transitionMs: 180,
};

export function resolveLineDragConfig(overrides?: Partial<LineDragConfig>): LineDragConfig {
  const config = { ...DEFAULT_LINE_DRAG_CONFIG, ...overrides };
  return {
    thresholdPx: Math.max(2, config.thresholdPx),
    touchLongPressMs: Math.max(80, Math.min(600, config.touchLongPressMs)),
    autoScrollEdgePx: Math.max(12, config.autoScrollEdgePx),
    autoScrollMaxSpeed: Math.max(1, Math.min(60, config.autoScrollMaxSpeed)),
    placeholderPx: Math.max(8, config.placeholderPx),
    transitionMs: Math.max(0, Math.min(500, config.transitionMs)),
  };
}

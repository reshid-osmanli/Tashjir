// حالات التفاعل الموحّدة — Interaction States
//
// كل عنصر قابل للتحرير في المحرر يمرّ بهذه الحالات. الأولوية ثابتة في مكان
// واحد حتى لا تختلف إجابة «ما حالة هذا العنصر الآن؟» بين لوحة الرسم وقائمة
// الترتيب وقائمة السياق. نقيّة تماما: لا DOM ولا React ولا مخزن، فتُختبر
// مباشرة ويستهلكها A1448 (سطر اللوحة) وصفوف LineOrderEditor معا.

export type InteractionState =
  | 'normal'
  | 'hover'
  | 'focus'
  | 'selected'
  | 'pressed'
  | 'dragging'
  | 'disabled'
  | 'saving'
  | 'error';

export interface InteractionInput {
  disabled?: boolean;
  saving?: boolean;
  error?: boolean;
  dragging?: boolean;
  pressed?: boolean;
  selected?: boolean;
  focused?: boolean;
  hovered?: boolean;
}

/**
 * الحالة الظاهرة الواحدة. الحالات الحاجبة تُقدَّم على حالات التوجيه:
 * خطأ ← حفظ ← معطّل ← سحب ← مضغوط ← محدد ← تركيز ← تمرير ← عادي.
 *
 * «معطّل» بعد «حفظ/خطأ» لأن الحالتين تصفان عملية جارية على عنصر كان مفعّلا،
 * أما السحب فيبقى ظاهرا حتى لو كان العنصر محددا أو مضغوطا.
 */
export function interactionStateOf(input: InteractionInput): InteractionState {
  if (input.error) return 'error';
  if (input.saving) return 'saving';
  if (input.disabled) return 'disabled';
  if (input.dragging) return 'dragging';
  if (input.pressed) return 'pressed';
  if (input.selected) return 'selected';
  if (input.focused) return 'focus';
  if (input.hovered) return 'hover';
  return 'normal';
}

/** هل يمكن بدء إيماءة تحرير على العنصر في هذه الحالة؟ */
export function isInteractiveState(state: InteractionState): boolean {
  return state !== 'disabled' && state !== 'saving' && state !== 'error';
}

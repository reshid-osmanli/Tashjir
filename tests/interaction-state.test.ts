// حالات التفاعل التسع (المرحلة الأولى): A1448 وصفوف ترتيب الأسطر
import { describe, expect, it } from 'vitest';
import { interactionStateOf, isInteractiveState, type InteractionState } from '@/lib/editor/interaction-state';

describe('interactionStateOf — الحالة الظاهرة الواحدة', () => {
  it('عادي بلا أي راية', () => {
    expect(interactionStateOf({})).toBe('normal');
  });

  it('كل حالة تظهر وحدها', () => {
    const cases: Array<[Parameters<typeof interactionStateOf>[0], InteractionState]> = [
      [{ hovered: true }, 'hover'],
      [{ focused: true }, 'focus'],
      [{ selected: true }, 'selected'],
      [{ pressed: true }, 'pressed'],
      [{ dragging: true }, 'dragging'],
      [{ disabled: true }, 'disabled'],
      [{ saving: true }, 'saving'],
      [{ error: true }, 'error'],
    ];
    for (const [input, expected] of cases) expect(interactionStateOf(input)).toBe(expected);
  });

  it('الأولوية: خطأ ← حفظ ← معطّل ← سحب ← مضغوط ← محدد ← تركيز ← تمرير', () => {
    const all = { hovered: true, focused: true, selected: true, pressed: true, dragging: true, disabled: true, saving: true, error: true };
    expect(interactionStateOf(all)).toBe('error');
    expect(interactionStateOf({ ...all, error: false })).toBe('saving');
    expect(interactionStateOf({ ...all, error: false, saving: false })).toBe('disabled');
    expect(interactionStateOf({ ...all, error: false, saving: false, disabled: false })).toBe('dragging');
    expect(interactionStateOf({ pressed: true, selected: true, hovered: true })).toBe('pressed');
    expect(interactionStateOf({ selected: true, focused: true, hovered: true })).toBe('selected');
    expect(interactionStateOf({ focused: true, hovered: true })).toBe('focus');
    expect(interactionStateOf({ hovered: true })).toBe('hover');
  });

  it('الحالات الحاجبة تمنع بدء إيماءة، وبقيتها تقبلها', () => {
    expect(['disabled', 'saving', 'error'].every((state) => !isInteractiveState(state as InteractionState))).toBe(true);
    expect(['normal', 'hover', 'focus', 'selected', 'pressed', 'dragging'].every((state) => isInteractiveState(state as InteractionState))).toBe(true);
  });
});

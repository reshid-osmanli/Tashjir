/**
 * Pure geometry and classification helpers for UIRegistryInspector.
 *
 * They never touch the DOM, so the placement and hover-bridging rules can be
 * unit-tested directly. The Inspector only measures the element under the
 * pointer and the pinned element; nothing here enumerates the whole page.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Visual treatment of the pinned selection, chosen by element type so the red
 * marker never hides the content it identifies:
 * - fill: buttons and other activatable controls (a translucent red wash)
 * - field: text inputs, textareas and selects (a red ring only, text stays readable)
 * - tab: tabs (a red wash plus a thick bottom bar)
 * - container: panels, dialogs, lists and other regions (a dashed red outline)
 */
export type HighlightTone = 'fill' | 'field' | 'tab' | 'container';

/** Space between a target and its badge. The hover bridge covers exactly this gap. */
export const BADGE_GAP = 4;
/** Badges stay this far from the viewport edge. */
export const EDGE_MARGIN = 4;
/** Pointer tolerance around the current target while crossing into its badge. */
export const HOVER_BRIDGE = 6;

const BUTTON_INPUT_TYPES = new Set(['button', 'submit', 'reset', 'image', 'checkbox', 'radio', 'color', 'range']);
const FILL_ROLES = new Set(['button', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'checkbox', 'radio', 'switch']);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Chooses a badge position that stays outside the target when possible:
 * above it, then below it, and only as a last resort at its top edge.
 * The horizontal position is clamped so the badge never leaves the viewport.
 */
export function placeBadge(target: Box, badge: Size, viewport: Size): { left: number; top: number } {
  const left = clamp(target.left, EDGE_MARGIN, viewport.width - badge.width - EDGE_MARGIN);

  const above = target.top - badge.height - BADGE_GAP;
  if (above >= EDGE_MARGIN) return { left, top: above };

  const below = target.top + target.height + BADGE_GAP;
  if (below + badge.height <= viewport.height - EDGE_MARGIN) return { left, top: below };

  return {
    left,
    top: clamp(target.top + 2, EDGE_MARGIN, viewport.height - badge.height - EDGE_MARGIN),
  };
}

/** True when a point lies inside the target expanded by `reach` pixels on every side. */
export function isInsideBridge(target: Box, x: number, y: number, reach: number = HOVER_BRIDGE): boolean {
  return (
    x >= target.left - reach &&
    x <= target.left + target.width + reach &&
    y >= target.top - reach &&
    y <= target.top + target.height + reach
  );
}

export function highlightToneFor(input: { tag: string; role: string | null; type: string | null }): HighlightTone {
  const tag = input.tag.toLowerCase();
  const role = (input.role ?? '').toLowerCase();
  if (role === 'tab') return 'tab';
  if (tag === 'textarea' || tag === 'select') return 'field';
  if (tag === 'input') {
    return BUTTON_INPUT_TYPES.has((input.type ?? 'text').toLowerCase()) ? 'fill' : 'field';
  }
  if (tag === 'button' || tag === 'a' || FILL_ROLES.has(role)) return 'fill';
  return 'container';
}

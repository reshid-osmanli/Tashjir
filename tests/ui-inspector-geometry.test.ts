import { describe, expect, it } from 'vitest';
import {
  BADGE_GAP,
  EDGE_MARGIN,
  HOVER_BRIDGE,
  highlightToneFor,
  isInsideBridge,
  placeBadge,
} from '../src/components/dev/inspector-geometry';

const viewport = { width: 1000, height: 700 };
const badge = { width: 60, height: 18 };

describe('UI ID Inspector badge placement', () => {
  it('places the badge above the target when there is room, outside the target box', () => {
    const target = { left: 200, top: 300, width: 80, height: 30 };
    const position = placeBadge(target, badge, viewport);
    expect(position).toEqual({ left: 200, top: 300 - 18 - BADGE_GAP });
    // The badge never overlaps the element it identifies.
    expect(position.top + badge.height).toBeLessThanOrEqual(target.top);
  });

  it('falls back below the target when the target is too close to the top edge', () => {
    const target = { left: 200, top: 10, width: 80, height: 30 };
    const position = placeBadge(target, badge, viewport);
    expect(position.top).toBe(10 + 30 + BADGE_GAP);
  });

  it('falls back inside the top edge only when neither outside position fits', () => {
    const target = { left: 200, top: 5, width: 80, height: 690 };
    const position = placeBadge(target, badge, viewport);
    expect(position.top).toBe(5 + 2);
  });

  it('keeps the badge inside the viewport horizontally near the right and left edges', () => {
    const right = placeBadge({ left: 990, top: 300, width: 40, height: 20 }, badge, viewport);
    expect(right.left).toBe(viewport.width - badge.width - EDGE_MARGIN);
    const left = placeBadge({ left: -30, top: 300, width: 40, height: 20 }, badge, viewport);
    expect(left.left).toBe(EDGE_MARGIN);
  });
});

describe('UI ID Inspector hover bridge', () => {
  const target = { left: 100, top: 100, width: 80, height: 30 };

  it('treats the gap between a target and its badge as part of the target', () => {
    // Badge sits above the target: the gap is the BADGE_GAP strip above the target top.
    expect(isInsideBridge(target, 120, 100 - BADGE_GAP)).toBe(true);
    expect(isInsideBridge(target, 120, 100 - HOVER_BRIDGE)).toBe(true);
  });

  it('does not extend beyond the bridge distance', () => {
    expect(isInsideBridge(target, 120, 100 - HOVER_BRIDGE - 1)).toBe(false);
    expect(isInsideBridge(target, 100 - HOVER_BRIDGE - 1, 120)).toBe(false);
  });
});

describe('UI ID Inspector highlight classification', () => {
  it('uses a fill for buttons and activatable controls', () => {
    expect(highlightToneFor({ tag: 'BUTTON', role: null, type: null })).toBe('fill');
    expect(highlightToneFor({ tag: 'INPUT', role: null, type: 'checkbox' })).toBe('fill');
    expect(highlightToneFor({ tag: 'DIV', role: 'menuitem', type: null })).toBe('fill');
  });

  it('uses a ring for text fields so typed content stays readable', () => {
    expect(highlightToneFor({ tag: 'INPUT', role: null, type: 'search' })).toBe('field');
    expect(highlightToneFor({ tag: 'INPUT', role: null, type: null })).toBe('field');
    expect(highlightToneFor({ tag: 'TEXTAREA', role: null, type: null })).toBe('field');
    expect(highlightToneFor({ tag: 'SELECT', role: null, type: null })).toBe('field');
  });

  it('uses a bottom bar for tabs and a dashed outline for panels and regions', () => {
    expect(highlightToneFor({ tag: 'BUTTON', role: 'tab', type: null })).toBe('tab');
    expect(highlightToneFor({ tag: 'ASIDE', role: null, type: null })).toBe('container');
    expect(highlightToneFor({ tag: 'DIV', role: 'dialog', type: null })).toBe('container');
  });
});

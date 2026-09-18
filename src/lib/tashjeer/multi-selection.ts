/**
 * One range/toggle algorithm, independent of virtualized DOM rows.
 *
 * FR-ED-07: the same multi-selection contract serves every element list —
 * faces, differences, lines, rules and rule occurrences — so Ctrl/Shift/Ctrl+A
 * behave identically everywhere and bulk actions read one shape.
 * `ownerId` scopes the selection to its parent (faces → difference,
 * occurrences → rule).
 */
export interface MultiSelection {
  kind: 'DIFFERENCE' | 'FACE' | 'LINE' | 'RULE' | 'OCCURRENCE';
  ownerId?: string;
  ids: string[];
  anchor?: string;
}
export function selectRange(current: MultiSelection, id: string, visible: string[], modifiers: { shift?: boolean; toggle?: boolean }): MultiSelection {
  const valid = current.ids.filter((item) => visible.includes(item));
  if (!visible.includes(id)) return { ...current, ids: valid };
  const start = current.anchor ? visible.indexOf(current.anchor) : -1;
  if (modifiers.shift && start >= 0) {
    const end = visible.indexOf(id);
    const range = visible.slice(Math.min(start, end), Math.max(start, end) + 1);
    return { ...current, ids: modifiers.toggle ? [...new Set([...valid, ...range])] : range };
  }
  return { ...current, anchor: id, ids: modifiers.toggle ? valid.includes(id) ? valid.filter((item) => item !== id) : [...valid, id] : [id] };
}

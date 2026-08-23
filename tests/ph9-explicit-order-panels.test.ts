// اختبارات PH9 - Explicit Order + Panel Auto-Hide
// FR-ED-12, FR-ED-14

import { describe, it, expect } from 'vitest';
import {
  sortByDisplayOrder,
  getNextDisplayOrder,
  moveItemToPosition,
  swapItems,
  renumberItems,
  isValidOrder,
  findDuplicateOrders,
  suggestDefaultOrder,
} from '@/lib/tashjeer/explicit-order';
import {
  isPanelVisible,
  isPanelAutoHide,
  isPanelPinned,
  togglePanel,
  togglePinPanel,
  setPanelState,
  findPanelConfig,
  updatePanelConfig,
  toggleFocusMode,
  hideAllPanels,
  showAllPanels,
  shouldShowAutoHidePanel,
  getPanelOverlayStyle,
  parsePanelShortcut,
  DEFAULT_PANELS_CONFIG,
} from '@/lib/tashjeer/panel-autohide';

describe('PH9 - Explicit Display Order (FR-ED-14)', () => {
  describe('sortByDisplayOrder', () => {
    it('sorts items by displayOrder', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 3 },
        { id: 'b', name: 'B', displayOrder: 1 },
        { id: 'c', name: 'C', displayOrder: 2 },
      ];

      const sorted = sortByDisplayOrder(items);

      expect(sorted[0].id).toBe('b');
      expect(sorted[1].id).toBe('c');
      expect(sorted[2].id).toBe('a');
    });

    it('does not mutate original array', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 2 },
        { id: 'b', name: 'B', displayOrder: 1 },
      ];

      const sorted = sortByDisplayOrder(items);

      expect(items[0].id).toBe('a');
      expect(sorted[0].id).toBe('b');
    });
  });

  describe('getNextDisplayOrder', () => {
    it('returns 1 for empty list', () => {
      expect(getNextDisplayOrder([])).toBe(1);
    });

    it('returns max + 1', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 5 },
        { id: 'c', name: 'C', displayOrder: 3 },
      ];

      expect(getNextDisplayOrder(items)).toBe(6);
    });
  });

  describe('moveItemToPosition', () => {
    it('moves item to target position', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 2 },
        { id: 'c', name: 'C', displayOrder: 3 },
      ];

      const result = moveItemToPosition(items, 'a', 2);

      expect(result.items[2].id).toBe('a');
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('returns empty changes if item not found', () => {
      const items = [{ id: 'a', name: 'A', displayOrder: 1 }];

      const result = moveItemToPosition(items, 'x', 0);

      expect(result.changes.length).toBe(0);
    });

    it('returns empty changes if target is current position', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 2 },
      ];

      const result = moveItemToPosition(items, 'a', 0);

      expect(result.changes.length).toBe(0);
    });
  });

  describe('swapItems', () => {
    it('swaps two items', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 2 },
      ];

      const result = swapItems(items, 'a', 'b');

      expect(result.items[0].id).toBe('b');
      expect(result.items[1].id).toBe('a');
      expect(result.changes.length).toBe(2);
    });

    it('returns empty changes if item not found', () => {
      const items = [{ id: 'a', name: 'A', displayOrder: 1 }];

      const result = swapItems(items, 'a', 'x');

      expect(result.changes.length).toBe(0);
    });
  });

  describe('renumberItems', () => {
    it('renumbers items sequentially', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 5 },
        { id: 'b', name: 'B', displayOrder: 10 },
        { id: 'c', name: 'C', displayOrder: 15 },
      ];

      const result = renumberItems(items);

      expect(result.items[0].displayOrder).toBe(1);
      expect(result.items[1].displayOrder).toBe(2);
      expect(result.items[2].displayOrder).toBe(3);
    });

    it('tracks all changes', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 5 },
        { id: 'b', name: 'B', displayOrder: 10 },
      ];

      const result = renumberItems(items);

      expect(result.changes.length).toBe(2);
      expect(result.changes[0].oldOrder).toBe(5);
      expect(result.changes[0].newOrder).toBe(1);
    });
  });

  describe('isValidOrder', () => {
    it('returns true for valid sequential order', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 2 },
        { id: 'c', name: 'C', displayOrder: 3 },
      ];

      expect(isValidOrder(items)).toBe(true);
    });

    it('returns false for gaps', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 3 },
      ];

      expect(isValidOrder(items)).toBe(false);
    });

    it('returns false for duplicates', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 1 },
      ];

      expect(isValidOrder(items)).toBe(false);
    });
  });

  describe('findDuplicateOrders', () => {
    it('finds duplicate orders', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 2 },
        { id: 'c', name: 'C', displayOrder: 2 },
        { id: 'd', name: 'D', displayOrder: 3 },
      ];

      const duplicates = findDuplicateOrders(items);

      expect(duplicates).toContain(2);
      expect(duplicates).not.toContain(1);
      expect(duplicates).not.toContain(3);
    });

    it('returns empty array if no duplicates', () => {
      const items = [
        { id: 'a', name: 'A', displayOrder: 1 },
        { id: 'b', name: 'B', displayOrder: 2 },
      ];

      expect(findDuplicateOrders(items)).toEqual([]);
    });
  });

  describe('suggestDefaultOrder', () => {
    it('suggests sequential order', () => {
      const items = [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ];

      const result = suggestDefaultOrder(items);

      expect(result[0].displayOrder).toBe(1);
      expect(result[1].displayOrder).toBe(2);
      expect(result[2].displayOrder).toBe(3);
    });

    it('sorts alphabetically when requested', () => {
      const items = [
        { id: 'c', name: 'ج' },
        { id: 'a', name: 'أ' },
        { id: 'b', name: 'ب' },
      ];

      const result = suggestDefaultOrder(items, 'ALPHABETICAL');

      expect(result[0].id).toBe('a');
      expect(result[1].id).toBe('b');
      expect(result[2].id).toBe('c');
    });
  });
});

describe('PH9 - Panel Auto-Hide (FR-ED-12)', () => {
  describe('Panel State Checks', () => {
    it('isPanelVisible returns true for VISIBLE', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'VISIBLE' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      expect(isPanelVisible(config)).toBe(true);
    });

    it('isPanelVisible returns true for PINNED', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'PINNED' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      expect(isPanelVisible(config)).toBe(true);
    });

    it('isPanelAutoHide returns true for AUTO_HIDE', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'AUTO_HIDE' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      expect(isPanelAutoHide(config)).toBe(true);
    });

    it('isPanelPinned returns true for PINNED', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'PINNED' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      expect(isPanelPinned(config)).toBe(true);
    });
  });

  describe('Panel State Transitions', () => {
    it('togglePanel toggles between VISIBLE and HIDDEN', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'VISIBLE' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      const toggled = togglePanel(config);
      expect(toggled.state).toBe('HIDDEN');

      const toggledAgain = togglePanel(toggled);
      expect(toggledAgain.state).toBe('VISIBLE');
    });

    it('togglePinPanel toggles between PINNED and AUTO_HIDE', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'AUTO_HIDE' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      const pinned = togglePinPanel(config);
      expect(pinned.state).toBe('PINNED');

      const unpinned = togglePinPanel(pinned);
      expect(unpinned.state).toBe('AUTO_HIDE');
    });

    it('setPanelState sets specific state', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'VISIBLE' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      const updated = setPanelState(config, 'HIDDEN');
      expect(updated.state).toBe('HIDDEN');
    });
  });

  describe('Panel Config Management', () => {
    it('findPanelConfig finds panel by ID', () => {
      const config = DEFAULT_PANELS_CONFIG;

      const panel = findPanelConfig(config, 'toolbar');

      expect(panel?.id).toBe('toolbar');
    });

    it('findPanelConfig returns undefined for unknown ID', () => {
      const config = DEFAULT_PANELS_CONFIG;

      const panel = findPanelConfig(config, 'unknown');

      expect(panel).toBeUndefined();
    });

    it('updatePanelConfig updates panel', () => {
      const config = DEFAULT_PANELS_CONFIG;

      const updated = updatePanelConfig(config, 'toolbar', { state: 'HIDDEN' });

      const panel = findPanelConfig(updated, 'toolbar');
      expect(panel?.state).toBe('HIDDEN');
    });
  });

  describe('Focus Mode', () => {
    it('toggleFocusMode toggles focus mode', () => {
      const config = DEFAULT_PANELS_CONFIG;

      const toggled = toggleFocusMode(config);
      expect(toggled.focusMode).toBe(!config.focusMode);
    });

    it('hideAllPanels hides all non-pinned panels', () => {
      const config = {
        focusMode: false,
        panels: [
          {
            id: 'a',
            label: 'A',
            position: 'RIGHT' as const,
            state: 'VISIBLE' as const,
            activationDistance: 30,
            hideDelay: 500,
          },
          {
            id: 'b',
            label: 'B',
            position: 'LEFT' as const,
            state: 'PINNED' as const,
            activationDistance: 30,
            hideDelay: 500,
          },
        ],
      };

      const hidden = hideAllPanels(config);

      expect(hidden.panels[0].state).toBe('HIDDEN');
      expect(hidden.panels[1].state).toBe('PINNED'); // Pinned stays pinned
    });

    it('showAllPanels shows all hidden panels', () => {
      const config = {
        focusMode: false,
        panels: [
          {
            id: 'a',
            label: 'A',
            position: 'RIGHT' as const,
            state: 'HIDDEN' as const,
            activationDistance: 30,
            hideDelay: 500,
          },
        ],
      };

      const shown = showAllPanels(config);

      expect(shown.panels[0].state).toBe('VISIBLE');
    });
  });

  describe('Auto-Hide Behavior', () => {
    it('shouldShowAutoHidePanel returns true when mouse near edge', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'AUTO_HIDE' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      const result = shouldShowAutoHidePanel(
        config,
        { x: 1990, y: 500 },
        { width: 2000, height: 1000 }
      );

      expect(result).toBe(true);
    });

    it('shouldShowAutoHidePanel returns false when mouse far from edge', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'AUTO_HIDE' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      const result = shouldShowAutoHidePanel(
        config,
        { x: 1000, y: 500 },
        { width: 2000, height: 1000 }
      );

      expect(result).toBe(false);
    });

    it('shouldShowAutoHidePanel returns false for non-AUTO_HIDE panels', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'VISIBLE' as const,
        activationDistance: 30,
        hideDelay: 500,
      };

      const result = shouldShowAutoHidePanel(
        config,
        { x: 1990, y: 500 },
        { width: 2000, height: 1000 }
      );

      expect(result).toBe(false);
    });
  });

  describe('Panel Overlay Style', () => {
    it('generates correct style for RIGHT panel', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'RIGHT' as const,
        state: 'VISIBLE' as const,
        width: 320,
        activationDistance: 30,
        hideDelay: 500,
      };

      const style = getPanelOverlayStyle(config);

      expect(style.position).toBe('fixed');
      expect(style.right).toBe(0);
      expect(style.width).toBe(320);
    });

    it('generates correct style for TOP panel', () => {
      const config = {
        id: 'test',
        label: 'Test',
        position: 'TOP' as const,
        state: 'VISIBLE' as const,
        height: 60,
        activationDistance: 30,
        hideDelay: 500,
      };

      const style = getPanelOverlayStyle(config);

      expect(style.top).toBe(0);
      expect(style.height).toBe(60);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('parsePanelShortcut parses valid shortcut', () => {
      const panelId = parsePanelShortcut('T', true, true);

      expect(panelId).toBe('toolbar');
    });

    it('parsePanelShortcut returns null for invalid shortcut', () => {
      const panelId = parsePanelShortcut('X', true, true);

      expect(panelId).toBeNull();
    });

    it('parsePanelShortcut returns null without Ctrl+Shift', () => {
      const panelId = parsePanelShortcut('T', false, true);

      expect(panelId).toBeNull();
    });
  });
});

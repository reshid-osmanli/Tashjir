// اختبارات مخزن التحديد الموحد - Unified Selection Store
// FR-ED-02: نظام التحديد الموحد

import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore, buildBreadcrumb } from '@/stores/selection-store';

describe('Unified Selection Store', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      current: null,
      multiSelection: [],
      breadcrumb: [],
      source: null,
    });
  });

  describe('Single Selection', () => {
    it('يحدد عنصرا واحدا', () => {
      useSelectionStore.getState().select({ kind: 'DIFFERENCE', id: 'diff-1' });
      const state = useSelectionStore.getState();
      expect(state.current?.id).toBe('diff-1');
      expect(state.current?.kind).toBe('DIFFERENCE');
      expect(state.multiSelection.length).toBe(0);
    });

    it('يمسح التحديد المتعدد عند تحديد عنصر جديد', () => {
      const store = useSelectionStore.getState();
      store.addToSelection({ kind: 'FACE', id: 'face-1' });
      store.addToSelection({ kind: 'FACE', id: 'face-2' });
      store.select({ kind: 'DIFFERENCE', id: 'diff-1' });
      const state = useSelectionStore.getState();
      expect(state.current?.id).toBe('diff-1');
      expect(state.multiSelection.length).toBe(0);
    });

    it('يلغي التحديد بتمرير null', () => {
      useSelectionStore.getState().select({ kind: 'DIFFERENCE', id: 'diff-1' });
      useSelectionStore.getState().select(null);
      expect(useSelectionStore.getState().current).toBeNull();
    });

    it('يحفظ مصدر التحديد', () => {
      useSelectionStore.getState().select({ kind: 'LINE', id: 'line-1' }, 'canvas');
      expect(useSelectionStore.getState().source).toBe('canvas');
    });
  });

  describe('Multi Selection', () => {
    it('يضيف عناصر إلى التحديد المتعدد', () => {
      const store = useSelectionStore.getState();
      store.addToSelection({ kind: 'FACE', id: 'face-1' });
      store.addToSelection({ kind: 'FACE', id: 'face-2' });
      const state = useSelectionStore.getState();
      expect(state.multiSelection.length).toBe(2);
      expect(state.multiSelection[0].id).toBe('face-1');
      expect(state.multiSelection[1].id).toBe('face-2');
    });

    it('يزيل عنصرا عند إضافته مرة أخرى (toggle)', () => {
      const store = useSelectionStore.getState();
      store.addToSelection({ kind: 'FACE', id: 'face-1' });
      store.addToSelection({ kind: 'FACE', id: 'face-1' }); // إزالة
      expect(useSelectionStore.getState().multiSelection.length).toBe(0);
    });

    it('يختار مدى من العناصر (Shift+نقر)', () => {
      const allItems = [
        { kind: 'FACE' as const, id: 'face-1' },
        { kind: 'FACE' as const, id: 'face-2' },
        { kind: 'FACE' as const, id: 'face-3' },
        { kind: 'FACE' as const, id: 'face-4' },
        { kind: 'FACE' as const, id: 'face-5' },
      ];
      useSelectionStore.getState().selectRange(allItems[1], allItems[3], allItems);
      const state = useSelectionStore.getState();
      expect(state.multiSelection.length).toBe(3);
      expect(state.multiSelection.map((i) => i.id)).toEqual(['face-2', 'face-3', 'face-4']);
    });

    it('يختار الكل', () => {
      const items = [
        { kind: 'FACE' as const, id: 'face-1' },
        { kind: 'FACE' as const, id: 'face-2' },
      ];
      useSelectionStore.getState().selectAll(items);
      const state = useSelectionStore.getState();
      expect(state.multiSelection.length).toBe(2);
      expect(state.current?.id).toBe('face-2'); // آخر عنصر
    });

    it('يمسح التحديد المتعدد', () => {
      const store = useSelectionStore.getState();
      store.addToSelection({ kind: 'FACE', id: 'face-1' });
      store.clearMultiSelection();
      expect(useSelectionStore.getState().multiSelection.length).toBe(0);
    });
  });

  describe('Selection Queries', () => {
    it('يتحقق من التحديد الفردي', () => {
      useSelectionStore.getState().select({ kind: 'LINE', id: 'line-1' });
      expect(useSelectionStore.getState().isSelected('line-1')).toBe(true);
      expect(useSelectionStore.getState().isSelected('line-2')).toBe(false);
    });

    it('يتحقق من التحديد المتعدد', () => {
      const store = useSelectionStore.getState();
      store.addToSelection({ kind: 'FACE', id: 'face-1' });
      store.addToSelection({ kind: 'FACE', id: 'face-2' });
      const state = useSelectionStore.getState();
      expect(state.isMultiSelected('face-1')).toBe(true);
      expect(state.isMultiSelected('face-2')).toBe(true);
      expect(state.isMultiSelected('face-3')).toBe(false);
    });

    it('isSelected يشمل التحديد المتعدد', () => {
      useSelectionStore.getState().addToSelection({ kind: 'FACE', id: 'face-1' });
      expect(useSelectionStore.getState().isSelected('face-1')).toBe(true);
    });
  });

  describe('Breadcrumb', () => {
    it('يبني سلسلة سياق من تحديد', () => {
      const breadcrumb = buildBreadcrumb(
        { kind: 'FACE', id: 'face-1', differenceId: 'diff-1', lineId: 'line-1' },
        {
          'line-1': 'سطر 25',
          'diff-1': 'مد',
          'face-1': 'بالألف',
        }
      );
      expect(breadcrumb.length).toBe(3);
      expect(breadcrumb[0].label).toBe('سطر 25');
      expect(breadcrumb[1].label).toBe('مد');
      expect(breadcrumb[2].label).toBe('بالألف');
    });

    it('يعرض سلسلة السياق في المخزن', () => {
      useSelectionStore.getState().setBreadcrumb([
        { kind: 'LINE', id: 'line-1', label: 'سطر 25' },
        { kind: 'DIFFERENCE', id: 'diff-1', label: 'مد' },
      ]);
      expect(useSelectionStore.getState().breadcrumb.length).toBe(2);
    });
  });
});

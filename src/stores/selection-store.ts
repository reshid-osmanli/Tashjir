// مخزن التحديد الموحد - Unified Selection Store
// FR-ED-02: لا تملك أي لوحة نظام تحديد مستقلا
//
// حالة «العنصر المحدد الآن» مصدر حقيقة واحد تقرأه وتكتبه كل الواجهات:
//   Face Panel ↔ Line Panel ↔ Differences List ↔ Tracking ↔ Canvas ↔ Studio
//
// أنواع التحديد: كلمة، حرف، موضع، سطر، جزء سطر، اختلاف، وجه، قاعدة،
// وجه مركب، علامة وقف.

import { create } from 'zustand';

// ==================== أنواع التحديد ====================

export type SelectionKind =
  | 'WORD'
  | 'CHARACTER'
  | 'LOCUS'
  | 'LINE'
  | 'SEGMENT'
  | 'DIFFERENCE'
  | 'FACE'
  | 'RULE'
  | 'COMPOSITE_FACE'
  | 'WAQF_MARK';

export interface SelectionTarget {
  kind: SelectionKind;
  id: string;
  /** معرّف الاختلاف الأب إن وُجد (للتتبع الهرمي). */
  differenceId?: string;
  /** معرّف الوجه الأب إن وُجد. */
  faceId?: string;
  /** معرّف السطر الأب إن وُجد. */
  lineId?: string;
  /** موضع الكلمة في الآية (للتمرير في اللوحة). */
  position?: number;
}

/** عنصر في سلسلة السياق (Breadcrumb). */
export interface BreadcrumbItem {
  kind: SelectionKind;
  id: string;
  label: string;
}

// ==================== واجهة المخزن ====================

interface SelectionState {
  /** التحديد الحالي (null = لا شيء محدد). */
  current: SelectionTarget | null;

  /** التحديدات المتعددة (لـ Ctrl+نقر وShift+نقر). */
  multiSelection: SelectionTarget[];

  /** سلسلة السياق (Breadcrumb): من الأعم إلى الأخص. */
  breadcrumb: BreadcrumbItem[];

  /** المصدر الذي أصدر التحديد الأخير (لمنع الحلقات). */
  source: string | null;

  // ---------- إجراءات ----------

  /** تحديد عنصر واحد (يمسح التحديد المتعدد). */
  select: (target: SelectionTarget | null, source?: string) => void;

  /** إضافة عنصر إلى التحديد المتعدد. */
  addToSelection: (target: SelectionTarget) => void;

  /** إزالة عنصر من التحديد المتعدد. */
  removeFromSelection: (id: string) => void;

  /** تحديد مدى من العناصر (Shift+نقر). */
  selectRange: (from: SelectionTarget, to: SelectionTarget, allItems: SelectionTarget[]) => void;

  /** تحديد الكل. */
  selectAll: (items: SelectionTarget[]) => void;

  /** مسح التحديد المتعدد. */
  clearMultiSelection: () => void;

  /** تعيين سلسلة السياق. */
  setBreadcrumb: (items: BreadcrumbItem[]) => void;

  /** هل العنصر محدد (فرديا أو ضمن متعدد)؟ */
  isSelected: (id: string) => boolean;

  /** هل العنصر ضمن التحديد المتعدد؟ */
  isMultiSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  current: null,
  multiSelection: [],
  breadcrumb: [],
  source: null,

  select: (target, source) => {
    set({
      current: target,
      multiSelection: [],
      source: source ?? null,
    });
  },

  addToSelection: (target) => {
    set((state) => {
      const exists = state.multiSelection.some((item) => item.id === target.id);
      return {
        multiSelection: exists
          ? state.multiSelection.filter((item) => item.id !== target.id)
          : [...state.multiSelection, target],
      };
    });
  },

  removeFromSelection: (id) => {
    set((state) => ({
      multiSelection: state.multiSelection.filter((item) => item.id !== id),
    }));
  },

  selectRange: (from, to, allItems) => {
    const fromIndex = allItems.findIndex((item) => item.id === from.id);
    const toIndex = allItems.findIndex((item) => item.id === to.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const range = allItems.slice(start, end + 1);
    set({ multiSelection: range, current: to });
  },

  selectAll: (items) => {
    set({ multiSelection: items, current: items[items.length - 1] ?? null });
  },

  clearMultiSelection: () => set({ multiSelection: [] }),

  setBreadcrumb: (items) => set({ breadcrumb: items }),

  isSelected: (id) => {
    const state = get();
    return state.current?.id === id || state.multiSelection.some((item) => item.id === id);
  },

  isMultiSelected: (id) => {
    return get().multiSelection.some((item) => item.id === id);
  },
}));

// ==================== أدوات مساعدة ====================

/**
 * يبني سلسلة سياق من التحديد الحالي.
 * مثال: الآية 2:4 ← Line 25 ← Segment X ← Difference Y ← Variant Z
 */
export function buildBreadcrumb(
  target: SelectionTarget,
  labels: Record<string, string>
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];

  if (target.lineId) {
    items.push({
      kind: 'LINE',
      id: target.lineId,
      label: labels[target.lineId] ?? `سطر ${target.lineId}`,
    });
  }
  if (target.differenceId) {
    items.push({
      kind: 'DIFFERENCE',
      id: target.differenceId,
      label: labels[target.differenceId] ?? `اختلاف ${target.differenceId}`,
    });
  }
  if (target.faceId) {
    items.push({
      kind: 'FACE',
      id: target.faceId,
      label: labels[target.faceId] ?? `وجه ${target.faceId}`,
    });
  }
  items.push({
    kind: target.kind,
    id: target.id,
    label: labels[target.id] ?? target.id,
  });

  return items;
}

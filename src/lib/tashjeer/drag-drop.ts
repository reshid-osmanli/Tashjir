// أدوات السحب والإفلات - Drag & Drop Utilities
// FR-ED-04: إعادة ترتيب الأسطر بالسحب والإفلات
// FR-ED-05: الدمج بالسحب
//
// يوفر:
//   - منطق حساب مؤشر الإدراج (insertion indicator)
//   - منطق تأكيد النقل (confirmation dialog data)
//   - منطق حساب الرتب المتأثرة
//   - منطق فحص الدمج المسموح

import { moveLineToIndex } from './manual-links';

// ==================== أنواع بيانات السحب ====================

export interface DragLinePayload {
  type: 'LINE_REORDER' | 'LINE_MERGE';
  lineId: string;
  lineLabel: string;
  originalIndex: number;
}

export interface DropTarget {
  /** معرّف السطر المستهدف. */
  targetLineId: string;
  /** موضع الإدراج: قبل أو بعد الهدف. */
  position: 'BEFORE' | 'AFTER' | 'ON_TOP';
  /** فهرس الهدف في القائمة. */
  targetIndex: number;
}

export interface ReorderConfirmation {
  /** وصف العملية للمستخدم. */
  description: string;
  /** عدد العناصر المتأثرة (السطر + المُزاحون). */
  affectedCount: number;
  /** الترتيب الجديد المقترح. */
  newOrder: string[];
}

export interface MergeConfirmation {
  /** وصف العملية للمستخدم. */
  description: string;
  /** العناصر المندمجة. */
  sourceLineId: string;
  targetLineId: string;
  /** ملخص ما سيحدث. */
  summary: {
    mergedDifferences: number;
    mergedFaces: number;
  };
}

// ==================== حساب مؤشر الإدراج ====================

/**
 * يحسب موضع الإدراج من إحداثيات المؤشر بالنسبة للعنصر المستهدف.
 * الثلث العلوي = قبل، الثلث السفلي = بعد، الوسط = فوقه (للدمج).
 */
export function calculateDropPosition(
  mouseY: number,
  elementRect: DOMRect,
  allowMerge: boolean
): DropTarget['position'] {
  const relativeY = mouseY - elementRect.top;
  const ratio = relativeY / elementRect.height;

  if (allowMerge && ratio > 0.3 && ratio < 0.7) {
    return 'ON_TOP';
  }
  return ratio < 0.5 ? 'BEFORE' : 'AFTER';
}

// ==================== منطق إعادة الترتيب ====================

/**
 * يحسب الترتيب الجديد بعد نقل سطر إلى موضع جديد.
 * يُرجع بيانات التأكيد اللازمة قبل التنفيذ.
 */
export function calculateReorder(
  currentOrder: string[],
  draggedLineId: string,
  targetLineId: string,
  position: 'BEFORE' | 'AFTER'
): ReorderConfirmation {
  const currentIndex = currentOrder.indexOf(draggedLineId);
  const targetIndex = currentOrder.indexOf(targetLineId);

  if (currentIndex === -1 || targetIndex === -1) {
    return {
      description: 'خطأ: العنصر غير موجود',
      affectedCount: 0,
      newOrder: currentOrder,
    };
  }

  // moveLineToIndex يستعمل ترقيمًا 1-based: الهدف هو الموضع النهائي (1 = أول).
  // عند إزالة العنصر المسحوب من القائمة، تنزاح المؤشرات إذا كان المسحوب قبل الهدف.
  const draggedBeforeTarget = currentIndex < targetIndex;
  let insertIndex: number;
  if (position === 'BEFORE') {
    insertIndex = draggedBeforeTarget ? targetIndex : targetIndex + 1;
  } else {
    insertIndex = draggedBeforeTarget ? targetIndex + 1 : targetIndex + 2;
  }
  const newOrder = moveLineToIndex(currentOrder, draggedLineId, insertIndex);

  // حساب عدد العناصر المتأثرة (المزاحة).
  const movedDistance = Math.abs(currentIndex - (insertIndex > currentIndex ? insertIndex - 1 : insertIndex));
  const affectedCount = movedDistance + 1;

  const draggedLabel = `السطر ${currentIndex + 1}`;
  const targetLabel = position === 'BEFORE'
    ? `قبل السطر ${targetIndex + 1}`
    : `بعد السطر ${targetIndex + 1}`;

  return {
    description: `نقل ${draggedLabel} إلى ${targetLabel}؟ (${affectedCount} عناصر متأثرة)`,
    affectedCount,
    newOrder,
  };
}

// ==================== منطق الدمج ====================

/**
 * يتحقق من إمكانية دمج سطرين.
 * يرجع سبب المنع إن لم يكن مسموحا.
 */
export function canMergeLines(
  sourceLineId: string,
  targetLineId: string,
  policy?: { allowMerge: boolean; reason?: string }
): { allowed: boolean; reason?: string } {
  if (sourceLineId === targetLineId) {
    return { allowed: false, reason: 'لا يمكن دمج سطر مع نفسه' };
  }

  if (policy && !policy.allowMerge) {
    return { allowed: false, reason: policy.reason ?? 'السياسة تمنع الدمج' };
  }

  return { allowed: true };
}

/**
 * يبني بيانات تأكيد الدمج.
 */
export function buildMergeConfirmation(
  sourceLineId: string,
  targetLineId: string,
  sourceLabel: string,
  targetLabel: string,
  sourceEntriesCount: number,
  targetEntriesCount: number
): MergeConfirmation {
  return {
    description: `دمج «${sourceLabel}» مع «${targetLabel}»؟`,
    sourceLineId,
    targetLineId,
    summary: {
      mergedDifferences: sourceEntriesCount,
      mergedFaces: sourceEntriesCount + targetEntriesCount,
    },
  };
}

// ==================== فصل الدمج (Unmerge) ====================

/**
 * يفك دمج سطرين: يزيل الرابط ويُعيد الأسطر إلى حالتها قبل الدمج.
 * يُرجع معرّف الرابط المحذوف لتسجيله في التراجع.
 */
export function findMergeLinkId(
  links: Array<{ id: string; from: { id: string }; to: { id: string }; relation: string }>,
  lineA: string,
  lineB: string
): string | null {
  const link = links.find(
    (l) =>
      l.relation === 'MERGE' &&
      ((l.from.id === lineA && l.to.id === lineB) ||
        (l.from.id === lineB && l.to.id === lineA))
  );
  return link?.id ?? null;
}

// ==================== React Hook ====================

/**
 * حالة السحب الحالية. يُستخدم في المكون لبناء واجهة السحب.
 */
export interface DragState {
  isDragging: boolean;
  draggedLineId: string | null;
  dropTarget: DropTarget | null;
  dragType: 'LINE_REORDER' | 'LINE_MERGE' | null;
}

export const initialDragState: DragState = {
  isDragging: false,
  draggedLineId: null,
  dropTarget: null,
  dragType: null,
};

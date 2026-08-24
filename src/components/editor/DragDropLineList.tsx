'use client';

// قائمة الأسطر مع السحب والإفلات - DragDropLineList
// FR-ED-04: إعادة ترتيب الأسطر بالسحب والإفلات
// FR-ED-05: الدمج بالسحب
// FR-ED-07: التحديد المتعدد والحذف الجماعي
//
// الميزات:
//   - سحب سطر لإعادة الترتيب مع مؤشر إدراج واضح
//   - سحب سطر فوق آخر للدمج
//   - حوار تأكيد قبل النقل والدمج
//   - تحديد متعدد (Ctrl+نقر، Shift+نقر)
//   - حذف جماعي بتأكيد كمي
//   - فك الدمج (Unmerge)
//   - اختصارات لوحة المفاتيح

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import {
  calculateDropPosition,
  calculateReorder,
  canMergeLines,
  buildMergeConfirmation,
  initialDragState,
  type DragState,
  type DropTarget,
} from '@/lib/tashjeer/drag-drop';
import {
  calculateBulkDeleteConfirmation,
  buildConfirmationMessage,
  type BulkDeleteTarget,
} from '@/lib/tashjeer/bulk-operations';

// ==================== أنواع ====================

export interface LineItem {
  id: string;
  label: string;
  ruleLabel: string;
  category: string;
  entriesCount: number;
  isMerged?: boolean;
  mergedFrom?: string[];
}

interface DragDropLineListProps {
  /** الأسطر بالترتيب الحالي. */
  lines: LineItem[];
  /** معرّفات الأسطر بالترتيب المحفوظ (لإعادة الترتيب). */
  lineOrder: string[];
  /** استدعاء عند تغيير الترتيب. */
  onReorder: (newOrder: string[]) => void;
  /** استدعاء عند دمج سطرين. */
  onMerge: (sourceId: string, targetId: string) => void;
  /** استدعاء عند فك الدمج. */
  onUnmerge?: (lineId: string) => void;
  /** استدعاء عند الحذف الجماعي. */
  onBulkDelete?: (ids: string[]) => void;
  /** استدعاء عند النقر على سطر. */
  onSelectLine?: (lineId: string) => void;
  /** معرّف السطر المحدد. */
  selectedLineId?: string | null;
  /** السماح بالدمج بالسحب. */
  allowMerge?: boolean;
}

export function DragDropLineList({
  lines,
  lineOrder,
  onReorder,
  onMerge,
  onUnmerge,
  onBulkDelete,
  onSelectLine,
  selectedLineId,
  allowMerge = true,
}: DragDropLineListProps) {
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'REORDER' | 'MERGE' | 'BULK_DELETE';
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ترتيب الأسطر حسب lineOrder.
  const orderedLines = useMemo(() => {
    const orderMap = new Map(lineOrder.map((id, i) => [id, i]));
    return [...lines].sort((a, b) => {
      const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
  }, [lines, lineOrder]);

  // ==================== Drag Handlers ====================

  const handleDragStart = useCallback(
    (e: React.DragEvent, lineId: string, index: number) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', lineId);
      setDragState({
        isDragging: true,
        draggedLineId: lineId,
        dropTarget: null,
        dragType: 'LINE_REORDER',
      });
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetLineId: string, targetIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!dragState.draggedLineId || dragState.draggedLineId === targetLineId) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const position = calculateDropPosition(e.clientY, rect, allowMerge);

      setDragState((prev) => ({
        ...prev,
        dropTarget: { targetLineId, position, targetIndex },
      }));
    },
    [dragState.draggedLineId, allowMerge]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetLineId: string) => {
      e.preventDefault();
      const draggedId = dragState.draggedLineId;
      if (!draggedId || draggedId === targetLineId) return;

      const dropTarget = dragState.dropTarget;
      if (!dropTarget) return;

      if (dropTarget.position === 'ON_TOP' && allowMerge) {
        // دمج.
        const sourceLine = lines.find((l) => l.id === draggedId);
        const targetLine = lines.find((l) => l.id === targetLineId);
        const mergeCheck = canMergeLines(draggedId, targetLineId);

        if (!mergeCheck.allowed) {
          alert(mergeCheck.reason);
          return;
        }

        const conf = buildMergeConfirmation(
          draggedId,
          targetLineId,
          sourceLine?.label ?? draggedId,
          targetLine?.label ?? targetLineId,
          sourceLine?.entriesCount ?? 0,
          targetLine?.entriesCount ?? 0
        );

        setConfirmDialog({
          type: 'MERGE',
          message: `${conf.description}\n\nسيُدمج ${conf.summary.mergedDifferences} عنصر في سطر واحد.`,
          onConfirm: () => {
            onMerge(draggedId, targetLineId);
            setConfirmDialog(null);
          },
        });
      } else {
        // إعادة ترتيب.
        const position = dropTarget.position as 'BEFORE' | 'AFTER';
        const result = calculateReorder(
          lineOrder,
          draggedId,
          targetLineId,
          position
        );

        setConfirmDialog({
          type: 'REORDER',
          message: result.description,
          onConfirm: () => {
            onReorder(result.newOrder);
            setConfirmDialog(null);
          },
        });
      }

      setDragState(initialDragState);
    },
    [dragState, lines, lineOrder, onReorder, onMerge, allowMerge]
  );

  const handleDragEnd = useCallback(() => {
    setDragState(initialDragState);
  }, []);

  // ==================== Selection Handlers ====================

  const handleLineClick = useCallback(
    (e: React.MouseEvent, lineId: string) => {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+نقر: إضافة/إزالة من التحديد المتعدد.
        setMultiSelected((prev) => {
          const next = new Set(prev);
          if (next.has(lineId)) {
            next.delete(lineId);
          } else {
            next.add(lineId);
          }
          return next;
        });
      } else if (e.shiftKey && selectedLineId) {
        // Shift+نقر: تحديد مدى.
        const currentIdx = orderedLines.findIndex((l) => l.id === selectedLineId);
        const clickedIdx = orderedLines.findIndex((l) => l.id === lineId);
        if (currentIdx !== -1 && clickedIdx !== -1) {
          const start = Math.min(currentIdx, clickedIdx);
          const end = Math.max(currentIdx, clickedIdx);
          const rangeIds = orderedLines.slice(start, end + 1).map((l) => l.id);
          setMultiSelected(new Set(rangeIds));
        }
      } else {
        // نقر عادي: تحديد واحد.
        setMultiSelected(new Set());
        onSelectLine?.(lineId);
      }
    },
    [selectedLineId, orderedLines, onSelectLine]
  );

  // ==================== Bulk Delete ====================

  const handleBulkDelete = useCallback(() => {
    if (multiSelected.size === 0) return;

    const targets: BulkDeleteTarget[] = orderedLines
      .filter((l) => multiSelected.has(l.id))
      .map((l) => ({ kind: 'LINE' as const, id: l.id, label: l.label }));

    const conf = calculateBulkDeleteConfirmation(targets, [], []);
    const message = buildConfirmationMessage(conf);

    setConfirmDialog({
      type: 'BULK_DELETE',
      message,
      onConfirm: () => {
        onBulkDelete?.([...multiSelected]);
        setMultiSelected(new Set());
        setConfirmDialog(null);
      },
    });
  }, [multiSelected, orderedLines, onBulkDelete]);

  // اختصار Ctrl+A للتحديد الكل.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement === listRef.current) {
        e.preventDefault();
        setMultiSelected(new Set(orderedLines.map((l) => l.id)));
      }
      if (e.key === 'Delete' && multiSelected.size > 0) {
        handleBulkDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orderedLines, multiSelected, handleBulkDelete]);

  // ==================== Render ====================

  const registerItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            ترتيب الأسطر ({toArabicDigits(orderedLines.length)})
          </h3>
          {multiSelected.size > 0 && (
            <p className="text-xs text-emerald-600">
              {toArabicDigits(multiSelected.size)} سطرا محددا
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {multiSelected.size > 0 && onBulkDelete && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
            >
              حذف ({multiSelected.size})
            </button>
          )}
          {multiSelected.size > 0 && (
            <button
              type="button"
              onClick={() => setMultiSelected(new Set())}
              className="rounded bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              إلغاء التحديد
            </button>
          )}
        </div>
      </div>

      {/* Line List */}
      <div ref={listRef} className="max-h-96 overflow-y-auto" tabIndex={0}>
        {orderedLines.map((line, index) => {
          const isDragged = dragState.draggedLineId === line.id;
          const isSelected = selectedLineId === line.id;
          const isMultiSelected = multiSelected.has(line.id);
          const dropTarget = dragState.dropTarget;
          const isDropTarget = dropTarget?.targetLineId === line.id;
          const dropPosition = isDropTarget ? dropTarget!.position : null;

          return (
            <div key={line.id} className="relative">
              {/* Drop Indicator: BEFORE */}
              {isDropTarget && dropPosition === 'BEFORE' && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500 z-10" />
              )}

              {/* Line Item */}
              <div
                ref={(el) => registerItemRef(line.id, el)}
                draggable
                onDragStart={(e) => handleDragStart(e, line.id, index)}
                onDragOver={(e) => handleDragOver(e, line.id, index)}
                onDrop={(e) => handleDrop(e, line.id)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleLineClick(e, line.id)}
                className={`
                  flex items-center gap-3 border-b border-gray-100 px-4 py-3 cursor-grab
                  transition-all duration-150
                  ${isDragged ? 'opacity-30' : ''}
                  ${isSelected ? 'bg-emerald-50 ring-2 ring-emerald-300 ring-inset' : ''}
                  ${isMultiSelected ? 'bg-blue-50 ring-1 ring-blue-300 ring-inset' : ''}
                  ${isDropTarget && dropPosition === 'ON_TOP' ? 'bg-violet-50 ring-2 ring-violet-400 ring-inset' : ''}
                  hover:bg-gray-50
                `}
              >
                {/* Drag Handle */}
                <div className="flex shrink-0 items-center text-gray-400">
                  <span className="text-xs">⠿</span>
                </div>

                {/* Order Number */}
                <span className="shrink-0 w-8 text-center text-xs font-bold text-gray-500">
                  {toArabicDigits(index + 1)}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{line.label}</p>
                  <p className="text-xs text-gray-500 truncate">{line.ruleLabel}</p>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1 shrink-0">
                  {line.isMerged && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                      مدمج
                    </span>
                  )}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {toArabicDigits(line.entriesCount)}
                  </span>
                </div>

                {/* Unmerge Button */}
                {line.isMerged && onUnmerge && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnmerge(line.id);
                    }}
                    className="shrink-0 rounded border border-violet-200 px-2 py-0.5 text-[10px] text-violet-700 hover:bg-violet-50"
                  >
                    فك
                  </button>
                )}
              </div>

              {/* Drop Indicator: AFTER */}
              {isDropTarget && dropPosition === 'AFTER' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 z-10" />
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              {confirmDialog.type === 'MERGE' ? 'تأكيد الدمج' :
               confirmDialog.type === 'REORDER' ? 'تأكيد النقل' :
               'تأكيد الحذف'}
            </h3>
            <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">
              {confirmDialog.message}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white ${
                  confirmDialog.type === 'BULK_DELETE'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                تأكيد
              </button>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

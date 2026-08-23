'use client';

// مؤشر تعدد الاختلافات - Multi-Difference Indicator
// FR-ED-03.3: عرض كل اختلافات الموضع مرتبة مع شارات
//
// يظهر عندما يكون هناك أكثر من اختلاف في نفس الموضع:
//   - عدد الاختلافات
//   - فهرس كل اختلاف (الأول، الثاني...)
//   - حالة كل اختلاف: متنافٍ/مرتبط/مستقل
//   - الفئة (مد/صلة/فرش/تحقيق...)
//   - المصدر (engine/editor)

import { useMemo } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import {
  computeVariantOccurrenceIndices,
  formatOccurrenceLabel,
} from '@/lib/tashjeer/multi-difference';
import type { VariantCategory } from '@/types';

interface MultiDifferenceIndicatorProps {
  /** معرّف الاختلاف الحالي. */
  currentVariantId: string;
  /** الفئة. */
  category: VariantCategory;
  /** الموضع: بداية. */
  startPosition: number;
  /** الموضع: نهاية. */
  endPosition: number;
  /** استدعاء عند النقر على اختلاف آخر في المجموعة. */
  onSelectDifference?: (variantId: string) => void;
}

export function MultiDifferenceIndicator({
  currentVariantId,
  category,
  startPosition,
  endPosition,
  onSelectDifference,
}: MultiDifferenceIndicatorProps) {
  const document = useEditorStore((state) => state.document);
  const selectedVariantId = useEditorStore((state) => state.selectedVariantId);

  const group = useMemo(() => {
    if (!document) return null;

    // البحث عن اختلافات في نفس الموضع.
    const sameLocus = document.variants.filter(
      (v) => v.startPosition === startPosition && v.endPosition === endPosition
    );

    if (sameLocus.length <= 1) return null;

    const indices = computeVariantOccurrenceIndices(sameLocus);

    return {
      differences: sameLocus.map((v) => ({
        ...v,
        occurrenceIndex: indices.get(v.id) ?? 1,
      })),
      total: sameLocus.length,
    };
  }, [document, startPosition, endPosition]);

  // لا شيء لعرضه إن كان اختلاف واحد فقط.
  if (!group || group.total <= 1) return null;

  const currentDiff = group.differences.find((d) => d.id === currentVariantId);
  if (!currentDiff) return null;

  return (
    <div className="mt-1.5">
      {/* Badge: عدد الاختلافات */}
      <div className="flex items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: getCategorySoftColor(category),
            color: getCategoryColor(category),
          }}
        >
          {toArabicDigits(group.total)} اختلافات في نفس الموضع
        </span>
        <span className="text-[10px] text-gray-500">
          ({formatOccurrenceLabel(currentDiff.occurrenceIndex, group.total)})
        </span>
      </div>

      {/* List: كل الاختلافات في الموضع */}
      <div className="mt-1.5 space-y-1">
        {group.differences.map((diff) => {
          const isCurrent = diff.id === currentVariantId;
          const isSelected = diff.id === selectedVariantId;
          const faceCount = diff.alternatives.filter((a) => !a.isBase).length;

          return (
            <button
              key={diff.id}
              type="button"
              onClick={() => onSelectDifference?.(diff.id)}
              className={`
                flex w-full items-center gap-2 rounded border px-2 py-1.5 text-right text-[11px]
                transition-all
                ${isCurrent
                  ? 'border-emerald-400 bg-emerald-50 font-medium'
                  : isSelected
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }
              `}
            >
              {/* Occurrence Index */}
              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                {toArabicDigits(diff.occurrenceIndex)}
              </span>

              {/* Category Badge */}
              <span
                className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
                style={{
                  backgroundColor: getCategorySoftColor(diff.category),
                  color: getCategoryColor(diff.category),
                }}
              >
                {CATEGORY_LABELS[diff.category]}
              </span>

              {/* Title */}
              <span className="flex-1 truncate text-gray-900">{diff.title}</span>

              {/* Source Badge */}
              {diff.origin === 'EDITOR' && (
                <span className="shrink-0 rounded bg-emerald-100 px-1 py-0.5 text-[9px] text-emerald-700">
                  محرر
                </span>
              )}

              {/* Face Count */}
              <span className="shrink-0 text-[10px] text-gray-500">
                {toArabicDigits(faceCount)} وجه
              </span>
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <p className="mt-1 text-[10px] text-gray-500">
        كل اختلاف كيان مستقل: تعديله أو حذفه لا يؤثر على الآخرين.
      </p>
    </div>
  );
}

// ==================== شارة مصغرة ====================

/**
 * شارة مصغرة لعدد الاختلافات (تُستخدم في قائمة الاختلافات).
 */
export function MultiDifferenceBadge({
  startPosition,
  endPosition,
}: {
  startPosition: number;
  endPosition: number;
}) {
  const document = useEditorStore((state) => state.document);

  const count = useMemo(() => {
    if (!document) return 0;
    return document.variants.filter(
      (v) => v.startPosition === startPosition && v.endPosition === endPosition
    ).length;
  }, [document, startPosition, endPosition]);

  if (count <= 1) return null;

  return (
    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
      {toArabicDigits(count)}×
    </span>
  );
}

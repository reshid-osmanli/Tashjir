'use client';

// لوحة تفاصيل العنصر المحدد - Selection Detail Panel
// FR-ED-02.4: عرض فوري لتفاصيل العنصر النشط
//
// تعرض: المعرّف، الرقم/الرتبة، الآية، الصفحة، النوع/الفئة، القواعد المرتبطة،
// الاختلافات، العلاقات، الأجزاء، الأوجه المركبة، المصدر، حالة التصحيح.

import { useMemo } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useSelectionStore } from '@/stores/selection-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { parseAyahKey } from '@/data/quran';

const kindLabels: Record<string, string> = {
  WORD: 'كلمة',
  CHARACTER: 'حرف',
  LOCUS: 'موضع',
  LINE: 'سطر',
  SEGMENT: 'جزء',
  DIFFERENCE: 'اختلاف',
  FACE: 'وجه',
  RULE: 'قاعدة',
  COMPOSITE_FACE: 'وجه مركب',
  WAQF_MARK: 'علامة وقف',
};

export function SelectionDetailPanel() {
  const document = useEditorStore((state) => state.document);
  const current = useSelectionStore((state) => state.current);

  const effectiveVariants = useMemo(
    () => (document ? getEffectiveVariants(document) : []),
    [document]
  );

  if (!current || !document) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
        لم يُحدد أي عنصر بعد
      </div>
    );
  }

  const variant = effectiveVariants.find((v) => v.id === current.differenceId || v.id === current.id);
  const face = variant?.alternatives.find((a) => a.id === current.faceId || a.id === current.id);
  const segment = document.segments?.find((s) => s.id === current.id);
  const branch = document.branches.find((b) => b.id === current.lineId || b.id === current.id);
  const boundary = document.boundaries.find((b) => b.id === current.id);
  const ayahInfo = parseAyahKey(document.ayahKey);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {kindLabels[current.kind] ?? current.kind}
          </span>
          <h3 className="text-sm font-bold text-gray-900">
            {variant?.title ?? face?.label ?? segment?.title ?? branch?.label ?? boundary?.label ?? current.id}
          </h3>
        </div>
        <span className="font-mono text-xs text-gray-500">{current.id}</span>
      </div>

      {/* Body */}
      <div className="grid grid-cols-2 gap-3 p-4 text-sm">
        {/* Common Info */}
        <InfoRow label="الآية" value={`${toArabicDigits(ayahInfo.surahNumber)}:${toArabicDigits(ayahInfo.ayahNumber)}`} />
        <InfoRow label="النوع" value={kindLabels[current.kind]} />

        {/* Variant-specific */}
        {variant && (
          <>
            <InfoRow label="الفئة" value={CATEGORY_LABELS[variant.category]} />
            <InfoRow
              label="المصدر"
              value={
                variant.isGlobalDerived
                  ? 'المحرك (قاعدة عامة)'
                  : variant.origin === 'EDITOR'
                    ? 'المحرر'
                    : 'المحرك'
              }
            />
            <InfoRow label="الموضع" value={`${toArabicDigits(variant.startPosition)}–${toArabicDigits(variant.endPosition)}`} />
            <InfoRow
              label="الحالة"
              value={
                variant.status === 'DRAFT'
                  ? 'مسودة'
                  : variant.status === 'REVIEW'
                    ? 'قيد المراجعة'
                    : variant.status === 'APPROVED'
                      ? 'معتمد'
                      : 'مرفوض'
              }
            />
            <InfoRow
              label="الأوجه"
              value={toArabicDigits(variant.alternatives.filter((a) => !a.isBase).length)}
            />
            {variant.orderRank !== undefined && (
              <InfoRow label="رتبة المرور" value={toArabicDigits(variant.orderRank)} />
            )}
          </>
        )}

        {/* Face-specific */}
        {face && (
          <>
            <InfoRow label="الوجه" value={face.label} />
            <InfoRow
              label="نوع النطاق"
              value={face.scope.kind}
            />
          </>
        )}

        {/* Segment-specific */}
        {segment && (
          <>
            <InfoRow label="الموضع" value={`${toArabicDigits(segment.startPosition)}–${toArabicDigits(segment.endPosition)}`} />
            <InfoRow label="المصدر" value={segment.origin === 'EDITOR' ? 'المحرر' : 'المحرك'} />
          </>
        )}

        {/* Branch/Line-specific */}
        {branch && (
          <>
            <InfoRow label="المسار" value={toArabicDigits(branch.lane + 1)} />
            <InfoRow label="الجهة" value={branch.side === 'TOP' ? 'أعلى النص' : 'أسفل النص'} />
            <InfoRow label="الفئة" value={CATEGORY_LABELS[branch.category]} />
          </>
        )}

        {/* Boundary/Waqf-specific */}
        {boundary && (
          <>
            <InfoRow label="النوع" value={boundary.kind} />
            <InfoRow label="الموضع" value={toArabicDigits(boundary.position)} />
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-gray-200 px-4 py-3">
        <button
          type="button"
          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
        >
          نسخ
        </button>
        <button
          type="button"
          className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
        >
          قص
        </button>
        <button
          type="button"
          className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          حذف
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded bg-gray-50 px-2 py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-800">{value}</span>
    </div>
  );
}

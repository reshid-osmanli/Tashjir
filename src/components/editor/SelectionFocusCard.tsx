// بطاقة العنصر المُوجَّه إليه — Selection Focus Card (FR-ED-02.3)
// مشروع التشجير - نظام القراءات العشر
//
// «يجب أن أعرف فورًا كل تفاصيله»: حين يُحدَّد عنصر من أي لوحة تظهر فوق اللوحة
// بطاقة مصغرة تعرض نوعه وعنوانه ومعرّفه وآيته — تأكيد بصري فوري أن الانتقال
// تم إلى العنصر الصحيح. تختفي تلقائيًا أو بإغلاق يدوي، ولا تحجب العمل.

'use client';

import { useMemo } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { getWordById } from '@/data/quran';
import { describeSelection, selectionKindLabel, type SelectionLookup } from '@/lib/tashjeer/selection-context';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import type { EditorSelection } from '@/types/tashjeer';

export function SelectionFocusCard({
  selection,
  onClose,
}: {
  selection: EditorSelection;
  onClose: () => void;
}) {
  const document = useEditorStore((state) => state.document);

  const summary = useMemo(() => {
    const variants = document?.variants ?? [];
    const lookup: SelectionLookup = {
      surahNumber: document?.surahNumber ?? 1,
      ayahNumber: document?.ayahNumber ?? 1,
      variantTitle: (id) => variants.find((variant) => variant.id === id)?.title,
      segmentTitle: (id) => document?.segments?.find((segment) => segment.id === id)?.title,
      wordText: (id) => getWordById(id)?.text,
    };
    return describeSelection(selection, lookup);
  }, [document, selection]);

  const variant = useMemo(() => {
    const variants = document?.variants ?? [];
    const id =
      selection.kind === 'FACE' || selection.kind === 'DIFFERENCE' || selection.kind === 'RULE'
        ? selection.differenceId ?? selection.id
        : selection.id;
    return variants.find((item) => item.id === id);
  }, [document, selection]);

  if (!summary) return null;

  return (
    <div
      role="status"
      className="tashjeer-focus-card pointer-events-auto absolute end-3 top-3 z-20 max-w-[300px] rounded-lg border border-emerald-300 bg-white/95 px-3 py-2 shadow-xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-stone-900">
            <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {selectionKindLabel(summary.kind)}
            </span>
            <span className="truncate">{summary.label}</span>
          </p>
          <p className="mt-1 font-mono text-[10px] text-stone-400" dir="ltr">
            {summary.ayah} · {selection.id.slice(0, 26)}
          </p>
          {variant && (
            <p className="mt-0.5 text-[10px] text-stone-500">
              {CATEGORY_LABELS[variant.category]} · {variant.alternatives.length} أوجه
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded px-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="إغلاق بطاقة العنصر المحدد"
        >
          ×
        </button>
      </div>
    </div>
  );
}

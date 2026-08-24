// شريط سياق التحديد — Selection Breadcrumb (FR-ED-02)
// مشروع التشجير - نظام القراءات العشر
//
// شريط علوي يعرض سلسلة السياق للعنصر المحدد الآن (الآية ← السطر ← الجزء ←
// الاختلاف ← الوجه)، مقروءًا من المصدر الواحد للحقيقة: حقل `selection` في
// المخزن. لا تملك أي لوحة تحديدًا مستقلًا (P-07). يساعد المستخدم على معرفة
// موقعه الهرمي بسرعة، ويُسهّل الانتقال عبر اللوحات.

'use client';

import { useMemo, type ReactNode } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { getWordById } from '@/data/quran';
import { buildSelectionBreadcrumb, describeSelection, selectionKindLabel, type SelectionLookup } from '@/lib/tashjeer/selection-context';

export function SelectionBreadcrumb() {
  const { document, selection } = useEditorStore();

  const lookup = useMemo<SelectionLookup>(() => {
    const variants = document?.variants ?? [];
    return {
      surahNumber: document?.surahNumber ?? 1,
      ayahNumber: document?.ayahNumber ?? 1,
      variantTitle: (id) => variants.find((variant) => variant.id === id)?.title,
      faceLabel: (variantId, faceId) =>
        variants.find((variant) => variant.id === variantId)?.alternatives.find((alt) => alt.id === faceId)?.label,
      segmentTitle: (id) => document?.segments?.find((segment) => segment.id === id)?.title,
      lineTitle: (id) => {
        const branch = document?.branches.find((item) => item.id === id);
        if (!branch) return undefined;
        const owner = variants.find((variant) => variant.id === branch.variantId);
        return owner?.title ?? `سطر`;
      },
      wordText: (id) => getWordById(id)?.text,
    };
  }, [document]);

  const crumbs = buildSelectionBreadcrumb(selection, lookup);
  const summary = describeSelection(selection, lookup);

  if (!selection) {
    return (
      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-1.5 text-[11px] text-stone-400">
        لا عنصر محدّد — انقر كلمة أو اختلافًا أو سطرًا لعرض سياقه.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 bg-stone-50 px-4 py-1.5 text-[11px]">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.kind}-${index}`} className="flex items-center gap-1">
          {index > 0 && <span className="text-stone-300">←</span>}
          <span
            className={`rounded px-1.5 py-0.5 ${
              index === crumbs.length - 1 ? 'bg-emerald-100 font-medium text-emerald-800' : 'text-stone-600'
            }`}
          >
            {crumb.label}
          </span>
        </span>
      ))}
      {summary && (
        <span className="ms-auto flex items-center gap-2 text-stone-400">
          <Tag>{selectionKindLabel(summary.kind)}</Tag>
          {typeof summary.position === 'number' && <Tag>موضع {summary.position}</Tag>}
        </span>
      )}
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded bg-stone-200 px-1.5 py-0.5 text-stone-500">{children}</span>;
}

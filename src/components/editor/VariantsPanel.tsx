// لوحة الاختلافات - Variants Panel
// مشروع التشجير - نظام القراءات العشر
//
// هذه اللوحة هي مكان العمل العلمي الفعلي: عرض اختلافات الآية، وإضافة اختلاف
// جديد من الكلمات المعلّمة، وتحرير الأوجه ونطاقاتها وأدلتها.
//
// ترتيب العرض يتبع القاعدة المعتمدة: من آخر الآية إلى أولها.

'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { getAyahWordsByKey } from '@/data/quran';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { describeScope, resolveScope } from '@/lib/tashjeer/scope';
import { VariantEditor } from './VariantEditor';
import type { VariantCategory } from '@/types';
import type { Variant } from '@/types/tashjeer';

export function VariantsPanel() {
  const {
    document,
    markedPositions,
    selectedVariantId,
    draftCategory,
    setDraftCategory,
    selectVariant,
    deleteVariant,
    clearMarks,
    addVariant,
  } = useEditorStore();

  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  const words = useMemo(
    () => (document ? getAyahWordsByKey(document.ayahKey) : []),
    [document]
  );

  const markedText = useMemo(
    () =>
      markedPositions
        .map((position) => words.find((word) => word.position === position)?.text ?? '')
        .join(' '),
    [markedPositions, words]
  );

  if (!document) return null;

  const editingVariant = document.variants.find((variant) => variant.id === editingVariantId);

  /** ينشئ اختلافا جديدا من الكلمات المعلّمة، بوجه أساس واحد جاهز للتحرير. */
  const handleCreateVariant = () => {
    if (markedPositions.length === 0) return;

    const start = Math.min(...markedPositions);
    const end = Math.max(...markedPositions);
    const baseText = words
      .filter((word) => word.position >= start && word.position <= end)
      .map((word) => word.text)
      .join(' ');

    const id = `v-${document.ayahKey}-${start}-${Date.now().toString(36)}`;

    addVariant({
      id,
      category: draftCategory,
      title: baseText,
      startPosition: start,
      endPosition: end,
      status: 'DRAFT',
      alternatives: [
        {
          id: `${id}-base`,
          text: baseText,
          label: 'وجه المصحف',
          isBase: true,
          scope: { kind: 'ALL' },
        },
      ],
    });

    selectVariant(id);
    setEditingVariantId(id);
  };

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-s border-stone-200 bg-white">
      <header className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-bold text-stone-900">اختلافات الآية</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          {document.variants.length} اختلافا — مرتبة من آخر الآية إلى أولها
        </p>
      </header>

      {/* إنشاء اختلاف من الكلمات المعلّمة */}
      <section className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <h3 className="text-xs font-semibold text-stone-700">اختلاف جديد</h3>

        {markedPositions.length === 0 ? (
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
            فعّل أداة التعليم (M) ثم انقر على الكلمات التي يقع فيها الاختلاف.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
              <p
                className="text-base leading-loose text-stone-900"
                style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
              >
                {markedText}
              </p>
              <p className="mt-1 text-[11px] text-stone-500">
                الكلمات {Math.min(...markedPositions)}–{Math.max(...markedPositions)}
              </p>
            </div>

            <div className="flex flex-wrap gap-1">
              {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setDraftCategory(category)}
                  className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                    draftCategory === category
                      ? 'border-stone-800 bg-stone-800 text-white'
                      : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateVariant}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                إنشاء الاختلاف
              </button>
              <button
                type="button"
                onClick={clearMarks}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </section>

      {/* قائمة الاختلافات */}
      <div className="flex-1 overflow-y-auto">
        {document.variants.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-stone-500">
            لا توجد اختلافات مسجّلة في هذه الآية بعد.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {document.variants.map((variant) => (
              <VariantRow
                key={variant.id}
                variant={variant}
                isSelected={variant.id === selectedVariantId}
                onSelect={() => selectVariant(variant.id === selectedVariantId ? null : variant.id)}
                onEdit={() => setEditingVariantId(variant.id)}
                onDelete={() => {
                  if (window.confirm(`حذف الاختلاف «${variant.title}»؟`)) {
                    deleteVariant(variant.id);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {editingVariant && (
        <VariantEditor variant={editingVariant} onClose={() => setEditingVariantId(null)} />
      )}
    </aside>
  );
}

// ==================== صف الاختلاف ====================

function VariantRow({
  variant,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  variant: Variant;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const drawnAlternatives = variant.alternatives.filter((alternative) => !alternative.isBase);

  return (
    <li className={isSelected ? 'bg-emerald-50/60' : ''}>
      <div className="px-4 py-3">
        <button type="button" onClick={onSelect} className="w-full text-start">
          <div className="flex items-start justify-between gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: getCategorySoftColor(variant.category),
                color: getCategoryColor(variant.category),
              }}
            >
              {CATEGORY_LABELS[variant.category]}
            </span>
            <StatusBadge status={variant.status} />
          </div>

          <p className="mt-1.5 text-sm font-medium leading-relaxed text-stone-900">
            {variant.title}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            الكلمات {variant.startPosition}
            {variant.endPosition !== variant.startPosition ? `–${variant.endPosition}` : ''} —{' '}
            {drawnAlternatives.length} وجها مرسوما
          </p>
        </button>

        {isSelected && (
          <ul className="mt-2 space-y-1.5">
            {variant.alternatives.map((alternative) => (
              <li
                key={alternative.id}
                className="rounded border border-stone-200 bg-white px-2 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-sm text-stone-900"
                    style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                  >
                    {alternative.text}
                  </span>
                  {alternative.isBase && (
                    <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                      وجه المصحف
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-stone-600">{alternative.label}</p>
                <p className="text-[11px] text-stone-500">
                  {describeScope(alternative.scope)} ({resolveScope(alternative.scope).length} راويا)
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-stone-300 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-100"
          >
            تحرير
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
          >
            حذف
          </button>
        </div>
      </div>
    </li>
  );
}

export function StatusBadge({ status }: { status: Variant['status'] }) {
  const styles: Record<Variant['status'], { label: string; className: string }> = {
    DRAFT: { label: 'مسودة', className: 'bg-stone-100 text-stone-600' },
    REVIEW: { label: 'قيد المراجعة', className: 'bg-amber-100 text-amber-800' },
    APPROVED: { label: 'معتمد', className: 'bg-emerald-100 text-emerald-800' },
    REJECTED: { label: 'مرفوض', className: 'bg-red-100 text-red-800' },
  };

  const style = styles[status];

  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

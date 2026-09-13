// اختلافات الموضع الواحد — Locus Differences (FR-ED-03)
// مشروع التشجير - نظام القراءات العشر
//
// تعرض كل اختلافات الكلمة المحددة مرتبة (المصدر ← الرتبة ← الفهرس)، مع شارات:
// النوع، المصدر (المحرك/المحرر)، الحالة (متنافٍ/مرتبط/مستقل)، والفهرس
// (اختلاف ١، ٢، ٣...). ومنها: تحديد مستقل لكل اختلاف، وقرار يدوي موثق
// «متنافيان/مرتبطان» على أي زوج، وزر «اختلاف ثانٍ لهذا الموضع».

'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useEngineConfig } from '@/hooks/useEngineConfig';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import {
  differencesAtPosition,
  resolveOccurrenceIndices,
  sortDifferencesForLocus,
} from '@/lib/tashjeer/multi-difference';
import {
  locusRelationStatuses,
  manualLocusVerdictsFromLinks,
  type LocusRelationStatus,
} from '@/lib/tashjeer/decision/editor-bridge';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { LocusLinkVerdict } from '@/types/tashjeer';

const STATUS_LABEL: Record<LocusRelationStatus, string> = {
  EXCLUSIVE: 'متنافٍ',
  RELATED: 'مرتبط',
  INDEPENDENT: 'مستقل',
};

const STATUS_STYLE: Record<LocusRelationStatus, string> = {
  EXCLUSIVE: 'border-amber-300 bg-amber-100 text-amber-900',
  RELATED: 'border-emerald-300 bg-emerald-100 text-emerald-900',
  INDEPENDENT: 'border-stone-200 bg-stone-100 text-stone-600',
};

export function LocusDifferences({ position }: { position: number }) {
  const document = useEditorStore((state) => state.document);
  const selectedVariantId = useEditorStore((state) => state.selectedVariantId);
  const selectVariant = useEditorStore((state) => state.selectVariant);
  const markPositions = useEditorStore((state) => state.markPositions);
  const setLocusRelation = useEditorStore((state) => state.setLocusRelation);
  const deleteLink = useEditorStore((state) => state.deleteLink);
  const engineConfig = useEngineConfig();

  const [secondId, setSecondId] = useState('');
  const [markedHint, setMarkedHint] = useState(false);
  const [verdictError, setVerdictError] = useState('');

  const effective = useMemo(
    () => (document ? getEffectiveVariants(document) : []),
    [document]
  );
  const indices = useMemo(() => resolveOccurrenceIndices(effective), [effective]);
  const locusDiffs = useMemo(
    () => sortDifferencesForLocus(differencesAtPosition(effective, position), indices),
    [effective, position, indices]
  );
  const verdicts = useMemo(
    () => manualLocusVerdictsFromLinks(document?.links ?? []),
    [document]
  );
  const statuses = useMemo(
    () => locusRelationStatuses(locusDiffs, engineConfig, verdicts),
    [locusDiffs, engineConfig, verdicts]
  );

  if (!document || locusDiffs.length === 0) return null;

  // الزوج الافتراضي للقرار اليدوي: المحدد (إن كان من الموضع) مع أول إخوته.
  const firstId =
    selectedVariantId && locusDiffs.some((diff) => diff.id === selectedVariantId)
      ? selectedVariantId
      : locusDiffs[0].id;
  const siblings = locusDiffs.filter((diff) => diff.id !== firstId);
  const activeSecondId = siblings.some((diff) => diff.id === secondId)
    ? secondId
    : (siblings[0]?.id ?? '');
  const pairVerdict = verdicts.find(
    (item) =>
      (item.firstId === firstId && item.secondId === activeSecondId) ||
      (item.firstId === activeSecondId && item.secondId === firstId)
  );
  const storedIds = new Set(document.variants.map((variant) => variant.id));
  const pairStored = storedIds.has(firstId) && storedIds.has(activeSecondId);

  const submitVerdict = (verdict: LocusLinkVerdict) => {
    setVerdictError('');
    if (!activeSecondId || firstId === activeSecondId) {
      setVerdictError('اختر اختلافين مختلفين من هذا الموضع.');
      return;
    }
    const linkId = setLocusRelation(firstId, activeSecondId, verdict);
    if (!linkId) setVerdictError('تعذّر تسجيل القرار: طرفا الزوج من خارج اختلافات الآية المحفوظة.');
  };

  return (
    <section className="border-b border-stone-200 px-4 py-3">
      <h3 className="mb-1 text-xs font-bold text-stone-900">
        اختلافات الكلمة {toArabicDigits(position)}
        <span className="ms-1 font-medium text-stone-500">
          ({toArabicDigits(locusDiffs.length)} {locusDiffs.length === 2 ? 'اختلافان' : 'اختلافات'} مستقلة)
        </span>
      </h3>
      <p className="mb-2 text-[10px] leading-relaxed text-stone-500">
        كل اختلاف كيان مستقل بمعرفه وفهرسه وعلاقاته — لا استبدال ولا دمج تلقائي.
      </p>

      <ul className="space-y-1.5">
        {locusDiffs.map((diff) => {
          const status = statuses.get(diff.id) ?? 'INDEPENDENT';
          const isSelected = diff.id === selectedVariantId;
          const fromEngine = diff.origin !== 'EDITOR' || diff.isGlobalDerived === true;
          return (
            <li key={diff.id}>
              <button
                type="button"
                onClick={() => selectVariant(isSelected ? null : diff.id)}
                className={`w-full rounded-md border px-2 py-1.5 text-start transition ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-200'
                    : 'border-stone-200 bg-white hover:border-emerald-300'
                }`}
              >
                <span className="flex flex-wrap items-center gap-1">
                  <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    اختلاف {toArabicDigits(indices.get(diff.id) ?? 1)}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: getCategorySoftColor(diff.category),
                      color: getCategoryColor(diff.category),
                    }}
                  >
                    {CATEGORY_LABELS[diff.category]}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      fromEngine ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                    title={fromEngine ? 'مصدره المحرك (بيانات أساسية أو قاعدة عامة)' : 'أضافه المحرر يدويا'}
                  >
                    {fromEngine ? 'المحرك' : 'المحرر'}
                  </span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                </span>
                <span className="mt-1 block truncate text-[11px] font-medium text-stone-800">
                  {diff.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {siblings.length > 0 && (
        <div className="mt-2 rounded-md border border-violet-200 bg-violet-50/40 p-2">
          <p className="text-[11px] font-semibold text-violet-950">قرار يدوي على زوج من الموضع</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <select
              value={activeSecondId}
              onChange={(event) => setSecondId(event.target.value)}
              className="input h-7 min-w-0 flex-1 py-0 text-[11px]"
              aria-label="الاختلاف الثاني في الزوج"
            >
              {siblings.map((diff) => (
                <option key={diff.id} value={diff.id}>
                  اختلاف {toArabicDigits(indices.get(diff.id) ?? 1)} — {diff.title.slice(0, 24)}
                </option>
              ))}
            </select>
          </div>
          {!pairStored && (
            <p className="mt-1 text-[10px] text-violet-900/75">
              القرار اليدوي للاختلافات المحفوظة في الآية؛ المشتق من قاعدة عامة يُخصَّص من تتبّع مواضعها.
            </p>
          )}
          {pairVerdict ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded border border-violet-200 bg-white px-2 py-1.5">
              <span className="text-[11px] text-violet-950">
                قرار مسجّل: {pairVerdict.verdict === 'EXCLUSIVE' ? 'متنافيان' : 'مرتبطان'}
              </span>
              <button
                type="button"
                onClick={() => pairVerdict.linkId && deleteLink(pairVerdict.linkId)}
                className="rounded border border-rose-200 px-2 py-0.5 text-[10px] text-rose-700 hover:bg-rose-50"
              >
                إلغاء القرار
              </button>
            </div>
          ) : null}
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              disabled={!pairStored}
              onClick={() => submitVerdict('EXCLUSIVE')}
              className="flex-1 rounded border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
              title="لا يجتمعان في وجه واحد ولا يُضربان معا"
            >
              متنافيان
            </button>
            <button
              type="button"
              disabled={!pairStored}
              onClick={() => submitVerdict('RELATED')}
              className="flex-1 rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
              title="يُطبَّقان معا في سطر الراوي"
            >
              مرتبطان
            </button>
          </div>
          {verdictError && <p className="mt-1 text-[10px] text-rose-700">{verdictError}</p>}
          <p className="mt-1 text-[10px] leading-relaxed text-violet-900/70">
            المحرك يقترح والمحرر يقرر: يُسجَّل القرار مع اقتراح السياسة قبله، فيظهر في التتبع والتصدير.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          markPositions([position]);
          setMarkedHint(true);
        }}
        className="mt-2 w-full rounded-md border border-cyan-500 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-950 hover:bg-cyan-100"
        title="يعلّم هذه الكلمة لتنشئ لها اختلافا جديدا مستقلا من لوحة الاختلافات"
      >
        + اختلاف ثانٍ لهذا الموضع
      </button>
      {markedHint && (
        <p role="status" className="mt-1.5 rounded bg-cyan-50 px-2 py-1.5 text-[11px] leading-relaxed text-cyan-900">
          عُلمت الكلمة {toArabicDigits(position)} — أكمل من «اختلاف جديد» في لوحة الاختلافات،
          وسيُنشأ كيان مستقل بفهرس تالٍ دون مساس الموجود.
        </p>
      )}
    </section>
  );
}

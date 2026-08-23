// أدوات الوقف والابتداء ومواضع الأسطر داخل محرر الآية

'use client';

import { useMemo, useState } from 'react';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useEditorStore } from '@/stores/editor-store';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { OrderRankControl } from './OrderRankControl';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import { normalizeScope, resolveScope } from '@/lib/tashjeer/scope';
import { getNarratorSymbol } from '@/lib/tashjeer/symbols';
import { documentReadingWindow, nextAyahKeyInSurah } from '@/lib/tashjeer/reading-window';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { parseAyahKey } from '@/data/quran';
import type { VariantCategory } from '@/types';
import type { RecitationBoundaryKind } from '@/types/tashjeer';

const BOUNDARY_LABELS: Record<RecitationBoundaryKind, string> = {
  WAQF: 'وقف بعد الكلمة',
  IBTIDA: 'ابتداء من الكلمة',
  WASL: 'وصل بعد الكلمة',
  NO_WASL: 'منع الوصل بعد الكلمة',
};

/**
 * يضع المحقق الوقف/الابتداء صراحة، ثم يعرض المحرك خطة الأداء الناتجة.
 * لا تعد هذه الأداة اقتراحا آليا لحكم الوقف؛ القرار العلمي يبقى للمحرر.
 */
export function RecitationControls() {
  const catalog = useTransmissionCatalog();
  const {
    document,
    selectedWordId,
    addBoundary,
    updateBoundary,
    deleteBoundary,
    setLinkNextAyah,
    setFocusSegment,
  } = useEditorStore();
  const [kind, setKind] = useState<RecitationBoundaryKind>('WAQF');
  const [label, setLabel] = useState('');
  const [isSpecific, setIsSpecific] = useState(false);
  const [narratorIds, setNarratorIds] = useState<string[]>([]);

  const words = useMemo(
    () => documentWindowWords(document),
    [document]
  );
  const selectedPosition = words.find((word) => word.id === selectedWordId)?.position;
  const readingWindow = useMemo(() => documentReadingWindow(document), [document]);
  const nextKey = document ? nextAyahKeyInSurah(document.ayahKey) : null;
  const focusSegment = document?.readingWindow?.focusSegment ?? null;
  const plan = useMemo(
    () => buildReadingPlan(words.length, document?.boundaries ?? []),
    [document?.boundaries, words.length]
  );

  if (!document) return null;

  const add = () => {
    if (!selectedPosition) return;
    const scope = isSpecific ? normalizeScope(narratorIds, catalog) : { kind: 'ALL' as const };
    addBoundary({
      id: `boundary-${document.ayahKey}-${selectedPosition}-${Date.now().toString(36)}`,
      kind,
      position: selectedPosition,
      label: label.trim() || undefined,
      scope,
      connectsToNextAyah: kind === 'WASL' && selectedPosition === words.length,
    });
    setLabel('');
  };

  const toggleNarrator = (narratorId: string) => {
    setNarratorIds((current) =>
      current.includes(narratorId)
        ? current.filter((id) => id !== narratorId)
        : [...current, narratorId]
    );
  };

  return (
    <Section title="الوقف والابتداء">
      <p className="mb-2 text-[11px] leading-relaxed text-stone-500">
        حدِّد الكلمة ثم سجّل الوقف أو الابتداء أو الوصل. يعيد المحرك ترتيب المقاطع من آخرها إلى أولها.
      </p>

      {selectedPosition ? (
        <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/50 p-2">
          <p className="text-[11px] font-medium text-violet-900">
            الكلمة المحددة: {selectedPosition} — {words[selectedPosition - 1]?.text}
          </p>
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(BOUNDARY_LABELS) as RecitationBoundaryKind[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`rounded border px-1.5 py-1 text-[10px] ${
                  kind === option
                    ? 'border-violet-700 bg-violet-700 text-white'
                    : 'border-violet-200 bg-white text-violet-800 hover:bg-violet-100'
                }`}
              >
                {option === 'WAQF' ? 'وقف' : option === 'IBTIDA' ? 'ابتداء' : option === 'WASL' ? 'وصل' : 'ممنوع'}
              </button>
            ))}
          </div>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="وصف اختياري: وقف كافٍ، وصل أولى..."
            className="input h-7 text-[11px]"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-stone-700">
            <input
              type="checkbox"
              checked={isSpecific}
              onChange={(event) => setIsSpecific(event.target.checked)}
              className="accent-violet-700"
            />
            يخص بعض الرواة فقط
          </label>
          {isSpecific && (
            <div className="flex flex-wrap gap-1 border-t border-violet-100 pt-1.5">
              {catalog.narrators.map((narrator) => {
                const active = narratorIds.includes(narrator.id);
                return (
                  <button
                    key={narrator.id}
                    type="button"
                    onClick={() => toggleNarrator(narrator.id)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${
                      active
                        ? 'border-violet-700 bg-violet-700 text-white'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    {narrator.name}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={add}
            className="w-full rounded bg-violet-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-violet-800"
          >
            تسجيل {BOUNDARY_LABELS[kind]}
          </button>
        </div>
      ) : (
        <p className="rounded bg-stone-50 p-2 text-[11px] text-stone-500">
          انقر على كلمة في اللوحة لتفعيل إضافة العلامة.
        </p>
      )}

      {document.boundaries.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {document.boundaries.map((boundary) => (
            <li key={boundary.id} className="rounded border border-stone-200 bg-white p-2">
              <div className="flex items-center gap-1.5">
                <select
                  value={boundary.kind}
                  onChange={(event) =>
                    updateBoundary(boundary.id, { kind: event.target.value as RecitationBoundaryKind })
                  }
                  className="h-6 rounded border border-stone-300 bg-white px-1 text-[10px]"
                >
                  <option value="WAQF">وقف</option>
                  <option value="IBTIDA">ابتداء</option>
                  <option value="WASL">وصل</option>
                  <option value="NO_WASL">ممنوع الوصل</option>
                </select>
                <span className="text-[10px] text-stone-600">عند الكلمة {boundary.position}</span>
                <button
                  type="button"
                  onClick={() => deleteBoundary(boundary.id)}
                  className="ms-auto text-[10px] text-red-700 hover:underline"
                >
                  حذف
                </button>
              </div>
              <input
                value={boundary.label ?? ''}
                onChange={(event) => updateBoundary(boundary.id, { label: event.target.value })}
                placeholder="وصف العلامة"
                className="mt-1 h-6 w-full rounded border border-stone-200 px-1.5 text-[10px]"
              />
              {boundary.kind === 'WASL' && boundary.position === words.length && (
                <label className="mt-1 flex items-center gap-1 text-[10px] text-sky-800">
                  <input
                    type="checkbox"
                    checked={boundary.connectsToNextAyah ?? false}
                    onChange={(event) =>
                      updateBoundary(boundary.id, { connectsToNextAyah: event.target.checked })
                    }
                    className="accent-sky-700"
                  />
                  وصل هذه الآية بالآية التالية
                </label>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded bg-stone-50 p-2">
        <p className="text-[10px] font-semibold text-stone-700">خطة الأداء الناتجة</p>
        <p className="mt-0.5 text-[11px] text-stone-600" dir="ltr">
          {plan.positions.length
            ? plan.positions.map((position) => toArabicDigits(position)).join(' ← ')
            : '—'}
        </p>
        {plan.connectsToNextAyah && (
          <p className="mt-1 text-[10px] text-sky-700">آخر الآية موصول بما بعدها.</p>
        )}
      </div>

      {/* المقاطع الناتجة عن الوقف: يختار المحقق أيّها يُشجَّر وحده. */}
      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-stone-700">تشجير مقطع وحده</p>
        <p className="text-[10px] leading-relaxed text-stone-500">
          الوقف يقسم النافذة مقاطع. اختر مقطعا ليظهر نصه وتشجيره وحدهما دون بقية النافذة.
        </p>
        <div className="flex flex-wrap gap-1">
          {plan.segments.map((segment) => {
            const isActive =
              focusSegment?.startPosition === segment.startPosition &&
              focusSegment?.endPosition === segment.endPosition;
            return (
              <button
                key={`${segment.startPosition}-${segment.endPosition}`}
                type="button"
                onClick={() =>
                  setFocusSegment(
                    isActive
                      ? null
                      : {
                          startPosition: segment.startPosition,
                          endPosition: segment.endPosition,
                        }
                  )
                }
                className={`rounded border px-1.5 py-1 text-[10px] ${
                  isActive
                    ? 'border-cyan-700 bg-cyan-700 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {toArabicDigits(segment.startPosition)}–{toArabicDigits(segment.endPosition)}
                {segment.endsWithWaqf ? ' ⏸' : ''}
              </button>
            );
          })}
        </div>
        {selectedPosition && (
          <button
            type="button"
            onClick={() =>
              setFocusSegment({ startPosition: 1, endPosition: selectedPosition })
            }
            className="w-full rounded border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] text-cyan-900 hover:bg-cyan-100"
          >
            تشجير ما قبل الكلمة المحددة (١–{toArabicDigits(selectedPosition)})
          </button>
        )}
        {focusSegment && (
          <button
            type="button"
            onClick={() => setFocusSegment(null)}
            className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-[10px] text-stone-700 hover:bg-stone-50"
          >
            إلغاء الحصر وتشجير النافذة كلها
          </button>
        )}
      </div>

      {/* وصل الآيتين: الحكم قد يقع بين آخر آية وأول التي بعدها. */}
      <div className="mt-3 rounded border border-sky-200 bg-sky-50/60 p-2">
        <p className="text-[10px] font-semibold text-sky-900">وصل الآيتين</p>
        {nextKey ? (
          <>
            <label className="mt-1 flex items-center gap-1.5 text-[11px] text-sky-900">
              <input
                type="checkbox"
                checked={readingWindow.isLinked}
                disabled={plan.forbiddenWaslAfter.includes(readingWindow.firstAyahEndPosition)}
                onChange={(event) => setLinkNextAyah(event.target.checked)}
                className="accent-sky-700 disabled:cursor-not-allowed"
              />
              ضمّ الآية {toArabicDigits(parseAyahKey(nextKey).ayahNumber)} إلى نافذة العمل
            </label>
            {plan.forbiddenWaslAfter.includes(readingWindow.firstAyahEndPosition) ? (
              <p className="mt-1 rounded bg-red-50 px-1.5 py-1 text-[10px] text-red-800">
                الوصل ممنوع بعلامة المحقق عند نهاية الآية. احذف العلامة أو غيّرها قبل ضم الآية التالية.
              </p>
            ) : (
              <p className="mt-1 text-[10px] leading-relaxed text-sky-800">
                عند الوصل تتسلسل مواضع الكلمات عبر الآيتين، فيمكن تحديد حكم يبدأ في آخر الأولى
                وينتهي في أول الثانية، ويشجّره المحرك سطرا واحدا.
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-[10px] text-sky-800">هذه آخر آية في السورة، فلا وصل بعدها.</p>
        )}
      </div>
    </Section>
  );
}

/** تحكم في كسر السطر النصي وإزاحته، لا في مسارات الشجرة فقط. */
export function TextLayoutControls() {
  const { document, selectedWordId, toggleForcedLineBreak, setLineOffset } = useEditorStore();
  const engine = useEngineSettings();
  const words = useMemo(
    () => documentWindowWords(document),
    [document]
  );
  const selected = words.find((word) => word.id === selectedWordId);
  const layout = useMemo(
    () => (document ? layoutAyah(document.ayahKey, words, document.layout) : null),
    [document, words]
  );

  if (!document) return null;

  const breaks = document.layout.forcedLineBreakAfter;
  return (
    <Section title="مواضع أسطر النص">
      {engine.singleLineText && (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-900">
          وضع «السطر الواحد» مفعّل، فنص الآية على خط واحد وكسور الأسطر معطّلة. أوقفه من شريط
          الأدوات إن أردت تقسيم الآية أسطرا.
        </p>
      )}
      {selected ? (
        <button
          type="button"
          onClick={() => toggleForcedLineBreak(selected.position)}
          className={`w-full rounded border px-2 py-1.5 text-[11px] ${
            breaks.includes(selected.position)
              ? 'border-amber-500 bg-amber-50 text-amber-900'
              : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
          }`}
        >
          {breaks.includes(selected.position) ? 'إلغاء كسر السطر بعد الكلمة المحددة' : 'كسر السطر بعد الكلمة المحددة'}
        </button>
      ) : (
        <p className="text-[11px] text-stone-500">اختر كلمة لضبط الكسر بعدها.</p>
      )}

      {breaks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {breaks.map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => toggleForcedLineBreak(position)}
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 hover:bg-amber-200"
              title="إزالة الكسر"
            >
              بعد {position} ×
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <p className="text-[10px] font-medium text-stone-600">
          إزاحة كل سطر نصي ({layout?.lineCount ?? 1} سطر):
        </p>
        {Array.from({ length: layout?.lineCount ?? 1 }, (_, lineIndex) => (
          <label key={lineIndex} className="block text-[10px] text-stone-600">
            السطر {lineIndex + 1}: {document.layout.lineOffsets[lineIndex] ?? 0}
            <input
              type="range"
              min={-80}
              max={80}
              step={2}
              value={document.layout.lineOffsets[lineIndex] ?? 0}
              onChange={(event) => setLineOffset(lineIndex, Number(event.target.value))}
              className="mt-1 w-full accent-emerald-600"
            />
          </label>
        ))}
      </div>
    </Section>
  );
}

/** إدارة السطر اليدوي المستقل من الكلمة/المدى الذي يختاره المحرر. */
export function ManualLinesControls() {
  const {
    document,
    selectedWordId,
    addManualLine,
    updateManualLine,
    deleteManualLine,
  } = useEditorStore();
  const [title, setTitle] = useState('سطر إرشادي');
  const [category, setCategory] = useState<VariantCategory>('WAQF');
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const words = useMemo(
    () => documentWindowWords(document),
    [document]
  );
  const selected = words.find((word) => word.id === selectedWordId);

  if (!document) return null;

  const startPosition = Number(startInput) || selected?.position || 0;
  const endPosition = Number(endInput) || startPosition;
  const validRange =
    startPosition >= 1 &&
    endPosition >= startPosition &&
    endPosition <= words.length;

  const add = () => {
    if (!validRange) return;
    addManualLine({
      id: `line-${document.ayahKey}-${startPosition}-${Date.now().toString(36)}`,
      title: title.trim() || 'سطر يدوي',
      category,
      startPosition,
      endPosition,
      lane: document.manualLines.length,
      label: 'يدوي',
    });
    setStartInput('');
    setEndInput('');
  };

  return (
    <Section title="الأسطر اليدوية">
      <p className="mb-2 text-[11px] text-stone-500">
        أضف سطرا دلاليا مستقلا عند كلمة محددة؛ الأفضل أن يرتبط كل وجه علمي باختلافه، وهذا السطر للشرح والتنظيم فقط.
      </p>
      <div className="flex gap-1">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="input h-7 min-w-0 flex-1 text-[11px]"
          placeholder="عنوان السطر"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as VariantCategory)}
          className="h-7 rounded border border-stone-300 bg-white px-1 text-[10px]"
        >
          {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((option) => (
            <option key={option} value={option}>{CATEGORY_LABELS[option]}</option>
          ))}
        </select>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <label className="text-[10px] text-stone-600">
          من كلمة
          <input
            type="number"
            min={1}
            max={words.length}
            value={startInput}
            onChange={(event) => setStartInput(event.target.value)}
            placeholder={selected ? String(selected.position) : '1'}
            className="mt-0.5 h-6 w-full rounded border border-stone-200 px-1 text-[10px]"
          />
        </label>
        <label className="text-[10px] text-stone-600">
          إلى كلمة
          <input
            type="number"
            min={1}
            max={words.length}
            value={endInput}
            onChange={(event) => setEndInput(event.target.value)}
            placeholder={selected ? String(selected.position) : 'نفسها'}
            className="mt-0.5 h-6 w-full rounded border border-stone-200 px-1 text-[10px]"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!validRange}
        onClick={add}
        className="mt-1.5 w-full rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 disabled:opacity-40"
      >
        إضافة سطر للمدى المحدد
      </button>

      {document.manualLines.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {document.manualLines.map((line) => (
            <li key={line.id} className="rounded border border-stone-200 p-1.5">
              <div className="flex items-center gap-1">
                <input
                  value={line.title}
                  onChange={(event) => updateManualLine(line.id, { title: event.target.value })}
                  className="h-6 min-w-0 flex-1 rounded border border-stone-200 px-1.5 text-[10px]"
                />
                <select
                  value={line.category}
                  onChange={(event) => updateManualLine(line.id, { category: event.target.value as VariantCategory })}
                  className="h-6 max-w-14 rounded border border-stone-200 bg-white px-1 text-[9px]"
                  aria-label="فئة السطر"
                >
                  {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((option) => (
                    <option key={option} value={option}>{CATEGORY_LABELS[option]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => deleteManualLine(line.id)}
                  className="text-[10px] text-red-700 hover:underline"
                >
                  حذف
                </button>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-stone-600">
                <label>
                  المسار
                  <input
                    type="number"
                    min={0}
                    value={line.lane}
                    onChange={(event) => updateManualLine(line.id, { lane: Math.max(0, Number(event.target.value)) })}
                    className="mt-0.5 h-5 w-full rounded border border-stone-200 px-1 text-[10px]"
                  />
                </label>
                <label>
                  من
                  <input
                    type="number"
                    min={1}
                    max={words.length}
                    value={line.startPosition}
                    onChange={(event) => {
                      const startPosition = Math.max(1, Number(event.target.value));
                      updateManualLine(line.id, { startPosition, endPosition: Math.max(startPosition, line.endPosition) });
                    }}
                    className="mt-0.5 h-5 w-full rounded border border-stone-200 px-1 text-[10px]"
                  />
                </label>
                <label>
                  إلى
                  <input
                    type="number"
                    min={line.startPosition}
                    max={words.length}
                    value={line.endPosition}
                    onChange={(event) => updateManualLine(line.id, { endPosition: Math.max(line.startPosition, Number(event.target.value)) })}
                    className="mt-0.5 h-5 w-full rounded border border-stone-200 px-1 text-[10px]"
                  />
                </label>
                <label>
                  إزاحة
                  <input
                    type="number"
                    min={-80}
                    max={80}
                    value={line.rowOffset ?? 0}
                    onChange={(event) => updateManualLine(line.id, { rowOffset: Number(event.target.value) })}
                    className="mt-0.5 h-5 w-full rounded border border-stone-200 px-1 text-[10px]"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * التحكم في ترتيب التشجير لهذه الآية بعينها.
 *
 * القاعدة العامة (آخر الآية أولا) وقاعدة قوة الوجه تُضبطان في لوحة التحكم،
 * لكن الكتب تختلف في مواضع بعينها. هذه اللوحة تتيح للمحقق تثبيت رتبة
 * الموضع وترتيب أوجهه داخل هذه الآية وحدها، فيُحفظ قراره مع المستند
 * ويدخل في ملف التصدير ولا يضيع عند إعادة التوليد.
 */
export function TashjeerOrderControls() {
  const catalog = useTransmissionCatalog();
  const {
    document,
    selectedVariantId,
    selectVariant,
    setEffectiveOrderRank,
    moveAlternative,
    resetAlternativeOrder,
  } = useEditorStore();

  const ordered = useMemo(() => {
    if (!document) return [];
    // نعرض المواضع الظاهرة كلها — بما فيها المشتقة من القواعد العامة —
    // بالترتيب الذي يرسمه المحرك فعلا.
    return [...getEffectiveVariants(document)].sort((first, second) => {
      const firstRank = first.orderRank;
      const secondRank = second.orderRank;
      if (typeof firstRank === 'number' && typeof secondRank === 'number' && firstRank !== secondRank) {
        return firstRank - secondRank;
      }
      if (typeof firstRank === 'number' && typeof secondRank !== 'number') return -1;
      if (typeof firstRank !== 'number' && typeof secondRank === 'number') return 1;
      return second.endPosition - first.endPosition || second.startPosition - first.startPosition;
    });
  }, [document]);

  if (!document) return null;

  return (
    <Section title="ترتيب التشجير في هذه الآية">
      <p className="mb-2 text-[11px] leading-relaxed text-stone-500">
        الترتيب الظاهر هو ترتيب الأسطر تحت الآية من أعلى إلى أسفل. ثبّت رتبة الموضع أو انقل
        وجها داخل موضعه عند مخالفة الكتاب للقاعدة العامة.
      </p>

      {ordered.length === 0 ? (
        <p className="rounded bg-stone-50 p-2 text-[11px] text-stone-500">
          لا توجد مواضع اختلاف في هذه الآية بعد.
        </p>
      ) : (
        <ol className="space-y-2">
          {ordered.map((variant, index) => {
            const drawable = variant.alternatives.filter((alternative) => !alternative.isBase);
            const explicit = variant.alternativeOrder ?? [];
            const known = new Set(drawable.map((alternative) => alternative.id));
            const sequence = [
              ...explicit.filter((id) => known.has(id)),
              ...drawable.filter((alternative) => !explicit.includes(alternative.id)).map((a) => a.id),
            ];
            const isSelected = variant.id === selectedVariantId;

            return (
              <li
                key={variant.id}
                className={`rounded border p-2 ${
                  isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-stone-700 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectVariant(isSelected ? null : variant.id)}
                    className="min-w-0 flex-1 truncate text-start text-[11px] font-medium text-stone-800 hover:underline"
                    title={variant.title}
                  >
                    {variant.title}
                  </button>
                  <span className="shrink-0 text-[10px] text-stone-500">
                    {variant.startPosition === variant.endPosition
                      ? `ك${variant.startPosition}`
                      : `ك${variant.startPosition}–${variant.endPosition}`}
                  </span>
                </div>

                <div className="mt-1.5">
                  <OrderRankControl
                    value={variant.orderRank}
                    onChange={(rank) => setEffectiveOrderRank(variant.id, rank)}
                    compact
                    hint={
                      variant.isGlobalDerived
                        ? 'تخصيص لهذا الموضع من القاعدة العامة.'
                        : undefined
                    }
                  />
                </div>

                {sequence.length > 1 && (
                  <ul className="mt-1.5 space-y-1 border-t border-stone-100 pt-1.5">
                    {sequence.map((alternativeId, alternativeIndex) => {
                      const alternative = drawable.find((item) => item.id === alternativeId);
                      if (!alternative) return null;
                      const symbols = resolveScope(alternative.scope, catalog)
                        .map((narratorId) => getNarratorSymbol(narratorId, catalog))
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <li key={alternativeId} className="flex items-center gap-1">
                          <span className="w-3 shrink-0 text-[9px] text-stone-400">
                            {alternativeIndex + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[10px] text-stone-700">
                            {alternative.ruleLabel || alternative.label || alternative.text}
                            {symbols && <span className="text-stone-400"> · {symbols}</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => moveAlternative(variant.id, alternativeId, -1)}
                            disabled={alternativeIndex === 0}
                            className="rounded border border-stone-200 px-1 text-[9px] text-stone-600 hover:bg-stone-50 disabled:opacity-30"
                            aria-label="تقديم الوجه"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAlternative(variant.id, alternativeId, 1)}
                            disabled={alternativeIndex === sequence.length - 1}
                            className="rounded border border-stone-200 px-1 text-[9px] text-stone-600 hover:bg-stone-50 disabled:opacity-30"
                            aria-label="تأخير الوجه"
                          >
                            ▼
                          </button>
                        </li>
                      );
                    })}
                    {variant.alternativeOrder && (
                      <li>
                        <button
                          type="button"
                          onClick={() => resetAlternativeOrder(variant.id)}
                          className="text-[10px] text-stone-500 hover:underline"
                        >
                          إعادة ترتيب الأوجه إلى قاعدة المحرك
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-stone-100 px-4 py-3 last:border-b-0">
      <h3 className="mb-2 text-xs font-bold text-stone-800">{title}</h3>
      {children}
    </section>
  );
}

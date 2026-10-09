// أدوات الوقف والابتداء ومواضع الأسطر داخل محرر الآية

'use client';

import { useMemo, useState } from 'react';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useGlobalRules } from '@/hooks/useGlobalRules';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { useEditorStore } from '@/stores/editor-store';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import {
  listOccurrenceOverrides,
  overrideById,
  localOverrideValues,
} from '@/lib/storage/rule-occurrences-store';
import { OrderRankControl } from './OrderRankControl';
import { LocalOverrideEditor } from './LocalOverrideEditor';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import { normalizeScope, resolveScope } from '@/lib/tashjeer/scope';
import { getNarratorSymbol } from '@/lib/tashjeer/symbols';
import { documentReadingWindow, nextAyahKeyInSurah } from '@/lib/tashjeer/reading-window';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { parseAyahKey } from '@/data/quran';
import type { VariantCategory } from '@/types';
import type { RecitationBoundaryKind } from '@/types/tashjeer';

// Immutable UI identity tables. Keys denote finite controls, never row positions.
const UI_RecitationControls_0 = {
  "WAQF": "A1051",
  "IBTIDA": "A1052",
  "WASL": "A1053",
  "NO_WASL": "A1054"
} as const;

const UI_ManualLinesControls_1 = {
  "TAHQIQ": "A1082",
  "USUL": "A1083",
  "FARSH": "A1084",
  "MADUD": "A1085",
  "HAMZ": "A1086",
  "WAQF": "A1087",
  "TAJWEED": "A1088"
} as const;

const UI_ManualLinesControls_2 = {
  "TAHQIQ": "A1096",
  "USUL": "A1097",
  "FARSH": "A1098",
  "MADUD": "A1099",
  "HAMZ": "A1100",
  "WAQF": "A1101",
  "TAJWEED": "A1102"
} as const;



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
    <Section title="الوقف والابتداء" data-ui-id="A139">
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
              <button data-ui-id={UI_RecitationControls_0[option as keyof typeof UI_RecitationControls_0]}
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
          <input data-ui-id="A1055"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="وصف اختياري: وقف كافٍ، وصل أولى..."
            className="input h-7 text-[11px]"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-stone-700">
            <input data-ui-id="A1056"
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
                  <button data-ui-instance={String(narrator.id)} data-ui-id="A1057"
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
          <button data-ui-id="A1058"
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
        <ul data-ui-id="A1059" className="mt-3 space-y-1.5">
          {document.boundaries.map((boundary) => (
            <li data-ui-instance={String(boundary.id)} data-ui-id="A1060" key={boundary.id} className="rounded border border-stone-200 bg-white p-2">
              <div className="flex items-center gap-1.5">
                <select data-ui-instance={String(boundary.id)} data-ui-id="A1061"
                  value={boundary.kind}
                  onChange={(event) =>
                    updateBoundary(boundary.id, { kind: event.target.value as RecitationBoundaryKind })
                  }
                  className="h-6 rounded border border-stone-300 bg-white px-1 text-[10px]"
                >
                  <option data-ui-id="A1062" value="WAQF">وقف</option>
                  <option data-ui-id="A1063" value="IBTIDA">ابتداء</option>
                  <option data-ui-id="A1064" value="WASL">وصل</option>
                  <option data-ui-id="A1065" value="NO_WASL">ممنوع الوصل</option>
                </select>
                <span className="text-[10px] text-stone-600">عند الكلمة {boundary.position}</span>
                <button data-ui-instance={String(boundary.id)} data-ui-id="A1066"
                  type="button"
                  onClick={() => deleteBoundary(boundary.id)}
                  className="ms-auto text-[10px] text-red-700 hover:underline"
                >
                  حذف
                </button>
              </div>
              <input data-ui-instance={String(boundary.id)} data-ui-id="A1067"
                value={boundary.label ?? ''}
                onChange={(event) => updateBoundary(boundary.id, { label: event.target.value })}
                placeholder="وصف العلامة"
                className="mt-1 h-6 w-full rounded border border-stone-200 px-1.5 text-[10px]"
              />
              {boundary.kind === 'WASL' && boundary.position === words.length && (
                <label className="mt-1 flex items-center gap-1 text-[10px] text-sky-800">
                  <input data-ui-instance={String(boundary.id)} data-ui-id="A1068"
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
              <button data-ui-id="A1069"
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
          <button data-ui-id="A1070"
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
          <button data-ui-id="A1071"
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
              <input data-ui-id="A1072"
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
    <Section data-ui-id="A1073" title="مواضع أسطر النص">
      {engine.singleLineText && (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-900">
          وضع «السطر الواحد» مفعّل، فنص الآية على خط واحد وكسور الأسطر معطّلة. أوقفه من شريط
          الأدوات إن أردت تقسيم الآية أسطرا.
        </p>
      )}
      {selected ? (
        <button data-ui-id="A1075"
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
            <button data-ui-id="A1076"
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
            <input data-ui-id="A1077"
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
    <Section data-ui-id="A1078" title="الأسطر اليدوية">
      <p className="mb-2 text-[11px] text-stone-500">
        أضف سطرا دلاليا مستقلا عند كلمة محددة؛ الأفضل أن يرتبط كل وجه علمي باختلافه، وهذا السطر للشرح والتنظيم فقط.
      </p>
      <div className="flex gap-1">
        <input data-ui-id="A1080"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="input h-7 min-w-0 flex-1 text-[11px]"
          placeholder="عنوان السطر"
        />
        <select data-ui-id="A1081"
          value={category}
          onChange={(event) => setCategory(event.target.value as VariantCategory)}
          className="h-7 rounded border border-stone-300 bg-white px-1 text-[10px]"
        >
          {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((option) => (
            <option data-ui-id={UI_ManualLinesControls_1[option as keyof typeof UI_ManualLinesControls_1]} key={option} value={option}>{CATEGORY_LABELS[option]}</option>
          ))}
        </select>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <label className="text-[10px] text-stone-600">
          من كلمة
          <input data-ui-id="A1089"
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
          <input data-ui-id="A1090"
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
      <button data-ui-id="A1091"
        type="button"
        disabled={!validRange}
        onClick={add}
        className="mt-1.5 w-full rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 disabled:opacity-40"
      >
        إضافة سطر للمدى المحدد
      </button>

      {document.manualLines.length > 0 && (
        <ul data-ui-id="A1092" className="mt-2 space-y-1.5">
          {document.manualLines.map((line) => (
            <li data-ui-instance={String(line.id)} data-ui-id="A1093" key={line.id} className="rounded border border-stone-200 p-1.5">
              <div className="flex items-center gap-1">
                <input data-ui-instance={String(line.id)} data-ui-id="A1094"
                  value={line.title}
                  onChange={(event) => updateManualLine(line.id, { title: event.target.value })}
                  className="h-6 min-w-0 flex-1 rounded border border-stone-200 px-1.5 text-[10px]"
                />
                <select data-ui-instance={String(line.id)} data-ui-id="A1095"
                  value={line.category}
                  onChange={(event) => updateManualLine(line.id, { category: event.target.value as VariantCategory })}
                  className="h-6 max-w-14 rounded border border-stone-200 bg-white px-1 text-[9px]"
                  aria-label="فئة السطر"
                >
                  {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((option) => (
                    <option data-ui-id={UI_ManualLinesControls_2[option as keyof typeof UI_ManualLinesControls_2]} key={option} value={option}>{CATEGORY_LABELS[option]}</option>
                  ))}
                </select>
                <button data-ui-instance={String(line.id)} data-ui-id="A1103"
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
                  <input data-ui-instance={String(line.id)} data-ui-id="A1104"
                    type="number"
                    min={0}
                    value={line.lane}
                    onChange={(event) => updateManualLine(line.id, { lane: Math.max(0, Number(event.target.value)) })}
                    className="mt-0.5 h-5 w-full rounded border border-stone-200 px-1 text-[10px]"
                  />
                </label>
                <label>
                  من
                  <input data-ui-instance={String(line.id)} data-ui-id="A1105"
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
                  <input data-ui-instance={String(line.id)} data-ui-id="A1106"
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
                  <input data-ui-instance={String(line.id)} data-ui-id="A1107"
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
    copySelection,
    cutSelection,
    setDerivedLocalOverride,
    clearDerivedLocalOverride,
    deleteDerivedOccurrence,
    restoreDerivedOccurrence,
  } = useEditorStore();
  const { rules, key: rulesKey } = useGlobalRules();
  const occurrences = useRuleOccurrences();
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const ruleById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);

  const ordered = useMemo(() => {
    void rulesKey; void occurrences.key;
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
  }, [document, rulesKey, occurrences.key]);

  // المواضع المحذوفة في هذه الآية وحدها، ليعيدها المحقق دون مغادرة اللوحة.
  const deletedInAyah = useMemo(() => {
    if (!document) return [];
    void occurrences.key;
    return listOccurrenceOverrides()
      .filter((item) => item.state === 'DELETED' && (item.patch?.placement?.ayahKey ?? item.ayahKey) === document.ayahKey)
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  }, [document, occurrences.key]);

  if (!document) return null;

  const editingVariant = editingVariantId
    ? ordered.find((variant) => variant.id === editingVariantId) ?? null
    : null;
  const editingRule = editingVariant?.globalRuleId ? ruleById.get(editingVariant.globalRuleId) ?? null : null;


  return (
    <Section data-ui-id="A1108" title="ترتيب التشجير في هذه الآية">
      <p className="mb-2 text-[11px] leading-relaxed text-stone-500">
        الترتيب الظاهر هو ترتيب الأسطر تحت الآية من أعلى إلى أسفل. ثبّت رتبة الموضع أو انقل
        وجها داخل موضعه عند مخالفة الكتاب للقاعدة العامة.
      </p>

      {ordered.length === 0 ? (
        <p className="rounded bg-stone-50 p-2 text-[11px] text-stone-500">
          لا توجد مواضع اختلاف في هذه الآية بعد.
        </p>
      ) : (
        <ol data-ui-id="A1110" className="space-y-2">
          {ordered.map((variant, index) => {
            const drawable = variant.alternatives.filter((alternative) => !alternative.isBase);
            const explicit = variant.alternativeOrder ?? [];
            const known = new Set(drawable.map((alternative) => alternative.id));
            const sequence = [
              ...explicit.filter((id) => known.has(id)),
              ...drawable.filter((alternative) => !explicit.includes(alternative.id)).map((a) => a.id),
            ];
            const isSelected = variant.id === selectedVariantId;

            const isDerived = Boolean(variant.isGlobalDerived);
            const rule = variant.globalRuleId ? ruleById.get(variant.globalRuleId) : undefined;
            const isDeleting = deletingVariantId === variant.id;

            return (
              <li data-ui-instance={String(variant.id)} data-ui-id="A1111"
                key={variant.id}
                className={`rounded border p-2 ${
                  isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-stone-700 text-[10px] font-bold text-white">
                    {toArabicDigits(index + 1)}
                  </span>
                  <button data-ui-instance={String(variant.id)} data-ui-id="A1112"
                    type="button"
                    onClick={() => selectVariant(isSelected ? null : variant.id)}
                    className="min-w-0 flex-1 truncate text-start text-[11px] font-medium text-stone-800 hover:underline"
                    title={variant.title}
                  >
                    {variant.title}
                  </button>
                  <span className="shrink-0 text-[10px] text-stone-500">
                    {variant.startPosition === variant.endPosition
                      ? `ك${toArabicDigits(variant.startPosition)}`
                      : `ك${toArabicDigits(variant.startPosition)}–${toArabicDigits(variant.endPosition)}`}
                  </span>
                </div>

                {(
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-600">
                      {isDerived ? 'قاعدة عامة' : variant.origin === 'EDITOR' ? 'يدوي' : 'محرك'}{rule ? ` · ${rule.title}` : ''}
                    </span>
                    {variant.hasLocalOverride && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-900">
                        متجاوز محليًا
                      </span>
                    )}
                  </div>
                )}

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

                {isDerived && (
                  <div className="mt-1.5 border-t border-stone-100 pt-1.5">
                    {isDeleting ? (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-stone-600">
                          حذف هذا الموضع وحده من الآية — القاعدة باقية في سائر المصحف، والحذف
                          قابل للتراجع.
                        </p>
                        <input data-ui-instance={String(variant.id)} data-ui-id="A1113"
                          value={deleteReason}
                          onChange={(event) => setDeleteReason(event.target.value)}
                          placeholder="سبب الحذف (يُحفظ في السجل)"
                          className="w-full rounded border border-stone-300 px-2 py-1 text-[10px]"
                        />
                        <div className="flex items-center gap-1.5">
                          <button data-ui-instance={String(variant.id)} data-ui-id="A1114"
                            type="button"
                            onClick={() => {
                              deleteDerivedOccurrence(variant.id, deleteReason);
                              setDeletingVariantId(null);
                              setDeleteReason('');
                            }}
                            className="rounded bg-rose-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-800"
                          >
                            تأكيد حذف الموضع
                          </button>
                          <button data-ui-id="A1115"
                            type="button"
                            onClick={() => {
                              setDeletingVariantId(null);
                              setDeleteReason('');
                            }}
                            className="rounded border border-stone-300 px-2 py-1 text-[10px] text-stone-600 hover:bg-stone-50"
                          >
                            تراجع
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <button data-ui-instance={String(variant.id)} data-ui-id="A1116"
                          type="button"
                          onClick={() => setEditingVariantId(variant.id)}
                          disabled={!rule}
                          title={rule ? 'تحرير قيم هذا الموضع وحده' : 'القاعدة الأمّ غير موجودة'}
                          className="rounded border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                        >
                          تحرير محلي
                        </button>
                        <button data-ui-instance={String(variant.id)} data-ui-id="A1117"
                          type="button"
                          onClick={() => setDeletingVariantId(variant.id)}
                          className="rounded border border-stone-200 px-1.5 py-0.5 text-[10px] text-rose-700 hover:bg-rose-50"
                        >
                          حذف موضعي
                        </button>
                        {variant.hasLocalOverride && (
                          <button data-ui-instance={String(variant.id)} data-ui-id="A1118"
                            type="button"
                            onClick={() => clearDerivedLocalOverride(variant.id)}
                            title="محو الترقيع والتخصيصات والعودة إلى قيم القاعدة الأمّ"
                            className="rounded border border-amber-300 px-1.5 py-0.5 text-[10px] text-amber-900 hover:bg-amber-50"
                          >
                            إلغاء التجاوز
                          </button>
                        )}
                        <button data-ui-instance={String(variant.id)} data-ui-id="A1119"
                          type="button"
                          onClick={() => { useEditorStore.getState().setMultiSelection(null); selectVariant(variant.id); copySelection(); }}
                          title="نسخ الموضع اختلافًا محليًا مستقلًا قابلًا للتحرير الحر"
                          className="rounded border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-700 hover:bg-stone-50"
                        >
                          نسخ
                        </button>
                        <button data-ui-instance={String(variant.id)} data-ui-id="A1120" type="button" onClick={() => { useEditorStore.getState().setMultiSelection(null); selectVariant(variant.id); cutSelection(); }}
                          title="قص هذا النوع وحده، ثم حدد كلمة (في أي آية) أو سطر هدف والصق؛ المصدر محفوظ حتى التأكيد"
                          className="rounded border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-700 hover:bg-stone-50">
                          نقل
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {sequence.length > 1 && (
                  <ul data-ui-instance={String(variant.id)} data-ui-id="A1121" className="mt-1.5 space-y-1 border-t border-stone-100 pt-1.5">
                    {sequence.map((alternativeId, alternativeIndex) => {
                      const alternative = drawable.find((item) => item.id === alternativeId);
                      if (!alternative) return null;
                      const symbols = resolveScope(alternative.scope, catalog)
                        .map((narratorId) => getNarratorSymbol(narratorId, catalog))
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <li data-ui-id="A1122" key={alternativeId} className="flex items-center gap-1">
                          <span className="w-3 shrink-0 text-[9px] text-stone-400">
                            {toArabicDigits(alternativeIndex + 1)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[10px] text-stone-700">
                            {alternative.ruleLabel || alternative.label || alternative.text}
                            {symbols && <span className="text-stone-400"> · {symbols}</span>}
                          </span>
                          <button data-ui-id="A1123"
                            type="button"
                            onClick={() => moveAlternative(variant.id, alternativeId, -1)}
                            disabled={alternativeIndex === 0}
                            className="rounded border border-stone-200 px-1 text-[9px] text-stone-600 hover:bg-stone-50 disabled:opacity-30"
                            aria-label="تقديم الوجه"
                          >
                            ▲
                          </button>
                          <button data-ui-id="A1124"
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
                      <li data-ui-instance={String(variant.id)} data-ui-id="A1125">
                        <button data-ui-instance={String(variant.id)} data-ui-id="A1126"
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

      {deletedInAyah.length > 0 && (
        <div className="mt-3 rounded border border-stone-200 bg-stone-50 p-2">
          <p className="mb-1.5 text-[11px] font-bold text-stone-700">
            مواضع محذوفة في هذه الآية ({toArabicDigits(deletedInAyah.length)})
          </p>
          <ul data-ui-id="A1127" className="space-y-1">
            {deletedInAyah.map((item) => {
              const rule = ruleById.get(item.ruleId);
              return (
                <li data-ui-instance={String(item.id)} data-ui-id="A1128" key={item.id} className="flex items-center gap-1.5 text-[10px]">
                  <span className="min-w-0 flex-1 truncate text-stone-600">
                    {rule ? rule.title : item.ruleId} · {item.matchedText ?? '—'}
                  </span>
                  <button data-ui-instance={String(item.id)} data-ui-id="A1129"
                    type="button"
                    onClick={() => restoreDerivedOccurrence(item.id)}
                    className="shrink-0 rounded border border-emerald-300 px-1.5 py-0.5 text-emerald-800 hover:bg-emerald-50"
                  >
                    إرجاع
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {editingVariant && editingRule && (
        <LocalOverrideEditor
          variant={editingVariant}
          rule={editingRule}
          currentPatch={localOverrideValues(overrideById(editingVariant.id))}
          originalText={
            editingVariant.globalMatchedText ?? overrideById(editingVariant.id)?.matchedText ??
            editingVariant.alternatives[0]?.text ??
            ''
          }
          onSave={(patch) => {
            setDerivedLocalOverride(editingVariant.id, patch);
            setEditingVariantId(null);
          }}
          onClose={() => setEditingVariantId(null)}
        />
      )}
    </Section>
  );
}

function Section({ title, children, ...attributes }: React.HTMLAttributes<HTMLElement> & { title: string }) {
  return (
    <section {...attributes} className="border-b border-stone-100 px-4 py-3 last:border-b-0">
      <h3 className="mb-2 text-xs font-bold text-stone-800">{title}</h3>
      {children}
    </section>
  );
}

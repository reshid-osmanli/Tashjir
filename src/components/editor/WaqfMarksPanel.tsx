// لوحة علامات الوقف والابتداء - Waqf Marks Panel (DM-07، FR-ED-11)
// مشروع التشجير - نظام القراءات العشر
//
// يدير علامات WaqfMark على الآية المفتوحة: WAQF، IBTIDA، FORBIDDEN_WASL.
// FORBIDDEN_WASL قيد صلب: إن حاول المحرر وصل آيتين بينهما علامة كهذه، ترفض
// العملية في setLinkNextAyah ويُعرض سبب المنع.

'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { WaqfMark, WaqfMarkKind, WaqfMarkScope } from '@/types/tashjeer';

const KIND_LABELS: Record<WaqfMarkKind, { label: string; tone: string; hint: string }> = {
  WAQF: {
    label: 'وقف',
    tone: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    hint: 'يقطع القراءة عند الكلمة. تظهر أحكام الوقف فقط في الموضع.',
  },
  IBTIDA: {
    label: 'ابتداء',
    tone: 'bg-cyan-100 text-cyan-900 border-cyan-200',
    hint: 'يبدأ القراءة من هنا. تُعرض الكلمة كبداية مقطع مستقل.',
  },
  WASL: {
    label: 'وصل',
    tone: 'bg-sky-100 text-sky-900 border-sky-200',
    hint: 'يوصل القراءة بالكلمة التالية. أحكام الوصل فقط تظهر في الموضع.',
  },
  FORBIDDEN_WASL: {
    label: 'ممنوع الوصل',
    tone: 'bg-rose-100 text-rose-900 border-rose-300',
    hint: 'قيد صلب: لا يصل القارئ ما قبل هذا الموضع بما بعده (DM-07).',
  },
};

export function WaqfMarksPanel() {
  const { document, addWaqfMark, updateWaqfMark, deleteWaqfMark, isConnectionForbidden } =
    useEditorStore();
  const [kind, setKind] = useState<WaqfMarkKind>('WAQF');
  const [scope, setScope] = useState<WaqfMarkScope>('INTERNAL');
  const [position, setPosition] = useState<number>(1);
  const [connectsToNextAyah, setConnectsToNextAyah] = useState(false);

  const words = useMemo(() => documentWindowWords(document), [document]);
  const marks = document?.waqfMarks ?? [];

  if (!document) return null;

  const handleAdd = () => {
    if (position < 1 || position > words.length) return;
    addWaqfMark({ kind, position, scope, connectsToNextAyah: scope === 'END_OF_AYAH' && connectsToNextAyah });
  };

  return (
    <section className="rounded-md border border-stone-200 bg-stone-50/60 p-3">
      <header className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-stone-900">علامات الوقف والابتداء</h3>
          <p className="mt-0.5 text-[10px] leading-relaxed text-stone-600">
            «ممنوع الوصل» قيد صلب يمنع الوصل بين الحدّين (FR-ED-11.3).
          </p>
        </div>
        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-700">
          {toArabicDigits(marks.length)} علامة
        </span>
      </header>

      {/* إضافة علامة */}
      <div className="grid gap-1.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as WaqfMarkKind)}
          className="input h-8 text-xs"
        >
          {(Object.keys(KIND_LABELS) as WaqfMarkKind[]).map((key) => (
            <option key={key} value={key}>
              {KIND_LABELS[key].label}
            </option>
          ))}
        </select>
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value as WaqfMarkScope)}
          className="input h-8 text-xs"
        >
          <option value="INTERNAL">داخل الآية</option>
          <option value="END_OF_AYAH">نهاية الآية</option>
        </select>
        <select
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="input h-8 text-xs"
        >
          {words.map((word) => (
            <option key={word.id} value={word.position}>
              الكلمة {toArabicDigits(word.position)}: {word.text}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
        >
          + أضف
        </button>
      </div>

      {scope === 'END_OF_AYAH' && (
        <label className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-700">
          <input
            type="checkbox"
            checked={connectsToNextAyah}
            onChange={(event) => setConnectsToNextAyah(event.target.checked)}
            className="h-3.5 w-3.5 accent-rose-600"
          />
          يربط نهاية هذه الآية بأول الآية التالية (يمنع الوصل بينهما عند التفعيل)
        </label>
      )}

      <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
        {KIND_LABELS[kind].hint}
      </p>

      {/* قائمة العلامات الحالية */}
      <ul className="mt-2 space-y-1.5">
        {marks.map((mark) => (
          <WaqfMarkRow
            key={mark.id}
            mark={mark}
            words={words}
            isForbiddenHere={isConnectionForbidden(mark.position, mark.position)}
            onUpdate={(patch) => updateWaqfMark(mark.id, patch)}
            onDelete={() => deleteWaqfMark(mark.id)}
          />
        ))}
        {marks.length === 0 && (
          <li className="rounded border border-dashed border-stone-300 px-2 py-1.5 text-[11px] text-stone-500">
            لم تُضف علامة بعد.
          </li>
        )}
      </ul>
    </section>
  );
}

function WaqfMarkRow({
  mark,
  words,
  isForbiddenHere,
  onUpdate,
  onDelete,
}: {
  mark: WaqfMark;
  words: { position: number; text: string }[];
  isForbiddenHere: boolean;
  onUpdate: (patch: Partial<WaqfMark>) => void;
  onDelete: () => void;
}) {
  const word = words.find((w) => w.position === mark.position);
  const label = KIND_LABELS[mark.kind].label;
  const tone = KIND_LABELS[mark.kind].tone;
  return (
    <li className="rounded border border-stone-200 bg-white px-2 py-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded border px-1.5 py-0.5 font-medium ${tone}`}>{label}</span>
        <span className="text-stone-600">
          الكلمة {toArabicDigits(mark.position)}
          {word ? ` · ${word.text}` : ''}
          {mark.scope === 'END_OF_AYAH' ? ' · نهاية الآية' : ' · داخل الآية'}
        </span>
        <div className="flex items-center gap-1.5">
          {mark.kind === 'FORBIDDEN_WASL' && (
            <label className="flex items-center gap-1 text-[10px] text-stone-600">
              <input
                type="checkbox"
                checked={Boolean(mark.connectsToNextAyah)}
                onChange={(event) => onUpdate({ connectsToNextAyah: event.target.checked })}
                className="h-3 w-3 accent-rose-600"
              />
              يمتد للآية التالية
            </label>
          )}
          {isForbiddenHere && mark.kind === 'FORBIDDEN_WASL' && (
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-800">
              قيد ساري
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`حذف العلامة «${label}» في الكلمة ${toArabicDigits(mark.position)}؟`)) {
                onDelete();
              }
            }}
            className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] text-red-700 hover:bg-red-50"
          >
            حذف
          </button>
        </div>
      </div>
    </li>
  );
}

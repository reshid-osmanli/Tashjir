// مُحدِّد درجة قوة الوجه — عامة ولكل راوٍ على حدة
//
// القوة عند أهل الأداء ليست صفة مطلقة في الوجه، بل تختلف باختلاف القارئ:
// فوجهٌ مقدَّم عند قالون قد يكون مؤخَّرا عند ورش. لذلك لا يكفي حقل واحد،
// بل يلزم أن يُسأل المحقق عن الدرجة **لكل راوٍ يشمله النطاق**.
//
// وهذا المكوّن هو الموضع الوحيد لهذا السؤال في المشروع: يستعمله منشئ القاعدة
// العامة، ومحرر الوجه الموضعي، ونافذة تعديل القاعدة في الفهرس، حتى لا تختلف
// الصياغة ولا سلوك التخصيص من شاشة إلى أخرى.

'use client';

import { useMemo, useState } from 'react';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { resolveScope } from '@/lib/tashjeer/scope';
import {
  createStrengthDegreeId,
  pruneStrengthMap,
  saveStrengthDegrees,
  type StrengthDegree,
} from '@/lib/tashjeer/strength-degrees';
import type { ReaderStrengthMap, ReadingScope } from '@/types/tashjeer';

interface StrengthDegreePickerProps {
  scope: ReadingScope;
  /** الدرجة العامة: تنطبق على كل راوٍ لم يُخصَّص له تخصيص صريح. */
  degreeId?: string;
  /** التخصيصات: معرّف الراوي ← معرّف الدرجة. */
  byNarrator?: ReaderStrengthMap;
  onChange: (next: { degreeId?: string; byNarrator?: ReaderStrengthMap }) => void;
  /** نصّ توضيحي إضافي يظهر تحت العنوان. */
  hint?: string;
}

export function StrengthDegreePicker({
  scope,
  degreeId,
  byNarrator,
  onChange,
  hint,
}: StrengthDegreePickerProps) {
  const catalog = useTransmissionCatalog();
  const strengthDegrees = useStrengthDegrees();
  const [expanded, setExpanded] = useState(() => Object.keys(byNarrator ?? {}).length > 0);
  const [addingDegree, setAddingDegree] = useState(false);
  const [newDegreeLabel, setNewDegreeLabel] = useState('');

  const narratorIds = useMemo(() => resolveScope(scope, catalog), [scope, catalog]);
  const narratorById = useMemo(
    () => new Map(catalog.narrators.map((narrator) => [narrator.id, narrator])),
    [catalog.narrators]
  );
  const imamById = useMemo(
    () => new Map(catalog.imams.map((imam) => [imam.id, imam])),
    [catalog.imams]
  );

  const degrees = strengthDegrees.degrees;
  const customCount = useMemo(
    () => narratorIds.filter((id) => Boolean(byNarrator?.[id])).length,
    [byNarrator, narratorIds]
  );

  const setGeneral = (value: string) => {
    onChange({ degreeId: value || undefined, byNarrator });
  };

  const setForNarrator = (narratorId: string, value: string) => {
    const next: ReaderStrengthMap = { ...(byNarrator ?? {}) };
    if (!value) delete next[narratorId];
    else next[narratorId] = value;
    onChange({ degreeId, byNarrator: pruneStrengthMap(next, narratorIds) });
  };

  /** يثبّت الدرجة العامة على كل راوٍ، فيبدأ المحقق من أرضية واحدة ثم يستثني. */
  const spreadGeneral = () => {
    if (!degreeId) return;
    const next: ReaderStrengthMap = {};
    for (const narratorId of narratorIds) next[narratorId] = byNarrator?.[narratorId] ?? degreeId;
    onChange({ degreeId, byNarrator: pruneStrengthMap(next, narratorIds) });
    setExpanded(true);
  };

  const clearCustom = () => {
    onChange({ degreeId, byNarrator: undefined });
  };

  /**
   * إضافة درجة جديدة إلى السلّم من هنا مباشرة، دون مغادرة النموذج إلى
   * الإعدادات. تُلحق آخر السلّم (الأضعف)، ويمكن ترتيبها لاحقا من الإعدادات.
   */
  const addDegree = () => {
    const label = newDegreeLabel.trim();
    if (!label) return;
    const id = createStrengthDegreeId();
    const saved = saveStrengthDegrees({
      degrees: [
        ...strengthDegrees.degrees,
        {
          id,
          label,
          shortLabel: label,
          rank: strengthDegrees.degrees.length + 1,
          color: '#7c3aed',
        },
      ],
    });
    setAddingDegree(false);
    setNewDegreeLabel('');
    // نختار الدرجة الجديدة درجةً عامة فورا؛ هذا هو مقصود من أضافها هنا غالبا.
    if (saved.degrees.some((degree) => degree.id === id)) {
      onChange({ degreeId: id, byNarrator });
    }
  };

  return (
    <div className="rounded-md border border-indigo-200 bg-indigo-50/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-indigo-950">درجة قوة الوجه (وتشمل «الوجه المقدَّم»)</h3>
          <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-indigo-900/75">
            {hint ??
              'أعلى الدرجات هي الوجه المقدَّم في الأداء. والدرجة تختلف بالرواة، فما كان مقدَّما عند راوٍ قد يكون مؤخَّرا عند غيره؛ لذلك يمكن تخصيص درجة كل راوٍ على حدة.'}
          </p>
        </div>
        <span className="rounded bg-white px-2 py-1 text-[11px] text-indigo-900">
          {narratorIds.length} راويا في النطاق
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-[14rem] flex-1">
          <span className="mb-1 block text-[11px] font-medium text-indigo-950">
            الدرجة العامة (لمن لم يُخصَّص)
          </span>
          <select
            value={degreeId ?? ''}
            onChange={(event) => setGeneral(event.target.value)}
            className="input"
          >
            <option value="">بلا درجة</option>
            {degrees.map((degree) => (
              <option key={degree.id} value={degree.id}>
                {degree.rank}. {degree.label}
                {degree.isPreferred ? ' — الوجه المقدَّم' : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setAddingDegree((value) => !value)}
          className="rounded border border-indigo-300 bg-white px-2.5 py-2 text-[11px] text-indigo-900 hover:bg-indigo-50"
          title="إضافة درجة جديدة إلى سلّم القوة دون مغادرة هذا النموذج"
        >
          + درجة جديدة
        </button>
        <button
          type="button"
          onClick={spreadGeneral}
          disabled={!degreeId || narratorIds.length === 0}
          className="rounded border border-indigo-300 bg-white px-2.5 py-2 text-[11px] text-indigo-900 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ابدأ من هذه الدرجة لكل راوٍ
        </button>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          disabled={narratorIds.length === 0}
          className="rounded border border-indigo-300 bg-white px-2.5 py-2 text-[11px] text-indigo-900 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {expanded ? 'إخفاء التخصيص لكل راوٍ' : 'تخصيص الدرجة لكل راوٍ'}
        </button>
        {customCount > 0 && (
          <button
            type="button"
            onClick={clearCustom}
            className="rounded border border-rose-200 bg-white px-2.5 py-2 text-[11px] text-rose-700 hover:bg-rose-50"
          >
            مسح التخصيصات ({customCount})
          </button>
        )}
      </div>

      {addingDegree && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded border border-indigo-200 bg-white p-2">
          <label className="block min-w-[12rem] flex-1">
            <span className="mb-1 block text-[11px] font-medium text-indigo-950">اسم الدرجة الجديدة</span>
            <input
              value={newDegreeLabel}
              onChange={(event) => setNewDegreeLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addDegree();
                }
              }}
              className="input"
              placeholder="مثال: مقروء به وليس مأخوذا به"
              autoFocus
            />
          </label>
          <button
            type="button"
            onClick={addDegree}
            disabled={!newDegreeLabel.trim()}
            className="rounded bg-indigo-600 px-3 py-2 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            إضافة إلى السلّم
          </button>
          <button
            type="button"
            onClick={() => {
              setAddingDegree(false);
              setNewDegreeLabel('');
            }}
            className="rounded border border-stone-300 px-3 py-2 text-[11px] text-stone-700 hover:bg-stone-50"
          >
            إلغاء
          </button>
          <p className="w-full text-[10px] text-indigo-900/70">
            تُضاف آخر السلّم (الأضعف رتبة). لإعادة ترتيبها أو تلوينها افتح الإعدادات ← درجات القوة.
          </p>
        </div>
      )}

      {degreeId && <DegreeHint degree={degrees.find((degree) => degree.id === degreeId)} />}

      {expanded && narratorIds.length > 0 && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded border border-indigo-100 bg-white">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-indigo-50 text-indigo-950">
              <tr>
                <th className="px-2 py-1.5 text-start font-semibold">الراوي</th>
                <th className="px-2 py-1.5 text-start font-semibold">القارئ</th>
                <th className="px-2 py-1.5 text-start font-semibold">الدرجة</th>
              </tr>
            </thead>
            <tbody>
              {narratorIds.map((narratorId) => {
                const narrator = narratorById.get(narratorId);
                const imam = narrator ? imamById.get(narrator.imamId) : undefined;
                const value = byNarrator?.[narratorId] ?? '';
                return (
                  <tr key={narratorId} className="border-t border-stone-100">
                    <td className="px-2 py-1 text-stone-800">{narrator?.name ?? narratorId}</td>
                    <td className="px-2 py-1 text-stone-500">{imam?.name ?? '—'}</td>
                    <td className="px-2 py-1">
                      <select
                        value={value}
                        onChange={(event) => setForNarrator(narratorId, event.target.value)}
                        className="w-full rounded border border-stone-200 bg-white px-1.5 py-1 text-[11px]"
                        aria-label={`درجة ${narrator?.name ?? narratorId}`}
                      >
                        <option value="">
                          {degreeId
                            ? `مثل العامة (${degrees.find((degree) => degree.id === degreeId)?.label ?? '—'})`
                            : 'بلا درجة'}
                        </option>
                        {degrees.map((degree) => (
                          <option key={degree.id} value={degree.id}>
                            {degree.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {narratorIds.length === 0 && (
        <p className="mt-2 rounded border border-dashed border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          حدّد النطاق أولا (قارئا أو راويا) حتى تظهر قائمة الرواة لتخصيص الدرجات.
        </p>
      )}
    </div>
  );
}

function DegreeHint({ degree }: { degree?: StrengthDegree }) {
  if (!degree?.description) return null;
  return (
    <p className="mt-2 flex items-center gap-2 text-[11px] text-indigo-900/80">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: degree.color }}
        aria-hidden
      />
      {degree.description}
    </p>
  );
}

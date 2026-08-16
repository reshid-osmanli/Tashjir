// إدارة سلّم درجات قوة الوجه
//
// كانت الدرجات أربعا ثابتة في الشيفرة. والمحقق قد يحتاج خامسة («مقروء به
// وليس مأخوذا به») أو أقل، فجُعل السلّم بيانات محرَّرة من الإعدادات.
//
// الترتيب هو المعنى: الرتبة 1 هي الأقوى، وسطرها يُرسم أعلى الأسطر تحت الآية،
// وواحدة من الدرجات تحمل علامة «الوجه المقدَّم» بعد دمج المفهومين.

'use client';

import { useEffect, useState } from 'react';
import {
  createDefaultStrengthDegrees,
  createStrengthDegreeId,
  normalizeStrengthDegrees,
  readStrengthDegrees,
  resetStrengthDegrees,
  saveStrengthDegrees,
  type StrengthDegree,
} from '@/lib/tashjeer/strength-degrees';

const PALETTE = ['#047857', '#0e7490', '#a16207', '#b45309', '#7c3aed', '#be123c', '#0f766e', '#4338ca'];

export function StrengthDegreesManager({ onMessage }: { onMessage?: (message: string) => void }) {
  const [degrees, setDegrees] = useState<StrengthDegree[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDegrees(readStrengthDegrees().degrees);
  }, []);

  const patch = (id: string, changes: Partial<StrengthDegree>) => {
    setDegrees((current) => current.map((degree) => (degree.id === id ? { ...degree, ...changes } : degree)));
    setDirty(true);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= degrees.length) return;
    const next = [...degrees];
    [next[index], next[target]] = [next[target], next[index]];
    setDegrees(next.map((degree, position) => ({ ...degree, rank: position + 1 })));
    setDirty(true);
  };

  const add = () => {
    const label = `درجة ${degrees.length + 1}`;
    setDegrees((current) => [
      ...current,
      {
        id: createStrengthDegreeId(),
        label,
        shortLabel: label,
        rank: current.length + 1,
        color: PALETTE[current.length % PALETTE.length],
      },
    ]);
    setDirty(true);
  };

  const remove = (id: string) => {
    const degree = degrees.find((item) => item.id === id);
    if (!degree) return;
    if (
      !window.confirm(
        `حذف درجة «${degree.label}»؟ الأوجه المسنَدة إليها ستصبح بلا درجة حتى تُسنَد إلى غيرها.`
      )
    ) {
      return;
    }
    setDegrees((current) =>
      current.filter((item) => item.id !== id).map((item, index) => ({ ...item, rank: index + 1 }))
    );
    setDirty(true);
  };

  // «المقدَّم» علامة واحدة لا تتعدد، فاختيار درجة يُلغي ما قبلها تلقائيا.
  const setPreferred = (id: string) => {
    setDegrees((current) => current.map((degree) => ({ ...degree, isPreferred: degree.id === id })));
    setDirty(true);
  };

  const save = () => {
    const saved = saveStrengthDegrees({ degrees });
    setDegrees(saved.degrees);
    setDirty(false);
    onMessage?.(`تم حفظ سلّم الدرجات (${saved.degrees.length} درجات).`);
  };

  const restoreDefaults = () => {
    if (!window.confirm('استعادة الدرجات الأربع المعهودة؟ سيُستبدل السلّم الحالي.')) return;
    const restored = resetStrengthDegrees();
    setDegrees(restored.degrees);
    setDirty(false);
    onMessage?.('تمت استعادة سلّم الدرجات الافتراضي.');
  };

  const preview = normalizeStrengthDegrees({ degrees });
  const duplicateLabels = findDuplicates(degrees.map((degree) => degree.label.trim()));

  return (
    <div>
      <p className="mb-3 rounded bg-stone-50 px-3 py-2 text-[11px] leading-relaxed text-stone-600">
        هذا السلّم يجمع «الوجه المقدَّم» و«قوة الوجه» في مقياس واحد. الرتبة الأولى هي الأقوى ويُرسم سطرها أعلى
        الأسطر تحت الآية. والدرجة تُسنَد لكل راوٍ على حدة عند إنشاء القاعدة أو الوجه، لأن ما يقدَّم عند راوٍ قد
        يؤخَّر عند غيره.
      </p>

      <div className="overflow-x-auto rounded-md border border-stone-200">
        <table className="w-full text-xs">
          <thead className="bg-stone-50 text-stone-700">
            <tr>
              <th className="px-2 py-2 text-start font-semibold">الرتبة</th>
              <th className="px-2 py-2 text-start font-semibold">الاسم</th>
              <th className="px-2 py-2 text-start font-semibold">مختصر</th>
              <th className="px-2 py-2 text-start font-semibold">اللون</th>
              <th className="px-2 py-2 text-start font-semibold">الشرح</th>
              <th className="px-2 py-2 text-center font-semibold">المقدَّم</th>
              <th className="px-2 py-2 text-center font-semibold">ترتيب</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {degrees.map((degree, index) => (
              <tr key={degree.id} className="border-t border-stone-100 align-top">
                <td className="px-2 py-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: degree.color }}
                  >
                    {index + 1}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <input
                    value={degree.label}
                    onChange={(event) => patch(degree.id, { label: event.target.value })}
                    className="input !py-1 !text-xs"
                    aria-label="اسم الدرجة"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={degree.shortLabel ?? ''}
                    onChange={(event) => patch(degree.id, { shortLabel: event.target.value })}
                    className="input !w-24 !py-1 !text-xs"
                    aria-label="اختصار الدرجة"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="color"
                    value={degree.color}
                    onChange={(event) => patch(degree.id, { color: event.target.value })}
                    className="h-7 w-10 cursor-pointer rounded border border-stone-300"
                    aria-label="لون الدرجة"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={degree.description ?? ''}
                    onChange={(event) => patch(degree.id, { description: event.target.value })}
                    className="input !py-1 !text-xs"
                    placeholder="شرح يظهر للمحقق عند الاختيار"
                    aria-label="شرح الدرجة"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="radio"
                    name="preferred-degree"
                    checked={Boolean(degree.isPreferred)}
                    onChange={() => setPreferred(degree.id)}
                    className="h-4 w-4 accent-emerald-600"
                    aria-label={`اجعل «${degree.label}» هي الوجه المقدَّم`}
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="rounded border border-stone-300 px-1.5 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100 disabled:opacity-30"
                      title="تقوية الدرجة"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === degrees.length - 1}
                      className="rounded border border-stone-300 px-1.5 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100 disabled:opacity-30"
                      title="تأخير الدرجة"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="px-2 py-2 text-end">
                  <button
                    type="button"
                    onClick={() => remove(degree.id)}
                    disabled={degrees.length <= 1}
                    className="rounded border border-red-200 px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-30"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {duplicateLabels.length > 0 && (
        <p className="mt-2 rounded bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
          تنبيه: تكرّر الاسم ({duplicateLabels.join('، ')}). الأسماء المتشابهة تُربك المحقق عند الاختيار.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
        >
          + درجة جديدة
        </button>
        <button
          type="button"
          onClick={restoreDefaults}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
        >
          استعادة الدرجات المعهودة
        </button>
        <span className="ms-auto text-[11px] text-stone-500">
          {dirty ? 'توجد تعديلات غير محفوظة.' : 'السلّم محفوظ.'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || degrees.length === 0}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          حفظ السلّم
        </button>
      </div>

      {/* معاينة الترتيب النهائي بعد التسوية، فيرى المحقق أثر تعديله قبل الحفظ. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-stone-500">المعاينة (الأقوى أولا):</span>
        {preview.degrees.map((degree) => (
          <span
            key={degree.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-white"
            style={{ backgroundColor: degree.color }}
            title={degree.description}
          >
            {degree.rank}. {degree.label}
            {degree.isPreferred ? ' ★' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/** يُستعمل في الاختبار السريع للتأكد من عدم كسر السلّم الافتراضي. */
export const DEFAULT_DEGREE_COUNT = createDefaultStrengthDegrees().degrees.length;

// مستضيف حوار التأكيد بالسبب الإلزامي — Reason Dialog Host (FR-ES-07.5، FR-ES-08.2)
// مشروع التشجير - نظام القراءات العشر
//
// حوار عربي RTL بأرقام عربية: التحذيرات، والأثر الكمي، وفرق قبل/بعد (عند
// الانحدار)، وحقل سبب **إلزامي** لا يُقبل التأكيد بدونه. Esc يلغي، وCtrl+Enter
// يؤكد (Enter داخل الحقل يكتب سطرًا جديدًا لا تأكيدًا عرضيًا).

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatImpact } from '@/lib/ui/confirm-store';
import { isReasonSufficient, useReasonConfirmStore } from '@/lib/ui/reason-confirm-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

export function ReasonDialogHost() {
  const pending = useReasonConfirmStore((state) => state.pending);
  const resolve = useReasonConfirmStore((state) => state.resolve);
  const setHostMounted = useReasonConfirmStore((state) => state.setHostMounted);
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setHostMounted(true);
    return () => setHostMounted(false);
  }, [setHostMounted]);

  // كل طلب جديد يبدأ بسبب فارغ وتركيز على الحقل (لا نص باقٍ من طلب سابق).
  const requestId = pending?.id;
  useEffect(() => {
    setReason('');
    if (requestId !== undefined) reasonRef.current?.focus();
  }, [requestId]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resolve(false);
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        resolve(true, reason);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, reason, resolve]);

  const sufficient = useMemo(
    () => (pending ? isReasonSufficient(pending, reason) : false),
    [pending, reason]
  );

  if (!pending) return null;

  const danger = pending.tone === 'danger';
  const impacts = (pending.impacts ?? []).filter((item) => item.count > 0);
  const diff = pending.diff ?? [];
  const min = pending.minReasonLength ?? 3;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reason-confirm-title"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) resolve(false);
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">
        <header className="border-b border-stone-200 px-5 py-4">
          <h2 id="reason-confirm-title" className="text-base font-bold text-stone-900">
            {pending.title}
          </h2>
          {pending.message && <p className="mt-1 text-sm leading-relaxed text-stone-600">{pending.message}</p>}
        </header>

        <div className="space-y-3 px-5 py-4">
          {(pending.warnings ?? []).length > 0 && (
            <ul className="space-y-1.5">
              {(pending.warnings ?? []).map((warning, index) => (
                <li
                  key={index}
                  className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    danger ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {warning}
                </li>
              ))}
            </ul>
          )}

          {impacts.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-700">ما سيتأثر</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {impacts.map((item, index) => (
                  <li
                    key={index}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      danger ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {formatImpact(item)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diff.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-stone-200">
              <p className="border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700">
                الفرق (قبل ← بعد)
              </p>
              <table className="w-full text-right text-xs">
                <tbody className="divide-y divide-stone-100">
                  {diff.slice(0, 12).map((row, index) => (
                    <tr key={index}>
                      <td className="w-28 px-3 py-1.5 font-medium text-stone-600">{row.label}</td>
                      <td className="px-2 py-1.5 text-red-700 line-through decoration-red-300">{row.before ?? '—'}</td>
                      <td className="px-2 py-1.5 text-emerald-700">{row.after ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {diff.length > 12 && (
                <p className="bg-stone-50 px-3 py-1.5 text-xs text-stone-500">
                  و{toArabicDigits(diff.length - 12)} سطرًا آخر في سجل التدقيق.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="reason-confirm-input" className="text-xs font-semibold text-stone-700">
              {pending.reasonLabel ?? 'السبب (إلزامي — يُحفظ في الإصدار وسجل التدقيق)'}
            </label>
            <textarea
              id="reason-confirm-input"
              ref={reasonRef}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder={pending.reasonPlaceholder ?? 'مثال: خفض الأولوية لأن قاعدة المنع أخصّ…'}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className={`mt-1 text-xs ${sufficient ? 'text-stone-500' : 'text-red-600'}`}>
              {sufficient
                ? `${toArabicDigits(reason.trim().length)} حرفًا — يكفي للتوثيق.`
                : `اكتب ${toArabicDigits(min)} أحرف على الأقل.`}
            </p>
          </div>

          <p
            className={`rounded-lg px-3 py-2 text-xs ${
              pending.undoable ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {pending.undoable
              ? 'يمكن الرجوع إلى الإصدار السابق من سلسلة إصدارات القاعدة بعد التنفيذ.'
              : 'لا يُحذف تاريخ: يُحفظ إصدار جديد ويمكن الرجوع إليه من سلسلة الإصدارات.'}
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <button
            type="button"
            onClick={() => resolve(false)}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {pending.cancelLabel ?? 'إلغاء'}
          </button>
          <button
            type="button"
            onClick={() => resolve(true, reason)}
            disabled={!sufficient}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400'
                : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400'
            }`}
          >
            {pending.confirmLabel ?? 'تأكيد بالسبب'}
          </button>
        </footer>
      </div>
    </div>
  );
}

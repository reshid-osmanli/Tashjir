// مستضيف حوار التأكيد الكمي - Confirm Dialog Host (FR-ED-04.2، NFR-05)
// مشروع التشجير - نظام القراءات العشر
//
// يُركَّب مرة واحدة في تخطيط لوحة التحكم، ويعرض أي طلب تأكيد صادر من
// confirmAction() بحوار عربي RTL: العنوان، الوصف، الأثر الكمي، وهل العملية
// قابلة للتراجع. Esc يلغي، وEnter يؤكد، والتركيز يبدأ على زر الإلغاء حماية
// من التأكيد العرضي.

'use client';

import { useEffect, useRef } from 'react';
import { formatImpact, useConfirmStore } from '@/lib/ui/confirm-store';

export function ConfirmDialogHost() {
  const pending = useConfirmStore((state) => state.pending);
  const resolve = useConfirmStore((state) => state.resolve);
  const setHostMounted = useConfirmStore((state) => state.setHostMounted);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHostMounted(true);
    return () => setHostMounted(false);
  }, [setHostMounted]);

  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); resolve(false);
      } else if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
      // Enter activates the focused button natively (initially Cancel), never a global confirmation.
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); previous?.focus(); };
  }, [pending, resolve]);

  if (!pending) return null;

  const danger = pending.tone !== 'default';
  const impacts = (pending.impacts ?? []).filter((item) => item.count > 0);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) resolve(false);
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <header className="border-b border-stone-200 px-5 py-4">
          <h2 id="confirm-title" className="text-base font-bold text-stone-900">
            {pending.title}
          </h2>
          {pending.message && <p className="mt-1 text-sm leading-relaxed text-stone-600">{pending.message}</p>}
        </header>

        <div className="space-y-3 px-5 py-4">
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

          <p
            className={`rounded-lg px-3 py-2 text-xs ${
              pending.undoable ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {pending.undoable
              ? 'يمكن التراجع عن هذه العملية بعد تنفيذها (تراجع / Ctrl+Z).'
              : 'لا يمكن التراجع عن هذه العملية بعد تنفيذها.'}
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => resolve(false)}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            {pending.cancelLabel ?? 'إلغاء'}
          </button>
          <button
            type="button"
            onClick={() => resolve(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 ${
              danger
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400'
                : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400'
            }`}
          >
            {pending.confirmLabel ?? 'تأكيد'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// نافذة الاختصارات - Shortcuts Dialog
// مشروع التشجير - نظام القراءات العشر
//
// تعرض اختصارات لوحة المفاتيح المدعومة. مصدر القائمة هو ملف الاختصارات نفسه
// (SHORTCUT_HINTS) حتى لا يتفرق التوثيق عن السلوك.

'use client';

import { SHORTCUT_HINTS } from '@/hooks/useKeyboardShortcuts';

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="اختصارات لوحة المفاتيح"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">اختصارات لوحة المفاتيح</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100"
          >
            إغلاق
          </button>
        </div>

        <ul className="divide-y divide-stone-100">
          {SHORTCUT_HINTS.map((hint) => (
            <li key={hint.keys} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-xs text-stone-600">{hint.description}</span>
              <kbd className="rounded border border-stone-300 bg-stone-50 px-2 py-0.5 font-mono text-[11px] text-stone-700">
                {hint.keys}
              </kbd>
            </li>
          ))}
        </ul>

        <p className="mt-3 rounded bg-stone-50 px-2.5 py-2 text-[11px] leading-relaxed text-stone-600">
          للتكبير داخل اللوحة استعمل عجلة الفأرة مع Ctrl. وللتحريك اسحب مساحة فارغة
          أو استعمل زر الفأرة الأوسط.
        </p>
      </div>
    </div>
  );
}

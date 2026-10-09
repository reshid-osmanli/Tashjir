// نافذة الاختصارات - Shortcuts Dialog
// مشروع التشجير - نظام القراءات العشر
//
// تعرض اختصارات لوحة المفاتيح المدعومة. مصدر القائمة هو ملف الاختصارات نفسه
// (SHORTCUT_HINTS) حتى لا يتفرق التوثيق عن السلوك.

'use client';

import { SHORTCUT_HINTS } from '@/hooks/useKeyboardShortcuts';

// Immutable UI identity tables. Keys denote finite controls, never row positions.
const UI_ShortcutsDialog_0 = {
  "V": "A1300",
  "M": "A1301",
  "E": "A1302",
  "Ctrl + S": "A1303",
  "Ctrl + Z": "A1304",
  "Ctrl + Shift + Z": "A1305",
  "Ctrl + =": "A1306",
  "Ctrl + -": "A1307",
  "Ctrl + 0": "A1308",
  "Ctrl + عجلة الفأرة": "A1309",
  "Alt + سحب": "A1310",
  "G": "A1311",
  "L": "A1312",
  "P": "A1313",
  "B": "A1314",
  "N": "A1315",
  "Ctrl + C": "A1316",
  "Ctrl + X": "A1317",
  "Ctrl + V": "A1318",
  "Ctrl + نقر": "A1319",
  "Shift + نقر": "A1320",
  "Ctrl + A": "A1321",
  "Alt + ↑ / Alt + ↓": "A1322",
  "Esc": "A1323"
} as const;



export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      data-ui-id="A131"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="اختصارات لوحة المفاتيح"
      onClick={onClose}
    >
      <div data-ui-id="A1297"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">اختصارات لوحة المفاتيح</h2>
          <button data-ui-id="A1298"
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100"
          >
            إغلاق
          </button>
        </div>

        <ul data-ui-id="A1299" className="divide-y divide-stone-100">
          {SHORTCUT_HINTS.map((hint) => (
            <li data-ui-id={UI_ShortcutsDialog_0[hint.keys as keyof typeof UI_ShortcutsDialog_0]} key={hint.keys} className="flex items-center justify-between gap-3 py-1.5">
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

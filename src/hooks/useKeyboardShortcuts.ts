// اختصارات لوحة المفاتيح - Keyboard Shortcuts
// مشروع التشجير - نظام القراءات العشر
//
// المحرر الاحترافي يُقاس بسرعة العمل فيه. هذا الخطاف يربط الاختصارات
// بإجراءات المخزن مباشرة.
//
// قاعدة مهمة: تُتجاهل الاختصارات إذا كان المستخدم يكتب في حقل إدخال،
// حتى لا يحذف زر D اختلافا بينما هو يكتب عنوانه.

'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/stores/editor-store';

/** وصف اختصار واحد، يُعرض في نافذة المساعدة. */
export interface ShortcutHint {
  keys: string;
  description: string;
}

/** قائمة الاختصارات المدعومة، مصدرها هذا الملف حتى لا يتفرق التوثيق. */
export const SHORTCUT_HINTS: ShortcutHint[] = [
  { keys: 'V', description: 'أداة التحديد' },
  { keys: 'M', description: 'أداة تعليم الكلمات أو الحروف' },
  { keys: 'E', description: 'أداة المسح' },
  { keys: 'Ctrl + S', description: 'حفظ المستند' },
  { keys: 'Ctrl + C', description: 'نسخ السطر أو الجزء أو الوجه المحدد (حتى جزء من السطر)' },
  { keys: 'Ctrl + X', description: 'قص العنصر المحدد' },
  { keys: 'Ctrl + V', description: 'لصق - ينشئ ID جديد وبيانات مستقلة' },
  { keys: 'Ctrl + D', description: 'نسخ السطر المحدد' },
  { keys: 'Ctrl + Z', description: 'تراجع عن النقل/الدمج/الحذف/التعميم' },
  { keys: 'Ctrl + Shift + Z / Ctrl + Y', description: 'إعادة' },
  { keys: 'Ctrl + = / +', description: 'تكبير' },
  { keys: 'Ctrl + -', description: 'تصغير' },
  { keys: 'Ctrl + 0', description: 'ملء العرض وإعادة الضبط' },
  { keys: 'Ctrl + عجلة الفأرة', description: 'تكبير وتصغير عند المؤشر' },
  { keys: 'Alt + سحب', description: 'تحريك اللوحة من أي موضع' },
  { keys: 'سحب السطر', description: 'إعادة ترتيب السطر بالسحب - تأكيد قبل النقل' },
  { keys: 'Shift + سحب', description: 'دمج سطرين بالسحب - تأكيد قبل الدمج' },
  { keys: 'Ctrl + نقر على وجه', description: 'تحديد عدة أوجه دفعة واحدة' },
  { keys: 'G', description: 'إظهار الشبكة' },
  { keys: 'L', description: 'إظهار بطاقات الأوجه' },
  { keys: 'P', description: 'لوحة الخصائص - تظهر تفاصيل السطر والآية' },
  { keys: 'B', description: 'لوحة الاختلافات - Scrollable احترافي' },
  { keys: 'Esc', description: 'إلغاء التعليم والتحديد' },
];

/**
 * يفعّل اختصارات المحرر على مستوى النافذة.
 *
 * @param enabled تعطيل الاختصارات عند فتح نافذة منبثقة مثلا
 */
export function useKeyboardShortcuts(enabled = true): void {
  const store = useEditorStore();

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const withModifier = event.ctrlKey || event.metaKey;

      if (withModifier) {
        switch (event.key.toLowerCase()) {
          case 's':
            event.preventDefault();
            store.save();
            return;
          case 'c':
            event.preventDefault();
            store.copySelection();
            return;
          case 'x':
            event.preventDefault();
            store.cutSelection();
            return;
          case 'v':
            event.preventDefault();
            store.pasteSelection();
            return;
          case 'd':
            event.preventDefault();
            if (store.selectedVariantId) store.duplicateVariant(store.selectedVariantId);
            return;
          case 'z':
            event.preventDefault();
            if (event.shiftKey) store.redo();
            else store.undo();
            return;
          case 'y':
            event.preventDefault();
            store.redo();
            return;
          case '=':
          case '+':
            event.preventDefault();
            store.zoomIn();
            return;
          case '-':
            event.preventDefault();
            store.zoomOut();
            return;
          case '0':
            event.preventDefault();
            store.resetView();
            return;
          default:
            return;
        }
      }

      switch (event.key.toLowerCase()) {
        case 'v':
          store.setTool('select');
          break;
        case 'm':
          store.setTool('mark');
          break;
        case 'e':
          store.setTool('erase');
          break;
        case 'g':
          store.setFilter({ showGrid: !store.filter.showGrid });
          break;
        case 'l':
          store.setFilter({ showLabels: !store.filter.showLabels });
          break;
        case 'p':
          store.togglePropertiesPanel();
          break;
        case 'b':
          store.toggleVariantsPanel();
          break;
        case 'escape':
          store.clearMarks();
          store.selectVariant(null);
          store.selectWord(null);
          store.selectBranch(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, store]);
}

/** هل المستخدم يكتب الآن في حقل إدخال أو منطقة نص؟ */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

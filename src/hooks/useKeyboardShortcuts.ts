// اختصارات لوحة المفاتيح - Keyboard Shortcuts
// مشروع التشجير - نظام القراءات العشر
//
// المحرر الاحترافي يُقاس بسرعة العمل فيه. هذا الخطاف يربط الاختصارات
// بإجراءات المخزن مباشرة.
//
// قاعدة مهمة: تُتجاهل الاختصارات إذا كان المستخدم يكتب في حقل إدخال،
// حتى لا يحذف زر D اختلافا بينما هو يكتب عنوانه.

'use client';

import { useConfirmStore } from '@/lib/ui/confirm-store';
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
  { keys: 'M', description: 'أداة تعليم الكلمات' },
  { keys: 'E', description: 'أداة المسح' },
  { keys: 'Ctrl + S', description: 'حفظ المستند' },

  { keys: 'Ctrl + Z', description: 'تراجع' },
  { keys: 'Ctrl + Shift + Z', description: 'إعادة' },
  { keys: 'Ctrl + =', description: 'تكبير' },
  { keys: 'Ctrl + -', description: 'تصغير' },
  { keys: 'Ctrl + 0', description: 'ملء العرض وإعادة الضبط' },
  { keys: 'Ctrl + عجلة الفأرة', description: 'تكبير وتصغير عند المؤشر' },
  { keys: 'Alt + سحب', description: 'تحريك اللوحة من أي موضع' },
  { keys: 'G', description: 'إظهار الشبكة أو إخفاؤها' },
  { keys: 'L', description: 'إظهار بطاقات الأوجه' },
  { keys: 'P', description: 'لوحة الخصائص' },
  { keys: 'B', description: 'لوحة الاختلافات' },
  { keys: 'N', description: 'المعالج الذكي الموحّد (إنشاء اختلاف)' },

  // أوامر العنصر النشط عبر التحديد الموحّد (FR-ED-02.6): تعمل على العنصر
  // المحدد في أي لوحة — نفس أوامر قائمة السياق ولوحة التفاصيل.
  { keys: 'Ctrl + C', description: 'نسخ العنصر المحدد (اختلاف/وجه/جزء/سطر/قاعدة)' },
  { keys: 'Ctrl + X', description: 'قص العنصر المحدد (نقل عند اللصق المؤكَّد)' },
  { keys: 'Ctrl + V', description: 'لصق عند العنصر المحدد (سطر محدد = لصق داخله)' },

  // التحديد المتعدد ونقل الأسطر (FR-ED-07 / FR-ED-04.5): قائمة الاختصارات
  // تذكر النقل بديلًا للسحب حتى يبقى موثّقًا في نافذة المساعدة نفسها.
  { keys: 'Ctrl + نقر', description: 'إضافة عنصر إلى التحديد المتعدد أو حذفه منه' },
  { keys: 'Shift + نقر', description: 'تحديد مدى من العناصر' },
  { keys: 'Ctrl + A', description: 'تحديد كل المعروض/المصفّى في القائمة الحالية' },
  { keys: 'Alt + ↑ / Alt + ↓', description: 'نقل السطر المحدد رتبة أعلى/أسفل (بتأكيد)' },
  { keys: 'Esc', description: 'إلغاء التعليم والتحديد والسحب' },
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
      if (event.defaultPrevented || useConfirmStore.getState().pending || isTypingTarget(event.target)) return;

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
            void store.requestPasteSelection();
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
        case 'n':
          store.requestSmartWizard();
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

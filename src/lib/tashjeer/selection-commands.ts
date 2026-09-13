// أوامر العنصر النشط — Selection Commands (FR-ED-02.6)
// مشروع التشجير - نظام القراءات العشر
//
// «العنصر النشط قابل للعمليات مباشرة»: هذه الوحدة النقية تحدد أي الأوامر
// ممكنة لأي نوع تحديد (نسخ، قص، لصق، حذف، ربط، دمج، نقل، نسخ المعرّف…).
// تستعملها لوحة التفاصيل وقائمة السياق معًا، فلا يتفرق قرار التمكين بين
// واجهتين. التنفيذ نفسه (مرجعية الإجراءات في المخزن) في SelectionDetailsPanel
// وSelectionContextMenu؛ عمليات التحرير العميقة تبقى لحزمة 04.

import type { EditorSelection } from '@/types/tashjeer';

/** سياق يلزم لتمكين الأوامر: هل الحافظة تحمل شيئًا؟ */
export interface SelectionCommandContext {
  hasClipboard: boolean;
}

/** أمر واحد قابل للعرض في قائمة السياق أو لوحة التفاصيل. */
export interface SelectionCommand {
  id:
    | 'COPY'
    | 'CUT'
    | 'PASTE'
    | 'DELETE'
    | 'COPY_ID'
    | 'LINK'
    | 'MOVE_UP'
    | 'MOVE_DOWN'
    | 'WHY'
    | 'UNLINK'
    | 'EDIT';
  label: string;
  enabled: boolean;
  /** عمليات مدمّرة تُعرض بلون تحذيري وتُنفَّذ عبر التأكيد الكمي. */
  danger?: boolean;
  hint?: string;
}

/** يبني قائمة الأوامر الممكنة للتحديد المعطى، بالترتيب الثابت للعرض. */
export function selectionCommands(
  selection: EditorSelection | null,
  context: SelectionCommandContext
): SelectionCommand[] {
  if (!selection) return [];

  const copyId: SelectionCommand = { id: 'COPY_ID', label: 'نسخ المعرّف', enabled: true };
  const paste: SelectionCommand = {
    id: 'PASTE',
    label: 'لصق',
    enabled: context.hasClipboard,
    hint: context.hasClipboard ? undefined : 'الحافظة فارغة',
  };

  switch (selection.kind) {
    case 'DIFFERENCE':
      return [
        { id: 'COPY', label: 'نسخ الاختلاف', enabled: true },
        { id: 'CUT', label: 'قص الاختلاف', enabled: true },
        paste,
        { id: 'EDIT', label: 'تحرير في لوحة الاختلافات', enabled: true },
        { id: 'DELETE', label: 'حذف الاختلاف', enabled: true, danger: true },
        copyId,
      ];
    case 'FACE':
      return [
        { id: 'COPY', label: 'نسخ الوجه', enabled: true },
        { id: 'CUT', label: 'قص الوجه', enabled: true },
        paste,
        { id: 'LINK', label: 'ربط/دمج بوجه آخر', enabled: true },
        { id: 'DELETE', label: 'حذف الوجه', enabled: true, danger: true },
        copyId,
      ];
    case 'SEGMENT':
      return [
        { id: 'COPY', label: 'نسخ الجزء', enabled: true },
        { id: 'CUT', label: 'قص الجزء', enabled: true },
        paste,
        { id: 'DELETE', label: 'حذف الجزء', enabled: true, danger: true },
        copyId,
      ];
    case 'LINE':
      return [
        { id: 'COPY', label: 'نسخ السطر كاملا', enabled: true },
        { id: 'MOVE_UP', label: 'أعلى في الترتيب', enabled: true },
        { id: 'MOVE_DOWN', label: 'أسفل في الترتيب', enabled: true },
        { id: 'LINK', label: 'ربط/دمج بسطر آخر', enabled: true },
        copyId,
      ];
    case 'RULE':
      return [
        { id: 'WHY', label: 'لماذا هذا القرار؟', enabled: true },
        { id: 'EDIT', label: 'فتح القاعدة في الاستوديو', enabled: true },
        copyId,
      ];
    case 'COMPOSITE_FACE':
      return [
        { id: 'UNLINK', label: 'فك الوجه المركب', enabled: true, danger: true },
        copyId,
      ];
    case 'WAQF_MARK':
      return [{ id: 'DELETE', label: 'حذف علامة الوقف', enabled: true, danger: true }, copyId];
    case 'WORD':
    case 'CHARACTER':
    case 'LOCUS':
      return [
        { id: 'COPY', label: 'تعليم للإنشاء', enabled: false, hint: 'استعمل أداة التعليم (M) ثم انقر الكلمة' },
        copyId,
      ];
    default:
      return [copyId];
  }
}

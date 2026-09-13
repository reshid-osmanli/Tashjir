// مخزن التحديد الموحّد — Unified Selection Store (FR-ED-02)
// مشروع التشجير - نظام القراءات العشر
//
// هذا هو المدخل الموحّد الذي تكتب من خلاله كل اللوحات تحديداتها:
//
//   Face Panel ↔ Line Panel ↔ Order Panel ↔ Differences List ↔ Tracking ↔
//   Relations Panel ↔ Editor Canvas ↔ Engine Studio
//
// مبدأ حاكم: لا تملك أي لوحة نظام تحديد مستقلًا (P-07). «العنصر المحدد الآن»
// يعيش حقلا واحدا (`selection` في editor-store) — وهو الموقع المكافئ للسليس
// المستقل في بنية الكود هذه، لأن المحرر ولوحاته كلها تعمل على مخزن واحد أصلًا.
// هذه الوحدة هي الواجهة فوقه:
//   1) selectElement: الكتابة الوحيدة التي تستعملها اللوحات، فتمر كلها من
//      الكاتبة المركزية في editor-store (آخر تحديد صالح + طلب تركيز متزايد).
//   2) useSelectionFocus: اشتراك اللوحة (اللوحة) في طلبات التركيز، فتنتقل إلى
//      العنصر وتميّزه خلال ≤ 300ms (AC-06).
//   3) دوال نقية بلا DOM (محدد العنصر في اللوحة، حساب التمركز) تُختبر في
//      Vitest مباشرة فلا يتفرق الحساب بين الاختبار والتشغيل.

import { useEditorStore, type SelectionFocus } from '@/stores/editor-store';
import { makeWordId } from '@/data/quran';
import type { EditorSelection } from '@/types/tashjeer';

/** الزمن المستهدف للانتقال والتمييز بعد النقر (AC-06). */
export const FOCUS_BUDGET_MS = 300;

/** مصدر التحديد: من اللوحة نفسها، من لوحة جانبية، أو من خارج المحرر. */
export type SelectionOrigin = 'CANVAS' | 'PANEL' | 'EXTERNAL';

/** خيارات selectElement الموحّدة. */
export interface SelectElementOptions {
  /** ضع العنصر في منتصف منطقة الرؤية حيثما أمكن (افتراضيا: نعم). */
  center?: boolean;
  origin?: SelectionOrigin;
}

/**
 * الكتابة الموحّدة للتحديد من أي لوحة. تمر من إجراء setSelection في مخزن
 * المحرر (الكاتبة المركزية)، فلا تكرار ولا تحديد مناقض.
 */
export function selectElement(selection: EditorSelection | null, options: SelectElementOptions = {}): void {
  useEditorStore.getState().setSelection(selection, { center: options.center ?? selection !== null });
}

/** يقرأ التحديد الموحّد الحالي خارج React (نفس المصدر). */
export function currentSelection(): EditorSelection | null {
  return useEditorStore.getState().selection;
}

/**
 * اشتراك اللوحة في طلبات التركيز. يعيد آخر طلب لم يُستهلك بعد؛ اللوحة
 * تقارن token لتحديد الجِدّة. يُستعمل في اللوحة (Canvas) وفي أي لوحة تريد
 * التمرير إلى العنصر حين يُحدَّد من مكان آخر.
 */
export function useSelectionFocus(): { selection: EditorSelection | null; focus: SelectionFocus } {
  const selection = useEditorStore((state) => state.selection);
  const focus = useEditorStore((state) => state.selectionFocus);
  return { selection, focus };
}

// ==================== دوال نقية: أهداف التركيز في اللوحة ====================

/**
 * تهريب قيمة محدد سمة CSS — بديل نقي عن CSS.escape (غير متاح في بيئة Node
 * للاختبارات). قيم المعرّفات بين علامتي اقتباس، فيكفي تهريب الاقتباس والمائل.
 */
function escapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** مستطيل مقياس مجرّد (بكسل شاشة) — قابل للمحاكاة في الاختبارات بلا DOM. */
export interface MeasuredRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** مستطيل من DOMRect الحقيقي، لتمرير نتائج getBoundingClientRect كما هي. */
export function toMeasuredRect(rect: { left: number; top: number; width: number; height: number }): MeasuredRect {
  return { left: rect.left, top: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height, width: rect.width, height: rect.height };
}

/**
 * هل العنصر خارج منطقة الرؤية (بالهامش) فيحتاج تحريك اللوحة؟
 * يكشف الحواف الأربعة، فلا يُحرَّك المشهد لعنصر هو ظاهر أصلًا.
 */
export function isRectOutsideViewport(target: MeasuredRect, viewport: MeasuredRect, marginPx: number): boolean {
  return (
    target.left < viewport.left + marginPx ||
    target.right > viewport.right - marginPx ||
    target.top < viewport.top + marginPx ||
    target.bottom > viewport.bottom - marginPx
  );
}

/**
 * pan الجديد الذي يجعل مركز العنصر يطابق مركز اللوحة. التحريك بلا تغيير
 * التكبير، فلا يفقد المحقق سياق نظره. نقية بالكامل وتُختبر في Vitest.
 */
export function computeFocusPan(
  targetCenter: { x: number; y: number },
  viewportCenter: { x: number; y: number },
  unitsPerPixel: number,
  pan: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: pan.x + (viewportCenter.x - targetCenter.x) * unitsPerPixel,
    y: pan.y + (viewportCenter.y - targetCenter.y) * unitsPerPixel,
  };
}

/**
 * مُحدِّد CSS للعنصر المرئي المقابل للتحديد داخل لوحة SVG. ترجع null إن لم
 * يكن للتحديد هدف مباشر (يُحلّ حينها بالمناوئ: موضع الكلمة، سطر الاختلاف).
 * المحددات مبنية على سمات data التي يرسمها TashjeerFigure، فلا معرّف يُعاد.
 * `ayahKey` يلزم لتحديدات الموضع (جزء/موضع/وقف) لبناء معرّف كلمة الإرشاد.
 */
export function selectionTargetSelector(selection: EditorSelection | null, ayahKey?: number): string | null {
  if (!selection) return null;
  switch (selection.kind) {
    case 'WORD':
      return `[data-word-id="${escapeAttr(selection.id)}"]`;
    case 'CHARACTER':
      // خلية الحرف داخل كلمتها؛ إن لم تُرسم الخلايا (بلا وضع حروف) يقع
      // المناوئ على الكلمة الحاضنة.
      return selection.wordId
        ? `[data-word-id="${escapeAttr(String(selection.wordId))}"]`
        : null;
    case 'LINE':
      return `[data-line-id="${escapeAttr(selection.lineId ?? selection.id)}"]`;
    case 'SEGMENT':
      // الجزء يُكشف بموضعه: الكلمة الأولى في مداه.
      return typeof selection.position === 'number' && ayahKey !== undefined
        ? `[data-word-id="${escapeAttr(String(makeWordId(ayahKey, selection.position)))}"]`
        : null;
    case 'DIFFERENCE':
    case 'RULE':
      // سطر الاختلاف (وإن كان مشتق قاعدة عامة فهو ضمن data-variant-ids).
      return `[data-variant-ids~="${escapeAttr(selection.differenceId ?? selection.id)}"]`;
    case 'FACE':
      // الوجه أداة ضمن سطر اختلافه: نستهدف سطر الاختلاف، ونبض الوجه نفسه
      // يتولاه TashjeerFigure عبر faceId.
      return selection.differenceId
        ? `[data-variant-ids~="${escapeAttr(selection.differenceId)}"]`
        : null;
    case 'LOCUS':
    case 'WAQF_MARK':
      return typeof selection.position === 'number' && ayahKey !== undefined
        ? `[data-word-id="${escapeAttr(String(makeWordId(ayahKey, selection.position)))}"]`
        : null;
    case 'COMPOSITE_FACE':
      // الوجه المركب رابط: يظهر في اللوحة عبر سطري وجهيه؛ التمييز يُدرَك
      // من لوحة التفاصيل، ولا هدف SVG مباشرا له.
      return null;
    default:
      return null;
  }
}

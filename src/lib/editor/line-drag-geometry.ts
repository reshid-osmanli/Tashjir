// هندسة سحب ترتيب الأسطر: حساب موضع الإدراج منفصل تمامًا عن رسم المعاينة
//
// لا يلمس هذا الملف المستند ولا يُنشئ معرّفًا. يُستدعى في كل إطار أثناء
// السحب ومع كل تمرير تلقائي، فيبقى «أين سيُوضع السطر» قرارًا نقيًا قابلاً
// للاختبار، بينما المعاينة العائمة مجرد عرض للإحداثيات (translate3d).

import { planLineInsertion } from '@/lib/tashjeer/line-operations';

export interface DragPointer {
  x: number;
  y: number;
}

export interface RowBox {
  id: string;
  top: number;
  bottom: number;
}

export interface ViewportBox {
  top: number;
  bottom: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface InsertionAtPointer {
  /** فجوة صفرية الأساس «قبل» الفهرس، من 0 إلى rows.length. */
  gap: number | null;
  /** الصف الواقع تحت المؤشر (هدف الدمج أو أقرب صف للإدراج). */
  targetId: string | null;
}

/**
 * يحوّل إحداثي المؤشر إلى فجوة إدراج. فوق منتصف الصف ⇒ قبله، وتحته ⇒ بعده.
 * قبل أول صف ⇒ 0، وبعد آخر صف ⇒ rows.length. خارج القائمة ⇒ null.
 * لا يُعاد ترتيب هنا: الترتيب النهائي يحسبه planLineInsertion وحده.
 */
export function insertionGapAt(pointerY: number, rows: RowBox[]): InsertionAtPointer {
  if (!rows.length || !Number.isFinite(pointerY)) return { gap: null, targetId: null };
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  // هامش أوسع من منطقة التمرير التلقائي: البقاء أسفل آخر صف أثناء التمرير
  // يعني «أدخل في النهاية» لا «أفلت خارج القائمة».
  if (pointerY < first.top - 96 || pointerY > last.bottom + 96) return { gap: null, targetId: null };
  if (pointerY < first.top) return { gap: 0, targetId: first.id };
  if (pointerY > last.bottom) return { gap: rows.length, targetId: last.id };
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (pointerY <= row.bottom) {
      const middle = row.top + (row.bottom - row.top) / 2;
      return { gap: pointerY < middle ? index : index + 1, targetId: row.id };
    }
  }
  return { gap: rows.length, targetId: last.id };
}

/** هل الإفلات في هذا الموضع لا يغيّر الترتيب؟ يُخفى مؤشر الإدراج حينها. */
export function isNoOpInsertion(ids: string[], id: string, gap: number | null): boolean {
  return gap === null || planLineInsertion(ids, id, gap) === null;
}

/**
 * سرعة التمرير التلقائي: صفر في المنتصف، وتتدرج خطيًا حتى maxSpeed عند
 * الحافة. موجبة ⇒ أسفل، سالبة ⇒ أعلى. لا تتجاوز حدود المحتوى.
 */
export function autoScrollDelta(
  pointerY: number,
  viewport: ViewportBox,
  edgePx: number,
  maxSpeed: number
): number {
  const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  if (!Number.isFinite(pointerY) || edgePx <= 0 || maxSpeed <= 0 || maxScroll <= 0) return 0;
  const topDistance = pointerY - viewport.top;
  const bottomDistance = viewport.bottom - pointerY;
  if (topDistance < edgePx && viewport.scrollTop > 0) {
    const nearness = Math.min(1, Math.max(0, (edgePx - topDistance) / edgePx));
    return -Math.max(1, Math.round(maxSpeed * nearness));
  }
  if (bottomDistance < edgePx && viewport.scrollTop < maxScroll) {
    const nearness = Math.min(1, Math.max(0, (edgePx - bottomDistance) / edgePx));
    return Math.max(1, Math.round(maxSpeed * nearness));
  }
  return 0;
}

/** تحويل مستقل للمعاينة العائمة: لا يعرف شيئًا عن الترتيب أو المستند. */
export function previewTransform(pointer: DragPointer, offset: DragPointer): string {
  const x = Math.round(pointer.x - offset.x);
  const y = Math.round(pointer.y - offset.y);
  return `translate3d(${x}px, ${y}px, 0)`;
}

/** وصف الحركة للحوار: الرتبة قبل/بعد، الجاران، وعدد الصفوف المتأثرة. */
export function describeLineOrderMove(beforeIds: string[], afterIds: string[], id: string) {
  const fromRank = beforeIds.indexOf(id) + 1;
  const rank = afterIds.indexOf(id) + 1;
  return {
    fromRank,
    rank,
    previousId: afterIds[rank - 2],
    nextId: afterIds[rank],
    affected: beforeIds.filter((item, index) => item !== afterIds[index]).length,
  };
}

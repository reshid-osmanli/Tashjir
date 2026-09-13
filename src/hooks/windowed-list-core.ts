// نواة نافذة العرض — Windowed List Core (NFR-01)
// مشروع التشجير - نظام القراءات العشر
//
// هذه وحدة نقية بلا React ولا DOM: تحسب أي الصفوف يجب رسمها من بين آلاف،
// وارتفاع الحشو الوهمي قبل النافذة وبعدها. استُخرجت من useWindowedList حتى
// تُختبر حسابيا على قوائم 2000 عنصر (AC: تمرير سلس بلا تجمد)، والخطاف
// يفوّض إليها في وقت التشغيل فلا يتفرق الحساب بين اختبار وتشغيل.

/** مدى الصفوف المرئية مع الحشوات. */
export interface WindowComputation {
  /** أول فهرس يُرسم وآخره (شامل). */
  start: number;
  end: number;
  /** ارتفاع الحشو قبل المدى وبعده بالبكسل. */
  topPad: number;
  bottomPad: number;
}

export interface WindowInput {
  scrollTop: number;
  /** ارتفاع منطقة الرؤية بالبكسل. */
  viewport: number;
  count: number;
  /** ارتفاع الصف بالفهرس (المقاس أو التقديري). */
  heightOf: (index: number) => number;
  /** صفوف إضافية فوق النافذة وتحتها. */
  overscan?: number;
}

/**
 * يحسب نافذة العرض: أول صف يلامس أعلى المنطقة، وآخر صف يلامس أسفلها،
 * مع هامش overscan في الاتجاهين. تعقيد O(count) — كافٍ لآلاف الصفوف
 * لأنه عملية جمع بسيطة تُستدعى عند التمرير فقط.
 */
export function computeWindow({ scrollTop, viewport, count, heightOf, overscan = 6 }: WindowInput): WindowComputation {
  if (count <= 0) return { start: 0, end: -1, topPad: 0, bottomPad: 0 };

  let offset = 0;
  let first = 0;
  while (first < count && offset + heightOf(first) < scrollTop) {
    offset += heightOf(first);
    first += 1;
  }
  let last = first;
  let covered = offset;
  while (last < count - 1 && covered + heightOf(last) < scrollTop + viewport) {
    covered += heightOf(last);
    last += 1;
  }
  const start = Math.max(0, first - overscan);
  const end = Math.min(count - 1, last + overscan);
  let topPad = 0;
  for (let index = 0; index < start; index += 1) topPad += heightOf(index);
  let bottomPad = 0;
  for (let index = end + 1; index < count; index += 1) bottomPad += heightOf(index);
  return { start, end, topPad, bottomPad };
}

/**
 * الإزاحة التراكمية لأعلى فهرس: تُستعمل لتمرير القائمة إلى صف معيّن
 * (Scroll Into View من التحديد الموحّد) وحساب موضع الصف في منتصف الرؤية.
 */
export function offsetOfIndex(count: number, index: number, heightOf: (i: number) => number): number {
  let offset = 0;
  const bound = Math.min(Math.max(index, 0), count - 1);
  for (let i = 0; i < bound; i += 1) offset += heightOf(i);
  return offset;
}

/**
 * موضع التمرير الذي يجعل الصف في منتصف منطقة الرؤية حيثما أمكن، مقيدا
 * بحدود المحتوى ([0, scrollHeight - viewport]). هذا هو السلوك المطلوب في
 * AC: «يظهر مميزًا في منتصف الرؤية».
 */
export function scrollTopToCenterIndex(
  count: number,
  index: number,
  heightOf: (i: number) => number,
  viewport: number
): number {
  const safeViewport = Math.max(viewport, 1);
  const top = offsetOfIndex(count, index, heightOf);
  const height = Math.max(heightOf(Math.min(Math.max(index, 0), Math.max(count - 1, 0))), 0);
  const desired = top - safeViewport / 2 + height / 2;
  const maxScroll = Math.max(totalHeight(count, heightOf) - safeViewport, 0);
  return Math.min(Math.max(desired, 0), maxScroll);
}

/** مجموع ارتفاعات الصفوف كلها، لحصر موضع التمرير في حدوده الصحيحة. */
export function totalHeight(count: number, heightOf: (i: number) => number): number {
  let total = 0;
  for (let i = 0; i < count; i += 1) total += heightOf(i);
  return total;
}

/** هل يلزم إظهار زر الصعود/النزول؟ بهامش 2px لتفادي الاهتزاز عند الحدود. */
export function scrollDirections(scrollTop: number, viewport: number, scrollHeight: number): { up: boolean; down: boolean } {
  return {
    up: scrollTop > 2,
    down: scrollTop + viewport < scrollHeight - 2,
  };
}

/**
 * هل يظهر زر «الانتقال إلى أعلى القائمة»؟ لا يظهر إلا بعد تمرير بعيد
 * (عدة شاشات) حتى لا يزاحم أزرار الصعود الصغيرة.
 */
export function shouldShowJumpToTop(scrollTop: number, viewport: number): boolean {
  return scrollTop > Math.max(viewport * 2.5, 600);
}

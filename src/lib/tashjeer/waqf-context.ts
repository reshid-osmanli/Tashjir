// سياق الوقف والوصل — Waqf/Wasl Context (FR-ED-11، DM-06/DM-07/DM-11)
//
// المكان الواحد لكل قرارات السياق (وقف/وصل/منع) على مستوى المواضع: ما الحدّ،
// وما حالته، وهل اختلافٌ مشروطٌ (وقفًا فقط/وصلًا فقط) ظاهرٌ عنده؟ تستهلكه
// خطةُ القراءة، وواجهةُ القرار (Decision API)، ومحركُ التراكيب، والخطافات،
// والواجهات — فلا منطق سياق مكرر في أي Feature (P-07).
//
// القواعد (موثقة أيضًا في PROGRESS.md — حُسم الغموض بالأكثر أمانًا):
//
//   1. نهاية نافذة العمل وقفٌ طبيعي: اختلاف «وقفًا فقط» في نهاية آية غير
//      موصولة يظهر افتراضيًا بلا حاجة لعلامة صريحة، ويسقط عند وصل الآية
//      بالتالية؛ و«وصلًا فقط» بالعكس تمامًا.
//   2. الحدّ الداخلي الذي عليه علامة وقف/ابتداء فاصلٌ (وقف) ما لم يختر
//      المحقق وصله صراحة (segmentWasl)؛ والعلامة تبقى في البيانات توثيقًا.
//   3. «ممنوع الوصل» قيدٌ صلب: يمنع الوصل أصلًا، ويُعامل معاملة الوقف
//      الإجباري عند تقييم السياق (لا يمكن الوصل حيث مُنع).
//   4. ما سوى ذلك فهو وصل: القراءة مستمرة ولا توقف عندها.
//   5. الكيان لا يُحذف أبدًا عند السقوط من العرض — يسقط من التركيب فقط.

import type { RecitationBoundary, RecitationMode } from '@/types/tashjeer';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

/** حالة حدّ: وقف، أو وصل، أو منع صلب للوصل. */
export type JointState = 'WAQF' | 'WASL' | 'FORBIDDEN';

/** طبيعة الحدّ: نهاية آية، أو حدّ داخلي، أو حدّ بين آيتين موصولتين. */
export type JointKind = 'AYAH_END' | 'INTERNAL' | 'AYAH_SEAM';

/** حدّ قطع/وصل واحد بعد كلمة. */
export interface AyahJoint {
  /** بعد أي كلمة يقع الحدّ (مواضع النافذة، 1-based). */
  position: number;
  kind: JointKind;
  state: JointState;
  /** كل العلامات عند هذا الحدّ. */
  marks: RecitationBoundary[];
  /** علامة المنع إن وُجدت (مرجع الرفض في الرسائل). */
  forbiddenMark?: RecitationBoundary;
  /** هل اختار المحقق الوصل عند هذا الحدّ؟ */
  connected: boolean;
}

/** مدخلات السياق: نافذة العمل + علامات المحقق + اختيارات الوصل. */
export interface WaqfContextInput {
  /** عدد كلمات نافذة العمل (الآية، أو الآيتان عند الوصل). */
  wordsCount: number;
  boundaries?: RecitationBoundary[];
  /** هل الآية موصولة بالتالية؟ */
  linkNextAyah?: boolean;
  /** الحدود الداخلية الموصولة («بعد الكلمة N»). */
  segmentWasl?: number[];
  /** موضع آخر كلمة في الآية الأولى (يساوي wordsCount عند عدم الوصل). */
  firstAyahEndPosition?: number;
}

/** يطبّع قائمة الوصل الداخلية: أعداد صحيحة صالحة بلا تكرار، مرتبة. */
export function sanitizeSegmentWasl(value: unknown, wordsCount: number): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  for (const item of value) {
    if (!Number.isInteger(item) || item < 1 || item >= wordsCount) continue;
    seen.add(item);
  }
  return [...seen].sort((a, b) => a - b);
}

/** العلامات الصالحة عند موضع (بعد الكلمة position). */
function marksAt(boundaries: RecitationBoundary[], position: number, wordsCount: number): RecitationBoundary[] {
  if (!Number.isInteger(position) || position < 1 || position > wordsCount) return [];
  return boundaries.filter(
    (boundary) => boundary.position === position && Number.isInteger(boundary.position)
  );
}

/** هل عند الموضع فاصلٌ صريح (وقف/منع بعده، أو ابتداء بعده)؟ */
function hasExplicitBreak(
  boundaries: RecitationBoundary[],
  position: number,
  wordsCount: number
): boolean {
  if (boundaries.some((b) => (b.kind === 'WAQF' || b.kind === 'NO_WASL') && b.position === position)) {
    return true;
  }
  // الابتداء من الكلمة التالية فاصلٌ قبلها.
  if (position < wordsCount && boundaries.some((b) => b.kind === 'IBTIDA' && b.position === position + 1)) {
    return true;
  }
  return false;
}

/**
 * يسرد حدود القطع/الوصل المعالَجة في النافذة: نهاية الآية (أو حدّ الآيتين عند
 * الوصل)، وكل حدّ داخلي عليه علامة وقف/منع أو يليه ابتداء. مرتبة بالموضع.
 */
export function listJoints(input: WaqfContextInput): AyahJoint[] {
  const wordsCount = Math.max(0, Math.floor(input.wordsCount));
  if (wordsCount <= 0) return [];
  const boundaries = input.boundaries ?? [];
  const linked = input.linkNextAyah === true;
  const firstEnd = input.firstAyahEndPosition ?? wordsCount;
  const seam = linked && firstEnd >= 1 && firstEnd < wordsCount ? firstEnd : null;
  const connected = new Set(sanitizeSegmentWasl(input.segmentWasl, wordsCount));

  const positions = new Set<number>();
  // نهاية النافذة حدٌّ دائمًا (وقف طبيعي).
  positions.add(wordsCount);
  // حدّ الآيتين عند الوصل.
  if (seam !== null) positions.add(seam);
  for (const boundary of boundaries) {
    if (!Number.isInteger(boundary.position) || boundary.position < 1 || boundary.position > wordsCount) {
      continue;
    }
    if (boundary.kind === 'WAQF' || boundary.kind === 'NO_WASL') {
      positions.add(boundary.position);
    }
    // الابتداء من الكلمة N فاصلٌ بعد الكلمة N-1.
    if (boundary.kind === 'IBTIDA' && boundary.position > 1) {
      positions.add(boundary.position - 1);
    }
  }

  return [...positions]
    .sort((a, b) => a - b)
    .map((position) => {
      const marks = marksAt(boundaries, position, wordsCount);
      const forbiddenMark = marks.find((mark) => mark.kind === 'NO_WASL');
      const isSeam = seam !== null && position === seam;
      const isEnd = position === wordsCount;
      const kind: JointKind = isSeam ? 'AYAH_SEAM' : isEnd && seam === null ? 'AYAH_END' : isEnd ? 'AYAH_END' : 'INTERNAL';
      const isConnected = isSeam ? true : connected.has(position);
      const state: JointState = forbiddenMark
        ? 'FORBIDDEN'
        : isSeam
          ? 'WASL'
          : isEnd
            ? 'WAQF'
            : isConnected
              ? 'WASL'
              : 'WAQF';
      // «موصول» تعني وصلًا فعليًا: الممنوع (قيد صلب) غير موصول أبدًا ولو
      // ذُكر موضعه في الوصل — المنع يغلب الوصل دائمًا.
      return { position, kind, state, marks, forbiddenMark, connected: state === 'WASL' };
    });
}

/** حدّ موضع واحد، أو null إن لم يكن الموضع حدًّا معالَجًا. */
export function jointAt(position: number, input: WaqfContextInput): AyahJoint | null {
  return listJoints(input).find((joint) => joint.position === position) ?? null;
}

/**
 * وضع الأداء عند موضع: هل يُقرأ وقفًا أم وصلًا؟
 *
 * يُستعمل لتقييم الاختلافات المشروطة: «وقفًا فقط» يظهر في WAQF، و«وصلًا فقط»
 * في WASL. المنع الصلب يُعامل معاملة الوقف (القاعدة 3).
 */
export function resolvePositionMode(position: number, input: WaqfContextInput): 'WAQF' | 'WASL' {
  const wordsCount = Math.max(0, Math.floor(input.wordsCount));
  if (wordsCount <= 0) return 'WASL';
  const clamped = Math.min(Math.max(1, Math.floor(position)), wordsCount);
  const boundaries = input.boundaries ?? [];
  const linked = input.linkNextAyah === true;
  const firstEnd = input.firstAyahEndPosition ?? wordsCount;
  const seam = linked && firstEnd >= 1 && firstEnd < wordsCount ? firstEnd : null;

  // القاعدة 3: المنع وقفٌ إجباري.
  if (boundaries.some((b) => b.kind === 'NO_WASL' && b.position === clamped)) return 'WAQF';
  // حدّ الآيتين الموصولتين: وصلٌ دائمًا (القاعدة 2: الوصل يغلب التوثيق).
  if (seam !== null && clamped === seam) return 'WASL';
  // القاعدة 1: نهاية النافذة وقفٌ طبيعي.
  if (clamped === wordsCount) return 'WAQF';
  // القاعدة 2: الفاصل الصريح وقفٌ ما لم يُوصَل.
  if (hasExplicitBreak(boundaries, clamped, wordsCount)) {
    const connected = new Set(sanitizeSegmentWasl(input.segmentWasl, wordsCount));
    return connected.has(clamped) ? 'WASL' : 'WAQF';
  }
  // القاعدة 4: ما سوى ذلك استمرار.
  return 'WASL';
}

/** هل سياق اختلافٍ مشروطٍ نشطٌ في وضع أداء؟ (مطابق v8.isContextActive). */
export function differenceAppliesInMode(
  context: RecitationMode | undefined,
  mode: 'WAQF' | 'WASL'
): boolean {
  const normalized = context ?? 'ALWAYS';
  if (normalized === 'ALWAYS') return true;
  return mode === 'WAQF' ? normalized === 'WAQF_ONLY' : normalized === 'WASL_ONLY';
}

/** هل اختلافٌ مشروطٌ ظاهرٌ عند موضع في سياق نافذة؟ */
export function differenceAppliesAt(
  context: RecitationMode | undefined,
  endPosition: number,
  input: WaqfContextInput
): boolean {
  return differenceAppliesInMode(context, resolvePositionMode(endPosition, input));
}

/** حدّ نهاية الآية الأولى (لشريط المحرر): وقف/وصل/ممنوع. */
export function ayahEndJoint(input: WaqfContextInput & { wordsCount: number }): AyahJoint {
  const wordsCount = Math.max(1, Math.floor(input.wordsCount));
  const linked = input.linkNextAyah === true;
  const firstEnd = input.firstAyahEndPosition ?? wordsCount;
  const at = linked && firstEnd >= 1 && firstEnd < wordsCount ? firstEnd : wordsCount;
  return (
    jointAt(at, input) ?? {
      position: at,
      kind: linked ? 'AYAH_SEAM' : 'AYAH_END',
      state: linked ? 'WASL' : 'WAQF',
      marks: [],
      connected: linked,
    }
  );
}

/** وصف عربي لحدّ (للقوائم والرسائل)، بالأرقام العربية. */
export function describeJoint(
  joint: AyahJoint,
  opts: { ayahNumber?: number; nextAyahNumber?: number } = {}
): string {
  const at = `بعد الكلمة ${toArabicDigits(joint.position)}`;
  if (joint.kind === 'AYAH_SEAM') {
    const from = opts.ayahNumber !== undefined ? `الآية ${toArabicDigits(opts.ayahNumber)}` : 'الآية';
    const to =
      opts.nextAyahNumber !== undefined ? `الآية ${toArabicDigits(opts.nextAyahNumber)}` : 'التالية';
    return `بين ${from} و${to} (${at})`;
  }
  if (joint.kind === 'AYAH_END') return `نهاية الآية (${at})`;
  return `داخل الآية (${at})`;
}

/** تسمية حالة الحدّ بالعربية. */
export function jointStateLabel(state: JointState): string {
  return state === 'WAQF' ? 'وقف' : state === 'WASL' ? 'وصل' : 'ممنوع الوصل';
}

/** أيقونة حالة الحدّ (نصية، بلا اعتماد على خطوط أيقونات). */
export function jointStateIcon(state: JointState): string {
  return state === 'WAQF' ? '⏸' : state === 'WASL' ? '↔' : '🚫';
}

/**
 * كلمات مقطع العرض المعزول وحده (DM-11): عند تفعيل نطاق يُعرض الجزء المحدد
 * فقط دون بقية النافذة، كأنه قطعة مستقلة. غياب النطاق يعني النافذة كلها.
 */
export function wordsInSegment<T extends { position: number }>(
  words: T[],
  segment: { startPosition: number; endPosition: number } | null | undefined
): T[] {
  if (!segment) return words;
  const start = Math.min(segment.startPosition, segment.endPosition);
  const end = Math.max(segment.startPosition, segment.endPosition);
  return words.filter((word) => word.position >= start && word.position <= end);
}

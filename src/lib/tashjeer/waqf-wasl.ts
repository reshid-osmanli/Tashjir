// الوقف والوصل وممنوع الوصل
// FR-ED-11: سياق الوقف/الوصل + ممنوع الوصل + وقف داخلي معزول
//
// المبادئ:
//   1. بعض الأحكام تظهر وقفا فقط وتسقط عند الوصل
//   2. بعض الأحكام تظهر وصلا فقط
//   3. ممنوع الوصل قيد صلب يمنع وصل آيتين
//   4. الوقف الداخلي يعزل جزءًا من الآية للعرض المستقل
//   5. السياق يتكامل مع reading-window الحالية

import type {
  Variant,
  RecitationBoundary,
} from '@/types/tashjeer';
import type { RenderRange, WaqfMark } from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';

// ==================== سياق الأداء ====================

/** وضع العرض الحالي (وقف أو وصل). */
export type RecitationDisplayMode = 'WAQF' | 'WASL';

/**
 * يتحقق من ظهور اختلاف في وضع العرض الحالي.
 */
export function shouldDisplayInMode(
  variant: Variant,
  mode: RecitationDisplayMode
): boolean {
  const recitationMode = variant.recitationMode ?? 'ALWAYS';

  switch (recitationMode) {
    case 'ALWAYS':
      return true;
    case 'WAQF_ONLY':
      return mode === 'WAQF';
    case 'WASL_ONLY':
      return mode === 'WASL';
    default:
      return true;
  }
}

/**
 * يُصفّي الاختلافات حسب وضع العرض.
 */
export function filterVariantsByMode(
  variants: Variant[],
  mode: RecitationDisplayMode
): Variant[] {
  return variants.filter((v) => shouldDisplayInMode(v, mode));
}

/**
 * يحسب عدد الاختلافات التي ستسقط عند الوصل.
 */
export function countWaqfOnlyVariants(variants: Variant[]): number {
  return variants.filter((v) => v.recitationMode === 'WAQF_ONLY').length;
}

/**
 * يحسب عدد الاختلافات التي ستظهر فقط عند الوصل.
 */
export function countWaslOnlyVariants(variants: Variant[]): number {
  return variants.filter((v) => v.recitationMode === 'WASL_ONLY').length;
}

// ==================== ممنوع الوصل ====================

/**
 * يتحقق من وجود ممنوع وصل بين آيتين.
 */
export function hasForbiddenConnection(
  currentAyahKey: number,
  boundaries: RecitationBoundary[]
): boolean {
  // ممنوع الوصل يكون عند نهاية الآية (position = آخر كلمة).
  return boundaries.some(
    (b) => b.kind === 'NO_WASL' && b.connectsToNextAyah
  );
}

/**
 * يتحقق من إمكانية وصل آيتين.
 */
export function canConnectAyahs(
  currentAyahKey: number,
  boundaries: RecitationBoundary[]
): { allowed: boolean; reason?: string } {
  if (hasForbiddenConnection(currentAyahKey, boundaries)) {
    return {
      allowed: false,
      reason: 'يوجد ممنوع وصل بين الآيتين — لا يجوز الوصل في هذا الموضع',
    };
  }
  return { allowed: true };
}

/**
 * يُرجع علامات ممنوع الوصل في الآية.
 */
export function getForbiddenConnections(
  boundaries: RecitationBoundary[]
): RecitationBoundary[] {
  return boundaries.filter((b) => b.kind === 'NO_WASL');
}

// ==================== الوقف الداخلي ====================

/**
 * يُنشئ نطاق عرض معزول للوقف الداخلي.
 */
export function createIsolatedRenderRange(
  ayahKey: number,
  startPosition: number,
  endPosition: number,
  label?: string
): RenderRange {
  return {
    id: createEntityId('range'),
    ayahKey,
    fromPosition: startPosition,
    toPosition: endPosition,
    label: label ?? 'نطاق العرض المعزول',
  };
}

/**
 * يجد علامة الوقف عند موضع معين.
 */
export function findWaqfAtPosition(
  boundaries: RecitationBoundary[],
  position: number
): RecitationBoundary | undefined {
  return boundaries.find((b) => b.kind === 'WAQF' && b.position === position);
}

/**
 * يجد علامة الابتداء عند موضع معين.
 */
export function findIbtidaAtPosition(
  boundaries: RecitationBoundary[],
  position: number
): RecitationBoundary | undefined {
  return boundaries.find((b) => b.kind === 'IBTIDA' && b.position === position);
}

/**
 * يحسب المقاطع المعزولة في الآية (بين علامات الوقف والابتداء).
 */
export function calculateIsolatedSegments(
  boundaries: RecitationBoundary[],
  totalWords: number
): Array<{ start: number; end: number; label: string }> {
  const segments: Array<{ start: number; end: number; label: string }> = [];

  // ترتيب العلامات حسب الموضع.
  const sorted = [...boundaries]
    .filter((b) => b.kind === 'WAQF' || b.kind === 'IBTIDA')
    .sort((a, b) => a.position - b.position);

  if (sorted.length === 0) {
    // لا علامات — الآية كاملة.
    segments.push({ start: 1, end: totalWords, label: 'الآية كاملة' });
    return segments;
  }

  let currentStart = 1;

  for (const boundary of sorted) {
    if (boundary.kind === 'WAQF') {
      // نهاية مقطع.
      segments.push({
        start: currentStart,
        end: boundary.position,
        label: `من ${currentStart} إلى ${boundary.position}`,
      });
      currentStart = boundary.position + 1;
    } else if (boundary.kind === 'IBTIDA') {
      // بداية مقطع جديد.
      if (currentStart < boundary.position) {
        // هناك فجوة — مقطع ضمني.
        segments.push({
          start: currentStart,
          end: boundary.position - 1,
          label: `من ${currentStart} إلى ${boundary.position - 1}`,
        });
      }
      currentStart = boundary.position;
    }
  }

  // المقطع الأخير إن وجد.
  if (currentStart <= totalWords) {
    segments.push({
      start: currentStart,
      end: totalWords,
      label: `من ${currentStart} إلى ${totalWords}`,
    });
  }

  return segments;
}

/**
 * يتحقق من أن موضعًا داخل نطاق معزول.
 */
export function isPositionInRenderRange(
  position: number,
  range: RenderRange | null
): boolean {
  if (!range) return true; // لا نطاق — كل المواضع ظاهرة.
  return position >= range.fromPosition && position <= range.toPosition;
}

/**
 * يُصفّي الاختلافات حسب النطاق المعزول.
 */
export function filterVariantsByRenderRange(
  variants: Variant[],
  range: RenderRange | null
): Variant[] {
  if (!range) return variants;
  return variants.filter((v) => {
    // الاختلاف يظهر إن كان أي جزء منه داخل النطاق.
    return (
      isPositionInRenderRange(v.startPosition, range) ||
      isPositionInRenderRange(v.endPosition, range)
    );
  });
}

// ==================== تحويل الحدود إلى WaqfMark ====================

/**
 * يحوّل RecitationBoundary القديم إلى WaqfMark الجديد (v8).
 */
export function boundaryToWaqfMark(
  boundary: RecitationBoundary,
  ayahKey: number
): WaqfMark {
  const kindMap: Record<RecitationBoundary['kind'], WaqfMark['kind']> = {
    WAQF: 'WAQF',
    IBTIDA: 'IBTIDA',
    WASL: 'WASL',
    NO_WASL: 'FORBIDDEN_WASL',
  };

  return {
    id: boundary.id,
    ayahKey,
    position: boundary.position,
    kind: kindMap[boundary.kind],
    scope: boundary.connectsToNextAyah ? 'END_OF_AYAH' : 'INTERNAL',
    connectsToNextAyah: boundary.connectsToNextAyah,
    label: boundary.label,
    notes: boundary.notes,
    source: 'editor',
    createdAt: new Date().toISOString(),
  };
}

/**
 * يحوّل قائمة حدود إلى WaqfMarks.
 */
export function boundariesToWaqfMarks(
  boundaries: RecitationBoundary[],
  ayahKey: number
): WaqfMark[] {
  return boundaries.map((b) => boundaryToWaqfMark(b, ayahKey));
}

// ==================== تكامل وضع العرض ====================

/** حالة وضع العرض المتكاملة. */
export interface DisplayModeState {
  /** الوضع الحالي (وقف/وصل). */
  mode: RecitationDisplayMode;
  /** هل الآية موصولة بالتالية؟ */
  linkNextAyah: boolean;
  /** النطاق المعزول (إن وجد). */
  renderRange: RenderRange | null;
  /** عدد الاختلافات الظاهرة. */
  visibleCount: number;
  /** عدد الاختلافات المخفية. */
  hiddenCount: number;
}

/**
 * يحسب حالة وضع العرض المتكاملة.
 */
export function calculateDisplayModeState(
  variants: Variant[],
  mode: RecitationDisplayMode,
  linkNextAyah: boolean,
  renderRange: RenderRange | null
): DisplayModeState {
  // تصفية حسب الوضع.
  const modeFiltered = filterVariantsByMode(variants, mode);

  // تصفية حسب النطاق.
  const rangeFiltered = filterVariantsByRenderRange(modeFiltered, renderRange);

  return {
    mode,
    linkNextAyah,
    renderRange,
    visibleCount: rangeFiltered.length,
    hiddenCount: variants.length - rangeFiltered.length,
  };
}

/**
 * يُرجع وصفًا لحالة وضع العرض.
 */
export function describeDisplayMode(state: DisplayModeState): string {
  const parts: string[] = [];

  parts.push(state.mode === 'WAQF' ? 'وقفا' : 'وصلا');

  if (state.linkNextAyah) {
    parts.push('— موصولة بالتالية');
  }

  if (state.renderRange) {
    parts.push(`— نطاق معزول (${state.renderRange.fromPosition}-${state.renderRange.toPosition})`);
  }

  if (state.hiddenCount > 0) {
    parts.push(`— ${state.hiddenCount} مخفية`);
  }

  return parts.join(' ');
}

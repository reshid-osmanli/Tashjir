// مخطط السير في التشجير - Reading Plan
//
// التشجير ليس مجرد ترتيب بصري للأسطر؛ بل يمثل مرور القارئ على مواضع
// الاختلاف. القاعدة الافتراضية فيه هي البدء بآخر موضع في الآية ثم الرجوع
// إلى أولها. مواضع الوقف والابتداء تقسم الآية إلى مقاطع واضحة، ولا يقترح
// المحرك وقفا علميا من تلقاء نفسه: يعرض فقط ما أثبته المحقق.

import type { RecitationBoundary, RecitationMode, Variant } from '@/types/tashjeer';
import type { TraversalOrder } from './engine-settings';

export interface ReadingSegment {
  /** موضع أول كلمة في المقطع. */
  startPosition: number;
  /** موضع آخر كلمة في المقطع. */
  endPosition: number;
  /** هل يفصل هذا المقطع بوقف صريح في نهايته؟ */
  endsWithWaqf: boolean;
}

export interface ReadingPlan {
  traversal: TraversalOrder;
  /** المقاطع مرتبة بترتيب الأداء الذي يعتمده المحرك. */
  segments: ReadingSegment[];
  /** مواضع الكلمات المفردة بترتيب الأداء، مفيدة للمعاينة والاختبار. */
  positions: number[];
  /** هل اختار المحرر وصل رأس الآية بما بعدها؟ */
  connectsToNextAyah: boolean;
  /** المواضع التي منع المحقق الوصل بعدها صراحة. */
  forbiddenWaslAfter: number[];
}

/**
 * يبني خطة القراءة للآية.
 *
 * الوقف بعد كلمة يقسم بعدها، والابتداء قبل كلمة يقسم قبلها. علامة الوصل
 * لا تقسم المقطع، لكنها قد تسجل وصل نهاية الآية بالآية التالية.
 */
export function buildReadingPlan(
  wordsCount: number,
  boundaries: RecitationBoundary[] = [],
  traversal: TraversalOrder = 'END_TO_START'
): ReadingPlan {
  if (wordsCount <= 0) {
    return { traversal, segments: [], positions: [], connectsToNextAyah: false, forbiddenWaslAfter: [] };
  }

  const breakAfter = new Set<number>();
  const waqfAfter = new Set<number>();
  const forbiddenWaslAfter = new Set<number>();
  let connectsToNextAyah = false;

  for (const boundary of boundaries) {
    if (!Number.isInteger(boundary.position) || boundary.position < 1 || boundary.position > wordsCount) {
      continue;
    }

    if (boundary.kind === 'WAQF') {
      breakAfter.add(boundary.position);
      waqfAfter.add(boundary.position);
    }

    if (boundary.kind === 'IBTIDA' && boundary.position > 1) {
      breakAfter.add(boundary.position - 1);
    }

    if (boundary.kind === 'NO_WASL') {
      breakAfter.add(boundary.position);
      forbiddenWaslAfter.add(boundary.position);
    }

    if (
      boundary.kind === 'WASL' &&
      boundary.position === wordsCount &&
      boundary.connectsToNextAyah &&
      !boundaries.some((item) => item.kind === 'NO_WASL' && item.position === wordsCount)
    ) {
      connectsToNextAyah = true;
    }
  }

  const naturalSegments: ReadingSegment[] = [];
  let start = 1;
  for (let position = 1; position <= wordsCount; position++) {
    if (breakAfter.has(position) || position === wordsCount) {
      naturalSegments.push({
        startPosition: start,
        endPosition: position,
        endsWithWaqf: waqfAfter.has(position),
      });
      start = position + 1;
    }
  }

  const segments = traversal === 'END_TO_START' ? [...naturalSegments].reverse() : naturalSegments;
  const positions = segments.flatMap((segment) => {
    const result: number[] = [];
    if (traversal === 'END_TO_START') {
      for (let position = segment.endPosition; position >= segment.startPosition; position--) {
        result.push(position);
      }
    } else {
      for (let position = segment.startPosition; position <= segment.endPosition; position++) {
        result.push(position);
      }
    }
    return result;
  });

  return {
    traversal,
    segments,
    positions,
    connectsToNextAyah,
    forbiddenWaslAfter: [...forbiddenWaslAfter].sort((a, b) => a - b),
  };
}

/** هل يوجد وقف فعلي بعد الموضع في الخطة الحالية؟ */
export function isWaqfAt(position: number, boundaries: RecitationBoundary[]): boolean {
  return boundaries.some(
    (boundary) =>
      boundary.position === position && (boundary.kind === 'WAQF' || boundary.kind === 'NO_WASL')
  );
}

/**
 * يطبّق شرط الوقف/الوصل على الاختلاف دون مسح بياناته. الاختلاف المشروط
 * يبقى في الفهرس والتتبع، لكنه لا يدخل النتيجة النهائية إلا في سياقه.
 */
export function variantAppliesToRecitation(
  variant: Pick<Variant, 'recitationMode' | 'endPosition'>,
  boundaries: RecitationBoundary[]
): boolean {
  const mode: RecitationMode = variant.recitationMode ?? 'ALWAYS';
  if (mode === 'ALWAYS') return true;
  const stopped = isWaqfAt(variant.endPosition, boundaries);
  return mode === 'WAQF_ONLY' ? stopped : !stopped;
}

/**
 * يعيد رتبة موضع في خطة القراءة: 0 يعني أول ما يعالجه المحرك.
 * يفيد في ترتيب اختلاف متعدد الكلمات: نعتمد آخر موضع فعلي في اتجاه القراءة
 * (endPosition في الوضع الصحيح END_TO_START)، لا أول كلمة في مدى الاختلاف.
 */
export function readingRank(
  position: number,
  plan: ReadingPlan
): number {
  const rank = plan.positions.indexOf(position);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

/**
 * يقارن موضعين وفق خطة القراءة. قيمة سالبة تعني أن الأول يسبق الثاني.
 */
export function compareReadingPositions(
  first: number,
  second: number,
  plan: ReadingPlan
): number {
  return readingRank(first, plan) - readingRank(second, plan);
}

/** رقم المقطع في ترتيب الأداء (0 = أول مقطع يعالجه المحرك). */
export function readingSegmentIndex(position: number, plan: ReadingPlan): number {
  const index = plan.segments.findIndex(
    (segment) => position >= segment.startPosition && position <= segment.endPosition
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * يعيد موضع الارتكاز الصحيح لاختلاف يمتد على عدة كلمات.
 * في القاعدة المعتمدة نبدأ بآخر كلمة منه، لا بأوله.
 */
export function variantTraversalAnchor(
  startPosition: number,
  endPosition: number,
  traversal: TraversalOrder = 'END_TO_START'
): number {
  return traversal === 'END_TO_START' ? endPosition : startPosition;
}

// قواعد الترتيب المشتركة - Tashjeer Ordering Rules
//
// كان ترتيب المواضع وترتيب أوجه الموضع محبوسين داخل محرك التشجير الكلاسيكي،
// فلما احتاج محرك الأوجه المركّبة إلى القاعدتين نفسيهما لم يكن أمامه إلا
// تكرارهما — وتكرار قاعدة الترتيب يعني تشجيرين مختلفين لآية واحدة.
// لذلك أُخرجت القاعدتان إلى هنا: مصدر واحد يقرأ منه المحركان.

import type { Variant, VariantAlternative } from '@/types/tashjeer';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import type { TashjeerEngineSettings } from './engine-settings';
import {
  createDefaultStrengthDegrees,
  resolveStrength,
  UNGRADED_RANK,
  type ResolvedStrength,
  type StrengthDegreeCatalog,
} from './strength-degrees';
import {
  compareReadingPositions,
  variantTraversalAnchor,
  type ReadingPlan,
} from './reading-plan';
import { resolveScope } from './scope';
import { narratorTayyibahOrder } from './symbols';

/**
 * ترتيب موضعين من مواضع الآية.
 *
 *   1. الرتبة اليدوية `orderRank` إن ثبّتها المحقق: قرار صريح يسبق كل قاعدة.
 *   2. خطة القراءة (من آخر الآية إلى أولها) مع مراعاة الوقف والابتداء.
 *   3. المدى الأقصر أولا، ثم المعرّف حتى يكون الناتج حتميا.
 */
export function compareVariantsForReading(
  first: Variant,
  second: Variant,
  plan: ReadingPlan
): number {
  const firstRank = first.orderRank;
  const secondRank = second.orderRank;
  if (typeof firstRank === 'number' && typeof secondRank === 'number' && firstRank !== secondRank) {
    return firstRank - secondRank;
  }
  if (typeof firstRank === 'number' && typeof secondRank !== 'number') return -1;
  if (typeof firstRank !== 'number' && typeof secondRank === 'number') return 1;

  const firstAnchor = variantTraversalAnchor(first.startPosition, first.endPosition, plan.traversal);
  const secondAnchor = variantTraversalAnchor(
    second.startPosition,
    second.endPosition,
    plan.traversal
  );

  const traversalDiff = compareReadingPositions(firstAnchor, secondAnchor, plan);
  if (traversalDiff !== 0) return traversalDiff;

  const spanDiff =
    plan.traversal === 'END_TO_START'
      ? second.startPosition - first.startPosition
      : first.endPosition - second.endPosition;
  if (spanDiff !== 0) return spanDiff;

  return first.id.localeCompare(second.id, 'ar');
}

/** المواضع مرتبة بترتيب المرور المعتمد. */
export function orderVariantsForReading(variants: Variant[], plan: ReadingPlan): Variant[] {
  return [...variants].sort((first, second) => compareVariantsForReading(first, second, plan));
}

/**
 * ترتيب وجهين داخل الموضع الواحد.
 *
 * القاعدة المعتمدة: **قوة الوجه في الكتاب**، وقد صارت بعد دمج «الوجه
 * المقدَّم» مع القوة درجةً من سلّم قابل للتحرير. يُقدَّم الوجه ذو الرتبة
 * الأصغر، والوجه غير المدرَّج يأتي بعد المدرَّج.
 */
export function compareAlternatives(
  variant: Variant,
  first: VariantAlternative,
  second: VariantAlternative,
  engine: TashjeerEngineSettings,
  catalog?: TransmissionCatalog,
  strengthDegrees?: StrengthDegreeCatalog
): number {
  // ترتيب صريح للأوجه في هذا الموضع بعينه: أقوى من أي قاعدة عامة.
  const explicit = variant.alternativeOrder ?? [];
  if (explicit.length > 0) {
    const firstIndex = explicit.indexOf(first.id);
    const secondIndex = explicit.indexOf(second.id);
    if (firstIndex !== -1 && secondIndex !== -1 && firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }
    if (firstIndex !== -1 && secondIndex === -1) return -1;
    if (firstIndex === -1 && secondIndex !== -1) return 1;
  }

  if (engine.alternativeOrder === 'MANUAL') {
    // لا ترتيب صريح محفوظ: نسقط إلى الطيبة حتى يكون الناتج حتميا.
    return compareByTayyibah(first, second, catalog);
  }

  if (engine.alternativeOrder === 'STRENGTH') {
    const degrees = strengthDegrees ?? createDefaultStrengthDegrees();
    const firstRank = strengthRankOf(first, degrees, catalog);
    const secondRank = strengthRankOf(second, degrees, catalog);
    if (firstRank !== secondRank) return firstRank - secondRank;
  }

  return compareByTayyibah(first, second, catalog);
}

export function compareByTayyibah(
  first: VariantAlternative,
  second: VariantAlternative,
  catalog?: TransmissionCatalog
): number {
  const firstOrder = leadNarratorOrder(first, catalog);
  const secondOrder = leadNarratorOrder(second, catalog);
  if (firstOrder !== secondOrder) return firstOrder - secondOrder;
  return first.id.localeCompare(second.id, 'ar');
}

/**
 * رتبة قوة الوجه للترتيب. تشمل الحقل الرقمي القديم كي لا يفقد ما حُفظ قبل
 * توحيد المفهومين ترتيبه بعد الترقية.
 */
export function strengthRankOf(
  alt: VariantAlternative,
  degrees: StrengthDegreeCatalog,
  catalog?: TransmissionCatalog
): number {
  const resolved: ResolvedStrength = resolveStrength(alt, alt.scope, degrees, catalog);
  if (resolved.rank !== UNGRADED_RANK) return resolved.rank;
  return typeof alt.strength === 'number' ? alt.strength : UNGRADED_RANK;
}

/**
 * رتبة قوة الوجه عند راوٍ بعينه.
 *
 * ضرورة في المحرك المركّب: الوجه الواحد قد يكون مقدَّما عند راوٍ مؤخَّرا عند
 * آخر، وترتيب أوجه الراوي في سطوره يجب أن يتبع درجته هو لا درجة غيره.
 */
export function strengthRankForNarrator(
  alt: VariantAlternative,
  narratorId: string,
  degrees: StrengthDegreeCatalog,
  catalog?: TransmissionCatalog
): number {
  const perNarrator = alt.strengthByNarrator?.[narratorId];
  if (perNarrator) {
    const degree = degrees.degrees.find((item) => item.id === perNarrator);
    if (degree) return degree.rank;
  }
  return strengthRankOf(alt, degrees, catalog);
}

export function leadNarratorOrder(
  alt: VariantAlternative,
  catalog?: TransmissionCatalog
): number {
  const narratorIds = resolveScope(alt.scope, catalog);
  if (narratorIds.length === 0) return 999;
  return Math.min(...narratorIds.map((id) => narratorTayyibahOrder(id, catalog)));
}

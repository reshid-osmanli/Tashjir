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
import { resolveOrder } from './decision/api';
import { DEFAULT_SYSTEM_PROFILE } from './decision/policy';

/**
 * ترتيب موضعين من مواضع الآية.
 *
 *   1. الرتبة اليدوية `orderRank` إن ثبّتها المحقق: قرار صريح يسبق كل قاعدة — يُحسم عبر Decision API (DM-04).
 *   2. خطة القراءة (من آخر الآية إلى أولها) مع مراعاة الوقف والابتداء.
 *   3. المدى الأقصر أولا، ثم المعرّف حتى يكون الناتج حتميا.
 *
 * التوجيه عبر Decision API يضمن أن ترتيب الظهور يحكمه رقم صريح في البيانات (P-04) وأن أي سياسة
 * ترتيب مستقبلية تمر من مكان واحد (FR-EN-01).
 */
export function compareVariantsForReading(
  first: Variant,
  second: Variant,
  plan: ReadingPlan
): number {
  // الرتبة الصريحة عبر Decision API (DM-04): لا نعتمد ترتيب الإدراج ولا الاسم.
  const firstRank = first.orderRank;
  const secondRank = second.orderRank;
  if (typeof firstRank === 'number' || typeof secondRank === 'number') {
    const resolved = resolveOrder(
      [
        { id: first.id, explicitOrder: firstRank },
        { id: second.id, explicitOrder: secondRank },
      ],
      DEFAULT_SYSTEM_PROFILE
    );
    const firstIndex = resolved.decision.orderedIds.indexOf(first.id);
    const secondIndex = resolved.decision.orderedIds.indexOf(second.id);
    if (firstIndex !== secondIndex) return firstIndex - secondIndex;
  }

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

/** المواضع مرتبة بترتيب المرور المعتمد — يمر عبر Decision API للرتبة الصريحة. */
export function orderVariantsForReading(variants: Variant[], plan: ReadingPlan): Variant[] {
  // للترتيب الجماعي نستخدم القرار المركزي للرتب الصريحة، ثم نطبق خطة القراءة.
  const explicit = variants.filter((v) => typeof v.orderRank === 'number');
  const implicit = variants.filter((v) => typeof v.orderRank !== 'number');
  if (explicit.length > 1) {
    const resolved = resolveOrder(
      explicit.map((v) => ({ id: v.id, explicitOrder: v.orderRank })),
      DEFAULT_SYSTEM_PROFILE
    );
    const orderMap = new Map(resolved.decision.orderedIds.map((id, idx) => [id, idx]));
    explicit.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  }
  const all = [...explicit, ...implicit];
  return [...all].sort((first, second) => compareVariantsForReading(first, second, plan));
}

/**
 * ترتيب وجهين داخل الموضع الواحد.
 *
 * القاعدة المعتمدة: **قوة الوجه في الكتاب**، وقد صارت بعد دمج «الوجه
 * المقدَّم» مع القوة درجةً من سلّم قابل للتحرير. يُقدَّم الوجه ذو الرتبة
 * الأصغر، والوجه غير المدرَّج يأتي بعد المدرَّج.
 *
 * الترتيب الصريح يمر عبر Decision API (DM-04، FR-EN-03).
 */
export function compareAlternatives(
  variant: Variant,
  first: VariantAlternative,
  second: VariantAlternative,
  engine: TashjeerEngineSettings,
  catalog?: TransmissionCatalog,
  strengthDegrees?: StrengthDegreeCatalog
): number {
  // ترتيب صريح للأوجه في هذا الموضع بعينه: أقوى من أي قاعدة عامة — عبر Decision API.
  const explicit = variant.alternativeOrder ?? [];
  if (explicit.length > 0) {
    const orderMap = new Map(explicit.map((id, idx) => [id, idx]));
    const firstExplicit = orderMap.has(first.id) ? orderMap.get(first.id) : undefined;
    const secondExplicit = orderMap.has(second.id) ? orderMap.get(second.id) : undefined;
    if (firstExplicit !== undefined || secondExplicit !== undefined) {
      const resolved = resolveOrder(
        [
          { id: first.id, explicitOrder: firstExplicit },
          { id: second.id, explicitOrder: secondExplicit },
        ],
        DEFAULT_SYSTEM_PROFILE
      );
      const firstIdx = resolved.decision.orderedIds.indexOf(first.id);
      const secondIdx = resolved.decision.orderedIds.indexOf(second.id);
      if (firstIdx !== secondIdx) return firstIdx - secondIdx;
    }
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

// تعدد الاختلافات المستقلة - Multiple Independent Differences
// FR-ED-03: عدة اختلافات مستقلة لنفس القارئ ونفس الكلمة
// DM-09: تعدد الاختلافات لنفس القارئ+الموضع
//
// المبادئ:
//   - كل اختلاف كيان مستقل بمعرفه الخاص
//   - لا دمج تلقائي لمجرد تطابق القارئ والموضع
//   - occurrenceIndex يميز الاختلافات المتعددة (الأول، الثاني، الثالث...)
//   - التنافي يُحدد عبر Resolver وفق سياسة الدمج
//   - العلاقات MUTUALLY_EXCLUSIVE توثق التنافي صراحة

import type { Variant, ReadingScope } from '@/types/tashjeer';
import type { Difference, Relation, RelationType } from '@/lib/tashjeer/model/v8';
import { resolveMerge } from '@/lib/tashjeer/decision/api';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';

// ==================== أنواع البيانات ====================

/** مجموعة اختلافات في نفس الموضع. */
export interface DifferenceGroup {
  /** مفتاح التجميع: startPosition-endPosition-scopeKey. */
  key: string;
  /** الموضع المشترك. */
  startPosition: number;
  endPosition: number;
  /** نطاق القراء المشترك (أو عام إن تعددت النطاقات). */
  scope: ReadingScope;
  /** الاختلافات في هذه المجموعة. */
  differences: Difference[];
  /** عدد الاختلافات. */
  count: number;
}

/** نتيجة فحص التنافي بين اختلافين. */
export interface ExclusionCheck {
  /** هل الاختلافان متنافيان؟ */
  exclusive: boolean;
  /** السبب. */
  reason: string;
  /** العلاقة الموجودة (إن وُجدت). */
  relation?: Relation;
}

/** ملخص تعدد الاختلافات في موضع. */
export interface MultiDifferenceSummary {
  /** عدد الاختلافات المستقلة. */
  totalDifferences: number;
  /** عدد الأزواج المتنافية. */
  exclusivePairs: number;
  /** عدد الأزواج المرتبطة. */
  relatedPairs: number;
  /** عدد الأزواج المستقلة. */
  independentPairs: number;
}

// ==================== التجميع ====================

/**
 * يبني مفتاح تجميع فريد للموضع + النطاق.
 */
export function buildGroupKey(
  startPosition: number,
  endPosition: number,
  scope: ReadingScope
): string {
  const scopeKey = buildScopeKey(scope);
  return `${startPosition}-${endPosition}-${scopeKey}`;
}

/**
 * يبني مفتاح نطاق للتجميع.
 */
function buildScopeKey(scope: ReadingScope): string {
  const ids = new Set<string>();
  for (const id of scope.narratorIds ?? []) ids.add(id);
  for (const id of scope.imamIds ?? []) ids.add(id);
  for (const id of scope.pathIds ?? []) ids.add(id);
  const sorted = [...ids].sort();
  return sorted.length > 0 ? `SCOPED:${sorted.join(',')}` : scope.kind;
}

/**
 * يجمع الاختلافات حسب الموضع والنطاق.
 */
export function groupDifferencesByLocus(differences: Difference[]): DifferenceGroup[] {
  const groups = new Map<string, DifferenceGroup>();

  for (const diff of differences) {
    const key = buildGroupKey(
      diff.locus.startPosition,
      diff.locus.endPosition,
      diff.scope
    );

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        startPosition: diff.locus.startPosition,
        endPosition: diff.locus.endPosition,
        scope: diff.scope,
        differences: [],
        count: 0,
      });
    }

    const group = groups.get(key)!;
    group.differences.push(diff);
    group.count++;
  }

  return [...groups.values()];
}

// ==================== فهرس الحدوث ====================

/**
 * يحسب occurrenceIndex لكل اختلاف في المجموعة.
 * يعيد خريطة: differenceId → occurrenceIndex.
 */
export function computeOccurrenceIndices(
  differences: Difference[]
): Map<string, number> {
  const groups = groupDifferencesByLocus(differences);
  const indices = new Map<string, number>();

  for (const group of groups) {
    // ترتيب حسب الرتبة ثم المعرف.
    const sorted = [...group.differences].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.id.localeCompare(b.id, 'ar');
    });

    sorted.forEach((diff, index) => {
      indices.set(diff.id, index + 1);
    });
  }

  return indices;
}

/**
 * يرجع label لعرض فهرس الحدوث بالعربية.
 */
export function formatOccurrenceLabel(index: number, total: number): string {
  if (total <= 1) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const toArabic = (n: number) =>
    String(n)
      .split('')
      .map((d) => arabicDigits[parseInt(d)] || d)
      .join('');
  return `اختلاف ${toArabic(index)} من ${toArabic(total)}`;
}

// ==================== فحص التنافي ====================

/**
 * يفحص التنافي بين اختلافين عبر Decision Resolver.
 */
export function checkMutualExclusion(
  diffA: Difference,
  diffB: Difference,
  profile: EngineConfig
): ExclusionCheck {
  // التحقق من وجود علاقة MUTUALLY_EXCLUSIVE صريحة.
  const existingRelation = findRelation(diffA, diffB, 'MUTUALLY_EXCLUSIVE');
  if (existingRelation) {
    return {
      exclusive: true,
      reason: 'علاقة تنافٍ صريحة',
      relation: existingRelation,
    };
  }

  // استشارة Resolver.
  const result = resolveMerge(diffA.category, diffB.category, profile);
  const exclusive = !result.decision.merge;

  return {
    exclusive,
    reason: result.decision.reason,
  };
}

/**
 * يبحث عن علاقة من نوع معين بين اختلافين.
 */
function findRelation(
  diffA: Difference,
  diffB: Difference,
  type: RelationType
): Relation | undefined {
  return diffA.relations.find(
    (rel) =>
      rel.type === type &&
      ((rel.fromId === diffA.id && rel.toId === diffB.id) ||
        (rel.fromId === diffB.id && rel.toId === diffA.id))
  );
}

/**
 * يفحص التنافي بين كل أزواج الاختلافات في مجموعة.
 */
export function checkAllExclusions(
  group: DifferenceGroup,
  profile: EngineConfig
): Map<string, ExclusionCheck> {
  const checks = new Map<string, ExclusionCheck>();

  for (let i = 0; i < group.differences.length; i++) {
    for (let j = i + 1; j < group.differences.length; j++) {
      const diffA = group.differences[i];
      const diffB = group.differences[j];
      const pairKey = `${diffA.id}:${diffB.id}`;
      checks.set(pairKey, checkMutualExclusion(diffA, diffB, profile));
    }
  }

  return checks;
}

// ==================== الملخص ====================

/**
 * يبني ملخص تعدد الاختلافات في مجموعة.
 */
export function summarizeMultiDifferences(
  group: DifferenceGroup,
  profile: EngineConfig
): MultiDifferenceSummary {
  const checks = checkAllExclusions(group, profile);

  let exclusivePairs = 0;
  let relatedPairs = 0;
  let independentPairs = 0;

  for (const check of checks.values()) {
    if (check.exclusive) {
      exclusivePairs++;
    } else if (check.relation) {
      relatedPairs++;
    } else {
      independentPairs++;
    }
  }

  return {
    totalDifferences: group.count,
    exclusivePairs,
    relatedPairs,
    independentPairs,
  };
}

// ==================== التحقق من الاستبدال الضمني ====================

/**
 * يتحقق من عدم وجود استبدال ضمني عند إضافة اختلاف جديد.
 * يرجع تحذيرًا إن كان الاختلاف الجديد سيحل محل اختلاف موجود.
 */
export function detectImplicitReplacement(
  newDiff: Difference,
  existingDifferences: Difference[]
): { warning: boolean; reason?: string; conflictingId?: string } {
  const group = groupDifferencesByLocus([newDiff, ...existingDifferences]).find(
    (g) => g.differences.some((d) => d.id === newDiff.id)
  );

  if (!group || group.count <= 1) {
    return { warning: false };
  }

  // البحث عن اختلاف موجود بنفس الفئة.
  const sameCategory = group.differences.find(
    (d) => d.id !== newDiff.id && d.category === newDiff.category
  );

  if (sameCategory) {
    return {
      warning: true,
      reason: `يوجد اختلاف آخر بنفس الفئة (${sameCategory.category}) في نفس الموضع`,
      conflictingId: sameCategory.id,
    };
  }

  return { warning: false };
}

// ==================== التكامل مع Variant القديم ====================

/**
 * يحسب occurrenceIndex لنموذج Variant القديم (للتوافق).
 */
export function computeVariantOccurrenceIndices(
  variants: Variant[]
): Map<string, number> {
  const groups = new Map<string, Variant[]>();

  for (const variant of variants) {
    // اشتقاق النطاق من أول وجه غير أساسي (أو الأول).
    const firstAlt = variant.alternatives.find((a) => !a.isBase) ?? variant.alternatives[0];
    const scope: ReadingScope = firstAlt?.scope ?? { kind: 'ALL' };
    const key = `${variant.startPosition}-${variant.endPosition}-${buildScopeKey(scope)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(variant);
  }

  const indices = new Map<string, number>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      if ((a.orderRank ?? 0) !== (b.orderRank ?? 0)) {
        return (a.orderRank ?? 0) - (b.orderRank ?? 0);
      }
      return a.id.localeCompare(b.id, 'ar');
    });
    sorted.forEach((v, i) => indices.set(v.id, i + 1));
  }

  return indices;
}

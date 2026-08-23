// التعميم متعدد الأنواع والاستقلال المحلي
// FR-ED-10: التعميم متعدد الأنواع + التحرير المحلي المستقل
//
// المبادئ:
//   1. ترتيب الأنواع: تحقيق=1، أصول=2، فرش=3 (رتب صريحة)
//   2. كل نوع يظهر بجانب السطر حسب رتبته
//   3. بعد التعميم، فتح أي آية يعرض الأنواع مستقلة
//   4. تعديل نوع محليًا لا يمس الأنواع الأخرى ولا القاعدة الأم
//   5. لا نسخ آلاف المستندات — الاشتقاق بلا نسخ + Override layer

import type { Variant, ReadingScope } from '@/types/tashjeer';
import type { VariantCategory } from '@/types';
import type {
  GlobalRule,
  RuleOccurrence,
  Locus,
  EntityId,
} from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';

// ==================== ترتيب الأنواع ====================

/** الرتب الافتراضية لأنواع التعميم (DM-04, FR-ED-10). */
export const CATEGORY_RANK: Partial<Record<VariantCategory, number>> = {
  USUL: 1,      // أصول (تحقيق)
  FARSH: 3,     // فرش
  MADUD: 2,     // مدود (أصول)
  HAMZ: 2,      // همز (أصول)
  WAQF: 4,      // وقف
  TAJWEED: 5,   // تجويد
};

/** يُرجع رتبة النوع (افتراضيًا 99 إن لم تُحدد). */
export function getCategoryRank(category: VariantCategory): number {
  return CATEGORY_RANK[category] ?? 99;
}

/** ترتيب الأنواع حسب الرتبة الصريحة. */
export function sortCategoriesByRank(categories: VariantCategory[]): VariantCategory[] {
  return [...categories].sort((a, b) => getCategoryRank(a) - getCategoryRank(b));
}

// ==================== التعميم متعدد الأنواع ====================

/** بيانات التعميم متعدد الأنواع. */
export interface MultiTypeGeneralization {
  /** الأنواع المُعمَّمة مرتبة. */
  categories: VariantCategory[];
  /** نمط المطابقة الحتمي (CHARACTERS أو MORPHOLOGY). */
  pattern: unknown;
  /** نطاق القراء العام. */
  scope: ReadingScope;
  /** الموضع (كلمة/حرف/مدى). */
  locus: Locus;
  /** عنوان كل نوع. */
  titles: Record<string, string>;
  /** labels كل نوع. */
  ruleLabels: Record<string, string>;
  /** معرّف الدفعة (للتتبع فقط — P-05). */
  batchId: EntityId;
}

/** نتيجة التعميم متعدد الأنواع. */
export interface MultiTypeGeneralizationResult {
  /** القواعد العامة المُنشأة (واحدة لكل نوع). */
  rules: GlobalRule[];
  /** المواضع المشتقة الأولية. */
  occurrences: RuleOccurrence[];
  /** معرّف الدفعة. */
  batchId: EntityId;
}

/**
 * يُعمّم عدة أنواع مستقلة في عملية واحدة.
 * كل نوع يُحفظ كقاعدة عامة مستقلة برتبته.
 */
export function createMultiTypeGeneralization(
  input: MultiTypeGeneralization,
  matchCount: number
): MultiTypeGeneralizationResult {
  const sortedCategories = sortCategoriesByRank(input.categories);
  const rules: GlobalRule[] = [];
  const occurrences: RuleOccurrence[] = [];

  for (const category of sortedCategories) {
    const ruleId = createEntityId('gr');
    const rank = getCategoryRank(category);

    const rule: GlobalRule = {
      id: ruleId,
      title: input.titles[category] ?? `${category} — قاعدة عامة`,
      category,
      pattern: input.pattern,
      scope: input.scope,
      ruleLabel: input.ruleLabels[category],
      priority: rank * 10,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rules.push(rule);
  }

  return {
    rules,
    occurrences,
    batchId: input.batchId,
  };
}

// ==================== الاستقلال المحلي ====================

/** بيانات التجاوز المحلي (localOverride). */
export interface LocalOverrideData {
  /** معرّف القاعدة العامة. */
  globalRuleId: EntityId;
  /** معرّف الموضع المشتق. */
  occurrenceId: EntityId;
  /** نوع التجاوز. */
  type: 'MODIFY' | 'DELETE' | 'RESTORE';
  /** التعديل (إن كان MODIFY). */
  patch?: Partial<Variant>;
  /** ملاحظة. */
  note?: string;
}

/**
 * يتحقق من أن التعديل المحلي لا يمس القاعدة الأم ولا بقية المواضع.
 */
export function validateLocalOverride(
  override: LocalOverrideData,
  allOccurrences: RuleOccurrence[]
): { valid: boolean; reason?: string } {
  // التحقق من وجود الموضع.
  const occurrence = allOccurrences.find((o) => o.id === override.occurrenceId);
  if (!occurrence) {
    return { valid: false, reason: 'الموضع غير موجود' };
  }

  // التحقق من أن الموضع ينتمي للقاعدة.
  if (occurrence.globalRuleId !== override.globalRuleId) {
    return { valid: false, reason: 'الموضع لا ينتمي لهذه القاعدة' };
  }

  return { valid: true };
}

/**
 * يُطبّق تجاوزًا محليًا على موضع مشتق.
 * يُرجع الموضع المُعدَّل دون تعديل بقية المواضع.
 */
export function applyLocalOverride(
  occurrence: RuleOccurrence,
  override: LocalOverrideData
): RuleOccurrence {
  switch (override.type) {
    case 'MODIFY':
      return {
        ...occurrence,
        modified: true,
        localOverride: {
          variantPatch: override.patch,
          note: override.note,
          by: 'editor',
          at: new Date().toISOString(),
        },
      };
    case 'DELETE':
      return {
        ...occurrence,
        cancelled: true,
        localOverride: {
          cancelled: true,
          note: override.note,
          by: 'editor',
          at: new Date().toISOString(),
        },
      };
    case 'RESTORE':
      return {
        ...occurrence,
        modified: false,
        cancelled: false,
        localOverride: undefined,
      };
    default:
      return occurrence;
  }
}

// ==================== تحليل الأثر ====================

/** ملخص أثر حذف قاعدة أم. */
export interface DeletionImpact {
  /** عدد المواضع المشتقة. */
  derivedOccurrences: number;
  /** عدد المواضع المتجاوزة محليًا. */
  overriddenOccurrences: number;
  /** عدد المواضع المؤكدة. */
  confirmedOccurrences: number;
  /** الأنواع المتأثرة (إن كانت جزءًا من تعميم متعدد). */
  relatedCategories: VariantCategory[];
  /** تحذير. */
  warning: string;
}

/**
 * يحسب أثر حذف قاعدة عامة.
 */
export function calculateDeletionImpact(
  rule: GlobalRule,
  occurrences: RuleOccurrence[],
  allRules: GlobalRule[]
): DeletionImpact {
  const ruleOccurrences = occurrences.filter((o) => o.globalRuleId === rule.id);
  const overridden = ruleOccurrences.filter((o) => o.localOverride);
  const confirmed = ruleOccurrences.filter((o) => o.confirmed);

  // البحث عن قواعد من نفس الدفعة (تعميم متعدد).
  const relatedRules = allRules.filter(
    (r) => r.id !== rule.id && r.category !== rule.category
  );
  const relatedCategories = relatedRules.map((r) => r.category);

  const warning =
    ruleOccurrences.length > 0
      ? `حذف القاعدة يؤثر على ${ruleOccurrences.length} موضعًا مشتقًا`
      : 'لا مواضع مشتقة — الحذف آمن';

  return {
    derivedOccurrences: ruleOccurrences.length,
    overriddenOccurrences: overridden.length,
    confirmedOccurrences: confirmed.length,
    relatedCategories: [...new Set(relatedCategories)],
    warning,
  };
}

// ==================== عرض الأنواع المستقلة ====================

/** مجموعة أنواع مستقلة في آية واحدة. */
export interface IndependentTypesGroup {
  /** معرّف الموضع المشترك. */
  locusKey: string;
  /** الأنواع مرتبة حسب الرتبة. */
  types: Array<{
    category: VariantCategory;
    rank: number;
    variants: Variant[];
    isGlobalDerived: boolean;
    hasLocalOverride: boolean;
  }>;
}

/**
 * يجمع الأنواع المستقلة في آية حسب الموضع.
 * كل نوع يظهر منفصلًا بترتيبه الصريح.
 */
export function groupIndependentTypes(
  variants: Variant[],
  occurrenceOverrides: Map<string, { modified?: boolean; cancelled?: boolean }>
): IndependentTypesGroup[] {
  const groups = new Map<string, IndependentTypesGroup>();

  for (const variant of variants) {
    const locusKey = `${variant.startPosition}-${variant.endPosition}`;

    if (!groups.has(locusKey)) {
      groups.set(locusKey, { locusKey, types: [] });
    }

    const group = groups.get(locusKey)!;
    const existingType = group.types.find((t) => t.category === variant.category);

    if (existingType) {
      existingType.variants.push(variant);
    } else {
      const hasOverride = variant.isGlobalDerived && variant.globalRuleId
        ? occurrenceOverrides.has(variant.globalRuleId) ?? false
        : false;

      group.types.push({
        category: variant.category,
        rank: getCategoryRank(variant.category),
        variants: [variant],
        isGlobalDerived: variant.isGlobalDerived ?? false,
        hasLocalOverride: hasOverride,
      });
    }
  }

  // ترتيب الأنواع حسب الرتبة.
  for (const group of groups.values()) {
    group.types.sort((a, b) => a.rank - b.rank);
  }

  return [...groups.values()];
}

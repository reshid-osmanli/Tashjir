// تعدد الاختلافات لنفس القارئ والموضع — Multi-Difference per Locus (FR-ED-03، DM-09)
// مشروع التشجير - نظام القراءات العشر
//
// القاعدة الصارمة: الاختلافات المتعددة لنفس الكلمة لا تُدمج تلقائيا لمجرد
// أنها لنفس القارئ. المفتاح ليس (قارئ+كلمة) بل **معرف مستقل لكل اختلاف**،
// وكل اختلاف يحمل فهرسه ضمن موضع القارئ نفسه (`occurrenceIndex`: الأول،
// الثاني، الثالث...).
//
// هذه الوحدة نقيّة وحتمية بلا DOM ولا تخزين: تجميع الاختلافات في مجموعات
// (قارئ × موضع)، إسناد الفهارس وحلّها، وترتيب اختلافات الموضع للعرض.
// قرار «متنافيان أم مرتبطان؟» ليس هنا — ذلك للـ Resolver عبر
// `decision/editor-bridge.ts` حصريا (P-07).

import type { Variant } from '@/types/tashjeer';
import { positionsOfVariant } from './loci';

/** قرار يدوي على زوج اختلافين: متنافيان (لا يُضربان) أو مرتبطان (يجتمعان). */
export type LocusVerdict = 'EXCLUSIVE' | 'RELATED';

/** علاقة موضع يدوية كما يستهلكها محرك التراكيب. */
export interface ManualLocusRelation {
  firstId: string;
  secondId: string;
  verdict: LocusVerdict;
  /** معرّف الرابط اليدوي المصدر، للتتبع. */
  linkId?: string;
}

/**
 * مفتاح الزوج غير حسّاس للترتيب: («a»،«b») و(«b»،«a») مفتاح واحد.
 * تُبنى عليه خرائط القرارات اليدوية حتى لا يتضاعف الزوج الواحد.
 */
export function locusPairKey(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join('::');
}

/**
 * مفتاح نطاق القارئ للتجميع (DM-09).
 *
 * النطاق في نموذج المحرر على الأوجه لا على الاختلاف، فنجمع معرّفات كل
 * الأوجه غير الأساسية (رواة/أئمة/طرق). عند غيابها نسقط إلى النطاق العام.
 * حتمي ومستقل عن الكتالوج: يعمل في المخزن المتزامن وفي الترحيل سواء.
 */
export function variantScopeKey(variant: Variant): string {
  const ids = new Set<string>();
  for (const alt of variant.alternatives) {
    if (alt.isBase) continue;
    for (const id of alt.scope?.narratorIds ?? []) ids.add(`N:${id}`);
    for (const id of alt.scope?.imamIds ?? []) ids.add(`I:${id}`);
    for (const id of alt.scope?.pathIds ?? []) ids.add(`P:${id}`);
  }
  // اختلاف بلا أوجه مرسومة (مسودة بوجه المصحف وحده): يُجمَّع مع عموم الموضع
  // حتى لا يتشتت عن بقية اختلافات الكلمة نفسها.
  if (ids.size === 0) return 'ALL';
  return [...ids].sort().join(',');
}

/**
 * مجموعات التعدد (قارئ × موضع): كل اختلاف ← معرّف مجموعته.
 *
 * يجتمع اختلافان في مجموعة واحدة إن تقاطعا في كلمة واحدة على الأقل
 * (بمواضعهما الفعلية، لا بحدود المدى المسجّل) واتحد مفتاح نطاق قارئهما.
 * التجميع باتحاد-وجود (union-find) بترتيب المستند، فالناتج حتمي.
 */
export function multiDifferenceGroups(variants: Variant[]): Map<string, string> {
  const parent = new Map(variants.map((variant) => [variant.id, variant.id]));

  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const positionsCache = new Map(variants.map((variant) => [variant.id, new Set(positionsOfVariant(variant))]));
  const scopeCache = new Map(variants.map((variant) => [variant.id, variantScopeKey(variant)]));

  for (let i = 0; i < variants.length; i += 1) {
    for (let j = i + 1; j < variants.length; j += 1) {
      const first = variants[i];
      const second = variants[j];
      if (scopeCache.get(first.id) !== scopeCache.get(second.id)) continue;
      const firstPositions = positionsCache.get(first.id) ?? new Set<number>();
      const secondPositions = positionsCache.get(second.id) ?? new Set<number>();
      const share = [...firstPositions].some((position) => secondPositions.has(position));
      if (!share) continue;
      const a = find(first.id);
      const b = find(second.id);
      if (a !== b) parent.set(a, b);
    }
  }

  const groups = new Map<string, string>();
  for (const variant of variants) groups.set(variant.id, find(variant.id));
  return groups;
}

/** هل الفهرس المخزّن صالح (عدد صحيح موجب)؟ */
export function isValidOccurrenceIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * يحلّ فهرس كل اختلاف (Map: المعرّف ← الفهرس).
 *
 * - الفهرس المخزّن الصالح يُحترم كما هو ولا يعاد ترقيمه أبدا (حذف «اختلاف ٢»
 *   لا يغيّر «اختلاف ٣» إلى ٢؛ استقرار الملفات المصدَّرة DM-13).
 * - من لا فهرس له (مستندات قديمة ومسودات البذرة) يأخذ التالي بعد أعلى فهرس
 *   مخزّن في مجموعته، بترتيب المستند — حتمي ومستقر.
 */
export function resolveOccurrenceIndices(variants: Variant[]): Map<string, number> {
  const groups = multiDifferenceGroups(variants);
  const members = new Map<string, Variant[]>();
  for (const variant of variants) {
    const group = groups.get(variant.id) ?? variant.id;
    const list = members.get(group) ?? [];
    list.push(variant);
    members.set(group, list);
  }

  const indices = new Map<string, number>();
  for (const list of members.values()) {
    const used = new Set<number>();
    for (const variant of list) {
      if (isValidOccurrenceIndex(variant.occurrenceIndex)) used.add(variant.occurrenceIndex);
    }
    let next = used.size > 0 ? Math.max(...used) + 1 : 1;
    for (const variant of list) {
      if (isValidOccurrenceIndex(variant.occurrenceIndex)) {
        indices.set(variant.id, variant.occurrenceIndex);
        continue;
      }
      // فهرس مخزّن مكرر داخل المجموعة (فساد قديم): يُعامل كالمفقود.
      while (used.has(next)) next += 1;
      indices.set(variant.id, next);
      used.add(next);
      next += 1;
    }
  }
  return indices;
}

/**
 * الفهرس التالي لمرشّح جديد ضمن مجموعته (قارئ × موضع).
 * يُستعمل عند الإنشاء فقط؛ الموجودون لا تُمسّ فهارسهم.
 */
export function nextOccurrenceIndex(existing: Variant[], candidate: Variant): number {
  const groups = multiDifferenceGroups([...existing, candidate]);
  const group = groups.get(candidate.id) ?? candidate.id;
  const indices = resolveOccurrenceIndices(existing);
  let max = 0;
  for (const variant of existing) {
    if ((groups.get(variant.id) ?? variant.id) !== group) continue;
    max = Math.max(max, indices.get(variant.id) ?? 0);
  }
  return max + 1;
}

/** اختلافات كلمة بعينها (بمواضعها الفعلية، لا بحدود المدى). */
export function differencesAtPosition(variants: Variant[], position: number): Variant[] {
  return variants.filter((variant) => positionsOfVariant(variant).includes(position));
}

/**
 * ترتيب اختلافات الموضع للعرض — حتمي ومستقر (قرار محسوم في الحزمة):
 * المصدر (المحرك ثم المحرر) ← الرتبة الصريحة ← الفهرس ← المعرّف.
 */
export function sortDifferencesForLocus(
  diffs: Variant[],
  indices?: Map<string, number>
): Variant[] {
  const resolved = indices ?? resolveOccurrenceIndices(diffs);
  return [...diffs].sort((first, second) => {
    const firstEngine = first.origin !== 'EDITOR' ? 0 : 1;
    const secondEngine = second.origin !== 'EDITOR' ? 0 : 1;
    if (firstEngine !== secondEngine) return firstEngine - secondEngine;
    const firstRank = typeof first.orderRank === 'number' ? first.orderRank : Number.MAX_SAFE_INTEGER;
    const secondRank = typeof second.orderRank === 'number' ? second.orderRank : Number.MAX_SAFE_INTEGER;
    if (firstRank !== secondRank) return firstRank - secondRank;
    const firstIndex = resolved.get(first.id) ?? Number.MAX_SAFE_INTEGER;
    const secondIndex = resolved.get(second.id) ?? Number.MAX_SAFE_INTEGER;
    if (firstIndex !== secondIndex) return firstIndex - secondIndex;
    return first.id.localeCompare(second.id, 'ar');
  });
}

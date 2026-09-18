// تعدد الاختلافات لنفس القارئ والموضع — Difference Occurrences (DM-09، FR-ED-03)
// مشروع التشجير - نظام القراءات العشر
//
// القاعدة الصارمة (حزمة 05): الاختلافات المتعددة لنفس الكلمة لا تُدمج تلقائيًا
// لمجرد أنها لنفس القارئ. كل اختلاف كيان مستقل بمعرّفه، و«الفهرس» (الأول/الثاني/)
// ترتيبُ عرضٍ داخل مجموعة الموضع+النطاق نفسها، يُشتق اشتقاقًا حتميًا من المستند
// لا يُخزَّن، فلا يتقادم أبدًا ولا يتصادم.
//
// هذا الملف هو المكان الوحيد لحساب:
//   - مفتاح مجموعة التعدد (الموضع + نطاق القرّاء) — نفس منطق ترحيل v7→v8
//     حرفيًا فلا يختلف التصدير عن السابق ببايت (DM-13)،
//   - فهرس كل اختلاف داخل مجموعته (occurrenceIndex)،
//   - ترتيب عرض اختلافات الموضع (المصدر ثم الرتبة الصريحة ثم الفهرس — قرار
//     محسوم في §8 من الحزمة)،
//   - رسالة حالة «اختلافان لموضع واحد» عند إضافة ثانٍ (معيار القبول ٢).
//
// دوال نقية بلا متصفح ولا مخزن؛ تُستعمل من المحرر والترحيل والاختبارات معًا.

import type { Variant } from '@/types/tashjeer';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

// ==================== مفاتيح مجموعة التعدد ====================

/**
 * مفتاح نطاق قرّاء الاختلاف للتجميع عند تعدد الاختلافات في الموضع نفسه
 * (DM-09). النطاق في نموذج المحرر على الأوجه لا على الاختلاف، فنجمع معرّفات
 * كل الأوجه. عند غيابها نسقط إلى النطاق العام.
 *
 * نفس الدلالة التي كان يحسبها ترحيل v7→v8 محليًا؛ انتقلت إلى هنا لتكون قرارًا
 * واحدًا في مكان واحد (P-07).
 */
export function differenceScopeKey(variant: Variant): string {
  const ids = new Set<string>();
  for (const alt of variant.alternatives) {
    for (const id of alt.scope?.narratorIds ?? []) ids.add(id);
    for (const id of alt.scope?.imamIds ?? []) ids.add(id);
    for (const id of alt.scope?.pathIds ?? []) ids.add(id);
  }
  const sorted = [...ids].sort();
  return sorted.length > 0 ? `SCOPED:${sorted.join(',')}` : 'ALL';
}

/**
 * مفتاح مجموعة التعدد: حدود الموضع + نطاق القرّاء. اختلافان بمفتاح واحد هما
 * «اختلافان لموضع واحد» (القارئ نفسه × الكلمة نفسها) فيُفهرسان ١ و٢.
 */
export function differenceOccurrenceKey(variant: Variant): string {
  return `${variant.startPosition}-${variant.endPosition}-${differenceScopeKey(variant)}`;
}

// ==================== الفهرس (occurrenceIndex) ====================

/**
 * يحسب فهرس كل اختلاف ضمن مجموعته (الأول = ١). حتمي: يتبع ترتيب المصفوفة
 * كما هو — وهو نفسه ما يفعله ترحيل v7→v8 فلا يتغير التصدير.
 */
export function assignOccurrenceIndices(variants: Variant[]): Map<string, number> {
  const counters = new Map<string, number>();
  const indices = new Map<string, number>();
  for (const variant of variants) {
    const key = differenceOccurrenceKey(variant);
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    indices.set(variant.id, next);
  }
  return indices;
}

/** فهرس اختلاف واحد ضمن مجموعته في سياق القائمة المعطاة (١ عند الغياب). */
export function occurrenceIndexOf(variant: Variant, all: Variant[]): number {
  return assignOccurrenceIndices(all).get(variant.id) ?? 1;
}

// ==================== المصدر والترتيب ====================

/**
 * مصدر الاختلاف بمصطلح النموذج الموحّد (engine/editor): المشتق من قاعدة عامة
 * محرك، وكذلك ما نُشأ ببيانات أساسية (origin=ENGINE)؛ وما عداه محرر — وهي
 * نفس خريطة ترحيل v7→v8 فلا يختلف العرض عن التصدير.
 */
export function differenceSourceOf(variant: Variant): 'engine' | 'editor' {
  if (variant.isGlobalDerived) return 'engine';
  return variant.origin === 'ENGINE' ? 'engine' : 'editor';
}

/**
 * ترتيب عرض اختلافات الموضع الواحد — القرار المحسوم (§8):
 * المصدر (engine ثم editor)، ثم الرتبة الصريحة (orderRank الأصغر أولًا)،
 * ثم فهرس التعدد، ثم المعرّف كاسر تعادل حتمي أخير. مستقل وقابل للتكرار.
 */
export function sortLocusDifferences(variants: Variant[]): Variant[] {
  const indices = assignOccurrenceIndices(variants);
  return [...variants].sort((first, second) => {
    const sourceFirst = differenceSourceOf(first) === 'engine' ? 0 : 1;
    const sourceSecond = differenceSourceOf(second) === 'engine' ? 0 : 1;
    if (sourceFirst !== sourceSecond) return sourceFirst - sourceSecond;
    const rankFirst = first.orderRank ?? Number.MAX_SAFE_INTEGER;
    const rankSecond = second.orderRank ?? Number.MAX_SAFE_INTEGER;
    if (rankFirst !== rankSecond) return rankFirst - rankSecond;
    const indexFirst = indices.get(first.id) ?? 1;
    const indexSecond = indices.get(second.id) ?? 1;
    if (indexFirst !== indexSecond) return indexFirst - indexSecond;
    return first.id.localeCompare(second.id, 'ar');
  });
}

// ==================== اختلافات الموضع ====================

/**
 * اختلافات الموضع للعرض في لوحة التفاصيل: كل اختلاف يغطي هذه الكلمة
 * (start ≤ الموضع ≤ end) — نفس دلالة «اختلافات في الموضع» القائمة، مرتبة
 * بترتيب العرض المعتمد أعلاه.
 */
export function differencesCoveringPosition(all: Variant[], position: number): Variant[] {
  return sortLocusDifferences(
    all.filter((variant) => position >= variant.startPosition && position <= variant.endPosition)
  );
}

// ==================== رسالة حالة التعدد ====================

/**
 * رسالة حالة عند إضافة اختلاف(ات) جديدة إلى موضع فيه اختلافات قائمة لنفس
 * النطاق (معيار القبول ٢): تُخبر أن التعدد حصل بالاستقلال التام — لا استبدال
 * ولا دمج ولا تحديث ضمني للسابق.
 *
 * تعيد null إن لم تنشأ أي مجموعة تعدد جديدة (اختلاف واحد للموضع كما كان).
 */
export function multiDifferenceNotice(existing: Variant[], added: Variant[]): string | null {
  if (added.length === 0) return null;
  const combined = [...existing, ...added];
  const addedIds = new Set(added.map((variant) => variant.id));

  interface Group {
    members: Variant[];
    addedCount: number;
  }
  const groups = new Map<string, Group>();
  for (const variant of combined) {
    const key = differenceOccurrenceKey(variant);
    const group = groups.get(key) ?? { members: [], addedCount: 0 };
    group.members.push(variant);
    if (addedIds.has(variant.id)) group.addedCount += 1;
    groups.set(key, group);
  }

  const messages: string[] = [];
  for (const group of groups.values()) {
    if (group.members.length < 2 || group.addedCount === 0) continue;
    // عرض حتمي: أعضاء المجموعة بترتيب المستند، والسابق أولًا ثم المضاف.
    const kept = group.members.find((variant) => !addedIds.has(variant.id));
    const lastAdded = [...group.members].reverse().find((variant) => addedIds.has(variant.id));
    const total = group.members.length;
    if (!kept) {
      // الدفعة كلها جديدة (معالج متعدد الأنواع في موضع واحد): استقلال داخلي.
      messages.push(
        `${toArabicDigits(total)} اختلافات مستقلة لموضع واحد أُنشئت في دفعة واحدة — لا دمج بينها، والتنافي والارتباط يحسمهما المحرك من السياسات.`
      );
      continue;
    }
    if (total === 2) {
      messages.push(
        `اختلافان لموضع واحد — أُضيف «${lastAdded?.title ?? ''}» اختلافًا ثانيًا مستقلًا بمعرّفه، والأول «${kept.title}» كما هو بلا تغيير.`
      );
    } else {
      messages.push(
        `${toArabicDigits(total)} اختلافات لموضع واحد — أُضيف «${lastAdded?.title ?? ''}» بمعرّف مستقل إلى ${toArabicDigits(total - 1)} اختلافات قائمة، ولا تغيير عليها ولا دمج بينها.`
      );
    }
  }

  return messages.length > 0 ? messages.join(' ') : null;
}

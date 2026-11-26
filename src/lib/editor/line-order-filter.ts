// هل ترتيب الأسطر المعروض يمثل كل أسطر المحرك؟
//
// كان الشرط القديم `filter.categories.length !== 6` مع أن الفئات الافتراضية
// سبع (TAHQIQ…TAJWEED)، فيُمنع النقل حتى بلا تصفية، ويُقبل أحيانًا وست
// فئات فقط. الفحص هنا يقارن «الفئات المعروضة» بالفئات المعروفة فعلا لا بعدد
// سحري، وهو مصدر واحد يستعمله المخزن ولوحة الترتيب معا.

import { ORDERED_VARIANT_CATEGORIES } from '@/lib/tashjeer/type-ranks';
import type { TashjeerDocument, ViewFilter } from '@/types/tashjeer';

export function lineOrderIsFiltered(
  filter: ViewFilter,
  document: Pick<TashjeerDocument, 'readingWindow'> | null | undefined
): boolean {
  const visible = new Set(filter.categories);
  return (
    ORDERED_VARIANT_CATEGORIES.some((category) => !visible.has(category)) ||
    filter.narratorIds.length > 0 ||
    Boolean(document?.readingWindow?.focusSegment)
  );
}

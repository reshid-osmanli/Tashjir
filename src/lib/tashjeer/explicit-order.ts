// الترتيب الصريح للقراء والرواة والطرق - Explicit Display Order
// FR-ED-14: ترتيب القراء/الرواة/الطرق الرقمي الصريح في كل الواجهات
//
// المبدأ: Display Order ≠ Creation Order ≠ Name Order
// تغيير الترتيب يتم فقط بتعديل الرقم الصريح، لا بتغيير الاسم أو تاريخ الإنشاء.

import type { ReadingImam, Narrator, TransmissionPath } from '@/types';

// ==================== أنواع البيانات ====================

/** عنصر قابل للترتيب الصريح. */
export interface OrderableItem {
  id: string;
  name: string;
  displayOrder: number;
}

/** نتيجة إعادة الترتيب. */
export interface ReorderResult {
  items: OrderableItem[];
  changes: Array<{
    id: string;
    oldOrder: number;
    newOrder: number;
  }>;
}

// ==================== دوال الترتيب ====================

/**
 * يرتب العناصر حسب displayOrder الصريح.
 */
export function sortByDisplayOrder<T extends OrderableItem>(items: T[]): T[] {
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * يحسب الترتيب الصريح التالي عند إضافة عنصر جديد.
 */
export function getNextDisplayOrder(items: OrderableItem[]): number {
  if (items.length === 0) return 1;
  const maxOrder = Math.max(...items.map((i) => i.displayOrder));
  return maxOrder + 1;
}

/**
 * ينقل عنصرًا إلى موضع جديد ويعيد ترقيم العناصر المتأثرة.
 */
export function moveItemToPosition<T extends OrderableItem>(
  items: T[],
  itemId: string,
  targetIndex: number
): ReorderResult {
  const sorted = sortByDisplayOrder(items);
  const currentIndex = sorted.findIndex((i) => i.id === itemId);

  if (currentIndex === -1 || currentIndex === targetIndex) {
    return { items: sorted, changes: [] };
  }

  // إزالة العنصر من موضعه الحالي.
  const [item] = sorted.splice(currentIndex, 1);

  // إدراجه في الموضع الجديد.
  sorted.splice(targetIndex, 0, item);

  // إعادة ترقيم كل العناصر.
  const changes: Array<{ id: string; oldOrder: number; newOrder: number }> = [];
  const result = sorted.map((item, index) => {
    const newOrder = index + 1;
    if (item.displayOrder !== newOrder) {
      changes.push({
        id: item.id,
        oldOrder: item.displayOrder,
        newOrder,
      });
    }
    return { ...item, displayOrder: newOrder };
  });

  return { items: result, changes };
}

/**
 * يبدل ترتيب عنصرين.
 */
export function swapItems<T extends OrderableItem>(
  items: T[],
  itemId1: string,
  itemId2: string
): ReorderResult {
  const sorted = sortByDisplayOrder(items);
  const index1 = sorted.findIndex((i) => i.id === itemId1);
  const index2 = sorted.findIndex((i) => i.id === itemId2);

  if (index1 === -1 || index2 === -1) {
    return { items: sorted, changes: [] };
  }

  // تبديل العناصر.
  const temp = sorted[index1];
  sorted[index1] = sorted[index2];
  sorted[index2] = temp;

  // تحديث displayOrder.
  const changes: Array<{ id: string; oldOrder: number; newOrder: number }> = [
    {
      id: itemId1,
      oldOrder: sorted[index2].displayOrder,
      newOrder: sorted[index1].displayOrder,
    },
    {
      id: itemId2,
      oldOrder: sorted[index1].displayOrder,
      newOrder: sorted[index2].displayOrder,
    },
  ];

  return { items: sorted, changes };
}

/**
 * يعيد ترقيم العناصر بشكل متسلسل (1, 2, 3, ...).
 */
export function renumberItems<T extends OrderableItem>(items: T[]): ReorderResult {
  const sorted = sortByDisplayOrder(items);
  const changes: Array<{ id: string; oldOrder: number; newOrder: number }> = [];

  const result = sorted.map((item, index) => {
    const newOrder = index + 1;
    if (item.displayOrder !== newOrder) {
      changes.push({
        id: item.id,
        oldOrder: item.displayOrder,
        newOrder,
      });
    }
    return { ...item, displayOrder: newOrder };
  });

  return { items: result, changes };
}

// ==================== دوال خاصة بالأئمة والرواة ====================

/**
 * يحول الأئمة إلى عناصر قابلة للترتيب.
 */
export function imamsToOrderable(imams: ReadingImam[]): OrderableItem[] {
  return imams.map((imam) => ({
    id: imam.id,
    name: imam.name,
    displayOrder: imam.order,
  }));
}

/**
 * يحول الرواة إلى عناصر قابلة للترتيب.
 */
export function narratorsToOrderable(narrators: Narrator[]): OrderableItem[] {
  return narrators.map((narrator) => ({
    id: narrator.id,
    name: narrator.name,
    displayOrder: narrator.order,
  }));
}

/**
 * يحول الطرق إلى عناصر قابلة للترتيب.
 */
export function pathsToOrderable(paths: TransmissionPath[]): OrderableItem[] {
  return paths.map((path) => ({
    id: path.id,
    name: path.shortName,
    displayOrder: path.order,
  }));
}

// ==================== التحقق من الترتيب ====================

/**
 * يتحقق من أن الترتيب متسلسل بدون فجوات.
 */
export function isValidOrder(items: OrderableItem[]): boolean {
  const sorted = sortByDisplayOrder(items);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].displayOrder !== i + 1) {
      return false;
    }
  }
  return true;
}

/**
 * يجد العناصر المكررة في الترتيب.
 */
export function findDuplicateOrders(items: OrderableItem[]): number[] {
  const orderCounts = new Map<number, number>();
  for (const item of items) {
    orderCounts.set(item.displayOrder, (orderCounts.get(item.displayOrder) || 0) + 1);
  }
  return Array.from(orderCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([order, _]) => order);
}

/**
 * يقترح ترتيبًا افتراضيًا حسب الترتيب التاريخي أو الأبجدي.
 */
export function suggestDefaultOrder<T extends { id: string; name: string }>(
  items: T[],
  strategy: 'HISTORICAL' | 'ALPHABETICAL' = 'HISTORICAL'
): OrderableItem[] {
  const sorted =
    strategy === 'ALPHABETICAL'
      ? [...items].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
      : items;

  return sorted.map((item, index) => ({
    id: item.id,
    name: item.name,
    displayOrder: index + 1,
  }));
}

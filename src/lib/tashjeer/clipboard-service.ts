// خدمة الحافظة الموحّدة - Unified Clipboard Service
// FR-ED-06: نسخ/قص/لصق على مستويات متعددة
//
// نظام حافظة واحد يعمل على المستويات:
//   سطر كامل، جزء من سطر (اختيار اختلافات محددة)، اختلاف واحد، وجه، قاعدة
//
// القواعد:
//   - نسخ سطر: ID جديد لكل كيان منسوخ + بيانات مستقلة + source: editor
//   - نسخ جزء: نسخ العناصر المحددة فقط بمعرفات جديدة
//   - لصق ذكي: العناصر تحتفظ بأنواعها ونطاقاتها وعلاقاتها الداخلية
//   - العلاقات الخارجية (dangling) تُعلَّق وتُعرض للمراجعة
//   - كل عملية قابلة للتراجع

import type { Variant, VariantAlternative, LineSegment } from '@/types/tashjeer';
import type { TashjeerDocument } from '@/types/tashjeer';

// ==================== أنواع عناصر الحافظة ====================

export type ClipboardItemKind =
  | 'DIFFERENCE'
  | 'FACE'
  | 'SEGMENT'
  | 'LINE'
  | 'MULTI_DIFFERENCE'
  | 'MULTI_FACE';

export interface ClipboardItem {
  kind: ClipboardItemKind;
  /** البيانات المنسوخة. */
  data: unknown;
  /** مصدر النسخة (للتتبع). */
  copiedFrom?: string;
  /** طابع زمني للنسخ. */
  copiedAt: string;
}

export interface ClipboardDifferenceItem extends ClipboardItem {
  kind: 'DIFFERENCE';
  data: Variant;
}

export interface ClipboardFaceItem extends ClipboardItem {
  kind: 'FACE';
  data: VariantAlternative;
  parentDifferenceId: string;
}

export interface ClipboardSegmentItem extends ClipboardItem {
  kind: 'SEGMENT';
  data: LineSegment;
}

export interface ClipboardLineItem extends ClipboardItem {
  kind: 'LINE';
  data: {
    differences: Variant[];
    segments: LineSegment[];
  };
}

export interface ClipboardMultiDifferenceItem extends ClipboardItem {
  kind: 'MULTI_DIFFERENCE';
  data: Variant[];
}

export interface ClipboardMultiFaceItem extends ClipboardItem {
  kind: 'MULTI_FACE';
  data: Array<{ alternative: VariantAlternative; parentDifferenceId: string }>;
}

// ==================== مولّد المعرّفات ====================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ==================== النسخ ====================

/**
 * ينسخ اختلافا واحدا: يعيد نسخة مستقلة بمعرفات جديدة.
 * لا ينسخ الطوابع الزمنية الأصلية بل يُنشئ جديدة.
 */
export function copyDifference(variant: Variant): ClipboardDifferenceItem {
  const cloned = structuredClone(variant);
  const now = new Date().toISOString();
  const newId = generateId('v-copy');

  cloned.id = newId;
  cloned.title = `${cloned.title} — نسخة`;
  cloned.origin = 'EDITOR';
  cloned.engineSnapshot = undefined;
  cloned.editorModifiedAt = undefined;
  cloned.alternatives = cloned.alternatives.map((alt, index) => ({
    ...alt,
    id: `${newId}-face-${index + 1}-${generateId('f')}`,
  }));

  return {
    kind: 'DIFFERENCE',
    data: cloned,
    copiedFrom: variant.id,
    copiedAt: now,
  };
}

/**
 * ينسخ وجها واحدا من اختلاف محدد.
 */
export function copyFace(
  alternative: VariantAlternative,
  parentDifferenceId: string
): ClipboardFaceItem {
  return {
    kind: 'FACE',
    data: structuredClone(alternative),
    parentDifferenceId,
    copiedFrom: alternative.id,
    copiedAt: new Date().toISOString(),
  };
}

/**
 * ينسخ جزء سطر.
 */
export function copySegment(segment: LineSegment): ClipboardSegmentItem {
  return {
    kind: 'SEGMENT',
    data: structuredClone(segment),
    copiedFrom: segment.id,
    copiedAt: new Date().toISOString(),
  };
}

/**
 * ينسخ عدة اختلافات معا.
 */
export function copyMultipleDifferences(variants: Variant[]): ClipboardMultiDifferenceItem {
  return {
    kind: 'MULTI_DIFFERENCE',
    data: variants.map((v) => structuredClone(v)),
    copiedFrom: variants.map((v) => v.id).join(','),
    copiedAt: new Date().toISOString(),
  };
}

/**
 * ينسخ عدة أوجه معا.
 */
export function copyMultipleFaces(
  items: Array<{ alternative: VariantAlternative; parentDifferenceId: string }>
): ClipboardMultiFaceItem {
  return {
    kind: 'MULTI_FACE',
    data: items.map((item) => ({
      alternative: structuredClone(item.alternative),
      parentDifferenceId: item.parentDifferenceId,
    })),
    copiedFrom: items.map((i) => i.alternative.id).join(','),
    copiedAt: new Date().toISOString(),
  };
}

// ==================== اللصق ====================

/**
 * يجهّز اختلافا للصقه: يعيد تعيين المعرّفات والطوابع.
 */
export function prepareDifferenceForPaste(item: ClipboardDifferenceItem): Variant {
  const variant = structuredClone(item.data);
  const newId = generateId('v-paste');

  variant.id = newId;
  variant.origin = 'EDITOR';
  variant.engineSnapshot = undefined;
  variant.editorModifiedAt = undefined;
  variant.alternatives = variant.alternatives.map((alt, index) => ({
    ...alt,
    id: `${newId}-face-${index + 1}-${generateId('f')}`,
  }));

  return variant;
}

/**
 * يجهّز وجها للصقه في اختلاف محدد.
 */
export function prepareFaceForPaste(item: ClipboardFaceItem): VariantAlternative {
  const alt = structuredClone(item.data);
  alt.id = generateId('face-paste');
  alt.isBase = false;
  return alt;
}

/**
 * يجهّز جزء سطر للصقه.
 */
export function prepareSegmentForPaste(item: ClipboardSegmentItem): LineSegment {
  const segment = structuredClone(item.data);
  segment.id = generateId('segment-paste');
  segment.title = `${segment.title} — نسخة`;
  segment.origin = 'EDITOR';
  segment.createdAt = new Date().toISOString();
  segment.updatedAt = new Date().toISOString();
  return segment;
}

/**
 * يجهّز عدة اختلافات للصقها.
 */
export function prepareMultipleDifferencesForPaste(
  item: ClipboardMultiDifferenceItem
): Variant[] {
  return (item.data as Variant[]).map((original) => {
    const newId = generateId('v-paste');
    return {
      ...structuredClone(original),
      id: newId,
      title: `${original.title} — نسخة`,
      origin: 'EDITOR' as const,
      engineSnapshot: undefined,
      editorModifiedAt: undefined,
      alternatives: original.alternatives.map((alt, index) => ({
        ...structuredClone(alt),
        id: `${newId}-face-${index + 1}-${generateId('f')}`,
      })),
    };
  });
}

/**
 * يجهّز عدة أوجه للصقها.
 */
export function prepareMultipleFacesForPaste(
  item: ClipboardMultiFaceItem
): VariantAlternative[] {
  return item.data.map((entry) => ({
    ...structuredClone(entry.alternative),
    id: generateId('face-paste'),
    isBase: false,
  }));
}

// ==================== التحقق من العلاقات المعلقة ====================

export interface DanglingRelation {
  fromId: string;
  toId: string;
  reason: string;
}

/**
 * يتحقق من العلاقات المعلقة عند لصق عناصر: العلاقات الداخلية تبقى،
 * أما العلاقات إلى عناصر خارج النسخ فتُعلَّق وتُعرض للمراجعة.
 */
export function detectDanglingRelations(
  pastedIds: string[],
  document: TashjeerDocument
): DanglingRelation[] {
  const pastedSet = new Set(pastedIds);
  const dangling: DanglingRelation[] = [];

  for (const link of document.links ?? []) {
    const fromPasted = pastedSet.has(link.from.id);
    const toPasted = pastedSet.has(link.to.id);
    if (fromPasted && !toPasted) {
      dangling.push({
        fromId: link.from.id,
        toId: link.to.id,
        reason: `العلاقة تشير إلى عنصر خارج النسخة: ${link.to.id}`,
      });
    }
    if (!fromPasted && toPasted) {
      dangling.push({
        fromId: link.from.id,
        toId: link.to.id,
        reason: `العلاقة من عنصر خارج النسخة: ${link.from.id}`,
      });
    }
  }

  return dangling;
}

// ==================== ملخص اللصق ====================

export interface PasteSummary {
  kind: string;
  count: number;
  description: string;
}

export function summarizePaste(item: ClipboardItem): PasteSummary {
  switch (item.kind) {
    case 'DIFFERENCE':
      return { kind: 'اختلاف', count: 1, description: 'اختلاف واحد مع أوجهه' };
    case 'FACE':
      return { kind: 'وجه', count: 1, description: 'وجه واحد' };
    case 'SEGMENT':
      return { kind: 'جزء', count: 1, description: 'جزء سطر' };
    case 'LINE':
      return {
        kind: 'سطر',
        count: 1,
        description: `سطر كامل (${(item.data as { differences: Variant[] }).differences.length} اختلاف)`,
      };
    case 'MULTI_DIFFERENCE':
      return {
        kind: 'اختلافات',
        count: (item.data as Variant[]).length,
        description: `${(item.data as Variant[]).length} اختلافات مستقلة`,
      };
    case 'MULTI_FACE':
      return {
        kind: 'أوجه',
        count: (item.data as Array<{ alternative: VariantAlternative }>).length,
        description: `${(item.data as Array<{ alternative: VariantAlternative }>).length} أوجه`,
      };
    default:
      return { kind: 'غير معروف', count: 0, description: '' };
  }
}

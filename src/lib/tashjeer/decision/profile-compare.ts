// مقارنة ملفات المحرك — Profile Comparison (FR-ES-11.3)
// مشروع التشجير - نظام القراءات العشر
//
// يقارن ملفّي سياسات (Profile A وB) على مجموعة مدخلات، ويصنّف كل موضع:
// SAME (نفس القرار) أو CHANGED (اختلف). ومع مرجع (Reference = الحقيقة المعتمدة
// بشريًا) يصنّف أيضًا Improved (B أصاب حيث أخطأ A) وRegressed (B أخطأ حيث
// أصاب A). طبقة نقيّة بلا DOM، تُستعمل في الاستوديو لسير الاعتماد والمقارنة.

import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { resolveMerge } from './api';
import type { DecisionContext } from './policy';

/** مدخل مقارنة: زوج أنواع عناصر يُفحص عليه قرار الدمج. */
export interface CompareInput {
  id: string;
  differenceType: string;
  relatedType: string;
  /** القرار الصحيح المرجعي إن توفّر (للتصنيف Improved/Regressed). */
  referenceMerge?: boolean;
}

/** تصنيف الموضع في المقارنة. */
export type CompareClass = 'SAME' | 'CHANGED' | 'IMPROVED' | 'REGRESSED';

/** نتيجة موضع واحد في المقارنة. */
export interface CompareItem {
  id: string;
  aMerge: boolean;
  bMerge: boolean;
  class: CompareClass;
}

/** تقرير مقارنة ملفّين. */
export interface CompareReport {
  total: number;
  same: number;
  changed: number;
  improved: number;
  regressed: number;
  items: CompareItem[];
}

/** زوج أنواع شائع للافتراضي عند غياب مدخلات صريحة (FR-ES-11). */
export const DEFAULT_COMPARE_INPUTS: CompareInput[] = [
  { id: 'madd-tahqiq', differenceType: 'MADD', relatedType: 'TAHQIQ', referenceMerge: true },
  { id: 'madd-wasl', differenceType: 'MADD', relatedType: 'WASL', referenceMerge: true },
  { id: 'farsh-madd', differenceType: 'FARSH', relatedType: 'MADD', referenceMerge: false },
  { id: 'farsh-tahqiq', differenceType: 'FARSH', relatedType: 'TAHQIQ', referenceMerge: false },
  { id: 'madd-madd', differenceType: 'MADD', relatedType: 'MADD', referenceMerge: false },
];

/**
 * يقارن قرارَي ملفّين على مجموعة مدخلات. إن توفّر مرجع، يصنّف التغيّر إلى
 * Improved/Regressed؛ وإلا يبقى SAME/CHANGED.
 */
export function compareProfiles(
  profileA: EngineConfig,
  profileB: EngineConfig,
  inputs: CompareInput[] = DEFAULT_COMPARE_INPUTS
): CompareReport {
  const items: CompareItem[] = inputs.map((input) => {
    const ctx: DecisionContext = { differenceType: input.differenceType, relatedType: input.relatedType };
    const aMerge = resolveMerge(input.differenceType, input.relatedType, profileA, ctx).decision.merge;
    const bMerge = resolveMerge(input.differenceType, input.relatedType, profileB, ctx).decision.merge;

    let classification: CompareClass;
    if (aMerge === bMerge) {
      classification = 'SAME';
    } else if (typeof input.referenceMerge === 'boolean') {
      // أحدهما يطابق المرجع والآخر لا: إن كان B هو المطابق فتحسّن، وإلا تراجع.
      classification = bMerge === input.referenceMerge ? 'IMPROVED' : 'REGRESSED';
    } else {
      classification = 'CHANGED';
    }

    return { id: input.id, aMerge, bMerge, class: classification };
  });

  return {
    total: items.length,
    same: items.filter((item) => item.class === 'SAME').length,
    changed: items.filter((item) => item.class === 'CHANGED').length,
    improved: items.filter((item) => item.class === 'IMPROVED').length,
    regressed: items.filter((item) => item.class === 'REGRESSED').length,
    items,
  };
}

/** هل المقارنة آمنة للاعتماد؟ لا تراجع عن المرجع. */
export function isSafeToAdopt(report: CompareReport): boolean {
  return report.regressed === 0;
}

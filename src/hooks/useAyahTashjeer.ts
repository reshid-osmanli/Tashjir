// خطاف تشجير الآية - Ayah Tashjeer Hook
// مشروع التشجير - نظام القراءات العشر
//
// يجمع هذا الخطاف كل ما تحتاجه لوحة الرسم في مكان واحد:
//   كلمات الآية، وتخطيطها، وخطوطها بعد التصفية والحساب الهندسي، وإحصاءاتها.
//
// كل الحسابات داخل useMemo ومربوطة بمفاتيح دقيقة، فلا يُعاد الحساب
// إلا عند تغير المستند فعلا أو تغير التصفية. هذا مهم لأن الآيات الطويلة
// قد تصل إلى مئة كلمة وعشرات الخطوط.

'use client';

import { useMemo } from 'react';
import { getAyahByKey, getAyahWordsByKey, type MushafAyah, type MushafWord } from '@/data/quran';
import {
  DEFAULT_LAYOUT_OPTIONS,
  layoutAyah,
} from '@/lib/tashjeer/layout-engine';
import {
  computeStats,
  filterBranches,
  renderBranches,
  type AyahTashjeerStats,
} from '@/lib/tashjeer/branch-engine';
import {
  generateClassicTashjeer,
  type ClassicTashjeer,
} from '@/lib/tashjeer/classic-tashjeer';
import type {
  AyahLayout,
  LayoutOptions,
  RenderedBranch,
  TashjeerDocument,
  ViewFilter,
} from '@/types/tashjeer';

/** ناتج الخطاف. */
export interface AyahTashjeerResult {
  /** بيانات الآية، أو undefined إن كان المعرّف غير صالح */
  ayah?: MushafAyah;
  /** كلمات الآية */
  words: MushafWord[];
  /** تخطيط الكلمات */
  layout: AyahLayout;
  /** الخطوط بعد التصفية والحساب الهندسي (للتوافق مع اللوحات) */
  branches: RenderedBranch[];
  /** التشجير الكلاسيكي: خط لكل وجه مختلف تحت الآية */
  classic: ClassicTashjeer;
  /** إحصاءات الآية */
  stats: AyahTashjeerStats;
  /** إعدادات التخطيط المستخدمة */
  options: LayoutOptions;
  /** حدود اللوحة: تُستخدم في viewBox */
  viewBox: { x: number; y: number; width: number; height: number };
}

/**
 * يحسب كل ما تحتاجه لوحة التشجير لآية واحدة.
 *
 * @param document المستند المفتوح، أو null قبل التحميل
 * @param filter تصفية العرض
 * @param options تعديلات على إعدادات التخطيط (حجم الخط مثلا)
 */
export function useAyahTashjeer(
  document: TashjeerDocument | null,
  filter: ViewFilter,
  options: Partial<LayoutOptions> = {}
): AyahTashjeerResult {
  const ayahKey = document?.ayahKey ?? 0;

  // مفتاح استقرار: يمنع إعادة الحساب عند تغير مرجع الكائن دون تغير القيم.
  const optionsKey = JSON.stringify(options);
  const layoutOptions = useMemo<LayoutOptions>(
    () => ({ ...DEFAULT_LAYOUT_OPTIONS, ...options }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionsKey]
  );

  const ayah = useMemo(() => (ayahKey ? getAyahByKey(ayahKey) : undefined), [ayahKey]);
  const words = useMemo(() => (ayahKey ? getAyahWordsByKey(ayahKey) : []), [ayahKey]);

  const layout = useMemo(
    () => layoutAyah(ayahKey, words, layoutOptions),
    [ayahKey, words, layoutOptions]
  );

  const visibleBranches = useMemo(() => {
    if (!document) return [];
    return filterBranches(document.branches, document.variants, filter);
  }, [document, filter]);

  const branches = useMemo(
    () => renderBranches(visibleBranches, layout, layoutOptions),
    [visibleBranches, layout, layoutOptions]
  );

  // التشجير الكلاسيكي: الخطوط المترتّبة تحت الآية.
  const classic = useMemo(
    () =>
      generateClassicTashjeer(
        document?.variants ?? [],
        layout,
        filter,
        layoutOptions
      ),
    [document, layout, filter, layoutOptions]
  );

  const stats = useMemo(
    () => computeStats(document?.variants ?? [], visibleBranches),
    [document, visibleBranches]
  );

  const viewBox = useMemo(() => {
    // هامش أيسر للبطاقات الجانبية، وهامش أيمن لرموز القراء على رأس كل خط.
    const leftMargin = 70;
    const rightMargin = 380;

    const top = 0;
    const bottom = classic.totalHeight;

    return {
      x: -leftMargin,
      y: top,
      width: layoutOptions.canvasWidth + leftMargin + rightMargin,
      height: Math.max(bottom - top, 360),
    };
  }, [classic, layoutOptions]);

  return { ayah, words, layout, branches, classic, stats, options: layoutOptions, viewBox };
}

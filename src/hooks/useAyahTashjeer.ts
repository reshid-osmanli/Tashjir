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
import { getAyahByKey, type MushafAyah, type MushafWord } from '@/data/quran';
import {
  DEFAULT_LAYOUT_OPTIONS,
  layoutAyah,
  type TextMetricsProvider,
} from '@/lib/tashjeer/layout-engine';
import { buildReadingWindow, type ReadingWindow } from '@/lib/tashjeer/reading-window';
import {
  computeStats,
  filterBranches,
  renderBranches,
  type AyahTashjeerStats,
} from '@/lib/tashjeer/branch-engine';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import {
  generateClassicTashjeer,
  type ClassicTashjeer,
  type ClassicTashjeerOptions,
} from '@/lib/tashjeer/classic-tashjeer';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import type { TashjeerEngineSettings } from '@/lib/tashjeer/engine-settings';
import type { StrengthDegreeCatalog } from '@/lib/tashjeer/strength-degrees';
import type {
  AyahLayout,
  LayoutOptions,
  RenderedBranch,
  TashjeerDocument,
  ViewFilter,
} from '@/types/tashjeer';

/** ناتج الخطاف. */
export interface AyahTashjeerRuntime {
  /** كتالوج القراء والرواة والطرق بعد تعديلات لوحة التحكم. */
  catalog?: TransmissionCatalog;
  /** إعدادات ترتيب وعرض المحرك. */
  engine?: TashjeerEngineSettings;
  /** سلّم درجات قوة الوجه بعد تعديلات الإعدادات. */
  strengthDegrees?: StrengthDegreeCatalog;
  /**
   * مفتاح إبطال يتغير عند تعديل استثناءات المواضع (حذف موضع أو تخصيص درجته)،
   * فيعاد اشتقاق الاختلافات دون انتظار إعادة تحميل المستند.
   */
  occurrencesKey?: string;
  /**
   * مقياس نص حقيقي من المتصفح. غيابه يعيد القياس النموذجي الحتمي، وهو ما
   * يعمل به الخادم والاختبارات.
   */
  metrics?: TextMetricsProvider;
}

export interface AyahTashjeerResult {
  /** بيانات الآية، أو undefined إن كان المعرّف غير صالح */
  ayah?: MushafAyah;
  /** كلمات نافذة العمل (الآية، أو الآيتان الموصولتان) */
  words: MushafWord[];
  /** نافذة العمل: أي آيات تشملها المواضع الحالية */
  window: ReadingWindow;
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
  options: Partial<LayoutOptions> = {},
  runtime: AyahTashjeerRuntime = {}
): AyahTashjeerResult {
  const ayahKey = document?.ayahKey ?? 0;

  // مفتاح استقرار: يمنع إعادة الحساب عند تغير مرجع الكائن دون تغير القيم.
  // إعداد الآية المحفوظ يسبق افتراضيات المحرك، بينما تعديل الواجهة الآني
  // (مثل حجم الخط في الشريط) له الأولوية الأخيرة.
  const optionsKey = JSON.stringify({ options, documentLayout: document?.layout ?? {} });
  const layoutOptions = useMemo<LayoutOptions>(
    () => ({ ...DEFAULT_LAYOUT_OPTIONS, ...(document?.layout ?? {}), ...options }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionsKey]
  );

  const ayah = useMemo(() => (ayahKey ? getAyahByKey(ayahKey) : undefined), [ayahKey]);

  // نافذة العمل: الآية وحدها، أو موصولة بالتي بعدها إن اختار المحقق ذلك.
  const linkNextAyah = document?.readingWindow?.linkNextAyah === true;
  const window = useMemo(
    () =>
      ayahKey
        ? buildReadingWindow(ayahKey, linkNextAyah)
        : { ayahKey: 0, ayahKeys: [], words: [], firstAyahEndPosition: 0, isLinked: false },
    [ayahKey, linkNextAyah]
  );
  const words = window.words;

  const layout = useMemo(
    () => layoutAyah(ayahKey, words, layoutOptions, runtime.metrics),
    [ayahKey, words, layoutOptions, runtime.metrics]
  );

  const runtimeKey = JSON.stringify({
    catalogUpdatedAt: runtime.catalog?.updatedAt,
    engine: runtime.engine,
    strengthUpdatedAt: runtime.strengthDegrees?.updatedAt,
  });

  const effectiveVariants = useMemo(
    () => (document ? getEffectiveVariants(document) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document, runtime.occurrencesKey]
  );

  const visibleBranches = useMemo(() => {
    if (!document) return [];
    return filterBranches(document.branches, effectiveVariants, filter, runtime.catalog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, effectiveVariants, filter, runtimeKey]);

  const branches = useMemo(
    () => renderBranches(visibleBranches, layout, layoutOptions),
    [visibleBranches, layout, layoutOptions]
  );

  // التشجير الكلاسيكي: الخطوط المترتّبة تحت الآية.
  const classic = useMemo(() => {
    const classicRuntime: ClassicTashjeerOptions = {
      catalog: runtime.catalog,
      engine: runtime.engine,
      strengthDegrees: runtime.strengthDegrees,
      boundaries: document?.boundaries ?? [],
      branchOverrides: document?.branches ?? [],
      manualLines: document?.manualLines ?? [],
      focusSegment: document?.readingWindow?.focusSegment ?? null,
    };
    return generateClassicTashjeer(
      effectiveVariants,
      layout,
      filter,
      layoutOptions,
      classicRuntime
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, effectiveVariants, layout, filter, layoutOptions, runtimeKey]);

  const stats = useMemo(
    () => computeStats(effectiveVariants, visibleBranches),
    [effectiveVariants, visibleBranches]
  );

  const viewBox = useMemo(() => {
    // هامش أيسر لرموز القراء في طرف كل سطر، وهامش أيمن لأرقام حركات المد.
    const leftMargin = 150;
    const rightMargin = 90;

    // نبدأ من أعلى النص لا من الصفر: بعد نزول كل الأسطر تحت الآية لم يعد
    // فوق النص شيء، وكان التثبيت عند صفر يترك فراغا كبيرا في رأس اللوحة.
    const top = classic.topY - layoutOptions.fontSize - 30;
    const bottom = classic.totalHeight;

    return {
      x: -leftMargin,
      y: top,
      // عرض اللوحة المقيس لا المضبوط: في وضع السطر الواحد تتمدد الآية
      // الطويلة، فلو ثبّتنا العرض خرج آخرها من الإطار.
      width: layout.canvasWidth + leftMargin + rightMargin,
      height: Math.max(bottom - top, 280),
    };
  }, [classic, layout.canvasWidth, layoutOptions]);

  return { ayah, words, window, layout, branches, classic, stats, options: layoutOptions, viewBox };
}

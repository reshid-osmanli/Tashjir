// نافذة عرض لقوائم طويلة — Windowed List (NFR-01)
// مشروع التشجير - نظام القراءات العشر
//
// القوائم الطويلة (آيات فيها عشرات المواضع بأوجهها) تُرسم بالكامل فتثقل
// المتصفح. هذا الخطاف يعيد المدى المرئي فقط مع هامش، ويحسب ارتفاعين
// وهميين قبل المدى وبعده حتى يبقى شريط التمرير صادقا. الارتفاعات تقديرية
// ثم تُصحَّح من القياس الفعلي للصفوف المرسومة، فلا يقفز التمرير.
//
// العناصر «المثبّتة» (كالصف المحدد) تُرسم دائما ولو خرجت من النافذة، حتى
// يعمل scrollIntoView والاختصارات كما هي.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

export interface WindowedRange {
  /** أول فهرس يُرسم وآخره (شامل). */
  start: number;
  end: number;
  /** ارتفاع الحشو قبل المدى وبعده بالبكسل. */
  topPad: number;
  bottomPad: number;
  /** يسجّل ارتفاع صف مقيس. */
  measure: (index: number, element: HTMLElement | null) => void;
  /** هل التنافذ فعّال أصلا (القائمة أطول من العتبة)؟ */
  active: boolean;
}

interface Options {
  /** ارتفاع تقديري للصف قبل قياسه. */
  estimateHeight?: number;
  /** صفوف إضافية فوق النافذة وتحتها. */
  overscan?: number;
  /** لا تُفعَّل النافذة إن كان العدد أقل من هذا (القوائم القصيرة تُرسم كاملة). */
  threshold?: number;
}

export function useWindowedList(
  containerRef: RefObject<HTMLElement | null>,
  count: number,
  { estimateHeight = 96, overscan = 6, threshold = 40 }: Options = {}
): WindowedRange {
  const heights = useRef<number[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [, force] = useState(0);
  const active = count >= threshold;

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !active) return;
    const onScroll = () => setScrollTop(element.scrollTop);
    const onResize = () => setViewport(element.clientHeight);
    onScroll();
    onResize();
    element.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [containerRef, active]);

  const heightOf = useCallback((index: number) => heights.current[index] ?? estimateHeight, [estimateHeight]);

  const measure = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (!element) return;
      const height = element.getBoundingClientRect().height;
      if (height > 0 && Math.abs((heights.current[index] ?? 0) - height) > 1) {
        heights.current[index] = height;
        // إعادة رسم خفيفة حتى تتحدث الحشوات بالقياس الجديد.
        force((tick) => tick + 1);
      }
    },
    []
  );

  return useMemo(() => {
    if (!active) {
      return { start: 0, end: count - 1, topPad: 0, bottomPad: 0, measure, active: false };
    }
    // أول صف يلامس أعلى النافذة، ثم آخر صف يلامس أسفلها.
    let offset = 0;
    let first = 0;
    while (first < count && offset + heightOf(first) < scrollTop) {
      offset += heightOf(first);
      first += 1;
    }
    let last = first;
    let covered = offset;
    while (last < count - 1 && covered + heightOf(last) < scrollTop + viewport) {
      covered += heightOf(last);
      last += 1;
    }
    const start = Math.max(0, first - overscan);
    const end = Math.min(count - 1, last + overscan);
    let topPad = 0;
    for (let index = 0; index < start; index += 1) topPad += heightOf(index);
    let bottomPad = 0;
    for (let index = end + 1; index < count; index += 1) bottomPad += heightOf(index);
    return { start, end, topPad, bottomPad, measure, active: true };
  }, [active, count, heightOf, measure, overscan, scrollTop, viewport]);
}

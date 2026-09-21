// مكوّنات الحركة — Motion Primitives
//
// مشروع التشجير - نظام القراءات العشر
//
// المبدأ (SPEC §207): إن كفى CSS فلا مكتبة. لذلك لا يوجد هنا أي اعتماد خارجي:
// الحالة الوحيدة التي تحتاج JavaScript هي **معرفة متى دخل العنصر مجال الرؤية**،
// وهي تُدار بمراقب تقاطع واحد مشترك لكل الصفحة لا بمراقب لكل عنصر.
//
// المحتوى يبقى ظاهرا بلا JavaScript: الأنماط في CSS، وإن تعطّل التنفيذ يكشف
// وسم <noscript> كل العناصر المخفية (انظر RevealStyles).

'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

type VisibleCallback = () => void;

let sharedObserver: IntersectionObserver | null = null;
const pending = new Map<Element, VisibleCallback>();

function ensureObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const callback = pending.get(entry.target);
          pending.delete(entry.target);
          sharedObserver?.unobserve(entry.target);
          callback?.();
        }
      },
      // نستبق قليلا: يكفي أن يقترب العنصر من الحافة السفلى ليبدأ ظهوره.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.06 }
    );
  }

  return sharedObserver;
}

/** يُنبّه مرة واحدة عند دخول العنصر مجال الرؤية. */
function useRevealOnce<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;

    const observer = ensureObserver();
    if (!observer) {
      setVisible(true);
      return;
    }

    pending.set(element, () => setVisible(true));
    observer.observe(element);

    return () => {
      pending.delete(element);
      observer.unobserve(element);
    };
  }, [visible]);

  return { ref, visible };
}

/** هل يطلب المستخدم تقليل الحركة؟ (يُقرأ مرة واحدة لكل صفحة) */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/**
 * كشف عنصر عند التمرير. الحركة نفسها في CSS (`.reveal`)، فلا إعادة تصيير
 * ولا حساب في JavaScript — تُضاف سمة `data-visible` فقط.
 */
export function Reveal({
  as: Tag = 'div',
  children,
  className,
  delay = 0,
  ...rest
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** تأخير الظهور بالمللي ثانية (يُنصح بألا يزيد على 240). */
  delay?: number;
} & Record<string, unknown>) {
  const { ref, visible } = useRevealOnce<HTMLElement>();

  return (
    <Tag
      ref={ref}
      className={`reveal ${className ?? ''}`}
      data-visible={visible ? 'true' : 'false'}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * ظهور متتالٍ قصير لعناصر متجاورة. الفرق بين العناصر ≤ 60ms حتى لا يتحوّل
 * التتالي إلى انتظار (SPEC §98).
 */
export function Stagger({
  as: Tag = 'div',
  children,
  className,
  step = 55,
  ...rest
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** الفرق الزمني بين عنصرين متجاورين. */
  step?: number;
} & Record<string, unknown>) {
  const { ref, visible } = useRevealOnce<HTMLElement>();

  return (
    <Tag
      ref={ref}
      className={`stagger ${className ?? ''}`}
      data-visible={visible ? 'true' : 'false'}
      style={{ '--stagger-step': `${step}ms` } as React.CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** عنصر داخل Stagger: رقمه يحدد زمن تأخيره. */
export function StaggerItem({
  as: Tag = 'div',
  children,
  index,
  className,
  ...rest
}: {
  as?: ElementType;
  children: ReactNode;
  index: number;
  className?: string;
} & Record<string, unknown>) {
  return (
    <Tag
      className={className}
      style={{ '--stagger-index': index } as React.CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * عدّاد يُعدّ مرة واحدة عند الظهور، ثم يستقر على الرقم النهائي (SPEC §182).
 *
 * الرقم النهائي هو ما يُصيَّر على الخادم، فالزائر يرى الرقم الصحيح فورا إن
 * تعطّل JavaScript أو طُلب تقليل الحركة.
 */
export function CountUp({
  value,
  arabicDigits = true,
  duration = 900,
  className,
}: {
  value: number;
  arabicDigits?: boolean;
  duration?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, visible } = useRevealOnce<HTMLSpanElement>();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!visible || reduced) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // تسهيل خارجي هادئ: يبدأ سريعا ويستقر.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, reduced, value, duration]);

  const text = arabicDigits ? toArabicDigits(display) : display.toLocaleString('en-US');

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}

/**
 * نمط احتياطي: إن كان JavaScript معطّلا فلا حركة، ولا يجوز أن يبقى المحتوى
 * مخفيا. الحقن في الرأس يضمن الظهور قبل الرسم الأول.
 */
export function RevealStyles() {
  return (
    <noscript>
      <style
        dangerouslySetInnerHTML={{
          __html: '.reveal,.stagger>*{opacity:1!important;transform:none!important}',
        }}
      />
    </noscript>
  );
}

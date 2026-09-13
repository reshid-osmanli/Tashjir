// القائمة الطويلة الاحترافية — ScrollableList (FR-ED-01)
// مشروع التشجير - نظام القراءات العشر
//
// «قرار واحد في مكان واحد» لكل قوائم المحرر الطويلة: قائمة الاختلافات،
// الأوجه، العلاقات، الترتيب، الأسطر، وفهارس التتبع داخل المحرر. هذا الغلاف
// يوفّر لكل قائمة:
//
//   1. حاوية بارتفاع محدد لا تخرج عن إطار الشاشة ولا تمدّ التخطيط عموديًا.
//   2. شريط تمرير رأسي مرئي دائمًا عند التجاوز (scrollbar-gutter محفوظ).
//   3. زرا صعود/نزول عائمان في طرف القائمة (RTL: يمينها) يظهران عند الحاجة:
//      نقرة = خطوة، وضغط مستمر = تمرير متواصل.
//   4. رأس ثابت (بحث/تصفية/إجراءات) لا يُمرَّر مع المحتوى.
//   5. تمرير بالعجلة وباللمس وبالأسهم بعد التركيز (سلوك أصلي + tabIndex).
//   6. زر «إلى أعلى القائمة» بعد تمرير بعيد.
//   7. Scroll Into View موحّد: حين يُحدَّد عنصر من خارج القائمة (التحديد
//      الموحّد) تُمرَّر إليه وتُبرزه في منتصف الرؤية حيثما أمكن (AC: العنصر
//      847 يظهر في المنتصف خلال خطوتين).
//
// التنافذ (Virtualization) اختياري عبر renderWindow: القوائم القصيرة تُرسم
// كاملة، والطويلة (≥ threshold) تُنافذ عبر useWindowedList والنواة النقية
// windowed-list-core التي تُقاس في الاختبارات على 2000 عنصر.

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useWindowedList, type WindowedRange } from '@/hooks/useWindowedList';
import { scrollDirections, shouldShowJumpToTop } from '@/hooks/windowed-list-core';

/** واجهة القائمة لمن يحتاج التمرير البرمجي (Scroll Into View الموحّد). */
export interface ScrollableListApi {
  /** يمرّر إلى فهرس، ويحاول وضعه في منتصف الرؤية. */
  scrollToIndex: (index: number, options?: { center?: boolean }) => void;
  /** ارتفاع خطوة الصعود/النزول (متوسط ارتفاع الصف المقيس). */
  stepHeight: () => number;
}

interface ScrollableListProps {
  /** عدد العناصر الكلي (قبل التنافذ). */
  itemCount: number;
  /** رأس ثابت أعلى القائمة: بحث وتصفية وإجراءات. لا يُمرَّر. */
  header?: ReactNode;
  /** ما يُعرض حين لا عناصر. */
  emptyState?: ReactNode;
  /** ارتفاع تقديري للصف قبل قياسه. */
  estimateHeight?: number;
  /** عتبة تفعيل التنافذ: تحتها تُرسم القائمة كاملة. */
  threshold?: number;
  overscan?: number;
  /** فهرس العنصر النشط من التحديد الموحّد؛ يُمارَر إليه عند تغيّره. */
  activeIndex?: number;
  /** يُستدعى مرة ليستلم المستهلك واجهة التمرير البرمجي. */
  registerApi?: (api: ScrollableListApi) => void;
  /** ينافذ نطاق الرسم: (المدى) ⇒ صفوف. تغيبه ⇒ رسم كامل. */
  renderWindow?: (range: WindowedRange) => ReactNode;
  /** محتوى القائمة كاملا حين لا يلزم تنافذ (قوائم قصيرة، سحب وإفلات…). */
  children?: ReactNode;
  /**
   * تحميل تدريجي (بديل التنافذ للصفوف المعقدة): يُستدعى حين يقترب التمرير
   * من أسفل القائمة فيضيف المستهلك دفعة صفوف جديدة (NFR-01).
   */
  onNearBottom?: () => void;
  /** مسافة الاقتراب من الأسفل التي تُفعّل onNearBottom. */
  nearBottomPx?: number;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
}

const HOLD_REPEAT_MS = 40;
/** يبدأ التمرير المتواصل بعد ضغطة مستمرة بهذا الزمن (يبعد النقرة عن السحب). */
const HOLD_DELAY_MS = 260;

export function ScrollableList({
  itemCount,
  header,
  emptyState,
  estimateHeight = 96,
  threshold = 40,
  overscan = 6,
  activeIndex,
  registerApi,
  renderWindow,
  children,
  onNearBottom,
  nearBottomPx = 400,
  className = '',
  contentClassName = '',
  ariaLabel,
}: ScrollableListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [showJumpTop, setShowJumpTop] = useState(false);

  const windowed = useWindowedList(listRef, itemCount, { estimateHeight, overscan, threshold });

  const onNearBottomRef = useRef(onNearBottom);
  useEffect(() => {
    onNearBottomRef.current = onNearBottom;
  });

  const refreshDirections = useCallback(() => {
    const element = listRef.current;
    if (!element) return;
    const directions = scrollDirections(element.scrollTop, element.clientHeight, element.scrollHeight);
    setCanScrollUp(directions.up);
    setCanScrollDown(directions.down);
    setShowJumpTop(shouldShowJumpToTop(element.scrollTop, element.clientHeight));
    // اقتراب من الأسفل ⇒ طلب دفعة صفوف جديدة (تحميل تدريجي).
    if (onNearBottomRef.current && element.scrollTop + element.clientHeight > element.scrollHeight - nearBottomPx) {
      onNearBottomRef.current();
    }
  }, [nearBottomPx]);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    refreshDirections();
    element.addEventListener('scroll', refreshDirections, { passive: true });
    const observer = new ResizeObserver(refreshDirections);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', refreshDirections);
      observer.disconnect();
    };
  }, [refreshDirections, itemCount]);

  useEffect(() => {
    // عند تغيّر عدد العناصر قد تتغير الارتفاعات المقيسة؛ حدّث الأزرار.
    refreshDirections();
  }, [refreshDirections, itemCount, windowed.measure]);

  const stepHeight = useCallback(() => {
    const element = listRef.current;
    if (!element) return estimateHeight;
    // خطوة معقولة: ثلث الرؤية، لا صف واحد الضئيل ولا قفزة مربكة.
    return Math.max(element.clientHeight / 3, estimateHeight / 2);
  }, [estimateHeight]);

  const scrollToIndex = useCallback(
    (index: number, options?: { center?: boolean }) => {
      const element = listRef.current;
      if (!element || index < 0) return;
      if (options?.center !== false) {
        const rect = element.getBoundingClientRect();
        // الطريق الدقيق: صفّ القائمة المرسوم إن وُجد، وإلا الإزاحة التراكمية
        // من الارتفاعات المقيسة (windowed-list-core).
        const rows = element.querySelectorAll<HTMLElement>('[data-list-index]');
        let target: HTMLElement | null = null;
        for (const row of rows) {
          if (Number(row.dataset.listIndex) === index) {
            target = row;
            break;
          }
        }
        if (target) {
          const rowRect = target.getBoundingClientRect();
          const offset = element.scrollTop + (rowRect.top - rect.top) - rect.height / 2 + rowRect.height / 2;
          element.scrollTo({ top: Math.max(offset, 0), behavior: 'smooth' });
          return;
        }
      }
      // بلا صف مرسوم (خارج النافذة): قفزة حسب الارتفاع التقديري ثم تمرير
      // ناعم؛ بعد الرسم يلتقط تأثير activeIndex الصف الدقيق.
      element.scrollTo({ top: index * estimateHeight - element.clientHeight / 2, behavior: 'auto' });
    },
    [estimateHeight]
  );

  // تسجيل الواجهة مرة واحدة.
  const registerApiRef = useRef(registerApi);
  useEffect(() => {
    registerApiRef.current = registerApi;
  });
  useEffect(() => {
    registerApiRef.current?.({ scrollToIndex, stepHeight });
  }, [scrollToIndex, stepHeight]);

  // Scroll Into View الموحّد: تغيّر الفهرس النشط من خارج القائمة يمرّر إليه.
  const lastActiveIndex = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (activeIndex === undefined) return;
    if (lastActiveIndex.current === activeIndex) return;
    lastActiveIndex.current = activeIndex;
    scrollToIndex(activeIndex, { center: true });
  }, [activeIndex, scrollToIndex]);

  const stopHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (repeatTimer.current !== null) {
      window.clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  }, []);

  useEffect(() => stopHold, [stopHold]);

  /** نقرة = خطوة؛ ضغط مستمر = تمرير متواصل بعد مهلة قصيرة. */
  const startHold = useCallback(
    (direction: 1 | -1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'touch') return; // اللمس يمرّر بالإصبع أصلًا.
      event.preventDefault();
      const element = listRef.current;
      element?.scrollBy({ top: direction * stepHeight(), behavior: 'smooth' });
      stopHold();
      holdTimer.current = window.setTimeout(() => {
        repeatTimer.current = window.setInterval(() => {
          listRef.current?.scrollBy({ top: direction * stepHeight() / 3, behavior: 'auto' });
        }, HOLD_REPEAT_MS);
      }, HOLD_DELAY_MS);
    },
    [stepHeight, stopHold]
  );

  const body = useMemo(() => {
    if (itemCount === 0) return emptyState ?? null;
    if (renderWindow) return renderWindow(windowed);
    return children ?? null;
  }, [children, emptyState, itemCount, renderWindow, windowed]);

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      {header && <div className="sticky top-0 z-10 shrink-0 border-b border-stone-200 bg-white">{header}</div>}

      {canScrollUp && (
        <button
          type="button"
          onPointerDown={startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onClick={() => listRef.current?.scrollBy({ top: -stepHeight(), behavior: 'smooth' })}
          className="tashjeer-scroll-btn absolute start-1 top-12 z-20"
          aria-label="الصعود في القائمة"
          title="صعود (اضغط مطولا لتمرير متواصل)"
        >
          ↑
        </button>
      )}
      {showJumpTop && (
        <button
          type="button"
          onClick={() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="tashjeer-scroll-btn absolute start-1 top-20 z-20"
          aria-label="الانتقال إلى أعلى القائمة"
          title="إلى أعلى القائمة"
        >
          ⤒
        </button>
      )}

      <div
        ref={listRef}
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        className={`tashjeer-scroll-area min-h-0 flex-1 overscroll-contain overflow-y-scroll [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 touch-pan-y ${contentClassName}`}
      >
        {itemCount === 0 ? (
          body
        ) : renderWindow ? (
          <>
            {windowed.active && windowed.topPad > 0 && <div aria-hidden style={{ height: windowed.topPad }} />}
            {body}
            {windowed.active && windowed.bottomPad > 0 && <div aria-hidden style={{ height: windowed.bottomPad }} />}
          </>
        ) : (
          body
        )}
      </div>

      {canScrollDown && (
        <button
          type="button"
          onPointerDown={startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onClick={() => listRef.current?.scrollBy({ top: stepHeight(), behavior: 'smooth' })}
          className="tashjeer-scroll-btn absolute bottom-1 start-1 z-20"
          aria-label="النزول في القائمة"
          title="نزول (اضغط مطولا لتمرير متواصل)"
        >
          ↓
        </button>
      )}
    </div>
  );
}

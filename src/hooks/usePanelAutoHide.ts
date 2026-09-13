// خطاف الإخفاء التلقائي للوحات - Panel Auto-Hide Hook (FR-ED-12)
//
// يربط آلة حالة الكشف (`EdgeRevealController`) بالمتصفح: يتتبّع المؤشر
// والإصبع، ويقرّر متى تُكشف حافة ومتى تُخفى، بلا وميض وبلا فتح عرضي.
//
// **لا مناطق شفافة فوق المحتوى.** الكشف يُحسب من إحداثيات المؤشر وحجم منطقة
// المحرر (`edgeZoneForPoint`)، فلا عنصر DOM يسرق نقرات اللوحة أو كلماتها في
// أطراف الشاشة — وهو الفرق بين وضع احترافي ووضع يعطّل الرسم عند الحواف.

'use client';

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { usePanelStore } from '@/stores/panel-store';
import {
  EdgeRevealController,
  edgeHasOverlay,
  edgeZoneForPoint,
  overlayPanelsOnEdge,
  PANEL_EDGE,
  panelPlacement,
  type PanelEdge,
  type PanelId,
} from '@/lib/ui/panel-layout';

/** سمة تُوضع على غلاف اللوحة الفوقية حتى يعرف اللمس هل النقرة داخلها. */
export const PANEL_OVERLAY_ATTR = 'data-panel-overlay';

export interface PanelAutoHide {
  /** هل وضع الإخفاء مفعّل أصلًا. */
  enabled: boolean;
  /** الحافة المكشوفة الآن. */
  revealedEdge: PanelEdge | null;
  /** هل هذه اللوحة مكشوفة الآن (بالحافة أو بالزر العائم). */
  isOpen: (id: PanelId) => boolean;
  /** اللوحات الفوقية على حافة، لرسم مقابضها العائمة. */
  overlayPanelsOn: (edge: PanelEdge) => PanelId[];
  /** خصائص تُربط بغلاف لوحة فوقية: إبقاؤها مفتوحة ما دام المؤشر فيها. */
  panelHandlers: (id: PanelId) => {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
  /** كشف فوري (زر عائم أو لمس الحافة). */
  revealNow: (edge: PanelEdge) => void;
  /** كشف لوحة بعينها بلا حافة (زر عائم بجانبها). */
  holdPanel: (id: PanelId) => void;
  /** إخفاء فوري لكل مكشوف. */
  hideNow: () => void;
}

/**
 * يشغّل الإخفاء التلقائي داخل منطقة المحرر.
 *
 * @param containerRef عنصر يملأ مساحة العمل؛ تُقاس الحواف بالنسبة إليه لا
 *        بالنسبة للنافذة، حتى لا تتداخل الحافة مع قائمة التطبيق الجانبية.
 */
export function usePanelAutoHide(
  containerRef: RefObject<HTMLElement | null>
): PanelAutoHide {
  const prefs = usePanelStore((state) => state.prefs);
  const revealedEdge = usePanelStore((state) => state.revealedEdge);
  const heldPanel = usePanelStore((state) => state.heldPanel);
  const revealEdge = usePanelStore((state) => state.revealEdge);
  const holdPanelAction = usePanelStore((state) => state.holdPanel);

  const enabled = prefs.autoHide;
  const controllerRef = useRef<EdgeRevealController | null>(null);
  const lastEdgeRef = useRef<PanelEdge | null>(null);

  // آلة الحالة تُنشأ من جديد عند تغيير الحساسية، فتُحترم الأرقام المحفوظة.
  useEffect(() => {
    const controller = new EdgeRevealController({
      revealDelayMs: prefs.revealDelayMs,
      hideDelayMs: prefs.hideDelayMs,
      onReveal: (edge) => revealEdge(edge),
      onHide: () => revealEdge(null),
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [prefs.revealDelayMs, prefs.hideDelayMs, revealEdge]);

  /**
   * قياس منطقة المحرر مخزَّن مؤقتًا.
   *
   * `getBoundingClientRect` عند كل `pointermove` تُجبر المتصفح على إعادة حساب
   * التخطيط، فيظهر التلعثم عند تحريك المؤشر قرب الحواف. يُبطَل التخزين عند
   * تغيير مقاس النافذة أو التمرير أو تغيّر تفضيلات اللوحات — طيّ الشريط
   * الجانبي يغيّر عرض منطقة المحرر دون أن يُطلق حدث resize.
   */
  const containerRectRef = useRef<DOMRect | null>(null);

  const invalidateContainerRect = useCallback(() => {
    containerRectRef.current = null;
  }, []);

  useEffect(() => {
    containerRectRef.current = null;
  }, [prefs]);

  /** إحداثيات المؤشر بالنسبة لمنطقة المحرر، أو null إن كان خارجها. */
  const pointInside = useCallback(
    (clientX: number, clientY: number) => {
      const node = containerRef.current;
      if (!node) return null;
      if (!containerRectRef.current) {
        containerRectRef.current = node.getBoundingClientRect();
      }
      const rect = containerRectRef.current;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        return { x, y, width: rect.width, height: rect.height, inside: false };
      }
      return { x, y, width: rect.width, height: rect.height, inside: true };
    },
    [containerRef]
  );

  // تتبّع المؤشر: دخول منطقة حافة يبدأ مؤقت الظهور، والخروج منها يبدأ مؤقت
  // الإخفاء. مستمع واحد على النافذة يكفي، فلا عناصر فوق المحتوى.
  useEffect(() => {
    const controller = () => controllerRef.current;
    if (!enabled) {
      controller()?.hideNow();
      lastEdgeRef.current = null;
      return;
    }

    const onMove = (event: PointerEvent | MouseEvent) => {
      const point = pointInside(event.clientX, event.clientY);
      if (!point || !point.inside) {
        if (lastEdgeRef.current !== null) {
          lastEdgeRef.current = null;
          controller()?.pointerLeaveEdge();
        }
        return;
      }

      const edge = edgeZoneForPoint(point, point, prefs.edgeZonePx);
      if (edge !== null && edgeHasOverlay(prefs, edge)) {
        if (lastEdgeRef.current !== edge) {
          lastEdgeRef.current = edge;
          controller()?.pointerEnterEdge(edge);
        }
        return;
      }

      if (lastEdgeRef.current !== null) {
        lastEdgeRef.current = null;
        controller()?.pointerLeaveEdge();
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('resize', invalidateContainerRect);
    window.addEventListener('scroll', invalidateContainerRect, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('resize', invalidateContainerRect);
      window.removeEventListener('scroll', invalidateContainerRect, { capture: true });
    };
  }, [enabled, pointInside, invalidateContainerRect, prefs]);

  // اللمس: لا «مرور» على الحافة بل نقرة أو سحب، فالكشف فوري. والنقر خارج
  // اللوحة المكشوفة يغلقها، وهو ما يتوقعه مستخدم اللوح.
  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const point = pointInside(touch.clientX, touch.clientY);
      if (!point || !point.inside) return;

      const target = event.target as Element | null;
      if (target?.closest?.(`[${PANEL_OVERLAY_ATTR}]`)) return;

      const edge = edgeZoneForPoint(point, point, prefs.edgeZonePx);
      if (edge !== null && edgeHasOverlay(prefs, edge)) {
        controllerRef.current?.revealNow(edge);
        return;
      }
      if (usePanelStore.getState().revealedEdge !== null) {
        controllerRef.current?.hideNow();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => window.removeEventListener('touchstart', onTouchStart);
  }, [enabled, pointInside, prefs]);

  // Esc يغلق المكشوف قبل أي شيء آخر، فلا تبقى لوحة عائمة حائرة.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (usePanelStore.getState().revealedEdge === null) return;
      controllerRef.current?.hideNow();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  /**
   * هل اللوحة مكشوفة الآن؟
   *
   * تُشتق من التفضيل والحالتين الزائلتين معا، فلا يمكن أن تتعارض مع المخزن؛
   * واعتمادها عليهما يجعل كل مستهلك يعيد الرسم حين يتغير الكشف.
   */
  const isOpen = useCallback(
    (id: PanelId): boolean => {
      const placement = panelPlacement(prefs, id);
      if (placement === 'hidden') return false;
      if (placement === 'flow') return true;
      if (heldPanel === id) return true;
      const edge = PANEL_EDGE[id];
      return edge !== null && revealedEdge === edge;
    },
    [prefs, heldPanel, revealedEdge]
  );

  const panelHandlers = useCallback(
    (id: PanelId) => ({
      onPointerEnter: () => {
        if (!enabled) return;
        if (panelPlacement(prefs, id) !== 'overlay') return;
        controllerRef.current?.pointerEnterPanel();
      },
      onPointerLeave: () => {
        if (!enabled) return;
        controllerRef.current?.pointerLeavePanel();
      },
    }),
    [enabled, prefs]
  );

  const revealNow = useCallback(
    (edge: PanelEdge) => {
      // كشف صريح بنقرة أو لمس: يُقاس من جديد، فقد تغيّر التخطيط منذ آخر حركة.
      containerRectRef.current = null;
      controllerRef.current?.revealNow(edge);
    },
    []
  );

  const hideNow = useCallback(() => {
    controllerRef.current?.hideNow();
  }, []);

  const overlayPanelsOn = useCallback(
    (edge: PanelEdge) => overlayPanelsOnEdge(prefs, edge),
    [prefs]
  );

  return useMemo(
    () => ({
      enabled,
      revealedEdge,
      isOpen,
      overlayPanelsOn,
      panelHandlers,
      revealNow,
      holdPanel: (id: PanelId) => holdPanelAction(id),
      hideNow,
    }),
    [enabled, revealedEdge, isOpen, overlayPanelsOn, panelHandlers, revealNow, holdPanelAction, hideNow]
  );
}

// إطار اللوحة القابلة للإخفاء - PanelFrame (FR-ED-12)
//
// مكوّن واحد يقرّر **أين** تُرسم اللوحة، فتتصرف كل اللوحات سلوكًا واحدًا:
//
//   hidden   → لا تُرسم.
//   flow     → في التدفق، تأخذ مساحتها (الوضع المعتاد، أو مثبتة).
//   overlay  → طبقة فوقية على حافتها، لا تأخذ مساحة، وتظهر عند كشف الحافة.
//
// وفي الحالتين الأخيرتين تُرسم اللوحة نفسها **بلا أي تغيير داخلي**: العرض نفسه،
// والتمرير الداخلي نفسه، ومواضع الكلمات والأسطر نفسها. الفرق موضع الغلاف فقط،
// فلا «يقفز» شيء داخل اللوحة بين المخفية والمثبتة (معيار القبول ٣ و٧).
//
// ============================ لماذا translate لا unmount؟ ============================
//
// اللوحة الفوقية تبقى مركّبة وتُنقل خارج الرؤية بـ`transform`، لسببين:
//   1. الظهور والاختفاء حركة واحدة ناعمة بلا وميض (لا إعادة تركيب ولا إعادة
//      قياس لكلمات المصحف داخل اللوحة).
//   2. الحالة الداخلية للوحة (موضع التمرير، الحقول المفتوحة، التحديد) لا تضيع
//      كلما ابتعد المؤشر، فوضع الإخفاء لا يكلّف المحقق عمله.
//
// وعندما تكون مخفية تُعطَّل بالـ`inert` و`pointer-events-none` و`aria-hidden`
// فلا تصلها لوحة المفاتيح ولا قارئ الشاشة ولا النقر.

'use client';

import { Children, createContext, useContext, type ReactNode } from 'react';
import {
  PANEL_EDGE,
  panelPlacement,
  type PanelEdge,
  type PanelId,
  type PanelPlacement,
} from '@/lib/ui/panel-layout';
import { usePanelStore } from '@/stores/panel-store';
import type { PanelAutoHide } from '@/hooks/usePanelAutoHide';
import { PANEL_OVERLAY_ATTR } from '@/hooks/usePanelAutoHide';

/**
 * سياق وضع الإخفاء، يوفّره صفحة المحرر (مالك آلة الكشف الواحدة).
 *
 * بدونه تعمل اللوحات في التدفق دائمًا، فتبقى صالحة للاستعمال خارج المحرر.
 */
const PanelAutoHideContext = createContext<PanelAutoHide | null>(null);

export function PanelAutoHideProvider({
  value,
  children,
}: {
  value: PanelAutoHide;
  children: ReactNode;
}) {
  return <PanelAutoHideContext.Provider value={value}>{children}</PanelAutoHideContext.Provider>;
}

export function usePanelAutoHideContext(): PanelAutoHide | null {
  return useContext(PanelAutoHideContext);
}

/**
 * مواضع الطبقة الفوقية لكل حافة.
 *
 * `translate-x` في Tailwind فيزيائي لا منطقي، والواجهة كلها `dir="rtl"`:
 * فالبداية (start) هي **اليمين**، وإخفاء لوحته دفعٌ إلى اليمين (`translate-x-full`)،
 * والنهاية (end) هي **اليسار** وإخفاؤها دفع إلى اليسار.
 */
const OVERLAY_POSITION: Record<PanelEdge, string> = {
  top: 'inset-x-0 top-0',
  start: 'inset-y-0 start-0',
  end: 'inset-y-0 end-0',
  bottom: 'inset-x-0 bottom-0',
};

const OVERLAY_HIDDEN_SHIFT: Record<PanelEdge, string> = {
  top: '-translate-y-full',
  start: 'translate-x-full',
  end: '-translate-x-full',
  bottom: 'translate-y-full',
};

const OVERLAY_Z: Record<PanelEdge, string> = {
  // الشريط العلوي فوق اللوحات الجانبية حتى لا يقطع ظله أدوات الرسم.
  top: 'z-40',
  start: 'z-30',
  end: 'z-30',
  bottom: 'z-20',
};

export interface PanelFrameProps {
  panel: PanelId;
  children: ReactNode;
  /**
   * صنف إضافي على الغلاف الفوقي (عرض اللوحة مثلًا).
   *
   * لا يُستعمل في التدفق: هناك الغلاف `display: contents` فتبقى اللوحة نفسها
   * عنصر التخطيط، فلا يتغير قياسها بين الوضعين.
   */
  overlayClassName?: string;
  /** ظل الطبقة الفوقية، يفصلها بصريا عن المحتوى تحتها. */
  shadowClassName?: string;
}

/** يرسم اللوحة في وضعها الحالي: مخفية، أو في التدفق، أو طبقة فوقية. */
export function PanelFrame({
  panel,
  children,
  overlayClassName = '',
  shadowClassName = 'shadow-2xl',
}: PanelFrameProps) {
  const placement = usePanelStore((state) => panelPlacement(state.prefs, panel));
  const open = usePanelStore((state) => state.isOpen(panel));
  const autoHide = usePanelAutoHideContext();

  if (placement === 'hidden') return null;

  if (placement === 'flow') {
    // `contents`: الغلاف شفّاف تخطيطيًا، فاللوحة هي عنصر الـflex نفسه كما كانت
    // قبل وجود وضع الإخفاء — لا إزاحة ولا تغيير قياس.
    return <div className="contents">{children}</div>;
  }

  const edge = PANEL_EDGE[panel] ?? 'start';
  const handlers = autoHide?.panelHandlers(panel);

  return (
    <div
      {...{ [PANEL_OVERLAY_ATTR]: panel }}
      aria-hidden={!open}
      inert={!open}
      onPointerEnter={handlers?.onPointerEnter}
      onPointerLeave={handlers?.onPointerLeave}
      className={[
        'absolute',
        OVERLAY_POSITION[edge],
        OVERLAY_Z[edge],
        'transition-transform duration-200 ease-out will-change-transform',
        open ? `translate-x-0 translate-y-0 ${shadowClassName}` : OVERLAY_HIDDEN_SHIFT[edge],
        open ? '' : 'pointer-events-none',
        overlayClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

/**
 * يرسم محتوى لوحة واحدة داخل غلاف مشترك، فيختفي وحده إن أُخفي.
 *
 * يُستعمل مع `PanelGroupFrame`: الشريط العلوي لوحتان (الأدوات والآيات) على
 * حافة واحدة، وقد يُخفي المحقق إحداهما فتبقى الأخرى.
 */
export function PanelSlot({ panel, children }: { panel: PanelId; children: ReactNode }) {
  const placement = usePanelStore((state) => panelPlacement(state.prefs, panel));
  if (placement === 'hidden') return null;
  return <>{children}</>;
}

/**
 * غلاف لمجموعة لوحات تشترك في حافة واحدة (الشريط العلوي: الأدوات + الآيات).
 *
 * لو رُصّت كل لوحة في طبقة مستقلة لتراكمت إحداها فوق الأخرى على الحافة نفسها،
 * فاللوحات **الفوقية** منها تُرصّ في طبقة واحدة. أما **المثبتة** فتبقى في
 * التدفق: تثبيت لوحة يعني أنها لا تغادر مكانها أبدًا، ولو سُحبت إلى الطبقة
 * لصارت الطبقة مفتوحة دائمًا ولفقد المحقق تثبيته. لذلك يفصل الغلاف أطفاله بين
 * التدفق والطبقة حين يطابق عدد الأطفال عدد اللوحات (وهو حال استعماله)، وإلا
 * احتاط فرسم الجميع في التدفق.
 */
export function PanelGroupFrame({
  panels,
  children,
  overlayClassName = '',
  shadowClassName = 'shadow-2xl',
}: {
  panels: PanelId[];
  children: ReactNode;
  overlayClassName?: string;
  shadowClassName?: string;
}) {
  // المفاتيح نصوص لا مصفوفات: مقارنة Zustand الافتراضية بالمرجع، فمصفوفة جديدة
  // في كل اختيار تعني إعادة رسم لا تنتهي.
  const placementsKey = usePanelStore((state) =>
    panels.map((panel) => panelPlacement(state.prefs, panel)).join(',')
  );
  const overlayKey = usePanelStore((state) =>
    panels
      .filter((panel) => panelPlacement(state.prefs, panel) === 'overlay')
      .join(',')
  );
  // «مفتوحة» تعني أن إحدى اللوحات **الفوقية** مكشوفة؛ المثبتة لا تحسب، وإلا
  // بقيت الطبقة مفتوحة إلى الأبد.
  const open = usePanelStore((state) =>
    panels.some(
      (panel) => panelPlacement(state.prefs, panel) === 'overlay' && state.isOpen(panel)
    )
  );
  const autoHide = usePanelAutoHideContext();

  const placements = placementsKey.split(',') as PanelPlacement[];
  if (placements.every((placement) => placement === 'hidden')) return null;

  const overlayPanels = (overlayKey ? overlayKey.split(',') : []) as PanelId[];
  const slots = Children.toArray(children);
  const splittable = slots.length === panels.length;

  if (overlayPanels.length === 0 || !splittable) {
    return <div className="contents">{children}</div>;
  }

  const overlayIndexes = new Set(
    panels.map((panel, index) => (overlayPanels.includes(panel) ? index : -1)).filter((i) => i >= 0)
  );
  const flowSlots = slots.filter((_, index) => !overlayIndexes.has(index));
  const overlaySlots = slots.filter((_, index) => overlayIndexes.has(index));

  const edge = PANEL_EDGE[overlayPanels[0]] ?? 'top';
  const handlers = autoHide?.panelHandlers(overlayPanels[0]);

  return (
    <>
      {flowSlots.length > 0 && <div className="contents">{flowSlots}</div>}
      <div
        {...{ [PANEL_OVERLAY_ATTR]: overlayPanels.join(' ') }}
        aria-hidden={!open}
        inert={!open}
        onPointerEnter={handlers?.onPointerEnter}
        onPointerLeave={handlers?.onPointerLeave}
        className={[
          'absolute',
          OVERLAY_POSITION[edge],
          OVERLAY_Z[edge],
          'flex flex-col transition-transform duration-200 ease-out will-change-transform',
          open ? `translate-x-0 translate-y-0 ${shadowClassName}` : OVERLAY_HIDDEN_SHIFT[edge],
          open ? '' : 'pointer-events-none',
          overlayClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {overlaySlots}
      </div>
    </>
  );
}

/**
 * مقبض عائم على الحافة: بديل اللمس عن ملامسة الحافة نفسها، وطريقة كشف صريحة
 * لا تعتمد على دقة وصول المؤشر إلى آخر ١٤ بكسل.
 *
 * وهو القرار المحسوم للأجهزة اللمسية: «وزر عائم صغير كبديل دائم». يظهر فقط
 * حين يكون على الحافة ما يُكشف **وهي مغلقة**؛ فإذا كُشفت اللوحة اختفى المقبض
 * حتى لا يغطي شيئًا منها، والإغلاق يعود إلى السلوك الطبيعي: الابتعاد يخفي
 * غير المثبتة، وEsc يغلق المكشوفة، ولمس خارجها يغلقها.
 *
 * المواضع بالمنطق RTL: `start` هي **اليمين**، فالمقبض الملاصق لها يُثبَّت بـ
 * `start-0` وتُقوَّس حوافه المقابلة للمحتوى (`rounded-e`) ويُلغى حدّه الملاصق
 * للحافة (`border-s-0`).
 */
export function PanelEdgeHandle({ edge, label }: { edge: PanelEdge; label: string }) {
  const prefs = usePanelStore((state) => state.prefs);
  const revealedEdge = usePanelStore((state) => state.revealedEdge);
  const autoHide = usePanelAutoHideContext();

  if (!prefs.autoHide) return null;
  if (revealedEdge === edge) return null;
  const panels = autoHide?.overlayPanelsOn(edge) ?? [];
  if (panels.length === 0) return null;

  const position =
    edge === 'top'
      ? 'start-1/2 top-0 translate-x-1/2 rounded-b-md border-t-0'
      : edge === 'bottom'
        ? 'start-1/2 bottom-0 translate-x-1/2 rounded-t-md border-b-0'
        : edge === 'start'
          ? 'start-0 top-1/2 -translate-y-1/2 rounded-e-md border-s-0'
          : 'end-0 top-1/2 -translate-y-1/2 rounded-s-md border-e-0';

  const arrow = edge === 'top' ? '▾' : edge === 'bottom' ? '▴' : edge === 'start' ? '◂' : '▸';

  return (
    <button
      type="button"
      onClick={() => autoHide?.revealNow(edge)}
      aria-expanded={false}
      aria-label={label}
      title={label}
      className={[
        'absolute z-40 flex h-7 items-center justify-center border border-stone-300 bg-white/95 px-1.5',
        'text-[10px] font-medium text-stone-600 shadow-md backdrop-blur-sm',
        'hover:bg-emerald-50 hover:text-emerald-800',
        position,
      ].join(' ')}
    >
      {arrow}
    </button>
  );
}

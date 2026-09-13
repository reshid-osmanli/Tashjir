// اختبارات وضع إخفاء اللوحات (FR-ED-12، NFR-03)
//
// ما تحرسه هذه الاختبارات:
//   1. القرار: أي لوحة في التدفق، وأيها طبقة فوقية، وأيها مخفية.
//   2. الإخفاء **يوفّر مساحة** المحرر فعلا (معيار القبول ٣).
//   3. الحساسية: ملامسة الحافة تكشف، والعبور العابر لا يكشف، والابتعاد يخفي
//      بعد مهلة، والدخول في اللوحة يلغي الإخفاء — فلا وميض (معيار ٤).
//   4. التثبيت والحفظ: التفضيل يُستعاد في الجلسة التالية (T2.4).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import {
  compactPanelLayout,
  countOverlayPanels,
  DEFAULT_HIDE_DELAY_MS,
  DEFAULT_PANEL_LAYOUT,
  DEFAULT_REVEAL_DELAY_MS,
  EdgeRevealController,
  edgeHasOverlay,
  edgeZoneForPoint,
  isPanelInFlow,
  isPanelOverlay,
  normalizePanelLayout,
  overlayPanelsOnEdge,
  PANEL_EDGE,
  PANEL_IDS,
  PANEL_OVERLAY_WITHOUT_EDGE,
  panelPlacement,
  readPanelLayout,
  resetPanelLayout,
  reservedSideWidth,
  savePanelLayout,
  setAutoHide,
  setPanelPinned,
  setPanelVisible,
  togglePanelPinned,
  togglePanelVisible,
  PANEL_LAYOUT_STORAGE_KEY,
  type PanelEdge,
  type PanelId,
  type PanelLayoutPrefs,
  type Scheduler,
} from '@/lib/ui/panel-layout';

// ==================== أدوات ====================

/** جدول زمني يدوي: الاختبار يتحكم في الوقت فلا ينتظر ولا يتذبذب. */
function fakeScheduler() {
  const timers = new Map<number, { handler: () => void; at: number }>();
  let now = 0;
  let nextId = 1;

  const scheduler: Scheduler & {
    advance: (ms: number) => void;
    pending: () => number;
  } = {
    setTimeout: (handler, ms) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { handler, at: now + ms });
      return id;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
    advance: (ms) => {
      now += ms;
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= now)
        .sort((first, second) => first[1].at - second[1].at);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.handler();
      }
    },
    pending: () => timers.size,
  };
  return scheduler;
}

function controllerWith(scheduler: Scheduler) {
  const revealed: PanelEdge[] = [];
  let hides = 0;
  const controller = new EdgeRevealController({
    scheduler,
    onReveal: (edge) => revealed.push(edge),
    onHide: () => {
      hides += 1;
    },
  });
  return { controller, revealed, hides: () => hides };
}

/** وضع الإخفاء مفعّل وكل اللوحات غير مثبتة: «وضع الشاشة الصغيرة». */
function compact(): PanelLayoutPrefs {
  return compactPanelLayout(DEFAULT_PANEL_LAYOUT);
}

const PANEL_WIDTHS = { properties: 320, variants: 340 };

// ==================== 1) القرار ====================

describe('وضع اللوحة: مخفية / في التدفق / فوقية', () => {
  it('بلا إخفاء تلقائي كل لوحة ظاهرة في التدفق', () => {
    for (const id of PANEL_IDS) {
      expect(panelPlacement(DEFAULT_PANEL_LAYOUT, id)).toBe('flow');
      expect(isPanelInFlow(DEFAULT_PANEL_LAYOUT, id)).toBe(true);
    }
  });

  it('مع الإخفاء التلقائي المثبتة في التدفق وغير المثبتة فوقية', () => {
    const prefs = setAutoHide(DEFAULT_PANEL_LAYOUT, true);
    expect(panelPlacement({ ...prefs, panels: { ...prefs.panels, properties: { visible: true, pinned: true } } }, 'properties')).toBe('flow');

    const unpinned = setPanelPinned(prefs, 'properties', false);
    expect(panelPlacement(unpinned, 'properties')).toBe('overlay');
    expect(isPanelOverlay(unpinned, 'properties')).toBe(true);
  });

  it('الإخفاء الصريح يخفي اللوحة حتى مع إطفاء الإخفاء التلقائي', () => {
    const prefs = setPanelVisible(DEFAULT_PANEL_LAYOUT, 'variants', false);
    expect(panelPlacement(prefs, 'variants')).toBe('hidden');
    expect(panelPlacement(setAutoHide(prefs, true), 'variants')).toBe('hidden');
    // والحافة لا تكشف ما أخفاه المستخدم صراحة، ولو كان الإخفاء التلقائي مفعلا.
    const hiddenAndAuto = setPanelVisible(compact(), 'variants', false);
    expect(edgeHasOverlay(hiddenAndAuto, 'end')).toBe(false);
    expect(overlayPanelsOnEdge(hiddenAndAuto, 'end')).toEqual([]);
  });

  it('من لا حافة لها ولا آلية كشف لا تصير فوقية: لا معنى لطبقة لا تُكشف', () => {
    const prefs = compact();
    for (const id of PANEL_IDS) {
      if (PANEL_EDGE[id] === null && !PANEL_OVERLAY_WITHOUT_EDGE.has(id)) {
        expect(panelPlacement(prefs, id)).toBe('flow');
      }
    }
    expect(PANEL_EDGE.breadcrumb).toBeNull();
    expect(PANEL_EDGE.relations).toBeNull();
  });

  it('قائمة التطبيق تنطوي إلى شريط رفيع: فوقية بلا حافة لأن شريطها هو المقبض', () => {
    // مثبتة (الافتراضي) → بعرضها الكامل في التدفق، حتى مع تفعيل الإخفاء.
    expect(panelPlacement(setAutoHide(DEFAULT_PANEL_LAYOUT, true), 'appnav')).toBe('flow');
    // غير مثبتة + إخفاء مفعّل → منطوية (شريط أيقونات)، ولا حافة تكشفها لأنها
    // ليست على حافة منطقة المحرر أصلًا.
    const collapsed = setPanelPinned(setAutoHide(DEFAULT_PANEL_LAYOUT, true), 'appnav', false);
    expect(panelPlacement(collapsed, 'appnav')).toBe('overlay');
    expect(PANEL_EDGE.appnav).toBeNull();
    expect(overlayPanelsOnEdge(collapsed, 'start')).not.toContain('appnav');
    expect(edgeHasOverlay(collapsed, 'start')).toBe(false);
    // مخفية صراحة → لا تُرسم، فلا شريط ولا قائمة.
    expect(panelPlacement(setPanelVisible(collapsed, 'appnav', false), 'appnav')).toBe('hidden');
    // «وضع الشاشة الصغيرة» ينطوي بها، فتظهر ضمن عدّاد الطبقات الفوقية.
    expect(panelPlacement(compact(), 'appnav')).toBe('overlay');
    expect(countOverlayPanels(compact())).toBe(6);
  });

  it('الحافة العلوية تجمع شريط الأدوات وشريط الآيات كشريط علوي واحد', () => {
    expect(overlayPanelsOnEdge(compact(), 'top')).toEqual(['toolbar', 'navigator']);
    expect(overlayPanelsOnEdge(compact(), 'start')).toEqual(['properties']);
    expect(overlayPanelsOnEdge(compact(), 'end')).toEqual(['variants']);
    expect(overlayPanelsOnEdge(compact(), 'bottom')).toEqual(['statusbar']);
  });

  it('إخفاء شريط الأدوات وحده يترك شريط الآيات على الحافة العلوية', () => {
    const prefs = setPanelVisible(compact(), 'toolbar', false);
    expect(overlayPanelsOnEdge(prefs, 'top')).toEqual(['navigator']);
  });
});

// ==================== 2) المساحة ====================

describe('الإخفاء يوفّر مساحة المحرر', () => {
  it('كل اللوحات مثبتة: المحرر محجوز من الجهتين', () => {
    expect(reservedSideWidth(DEFAULT_PANEL_LAYOUT, PANEL_WIDTHS)).toEqual({
      start: 320,
      end: 340,
    });
  });

  it('وضع الإخفاء التلقائي يحرّر العرض كله للطبقات الفوقية', () => {
    expect(reservedSideWidth(compact(), PANEL_WIDTHS)).toEqual({ start: 0, end: 0 });
    // الخمس ذات الحواف (الأدوات، الآيات، الخصائص، الاختلافات، الحالة) + قائمة
    // التطبيق المنطوية؛ ويبقى شريط المسار ولوحة العلاقات في التدفق إذ لا آلية
    // تكشف لهما.
    expect(countOverlayPanels(compact())).toBe(6);
  });

  it('تثبيت لوحة واحدة يعيد حجز مساحتها وحدها', () => {
    const prefs = setPanelPinned(compact(), 'variants', true);
    expect(reservedSideWidth(prefs, PANEL_WIDTHS)).toEqual({ start: 0, end: 340 });
  });

  it('إخفاء اللوحتين صراحة يحرّر العرض ولو كان الإخفاء التلقائي مطفأ', () => {
    const prefs = setPanelVisible(setPanelVisible(DEFAULT_PANEL_LAYOUT, 'properties', false), 'variants', false);
    expect(reservedSideWidth(prefs, PANEL_WIDTHS)).toEqual({ start: 0, end: 0 });
  });
});

// ==================== 3) منطقة الحافة ====================

describe('منطقة الحافة: أي حافة يلمسها المؤشر', () => {
  const viewport = { width: 1366, height: 768, rtl: true };

  it('في RTL البداية يمين والنهاية يسار', () => {
    expect(edgeZoneForPoint({ x: 1360, y: 400 }, viewport, 14)).toBe('start');
    expect(edgeZoneForPoint({ x: 4, y: 400 }, viewport, 14)).toBe('end');
    expect(edgeZoneForPoint({ x: 700, y: 5 }, viewport, 14)).toBe('top');
    expect(edgeZoneForPoint({ x: 700, y: 765 }, viewport, 14)).toBe('bottom');
  });

  it('وسط الشاشة ليس حافة', () => {
    expect(edgeZoneForPoint({ x: 700, y: 400 }, viewport, 14)).toBeNull();
  });

  it('عرض المنطقة مضبوط: ١٥ داخل و١٥ خارج عند منطقة ١٤', () => {
    expect(edgeZoneForPoint({ x: 1366 - 13, y: 400 }, viewport, 14)).toBe('start');
    expect(edgeZoneForPoint({ x: 1366 - 15, y: 400 }, viewport, 14)).toBeNull();
  });

  it('الزاوية العليا القريبة من البداية للوحة الجانبية لا للشريط العلوي', () => {
    expect(edgeZoneForPoint({ x: 1364, y: 2 }, viewport, 14)).toBe('start');
  });

  it('في LTR تنعكس البدايتان', () => {
    const ltr = { width: 1024, height: 625, rtl: false };
    expect(edgeZoneForPoint({ x: 3, y: 300 }, ltr, 14)).toBe('start');
    expect(edgeZoneForPoint({ x: 1020, y: 300 }, ltr, 14)).toBe('end');
  });

  it('لوح ١٠٢٤×٦٢٥: الحواف تُحسب على مقاسه هو', () => {
    const tablet = { width: 1024, height: 625, rtl: true };
    expect(edgeZoneForPoint({ x: 1015, y: 300 }, tablet, 14)).toBe('start');
    expect(edgeZoneForPoint({ x: 512, y: 620 }, tablet, 14)).toBe('bottom');
    expect(edgeZoneForPoint({ x: 512, y: 300 }, tablet, 14)).toBeNull();
  });

  it('إحداثيات تالفة أو منطقة صفرية لا تكشف شيئا', () => {
    expect(edgeZoneForPoint({ x: Number.NaN, y: 10 }, viewport, 14)).toBeNull();
    expect(edgeZoneForPoint({ x: 10, y: 10 }, viewport, 0)).toBeNull();
    expect(edgeZoneForPoint({ x: 10, y: 10 }, { width: 0, height: 0 }, 14)).toBeNull();
  });
});

// ==================== 4) زمن الظهور والإخفاء ====================

describe('آلة كشف الحواف: بلا وميض وبلا فتح عرضي', () => {
  it('العبور العابر لا يكشف: خرج قبل زمن الظهور', () => {
    const scheduler = fakeScheduler();
    const { controller, revealed } = controllerWith(scheduler);

    controller.pointerEnterEdge('start');
    scheduler.advance(DEFAULT_REVEAL_DELAY_MS - 1);
    controller.pointerLeaveEdge();
    scheduler.advance(1000);

    expect(revealed).toEqual([]);
  });

  it('المكوث في الحافة يكشف بعدها', () => {
    const scheduler = fakeScheduler();
    const { controller, revealed } = controllerWith(scheduler);

    controller.pointerEnterEdge('start');
    expect(revealed).toEqual([]);
    scheduler.advance(DEFAULT_REVEAL_DELAY_MS);
    expect(revealed).toEqual(['start']);
    expect(controller.revealedEdge).toBe('start');
  });

  it('الابتعاد يخفي بعد المهلة، والدخول في اللوحة يلغي الإخفاء', () => {
    const scheduler = fakeScheduler();
    const { controller, hides } = controllerWith(scheduler);

    controller.pointerEnterEdge('end');
    scheduler.advance(DEFAULT_REVEAL_DELAY_MS);
    controller.pointerLeaveEdge();
    scheduler.advance(DEFAULT_HIDE_DELAY_MS - 1);
    expect(hides()).toBe(0);

    // نقل المؤشر إلى داخل اللوحة نفسها: تبقى مفتوحة.
    controller.pointerEnterPanel();
    scheduler.advance(5000);
    expect(hides()).toBe(0);
    expect(controller.revealedEdge).toBe('end');

    controller.pointerLeavePanel();
    scheduler.advance(DEFAULT_HIDE_DELAY_MS);
    expect(hides()).toBe(1);
    expect(controller.revealedEdge).toBeNull();
  });

  it('الانتقال بين حافتين يلغي مؤقت الأولى فلا تُكشفان معا', () => {
    const scheduler = fakeScheduler();
    const { controller, revealed } = controllerWith(scheduler);

    controller.pointerEnterEdge('start');
    scheduler.advance(DEFAULT_REVEAL_DELAY_MS - 10);
    controller.pointerEnterEdge('end');
    scheduler.advance(DEFAULT_REVEAL_DELAY_MS);

    expect(revealed).toEqual(['end']);
  });

  it('الحركة داخل الحافة نفسها لا تعيد المؤقت (لا وميض عند الارتعاش)', () => {
    const scheduler = fakeScheduler();
    const { controller, revealed } = controllerWith(scheduler);

    controller.pointerEnterEdge('top');
    scheduler.advance(DEFAULT_REVEAL_DELAY_MS - 5);
    // ارتعاش المؤشر داخل المنطقة نفسها: لا يُعاد العدّ من الصفر.
    controller.pointerEnterEdge('top');
    scheduler.advance(10);
    expect(revealed).toEqual(['top']);
    // ولو أعيد العدّ لاحتاج ٩٠ms أخرى بعد الارتعاش، أي ١٧٥ms في المجموع.
    expect(scheduler.pending()).toBe(0);
  });

  it('الكشف الصريح فوري: اللمس والزر العائم لا ينتظران', () => {
    const scheduler = fakeScheduler();
    const { controller, revealed } = controllerWith(scheduler);

    controller.revealNow('start');
    expect(revealed).toEqual(['start']);
    expect(scheduler.pending()).toBe(0);
  });

  it('الإخفاء الصريح يلغي كل مؤقت معلّق', () => {
    const scheduler = fakeScheduler();
    const { controller, hides } = controllerWith(scheduler);

    controller.pointerEnterEdge('start');
    controller.hideNow();
    scheduler.advance(5000);
    expect(hides()).toBe(0);
    expect(scheduler.pending()).toBe(0);
  });

  it('الإخفاء لا يُنادى مرتين إن لم يكن شيء مكشوفًا', () => {
    const scheduler = fakeScheduler();
    const { controller, hides } = controllerWith(scheduler);

    controller.hideNow();
    controller.pointerLeaveEdge();
    controller.pointerLeavePanel();
    scheduler.advance(5000);
    expect(hides()).toBe(0);
  });

  it('dispose يحرر المؤقتات فلا يعمل شيء بعد فك التركيب', () => {
    const scheduler = fakeScheduler();
    const { controller, revealed } = controllerWith(scheduler);

    controller.pointerEnterEdge('start');
    controller.dispose();
    scheduler.advance(5000);
    expect(revealed).toEqual([]);
    expect(scheduler.pending()).toBe(0);
  });

  it('زمن صفر يعمل بلا مؤقتات (وضع الاختبار والاستجابة الفورية)', () => {
    const scheduler = fakeScheduler();
    const revealed: PanelEdge[] = [];
    let hides = 0;
    const controller = new EdgeRevealController({
      scheduler,
      revealDelayMs: 0,
      hideDelayMs: 0,
      onReveal: (edge) => revealed.push(edge),
      onHide: () => {
        hides += 1;
      },
    });

    controller.pointerEnterEdge('start');
    expect(revealed).toEqual(['start']);
    controller.pointerLeaveEdge();
    expect(hides).toBe(1);
    expect(scheduler.pending()).toBe(0);
  });
});

// ==================== 5) التطبيع والحفظ ====================

describe('التفضيل: تطبيع وحفظ واستعادة', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('التطبيع متسامح: الناقص يأخذ افتراضيه والتالف لا يكسر المحرر', () => {
    expect(normalizePanelLayout(null)).toEqual(resetPanelLayout());
    expect(normalizePanelLayout('ليس كائنا')).toEqual(resetPanelLayout());
    expect(normalizePanelLayout({ autoHide: 'نعم' }).autoHide).toBe(false);
    expect(normalizePanelLayout({ panels: { toolbar: { visible: false } } }).panels.toolbar).toEqual(
      { visible: false, pinned: true }
    );
    // لوحة غير معروفة تُتجاهل، ولوحة معروفة ناقصة تُكمل.
    expect(normalizePanelLayout({ panels: { ghost: {} } }).panels.variants).toEqual({
      visible: true,
      pinned: true,
    });
  });

  it('الحساسية تُحصر في مدى آمن', () => {
    expect(normalizePanelLayout({ edgeZonePx: 999 }).edgeZonePx).toBe(48);
    expect(normalizePanelLayout({ edgeZonePx: -5 }).edgeZonePx).toBe(4);
    expect(normalizePanelLayout({ revealDelayMs: Number.NaN }).revealDelayMs).toBe(
      DEFAULT_REVEAL_DELAY_MS
    );
    expect(normalizePanelLayout({ hideDelayMs: 1e9 }).hideDelayMs).toBe(3000);
  });

  it('ما يُحفظ يُستعاد في الجلسة التالية', () => {
    const prefs = setPanelPinned(setAutoHide(DEFAULT_PANEL_LAYOUT, true), 'variants', false);
    savePanelLayout(prefs);

    const reloaded = readPanelLayout();
    expect(reloaded.autoHide).toBe(true);
    expect(reloaded.panels.variants.pinned).toBe(false);
    expect(reloaded.panels.properties.pinned).toBe(true);
    expect(panelPlacement(reloaded, 'variants')).toBe('overlay');
  });

  it('التخزين التالف يعود إلى الافتراضي بلا استثناء', () => {
    window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, '{غير صالح');
    expect(readPanelLayout()).toEqual(resetPanelLayout());
  });

  it('ترحيل لطيف: من أخفى لوحة في التفضيل القديم لا يجدها عادت ظاهرة', () => {
    window.localStorage.setItem(
      'tashjeer:editor-workspace:v1',
      JSON.stringify({ showPropertiesPanel: false, showVariantsPanel: true, showGrid: true })
    );
    const migrated = readPanelLayout();
    expect(migrated.panels.properties.visible).toBe(false);
    expect(migrated.panels.variants.visible).toBe(true);
  });

  it('التفضيل المحفوظ يسبق الترحيل القديم', () => {
    window.localStorage.setItem(
      'tashjeer:editor-workspace:v1',
      JSON.stringify({ showPropertiesPanel: false })
    );
    savePanelLayout(setPanelVisible(DEFAULT_PANEL_LAYOUT, 'properties', true));
    expect(readPanelLayout().panels.properties.visible).toBe(true);
  });

  it('القلب والتبديل دوال نقية لا تعدّل التفضيل الداخل', () => {
    const before = DEFAULT_PANEL_LAYOUT;
    const after = togglePanelVisible(togglePanelPinned(before, 'properties'), 'properties');
    expect(before).toBe(DEFAULT_PANEL_LAYOUT);
    expect(before.panels.properties).toEqual({ visible: true, pinned: true });
    expect(after.panels.properties).toEqual({ visible: false, pinned: false });
  });

  it('وضع الشاشة الصغيرة: إخفاء مفعّل وكل اللوحات ظاهرة غير مثبتة', () => {
    const prefs = compactPanelLayout(DEFAULT_PANEL_LAYOUT);
    expect(prefs.autoHide).toBe(true);
    for (const id of PANEL_IDS) {
      expect(prefs.panels[id]).toEqual({ visible: true, pinned: false });
    }
  });
});

// ==================== 6) المخزن ====================

describe('مخزن اللوحات', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('الحالة مشتقة من التفضيل: الطبقة الفوقية تُفتح بكشف حافتها فقط', async () => {
    const { usePanelStore } = await import('@/stores/panel-store');
    usePanelStore.getState().compactLayout();

    const state = () => usePanelStore.getState();
    expect(state().placement('properties')).toBe('overlay');
    expect(state().isOpen('properties')).toBe(false);

    state().revealEdge('start');
    expect(state().isOpen('properties')).toBe(true);
    expect(state().isOpen('variants')).toBe(false);

    state().revealEdge(null);
    expect(state().isOpen('properties')).toBe(false);
  });

  it('الزر العائم يمسك لوحة بعينها ولو لم تكن حافتها مكشوفة', async () => {
    const { usePanelStore } = await import('@/stores/panel-store');
    usePanelStore.getState().compactLayout();
    usePanelStore.getState().holdPanel('variants');

    expect(usePanelStore.getState().isOpen('variants')).toBe(true);
    expect(usePanelStore.getState().isOpen('properties')).toBe(false);
  });

  it('التثبيت يُظهر اللوحة فورًا بلا حاجة إلى كشف', async () => {
    const { usePanelStore } = await import('@/stores/panel-store');
    const store = usePanelStore.getState();
    store.compactLayout();
    expect(usePanelStore.getState().isOpen('properties')).toBe(false);

    usePanelStore.getState().setPanelPinned('properties', true);
    expect(usePanelStore.getState().placement('properties')).toBe('flow');
    expect(usePanelStore.getState().isOpen('properties')).toBe(true);
  });

  it('كل تغيير يُحفظ في التخزين', async () => {
    const { usePanelStore } = await import('@/stores/panel-store');
    usePanelStore.getState().setAutoHide(true);
    usePanelStore.getState().setPanelVisible('statusbar', false);

    const stored = JSON.parse(
      window.localStorage.getItem('tashjeer:panels:v1') ?? '{}'
    ) as PanelLayoutPrefs;
    expect(stored.autoHide).toBe(true);
    expect(stored.panels.statusbar.visible).toBe(false);
  });

  it('المخزن يُستعاد في جلسة تالية (قراءة من التخزين عند الإنشاء)', async () => {
    const first = await import('@/stores/panel-store');
    first.usePanelStore.getState().compactLayout();
    first.usePanelStore.getState().setPanelPinned('properties', true);

    vi.resetModules();
    const second = await import('@/stores/panel-store');
    expect(second.usePanelStore.getState().prefs.autoHide).toBe(true);
    expect(second.usePanelStore.getState().prefs.panels.properties.pinned).toBe(true);
    // والحالة الزائلة لا تُستعاد: لا لوحة مفتوحة بلا سبب في جلسة جديدة.
    expect(second.usePanelStore.getState().revealedEdge).toBeNull();
    expect(second.usePanelStore.getState().heldPanel).toBeNull();
  });
});

describe('تغطية اللوحات', () => {
  it('كل لوحة مطلوبة في المتطلب معروفة ولها اسم وحافة', () => {
    const required: PanelId[] = [
      'toolbar',
      'navigator',
      'breadcrumb',
      'properties',
      'relations',
      'variants',
      'statusbar',
      'appnav',
    ];
    for (const id of required) {
      expect(PANEL_IDS).toContain(id);
      expect(id in PANEL_EDGE).toBe(true);
    }
  });
});

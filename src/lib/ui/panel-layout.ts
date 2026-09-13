// تخطيط اللوحات ووضع الإخفاء التلقائي - Panel Layout & Auto-Hide (FR-ED-12)
//
// ============================ المشكلة ============================
//
// على شاشة ١٣٦٦×٧٦٨ — فضلًا عن لوح ١٠٢٤×٦٢٥ — تأكل اللوحات مساحة اللوحة
// المركزية: قائمة التطبيق ٢٥٦px + لوحة الخصائص ٣٢٠px + لوحة الاختلافات
// ٣٤٠px، فلا يبقى للرسم شيء (NFR-03). والحل المطلوب ليس «تصغير الخط» بل
// **وضع احترافي**: كل لوحة قابلة للإخفاء فتوفّر مساحتها، وتظهر عند ملامسة
// حافة الشاشة **فوق** المحتوى بلا إزاحة، وتُثبَّت إن أراد المحقق بقاءها.
//
// ============================ النموذج ============================
//
// تفضيل **عام للمشروع** (لا لكل صفحة) مع تثبيت per-panel، وهو القرار المحسوم
// سلفًا. لكل لوحة حالتان مستقلتان:
//
//   visible  — هل تظهر أصلًا (إخفاء صريح من المستخدم).
//   pinned   — هل تبقى ظاهرة بلا إخفاء تلقائي (تأخذ مساحتها في التخطيط).
//
// ومنهما ومع المفتاح العام `autoHide` تُشتق الحالة الفعلية:
//
//   !visible                        → لا تُرسم إطلاقًا.
//   visible && (!autoHide || pinned)→ **في التدفق**: تأخذ مساحتها.
//   visible && autoHide && !pinned  → **طبقة فوقية**: لا تأخذ مساحة، وتظهر
//                                     عند كشف حافتها.
//
// الحالتان الأخيرتان ترسمان اللوحة **بالعرض نفسه والتخطيط الداخلي نفسه**؛
// الفرق موضعها فقط، فلا «يقفز» شيء داخل اللوحة بين المخفية والمثبتة.
//
// ============================ الحتمية والاختبار ============================
//
// كل القرار هنا دوال نقية (بلا DOM ولا React): `edgeZoneForPoint` تحسب الحافة
// من إحداثيات المؤشر، و`EdgeRevealController` تدير زمن الظهور والإخفاء
// بجدول قابل للحقن، فتُختبر الحساسية ومقاومة الوميض بلا متصفح.

/** كل لوحة يعرفها وضع الإخفاء. */
export type PanelId =
  /** شريط أدوات المحرر. */
  | 'toolbar'
  /** شريط الآيات/الصفحات (مستعرض الموضع). */
  | 'navigator'
  /** شريط سياق التحديد. */
  | 'breadcrumb'
  /** اللوحة اليمنى في RTL: الخصائص والتصفية والترتيب. */
  | 'properties'
  /** لوحة العلاقات (داخل لوحة الخصائص). */
  | 'relations'
  /** اللوحة اليسرى في RTL: الاختلافات والأوجه. */
  | 'variants'
  /** شريط الحالة السفلي. */
  | 'statusbar'
  /** قائمة التطبيق الجانبية (هيكل الصفحات كلها). */
  | 'appnav';

/** حافة الشاشة التي تكشف اللوحة. */
export type PanelEdge = 'top' | 'start' | 'end' | 'bottom';

/** حالة لوحة واحدة. */
export interface PanelPref {
  /** هل تظهر أصلًا. إخفاؤها صريح ولا تكشفه الحافة. */
  visible: boolean;
  /** مثبتة: تبقى في التدفق وتأخذ مساحتها حتى مع تفعيل الإخفاء التلقائي. */
  pinned: boolean;
}

/** تفضيل اللوحات العام للمشروع، محفوظ محليا. */
export interface PanelLayoutPrefs {
  /** المفتاح العام لوضع الإخفاء التلقائي (الوضع الاحترافي). */
  autoHide: boolean;
  panels: Record<PanelId, PanelPref>;
  /** عرض منطقة الحافة التي تُفعّل الكشف بالبكسل (المطلوب ١٢–١٦). */
  edgeZonePx: number;
  /** زمن بقاء المؤشر في الحافة قبل الظهور، لمنع الفتح العرضي عند العبور. */
  revealDelayMs: number;
  /** مهلة الإخفاء بعد الابتعاد، لمنع الوميض بين الحافة واللوحة. */
  hideDelayMs: number;
}

export const PANEL_LAYOUT_STORAGE_KEY = 'tashjeer:panels:v1';

/**
 * عرض منطقة الحافة بالبكسل.
 *
 * ١٤px: داخل المدى المطلوب (١٢–١٦)، صغير بما يكفي ألا يسرق نقرات اللوحة،
 * وكبير بما يكفي أن تُلمس بالإصبع على اللوح.
 */
export const DEFAULT_EDGE_ZONE_PX = 14;

/** ٩٠ms: أسرع من أن يُحسّ انتظارًا، وأبطأ من عبور عابر للماوس. */
export const DEFAULT_REVEAL_DELAY_MS = 90;

/** ٤٢٠ms: تكفي لنقل المؤشر من الحافة إلى داخل اللوحة بلا وميض. */
export const DEFAULT_HIDE_DELAY_MS = 420;

/** أسماء اللوحات كما تظهر في الإعدادات وقائمة اللوحات. */
export const PANEL_LABELS: Record<PanelId, string> = {
  toolbar: 'شريط الأدوات',
  navigator: 'شريط الآيات والصفحات',
  breadcrumb: 'شريط سياق التحديد',
  properties: 'اللوحة اليمنى (الخصائص والتصفية)',
  relations: 'لوحة العلاقات',
  variants: 'اللوحة اليسرى (الاختلافات)',
  statusbar: 'شريط الحالة',
  appnav: 'قائمة التطبيق الجانبية',
};

/**
 * حافة كل لوحة، أو null لمن لا حافة لها.
 *
 * `breadcrumb` شريط رفيع داخل العمود المركزي و`relations` متفرعة داخل لوحة
 * الخصائص: إخفاؤهما يوفّر مساحة لكن لا معنى لكشفهما من حافة مستقلة، فهما
 * يُخفيان ويُظهران من قائمة اللوحات والإعدادات. و`appnav` له سلوك خاص:
 * ينطوي إلى شريط رفيع يتمدد فوق المحتوى عند المرور عليه.
 */
export const PANEL_EDGE: Record<PanelId, PanelEdge | null> = {
  toolbar: 'top',
  navigator: 'top',
  breadcrumb: null,
  properties: 'start',
  relations: null,
  variants: 'end',
  statusbar: 'bottom',
  appnav: null,
};

/**
 * لوحات تُرسم فوقية **وإن لم تكن لها حافة** تكشفها، لأن لها آلية كشف خاصة.
 *
 * `appnav` تنطوي إلى شريط أيقونات رفيع (٥٦px) يتمدد فوق المحتوى عند المرور
 * عليه أو نقره — فهي «فوقية» بمعنى أنها لا تأخذ عرضها الكامل من المحتوى، ولا
 * تحتاج حافة شاشة لأن شريطها نفسه هو المقبض. أما `breadcrumb` و`relations`
 * فبلا آلية كهذه، فتبقيان في التدفق لأن طبقة لا تُكشف طبقةٌ ضائعة.
 */
export const PANEL_OVERLAY_WITHOUT_EDGE: ReadonlySet<PanelId> = new Set<PanelId>(['appnav']);

/** كل اللوحات بترتيب عرض ثابت في واجهات الضبط. */
export const PANEL_IDS: PanelId[] = [
  'toolbar',
  'navigator',
  'breadcrumb',
  'properties',
  'relations',
  'variants',
  'statusbar',
  'appnav',
];

/** التفضيل الافتراضي: كل اللوحات ظاهرة ومثبتة، ووضع الإخفاء مطفأ. */
export const DEFAULT_PANEL_LAYOUT: PanelLayoutPrefs = {
  autoHide: false,
  edgeZonePx: DEFAULT_EDGE_ZONE_PX,
  revealDelayMs: DEFAULT_REVEAL_DELAY_MS,
  hideDelayMs: DEFAULT_HIDE_DELAY_MS,
  panels: {
    toolbar: { visible: true, pinned: true },
    navigator: { visible: true, pinned: true },
    breadcrumb: { visible: true, pinned: true },
    properties: { visible: true, pinned: true },
    relations: { visible: true, pinned: true },
    variants: { visible: true, pinned: true },
    statusbar: { visible: true, pinned: true },
    appnav: { visible: true, pinned: true },
  },
};

// ==================== الحالة الفعلية ====================

/** وضع اللوحة الفعلي في التخطيط. */
export type PanelPlacement = 'hidden' | 'flow' | 'overlay';

/**
 * أين تُرسم اللوحة الآن؟
 *
 * هذا هو القرار الوحيد الذي تحتاجه كل الواجهات، وهو ناتج ثلاث قيم فقط:
 * ظهور اللوحة، والمفتاح العام، والتثبيت.
 */
export function panelPlacement(prefs: PanelLayoutPrefs, id: PanelId): PanelPlacement {
  const panel = prefs.panels[id] ?? DEFAULT_PANEL_LAYOUT.panels[id];
  if (!panel.visible) return 'hidden';
  if (!prefs.autoHide || panel.pinned) return 'flow';
  // بلا حافة ولا آلية كشف خاصة: لا معنى لطبقة فوقية لا تُكشف، فتبقى في التدفق.
  if (PANEL_EDGE[id] === null && !PANEL_OVERLAY_WITHOUT_EDGE.has(id)) return 'flow';
  return 'overlay';
}

/** هل اللوحة في التدفق (تأخذ مساحتها)؟ */
export function isPanelInFlow(prefs: PanelLayoutPrefs, id: PanelId): boolean {
  return panelPlacement(prefs, id) === 'flow';
}

/** هل اللوحة طبقة فوقية لا تأخذ مساحة؟ */
export function isPanelOverlay(prefs: PanelLayoutPrefs, id: PanelId): boolean {
  return panelPlacement(prefs, id) === 'overlay';
}

/** هل تظهر اللوحة (في التدفق أو كطبقة)؟ */
export function isPanelShown(prefs: PanelLayoutPrefs, id: PanelId): boolean {
  return panelPlacement(prefs, id) !== 'hidden';
}

/**
 * اللوحات الفوقية على حافة بعينها.
 *
 * الحافة العلوية تكشف شريط الأدوات وشريط الآيات معًا ككتلة واحدة، لأنهما
 * «الشريط العلوي» في عرف المحقق ولأن كشف أحدهما دون الآخر يترك شريطًا
 * عائما بلا معنى.
 */
export function overlayPanelsOnEdge(prefs: PanelLayoutPrefs, edge: PanelEdge): PanelId[] {
  return PANEL_IDS.filter((id) => PANEL_EDGE[id] === edge && isPanelOverlay(prefs, id));
}

/** هل على هذه الحافة ما يُكشف أصلًا؟ (لا معنى لمنطقة حافة فارغة.) */
export function edgeHasOverlay(prefs: PanelLayoutPrefs, edge: PanelEdge): boolean {
  return overlayPanelsOnEdge(prefs, edge).length > 0;
}

/**
 * عرض العمود المركزي المتاح بعد اللوحات المثبتة/الظاهرة في التدفق.
 *
 * يُستعمل في الاختبار للتأكد من أن إخفاء اللوحات يوسّع المحرر فعلا، وفي
 * الواجهة لعرض الأثر بالبكسل قبل التثبيت.
 */
export function reservedSideWidth(
  prefs: PanelLayoutPrefs,
  widths: Partial<Record<PanelId, number>>
): { start: number; end: number } {
  const widthOf = (id: PanelId) => widths[id] ?? 0;
  return {
    start: isPanelInFlow(prefs, 'properties') ? widthOf('properties') : 0,
    end: isPanelInFlow(prefs, 'variants') ? widthOf('variants') : 0,
  };
}

// ==================== التعديل ====================

function withPanel(
  prefs: PanelLayoutPrefs,
  id: PanelId,
  patch: Partial<PanelPref>
): PanelLayoutPrefs {
  const current = prefs.panels[id] ?? DEFAULT_PANEL_LAYOUT.panels[id];
  return { ...prefs, panels: { ...prefs.panels, [id]: { ...current, ...patch } } };
}

/** إظهار/إخفاء لوحة. الإخفاء صريح: لا تكشفه الحافة. */
export function setPanelVisible(
  prefs: PanelLayoutPrefs,
  id: PanelId,
  visible: boolean
): PanelLayoutPrefs {
  return withPanel(prefs, id, { visible });
}

/** قلب ظهور اللوحة. */
export function togglePanelVisible(prefs: PanelLayoutPrefs, id: PanelId): PanelLayoutPrefs {
  const current = prefs.panels[id] ?? DEFAULT_PANEL_LAYOUT.panels[id];
  return setPanelVisible(prefs, id, !current.visible);
}

/**
 * تثبيت اللوحة أو فك تثبيتها.
 *
 * التثبيت يعني «ابقَ ظاهرة وخذ مساحتك»؛ وفكّه مع تفعيل الإخفاء التلقائي
 * يعني «صر طبقة فوقية تُكشف من الحافة». إظهار لوحة مخفية بتثبيتها قرار
 * مقصود: التثبيت وحده لا يُظهر ما أخفاه المستخدم صراحة.
 */
export function setPanelPinned(
  prefs: PanelLayoutPrefs,
  id: PanelId,
  pinned: boolean
): PanelLayoutPrefs {
  return withPanel(prefs, id, { pinned });
}

/** قلب التثبيت. */
export function togglePanelPinned(prefs: PanelLayoutPrefs, id: PanelId): PanelLayoutPrefs {
  const current = prefs.panels[id] ?? DEFAULT_PANEL_LAYOUT.panels[id];
  return setPanelPinned(prefs, id, !current.pinned);
}

/** تفعيل/إطفاء وضع الإخفاء التلقائي العام. */
export function setAutoHide(prefs: PanelLayoutPrefs, autoHide: boolean): PanelLayoutPrefs {
  return { ...prefs, autoHide };
}

/** إظهار كل اللوحات وتثبيتها وإطفاء الإخفاء: «أعد كل شيء كما كان». */
export function resetPanelLayout(): PanelLayoutPrefs {
  return structuredCloneSafe(DEFAULT_PANEL_LAYOUT);
}

/** تفضيل يصلح «وضعًا مصغرا»: الإخفاء مفعّل وكل اللوحات غير مثبتة. */
export function compactPanelLayout(prefs: PanelLayoutPrefs): PanelLayoutPrefs {
  const panels = { ...prefs.panels } as Record<PanelId, PanelPref>;
  for (const id of PANEL_IDS) {
    panels[id] = { visible: true, pinned: false };
  }
  return { ...prefs, autoHide: true, panels };
}

// ==================== منطقة الحافة ====================

export interface PointLike {
  x: number;
  y: number;
}

export interface ViewportLike {
  width: number;
  height: number;
  /** هل الصفحة عربية الاتجاه؟ الحافة «البداية» عندها هي اليمنى. */
  rtl?: boolean;
}

/**
 * أي حافة يلمسها هذا المؤشر؟
 *
 * تُحسب من إحداثيات المؤشر وحجم المنطقة لا من عناصر DOM، فلا تحتاج مناطق
 * شفافة فوق المحتوى تسرق النقرات. الأولوية للزوايا: إن كان المؤشر في
 * الزاوية العليا القريبة من البداية فالأولى حافة البداية (اللوحة الجانبية
 * أكبر وأهم من شريط الأدوات).
 *
 * @returns الحافة، أو null إن كان المؤشر خارج كل مناطق الحواف.
 */
export function edgeZoneForPoint(
  point: PointLike,
  viewport: ViewportLike,
  zonePx: number = DEFAULT_EDGE_ZONE_PX
): PanelEdge | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  if (zonePx <= 0) return null;
  if (viewport.width <= 0 || viewport.height <= 0) return null;

  const rtl = viewport.rtl !== false;
  const atStart = rtl ? point.x >= viewport.width - zonePx : point.x <= zonePx;
  const atEnd = rtl ? point.x <= zonePx : point.x >= viewport.width - zonePx;
  const atTop = point.y <= zonePx;
  const atBottom = point.y >= viewport.height - zonePx;

  if (atStart) return 'start';
  if (atEnd) return 'end';
  if (atTop) return 'top';
  if (atBottom) return 'bottom';
  return null;
}

// ==================== زمن الظهور والإخفاء ====================

/** جدول قابل للحقن حتى يُختبر الزمن بلا متصفح ولا انتظار. */
export interface Scheduler {
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface EdgeRevealOptions {
  revealDelayMs?: number;
  hideDelayMs?: number;
  scheduler?: Scheduler;
  /** تُنادى عند كشف حافة (ظهور اللوحات الفوقية عليها). */
  onReveal: (edge: PanelEdge) => void;
  /** تُنادى عند الإخفاء بعد الابتعاد. */
  onHide: () => void;
}

/**
 * آلة حالة كشف الحواف: بلا وميض وبلا فتح عرضي.
 *
 * القاعدتان:
 *
 *   1. **ظهور مؤجَّل** (`revealDelayMs`): المرور العابر بالحافة لا يفتح شيئًا؛
 *      لا يُكشف إلا من مكث فيها. وأي حركة إلى حافة أخرى تلغي المؤقت السابق.
 *   2. **إخفاء مؤجَّل** (`hideDelayMs`): بين ترك الحافة والدخول في اللوحة
 *      نفسها ثغرة، فالمهلة تمنع الانطفاء في منتصف الحركة. ولمس اللوحة
 *      (`pointerEnterPanel`) يلغي الإخفاء ما دام المؤشر داخلها.
 *
 * والتثبيت يُحترم خارج هذه الآلة: اللوحة المثبتة في التدفق أصلًا فلا تُكشف
 * ولا تُخفى.
 */
export class EdgeRevealController {
  private readonly revealDelayMs: number;
  private readonly hideDelayMs: number;
  private readonly scheduler: Scheduler;
  private readonly onReveal: (edge: PanelEdge) => void;
  private readonly onHide: () => void;

  private revealHandle: unknown = null;
  private hideHandle: unknown = null;
  private pendingEdge: PanelEdge | null = null;
  private revealed: PanelEdge | null = null;
  private insidePanel = false;

  constructor(options: EdgeRevealOptions) {
    this.revealDelayMs = Math.max(0, options.revealDelayMs ?? DEFAULT_REVEAL_DELAY_MS);
    this.hideDelayMs = Math.max(0, options.hideDelayMs ?? DEFAULT_HIDE_DELAY_MS);
    this.scheduler = options.scheduler ?? realScheduler;
    this.onReveal = options.onReveal;
    this.onHide = options.onHide;
  }

  /** الحافة المكشوفة الآن (للقراءة والاختبار). */
  get revealedEdge(): PanelEdge | null {
    return this.revealed;
  }

  /** المؤشر دخل منطقة حافة. */
  pointerEnterEdge(edge: PanelEdge): void {
    this.cancelHide();
    if (this.revealed === edge) {
      this.cancelReveal();
      this.pendingEdge = null;
      return;
    }
    if (this.pendingEdge === edge) return;

    this.cancelReveal();
    this.pendingEdge = edge;
    if (this.revealDelayMs === 0) {
      this.commitReveal();
      return;
    }
    this.revealHandle = this.scheduler.setTimeout(() => this.commitReveal(), this.revealDelayMs);
  }

  /** المؤشر غادر منطقة الحواف كلها. */
  pointerLeaveEdge(): void {
    this.cancelReveal();
    this.pendingEdge = null;
    if (this.revealed === null || this.insidePanel) return;
    this.scheduleHide();
  }

  /** المؤشر دخل اللوحة المكشوفة نفسها: تبقى ما دام فيها. */
  pointerEnterPanel(): void {
    this.insidePanel = true;
    this.cancelHide();
    this.cancelReveal();
  }

  /** المؤشر غادر اللوحة المكشوفة. */
  pointerLeavePanel(): void {
    this.insidePanel = false;
    if (this.revealed === null) return;
    this.scheduleHide();
  }

  /** كشف فوري بالحافة (نقر أو لمس أو زر عائم)، بلا انتظار. */
  revealNow(edge: PanelEdge): void {
    this.cancelHide();
    this.cancelReveal();
    this.pendingEdge = edge;
    this.commitReveal();
  }

  /** إخفاء فوري (Esc أو الضغط على الوضع). */
  hideNow(): void {
    this.cancelReveal();
    this.cancelHide();
    this.pendingEdge = null;
    this.insidePanel = false;
    if (this.revealed !== null) {
      this.revealed = null;
      this.onHide();
    }
  }

  /** تحرير المؤقتات عند فك التركيب. */
  dispose(): void {
    this.cancelReveal();
    this.cancelHide();
    this.pendingEdge = null;
    this.insidePanel = false;
  }

  private commitReveal(): void {
    this.revealHandle = null;
    const edge = this.pendingEdge;
    if (edge === null) return;
    this.revealed = edge;
    this.onReveal(edge);
  }

  private scheduleHide(): void {
    this.cancelHide();
    if (this.hideDelayMs === 0) {
      this.hideNow();
      return;
    }
    this.hideHandle = this.scheduler.setTimeout(() => this.hideNow(), this.hideDelayMs);
  }

  private cancelReveal(): void {
    if (this.revealHandle !== null) {
      this.scheduler.clearTimeout(this.revealHandle);
      this.revealHandle = null;
    }
  }

  private cancelHide(): void {
    if (this.hideHandle !== null) {
      this.scheduler.clearTimeout(this.hideHandle);
      this.hideHandle = null;
    }
  }
}

// ==================== التخزين ====================

/**
 * يطبّع تفضيلا محفوظًا (أو جزءًا منه) على الافتراضي.
 *
 * متسامح مع كل نقص: لوحة غائبة تأخذ افتراضها، ورقم حساسية غير صالح يعود إلى
 * مداه الآمن. فلا يكسر التخزينُ المحررَ أبدًا.
 */
export function normalizePanelLayout(value: unknown): PanelLayoutPrefs {
  const raw = (value ?? {}) as Partial<PanelLayoutPrefs>;
  const rawPanels = (raw.panels ?? {}) as Partial<Record<PanelId, Partial<PanelPref>>>;

  const panels = {} as Record<PanelId, PanelPref>;
  for (const id of PANEL_IDS) {
    const fallback = DEFAULT_PANEL_LAYOUT.panels[id];
    const stored = rawPanels[id];
    panels[id] = {
      visible: typeof stored?.visible === 'boolean' ? stored.visible : fallback.visible,
      pinned: typeof stored?.pinned === 'boolean' ? stored.pinned : fallback.pinned,
    };
  }

  return {
    autoHide: typeof raw.autoHide === 'boolean' ? raw.autoHide : DEFAULT_PANEL_LAYOUT.autoHide,
    panels,
    edgeZonePx: clampNumber(raw.edgeZonePx, 4, 48, DEFAULT_EDGE_ZONE_PX),
    revealDelayMs: clampNumber(raw.revealDelayMs, 0, 1000, DEFAULT_REVEAL_DELAY_MS),
    hideDelayMs: clampNumber(raw.hideDelayMs, 0, 3000, DEFAULT_HIDE_DELAY_MS),
  };
}

/** يقرأ التفضيل المحفوظ، أو الافتراضي في SSR وأول استخدام. */
export function readPanelLayout(): PanelLayoutPrefs {
  if (!hasStorage()) return resetPanelLayout();
  try {
    const raw = window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);
    // أول استخدام بعد الترقية: يُحترم ما أخفاه المستخدم في التفضيل القديم.
    if (!raw) return seedFromLegacyWorkspace(resetPanelLayout());
    return normalizePanelLayout(JSON.parse(raw));
  } catch {
    return seedFromLegacyWorkspace(resetPanelLayout());
  }
}

/** يحفظ التفضيل. */
export function savePanelLayout(prefs: PanelLayoutPrefs): PanelLayoutPrefs {
  const normalized = normalizePanelLayout(prefs);
  if (hasStorage()) {
    try {
      window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // امتلاء التخزين لا يعطل المحرر؛ التفضيل يبقى في الذاكرة لهذه الجلسة.
    }
  }
  return normalized;
}

/**
 * ترحيل لطيف: تفضيل اللوحات القديم في مخزن مساحة عمل المحرر.
 *
 * قبل هذه الحزمة كان ظهور لوحتي الخصائص والاختلافات محفوظًا في
 * `tashjeer:editor-workspace:v1`. فمن كان قد أخفى إحداهما لا يجدها عادت
 * ظاهرة بعد الترقية.
 */
export function migrateLegacyPanelVisibility(): Partial<Record<PanelId, boolean>> {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem('tashjeer:editor-workspace:v1');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { showPropertiesPanel?: unknown; showVariantsPanel?: unknown };
    const result: Partial<Record<PanelId, boolean>> = {};
    if (typeof parsed?.showPropertiesPanel === 'boolean') result.properties = parsed.showPropertiesPanel;
    if (typeof parsed?.showVariantsPanel === 'boolean') result.variants = parsed.showVariantsPanel;
    return result;
  } catch {
    return {};
  }
}

/** يطبّق الترحيل اللطيف على تفضيل افتراضي. */
export function seedFromLegacyWorkspace(prefs: PanelLayoutPrefs): PanelLayoutPrefs {
  const legacy = migrateLegacyPanelVisibility();
  let next = prefs;
  for (const [id, visible] of Object.entries(legacy) as Array<[PanelId, boolean]>) {
    next = setPanelVisible(next, id, visible);
  }
  return next;
}

/** عدد اللوحات المخفية صراحة، لعرضه في زر الوضع. */
export function countHiddenPanels(prefs: PanelLayoutPrefs): number {
  return PANEL_IDS.filter((id) => !(prefs.panels[id]?.visible ?? true)).length;
}

/** عدد اللوحات الفوقية (التي ستُكشف من الحواف) — أثر الوضع على المساحة. */
export function countOverlayPanels(prefs: PanelLayoutPrefs): number {
  return PANEL_IDS.filter((id) => isPanelOverlay(prefs, id)).length;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// إخفاء وإظهار اللوحات - Panel Auto-Hide
// FR-ED-12: وضع إخفاء وإظهار النوافذ والأشرطة
//
// الميزات:
//   - Auto-hide بالحواف (الماوس يقترب من الحافة فتظهر اللوحة)
//   - Overlay (اللوحة تظهر فوق المحتوى دون إزاحة)
//   - Pin/Unpin (تثبيت اللوحة)
//   - حفظ التفضيلات

// ==================== أنواع البيانات ====================

/** موقع اللوحة. */
export type PanelPosition = 'TOP' | 'RIGHT' | 'LEFT' | 'BOTTOM';

/** حالة اللوحة. */
export type PanelState = 'VISIBLE' | 'HIDDEN' | 'AUTO_HIDE' | 'PINNED';

/** إعدادات لوحة واحدة. */
export interface PanelConfig {
  id: string;
  label: string;
  position: PanelPosition;
  state: PanelState;
  width?: number;
  height?: number;
  /** مسافة التفعيل بالبكسل (لـ auto-hide). */
  activationDistance: number;
  /** مدة التأخير قبل الإخفاء (مللي ثانية). */
  hideDelay: number;
}

/** إعدادات كل اللوحات. */
export interface PanelsConfig {
  panels: PanelConfig[];
  /** هل وضع التركيز مفعّل (إخفاء كل اللوحات)؟ */
  focusMode: boolean;
}

// ==================== الإعدادات الافتراضية ====================

/** إعدادات اللوحات الافتراضية. */
export const DEFAULT_PANELS_CONFIG: PanelsConfig = {
  focusMode: false,
  panels: [
    {
      id: 'toolbar',
      label: 'شريط الأدوات',
      position: 'TOP',
      state: 'VISIBLE',
      height: 60,
      activationDistance: 20,
      hideDelay: 500,
    },
    {
      id: 'properties',
      label: 'لوحة الخصائص',
      position: 'RIGHT',
      state: 'VISIBLE',
      width: 320,
      activationDistance: 30,
      hideDelay: 500,
    },
    {
      id: 'variants',
      label: 'لوحة الاختلافات',
      position: 'LEFT',
      state: 'VISIBLE',
      width: 340,
      activationDistance: 30,
      hideDelay: 500,
    },
    {
      id: 'relations',
      label: 'لوحة العلاقات',
      position: 'RIGHT',
      state: 'AUTO_HIDE',
      width: 280,
      activationDistance: 30,
      hideDelay: 800,
    },
  ],
};

// ==================== دوال الحالة ====================

/**
 * يتحقق من أن اللوحة مرئية.
 */
export function isPanelVisible(config: PanelConfig): boolean {
  return config.state === 'VISIBLE' || config.state === 'PINNED';
}

/**
 * يتحقق من أن اللوحة في وضع الإخفاء التلقائي.
 */
export function isPanelAutoHide(config: PanelConfig): boolean {
  return config.state === 'AUTO_HIDE';
}

/**
 * يتحقق من أن اللوحة مثبّتة.
 */
export function isPanelPinned(config: PanelConfig): boolean {
  return config.state === 'PINNED';
}

/**
 * يبدّل حالة اللوحة بين VISIBLE و HIDDEN.
 */
export function togglePanel(config: PanelConfig): PanelConfig {
  if (config.state === 'VISIBLE' || config.state === 'PINNED') {
    return { ...config, state: 'HIDDEN' };
  }
  return { ...config, state: 'VISIBLE' };
}

/**
 * يثبّت اللوحة أو يلغي تثبيتها.
 */
export function togglePinPanel(config: PanelConfig): PanelConfig {
  if (config.state === 'PINNED') {
    return { ...config, state: 'AUTO_HIDE' };
  }
  return { ...config, state: 'PINNED' };
}

/**
 * يضبط حالة اللوحة.
 */
export function setPanelState(config: PanelConfig, state: PanelState): PanelConfig {
  return { ...config, state };
}

// ==================== دوال الإعدادات ====================

/**
 * يجد إعدادات لوحة بالـ ID.
 */
export function findPanelConfig(
  config: PanelsConfig,
  panelId: string
): PanelConfig | undefined {
  return config.panels.find((p) => p.id === panelId);
}

/**
 * يحدّث إعدادات لوحة.
 */
export function updatePanelConfig(
  config: PanelsConfig,
  panelId: string,
  updates: Partial<PanelConfig>
): PanelsConfig {
  return {
    ...config,
    panels: config.panels.map((p) =>
      p.id === panelId ? { ...p, ...updates } : p
    ),
  };
}

/**
 * يبدّل وضع التركيز (إخفاء/إظهار كل اللوحات).
 */
export function toggleFocusMode(config: PanelsConfig): PanelsConfig {
  return { ...config, focusMode: !config.focusMode };
}

/**
 * يخفي كل اللوحات (وضع التركيز).
 */
export function hideAllPanels(config: PanelsConfig): PanelsConfig {
  return {
    ...config,
    panels: config.panels.map((p) => ({
      ...p,
      state: p.state === 'PINNED' ? p.state : 'HIDDEN',
    })),
  };
}

/**
 * يظهر كل اللوحات.
 */
export function showAllPanels(config: PanelsConfig): PanelsConfig {
  return {
    ...config,
    panels: config.panels.map((p) => ({
      ...p,
      state: p.state === 'HIDDEN' ? 'VISIBLE' : p.state,
    })),
  };
}

// ==================== دوال Auto-Hide ====================

/**
 * يحسب هل يجب إظهار اللوحة بناءً على موقع الماوس.
 */
export function shouldShowAutoHidePanel(
  config: PanelConfig,
  mousePosition: { x: number; y: number },
  viewportSize: { width: number; height: number }
): boolean {
  if (config.state !== 'AUTO_HIDE') return false;

  const distance = config.activationDistance;

  switch (config.position) {
    case 'TOP':
      return mousePosition.y <= distance;
    case 'BOTTOM':
      return mousePosition.y >= viewportSize.height - distance;
    case 'LEFT':
      return mousePosition.x <= distance;
    case 'RIGHT':
      return mousePosition.x >= viewportSize.width - distance;
    default:
      return false;
  }
}

/**
 * يحسب موقع اللوحة عند الإظهار (Overlay).
 */
export function getPanelOverlayStyle(
  config: PanelConfig
): React.CSSProperties {
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 50,
  };

  switch (config.position) {
    case 'TOP':
      style.top = 0;
      style.left = 0;
      style.right = 0;
      style.height = config.height;
      break;
    case 'BOTTOM':
      style.bottom = 0;
      style.left = 0;
      style.right = 0;
      style.height = config.height;
      break;
    case 'LEFT':
      style.top = 0;
      style.left = 0;
      style.bottom = 0;
      style.width = config.width;
      break;
    case 'RIGHT':
      style.top = 0;
      style.right = 0;
      style.bottom = 0;
      style.width = config.width;
      break;
  }

  return style;
}

// ==================== التخزين والاسترجاع ====================

const STORAGE_KEY = 'tashjir:panels-config';

/**
 * يحفظ إعدادات اللوحات في التخزين المحلي.
 */
export function savePanelsConfig(config: PanelsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save panels config:', error);
  }
}

/**
 * يحمّل إعدادات اللوحات من التخزين المحلي.
 */
export function loadPanelsConfig(): PanelsConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load panels config:', error);
  }
  return DEFAULT_PANELS_CONFIG;
}

/**
 * يعيد الإعدادات إلى الافتراضية.
 */
export function resetPanelsConfig(): PanelsConfig {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_PANELS_CONFIG;
}

// ==================== اختصارات لوحة المفاتيح ====================

/** خريطة الاختصارات للتبديل بين اللوحات. */
export const PANEL_SHORTCUTS: Record<string, string> = {
  'Ctrl+Shift+T': 'toolbar',
  'Ctrl+Shift+P': 'properties',
  'Ctrl+Shift+V': 'variants',
  'Ctrl+Shift+R': 'relations',
  'Ctrl+Shift+F': 'focus-mode',
};

/**
 * يحلل اختصار لوحة المفاتيح ويعيد ID اللوحة.
 */
export function parsePanelShortcut(key: string, ctrl: boolean, shift: boolean): string | null {
  if (!ctrl || !shift) return null;

  const shortcut = `Ctrl+Shift+${key.toUpperCase()}`;
  return PANEL_SHORTCUTS[shortcut] || null;
}

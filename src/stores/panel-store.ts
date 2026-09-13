// مخزن اللوحات ووضع الإخفاء - Panel Layout Store (FR-ED-12، NFR-03)
//
// حالة واحدة لكل المشروع: أي اللوحات تظهر، وأيها مثبتة، وهل وضع الإخفاء
// التلقائي مفعّل. تُحفظ محليًا فتُستعاد في الجلسة التالية (القرار المحسوم:
// تفضيل عام للمشروع مع تثبيت per-panel).
//
// وفيه حالتان **زائلتان** لا تُحفظان: الحافة المكشوفة الآن، واللوحة الممسوكة
// بزر عائم. فلو حُفظتا لعادت الجلسة التالية بلوحة مفتوحة لا سبب لها.
//
// كل القرار في `lib/ui/panel-layout` (دوال نقية مختبَرة)؛ هذا المخزن يحفظ
// الحالة ويحفظها في التخزين فقط، فلا يتكرر المنطق في موضعين.

import { create } from 'zustand';
import {
  compactPanelLayout,
  normalizePanelLayout,
  PANEL_EDGE,
  PANEL_IDS,
  panelPlacement,
  readPanelLayout,
  resetPanelLayout,
  savePanelLayout,
  setAutoHide as setAutoHidePref,
  setPanelPinned as setPanelPinnedPref,
  setPanelVisible as setPanelVisiblePref,
  togglePanelPinned as togglePanelPinnedPref,
  togglePanelVisible as togglePanelVisiblePref,
  type PanelEdge,
  type PanelId,
  type PanelLayoutPrefs,
  type PanelPlacement,
} from '@/lib/ui/panel-layout';

const INITIAL_PREFS = readPanelLayout();

export interface PanelState {
  /** التفضيل المحفوظ. */
  prefs: PanelLayoutPrefs;
  /** الحافة المكشوفة الآن بحركة المؤشر/اللمس (زائل). */
  revealedEdge: PanelEdge | null;
  /** لوحة كُشفت من زر عائم أو نقرة، فتبقى مفتوحة حتى تُغلق (زائل). */
  heldPanel: PanelId | null;

  // ---------- قراءة مشتقة ----------
  placement: (id: PanelId) => PanelPlacement;
  isOpen: (id: PanelId) => boolean;

  // ---------- الوضع العام ----------
  setAutoHide: (value: boolean) => void;
  toggleAutoHide: () => void;
  /** «وضع الشاشة الصغيرة»: إخفاء مفعّل وكل اللوحات ظاهرة غير مثبتة. */
  compactLayout: () => void;
  resetLayout: () => void;

  // ---------- لوحة بعينها ----------
  setPanelVisible: (id: PanelId, visible: boolean) => void;
  togglePanelVisible: (id: PanelId) => void;
  setPanelPinned: (id: PanelId, pinned: boolean) => void;
  togglePanelPinned: (id: PanelId) => void;

  // ---------- حساسية الحواف ----------
  setSensitivity: (
    patch: Partial<Pick<PanelLayoutPrefs, 'edgeZonePx' | 'revealDelayMs' | 'hideDelayMs'>>
  ) => void;

  // ---------- الكشف الزائل ----------
  revealEdge: (edge: PanelEdge | null) => void;
  holdPanel: (id: PanelId | null) => void;
  closeAllRevealed: () => void;
}

export const usePanelStore = create<PanelState>((set, get) => {
  /** يكتب التفضيل في التخزين ويحدّث الحالة. */
  const commit = (next: PanelLayoutPrefs) => set({ prefs: savePanelLayout(next) });

  return {
    prefs: INITIAL_PREFS,
    revealedEdge: null,
    heldPanel: null,

    placement: (id) => panelPlacement(get().prefs, id),

    /**
     * هل اللوحة مفتوحة الآن (مرئية فعلًا على الشاشة)؟
     *
     * في التدفق: ظاهرة دائمًا. كطبقة فوقية: ظاهرة إن كُشفت حافتها أو كانت هي
     * اللوحة الممسوكة بزر عائم. ومشتقة من التفضيل، فلا يمكن أن تتعارض معه.
     */
    isOpen: (id) => {
      const state = get();
      const placement = panelPlacement(state.prefs, id);
      if (placement === 'hidden') return false;
      if (placement === 'flow') return true;
      if (state.heldPanel === id) return true;
      const edge = PANEL_EDGE[id];
      return edge !== null && state.revealedEdge === edge;
    },

    setAutoHide: (value) => commit(setAutoHidePref(get().prefs, value)),
    toggleAutoHide: () => commit(setAutoHidePref(get().prefs, !get().prefs.autoHide)),
    compactLayout: () => commit(compactPanelLayout(get().prefs)),
    resetLayout: () => commit(resetPanelLayout()),

    setPanelVisible: (id, visible) => commit(setPanelVisiblePref(get().prefs, id, visible)),
    togglePanelVisible: (id) => commit(togglePanelVisiblePref(get().prefs, id)),
    setPanelPinned: (id, pinned) => commit(setPanelPinnedPref(get().prefs, id, pinned)),
    togglePanelPinned: (id) => commit(togglePanelPinnedPref(get().prefs, id)),

    setSensitivity: (patch) => commit(normalizePanelLayout({ ...get().prefs, ...patch })),

    revealEdge: (edge) => set({ revealedEdge: edge, heldPanel: null }),
    holdPanel: (id) => set({ heldPanel: id, revealedEdge: null }),
    closeAllRevealed: () => set({ revealedEdge: null, heldPanel: null }),
  };
});

/** كل اللوحات بترتيب عرض ثابت، لقوائم الضبط. */
export const ALL_PANEL_IDS: PanelId[] = PANEL_IDS;

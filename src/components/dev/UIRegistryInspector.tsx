'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import type { FeatureRegistryEntry } from '@/ui/feature-registry';
import type { UIRegistryEntry } from '@/ui/ui-registry';
import {
  highlightToneFor,
  isInsideBridge,
  placeBadge,
  type Box,
  type HighlightTone,
} from './inspector-geometry';

/**
 * Interactive UI ID Inspector.
 *
 * Default state: off. Nothing is rendered, no listeners are attached, and the
 * Registry JSON is not loaded. When on, at most two badges exist at a time: one
 * for the element under the pointer (or keyboard focus) and one for the pinned
 * selection. Badges and highlights live in a fixed layer outside the layout and
 * never mutate the application's DOM, styles, or data.
 *
 * Controls:
 * - Alt+Shift+I toggles the Inspector.
 * - Hover a registered element: its badge and a temporary outline appear.
 * - Click the badge (or Alt+click the element): pins it, marks it red, and
 *   opens its details. The click never reaches the element's own action.
 * - Alt+Shift+Enter pins the hovered or keyboard-focused element.
 * - Escape clears the pinned selection.
 */

const UI_ID_ATTRIBUTE = 'data-ui-id';
const NOT_AVAILABLE = 'غير متاح';

/** A registered element the Inspector is following. */
interface Tracked {
  element: HTMLElement;
  id: string;
  instance: string | null;
}

interface HoverTracked extends Tracked {
  source: 'pointer' | 'keyboard';
}

interface Layer {
  element: HTMLElement;
  id: string;
  instance: string | null;
  box: Box;
  tone: HighlightTone;
  inView: boolean;
}

interface View {
  hover: Layer | null;
  pinned: Layer | null;
}

const EMPTY_VIEW: View = { hover: null, pinned: null };

interface RegistrySnapshot {
  entries: ReadonlyMap<string, UIRegistryEntry>;
  features: ReadonlyMap<string, FeatureRegistryEntry>;
}

const PINNED_STYLE: Record<HighlightTone, CSSProperties> = {
  fill: {
    backgroundColor: 'rgba(220, 38, 38, 0.38)',
    boxShadow: '0 0 0 2px #dc2626, 0 0 0 4px rgba(255, 255, 255, 0.9)',
  },
  field: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    boxShadow: '0 0 0 3px #dc2626',
  },
  tab: {
    backgroundColor: 'rgba(220, 38, 38, 0.24)',
    boxShadow: 'inset 0 -4px 0 #dc2626, 0 0 0 2px #dc2626',
  },
  container: {
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    outline: '3px dashed #dc2626',
    outlineOffset: '2px',
  },
};

const HOVER_STYLE: CSSProperties = {
  backgroundColor: 'rgba(2, 132, 199, 0.08)',
  boxShadow: 'inset 0 0 0 2px #0284c7',
};

function writeInspectorQuery(enabled: boolean) {
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set('uiInspector', '1');
  else url.searchParams.delete('uiInspector');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** The nearest registered element for a node, or null for Inspector UI and the document root. */
function registeredElementFor(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element) || node.closest('[data-ui-inspector-root]')) return null;
  const element = node.closest<HTMLElement>(`[${UI_ID_ATTRIBUTE}]`);
  if (!element || element === document.documentElement) return null;
  return element;
}

function instanceOf(element: Element): string | null {
  return (
    element.getAttribute('data-ui-instance') ??
    element.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ??
    null
  );
}

function trackedFor(element: HTMLElement): Tracked | null {
  const id = element.getAttribute(UI_ID_ATTRIBUTE);
  if (!id) return null;
  return { element, id, instance: instanceOf(element) };
}

function readBox(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function isRenderable(element: HTMLElement): boolean {
  if (typeof element.checkVisibility === 'function' && !element.checkVisibility({ visibilityProperty: true })) {
    return false;
  }
  const box = readBox(element);
  return box.width > 0 && box.height > 0;
}

/** A tracked element is valid while it is still connected, keeps its ID, and is rendered. */
function isStillValid(tracked: Tracked): boolean {
  return (
    tracked.element.isConnected &&
    tracked.element.getAttribute(UI_ID_ATTRIBUTE) === tracked.id &&
    isRenderable(tracked.element)
  );
}

function toLayer(tracked: Tracked | null): Layer | null {
  if (!tracked) return null;
  const { element } = tracked;
  const box = readBox(element);
  return {
    element,
    id: tracked.id,
    instance: tracked.instance,
    box,
    tone: highlightToneFor({
      tag: element.tagName,
      role: element.getAttribute('role'),
      type: element.getAttribute('type'),
    }),
    inView:
      box.top + box.height >= 0 &&
      box.top <= window.innerHeight &&
      box.left + box.width >= 0 &&
      box.left <= window.innerWidth,
  };
}

function sameBox(a: Box, b: Box): boolean {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function sameLayer(a: Layer | null, b: Layer | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.element === b.element &&
    a.id === b.id &&
    a.instance === b.instance &&
    a.tone === b.tone &&
    a.inView === b.inView &&
    sameBox(a.box, b.box)
  );
}

function sameView(a: View, b: View): boolean {
  return sameLayer(a.hover, b.hover) && sameLayer(a.pinned, b.pinned);
}

function matchesFocusVisible(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  try {
    return node.matches(':focus-visible');
  } catch {
    return false;
  }
}

/**
 * A badge positioned from its measured size. Its position is written directly
 * to the DOM so the layout effect runs before paint and React never fights it.
 */
function InspectorBadge({
  layer,
  variant,
  name,
}: {
  layer: Layer;
  variant: 'hover' | 'pinned';
  name: string | null;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const position = placeBadge(
      layer.box,
      { width: node.offsetWidth, height: node.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight }
    );
    node.style.left = `${position.left}px`;
    node.style.top = `${position.top}px`;
  });

  const label = `${layer.id}${name ? ` — ${name}` : ''}${layer.instance ? ` · ${layer.instance}` : ''}`;
  const tone = variant === 'pinned' ? 'border-red-200 bg-red-700 text-white' : 'border-fuchsia-200 bg-fuchsia-700/95 text-white';

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      data-ui-id="A731"
      data-ui-inspector-badge
      data-ui-badge-for={layer.id}
      data-ui-badge-layer={variant}
      dir="ltr"
      title={`${label} — click to pin and inspect (Escape clears)`}
      aria-label={`Inspect ${label}`}
      className={`pointer-events-auto fixed inline-flex max-w-[min(20rem,calc(100vw-1rem))] items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] leading-none shadow-md ${tone}`}
    >
      <span className="font-mono font-bold">{layer.id}</span>
      {name && <span className="min-w-0 truncate font-normal opacity-95">{name}</span>}
    </button>
  );
}

function Highlight({ layer, variant }: { layer: Layer; variant: 'hover' | 'pinned' }) {
  const { box } = layer;
  const toneStyle = variant === 'pinned' ? PINNED_STYLE[layer.tone] : HOVER_STYLE;
  return (
    <div
      aria-hidden="true"
      data-ui-inspector-highlight={variant}
      data-ui-inspector-tone={variant === 'pinned' ? layer.tone : undefined}
      className="pointer-events-none fixed rounded-[2px]"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, ...toneStyle }}
    />
  );
}

/**
 * Optional, production-safe inspector. It renders nothing unless enabled by
 * ?uiInspector=1 or Alt+Shift+I. Registry JSON is loaded on demand.
 */
export function UIRegistryInspector() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState<View>(EMPTY_VIEW);
  const [registry, setRegistry] = useState<RegistrySnapshot | null>(null);
  const [registryLoadFailed, setRegistryLoadFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const hoverRef = useRef<HoverTracked | null>(null);
  const pinnedRef = useRef<Tracked | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);

  // Recomputes only the hovered and pinned elements. Nothing else on the page is measured.
  const refresh = useCallback(() => {
    if (hoverRef.current && !isStillValid(hoverRef.current)) hoverRef.current = null;
    if (pinnedRef.current && !isStillValid(pinnedRef.current)) pinnedRef.current = null;
    const next: View = { hover: toLayer(hoverRef.current), pinned: toLayer(pinnedRef.current) };
    setView((previous) => (sameView(previous, next) ? previous : next));
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      refresh();
    });
  }, [refresh]);

  const setHover = useCallback(
    (element: HTMLElement | null, source: HoverTracked['source']) => {
      const current = hoverRef.current;
      if (element === null) {
        if (!current) return;
        hoverRef.current = null;
      } else {
        if (current?.element === element && current.source === source) return;
        const tracked = trackedFor(element);
        hoverRef.current = tracked ? { ...tracked, source } : null;
      }
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  /**
   * Resolves the element under a pointer position. Crossing the small gap
   * between an element and its badge keeps the current target, so the badge
   * stays clickable. Moving onto a different registered element switches at once.
   */
  const applyPointerTarget = useCallback(
    (node: EventTarget | null, x: number, y: number) => {
      if (node instanceof Element && node.closest('[data-ui-inspector-badge]')) return;
      const hit = registeredElementFor(node);
      const current = hoverRef.current;
      if (current?.source === 'pointer' && hit !== current.element && current.element.isConnected) {
        const bridging = isInsideBridge(readBox(current.element), x, y);
        if (bridging && (!hit || hit.contains(current.element))) return;
      }
      setHover(hit, 'pointer');
    },
    [setHover]
  );

  const pin = useCallback(
    (element: HTMLElement) => {
      const tracked = trackedFor(element);
      if (!tracked) return;
      pinnedRef.current = tracked;
      setCopyStatus('');
      refresh();
    },
    [refresh]
  );

  const clearPinned = useCallback(() => {
    if (!pinnedRef.current) return;
    pinnedRef.current = null;
    setCopyStatus('');
    refresh();
  }, [refresh]);

  const clearAll = useCallback(() => {
    hoverRef.current = null;
    pinnedRef.current = null;
    pointerRef.current = null;
    setView(EMPTY_VIEW);
    setCopyStatus('');
  }, []);

  const setInspectorEnabled = useCallback(
    (next: boolean) => {
      setEnabled(next);
      writeInspectorQuery(next);
      if (!next) clearAll();
    },
    [clearAll]
  );

  // A query parameter deliberately works in production builds and on Vercel
  // Preview. The keyboard shortcut is also available when the overlay is off.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('uiInspector') === '1') {
      setEnabled(true);
    }
  }, []);

  // Client-side navigation removes the page that held the pinned selection.
  // Clearing here guarantees no badge or highlight outlives its page.
  useEffect(() => {
    clearAll();
  }, [pathname, clearAll]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.code === 'KeyI' || event.key.toLowerCase() === 'i') && event.altKey && event.shiftKey) {
        event.preventDefault();
        setInspectorEnabled(!enabled);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, setInspectorEnabled]);

  // Keep the multi-megabyte registry out of normal page loads. It is fetched
  // only when a user explicitly turns the Inspector on.
  useEffect(() => {
    if (!enabled) {
      setRegistry(null);
      setRegistryLoadFailed(false);
      return;
    }

    let cancelled = false;
    void Promise.all([import('@/ui/ui-registry'), import('@/ui/feature-registry')])
      .then(([uiRegistry, featureRegistry]) => {
        if (cancelled) return;
        setRegistry({
          entries: new Map(uiRegistry.UI_REGISTRY.map((entry) => [entry.id, entry])),
          features: new Map(featureRegistry.FEATURE_REGISTRY.map((entry) => [entry.id, entry])),
        });
      })
      .catch(() => {
        if (!cancelled) setRegistryLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Pointer, keyboard, focus, viewport and DOM listeners exist only while enabled.
  useEffect(() => {
    if (!enabled) return;

    // Capture phase: the badge and Alt+click are consumed before the application sees them.
    const onClickCapture = (event: MouseEvent) => {
      const node = event.target;
      const badge = node instanceof Element ? node.closest('[data-ui-inspector-badge]') : null;
      if (badge) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const layer = badge.getAttribute('data-ui-badge-layer') === 'pinned' ? pinnedRef.current : hoverRef.current;
        if (layer?.element.isConnected) pin(layer.element);
        return;
      }

      // Alt+click inspects the registered control without invoking its action.
      if (!event.altKey) return;
      const element = registeredElementFor(node);
      if (!element) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pin(element);
    };

    // Badge pointer/mouse presses must not reach the element beneath the badge.
    const swallowBadgePress = (event: Event) => {
      const node = event.target;
      if (!(node instanceof Element) || !node.closest('[data-ui-inspector-badge]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      applyPointerTarget(event.target, event.clientX, event.clientY);
    };

    const onMouseOut = (event: MouseEvent) => {
      // A null relatedTarget means the pointer left the browser window.
      if (event.relatedTarget !== null) return;
      pointerRef.current = null;
      if (hoverRef.current?.source === 'pointer') setHover(null, 'pointer');
    };

    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (!(event.altKey && event.shiftKey && event.key === 'Enter')) return;
      const element = hoverRef.current?.element ?? registeredElementFor(document.activeElement);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      pin(element);
    };

    // Escape clears only the Inspector's pinned selection. The event is not consumed,
    // so the editor's own Escape handling keeps working unchanged.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearPinned();
    };

    const onFocusIn = (event: FocusEvent) => {
      const element = registeredElementFor(event.target);
      if (!element || !matchesFocusVisible(event.target)) return;
      setHover(element, 'keyboard');
    };

    const onFocusOut = (event: FocusEvent) => {
      const current = hoverRef.current;
      if (current?.source === 'keyboard' && current.element === event.target) setHover(null, 'keyboard');
    };

    const onViewportChange = () => {
      // Scrolling moves elements under a still pointer, so re-resolve the target from its last position.
      const pointer = pointerRef.current;
      if (pointer && hoverRef.current?.source === 'pointer') {
        applyPointerTarget(document.elementFromPoint(pointer.x, pointer.y), pointer.x, pointer.y);
      }
      scheduleRefresh();
    };

    const observer = new MutationObserver((records) => {
      const appMutation = records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return !target?.closest('[data-ui-inspector-root]');
      });
      if (appMutation) scheduleRefresh();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-ui-id', 'data-ui-instance', 'class', 'style', 'hidden', 'aria-hidden'],
    });

    window.addEventListener('click', onClickCapture, true);
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup'] as const) {
      window.addEventListener(type, swallowBadgePress, true);
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mouseout', onMouseOut);
    window.addEventListener('keydown', onKeyDownCapture, true);
    window.addEventListener('keydown', onEscape);
    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
    window.addEventListener('resize', onViewportChange);
    scheduleRefresh();

    return () => {
      window.removeEventListener('click', onClickCapture, true);
      for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup'] as const) {
        window.removeEventListener(type, swallowBadgePress, true);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('keydown', onKeyDownCapture, true);
      window.removeEventListener('keydown', onEscape);
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      observer.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [enabled, applyPointerTarget, clearPinned, pin, scheduleRefresh, setHover]);

  // Re-measure when a followed element resizes without a DOM mutation (e.g. a CSS transition).
  const hoverElement = view.hover?.element ?? null;
  const pinnedElement = view.pinned?.element ?? null;
  useEffect(() => {
    if (!enabled || (!hoverElement && !pinnedElement)) return;
    const observer = new ResizeObserver(() => scheduleRefresh());
    if (hoverElement) observer.observe(hoverElement);
    if (pinnedElement) observer.observe(pinnedElement);
    return () => observer.disconnect();
  }, [enabled, hoverElement, pinnedElement, scheduleRefresh]);

  if (!enabled) return null;

  const pinned = view.pinned;
  const entry = pinned ? registry?.entries.get(pinned.id) : undefined;
  const feature = entry ? registry?.features.get(entry.featureId) : undefined;
  const parent = entry?.parentId
    ? registry?.entries.get(entry.parentId) ?? registry?.features.get(entry.parentId)
    : undefined;
  const nameOf = (id: string) => registry?.entries.get(id)?.name ?? null;

  // Until the Registry loads, fields show a loading marker rather than a guess.
  const field = (value: string | null | undefined): string => {
    if (!registry) return registryLoadFailed ? NOT_AVAILABLE : 'جارٍ التحميل…';
    return value ?? NOT_AVAILABLE;
  };

  const registryNote = !pinned
    ? null
    : registry
      ? entry
        ? null
        : 'هذا المعرّف غير موجود في Registry، ولذلك لا تُعرض بيانات بديلة.'
      : registryLoadFailed
        ? 'تعذّر تحميل Registry؛ الحقول المرتبطة به غير متاحة.'
        : 'جارٍ تحميل Registry…';

  const copySelectedId = async () => {
    if (!pinned) return;
    const selectedId = pinned.id;
    let copied = false;

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(selectedId);
      copied = true;
    } catch {
      try {
        const temporaryInput = document.createElement('textarea');
        temporaryInput.value = selectedId;
        temporaryInput.setAttribute('readonly', '');
        temporaryInput.setAttribute('aria-hidden', 'true');
        temporaryInput.style.position = 'fixed';
        temporaryInput.style.opacity = '0';
        document.body.appendChild(temporaryInput);
        try {
          temporaryInput.select();
          copied = document.execCommand('copy');
        } finally {
          temporaryInput.remove();
        }
      } catch {
        copied = false;
      }
    }

    setCopyStatus(copied ? 'Copied' : 'Copy failed');
  };

  const showHover = view.hover && view.hover.inView && view.hover.element !== pinned?.element;

  return (
    <div data-ui-id="A730" className="contents" data-ui-inspector-root>
      <button
        type="button"
        data-ui-id="A410"
        data-ui-inspector-toggle
        onClick={() => setInspectorEnabled(false)}
        aria-pressed={enabled}
        title="Turn off the UI ID Inspector (Alt+Shift+I). Hover shows an ID; click its badge to pin."
        className="fixed bottom-3 start-3 z-[10000] rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white shadow-xl hover:bg-slate-800"
      >
        UI ID Inspector · ON
      </button>

      <div
        data-ui-id="A411"
        data-ui-inspector-overlay
        // Above the details card so the pinned marker and its badge stay visible over it.
        className="pointer-events-none fixed inset-0 z-[10002]"
      >
        {showHover && view.hover && <Highlight layer={view.hover} variant="hover" />}
        {pinned?.inView && <Highlight layer={pinned} variant="pinned" />}
        {showHover && view.hover && (
          <InspectorBadge layer={view.hover} variant="hover" name={nameOf(view.hover.id)} />
        )}
        {pinned?.inView && <InspectorBadge layer={pinned} variant="pinned" name={nameOf(pinned.id)} />}
      </div>

      {pinned && (
        <aside
          data-ui-id="A412"
          data-ui-inspector-details
          role="dialog"
          aria-label="UI ID Inspector details"
          aria-keyshortcuts="Escape"
          // The panel is pointer-transparent so the pinned selection never blocks hovering
          // other elements; only its own buttons receive pointer events.
          className="pointer-events-none fixed bottom-14 start-3 z-[10001] max-h-[70vh] w-[min(32rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-left text-xs text-slate-100 shadow-2xl"
          dir="ltr"
        >
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-700 pb-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">UI ID Inspector</p>
              <p className="mt-1 text-[10px] text-slate-400">
                Pinned selection. Hover to preview another element; click its badge to pin it. Escape clears.
                Inspecting never runs the element&apos;s action.
              </p>
              {pinned.instance && (
                <p className="mt-1 font-mono text-[10px] text-slate-400">Instance: {pinned.instance}</p>
              )}
            </div>
            <div className="pointer-events-auto flex shrink-0 gap-2">
              <button
                data-ui-id="A732"
                type="button"
                onClick={() => void copySelectedId()}
                className="rounded border border-fuchsia-400 px-2 py-1 font-semibold text-fuchsia-200 hover:bg-fuchsia-950"
                title="Copy the pinned element's real UI ID"
              >
                {copyStatus || 'Copy ID'}
              </button>
              <button
                data-ui-id="A2126"
                type="button"
                onClick={clearPinned}
                className="rounded border border-red-400 px-2 py-1 font-semibold text-red-200 hover:bg-red-950"
                title="Clear the pinned selection and remove its red marker (Escape)"
              >
                Clear selection
              </button>
            </div>
          </div>

          <p className="mb-3 font-mono text-base font-bold text-red-300" data-ui-inspector-selected-id>
            {pinned.id}
          </p>
          {registryNote && <p className="mb-3 text-amber-300">{registryNote}</p>}
          <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 leading-relaxed">
            <dt className="text-slate-400">Name / الاسم</dt>
            <dd>{field(entry?.name)}</dd>
            <dt className="text-slate-400">Type / النوع</dt>
            <dd className="font-mono">{field(entry?.kind)}</dd>
            <dt className="text-slate-400">Page / الصفحة</dt>
            <dd className="font-mono">
              {field(entry?.route)}
              <span className="block text-slate-400">live path: {window.location.pathname}</span>
            </dd>
            <dt className="text-slate-400">Parent ID</dt>
            <dd className="font-mono">
              {entry ? (entry.parentId ?? NOT_AVAILABLE) : field(undefined)}
              {parent?.name ? ` — ${parent.name}` : ''}
            </dd>
            <dt className="text-slate-400">Feature ID</dt>
            <dd className="font-mono">
              {field(entry?.featureId)}
              {feature?.name ? ` — ${feature.name}` : ''}
            </dd>
            <dt className="text-slate-400">Component / المكوّن</dt>
            <dd className="font-mono">{field(entry?.component)}</dd>
            <dt className="text-slate-400">Source file / الملف</dt>
            <dd className="break-all font-mono">{field(entry?.sourceFile)}</dd>
            <dt className="text-slate-400">Action / Handler</dt>
            <dd className="whitespace-pre-wrap break-all font-mono">
              {entry
                ? entry.actions?.length
                  ? entry.actions.map((action) => `${action.event}: ${action.expression}`).join('\n')
                  : 'لا يوجد Action مسجّل'
                : field(undefined)}
            </dd>
            <dt className="text-slate-400">Related IDs</dt>
            <dd className="break-all font-mono">
              {entry ? entry.relatedIds.join(', ') || 'لا توجد معرفات مرتبطة' : field(undefined)}
            </dd>
            <dt className="text-slate-400">Live DOM</dt>
            <dd className="font-mono">
              {`<${pinned.element.tagName.toLowerCase()}>`}
              {pinned.element.getAttribute('role') ? ` role="${pinned.element.getAttribute('role')}"` : ''}
            </dd>
            <dt className="text-slate-400">Description</dt>
            <dd>{field(entry?.description)}</dd>
          </dl>
        </aside>
      )}
    </div>
  );
}

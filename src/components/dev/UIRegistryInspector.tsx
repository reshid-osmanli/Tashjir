'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeatureRegistryEntry } from '@/ui/feature-registry';
import type { UIRegistryEntry } from '@/ui/ui-registry';

// المرجع الوحيد للهوية هو DOM: تُقرأ `data-ui-id` من العنصر الحقيقي تحت
// المؤشر ولا يُولَّد أو يُشتق أي معرّف داخل هذه الأداة.

type Rect = { left: number; top: number; width: number; height: number };

type Identity = { id: string; instance: string | null };

type HoverTarget = Identity & { rect: Rect; isPinned: boolean };

type RegistrySnapshot = {
  entries: readonly UIRegistryEntry[];
  features: readonly FeatureRegistryEntry[];
};

const INSPECTOR_ROOT = '[data-ui-inspector-root]';
const INSPECTOR_BADGE = '[data-ui-inspector-badge]';
const PINNED_ATTRIBUTE = 'data-ui-inspector-pinned';
const NOT_AVAILABLE = 'Not available';
/** ألوان الطبقة المؤقتة: ثوابت صريحة حتى لا تتبدّل مع ثيم Tailwind. */
const RED = '#ef4444';
const HOVER_BLUE = '#0ea5e9';
const BADGE_HEIGHT = 17;
const BADGE_MAX_WIDTH = 208;
const HOVER_KEEP_PADDING = 16;

/**
 * الطبقة الحمراء طبقة مظهرية مؤقتة فقط: `outline` لا يدخل في حساب التخطيط،
 * فلا يتغيّر حجم العنصر أو موضعه أو منطق التطبيق.
 */
const INSPECTOR_STYLE = `[data-ui-inspector-pinned="1"]{outline:2px solid ${RED} !important;outline-offset:1px !important;border-radius:4px !important}`;

function writeInspectorQuery(enabled: boolean) {
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set('uiInspector', '1');
  else url.searchParams.delete('uiInspector');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function rectOf(node: HTMLElement): Rect | null {
  const { width, height, top, left, bottom, right } = node.getBoundingClientRect();
  if (width <= 0 || height <= 0) return null;
  if (bottom <= 0 || top >= window.innerHeight) return null;
  if (right <= 0 || left >= window.innerWidth) return null;
  return { left, top, width, height };
}

function readIdentity(node: HTMLElement): Identity | null {
  const id = node.getAttribute('data-ui-id');
  if (!id) return null;
  const instance =
    node.getAttribute('data-ui-instance') ??
    node.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ??
    null;
  return { id, instance };
}

/** العنصر الأقرب للمؤشر: `closest` يعيد الابن المسجّل لا اللوحة الأب. */
function resolveNode(element: Element | null): HTMLElement | null {
  if (!element) return null;
  if (element.closest(INSPECTOR_ROOT)) return null;
  const node = element.closest<HTMLElement>('[data-ui-id]');
  if (!node) return null;
  if (node.closest(INSPECTOR_ROOT)) return null;
  if (node === document.body || node === document.documentElement) return null;
  return node;
}

function registeredNodes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-ui-id]')).filter((node) => {
    if (node.closest(INSPECTOR_ROOT)) return false;
    if (node === document.body || node === document.documentElement) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function badgePosition(rect: Rect): { left: number; top: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let top = rect.top - BADGE_HEIGHT - 1;
  if (top < 2) {
    const below = rect.top + rect.height + 1;
    top =
      below + BADGE_HEIGHT + 2 <= viewportHeight
        ? below
        : Math.max(2, Math.min(rect.top + 2, Math.max(2, viewportHeight - BADGE_HEIGHT - 2)));
  }
  return {
    left: Math.max(2, Math.min(rect.left, Math.max(2, viewportWidth - BADGE_MAX_WIDTH - 2))),
    top,
  };
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  );
}

function sameHover(a: HoverTarget | null, b: HoverTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.instance === b.instance && a.isPinned === b.isPinned && sameRect(a.rect, b.rect);
}

function shorten(value: string, limit = 64): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/**
 * أداة فحص اختيارية وآمنة في الإنتاج: لا ترسم شيئًا إلا بعد تفعيل صريح عبر
 * `?uiInspector=1` أو Alt+Shift+I. الشارات لا تظهر دفعة واحدة؛ تظهر للعنصر
 * المُشار إليه فقط، وبالضغط عليها يُثبَّت تحديد عنصر واحد.
 */
export function UIRegistryInspector() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [pinned, setPinned] = useState<Identity | null>(null);
  const [pinnedRect, setPinnedRect] = useState<Rect | null>(null);
  const [registry, setRegistry] = useState<RegistrySnapshot | null>(null);
  const [registryLoadFailed, setRegistryLoadFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [keyboardMode, setKeyboardMode] = useState(false);

  const hoverNodeRef = useRef<HTMLElement | null>(null);
  const pinNodeRef = useRef<HTMLElement | null>(null);
  const badgeRef = useRef<HTMLButtonElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const enabledRef = useRef(false);
  const keyboardModeRef = useRef(false);

  const clearHover = useCallback(() => {
    hoverNodeRef.current = null;
    setHover(null);
  }, []);

  const clearPin = useCallback(() => {
    pinNodeRef.current?.removeAttribute(PINNED_ATTRIBUTE);
    pinNodeRef.current = null;
    setPinned(null);
    setPinnedRect(null);
    setCopyStatus('');
  }, []);

  /** يثبّت عنصرًا واحدًا فقط: أي تثبيت جديد يُلغي السلف بلا أثر. */
  const pinNode = useCallback((node: HTMLElement | null) => {
    const previous = pinNodeRef.current;
    if (previous && previous !== node) previous.removeAttribute(PINNED_ATTRIBUTE);
    if (!node || !node.isConnected) {
      pinNodeRef.current = null;
      setPinned(null);
      setPinnedRect(null);
      setCopyStatus('');
      return;
    }
    const identity = readIdentity(node);
    if (!identity) return;
    pinNodeRef.current = node;
    node.setAttribute(PINNED_ATTRIBUTE, '1');
    setPinned(identity);
    setPinnedRect(rectOf(node));
    setCopyStatus('');
  }, []);

  const setInspectorEnabled = useCallback(
    (next: boolean) => {
      enabledRef.current = next;
      setEnabled(next);
      writeInspectorQuery(next);
      if (!next) {
        pinNodeRef.current?.removeAttribute(PINNED_ATTRIBUTE);
        pinNodeRef.current = null;
        hoverNodeRef.current = null;
        keyboardModeRef.current = false;
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        setHover(null);
        setPinned(null);
        setPinnedRect(null);
        setKeyboardMode(false);
        setCopyStatus('');
      }
    },
    []
  );

  // A query parameter deliberately works in production builds and on preview
  // deployments. The keyboard shortcut is also available while the overlay is off.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('uiInspector') === '1') {
      setInspectorEnabled(true);
    }
  }, [setInspectorEnabled]);

  // Alt+Shift+I يعمل دائمًا، حتى عندما تكون الأداة مطفأة.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        setInspectorEnabled(!enabledRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [setInspectorEnabled]);

  // Registry JSON كبير؛ يُحمَّل عند الطلب فقط بعد التفعيل.
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
        setRegistry({ entries: uiRegistry.UI_REGISTRY, features: featureRegistry.FEATURE_REGISTRY });
      })
      .catch(() => {
        if (!cancelled) setRegistryLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // كل الطبقات المؤقتة تُزال عند تغيّر المسار، فلا يبقى تمييز لعنصر زال.
  useEffect(() => {
    clearHover();
    clearPin();
  }, [pathname, clearHover, clearPin]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      frameRef.current = null;

      if (hoverNodeRef.current && !hoverNodeRef.current.isConnected) hoverNodeRef.current = null;
      if (pinNodeRef.current && !pinNodeRef.current.isConnected) {
        pinNodeRef.current = null;
        setPinned(null);
        setPinnedRect(null);
        setCopyStatus('');
      }

      const hoverNode = hoverNodeRef.current;
      const pinNode = pinNodeRef.current;
      const nextHover: HoverTarget | null = (() => {
        if (!hoverNode) return null;
        const identity = readIdentity(hoverNode);
        const rect = rectOf(hoverNode);
        if (!identity || !rect) return null;
        return { ...identity, rect, isPinned: hoverNode === pinNode };
      })();

      setHover((previous) => (sameHover(previous, nextHover) ? previous : nextHover));
      setPinnedRect((previous) => {
        const next = pinNode ? rectOf(pinNode) : null;
        return sameRect(previous, next) ? previous : next;
      });

      if (hoverNodeRef.current || pinNodeRef.current) schedule();
    };

    const schedule = () => {
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (keyboardModeRef.current) {
        keyboardModeRef.current = false;
        setKeyboardMode(false);
      }
      const { clientX, clientY } = event;
      const element = document.elementFromPoint(clientX, clientY);
      // الشارة ولوحة التفاصيل من طبقة الأداة: المؤشر فوقها يحفظ الهدف الحالي.
      if (element?.closest(INSPECTOR_ROOT)) {
        schedule();
        return;
      }
      const node = resolveNode(element);
      if (node) {
        hoverNodeRef.current = node;
        schedule();
        return;
      }
      // منطقة ميتة صغيرة بين العنصر والشارات: يُحفظ الهدف ما دام المؤشر قريبا.
      const current = hoverNodeRef.current;
      if (!current) return;
      const rect = current.getBoundingClientRect();
      const nearPointer =
        clientX >= rect.left - HOVER_KEEP_PADDING &&
        clientX <= rect.right + HOVER_KEEP_PADDING &&
        clientY >= rect.top - HOVER_KEEP_PADDING &&
        clientY <= rect.bottom + HOVER_KEEP_PADDING;
      if (!nearPointer) {
        hoverNodeRef.current = null;
        schedule();
      }
    };

    const onPointerLeave = () => {
      if (!hoverNodeRef.current) return;
      hoverNodeRef.current = null;
      schedule();
    };

    const cycle = (step: number) => {
      const nodes = registeredNodes();
      if (nodes.length === 0) return;
      const current = hoverNodeRef.current;
      const index = current ? nodes.indexOf(current) : -1;
      const next =
        index < 0 ? (step > 0 ? 0 : nodes.length - 1) : (index + step + nodes.length) % nodes.length;
      const node = nodes[next];
      if (!node) return;
      hoverNodeRef.current = node;
      keyboardModeRef.current = true;
      setKeyboardMode(true);
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
      schedule();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearHover();
        clearPin();
        keyboardModeRef.current = false;
        setKeyboardMode(false);
        return;
      }
      if (event.altKey && event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cycle(event.key === 'ArrowDown' ? 1 : -1);
      }
    };

    /**
     * الضغط على الشارة للتحديد والفحص فقط: يُلتقط الحدث في مرحلة الالتقاط على
     * `window` قبل أي مستمع للتطبيق، فلا يصل النقر إلى الإجراء الأصلي أبدًا.
     */
    const onBadgePointer = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const badge = target?.closest<HTMLElement>(INSPECTOR_BADGE);
      if (!badge) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type !== 'click') return;
      const node = badge.dataset.uiInspectorBadge === 'pin' ? pinNodeRef.current : hoverNodeRef.current;
      if (node) pinNode(node);
    };

    // Alt+نقر يبقى اختصارًا مكافئًا: يثبّت العنصر دون تنفيذ إجراءه.
    const onAltClick = (event: MouseEvent) => {
      if (!event.altKey || !(event.target instanceof Element)) return;
      if (event.target.closest(INSPECTOR_ROOT)) return;
      const node = resolveNode(event.target);
      if (!node) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pinNode(node);
    };

    const eventNames = ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick'] as const;
    for (const name of eventNames) window.addEventListener(name, onBadgePointer, true);
    window.addEventListener('click', onAltClick, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mouseleave', onPointerLeave);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      for (const name of eventNames) window.removeEventListener(name, onBadgePointer, true);
      window.removeEventListener('click', onAltClick, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [enabled, clearHover, clearPin, pinNode]);

  // في وضع لوحة المفاتيح تُمنح الشارة التركيز فيعمل Enter/Space طبيعيًا.
  useEffect(() => {
    if (!keyboardMode || !hover) return;
    badgeRef.current?.focus({ preventScroll: true });
  }, [keyboardMode, hover]);

  useEffect(() => {
    setCopyStatus('');
  }, [pinned]);

  if (!enabled) return null;

  const selected = pinned ? registry?.entries.find((entry) => entry.id === pinned.id) : undefined;
  const feature = selected
    ? registry?.features.find((entry) => entry.id === selected.featureId)
    : undefined;
  const parent = selected?.parentId
    ? registry?.entries.find((entry) => entry.id === selected.parentId) ??
      registry?.features.find((entry) => entry.id === selected.parentId)
    : undefined;

  const pinnedTarget: HoverTarget | null =
    pinned && pinnedRect ? { ...pinned, rect: pinnedRect, isPinned: true } : null;
  const primaryTarget: HoverTarget | null = hover ?? pinnedTarget;
  // عند تمرير المؤشر على عنصر آخر يبقى العنصر المثبّت مميّزًا بالأحمر.
  const secondaryPinned: HoverTarget | null =
    pinnedTarget && hover && !hover.isPinned ? pinnedTarget : null;

  const copySelectedId = async () => {
    if (!pinned) return;
    let copied = false;

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(pinned.id);
      copied = true;
    } catch {
      try {
        const temporaryInput = document.createElement('textarea');
        temporaryInput.value = pinned.id;
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

  const renderBadge = (target: HoverTarget, role: 'primary' | 'secondary') => {
    const name = registry?.entries.find((entry) => entry.id === target.id)?.name;
    const position = badgePosition(target.rect);
    const title = [
      target.id,
      target.instance ? `instance: ${target.instance}` : null,
      name ? shorten(name, 160) : null,
      '— click the badge to pin this element (its own action is not invoked)',
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <button
        key={`${role}:${target.id}:${target.instance ?? ''}`}
        ref={role === 'primary' ? badgeRef : undefined}
        type="button"
        data-ui-id="A731"
        data-ui-inspector-badge={target.isPinned ? 'pin' : 'hover'}
        data-ui-badge-for={target.id}
        data-ui-inspector-badge-pinned={target.isPinned ? '1' : undefined}
        title={title}
        aria-label={`Inspect ${target.id}${name ? ` — ${shorten(name, 80)}` : ''}`}
        className={[
          'pointer-events-auto absolute z-[10000] flex h-[17px] max-w-[13rem] items-center gap-1 rounded-[3px] border px-1',
          'font-mono text-[10px] font-bold leading-none text-white shadow-md',
          target.isPinned
            ? 'border-rose-200 bg-rose-600 hover:bg-rose-500'
            : 'border-sky-200 bg-sky-600 hover:bg-sky-500',
        ].join(' ')}
        style={{ left: position.left, top: position.top, maxWidth: BADGE_MAX_WIDTH }}
      >
        <span className="shrink-0">{target.id}</span>
        {name && (
          <span className="max-w-[8.5rem] truncate font-sans text-[9px] font-normal opacity-95">
            {shorten(name)}
          </span>
        )}
      </button>
    );
  };

  return (
    <div data-ui-id="A730" className="contents" data-ui-inspector-root>
      <style dangerouslySetInnerHTML={{ __html: INSPECTOR_STYLE }} />

      <button
        type="button"
        data-ui-id="A410"
        data-ui-inspector-toggle
        onClick={() => setInspectorEnabled(false)}
        aria-pressed={enabled}
        title="Turn off the UI ID Inspector (Alt+Shift+I)"
        className="fixed bottom-3 start-3 z-[10000] rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white shadow-xl hover:bg-slate-800"
      >
        UI ID Inspector · ON
      </button>

      <div
        data-ui-id="A411"
        data-ui-inspector-overlay
        className="pointer-events-none fixed inset-0 z-[9998]"
        aria-hidden="true"
      >
        {pinnedTarget && (
          <div
            data-ui-inspector-pin-outline
            data-ui-inspector-outline-for={pinnedTarget.id}
            className="pointer-events-none absolute rounded-md border-2 border-solid"
            style={{
              left: pinnedTarget.rect.left,
              top: pinnedTarget.rect.top,
              width: pinnedTarget.rect.width,
              height: pinnedTarget.rect.height,
              borderColor: RED,
              background: 'rgba(239,68,68,0.55)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.7), 0 0 12px rgba(239,68,68,0.55)',
            }}
          />
        )}
        {hover && !hover.isPinned && (
          <div
            data-ui-inspector-hover-outline
            data-ui-inspector-outline-for={hover.id}
            className="pointer-events-none absolute rounded-md border-2 border-solid"
            style={{
              left: hover.rect.left,
              top: hover.rect.top,
              width: hover.rect.width,
              height: hover.rect.height,
              borderColor: HOVER_BLUE,
              background: 'rgba(14,165,233,0.15)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.7)',
            }}
          />
        )}
        {secondaryPinned && renderBadge(secondaryPinned, 'secondary')}
        {primaryTarget && renderBadge(primaryTarget, 'primary')}
      </div>

      {pinned && (
        <aside
          data-ui-id="A412"
          data-ui-inspector-details
          role="dialog"
          aria-label="UI ID Inspector details"
          aria-keyshortcuts="Escape"
          className="fixed bottom-14 start-3 z-[10001] max-h-[70vh] w-[min(32rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs text-slate-100 shadow-2xl"
          dir="ltr"
        >
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-700 pb-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">UI ID Inspector</p>
              <p className="mt-1 text-[10px] text-slate-400">
                Hover an element, then click its badge to pin it. Alt+Shift+I toggles, Alt+Shift+↑/↓ walks,
                Escape clears.
              </p>
              {pinned.instance && (
                <p className="mt-1 font-mono text-[10px] text-slate-400">Instance: {pinned.instance}</p>
              )}
            </div>
            <button
              data-ui-id="A732"
              type="button"
              onClick={() => void copySelectedId()}
              className="shrink-0 rounded border border-fuchsia-400 px-2 py-1 font-semibold text-fuchsia-200 hover:bg-fuchsia-950"
              title="Copy the pinned element's real UI ID"
            >
              {copyStatus || 'Copy ID'}
            </button>
          </div>

          <p className="mb-3 font-mono text-base font-bold text-fuchsia-300" data-ui-inspector-selected-id>
            {pinned.id}
          </p>

          {!registry && !registryLoadFailed && (
            <p className="mb-3 text-slate-300">Loading the checked-in Registry entry for {pinned.id}…</p>
          )}
          {registryLoadFailed && (
            <p className="mb-3 text-rose-300">
              Registry metadata could not be loaded; no fallback values are invented.
            </p>
          )}

          <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 leading-relaxed">
            <dt className="text-slate-400">Name</dt>
            <dd>{selected?.name ?? NOT_AVAILABLE}</dd>
            <dt className="text-slate-400">Type</dt>
            <dd>{selected?.kind ?? NOT_AVAILABLE}</dd>
            <dt className="text-slate-400">Page</dt>
            <dd className="font-mono">{selected?.route ?? NOT_AVAILABLE}</dd>
            <dt className="text-slate-400">Parent ID</dt>
            <dd className="font-mono">
              {selected?.parentId ?? NOT_AVAILABLE}
              {parent?.name ? ` — ${parent.name}` : ''}
            </dd>
            <dt className="text-slate-400">Feature ID</dt>
            <dd className="font-mono">
              {selected?.featureId ?? NOT_AVAILABLE}
              {feature?.name ? ` — ${feature.name}` : ''}
            </dd>
            <dt className="text-slate-400">Component</dt>
            <dd className="font-mono">{selected?.component ?? NOT_AVAILABLE}</dd>
            <dt className="text-slate-400">Source file</dt>
            <dd className="break-all font-mono">{selected?.sourceFile ?? NOT_AVAILABLE}</dd>
            <dt className="text-slate-400">Action / handler</dt>
            <dd className="whitespace-pre-wrap break-all font-mono">
              {selected?.actions?.length
                ? selected.actions.map((action) => `${action.event}: ${action.expression}`).join('\n')
                : NOT_AVAILABLE}
            </dd>
            <dt className="text-slate-400">Related IDs</dt>
            <dd className="break-all font-mono">
              {selected?.relatedIds?.length ? selected.relatedIds.join(', ') : NOT_AVAILABLE}
            </dd>
            <dt className="text-slate-400">Description</dt>
            <dd>{selected?.description ?? NOT_AVAILABLE}</dd>
          </dl>
        </aside>
      )}
    </div>
  );
}

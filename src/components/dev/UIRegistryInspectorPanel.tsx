'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BADGE_HEIGHT,
  FAMILY_BADGE_CLASS,
  badgeFamily,
  buildRegistryRows,
  placeBadges,
  type BadgeCandidate,
  type Box,
  type PlacedBadge,
  type RegistryLookup,
} from './ui-inspector-model';
import type { UIRegistryEntry } from '@/ui/ui-registry';

/** Which screen edge the details card uses: always the side away from the selected element. */
type CardSide = 'left' | 'right';

type Selection =
  | {
      kind: 'registered';
      id: string;
      instance: string | null;
      chain: string[];
      clickedTag: string;
      path: string;
      detached: boolean;
      side: CardSide;
    }
  | { kind: 'unregistered'; clickedTag: string; path: string; side: CardSide };

type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * The registry is loaded on first use, from its own chunk. Ordinary page loads never download it,
 * and the rows shown below come straight from the records, never from placeholders.
 */
async function loadRegistryLookup(): Promise<RegistryLookup> {
  const [registry, features] = await Promise.all([import('@/ui/ui-registry'), import('@/ui/feature-registry')]);
  const byId = new Map<string, UIRegistryEntry>(
    registry.UI_REGISTRY.map((entry): [string, UIRegistryEntry] => [entry.id, entry]),
  );
  return {
    entry: (id) => byId.get(id),
    identityName: (id) => registry.getUIIdentity(id)?.name,
    featureName: (id) => features.getFeatureById(id)?.name,
  };
}

/** Ancestor chain of registered IDs, starting with the element itself. */
function registeredChain(node: Element): string[] {
  const chain: string[] = [];
  for (let current: Element | null = node; current && chain.length < 16; current = current.parentElement) {
    const id = current.getAttribute('data-ui-id');
    if (id) chain.push(id);
  }
  return chain;
}

/** Clipboard API first; a hidden textarea covers insecure origins and denied permissions. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the legacy copy path below.
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

const LEGEND: ReadonlyArray<{ label: string; dot: string }> = [
  { label: 'action', dot: 'bg-fuchsia-700' },
  { label: 'field', dot: 'bg-sky-700' },
  { label: 'choice', dot: 'bg-amber-600' },
  { label: 'container', dot: 'bg-emerald-700' },
  { label: 'not in registry', dot: 'bg-rose-700' },
];

/**
 * Active UI ID Inspector. Mounted only while the inspector is on (see UIRegistryInspector.tsx).
 *
 * While active, the overlay is inert for pointers: badges and highlights are pointer-events:none,
 * and every pointer, mouse, drag and click event outside the inspector is consumed in the capture
 * phase. That keeps inspecting from triggering any action. Keyboard shortcuts are not affected.
 */
export function UIRegistryInspectorPanel({ onDisable }: { onDisable: () => void }) {
  const [lookup, setLookup] = useState<RegistryLookup | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [badges, setBadges] = useState<PlacedBadge[]>([]);
  const [highlight, setHighlight] = useState<Box | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [useMode, setUseMode] = useState(false);
  const selectedRef = useRef<Element | null>(null);
  // Mirrors `useMode` for the window listeners, which are attached once per activation.
  const useModeRef = useRef(false);

  useEffect(() => {
    let active = true;
    loadRegistryLookup().then(
      (loaded) => {
        if (active) setLookup(loaded);
      },
      () => {
        if (active) setLookupFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const insideInspector = (target: EventTarget | null) =>
      target instanceof Element && target.closest('[data-ui-inspector-root]') !== null;

    let frame = 0;
    let badgeKey = '';
    let highlightKey = '';

    const measure = () => {
      frame = 0;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const candidates: BadgeCandidate[] = [];
      document.querySelectorAll<Element>('[data-ui-id]').forEach((node) => {
        if (node.closest('[data-ui-inspector-root]')) return;
        const rect = node.getBoundingClientRect();
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          rect.right < 0 ||
          rect.bottom < 0 ||
          rect.left > viewportWidth ||
          rect.top > viewportHeight
        ) {
          return;
        }
        candidates.push({
          key: String(candidates.length),
          id: node.getAttribute('data-ui-id') ?? '',
          instance: node.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ?? null,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
      });
      const placed = placeBadges(candidates, { width: viewportWidth, height: viewportHeight });
      const nextBadgeKey = placed.map((b) => `${b.id}|${b.instance ?? ''}|${Math.round(b.left)}|${Math.round(b.top)}`).join(';');
      if (nextBadgeKey !== badgeKey) {
        badgeKey = nextBadgeKey;
        setBadges(placed);
      }

      const node = selectedRef.current;
      let nextHighlight: Box | null = null;
      if (node?.isConnected) {
        const rect = node.getBoundingClientRect();
        nextHighlight = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      } else if (node) {
        setSelection((current) =>
          current && current.kind === 'registered' && !current.detached ? { ...current, detached: true } : current,
        );
      }
      const nextHighlightKey = nextHighlight
        ? [nextHighlight.left, nextHighlight.top, nextHighlight.width, nextHighlight.height].map(Math.round).join(',')
        : '';
      if (nextHighlightKey !== highlightKey) {
        highlightKey = nextHighlightKey;
        setHighlight(nextHighlight);
      }
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    const inspect = (clicked: Element | null) => {
      const node = clicked?.closest('[data-ui-id]') ?? null;
      const clickedTag = clicked ? clicked.tagName.toLowerCase() : 'document';
      const path = window.location.pathname;
      const rect = node?.getBoundingClientRect();
      const side: CardSide = rect && rect.left + rect.width / 2 < window.innerWidth / 2 ? 'right' : 'left';
      selectedRef.current = node;
      setCopyStatus('idle');
      setSelection(
        node
          ? {
              kind: 'registered',
              id: node.getAttribute('data-ui-id') ?? '',
              instance: node.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ?? null,
              chain: registeredChain(node),
              clickedTag,
              path,
              detached: false,
              side,
            }
          : { kind: 'unregistered', clickedTag, path, side },
      );
      schedule();
    };

    // Inspect mode consumes pointer, drag and context events so no action runs. Use mode leaves
    // them to the editor (its own drags and Alt+drag pan keep working); only clicks are caught below.
    const suppress = (event: Event) => {
      if (insideInspector(event.target) || useModeRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    // Touch gestures keep their default behaviour so the page can still be scrolled.
    const passTouch = (event: Event) => {
      if (insideInspector(event.target) || useModeRef.current) return;
      event.stopImmediatePropagation();
    };
    // A click inspects in inspect mode, and in use mode when Alt is held.
    const inspectClick = (event: MouseEvent) => {
      if (insideInspector(event.target)) return;
      if (useModeRef.current && !event.altKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      inspect(event.target instanceof Element ? event.target : null);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      selectedRef.current = null;
      setSelection(null);
      setHighlight(null);
    };

    const suppressedEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick', 'contextmenu', 'dragstart'];
    const touchEvents = ['touchstart', 'touchend'];
    for (const type of suppressedEvents) window.addEventListener(type, suppress, true);
    for (const type of touchEvents) window.addEventListener(type, passTouch, { capture: true, passive: true });
    window.addEventListener('click', inspectClick, true);
    window.addEventListener('keydown', onEscape);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    document.addEventListener('transitionend', schedule, true);
    document.addEventListener('animationend', schedule, true);

    const mutations = new MutationObserver((records) => {
      const external = records.some((record) => {
        const origin = record.target instanceof Element ? record.target : record.target.parentElement;
        return !origin?.closest('[data-ui-inspector-root]');
      });
      if (external) schedule();
    });
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-ui-id', 'data-ui-instance'],
    });
    const resizes = new ResizeObserver(() => schedule());
    resizes.observe(document.documentElement);
    // Safety net for layout changes that neither mutations nor resize events report (e.g. CSS transitions).
    const timer = window.setInterval(schedule, 400);
    schedule();

    return () => {
      for (const type of suppressedEvents) window.removeEventListener(type, suppress, true);
      for (const type of touchEvents) window.removeEventListener(type, passTouch, true);
      window.removeEventListener('click', inspectClick, true);
      window.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      document.removeEventListener('transitionend', schedule, true);
      document.removeEventListener('animationend', schedule, true);
      mutations.disconnect();
      resizes.disconnect();
      window.clearInterval(timer);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      selectedRef.current = null;
    };
  }, []);

  const registered = selection?.kind === 'registered' ? selection : null;
  const entry = registered && lookup ? lookup.entry(registered.id) : undefined;
  const ready = lookup !== null;
  const registryNote = lookupFailed
    ? 'Registry data could not be loaded.'
    : !ready
      ? 'Loading registry…'
      : registered && !entry
        ? 'This ID is not in the UI registry.'
        : null;

  const copySelectedId = async () => {
    if (!registered) return;
    setCopyStatus((await copyText(registered.id)) ? 'copied' : 'failed');
  };

  const closeDetails = () => {
    selectedRef.current = null;
    setSelection(null);
    setHighlight(null);
    setCopyStatus('idle');
  };

  const toggleClickMode = () => {
    const next = !useModeRef.current;
    useModeRef.current = next;
    setUseMode(next);
  };

  return (
    <div data-ui-id="A730" data-ui-inspector-root className="contents">
      <div data-ui-id="A411" aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9998]">
        {highlight ? (
          <div
            data-ui-inspector-highlight
            className="pointer-events-none absolute rounded-sm border-2 border-fuchsia-500 bg-fuchsia-500/10"
            style={{ left: highlight.left, top: highlight.top, width: highlight.width, height: highlight.height }}
          />
        ) : null}
        {badges.map((badge) => {
          const badgeEntry = lookup?.entry(badge.id);
          const family = badgeFamily(badgeEntry, ready);
          return (
            <span
              key={badge.key}
              data-ui-id="A731"
              data-ui-inspector-badge={badge.id}
              data-ui-inspector-family={family}
              title={badgeEntry ? `${badge.id} · ${badgeEntry.name}` : badge.id}
              className={`pointer-events-none absolute whitespace-nowrap rounded-sm border px-1 font-mono text-[10px] leading-4 font-bold shadow-sm ${FAMILY_BADGE_CLASS[family]}`}
              style={{ left: badge.left, top: badge.top, height: BADGE_HEIGHT }}
            >
              {badge.id}
            </span>
          );
        })}
      </div>

      <div className="fixed start-3 bottom-3 z-[10000] flex flex-col items-start gap-1">
        <div className="flex items-center gap-1.5">
          <button
            data-ui-id="A410"
            type="button"
            aria-pressed="true"
            onClick={onDisable}
            title="Turn off UI ID Inspector (Alt+Shift+I)"
            className="rounded-full bg-slate-950 px-3 py-1.5 font-mono text-[11px] font-bold text-white shadow-lg ring-2 ring-fuchsia-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500"
          >
            UI ID Inspector · ON · {badges.length}
          </button>
          <button
            data-ui-id="A2127"
            type="button"
            aria-pressed={useMode}
            onClick={toggleClickMode}
            title={
              useMode
                ? 'Clicks use the editor normally. Alt+click still inspects.'
                : 'Clicks inspect elements and do not run their actions. Click to use the editor normally.'
            }
            className="rounded-full bg-white px-3 py-1.5 font-mono text-[11px] font-bold text-slate-900 shadow-lg ring-2 ring-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500"
          >
            {useMode ? 'Clicks: use editor' : 'Clicks: inspect'}
          </button>
        </div>
        <div className="pointer-events-none flex flex-wrap gap-x-3 gap-y-1 rounded bg-slate-950/90 px-2 py-1 text-[10px] text-white shadow">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${item.dot}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {selection ? (
        <aside
          data-ui-id="A412"
          aria-label="UI ID details"
          dir="ltr"
          style={selection.side === 'left' ? { left: 12, bottom: 96 } : { right: 12, bottom: 96 }}
          className="fixed z-[10001] max-h-[70vh] w-[min(30rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-left text-xs leading-relaxed text-slate-100 shadow-2xl"
        >
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-700 pb-3">
            <div className="min-w-0 flex-1">
              {registered ? (
                <>
                  <p data-ui-inspector-selected={registered.id} className="font-mono text-base font-bold text-fuchsia-300">
                    {registered.id}
                  </p>
                  {entry ? (
                    <p dir="auto" className="mt-0.5 font-semibold text-slate-100">
                      {entry.name}
                    </p>
                  ) : null}
                  {registryNote ? <p className="mt-1 text-amber-300">{registryNote}</p> : null}
                  {registered.detached ? (
                    <p className="mt-1 text-amber-300">This element is no longer on the page.</p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="font-mono text-base font-bold text-slate-300">No registered element</p>
                  <p className="mt-0.5 text-slate-400">
                    The clicked &lt;{selection.clickedTag}&gt; has no data-ui-id on it or above it.
                  </p>
                </>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {registered ? (
                <button
                  data-ui-id="A2126"
                  type="button"
                  onClick={copySelectedId}
                  className="rounded-md bg-fuchsia-600 px-2.5 py-1 font-semibold text-white hover:bg-fuchsia-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300"
                >
                  {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy ID'}
                </button>
              ) : null}
              <button
                data-ui-id="A732"
                type="button"
                onClick={closeDetails}
                className="rounded-md border border-slate-600 px-2.5 py-1 text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300"
              >
                Close
              </button>
            </div>
          </div>

          {registered && entry && lookup ? (
            <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              {buildRegistryRows(entry, lookup).map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-slate-400">{row.label}</dt>
                  <dd dir="auto" className={`min-w-0 break-words whitespace-pre-wrap ${row.mono ? 'font-mono text-[11px]' : ''}`}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <dl className={`grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 ${registered && entry ? 'mt-3 border-t border-slate-700 pt-3' : ''}`}>
            {registered ? (
              <>
                <div className="contents">
                  <dt className="text-slate-400">Instance</dt>
                  <dd className="font-mono text-[11px]">{registered.instance ?? '—'}</dd>
                </div>
                <div className="contents">
                  <dt className="text-slate-400">DOM chain</dt>
                  <dd className="font-mono text-[11px] break-words">{registered.chain.join(' › ')}</dd>
                </div>
                <div className="contents">
                  <dt className="text-slate-400">Clicked element</dt>
                  <dd className="font-mono text-[11px]">&lt;{registered.clickedTag}&gt;</dd>
                </div>
                <div className="contents">
                  <dt className="text-slate-400">Element state</dt>
                  <dd>{registered.detached ? 'Removed from the page' : 'On the page'}</dd>
                </div>
              </>
            ) : null}
            <div className="contents">
              <dt className="text-slate-400">Current path</dt>
              <dd className="font-mono text-[11px]">{selection.path}</dd>
            </div>
          </dl>
        </aside>
      ) : null}
    </div>
  );
}

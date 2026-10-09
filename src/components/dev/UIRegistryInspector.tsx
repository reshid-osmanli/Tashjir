'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeatureRegistryEntry } from '@/ui/feature-registry';
import type { UIRegistryEntry } from '@/ui/ui-registry';

type InspectedTarget = {
  id: string;
  instance: string | null;
  left: number;
  top: number;
};

type RegistrySnapshot = {
  entries: readonly UIRegistryEntry[];
  features: readonly FeatureRegistryEntry[];
};

function writeInspectorQuery(enabled: boolean) {
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set('uiInspector', '1');
  else url.searchParams.delete('uiInspector');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Optional, production-safe inspector. It renders nothing unless explicitly
 * enabled by ?uiInspector=1 or Alt+Shift+I. Registry JSON is loaded on demand.
 */
export function UIRegistryInspector() {
  const [enabled, setEnabled] = useState(false);
  const [targets, setTargets] = useState<InspectedTarget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistrySnapshot | null>(null);
  const [registryLoadFailed, setRegistryLoadFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const lastSignature = useRef('');

  const setInspectorEnabled = useCallback((next: boolean) => {
    setEnabled(next);
    writeInspectorQuery(next);
    if (!next) {
      setTargets([]);
      setSelectedId(null);
      setSelectedInstance(null);
      setCopyStatus('');
    }
  }, []);

  // A query parameter deliberately works in production builds and on Vercel
  // Preview. The keyboard shortcut is also available when the overlay is off.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('uiInspector') === '1') {
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        setInspectorEnabled(!enabled);
      }
      if (event.key === 'Escape') {
        setSelectedId(null);
        setSelectedInstance(null);
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
          entries: uiRegistry.UI_REGISTRY,
          features: featureRegistry.FEATURE_REGISTRY,
        });
      })
      .catch(() => {
        if (!cancelled) setRegistryLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    setCopyStatus('');
  }, [selectedId]);

  useEffect(() => {
    if (!enabled) {
      setTargets([]);
      setSelectedId(null);
      lastSignature.current = '';
      return;
    }

    // Alt+click inspects the exact registered control without invoking its
    // action. Ordinary clicks remain completely unchanged.
    const inspectClick = (event: MouseEvent) => {
      if (!event.altKey || !(event.target instanceof Element)) return;
      if (event.target.closest('[data-ui-inspector-root]')) return;
      const target = event.target.closest('[data-ui-id]');
      const id = target?.getAttribute('data-ui-id');
      if (!target || !id) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      setSelectedId(id);
      setSelectedInstance(
        target.getAttribute('data-ui-instance') ??
          target.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ??
          null
      );
    };
    window.addEventListener('click', inspectClick, true);

    let frame: number | null = null;
    const resizeObserver = new ResizeObserver(schedule);

    function schedule() {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const nodes = Array.from(document.querySelectorAll<Element>('[data-ui-id]'))
          .filter((node) => !node.closest('[data-ui-inspector-root]'));
        resizeObserver.disconnect();

        const next = nodes.flatMap((node, index): Array<InspectedTarget & { keyIndex: number }> => {
          const rect = node.getBoundingClientRect();
          if (
            rect.width <= 0 || rect.height <= 0 ||
            rect.bottom < 0 || rect.top > window.innerHeight ||
            rect.right < 0 || rect.left > window.innerWidth
          ) return [];

          const id = node.getAttribute('data-ui-id');
          if (!id) return [];
          resizeObserver.observe(node);

          const badgeHeight = 16;
          const top = rect.top >= badgeHeight + 3
            ? rect.top - badgeHeight - 2
            : rect.bottom + badgeHeight + 2 <= window.innerHeight
              ? rect.bottom + 2
              : Math.max(0, Math.min(rect.top, window.innerHeight - badgeHeight));
          const left = Math.max(0, Math.min(rect.left, Math.max(0, window.innerWidth - 58)));

          return [{
            id,
            instance: node.getAttribute('data-ui-instance') ??
              node.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ??
              null,
            left,
            top,
            keyIndex: index,
          }];
        });

        const signature = next
          .map((target) => `${target.id}:${target.instance ?? ''}:${Math.round(target.left)}:${Math.round(target.top)}:${target.keyIndex}`)
          .join('|');
        if (signature !== lastSignature.current) {
          lastSignature.current = signature;
          setTargets(next.map(({ keyIndex: _keyIndex, ...target }) => target));
        }
      });
    }

    const observer = new MutationObserver((records) => {
      const appMutation = records.some((record) => {
        const target = record.target instanceof Element
          ? record.target
          : record.target.parentElement;
        return !target?.closest('[data-ui-inspector-root]');
      });
      if (appMutation) schedule();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-ui-id', 'data-ui-instance', 'class', 'style', 'hidden'],
      });
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();

    return () => {
      window.removeEventListener('click', inspectClick, true);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;

  const selected = selectedId
    ? registry?.entries.find((entry) => entry.id === selectedId)
    : undefined;
  const feature = selected
    ? registry?.features.find((entry) => entry.id === selected.featureId)
    : undefined;
  const parent = selected?.parentId
    ? registry?.entries.find((entry) => entry.id === selected.parentId) ??
      registry?.features.find((entry) => entry.id === selected.parentId)
    : undefined;

  const copySelectedId = async () => {
    if (!selectedId) return;
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

  return (
    <div data-ui-id="A730" className="contents" data-ui-inspector-root>
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
        {targets.map((target, index) => (
          <span
            data-ui-instance={target.instance ?? undefined}
            data-ui-id="A731"
            data-ui-badge-for={target.id}
            key={`${target.id}:${target.instance ?? index}:${index}`}
            title={`${target.id}${target.instance ? ` · ${target.instance}` : ''} — Alt+click the actual control for Registry details`}
            className="pointer-events-none absolute rounded-sm border border-fuchsia-200 bg-fuchsia-700/95 px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-white shadow"
            style={{ left: target.left, top: target.top }}
          >
            {target.id}
          </span>
        ))}
      </div>

      {selectedId && (
        <aside
          data-ui-id="A412"
          data-ui-inspector-details
          role="dialog"
          aria-label="UI ID Inspector details"
          aria-keyshortcuts="Escape"
          className="fixed bottom-14 start-3 z-[10001] max-h-[70vh] w-[min(32rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-left text-xs text-slate-100 shadow-2xl"
          dir="ltr"
        >
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-700 pb-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">UI ID Inspector</p>
              <p className="mt-1 text-[10px] text-slate-400">
                Alt+click an app control to inspect it. Ordinary clicks still work. Press Escape to close details.
              </p>
              {selectedInstance && (
                <p className="mt-1 font-mono text-[10px] text-slate-400">Instance: {selectedInstance}</p>
              )}
            </div>
            <button
              data-ui-id="A732"
              type="button"
              onClick={() => void copySelectedId()}
              disabled={!selected}
              className="shrink-0 rounded border border-fuchsia-400 px-2 py-1 font-semibold text-fuchsia-200 hover:bg-fuchsia-950 disabled:opacity-50"
              title="Copy the selected DOM element's real UI ID"
            >
              {copyStatus || 'Copy ID'}
            </button>
          </div>

          {selected ? (
            <>
              <p className="mb-3 font-mono text-base font-bold text-fuchsia-300" data-ui-inspector-selected-id>
                {selected.id}
              </p>
              <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 leading-relaxed">
                <dt className="text-slate-400">Name</dt><dd>{selected.name}</dd>
                <dt className="text-slate-400">Kind</dt><dd>{selected.kind}</dd>
                <dt className="text-slate-400">Route</dt><dd className="font-mono">{selected.route}</dd>
                <dt className="text-slate-400">Parent ID</dt>
                <dd className="font-mono">{selected.parentId ?? '—'}{parent?.name ? ` — ${parent.name}` : ''}</dd>
                <dt className="text-slate-400">Feature ID</dt>
                <dd className="font-mono">{selected.featureId}{feature?.name ? ` — ${feature.name}` : ''}</dd>
                <dt className="text-slate-400">Component</dt><dd className="font-mono">{selected.component}</dd>
                <dt className="text-slate-400">Source file</dt><dd className="break-all font-mono">{selected.sourceFile}</dd>
                <dt className="text-slate-400">Action / handler</dt>
                <dd className="whitespace-pre-wrap break-all font-mono">
                  {selected.actions?.map((action) => `${action.event}: ${action.expression}`).join('\n') || 'No handler recorded in the Registry'}
                </dd>
                <dt className="text-slate-400">Related IDs</dt>
                <dd className="break-all font-mono">{selected.relatedIds.join(', ') || '—'}</dd>
                <dt className="text-slate-400">Description</dt><dd>{selected.description}</dd>
              </dl>
            </>
          ) : registryLoadFailed ? (
            <p className="text-rose-300">Registry metadata could not be loaded; no fallback identity was invented.</p>
          ) : (
            <p className="text-slate-300">Loading the checked-in Registry entry for {selectedId}…</p>
          )}
        </aside>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { getFeatureById } from '@/ui/feature-registry';
import { getUIEntryById, getUIIdentity } from '@/ui/ui-registry';

type InspectedTarget = {
  id: string;
  instance: string | null;
  left: number;
  top: number;
  node: HTMLElement;
};

/** Development-only DOM identity overlay. It never participates in app behavior. */
export function UIRegistryInspector() {
  const [enabled, setEnabled] = useState(false);
  const [targets, setTargets] = useState<InspectedTarget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const lastSignature = useRef('');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        setEnabled((value) => !value);
      }
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!enabled) {
      setTargets([]);
      setSelectedId(null);
      lastSignature.current = '';
      return;
    }

    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-ui-id]'))
          .filter((node) => !node.closest('[data-ui-inspector-root]'));
        resizeObserver.disconnect();
        const next = nodes.flatMap((node): InspectedTarget[] => {
          const rect = node.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > window.innerHeight) return [];
          resizeObserver.observe(node);
          return [{
            id: node.dataset.uiId ?? '',
            instance: node.dataset.uiInstance ?? null,
            left: Math.max(0, Math.min(rect.left, window.innerWidth - 58)),
            top: Math.max(0, Math.min(rect.top, window.innerHeight - 25)),
            node,
          }];
        });
        const signature = next.map((target) => `${target.id}:${target.instance ?? ''}:${Math.round(target.left)}:${Math.round(target.top)}:${target.node.dataset.uiId}`).join('|');
        if (signature !== lastSignature.current) {
          lastSignature.current = signature;
          setTargets(next);
        }
      });
    };
    const resizeObserver = new ResizeObserver(schedule);

    const observer = new MutationObserver((records) => {
      const appMutation = records.some((record) => {
        const target = record.target instanceof Element
          ? record.target
          : record.target.parentElement;
        return !target?.closest('[data-ui-inspector-root]');
      });
      if (appMutation) schedule();
    });

    if (document.body) observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-ui-id', 'data-ui-instance', 'class', 'style', 'hidden'],
    });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (process.env.NODE_ENV !== 'development') return null;

  const selected = selectedId ? getUIEntryById(selectedId) : undefined;
  const feature = selected ? getFeatureById(selected.featureId) : undefined;
  const parent = selected ? getUIIdentity(selected.parentId) : undefined;

  return (
    <div className="contents" data-ui-inspector-root>
      <button
        type="button"
        data-ui-id="A410"
        onClick={() => setEnabled((value) => !value)}
        aria-pressed={enabled}
        title="UI Registry Inspector (Alt+Shift+I)"
        className="fixed bottom-3 start-3 z-[10000] rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white shadow-xl hover:bg-slate-800"
      >
        UI IDs {enabled ? 'ON' : 'OFF'}
      </button>

      {enabled && (
        <div
          data-ui-id="A411"
          className="pointer-events-none fixed inset-0 z-[9998]"
          aria-hidden="true"
        >
          {targets.map((target, index) => (
            <button
              key={`${target.id}:${target.instance ?? index}:${index}`}
              type="button"
              tabIndex={-1}
              data-ui-inspector-ignore
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setSelectedId(target.id);
                setSelectedInstance(target.instance);
              }}
              title={`${target.id}${target.instance ? ` · ${target.instance}` : ''} — click for registry details`}
              className="pointer-events-auto absolute rounded-sm border border-fuchsia-200 bg-fuchsia-700/95 px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-white shadow"
              style={{ left: target.left, top: target.top }}
            >
              {target.id}
            </button>
          ))}
        </div>
      )}

      {enabled && selectedId && (
        <aside
          data-ui-id="A412"
          role="dialog"
          aria-label="UI Registry identity details"
          className="fixed bottom-14 start-3 z-[10001] max-h-[70vh] w-[min(30rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-left text-xs text-slate-100 shadow-2xl"
          dir="ltr"
        >
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-700 pb-2">
            <div>
              <p className="font-mono text-sm font-bold text-fuchsia-300">{selectedId}</p>
              <p className="mt-1 text-sm font-semibold">{selected?.name ?? 'Unregistered UI ID'}</p>
              {selectedInstance && <p className="mt-1 font-mono text-[10px] text-slate-400">Instance: {selectedInstance}</p>}
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="rounded border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800">Close</button>
          </div>
          {selected ? (
            <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 leading-relaxed">
              <dt className="text-slate-400">Type</dt><dd>{selected.kind}</dd>
              <dt className="text-slate-400">Feature</dt><dd>{feature ? `${feature.id} — ${feature.name}` : selected.featureId}</dd>
              <dt className="text-slate-400">Parent</dt><dd>{parent ? `${parent.id} — ${parent.name}` : selected.parentId}</dd>
              <dt className="text-slate-400">Route</dt><dd className="font-mono">{selected.route}</dd>
              <dt className="text-slate-400">Component</dt><dd className="font-mono">{selected.component}</dd>
              <dt className="text-slate-400">Source</dt><dd className="break-all font-mono">{selected.sourceFile}</dd>
              <dt className="text-slate-400">Purpose</dt><dd>{selected.description}</dd>
              <dt className="text-slate-400">Behavior</dt><dd>{selected.behavior}</dd>
              <dt className="text-slate-400">Constraints</dt><dd>{selected.constraints}</dd>
              <dt className="text-slate-400">Status</dt><dd>{selected.status}</dd>
              <dt className="text-slate-400">Dependencies</dt><dd className="font-mono">{selected.dependencies.join(', ') || '—'}</dd>
              <dt className="text-slate-400">Related IDs</dt><dd className="font-mono">{selected.relatedIds.join(', ') || '—'}</dd>
              <dt className="text-slate-400">Code refs</dt><dd className="break-words font-mono">{selected.codeReferences.join(', ') || '—'}</dd>
            </dl>
          ) : (
            <p className="text-rose-300">This DOM marker is not present in the registry.</p>
          )}
        </aside>
      )}
    </div>
  );
}

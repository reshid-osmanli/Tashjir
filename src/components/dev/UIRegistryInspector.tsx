'use client';

// مفتّش هوية الواجهة — UI ID Inspector
//
// طبقة فحص مرئية فوق عناصر `data-ui-id` المسجلة في UI Registry.
// تعمل في التطوير AND في Production (Vercel Preview): لا توجد أي بوابة
// NODE_ENV هنا. طرق التفعيل:
//   1. الزر العائم "UI Inspector" (مرئي دائمًا)
//   2. معامل URL: ?uiInspector=1
//   3. الاختصار: Alt+Shift+I
//
// عند التفعيل: شارة صغيرة فوق كل عنصر مسجل تحمل معرّفه الحقيقي.
// عند الضغط على عنصر: بطاقة تُظهر بياناته الفعلية من السجل.
// عند الإيقاف: تختفي كل الشارات ويعود الموقع لسلوكه الطبيعي.

import { useCallback, useEffect, useRef, useState } from 'react';

type UIRegistryModule = typeof import('@/ui/ui-registry');
type FeatureRegistryModule = typeof import('@/ui/feature-registry');

type InspectedTarget = {
  id: string;
  instance: string | null;
  left: number;
  top: number;
};

const ACTIVATION_PARAM = 'uiInspector';
const BADGE_MAX_WIDTH = 96;
const BADGE_HEIGHT = 16;

function isActivationRequested(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get(ACTIVATION_PARAM) === '1' || params.get('ui-inspector') === '1';
}

function syncActivationParam(enabled: boolean) {
  try {
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set(ACTIVATION_PARAM, '1');
    else url.searchParams.delete(ACTIVATION_PARAM);
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // ignore: failure to reflect the param in the URL must never break the toggle
  }
}

/** DOM identity overlay. It never participates in app behavior. */
export function UIRegistryInspector() {
  const [enabled, setEnabled] = useState(false);
  const [targets, setTargets] = useState<InspectedTarget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uiRegistry, setUiRegistry] = useState<UIRegistryModule | null>(null);
  const [featureRegistry, setFeatureRegistry] = useState<FeatureRegistryModule | null>(null);
  const lastSignature = useRef('');
  const registryRequested = useRef(false);

  const toggle = useCallback(() => {
    setEnabled((value) => {
      const next = !value;
      syncActivationParam(next);
      return next;
    });
  }, []);

  // ?uiInspector=1 — read once on mount (client only, no hydration mismatch).
  useEffect(() => {
    if (isActivationRequested()) setEnabled(true);
  }, []);

  // Alt+Shift+I toggles; Escape closes the details card.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        toggle();
      }
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  // The 1700+ record registry is loaded lazily, only when the inspector is
  // first enabled, so production pages do not pay for it in the main bundle.
  useEffect(() => {
    if (!enabled || registryRequested.current) return;
    registryRequested.current = true;
    let cancelled = false;
    void import('@/ui/ui-registry').then((module) => {
      if (!cancelled) setUiRegistry(module);
    });
    void import('@/ui/feature-registry').then((module) => {
      if (!cancelled) setFeatureRegistry(module);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // While enabled: scan registered elements and select on click (capture).
  // Plain clicks AND Alt+clicks select the nearest [data-ui-id] ancestor and
  // suppress the app action — the badges themselves are pointer-events:none,
  // so they can never block interaction. When disabled, nothing is attached.
  useEffect(() => {
    if (!enabled) {
      setTargets([]);
      setSelectedId(null);
      lastSignature.current = '';
      return;
    }

    const inspectClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-ui-inspector-root]')) return;
      const target = event.target.closest('[data-ui-id]');
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSelectedId(target.getAttribute('data-ui-id'));
      setSelectedInstance(target.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ?? null);
      setCopied(false);
    };
    window.addEventListener('click', inspectClick, true);

    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const nodes = Array.from(document.querySelectorAll<HTMLElement | SVGElement>('[data-ui-id]'))
          .filter((node) => !node.closest('[data-ui-inspector-root]'));
        resizeObserver.disconnect();
        const next = nodes.flatMap((node): InspectedTarget[] => {
          const rect = node.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > window.innerHeight) return [];
          resizeObserver.observe(node);
          const above = rect.top >= BADGE_HEIGHT + 4;
          return [{
            id: node.dataset.uiId ?? '',
            instance: node.dataset.uiInstance ?? node.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ?? null,
            left: Math.max(0, Math.min(rect.left, window.innerWidth - BADGE_MAX_WIDTH)),
            top: above ? rect.top - BADGE_HEIGHT - 2 : Math.max(0, rect.top + 2),
          }];
        });
        const signature = next.map((target) => `${target.id}:${target.instance ?? ''}:${Math.round(target.left)}:${Math.round(target.top)}`).join('|');
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
      window.removeEventListener('click', inspectClick, true);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  const copyId = useCallback(async () => {
    if (!selectedId) return;
    try {
      await navigator.clipboard.writeText(selectedId);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = selectedId;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [selectedId]);

  const selected = selectedId && uiRegistry ? uiRegistry.getUIEntryById(selectedId) : undefined;
  const feature = selected && featureRegistry ? featureRegistry.getFeatureById(selected.featureId) : undefined;
  const parent = selected?.parentId && uiRegistry ? uiRegistry.getUIIdentity(selected.parentId) : undefined;

  return (
    <div data-ui-id="A730" className="contents" data-ui-inspector-root>
      <button
        type="button"
        data-ui-id="A410"
        onClick={toggle}
        aria-pressed={enabled}
        title="UI ID Inspector — ?uiInspector=1 أو Alt+Shift+I"
        className="fixed bottom-3 start-3 z-[10000] rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white shadow-xl hover:bg-slate-800"
      >
        UI Inspector {enabled ? 'ON' : 'OFF'}
      </button>

      {enabled && (
        <div
          data-ui-id="A411"
          className="pointer-events-none fixed inset-0 z-[9998]"
          aria-hidden="true"
        >
          {targets.map((target, index) => (
            <button data-ui-instance={String(target.id)} data-ui-id="A731"
              key={`${target.id}:${target.instance ?? index}:${index}`}
              type="button"
              tabIndex={-1}
              data-ui-inspector-ignore
              title={`${target.id}${target.instance ? ` · ${target.instance}` : ''}`}
              className="pointer-events-none absolute rounded-sm border border-fuchsia-200 bg-fuchsia-700/95 px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-white shadow"
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
              <p className="mt-1 text-[10px] text-slate-400">Click any registered UI control while the inspector is on.</p>
              {selectedInstance && <p className="mt-1 font-mono text-[10px] text-slate-400">Instance: {selectedInstance}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                data-ui-id="A2126"
                type="button"
                onClick={() => void copyId()}
                className="rounded border border-emerald-500 px-2 py-1 font-semibold text-emerald-300 hover:bg-emerald-950"
              >
                {copied ? '✓ Copied' : 'Copy ID'}
              </button>
              <button data-ui-id="A732" type="button" onClick={() => setSelectedId(null)} className="rounded border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800">Close</button>
            </div>
          </div>
          {!uiRegistry ? (
            <p className="text-slate-400">Loading registry data…</p>
          ) : selected ? (
            <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 leading-relaxed">
              <dt className="text-slate-400">UI ID</dt><dd className="font-mono font-bold text-fuchsia-300">{selected.id}</dd>
              <dt className="text-slate-400">Name</dt><dd>{selected.name}</dd>
              <dt className="text-slate-400">Kind</dt><dd>{selected.kind}</dd>
              <dt className="text-slate-400">Route</dt><dd className="font-mono">{selected.route}</dd>
              <dt className="text-slate-400">Parent ID</dt><dd>{parent ? `${parent.id} — ${parent.name}` : selected.parentId ?? '—'}</dd>
              <dt className="text-slate-400">Feature ID</dt><dd>{feature ? `${feature.id} — ${feature.name}` : selected.featureId}</dd>
              <dt className="text-slate-400">Component</dt><dd className="font-mono">{selected.component}</dd>
              <dt className="text-slate-400">Source file</dt><dd className="break-all font-mono">{selected.sourceFile}</dd>
              <dt className="text-slate-400">Actions</dt><dd className="whitespace-pre-wrap break-all font-mono">{selected.actions?.map(action => `${action.event}: ${action.expression}`).join('\n') || '—'}</dd>
              <dt className="text-slate-400">Related IDs</dt><dd className="font-mono">{selected.relatedIds.join(', ') || '—'}</dd>
              <dt className="text-slate-400">Purpose</dt><dd>{selected.description}</dd>
              <dt className="text-slate-400">Behavior</dt><dd className="whitespace-pre-wrap">{selected.behavior}</dd>
              <dt className="text-slate-400">Stores</dt><dd className="break-all font-mono">{selected.stores?.join(', ') || '—'}</dd>
              <dt className="text-slate-400">Logic</dt><dd className="break-all font-mono">{selected.logicFiles?.join(', ') || '—'}</dd>
              <dt className="text-slate-400">Tests</dt><dd className="break-all font-mono">{selected.testFiles?.join(', ') || '—'}</dd>
              <dt className="text-slate-400">Shortcut</dt><dd>{selected.shortcuts?.join(', ') || '—'}</dd>
              <dt className="text-slate-400">Identity</dt><dd>{selected.identity}</dd>
              <dt className="text-slate-400">Constraints</dt><dd>{selected.constraints}</dd>
              <dt className="text-slate-400">Status</dt><dd>{selected.status}</dd>
              <dt className="text-slate-400">Dependencies</dt><dd className="font-mono">{selected.dependencies.join(', ') || '—'}</dd>
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

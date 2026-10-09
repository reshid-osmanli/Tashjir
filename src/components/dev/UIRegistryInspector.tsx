'use client';

// فاحص هويات الواجهة — UI ID Inspector
// مشروع التشجير - نظام القراءات العشر
//
// طبقة فحص مرئية فوق الواجهة الحقيقية: تعرض شارة تحتوي معرف السجل
// (data-ui-id) فوق كل عنصر مرئي، ولوحة تفاصيل عند اختيار عنصر.
//
// متاح في كل البيئات — بما فيها بناء الإنتاج على Vercel Preview —
// لأن الحجب بـ NODE_ENV يمنع ظهوره على النشر المنشور أصلًا.
//
// التفعيل (كلها مكافئة):
//   1. زر مرئي ثابت في أسفل بداية الشاشة (A410).
//   2. معامل الرابط ?uiInspector=1 (و?uiInspector=0 للإيقاف).
//   3. اختصار Alt+Shift+I.
//
// قواعد عدم التدخل:
//   - الشارات تُرسم فوق حافة العنصر العلوية (خارجه متى أمكن) ولا تحجب نقره.
//   - النقر العادي يمر كما هو؛ لا يُعترض أي حدث للتطبيق.
//   - اختيار عنصر للفحص يكون بنقر شارته، أو Alt+نقر العنصر نفسه.
//   - عند الإيقاف تُفكك الطبقة كاملة ويعود الموقع إلى مظهره الطبيعي.

import { useEffect, useRef, useState } from 'react';
import { getFeatureById } from '@/ui/feature-registry';
import { getUIEntryById, getUIIdentity } from '@/ui/ui-registry';

const STORAGE_KEY = 'tashjir-ui-inspector';
const URL_PARAM = 'uiInspector';

type InspectedTarget = {
  id: string;
  instance: string | null;
  registered: boolean;
  left: number;
  top: number;
  width: number;
  node: Element;
};

/** يقرأ حالة التفعيل الأولية: معامل الرابط يعلو على تخزين الجلسة. */
function readInitialState(): boolean {
  if (typeof window === 'undefined') return false;
  const param = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (param === '1' || param === 'true') return true;
  if (param === '0' || param === 'false') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function UIRegistryInspector() {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [targets, setTargets] = useState<InspectedTarget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const lastSignature = useRef('');

  // التفعيل الأولي من الرابط/الجلسة، ثم الاستماع لمعامل الرابط عند التنقل.
  useEffect(() => {
    setEnabled(readInitialState());
    setHydrated(true);
    const onPopState = () => {
      const param = new URLSearchParams(window.location.search).get(URL_PARAM);
      if (param === '1' || param === 'true') setEnabled(true);
      else if (param === '0' || param === 'false') setEnabled(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // حفظ الحالة في تخزين الجلسة (للتبويب الحالي فقط) حتى تصمد عبر إعادة التحميل.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // تخزين الجلسة قد يكون محظورًا؛ الفحص يعمل بدونه.
    }
  }, [enabled, hydrated]);

  // اختصار Alt+Shift+I للتبديل، وEscape لإغلاق لوحة التفاصيل.
  useEffect(() => {
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
    if (!enabled) {
      setTargets([]);
      setSelectedId(null);
      setSelectedInstance(null);
      lastSignature.current = '';
      return;
    }

    // Alt+نقر يحدد العنصر الفعلي دون تفعيله؛ النقر العادي يمر بلا اعتراض.
    const inspectClick = (event: MouseEvent) => {
      if (!event.altKey || !(event.target instanceof Element)) return;
      if (event.target.closest('[data-ui-inspector-root]')) return;
      const target = event.target.closest('[data-ui-id]');
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSelectedId(target.getAttribute('data-ui-id'));
      setSelectedInstance(target.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ?? null);
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
          // العناصر المخفية أو خارج الشاشة لا تحتاج شارة.
          if (rect.width <= 0 || rect.height <= 0) return [];
          if (rect.bottom < 0 || rect.top > window.innerHeight) return [];
          if (rect.right < 0 || rect.left > window.innerWidth) return [];
          resizeObserver.observe(node);
          const id = node.getAttribute('data-ui-id') ?? '';
          // الشارة فوق الحافة العلوية للعنصر (خارجه) ما أمكن، ولا تحجب وسطه.
          const badgeHeight = 16;
          const top = rect.top >= badgeHeight + 4 ? rect.top - badgeHeight - 2 : Math.max(2, rect.top);
          const badgeWidth = 14 + id.length * 7;
          return [{
            id,
            instance: node.getAttribute('data-ui-instance') ?? node.closest('[data-ui-instance]')?.getAttribute('data-ui-instance') ?? null,
            registered: Boolean(getUIEntryById(id)),
            left: Math.max(2, Math.min(rect.left, window.innerWidth - badgeWidth - 2)),
            top,
            width: badgeWidth,
            node,
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

    // العناصر المنشأة ديناميكيًا (نوافذ/قوائم) تُرصد لحظيًا.
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

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  const selected = selectedId ? getUIEntryById(selectedId) : undefined;
  const feature = selected ? getFeatureById(selected.featureId) : undefined;
  const parent = selected?.parentId ? getUIIdentity(selected.parentId) : undefined;

  const copySelectedId = async () => {
    if (!selectedId) return;
    try {
      await navigator.clipboard.writeText(selectedId);
    } catch {
      // الحافظة قد تكون محظورة؛ نعرض المعرف محددًا بديلًا عن النسخ.
      window.prompt('انسخ المعرف يدويًا:', selectedId);
    }
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div data-ui-id="A730" className="contents" data-ui-inspector-root>
      <button
        type="button"
        data-ui-id="A410"
        onClick={() => setEnabled((value) => !value)}
        aria-pressed={enabled}
        title="UI ID Inspector — إظهار معرفات عناصر الواجهة (Alt+Shift+I أو ?uiInspector=1)"
        className="fixed bottom-3 start-3 z-[10000] rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white shadow-xl hover:bg-slate-800"
      >
        UI ID Inspector {enabled ? 'ON' : 'OFF'}
      </button>

      {enabled && (
        <div
          data-ui-id="A411"
          className="pointer-events-none fixed inset-0 z-[9998]"
        >
          {targets.map((target, index) => (
            <button data-ui-instance={String(target.id)} data-ui-target-id={target.id} data-ui-id="A731"
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
              title={`${target.id}${target.instance ? ` · ${target.instance}` : ''}${getUIEntryById(target.id) ? ` — ${getUIEntryById(target.id)!.name}` : ' — غير مسجل في السجل'}`}
              className={`pointer-events-auto absolute rounded-sm border px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-white shadow ${
                target.registered ? 'border-fuchsia-200 bg-fuchsia-700/95' : 'border-rose-200 bg-rose-700/95'
              }`}
              style={{ left: target.left, top: target.top, minWidth: target.width }}
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
              <p className="mt-1 text-[10px] text-slate-400">انقر شارة العنصر أو Alt+انقر العنصر نفسه لفحصه.</p>
              {selectedInstance && <p className="mt-1 font-mono text-[10px] text-slate-400">Instance: {selectedInstance}</p>}
            </div>
            <button data-ui-id="A732" type="button" onClick={() => setSelectedId(null)} className="rounded border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800">Close</button>
          </div>
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <button data-ui-id="A2126" type="button" onClick={() => void copySelectedId()} className="rounded border border-fuchsia-400 bg-fuchsia-700/40 px-2 py-1 font-semibold text-fuchsia-100 hover:bg-fuchsia-700/70">
                  {copied ? 'Copied ✓' : 'Copy ID'}
                </button>
              </div>
              <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 leading-relaxed">
                <dt className="text-slate-400">Type</dt><dd>{selected.kind}</dd>
                <dt className="text-slate-400">Feature</dt><dd>{feature ? `${feature.id} — ${feature.name}` : selected.featureId}</dd>
                <dt className="text-slate-400">Parent</dt><dd>{parent ? `${parent.id} — ${parent.name}` : selected.parentId}</dd>
                <dt className="text-slate-400">Route</dt><dd className="font-mono">{selected.route}</dd>
                <dt className="text-slate-400">Component</dt><dd className="font-mono">{selected.component}</dd>
                <dt className="text-slate-400">Source</dt><dd className="break-all font-mono">{selected.sourceFile}</dd>
                <dt className="text-slate-400">Purpose</dt><dd>{selected.description}</dd>
                <dt className="text-slate-400">Behavior</dt><dd className="whitespace-pre-wrap">{selected.behavior}</dd>
                <dt className="text-slate-400">Actions</dt><dd className="whitespace-pre-wrap break-all font-mono">{selected.actions?.map(action => `${action.event}: ${action.expression}`).join('\n') || '—'}</dd>
                <dt className="text-slate-400">Stores</dt><dd className="break-all font-mono">{selected.stores?.join(', ') || '—'}</dd>
                <dt className="text-slate-400">Logic</dt><dd className="break-all font-mono">{selected.logicFiles?.join(', ') || '—'}</dd>
                <dt className="text-slate-400">Tests</dt><dd className="break-all font-mono">{selected.testFiles?.join(', ') || '—'}</dd>
                <dt className="text-slate-400">Shortcut</dt><dd>{selected.shortcuts?.join(', ') || '—'}</dd>
                <dt className="text-slate-400">Identity</dt><dd>{selected.identity}</dd>
                <dt className="text-slate-400">Constraints</dt><dd>{selected.constraints}</dd>
                <dt className="text-slate-400">Status</dt><dd>{selected.status}</dd>
                <dt className="text-slate-400">Dependencies</dt><dd className="font-mono">{selected.dependencies.join(', ') || '—'}</dd>
                <dt className="text-slate-400">Related IDs</dt><dd className="font-mono">{selected.relatedIds.join(', ') || '—'}</dd>
                <dt className="text-slate-400">Code refs</dt><dd className="break-words font-mono">{selected.codeReferences.join(', ') || '—'}</dd>
              </dl>
            </>
          ) : (
            <p className="text-rose-300">هذا المعرّف موجود في DOM لكنه غير مسجل في ui-registry.records.json.</p>
          )}
        </aside>
      )}
    </div>
  );
}

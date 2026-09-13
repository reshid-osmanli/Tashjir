'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { coalesceLineOrder, moveLineToIndex } from '@/lib/tashjeer/manual-links';
import { planLineInsertion } from '@/lib/tashjeer/line-operations';
import { confirmAction } from '@/lib/ui/confirm-store';
import { toArabicDigits as ar } from '@/lib/utils/arabic-numbers';
import { useEditorStore } from '@/stores/editor-store';

type Drag = { id: string; mode: 'ORDER' | 'MERGE'; gap: number | null; target: string | null };

/** Pointer Events only: mouse, pen and touch share the same 350 ms gesture. */
export function LineOrderEditor({ classic }: { classic: ClassicTashjeer }) {
  const document = useEditorStore((s) => s.document);
  const filter = useEditorStore((s) => s.filter);
  const isFiltered = filter.categories.length !== 6 || filter.narratorIds.length > 0 || Boolean(document?.readingWindow?.focusSegment);
  const selection = useEditorStore((s) => s.selection);
  const ids = useMemo(() => coalesceLineOrder(document?.lineOrder, classic.lines.map((line) => line.id)), [document?.lineOrder, classic.lines]);
  const lines = ids.map((id) => classic.lines.find((line) => line.id === id)!);
  const list = useRef<HTMLOListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef<{ x: number; y: number; pointerId: number; element: HTMLElement } | null>(null);
  const active = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);
  const [notice, setNotice] = useState('');

  const update = useCallback((next: Drag | null) => { active.current = next; setDrag(next); }, []);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const captured = press.current;
    press.current = null;
    if (captured?.element.hasPointerCapture(captured.pointerId)) captured.element.releasePointerCapture(captured.pointerId);
    update(null);
  }, [update]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (press.current || active.current)) {
        event.preventDefault(); event.stopImmediatePropagation(); clear();
      }
    };
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('keydown', escape, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [clear]);
  useEffect(() => { clear(); }, [document, classic, clear]);

  const confirmOrder = async (id: string, order: string[]) => {
    if (isFiltered) { setNotice('ألغِ تصفية الأسطر قبل النقل لحماية ترتيب الأسطر المخفية.'); return; }
    if (!document || ids.every((item, index) => item === order[index])) return;
    if (document.lines?.some((line) => line.locked && order.includes(line.id) && order.indexOf(line.id) !== ids.indexOf(line.id))) { setNotice('يتأثر سطر مقفل؛ لم يُنقل أي سطر.'); return; }
    const rank = order.indexOf(id) + 1;
    const left = order[rank - 2];
    const right = order[rank];
    const label = (neighbor: string) => `السطر ${ar(ids.indexOf(neighbor) + 1)}`;
    const hint = left && right ? `بين ${label(left)} و${label(right)}` : left ? `بعد ${label(left)}` : `قبل ${label(right)}`;
    const accepted = await confirmAction({
      title: `نقل السطر ${ar(ids.indexOf(id) + 1)} إلى هذا الموضع؟`,
      message: `${hint} — رتبته النهائية ${ar(rank)}. تبقى المعرّفات والأجزاء والعلاقات كما هي.`,
      impacts: [{ label: 'أسطر متأثرة', count: ids.filter((item, index) => item !== order[index]).length }],
      undoable: true, confirmLabel: 'تأكيد', tone: 'default',
    });
    if (!accepted) return;
    if (useEditorStore.getState().document !== document) { setNotice('تغيّر المستند أثناء التأكيد؛ أعد طلب النقل.'); return; }
    useEditorStore.getState().setLineOrder(order, lines);
    setNotice(`نُقل السطر إلى الرتبة ${ar(rank)}. يمكن التراجع.`);
  };

  const merge = async (from: string, to: string) => {
    setNotice(await useEditorStore.getState().requestMergeLines(lines, from, to));
  };

  const down = (event: React.PointerEvent<HTMLElement>, id: string, mode: Drag['mode']) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (isFiltered) { setNotice('ألغِ التصفية قبل السحب لحماية الأسطر المخفية.'); return; }
    if (mode === 'ORDER' && (event.target as HTMLElement).closest('button,input')) return;
    event.stopPropagation();
    clear(); suppressClick.current = false;
    const element = event.currentTarget;
    press.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, element };
    element.setPointerCapture(event.pointerId);
    timer.current = setTimeout(() => {
      timer.current = null; suppressClick.current = true;
      update({ id, mode, gap: null, target: null });
    }, 350);
  };
  const move = (event: React.PointerEvent) => {
    if (!press.current || event.pointerId !== press.current.pointerId) return;
    event.stopPropagation();
    if (!active.current) {
      if (Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 7) clear();
      return;
    }
    event.preventDefault();
    const box = list.current?.getBoundingClientRect();
    if (!box || event.clientX < box.left || event.clientX > box.right || event.clientY < box.top - 24 || event.clientY > box.bottom + 24) {
      update({ ...active.current, gap: null, target: null }); return;
    }
    if (event.clientY < box.top + 28) list.current!.scrollTop -= 18;
    if (event.clientY > box.bottom - 28) list.current!.scrollTop += 18;
    const rows = Array.from(list.current!.querySelectorAll<HTMLElement>('[data-order-line-id]'));
    const row = rows.find((item) => event.clientY < item.getBoundingClientRect().bottom) ?? rows.at(-1);
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const index = Number(row.dataset.orderIndex);
    update({ ...active.current, gap: event.clientY < rect.top + rect.height / 2 ? index : index + 1, target: row.dataset.orderLineId ?? null });
  };
  const up = (event: React.PointerEvent) => {
    if (!press.current || event.pointerId !== press.current.pointerId) return;
    event.stopPropagation();
    const value = active.current;
    clear();
    if (!value) return;
    if (value.mode === 'MERGE' && value.target) void merge(value.id, value.target);
    else if (value.gap !== null) {
      const plan = planLineInsertion(ids, value.id, value.gap);
      if (plan) void confirmOrder(value.id, plan.order);
    }
  };

  return <div dir="rtl" className="rounded-md border border-stone-200 p-2.5">
    <p className="mb-2 text-[11px] text-stone-600">اضغط مطولًا على السطر ثم اسحب. ↳ للدمج. Alt+↑/↓ للنقل مع التأكيد. Esc للإلغاء.</p>
    {document?.lineOrder?.length ? <button type="button" className="mb-2 text-xs text-emerald-800" onClick={async () => {
      if (await confirmAction({ title: 'عودة لترتيب المحرك؟', impacts: [{ label: 'أسطر', count: ids.length }], undoable: true })) {
        if (useEditorStore.getState().document === document) useEditorStore.getState().resetLineOrder();
      }
    }}>عودة لترتيب المحرك</button> : null}
    <ol ref={list} aria-label="ترتيب الأسطر" className="max-h-80 overflow-y-auto overscroll-contain py-1"
      onPointerMove={move} onPointerUp={up} onPointerCancel={clear}
      onLostPointerCapture={() => { if (press.current) clear(); }}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      {lines.map((line, index) => <li key={line.id}>
        <div data-insert-gap={index} className={`h-1 rounded transition ${drag?.mode === 'ORDER' && drag.gap === index ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : ''}`} />
        <div data-order-line-id={line.id} data-order-index={index} tabIndex={0}
          onPointerDown={(event) => down(event, line.id, 'ORDER')}
          onClick={() => useEditorStore.getState().selectLine(line.id, line.variantId, line.startPosition)}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).tagName === 'INPUT') return;
            if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
              event.preventDefault(); event.stopPropagation();
              void confirmOrder(line.id, moveLineToIndex(ids, line.id, index + 1 + (event.key === 'ArrowUp' ? -1 : 1)));
            }
          }}
          className={`flex touch-none select-none items-center gap-1 rounded border px-2 py-2 text-xs ${drag?.id === line.id ? 'border-emerald-600 bg-emerald-100 opacity-60' : drag?.mode === 'MERGE' && drag.target === line.id ? 'border-violet-600 bg-violet-100 ring-2 ring-violet-400' : selection?.id === line.id ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white'}`}>
          <span aria-hidden>⠿</span>
          <span className="w-6">{ar(index + 1)}</span>
          <button type="button" className="touch-none rounded border px-1 text-violet-700" aria-label={`مقبض دمج السطر ${ar(index + 1)}`} onPointerDown={(event) => down(event, line.id, 'MERGE')}>↳</button>
          <span className="min-w-0 flex-1 truncate" title={line.ruleLabel}>{line.label} · {line.ruleLabel}</span>
          <RankInput rank={index + 1} max={ids.length} onApply={(rank) => void confirmOrder(line.id, moveLineToIndex(ids, line.id, rank))} />
          <button type="button" disabled={index === 0} aria-label={`نقل السطر ${ar(index + 1)} أعلى`} onClick={() => void confirmOrder(line.id, moveLineToIndex(ids, line.id, index))}>↑</button>
          <button type="button" disabled={index === ids.length - 1} aria-label={`نقل السطر ${ar(index + 1)} أسفل`} onClick={() => void confirmOrder(line.id, moveLineToIndex(ids, line.id, index + 2))}>↓</button>
        </div>
      </li>)}
      <li data-insert-gap={ids.length} className={`h-1 rounded ${drag?.mode === 'ORDER' && drag.gap === ids.length ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : ''}`} />
    </ol>
    <p role="status" className="mt-2 text-xs text-emerald-900">{notice}</p>
  </div>;
}

function RankInput({ rank, max, onApply }: { rank: number; max: number; onApply: (rank: number) => void }) {
  const [value, setValue] = useState(ar(rank));
  useEffect(() => setValue(ar(rank)), [rank]);
  const apply = () => {
    const numeric = Number(value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))));
    setValue(ar(rank));
    if (value.trim() && Number.isInteger(numeric) && numeric >= 1 && numeric <= max && numeric !== rank) onApply(numeric);
  };
  return <input aria-label={`رتبة السطر ${ar(rank)}`} inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} onBlur={apply} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="w-10 rounded border border-stone-300 text-center" />;
}

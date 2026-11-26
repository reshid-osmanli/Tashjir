'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { ClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { coalesceLineOrder, moveLineToIndex } from '@/lib/tashjeer/manual-links';
import { selectRange } from '@/lib/tashjeer/multi-selection';
import { planLineInsertion } from '@/lib/tashjeer/line-operations';
import { lineOrderIsFiltered } from '@/lib/editor/line-order-filter';
import { interactionStateOf, type InteractionState } from '@/lib/editor/interaction-state';
import { resolveLineDragConfig, type LineDragConfig } from '@/lib/editor/drag-config';
import {
  autoScrollDelta,
  describeLineOrderMove,
  insertionGapAt,
  previewTransform,
  type RowBox,
  type ViewportBox,
} from '@/lib/editor/line-drag-geometry';
import { confirmAction, useConfirmStore } from '@/lib/ui/confirm-store';
import { toArabicDigits as ar } from '@/lib/utils/arabic-numbers';
import { useEditorStore } from '@/stores/editor-store';
import { ScrollableList } from '@/components/ui/ScrollableList';

type DragMode = 'ORDER' | 'MERGE';

type DragVisual = {
  id: string;
  mode: DragMode;
  sourceIndex: number;
  label: string;
  ruleLabel: string;
  width: number;
  height: number;
  gap: number | null;
  targetId: string | null;
  targetLabel: string;
  noOp: boolean;
};

type Gesture = {
  pointerId: number;
  pointerType: string;
  mode: DragMode;
  id: string;
  sourceIndex: number;
  label: string;
  ruleLabel: string;
  width: number;
  height: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  pointerX: number;
  pointerY: number;
  element: HTMLElement;
  started: boolean;
  touchTimer: number | null;
  rafId: number | null;
  gap: number | null;
  targetId: string | null;
};

/**
 * حاوية التمرير التي تلف القائمة (ScrollableList): حدود السحب والتمرير
 * التلقائي أثناء السحب تُحسب عليها لا على القائمة نفسها.
 */
function scrollViewportOf(element: HTMLOListElement | null): HTMLElement | null {
  return (element?.closest('[data-scroll-viewport]') as HTMLElement | null) ?? element;
}

/** لون واحد واضح لكل حالة تفاعل؛ hover تبقى عبر CSS ولا تُنشئ حالة مخزنة. */
const ROW_STATE_CLASS: Record<InteractionState, string> = {
  normal: 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50',
  hover: 'border-stone-400 bg-stone-50',
  focus: 'border-sky-500 bg-white ring-2 ring-sky-200',
  selected: 'border-emerald-500 bg-emerald-50 ring-2 ring-inset ring-emerald-300',
  pressed: 'border-emerald-700 bg-emerald-100 ring-2 ring-emerald-400',
  dragging: 'border-emerald-600 bg-emerald-100 opacity-60',
  disabled: 'border-stone-200 bg-stone-100 text-stone-400',
  saving: 'border-amber-400 bg-amber-50 text-amber-900',
  error: 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200',
};

/**
 * ترتيب الأسطر: Pointer Events موحّدة، معاينة عائمة مستقلة، فجوة إدراج
 * خضراء، تمرير تلقائي تدريجي، وتأكيد كمي قبل التعديل الوحيد على المستند.
 * لا يُنشأ معرّف سطر جديد، ولا يُلمس المستند أثناء حركة المؤشر.
 */
export function LineOrderEditor({ classic, dragConfig }: { classic: ClassicTashjeer; dragConfig?: Partial<LineDragConfig> }) {
  const document = useEditorStore((s) => s.document);
  const filter = useEditorStore((s) => s.filter);
  const selection = useEditorStore((s) => s.selection);
  const multiSelection = useEditorStore((s) => s.multiSelection);
  const setMultiSelection = useEditorStore((s) => s.setMultiSelection);
  const requestDeleteItems = useEditorStore((s) => s.requestDeleteItems);
  const isFiltered = lineOrderIsFiltered(filter, document);
  const config = useMemo(() => resolveLineDragConfig(dragConfig), [dragConfig]);

  const ids = useMemo(() => coalesceLineOrder(document?.lineOrder, classic.lines.map((line) => line.id)), [document?.lineOrder, classic.lines]);
  const lines = ids.map((id) => classic.lines.find((line) => line.id === id)!);

  const idsRef = useRef(ids); idsRef.current = ids;
  const linesRef = useRef(lines); linesRef.current = lines;
  const isFilteredRef = useRef(isFiltered); isFilteredRef.current = isFiltered;
  const configRef = useRef(config); configRef.current = config;
  const gesture = useRef<Gesture | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const previousBodyCursor = useRef('');

  const [drag, setDrag] = useState<DragVisual | null>(null);
  const [pressedRow, setPressedRow] = useState<{ id: string; mode: DragMode } | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [keyboardDrag, setKeyboardDrag] = useState<{ id: string; gap: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [notice, setNotice] = useState('');
  const flipBefore = useRef<Map<string, number> | null>(null);

  const checkedLineIds = new Set(multiSelection?.kind === 'LINE' ? multiSelection.ids : []);
  const chooseLine = (lineId: string, modifiers: { shift?: boolean; toggle?: boolean }) =>
    setMultiSelection(
      selectRange(
        multiSelection?.kind === 'LINE' ? multiSelection : { kind: 'LINE', ids: [] },
        lineId,
        ids,
        modifiers
      )
    );

  const setBodyCursor = useCallback((value: 'grabbing' | '') => {
    if (typeof window === 'undefined') return;
    if (value === 'grabbing') {
      previousBodyCursor.current = window.document.body.style.cursor;
      window.document.body.style.cursor = 'grabbing';
    } else {
      window.document.body.style.cursor = previousBodyCursor.current;
    }
  }, []);

  const rowBoxes = useCallback((): RowBox[] => {
    const container = list.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>('[data-order-line-id]')).map((element) => {
      const rect = element.getBoundingClientRect();
      return { id: element.dataset.orderLineId ?? '', top: rect.top, bottom: rect.bottom };
    });
  }, []);

  const captureRowPositions = useCallback(() => {
    const positions = new Map<string, number>();
    for (const element of list.current?.querySelectorAll<HTMLElement>('[data-order-line-id]') ?? []) {
      positions.set(element.dataset.orderLineId ?? '', element.getBoundingClientRect().top);
    }
    return positions;
  }, []);

  const updatePreview = useCallback(() => {
    const active = gesture.current;
    const element = previewRef.current;
    if (!active?.started || !element) return;
    element.style.transform = previewTransform(
      { x: active.pointerX, y: active.pointerY },
      { x: active.offsetX, y: active.offsetY }
    );
    element.dataset.pointerX = String(Math.round(active.pointerX));
    element.dataset.pointerY = String(Math.round(active.pointerY));
  }, []);

  const updateInsertion = useCallback((active: Gesture) => {
    const boxes = rowBoxes();
    const { gap, targetId } = insertionGapAt(active.pointerY, boxes);
    if (active.mode === 'MERGE') {
      const nextTarget = targetId && targetId !== active.id ? targetId : null;
      if (nextTarget !== active.targetId) {
        active.targetId = nextTarget;
        const targetLine = linesRef.current.find((line) => line.id === nextTarget);
        setDrag((previous) => previous ? { ...previous, targetId: nextTarget, targetLabel: targetLine?.label ?? '' } : previous);
      }
      return;
    }
    // لا منطق رتب مكرّر: planLineInsertion وحده يقرر إن كانت الفجوة no-op.
    const plan = gap === null ? null : planLineInsertion(idsRef.current, active.id, gap);
    const nextGap = plan ? gap : null;
    if (nextGap !== active.gap) {
      active.gap = nextGap;
      setDrag((previous) => previous ? { ...previous, gap: nextGap, noOp: !plan } : previous);
    }
  }, [rowBoxes]);

  const frame = useCallback(function frameLoop() {
    const active = gesture.current;
    if (!active?.started) return;
    const viewport = scrollViewportOf(list.current);
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const box: ViewportBox = {
        top: rect.top, bottom: rect.bottom,
        scrollTop: viewport.scrollTop, scrollHeight: viewport.scrollHeight, clientHeight: viewport.clientHeight,
      };
      const delta = autoScrollDelta(active.pointerY, box, configRef.current.autoScrollEdgePx, configRef.current.autoScrollMaxSpeed);
      if (delta !== 0) {
        const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        viewport.scrollTop = Math.min(maxScroll, Math.max(0, viewport.scrollTop + delta));
      }
      // التمرير يغيّر مواضع الصفوف؛ أعد الحساب في كل إطار لا عند أول حركة فقط.
      updateInsertion(active);
    }
    updatePreview();
    active.rafId = window.requestAnimationFrame(frameLoop);
  }, [updateInsertion, updatePreview]);

  const scheduleFrame = useCallback((active: Gesture) => {
    if (active.rafId === null) active.rafId = window.requestAnimationFrame(frame);
  }, [frame]);

  const startDrag = useCallback((active: Gesture) => {
    if (active.started) return;
    active.started = true;
    if (active.touchTimer !== null) { window.clearTimeout(active.touchTimer); active.touchTimer = null; }
    // بعد الضغطة المطولة نمنع تمرير الإصبع اللاحق، وقبلها يبقى pan-y طبيعيًا.
    if (active.pointerType === 'touch') active.element.style.touchAction = 'none';
    setBodyCursor('grabbing');
    setPressedRow({ id: active.id, mode: active.mode });
    setDrag({
      id: active.id, mode: active.mode, sourceIndex: active.sourceIndex,
      label: active.label, ruleLabel: active.ruleLabel, width: active.width, height: active.height,
      gap: null, targetId: null, targetLabel: '', noOp: false,
    });
    scheduleFrame(active);
  }, [scheduleFrame, setBodyCursor]);

  const clear = useCallback(() => {
    const active = gesture.current;
    if (!active) return;
    // إفراغ المرجع أولًا: releasePointerCapture يُطلق lostpointercapture ولا نريد recursion.
    gesture.current = null;
    if (active.touchTimer !== null) window.clearTimeout(active.touchTimer);
    if (active.rafId !== null) window.cancelAnimationFrame(active.rafId);
    active.element.style.touchAction = '';
    if (active.element.hasPointerCapture(active.pointerId)) active.element.releasePointerCapture(active.pointerId);
    setDrag(null);
    setPressedRow(null);
    setBodyCursor('');
    suppressClick.current = active.started;
  }, [setBodyCursor]);

  const fail = useCallback((message: string, id: string) => {
    setNotice(message); setRowError({ id, message });
  }, []);

  const playFlip = useCallback((before: Map<string, number>) => {
    const duration = configRef.current.transitionMs;
    if (duration === 0 || typeof window === 'undefined') return;
    for (const element of list.current?.querySelectorAll<HTMLElement>('[data-order-line-id]') ?? []) {
      const oldTop = before.get(element.dataset.orderLineId ?? '');
      if (oldTop === undefined) continue;
      const delta = oldTop - element.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      element.style.transition = 'none';
      element.style.transform = `translateY(${delta}px)`;
      window.requestAnimationFrame(() => {
        element.style.transition = `transform ${duration}ms ease-out`;
        element.style.transform = '';
        element.addEventListener('transitionend', () => {
          element.style.transition = '';
          element.style.transform = '';
        }, { once: true });
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (flipBefore.current) {
      playFlip(flipBefore.current);
      flipBefore.current = null;
    }
  }, [ids, playFlip]);

  useLayoutEffect(() => { updatePreview(); }, [drag, updatePreview]);

  // معايرة اللمس: قبل الضغطة المطولة يبقى التمرير الطبيعي (لا منع)، وبعدها
  // يُمنع touchmove نفسه بلا انتظار دورة مؤقت. منع pointermove وحده لا يكفي
  // في Chromium عند touch-action: pan-y فيرسل pointercancel؛ لذلك مستمع原生
  // غير passive على touchmove هو الذي يثبت الإيماءة مع بقاء التمرير طبيعيًا قبلها.
  useEffect(() => {
    const onTouchMove = (event: TouchEvent) => {
      const active = gesture.current;
      if (active?.started && active.pointerType === 'touch' && event.cancelable) event.preventDefault();
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => window.removeEventListener('touchmove', onTouchMove);
  }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || useConfirmStore.getState().pending) return;
      if (gesture.current) {
        event.preventDefault(); event.stopImmediatePropagation(); clear();
      } else if (keyboardDrag) {
        event.preventDefault(); setKeyboardDrag(null); setNotice('أُلغي السحب بلوحة المفاتيح؛ لم يتغير الترتيب.');
      }
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [clear, keyboardDrag]);

  useEffect(() => () => {
    const active = gesture.current;
    if (active) {
      if (active.touchTimer !== null) window.clearTimeout(active.touchTimer);
      if (active.rafId !== null) window.cancelAnimationFrame(active.rafId);
      gesture.current = null;
    }
    if (typeof window !== 'undefined') window.document.body.style.cursor = previousBodyCursor.current;
  }, []);

  const confirmOrder = async (id: string, order: string[]) => {
    if (isFilteredRef.current) { fail('ألغِ تصفية الأسطر قبل النقل لحماية ترتيب الأسطر المخفية.', id); return; }
    const state = useEditorStore.getState();
    const current = state.document;
    if (!current) return;
    const beforeIds = idsRef.current;
    if (beforeIds.every((item, index) => item === order[index])) return;
    if (current.lines?.some((line) => line.locked && order.includes(line.id) && order.indexOf(line.id) !== beforeIds.indexOf(line.id))) {
      fail('يتأثر سطر مقفل؛ لم يُنقل أي سطر.', id); return;
    }
    const description = describeLineOrderMove(beforeIds, order, id);
    const label = (neighbor?: string) => neighbor ? `السطر ${ar(beforeIds.indexOf(neighbor) + 1)}` : '';
    const hint = description.previousId && description.nextId
      ? `بين ${label(description.previousId)} و${label(description.nextId)}`
      : description.previousId ? `بعد ${label(description.previousId)}` : `قبل ${label(description.nextId)}`;
    setRowError(null); setSaving(true);
    try {
      const accepted = await confirmAction({
        title: `نقل السطر ${ar(description.fromRank)} إلى الرتبة ${ar(description.rank)}؟`,
        message: `قبل النقل: الرتبة ${ar(description.fromRank)}؛ بعده: الرتبة ${ar(description.rank)}. ${hint}. تبقى المعرّفات والأجزاء والعلاقات كما هي.`,
        impacts: [{ label: 'أسطر متأثرة', count: description.affected }],
        undoable: true, confirmLabel: 'تأكيد', tone: 'default',
      });
      if (!accepted) return;
      if (useEditorStore.getState().document !== current) { fail('تغيّر المستند أثناء التأكيد؛ أعد طلب النقل.', id); return; }
      flipBefore.current = captureRowPositions();
      // تعديل واحد ذري في مخزن المستند؛ التحديد الموحّد يبقى على السطر المنقول.
      useEditorStore.getState().setLineOrder(order, linesRef.current);
      const line = linesRef.current.find((item) => item.id === id);
      if (line) useEditorStore.getState().selectLine(id, line.variantId, line.startPosition);
      setNotice(`نُقل السطر إلى الرتبة ${ar(description.rank)}. يمكن التراجع.`);
    } finally { setSaving(false); }
  };

  const merge = async (from: string, to: string) => {
    setSaving(true);
    try { setNotice(await useEditorStore.getState().requestMergeLines(linesRef.current, from, to)); }
    finally { setSaving(false); }
  };

  const bulkDelete = async () => {
    if (!multiSelection?.ids.length) return;
    if (isFilteredRef.current) { setNotice('ألغِ تصفية الأسطر قبل الحذف الجماعي لحماية الأسطر المخفية.'); return; }
    setSaving(true);
    try {
      const done = await requestDeleteItems({ kind: 'LINE', ids: multiSelection.ids }, { rendered: linesRef.current });
      setNotice(done ? 'حُذفت الأسطر المحددة وما تختص به. يمكن التراجع.' : useEditorStore.getState().clipboardNotice);
    } finally { setSaving(false); }
  };

  const down = (event: ReactPointerEvent<HTMLElement>, id: string, mode: DragMode) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (isFilteredRef.current) { fail('ألغِ التصفية قبل السحب لحماية الأسطر المخفية.', id); return; }
    if (mode === 'ORDER' && (event.target as HTMLElement).closest('button,input')) return;
    event.stopPropagation();
    clear(); suppressClick.current = false; setRowError(null);
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const sourceIndex = idsRef.current.indexOf(id);
    const line = linesRef.current[sourceIndex];
    const active: Gesture = {
      pointerId: event.pointerId, pointerType: event.pointerType || 'mouse', mode, id, sourceIndex,
      label: line?.label ?? `سطر ${ar(sourceIndex + 1)}`, ruleLabel: line?.ruleLabel ?? '',
      width: Math.max(180, Math.min(rect.width, 520)), height: Math.max(30, rect.height),
      startX: event.clientX, startY: event.clientY,
      offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
      pointerX: event.clientX, pointerY: event.clientY,
      element, started: false, touchTimer: null, rafId: null, gap: null, targetId: null,
    };
    gesture.current = active;
    element.setPointerCapture(event.pointerId);
    setPressedRow({ id, mode });
    if (active.pointerType === 'touch') {
      // الضغطة المطولة للمس فقط. الحركة قبلها تُبقي التمرير الطبيعي وتلغي الإيماءة.
      active.touchTimer = window.setTimeout(() => {
        if (gesture.current !== active || active.started) return;
        if (Math.hypot(active.pointerX - active.startX, active.pointerY - active.startY) <= configRef.current.thresholdPx) startDrag(active);
      }, configRef.current.touchLongPressMs);
    }
    // الفأرة/القلم يبدأ بعد عتبة الحركة في move(): لا انتظار 350ms ولا إلغاء للحركة الطبيعية.
  };

  const move = (event: ReactPointerEvent) => {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointerId) return;
    active.pointerX = event.clientX; active.pointerY = event.clientY;
    const distance = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
    if (!active.started) {
      if (active.pointerType === 'touch') {
        if (distance > configRef.current.thresholdPx) clear(); // يمرّر المتصفح طبيعيًا
        return;
      }
      if (distance > configRef.current.thresholdPx) startDrag(active);
      else return;
    }
    event.preventDefault();
    event.stopPropagation();
    updateInsertion(active);
    scheduleFrame(active);
  };

  const up = (event: ReactPointerEvent) => {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointerId) return;
    event.stopPropagation();
    const snapshot = {
      started: active.started, mode: active.mode, id: active.id,
      gap: active.gap, targetId: active.targetId,
    };
    clear();
    if (!snapshot.started) return;
    if (snapshot.mode === 'MERGE') {
      if (snapshot.targetId) void merge(snapshot.id, snapshot.targetId);
      return;
    }
    if (snapshot.gap !== null) {
      const plan = planLineInsertion(idsRef.current, snapshot.id, snapshot.gap);
      if (plan) void confirmOrder(snapshot.id, plan.order);
    }
  };

  const cancelPointer = (event: ReactPointerEvent) => {
    const active = gesture.current;
    if (active && event.pointerId === active.pointerId) clear();
  };

  const initialKeyboardGap = (id: string, index: number) => {
    const valid = Array.from({ length: ids.length + 1 }, (_, gap) => gap)
      .filter((gap) => planLineInsertion(ids, id, gap));
    return valid.sort((a, b) => Math.abs(a - (index + 2)) - Math.abs(b - (index + 2)))[0] ?? index + 1;
  };

  const onRowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, lineId: string, index: number) => {
    if ((event.target as HTMLElement).tagName === 'INPUT' || (event.target as HTMLElement).tagName === 'BUTTON') return;
    if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      void confirmOrder(lineId, moveLineToIndex(ids, lineId, index + 1 + (event.key === 'ArrowUp' ? -1 : 1)));
      return;
    }
    if (keyboardDrag?.id === lineId) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault(); event.stopPropagation();
        setKeyboardDrag((previous) => previous ? {
          ...previous, gap: Math.max(0, Math.min(ids.length, previous.gap + (event.key === 'ArrowDown' ? 1 : -1))),
        } : previous);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); event.stopPropagation();
        const plan = planLineInsertion(ids, lineId, keyboardDrag.gap);
        setKeyboardDrag(null);
        if (plan) void confirmOrder(lineId, plan.order);
        return;
      }
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation();
      setKeyboardDrag({ id: lineId, gap: initialKeyboardGap(lineId, index) });
      setNotice(`سطر ${ar(index + 1)} ممسوك للنقل: ↑/↓ لتغيير الموضع، Enter للتأكيد، Esc للإلغاء.`);
    }
  };

  // مؤشر واحد للإدراج: من السحب الحقيقي أو من وضع لوحة المفاتيح، بلا no-op.
  const keyboardPlan = keyboardDrag ? planLineInsertion(ids, keyboardDrag.id, keyboardDrag.gap) : null;
  const indicatorGap = drag?.mode === 'ORDER' && !drag.noOp ? drag.gap : keyboardPlan ? keyboardDrag!.gap : null;
  const mergeTargetId = drag?.mode === 'MERGE' ? drag.targetId : null;
  const activeLineIndex = selection?.kind === 'LINE' && selection.lineId ? ids.indexOf(selection.lineId) : -1;

  return <div
    data-ui-id="A123"
    dir="rtl"
    className="rounded-md border border-stone-200 p-2.5"
    onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        if ((event.target as HTMLElement).tagName === 'INPUT') return;
        event.preventDefault(); setMultiSelection({ kind: 'LINE', ids });
      }
    }}
  >
    <ScrollableList
      itemCount={lines.length}
      ariaLabel="ترتيب الأسطر"
      estimateHeight={44}
      className="max-h-80"
      activeIndex={activeLineIndex >= 0 ? activeLineIndex : undefined}
      header={
        <div className="px-1 py-1.5">
          <p className="text-[11px] text-stone-600">اسحب الصف لتغيير الترتيب فورًا؛ ↳ للدمج فقط. Enter/Space للسحب بلوحة المفاتيح، Alt+↑/↓ للنقل، Esc للإلغاء، Ctrl+Z للتراجع.</p>
          {multiSelection?.kind === 'LINE' && multiSelection.ids.length > 0 && (
            <div data-ui-id="A971" role="toolbar" aria-label="إجراءات التحديد المتعدد للأسطر"
              className="mt-1 flex flex-wrap items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50/80 px-2 py-1.5">
              <span className="text-[11px] font-medium text-emerald-900">
                المحدد: {ar(multiSelection.ids.length)} {multiSelection.ids.length === 1 ? 'سطر' : multiSelection.ids.length === 2 ? 'سطران' : 'أسطر'}
              </span>
              <button data-ui-id="A972" type="button" disabled={saving}
                className="rounded border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                onClick={() => void bulkDelete()}
                title="حذف الأسطر المحددة وما تختص به من اختلافات — بتأكيد كمي يبيّن المشترك الباقي، وقابل للتراجع">حذف المحدد</button>
              <button data-ui-id="A973" type="button"
                className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-50"
                onClick={() => setMultiSelection(null)}>تفريغ</button>
              <span className="ms-auto text-[10px] text-stone-400">Shift+نقر مدى · Ctrl+A كل المعروض</span>
            </div>
          )}
          {document?.lineOrder?.length ? <button data-ui-id="A974" type="button" disabled={saving} className="mt-1 text-xs text-emerald-800 disabled:opacity-40" onClick={async () => {
            if (await confirmAction({ title: 'عودة لترتيب المحرك؟', impacts: [{ label: 'أسطر', count: ids.length }], undoable: true })) {
              if (useEditorStore.getState().document === document) useEditorStore.getState().resetLineOrder();
            }
          }}>عودة لترتيب المحرك</button> : null}
        </div>
      }
    >
    <ol data-ui-id="A975" ref={list} aria-label="ترتيب الأسطر" className="py-1"
      onPointerMove={move} onPointerUp={up} onPointerCancel={cancelPointer}
      onLostPointerCapture={() => { if (gesture.current) clear(); }}
      onClickCapture={(event: ReactMouseEvent) => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      }}>
      {lines.map((line, index) => {
        const isLocked = Boolean(document?.lines?.find((saved) => saved.id === line.id)?.locked);
        const rowDisabled = isFiltered || isLocked || saving;
        const controlsDisabled = rowDisabled || Boolean(drag) || Boolean(keyboardDrag);
        const state = interactionStateOf({
          focused: focusedRowId === line.id,
          selected: checkedLineIds.has(line.id) || selection?.id === line.id,
          pressed: pressedRow?.id === line.id,
          dragging: drag?.id === line.id,
          disabled: rowDisabled,
          saving,
          error: rowError?.id === line.id,
        });
        const isIndicator = indicatorGap === index;
        const isMergeTarget = mergeTargetId === line.id;
        const isMergeSource = drag?.mode === 'MERGE' && drag.id === line.id;
        return <li data-ui-instance={String(line.id)} data-ui-id="A976" key={line.id}>
          <div data-insert-gap={index} aria-hidden="true" data-drop-indicator={isIndicator ? 'true' : 'false'}
            className={`rounded transition-all duration-150 ${isIndicator ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-transparent'}`}
            style={{ height: isIndicator ? 2 : 4, marginBottom: isIndicator ? config.placeholderPx : 0 }} />
          <div data-ui-id="A124" data-ui-instance={line.id} data-order-line-id={line.id} data-order-index={index} data-list-index={index}
            data-state={state} aria-label={`السطر ${ar(index + 1)}: ${line.label} · ${line.ruleLabel}`}
            aria-disabled={rowDisabled} aria-grabbed={keyboardDrag?.id === line.id || drag?.id === line.id}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Control+z Control+Shift+z"
            data-keyboard-drag={keyboardDrag?.id === line.id ? 'true' : 'false'}
            tabIndex={rowDisabled ? -1 : 0}
            onFocus={() => setFocusedRowId(line.id)} onBlur={() => setFocusedRowId((current) => current === line.id ? null : current)}
            onPointerDown={(event) => down(event, line.id, 'ORDER')}
            onClick={(event) => {
              if (event.shiftKey || event.ctrlKey || event.metaKey) {
                event.preventDefault(); chooseLine(line.id, { shift: event.shiftKey, toggle: event.ctrlKey || event.metaKey }); return;
              }
              useEditorStore.getState().selectLine(line.id, line.variantId, line.startPosition);
              if (multiSelection?.kind === 'LINE') chooseLine(line.id, {});
            }}
            onKeyDown={(event) => onRowKeyDown(event, line.id, index)}
            className={`flex touch-pan-y select-none items-center gap-1 rounded border px-2 py-2 text-xs transition-colors duration-150 ${ROW_STATE_CLASS[state]} ${isMergeTarget ? '!border-violet-600 !bg-violet-100 ring-2 ring-violet-400' : isMergeSource ? '!border-violet-500 !bg-violet-50' : ''}`}>
            <span aria-hidden title="اسحب لتغيير الترتيب" className="cursor-grab">⠿</span>
            <span className="w-6 shrink-0">{ar(index + 1)}</span>
            <button type="button" data-ui-id="A125" data-ui-instance={line.id} data-state={isMergeTarget ? 'merge-target' : state}
              disabled={controlsDisabled} title="اسحب هذا المقبض لدمج السطر في سطر آخر"
              className="touch-pan-y shrink-0 rounded border px-1 text-violet-700 hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`مقبض دمج السطر ${ar(index + 1)}`} onPointerDown={(event) => down(event, line.id, 'MERGE')}>↳</button>
            <span className="min-w-0 flex-1 truncate" title={line.ruleLabel}>{line.label} · {line.ruleLabel}</span>
            <RankInput data-ui-instance={String(line.id)} data-ui-id="A126" instance={line.id} rank={index + 1} max={ids.length} disabled={controlsDisabled}
              onApply={(rank) => void confirmOrder(line.id, moveLineToIndex(ids, line.id, rank))} />
            <button type="button" data-ui-id="A127" data-ui-instance={line.id} disabled={controlsDisabled || index === 0} title="نقل السطر أعلى"
              className="shrink-0 rounded border px-1 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`نقل السطر ${ar(index + 1)} أعلى`} onClick={() => void confirmOrder(line.id, moveLineToIndex(ids, line.id, index))}>↑</button>
            <button type="button" data-ui-id="A2125" data-ui-instance={line.id} disabled={controlsDisabled || index === ids.length - 1} title="نقل السطر أسفل"
              className="shrink-0 rounded border px-1 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`نقل السطر ${ar(index + 1)} أسفل`} onClick={() => void confirmOrder(line.id, moveLineToIndex(ids, line.id, index + 2))}>↓</button>
          </div>
        </li>;
      })}
      <li data-ui-id="A978" data-insert-gap={ids.length} aria-hidden="true" data-drop-indicator={indicatorGap === ids.length ? 'true' : 'false'}
        className={`rounded transition-all duration-150 ${indicatorGap === ids.length ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-transparent'}`}
        style={{ height: indicatorGap === ids.length ? 2 : 4, marginBottom: indicatorGap === ids.length ? config.placeholderPx : 0 }} />
    </ol>
    </ScrollableList>
    <p role="status" aria-live="polite" data-state={rowError ? 'error' : saving ? 'saving' : 'normal'}
      className={`mt-2 text-xs ${rowError ? 'text-rose-700' : saving ? 'text-amber-800' : 'text-emerald-900'}`}>{notice}</p>
    <DragPreview drag={drag} previewRef={previewRef} gesture={gesture} />
  </div>;
}

/** معاينة عائمة مستقلة: عنصر HTML عبر portal، لا يلمس ترتيب الصفوف ولا المستند. */
function DragPreview({
  drag,
  previewRef,
  gesture,
}: {
  drag: DragVisual | null;
  previewRef: RefObject<HTMLDivElement | null>;
  gesture: RefObject<Gesture | null>;
}) {
  if (!drag || typeof window === 'undefined') return null;
  const active = gesture.current;
  const pointerX = Math.round(active?.pointerX ?? 0);
  const pointerY = Math.round(active?.pointerY ?? 0);
  const order = drag.mode === 'ORDER';
  const common = {
    ref: previewRef,
    'aria-hidden': true,
    'data-drag-mode': drag.mode,
    'data-drag-id': drag.id,
    'data-drag-gap': drag.gap ?? '',
    'data-drop-target': drag.targetId ?? '',
    'data-pointer-x': pointerX,
    'data-pointer-y': pointerY,
    style: {
      width: drag.width,
      minHeight: drag.height,
      transform: active ? previewTransform({ x: active.pointerX, y: active.pointerY }, { x: active.offsetX, y: active.offsetY }) : 'translate3d(-9999px,-9999px,0)',
      cursor: 'grabbing',
    },
    className: `pointer-events-none fixed left-0 top-0 z-[80] rounded-lg border px-3 py-2 text-xs shadow-2xl backdrop-blur-sm will-change-transform ${order ? 'border-emerald-500 bg-emerald-100/90 text-emerald-950' : 'border-violet-500 bg-violet-100/90 text-violet-950'}`,
  } as const;
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`text-base font-bold ${order ? 'text-emerald-700' : 'text-violet-700'}`}>{order ? '⠿' : '↳'}</span>
        <span className="font-semibold">{order ? `السطر ${ar(drag.sourceIndex + 1)}` : 'دمج السطر'}</span>
        <span className="truncate">{drag.label}</span>
      </div>
      <div className="mt-0.5 text-[10px] opacity-80">
        {order ? drag.ruleLabel : drag.targetId ? `↳ دمج مع: ${drag.targetLabel || drag.targetId}` : 'أفلت فوق سطر لدمجه — لا يندمج سطر بسحب الصف العادي'}
      </div>
    </>
  );
  // معرّفان ثابتان مسجّلان: معاينة الترتيب ومعاينة الدمج، لكل منهما لونه وشارته.
  if (order) return createPortal(<div {...common} data-ui-id="A2211">{content}</div>, window.document.body);
  return createPortal(<div {...common} data-ui-id="A2212">{content}</div>, window.document.body);
}

function RankInput({ 'data-ui-id': uiId, instance, rank, max, disabled, onApply }: {
  instance: string; rank: number; max: number; disabled?: boolean; onApply: (rank: number) => void;
} & { 'data-ui-id'?: string }) {
  const [value, setValue] = useState(ar(rank));
  useEffect(() => setValue(ar(rank)), [rank]);
  const apply = () => {
    const numeric = Number(value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))));
    setValue(ar(rank));
    if (value.trim() && Number.isInteger(numeric) && numeric >= 1 && numeric <= max && numeric !== rank) onApply(numeric);
  };
  return <input data-ui-id={uiId} data-ui-instance={instance} aria-label={`رتبة السطر ${ar(rank)}`} title="اكتب الرتبة ثم Enter" disabled={disabled}
    inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} onBlur={apply}
    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    className="w-10 shrink-0 rounded border border-stone-300 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:bg-stone-100" />;
}

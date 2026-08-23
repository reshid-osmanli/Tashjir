// لوحة التشجير الكلاسيكي - Classic Tashjeer Canvas v2 - بيئة احترافية
// مشروع التشجير - نظام القراءات العشر

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { TashjeerFigure } from './TashjeerFigure';
import { getNarratorsByTayyibah } from '@/lib/tashjeer/symbols';
import { getImamsWithSymbols } from '@/lib/tashjeer/reader-symbols';
import { getNarratorProfile } from '@/data/qiraat-data/narrator-profiles';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { lociOfVariant, positionsOfVariant } from '@/lib/tashjeer/loci';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { parseAyahKey } from '@/data/quran';
import type { ClassicLine, ClassicReaderChip } from '@/lib/tashjeer/classic-tashjeer';
import type { VariantCategory } from '@/types';
import type { WordBox } from '@/types/tashjeer';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';

interface TashjeerCanvasProps {
  fontSize?: number;
  readOnly?: boolean;
}

export function TashjeerCanvas({ fontSize = 34, readOnly = false }: TashjeerCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [showSymbols, setShowSymbols] = useState(false);
  const [openReader, setOpenReader] = useState<ClassicReaderChip | null>(null);
  const [dragLineId, setDragLineId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const {
    document,
    filter,
    zoom,
    pan,
    currentTool,
    markingMode,
    markedPositions,
    markedCharacters,
    selectedWordId,
    selectedVariantId,
    selection,
    setZoom,
    setPan,
    selectWord,
    selectVariant,
    selectAlternative,
    selectLine,
    selectBranch,
    refreshDerivedBranches,
    toggleMarkedPosition,
    toggleMarkedCharacter,
    copySelection,
    pasteSelection,
    cutSelection,
    moveLineInOrder,
  } = useEditorStore();

  const catalog = useTransmissionCatalog();
  const engine = useEngineSettings();
  const strengthDegrees = useStrengthDegrees();
  const occurrences = useRuleOccurrences();

  useEffect(() => {
    refreshDerivedBranches();
  }, [catalog.updatedAt, engine.rowSpacing, engine.textToTreeGap, engine.tieBreakOrder, engine.symbolDisplay, strengthDegrees.updatedAt, occurrences.key, refreshDerivedBranches]);

  const { ayah, layout, classic, viewBox, window: readingWindow } = useAyahTashjeer(
    document,
    filter,
    { fontSize, singleLine: engine.singleLineText },
    { catalog, engine, strengthDegrees, occurrencesKey: occurrences.key }
  );

  const ayahMarkers = useMemo(() => {
    if (!readingWindow.isLinked) return [];
    return [{ position: readingWindow.firstAyahEndPosition, ayahNumber: parseAyahKey(readingWindow.ayahKeys[0]).ayahNumber }];
  }, [readingWindow]);

  const focusSegment = document?.readingWindow?.focusSegment ?? null;

  const effectiveVariants = useMemo(() => (document ? getEffectiveVariants(document) : []), [document, occurrences.key]);

  // الاستماع لحدث التمرير من لوحة الاختلافات
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { variantId: string };
      const variant = effectiveVariants.find((v) => v.id === detail.variantId);
      if (!variant || !layout.boxes.length) return;
      const box = layout.boxByPosition.get(variant.startPosition);
      if (!box) return;
      // تمرير المحرر إلى موضع الكلمة
      const svg = svgRef.current;
      if (!svg) return;
      // تحريك pan ليكون المركز على الكلمة
      const targetX = box.centerX;
      const targetY = box.baselineY;
      // حساب pan ليظهر المركز
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const scale = viewBox.width / rect.width;
      // نريد أن يكون target في منتصف العرض
      const centerX = viewBox.x + rect.width * 0.5 * scale;
      const centerY = viewBox.y + rect.height * 0.3 * scale;
      setPan({ x: centerX - targetX * zoom, y: centerY - targetY * zoom });
      // وميض بصري
      setHoveredLineId(`flash-${variant.id}`);
      setTimeout(() => setHoveredLineId(null), 800);
    };
    window.addEventListener('tashjeer:scroll-to-variant' as any, handler);
    return () => window.removeEventListener('tashjeer:scroll-to-variant' as any, handler);
  }, [effectiveVariants, layout, viewBox, zoom, setPan]);

  // اختصارات النسخ/اللصق داخل المحرر
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        cutSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly, copySelection, pasteSelection, cutSelection]);

  const unitsPerPixel = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    return viewBox.width / rect.width;
  }, [viewBox.width]);

  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      const nextZoom = Math.min(6, Math.max(0.2, zoom * factor));
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const scale = unitsPerPixel();
        const cursorX = viewBox.x + (event.clientX - rect.left) * scale;
        const cursorY = viewBox.y + (event.clientY - rect.top) * scale;
        setPan({ x: cursorX - (nextZoom * (cursorX - pan.x)) / zoom, y: cursorY - (nextZoom * (cursorY - pan.y)) / zoom });
      }
      setZoom(nextZoom);
    },
    [pan.x, pan.y, setPan, setZoom, unitsPerPixel, viewBox.x, viewBox.y, zoom]
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      const isMiddleButton = event.button === 1;
      const isEmptyArea = event.target === svgRef.current;
      const isAltDrag = event.altKey && event.button === 0;
      if (!isMiddleButton && !isEmptyArea && !isAltDrag) return;
      if (isAltDrag) event.preventDefault();
      panState.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (!panState.current) return;
      const scale = unitsPerPixel();
      setPan({ x: panState.current.panX + (event.clientX - panState.current.x) * scale, y: panState.current.panY + (event.clientY - panState.current.y) * scale });
    },
    [setPan, unitsPerPixel]
  );

  const endPan = useCallback(() => {
    panState.current = null;
  }, []);

  const handleWordClick = useCallback(
    (box: WordBox) => {
      if (readOnly) {
        selectWord(box.wordId);
        return;
      }
      if (currentTool === 'mark') {
        if (markingMode === 'WORDS') toggleMarkedPosition(box.position);
        return;
      }
      selectWord(box.wordId === selectedWordId ? null : box.wordId);
      const variant = effectiveVariants.find((item) => box.position >= item.startPosition && box.position <= item.endPosition);
      if (variant) selectVariant(variant.id);
    },
    [currentTool, effectiveVariants, markingMode, readOnly, selectVariant, selectWord, selectedWordId, toggleMarkedPosition]
  );

  const handleCharacterClick = useCallback(
    (box: WordBox, characterIndex: number) => {
      if (readOnly || currentTool !== 'mark' || markingMode !== 'CHARACTERS') return;
      toggleMarkedCharacter({ position: box.position, characterIndex });
      selectWord(box.wordId);
    },
    [currentTool, markingMode, readOnly, selectWord, toggleMarkedCharacter]
  );

  const handleLineClick = useCallback(
    (line: ClassicLine) => {
      if (readOnly) return;
      if (line.source === 'MANUAL') {
        selectVariant(null);
        selectBranch(null);
        return;
      }
      const nextVariantId = line.variantId === selectedVariantId ? null : line.variantId;
      if (nextVariantId) selectLine(line.id, nextVariantId, line.startPosition);
      else {
        selectVariant(null);
        selectBranch(null);
      }
    },
    [readOnly, selectBranch, selectLine, selectVariant, selectedVariantId]
  );

  const handleEntryClick = useCallback(
    (_line: ClassicLine, entry: { variantId: string; alternativeId?: string }) => {
      if (readOnly || !entry.variantId) return;
      if (entry.alternativeId) selectAlternative(entry.variantId, entry.alternativeId);
      else selectVariant(entry.variantId);
      selectBranch(null);
    },
    [readOnly, selectAlternative, selectBranch, selectVariant]
  );

  // سحب السطور لإعادة الترتيب والدمج
  const handleLineDragStart = useCallback((line: ClassicLine) => {
    if (readOnly) return;
    setDragLineId(line.id);
  }, [readOnly]);

  const handleLineDragOver = useCallback((e: React.DragEvent, line: ClassicLine) => {
    e.preventDefault();
    if (dragLineId && dragLineId !== line.id) setDropTargetId(line.id);
  }, [dragLineId]);

  const handleLineDrop = useCallback((e: React.DragEvent, line: ClassicLine) => {
    e.preventDefault();
    if (!dragLineId || dragLineId === line.id) {
      setDragLineId(null);
      setDropTargetId(null);
      return;
    }
    const allIds = classic.lines.map((l) => l.id);
    if (e.shiftKey) {
      // دمج
      if (confirm(`هل تريد دمج السطر ${dragLineId.slice(0, 10)} مع ${line.id.slice(0, 10)}؟`)) {
        const { addLink } = useEditorStore.getState();
        addLink({ kind: 'LINE_TO_LINE', relation: 'MERGE', from: { type: 'LINE', id: dragLineId }, to: { type: 'LINE', id: line.id } });
      }
    } else {
      const targetIdx = allIds.indexOf(line.id);
      if (targetIdx !== -1 && confirm(`هل تريد نقل هذا السطر إلى هذا الموضع؟`)) {
        moveLineInOrder(allIds, dragLineId, targetIdx + 1);
      }
    }
    setDragLineId(null);
    setDropTargetId(null);
  }, [dragLineId, classic.lines, moveLineInOrder]);

  const coveredPositions = useMemo(() => {
    if (!document) return [];
    const positions = new Set<number>();
    for (const variant of effectiveVariants) {
      for (const position of positionsOfVariant(variant)) positions.add(position);
    }
    return [...positions];
  }, [document, effectiveVariants]);

  const coveredCharacterRanges = useMemo(
    () => effectiveVariants.flatMap((variant) => lociOfVariant(variant).map((locus) => locus.characterRange).filter((range): range is NonNullable<typeof range> => Boolean(range))),
    [effectiveVariants]
  );

  if (!document) {
    return <CanvasMessage text="اختر سورة وآية لبدء التشجير." />;
  }

  if (!ayah || layout.boxes.length === 0) {
    return <CanvasMessage text="تعذر تحميل نص هذه الآية." tone="error" />;
  }

  const cursor = readOnly ? 'default' : currentTool === 'mark' ? 'crosshair' : 'default';

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-auto bg-[#fdfaf2]">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`تشجير الآية ${ayah.ayahNumber} من السورة ${ayah.surahNumber}`}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMin meet"
        className="h-full min-h-[520px] min-w-[920px] w-full"
        style={{ cursor }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
        <defs>
          <filter id="branch-glow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.45" /></filter>
          <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d6d3d1" strokeWidth="0.5" /></pattern>
        </defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {filter.showGrid && <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#canvas-grid)" pointerEvents="none" />}
          <TashjeerFigure
            layout={layout}
            classic={classic}
            viewBox={viewBox}
            fontSize={fontSize}
            showLabels={filter.showLabels}
            showRulers={filter.showRulers}
            showAnchors={filter.showAnchors}
            boundaries={document.boundaries}
            baseNarratorName={catalog.narrators.find((n) => n.id === 'narrator-hafs')?.name ?? 'حفص'}
            engine={engine}
            markedPositions={markedPositions}
            markedCharacters={markedCharacters}
            ayahMarkers={ayahMarkers}
            focusSegment={focusSegment}
            coveredPositions={coveredPositions}
            coveredCharacterRanges={coveredCharacterRanges}
            characterMarkingActive={!readOnly && currentTool === 'mark' && markingMode === 'CHARACTERS'}
            selectedWordId={selectedWordId}
            selectedVariantId={selectedVariantId}
            hoveredLineId={hoveredLineId}
            onWordClick={handleWordClick}
            onCharacterClick={handleCharacterClick}
            onLineClick={handleLineClick}
            onEntryClick={handleEntryClick}
            onLineHoverStart={(line) => setHoveredLineId(line.id)}
            onLineHoverEnd={() => setHoveredLineId(null)}
            onReaderClick={setOpenReader}
          />
          {/* مؤشرات السحب */}
          {classic.lines.map((line) => {
            const isDrop = dropTargetId === line.id;
            return isDrop ? <line key={`drop-${line.id}`} x1={line.spanStartX} y1={line.rowY - 12} x2={line.spanEndX} y2={line.rowY - 12} stroke="#f59e0b" strokeWidth={3} strokeDasharray="6 3" opacity={0.9} /> : null;
          })}
        </g>
      </svg>

      <CanvasLegend characterMarkingActive={!readOnly && currentTool === 'mark' && markingMode === 'CHARACTERS'} selection={selection} />

      <button type="button" onClick={() => setShowSymbols((v) => !v)} className="absolute bottom-3 right-3 z-10 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm backdrop-blur hover:bg-white" aria-expanded={showSymbols}>دليل الرموز</button>

      {showSymbols && <SymbolsLegend catalog={catalog} onClose={() => setShowSymbols(false)} />}

      {openReader && <ReaderCard reader={openReader} catalog={catalog} onClose={() => setOpenReader(null)} />}

      {/* طبقة سحب احترافية */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-2 p-2">
        {dragLineId && <span className="rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold text-white shadow-lg">اسحب إلى موضع الإدراج · Shift للدمج</span>}
      </div>
    </div>
  );
}

function ReaderCard({ reader, catalog, onClose }: { reader: ClassicReaderChip; catalog: TransmissionCatalog; onClose: () => void }) {
  const narrator = catalog.narrators.find((item) => item.id === reader.narratorId);
  const imam = catalog.imams.find((item) => item.id === narrator?.imamId);
  const profile = getNarratorProfile(reader.narratorId);
  return (
    <div role="dialog" aria-modal="true" aria-label={`تعريف الراوي ${reader.name}`} className="absolute inset-0 z-20 flex items-center justify-center bg-stone-900/30 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-base font-bold text-white" style={{ fontFamily: "'Amiri Quran', serif" }}>{reader.symbol || '—'}</span>
            <div><h4 className="text-sm font-bold text-stone-900">{reader.name}</h4><p className="text-[11px] text-stone-500">{imam ? `راوٍ عن ${imam.name}` : 'راوٍ'}{narrator?.legacyOrderInTayyibah ? ` · ترتيبه ${narrator.legacyOrderInTayyibah}` : ''}</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded px-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="إغلاق">×</button>
        </div>
        {profile ? <dl className="mt-3 space-y-1.5 border-t border-stone-100 pt-3 text-[12px] leading-relaxed">{profile.fullName && <div><dt className="inline font-medium text-stone-800">الاسم: </dt><dd className="inline text-stone-600">{profile.fullName}</dd></div>}{(profile.died || profile.place) && <div><dt className="inline font-medium text-stone-800">الوفاة: </dt><dd className="inline text-stone-600">{profile.died ?? '—'}{profile.place ? ` · ${profile.place}` : ''}</dd></div>}{profile.summary && <p className="pt-1 text-stone-700">{profile.summary}</p>}</dl> : <p className="mt-3 border-t border-stone-100 pt-3 text-[12px] text-stone-500">لا توجد نبذة.</p>}
        <p className="mt-3 border-t border-stone-100 pt-2 text-[10px] leading-relaxed text-stone-400">نبذة تعريفية موجزة للاستئناس.</p>
      </div>
    </div>
  );
}

function CanvasLegend({ characterMarkingActive = false, selection }: { characterMarkingActive?: boolean; selection?: any }) {
  const categories = Object.keys(CATEGORY_LABELS) as Array<VariantCategory>;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-xs text-stone-600 shadow-sm backdrop-blur">
      {characterMarkingActive && <p className="mb-1.5 font-medium text-amber-800">وضع الحروف: انقر الحرف نفسه.</p>}
      {selection && <p className="mb-1 font-bold text-emerald-800">المحدد: {selection.kind} {selection.id?.slice(0, 10)} موضع {selection.position ?? '-'}</p>}
      <div className="flex flex-wrap items-center gap-3">{categories.map((cat) => <span key={cat} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getCategorySoftColor(cat), border: `1px solid ${getCategoryColor(cat)}` }} />{CATEGORY_LABELS[cat]}</span>)}</div>
      <p className="mt-1 text-[10px] text-stone-400">Ctrl+C نسخ · Ctrl+V لصق · سحب لإعادة الترتيب · Shift+سحب للدمج</p>
    </div>
  );
}

function CanvasMessage({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'error' }) {
  return <div className="flex h-full min-h-[400px] items-center justify-center bg-[#fdfaf2]"><p className={tone === 'error' ? 'text-red-700' : 'text-stone-500'}>{text}</p></div>;
}

function SymbolsLegend({ catalog, onClose }: { catalog: TransmissionCatalog; onClose: () => void }) {
  return (
    <div className="absolute bottom-14 right-3 z-10 max-h-[70vh] w-72 overflow-auto rounded-xl border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur custom-scrollbar">
      <div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-bold text-stone-800">دليل الرموز - ترتيب صريح</h4><button type="button" onClick={onClose} className="rounded px-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="إغلاق">×</button></div>
      <h5 className="mb-1 text-[11px] font-semibold text-stone-700">رموز الأئمة (حسب order)</h5>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">{getImamsWithSymbols(catalog).map((imam) => <li key={imam.id} className="flex items-center gap-1.5 text-[11px] text-stone-700"><span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-stone-800 px-0.5 text-[10px] font-bold text-white" style={{ fontFamily: "'Amiri Quran', serif" }}>{imam.symbol || '—'}</span><span className="truncate">{imam.name}</span></li>)}</ul>
      <h5 className="mb-1 mt-3 text-[11px] font-semibold text-stone-700">رموز الرواة (ترتيب صريح)</h5>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">{getNarratorsByTayyibah(catalog).map((n) => <li key={n.id} className="flex items-center gap-1.5 text-[11px] text-stone-700"><span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-emerald-600 px-0.5 text-[10px] font-bold text-white" style={{ fontFamily: "'Amiri Quran', serif" }}>{n.symbol || '—'}</span><span className="truncate">{n.name}</span></li>)}</ul>
      <p className="mt-2 border-t border-stone-100 pt-2 text-[10px] leading-relaxed text-stone-500">الترتيب صريح رقمي: Display Order ≠ Name Order. يظهر بجانب السطر حسب order المحدد.</p>
    </div>
  );
}

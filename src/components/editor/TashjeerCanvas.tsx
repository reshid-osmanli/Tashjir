// لوحة التشجير الكلاسيكي - Classic Tashjeer Canvas
// مشروع التشجير - نظام القراءات العشر
//
// اللوحة هي المكوّن المركزي في المحرر. تعرض التشجير الكلاسيكي:
//   - نص الآية (راوي الأساس المختار في إعدادات المحرك) في الأعلى كخط أساس.
//   - تحت كل كلمة مختلفة خطٌّ أفقيٌّ لكل وجه، يبدأ بالترتيب (قالون أولاً)،
//     وفوق الخط رمز القارئ ورموز مَن اتفق معه، وتحته نص الاختلاف ملوّناً بنوعه.
//
// كل الرسم بـ SVG: النص العربي يُرسم بخط المصحف، وكل عنصر قابل للتحديد
// والتصدير. العناصر متجهية فالتكبير لا يفقد الدقة.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import {
  CATEGORY_LABELS,
} from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { TashjeerFigure } from './TashjeerFigure';
import { getNarratorsByTayyibah } from '@/lib/tashjeer/symbols';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import type { ClassicLine } from '@/lib/tashjeer/classic-tashjeer';
import type { VariantCategory } from '@/types';
import type { WordBox } from '@/types/tashjeer';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';

interface TashjeerCanvasProps {
  /** حجم خط المصحف، قابل للضبط من شريط الأدوات */
  fontSize?: number;
  /** وضع العرض فقط: يعطّل كل التفاعل التحريري */
  readOnly?: boolean;
}

export function TashjeerCanvas({ fontSize = 34, readOnly = false }: TashjeerCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panState = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [showSymbols, setShowSymbols] = useState(false);

  const {
    document,
    filter,
    zoom,
    pan,
    currentTool,
    markedPositions,
    selectedWordId,
    selectedVariantId,
    setZoom,
    setPan,
    selectWord,
    selectVariant,
    selectBranch,
    refreshDerivedBranches,
    toggleMarkedPosition,
  } = useEditorStore();

  const catalog = useTransmissionCatalog();
  const engine = useEngineSettings();

  // عند تعديل قارئ أو رمز أو طريق من لوحة التحكم، حدّث الخطوط المشتقة مع
  // إبقاء مواضع الأسطر اليدوية كما هي. لا يحتاج المحرر إلى إعادة فتح الآية.
  useEffect(() => {
    refreshDerivedBranches();
  }, [catalog.updatedAt, engine.rowSpacing, engine.textToTreeGap, engine.tieBreakOrder, engine.symbolDisplay, refreshDerivedBranches]);

  const { ayah, layout, classic, viewBox } = useAyahTashjeer(
    document,
    filter,
    { fontSize },
    { catalog, engine }
  );

  // ==================== التفاعل ====================

  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(zoom * (event.deltaY > 0 ? 0.92 : 1.08));
    },
    [setZoom, zoom]
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      const isMiddleButton = event.button === 1;
      const isEmptyArea = event.target === svgRef.current;
      if (!isMiddleButton && !isEmptyArea) return;

      panState.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (!panState.current) return;
      setPan({
        x: panState.current.panX + (event.clientX - panState.current.x),
        y: panState.current.panY + (event.clientY - panState.current.y),
      });
    },
    [setPan]
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
        toggleMarkedPosition(box.position);
        return;
      }

      selectWord(box.wordId === selectedWordId ? null : box.wordId);

      const variant = document?.variants.find(
        (item) => box.position >= item.startPosition && box.position <= item.endPosition
      );
      selectVariant(variant?.id ?? null);
    },
    [currentTool, document, readOnly, selectVariant, selectWord, selectedWordId, toggleMarkedPosition]
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
      selectVariant(nextVariantId);
      selectBranch(nextVariantId ? line.id : null);
    },
    [readOnly, selectBranch, selectVariant, selectedVariantId]
  );

  // الكلمات المشمولة باختلاف: تُظلَّل تظليلا خفيفا يرشد المحرر.
  const coveredPositions = useMemo(() => {
    if (!document) return [];
    const positions = new Set<number>();
    for (const variant of document.variants) {
      for (let position = variant.startPosition; position <= variant.endPosition; position++) {
        positions.add(position);
      }
    }
    return [...positions];
  }, [document]);

  // ==================== حالات فارغة ====================

  if (!document) {
    return <CanvasMessage text="اختر سورة وآية لبدء التشجير." />;
  }

  if (!ayah || layout.boxes.length === 0) {
    return <CanvasMessage text="تعذر تحميل نص هذه الآية." tone="error" />;
  }

  const cursor = readOnly
    ? 'default'
    : currentTool === 'mark'
      ? 'crosshair'
      : 'default';

  return (
    <div className="relative h-full w-full overflow-auto bg-[#fdfaf2]">
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
          <filter id="branch-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.45" />
          </filter>
          <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d6d3d1" strokeWidth="0.5" />
          </pattern>
        </defs>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {filter.showGrid && (
            <rect
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              fill="url(#canvas-grid)"
              pointerEvents="none"
            />
          )}

          <TashjeerFigure
            layout={layout}
            classic={classic}
            viewBox={viewBox}
            fontSize={fontSize}
            showLabels={filter.showLabels}
            showRulers={filter.showRulers}
            showAnchors={filter.showAnchors}
            boundaries={document.boundaries}
            baseNarratorName={
              catalog.narrators.find((narrator) => narrator.id === 'narrator-hafs')?.name ?? 'حفص'
            }
            engine={engine}
            markedPositions={markedPositions}
            coveredPositions={coveredPositions}
            selectedWordId={selectedWordId}
            selectedVariantId={selectedVariantId}
            hoveredLineId={hoveredLineId}
            onWordClick={handleWordClick}
            onLineClick={handleLineClick}
            onLineHoverStart={(line) => setHoveredLineId(line.id)}
            onLineHoverEnd={() => setHoveredLineId(null)}
          />
        </g>
      </svg>

      <CanvasLegend />

      <button
        type="button"
        onClick={() => setShowSymbols((value) => !value)}
        className="absolute bottom-3 right-3 z-10 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm backdrop-blur hover:bg-white"
        aria-expanded={showSymbols}
      >
        دليل الرموز
      </button>

      {showSymbols && <SymbolsLegend catalog={catalog} onClose={() => setShowSymbols(false)} />}
    </div>
  );
}

// ==================== عناصر خاصة بالمحرر ====================

function CanvasLegend() {
  const categories = Object.keys(CATEGORY_LABELS) as Array<VariantCategory>;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-xs text-stone-600 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {categories.map((category) => (
          <span key={category} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getCategorySoftColor(category), border: `1px solid ${getCategoryColor(category)}` }}
            />
            {CATEGORY_LABELS[category]}
          </span>
        ))}
      </div>
    </div>
  );
}

function CanvasMessage({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'error' }) {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center bg-[#fdfaf2]">
      <p className={tone === 'error' ? 'text-red-700' : 'text-stone-500'}>{text}</p>
    </div>
  );
}

/** دليل رموز القراء: يربط كل رمز باسم راويه. */
function SymbolsLegend({
  catalog,
  onClose,
}: {
  catalog: TransmissionCatalog;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-14 right-3 z-10 w-60 rounded-xl border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-bold text-stone-800">رموز القراء</h4>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="إغلاق"
        >
          ×
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {getNarratorsByTayyibah(catalog).map((narrator) => (
          <li key={narrator.id} className="flex items-center gap-1.5 text-[11px] text-stone-700">
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-600 text-[10px] font-bold text-white"
              style={{ fontFamily: "'Amiri Quran', serif" }}
            >
              {narrator.symbol || '—'}
            </span>
            <span className="truncate">{narrator.name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-stone-100 pt-2 text-[10px] leading-relaxed text-stone-500">
        رمز «—» للأصل (حفص عن عاصم = نص المصحف). تتكرر الرموز لقراء كل إمام على حدة.
      </p>
    </div>
  );
}

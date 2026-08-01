// لوحة التشجير الكلاسيكي - Classic Tashjeer Canvas
// مشروع التشجير - نظام القراءات العشر
//
// اللوحة هي المكوّن المركزي في المحرر. تعرض التشجير الكلاسيكي:
//   - نص الآية (رواية حفص = «الجمهور») في الأعلى كخط أساس.
//   - تحت كل كلمة مختلفة خطٌّ أفقيٌّ لكل وجه، يبدأ بالترتيب (قالون أولاً)،
//     وفوق الخط رمز القارئ ورموز مَن اتفق معه، وتحته نص الاختلاف ملوّناً بنوعه.
//
// كل الرسم بـ SVG: النص العربي يُرسم بخط المصحف، وكل عنصر قابل للتحديد
// والتصدير. العناصر متجهية فالتكبير لا يفقد الدقة.

'use client';

import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import {
  CATEGORY_LABELS,
} from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { NARRATORS_BY_TAYYIBAH } from '@/lib/tashjeer/symbols';
import type { ClassicLine } from '@/lib/tashjeer/classic-tashjeer';
import type { VariantCategory } from '@/types';
import type { WordBox } from '@/types/tashjeer';

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
    toggleMarkedPosition,
  } = useEditorStore();

  const { ayah, layout, classic, viewBox } = useAyahTashjeer(document, filter, { fontSize });

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
      selectVariant(line.variantId === selectedVariantId ? null : line.variantId);
    },
    [readOnly, selectVariant, selectedVariantId]
  );

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

          {filter.showRulers && <Rulers viewBox={viewBox} />}

          {/* الخط الأساس: نص المصحف = «الجمهور» */}
          <BaselineBand layout={layout} viewBox={viewBox} />

          {/* خطوط التشجير الكلاسيكية */}
          <g>
            {classic.lines.map((line) => (
              <ClassicLineShape
                key={line.id}
                line={line}
                fontSize={fontSize}
                showLabels={filter.showLabels}
                isSelected={line.variantId === selectedVariantId}
                isHovered={line.id === hoveredLineId}
                onClick={() => handleLineClick(line)}
                onHoverStart={() => setHoveredLineId(line.id)}
                onHoverEnd={() => setHoveredLineId(null)}
              />
            ))}

            {!classic.hasDifferences && <MajorityLine classic={classic} />}
          </g>

          {/* نص الآية فوق الخطوط ليظل واضحا وقابلا للنقر */}
          <g>
            {layout.boxes.map((box) => (
              <WordShape
                key={box.wordId}
                box={box}
                fontSize={fontSize}
                isMarked={markedPositions.includes(box.position)}
                isSelected={box.wordId === selectedWordId}
                isCovered={isCovered(box.position, document.variants)}
                showAnchors={filter.showAnchors}
                onClick={() => handleWordClick(box)}
              />
            ))}
          </g>
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

      {showSymbols && <SymbolsLegend onClose={() => setShowSymbols(false)} />}
    </div>
  );
}

// ==================== الكلمة ====================

function WordShape({
  box,
  fontSize,
  isMarked,
  isSelected,
  isCovered,
  showAnchors,
  onClick,
}: {
  box: WordBox;
  fontSize: number;
  isMarked: boolean;
  isSelected: boolean;
  isCovered: boolean;
  showAnchors: boolean;
  onClick: () => void;
}) {
  const highlight = isMarked
    ? '#fde68a'
    : isSelected
      ? '#bbf7d0'
      : isCovered
        ? '#f1f5f9'
        : 'transparent';

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }} data-word-id={box.wordId}>
      <rect
        x={box.x - 4}
        y={box.topY - 4}
        width={box.width + 8}
        height={box.height + 8}
        rx={6}
        fill={highlight}
        stroke={isMarked || isSelected ? '#0f766e' : 'transparent'}
        strokeWidth={1.2}
      />

      <text
        x={box.centerX}
        y={box.baselineY}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="'Amiri Quran', 'Amiri', serif"
        fill="#1c1917"
        style={{ direction: 'rtl', userSelect: 'none' }}
      >
        {box.text}
      </text>

      {showAnchors && (
        <>
          <circle cx={box.centerX} cy={box.topY - 3} r={2} fill="#94a3b8" opacity={0.55} />
          <circle cx={box.centerX} cy={box.bottomY + 3} r={2} fill="#94a3b8" opacity={0.55} />
        </>
      )}

      <title>{`الكلمة ${box.position}: ${box.text}`}</title>
    </g>
  );
}

// ==================== خط التشجير الكلاسيكي ====================

function ClassicLineShape({
  line,
  fontSize,
  showLabels,
  isSelected,
  isHovered,
  onClick,
  onHoverStart,
  onHoverEnd,
}: {
  line: ClassicLine;
  fontSize: number;
  showLabels: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const color = getCategoryColor(line.category);
  const soft = getCategorySoftColor(line.category);
  const strokeWidth = isSelected ? 3 : isHovered ? 2.4 : 1.8;
  const opacity = isSelected || isHovered ? 1 : 0.9;

  if (line.marks.length === 0) return null;

  const xs = line.marks.map((mark) => mark.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const pad = 16;
  const lineStart = minX - pad;
  const lineEnd = maxX + pad;

  return (
    <g
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{ cursor: 'pointer' }}
      data-line-id={line.id}
    >
      {/* الممر الشفاف العريض لتسهيل النقر على الخط */}
      <rect
        x={lineStart}
        y={line.rowY - 9}
        width={lineEnd - lineStart}
        height={18}
        fill="transparent"
      />

      {/* الوصلات الرأسية من كل كلمة مختلفة إلى الخط */}
      {line.marks.map((mark) => (
        <line
          key={`c-${mark.wordId}`}
          x1={mark.x}
          y1={mark.bottomY}
          x2={mark.x}
          y2={line.rowY}
          stroke={color}
          strokeWidth={1.1}
          opacity={0.55}
        />
      ))}

      {/* الخط الأفقي للوجه */}
      <line
        x1={lineStart}
        y1={line.rowY}
        x2={lineEnd}
        y2={line.rowY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
        filter={isSelected ? 'url(#branch-glow)' : undefined}
      />

      {/* العقد على الكلمات المختلفة */}
      {line.marks.map((mark) => (
        <circle
          key={`d-${mark.wordId}`}
          cx={mark.x}
          cy={line.rowY}
          r={isSelected ? 4 : 3.2}
          fill={color}
          stroke="#ffffff"
          strokeWidth={1.2}
        />
      ))}

      {/* نص الاختلاف تحت الكلمة، ملوّناً بنوعه.
          للاختلاف متعدد الكلمات نعرضه مرة واحدة فوق المدى لتفادي التداخل. */}
      {showLabels &&
        (line.marks.length > 1 ? (
          <text
            key="reading-span"
            x={(minX + maxX) / 2}
            y={line.rowY - 8}
            textAnchor="middle"
            fontSize={Math.round(fontSize * 0.5)}
            fontFamily="'Amiri Quran', 'Amiri', serif"
            fill={color}
            style={{ direction: 'rtl', userSelect: 'none', fontWeight: 600 }}
          >
            {line.readingText}
          </text>
        ) : (
          <text
            key="reading-single"
            x={line.marks[0].x}
            y={line.rowY - 8}
            textAnchor="middle"
            fontSize={Math.round(fontSize * 0.5)}
            fontFamily="'Amiri Quran', 'Amiri', serif"
            fill={color}
            style={{ direction: 'rtl', userSelect: 'none', fontWeight: 600 }}
          >
            {line.readingText}
          </text>
        ))}

      {/* بطاقة رأس الخط: رموز القراء واسم الرئيس ونوع الاختلاف */}
      {showLabels && (
        <LineLabel line={line} color={color} soft={soft} x={maxX + 20} y={line.rowY} />
      )}

      <title>{lineTitle(line)}</title>
    </g>
  );
}

function LineLabel({
  line,
  color,
  soft,
  x,
  y,
}: {
  line: ClassicLine;
  color: string;
  soft: string;
  x: number;
  y: number;
}) {
  const badgeWidth = Math.max(line.label.length * 13 + 18, 34);
  const text = `${line.primaryNarratorName} · ${line.categoryLabel}`;

  return (
    <g>
      <rect
        x={x}
        y={y - 13}
        width={badgeWidth}
        height={26}
        rx={8}
        fill={soft}
        stroke={color}
        strokeWidth={1.2}
      />
      <text
        x={x + badgeWidth / 2}
        y={y + 5}
        textAnchor="middle"
        fontSize={14}
        fontFamily="'Amiri Quran', 'Amiri', serif"
        fill={color}
        style={{ direction: 'rtl', userSelect: 'none', fontWeight: 700 }}
      >
        {line.label}
      </text>
      <text
        x={x + badgeWidth + 8}
        y={y + 5}
        textAnchor="start"
        fontSize={12.5}
        fontFamily="system-ui, sans-serif"
        fill="#475569"
        style={{ direction: 'rtl', userSelect: 'none' }}
      >
        {text}
      </text>
    </g>
  );
}

function lineTitle(line: ClassicLine): string {
  const readers = line.readerNames.join('، ');
  return `القارئ: ${line.primaryNarratorName} — النوع: ${line.categoryLabel}\nالقراء المتفقون: ${readers}\nالوجه: ${line.readingText}${line.readingLabel ? ` (${line.readingLabel})` : ''}`;
}

// ==================== عناصر مساعدة ====================

/** شريط «الجمهور» تحت نص الآية: يوضّح أن النص المطبوع هو رواية حفص. */
function BaselineBand({
  layout,
  viewBox,
}: {
  layout: { boxes: WordBox[] };
  viewBox: { x: number; y: number; width: number; height: number };
}) {
  if (layout.boxes.length === 0) return null;

  const top = Math.min(...layout.boxes.map((box) => box.topY));
  const bottom = Math.max(...layout.boxes.map((box) => box.bottomY));
  const rightX = Math.max(...layout.boxes.map((box) => box.x + box.width));
  const leftX = Math.min(...layout.boxes.map((box) => box.x));
  const bandY = bottom + 10;

  return (
    <g pointerEvents="none">
      <rect
        x={leftX - 10}
        y={top - 8}
        width={rightX - leftX + 20}
        height={bottom - top + 16}
        rx={10}
        fill="#fffdf7"
        stroke="#e7e5e4"
        strokeWidth={1}
      />
      <line
        x1={leftX - 10}
        y1={bandY}
        x2={rightX + 10}
        y2={bandY}
        stroke="#94a3b8"
        strokeWidth={1.4}
        strokeDasharray="2 5"
        opacity={0.8}
      />
      <text
        x={rightX + 22}
        y={bandY + 5}
        fontSize={13}
        fill="#0f766e"
        fontFamily="system-ui, sans-serif"
        style={{ direction: 'rtl', userSelect: 'none', fontWeight: 700 }}
      >
        الجمهور · حفص
      </text>
      <text
        x={viewBox.x + 12}
        y={top - 16}
        fontSize={11}
        fill="#0f766e"
        fontFamily="system-ui, sans-serif"
      >
        نص المصحف (الأساس)
      </text>
    </g>
  );
}

/** خط «الجمهور» عندما لا توجد أي اختلافات في الآية. */
function MajorityLine({ classic }: { classic: { textBottom: number; firstRowY: number } }) {
  const y = classic.firstRowY;
  return (
    <g pointerEvents="none">
      <line
        x1={-200}
        y1={y}
        x2={1000}
        y2={y}
        stroke="#94a3b8"
        strokeWidth={1.4}
        strokeDasharray="2 5"
      />
      <text
        x={20}
        y={y + 5}
        fontSize={14}
        fill="#0f766e"
        fontFamily="system-ui, sans-serif"
        style={{ direction: 'rtl', userSelect: 'none', fontWeight: 700 }}
      >
        الجمهور
      </text>
    </g>
  );
}

function Rulers({ viewBox }: { viewBox: { x: number; y: number; width: number; height: number } }) {
  const step = 100;
  const marks: number[] = [];
  for (let x = Math.ceil(viewBox.x / step) * step; x < viewBox.x + viewBox.width; x += step) {
    marks.push(x);
  }

  return (
    <g opacity={0.6} pointerEvents="none">
      {marks.map((x) => (
        <g key={x}>
          <line
            x1={x}
            y1={viewBox.y}
            x2={x}
            y2={viewBox.y + viewBox.height}
            stroke="#cbd5e1"
            strokeWidth={0.5}
            strokeDasharray="4 6"
          />
          <text x={x + 3} y={viewBox.y + 12} fontSize={9} fill="#94a3b8">
            {x}
          </text>
        </g>
      ))}
    </g>
  );
}

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
function SymbolsLegend({ onClose }: { onClose: () => void }) {
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
        {NARRATORS_BY_TAYYIBAH.map((narrator) => (
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

/** هل هذه الكلمة مشمولة بأي اختلاف؟ يُستخدم لتظليل خفيف يرشد المحرر. */
function isCovered(
  position: number,
  variants: Array<{ startPosition: number; endPosition: number }>
): boolean {
  return variants.some(
    (variant) => position >= variant.startPosition && position <= variant.endPosition
  );
}

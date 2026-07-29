// لوحة التشجير - Tashjeer Canvas
// مشروع التشجير - نظام القراءات العشر
//
// اللوحة هي المكوّن المركزي في المحرر. مسؤوليتها:
//   1. رسم نص الآية بخط المصحف في مواضعه المحسوبة.
//   2. رسم خطوط التشجير وبطاقات الأوجه.
//   3. استقبال تفاعل المستخدم: تعليم الكلمات، تحديد الخطوط، التكبير، السحب.
//
// كل الرسم بـ SVG وليس Canvas، لأسباب عملية:
//   - النص العربي يُرسم بخط المصحف مع تشكيله دون معالجة يدوية.
//   - كل عنصر قابل للتحديد والاختبار والتصدير إلى PNG/SVG مباشرة.
//   - العناصر متجهية، فالتكبير لا يفقد الدقة.

'use client';

import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import { getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import type { RenderedBranch, WordBox } from '@/types/tashjeer';

interface TashjeerCanvasProps {
  /** حجم خط المصحف، قابل للضبط من شريط الأدوات */
  fontSize?: number;
  /** وضع العرض فقط: يعطّل كل التفاعل التحريري */
  readOnly?: boolean;
}

export function TashjeerCanvas({ fontSize = 34, readOnly = false }: TashjeerCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panState = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [hoveredBranchId, setHoveredBranchId] = useState<string | null>(null);

  const {
    document,
    filter,
    zoom,
    pan,
    currentTool,
    markedPositions,
    selectedWordId,
    selectedVariantId,
    selectedBranchId,
    setZoom,
    setPan,
    selectWord,
    selectVariant,
    selectBranch,
    toggleMarkedPosition,
    toggleBranchVisibility,
  } = useEditorStore();

  const { ayah, layout, branches, viewBox } = useAyahTashjeer(document, filter, { fontSize });

  // ==================== التفاعل ====================

  /** التكبير بعجلة الفأرة مع مفتاح Ctrl، والتمرير الرأسي بدونه. */
  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(zoom * (event.deltaY > 0 ? 0.92 : 1.08));
    },
    [setZoom, zoom]
  );

  /** بدء السحب بزر الفأرة الأوسط أو بالضغط على مساحة فارغة بأداة التحديد. */
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

  /** النقر على كلمة: يعلّمها أو يحددها بحسب الأداة الحالية. */
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

      // تحديد الكلمة يبرز أول اختلاف يشملها، لتسهيل الوصول إليه.
      const variant = document?.variants.find(
        (item) => box.position >= item.startPosition && box.position <= item.endPosition
      );
      selectVariant(variant?.id ?? null);
    },
    [currentTool, document, readOnly, selectVariant, selectWord, selectedWordId, toggleMarkedPosition]
  );

  /** النقر على خط: يحدده، أو يخفيه إذا كانت أداة المسح فعّالة. */
  const handleBranchClick = useCallback(
    (branch: RenderedBranch) => {
      if (!readOnly && currentTool === 'erase') {
        toggleBranchVisibility(branch.id);
        return;
      }

      selectBranch(branch.id === selectedBranchId ? null : branch.id);
      selectVariant(branch.variantId);
    },
    [currentTool, readOnly, selectBranch, selectVariant, selectedBranchId, toggleBranchVisibility]
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
      : currentTool === 'erase'
        ? 'not-allowed'
        : 'default';

  return (
    <div className="relative h-full w-full overflow-auto bg-[#fdfaf2]">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`لوحة تشجير الآية ${ayah.ayahNumber} من السورة ${ayah.surahNumber}`}
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

          {/* شريط الأساس: يوضح أن النص المرسوم هو رواية حفص */}
          <BaselineBands layout={layout} viewBox={viewBox} />

          {/* الخطوط تُرسم قبل النص حتى لا تغطي الحروف */}
          <g>
            {branches.map((branch) => (
              <BranchShape
                key={branch.id}
                branch={branch}
                isSelected={branch.id === selectedBranchId || branch.variantId === selectedVariantId}
                isHovered={branch.id === hoveredBranchId}
                showLabel={filter.showLabels}
                onClick={() => handleBranchClick(branch)}
                onHoverStart={() => setHoveredBranchId(branch.id)}
                onHoverEnd={() => setHoveredBranchId(null)}
              />
            ))}
          </g>

          {/* نص الآية */}
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
        x={box.x + box.width}
        y={box.baselineY}
        textAnchor="end"
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

// ==================== الخط ====================

function BranchShape({
  branch,
  isSelected,
  isHovered,
  showLabel,
  onClick,
  onHoverStart,
  onHoverEnd,
}: {
  branch: RenderedBranch;
  isSelected: boolean;
  isHovered: boolean;
  showLabel: boolean;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const strokeWidth = isSelected ? 3 : isHovered ? 2.4 : 1.8;
  const opacity = isSelected || isHovered ? 1 : 0.85;

  return (
    <g
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{ cursor: 'pointer' }}
      data-branch-id={branch.id}
    >
      {/* مسار شفاف عريض: يوسّع مساحة النقر دون تغيير الشكل */}
      <path d={branch.path} fill="none" stroke="transparent" strokeWidth={14} />

      <path
        d={branch.path}
        fill="none"
        stroke={branch.color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
        filter={isSelected ? 'url(#branch-glow)' : undefined}
      />

      {branch.points.map((point) => (
        <circle
          key={point.wordId}
          cx={point.x}
          cy={point.y}
          r={isSelected ? 4 : 3}
          fill={branch.color}
          stroke="#ffffff"
          strokeWidth={1.2}
        />
      ))}

      {showLabel && (
        <BranchLabel branch={branch} isSelected={isSelected || isHovered} />
      )}

      <title>{`${CATEGORY_LABELS[branch.category]}: ${branch.label}`}</title>
    </g>
  );
}

function BranchLabel({ branch, isSelected }: { branch: RenderedBranch; isSelected: boolean }) {
  // عرض تقريبي: الحرف العربي في هذا المقاس يشغل نحو 8.2 وحدة.
  const width = Math.max(branch.label.length * 8.2 + 20, 64);
  const height = 22;
  const x = branch.labelX - width;
  const y = branch.laneY - height / 2;

  return (
    <g>
      <line
        x1={branch.labelX}
        y1={branch.laneY}
        x2={branch.labelX - 6}
        y2={branch.laneY}
        stroke={branch.color}
        strokeWidth={1.6}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill={getCategorySoftColor(branch.category)}
        stroke={branch.color}
        strokeWidth={isSelected ? 1.6 : 1}
      />
      <text
        x={x + width - 10}
        y={y + height / 2 + 4.5}
        textAnchor="end"
        fontSize={12}
        fontFamily="system-ui, sans-serif"
        fill="#1f2937"
        style={{ direction: 'rtl', userSelect: 'none' }}
      >
        {branch.label}
      </text>
    </g>
  );
}

// ==================== عناصر مساعدة ====================

/** خلفيتان خفيفتان تفصلان منطقة الأصول (فوق) عن منطقة الفرش (تحت). */
function BaselineBands({
  layout,
  viewBox,
}: {
  layout: { boxes: WordBox[] };
  viewBox: { x: number; y: number; width: number; height: number };
}) {
  if (layout.boxes.length === 0) return null;

  const top = Math.min(...layout.boxes.map((box) => box.topY));
  const bottom = Math.max(...layout.boxes.map((box) => box.bottomY));

  return (
    <g pointerEvents="none">
      <rect
        x={viewBox.x}
        y={top - 10}
        width={viewBox.width}
        height={bottom - top + 20}
        fill="#fffdf7"
        stroke="#e7e5e4"
        strokeWidth={1}
        rx={8}
      />
      <text
        x={viewBox.x + 12}
        y={top - 18}
        fontSize={11}
        fill="#0f766e"
        fontFamily="system-ui, sans-serif"
      >
        منطقة الأصول والمدود
      </text>
      <text
        x={viewBox.x + 12}
        y={bottom + 26}
        fontSize={11}
        fill="#1d4ed8"
        fontFamily="system-ui, sans-serif"
      >
        منطقة الفرش والهمز والوقف
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
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-xs text-stone-600 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((category) => (
          <span key={category} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getCategorySoftColor(category) }}
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

/** هل هذه الكلمة مشمولة بأي اختلاف؟ يُستخدم لتظليل خفيف يرشد المحرر. */
function isCovered(
  position: number,
  variants: Array<{ startPosition: number; endPosition: number }>
): boolean {
  return variants.some(
    (variant) => position >= variant.startPosition && position <= variant.endPosition
  );
}

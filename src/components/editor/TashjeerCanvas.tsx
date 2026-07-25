'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMushafLayout } from '@/hooks/useMushafLayout';
import { useTashjeerLines } from '@/hooks/useTashjeerLines';
import { WordMarker } from './WordMarker';
import { LineDrawer } from './LineDrawer';
import { EvidencePopup } from './EvidencePopup';
import { useEditorStore } from '@/stores/editor-store';
import { LineType, NodePosition, TashjeerLine, WordPosition } from '@/types';

type MushafWord = {
  id: number;
  text: string;
  position: number;
};

type HoveredNode = {
  wordText?: string;
};

interface TashjeerCanvasProps {
  ayahId: number;
  surahId: number;
  qiraahOrder: number[];
  readOnly?: boolean;
  onSave?: (data: unknown) => void;
}

export function TashjeerCanvas({
  ayahId,
  surahId,
  qiraahOrder,
  readOnly = false,
  onSave,
}: TashjeerCanvasProps) {
  const canvasRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const {
    zoom,
    pan,
    setZoom,
    currentTool,
    currentLineType,
    currentQiraahId,
    selectedWordId,
    selectedLineId,
    showGrid,
    showRulers,
    selectWord,
    selectLine,
    clearSelection,
    setUnsavedChanges,
  } = useEditorStore();

  const { words, positions, isLoading, error: layoutError } = useMushafLayout(ayahId, surahId);
  const {
    lines,
    addLine,
    updateLine,
    deleteLine,
    addNode,
    removeNode,
    error: linesError,
  } = useTashjeerLines(ayahId, surahId);

  useEffect(() => {
    clearSelection();
  }, [ayahId, surahId, clearSelection]);

  useEffect(() => {
    onSave?.({ surahId, ayahId, lines });
  }, [ayahId, lines, onSave, surahId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(Math.min(Math.max(zoom * delta, 0.5), 3));
  }, [zoom, setZoom]);

  const handleWordSelect = useCallback((word: MushafWord, wordPosition: WordPosition) => {
    selectWord(word.id);
    if (readOnly || currentTool === 'select') return;

    if (currentTool === 'delete') {
      const targetLines = selectedLineId
        ? lines.filter((line) => line.id === selectedLineId)
        : lines;

      targetLines.forEach((line) => {
        const node = line.nodes.find((item) => item.wordId === word.id);
        if (node) removeNode(line.id, node.id);
      });
      setUnsavedChanges(true);
      return;
    }

    const lineType = getLineTypeForTool(currentTool) ?? currentLineType;
    const qiraahId = currentQiraahId || qiraahOrder[0] || 1;
    let targetLine = selectedLineId
      ? lines.find((line) => line.id === selectedLineId && line.type === lineType)
      : undefined;

    if (!targetLine) {
      targetLine = addLine(lineType, qiraahId);
      selectLine(Number(targetLine.id));
    }

    addNode(
      targetLine.id,
      word.id,
      getNodePositionForLine(lineType),
      { x: wordPosition.centerX, y: targetLine.yPosition },
      qiraahId
    );
    setUnsavedChanges(true);
  }, [
    addLine,
    addNode,
    currentLineType,
    currentQiraahId,
    currentTool,
    lines,
    qiraahOrder,
    readOnly,
    removeNode,
    selectLine,
    selectWord,
    selectedLineId,
    setUnsavedChanges,
  ]);

  const handleLineDelete = useCallback((lineId: number) => {
    deleteLine(lineId);
    clearSelection();
    setUnsavedChanges(true);
  }, [clearSelection, deleteLine, setUnsavedChanges]);

  const error = layoutError ?? linesError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-700">
        {error.message}
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        لا توجد كلمات متاحة لهذه الآية.
      </div>
    );
  }

  return (
    <div className="tashjeer-canvas-container relative w-full h-full">
      <svg
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        style={{
          cursor: readOnly ? 'default' : 'crosshair',
          background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)',
        }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <MushafBackground />
          {showGrid && <GridOverlay />}
          {showRulers && <RulersOverlay />}
          <UsulArea />
          <MushafTextGroup words={words} positions={positions} />
          <TashjeerLinesGroup
            lines={lines}
            positions={positions}
            activeLineId={selectedLineId}
            onLineUpdate={updateLine}
            onLineDelete={handleLineDelete}
            onLineSelect={(lineId) => selectLine(lineId)}
          />
          <WordsMarkersGroup
            words={words}
            positions={positions}
            selectedWordId={selectedWordId}
            onHover={setHoveredNode}
            onWordSelect={handleWordSelect}
          />
        </g>
      </svg>

      {!readOnly && (
        <div
          className="absolute pointer-events-none w-8 h-8 border-2 border-emerald-500 rounded-full opacity-40"
          style={{
            left: mousePosition.x - 16,
            top: mousePosition.y - 16,
          }}
        />
      )}

      {hoveredNode && (
        <EvidencePopup
          node={hoveredNode}
          position={mousePosition}
          onClose={() => setHoveredNode(null)}
        />
      )}

      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow-lg">
        <span className="text-sm text-gray-600">
          التكبير: {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}

function MushafBackground() {
  return (
    <g>
      <rect
        x="50"
        y="30"
        width="694"
        height="900"
        fill="#fefce8"
        stroke="#d97706"
        strokeWidth="2"
        rx="8"
      />
      {[...Array(15)].map((_, i) => (
        <line
          key={i}
          x1="50"
          y1={80 + i * 55}
          x2="744"
          y2={80 + i * 55}
          stroke="#e5e7eb"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      ))}
    </g>
  );
}

function GridOverlay() {
  return (
    <g opacity="0.25">
      {[...Array(18)].map((_, i) => (
        <line key={`v-${i}`} x1={70 + i * 36} y1="30" x2={70 + i * 36} y2="930" stroke="#94a3b8" strokeWidth="0.5" />
      ))}
      {[...Array(22)].map((_, i) => (
        <line key={`h-${i}`} x1="50" y1={50 + i * 40} x2="744" y2={50 + i * 40} stroke="#94a3b8" strokeWidth="0.5" />
      ))}
    </g>
  );
}

function RulersOverlay() {
  const xMarks = [...Array(8)].map((_, index) => 100 + index * 80);
  const yMarks = [...Array(10)].map((_, index) => 120 + index * 80);

  return (
    <g opacity="0.7">
      <rect x="50" y="30" width="694" height="22" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
      <rect x="722" y="30" width="22" height="900" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />

      {xMarks.map((x) => (
        <g key={`rx-${x}`}>
          <line x1={x} y1="30" x2={x} y2="52" stroke="#64748b" strokeWidth="0.5" />
          <text x={x} y="47" textAnchor="middle" fontSize="8" fill="#64748b">
            {x}
          </text>
        </g>
      ))}

      {yMarks.map((y) => (
        <g key={`ry-${y}`}>
          <line x1="722" y1={y} x2="744" y2={y} stroke="#64748b" strokeWidth="0.5" />
          <text x="733" y={y - 3} textAnchor="middle" fontSize="8" fill="#64748b">
            {y}
          </text>
        </g>
      ))}
    </g>
  );
}

function UsulArea() {
  return (
    <g>
      <rect
        x="50"
        y="30"
        width="694"
        height="70"
        fill="#f0fdf4"
        stroke="#22c55e"
        strokeWidth="1"
        strokeDasharray="4,4"
        rx="4"
      />
      <text
        x="397"
        y="58"
        textAnchor="middle"
        fill="#16a34a"
        fontSize="14"
        fontWeight="bold"
      >
        منطقة الأصول
      </text>
    </g>
  );
}

function MushafTextGroup({
  words,
  positions,
}: {
  words: MushafWord[];
  positions: Map<number, WordPosition>;
}) {
  return (
    <g>
      {words.map((word) => {
        const pos = positions.get(word.id);
        if (!pos) return null;
        return (
          <text
            key={word.id}
            x={pos.x}
            y={pos.y}
            fontSize="24"
            fontFamily="UthmanicHafs, Amiri, serif"
            fill="#1e293b"
            textAnchor="start"
          >
            {word.text}
          </text>
        );
      })}
    </g>
  );
}

function TashjeerLinesGroup({
  lines,
  positions,
  activeLineId,
  onLineUpdate,
  onLineDelete,
  onLineSelect,
}: {
  lines: TashjeerLine[];
  positions: Map<number, WordPosition>;
  activeLineId: number | null;
  onLineUpdate: (line: TashjeerLine) => void;
  onLineDelete: (lineId: number) => void;
  onLineSelect: (lineId: number) => void;
}) {
  return (
    <g>
      {lines.map((line) => (
        <LineDrawer
          key={String(line.id)}
          line={line}
          positions={positions}
          isActive={line.id === activeLineId}
          onUpdate={onLineUpdate}
          onDelete={() => onLineDelete(Number(line.id))}
          onSelect={() => onLineSelect(Number(line.id))}
        />
      ))}
    </g>
  );
}

function WordsMarkersGroup({
  words,
  positions,
  selectedWordId,
  onHover,
  onWordSelect,
}: {
  words: MushafWord[];
  positions: Map<number, WordPosition>;
  selectedWordId: number | null;
  onHover: (node: HoveredNode) => void;
  onWordSelect: (word: MushafWord, position: WordPosition) => void;
}) {
  return (
    <g>
      {words.map((word) => {
        const pos = positions.get(word.id);
        if (!pos) return null;
        return (
          <WordMarker
            key={word.id}
            word={word}
            position={pos}
            isSelected={selectedWordId === word.id}
            onHover={onHover}
            onSelect={() => onWordSelect(word, pos)}
          />
        );
      })}
    </g>
  );
}

function getLineTypeForTool(tool: string): LineType | null {
  if (tool === 'line-usul') return 'USUL';
  if (tool === 'line-farsh') return 'FARSH';
  if (tool === 'line-madud') return 'MADUD';
  return null;
}

function getNodePositionForLine(type: LineType): NodePosition {
  if (type === 'USUL') return 'TOP';
  if (type === 'MADUD') return 'MIDDLE';
  return 'BOTTOM';
}

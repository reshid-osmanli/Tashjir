'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EntityId, LineType, NodePosition, TashjeerLine, TashjeerNode } from '@/types';
import { getLineColor, getQiraahColor } from '@/lib/tashjeer/color-system';

interface UseTashjeerLinesResult {
  lines: TashjeerLine[];
  addLine: (type: LineType, qiraahId: number) => TashjeerLine;
  updateLine: (line: TashjeerLine) => void;
  deleteLine: (lineId: EntityId) => void;
  addNode: (
    lineId: EntityId,
    wordId: number,
    position: NodePosition,
    point: { x: number; y: number },
    qiraahId?: number
  ) => void;
  removeNode: (lineId: EntityId, nodeId: EntityId) => void;
  clearLines: () => void;
  isLoading: boolean;
  error: Error | null;
}

export function useTashjeerLines(ayahId: number, surahId = 1): UseTashjeerLinesResult {
  const [lines, setLines] = useState<TashjeerLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const storageKey = useMemo(
    () => `tashjeer-lines:${surahId}:${ayahId}`,
    [surahId, ayahId]
  );

  useEffect(() => {
    try {
      setIsLoading(true);
      setError(null);

      const saved = window.localStorage.getItem(storageKey);
      const nextLines = saved
        ? deserializeLines(saved)
        : getInitialTashjeerLines(ayahId, surahId);

      setLines(nextLines);
      setIsHydrated(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('تعذر تحميل خطوط التشجير'));
      setLines(getInitialTashjeerLines(ayahId, surahId));
      setIsHydrated(true);
    } finally {
      setIsLoading(false);
    }
  }, [ayahId, storageKey, surahId]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(lines));
  }, [isHydrated, lines, storageKey]);

  const addLine = useCallback((type: LineType, qiraahId: number) => {
    const lineOrder = lines.filter((line) => line.type === type).length;
    const newLine: TashjeerLine = {
      id: Date.now(),
      ayahId,
      type,
      color: type === 'FARSH' ? getQiraahColor(qiraahId) : getLineColor(type),
      strokeWidth: 2,
      dashStyle: type === 'USUL' ? '8,4' : 'none',
      yPosition: calculateYPosition(type, lineOrder),
      isActive: true,
      nodes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setLines((prev) => [...prev, newLine]);
    return newLine;
  }, [ayahId, lines]);

  const updateLine = useCallback((updatedLine: TashjeerLine) => {
    setLines((prev) =>
      prev.map((line) =>
        line.id === updatedLine.id
          ? { ...updatedLine, updatedAt: new Date() }
          : line
      )
    );
  }, []);

  const deleteLine = useCallback((lineId: EntityId) => {
    setLines((prev) => prev.filter((line) => line.id !== lineId));
  }, []);

  const addNode = useCallback((
    lineId: EntityId,
    wordId: number,
    position: NodePosition,
    point: { x: number; y: number },
    qiraahId = 1
  ) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        if (line.nodes.some((node) => node.wordId === wordId && node.qiraahId === qiraahId)) {
          return line;
        }

        const newNode: TashjeerNode = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          tashjeerLineId: lineId,
          wordId,
          qiraahId,
          position,
          x: point.x,
          y: point.y,
        };

        return {
          ...line,
          nodes: [...line.nodes, newNode].sort((a, b) => b.x - a.x),
          updatedAt: new Date(),
        };
      })
    );
  }, []);

  const removeNode = useCallback((lineId: EntityId, nodeId: EntityId) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          nodes: line.nodes.filter((node) => node.id !== nodeId),
          updatedAt: new Date(),
        };
      })
    );
  }, []);

  const clearLines = useCallback(() => {
    setLines([]);
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    lines,
    addLine,
    updateLine,
    deleteLine,
    addNode,
    removeNode,
    clearLines,
    isLoading,
    error,
  };
}

function calculateYPosition(type: LineType, order: number): number {
  if (type === 'USUL') return 58 + order * 26;
  if (type === 'MADUD') return 118 + order * 34;
  return 170 + order * 40;
}

function deserializeLines(serialized: string): TashjeerLine[] {
  const parsed = JSON.parse(serialized) as Array<Omit<TashjeerLine, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  }>;

  return parsed.map((line) => ({
    ...line,
    createdAt: new Date(line.createdAt),
    updatedAt: new Date(line.updatedAt),
  }));
}

function getInitialTashjeerLines(ayahId: number, surahId: number): TashjeerLine[] {
  if (surahId !== 1 || ayahId !== 1) return [];

  return [
    {
      id: 1,
      ayahId: 1,
      type: 'USUL',
      color: getLineColor('USUL'),
      strokeWidth: 2,
      dashStyle: '8,4',
      yPosition: 58,
      isActive: true,
      createdBy: 1,
      nodes: [
        { id: 1, tashjeerLineId: 1, wordId: 1, qiraahId: 9, position: 'TOP', x: 700, y: 58 },
        { id: 2, tashjeerLineId: 1, wordId: 2, qiraahId: 9, position: 'TOP', x: 610, y: 58 },
        { id: 3, tashjeerLineId: 1, wordId: 3, qiraahId: 9, position: 'TOP', x: 500, y: 58 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      ayahId: 1,
      type: 'FARSH',
      color: getQiraahColor(1),
      strokeWidth: 2,
      dashStyle: 'none',
      yPosition: 170,
      isActive: true,
      createdBy: 1,
      nodes: [
        { id: 4, tashjeerLineId: 2, wordId: 1, qiraahId: 1, position: 'BOTTOM', x: 700, y: 170 },
        { id: 5, tashjeerLineId: 2, wordId: 4, qiraahId: 1, position: 'BOTTOM', x: 365, y: 170 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

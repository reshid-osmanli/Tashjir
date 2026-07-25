// خطاف تخطيط المصحف - Mushaf Layout Hook
// مشروع التشجير - نظام القراءات العشر

'use client';

import { useState, useEffect, useMemo } from 'react';
import { calculateWordPositions, LAYOUT_CONSTANTS } from '@/lib/tashjeer/position-engine';
import { LayoutContext, WordPosition } from '@/types';
import { getLocalAyahWords, LocalAyahWord } from '@/data/quran';

interface UseMushafLayoutResult {
  words: LocalAyahWord[];
  positions: Map<number, WordPosition>;
  layoutContext: LayoutContext;
  isLoading: boolean;
  error: Error | null;
}

/**
 * خطاف لحساب تخطيط المصحف
 */
export function useMushafLayout(ayahId: number, surahId = 1): UseMushafLayoutResult {
  const [words, setWords] = useState<LocalAyahWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // سياق التخطيط
  const layoutContext: LayoutContext = useMemo(() => ({
    currentX: LAYOUT_CONSTANTS.PAGE_WIDTH - LAYOUT_CONSTANTS.MARGIN_RIGHT,
    currentY: LAYOUT_CONSTANTS.MARGIN_TOP,
    fontSize: LAYOUT_CONSTANTS.FONT_SIZE,
    wordSpacing: LAYOUT_CONSTANTS.WORD_SPACING,
    lineHeight: LAYOUT_CONSTANTS.LINE_HEIGHT,
    pageWidth: LAYOUT_CONSTANTS.PAGE_WIDTH,
    pageHeight: LAYOUT_CONSTANTS.PAGE_HEIGHT,
    MARGIN_TOP: LAYOUT_CONSTANTS.MARGIN_TOP,
    MARGIN_BOTTOM: LAYOUT_CONSTANTS.MARGIN_BOTTOM,
    MARGIN_RIGHT: LAYOUT_CONSTANTS.MARGIN_RIGHT,
    MARGIN_LEFT: LAYOUT_CONSTANTS.MARGIN_LEFT,
    FONT_SIZE: LAYOUT_CONSTANTS.FONT_SIZE,
    WORD_SPACING: LAYOUT_CONSTANTS.WORD_SPACING,
    LINE_HEIGHT: LAYOUT_CONSTANTS.LINE_HEIGHT,
  }), []);

  // حساب المواقع
  const positions = useMemo(() => {
    if (words.length === 0) return new Map<number, WordPosition>();
    return calculateWordPositions(words, layoutContext);
  }, [words, layoutContext]);

  // جلب بيانات الآية
  useEffect(() => {
    const fetchAyahWords = async () => {
      try {
        setIsLoading(true);
        setError(null);

        setWords(getLocalAyahWords(ayahId, surahId));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('حدث خطأ في جلب البيانات'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAyahWords();
  }, [ayahId, surahId]);

  return {
    words,
    positions,
    layoutContext,
    isLoading,
    error,
  };
}

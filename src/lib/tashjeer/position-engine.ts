// محرك المواقع - Position Engine
// مشروع التشجير - نظام القراءات العشر

import { WordPosition, LayoutContext, LineType, NodePosition } from '@/types';
import { calculateWordWidth, calculateWordHeight } from '../quran-logic/harakat';
import { getQiraatByTayyibahOrder } from '@/data/qiraat-data/qiraat';

// ==================== ثوابت التخطيط ====================

export const LAYOUT_CONSTANTS = {
  PAGE_WIDTH: 794,           // عرض الصفحة (A4)
  PAGE_HEIGHT: 1123,         // ارتفاع الصفحة (A4)
  MARGIN_TOP: 50,
  MARGIN_BOTTOM: 50,
  MARGIN_RIGHT: 50,
  MARGIN_LEFT: 50,
  FONT_SIZE: 24,             // حجم الخط الأساسي
  WORD_SPACING: 8,           // المسافة بين الكلمات
  LINE_HEIGHT: 60,           // ارتفاع السطر
  TASHJEER_LINE_HEIGHT: 30,  // ارتفاع خط التشجير
  TASHJEER_LINE_GAP: 15,     // المسافة بين خطوط التشجير
  USUL_AREA_HEIGHT: 60,      // ارتفاع منطقة الأصول
  FARSH_AREA_TOP: 100,       // بداية منطقة الفرش
  MADUD_AREA_HEIGHT: 40,     // ارتفاع منطقة المدود
};

// ==================== حساب مواقع الكلمات ====================

/**
 * حساب مواقع الكلمات في الآية
 */
export function calculateWordPositions(
  words: Array<{ id: number; text: string; position: number }>,
  context: LayoutContext
): Map<number, WordPosition> {
  const positions = new Map<number, WordPosition>();
  const marginRight = context.MARGIN_RIGHT ?? LAYOUT_CONSTANTS.MARGIN_RIGHT;
  const marginLeft = context.MARGIN_LEFT ?? LAYOUT_CONSTANTS.MARGIN_LEFT;
  const marginTop = context.MARGIN_TOP ?? LAYOUT_CONSTANTS.MARGIN_TOP;
  const fontSize = context.FONT_SIZE ?? context.fontSize;
  const wordSpacing = context.WORD_SPACING ?? context.wordSpacing;
  const lineHeight = context.LINE_HEIGHT ?? context.lineHeight;
  let currentX = context.pageWidth - marginRight;
  let currentY = marginTop;

  for (const word of words) {
    const width = calculateWordWidth(word.text, fontSize);
    const height = calculateWordHeight(word.text, fontSize);

    // التحقق من الحاجة لسطر جديد
    if (currentX - width < marginLeft) {
      currentX = context.pageWidth - marginRight;
      currentY += lineHeight;
    }

    const wordPosition: WordPosition = {
      wordId: word.id,
      x: currentX - width,
      y: currentY,
      width,
      height,
      centerX: currentX - width / 2,
      centerY: currentY + height / 2,
      baselineY: currentY + height * 0.8,
    };

    positions.set(word.id, wordPosition);
    currentX -= width + wordSpacing;
  }

  return positions;
}

/**
 * حساب موقع كلمة واحدة
 */
export function calculateSingleWordPosition(
  word: { id: number; text: string },
  context: LayoutContext,
  previousWord?: WordPosition
): WordPosition {
  const marginRight = context.MARGIN_RIGHT ?? LAYOUT_CONSTANTS.MARGIN_RIGHT;
  const marginLeft = context.MARGIN_LEFT ?? LAYOUT_CONSTANTS.MARGIN_LEFT;
  const marginTop = context.MARGIN_TOP ?? LAYOUT_CONSTANTS.MARGIN_TOP;
  const fontSize = context.FONT_SIZE ?? context.fontSize;
  const wordSpacing = context.WORD_SPACING ?? context.wordSpacing;
  const lineHeight = context.LINE_HEIGHT ?? context.lineHeight;
  const width = calculateWordWidth(word.text, fontSize);
  const height = calculateWordHeight(word.text, fontSize);

  let x: number;
  let y: number;

  if (previousWord) {
    x = previousWord.x - width - wordSpacing;
    y = previousWord.y;

    // التحقق من الحاجة لسطر جديد
    if (x < marginLeft) {
      x = context.pageWidth - marginRight - width;
      y = previousWord.y + lineHeight;
    }
  } else {
    x = context.pageWidth - marginRight - width;
    y = marginTop;
  }

  return {
    wordId: word.id,
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    baselineY: y + height * 0.8,
  };
}

// ==================== حساب مواقع خطوط التشجير ====================

/**
 * حساب موقع خط التشجير
 */
export function calculateTashjeerLinePosition(
  type: LineType,
  order: number,
  words: WordPosition[],
  context: LayoutContext
): { y: number; startX: number; endX: number } {
  const y = calculateTashjeerYAxis(type, order, context);
  const startX = Math.min(...words.map(w => w.centerX));
  const endX = Math.max(...words.map(w => w.centerX));

  return { y, startX, endX };
}

/**
 * حساب محور Y لخط التشجير
 */
export function calculateTashjeerYAxis(
  type: LineType,
  order: number,
  context: LayoutContext
): number {
  const usulAreaHeight = context.USUL_AREA_HEIGHT ?? LAYOUT_CONSTANTS.USUL_AREA_HEIGHT;
  const farshAreaTop = context.FARSH_AREA_TOP ?? LAYOUT_CONSTANTS.FARSH_AREA_TOP;
  const tashjeerLineHeight = context.TASHJEER_LINE_HEIGHT ?? LAYOUT_CONSTANTS.TASHJEER_LINE_HEIGHT;
  const tashjeerLineGap = context.TASHJEER_LINE_GAP ?? LAYOUT_CONSTANTS.TASHJEER_LINE_GAP;

  switch (type) {
    case 'USUL':
      // الأصول في الأعلى
      return usulAreaHeight;

    case 'FARSH':
      // الفرش تحت الأصول
      return farshAreaTop + (order * (tashjeerLineHeight + tashjeerLineGap));

    case 'MADUD':
      // المدود بين الأصول والفرش
      return usulAreaHeight + tashjeerLineHeight + tashjeerLineGap;

    default:
      return farshAreaTop;
  }
}

/**
 * حساب موقع عقدة التشجير
 */
export function calculateNodePosition(
  word: WordPosition,
  lineY: number,
  position: NodePosition
): { x: number; y: number } {
  const x = word.centerX;

  let y: number;
  switch (position) {
    case 'TOP':
      y = lineY - 10;
      break;
    case 'BOTTOM':
      y = lineY + 10;
      break;
    case 'MIDDLE':
    default:
      y = lineY;
      break;
  }

  return { x, y };
}

// ==================== حساب نقاط التحكم للمنحنيات ====================

/**
 * حساب نقاط التحكم لمنحنى بيزيه
 */
export function calculateBezierControlPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  curve: number = 0.3
): Array<{ x: number; y: number }> {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  return [
    {
      x: start.x + dx * curve,
      y: start.y + dy * curve,
    },
    {
      x: end.x - dx * curve,
      y: end.y - dy * curve,
    },
  ];
}

/**
 * إنشاء مسار SVG لمنحنى بيزيه
 */
export function createBezierPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  controlPoints: Array<{ x: number; y: number }>
): string {
  if (controlPoints.length === 2) {
    return `M ${start.x} ${start.y} C ${controlPoints[0].x} ${controlPoints[0].y}, ${controlPoints[1].x} ${controlPoints[1].y}, ${end.x} ${end.y}`;
  } else if (controlPoints.length === 1) {
    return `M ${start.x} ${start.y} Q ${controlPoints[0].x} ${controlPoints[0].y}, ${end.x} ${end.y}`;
  } else {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
}

// ==================== حساب ترتيب القراء ====================

/**
 * حساب ترتيب القراء في التشجير
 */
export function calculateQiraahOrderInTashjeer(
  qiraahIds: number[]
): number[] {
  const qiraat = getQiraatByTayyibahOrder();
  const orderMap = new Map<number, number>();

  qiraat.forEach((q, index) => {
    orderMap.set(q.id, index);
  });

  return qiraahIds
    .map(id => ({ id, order: orderMap.get(id) ?? 999 }))
    .sort((a, b) => a.order - b.order)
    .map(item => item.id);
}

/**
 * حساب المسافة بين خطين من التشجير
 */
export function calculateLineSpacing(
  lineType: LineType,
  readerOrder: number
): number {
  const baseSpacing = LAYOUT_CONSTANTS.TASHJEER_LINE_HEIGHT + LAYOUT_CONSTANTS.TASHJEER_LINE_GAP;

  if (lineType === 'USUL') {
    return baseSpacing * 0.5;
  }

  return baseSpacing;
}

// ==================== دوال التحويل ====================

/**
 * تحويل الإحداثيات من نظام المصحف إلى نظام SVG
 */
export function mushafToSVGCoordinates(
  x: number,
  y: number,
  mushafWidth: number,
  mushafHeight: number,
  svgWidth: number,
  svgHeight: number
): { x: number; y: number } {
  return {
    x: (x / mushafWidth) * svgWidth,
    y: (y / mushafHeight) * svgHeight,
  };
}

/**
 * تحويل الإحداثيات من نظام SVG إلى نظام المصحف
 */
export function svgToMushafCoordinates(
  x: number,
  y: number,
  svgWidth: number,
  svgHeight: number,
  mushafWidth: number,
  mushafHeight: number
): { x: number; y: number } {
  return {
    x: (x / svgWidth) * mushafWidth,
    y: (y / svgHeight) * mushafHeight,
  };
}

// ==================== دوال التكبير والتحريك ====================

/**
 * حساب الإحداثيات بعد التكبير
 */
export function applyZoom(
  x: number,
  y: number,
  zoom: number,
  centerX: number,
  centerY: number
): { x: number; y: number } {
  return {
    x: (x - centerX) * zoom + centerX,
    y: (y - centerY) * zoom + centerY,
  };
}

/**
 * حساب الإحداثيات بعد التحريك
 */
export function applyPan(
  x: number,
  y: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  return {
    x: x + panX,
    y: y + panY,
  };
}

/**
 * حساب الإحداثيات بعد التكبير والتحريك
 */
export function applyTransform(
  x: number,
  y: number,
  zoom: number,
  panX: number,
  panY: number,
  centerX: number,
  centerY: number
): { x: number; y: number } {
  const zoomed = applyZoom(x, y, zoom, centerX, centerY);
  return applyPan(zoomed.x, zoomed.y, panX, panY);
}

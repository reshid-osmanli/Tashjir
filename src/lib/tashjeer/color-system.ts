// نظام الألوان - Color System
// مشروع التشجير - نظام القراءات العشر

import { LineType, ReviewStatus, NodePosition } from '@/types';

// ==================== ألوان خطوط التشجير ====================

export const LINE_COLORS: Record<LineType, string> = {
  USUL: '#22c55e',   // أخضر - الأصول
  FARSH: '#3b82f6',  // أزرق - الفرش
  MADUD: '#f97316',  // برتقالي - المدود
  HAMZ: '#dc2626',   // أحمر - الهمز
  WAQF: '#7c3aed',   // بنفسجي - الوقف
  TAJWEED: '#0891b2', // سماوي داكن - التجويد
};

export const LINE_COLORS_HEX: Record<LineType, string> = {
  USUL: '#22c55e',
  FARSH: '#3b82f6',
  MADUD: '#f97316',
  HAMZ: '#dc2626',
  WAQF: '#7c3aed',
  TAJWEED: '#0891b2',
};

export const LINE_COLORS_RGB: Record<LineType, { r: number; g: number; b: number }> = {
  USUL: { r: 34, g: 197, b: 94 },
  FARSH: { r: 59, g: 130, b: 246 },
  MADUD: { r: 249, g: 115, b: 22 },
  HAMZ: { r: 220, g: 38, b: 38 },
  WAQF: { r: 124, g: 58, b: 237 },
  TAJWEED: { r: 8, g: 145, b: 178 },
};

// ==================== ألوان التمييز ====================

export const HIGHLIGHT_COLORS = {
  SELECTED: '#3b82f6',   // أزرق - محدد
  DIFFERENT: '#fbbf24',  // أصفر - مختلف
  AGREED: '#22c55e',     // أخضر - متفق
  REVIEWED: '#10b981',   // زمردي - مراجع
  PENDING: '#f59e0b',    // برتقالي - معلق
  REJECTED: '#ef4444',   // أحمر - مرفوض
};

// ==================== ألوان القراء ====================

export const QIRAAT_COLORS: Record<number, string> = {
  1: '#3b82f6',   // قالون - أزرق
  2: '#8b5cf6',   // ورش - بنفسجي
  3: '#22c55e',   // البزي - أخضر
  4: '#f97316',   // قنبل - برتقالي
  5: '#ec4899',   // الدوري - وردي
  6: '#06b6d4',   // السوسي - سماوي
  7: '#84cc16',   // هشام - ليموني
  8: '#f43f5e',   // ابن ذكوان - قرمزي
  9: '#6366f1',   // حفص - نيلي
  10: '#14b8a6',  // شعبة - تيل
  11: '#a855f7',  // خلف - فوشيا
  12: '#eab308',  // خلاد - ذهبي
  13: '#10b981',  // الليث - زمردي
  14: '#64748b',  // الدوري (كسائي) - رمادي
  15: '#dc2626',  // ابن وردان - أحمر
  16: '#0891b2',  // ابن جماز - أزرق غامق
  17: '#9333ea',  // رويس - بنفسجي غامق
  18: '#059669',  // روح - أخضر غامق
  19: '#b45309',  // إدريس - بني
  20: '#1d4ed8',  // إسحاق - أزرق داكن
};

// ==================== ألوان الخلفية ====================

export const BACKGROUND_COLORS = {
  PAGE: '#fefce8',        // أصفر فاتح (لون المصحف)
  USUL_AREA: '#f0fdf4',   // أخضر فاتح
  FARSH_AREA: '#eff6ff',  // أزرق فاتح
  MADUD_AREA: '#fff7ed',  // برتقالي فاتح
  LINE_EVEN: '#f8fafc',   // زوجي
  LINE_ODD: '#ffffff',    // فردي
};

// ==================== ألوان النص ====================

export const TEXT_COLORS = {
  PRIMARY: '#1e293b',     // النص الأساسي
  SECONDARY: '#64748b',   // النص الثانوي
  MUTED: '#94a3b8',       // النص الخفيف
  LINK: '#3b82f6',        // الروابط
  SUCCESS: '#22c55e',     // النجاح
  WARNING: '#f59e0b',     // التحذير
  ERROR: '#ef4444',       // الخطأ
};

// ==================== ألوان حالات المراجعة ====================

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'معلق',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

// ==================== دوال مساعدة ====================

/**
 * الحصول على لون خط التشجير
 */
export function getLineColor(type: LineType): string {
  return LINE_COLORS[type] || LINE_COLORS.FARSH;
}

/**
 * الحصول على لون القارئ
 */
export function getQiraahColor(qiraahId: number): string {
  return QIRAAT_COLORS[qiraahId] || '#64748b';
}

/**
 * الحصول على لون حالة المراجعة
 */
export function getReviewStatusColor(status: ReviewStatus): string {
  return REVIEW_STATUS_COLORS[status] || '#94a3b8';
}

/**
 * الحصول على اسم حالة المراجعة
 */
export function getReviewStatusLabel(status: ReviewStatus): string {
  return REVIEW_STATUS_LABELS[status] || 'غير محدد';
}

/**
 * إنشاء لون شفاف
 */
export function createTransparentColor(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/**
 * تحويل HEX إلى RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * تحويل RGB إلى HEX
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * تفتيح اللون
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.min(255, rgb.r + (255 - rgb.r) * percent);
  const g = Math.min(255, rgb.g + (255 - rgb.g) * percent);
  const b = Math.min(255, rgb.b + (255 - rgb.b) * percent);

  return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
}

/**
 * تظليل اللون
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.max(0, rgb.r * (1 - percent));
  const g = Math.max(0, rgb.g * (1 - percent));
  const b = Math.max(0, rgb.b * (1 - percent));

  return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
}

/**
 * الحصول على لون متناسق مع الخلفية
 */
export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * الحصول على لون العقدة
 */
export function getNodeColor(position: NodePosition, lineType: LineType): string {
  const baseColor = getLineColor(lineType);

  switch (position) {
    case 'TOP':
      return lightenColor(baseColor, 0.2);
    case 'BOTTOM':
      return darkenColor(baseColor, 0.2);
    case 'MIDDLE':
    default:
      return baseColor;
  }
}

// ==================== ثوابت التنسيق ====================

export const STROKE_WIDTHS = {
  THIN: 1,
  NORMAL: 2,
  THICK: 3,
  EXTRA_THICK: 4,
};

export const DASH_STYLES = {
  SOLID: 'none',
  DASHED: '8,4',
  DOTTED: '2,4',
  DASH_DOT: '8,4,2,4',
};

export const OPACITIES = {
  TRANSPARENT: 0,
  LIGHT: 0.25,
  MEDIUM: 0.5,
  HEAVY: 0.75,
  OPAQUE: 1,
};

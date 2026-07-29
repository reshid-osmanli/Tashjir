// محرك التشجير الكلاسيكي - Classic Tashjeer Engine
// مشروع التشجير - نظام القراءات العشر
//
// هذا المحرك يحوّل اختلافات الآية إلى "التشجير الكلاسيكي" المعهود في المصاحف
// المشجّرة: خط أفقي تحت الآية لكل وجه مختلف، يبدأ بالترتيب (قالون أولاً)،
// ويُكتب تحت كل كلمة مختلفة رمز القارئ والقرّاء الذين اتفقوا معه، ثم يُبيَّن
// نوع الاختلاف (فرش/همز/وقف...). والخط الأول تحت الآية هو "الجمهور" (الأصل).
//
// القواعد المنهجية المطبّقة:
//   1. النص المطبوع (حفص) هو الأساس = "الجمهور"، فلا يُرسم له خط وجه.
//   2. كل وجه غير أساسي يأخذ خطا واحدا يمتد على كلمات الاختلاف.
//   3. يُرتّب الخطوط "من آخر الآية إلى أولها": الخط الذي تكون عقدته
//      المتأخرة أقرب لنهاية الآية يُرسم أقرب إلى النص (مسار أدنى رقما).
//   4. داخل نفس الموضع، يُقدَّم الخط الذي يرأسه القارئ الأعلى ترتيبا
//      في طيبة النشر (قالون قبل ورش قبل البزي...).
//   5. رمز كل راوٍ يُكتب تحت الكلمة، ومعه رموز القرّاء الذين اتفقوا معه،
//      ويُبيَّن نوع الاختلاف بلون وبطاقة.

import type { VariantCategory } from '@/types';
import type {
  AyahLayout,
  LayoutOptions,
  Variant,
  VariantAlternative,
  ViewFilter,
} from '@/types/tashjeer';
import { NARRATORS } from '@/data/qiraat-data/qiraat';
import { resolveScope } from './scope';
import { CATEGORY_LABELS } from './branch-engine';
import { getNarratorSymbol, narratorTayyibahOrder } from './symbols';

// ==================== الإعدادات ====================

const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  canvasWidth: 1000,
  paddingRight: 56,
  paddingLeft: 56,
  textTop: 300,
  fontSize: 34,
  wordGap: 14,
  lineHeight: 96,
  laneHeight: 34,
  laneGap: 28,
};

// ==================== النواتج ====================

/** عقدة ربط الخط بكلمة مختلفة. */
export interface ClassicMark {
  wordId: number;
  position: number;
  /** مركز الكلمة أفقيا (نقطة الارتباط). */
  x: number;
  topY: number;
  bottomY: number;
  baselineY: number;
}

/** خط تشجير كلاسيكي واحد = وجه قرائي واحد غير أساسي. */
export interface ClassicLine {
  id: string;
  variantId: string;
  alternativeId: string;
  category: VariantCategory;
  categoryLabel: string;
  /** معرّفات كل القرّاء الذين يقرأون بهذا الوجه. */
  narratorIds: string[];
  /** رموزهم مرتّبة حسب طيبة النشر (ب ج د...). */
  symbols: string[];
  /** رمز الرئيس (الأعلى ترتيبا). */
  primarySymbol: string;
  primaryNarratorName: string;
  /** أسماء القرّاء الذين اتفقوا معه، للتلميح. */
  readerNames: string[];
  /** الرموز مضمومة بفراغ، للعرض على رأس الخط. */
  label: string;
  /** النص المقروء بهذا الوجه (بالتشكيل). */
  readingText: string;
  /** وصف الوجه إن وُجد. */
  readingLabel: string;
  startPosition: number;
  endPosition: number;
  /** رقم المسار (0 = الأقرب للنص). */
  lane: number;
  /** الإحداثي الرأسي للخط بعد الحساب. */
  rowY: number;
  marks: ClassicMark[];
}

/** ناتج التشجير الكلاسيكي الكامل لآية. */
export interface ClassicTashjeer {
  lines: ClassicLine[];
  /** أدنى نقطة لأسفل النص. */
  textBottom: number;
  /** إحداثي أول خط اختلاف. */
  firstRowY: number;
  /** ارتفاع كل مسار. */
  rowHeight: number;
  /** الارتفاع الكلي المطلوب للوحة. */
  totalHeight: number;
  /** هل في الآية اختلافات أصلا؟ */
  hasDifferences: boolean;
}

// ==================== التوليد ====================

interface RawAlternative {
  variant: Variant;
  alt: VariantAlternative;
}

/**
 * يولّد التشجير الكلاسيكي لآية من اختلافاتها.
 *
 * الخطوات:
 *   1. جمع كل الأوجه غير الأساسية ذات النطاق غير الفارغ.
 *   2. تصفية حسب الفئة والراوي المطلوبَين في العرض.
 *   3. تحويل كل وجه إلى خط مع عقده (الكلمات المشمولة).
 *   4. ترتيب الخطوط (من آخر الآية إلى أولها، ثم حسب ترتيب القارئ).
 *   5. حساب الإحداثيات الرأسية للمسارات.
 */
export function generateClassicTashjeer(
  variants: Variant[],
  layout: AyahLayout,
  filter: ViewFilter,
  options: Partial<LayoutOptions> = {}
): ClassicTashjeer {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };

  const textBottom = layout.boxes.length
    ? Math.max(...layout.boxes.map((box) => box.bottomY))
    : opts.textTop;

  // 1+2. جمع وتصفية الأوجه.
  const raw: RawAlternative[] = [];
  for (const variant of variants) {
    for (const alt of variant.alternatives) {
      if (alt.isBase) continue;
      if (resolveScope(alt.scope).length === 0) continue;
      raw.push({ variant, alt });
    }
  }

  const categoryFiltered = raw.filter((item) =>
    filter.categories.includes(item.variant.category)
  );

  const shown =
    filter.narratorIds.length === 0
      ? categoryFiltered
      : categoryFiltered.filter((item) => {
          const ids = new Set(resolveScope(item.alt.scope));
          return filter.narratorIds.some((id) => ids.has(id));
        });

  // 3. بناء الخطوط.
  const lines: ClassicLine[] = shown.map(({ variant, alt }) => {
    const ids = resolveScope(alt.scope).sort(
      (a, b) => narratorTayyibahOrder(a) - narratorTayyibahOrder(b)
    );
    const symbols = ids.map(getNarratorSymbol).filter(Boolean);

    const marks: ClassicMark[] = [];
    for (let position = variant.startPosition; position <= variant.endPosition; position++) {
      const box = layout.boxByPosition.get(position);
      if (!box) continue;
      marks.push({
        wordId: box.wordId,
        position,
        x: box.centerX,
        topY: box.topY,
        bottomY: box.bottomY,
        baselineY: box.baselineY,
      });
    }

    const primaryId = ids[0];
    return {
      id: `${variant.id}::${alt.id}`,
      variantId: variant.id,
      alternativeId: alt.id,
      category: variant.category,
      categoryLabel: CATEGORY_LABELS[variant.category],
      narratorIds: ids,
      symbols,
      primarySymbol: symbols[0] ?? '',
      primaryNarratorName: narratorName(primaryId),
      readerNames: ids.map(narratorName),
      label: symbols.join(' '),
      readingText: alt.text,
      readingLabel: alt.label,
      startPosition: variant.startPosition,
      endPosition: variant.endPosition,
      lane: 0,
      rowY: 0,
      marks,
    };
  });

  // 4. الترتيب: من آخر الآية إلى أولها، ثم حسب ترتيب القارئ الرئيس.
  lines.sort(compareLines);
  lines.forEach((line, index) => {
    line.lane = index;
  });

  // 5. الحساب الهندسي.
  const rowGap = Math.max(opts.fontSize * 1.3, 30);
  const rowHeight = Math.max(opts.fontSize * 1.85, 44);
  const firstRowY = textBottom + rowGap;

  for (const line of lines) {
    line.rowY = firstRowY + line.lane * rowHeight;
  }

  const totalHeight = lines.length
    ? firstRowY + lines.length * rowHeight + rowGap
    : textBottom + rowGap + 60;

  return {
    lines,
    textBottom,
    firstRowY,
    rowHeight,
    totalHeight,
    hasDifferences: lines.length > 0,
  };
}

/** ترتيب الخطوط: الآية من آخرها إلى أولها، ثم القارئ الأعلى ترتيبا. */
function compareLines(a: ClassicLine, b: ClassicLine): number {
  if (a.endPosition !== b.endPosition) return b.endPosition - a.endPosition;

  const primaryA = a.narratorIds[0];
  const primaryB = b.narratorIds[0];
  const orderDiff = narratorTayyibahOrder(primaryA) - narratorTayyibahOrder(primaryB);
  if (orderDiff !== 0) return orderDiff;

  if (a.startPosition !== b.startPosition) return b.startPosition - a.startPosition;
  return a.variantId.localeCompare(b.variantId, 'ar');
}

// ==================== مساعدات ====================

const narratorNameById = new Map(NARRATORS.map((narrator) => [narrator.id, narrator.name]));

function narratorName(narratorId: string): string {
  return narratorNameById.get(narratorId) ?? narratorId;
}

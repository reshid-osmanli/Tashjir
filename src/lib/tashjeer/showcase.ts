// نموذج العرض الحقيقي — Live Showcase Model
//
// مشروع التشجير - نظام القراءات العشر
//
// الغرض: تشغيل خط أنابيب التشجير **الحقيقي** (نفس التخطيط، ونفس المحرك، ونفس
// بيانات البذور) وإنتاج نموذج قابل للتسلسل تعرضه صفحات الواجهة (الرئيسية،
// بطاقات الشرح، معاينة المحرر) بلا حاجة إلى مخزن المحرر ولا إلى المتصفح.
//
// لماذا هذا الملف ضروري:
//   §128 في المواصفة يمنع عرض مخطط "شبيه" وتسميته حقيقيا. لذلك لا يُكتب هنا
//   أي إحداثي يدويا: الكلمات من mushaf.json، والصناديق من layout-engine،
//   والأسطر والروابط والرموز من classic-tashjeer. النموذج نقل فقط.
//
// الدالة نقية (pure) وتعمل على الخادم وفي الاختبارات.

import { getAyahByKey, getAyahWordsByKey, getSurah, type MushafAyah } from '@/data/quran';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor } from '@/lib/tashjeer/color-system';
import { createDefaultTransmissionCatalog } from '@/lib/transmissions/catalog';
import { getSeedVariants, SEED_VARIANTS } from '@/data/variants/seed-variants';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { Variant, ViewFilter } from '@/types/tashjeer';
import type { LayoutOptions } from '@/types/tashjeer';
import type { VariantCategory } from '@/types';

/** نمط عرض اللوح: ثابت، أو مُترسَّم عند أول ظهور (SPEC §17-19). */
export type DisplayMode = 'static' | 'draw';

/** كل الفئات ظاهرة: العرض الحقيقي لا يُخفي فئة. */
export const SHOWCASE_FILTER: ViewFilter = {
  categories: ['TAHQIQ', 'USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

export interface ShowcaseBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShowcaseWord {
  position: number;
  text: string;
  /** صندوق الكلمة بإحداثيات اللوحة نفسها التي يستعملها المحرر. */
  x: number;
  width: number;
  centerX: number;
  topY: number;
  bottomY: number;
  baselineY: number;
  lineIndex: number;
}

export interface ShowcaseReader {
  id: string;
  name: string;
  symbol: string;
  kind: 'IMAM' | 'NARRATOR' | 'PATH';
  narratorIds: string[];
}

export interface ShowcaseMark {
  position: number;
  x: number;
  topY: number;
  bottomY: number;
  baselineY: number;
}

export interface ShowcaseLine {
  id: string;
  source: string;
  variantId: string;
  alternativeId: string;
  category: VariantCategory;
  categoryLabel: string;
  color: string;
  rowY: number;
  spanStartX: number;
  spanEndX: number;
  label: string;
  symbolDisplay: string;
  symbols: string[];
  readingText: string;
  readingLabel: string;
  ruleLabel: string;
  isPreferred: boolean;
  readers: ShowcaseReader[];
  marks: ShowcaseMark[];
  emphasisStartX: number;
  emphasisEndX: number;
  labelX: number;
}

export interface ShowcaseEvidence {
  id: string;
  source: string;
  text: string;
  reference: string;
}

export interface ShowcaseVariant {
  id: string;
  title: string;
  description: string;
  category: VariantCategory;
  categoryLabel: string;
  color: string;
  status: string;
  sourceRef: string;
  /** حدود الموضع داخل الآية: [أول كلمة، آخر كلمة]. */
  startPosition: number;
  endPosition: number;
  alternatives: Array<{
    id: string;
    text: string;
    label: string;
    isBase: boolean;
    readerNames: string[];
    evidences: ShowcaseEvidence[];
  }>;
}

export interface ShowcaseAyah {
  ayahKey: number;
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  ayahRef: string;
  revelationType: 'MECCAN' | 'MEDINAN';
  text: string;
  plainText: string;
  fontSize: number;
  words: ShowcaseWord[];
  lines: ShowcaseLine[];
  /** حدود التركيبة المحسوبة فعلا من الإحداثيات، لا من مساحة التخمين. */
  viewBox: { x: number; y: number; width: number; height: number };
  textTop: number;
  textBottom: number;
  firstRowY: number;
  totalHeight: number;
  variant: ShowcaseVariant | null;
  /** هل المادة من البذور الأولية غير المعتمدة؟ يُقال ذلك في الواجهة صريحا. */
  fromSeedData: boolean;
}

const DEFAULT_SHOWCASE_LAYOUT: Partial<LayoutOptions> = {
  fontSize: 34,
  paddingLeft: 24,
  paddingRight: 24,
  singleLine: true,
};

/** حواف النموذج: أوسع نقطة في النص والأسطر والتسميات. */
function boundsOf(
  words: ShowcaseWord[],
  lines: ShowcaseLine[],
  textTop: number,
  textBottom: number
): { viewBox: ShowcaseAyah['viewBox'] } {
  const xs: number[] = [];
  for (const word of words) {
    xs.push(word.x, word.x + word.width);
  }
  let lowest = textBottom;
  for (const line of lines) {
    xs.push(line.spanStartX, line.spanEndX, line.emphasisStartX, line.emphasisEndX);
    for (const mark of line.marks) xs.push(mark.x);
    // التسمية مطبوعة فوق السطر ومتوسّطة على labelX؛ نقدّر امتدادها بنصف عرض تقريبي.
    xs.push(line.labelX - line.ruleLabel.length * 5, line.labelX + line.ruleLabel.length * 5);
    lowest = Math.max(lowest, line.rowY + 18);
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const padX = 14;
  const topY = Math.min(textTop, ...lines.map((line) => line.rowY - 22));
  const bottomY = Math.max(textBottom + 10, lowest + 6);

  return {
    viewBox: {
      x: minX - padX,
      y: topY - 12,
      width: maxX - minX + padX * 2,
      height: bottomY - (topY - 12),
    },
  };
}

/** أسماء قراء وجه واحد من نطاقه الحقيقي عبر الكتالوج. */
function readerNamesOf(scope: Variant['alternatives'][number]['scope'], catalog: ReturnType<typeof createDefaultTransmissionCatalog>) {
  const ids = new Set<string>();
  const kind = scope.kind;

  if (kind === 'ALL') {
    for (const narrator of catalog.narrators) ids.add(narrator.id);
    return catalog.narrators.map((narrator) => narrator.name);
  }

  const explicit = 'narratorIds' in scope ? scope.narratorIds ?? [] : [];
  for (const id of explicit) ids.add(id);
  if ('imamIds' in scope) {
    for (const imamId of scope.imamIds ?? []) {
      for (const narrator of catalog.narrators) {
        if (narrator.imamId === imamId) ids.add(narrator.id);
      }
    }
  }
  if ('pathIds' in scope) {
    for (const pathId of scope.pathIds ?? []) {
      const path = catalog.paths.find((item) => item.id === pathId);
      if (path) ids.add(path.narratorId);
    }
  }

  if (kind === 'ALL_EXCEPT') {
    for (const narrator of catalog.narrators) {
      if (!explicit.includes(narrator.id)) ids.add(narrator.id);
    }
  }

  return catalog.narrators.filter((narrator) => ids.has(narrator.id)).map((narrator) => narrator.name);
}

function variantToShowcase(variant: Variant, catalog: ReturnType<typeof createDefaultTransmissionCatalog>): ShowcaseVariant {
  return {
    id: variant.id,
    title: variant.title,
    description: variant.description ?? '',
    category: variant.category,
    categoryLabel: CATEGORY_LABELS[variant.category] ?? variant.category,
    color: getCategoryColor(variant.category),
    status: variant.status ?? 'DRAFT',
    sourceRef: variant.sourceRef ?? '',
    startPosition: variant.startPosition,
    endPosition: variant.endPosition,
    alternatives: variant.alternatives.map((alt) => ({
      id: alt.id,
      text: alt.text,
      label: alt.label,
      isBase: Boolean(alt.isBase),
      readerNames: readerNamesOf(alt.scope, catalog),
      evidences: (alt.evidences ?? []).map((evidence) => ({
        id: evidence.id,
        source: String(evidence.source),
        text: evidence.text,
        reference: evidence.reference ?? '',
      })),
    })),
  };
}

/**
 * يبني نموذج العرض لآية من بيانات المشروع الحقيقية.
 *
 * @param ayahKey معرّف الآية (surah * 1000 + ayah)
 * @param options تجاوزات التخطيط (حجم الخط، عرض اللوحة، السطر الواحد)
 * @returns النموذج، أو null إن كان المعرّف غير صالح
 */
export function buildShowcase(
  ayahKey: number,
  options: Partial<LayoutOptions> = {}
): ShowcaseAyah | null {
  const ayah: MushafAyah | undefined = getAyahByKey(ayahKey);
  if (!ayah) return null;
  const surah = getSurah(ayah.surahNumber);

  const words = getAyahWordsByKey(ayahKey);
  const layoutOptions: Partial<LayoutOptions> = { ...DEFAULT_SHOWCASE_LAYOUT, ...options };
  const layout = layoutAyah(ayahKey, words, layoutOptions);
  const catalog = createDefaultTransmissionCatalog();
  const classic = generateClassicTashjeer(
    getSeedVariants(ayahKey),
    layout,
    SHOWCASE_FILTER,
    layoutOptions,
    { catalog }
  );

  const showcaseWords: ShowcaseWord[] = layout.boxes.map((box) => ({
    position: box.position,
    text: box.text,
    x: box.x,
    width: box.width,
    centerX: box.centerX,
    topY: box.topY,
    bottomY: box.bottomY,
    baselineY: box.baselineY,
    lineIndex: box.lineIndex,
  }));

  const textTop = showcaseWords.length ? Math.min(...showcaseWords.map((word) => word.topY)) : 0;
  const textBottom = showcaseWords.length ? Math.max(...showcaseWords.map((word) => word.bottomY)) : 0;

  const lines: ShowcaseLine[] = classic.lines.map((line) => ({
    id: line.id,
    source: line.source,
    variantId: line.variantId,
    alternativeId: line.alternativeId,
    category: line.category,
    categoryLabel: CATEGORY_LABELS[line.category] ?? line.category,
    color: line.entries[0]?.color ?? getCategoryColor(line.category),
    rowY: line.rowY,
    spanStartX: line.spanStartX,
    spanEndX: line.spanEndX,
    label: line.label,
    symbolDisplay: String(line.symbolDisplay),
    symbols: line.symbols,
    readingText: line.readingText,
    readingLabel: line.readingLabel,
    ruleLabel: line.ruleLabel,
    isPreferred: Boolean(line.isPreferred),
    readers: line.readers.map((reader) => ({
      id: reader.id,
      name: reader.name,
      symbol: reader.symbol,
      kind: reader.kind,
      narratorIds: [...reader.narratorIds],
    })),
    marks: line.marks.map((mark) => ({
      position: mark.position,
      x: mark.x,
      topY: mark.topY,
      bottomY: mark.bottomY,
      baselineY: mark.baselineY,
    })),
    emphasisStartX: line.entries[0]?.emphasisStartX ?? Math.min(...line.marks.map((mark) => mark.x)),
    emphasisEndX: line.entries[0]?.emphasisEndX ?? Math.max(...line.marks.map((mark) => mark.x)),
    labelX: line.entries[0]?.labelX ?? line.marks[0]?.x ?? line.spanStartX,
  }));

  const firstVariant = SEED_VARIANTS.find((variant) => variant.ayahKey === ayahKey) ?? null;
  const { viewBox } = boundsOf(showcaseWords, lines, textTop, textBottom);

  return {
    ayahKey,
    surahNumber: ayah.surahNumber,
    ayahNumber: ayah.ayahNumber,
    surahName: surah?.name ?? '',
    ayahRef: `${toArabicDigits(ayah.surahNumber)}:${toArabicDigits(ayah.ayahNumber)}`,
    revelationType: surah?.revelationType ?? 'MECCAN',
    text: ayah.text,
    plainText: ayah.plainText,
    fontSize: layoutOptions.fontSize ?? 34,
    words: showcaseWords,
    lines,
    viewBox,
    textTop,
    textBottom,
    firstRowY: classic.firstRowY,
    totalHeight: classic.totalHeight,
    variant: firstVariant ? variantToShowcase(firstVariant, catalog) : null,
    fromSeedData: getSeedVariants(ayahKey).length > 0,
  };
}

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
import { selectElement } from '@/lib/editor/selection-store';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import {
  CATEGORY_LABELS,
} from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { TashjeerFigure } from './TashjeerFigure';
import { getNarratorsByTayyibah } from '@/lib/tashjeer/symbols';
import { getImamsWithSymbols } from '@/lib/tashjeer/reader-symbols';
import { getNarratorProfile } from '@/data/qiraat-data/narrator-profiles';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { lociOfVariant, positionsOfVariant } from '@/lib/tashjeer/loci';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useEngineConfig } from '@/hooks/useEngineConfig';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { parseAyahKey } from '@/data/quran';
import {
  computeFocusPan,
  isRectOutsideViewport,
  selectionTargetSelector,
  toMeasuredRect,
} from '@/lib/editor/selection-store';
import { SelectionContextMenu, type ContextMenuState } from './SelectionContextMenu';
import { SelectionFocusCard } from './SelectionFocusCard';
import type { ClassicLine, ClassicReaderChip } from '@/lib/tashjeer/classic-tashjeer';
import type { VariantCategory } from '@/types';
import type { EditorSelection, WordBox } from '@/types/tashjeer';
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
  // الراوي المفتوحة بطاقته بعد النقر على رمزه في طرف السطر.
  const [openReader, setOpenReader] = useState<ClassicReaderChip | null>(null);

  const {
    document,
    filter,
    zoom,
    pan,
    currentTool,
    markingMode,
    markedPositions,
    markedCharacters,
    selectedWordId,
    selectedVariantId,
    setZoom,
    setPan,
    selectWord,
    selectVariant,
    selectAlternative,
    selectLine,
    selectBranch,
    refreshDerivedBranches,
    toggleMarkedPosition,
    toggleMarkedCharacter,
  } = useEditorStore();

  const catalog = useTransmissionCatalog();
  const engine = useEngineSettings();
  const engineConfig = useEngineConfig();
  const strengthDegrees = useStrengthDegrees();
  const occurrences = useRuleOccurrences();

  // عند تعديل قارئ أو رمز أو طريق من لوحة التحكم، حدّث الخطوط المشتقة مع
  // إبقاء مواضع الأسطر اليدوية كما هي. لا يحتاج المحرر إلى إعادة فتح الآية.
  useEffect(() => {
    refreshDerivedBranches();
  }, [
    catalog.updatedAt,
    engine.rowSpacing,
    engine.textToTreeGap,
    engine.tieBreakOrder,
    engine.symbolDisplay,
    strengthDegrees.updatedAt,
    occurrences.key,
    refreshDerivedBranches,
  ]);

  const { ayah, layout, classic, viewBox, window: readingWindow } = useAyahTashjeer(
    document,
    filter,
    { fontSize, singleLine: engine.singleLineText },
    { catalog, engine, strengthDegrees, engineConfig, occurrencesKey: occurrences.key }
  );

  // نهاية الآية الأولى حين تُوصل بالتالية: يُطبع عندها رقم الآية.
  const ayahMarkers = useMemo(() => {
    if (!readingWindow.isLinked) return [];
    return [
      {
        position: readingWindow.firstAyahEndPosition,
        ayahNumber: parseAyahKey(readingWindow.ayahKeys[0]).ayahNumber,
      },
    ];
  }, [readingWindow]);

  const focusSegment = document?.readingWindow?.focusSegment ?? null;

  // يشمل هذا القائمة المحلية والقواعد العامة المشتقة؛ لذلك يتفاعل النقر
  // مع موضع القاعدة العامة كما يتفاعل مع الاختلاف الذي أضيف يدويا.
  const effectiveVariants = useMemo(
    () => (document ? getEffectiveVariants(document) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document, occurrences.key]
  );

  // ==================== التفاعل ====================

  /**
   * تحويل بكسلات الشاشة إلى وحدات اللوحة.
   *
   * ضروري لا تجميلي: في وضع السطر الواحد قد يبلغ عرض اللوحة عشرات آلاف
   * الوحدات في ألف بكسل، فلو حرّكنا اللوحة ببكسلات الفأرة مباشرة لتحرك
   * المشهد بجزء من عشرين مما حرّكه المستعمل، فيبدو السحب معطلا.
   */
  const unitsPerPixel = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    return viewBox.width / rect.width;
  }, [viewBox.width]);

  // ==================== بروتوكول التركيز الموحّد (FR-ED-02.3, AC-06) ====================
  //
  // كل كتابة تحديد (من أي لوحة: الاختلافات، العلاقات، الترتيب، التتبع،
  // أو اللوحة نفسها) ترفع طلب تركيز برقم متزايد في المخزن. هنا تُستهلك:
  // يُكشف عنصر اللوحة المقابل للتحديد (محدّد CSS من selection-store)، فإن
  // كان خارج الإطار حُرّكت اللوحة إليه بلا تغيير التكبير — أو وُضع في منتصف
  // الرؤية إن طُلب ذلك — ثم نُبض العنصر (السطر أو الأداة نفسها) ونعرض بطاقة
  // معلومات مصغرة. الزمن المستهدف ≤ 300ms (FOCUS_BUDGET_MS).
  const selection = useEditorStore((state) => state.selection);
  const selectionFocus = useEditorStore((state) => state.selectionFocus);
  const [pulseLineId, setPulseLineId] = useState<string | null>(null);
  const [pulseEntryKey, setPulseEntryKey] = useState<string | null>(null);
  const [focusCard, setFocusCard] = useState<EditorSelection | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const lastHandledToken = useRef(0);
  const pendingToken = useRef<number | null>(null);

  // الأداة النشطة في التحديد الموحّد: وجه بعينه، أو اختلاف كله بأوجهه على
  // كل أسطره — يُبرَز هو بالذات لا سطره كله (FR-ED-02.5).
  const activeEntry: { variantId: string; alternativeId?: string } | null =
    selection?.kind === 'FACE'
      ? { variantId: selection.differenceId ?? '', alternativeId: selection.faceId ?? selection.id }
      : selection?.kind === 'DIFFERENCE'
        ? { variantId: selection.differenceId ?? selection.id }
        : null;


  const applyFocus = useCallback(
    (center: boolean): boolean => {
      const svg = svgRef.current;
      if (!svg || !selection) return false;
      const selector = selectionTargetSelector(selection, document?.ayahKey);
      const target = selector ? svg.querySelector<SVGGElement>(selector) : null;
      if (!target) return false;

      const svgRect = svg.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const margin = 24;
      const outside = isRectOutsideViewport(toMeasuredRect(rect), toMeasuredRect(svgRect), margin);
      if (outside || center) {
        const scale = unitsPerPixel();
        const next = computeFocusPan(
          { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          { x: svgRect.left + svgRect.width / 2, y: svgRect.top + svgRect.height / 2 },
          scale,
          useEditorStore.getState().pan
        );
        setPan(next);
      }

      // النبضة على العنصر المحدد بالذات: أداة (اختلاف/وجه) تُنبض هي، وإلا
      // يُنبض سطرها أو الكلمة المقصودة.
      if (selection.kind === 'FACE' && selection.differenceId) {
        setPulseEntryKey(`${selection.differenceId}::${selection.faceId ?? selection.id}`);
      } else if (selection.kind === 'DIFFERENCE' || selection.kind === 'RULE') {
        const lineEl = svg.querySelector<SVGGElement>(`[data-line-id][data-variant-ids~="${CSS.escape(selection.differenceId ?? selection.id)}"]`);
        setPulseLineId(lineEl?.dataset.lineId ?? null);
      } else {
        const lineEl = target.closest<SVGGElement>('[data-line-id]');
        setPulseLineId(lineEl?.dataset.lineId ?? null);
      }
      setFocusCard(selection);
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
      pulseTimer.current = window.setTimeout(() => {
        setPulseLineId(null);
        setPulseEntryKey(null);
        setFocusCard(null);
        pulseTimer.current = null;
      }, 2200);
      return true;
    },
    [document?.ayahKey, selection, setPan, unitsPerPixel]
  );

  useEffect(() => {
    if (selectionFocus.token === lastHandledToken.current) return;
    lastHandledToken.current = selectionFocus.token;
    if (!selection) {
      setFocusCard(null);
      return;
    }
    const applied = applyFocus(selectionFocus.center);
    pendingToken.current = applied ? null : selectionFocus.token;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionFocus.token, selection]);

  // تأخر الرسم: إن لم يكن عنصر التحديد مرسومًا بعد (فتح آية جديدة من رابط
  // عميق) يُعاد المحاولة حين تجهز أسطر المحرك.
  useEffect(() => {
    if (pendingToken.current === null || pendingToken.current !== lastHandledToken.current) return;
    if (applyFocus(false)) pendingToken.current = null;
  }, [classic.lines.length, applyFocus]);

  /**
   * التكبير عند مؤشر الفأرة لا عند رأس اللوحة.
   *
   * التكبير من نقطة ثابتة يهرّب الموضع الذي ينظر إليه المحقق خارج الشاشة،
   * فيضطر إلى السحب بعد كل تكبير. هنا تبقى النقطة التي تحت المؤشر مكانها.
   */
  const handleWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();

      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      const nextZoom = Math.min(6, Math.max(0.2, zoom * factor));
      const rect = svgRef.current?.getBoundingClientRect();

      if (rect) {
        const scale = unitsPerPixel();
        // إحداثيا المؤشر في فضاء اللوحة قبل التحويل.
        const cursorX = viewBox.x + (event.clientX - rect.left) * scale;
        const cursorY = viewBox.y + (event.clientY - rect.top) * scale;
        setPan({
          x: cursorX - (nextZoom * (cursorX - pan.x)) / zoom,
          y: cursorY - (nextZoom * (cursorY - pan.y)) / zoom,
        });
      }

      setZoom(nextZoom);
    },
    [pan.x, pan.y, setPan, setZoom, unitsPerPixel, viewBox.x, viewBox.y, zoom]
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      const isMiddleButton = event.button === 1;
      const isEmptyArea = event.target === svgRef.current;
      // Alt + سحب: تحريك اللوحة من أي موضع، وهو أيسر في الآيات الطويلة التي
      // تملأ الشاشة فلا يبقى فيها فراغ يُسحب منه.
      const isAltDrag = event.altKey && event.button === 0;
      if (!isMiddleButton && !isEmptyArea && !isAltDrag) return;
      if (isAltDrag) event.preventDefault();

      panState.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (!panState.current) return;
      const scale = unitsPerPixel();
      setPan({
        x: panState.current.panX + (event.clientX - panState.current.x) * scale,
        y: panState.current.panY + (event.clientY - panState.current.y) * scale,
      });
    },
    [setPan, unitsPerPixel]
  );

  const endPan = useCallback(() => {
    panState.current = null;
  }, []);

  /** الزر الأيمن على أي عنصر: يحدده ويفتح قائمة أوامره (FR-ED-02.6). */
  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (readOnly) return;
      event.preventDefault();
      const target = (event.target as Element).closest<SVGGElement>('[data-word-id],[data-line-id],[data-entry-variant]');
      if (!target) return;
      // كشف نوع العنصر من سماته: أداة ← اختلاف/وجه، سطر، كلمة.
      const entryVariant = target.dataset.entryVariant;
      const entryAlternative = target.dataset.entryAlternative;
      const lineId = target.dataset.lineId;
      const wordId = target.dataset.wordId;
      if (entryVariant) {
        if (entryAlternative) selectAlternative(entryVariant, entryAlternative);
        else selectVariant(entryVariant);
      } else if (lineId) {
        const variantId = target.dataset.variantIds?.split(' ')[0];
        selectLine(lineId, variantId);
      } else if (wordId) {
        selectWord(Number(wordId));
      } else {
        return;
      }
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [readOnly, selectAlternative, selectLine, selectVariant, selectWord]
  );

  const handleWordClick = useCallback(
    (box: WordBox, event?: React.MouseEvent) => {
      if (readOnly) {
        selectWord(box.wordId);
        return;
      }

      if (currentTool === 'mark') {
        // في وضع الحروف لا نعتمد النقر العام على الكلمة؛ انقر خلية الحرف
        // الظاهرة فوق النص حتى يبقى التحديد دقيقا ولا يتحول سهوا إلى كلمة.
        if (markingMode === 'WORDS') toggleMarkedPosition(box.position);
        return;
      }

      // تحديد متعدد سريع (FR-ED-09/T2): Ctrl+نقر على كلمات متفرقة يعلّمها
      // دون تبديل الأداة، فتُسند إليها الاختلافات دفعة واحدة من المعالج.
      if ((event?.ctrlKey || event?.metaKey) && markingMode === 'WORDS') {
        toggleMarkedPosition(box.position);
        return;
      }

      selectWord(box.wordId === selectedWordId ? null : box.wordId);

      const variant = effectiveVariants.find(
        (item) => box.position >= item.startPosition && box.position <= item.endPosition
      );
      selectVariant(variant?.id ?? null);
    },
    [
      currentTool,
      effectiveVariants,
      markingMode,
      readOnly,
      selectVariant,
      selectWord,
      selectedWordId,
      toggleMarkedPosition,
    ]
  );

  const handleCharacterClick = useCallback(
    (box: WordBox, characterIndex: number) => {
      if (readOnly || currentTool !== 'mark' || markingMode !== 'CHARACTERS') return;
      toggleMarkedCharacter({ position: box.position, characterIndex });
      // الحرف نفسه هو العنصر النشط في التحديد الموحّد (لا كلمته فقط).
      selectElement({
        kind: 'CHARACTER',
        id: `${box.wordId}:${characterIndex}`,
        wordId: box.wordId,
        position: box.position,
        characterIndex,
      });
    },
    [currentTool, markingMode, readOnly, toggleMarkedCharacter]
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
      if (nextVariantId) selectLine(line.id, nextVariantId, line.startPosition);
      else {
        selectVariant(null);
        selectBranch(null);
      }
    },
    [readOnly, selectBranch, selectLine, selectVariant, selectedVariantId]
  );

  /**
   * النقر على حكم داخل سطر مركّب: السطر يحمل أحكاما عدة، فيجب أن يفتح
   * النقر موضع الحكم الذي تحته المؤشر لا أول أحكام السطر.
   */
  const handleEntryClick = useCallback(
    (_line: ClassicLine, entry: { variantId: string; alternativeId?: string }) => {
      if (readOnly || !entry.variantId) return;
      if (entry.alternativeId) selectAlternative(entry.variantId, entry.alternativeId);
      else selectVariant(entry.variantId);
      selectBranch(null);
    },
    [readOnly, selectAlternative, selectBranch, selectVariant]
  );

  // الكلمات المشمولة باختلاف: تُظلَّل تظليلا خفيفا يرشد المحرر.
  const coveredPositions = useMemo(() => {
    if (!document) return [];
    const positions = new Set<number>();
    for (const variant of effectiveVariants) {
      for (const position of positionsOfVariant(variant)) positions.add(position);
    }
    return [...positions];
  }, [document, effectiveVariants]);

  // النطاقات الحرفية المحفوظة تعرض بتظليل أدق من تظليل الكلمة الكاملة.
  const coveredCharacterRanges = useMemo(
    () =>
      effectiveVariants.flatMap((variant) =>
        lociOfVariant(variant)
          .map((locus) => locus.characterRange)
          .filter((range): range is NonNullable<typeof range> => Boolean(range))
      ),
    [effectiveVariants]
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
        onContextMenu={handleContextMenu}
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
            markedCharacters={markedCharacters}
            ayahMarkers={ayahMarkers}
            focusSegment={focusSegment}
            coveredPositions={coveredPositions}
            coveredCharacterRanges={coveredCharacterRanges}
            characterMarkingActive={!readOnly && currentTool === 'mark' && markingMode === 'CHARACTERS'}
            selectedWordId={selectedWordId}
            selectedVariantId={selectedVariantId}
            pulseLineId={pulseLineId}
            activeEntry={activeEntry}
            pulseEntryKey={pulseEntryKey}
            hoveredLineId={hoveredLineId}
            onWordClick={handleWordClick}
            onCharacterClick={handleCharacterClick}
            onLineClick={handleLineClick}
            onEntryClick={handleEntryClick}
            onLineHoverStart={(line) => setHoveredLineId(line.id)}
            onLineHoverEnd={() => setHoveredLineId(null)}
            onReaderClick={setOpenReader}
          />
        </g>
      </svg>

      <CanvasLegend characterMarkingActive={!readOnly && currentTool === 'mark' && markingMode === 'CHARACTERS'} />

      {/* بطاقة معلومات مصغرة للعنصر المُوجَّه إليه، أعلى اللوحة (FR-ED-02.3) */}
      {focusCard && (
        <SelectionFocusCard
          selection={focusCard}
          onClose={() => {
            setFocusCard(null);
            if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
          }}
        />
      )}

      <SelectionContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />

      <button
        type="button"
        onClick={() => setShowSymbols((value) => !value)}
        className="absolute bottom-3 right-3 z-10 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm backdrop-blur hover:bg-white"
        aria-expanded={showSymbols}
      >
        دليل الرموز
      </button>

      {showSymbols && <SymbolsLegend catalog={catalog} onClose={() => setShowSymbols(false)} />}

      {openReader && (
        <ReaderCard
          reader={openReader}
          catalog={catalog}
          onClose={() => setOpenReader(null)}
        />
      )}
    </div>
  );
}

/**
 * بطاقة تعريف الراوي: تُفتح بالنقر على رمزه في طرف السطر.
 *
 * النبذة مادة تعريفية موجزة لا تحقيق علمي، ولذلك تُذيَّل بتنبيه صريح. أما
 * الاسم والإمام والرمز فمن الكتالوج، فتظهر صحيحة حتى لراوٍ أضافه المشرف.
 */
function ReaderCard({
  reader,
  catalog,
  onClose,
}: {
  reader: ClassicReaderChip;
  catalog: TransmissionCatalog;
  onClose: () => void;
}) {
  const narrator = catalog.narrators.find((item) => item.id === reader.narratorId);
  const imam = catalog.imams.find((item) => item.id === narrator?.imamId);
  const profile = getNarratorProfile(reader.narratorId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تعريف الراوي ${reader.name}`}
      className="absolute inset-0 z-20 flex items-center justify-center bg-stone-900/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-base font-bold text-white"
              style={{ fontFamily: "'Amiri Quran', serif" }}
            >
              {reader.symbol || '—'}
            </span>
            <div>
              <h4 className="text-sm font-bold text-stone-900">{reader.name}</h4>
              <p className="text-[11px] text-stone-500">
                {imam ? `راوٍ عن ${imam.name}` : 'راوٍ'}
                {narrator?.legacyOrderInTayyibah
                  ? ` · ترتيبه في الطيبة ${narrator.legacyOrderInTayyibah}`
                  : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        {profile ? (
          <dl className="mt-3 space-y-1.5 border-t border-stone-100 pt-3 text-[12px] leading-relaxed">
            {profile.fullName && (
              <div>
                <dt className="inline font-medium text-stone-800">الاسم: </dt>
                <dd className="inline text-stone-600">{profile.fullName}</dd>
              </div>
            )}
            {(profile.died || profile.place) && (
              <div>
                <dt className="inline font-medium text-stone-800">الوفاة: </dt>
                <dd className="inline text-stone-600">
                  {profile.died ?? '—'}
                  {profile.place ? ` · ${profile.place}` : ''}
                </dd>
              </div>
            )}
            {profile.summary && (
              <p className="pt-1 text-stone-700">{profile.summary}</p>
            )}
          </dl>
        ) : (
          <p className="mt-3 border-t border-stone-100 pt-3 text-[12px] text-stone-500">
            لا توجد نبذة مسجّلة لهذا الراوي بعد.
          </p>
        )}

        <p className="mt-3 border-t border-stone-100 pt-2 text-[10px] leading-relaxed text-stone-400">
          نبذة تعريفية موجزة للاستئناس، وليست تحقيقا علميا. المرجع: غاية النهاية والنشر وطبقات القراء.
        </p>
      </div>
    </div>
  );
}

// ==================== عناصر خاصة بالمحرر ====================

function CanvasLegend({ characterMarkingActive = false }: { characterMarkingActive?: boolean }) {
  const categories = Object.keys(CATEGORY_LABELS) as Array<VariantCategory>;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-xs text-stone-600 shadow-sm backdrop-blur">
      {characterMarkingActive && (
        <p className="mb-1.5 font-medium text-amber-800">وضع الحروف: انقر الحرف نفسه — كل خلية حرف واحد فقط.</p>
      )}
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

/**
 * دليل الرموز: رموز الأئمة ورموز الرواة، وبيان أن الطريق يُذكر باسمه.
 *
 * هذه هي القاعدة التي يعمل بها المحرك في طرف السطر: يرتفع إلى رمز الإمام
 * إذا اجتمع راوياه، وينزل إلى اسم الطريق إذا انفرد.
 */
function SymbolsLegend({
  catalog,
  onClose,
}: {
  catalog: TransmissionCatalog;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-14 right-3 z-10 max-h-[70vh] w-72 overflow-auto rounded-xl border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-bold text-stone-800">دليل الرموز</h4>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="إغلاق"
        >
          ×
        </button>
      </div>

      <h5 className="mb-1 text-[11px] font-semibold text-stone-700">رموز الأئمة</h5>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {getImamsWithSymbols(catalog).map((imam) => (
          <li key={imam.id} className="flex items-center gap-1.5 text-[11px] text-stone-700">
            <span
              className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-stone-800 px-0.5 text-[10px] font-bold text-white"
              style={{ fontFamily: "'Amiri Quran', serif" }}
            >
              {imam.symbol || '—'}
            </span>
            <span className="truncate">{imam.name}</span>
          </li>
        ))}
      </ul>

      <h5 className="mb-1 mt-3 text-[11px] font-semibold text-stone-700">رموز الرواة</h5>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {getNarratorsByTayyibah(catalog).map((narrator) => (
          <li key={narrator.id} className="flex items-center gap-1.5 text-[11px] text-stone-700">
            <span
              className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-emerald-600 px-0.5 text-[10px] font-bold text-white"
              style={{ fontFamily: "'Amiri Quran', serif" }}
            >
              {narrator.symbol || '—'}
            </span>
            <span className="truncate">{narrator.name}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 border-t border-stone-100 pt-2 text-[10px] leading-relaxed text-stone-500">
        القاعدة في طرف السطر: اجتمع الراويان → <strong>رمز الإمام</strong>، انفرد راوٍ أو
        اجتمع طريقاه → <strong>رمز الراوي</strong>، انفرد طريق → <strong>اسم الطريق</strong>.
        يمكن وضع رمز للطريق من لوحة التحكم، ويبقى الاسم هو ما يُطبع على السطر.
      </p>
    </div>
  );
}

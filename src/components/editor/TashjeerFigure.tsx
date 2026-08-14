// عناصر رسم لوحة التشجير - Tashjeer Figure
//
// كل الرسم البصري للشجرة مجموع هنا في مكوّنات نقية بلا حالة ولا مخزن، حتى
// يكون ناتج المحرر في المتصفح هو نفسه الناتج الذي تفحصه الاختبارات وأدوات
// التصدير. لو بقي الرسم داخل مكوّن المحرر لتعذّر التحقق منه إلا بمتصفح.

import { getCategoryColor } from '@/lib/tashjeer/color-system';
import type {
  ClassicAgreementLine,
  ClassicLine,
  ClassicReaderChip,
  ClassicTashjeer,
} from '@/lib/tashjeer/classic-tashjeer';
import type { TashjeerEngineSettings } from '@/lib/tashjeer/engine-settings';
import type { AyahLayout, RecitationBoundary, WordBox } from '@/types/tashjeer';

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * الشجرة كاملة: إطار النص، وعلامات الوقف، وأسطر الأوجه، ثم كلمات الآية فوقها.
 * ترتيب الطبقات مقصود: النص آخرا ليبقى مقروءا وقابلا للنقر فوق الأسطر.
 */
export function TashjeerFigure({
  layout,
  classic,
  viewBox,
  fontSize,
  showLabels,
  boundaries,
  baseNarratorName,
  engine,
  showAnchors = false,
  showRulers = false,
  markedPositions = [],
  coveredPositions = [],
  selectedWordId = null,
  selectedVariantId = null,
  hoveredLineId = null,
  onWordClick,
  onLineClick,
  onLineHoverStart,
  onLineHoverEnd,
  onReaderClick,
}: {
  layout: AyahLayout;
  classic: ClassicTashjeer;
  viewBox: ViewBox;
  fontSize: number;
  showLabels: boolean;
  boundaries: RecitationBoundary[];
  baseNarratorName: string;
  engine: TashjeerEngineSettings;
  showAnchors?: boolean;
  showRulers?: boolean;
  markedPositions?: number[];
  coveredPositions?: number[];
  selectedWordId?: number | null;
  selectedVariantId?: string | null;
  hoveredLineId?: string | null;
  onWordClick?: (box: WordBox) => void;
  onLineClick?: (line: ClassicLine) => void;
  onLineHoverStart?: (line: ClassicLine) => void;
  onLineHoverEnd?: () => void;
  /** النقر على رمز راوٍ: تفتح اللوحة بطاقة تعريفه. */
  onReaderClick?: (reader: ClassicReaderChip) => void;
}) {
  return (
    <>
      {showRulers && <Rulers viewBox={viewBox} />}

      <BaselineBand layout={layout} viewBox={viewBox} baseNarratorName={baseNarratorName} />

      <BoundaryMarkers boundaries={boundaries} layout={layout} />

      <g>
        {classic.lines.map((line) => (
          <ClassicLineShape
            key={line.id}
            line={line}
            fontSize={fontSize}
            showLabels={showLabels}
            showMadd={engine.showMaddColumn}
            showRule={engine.showRuleUnderWord && showLabels}
            textBottom={classic.textBottom}
            isSelected={line.variantId === selectedVariantId}
            isHovered={line.id === hoveredLineId}
            onClick={() => onLineClick?.(line)}
            onHoverStart={() => onLineHoverStart?.(line)}
            onHoverEnd={() => onLineHoverEnd?.()}
            onReaderClick={onReaderClick}
          />
        ))}

        {classic.agreement && (
          <AgreementLine
            agreement={classic.agreement}
            showLabels={showLabels}
            isHovered={classic.agreement.id === hoveredLineId}
            onHoverStart={() => onLineHoverStart?.({ id: classic.agreement!.id } as ClassicLine)}
            onHoverEnd={() => onLineHoverEnd?.()}
            onReaderClick={onReaderClick}
          />
        )}
      </g>

      <g>
        {layout.boxes.map((box) => (
          <WordShape
            key={box.wordId}
            box={box}
            fontSize={fontSize}
            isMarked={markedPositions.includes(box.position)}
            isSelected={box.wordId === selectedWordId}
            isCovered={coveredPositions.includes(box.position)}
            showAnchors={showAnchors}
            onClick={() => onWordClick?.(box)}
          />
        ))}
      </g>
    </>
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

// ==================== سطر التشجير الكلاسيكي ====================
//
// شكل السطر الواحد، مطابقا للمصحف المشجّر:
//
//                          كلمة الاختلاف          (نص الآية أعلاه)
//                                │
//                             إمالة              ← اسم الحكم عند الكلمة
//   ج ع  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈├────────┴────────┤┈┈┈┈┈┈┈┈┈┈  ٤
//    ↑                       ↑                          ↑
//  رموز القراء يسارا     خط الوجه              حركات المد يمينا
//   (الترتيب من آخر الآية)
//
// الخط التوضيحي الرفيع يمتد بطول الآية كلها دائما، منفصلا عن خط الوجه، حتى
// تصل العين من الكلمة إلى بطاقة القارئ ولو كان الاختلاف كلمة واحدة.
//
// رموز القراء في **الطرف الأيسر**: ترتيب قراءة الاختلاف يبدأ من آخر كلمة في
// الآية، وآخر الآية في الرسم العربي هو الطرف الأيسر، فتقع البطاقة حيث تنتهي
// عين القارئ لا حيث تبدأ.

function ClassicLineShape({
  line,
  fontSize,
  showLabels,
  showMadd,
  showRule,
  textBottom,
  isSelected,
  isHovered,
  onClick,
  onHoverStart,
  onHoverEnd,
  onReaderClick,
}: {
  line: ClassicLine;
  fontSize: number;
  showLabels: boolean;
  showMadd: boolean;
  showRule: boolean;
  /** أسفل كتلة النص: تبدأ منه الوصلة حتى لا تخترق أسطر الآية الملتفة. */
  textBottom: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onReaderClick?: (reader: ClassicReaderChip) => void;
}) {
  const color = getCategoryColor(line.category);
  const strokeWidth = isSelected ? 2.6 : isHovered ? 2 : 1.4;
  const opacity = isSelected || isHovered ? 1 : 0.92;

  if (line.marks.length === 0) return null;

  const startX = line.spanStartX;
  const endX = line.spanEndX;
  const ruleFontSize = Math.max(11, Math.round(fontSize * 0.42));

  // حصر كلمات الاختلاف على السطر الممتد: من أول عقدة إلى آخرها مع هامش.
  const markXs = line.marks.map((mark) => mark.x);
  const emphasisPad = 10;
  const emphasis = markXs.length
    ? { startX: Math.min(...markXs) - emphasisPad, endX: Math.max(...markXs) + emphasisPad }
    : null;

  return (
    <g
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{ cursor: 'pointer' }}
      data-line-id={line.id}
      data-lane={line.lane}
    >
      {/* ممر شفاف عريض لتسهيل النقر على السطر */}
      <rect
        x={Math.min(startX, line.guideStartX)}
        y={line.rowY - 9}
        width={Math.max(Math.max(endX, line.guideEndX) - Math.min(startX, line.guideStartX), 1)}
        height={18}
        fill="transparent"
      />

      {/* الخط التوضيحي بطول الآية كلها. لا نرسمه إلا حين يقصر خط الوجه عن
          الآية (وضع VARIANT_SPAN)، إذ يكون خط الوجه نفسه هو خط الآية في
          الوضع الافتراضي، فرسم خط ثانٍ فوقه تكرار لا يراه أحد. */}
      {(line.guideStartX < startX - 0.5 || line.guideEndX > endX + 0.5) && (
        <line
          x1={line.guideStartX}
          y1={line.rowY}
          x2={line.guideEndX}
          y2={line.rowY}
          stroke={color}
          strokeWidth={0.8}
          strokeDasharray="1 4"
          opacity={isSelected || isHovered ? 0.6 : 0.38}
        />
      )}

      {/* السطر الأفقي: يبدأ من الطرف الأيسر وينتهي عند الطرف الأيمن */}
      <line
        x1={startX}
        y1={line.rowY}
        x2={endX}
        y2={line.rowY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
        filter={isSelected ? 'url(#branch-glow)' : undefined}
      />

      {/* مدى الاختلاف نفسه، مغلّظا فوق السطر الممتد. بهذا ينفصل الاختلاف عن
          الخط: الخط يمتد مع الآية فيبيّن موافقة الراوي لما قبله، والغليظ
          يحصر الكلمات المختلفة وحدها. */}
      {emphasis && (
        <line
          x1={emphasis.startX}
          y1={line.rowY}
          x2={emphasis.endX}
          y2={line.rowY}
          stroke={color}
          strokeWidth={strokeWidth + 2.2}
          strokeLinecap="round"
          opacity={opacity}
        />
      )}

      {/* الوصلة الرأسية إلى موضع الاختلاف، على جزأين حتى لا تخترق النص:
            1. شارة قصيرة تحت الكلمة نفسها تعيّن موضعها بدقة.
            2. وصلة في الفراغ الذي بين كتلة النص والسطر.
          في الآية الطويلة الملتفة كانت الوصلة الواحدة تنزل من كلمة في السطر
          الأول فتقطع أسطر النص التالية كلها. */}
      {line.marks.map((mark) => (
        <g key={`c-${mark.wordId}`}>
          <line
            x1={mark.x}
            y1={mark.bottomY + 2}
            x2={mark.x}
            y2={mark.bottomY + 10}
            stroke={color}
            strokeWidth={1.2}
            opacity={0.75}
          />
          <line
            x1={mark.x}
            y1={textBottom + 6}
            x2={mark.x}
            y2={line.rowY}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={0.5}
          />
        </g>
      ))}

      {/* العقدة على موضع الكلمة المختلفة */}
      {line.marks.map((mark) => (
        <circle
          key={`d-${mark.wordId}`}
          cx={mark.x}
          cy={line.rowY}
          r={isSelected ? 3.4 : 2.6}
          fill={color}
          stroke="#ffffff"
          strokeWidth={1}
        />
      ))}

      {/* اسم الحكم فوق السطر عند موضع الكلمة تماما: إمالة، تقليل، سكت... */}
      {showRule && (
        <text
          x={(Math.min(...line.marks.map((m) => m.x)) + Math.max(...line.marks.map((m) => m.x))) / 2}
          y={line.rowY - 6}
          textAnchor="middle"
          fontSize={ruleFontSize}
          fontFamily="'Amiri Quran', 'Amiri', serif"
          fill={color}
          style={{ direction: 'rtl', userSelect: 'none', fontWeight: 700 }}
        >
          {line.ruleLabel}
        </text>
      )}

      {/* رموز القراء في الطرف الأيسر من السطر: أين يقرأ القارئ */}
      {showLabels && (
        <ReaderSymbols
          readers={line.readers}
          fallbackName={line.primaryNarratorName}
          symbolDisplay={line.symbolDisplay}
          color={color}
          rightX={line.guideStartX - 12}
          y={line.rowY}
          onReaderClick={onReaderClick}
        />
      )}

      {/* حركات المد في الهامش الأيمن قبالة السطر */}
      {showMadd && typeof line.maddHarakat === 'number' && (
        <text
          x={endX + 18}
          y={line.rowY + 4}
          textAnchor="middle"
          fontSize={13}
          fontFamily="'Amiri Quran', 'Amiri', serif"
          fill="#78716c"
          style={{ userSelect: 'none', fontWeight: 700 }}
        >
          {toArabicDigits(line.maddHarakat)}
        </text>
      )}

      <title>{lineTitle(line)}</title>
    </g>
  );
}

/**
 * رموز القراء في طرف السطر الأيسر. الرمز هو مفتاح القراءة في المصحف
 * المشجّر: يعرف القارئ من نظرة واحدة أن هذا السطر يخصه.
 *
 * كل رمز عنصر مستقل بإحداثي محسوب، لا نص واحد مجمّع. سببان:
 *
 *   1. **الجهة**. النص الواحد كان يُرسم بـ `text-anchor="end"` مع
 *      `direction: rtl`، وفي هذه الحال يعني «end» طرفَ النص في اتجاه
 *      الكتابة، أي حافته اليسرى، فينسكب النص يمينا من نقطة الإرساء ويظهر
 *      في الجهة اليمنى — عكس المطلوب. الإحداثي الصريح مع `middle` لا
 *      يتأثر باتجاه الكتابة أصلا، فالنتيجة واحدة في كل محرك رسم.
 *   2. **التفاعل**. الرمز المستقل يمكن النقر عليه لمعرفة صاحبه.
 *
 * الترتيب من اليمين إلى اليسار: أول الرواة في الطيبة أقربهم إلى السطر.
 */
function ReaderSymbols({
  readers,
  fallbackName,
  symbolDisplay,
  color,
  rightX,
  y,
  onReaderClick,
}: {
  readers: ClassicReaderChip[];
  fallbackName: string;
  symbolDisplay: ClassicLine['symbolDisplay'];
  color: string;
  /** الحافة اليمنى لكتلة الرموز: تنمو الكتلة يسارا انطلاقا منها. */
  rightX: number;
  y: number;
  onReaderClick?: (reader: ClassicReaderChip) => void;
}) {
  const chips = layoutReaderChips(readers, fallbackName, symbolDisplay, rightX, y);

  if (chips.length === 0) return null;

  return (
    <g>
      {chips.map((chip) => (
        <g
          key={chip.key}
          onClick={
            chip.reader && onReaderClick
              ? (event) => {
                  // لا نفتح تحرير الوجه عند النقر على الرمز؛ المقصود صاحبه.
                  event.stopPropagation();
                  onReaderClick(chip.reader!);
                }
              : undefined
          }
          style={{ cursor: chip.reader && onReaderClick ? 'pointer' : 'inherit' }}
          data-narrator-id={chip.reader?.narratorId}
        >
          <rect
            x={chip.x - chip.width / 2}
            y={y - 9}
            width={chip.width}
            height={18}
            rx={4}
            fill="transparent"
          />
          <text
            x={chip.x}
            y={y + 5}
            textAnchor="middle"
            fontSize={15}
            fontFamily="'Amiri Quran', 'Amiri', serif"
            fill={color}
            style={{ userSelect: 'none', fontWeight: 700 }}
          >
            {chip.text}
          </text>
          {chip.reader && <title>{chip.reader.name}</title>}
        </g>
      ))}
    </g>
  );
}

interface PlacedChip {
  key: string;
  text: string;
  x: number;
  width: number;
  reader?: ClassicReaderChip;
}

/**
 * يوزّع بطاقات القراء أفقيا انطلاقا من الحافة اليمنى نحو اليسار.
 *
 * القياس تقريبي مقصود: الغرض تباعد ثابت لا يعتمد على قياس المتصفح، حتى
 * يكون ناتج الخادم والاختبارات هو ناتج الشاشة نفسه.
 */
function layoutReaderChips(
  readers: ClassicReaderChip[],
  fallbackName: string,
  symbolDisplay: ClassicLine['symbolDisplay'],
  rightX: number,
  _y: number
): PlacedChip[] {
  const gap = 4;

  // عرض الاسم يتناسب مع حروفه، والرمز حرف أو حرفان فله عرض ثابت مريح.
  const measure = (text: string) => Math.max(13, text.length * 8.5 + 6);

  if (symbolDisplay === 'NAMES') {
    const text = readers[0]?.name ?? fallbackName;
    if (!text) return [];
    const width = measure(text);
    return [{ key: 'name', text, x: rightX - width / 2, width, reader: readers[0] }];
  }

  const withSymbols = readers.filter((reader) => reader.symbol.trim().length > 0);

  // لا رمز لأحد (حالة حفص وحده مثلا): نطبع الاسم حتى لا يبقى السطر مجهولا.
  if (withSymbols.length === 0) {
    const text = readers[0]?.name ?? fallbackName;
    if (!text) return [];
    const width = measure(text);
    return [{ key: 'name', text, x: rightX - width / 2, width, reader: readers[0] }];
  }

  const chips: PlacedChip[] = [];
  let cursor = rightX;

  for (const reader of withSymbols) {
    const width = measure(reader.symbol);
    chips.push({
      key: reader.narratorId,
      text: reader.symbol,
      x: cursor - width / 2,
      width,
      reader,
    });
    cursor -= width + gap;
  }

  return chips;
}

/** تحويل الرقم إلى أرقام عربية، كما تُطبع حركات المد في المصحف. */
function toArabicDigits(value: number): string {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return String(value).replace(/\d/g, (digit) => digits[Number(digit)]);
}

function lineTitle(line: ClassicLine): string {
  const readers = line.readerNames.join('، ');
  const madd = typeof line.maddHarakat === 'number' ? `\nحركات المد: ${line.maddHarakat}` : '';
  return `الحكم: ${line.ruleLabel} — النوع: ${line.categoryLabel}\nالقراء: ${readers}\nالوجه: ${line.readingText}${line.readingLabel ? ` (${line.readingLabel})` : ''}${madd}`;
}

// ==================== عناصر مساعدة ====================

/**
 * إطار نص الآية. لا نرسم تحته خطا فاصلا: أول سطر تشجير هو الذي يلي النص
 * مباشرة، وأي خط إضافي هنا كان يُقرأ خطأ على أنه سطر وجه.
 */
function BaselineBand({
  layout,
  viewBox,
  baseNarratorName,
}: {
  layout: { boxes: WordBox[] };
  viewBox: { x: number; y: number; width: number; height: number };
  baseNarratorName: string;
}) {
  if (layout.boxes.length === 0) return null;

  const top = Math.min(...layout.boxes.map((box) => box.topY));
  const bottom = Math.max(...layout.boxes.map((box) => box.bottomY));
  const rightX = Math.max(...layout.boxes.map((box) => box.x + box.width));
  const leftX = Math.min(...layout.boxes.map((box) => box.x));

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
      <text
        x={viewBox.x + 12}
        y={top - 16}
        fontSize={11}
        fill="#0f766e"
        fontFamily="system-ui, sans-serif"
        style={{ direction: 'rtl', userSelect: 'none' }}
      >
        نص المصحف · {baseNarratorName}
      </text>
    </g>
  );
}

/**
 * علامات الوقف والابتداء التي أدخلها المحقق. ترسم كدليل بصري فقط؛ لا تفترض
 * صحة وقف من غير بيانات علمية ولا تمنع المحرر من تغيير اختياره.
 */
function BoundaryMarkers({
  boundaries,
  layout,
}: {
  boundaries: RecitationBoundary[];
  layout: { boxByPosition: Map<number, WordBox> };
}) {
  const labels: Record<RecitationBoundary['kind'], string> = {
    WAQF: 'وقف',
    IBTIDA: 'ابتداء',
    WASL: 'وصل',
  };
  const colors: Record<RecitationBoundary['kind'], string> = {
    WAQF: '#7c3aed',
    IBTIDA: '#0f766e',
    WASL: '#0369a1',
  };

  return (
    <g pointerEvents="none">
      {boundaries.map((boundary) => {
        const box = layout.boxByPosition.get(boundary.position);
        if (!box) return null;
        // بعد الكلمة في RTL يكون عند طرفها الأيسر، وقبلها عند طرفها الأيمن.
        const x = boundary.kind === 'IBTIDA' ? box.x + box.width + 4 : box.x - 4;
        const y = boundary.kind === 'IBTIDA' ? box.topY - 13 : box.bottomY + 16;
        const color = colors[boundary.kind];
        const text = `${boundary.label || labels[boundary.kind]}${
          boundary.connectsToNextAyah ? ' ↔ التالية' : ''
        }`;

        return (
          <g key={boundary.id} opacity={0.94}>
            <line
              x1={x}
              y1={boundary.kind === 'IBTIDA' ? box.topY - 2 : box.bottomY + 2}
              x2={x}
              y2={y + (boundary.kind === 'IBTIDA' ? 4 : -4)}
              stroke={color}
              strokeWidth={1.1}
              strokeDasharray="2 2"
            />
            <rect
              x={x - 17}
              y={y - 10}
              width={Math.max(34, text.length * 6.5 + 10)}
              height={17}
              rx={5}
              fill="#ffffff"
              stroke={color}
              strokeWidth={0.8}
            />
            <text
              x={x}
              y={y + 2}
              textAnchor="middle"
              fontSize={9.5}
              fill={color}
              fontFamily="system-ui, sans-serif"
              style={{ direction: 'rtl', userSelect: 'none', fontWeight: 700 }}
            >
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * سطر «جمهور»: يُرسم وحده حين تخلو الآية من أي اختلاف.
 *
 * لا يُنسب إلى راوٍ. كان يُطبع «الجمهور · حفص» وهو خطأ منهجي: نص المصحف
 * مكتوب برواية حفص، لكن الوجه عند اتفاق القراء وجه الجمهور كلهم لا وجه حفص.
 *
 * وهو تفاعلي: عند التمرير عليه تنكشف رموز القراء، وبالنقر على أي رمز تُفتح
 * بطاقة صاحبه.
 */
function AgreementLine({
  agreement,
  showLabels,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onReaderClick,
}: {
  agreement: ClassicAgreementLine;
  showLabels: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onReaderClick?: (reader: ClassicReaderChip) => void;
}) {
  const color = '#0f766e';
  const y = agreement.rowY;
  // الكلمة في الطرف الأيسر كبقية بطاقات الأسطر، وترتيبها من آخر الآية.
  const labelRightX = agreement.guideStartX - 12;
  const labelWidth = Math.max(40, agreement.label.length * 9 + 10);
  const labelCenterX = labelRightX - labelWidth / 2;

  return (
    <g
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      data-line-id={agreement.id}
      data-agreement="true"
    >
      <rect
        x={labelCenterX - labelWidth / 2}
        y={y - 10}
        width={agreement.guideEndX - (labelCenterX - labelWidth / 2)}
        height={20}
        fill="transparent"
      />

      {/* الخط التوضيحي بطول الآية: مع الاتفاق خط كما مع الاختلاف. */}
      <line
        x1={agreement.guideStartX}
        y1={y}
        x2={agreement.guideEndX}
        y2={y}
        stroke={color}
        strokeWidth={isHovered ? 1.1 : 0.8}
        strokeDasharray="1 4"
        opacity={isHovered ? 0.6 : 0.4}
      />

      {/* خط الاتفاق نفسه: ممتد مع الآية كلها، فالقراء كلهم على وجه واحد. */}
      <line
        x1={agreement.guideStartX}
        y1={y}
        x2={agreement.guideEndX}
        y2={y}
        stroke={color}
        strokeWidth={isHovered ? 2 : 1.4}
        strokeLinecap="round"
        opacity={0.92}
      />

      {showLabels && (
        <text
          x={labelCenterX}
          y={y + 5}
          textAnchor="middle"
          fontSize={15}
          fontFamily="'Amiri Quran', 'Amiri', serif"
          fill={color}
          style={{ userSelect: 'none', fontWeight: 700 }}
        >
          {agreement.label}
        </text>
      )}

      {/* عند التمرير تنكشف رموز القراء فوق السطر: من قرأ بهذا الوجه. */}
      {showLabels && isHovered && (
        <ReaderSymbols
          readers={agreement.readers}
          fallbackName={agreement.label}
          symbolDisplay="SYMBOLS"
          color={color}
          rightX={agreement.guideEndX}
          y={y - 18}
          onReaderClick={onReaderClick}
        />
      )}

      <title>{`اتفق القراء العشرة على وجه واحد في هذه الآية — ${agreement.label}`}</title>
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


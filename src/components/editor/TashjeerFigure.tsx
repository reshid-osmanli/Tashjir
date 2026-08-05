// عناصر رسم لوحة التشجير - Tashjeer Figure
//
// كل الرسم البصري للشجرة مجموع هنا في مكوّنات نقية بلا حالة ولا مخزن، حتى
// يكون ناتج المحرر في المتصفح هو نفسه الناتج الذي تفحصه الاختبارات وأدوات
// التصدير. لو بقي الرسم داخل مكوّن المحرر لتعذّر التحقق منه إلا بمتصفح.

import { getCategoryColor } from '@/lib/tashjeer/color-system';
import type { ClassicLine, ClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
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
          />
        ))}

        {!classic.hasDifferences && (
          <MajorityLine classic={classic} baseNarratorName={baseNarratorName} />
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
//        كلمة الاختلاف                       (نص الآية أعلاه)
//              │
//            إمالة                ← اسم الحكم تحت الكلمة تماما
//   ٤ ├────────┴───────────────────────┤ ج ع    ← رموز القراء في الطرف الأيسر
//   ↑ حركات المد في الهامش الأيمن
//
// السطر يمتد مع الآية كلها (حسب إعداد المحرك)، فيبيّن امتداده أن هذا الوجه
// يوافق ما قبله في بقية الآية، ولا يشير إلى موضع الاختلاف إلا بالوصلة.

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
}) {
  const color = getCategoryColor(line.category);
  const strokeWidth = isSelected ? 2.6 : isHovered ? 2 : 1.4;
  const opacity = isSelected || isHovered ? 1 : 0.92;

  if (line.marks.length === 0) return null;

  const startX = line.spanStartX;
  const endX = line.spanEndX;
  const ruleFontSize = Math.max(11, Math.round(fontSize * 0.42));

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
        x={startX}
        y={line.rowY - 9}
        width={Math.max(endX - startX, 1)}
        height={18}
        fill="transparent"
      />

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
      {showLabels && <ReaderSymbols line={line} color={color} x={startX - 14} y={line.rowY} />}

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
 */
function ReaderSymbols({
  line,
  color,
  x,
  y,
}: {
  line: ClassicLine;
  color: string;
  x: number;
  y: number;
}) {
  const text = line.symbolDisplay === 'NAMES'
    ? line.primaryNarratorName
    : line.symbols.length
      ? line.symbols.join(' ')
      : line.primaryNarratorName;

  return (
    <text
      x={x}
      y={y + 5}
      textAnchor="end"
      fontSize={15}
      fontFamily="'Amiri Quran', 'Amiri', serif"
      fill={color}
      style={{ direction: 'rtl', userSelect: 'none', fontWeight: 700 }}
    >
      {text}
    </text>
  );
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

/** خط «الجمهور» عندما لا توجد أي اختلافات في الآية. */
function MajorityLine({
  classic,
  baseNarratorName,
}: {
  classic: { textBottom: number; firstRowY: number };
  baseNarratorName: string;
}) {
  const y = classic.firstRowY;
  return (
    <g pointerEvents="none">
      <line
        x1={-200}
        y1={y}
        x2={1000}
        y2={y}
        stroke="#94a3b8"
        strokeWidth={1.4}
        strokeDasharray="2 5"
      />
      <text
        x={20}
        y={y + 5}
        fontSize={14}
        fill="#0f766e"
        fontFamily="system-ui, sans-serif"
        style={{ direction: 'rtl', userSelect: 'none', fontWeight: 700 }}
      >
        الجمهور · {baseNarratorName}
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


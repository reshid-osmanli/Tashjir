// لوح التشجير — Tashjeer Plate
//
// مشروع التشجير - نظام القراءات العشر
//
// طبقة العرض المشتركة بين كل مخططات الواجهة (الافتتاحية، الشرح، معاينة المحرر).
// وهي **خالية من البيانات ومن الحالة**: تأخذ نموذجا مبنيّا مسبقا (`ShowcaseAyah`)
// وترسمه. سبب ذلك أداء صريح: هذه الوحدة لا تستورد شيئا من طبقة البيانات، فتمرّ
// مع حزمة العميل خفيفة، ولا تُدخل `mushaf.json` في صفحة لا تحتاجها.
//
// أما المحرك فهو مصدر الإحداثيات: كل خط ونقطة وتسمية هنا موضعها محسوب في
// `layout-engine` و`classic-tashjeer`، وليس في هذه الطبقة (SPEC §157-158).

import type { DisplayMode, ShowcaseAyah, ShowcaseLine } from '@/lib/tashjeer/showcase';

/** أزمنة الترسيم في المشهد الافتتاحي (SPEC §74: الافتتاحية ≤ ١٢٠٠ms). */
export const PLATE_STEP = {
  word: 110,
  wordGap: 85,
  rule: 470,
  tick: 560,
  drop: 640,
  line: 700,
  emphasis: 830,
  node: 930,
  label: 1000,
} as const;

interface TraceStyle extends React.CSSProperties {
  '--trace-delay'?: string;
}

interface DrawStyle extends React.CSSProperties {
  '--draw-length'?: number;
  '--draw-delay'?: string;
}

const QURAN_FONT = "'Amiri Quran', 'Amiri', serif";

/** نص الآية وإحداثياته، مع مسطرة المخطوط تحته. */
export function PlateText({
  model,
  mode = 'static',
  step = PLATE_STEP,
  showBoxes = false,
  opacity = 1,
  fontSize = model.fontSize,
}: {
  model: ShowcaseAyah;
  mode?: DisplayMode;
  step?: typeof PLATE_STEP;
  /** إظهار صندوق كل كلمة (يُستعمل في الشرح فقط). */
  showBoxes?: boolean;
  opacity?: number;
  fontSize?: number;
}) {
  const textLeft = Math.min(...model.words.map((word) => word.x));
  const textRight = Math.max(...model.words.map((word) => word.x + word.width));
  const ruleY = model.textBottom + fontSize * 0.26;

  return (
    <g style={{ opacity, transition: 'opacity 240ms var(--ease-standard)' }}>
      <line
        x1={textLeft - fontSize * 0.2}
        y1={ruleY}
        x2={textRight + fontSize * 0.2}
        y2={ruleY}
        stroke="var(--color-manuscript-edge)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        className={mode === 'draw' ? 'draw-line' : undefined}
        style={
          mode === 'draw'
            ? ({ '--draw-length': textRight - textLeft + fontSize * 0.4, '--draw-delay': `${step.rule}ms` } as DrawStyle)
            : undefined
        }
      />

      {model.words.map((word, index) => (
        <g key={word.position}>
          {showBoxes ? (
            <rect
              x={word.x - 2}
              y={word.topY - 3}
              width={word.width + 4}
              height={word.bottomY - word.topY + 6}
              rx={3}
              fill="none"
              stroke="var(--color-line-strong)"
              strokeOpacity={0.55}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2 3"
            />
          ) : null}
          <text
            x={word.centerX}
            y={word.baselineY}
            textAnchor="middle"
            fontSize={fontSize}
            fontFamily={QURAN_FONT}
            fill="var(--color-viz-base)"
            className={mode === 'draw' ? 'draw-trace' : undefined}
            style={
              mode === 'draw'
                ? ({ direction: 'rtl', '--trace-delay': `${step.word + index * step.wordGap}ms` } as TraceStyle)
                : { direction: 'rtl' }
            }
          >
            {word.text}
          </text>
        </g>
      ))}
    </g>
  );
}

/**
 * سطر الوجه كاملا: الوصلة من الموضع، ثم خط الوجه، ثم التغليظ، ثم عقد الربط،
 * ثم اسم الحكم. الأجزاء الخمسة قابلة للتعتيم كلٌّ على حدة، فيستعملها الشرح
 * لتمييز طبقة بعينها (SPEC §24, §87).
 */
export function PlateLine({
  line,
  model,
  mode = 'static',
  step = PLATE_STEP,
  fontSize = model.fontSize,
  opacityFor,
  showLabel = true,
  activeNode = true,
}: {
  line: ShowcaseLine;
  model: ShowcaseAyah;
  mode?: DisplayMode;
  step?: typeof PLATE_STEP;
  fontSize?: number;
  opacityFor?: (part: 'marks' | 'line' | 'emphasis' | 'label' | 'nodes') => number;
  showLabel?: boolean;
  /** عقدة الربط النشطة: كِبَر خفيف عند إبراز قارئ، بلا توهّج. */
  activeNode?: boolean;
}) {
  const alpha = (part: 'marks' | 'line' | 'emphasis' | 'label' | 'nodes') => opacityFor?.(part) ?? 1;
  const decay = 'opacity 240ms var(--ease-standard)';
  const ruleFontSize = Math.max(11, Math.round(fontSize * 0.38));
  const ruleY = model.textBottom + fontSize * 0.26;
  const spanLength = Math.abs(line.spanEndX - line.spanStartX);
  const emphasisLength = Math.abs(line.emphasisEndX - line.emphasisStartX);

  return (
    <g>
      {/* الوصلة: من أسفل الكلمة إلى خط الوجه. */}
      <g style={{ opacity: alpha('marks'), transition: decay }}>
        {line.marks.map((mark) => (
          <g key={`mark-${mark.position}`}>
            <line
              x1={mark.x}
              y1={mark.bottomY + fontSize * 0.06}
              x2={mark.x}
              y2={ruleY + fontSize * 0.22}
              stroke={line.color}
              strokeWidth={1.1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2 2"
              opacity={0.62}
              className={mode === 'draw' ? 'draw-line' : undefined}
              style={
                mode === 'draw'
                  ? ({ '--draw-length': ruleY - mark.bottomY, '--draw-delay': `${step.tick}ms` } as DrawStyle)
                  : undefined
              }
            />
            {(mode === 'draw' || activeNode) && (
              <circle
                cx={mark.x}
                cy={mark.bottomY + fontSize * 0.03}
                r={2.6}
                fill={line.color}
                className={mode === 'draw' ? 'draw-trace' : undefined}
                style={mode === 'draw' ? ({ '--trace-delay': `${step.drop}ms` } as TraceStyle) : undefined}
              />
            )}
          </g>
        ))}
      </g>

      {/* خط الوجه ثم التغليظ فوقه. */}
      <g style={{ opacity: alpha('line'), transition: decay }}>
        <line
          x1={line.spanStartX}
          y1={line.rowY}
          x2={line.spanEndX}
          y2={line.rowY}
          stroke={line.color}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          opacity={0.88}
          className={mode === 'draw' ? 'draw-line' : undefined}
          style={
            mode === 'draw'
              ? ({ '--draw-length': spanLength, '--draw-delay': `${step.line}ms` } as DrawStyle)
              : undefined
          }
        />
      </g>

      <g style={{ opacity: alpha('emphasis'), transition: decay }}>
        <line
          x1={line.emphasisStartX}
          y1={line.rowY}
          x2={line.emphasisEndX}
          y2={line.rowY}
          stroke={line.color}
          strokeWidth={3.8}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          className={mode === 'draw' ? 'draw-line' : undefined}
          style={
            mode === 'draw'
              ? ({ '--draw-length': emphasisLength, '--draw-delay': `${step.emphasis}ms` } as DrawStyle)
              : undefined
          }
        />
      </g>

      {/* عقد الربط على خط الوجه. */}
      <g style={{ opacity: alpha('nodes'), transition: decay }}>
        {line.marks.map((mark) => (
          <circle
            key={`node-${mark.position}`}
            cx={mark.x}
            cy={line.rowY}
            r={activeNode ? 2.6 : 2.1}
            fill={line.color}
            stroke="var(--color-viz-node)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            className={mode === 'draw' ? 'draw-trace' : undefined}
            style={mode === 'draw' ? ({ '--trace-delay': `${step.node}ms` } as TraceStyle) : undefined}
          />
        ))}
      </g>

      {/* اسم الحكم فوق موضعه. */}
      {showLabel ? (
        <text
          x={line.labelX}
          y={line.rowY - fontSize * 0.3}
          textAnchor="middle"
          fontSize={ruleFontSize}
          fontFamily={QURAN_FONT}
          fill={line.color}
          className={mode === 'draw' ? 'draw-trace' : undefined}
          style={{
            opacity: alpha('label'),
            transition: decay,
            direction: 'rtl',
            fontWeight: 700,
            ...(mode === 'draw' ? { '--trace-delay': `${step.label}ms` } : {}),
          } as TraceStyle}
        >
          {line.ruleLabel}
        </text>
      ) : null}
    </g>
  );
}

/** رموز القراء: دائرة لكل رمز، موزّعة على امتداد سطر الوجه من طرفه. */
export function PlateSymbols({
  line,
  firstX,
  step,
  radius,
  y,
  opacity = 1,
  mode = 'static',
  traceDelay = 1060,
}: {
  line: ShowcaseLine;
  firstX: number;
  step: number;
  radius: number;
  y: number;
  opacity?: number;
  mode?: DisplayMode;
  traceDelay?: number;
}) {
  return (
    <g style={{ opacity, transition: 'opacity 240ms var(--ease-standard)' }}>
      {line.symbols.map((symbol, index) => {
        const cx = firstX - index * step;
        return (
          <g
            key={`${symbol}-${index}`}
            className={mode === 'draw' ? 'draw-trace' : undefined}
            style={
              mode === 'draw'
                ? ({ '--trace-delay': `${traceDelay + index * 40}ms` } as TraceStyle)
                : undefined
            }
          >
            <circle
              cx={cx}
              cy={y}
              r={radius}
              fill="var(--color-parchment-50)"
              fillOpacity={0.92}
              stroke={line.color}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeOpacity={0.5}
            />
            <text
              x={cx}
              y={y + radius * 0.5}
              textAnchor="middle"
              fontSize={radius * 0.95}
              fontFamily={QURAN_FONT}
              fill={line.color}
            >
              {symbol}
            </text>
          </g>
        );
      })}
    </g>
  );
}

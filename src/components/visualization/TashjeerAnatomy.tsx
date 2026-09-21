// تشريح العلاقة — Tashjeer Anatomy
//
// مشروع التشجير - نظام القراءات العشر
//
// غرضه: أن يرى الزائر خلال ثوانٍ كيف يُبنى سطر تشجير واحد، طبقة طبقة، على
// مثال حقيقي من بيانات المشروع. لا شرح نظري: نفس الإحداثيات ونفس المحرك.
//
// التفاعل: تمرير المؤشر (أو التركيز بلوحة المفاتيح) على بند في الشرح يُبرز
// الطبقة المقابلة في المخطط ويخفّف غيرها (SPEC §24, §87). التخفيف بالتعتيم
// لا بالإخفاء: المعلومة تبقى ظاهرة (SPEC §49).

'use client';

import { useState } from 'react';
import type { ShowcaseAyah } from '@/lib/tashjeer/showcase';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

type LayerId = 'text' | 'position' | 'face' | 'readers' | 'rule';

const LAYERS: Array<{ id: LayerId; title: string; note: string }> = [
  {
    id: 'text',
    title: 'النص العثماني',
    note: 'الكلمات بأرقام حتمية: لكل كلمة معرّف ثابت لا يتغيّر بتغيّر الترتيب أو العرض.',
  },
  {
    id: 'position',
    title: 'موضع الاختلاف',
    note: 'الموضع مضبوط بالكلمة (وربما بالحرف)، فلا يُنسب الاختلاف إلى ما ليس منه.',
  },
  {
    id: 'face',
    title: 'سطر الوجه',
    note: 'السطر = قراءة كاملة: يبدأ من طرف الآية ويمتد بقدر الموضع، وفوقه اسم الحكم.',
  },
  {
    id: 'readers',
    title: 'رموز القراء',
    note: 'لكل قارئ رمز في الطيبة؛ الرمز يميّز صاحب القراءة قبل قراءة الاسم.',
  },
  {
    id: 'rule',
    title: 'الفئة والدليل',
    note: 'الفئة (فرش، أصول، مدود...) لونها ثابت، والدليل مرتبط بالموضع لا بالعرض.',
  },
];

/**
 * مسطرة القياس: صف رموز القراء موزّع على امتداد سطر الوجه نفسه.
 * تُصدَّر ليُقاس الإطار عليها في الاختبارات بلا متصفح.
 */
export function readerRowMetrics(
  model: ShowcaseAyah
): { firstSymbolX: number; symbolStep: number; symbolRadius: number; symbolsY: number; viewBox: { x: number; y: number; width: number; height: number } } | null {
  const line = model.lines[0];
  if (!line || line.symbols.length === 0) return null;

  const fontSize = model.fontSize;
  const symbolCount = line.symbols.length;
  const symbolRadius = fontSize * 0.44;
  const symbolsY = line.rowY + fontSize * 1.35;
  // الطرف الأول عند طرف سطر الوجه، ثم يوزّع الصف على عرض اللوحة: ترتيب الرموز
  // محفوظ كما هو، والتوزيع قرار تحريري يجعل التركيبة تنتظم داخل إطار واحد.
  const firstSymbolX = line.spanEndX - symbolRadius;
  const available = Math.abs(line.spanEndX - model.viewBox.x) - symbolRadius * 2;
  const symbolStep = Math.max(
    symbolRadius * 2 + 9,
    available / Math.max(symbolCount - 1, 1)
  );
  const lastSymbolX = firstSymbolX - symbolStep * Math.max(symbolCount - 1, 0);

  const contentLeft = Math.min(model.viewBox.x, lastSymbolX - symbolRadius);
  const contentRight = Math.max(model.viewBox.x + model.viewBox.width, firstSymbolX + symbolRadius);

  return {
    firstSymbolX,
    symbolStep,
    symbolRadius,
    symbolsY,
    viewBox: {
      x: contentLeft,
      y: model.viewBox.y,
      width: contentRight - contentLeft,
      height: symbolsY + symbolRadius + 10 - model.viewBox.y,
    },
  };
}

export function TashjeerAnatomy({ model }: { model: ShowcaseAyah }) {
  const [active, setActive] = useState<LayerId | null>(null);

  const line = model.lines[0] ?? null;
  const fontSize = model.fontSize;
  const ruleFontSize = Math.max(11, Math.round(fontSize * 0.38));

  // صف رموز القراء: موزّع على امتداد سطر الوجه نفسه، كما يفعل المحرك في لوحته.
  const metrics = readerRowMetrics(model);
  const symbolRadius = metrics?.symbolRadius ?? fontSize * 0.44;
  const symbolStep = metrics?.symbolStep ?? fontSize;
  const symbolsY = metrics?.symbolsY ?? 0;
  const firstSymbolX = metrics?.firstSymbolX ?? 0;
  const viewBox = metrics?.viewBox ?? model.viewBox;

  const dim = (layer: LayerId) => (active === null || active === layer ? 1 : 0.2);
  const dimTransition = 'opacity 240ms cubic-bezier(0.2, 0.7, 0.3, 1)';

  const textLeft = Math.min(...model.words.map((word) => word.x));
  const textRight = Math.max(...model.words.map((word) => word.x + word.width));
  const ruleY = model.textBottom + fontSize * 0.26;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
      <div className="order-2 mx-auto min-w-0 w-full max-w-[32rem] lg:order-1">
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="w-full overflow-visible"
          role="img"
          aria-label={`تشريح سطر تشجير على سورة الفاتحة الآية ${model.ayahRef}`}
        >
          <g style={{ transition: dimTransition }} opacity={dim('text')}>
            <line
              x1={textLeft - fontSize * 0.2}
              y1={ruleY}
              x2={textRight + fontSize * 0.2}
              y2={ruleY}
              stroke="var(--color-manuscript-edge)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {model.words.map((word) => (
              <g key={word.position}>
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
                <text
                  x={word.centerX}
                  y={word.baselineY}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontFamily="'Amiri Quran', 'Amiri', serif"
                  fill="var(--color-viz-base)"
                  style={{ direction: 'rtl' }}
                >
                  {word.text}
                </text>
              </g>
            ))}
          </g>

          {line ? (
            <>
              <g style={{ transition: dimTransition }} opacity={dim('position')}>
                {line.marks.map((mark) => (
                  <g key={`pos-${mark.position}`}>
                    <line
                      x1={mark.x}
                      y1={mark.bottomY + fontSize * 0.06}
                      x2={mark.x}
                      y2={ruleY + fontSize * 0.24}
                      stroke={line.color}
                      strokeWidth={1.1}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray="2 2"
                      opacity={0.6}
                    />
                    <circle cx={mark.x} cy={mark.bottomY + fontSize * 0.03} r={2.4} fill={line.color} />
                  </g>
                ))}
              </g>

              <g style={{ transition: dimTransition }} opacity={dim('face')}>
                <line
                  x1={line.spanStartX}
                  y1={line.rowY}
                  x2={line.spanEndX}
                  y2={line.rowY}
                  stroke={line.color}
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  opacity={0.85}
                />
                <line
                  x1={line.emphasisStartX}
                  y1={line.rowY}
                  x2={line.emphasisEndX}
                  y2={line.rowY}
                  stroke={line.color}
                  strokeWidth={3.8}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
                <text
                  x={line.labelX}
                  y={line.rowY - fontSize * 0.32}
                  textAnchor="middle"
                  fontSize={ruleFontSize}
                  fontFamily="'Amiri Quran', 'Amiri', serif"
                  fill={line.color}
                  style={{ direction: 'rtl', fontWeight: 700 }}
                >
                  {line.ruleLabel}
                </text>
              </g>

              <line
                x1={line.spanEndX}
                y1={line.rowY + 6}
                x2={line.spanEndX}
                y2={symbolsY - symbolRadius - 6}
                stroke={line.color}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="2 3"
                opacity={0.35 * dim('readers')}
                style={{ transition: dimTransition }}
              />

              <g style={{ transition: dimTransition }} opacity={dim('readers')}>
                {line.symbols.map((symbol, index) => {
                  const cx = firstSymbolX - index * symbolStep;
                  const radius = symbolRadius;
                  return (
                    <g key={`${symbol}-${index}`}>
                      <circle
                        cx={cx}
                        cy={symbolsY}
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
                        y={symbolsY + fontSize * 0.14}
                        textAnchor="middle"
                        fontSize={symbolRadius * 0.95}
                        fontFamily="'Amiri Quran', 'Amiri', serif"
                        fill={line.color}
                      >
                        {symbol}
                      </text>
                    </g>
                  );
                })}
              </g>

              <g style={{ transition: dimTransition }} opacity={dim('rule')}>
                {/* علامة تحريرية تحت اسم الحكم: خط واحد يدل على مدى الفئة،
                    بلا صندوق يزاحم النص أو يقطع الصف. */}
                <line
                  x1={line.labelX - Math.max(14, line.ruleLabel.length * ruleFontSize * 0.32)}
                  y1={line.rowY - fontSize * 0.28}
                  x2={line.labelX + Math.max(14, line.ruleLabel.length * ruleFontSize * 0.32)}
                  y2={line.rowY - fontSize * 0.28}
                  stroke={line.color}
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              </g>

            </>
          ) : null}
        </svg>
      </div>

      {/* الشرح: قائمة مرقّمة بالأرقام العربية، تقودها في المخطط. */}
      <ol className="order-1 flex flex-col gap-1 lg:order-2">
        {LAYERS.map((layer, index) => {
          const isActive = active === layer.id;
          return (
            <li key={layer.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(layer.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(layer.id)}
                onBlur={() => setActive(null)}
                className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-start transition-colors ${
                  isActive
                    ? 'border-line-strong bg-parchment-200'
                    : 'border-transparent hover:border-line hover:bg-parchment-100'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-micro ${
                    isActive ? 'border-primary-600 text-primary-700' : 'border-line-strong text-ink-400'
                  }`}
                >
                  {toArabicDigits(index + 1)}
                </span>
                <span className="min-w-0">
                  <span className="block text-label font-medium text-ink-900">{layer.title}</span>
                  <span className="mt-0.5 block text-caption text-ink-500">{layer.note}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

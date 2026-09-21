// مخطط التشجير في الواجهة — Hero Tashjeer Diagram
//
// مشروع التشجير - نظام القراءات العشر
//
// هذا ليس رسما توضيحيا مُختلقا: كل إحداثي فيه يأتي من `buildShowcase`، أي من
// نفس التخطيط ونفس المحرك اللذين يرسم بهما المحرر لوحته (SPEC §18, §128).
//
// القواعد:
//   - النص العثماني بخط Amiri Quran وبالإحداثيات المحسوبة، كالمحرر تماما.
//   - الوصلات والنقاط وخط الوجه والتسمية: نفس هندسة `ClassicEntryShape`.
//   - الحركة ترسيم فقط، وتنتهي إلى حالة مستقرّة، ولا تُعيد نفسها (SPEC §17, §51).
//   - الرقائق (شارات القراء) عناصر HTML لا SVG: أوضح للخط ولقارئ الشاشة.

'use client';

import { useState } from 'react';
import { PLATE_STEP, PlateLine, PlateText } from '@/components/visualization/TashjeerPlate';
import { IconReplay } from '@/components/ui/icons';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { ShowcaseAyah } from '@/lib/tashjeer/showcase';

export function HeroTashjeerDiagram({ model }: { model: ShowcaseAyah }) {
  const [run, setRun] = useState(0);
  const [focusedReader, setFocusedReader] = useState<string | null>(null);

  const line = model.lines[0] ?? null;
  const baseReading = model.variant?.alternatives.find((alt) => alt.isBase) ?? null;

  return (
    <figure className="not-prose m-0 w-full">
      {/* حدّ عرض مقصود: المخطط لوحة مخطوط لا لافتة بعرض الشاشة، فحجم النص
          يبقى في حدود العرض الطباعي للآية. */}
      <div className="relative mx-auto w-full max-w-[40rem]">
        <svg
          viewBox={`${model.viewBox.x} ${model.viewBox.y} ${model.viewBox.width} ${model.viewBox.height}`}
          className="w-full overflow-visible"
          role="img"
          aria-labelledby="hero-diagram-title"
        >
          <title id="hero-diagram-title">
            {`مخطط تشجير حقيقي لسورة ${model.surahName} الآية ${model.ayahRef}: خط الوجه يخرج من الموضع المضبوط ويصل إلى رموز القراء.`}
          </title>

          <g key={run}>
            <PlateText model={model} mode="draw" />
            {line ? (
              <PlateLine
                line={line}
                model={model}
                mode="draw"
                opacityFor={() => (focusedReader ? 1 : 0.92)}
              />
            ) : null}
          </g>
        </svg>

        {model.variant ? (
          <button
            type="button"
            onClick={() => setRun((value) => value + 1)}
            className="btn btn-ghost absolute end-0 top-0 gap-1.5 px-2 py-1 text-micro text-ink-400 hover:text-ink-700"
            title="إعادة ترسيم المخطط"
          >
            <IconReplay size={14} />
            <span className="sr-only">إعادة ترسيم المخطط</span>
          </button>
        ) : null}
      </div>

      {/* القراءات: رقائق HTML بلون الفئة نفسه، مربوطة بالمخطط. */}
      {line ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {line.readers.map((reader, index) => (
            <button
              key={reader.id}
              type="button"
              className="chip reader-chip draw-trace"
              style={
                {
                  '--chip-color': line.color,
                  '--trace-delay': `${PLATE_STEP.label + 60 + index * 40}ms`,
                } as React.CSSProperties
              }
              onMouseEnter={() => setFocusedReader(reader.id)}
              onMouseLeave={() => setFocusedReader(null)}
              onFocus={() => setFocusedReader(reader.id)}
              onBlur={() => setFocusedReader(null)}
              title={`${reader.name} — ${line.readingLabel}`}
            >
              <span className="font-mushaf text-caption" aria-hidden="true">
                {reader.symbol}
              </span>
              <span>{reader.name}</span>
            </button>
          ))}

          {baseReading ? (
            <span className="chip" style={{ borderStyle: 'dashed' }} title="ما في المصحف المطبوع">
              <span className="font-mushaf text-caption" aria-hidden="true">
                ۞
              </span>
              <span>{baseReading.label}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-500">
        <span>
          مثال حقيقي من بيانات المشروع: سورة {model.surahName} الآية{' '}
          {toArabicDigits(model.ayahNumber)} — {model.variant?.title ?? ''}
        </span>
        {line ? (
          <span className="chip" style={{ '--chip-color': line.color } as React.CSSProperties}>
            {line.categoryLabel}
          </span>
        ) : null}
        {model.variant?.sourceRef ? (
          <span className="text-ink-400">المصدر: {model.variant.sourceRef}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}

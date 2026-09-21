// خط السير العلمي — Pipeline Figure
//
// مشروع التشجير - نظام القراءات العشر
//
// يرسم السلسلة التي يشتغل بها المشروع:
//
//   اختلاف ← وجه ← قارئ ← راوي ← طريق ← تشجير
//
// والخط نفسه يتحرك مع التمرير، فتظهر المراحل بالترتيب الذي تُبنى به فعلا
// (SPEC §26). الحركة وظيفتها الشرح: أين نحن من السلسلة. لذلك لا شيء يتحرك
// إلا الخط والتمييز؛ لا إزاحة للنصوص ولا ارتداد.
//
// الطريقة: متغيّر CSS واحد (`--progress`) يُكتب من مستمع تمرير واحد بلا
// إعادة تصيير، ثم تُشغَّل الحالة (`passed`) مرة لكل مرحلة لا في كل إطار.

'use client';

import { useEffect, useRef, useState } from 'react';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { usePrefersReducedMotion } from '@/components/motion/Reveal';

export interface PipelineStage {
  id: string;
  label: string;
  note: string;
  /** مثال حقيقي من البيانات يوضّح المرحلة. */
  example: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'difference',
    label: 'اختلاف',
    note: 'موضع واحد تختلف فيه القراءات، مضبوط بكلمة أو حرف.',
    example: 'مَٰلِكِ / مَلِكِ في الفاتحة',
  },
  {
    id: 'face',
    label: 'وجه',
    note: 'قراءة بعينها لها نصّها وحكمها، وهي وحدة الاعتماد العلمي.',
    example: '«بغير ألف» — فرش',
  },
  {
    id: 'reader',
    label: 'قارئ',
    note: 'الإمام الذي تُنسب إليه القراءة، وله ترتيب ثابت في الطيبة.',
    example: 'نافع · ابن كثير · أبو عمرو',
  },
  {
    id: 'narrator',
    label: 'راوٍ',
    note: 'من نقل القراءة عن الإمام، وله رمز يميّزه في الهامش.',
    example: 'قالون · ورش',
  },
  {
    id: 'path',
    label: 'طريق',
    note: 'سلسلة النقل التفصيلية عن الراوي، وهي أدقّ مستوى في النسبة.',
    example: 'الأزرق عن ورش عن نافع',
  },
  {
    id: 'tashjeer',
    label: 'تشجير',
    note: 'النتيجة: خط يخرج من الموضع ويمتد بقدره، ورموز القراء على طرفه.',
    example: 'خط الفرش في مَٰلِكِ',
  },
];

export function PipelineFigure({ stages = PIPELINE_STAGES }: { stages?: PipelineStage[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [passed, setPassed] = useState(-1);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (reduced) {
      element.style.setProperty('--progress', '1');
      setPassed(stages.length - 1);
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const start = viewport * 0.92;
      const end = viewport * 0.42;
      const raw = (start - rect.top) / (start - end);
      const progress = Math.min(Math.max(raw, 0), 1);

      element.style.setProperty('--progress', progress.toFixed(4));

      const nextPassed = Math.round(progress * (stages.length - 1)) - (progress < 0.02 ? 1 : 0);
      setPassed((current) => (current === nextPassed ? current : nextPassed));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced, stages.length]);

  return (
    <div ref={containerRef} className="relative">
      {/* المسار: أفقي على سطح المكتب، رأسي على الجوال. */}
      <div className="absolute end-[9px] top-2 bottom-2 w-px bg-line md:hidden" aria-hidden="true">
        <div
          className="absolute inset-x-0 top-0 w-px bg-primary-600"
          style={{ height: 'calc(var(--progress, 0) * 100%)', transition: 'height 120ms linear' }}
        />
      </div>
      <div className="absolute inset-x-6 top-[9px] hidden h-px bg-line md:block" aria-hidden="true">
        <div
          className="h-px origin-right bg-primary-600"
          style={{
            transform: 'scaleX(var(--progress, 0))',
            transition: 'transform 120ms linear',
          }}
        />
      </div>

      <ol className="relative flex flex-col gap-6 md:flex-row md:justify-between md:gap-4">
        {stages.map((stage, index) => {
          const isPassed = index <= passed;
          return (
            <li key={stage.id} className="flex min-w-0 flex-1 items-start gap-3 md:flex-col md:gap-3">
              <span
                className={`z-base mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors md:mt-0 ${
                  isPassed
                    ? 'border-primary-600 bg-primary-600 text-parchment-50'
                    : 'border-line-strong bg-page text-ink-400'
                }`}
                style={{ transitionDuration: 'var(--motion-fast)' }}
              >
                <span className="text-[9px] leading-none">
                  {isPassed ? '' : toArabicDigits(index + 1)}
                </span>
              </span>

              <div className="min-w-0 ps-1 md:ps-0">
                <p
                  className={`font-amiri text-h3 leading-tight transition-colors ${
                    isPassed ? 'text-ink-900' : 'text-ink-400'
                  }`}
                >
                  {stage.label}
                </p>
                <p className="mt-1 text-caption text-ink-500">{stage.note}</p>
                <p className="mt-1.5 text-caption text-ink-400">{stage.example}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

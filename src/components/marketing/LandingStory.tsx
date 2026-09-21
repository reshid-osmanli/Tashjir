// قصة الرئيسية (١) — التعريف والمشكلة والحل
//
// مشروع التشجير - نظام القراءات العشر
//
// هذه المكوّنات خادمية (server components) إلا ما يلزمه تفاعل. القاعدة:
//   ثابت ⇒ خادم. متحرك بتفاعل ⇒ عميل (SPEC §204).
// ولا يُكتب أي رقم يدويا: كل عدد يأتي من بيانات المشروع.

import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import { HeroTashjeerDiagram } from '@/components/visualization/HeroTashjeerDiagram';
import { TashjeerAnatomy } from '@/components/visualization/TashjeerAnatomy';
import { PipelineFigure } from '@/components/visualization/PipelineFigure';
import { IconArrowForward, IconBranch, IconLayers, IconRoute, IconSource } from '@/components/ui/icons';
import type { ShowcaseAyah } from '@/lib/tashjeer/showcase';
import { NARRATORS, READING_IMAMS, TRANSMISSION_PATH_SEEDS } from '@/data/qiraat-data/qiraat';
import { SEEDED_AYAH_KEYS } from '@/data/variants/seed-variants';
import { TOTAL_AYAHS, TOTAL_WORDS, SURAHS } from '@/data/quran';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

/** عنوان قسم موحّد: رقم تحريري، ثم عنوان، ثم تمهيد. */
export function SectionHeading({
  index,
  title,
  lead,
  id,
}: {
  index?: number;
  title: string;
  lead?: string;
  id?: string;
}) {
  return (
    <header className="max-w-3xl">
      <div className="flex items-baseline gap-3">
        {typeof index === 'number' ? (
          <span className="numeral text-caption text-ink-300">{toArabicDigits(index)}</span>
        ) : null}
        <h2 id={id} className="title-editorial text-h2">
          {title}
        </h2>
      </div>
      {lead ? <p className="measure mt-3 text-lead text-ink-600">{lead}</p> : null}
    </header>
  );
}

/* ================================ الافتتاحية ================================ */

export function HeroSection({ model }: { model: ShowcaseAyah }) {
  const facts = [
    { value: toArabicDigits(SURAHS.length), label: 'سورة' },
    { value: toArabicDigits(TOTAL_AYAHS), label: 'آية' },
    { value: toArabicDigits(TOTAL_WORDS), label: 'كلمة' },
  ];

  return (
    <section className="relative overflow-hidden pb-14 pt-8 md:pb-20 md:pt-12">
      {/* شبكة المخطوط: علامات رأسية شبه غير مرئية تقود العين. */}
      <div
        className="pointer-events-none absolute inset-0 grid-manuscript opacity-40"
        aria-hidden="true"
      />

      <div className="container-editorial relative">
        <div className="max-w-4xl">
          <p className="eyebrow">
            <span className="inline-block h-1 w-1 rounded-full bg-brass-500" />
            نظام القراءات العشر — من طريق الطيبة والنشر
          </p>

          <h1 className="mt-4 font-amiri text-display font-bold text-ink-900">
            القراءات العشر
            <span className="mt-1 block text-ink-700">في صورة واحدة مترابطة</span>
          </h1>

          <p className="measure mt-5 text-lead text-ink-600">
            التشجير هنا نموذج بيانات، لا رسم توضيحي: كل موضع اختلاف يُضبط بكلمته أو حرفه،
            ويُنسب إلى القارئ والراوي والطريق، ويُربط بدليله — ثم يُرسم على النص العثماني نفسه.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/editor" className="btn btn-primary gap-2">
              ادخل إلى المحرر
              <IconArrowForward size={18} />
            </Link>
            <Link href="/quran" className="btn btn-quiet">
              استعرض المصحف المشجّر
            </Link>
          </div>

          <dl className="mt-9 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline gap-2">
                <dt className="numeral text-h3 text-ink-900">{fact.value}</dt>
                <dd className="text-caption text-ink-400">{fact.label}</dd>
              </div>
            ))}
            <div className="flex items-baseline gap-2">
              <dt className="numeral text-h3 text-ink-900">{toArabicDigits(READING_IMAMS.length)}</dt>
              <dd className="text-caption text-ink-400">قراءات</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="numeral text-h3 text-ink-900">{toArabicDigits(NARRATORS.length)}</dt>
              <dd className="text-caption text-ink-400">راويا</dd>
            </div>
          </dl>
        </div>

        {/* لوحة المخطوط: المخطط الحقيقي للآية ٤ من الفاتحة. */}
        <Reveal className="mt-12 md:mt-14" delay={120}>
          <div className="surface-manuscript mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-manuscript-rule pb-4">
              <div className="flex items-center gap-2.5">
                <IconBranch size={18} className="text-primary-700" />
                <span className="text-label font-medium text-ink-800">لوحة التشجير</span>
                <span className="text-caption text-ink-400">
                  سورة الفاتحة — الآية {toArabicDigits(4)}
                </span>
              </div>
              {model.fromSeedData ? (
                <span className="status-badge" title="مادة أولية غير معتمدة بعد">
                  <span className="status-dot" data-status="DRAFT" />
                  مسودة أولية · قيد المراجعة العلمية
                </span>
              ) : null}
            </div>

            <HeroTashjeerDiagram model={model} />
          </div>
        </Reveal>

        <p className="mt-4 text-caption text-ink-400">
          المخطط مرسوم من مخرجات المحرك: نفس التخطيط ونفس الأسطر ونفس الرموز التي يراها
          المحقق في المحرر.
        </p>
      </div>
    </section>
  );
}

/* ================================== الشرح ================================== */

export function ExplainerSection({ model }: { model: ShowcaseAyah }) {
  return (
    <section className="border-t border-line py-section" aria-labelledby="explainer-title">
      <div className="container-editorial">
        <SectionHeading
          id="explainer-title"
          index={1}
          title="ما هو التشجير؟"
          lead="التشجير في هذا المشروع ليس خطوطا فوق نص: هو ترتيب علمي معلوم. يُضبط الموضع، ويُنسب الوجه، ويُربط الدليل، ثم يُرسم ما ثبت."
        />

        <Reveal className="mt-10">
          <TashjeerAnatomy model={model} />
        </Reveal>

        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-6">
          <p className="measure text-body-sm text-ink-500">
            تمرير المؤشر على أي بند في الشرح يُبرز طبقته في المخطط. التخفيف بالتعتيم لا
            بالإخفاء: كل طبقة تبقى ظاهرة، والمعلومات لا تُخفى أبدا.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ================================== المشكلة ================================== */

export function ProblemSection() {
  const counts = [
    { label: 'قراءات', value: READING_IMAMS.length },
    { label: 'روايات', value: NARRATORS.length },
    { label: 'طرق مسجّلة', value: TRANSMISSION_PATH_SEEDS.length },
  ];

  return (
    <section className="surface-sunken border-y border-line py-section" aria-labelledby="problem-title">
      <div className="container-editorial">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <SectionHeading
              id="problem-title"
              index={2}
              title="الاختلاف كثير، ومنظّم في أصله"
              lead="ليس المطلوب أن تُحفظ كثرة القراءات، بل أن تُنمذج نسبتها: من قرأ؟ وعن من؟ وبأي طريق؟ وفي أي حرف بالضبط؟"
            />

            <ul className="mt-8 space-y-5">
              <li className="flex gap-3">
                <IconLayers size={18} className="mt-1 shrink-0 text-brass-600" />
                <p className="measure text-body-sm text-ink-600">
                  المواضع موزّعة على المصحف كله، والاختلاف الواحد قد يقع في كلمة واحدة داخل آية
                  طويلة.
                </p>
              </li>
              <li className="flex gap-3">
                <IconRoute size={18} className="mt-1 shrink-0 text-brass-600" />
                <p className="measure text-body-sm text-ink-600">
                  النسبة لا تكفي فيها «قراءة فلان»: الرواية والطريق أدقّ مرتبة في النسبة، وقد
                  تختلف أحكام الطريق الواحد عن الآخر.
                </p>
              </li>
              <li className="flex gap-3">
                <IconSource size={18} className="mt-1 shrink-0 text-brass-600" />
                <p className="measure text-body-sm text-ink-600">
                  الهامش الورقي يحفظ المعلومة، لكنه لا يُقارَن آليا ولا يُدقَّق، ولا يمكن تتبّع
                  من عدّل ماذا ومتى.
                </p>
              </li>
            </ul>
          </div>

          {/* مروحة الأعداد: تمثيل البنية نفسها، بأرقام المشروع الحقيقية. */}
          <div className="mx-auto w-full max-w-md self-center">
            <svg viewBox="0 0 420 220" className="w-full" role="img" aria-label="بنية النسبة: قراءات ثم روايات ثم طرق">
              <g fill="none" stroke="var(--color-line-strong)" strokeWidth={1}>
                {Array.from({ length: READING_IMAMS.length }).map((_, index) => (
                  <path
                    key={index}
                    d={`M 392 ${18 + index * 18} C 330 ${18 + index * 18}, 300 ${18 + index * 9}, 258 ${
                      18 + index * 9
                    }`}
                  />
                ))}
                {Array.from({ length: NARRATORS.length }).map((_, index) => (
                  <path
                    key={`n-${index}`}
                    d={`M 246 ${9 + index * 9} C 200 ${9 + index * 9}, 180 ${18 + index * 4.5}, 138 ${
                      18 + index * 4.5
                    }`}
                    stroke="var(--color-line)"
                  />
                ))}
                {Array.from({ length: 24 }).map((_, index) => (
                  <path
                    key={`p-${index}`}
                    d={`M 126 ${9 + index * 7.5} C 90 ${9 + index * 7.5}, 70 ${18 + index * 3.75}, 28 ${
                      18 + index * 3.75
                    }`}
                    stroke="var(--color-line)"
                  />
                ))}
              </g>

              {Array.from({ length: READING_IMAMS.length }).map((_, index) => (
                <circle key={`i-${index}`} cx={392} cy={18 + index * 18} r={4} fill="var(--color-primary-600)" />
              ))}
              {Array.from({ length: NARRATORS.length }).map((_, index) => (
                <circle key={`nn-${index}`} cx={252} cy={9 + index * 9} r={2.6} fill="var(--color-ink-400)" />
              ))}
              {Array.from({ length: 24 }).map((_, index) => (
                <circle key={`pp-${index}`} cx={132} cy={9 + index * 7.5} r={1.8} fill="var(--color-ink-300)" />
              ))}

              <text x={392} y={214} textAnchor="middle" fontSize={12} fill="var(--color-ink-500)">
                {toArabicDigits(READING_IMAMS.length)} قراءات
              </text>
              <text x={252} y={214} textAnchor="middle" fontSize={12} fill="var(--color-ink-500)">
                {toArabicDigits(NARRATORS.length)} رواية
              </text>
              <text x={86} y={214} textAnchor="middle" fontSize={12} fill="var(--color-ink-500)">
                طرق
              </text>
            </svg>

            <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5">
              {counts.map((count) => (
                <div key={count.label}>
                  <dt className="text-caption text-ink-400">{count.label}</dt>
                  <dd className="numeral text-h2 text-ink-900">{toArabicDigits(count.value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-caption text-ink-400">
              الأعداد من `src/data/qiraat-data`؛ بنية الطرق تقبل مئات الطرق بالاستيراد.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================== الحل =================================== */

export function SolutionSection() {
  return (
    <section className="border-t border-line py-section" aria-labelledby="solution-title">
      <div className="container-editorial">
        <SectionHeading
          id="solution-title"
          index={3}
          title="من الاختلاف إلى التشجير"
          lead="ست مراحل ثابتة الترتيب. الخط نفسه يتحرك مع التمرير لأن الترتيب جزء من المعنى، لا تفصيل عرض."
        />

        <Reveal className="mt-14">
          <PipelineFigure />
        </Reveal>

        <p className="measure mt-10 text-caption text-ink-400">
          الترتيب هنا ليس تسلسلا زمنيا لعملك: هو ترتيب النسبة العلمية. ولذلك يبدأ تشجير الآية
          من آخرها أولا، وهو قرار محرك ثابت لا يغيّره العرض.
        </p>
      </div>
    </section>
  );
}

/** عدد المواضع المشجّرة في البذرة الأولية، يُعرض صريحا بلا تجميل. */
export const SEEDED_PLACES = SEEDED_AYAH_KEYS.length;

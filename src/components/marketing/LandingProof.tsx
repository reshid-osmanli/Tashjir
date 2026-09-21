// قصة الرئيسية (٢) — القراءات، المحرر، الدقة، الأدلة، البيانات، الخاتمة
//
// مشروع التشجير - نظام القراءات العشر
//
// كل ما هنا مبني على بيانات المشروع: الأسماء من `qiraat-data`، والأدلة من
// بذور الاختلافات، والأعداد من `mushaf.json`. لا ادّعاء بلا رقم ولا مصدر.

import Link from 'next/link';
import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { QiraatTree, type QiraatImamNode } from '@/components/visualization/QiraatTree';
import { EditorPreview } from '@/components/marketing/EditorPreview';
import { SectionHeading } from '@/components/marketing/LandingStory';
import {
  IconAnchor,
  IconArrowForward,
  IconBranch,
  IconLayers,
  IconSequence,
  IconSource,
} from '@/components/ui/icons';
import type { ShowcaseAyah } from '@/lib/tashjeer/showcase';
import { NARRATORS, READING_IMAMS, TRANSMISSION_PATH_SEEDS } from '@/data/qiraat-data/qiraat';
import { SEEDED_AYAH_KEYS } from '@/data/variants/seed-variants';
import { TOTAL_AYAHS, TOTAL_WORDS, SURAHS, MUSHAF_SOURCE } from '@/data/quran';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

/** شجرة القراءات كما هي في البيانات: عشرة أئمة، عشرون راويا، طرقهم. */
export function buildQiraatTree(): QiraatImamNode[] {
  return [...READING_IMAMS]
    .sort((a, b) => a.order - b.order)
    .map((imam) => ({
      id: imam.id,
      name: imam.name,
      order: imam.order,
      region: imam.region ?? '',
      narrators: NARRATORS.filter((narrator) => narrator.imamId === imam.id)
        .sort((a, b) => a.order - b.order)
        .map((narrator) => ({
          id: narrator.id,
          name: narrator.name,
          tayyibahOrder: narrator.legacyOrderInTayyibah ?? 0,
          paths: TRANSMISSION_PATH_SEEDS.filter((path) => path.narratorId === narrator.id).map((path) => ({
            id: path.id,
            fullName: path.fullName,
            shortName: path.fullName,
          })),
        })),
    }));
}

/* ============================== القراءات العشر ============================== */

export function QiraatSection() {
  const tree = buildQiraatTree();
  const paths = tree.reduce(
    (total, imam) => total + imam.narrators.reduce((sum, narrator) => sum + narrator.paths.length, 0),
    0
  );

  return (
    <section className="border-t border-line py-section" aria-labelledby="qiraat-title">
      <div className="container-editorial">
        <SectionHeading
          id="qiraat-title"
          index={4}
          title="القراءات العشر — بترتيبها لا بترتيب العرض"
          lead="الترتيب في هذه الشجرة هو ترتيب طيبة النشر: عشرة أئمة، ثم راويان لكل إمام، ثم الطرق. تمرير المؤشر يُبرز فرع القارئ، والنقر يثبّت الاختيار."
        />

        <Reveal className="mt-10">
          <QiraatTree imams={tree} />
        </Reveal>

        <p className="mt-6 text-caption text-ink-400">
          {toArabicDigits(READING_IMAMS.length)} قراءات · {toArabicDigits(NARRATORS.length)} رواية ·{' '}
          {toArabicDigits(paths)} طريقا مسجّلا في البيانات الحالية.
        </p>
      </div>
    </section>
  );
}

/* ================================== المحرر ================================== */

const EDITOR_NOTES = [
  {
    title: 'لوحة واحدة للحقيقة',
    note: 'اللوحة والمصحف والتتبع ترسم كلها من المستند نفسه، فلا تختلف النتيجة بين شاشة وأخرى.',
  },
  {
    title: 'الترتيب قرار محرك',
    note: 'ترتيب الأسطر وخطة الأداء تُحسب في المحرك، ولا تسمح الواجهة بقلب قاعدة «آخر الآية أولا».',
  },
  {
    title: 'كل تعديل مُتتبَّع',
    note: 'لكل مستند سجل تعديلات، ونطاق، وأصل (محرك، يدوي، قاعدة عامة)، ودرجة قوة للوجه.',
  },
];

export function EditorSection({ model }: { model: ShowcaseAyah }) {
  return (
    <section className="surface-sunken border-y border-line py-section" aria-labelledby="editor-title">
      <div className="container-editorial">
        <SectionHeading
          id="editor-title"
          index={5}
          title="مساحة العمل"
          lead="المحرر هو قلب المشروع: لوحة رسم بإحداثيات محسوبة، ولوحة خصائص، وشريط أوامر سياقي، وسجل تعديلات. الكثافة هنا مقصودة، والدقة هي الجمال."
        />

        <Reveal className="mt-10">
          {/* النموذج يُحسب على الخادم: لا تدخل بيانات المصحف في حزمة هذه الصفحة. */}
          <EditorPreview model={model} />
        </Reveal>

        <Stagger className="mt-10 grid gap-6 md:grid-cols-3" step={70}>
          {EDITOR_NOTES.map((item) => (
            <StaggerItem key={item.title} index={EDITOR_NOTES.indexOf(item)}>
              <h3 className="font-ui text-label font-medium text-ink-800">{item.title}</h3>
              <p className="mt-1.5 text-caption text-ink-500">{item.note}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ============================== الدقة العلمية ============================== */

const PRINCIPLES = [
  {
    icon: IconLayers,
    title: 'السطر = قراءة كاملة',
    note: 'السطر الواحد يجمع أحكام الراوي في الآية، كل حكم على كلمته، فلا يتوهّم القارئ أن الراوي يقرأ الآية مرات.',
  },
  {
    icon: IconAnchor,
    title: 'الاختلاف = موضع مضبوط',
    note: 'الموضع بالكلمة أو بالحرف، بمعرّفات حتمية: معرّف الكلمة يبقى هو هو مهما تغيّر العرض.',
  },
  {
    icon: IconSequence,
    title: 'الترتيب = قاعدة ثابتة',
    note: 'يبدأ التشجير من آخر الآية أولا. قاعدة محرك لا خيار عرض، فلا يُنتج ملف مقلوب سهوا.',
  },
  {
    icon: IconBranch,
    title: 'الوجه = كيان مستقل',
    note: 'الاعتماد العلمي يقع على الوجه لا على الاختلاف كله: يصحّ وجه ويُرَدّ آخر في الموضع نفسه.',
  },
  {
    icon: IconSource,
    title: 'الدليل = مرتبط بالمعلومة',
    note: 'لكل وجه مرجعه من كتب القراءات، ونصّ الدليل ومسؤوليته على المدقق البشري لا على المحرك.',
  },
];

export function AccuracySection() {
  return (
    <section className="border-t border-line py-section" aria-labelledby="accuracy-title">
      <div className="container-editorial">
        <SectionHeading
          id="accuracy-title"
          index={6}
          title="الدقة ليست مظهرا"
          lead="خمسة مبادئ تحكم النظام كله. هذه ليست شعارات: هي قواعد مفروضة في المحرك، ويظهر أثرها في كل شاشة."
        />

        <Stagger className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2" step={60}>
          {PRINCIPLES.map((principle, index) => (
            <StaggerItem key={principle.title} index={index} className="flex gap-4">
              <principle.icon size={18} className="mt-1 shrink-0 text-brass-600" />
              <div>
                <h3 className="font-ui text-label font-medium text-ink-900">{principle.title}</h3>
                <p className="measure mt-1.5 text-caption text-ink-500">{principle.note}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ================================== الأدلة ================================== */

export function EvidenceSection({ model }: { model: ShowcaseAyah }) {
  const variant = model.variant;
  if (!variant) return null;

  const base = variant.alternatives.find((alt) => alt.isBase);
  const branches = variant.alternatives.filter((alt) => !alt.isBase);
  const evidence = variant.alternatives.flatMap((alt) => alt.evidences)[0] ?? null;

  return (
    <section className="border-t border-line py-section" aria-labelledby="evidence-title">
      <div className="container-editorial">
        <SectionHeading
          id="evidence-title"
          index={7}
          title="الدليل جزء من البيانات"
          lead="لا يُعرض وجه بلا مصدره. هذه بطاقة حقيقية لموضع واحد من بيانات المشروع، بلا زيادة ولا تحسين."
        />

        <Reveal className="mt-10">
          <div className="grid gap-0 overflow-hidden rounded-xl border border-line-strong bg-card md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="border-b border-line p-6 md:border-b-0 md:border-e md:p-7">
              <p className="eyebrow">الموضع</p>
              <h3 className="mt-2 font-amiri text-h3 text-ink-900">{variant.title}</h3>
              <p className="measure mt-2 text-body-sm text-ink-600">{variant.description}</p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="chip" style={{ '--chip-color': variant.color } as React.CSSProperties}>
                  {variant.categoryLabel}
                </span>
                <span className="status-badge">
                  <span className="status-dot" data-status={variant.status} />
                  {variant.status === 'DRAFT' ? 'مسودة' : variant.status}
                </span>
                <span className="chip">
                  الكلمات {toArabicDigits(variant.startPosition)}–
                  {toArabicDigits(variant.endPosition)}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {base ? (
                  <div className="border-s-2 border-line-strong ps-3">
                    <p className="text-caption text-ink-400">المطبوع في المصحف — {base.label}</p>
                    <p className="mt-1 font-mushaf text-quran-sm text-ink-900">{base.text}</p>
                    <p className="mt-1 text-caption text-ink-500">
                      يُقرأ به: {base.readerNames.join(' · ') || 'الجمهور'}
                    </p>
                  </div>
                ) : null}

                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="border-s-2 ps-3"
                    style={{ borderColor: variant.color }}
                  >
                    <p className="text-caption text-ink-400">وجه — {branch.label}</p>
                    <p className="mt-1 font-mushaf text-quran-sm text-ink-900">{branch.text}</p>
                    <p className="mt-1 text-caption text-ink-500">
                      يُقرأ به: {branch.readerNames.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-page-alt p-6 md:p-7">
              <p className="eyebrow">السند</p>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="meta-key">المصدر المنهجي</dt>
                  <dd className="meta-value">{variant.sourceRef || 'لم يُسجّل بعد'}</dd>
                </div>
                {evidence ? (
                  <div>
                    <dt className="meta-key">موضع البحث في المصدر</dt>
                    <dd className="meta-value">{evidence.reference}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="meta-key">حالة التوثيق</dt>
                  <dd className="meta-value">
                    {variant.status === 'DRAFT' ? 'مسودة أولية — تحتاج مراجعة مجاز' : variant.status}
                  </dd>
                </div>
              </dl>

              {evidence ? (
                <blockquote className="evidence-quote mt-5">{evidence.text}</blockquote>
              ) : null}

              <p className="mt-5 text-caption text-ink-400">
                نصوص الأدلة هنا إشارات إلى مواضع البحث، وإدخال النص الحرفي مهمة المدقق البشري.
              </p>

              <Link
                href={`/editor?ayah=${model.ayahKey}`}
                className="btn btn-quiet mt-5 gap-2 text-caption"
              >
                افتح الموضع في المحرر
                <IconArrowForward size={16} />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================= البيانات ================================= */

export function DataSection() {
  const primary = [
    { value: SURAHS.length, label: 'سورة', note: 'مفهرسة بالاسم والرقم والنوع' },
    { value: TOTAL_AYAHS, label: 'آية', note: 'النص العثماني كاملا' },
    { value: TOTAL_WORDS, label: 'كلمة', note: 'لكل كلمة معرّف حتمي' },
  ];
  const secondary = [
    { value: READING_IMAMS.length, label: 'قراءات' },
    { value: NARRATORS.length, label: 'روايات' },
    { value: TRANSMISSION_PATH_SEEDS.length, label: 'طرق مسجّلة' },
    { value: SEEDED_AYAH_KEYS.length, label: 'مواضع في البذرة' },
  ];

  return (
    <section className="surface-sunken border-y border-line py-section" aria-labelledby="data-title">
      <div className="container-editorial">
        <SectionHeading
          id="data-title"
          index={8}
          title="ما في البيانات فعلا"
          lead="لا إحصاءات تجميلية: هذه أعداد الملفات نفسها، وتُقرأ من المصدر عند بناء الصفحة."
        />

        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {primary.map((item, index) => (
            <Reveal key={item.label} delay={index * 90}>
              <p className="numeral text-numeral-lg font-bold text-ink-900">
                <CountUp value={item.value} />
              </p>
              <p className="mt-1 font-amiri text-h3 text-ink-700">{item.label}</p>
              <p className="mt-1 text-caption text-ink-400">{item.note}</p>
            </Reveal>
          ))}
        </div>

        <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-line pt-6">
          {secondary.map((item) => (
            <div key={item.label}>
              <dt className="text-caption text-ink-400">{item.label}</dt>
              <dd className="numeral text-h3 text-ink-800">{toArabicDigits(item.value)}</dd>
            </div>
          ))}
        </dl>

        <p className="measure mt-6 text-caption text-ink-400">
          مصدر النص: {MUSHAF_SOURCE}. والبذرة العلمية الحالية مسودات أولية لسبعة مواضع، لا
          تُعتمد قبل مراجعة مختص مجاز ومقابلتها على المصادر.
        </p>
      </div>
    </section>
  );
}

/* ================================== الخاتمة ================================= */

export function ClosingSection() {
  return (
    <section className="py-section" aria-labelledby="closing-title">
      <div className="container-editorial">
        <div className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="closing-title" className="title-editorial text-h1">
              ابدأ من موضع واحد
            </h2>
            <p className="measure mt-3 text-body text-ink-600">
              افتح الفاتحة في المصحف، أو ادخل المحرر مباشرة. العمل يجري في متصفحك، ولا يُرفع شيء
              إلى أي جهة.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/editor" className="btn btn-primary gap-2">
                ادخل إلى المحرر
                <IconArrowForward size={18} />
              </Link>
              <Link href="/quran" className="btn btn-quiet">
                استعرض المصحف المشجّر
              </Link>
            </div>
          </div>

          {/* رسم صغير من هوية التشجير، لا زخرفة. */}
          <svg
            viewBox="0 0 180 90"
            className="h-24 w-48 text-line-strong"
            aria-hidden="true"
            role="presentation"
          >
            <g fill="none" stroke="currentColor" strokeWidth={1}>
              <path d="M170 12 C 130 12, 120 40, 84 40" />
              <path d="M170 44 C 130 44, 122 46, 84 46" stroke="var(--color-primary-600)" strokeWidth={2} />
              <path d="M170 76 C 130 76, 120 52, 84 52" />
              <path d="M84 40 C 60 40, 52 20, 24 20" />
              <path d="M84 46 C 60 46, 54 46, 24 46" stroke="var(--color-primary-600)" strokeWidth={2} />
              <path d="M84 52 C 60 52, 52 72, 24 72" />
            </g>
            <g>
              <circle cx={170} cy={12} r={3.4} fill="var(--color-ink-400)" />
              <circle cx={170} cy={44} r={3.4} fill="var(--color-primary-700)" />
              <circle cx={170} cy={76} r={3.4} fill="var(--color-ink-400)" />
              <circle cx={24} cy={20} r={2.6} fill="var(--color-ink-300)" />
              <circle cx={24} cy={46} r={2.6} fill="var(--color-primary-600)" />
              <circle cx={24} cy={72} r={2.6} fill="var(--color-ink-300)" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}

// معاينة المحرر — Editor Preview
//
// مشروع التشجير - نظام القراءات العشر
//
// غرضه: أن يرى الزائر شكل مساحة العمل قبل فتحها.
//
// قرار أداء مقصود (SPEC §152, §205): هذه المعاينة **مكوّن خادم** لا يأخذ نموذجا
// محسوبا في المتصفح، بل يستهلك `ShowcaseAyah` المبني على الخادم. السبب أن رسم
// لوحة المحرر (`TashjeerFigure`) يستعمل معالجات أحداث ومحرك التخطيط وبيانات
// المصحف كاملة، وإدخالها في حزمة العميل يُنزل ملف المصحف (نحو ١.٤ ميغابايت) في
// صفحة لا تحتاج إلا آية واحدة. اللوح المشترك (`TashjeerPlate`) يرسم المخرجات
// نفسها بلا بيانات ولا حالة، فيبقى القياس صحيحا والحزمة خفيفة.
//
// تنبيه: إطار العمل هنا للعرض فقط، ولذلك هو `aria-hidden` ولا يحمل أزرارا
// حقيقية. لا يُعرض زر لا يؤدي عملا.

import Link from 'next/link';
import { PlateLine, PlateText } from '@/components/visualization/TashjeerPlate';
import type { ShowcaseAyah } from '@/lib/tashjeer/showcase';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

const TOOLBAR_GROUPS: Array<{ label: string; commands: string[] }> = [
  { label: 'ملف', commands: ['فتح', 'حفظ', 'تصدير'] },
  { label: 'عرض', commands: ['ملاءمة', 'إطارات', 'تكبير'] },
  { label: 'تحديد', commands: ['كلمة', 'حرف', 'سطر'] },
  { label: 'ترتيب', commands: ['تقديم', 'تأخير'] },
  { label: 'أدلة', commands: ['مصدر', 'مرجع'] },
];

export function EditorPreview({ model }: { model: ShowcaseAyah }) {
  const line = model.lines[0] ?? null;
  const base = model.variant?.alternatives.find((alt) => alt.isBase) ?? null;
  const branch = model.variant?.alternatives.find((alt) => !alt.isBase) ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-ink-900/95 p-1.5 shadow-[var(--shadow-overlay)]">
      {/* إطار مساحة العمل — عرض فقط. */}
      <div className="overflow-hidden rounded-lg bg-page" aria-hidden="true">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-panel px-3 py-2">
          {TOOLBAR_GROUPS.map((group) => (
            <div
              key={group.label}
              className="flex items-center gap-2 border-e border-line pe-3 last:border-e-0"
            >
              <span className="text-micro text-ink-400">{group.label}</span>
              <span className="flex items-center gap-1">
                {group.commands.map((command) => (
                  <span key={command} className="chip">
                    {command}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_12rem]">
          <div className="viz-canvas viz-grid border-b border-line md:border-b-0 md:border-e">
            <svg
              viewBox={`${model.viewBox.x} ${model.viewBox.y} ${model.viewBox.width} ${model.viewBox.height}`}
              className="h-[13rem] w-full"
              role="presentation"
            >
              <PlateText model={model} />
              {line ? <PlateLine line={line} model={model} /> : null}
            </svg>
          </div>

          <div className="flex flex-col gap-3 bg-panel p-3">
            <div>
              <p className="meta-key">العنصر المحدد</p>
              <p className="mt-0.5 text-label text-ink-800">
                الكلمة {toArabicDigits(1)} — {model.words[0]?.text}
              </p>
            </div>
            <div className="rule-hairline" />
            <dl className="space-y-2">
              <div>
                <dt className="meta-key">الفئة</dt>
                <dd className="meta-value">{line?.categoryLabel ?? '—'}</dd>
              </div>
              <div>
                <dt className="meta-key">نص الوجه</dt>
                <dd className="meta-value font-mushaf text-body-sm">{branch?.text ?? '—'}</dd>
              </div>
              <div>
                <dt className="meta-key">المطبوع</dt>
                <dd className="meta-value font-mushaf text-body-sm">{base?.text ?? '—'}</dd>
              </div>
              <div>
                <dt className="meta-key">الرواة</dt>
                <dd className="meta-value numeral">
                  {toArabicDigits(line?.readers.length ?? 0)} إماما
                </dd>
              </div>
              <div>
                <dt className="meta-key">الأدلة</dt>
                <dd className="meta-value">{model.variant?.sourceRef || 'لم يُسجّل بعد'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel px-3 py-1.5 text-micro text-ink-500">
          <span>
            الموضع: {model.ayahRef} · الأداة: تحديد
          </span>
          <span>التخزين: محلي في هذا المتصفح</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-2.5 py-2">
        <p className="text-caption text-parchment-500">
          معاينة إطار العمل — اللوحة مبنية بمخرجات المحرك على الآية {toArabicDigits(model.ayahNumber)} من
          سورة {model.surahName}.
        </p>
        <Link
          href="/editor"
          className="btn gap-2 border border-parchment-500/40 bg-transparent text-parchment-100 hover:bg-white/10"
        >
          افتح المحرر
        </Link>
      </div>
    </div>
  );
}

// الصفحة الرئيسية — Home Page
//
// مشروع التشجير - نظام القراءات العشر
//
// الصفحة مكوّن خادم (server component): كل ما فيها ثابت ومحسوب على الخادم من
// بيانات المشروع، والجزر التفاعلية (المخطط، الشجرة، خط السير، العدّادات) وحدها
// عميلة. هذا يحفظ زمن التحميل، ويجعل المحتوى ظاهرا قبل أي حركة (SPEC §152, §204, §206).
//
// المخططات كلها حقيقية: `buildShowcase` يشغّل المحرك على آية من البذرة، ويُمرّر
// الناتج إلى الواجهة. لا إحداثي مكتوب يدويا في هذه الصفحة (SPEC §127, §128).

import { makeAyahKey } from '@/data/quran';
import { buildShowcase } from '@/lib/tashjeer/showcase';
import { PublicHeader } from '@/components/marketing/PublicHeader';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { RevealStyles } from '@/components/motion/Reveal';
import {
  ExplainerSection,
  HeroSection,
  ProblemSection,
  SolutionSection,
} from '@/components/marketing/LandingStory';
import {
  AccuracySection,
  ClosingSection,
  DataSection,
  EditorSection,
  EvidenceSection,
  QiraatSection,
} from '@/components/marketing/LandingProof';

/**
 * المثال المعروض: سورة الفاتحة، الآية ٤ — «مَٰلِكِ يَوۡمِ ٱلدِّينِ».
 *
 * اختير لعلمه لا لشكله: الموضع في أول كلمة، فالمخطط يوضح العلاقة بوضوح،
 * والقراء به ستة أئمة معروفون بترتيبهم، والموضع من أشهر مواضع الفرش.
 */
const SHOWCASE_KEY = makeAyahKey(1, 4);

export default function HomePage() {
  const model = buildShowcase(SHOWCASE_KEY, {
    fontSize: 40,
    paddingLeft: 30,
    paddingRight: 30,
    singleLine: true,
  });

  if (!model) {
    // لا ينبغي أن يقع: المعرّف ثابت في البيانات. الاحتياط رسالة واضحة لا صفحة فارغة.
    return (
      <main className="container-reading py-section" dir="rtl">
        <h1 className="title-editorial text-h1">تعذّر تجهيز بيانات العرض</h1>
        <p className="mt-3 text-body text-ink-600">
          لم يُعثر على الآية المطلوبة في بيانات المصحف. تحقّق من مصدر البيانات ثم أعد بناء الصفحة.
        </p>
      </main>
    );
  }

  return (
    <>
      <RevealStyles />
      <PublicHeader />

      <main id="main">
        <HeroSection model={model} />
        <ExplainerSection model={model} />
        <ProblemSection />
        <SolutionSection />
        <QiraatSection />
        <EditorSection model={model} />
        <AccuracySection />
        <EvidenceSection model={model} />
        <DataSection />
        <ClosingSection />
      </main>

      <PublicFooter />
    </>
  );
}

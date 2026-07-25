// الصفحة الرئيسية - Home Page
// مشروع التشجير - نظام القراءات العشر

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white" dir="rtl">
      {/* الترويسة */}
      <header className="bg-white shadow-sm border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-2xl font-bold">ت</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">مشروع التشجير</h1>
                <p className="text-sm text-gray-500">نظام القراءات العشر</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/login"
                className="px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                تسجيل الدخول
              </Link>
              <Link
                href="/editor"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                المحرر
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* القسم الرئيسي */}
        <section className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            تشجير القراءات العشر
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            منصة احترافية لتشجير القراءات العشر من طريق الطيبة والنشر،
            مع محرر بصري ذكي يفهم النص القرآني والحركات والأحكام التجويدية
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/editor"
              className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-lg font-medium"
            >
              ابدأ التشجير
            </Link>
            <Link
              href="/quran"
              className="px-8 py-3 bg-white text-emerald-600 border-2 border-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors text-lg font-medium"
            >
              عرض المصحف
            </Link>
          </div>
        </section>

        {/* المميزات */}
        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <FeatureCard
            title="محرر بصري ذكي"
            description="محرر احترافي يرسم خطوط التشجير تلقائياً مع فهم كامل للحركات والأحكام التجويدية"
            icon="✍️"
          />
          <FeatureCard
            title="نظام الأدلة"
            description="ربط كل اختلاف بدليله من الطيبة والنشر مع إمكانية الانتقال للمصدر"
            icon="📚"
          />
          <FeatureCard
            title="مراجعة العلماء"
            description="نظام تقييم وتصحيح من العلماء المجازين مع تتبع المراجعات"
            icon="👨‍🏫"
          />
        </section>

        {/* القراءات العشر */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-16">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            القراءات العشر حسب ترتيب طيبة النشر
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {qiraatList.map((qiraah, index) => (
              <div
                key={index}
                className="bg-amber-50 rounded-lg p-4 text-center border border-amber-200"
              >
                <div className="text-2xl font-bold text-emerald-600 mb-1">
                  {index + 1}
                </div>
                <div className="font-medium text-gray-900">{qiraah.narrator}</div>
                <div className="text-sm text-gray-500">عن {qiraah.qari}</div>
              </div>
            ))}
          </div>
        </section>

        {/* إحصائيات */}
        <section className="grid md:grid-cols-4 gap-6">
          <StatCard number="6236" label="آية قرآنية" />
          <StatCard number="77434" label="كلمة" />
          <StatCard number="20" label="رواية معتمدة" />
          <StatCard number="40" label="طريق موثق" />
        </section>
      </main>

      {/* التذييل */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            مشروع التشجير - نظام القراءات العشر
          </p>
          <p className="text-sm text-gray-500 mt-2">
            من طريق الطيبة والنشر للإمام ابن الجزري
          </p>
        </div>
      </footer>
    </div>
  );
}

// مكون بطاقة الميزة
function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

// مكون بطاقة الإحصائية
function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 text-center border border-gray-100">
      <div className="text-3xl font-bold text-emerald-600 mb-1">{number}</div>
      <div className="text-gray-600">{label}</div>
    </div>
  );
}

// قائمة القراءات العشر
const qiraatList = [
  { narrator: 'قالون', qari: 'نافع' },
  { narrator: 'ورش', qari: 'نافع' },
  { narrator: 'البزي', qari: 'ابن كثير' },
  { narrator: 'قنبل', qari: 'ابن كثير' },
  { narrator: 'الدوري', qari: 'أبو عمرو' },
  { narrator: 'السوسي', qari: 'أبو عمرو' },
  { narrator: 'هشام', qari: 'ابن عامر' },
  { narrator: 'ابن ذكوان', qari: 'ابن عامر' },
  { narrator: 'حفص', qari: 'عاصم' },
  { narrator: 'شعبة', qari: 'عاصم' },
  { narrator: 'خلف', qari: 'حمزة' },
  { narrator: 'خلاد', qari: 'حمزة' },
  { narrator: 'الليث', qari: 'الكسائي' },
  { narrator: 'الدوري', qari: 'الكسائي' },
  { narrator: 'ابن وردان', qari: 'أبو جعفر' },
  { narrator: 'ابن جماز', qari: 'أبو جعفر' },
  { narrator: 'رويس', qari: 'يعقوب' },
  { narrator: 'روح', qari: 'يعقوب' },
  { narrator: 'إدريس', qari: 'خلف' },
  { narrator: 'إسحاق', qari: 'خلف' },
];

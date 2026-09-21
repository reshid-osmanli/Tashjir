// التذييل العام — Public Footer
//
// مشروع التشجير - نظام القراءات العشر
//
// هادئ وصغير (SPEC §36): هوية، وروابط حقيقية، وسطر عن مصدر البيانات.
// لا بطاقات، ولا نشرة بريدية، ولا أعمدة أربعة للمظهر.

import Link from 'next/link';
import { TashjirMark } from '@/components/brand/TashjirMark';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { TOTAL_AYAHS, TOTAL_WORDS, MUSHAF_SOURCE } from '@/data/quran';

const COLUMNS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: 'العمل',
    links: [
      { href: '/editor', label: 'المحرر' },
      { href: '/studio', label: 'استوديو المحرك' },
      { href: '/tracking', label: 'التتبع' },
      { href: '/variants', label: 'فهرس الاختلافات' },
    ],
  },
  {
    title: 'المعرفة',
    links: [
      { href: '/quran', label: 'المصحف' },
      { href: '/qiraat', label: 'القراءات العشر' },
      { href: '/readers', label: 'القراء والرواة' },
      { href: '/statistics', label: 'الإحصاءات' },
    ],
  },
  {
    title: 'النظام',
    links: [
      { href: '/review', label: 'المراجعة' },
      { href: '/settings', label: 'الإعدادات' },
      { href: '/admin', label: 'لوحة التحكم' },
      { href: '/login', label: 'الحساب' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="surface-sunken border-t border-line">
      <div className="container-editorial py-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <span className="inline-flex items-center gap-2.5">
              <TashjirMark size={26} className="text-primary-700" />
              <span className="font-amiri text-[1.0625rem] font-bold text-ink-900">التشجير</span>
            </span>
            <p className="mt-3 max-w-xs text-caption text-ink-500">
              نمذجة مواضع الاختلاف القرائي وعرضها في صورة قابلة للتدقيق: النص العثماني، ثم موضع
              الاختلاف، ثم سطر الوجه، ثم رموز القراء.
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-400">
              <div className="flex items-center gap-1.5">
                <dt>آيات</dt>
                <dd className="numeral text-ink-600">{toArabicDigits(TOTAL_AYAHS)}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt>كلمات</dt>
                <dd className="numeral text-ink-600">{toArabicDigits(TOTAL_WORDS)}</dd>
              </div>
            </dl>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="font-ui text-label font-medium text-ink-800">{column.title}</h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-caption text-ink-500 transition-colors hover:text-primary-700"
                      style={{ transitionDuration: 'var(--motion-fast)' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-caption text-ink-400">
          <p>مشروع التشجير — نظام القراءات العشر</p>
          <p>مصدر النص: {MUSHAF_SOURCE}</p>
        </div>
      </div>
    </footer>
  );
}

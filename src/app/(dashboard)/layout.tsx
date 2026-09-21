// هيكل مساحة العمل — Workspace Shell
//
// مشروع التشجير - نظام القراءات العشر
//
// مكوّن خادم: التنقّل ثابت ولا يحتاج حالة (SPEC §204). الجلسة وحدها جزيرة
// عميلة صغيرة لأنها تُقرأ من تخزين المتصفح.
//
// البنية: شريط جانبي ثابت في الجهة الابتدائية (RTL: اليمين)، ومحتوى يتنفّس
// بمسافة كافية. لا شعار صاخب ولا حقل بحث غير موصول.

import Link from 'next/link';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialogHost';
import { SessionBadge } from '@/components/layout/SessionBadge';
import { TashjirMark } from '@/components/brand/TashjirMark';
import {
  IconAudit,
  IconBranch,
  IconChart,
  IconEditor,
  IconGauge,
  IconIndex,
  IconLayers,
  IconMushaf,
  IconReader,
  IconSettings,
  IconSource,
  IconVerified,
} from '@/components/ui/icons';
import type { IconProps } from '@/components/ui/icons';

interface NavItem {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'العمل',
    items: [
      { href: '/editor', label: 'المحرر', icon: IconEditor },
      { href: '/studio', label: 'استوديو المحرك', icon: IconGauge },
      { href: '/variants', label: 'فهرس الاختلافات', icon: IconLayers },
      { href: '/tracking', label: 'التتبع', icon: IconAudit },
    ],
  },
  {
    title: 'المعرفة',
    items: [
      { href: '/quran', label: 'المصحف', icon: IconMushaf },
      { href: '/qiraat', label: 'القراءات', icon: IconReader },
      { href: '/readers', label: 'القراء والرواة', icon: IconIndex },
    ],
  },
  {
    title: 'النظام',
    items: [
      { href: '/review', label: 'المراجعة', icon: IconVerified },
      { href: '/statistics', label: 'الإحصاءات', icon: IconChart },
      { href: '/admin', label: 'لوحة التحكم', icon: IconSettings },
      { href: '/settings', label: 'الإعدادات', icon: IconSource },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-page">
      <aside className="fixed inset-y-0 start-0 z-sticky hidden w-60 border-e border-line bg-panel lg:block">
        <div className="flex h-[var(--layout-header)] items-center border-b border-line px-4">
          <Link href="/" className="flex items-center gap-2.5 rounded-md" aria-label="التشجير — الرئيسية">
            <TashjirMark size={22} className="text-primary-700" />
            <span className="font-amiri text-[1rem] font-bold text-ink-900">التشجير</span>
          </Link>
        </div>

        <nav aria-label="التنقل" className="tashjeer-scroll-area h-[calc(100dvh-var(--layout-header))] overflow-y-auto px-2 py-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-label text-ink-600 transition-colors hover:bg-hover hover:text-ink-900"
            style={{ transitionDuration: 'var(--motion-fast)' }}
          >
            <IconBranch size={18} className="text-ink-400" />
            الرئيسية
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mt-4">
              <p className="px-2.5 pb-1 text-micro font-medium text-ink-400">{group.title}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-label text-ink-700 transition-colors hover:bg-hover hover:text-ink-900"
                      style={{ transitionDuration: 'var(--motion-fast)' }}
                    >
                      <item.icon size={18} className="text-ink-400" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:ms-60">
        <header className="sticky top-0 z-sticky border-b border-line bg-panel/92 backdrop-blur-sm">
          <div className="flex h-[var(--layout-header)] items-center justify-between gap-3 px-4 md:px-6">
            <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="التشجير — الرئيسية">
              <TashjirMark size={20} className="text-primary-700" />
              <span className="font-amiri font-bold text-ink-900">التشجير</span>
            </Link>

            <p className="hidden text-caption text-ink-400 lg:block">
              كل التعديلات تُحفظ محليا في هذا المتصفح.
            </p>

            <div className="flex items-center gap-2">
              <Link href="/quran" className="btn btn-ghost gap-2 text-caption">
                <IconMushaf size={16} />
                المصحف
              </Link>
              <SessionBadge />
            </div>
          </div>

          {/* تنقّل الجوال: شريط أفقي مختصر بدل أعمدة مضغوطة (SPEC §99-100). */}
          <nav aria-label="التنقل" className="lg:hidden">
            <ul className="tashjeer-scroll-area flex gap-1.5 overflow-x-auto border-t border-line px-3 py-2">
              {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className="flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1.5 text-caption text-ink-600"
                  >
                    <item.icon size={16} className="text-ink-400" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main id="main" className="p-4 md:p-6">
          {children}
        </main>
      </div>

      <ConfirmDialogHost />
    </div>
  );
}

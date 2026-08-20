import Link from 'next/link';

const navItems = [
  { href: '/', icon: '⌂', label: 'الرئيسية' },
  { href: '/editor', icon: '✎', label: 'المحرر' },
  { href: '/quran', icon: 'ق', label: 'المصحف' },
  { href: '/variants', icon: '⌕', label: 'فهرس الاختلافات' },
  { href: '/tracking', icon: '⇄', label: 'التتبع' },
  { href: '/qiraat', icon: 'ع', label: 'القراءات' },
  { href: '/review', icon: '✓', label: 'المراجعة' },
  { href: '/readers', icon: 'ر', label: 'القراء' },
  { href: '/statistics', icon: '#', label: 'الإحصاءات' },
  { href: '/admin', icon: '⌘', label: 'لوحة التحكم' },
  { href: '/settings', icon: '⚙', label: 'الإعدادات' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <aside className="fixed right-0 top-0 z-30 hidden h-full w-64 border-l border-gray-200 bg-white shadow-lg md:block">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600">
              <span className="text-xl font-bold text-white">ت</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">التشجير</h1>
              <p className="text-xs text-gray-500">نظام القراءات العشر</p>
            </div>
          </Link>
        </div>

        <nav className="space-y-2 px-4">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </aside>

      <main className="md:mr-64">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
            <div className="w-full md:w-auto">
              <input
                type="text"
                placeholder="بحث في القرآن..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-80"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" type="button">
                تنبيه
              </button>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600">
                  <span className="text-sm text-white">أ</span>
                </div>
                <span className="text-sm font-medium text-gray-700">أحمد</span>
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t border-gray-100 px-4 py-2 md:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                <span className="font-bold">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </header>

        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
    >
      <span className="flex h-6 w-6 items-center justify-center text-sm font-bold">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

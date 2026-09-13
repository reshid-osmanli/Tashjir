// هيكل الصفحات: القائمة الجانبية والترويسة ومنطقة المحتوى
//
// نُقل هذا الهيكل من `app/(dashboard)/layout.tsx` إلى مكوّن عميل لسبب واحد:
// قائمة التطبيق الجانبية صارت لوحة من لوحات وضع الإخفاء (FR-ED-12). وعلى
// شاشة ١٣٦٦×٧٦٨ — فضلًا عن لوح ١٠٢٤×٦٢٥ — تأكل القائمة ٢٥٦px من عرض المحرر
// قبل أن تبدأ اللوحات، فانطواؤها جزء من «كل لوحة قابلة للإخفاء» (NFR-03).
//
// سلوكها عند الإخفاء التلقائي يختلف عن لوحات المحرر اختلافًا مقصودًا: لا
// تختفي تمامًا بل **تنطوي إلى شريط رفيع** (٥٦px) بأيقونات الصفحات، ويتمدد
// فوق المحتوى عند المرور عليه أو نقره. والسبب أن التنقل بين الصفحات وظيفة
// أساسية لا يجوز أن تُفقد، بينما الشريط الرفيع يترك للقارئ قرار البقاء فيه.
// والتمدد طبقة فوقية (`absolute`) فلا يزحزح المحتوى — القاعدة نفسها التي
// تحكم لوحات المحرر.

'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePanelStore } from '@/stores/panel-store';
import { panelPlacement } from '@/lib/ui/panel-layout';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialogHost';

const navItems = [
  { href: '/', icon: '⌂', label: 'الرئيسية' },
  { href: '/editor', icon: '✎', label: 'المحرر' },
  { href: '/studio', icon: 'Ɇ', label: 'استوديو المحرك' },
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

export function AppShell({ children }: { children: ReactNode }) {
  const placement = usePanelStore((state) => panelPlacement(state.prefs, 'appnav'));
  const setPanelVisible = usePanelStore((state) => state.setPanelVisible);
  const setPanelPinned = usePanelStore((state) => state.setPanelPinned);
  const [expanded, setExpanded] = useState(false);

  const hidden = placement === 'hidden';
  const collapsed = placement === 'overlay';

  const mainMargin = hidden ? '' : collapsed ? 'md:mr-14' : 'md:mr-64';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {!hidden && (
        <aside
          className={`fixed right-0 top-0 z-30 hidden h-full border-l border-gray-200 bg-white shadow-lg transition-[width] duration-200 md:block ${
            collapsed ? 'w-14' : 'w-64'
          }`}
          onPointerEnter={collapsed ? () => setExpanded(true) : undefined}
          onPointerLeave={collapsed ? () => setExpanded(false) : undefined}
          aria-label="قائمة التطبيق"
        >
          {collapsed ? (
            <>
              {/* الشريط الرفيع: أيقونات الصفحات، ويُبقي اللوحة قابلة للتثبيت. */}
              <div
                className={`flex h-full flex-col items-center gap-1 overflow-y-auto py-3 transition-opacity ${
                  expanded ? 'pointer-events-none opacity-0' : 'opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  title="قائمة التطبيق (منطوية — مرّر أو انقر للتمديد)"
                  aria-expanded={expanded}
                  className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg font-bold text-white"
                >
                  ت
                </button>
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    {item.icon}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => setPanelPinned('appnav', true)}
                  title="تثبيت قائمة التطبيق: تعود بعرضها الكامل"
                  className="mt-2 flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-xs text-stone-500 hover:bg-stone-50"
                >
                  📌
                </button>
              </div>

              {/* القائمة المتمددة: طبقة فوقية لا تزحزح المحتوى. */}
              <div
                className={`absolute inset-y-0 right-0 w-64 border-l border-gray-200 bg-white shadow-2xl transition-transform duration-200 ${
                  expanded ? 'translate-x-0' : 'pointer-events-none translate-x-full'
                }`}
                aria-hidden={!expanded}
                inert={!expanded}
              >
                <NavContent onNavigate={() => setExpanded(false)} />
              </div>
            </>
          ) : (
            <div className="contents">
              <NavContent />
            </div>
          )}
        </aside>
      )}

      <main className={mainMargin}>
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
              {hidden && (
                <button
                  type="button"
                  onClick={() => setPanelVisible('appnav', true)}
                  className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
                  title="إظهار قائمة التطبيق الجانبية"
                >
                  القائمة
                </button>
              )}
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
      <ConfirmDialogHost />
    </div>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
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
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </nav>
    </>
  );
}

function NavLink({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: string;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
    >
      <span className="flex h-6 w-6 items-center justify-center text-sm font-bold">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

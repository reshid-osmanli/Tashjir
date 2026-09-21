// الترويسة العامة — Public Header
//
// مشروع التشجير - نظام القراءات العشر
//
// وصفها: رقيقة، ورقيّة، هادئة (SPEC §37-38).
//   - في أعلى الصفحة: شفافة على الرقّ.
//   - بعد التمرير: سطح دافئ صلب بحدّ شعرة وظل خفيف، بانتقال سريع (160ms).
//
// لا يوجد فيها بحث غير موصول ولا اسم مستخدم مُصطنع: كل عنصر فيها يقود إلى
// صفحة موجودة فعلا، أو لا يكون.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TashjirWordmark } from '@/components/brand/TashjirMark';
import { IconAccount, IconClose, IconMenu } from '@/components/ui/icons';

const NAV_ITEMS = [
  { href: '/editor', label: 'المحرر' },
  { href: '/quran', label: 'المصحف' },
  { href: '/tracking', label: 'التتبع' },
  { href: '/qiraat', label: 'القراءات' },
];

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-sticky transition-colors ${
        scrolled
          ? 'border-b border-line bg-panel/94 backdrop-blur-md supports-[backdrop-filter]:bg-panel/86'
          : 'border-b border-transparent bg-transparent'
      }`}
      style={{ transitionDuration: 'var(--motion-fast)' }}
    >
      <div className="container-editorial flex h-[var(--layout-header)] items-center justify-between gap-4">
        <Link href="/" className="rounded-md py-1" aria-label="مشروع التشجير — الصفحة الرئيسية">
          <TashjirWordmark size={26} />
        </Link>

        <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-label text-ink-600 transition-colors hover:bg-hover hover:text-ink-900"
              style={{ transitionDuration: 'var(--motion-fast)' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link href="/login" className="btn btn-ghost hidden gap-2 md:inline-flex" title="الحساب">
            <IconAccount size={18} />
            <span>الحساب</span>
          </Link>
          <Link href="/editor" className="btn btn-primary">
            ادخل المحرر
          </Link>
          <button
            type="button"
            className="btn btn-ghost px-2 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="public-nav-mobile"
            aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="public-nav-mobile"
          aria-label="التنقل الرئيسي"
          className="border-t border-line bg-panel px-4 pb-4 pt-2 md:hidden"
        >
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2.5 text-body-sm text-ink-700 hover:bg-hover"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/login"
                className="block rounded-md px-3 py-2.5 text-body-sm text-ink-700 hover:bg-hover"
                onClick={() => setMenuOpen(false)}
              >
                الحساب
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

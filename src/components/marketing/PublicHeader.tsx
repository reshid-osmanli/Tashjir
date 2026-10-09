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

// Immutable UI identity tables. Keys denote finite controls, never row positions.
const UI_PublicHeader_0 = {
  "المحرر": "A1644",
  "المصحف": "A1645",
  "التتبع": "A1646",
  "القراءات": "A1647"
} as const;

const UI_PublicHeader_1 = {
  "المحرر": "A1653",
  "المصحف": "A1654",
  "التتبع": "A1655",
  "القراءات": "A1656"
} as const;

const UI_PublicHeader_2 = {
  "المحرر": "A1657",
  "المصحف": "A1658",
  "التتبع": "A1659",
  "القراءات": "A1660"
} as const;



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
      data-ui-id="A291"
      className={`sticky top-0 z-sticky transition-colors ${
        scrolled
          ? 'border-b border-line bg-panel/94 backdrop-blur-md supports-[backdrop-filter]:bg-panel/86'
          : 'border-b border-transparent bg-transparent'
      }`}
      style={{ transitionDuration: 'var(--motion-fast)' }}
    >
      <div className="container-editorial flex h-[var(--layout-header)] items-center justify-between gap-4">
        <Link data-ui-id="A1642" href="/" className="rounded-md py-1" aria-label="مشروع التشجير — الصفحة الرئيسية">
          <TashjirWordmark size={26} />
        </Link>

        <nav data-ui-id="A1643" aria-label="التنقل الرئيسي" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link data-ui-id={UI_PublicHeader_0[item.label as keyof typeof UI_PublicHeader_0]}
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
          <Link data-ui-id="A1648" href="/login" className="btn btn-ghost hidden gap-2 md:inline-flex" title="الحساب">
            <IconAccount size={18} />
            <span>الحساب</span>
          </Link>
          <Link data-ui-id="A1649" href="/editor" className="btn btn-primary">
            ادخل المحرر
          </Link>
          <button data-ui-id="A1650"
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
        <nav data-ui-id="A1651"
          id="public-nav-mobile"
          aria-label="التنقل الرئيسي"
          className="border-t border-line bg-panel px-4 pb-4 pt-2 md:hidden"
        >
          <ul data-ui-id="A1652" className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li data-ui-id={UI_PublicHeader_1[item.label as keyof typeof UI_PublicHeader_1]} key={item.href}>
                <Link data-ui-id={UI_PublicHeader_2[item.label as keyof typeof UI_PublicHeader_2]}
                  href={item.href}
                  className="block rounded-md px-3 py-2.5 text-body-sm text-ink-700 hover:bg-hover"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li data-ui-id="A1661">
              <Link data-ui-id="A1662"
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

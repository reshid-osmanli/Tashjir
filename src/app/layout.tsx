// التخطيط الجذري — Root Layout
// مشروع التشجير - نظام القراءات العشر
//
// الخطوط والألوان والأسطح تُعرَّف مرة واحدة في globals.css، ويُحمَّل الجذر
// بالعربية واتجاه RTL. لا مكتبة حركة تُحمَّل هنا: الأنماط تكفي (SPEC §207).

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'التشجير — نظام القراءات العشر',
  description:
    'نمذجة مواضع الاختلاف القرائي وعرضها في صورة قابلة للتدقيق: النص العثماني، ثم موضع الاختلاف، ثم سطر الوجه، ثم رموز القراء.',
  keywords: ['تشجير', 'قراءات عشر', 'قرآن', 'طيبة النشر', 'ابن الجزري', 'النشر في القراءات العشر'],
  applicationName: 'التشجير',
};

export const viewport: Viewport = {
  themeColor: '#fbf9f4',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh bg-page font-ui text-ink antialiased">
        <a
          href="#main"
          className="sr-only-focusable absolute start-4 top-3 z-toast rounded-md border border-line-strong bg-panel px-3 py-1.5 text-label text-ink-800"
        >
          تجاوز إلى المحتوى
        </a>
        {children}
      </body>
    </html>
  );
}

// التخطيط الرئيسي - Root Layout
// مشروع التشجير - نظام القراءات العشر

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مشروع التشجير - نظام القراءات العشر',
  description: 'منصة احترافية لتشجير القراءات العشر من طريق الطيبة والنشر',
  keywords: ['تشجير', 'قراءات عشر', 'قرآن', 'طيبة النشر', 'ابن الجزري'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased bg-amber-50">
        {children}
      </body>
    </html>
  );
}

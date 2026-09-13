// تخطيط صفحات لوحة القيادة
//
// الهيكل نفسه (القائمة الجانبية، الترويسة، منطقة المحتوى) في مكوّن عميل واحد
// `AppShell`، لأن القائمة الجانبية صارت لوحة من لوحات وضع الإخفاء (FR-ED-12)
// ولا يستطيع مكوّن خادم قراءة تفضيل اللوحات من المتصفح.

import { AppShell } from '@/components/layout/AppShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}

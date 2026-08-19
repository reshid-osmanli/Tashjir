// إعدادات الاختبارات - Vitest Configuration
// مشروع التشجير - نظام القراءات العشر
//
// الاختبارات تغطي منطق المجال (المصحف، النطاقات، التخطيط، محرك التشجير).
// هذه الطبقات نقية ولا تحتاج DOM، فالبيئة node أسرع وأدق للتحقق منها.
//
// ومكوّنات الرسم نقية كذلك (SVG بلا حالة)، فتُولَّد نصا على الخادم ويُتحقق
// من ناتجها. لذلك نصرّح بتحويل JSX التلقائي: tsconfig يترك JSX لـ Next،
// وesbuild في الاختبارات يحتاج التصريح وإلا طلب React عاما في كل ملف.

import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
});

// إعدادات الاختبارات - Vitest Configuration
// مشروع التشجير - نظام القراءات العشر
//
// الاختبارات تغطي منطق المجال (المصحف، النطاقات، التخطيط، محرك التشجير).
// هذه الطبقات نقية ولا تحتاج DOM، فالبيئة node أسرع وأدق للتحقق منها.

import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
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

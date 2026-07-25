// عميل قاعدة البيانات - Database Client
// مشروع التشجير - نظام القراءات العشر

import { PrismaClient } from '@prisma/client';

// إنشاء عميل Prisma مع التخزين المؤقت في التطوير
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

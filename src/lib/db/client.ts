// عميل قاعدة البيانات - Database Client
// مشروع التشجير - نظام القراءات العشر

import { PrismaClient } from '@prisma/client';

// على الاستضافة/المعاينة قد لا يكون DATABASE_URL مضبوطًا بعد (التخزين حاليًّا localStorage).
// Prisma 6 يرمي عند البناء إن فُقد المتغيّر حتى لو لم يُستعمل العميل؛ نوفّر قيمة وهمية
// للبناء فقط، والاتصال الحقيقي يُفعّل عند ضبط المتغير في بيئة الاستضافة.
const FALLBACK_DATABASE_URL = 'postgresql://user:password@localhost:5432/tashjeer?schema=public';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = FALLBACK_DATABASE_URL;
}

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

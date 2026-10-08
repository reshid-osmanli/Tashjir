// إعدادات Next.js - Next.js Configuration
// مشروع التشجير - نظام القراءات العشر

/** @type {import('next').NextConfig} */
const nextConfig = {
  // تفعيل React Strict Mode
  reactStrictMode: true,
  // Arena live previews use a proxied origin; allow *.e2b.app in dev.
  allowedDevOrigins: ['*.e2b.app', '127.0.0.1'],

  // إعدادات الصور
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // على الاستضافة: لا توقف البناء بسبب تحذيرات ESLint (الأنواع تُفحص عبر tsc).
  // lint نفسها ستبقى متاحة عبر `npm run lint` محليًا.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // لا تتجاهل أخطاء الأنواع — الفحص الحقيقي يبقى في tsc/typecheck.

  // إعدادات الأمان — X-Frame-Options أُزيلت ليتاح تضمين المعاينة المباشرة
  // في متصفح المنصة (https://{port}-{sandbox}.e2b.app). لإنتاجٍ يقيّد التضمين
  // يُفضّل استخدام CSP frame-ancestors بدل حظر عامّ.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

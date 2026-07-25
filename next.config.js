// إعدادات Next.js - Next.js Configuration
// مشروع التشجير - نظام القراءات العشر

/** @type {import('next').NextConfig} */
const nextConfig = {
  // تفعيل React Strict Mode
  reactStrictMode: true,

  // إعدادات الصور
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // إعدادات الأمان
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
            key: 'X-Frame-Options',
            value: 'DENY',
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

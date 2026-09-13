// إعدادات Next.js - Next.js Configuration
// مشروع التشجير - نظام القراءات العشر

/** @type {import('next').NextConfig} */
const nextConfig = {
  // تفعيل React Strict Mode
  reactStrictMode: true,
  // Arena live previews use a proxied origin; production embedding stays blocked.
  allowedDevOrigins: ['*.e2b.app', '127.0.0.1'],

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
          ...(process.env.NODE_ENV === 'production' ? [{ key: 'X-Frame-Options', value: 'DENY' }] : []),
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

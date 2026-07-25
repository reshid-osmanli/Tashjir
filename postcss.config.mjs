// إعدادات PostCSS - PostCSS Configuration
// مشروع التشجير - نظام القراءات العشر
//
// Tailwind CSS 4 يعتمد على إضافة @tailwindcss/postcss بدل الإضافة القديمة.
// بدون هذا الملف كانت توجيهات @tailwind في globals.css تمر كما هي دون معالجة،
// فتظهر الواجهة بلا أي تنسيق.

const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;

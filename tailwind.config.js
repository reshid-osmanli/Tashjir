// إعدادات Tailwind CSS - Tailwind Configuration
// مشروع التشجير - نظام القراءات العشر

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // الخطوط
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mushaf: ['UthmanicHafs', 'Amiri', 'serif'],
        amiri: ['Amiri', 'serif'],
      },

      // الألوان
      colors: {
        // ألوان المشروع الرئيسية
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        secondary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // ألوان المصحف
        mushaf: {
          background: '#fefce8',
          border: '#d97706',
          text: '#1e293b',
        },
        // ألوان التشجير
        tashjeer: {
          usul: '#22c55e',
          farsh: '#3b82f6',
          madud: '#f97316',
        },
      },

      // أحجام الخطوط
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        'mushaf': '1.5rem',
      },

      // المسافات
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      // الظلال
      boxShadow: {
        'mushaf': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'popup': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },

      // الحدود
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },

      // الحركات
      animation: {
        'fade-in': 'fadeIn 0.2s ease',
        'slide-up': 'slideUp 0.3s ease',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

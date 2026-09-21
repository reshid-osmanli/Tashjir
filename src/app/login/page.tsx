// صفحة الدخول — Login Page
//
// مشروع التشجير - نظام القراءات العشر
//
// ليست صفحة تسويقية (SPEC §68): بطاقة واحدة هادئة على سطح رقّي، وخلفية بسيطة
// مشتقّة من شكل التشجير (فرع واحد)، بلا صور ولا شعارات كبيرة.
//
// ملاحظة صريحة للمستخدم: الدخول هنا **محلي في هذا المتصفح** — لا حساب على
// خادم. قول ذلك صراحة أصدق من إيحاء بحساب قائم (SPEC §179).

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TashjirMark } from '@/components/brand/TashjirMark';
import { IconArrowForward } from '@/components/ui/icons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 4) {
      setError('أدخل بريدًا إلكترونيًا وكلمة مرور من أربعة أحرف على الأقل.');
      return;
    }

    localStorage.setItem(
      'tashjeer-session',
      JSON.stringify({ email, signedInAt: new Date().toISOString() })
    );
    router.push('/editor');
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      {/* خلفية مشتقّة من شكل التشجير: فروع شبه غير مرئية. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-line"
        aria-hidden="true"
        role="presentation"
        preserveAspectRatio="none"
        viewBox="0 0 600 400"
      >
        <g fill="none" stroke="currentColor" strokeWidth={1}>
          <path d="M600 40 C 420 40, 400 140, 300 140" />
          <path d="M600 200 C 420 200, 400 200, 300 200" />
          <path d="M600 360 C 420 360, 400 260, 300 260" />
          <path d="M300 140 C 200 140, 160 70, 40 70" />
          <path d="M300 200 C 200 200, 160 200, 40 200" />
          <path d="M300 260 C 200 260, 160 330, 40 330" />
        </g>
      </svg>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <TashjirMark size={40} className="text-primary-700" />
          <h1 className="mt-4 font-amiri text-h2 text-ink-900">التشجير</h1>
          <p className="mt-1 text-caption text-ink-500">نظام القراءات العشر</p>
        </div>

        <div className="surface-manuscript px-6 py-6">
          <h2 className="font-ui text-label font-medium text-ink-800">دخول</h2>
          <p className="mt-1 text-caption text-ink-500">
            الحساب محلي في هذا المتصفح؛ لا يُرسل شيء إلى أي جهة.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-line-strong bg-danger-bg px-3 py-2 text-caption text-danger"
              >
                {error}
              </p>
            ) : null}

            <div>
              <label htmlFor="login-email" className="meta-key">
                البريد الإلكتروني
              </label>
              <input
                id="login-email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input mt-1.5 text-start"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="meta-key">
                كلمة المرور
              </label>
              <input
                id="login-password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input mt-1.5 text-start"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full gap-2">
              ادخل إلى مساحة العمل
              <IconArrowForward size={18} />
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-caption">
            <Link href="/" className="text-ink-500 hover:text-primary-700">
              العودة إلى الرئيسية
            </Link>
            <Link href="/editor" className="text-ink-500 hover:text-primary-700">
              الدخول بلا حساب
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-caption text-ink-400">
          مساحة العمل تعمل بلا حساب؛ الدخول يختصر الطريق فقط.
        </p>
      </div>
    </div>
  );
}

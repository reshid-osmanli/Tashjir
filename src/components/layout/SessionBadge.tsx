// شريط الهوية والحساب في مساحة العمل — Session Badge
//
// مشروع التشجير - نظام القراءات العشر
//
// يعرض ما هو موجود فعلا: الجلسة المحفوظة في هذا المتصفح، أو دعوة للدخول.
// لا اسم مستخدم مُصطنع ولا صورة رمزية وهمية (SPEC §179).

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconAccount } from '@/components/ui/icons';

interface LocalSession {
  email?: string;
  signedInAt?: string;
}

export function SessionBadge() {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tashjeer-session');
      setSession(raw ? (JSON.parse(raw) as LocalSession) : null);
    } catch {
      setSession(null);
    }
    setReady(true);
  }, []);

  if (!ready) {
    return <span className="h-8 w-24" aria-hidden="true" />;
  }

  if (!session?.email) {
    return (
      <Link href="/login" className="btn btn-quiet gap-2 text-caption">
        <IconAccount size={16} />
        دخول
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2" title={`جلسة محلية — ${session.signedInAt ?? ''}`}>
      <IconAccount size={16} className="text-ink-400" />
      <span className="max-w-[10rem] truncate text-caption text-ink-600" dir="ltr">
        {session.email}
      </span>
      <button
        type="button"
        className="text-caption text-ink-400 hover:text-danger"
        onClick={() => {
          localStorage.removeItem('tashjeer-session');
          setSession(null);
        }}
      >
        خروج
      </button>
    </span>
  );
}

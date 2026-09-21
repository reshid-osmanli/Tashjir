// ضابط رقم ترتيب السطر - Order Rank Control
//
// حقل واحد مشترك بين خصائص الاختلاف، ومنشئ القاعدة، ومحرر الاختلاف:
// رقم ترتيب السطر جزء أساسي من التحكم اليدوي في نتيجة المحرك، فيجب أن
// يظهر واضحا قابلا للتحرير أينما وُجدت القاعدة.

'use client';

import { useEffect, useState } from 'react';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

export function OrderRankControl({
  value,
  onChange,
  hint,
  inherited,
  compact = false,
}: {
  /** الرتبة الحالية، أو undefined إن اعتمد الموضع قاعدة المحرك. */
  value?: number;
  onChange: (rank: number | null) => void;
  hint?: string;
  /** رتبة موروثة (من القاعدة العامة) تُعرض إن لم يُخصَّص الموضع. */
  inherited?: number;
  compact?: boolean;
}) {
  const effective = typeof value === 'number' ? value : inherited;
  const [draft, setDraft] = useState(typeof effective === 'number' ? String(effective) : '');

  useEffect(() => {
    setDraft(typeof effective === 'number' ? String(effective) : '');
  }, [effective]);

  const apply = (raw: string) => {
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.max(1, Math.round(parsed)));
  };

  return (
    <div
      className={
        compact
          ? 'rounded-md border border-emerald-200 bg-emerald-50/50 p-2'
          : 'rounded-md border border-emerald-300 bg-emerald-50/70 p-2.5'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-emerald-950">رقم ترتيب السطر</p>
        <p className="text-[10px] text-emerald-900/70">
          {typeof value === 'number'
            ? `يدوي: ${toArabicDigits(value)}`
            : typeof inherited === 'number'
              ? `موروث من القاعدة (${toArabicDigits(inherited)})`
              : 'قاعدة المحرك'}
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => apply(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') apply((event.target as HTMLInputElement).value);
          }}
          className="h-8 w-20 rounded border border-emerald-300 bg-white px-2 text-center text-xs tabular-nums"
          placeholder="تلقائي"
          aria-label="رقم ترتيب السطر"
        />
        <button
          type="button"
          onClick={() => apply(draft)}
          className="rounded border border-emerald-400 bg-white px-2.5 py-1.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100"
        >
          تثبيت
        </button>
        {(typeof value === 'number' || draft !== '') && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onChange(null);
            }}
            className="rounded border border-stone-300 bg-white px-2 py-1.5 text-[10px] text-stone-600 hover:bg-stone-50"
            title="إلغاء الترتيب اليدوي والعودة إلى قاعدة المحرك"
          >
            إلغاء الترتيب
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-[10px] leading-relaxed text-emerald-900/75">{hint}</p>}
    </div>
  );
}

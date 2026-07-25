// صفحة المراجعة - Review Page
// مشروع التشجير - نظام القراءات العشر
//
// وحدة المراجعة هي "الوجه" لا "الاختلاف": لأن الاعتماد العلمي يقع على
// نسبة وجه معيّن إلى رواة معيّنين، وقد يصح وجه ويُرد آخر في الاختلاف نفسه.
//
// اللوحة تنبّه على مؤشرين مهمين قبل الاعتماد:
//   1. وجه بلا دليل مسجّل.
//   2. وجه نطاقه فارغ أو مشكوك فيه.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatLocalDate,
  readReviewableItems,
  saveReviewDecision,
  type ReviewableItem,
} from '@/lib/local-app-data';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import type { VerificationStatus } from '@/types/tashjeer';

const FILTERS: Array<{ value: VerificationStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'الكل' },
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'REVIEW', label: 'قيد المراجعة' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'REJECTED', label: 'مرفوض' },
];

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewableItem[]>([]);
  const [filter, setFilter] = useState<VerificationStatus | 'ALL'>('ALL');
  const [reviewer, setReviewer] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = () => {
    const next = readReviewableItems();
    setItems(next);
    setComments(Object.fromEntries(next.map((item) => [item.key, item.review.comment])));
  };

  useEffect(load, []);

  const counts = useMemo(
    () => ({
      ALL: items.length,
      DRAFT: items.filter((item) => item.review.status === 'DRAFT').length,
      REVIEW: items.filter((item) => item.review.status === 'REVIEW').length,
      APPROVED: items.filter((item) => item.review.status === 'APPROVED').length,
      REJECTED: items.filter((item) => item.review.status === 'REJECTED').length,
    }),
    [items]
  );

  const visible = useMemo(
    () => items.filter((item) => filter === 'ALL' || item.review.status === filter),
    [filter, items]
  );

  const decide = (item: ReviewableItem, status: VerificationStatus) => {
    saveReviewDecision(item.key, {
      status,
      comment: comments[item.key] ?? '',
      reviewer: reviewer.trim() || 'مراجع غير مسمى',
    });
    load();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">المراجعة العلمية</h1>
          <p className="mt-0.5 text-sm text-stone-600">
            كل وجه من أوجه الاختلاف يُراجع مستقلا. المراجعة محفوظة في هذا المتصفح.
          </p>
        </div>

        <label className="text-xs text-stone-700">
          <span className="mb-1 block font-medium">اسم المراجع</span>
          <input
            type="text"
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            placeholder="يُسجَّل مع كل قرار"
            className="input w-56"
          />
        </label>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
              filter === option.value
                ? 'border-stone-800 bg-stone-800 text-white'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {option.label} ({counts[option.value]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState hasAnyItems={items.length > 0} />
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.key} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: getCategorySoftColor(item.category),
                        color: getCategoryColor(item.category),
                      }}
                    >
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <Link
                      href="/editor"
                      className="text-xs text-emerald-700 underline-offset-2 hover:underline"
                    >
                      {item.surahName} {item.ayahNumber}
                    </Link>
                    <span className="text-[11px] text-stone-400">
                      آخر تعديل: {formatLocalDate(item.updatedAt)}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm font-medium text-stone-900">{item.variantTitle}</p>
                  <p
                    className="mt-1 text-lg leading-loose text-stone-800"
                    style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                  >
                    {item.alternativeText}
                  </p>
                  <p className="text-xs text-stone-600">
                    {item.alternativeLabel} — {item.narratorsCount} راويا
                  </p>
                </div>

                <StatusPill status={item.review.status} />
              </div>

              {/* تنبيهات ما قبل الاعتماد */}
              <div className="mt-2 flex flex-wrap gap-2">
                {item.evidencesCount === 0 && (
                  <Warning text="لا يوجد دليل مسجّل لهذا الوجه." />
                )}
                {item.narratorsCount === 0 && <Warning text="نطاق الوجه فارغ: لا يقرأ به أحد." />}
                {item.authorStatus === 'DRAFT' && (
                  <Warning text="المحرر لم يرفع الاختلاف عن حالة المسودة." tone="info" />
                )}
              </div>

              <textarea
                value={comments[item.key] ?? ''}
                onChange={(event) =>
                  setComments((previous) => ({ ...previous, [item.key]: event.target.value }))
                }
                rows={2}
                placeholder="ملاحظة المراجع: مصدر التصحيح، أو تحرير الطرق المطلوب."
                className="input mt-3 resize-y"
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ActionButton tone="emerald" onClick={() => decide(item, 'APPROVED')}>
                  اعتماد
                </ActionButton>
                <ActionButton tone="amber" onClick={() => decide(item, 'REVIEW')}>
                  إعادة للمراجعة
                </ActionButton>
                <ActionButton tone="red" onClick={() => decide(item, 'REJECTED')}>
                  رفض
                </ActionButton>

                {item.review.reviewer && (
                  <span className="text-[11px] text-stone-500">
                    آخر قرار: {item.review.reviewer} — {formatLocalDate(item.review.updatedAt)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ hasAnyItems }: { hasAnyItems: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
      <p className="text-sm text-stone-600">
        {hasAnyItems
          ? 'لا توجد عناصر في هذه الحالة.'
          : 'لا توجد أوجه للمراجعة بعد. افتح المحرر وسجّل اختلافا ثم احفظه.'}
      </p>
      <Link
        href="/editor"
        className="mt-3 inline-block rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
      >
        الانتقال إلى المحرر
      </Link>
    </div>
  );
}

function StatusPill({ status }: { status: VerificationStatus }) {
  const styles: Record<VerificationStatus, { label: string; className: string }> = {
    DRAFT: { label: 'مسودة', className: 'bg-stone-100 text-stone-700' },
    REVIEW: { label: 'قيد المراجعة', className: 'bg-amber-100 text-amber-800' },
    APPROVED: { label: 'معتمد', className: 'bg-emerald-100 text-emerald-800' },
    REJECTED: { label: 'مرفوض', className: 'bg-red-100 text-red-800' },
  };

  const style = styles[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

function Warning({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'info' }) {
  const className =
    tone === 'warn' ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600';
  return <span className={`rounded px-2 py-1 text-[11px] ${className}`}>{text}</span>;
}

function ActionButton({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: 'emerald' | 'amber' | 'red';
}) {
  const tones = {
    emerald: 'border-emerald-300 text-emerald-800 hover:bg-emerald-50',
    amber: 'border-amber-300 text-amber-800 hover:bg-amber-50',
    red: 'border-red-300 text-red-800 hover:bg-red-50',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border bg-white px-3 py-1.5 text-xs font-medium transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

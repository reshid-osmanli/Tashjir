'use client';

import { useEffect, useMemo, useState } from 'react';
import { getQiraahByOrder } from '@/data/qiraat-data/qiraat';
import {
  TashjeerLineSummary,
  formatLocalDate,
  readAllTashjeerLineSummaries,
  saveReviewDecision,
} from '@/lib/local-app-data';
import { LineType, ReviewStatus } from '@/types';

const statusLabels: Record<ReviewStatus | 'all', string> = {
  all: 'الكل',
  PENDING: 'معلق',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

const lineTypeLabels: Record<LineType, string> = {
  USUL: 'أصول',
  FARSH: 'فرش',
  MADUD: 'مدود',
  HAMZ: 'همز',
  WAQF: 'وقف',
  TAJWEED: 'تجويد',
};

export default function ReviewPage() {
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('all');
  const [items, setItems] = useState<TashjeerLineSummary[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});

  const loadItems = () => {
    const nextItems = readAllTashjeerLineSummaries();
    setItems(nextItems);
    setComments(
      Object.fromEntries(nextItems.map((item) => [item.key, item.review.comment]))
    );
  };

  useEffect(() => {
    loadItems();
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => filter === 'all' || item.review.status === filter),
    [filter, items]
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      PENDING: items.filter((item) => item.review.status === 'PENDING').length,
      APPROVED: items.filter((item) => item.review.status === 'APPROVED').length,
      REJECTED: items.filter((item) => item.review.status === 'REJECTED').length,
    }),
    [items]
  );

  const updateStatus = (item: TashjeerLineSummary, status: ReviewStatus) => {
    saveReviewDecision(item.key, {
      status,
      comment: comments[item.key] ?? '',
      reviewer: 'المراجع المحلي',
    });
    loadItems();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المراجعة</h1>
          <p className="text-gray-600">متابعة خطوط التشجير المحفوظة واعتمادها علميا.</p>
        </div>
        <button
          onClick={loadItems}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          type="button"
        >
          تحديث
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`${statusLabels.all} (${counts.all})`}
        />
        <FilterButton
          active={filter === 'PENDING'}
          onClick={() => setFilter('PENDING')}
          label={`${statusLabels.PENDING} (${counts.PENDING})`}
          color="#f59e0b"
        />
        <FilterButton
          active={filter === 'APPROVED'}
          onClick={() => setFilter('APPROVED')}
          label={`${statusLabels.APPROVED} (${counts.APPROVED})`}
          color="#22c55e"
        />
        <FilterButton
          active={filter === 'REJECTED'}
          onClick={() => setFilter('REJECTED')}
          label={`${statusLabels.REJECTED} (${counts.REJECTED})`}
          color="#ef4444"
        />
      </div>

      <section className="overflow-hidden rounded-xl bg-white shadow-lg">
        {visibleItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">لا توجد خطوط تشجير محفوظة في هذا التصنيف.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الموضع</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الخط</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">تعليق المراجع</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibleItems.map((item) => (
                  <tr key={item.key}>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">
                        سورة {item.surahId} - آية {item.ayahId}
                      </div>
                      <div className="text-gray-500">آخر تحديث: {formatLocalDate(item.updatedAt)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color ?? '#64748b' }}
                        />
                        <span className="font-medium text-gray-900">{lineTypeLabels[item.type]}</span>
                      </div>
                      <div className="mt-1 text-gray-500">
                        {item.nodesCount} عقدة
                        {item.qiraahId ? ` - ${getQiraahLabel(item.qiraahId)}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={item.review.status} />
                    </td>
                    <td className="px-6 py-4">
                      <textarea
                        value={comments[item.key] ?? ''}
                        onChange={(event) =>
                          setComments({ ...comments, [item.key]: event.target.value })
                        }
                        rows={2}
                        className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <ActionButton label="اعتماد" onClick={() => updateStatus(item, 'APPROVED')} />
                        <ActionButton label="تعليق" onClick={() => updateStatus(item, 'PENDING')} muted />
                        <ActionButton label="رفض" onClick={() => updateStatus(item, 'REJECTED')} danger />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-600 text-white'
          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
      style={active && color ? { backgroundColor: color } : undefined}
      type="button"
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const classes: Record<ReviewStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${classes[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  muted = false,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  muted?: boolean;
  danger?: boolean;
}) {
  const className = danger
    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    : muted
      ? 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';

  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-medium ${className}`}
      type="button"
    >
      {label}
    </button>
  );
}

function getQiraahLabel(qiraahId: number): string {
  const qiraah = getQiraahByOrder(qiraahId);
  return qiraah ? `${qiraah.narrator} عن ${qiraah.name}` : `#${qiraahId}`;
}

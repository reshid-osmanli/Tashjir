'use client';

import { useEffect, useMemo, useState } from 'react';
import { QIRAAT_ORDER_TAYYIBAH } from '@/data/qiraat-data/qiraat';
import { LOCAL_QURAN_SURAHS } from '@/data/quran';
import {
  TashjeerLineSummary,
  formatLocalDate,
  readAllTashjeerLineSummaries,
  readStoredReaders,
} from '@/lib/local-app-data';
import { LineType, ReviewStatus } from '@/types';

const lineTypeLabels: Record<LineType, string> = {
  USUL: 'الأصول',
  FARSH: 'الفرش',
  MADUD: 'المدود',
  HAMZ: 'الهمز',
  WAQF: 'الوقف',
  TAJWEED: 'التجويد',
};

const reviewStatusLabels: Record<ReviewStatus, string> = {
  PENDING: 'معلق',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

export default function StatisticsPage() {
  const [lines, setLines] = useState<TashjeerLineSummary[]>([]);
  const [readersCount, setReadersCount] = useState(0);
  const [ijazatCount, setIjazatCount] = useState(0);
  const [loadedAt, setLoadedAt] = useState('');

  const loadStats = () => {
    const storedReaders = readStoredReaders();
    setLines(readAllTashjeerLineSummaries());
    setReadersCount(storedReaders.length);
    setIjazatCount(storedReaders.reduce((total, reader) => total + reader.ijazat.length, 0));
    setLoadedAt(new Date().toISOString());
  };

  useEffect(() => {
    loadStats();
  }, []);

  const totals = useMemo(() => {
    const localAyahs = LOCAL_QURAN_SURAHS.reduce((total, surah) => total + surah.ayahs.length, 0);
    const localWords = LOCAL_QURAN_SURAHS.reduce(
      (total, surah) =>
        total + surah.ayahs.reduce((ayahTotal, ayah) => ayahTotal + ayah.split(/\s+/).length, 0),
      0
    );

    return {
      localAyahs,
      localWords,
      totalNodes: lines.reduce((total, line) => total + line.nodesCount, 0),
      approved: lines.filter((line) => line.review.status === 'APPROVED').length,
    };
  }, [lines]);

  const lineTypeStats = useMemo(
    () =>
      (Object.keys(lineTypeLabels) as LineType[]).map((type) => ({
        type,
        label: lineTypeLabels[type],
        count: lines.filter((line) => line.type === type).length,
      })),
    [lines]
  );

  const reviewStats = useMemo(
    () =>
      (Object.keys(reviewStatusLabels) as ReviewStatus[]).map((status) => ({
        status,
        label: reviewStatusLabels[status],
        count: lines.filter((line) => line.review.status === status).length,
      })),
    [lines]
  );

  const qiraatStats = useMemo(
    () =>
      QIRAAT_ORDER_TAYYIBAH.map((qiraah) => ({
        name: `${qiraah.narrator} عن ${qiraah.name}`,
        count: lines.filter((line) => line.qiraahId === qiraah.orderInTayyibah).length,
      })),
    [lines]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الإحصاءات</h1>
          <p className="text-gray-600">ملخص حي للتشجير والمراجعة والقراء داخل هذا المتصفح.</p>
        </div>
        <button
          onClick={loadStats}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          type="button"
        >
          تحديث
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard title="الآيات المحلية" value={totals.localAyahs} detail="ضمن بيانات العرض الحالية" tone="emerald" />
        <StatCard title="الكلمات المحلية" value={totals.localWords} detail="محسوبة من النصوص المحفوظة" tone="blue" />
        <StatCard title="خطوط التشجير" value={lines.length} detail={`${totals.totalNodes} عقدة`} tone="amber" />
        <StatCard title="الاعتمادات" value={totals.approved} detail="خطوط مقبولة" tone="slate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-gray-900">توزيع الخطوط</h2>
          <div className="space-y-3">
            {lineTypeStats.map((item) => (
              <ProgressRow key={item.type} label={item.label} count={item.count} max={Math.max(lines.length, 1)} />
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-gray-900">حالات المراجعة</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {reviewStats.map((item) => (
              <div key={item.status} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-600">{item.label}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{item.count}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">إحصاءات القراءات</h2>
          <span className="text-sm text-gray-500">
            القراء: {readersCount} - الإجازات: {ijazatCount}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {qiraatStats.map((stat) => (
            <div key={stat.name} className="rounded-lg bg-gray-50 p-4">
              <div className="text-sm text-gray-600">{stat.name}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{stat.count}</div>
              <div className="mt-1 text-xs text-gray-500">خط تشجير</div>
            </div>
          ))}
        </div>
      </section>

      {loadedAt && (
        <p className="text-sm text-gray-500">آخر تحديث للإحصاءات: {formatLocalDate(loadedAt)}</p>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  tone: 'emerald' | 'blue' | 'amber' | 'slate';
}) {
  const classes = {
    emerald: 'border-emerald-200 bg-emerald-50',
    blue: 'border-blue-200 bg-blue-50',
    amber: 'border-amber-200 bg-amber-50',
    slate: 'border-slate-200 bg-slate-50',
  };

  return (
    <div className={`rounded-xl border p-6 ${classes[tone]}`}>
      <div className="text-sm text-gray-600">{title}</div>
      <div className="mt-1 text-3xl font-bold text-gray-900">{value}</div>
      <div className="mt-2 text-xs text-gray-500">{detail}</div>
    </div>
  );
}

function ProgressRow({ label, count, max }: { label: string; count: number; max: number }) {
  const width = `${Math.round((count / max) * 100)}%`;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-emerald-600" style={{ width }} />
      </div>
    </div>
  );
}

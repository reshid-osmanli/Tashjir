'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  NARRATORS,
  QIRAAT_ORDER_TAYYIBAH,
  READING_IMAMS,
  getFullQiraahName,
  getTuruqForQiraah,
} from '@/data/qiraat-data/qiraat';
import { Qiraah, Turuq } from '@/types';

export default function QiraatPage() {
  const [selectedQiraah, setSelectedQiraah] = useState<number>(QIRAAT_ORDER_TAYYIBAH[0]?.id ?? 1);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const normalizedQuery = normalize(query);
    return QIRAAT_ORDER_TAYYIBAH.map((qiraah) => ({
      qiraah,
      turuq: getTuruqForQiraah(qiraah.id),
    })).filter(({ qiraah, turuq }) => {
      if (!normalizedQuery) return true;
      const haystack = normalize(
        `${getFullQiraahName(qiraah)} ${turuq.map((item) => `${item.name} ${item.fullName}`).join(' ')}`
      );
      return haystack.includes(normalizedQuery);
    });
  }, [query]);

  const selected = rows.find((row) => row.qiraah.id === selectedQiraah)
    ?? QIRAAT_ORDER_TAYYIBAH.map((qiraah) => ({ qiraah, turuq: getTuruqForQiraah(qiraah.id) }))
      .find((row) => row.qiraah.id === selectedQiraah);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">القراءات العشر</h1>
          <p className="text-gray-600">ترتيب القراء والرواة والطرق حسب طيبة النشر.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <Link
            href="/admin"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
          >
            إدارة القراء والرواة والطرق
          </Link>
          <div className="w-full md:w-80">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="بحث في القارئ أو الراوي أو الطريق"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="الأئمة" value={READING_IMAMS.length} />
        <SummaryCard label="الرواة" value={NARRATORS.length} />
        <SummaryCard label="الطرق المدخلة" value={QIRAAT_ORDER_TAYYIBAH.reduce((total, qiraah) => total + getTuruqForQiraah(qiraah.id).length, 0)} />
        <SummaryCard label="نتائج البحث" value={rows.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
        <section className="overflow-hidden rounded-xl bg-white shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">#</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">القارئ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الراوي</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الطرق</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map(({ qiraah, turuq }) => (
                  <tr
                    key={qiraah.id}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      selectedQiraah === qiraah.id ? 'bg-emerald-50' : ''
                    }`}
                    onClick={() => setSelectedQiraah(qiraah.id)}
                  >
                    <td className="px-6 py-4 text-sm text-gray-500">{qiraah.orderInTayyibah}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{qiraah.name}</div>
                      <div className="text-xs text-gray-500">{getImamRegion(qiraah)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{qiraah.narrator}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {turuq.length} طريق
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                        type="button"
                      >
                        عرض
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selected && <QiraahDetails qiraah={selected.qiraah} turuq={selected.turuq} />}
      </div>
    </div>
  );
}

function QiraahDetails({ qiraah, turuq }: { qiraah: Qiraah; turuq: Turuq[] }) {
  return (
    <aside className="rounded-xl bg-white p-6 shadow-lg">
      <h2 className="text-lg font-bold text-gray-900">تفاصيل القراءة</h2>
      <div className="mt-4 space-y-4">
        <InfoRow label="القارئ" value={qiraah.name} />
        <InfoRow label="الراوي" value={qiraah.narrator} />
        <InfoRow label="الترتيب في الطيبة" value={String(qiraah.orderInTayyibah)} />
        <InfoRow label="البلد" value={getImamRegion(qiraah)} />
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-gray-500">الطرق المدخلة</h3>
        <div className="space-y-3">
          {turuq.map((tariq) => (
            <div key={tariq.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="font-medium text-gray-900">{tariq.name}</div>
              <div className="mt-1 text-sm leading-6 text-gray-600">{tariq.fullName}</div>
              {tariq.code && <div className="mt-2 text-xs text-gray-400">{tariq.code}</div>}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function getImamRegion(qiraah: Qiraah): string {
  const narrator = NARRATORS.find((item) => item.id === qiraah.narratorId);
  const imam = READING_IMAMS.find((item) => item.id === narrator?.imamId);
  return imam?.region ?? '-';
}

function normalize(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}

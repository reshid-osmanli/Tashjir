// صفحة الإحصاءات - Statistics Page
// مشروع التشجير - نظام القراءات العشر
//
// لوحة قياس التقدم: كم آية شُجّرت من 6236، وكم وجها اعتُمد، وأين الثغرات
// (أوجه بلا أدلة، مستندات ما زالت مسودة).

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TOTAL_AYAHS, getSurahOrFirst } from '@/data/quran';
import { NARRATORS, READING_IMAMS, TRANSMISSION_PATH_SEEDS } from '@/data/qiraat-data/qiraat';
import { listDocuments, loadDocument, type DocumentIndexEntry } from '@/lib/storage/document-store';
import { readReviewableItems, formatLocalDate, type ReviewableItem } from '@/lib/local-app-data';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor } from '@/lib/tashjeer/color-system';
import { resolveScope } from '@/lib/tashjeer/scope';
import type { VariantCategory } from '@/types';

export default function StatisticsPage() {
  const [documents, setDocuments] = useState<DocumentIndexEntry[]>([]);
  const [items, setItems] = useState<ReviewableItem[]>([]);
  const [narratorCoverage, setNarratorCoverage] = useState<Record<string, number>>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const entries = listDocuments();
    setDocuments(entries);
    setItems(readReviewableItems());

    // تغطية الرواة: كم وجها يقرأ به كل راو عبر كل المستندات.
    const coverage: Record<string, number> = {};
    const categories: Record<string, number> = {};

    for (const entry of entries) {
      const document = loadDocument(entry.ayahKey);
      if (!document) continue;

      for (const variant of document.variants) {
        categories[variant.category] = (categories[variant.category] ?? 0) + 1;

        for (const alternative of variant.alternatives) {
          if (alternative.isBase) continue;
          for (const narratorId of resolveScope(alternative.scope)) {
            coverage[narratorId] = (coverage[narratorId] ?? 0) + 1;
          }
        }
      }
    }

    setNarratorCoverage(coverage);
    setCategoryCounts(categories);
  }, []);

  const totals = useMemo(() => {
    const approved = items.filter((item) => item.review.status === 'APPROVED').length;
    const missingEvidence = items.filter((item) => item.evidencesCount === 0).length;
    const emptyScope = items.filter((item) => item.narratorsCount === 0).length;

    return {
      documents: documents.length,
      variants: documents.reduce((total, entry) => total + entry.variantsCount, 0),
      alternatives: items.length,
      approved,
      missingEvidence,
      emptyScope,
      progress: (documents.length / TOTAL_AYAHS) * 100,
    };
  }, [documents, items]);

  const maxCoverage = Math.max(1, ...Object.values(narratorCoverage));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-stone-900">الإحصاءات</h1>
        <p className="mt-0.5 text-sm text-stone-600">
          قياس التقدم وجودة التوثيق في العمل المحفوظ بهذا المتصفح.
        </p>
      </header>

      {/* التقدم العام */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-stone-900">تقدم تشجير المصحف</h2>
          <span className="text-xs text-stone-500">
            {totals.documents.toLocaleString('ar')} من {TOTAL_AYAHS.toLocaleString('ar')} آية (
            {totals.progress.toFixed(3)}%)
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${Math.max(totals.progress, 0.3)}%` }}
          />
        </div>
      </section>

      {/* بطاقات */}
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="مستندات محفوظة" value={totals.documents} tone="emerald" />
        <StatCard label="اختلافات مسجّلة" value={totals.variants} tone="blue" />
        <StatCard label="أوجه مرسومة" value={totals.alternatives} tone="amber" />
        <StatCard label="أوجه معتمدة" value={totals.approved} tone="stone" />
      </section>

      {/* ثغرات التوثيق */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-stone-900">ثغرات التوثيق</h2>
          <ul className="space-y-2 text-xs">
            <GapRow
              label="أوجه بلا دليل مسجّل"
              value={totals.missingEvidence}
              total={totals.alternatives}
            />
            <GapRow
              label="أوجه نطاقها فارغ"
              value={totals.emptyScope}
              total={totals.alternatives}
            />
            <GapRow
              label="أوجه لم تُعتمد بعد"
              value={totals.alternatives - totals.approved}
              total={totals.alternatives}
            />
          </ul>
          {totals.alternatives > 0 && (
            <Link
              href="/review"
              className="mt-3 inline-block rounded-md border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
            >
              الانتقال إلى المراجعة
            </Link>
          )}
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-stone-900">توزيع الفئات</h2>
          {Object.keys(categoryCounts).length === 0 ? (
            <p className="text-xs text-stone-500">لا توجد اختلافات مسجّلة بعد.</p>
          ) : (
            <ul className="space-y-2">
              {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => {
                const count = categoryCounts[category] ?? 0;
                const max = Math.max(1, ...Object.values(categoryCounts));

                return (
                  <li key={category}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-stone-700">{CATEGORY_LABELS[category]}</span>
                      <span className="tabular-nums text-stone-500">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / max) * 100}%`,
                          backgroundColor: getCategoryColor(category),
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* تغطية الرواة */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-bold text-stone-900">تغطية الرواة</h2>
        <p className="mb-3 text-[11px] text-stone-500">
          عدد الأوجه التي يقرأ بها كل راو في العمل المسجّل. التفاوت الشديد مؤشر على نقص التغطية.
        </p>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          {NARRATORS.map((narrator) => {
            const count = narratorCoverage[narrator.id] ?? 0;
            const imam = READING_IMAMS.find((item) => item.id === narrator.imamId);

            return (
              <div key={narrator.id} className="rounded-md bg-stone-50 px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-stone-800">{narrator.name}</span>
                  <span className="text-[11px] tabular-nums text-stone-500">{count}</span>
                </div>
                <p className="text-[10px] text-stone-400">عن {imam?.name}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${(count / maxCoverage) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* آخر ما عُمل عليه */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-stone-900">آخر المستندات</h2>
        {documents.length === 0 ? (
          <p className="text-xs text-stone-500">لا توجد مستندات بعد.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {documents.slice(0, 10).map((entry) => (
              <li key={entry.ayahKey} className="flex items-center justify-between gap-3 py-2">
                <span className="text-xs text-stone-800">
                  {getSurahOrFirst(entry.surahNumber).name} {entry.ayahNumber}
                </span>
                <span className="text-[11px] text-stone-500">
                  {entry.variantsCount} اختلافا · {formatLocalDate(entry.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* مرجعية النموذج */}
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="أئمة القراءة" value={READING_IMAMS.length} tone="stone" />
        <StatCard label="الرواة" value={NARRATORS.length} tone="stone" />
        <StatCard label="الطرق المدخلة" value={TRANSMISSION_PATH_SEEDS.length} tone="stone" />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'blue' | 'amber' | 'stone';
}) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50',
    blue: 'border-blue-200 bg-blue-50',
    amber: 'border-amber-200 bg-amber-50',
    stone: 'border-stone-200 bg-stone-50',
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-2xl font-bold tabular-nums text-stone-900">
        {value.toLocaleString('ar')}
      </div>
      <div className="mt-0.5 text-xs text-stone-600">{label}</div>
    </div>
  );
}

function GapRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total === 0 ? 0 : (value / total) * 100;
  const tone = value === 0 ? 'text-emerald-700' : percent > 50 ? 'text-red-700' : 'text-amber-700';

  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-stone-700">{label}</span>
      <span className={`tabular-nums font-medium ${tone}`}>
        {value} {total > 0 && `(${percent.toFixed(0)}%)`}
      </span>
    </li>
  );
}

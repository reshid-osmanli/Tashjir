// صفحة التتبع - Tracking Page
// مشروع التشجير - نظام القراءات العشر
//
// هذه الصفحة هي «المرحلة الرابعة» في سير العمل المعتمد:
//
//   المحرك يحلل ويقترح ← المحرر يصحح يدويا ← JSON موثوق ← **التتبع** ← تطوير المحرك
//
// يجيب التتبع عن الأسئلة الأربعة، مصنفة حسب نوع القاعدة (المدود، الفرش،
// الأصول، التجويد...):
//
//   ماذا وجد المحرك؟      مواضع مصدرها المحرك (قواعد عامة مشتقة أو بيانات أساسية).
//   ماذا أضاف المحرر؟      اختلافات أنشئت يدويا من المحرر.
//   ماذا صحّح المحرر؟      كل موضع عُدّل يدويا، مع فروق «قبل/بعد» من سجل التعديل.
//   أين الاختلاف؟         الفرق بين نتيجة المحرك والنتيجة اليدوية في كل موضع.
//
// ومن كل صف يُفتح الموضع مباشرة في المحرر للمراجعة أو التصحيح.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  readTrackingRows,
  readOccurrenceOverrideSummary,
  trackingSummary,
  type TrackingRow,
  type TrackingSource,
} from '@/lib/storage/tracking-store';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { VariantCategory } from '@/types';
import type { VerificationStatus } from '@/types/tashjeer';

type SourceFilter = TrackingSource | 'MODIFIED' | 'ALL';

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'ALL', label: 'الكل' },
  { value: 'ENGINE', label: 'ما وجده المحرك' },
  { value: 'EDITOR', label: 'ما أضافه المحرر' },
  { value: 'MODIFIED', label: 'المعدَّل يدويا' },
];

export default function TrackingPage() {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [overrides, setOverrides] = useState({ deleted: 0, confirmed: 0, edited: 0 });
  const [category, setCategory] = useState<VariantCategory | 'ALL'>('ALL');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setRows(
      readTrackingRows({
        category,
        scanGlobalMatches: category !== 'ALL',
      })
    );
    setOverrides(readOccurrenceOverrideSummary());
  }, [category]);

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (category === 'ALL' || row.category === category) &&
          (source === 'ALL' ||
            (source === 'MODIFIED' ? row.manuallyModified : row.source === source))
      ),
    [rows, category, source]
  );

  const summary = useMemo(() => trackingSummary(rows), [rows]);

  const categoriesWithData = useMemo(() => {
    const counts = new Map<VariantCategory, number>();
    for (const row of rows) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    return [...counts.entries()].sort((first, second) => second[1] - first[1]);
  }, [rows]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">التتبع</h1>
          <p className="mt-0.5 max-w-3xl text-sm leading-relaxed text-stone-600">
            ماذا وجد المحرك؟ وماذا صحّح المحرر؟ وما الفرق بين النتيجتين؟ اختر نوع القاعدة
            (المدود، الفرش، الأصول...) لتظهر مواضعها كلها بحالاتها، وافتح أي موضع في المحرر
            مباشرة.
          </p>
        </div>
      </header>

      {/* بطاقات الملخص */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="كل المواضع" value={summary.total} tone="stone" />
        <SummaryCard label="وجد المحرك" value={summary.engine} tone="cyan" />
        <SummaryCard label="أضاف المحرر" value={summary.editor} tone="emerald" />
        <SummaryCard label="عُدّل يدويا" value={summary.modified} tone="violet" />
      </div>

      {overrides.deleted + overrides.confirmed + overrides.edited > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-600">
          <span className="font-medium text-stone-800">مواضع القواعد العامة على المصحف كله:</span>{' '}
          محذوف موضعيا {toArabicDigits(overrides.deleted)} · معتمد بعد المراجعة{' '}
          {toArabicDigits(overrides.confirmed)} · عُدّل ترتيبه أو درجته{' '}
          {toArabicDigits(overrides.edited)} —{' '}
          <Link href="/editor" className="text-emerald-700 underline-offset-2 hover:underline">
            راجعها من المحرر
          </Link>
        </div>
      )}

      {/* تصفية الفئة */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={category === 'ALL'}
          onClick={() => setCategory('ALL')}
          label={`كل الفئات (${toArabicDigits(summary.total)})`}
        />
        {categoriesWithData.map(([value, count]) => (
          <FilterChip
            key={value}
            active={category === value}
            onClick={() => setCategory(value)}
            label={`${CATEGORY_LABELS[value]} (${toArabicDigits(count)})`}
            color={getCategoryColor(value)}
          />
        ))}
      </div>

      {/* تصفية المصدر */}
      <div className="flex flex-wrap gap-2">
        {SOURCE_FILTERS.map((option) => (
          <FilterChip
            key={option.value}
            active={source === option.value}
            onClick={() => setSource(option.value)}
            label={option.label}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-600">
            {rows.length === 0
              ? 'لا يوجد ما يُتبَّع بعد: احفظ تشجير آية من المحرر ثم عد إلى هنا.'
              : 'لا مواضع تطابق هذا التصنيف.'}
          </p>
          <Link
            href="/editor"
            className="mt-3 inline-block rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
          >
            الانتقال إلى المحرر
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((row) => (
            <TrackingRowCard
              key={row.id}
              row={row}
              expanded={expanded === row.id}
              onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TrackingRowCard({
  row,
  expanded,
  onToggle,
}: {
  row: TrackingRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10.5px] font-medium"
              style={{
                backgroundColor: getCategorySoftColor(row.category),
                color: getCategoryColor(row.category),
              }}
            >
              {CATEGORY_LABELS[row.category]}
            </span>

            <SourceBadge source={row.source} />
            {row.manuallyModified && (
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10.5px] text-violet-800">
                عُدّل يدويا {toArabicDigits(row.edits.length)} مرة
              </span>
            )}
            {typeof row.orderRank === 'number' && (
              <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10.5px] text-cyan-800">
                ترتيب السطر: {toArabicDigits(row.orderRank)}
              </span>
            )}

            <StatusPill status={row.status} />
          </div>

          <p className="mt-1.5 text-sm font-medium text-stone-900">{row.title}</p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            {row.globalRuleTitle ? `من قاعدة: ${row.globalRuleTitle} · ` : ''}
            آخر نشاط: {row.lastEditedAt ? formatDate(row.lastEditedAt) : 'لم يُعدَّل يدويا'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-600 hover:bg-stone-50"
          >
            {expanded ? 'إخفاء الفروق' : 'الفروق'}
          </button>
          <Link
            href={`/editor?ayah=${row.ayahKey}&variant=${row.variantId}`}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
          >
            فتح في المحرر
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50/70 p-3">
          <p className="mb-2 text-[11px] font-semibold text-stone-700">
            سجل التصحيح اليدوي (قبل ← بعد)
          </p>
          {row.edits.length === 0 ? (
            <p className="text-[11px] text-stone-500">لا تعديلات يدوية على هذا الموضع.</p>
          ) : (
            <ol className="space-y-2">
              {row.edits.map((edit, index) => (
                <li key={index} className="rounded border border-stone-200 bg-white px-2.5 py-2">
                  <p className="text-[11px] font-medium text-stone-800">
                    {toArabicDigits(index + 1)}. {edit.action}
                    <span className="font-normal text-stone-500"> — {formatDate(edit.at)}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-600">{edit.summary}</p>
                  {edit.changes && edit.changes.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {edit.changes.map((change, changeIndex) => (
                        <li key={changeIndex} className="text-[10.5px] text-stone-500">
                          <span className="font-medium text-stone-700">{change.field}:</span>{' '}
                          <span className="text-rose-700">{formatValue(change.before)}</span>
                          {' ← '}
                          <span className="text-emerald-700">{formatValue(change.after)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

function SourceBadge({ source }: { source: TrackingSource }) {
  return source === 'EDITOR' ? (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10.5px] text-emerald-800">
      أضافه المحرر
    </span>
  ) : (
    <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10.5px] text-cyan-800">
      وجده المحرك
    </span>
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
    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'stone' | 'cyan' | 'emerald' | 'violet';
}) {
  const tones = {
    stone: 'border-stone-200 bg-white text-stone-900',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-2xl font-bold tabular-nums">{toArabicDigits(value)}</div>
      <div className="mt-0.5 text-[11px] opacity-80">{label}</div>
    </div>
  );
}

function FilterChip({
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
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'border-stone-800 bg-stone-800 text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
      }`}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {label}
    </button>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return 'بلا قيمة';
  if (typeof value === 'string') return value.length > 30 ? `${value.slice(0, 30)}…` : value;
  if (typeof value === 'number') return toArabicDigits(value);
  if (Array.isArray(value)) return `قائمة (${toArabicDigits(value.length)})`;
  return JSON.stringify(value).slice(0, 40);
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(value)
    );
  } catch {
    return '—';
  }
}

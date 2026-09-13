// صفحة التتبع - Tracking Page
// مشروع التشجير - نظام القراءات العشر
//
// هذه الصفحة هي «المرحلة الرابعة» في سير العمل المعتمد:
//
//   المحرك يحلل ويقترح ← المحرر يصحح يدويا ← JSON موثوق ← **التتبع** ← تطوير المحرك
//
// ثلاثة أوضاع على نفس البيانات (بلا تخزين مكرر — DM-16):
//
//   مواضع التتبع      ماذا وجد المحرك؟ وماذا أضاف/صحّح المحرر؟ بثلاثية
//                    (Engine/Editor/Final) مع السبب والمصدر، وأثر قرار المحرك،
//                    وفتح الموضع في المحرر من كل سطر (تحديد موحد).
//   التحقق من المرجع   مقارنة نتيجة المحرك بالمرجعي المعتمد (Final) وتصنيف
//                    حتمي: صحيح/خاطئ/مفقود/زائد/متعارض (FR-ES-12.1).
//   أخطاء المحرك      تجميع حتمي للأخطاء المتكررة حسب النمط مع فتح
//                    المواضع المتأثرة (FR-ES-12.2).

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
import { DecisionTraceList } from '@/components/editor/WhyTraceDialog';
import { resolveDifference } from '@/lib/tashjeer/decision/api';
import { editorCategoryToStudioType } from '@/lib/tashjeer/decision/editor-bridge';
import { useEngineConfig } from '@/hooks/useEngineConfig';
import {
  validateAgainstReference,
  type ValidationPosition,
  type ValidationSummary,
  type ValidationVerdict,
} from '@/lib/tashjeer/reference-validation';
import {
  CONTEXT_LABELS,
  SOURCE_LABELS,
  VERDICT_LABELS,
  groupEngineErrors,
  type ErrorPattern,
} from '@/lib/tashjeer/engine-errors';
import { listDocuments, loadDocument } from '@/lib/storage/document-store';
import { listGlobalRules } from '@/lib/storage/global-rules-store';
import { listOccurrenceOverrides } from '@/lib/storage/rule-occurrences-store';

type SourceFilter = TrackingSource | 'MODIFIED' | 'ALL';
type TrackingTab = 'POSITIONS' | 'VALIDATION' | 'ERRORS';
type VerdictFilter = ValidationVerdict | 'ALL';

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'ALL', label: 'الكل' },
  { value: 'ENGINE', label: 'ما وجده المحرك' },
  { value: 'EDITOR', label: 'ما أضافه المحرر' },
  { value: 'MODIFIED', label: 'المعدَّل يدويا' },
];

const VERDICT_FILTERS: Array<{ value: VerdictFilter; label: string }> = [
  { value: 'ALL', label: 'الكل' },
  { value: 'CORRECT', label: VERDICT_LABELS.CORRECT },
  { value: 'WRONG', label: VERDICT_LABELS.WRONG },
  { value: 'MISSING', label: VERDICT_LABELS.MISSING },
  { value: 'EXTRA', label: VERDICT_LABELS.EXTRA },
  { value: 'CONFLICT', label: VERDICT_LABELS.CONFLICT },
];

export default function TrackingPage() {
  const [tab, setTab] = useState<TrackingTab>('POSITIONS');
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [overrides, setOverrides] = useState({ deleted: 0, confirmed: 0, edited: 0 });
  const [category, setCategory] = useState<VariantCategory | 'ALL'>('ALL');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [verdict, setVerdict] = useState<VerdictFilter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  // التحقق من المرجع: يُحسب من الكيانات نفسها (المستندات + الاستثناءات)
  // — بلا تخزين مكرر، وبملف المحرك المفعّل لحسم التعارضات (P-07).
  const engineConfig = useEngineConfig();
  const validation = useMemo(
    () =>
      validateAgainstReference({
        documents: listDocuments()
          .map((entry) => loadDocument(entry.ayahKey))
          .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
          .map((doc) => ({ ayahKey: doc.ayahKey, variants: doc.variants, links: doc.links })),
        rules: listGlobalRules(),
        overrides: listOccurrenceOverrides(),
        profile: engineConfig,
      }),
    [engineConfig]
  );
  const errorPatterns = useMemo(() => groupEngineErrors(validation.positions), [validation.positions]);

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

  const visibleValidation = useMemo(
    () =>
      validation.positions.filter(
        (position) =>
          (category === 'ALL' || position.category === category) &&
          (verdict === 'ALL' || position.verdict === verdict)
      ),
    [validation.positions, category, verdict]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">التتبع</h1>
          <p className="mt-0.5 max-w-3xl text-sm leading-relaxed text-stone-600">
            ماذا وجد المحرك؟ وماذا صحّح المحرر؟ وما الفرق بين النتيجتين؟ والتحقق من نتيجة
            المحرك مقابل المرجعي المعتمد — كله من نفس البيانات، ومن كل سطر يفتح الموضع في
            المحرر محددا عليه.
          </p>
        </div>
        {/* أوضاع التتبع الثلاثة على نفس الكيانات */}
        <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-xs">
          <TabButton active={tab === 'POSITIONS'} onClick={() => setTab('POSITIONS')}>
            مواضع التتبع
          </TabButton>
          <TabButton active={tab === 'VALIDATION'} onClick={() => setTab('VALIDATION')}>
            التحقق من المرجع
          </TabButton>
          <TabButton active={tab === 'ERRORS'} onClick={() => setTab('ERRORS')}>
            أخطاء المحرك
          </TabButton>
        </div>
      </header>

      {/* تصفية الفئة: مشتركة بين الأوضاع الثلاثة */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={category === 'ALL'}
          onClick={() => setCategory('ALL')}
          label={`كل الفئات (${toArabicDigits(summary.total + validation.summary.total)})`}
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

      {tab === 'POSITIONS' && (
        <>
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
        </>
      )}

      {tab === 'VALIDATION' && (
        <ValidationView
          positions={visibleValidation}
          summary={validation.summary}
          verdict={verdict}
          onVerdictChange={setVerdict}
        />
      )}

      {tab === 'ERRORS' && <ErrorsView patterns={errorPatterns} category={category} />}
    </div>
  );
}

// ==================== وضع التحقق من المرجع (FR-ES-12.1) ====================

const VERDICT_TONES: Record<ValidationVerdict, { badge: string; card: string }> = {
  CORRECT: { badge: 'bg-emerald-100 text-emerald-800', card: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  WRONG: { badge: 'bg-rose-100 text-rose-800', card: 'border-rose-200 bg-rose-50 text-rose-900' },
  MISSING: { badge: 'bg-amber-100 text-amber-800', card: 'border-amber-200 bg-amber-50 text-amber-900' },
  EXTRA: { badge: 'bg-sky-100 text-sky-800', card: 'border-sky-200 bg-sky-50 text-sky-900' },
  CONFLICT: { badge: 'bg-violet-100 text-violet-800', card: 'border-violet-200 bg-violet-50 text-violet-900' },
};

function ValidationView({
  positions,
  summary,
  verdict,
  onVerdictChange,
}: {
  positions: ValidationPosition[];
  summary: ValidationSummary;
  verdict: VerdictFilter;
  onVerdictChange: (value: VerdictFilter) => void;
}) {
  return (
    <>
      {/* الملخص الكمي: تصنيف كل المواضع مقابل المرجعي المعتمد */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="صحيح" value={summary.correct} tone="emerald" />
        <SummaryCard label="خاطئ" value={summary.wrong} tone="rose" />
        <SummaryCard label="مفقود" value={summary.missing} tone="amber" />
        <SummaryCard label="زائد" value={summary.extra} tone="sky" />
        <SummaryCard label="متعارض" value={summary.conflict} tone="violet" />
      </div>

      <div className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-xs text-stone-600">
        المرجع = كل ما ثبت بقرار المحرر (Final). المقارنة على آخر لقطة محرك محفوظة على
        الموضع؛ إعادة التشغيل الشاملة بخياراتها في الحزمة 12.
      </div>

      {/* تصفية بالتصنيف */}
      <div className="flex flex-wrap gap-2">
        {VERDICT_FILTERS.map((option) => (
          <FilterChip
            key={option.value}
            active={verdict === option.value}
            onClick={() => onVerdictChange(option.value)}
            label={
              option.value === 'ALL'
                ? `الكل (${toArabicDigits(summary.total)})`
                : `${option.label} (${toArabicDigits(
                    option.value === 'CORRECT'
                      ? summary.correct
                      : option.value === 'WRONG'
                        ? summary.wrong
                        : option.value === 'MISSING'
                          ? summary.missing
                          : option.value === 'EXTRA'
                            ? summary.extra
                            : summary.conflict
                  )})`
            }
          />
        ))}
      </div>

      {positions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-600">لا مواضع لتصنيفها بعد: صحّح موضعا في المحرر ثم عد هنا.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {positions.map((position) => (
            <ValidationRow key={position.id} position={position} />
          ))}
        </ul>
      )}
    </>
  );
}

function ValidationRow({ position }: { position: ValidationPosition }) {
  const tone = VERDICT_TONES[position.verdict];
  const href = `/editor?ayah=${position.ayahKey}${position.variantId ? `&variant=${encodeURIComponent(position.variantId)}` : ''}`;
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${tone.badge}`}>
              {VERDICT_LABELS[position.verdict]}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10.5px] font-medium"
              style={{
                backgroundColor: getCategorySoftColor(position.category),
                color: getCategoryColor(position.category),
              }}
            >
              {CATEGORY_LABELS[position.category]}
            </span>
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10.5px] text-stone-600">
              {SOURCE_LABELS[position.source]}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-stone-900">{position.title}</p>
          <p className="mt-0.5 text-[11px] text-stone-500">{position.reason}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11px] text-stone-400">
            {Math.floor(position.ayahKey / 1000)}:{position.ayahKey % 1000}
          </span>
          <Link
            href={href}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
          >
            فتح في المحرر
          </Link>
        </div>
      </div>
    </li>
  );
}

// ==================== وضع أخطاء المحرك (FR-ES-12.2) ====================

function ErrorsView({ patterns, category }: { patterns: ErrorPattern[]; category: VariantCategory | 'ALL' }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const visible = patterns.filter((pattern) => category === 'ALL' || pattern.category === category);

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <p className="text-sm text-stone-600">
          لا أخطاء محرك متكررة بعد: أخطاء المحرك تُجمع هنا تلقائيا من نتائج التحقق من المرجع.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold text-stone-800">Repeated Errors — الأنماط المتكررة</p>
      <p className="mt-0.5 text-[11px] text-stone-500">
        تجميع حتمي (فئة القاعدة × فئة القرار × السياق × المصدر). افتح أي نمط لترى مواضعه
        المتأثرة وافتحها في المحرر.
      </p>
      <ul className="mt-3 space-y-2">
        {visible.map((pattern) => (
          <li key={pattern.key} className="rounded-lg border border-stone-200">
            <button
              type="button"
              onClick={() => setOpenKey(openKey === pattern.key ? null : pattern.key)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start hover:bg-stone-50"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                  style={{
                    backgroundColor: getCategorySoftColor(pattern.category),
                    color: getCategoryColor(pattern.category),
                  }}
                >
                  {CATEGORY_LABELS[pattern.category]}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${VERDICT_TONES[pattern.verdict].badge}`}>
                  {VERDICT_LABELS[pattern.verdict]}
                </span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10.5px] text-stone-600">
                  {CONTEXT_LABELS[pattern.context]}
                </span>
                <span className="text-[11px] text-stone-500">{SOURCE_LABELS[pattern.source]}</span>
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-stone-800">
                {toArabicDigits(pattern.count)}
              </span>
            </button>
            {openKey === pattern.key && (
              <ul className="space-y-1 border-t border-stone-100 p-2">
                {pattern.positions.map((position) => (
                  <li
                    key={position.id}
                    className="flex items-center justify-between gap-2 rounded border border-stone-100 bg-stone-50/60 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0 truncate text-stone-800" title={position.reason}>
                      {position.title}
                      <span className="mr-1 text-stone-400">
                        ({Math.floor(position.ayahKey / 1000)}:{position.ayahKey % 1000})
                      </span>
                    </span>
                    <Link
                      href={`/editor?ayah=${position.ayahKey}${position.variantId ? `&variant=${encodeURIComponent(position.variantId)}` : ''}`}
                      className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-[10.5px] font-medium text-white hover:bg-emerald-700"
                    >
                      فتح في المحرر
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ==================== عناصر مشتركة ====================

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
            href={row.openHref ?? `/editor?ayah=${row.ayahKey}`}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
          >
            فتح في المحرر
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50/70 p-3">
          {row.correction && <CorrectionTripletView row={row} />}
          <RowDecisionTrace row={row} />
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

/**
 * أثر قرار المحرك لهذا الموضع (Decision Trace في صف التتبع — FR-ES-10):
 * يُعاد حسابه من ملف المحرك المفعّل الآن عبر Decision Resolver نفسه، فيرى
 * المحقق أي قاعدة استوجبت الاختلاف وأيها تُركت، دون فتح المحرر.
 */
function RowDecisionTrace({ row }: { row: TrackingRow }) {
  const engineConfig = useEngineConfig();
  const [open, setOpen] = useState(false);
  const result = useMemo(
    () =>
      resolveDifference(
        {
          differenceType: editorCategoryToStudioType(row.category),
          category: 'DIFFERENCE',
          source: row.source,
          globalRuleId: row.globalRuleId,
        },
        engineConfig
      ),
    [row.category, row.source, row.globalRuleId, engineConfig]
  );
  const applied = result.appliedRules.length;
  return (
    <div className="mb-3 rounded-lg border border-stone-200 bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-stone-800">
          أثر قرار المحرك
          <span className="mr-1 font-normal text-stone-500">
            {applied > 0 ? `${toArabicDigits(applied)} قاعدة فاعلة · ${result.decision.reason}` : 'لا قاعدة استوديو تستوجب هذا الاختلاف (قاعدة عامة أو إدخال يدوي)'}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-[10.5px] text-stone-700 hover:bg-stone-50"
        >
          {open ? 'إخفاء الأثر' : `عرض الأثر (${toArabicDigits(result.trace.length)})`}
        </button>
      </div>
      {open && (
        <div className="mt-2">
          <DecisionTraceList trace={result.trace} compact />
          {result.appliedRules.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {result.appliedRules.map((rule) => (
                <li key={rule.id}>
                  <Link href={`/studio?rule=${encodeURIComponent(rule.id)}`} className="rounded bg-emerald-50 px-2 py-0.5 text-[10.5px] text-emerald-800 hover:bg-emerald-100">
                    {rule.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ثلاثية A/B/Final (AC-02): اقتراح المحرك، تغيير المحرر، النتيجة المعتمدة،
 * مع السبب والمصدر، وزر ينقل التصحيح إلى الاستوديو ليُقترح منه قانون مرشّح
 * (FR-ES-12).
 */
function CorrectionTripletView({ row }: { row: TrackingRow }) {
  const correction = row.correction;
  if (!correction) return null;
  const changed = correction.editor !== null;
  const fieldLabels: Record<string, string> = { title: 'العنوان', category: 'الفئة', alternatives: 'الأوجه' };

  const candidateHref = correction.candidate
    ? `/studio?section=candidates&differenceType=${encodeURIComponent(correction.candidate.differenceType)}&engineMerged=${correction.candidate.engineMerged ? '1' : '0'}&editorWantsMerge=${correction.candidate.editorWantsMerge ? '1' : '0'}&ayah=${row.ayahKey}&variant=${encodeURIComponent(row.variantId)}`
    : null;

  return (
    <div className="mb-3 rounded-lg border border-stone-200 bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-stone-800">
          المحرك (أ) ← المحرر (ب) ← المعتمد
          <span className="mr-1 font-normal text-stone-500">لُقطت {formatDate(correction.capturedAt)}</span>
        </p>
        {candidateHref && (
          <Link
            href={candidateHref}
            className="rounded-md border border-violet-300 bg-violet-50 px-2 py-0.5 text-[10.5px] font-medium text-violet-800 hover:bg-violet-100"
          >
            أنشئ قاعدة من هذا التصحيح
          </Link>
        )}
      </div>
      {correction.reason && (
        <p className="mt-1.5 rounded bg-stone-50 px-2 py-1 text-[10.5px] text-stone-600">
          السبب: {correction.reason}
          {correction.actor ? ` — المصدر: ${correction.actor}` : ''}
        </p>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        <CorrectionColumn label="أ. اقتراح المحرك" state={correction.engine} tone="cyan" />
        <div className="rounded border border-violet-200 bg-violet-50/60 p-2">
          <p className="text-[10.5px] font-semibold text-violet-900">ب. تغيير المحرر</p>
          {changed ? (
            <ul className="mt-1 space-y-0.5 text-[10.5px] text-violet-900">
              {correction.editor?.changedFields.map((field) => (
                <li key={field}>غُيِّر: {fieldLabels[field] ?? field}</li>
              ))}
              {correction.editor?.at && <li className="text-violet-700/80">في {formatDate(correction.editor.at)}</li>}
            </ul>
          ) : (
            <p className="mt-1 text-[10.5px] text-violet-700/80">لم يغيّر المحرر شيئا؛ المعتمد هو اقتراح المحرك.</p>
          )}
        </div>
        <CorrectionColumn label="المعتمد (النهائي)" state={correction.final} tone="emerald" />
      </div>
    </div>
  );
}

function CorrectionColumn({
  label,
  state,
  tone,
}: {
  label: string;
  state: NonNullable<TrackingRow['correction']>['engine'];
  tone: 'cyan' | 'emerald';
}) {
  const box = tone === 'cyan' ? 'border-cyan-200 bg-cyan-50/60 text-cyan-900' : 'border-emerald-200 bg-emerald-50/60 text-emerald-900';
  return (
    <div className={`rounded border p-2 ${box}`}>
      <p className="text-[10.5px] font-semibold">{label}</p>
      <p className="mt-1 text-[10.5px]">
        {state.title} <span className="opacity-70">({CATEGORY_LABELS[state.category]})</span>
      </p>
      <ul className="mt-0.5 space-y-0.5 text-[10.5px]">
        {state.alternatives.length === 0 ? (
          <li className="opacity-70">لا أوجه</li>
        ) : (
          state.alternatives.map((alternative, index) => (
            <li key={alternative.id}>
              {toArabicDigits(index + 1)}. {alternative.label || alternative.text}
            </li>
          ))
        )}
      </ul>
    </div>
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
  tone: 'stone' | 'cyan' | 'emerald' | 'violet' | 'rose' | 'amber' | 'sky';
}) {
  const tones = {
    stone: 'border-stone-200 bg-white text-stone-900',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-2xl font-bold tabular-nums">{toArabicDigits(value)}</div>
      <div className="mt-0.5 text-[11px] opacity-80">{label}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-medium ${
        active ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
      }`}
    >
      {children}
    </button>
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

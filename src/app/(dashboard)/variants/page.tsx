// فهرس الاختلافات والقواعد - Variants Index
//
// يجمع هذا الموضع كل ما أضيف إلى المشروع: اختلافات آيات محفوظة وقواعد عامة
// للمصحف. لا يضطر المحقق إلى تذكر السورة أو فتح الآيات واحدة واحدة للمراجعة.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ScopePicker } from '@/components/editor/VariantEditor';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { describeScope, resolveScope } from '@/lib/tashjeer/scope';
import { readTransmissionCatalog } from '@/lib/transmissions/catalog';
import {
  createGlobalRuleId,
  deleteGlobalRule,
  listGlobalRules,
  saveGlobalRule,
  type GlobalRule,
} from '@/lib/storage/global-rules-store';
import { listDocuments, loadDocument } from '@/lib/storage/document-store';
import { getSurahOrFirst } from '@/data/quran';
import { describeGlobalPattern } from '@/lib/quran-logic/global-rule-engine';
import { RuleOccurrenceReview } from '@/components/editor/RuleOccurrenceReview';
import { StrengthDegreePicker } from '@/components/editor/StrengthDegreePicker';
import { pruneStrengthMap } from '@/lib/tashjeer/strength-degrees';
import { occurrenceStats } from '@/lib/storage/rule-occurrences-store';
import type { VariantCategory } from '@/types';
import type { ReaderStrengthMap, ReadingScope, Variant, VerificationStatus } from '@/types/tashjeer';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as VariantCategory[];
const STATUS_OPTIONS: Array<{ value: VerificationStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'كل الحالات' },
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'REVIEW', label: 'قيد المراجعة' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'REJECTED', label: 'مرفوض' },
];

type IndexedVariant = {
  key: string;
  type: 'LOCAL' | 'GLOBAL';
  title: string;
  category: VariantCategory;
  status: VerificationStatus;
  scope: ReadingScope;
  description?: string;
  sourceRef?: string;
  updatedAt: string;
  isActive: boolean;
  surahNumber?: number;
  surahName?: string;
  ayahNumber?: number;
  ayahKey?: number;
  variantId?: string;
  targetText: string;
  alternativesCount: number;
  globalRule?: GlobalRule;
};

export default function VariantsIndexPage() {
  const [items, setItems] = useState<IndexedVariant[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<VariantCategory | 'ALL'>('ALL');
  const [status, setStatus] = useState<VerificationStatus | 'ALL'>('ALL');
  const [type, setType] = useState<'ALL' | IndexedVariant['type']>('ALL');
  const [readerId, setReaderId] = useState('');
  const [editingRule, setEditingRule] = useState<GlobalRule | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [reviewingRule, setReviewingRule] = useState<GlobalRule | null>(null);
  const catalog = useMemo(() => readTransmissionCatalog(), []);

  const load = () => setItems(readIndexedVariants());
  useEffect(load, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ar');
    return items.filter((item) => {
      if (category !== 'ALL' && item.category !== category) return false;
      if (status !== 'ALL' && item.status !== status) return false;
      if (type !== 'ALL' && item.type !== type) return false;
      if (readerId && !resolveScope(item.scope, catalog).includes(readerId)) return false;
      if (!normalized) return true;

      const haystack = [
        item.title,
        item.description,
        item.sourceRef,
        item.surahName,
        item.targetText,
        describeScope(item.scope, { catalog }),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('ar');
      return haystack.includes(normalized);
    });
  }, [catalog, category, items, query, readerId, status, type]);

  const localCount = items.filter((item) => item.type === 'LOCAL').length;
  const globalCount = items.filter((item) => item.type === 'GLOBAL').length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">فهرس الاختلافات والقواعد</h1>
          <p className="mt-0.5 text-sm text-stone-600">
            ابحث وصفِّ كل ما أُضيف إلى الآيات أو ما يسري على المصحف كله من موضع واحد.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingRule(null);
            setShowRuleForm(true);
          }}
          className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
        >
          + قاعدة عامة للمصحف
        </button>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_150px_150px_150px_190px]">
          <label>
            <span className="mb-1 block text-[11px] font-medium text-stone-600">بحث</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="العنوان، الحكم، السورة، المرجع أو القارئ..."
              className="input"
            />
          </label>
          <FilterSelect label="النوع" value={type} onChange={(value) => setType(value as typeof type)}>
            <option value="ALL">المحلي والعام</option>
            <option value="LOCAL">اختلافات الآيات</option>
            <option value="GLOBAL">قواعد عامة</option>
          </FilterSelect>
          <FilterSelect label="الفئة" value={category} onChange={(value) => setCategory(value as typeof category)}>
            <option value="ALL">كل الفئات</option>
            {ALL_CATEGORIES.map((value) => (
              <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="الحالة" value={status} onChange={(value) => setStatus(value as typeof status)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="القارئ / الراوي" value={readerId} onChange={setReaderId}>
            <option value="">كل القراء</option>
            {catalog.imams.map((imam) => (
              <optgroup key={imam.id} label={imam.name}>
                {catalog.narrators
                  .filter((narrator) => narrator.imamId === imam.id)
                  .map((narrator) => (
                    <option key={narrator.id} value={narrator.id}>{narrator.name}</option>
                  ))}
              </optgroup>
            ))}
          </FilterSelect>
        </div>
        <p className="mt-3 text-[11px] text-stone-500">
          {visible.length} نتيجة من {items.length} — {localCount} اختلافا موضعيا و{globalCount} قاعدة عامة.
        </p>
      </section>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-5 py-12 text-center text-sm text-stone-500">
          لا توجد عناصر توافق هذه التصفية. أضف اختلافا من المحرر أو قاعدة عامة للمصحف.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.key} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: getCategorySoftColor(item.category), color: getCategoryColor(item.category) }}
                    >
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <TypeBadge type={item.type} active={item.isActive} />
                    <StatusBadge status={item.status} />
                    {item.surahName && (
                      <span className="text-[11px] text-stone-500">{item.surahName} · آية {item.ayahNumber}</span>
                    )}
                  </div>
                  <h2 className="mt-2 text-base font-bold text-stone-900">{item.title || 'بلا عنوان'}</h2>
                  <p className="mt-1 text-sm text-stone-700" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
                    {item.targetText}
                  </p>
                  <p className="mt-1.5 text-xs text-stone-600">
                    {describeScope(item.scope, { catalog })} · {resolveScope(item.scope, catalog).length} راويا
                    {item.alternativesCount > 0 ? ` · ${item.alternativesCount} وجها` : ''}
                  </p>
                  {item.globalRule && (
                    <p className="mt-1 text-[11px] text-violet-700">
                      التطبيق: {describeGlobalPattern(item.globalRule.pattern)}
                    </p>
                  )}
                  {item.globalRule?.pattern && <OccurrenceSummary ruleId={item.globalRule.id} />}
                  {item.description && <p className="mt-1 text-xs leading-relaxed text-stone-500">{item.description}</p>}
                  {item.sourceRef && <p className="mt-1 text-[11px] text-stone-400">المرجع: {item.sourceRef}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.type === 'LOCAL' && item.ayahKey && item.variantId ? (
                    <Link
                      href={`/editor?ayah=${item.ayahKey}&variant=${encodeURIComponent(item.variantId)}`}
                      className="rounded border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50"
                    >
                      فتح في المحرر
                    </Link>
                  ) : null}
                  {item.globalRule && (
                    <>
                      {item.globalRule.pattern && (
                        <button
                          type="button"
                          onClick={() => setReviewingRule(item.globalRule ?? null)}
                          className="rounded border border-violet-200 px-2.5 py-1.5 text-xs text-violet-800 hover:bg-violet-50"
                          title="مراجعة مواضع القاعدة موضعا موضعا"
                        >
                          تتبّع المواضع
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRule(item.globalRule ?? null);
                          setShowRuleForm(true);
                        }}
                        className="rounded border border-stone-300 px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
                      >
                        تحرير
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`حذف القاعدة العامة «${item.title}» من المصحف كله؟`)) return;
                          deleteGlobalRule(item.globalRule!.id);
                          load();
                        }}
                        className="rounded border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50"
                      >
                        حذف
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviewingRule && (
        <RuleOccurrenceReview
          rule={reviewingRule}
          onClose={() => {
            setReviewingRule(null);
            load();
          }}
        />
      )}

      {showRuleForm && (
        <GlobalRuleDialog
          rule={editingRule}
          onClose={() => setShowRuleForm(false)}
          onSaved={() => {
            setShowRuleForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/**
 * ملخّص حالة مواضع القاعدة: كم موضعا حُذف موضعيا وكم روجع.
 * يُقرأ من مخزن الاستثناءات وحده بلا فحص للمصحف، فلا يكلّف شيئا في القائمة.
 */
function OccurrenceSummary({ ruleId }: { ruleId: string }) {
  const stats = useMemo(() => occurrenceStats(ruleId), [ruleId]);
  if (stats.deleted === 0 && stats.confirmed === 0 && stats.edited === 0) return null;

  return (
    <p className="mt-1 flex flex-wrap gap-2 text-[11px]">
      {stats.confirmed > 0 && (
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{stats.confirmed} موضعا معتمدا</span>
      )}
      {stats.deleted > 0 && (
        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-800">{stats.deleted} موضعا محذوفا</span>
      )}
      {stats.edited > 0 && (
        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-800">
          {stats.edited} بدرجة مخصَّصة
        </span>
      )}
    </p>
  );
}

function readIndexedVariants(): IndexedVariant[] {
  const local: IndexedVariant[] = [];
  for (const entry of listDocuments()) {
    const document = loadDocument(entry.ayahKey);
    if (!document) continue;
    const surahName = getSurahOrFirst(document.surahNumber).name;
    for (const variant of document.variants) local.push(toLocalItem(document, variant, surahName));
  }

  const global = listGlobalRules().map((rule): IndexedVariant => ({
    key: `global:${rule.id}`,
    type: 'GLOBAL',
    title: rule.title,
    category: rule.category,
    status: rule.status,
    scope: rule.scope,
    description: rule.description,
    sourceRef: rule.sourceRef,
    updatedAt: rule.updatedAt,
    isActive: rule.isActive,
    targetText: rule.ruleLabel || 'قاعدة عامة للمصحف كله',
    alternativesCount: 0,
    globalRule: rule,
  }));

  return [...local, ...global].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

function toLocalItem(
  document: NonNullable<ReturnType<typeof loadDocument>>,
  variant: Variant,
  surahName: string
): IndexedVariant {
  const drawable = variant.alternatives.filter((alternative) => !alternative.isBase);
  const combinedNarrators = [...new Set(drawable.flatMap((alternative) => resolveScope(alternative.scope, readTransmissionCatalog())))];
  const targetText = variant.targetKind === 'CHARACTERS' && variant.characterRange
    ? `موضع حرفي: كلمة ${variant.characterRange.start.position} / حرف ${variant.characterRange.start.characterIndex} إلى كلمة ${variant.characterRange.end.position} / حرف ${variant.characterRange.end.characterIndex}`
    : `الكلمات ${variant.startPosition}${variant.endPosition !== variant.startPosition ? `–${variant.endPosition}` : ''}`;

  return {
    key: `local:${document.ayahKey}:${variant.id}`,
    type: 'LOCAL',
    title: variant.title,
    category: variant.category,
    status: variant.status,
    scope: { kind: 'NARRATORS', narratorIds: combinedNarrators },
    description: variant.description,
    sourceRef: variant.sourceRef,
    updatedAt: document.meta.updatedAt,
    isActive: true,
    surahNumber: document.surahNumber,
    surahName,
    ayahNumber: document.ayahNumber,
    ayahKey: document.ayahKey,
    variantId: variant.id,
    targetText,
    alternativesCount: drawable.length,
  };
}

function GlobalRuleDialog({
  rule,
  onClose,
  onSaved,
}: {
  rule: GlobalRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(rule?.title ?? '');
  const [category, setCategory] = useState<VariantCategory>(rule?.category ?? 'TAJWEED');
  const [scope, setScope] = useState<ReadingScope>(rule?.scope ?? { kind: 'NARRATORS', narratorIds: [] });
  const [ruleLabel, setRuleLabel] = useState(rule?.ruleLabel ?? '');
  const [maddHarakat, setMaddHarakat] = useState(rule?.maddHarakat?.toString() ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [sourceRef, setSourceRef] = useState(rule?.sourceRef ?? '');
  const [status, setStatus] = useState<VerificationStatus>(rule?.status ?? 'DRAFT');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [strengthDegreeId, setStrengthDegreeId] = useState<string | undefined>(rule?.strengthDegreeId);
  const [strengthByNarrator, setStrengthByNarrator] = useState<ReaderStrengthMap | undefined>(
    rule?.strengthByNarrator
  );
  const [error, setError] = useState('');

  const save = () => {
    if (!title.trim()) {
      setError('اكتب عنوان القاعدة العامة.');
      return;
    }
    if (resolveScope(scope, readTransmissionCatalog()).length === 0) {
      setError('اختر قارئا أو راويا واحدا على الأقل لهذه القاعدة.');
      return;
    }
    saveGlobalRule({
      id: rule?.id ?? createGlobalRuleId(),
      title,
      category,
      scope,
      ruleLabel: ruleLabel.trim() || undefined,
      maddHarakat: maddHarakat === '' ? undefined : Number(maddHarakat),
      description: description.trim() || undefined,
      sourceRef: sourceRef.trim() || undefined,
      evidences: rule?.evidences ?? [],
      pattern: rule?.pattern,
      strengthDegreeId,
      // ما خُصِّص لراوٍ خرج من نطاق القاعدة لا يُحفظ، فلا تبقى تخصيصات معلّقة.
      strengthByNarrator: pruneStrengthMap(strengthByNarrator, resolveScope(scope, readTransmissionCatalog())),
      status,
      isActive,
      createdAt: rule?.createdAt,
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" role="dialog" aria-modal="true" aria-label="قاعدة عامة للمصحف">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">{rule ? 'تحرير قاعدة عامة' : 'قاعدة عامة للمصحف'}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
              تحفظ مرة واحدة وتظهر في فهرس المصحف وفي JSON كل آية. القاعدة الوصفية لا ترسم خطا حتى يسجل موضعها محليا، أما القاعدة النمطية المنشأة من المحرر فتطبق آليا على كل موضع مطابق.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50">إغلاق</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="عنوان القاعدة">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: مد المنفصل لورش" className="input" autoFocus />
          </Field>
          <Field label="الفئة">
            <select value={category} onChange={(event) => setCategory(event.target.value as VariantCategory)} className="input">
              {ALL_CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}
            </select>
          </Field>
          <Field label="اسم الحكم المختصر">
            <input value={ruleLabel} onChange={(event) => setRuleLabel(event.target.value)} placeholder="مثال: مد منفصل" className="input" />
          </Field>
          <Field label="حركات المد (اختياري)">
            <input type="number" min={0} max={6} value={maddHarakat} onChange={(event) => setMaddHarakat(event.target.value)} placeholder="٤ أو ٥ أو ٦" className="input" />
          </Field>
          <Field label="الحالة">
            <select value={status} onChange={(event) => setStatus(event.target.value as VerificationStatus)} className="input">
              {STATUS_OPTIONS.filter((option) => option.value !== 'ALL').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="مرجع الاستقاء">
            <input value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} placeholder="مثال: طيبة النشر، باب المد" className="input" />
          </Field>
          <Field label="الشرح" className="md:col-span-2">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="input resize-y" placeholder="ما الذي يطبق، وما حدود القاعدة؟" />
          </Field>
        </div>

        <div className="mt-4 rounded-md border border-stone-200 p-3">
          <ScopePicker scope={scope} onChange={setScope} />
        </div>

        <div className="mt-4 rounded-md border border-stone-200 p-3">
          <StrengthDegreePicker
            scope={scope}
            degreeId={strengthDegreeId}
            byNarrator={strengthByNarrator}
            onChange={(next) => {
              setStrengthDegreeId(next.degreeId);
              setStrengthByNarrator(next.byNarrator);
            }}
            hint="درجة قوة هذا الوجه. خصّصها لكل راوٍ إن اختلف الترجيح بينهم؛ ومواضع بعينها يمكن تخصيصها من شاشة تتبّع المواضع."
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs text-stone-700">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="accent-emerald-600" />
          القاعدة نشطة حاليا
        </label>
        {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-stone-300 px-4 py-2 text-xs text-stone-700 hover:bg-stone-50">إلغاء</button>
          <button type="button" onClick={save} className="rounded bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700">حفظ القاعدة</button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-medium text-stone-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input">{children}</select>
    </label>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

function TypeBadge({ type, active }: { type: IndexedVariant['type']; active: boolean }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${type === 'GLOBAL' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>
      {type === 'GLOBAL' ? (active ? 'قاعدة عامة · نشطة' : 'قاعدة عامة · موقوفة') : 'اختلاف آية'}
    </span>
  );
}

function StatusBadge({ status }: { status: VerificationStatus }) {
  const labels: Record<VerificationStatus, string> = { DRAFT: 'مسودة', REVIEW: 'مراجعة', APPROVED: 'معتمد', REJECTED: 'مرفوض' };
  const colors: Record<VerificationStatus, string> = { DRAFT: 'bg-stone-100 text-stone-600', REVIEW: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800' };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[status]}`}>{labels[status]}</span>;
}

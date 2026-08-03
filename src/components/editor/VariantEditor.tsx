// محرر الاختلاف - Variant Editor
// مشروع التشجير - نظام القراءات العشر
//
// نافذة تحرير كاملة لاختلاف واحد: بياناته، وأوجهه، ونطاق كل وجه، وأدلته.
//
// أهم جزء هنا هو محدد النطاق (ScopePicker): يسمح باختيار الرواة بالنقر،
// أو باختيار إمام كامل بنقرة واحدة، ثم يُختصر الاختيار تلقائيا إلى أبسط
// تعبير ممكن عبر normalizeScope. هذا يمنع تضخم البيانات ويحفظ المعنى.

'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getImamColor } from '@/lib/tashjeer/color-system';
import { describeScope, normalizeScope, resolveScope } from '@/lib/tashjeer/scope';
import { getNarratorSymbol } from '@/lib/tashjeer/symbols';
import type { VariantCategory } from '@/types';
import type {
  EvidenceSource,
  ReadingScope,
  Variant,
  VariantAlternative,
  VerificationStatus,
} from '@/types/tashjeer';

interface VariantEditorProps {
  variant: Variant;
  onClose: () => void;
}

const STATUS_OPTIONS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'REVIEW', label: 'قيد المراجعة' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'REJECTED', label: 'مرفوض' },
];

const SOURCE_OPTIONS: Array<{ value: EvidenceSource; label: string }> = [
  { value: 'TAYYIBAH', label: 'طيبة النشر' },
  { value: 'NASHR', label: 'النشر' },
  { value: 'JANNAH', label: 'الجنة' },
  { value: 'OTHER', label: 'مصدر آخر' },
];

export function VariantEditor({ variant, onClose }: VariantEditorProps) {
  const { updateVariant, addAlternative, updateAlternative, deleteAlternative } = useEditorStore();
  const catalog = useTransmissionCatalog();
  const [activeAlternativeId, setActiveAlternativeId] = useState<string | null>(
    variant.alternatives.find((alternative) => !alternative.isBase)?.id ?? null
  );

  const activeAlternative = variant.alternatives.find(
    (alternative) => alternative.id === activeAlternativeId
  );

  const handleAddAlternative = () => {
    const id = `${variant.id}-alt-${Date.now().toString(36)}`;
    addAlternative(variant.id, {
      id,
      text: variant.title,
      label: 'وجه جديد',
      scope: { kind: 'NARRATORS', narratorIds: [] },
    });
    setActiveAlternativeId(id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`تحرير الاختلاف ${variant.title}`}
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">تحرير الاختلاف</h2>
            <p className="text-xs text-stone-500">
              الكلمات {variant.startPosition}
              {variant.endPosition !== variant.startPosition ? `–${variant.endPosition}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
          >
            إغلاق
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {/* بيانات الاختلاف */}
          <section className="grid gap-3 md:grid-cols-2">
            <Field label="العنوان">
              <input
                type="text"
                value={variant.title}
                onChange={(event) => updateVariant(variant.id, { title: event.target.value })}
                className="input"
              />
            </Field>

            <Field label="الفئة">
              <select
                value={variant.category}
                onChange={(event) =>
                  updateVariant(variant.id, { category: event.target.value as VariantCategory })
                }
                className="input"
              >
                {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="من الكلمة">
              <input
                type="number"
                min={1}
                value={variant.startPosition}
                onChange={(event) => {
                  const startPosition = Math.max(1, Number(event.target.value));
                  updateVariant(variant.id, {
                    startPosition,
                    endPosition: Math.max(startPosition, variant.endPosition),
                  });
                }}
                className="input"
              />
            </Field>

            <Field label="إلى الكلمة">
              <input
                type="number"
                min={variant.startPosition}
                value={variant.endPosition}
                onChange={(event) =>
                  updateVariant(variant.id, {
                    endPosition: Math.max(variant.startPosition, Number(event.target.value)),
                  })
                }
                className="input"
              />
            </Field>

            <Field label="الحالة">
              <select
                value={variant.status}
                onChange={(event) =>
                  updateVariant(variant.id, { status: event.target.value as VerificationStatus })
                }
                className="input"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="مرجع الاستقاء">
              <input
                type="text"
                value={variant.sourceRef ?? ''}
                onChange={(event) => updateVariant(variant.id, { sourceRef: event.target.value })}
                placeholder="مثال: النشر - فرش سورة البقرة"
                className="input"
              />
            </Field>

            <Field label="الشرح" className="md:col-span-2">
              <textarea
                value={variant.description ?? ''}
                onChange={(event) => updateVariant(variant.id, { description: event.target.value })}
                rows={2}
                className="input resize-y"
                placeholder="شرح مختصر لطبيعة الاختلاف وأثره."
              />
            </Field>
          </section>

          {/* الأوجه */}
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">الأوجه</h3>
              <button
                type="button"
                onClick={handleAddAlternative}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                إضافة وجه
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <ul className="space-y-1.5">
                {variant.alternatives.map((alternative) => {
                  const count = resolveScope(alternative.scope, catalog).length;
                  const active = alternative.id === activeAlternativeId;

                  return (
                    <li key={alternative.id}>
                      <button
                        type="button"
                        onClick={() => setActiveAlternativeId(alternative.id)}
                        className={`w-full rounded-md border px-2.5 py-2 text-start transition-colors ${
                          active
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                      >
                        <span
                          className="block text-sm text-stone-900"
                          style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                        >
                          {alternative.text || '—'}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-stone-600">
                          {alternative.label}
                        </span>
                        <span className="block text-[11px] text-stone-500">
                          {alternative.isBase ? 'وجه المصحف · ' : ''}
                          {count} راويا
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {activeAlternative ? (
                <AlternativeEditor
                  variantId={variant.id}
                  alternative={activeAlternative}
                  onUpdate={(patch) =>
                    updateAlternative(variant.id, activeAlternative.id, patch)
                  }
                  onDelete={() => {
                    deleteAlternative(variant.id, activeAlternative.id);
                    setActiveAlternativeId(null);
                  }}
                />
              ) : (
                <p className="rounded-md border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
                  اختر وجها من القائمة لتحريره.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ==================== محرر الوجه ====================

function AlternativeEditor({
  alternative,
  onUpdate,
  onDelete,
}: {
  variantId: string;
  alternative: VariantAlternative;
  onUpdate: (patch: Partial<VariantAlternative>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4 rounded-md border border-stone-200 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="نص الوجه">
          <input
            type="text"
            value={alternative.text}
            onChange={(event) => onUpdate({ text: event.target.value })}
            className="input"
            style={{ fontFamily: "'Amiri Quran', 'Amiri', serif", fontSize: '1.05rem' }}
          />
        </Field>

        <Field label="وصف الوجه">
          <input
            type="text"
            value={alternative.label}
            onChange={(event) => onUpdate({ label: event.target.value })}
            placeholder="مثال: بالألف، بالتسهيل، بضم الهاء"
            className="input"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-xs text-stone-700">
        <input
          type="checkbox"
          checked={alternative.isBase ?? false}
          onChange={(event) => onUpdate({ isBase: event.target.checked })}
          className="h-3.5 w-3.5 accent-emerald-600"
        />
        هذا هو وجه المصحف المطبوع (رواية حفص) — لا يُرسم له خط
      </label>

      <ScopePicker scope={alternative.scope} onChange={(scope) => onUpdate({ scope })} />

      <Field label="ملاحظات المحرر">
        <textarea
          value={alternative.notes ?? ''}
          onChange={(event) => onUpdate({ notes: event.target.value })}
          rows={2}
          className="input resize-y"
          placeholder="مثال: يحتاج تحرير الطرق، أو خلاف بين طريقي الأزرق والأصبهاني."
        />
      </Field>

      <EvidenceList
        evidences={alternative.evidences ?? []}
        onChange={(evidences) => onUpdate({ evidences })}
      />

      {!alternative.isBase && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50"
        >
          حذف هذا الوجه
        </button>
      )}
    </div>
  );
}

// ==================== محدد النطاق ====================

/**
 * محدد النطاق: يعرض القراء العشرة وتحت كل واحد راوييه.
 * النقر على اسم الإمام يختار رواته كلهم أو يلغيهم.
 * الاختيار يُختصر تلقائيا إلى أبسط تعبير عبر normalizeScope.
 */
function ScopePicker({
  scope,
  onChange,
}: {
  scope: ReadingScope;
  onChange: (scope: ReadingScope) => void;
}) {
  const catalog = useTransmissionCatalog();
  const [pickerMode, setPickerMode] = useState<'narrators' | 'paths'>(
    scope.kind === 'PATHS' ? 'paths' : 'narrators'
  );

  const selected = useMemo(() => new Set(resolveScope(scope, catalog)), [scope, catalog]);

  const selectedPathIds = useMemo(() => {
    if (scope.kind === 'PATHS') return new Set(scope.pathIds ?? []);
    return new Set<string>();
  }, [scope]);

  const toggleNarrator = (narratorId: string) => {
    const next = new Set(selected);
    if (next.has(narratorId)) next.delete(narratorId);
    else next.add(narratorId);
    onChange(normalizeScope([...next], catalog));
  };

  const toggleImam = (imamId: string) => {
    const imamNarrators = catalog.narrators.filter((narrator) => narrator.imamId === imamId);
    const allSelected = imamNarrators.every((narrator) => selected.has(narrator.id));

    const next = new Set(selected);
    for (const narrator of imamNarrators) {
      if (allSelected) next.delete(narrator.id);
      else next.add(narrator.id);
    }

    onChange(normalizeScope([...next], catalog));
  };

  const togglePath = (pathId: string) => {
    const nextPaths = new Set(selectedPathIds);
    if (nextPaths.has(pathId)) {
      nextPaths.delete(pathId);
    } else {
      nextPaths.add(pathId);
    }

    if (nextPaths.size > 0) {
      onChange({
        kind: 'PATHS',
        pathIds: [...nextPaths],
      });
    } else {
      onChange({
        kind: 'NARRATORS',
        narratorIds: [],
      });
    }
  };

  return (
    <div>
      {/* طريقة التحديد */}
      <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2">
        <span className="text-xs font-semibold text-stone-700">طريقة التحديد</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setPickerMode('narrators');
              if (scope.kind === 'PATHS') {
                onChange({ kind: 'NARRATORS', narratorIds: resolveScope(scope, catalog) });
              }
            }}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              pickerMode === 'narrators'
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            القراء والرواة
          </button>
          <button
            type="button"
            onClick={() => {
              setPickerMode('paths');
              if (scope.kind !== 'PATHS') {
                const narratorIds = resolveScope(scope, catalog);
                const pathIds = catalog.paths.filter((p) =>
                  narratorIds.includes(p.narratorId)
                ).map((p) => p.id);
                onChange({ kind: 'PATHS', pathIds });
              }
            }}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              pickerMode === 'paths'
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            الطرق التفصيلية
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-stone-500">
          {pickerMode === 'narrators' ? 'اختر الأئمة أو الرواة:' : 'اختر الطرق الفرعية:'}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (pickerMode === 'paths') {
                onChange({ kind: 'PATHS', pathIds: catalog.paths.map((p) => p.id) });
              } else {
                onChange({ kind: 'ALL' });
              }
            }}
            className="rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100"
          >
            الجميع
          </button>
          <button
            type="button"
            onClick={() => {
              if (pickerMode === 'paths') {
                onChange({ kind: 'PATHS', pathIds: [] });
              } else {
                onChange({ kind: 'NARRATORS', narratorIds: [] });
              }
            }}
            className="rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100"
          >
            تفريغ
          </button>
        </div>
      </div>

      {pickerMode === 'narrators' ? (
        <div className="grid grid-cols-2 gap-1.5 rounded-md border border-stone-200 p-2 md:grid-cols-5">
          {catalog.imams.map((imam) => {
            const imamNarrators = catalog.narrators.filter((narrator) => narrator.imamId === imam.id);
            const allSelected = imamNarrators.every((narrator) => selected.has(narrator.id));
            const color = getImamColor(imam.id);
            const imamSymbols = imamNarrators.map((n) => getNarratorSymbol(n.id, catalog)).filter(Boolean).join('');

            return (
              <div key={imam.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleImam(imam.id)}
                  className={`w-full rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    allSelected ? 'text-white' : 'text-stone-700 hover:bg-stone-100'
                  }`}
                  style={{ backgroundColor: allSelected ? color : '#f5f5f4' }}
                >
                  {imam.name}
                  {imamSymbols && (
                    <span className="ms-1 opacity-80" style={{ fontFamily: "'Amiri Quran', serif" }}>
                      {imamSymbols}
                    </span>
                  )}
                </button>

                {imamNarrators.map((narrator) => {
                  const isSelected = selected.has(narrator.id);
                  const symbol = getNarratorSymbol(narrator.id, catalog);
                  return (
                    <button
                      key={narrator.id}
                      type="button"
                      onClick={() => toggleNarrator(narrator.id)}
                      className={`flex w-full items-center justify-between gap-1 rounded border px-1.5 py-1 text-[11px] transition-colors ${
                        isSelected
                          ? 'border-transparent text-white'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                      style={{ backgroundColor: isSelected ? color : undefined }}
                    >
                      <span>{narrator.name}</span>
                      {symbol && (
                        <span style={{ fontFamily: "'Amiri Quran', serif" }}>{symbol}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 rounded-md border border-stone-200 p-2 md:grid-cols-5">
          {catalog.imams.map((imam) => {
            const imamNarrators = catalog.narrators.filter((narrator) => narrator.imamId === imam.id);
            const color = getImamColor(imam.id);

            return (
              <div key={imam.id} className="space-y-2 rounded bg-stone-50/50 p-1.5 border border-stone-100">
                <div
                  className="rounded px-1.5 py-0.5 text-[11px] font-bold text-center text-white"
                  style={{ backgroundColor: color }}
                >
                  {imam.name}
                </div>

                {imamNarrators.map((narrator) => {
                  const paths = catalog.paths.filter((p) => p.narratorId === narrator.id);
                  return (
                    <div key={narrator.id} className="space-y-1">
                      <div className="text-[10px] font-bold text-stone-700 px-1 border-b border-stone-200 pb-0.5">
                        {narrator.name}
                      </div>
                      <div className="space-y-0.5">
                        {paths.map((path) => {
                          const isPathSelected = selectedPathIds.has(path.id);
                          const cleanPathName = path.shortName.split(' / ')[1] || path.shortName;
                          return (
                            <button
                              key={path.id}
                              type="button"
                              onClick={() => togglePath(path.id)}
                              className={`w-full text-start rounded px-1 py-0.5 text-[9px] font-medium transition-colors ${
                                isPathSelected
                                  ? 'text-white'
                                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                              }`}
                              style={{ backgroundColor: isPathSelected ? color : undefined }}
                              title={path.fullName}
                            >
                              {cleanPathName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-1.5 text-[11px] text-stone-600">
        النطاق المختصر: <span className="font-medium text-stone-800">{describeScope(scope, { catalog })}</span>{' '}
        ({pickerMode === 'paths' ? selectedPathIds.size : selected.size} من{' '}
        {pickerMode === 'paths' ? catalog.paths.length : catalog.narrators.length})
      </p>
    </div>
  );
}

// ==================== الأدلة ====================

function EvidenceList({
  evidences,
  onChange,
}: {
  evidences: NonNullable<VariantAlternative['evidences']>;
  onChange: (evidences: NonNullable<VariantAlternative['evidences']>) => void;
}) {
  const addEvidence = () => {
    onChange([
      ...evidences,
      {
        id: `ev-${Date.now().toString(36)}`,
        source: 'NASHR',
        text: '',
        reference: '',
      },
    ]);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-700">الأدلة</span>
        <button
          type="button"
          onClick={addEvidence}
          className="rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100"
        >
          إضافة دليل
        </button>
      </div>

      {evidences.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 px-2.5 py-2 text-[11px] text-stone-500">
          لا يوجد دليل مسجّل. الوجه بلا دليل يبقى مسودة ولا يصح اعتماده.
        </p>
      ) : (
        <ul className="space-y-2">
          {evidences.map((evidence, index) => (
            <li key={evidence.id} className="rounded border border-stone-200 p-2">
              <div className="grid gap-2 md:grid-cols-[130px_1fr_auto]">
                <select
                  value={evidence.source}
                  onChange={(event) =>
                    onChange(
                      evidences.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, source: event.target.value as EvidenceSource }
                          : item
                      )
                    )
                  }
                  className="input text-xs"
                >
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={evidence.reference ?? ''}
                  onChange={(event) =>
                    onChange(
                      evidences.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, reference: event.target.value } : item
                      )
                    )
                  }
                  placeholder="المرجع: رقم البيت أو الصفحة"
                  className="input text-xs"
                />

                <button
                  type="button"
                  onClick={() =>
                    onChange(evidences.filter((_, itemIndex) => itemIndex !== index))
                  }
                  className="rounded border border-red-200 px-2 text-[11px] text-red-700 hover:bg-red-50"
                >
                  حذف
                </button>
              </div>

              <textarea
                value={evidence.text}
                onChange={(event) =>
                  onChange(
                    evidences.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, text: event.target.value } : item
                    )
                  )
                }
                rows={2}
                placeholder="نص الدليل كما ورد في المصدر."
                className="input mt-2 resize-y text-xs"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ==================== عناصر مشتركة ====================

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

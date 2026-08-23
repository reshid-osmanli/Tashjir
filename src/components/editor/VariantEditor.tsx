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
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { characterCount } from '@/lib/quran-logic/characters';
import { pruneStrengthMap } from '@/lib/tashjeer/strength-degrees';
import { StrengthDegreePicker } from './StrengthDegreePicker';
import { OrderRankControl } from './OrderRankControl';
import type { VariantCategory } from '@/types';
import { resolveReaderChips } from '@/lib/tashjeer/reader-symbols';
import { boundsOfLoci, describeLoci, lociOfVariant } from '@/lib/tashjeer/loci';
import type {
  EvidenceSource,
  ReadingScope,
  Variant,
  VariantAlternative,
  VariantLocus,
  VerificationStatus,
} from '@/types/tashjeer';

interface VariantEditorProps {
  variant: Variant;
  onClose: () => void;
  /**
   * تحويل الاختلاف الحرفي إلى قاعدة عامة على المصحف كله، بنفس مدى الحروف
   * وبيانات وجهه الأول. تظهر الزر فقط عندما يكون التحديد حرفيا.
   */
  onGeneralize?: () => void;
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

export function VariantEditor({ variant, onClose, onGeneralize }: VariantEditorProps) {
  const { updateVariant, addAlternative, updateAlternative, deleteAlternative, setEffectiveOrderRank } =
    useEditorStore();
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
              المواضع: {describeLoci(lociOfVariant(variant))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onGeneralize && variant.targetKind === 'CHARACTERS' && variant.characterRange && (
              <button
                type="button"
                onClick={onGeneralize}
                className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-900 hover:bg-violet-100"
                title="تحويل هذا الاختلاف إلى قاعدة تُطبَّق على كل المواضع المطابقة في المصحف"
              >
                تعميم على المصحف
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
            >
              إغلاق
            </button>
          </div>
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

            <div className="md:col-span-2">
              <OrderRankControl
                value={variant.orderRank}
                onChange={(rank) => setEffectiveOrderRank(variant.id, rank)}
                hint="رتبة هذا الاختلاف في أسطر التشجير. الأصغر يعلو، والمتأثرون يُزاحون تلقائيا."
              />
            </div>

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

          <TargetEditor variant={variant} onUpdate={(patch) => updateVariant(variant.id, patch)} />
          <LociEditor variant={variant} onUpdate={(patch) => updateVariant(variant.id, patch)} />

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

// ==================== موضع الاختلاف ====================

/**
 * يبقي محرر الموضع الكلمات والحروف في المكان نفسه. الحقول هنا ليست بديلا عن
 * النقر على خلايا الحروف في اللوحة؛ هي تدقيق دقيق قابل للتصحيح والتوثيق قبل
 * اعتماد المادة العلمية.
 */
function TargetEditor({
  variant,
  onUpdate,
}: {
  variant: Variant;
  onUpdate: (patch: Partial<Variant>) => void;
}) {
  // كلمات نافذة العمل لا كلمات الآية وحدها: قد يكون الموضع في الآية
  // الموصولة بها، فلا يُعثر عليه لو اقتصرنا على كلمات آية المستند.
  const editorDocument = useEditorStore((state) => state.document);
  const words = useMemo(
    () => documentWindowWords(editorDocument ?? { ayahKey: variant.ayahKey }),
    [editorDocument, variant.ayahKey]
  );
  const isCharacters = variant.targetKind === 'CHARACTERS';
  const range = variant.characterRange;
  const startWord = words.find((word) => word.position === (range?.start.position ?? variant.startPosition));
  const endWord = words.find((word) => word.position === (range?.end.position ?? variant.endPosition));

  const setCharacterRange = (patch: {
    startPosition?: number;
    startIndex?: number;
    endPosition?: number;
    endIndex?: number;
  }) => {
    const startPosition = patch.startPosition ?? range?.start.position ?? variant.startPosition;
    const endPosition = patch.endPosition ?? range?.end.position ?? variant.endPosition;
    const startText = words.find((word) => word.position === startPosition)?.text ?? '';
    const endText = words.find((word) => word.position === endPosition)?.text ?? '';
    const startIndex = Math.min(
      Math.max(1, patch.startIndex ?? range?.start.characterIndex ?? 1),
      Math.max(characterCount(startText), 1)
    );
    const endIndex = Math.min(
      Math.max(1, patch.endIndex ?? range?.end.characterIndex ?? 1),
      Math.max(characterCount(endText), 1)
    );

    const start = { position: Math.min(startPosition, endPosition), characterIndex: startIndex };
    const end = { position: Math.max(startPosition, endPosition), characterIndex: endIndex };
    // إذا كان الطرفان في كلمة واحدة لا يجوز أن تنعكس الحروف.
    if (start.position === end.position && start.characterIndex > end.characterIndex) {
      end.characterIndex = start.characterIndex;
    }
    onUpdate({
      targetKind: 'CHARACTERS',
      startPosition: start.position,
      endPosition: end.position,
      characterRange: { start, end },
    });
  };

  return (
    <section className="mt-4 rounded-md border border-cyan-200 bg-cyan-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-cyan-950">دقة موضع الاختلاف</h3>
          <p className="mt-0.5 text-[11px] text-cyan-900/75">
            اختر الحروف لأحكام التجويد الدقيقة؛ تبقى الكلمات نطاقا تنظيميا لخط التشجير.
          </p>
        </div>
        <div className="flex rounded-md border border-cyan-200 bg-white p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onUpdate({ targetKind: 'WORDS', characterRange: undefined })}
            className={`rounded px-2 py-1 ${!isCharacters ? 'bg-cyan-700 text-white' : 'text-stone-600 hover:bg-cyan-50'}`}
          >
            كلمات
          </button>
          <button
            type="button"
            onClick={() => setCharacterRange({})}
            className={`rounded px-2 py-1 ${isCharacters ? 'bg-cyan-700 text-white' : 'text-stone-600 hover:bg-cyan-50'}`}
          >
            حروف
          </button>
        </div>
      </div>

      {isCharacters && range && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label={`بداية الحرف${startWord ? ` في «${startWord.text}»` : ''}`}>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={words.length}
                value={range.start.position}
                onChange={(event) => setCharacterRange({ startPosition: Number(event.target.value) })}
                className="input"
                aria-label="كلمة بداية نطاق الحروف"
              />
              <input
                type="number"
                min={1}
                max={characterCount(startWord?.text ?? '') || 1}
                value={range.start.characterIndex}
                onChange={(event) => setCharacterRange({ startIndex: Number(event.target.value) })}
                className="input"
                aria-label="حرف بداية النطاق"
              />
            </div>
          </Field>
          <Field label={`نهاية الحرف${endWord ? ` في «${endWord.text}»` : ''}`}>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={words.length}
                value={range.end.position}
                onChange={(event) => setCharacterRange({ endPosition: Number(event.target.value) })}
                className="input"
                aria-label="كلمة نهاية نطاق الحروف"
              />
              <input
                type="number"
                min={1}
                max={characterCount(endWord?.text ?? '') || 1}
                value={range.end.characterIndex}
                onChange={(event) => setCharacterRange({ endIndex: Number(event.target.value) })}
                className="input"
                aria-label="حرف نهاية النطاق"
              />
            </div>
          </Field>
          <p className="text-[10px] leading-relaxed text-cyan-900/75 sm:col-span-2">
            ترتيب كل زوج: رقم الكلمة ثم رقم الحرف. الحرف يشمل علاماته وحركاته التابعة في الرسم العثماني.
          </p>
        </div>
      )}
    </section>
  );
}

// ==================== المواضع المنفصلة ====================

/**
 * يحرر مواضع الاختلاف المتباعدة: صلة في كلمتين تُحفظ موضعين، لا مدى يملأ
 * ما بينهما. إضافة موضع أو حذفه يحدّث start/end تلقائيا.
 */
function LociEditor({
  variant,
  onUpdate,
}: {
  variant: Variant;
  onUpdate: (patch: Partial<Variant>) => void;
}) {
  const loci = lociOfVariant(variant);

  const commit = (next: VariantLocus[]) => {
    const bounds = boundsOfLoci(next);
    onUpdate({
      loci: next.length > 1 ? next : next.length === 1 ? undefined : [],
      startPosition: bounds.startPosition,
      endPosition: bounds.endPosition,
      characterRange: next.length === 1 ? next[0].characterRange : variant.characterRange,
      targetKind: next.some((locus) => locus.characterRange) ? 'CHARACTERS' : variant.targetKind,
    });
  };

  const splitIntoWords = () => {
    const positions: VariantLocus[] = [];
    for (const locus of loci) {
      for (let position = locus.startPosition; position <= locus.endPosition; position++) {
        positions.push({ startPosition: position, endPosition: position });
      }
    }
    commit(positions);
  };

  return (
    <section className="mt-4 rounded-md border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-amber-950">مواضع منفصلة على السطر نفسه</h3>
          <p className="mt-0.5 text-[11px] text-amber-900/75">
            كل موضع علامة مستقلة. لا يُرسم خط غليظ بين كلمتين متباعدتين.
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={splitIntoWords}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-[10px] text-amber-900 hover:bg-amber-100"
          >
            فصل الكلمات
          </button>
          <button
            type="button"
            onClick={() =>
              commit([
                ...loci,
                {
                  startPosition: variant.endPosition,
                  endPosition: variant.endPosition,
                },
              ])
            }
            className="rounded border border-amber-300 bg-white px-2 py-1 text-[10px] text-amber-900 hover:bg-amber-100"
          >
            + موضع
          </button>
        </div>
      </div>

      <ul className="mt-2 space-y-1.5">
        {loci.map((locus, index) => (
          <li key={`${locus.startPosition}-${locus.endPosition}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
            <label className="text-[10px] text-stone-600">
              من
              <input
                type="number"
                min={1}
                value={locus.startPosition}
                onChange={(event) => {
                  const startPosition = Math.max(1, Number(event.target.value));
                  commit(
                    loci.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, startPosition, endPosition: Math.max(startPosition, item.endPosition) }
                        : item
                    )
                  );
                }}
                className="input mt-0.5 h-7 text-xs"
              />
            </label>
            <label className="text-[10px] text-stone-600">
              إلى
              <input
                type="number"
                min={locus.startPosition}
                value={locus.endPosition}
                onChange={(event) => {
                  const endPosition = Math.max(locus.startPosition, Number(event.target.value));
                  commit(loci.map((item, itemIndex) => (itemIndex === index ? { ...item, endPosition } : item)));
                }}
                className="input mt-0.5 h-7 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={loci.length <= 1}
              onClick={() => commit(loci.filter((_, itemIndex) => itemIndex !== index))}
              className="self-end rounded border border-red-200 px-2 py-1 text-[10px] text-red-700 disabled:opacity-30"
            >
              حذف
            </button>
          </li>
        ))}
      </ul>
    </section>
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
  const catalog = useTransmissionCatalog();

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

      {/* البيانات التي تُطبع في الشجرة: اسم الحكم تحت الكلمة، وحركات المد
          في الهامش، وقوة الوجه التي يُرتَّب بها السطر. */}
      <div className="grid gap-3 rounded-md border border-emerald-100 bg-emerald-50/40 p-3 md:grid-cols-3">
        <Field label="اسم الحكم (يُطبع تحت الكلمة)">
          <input
            type="text"
            value={alternative.ruleLabel ?? ''}
            onChange={(event) => onUpdate({ ruleLabel: event.target.value || undefined })}
            placeholder="إمالة، تقليل، سكت، إدغام"
            className="input"
            style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
          />
        </Field>

        <Field label="حركات المد (الهامش الأيمن)">
          <input
            type="number"
            min={0}
            max={6}
            value={alternative.maddHarakat ?? ''}
            onChange={(event) =>
              onUpdate({
                maddHarakat: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
            placeholder="٤ أو ٥ أو ٦"
            className="input"
          />
        </Field>

        <div className="md:col-span-3">
          <StrengthDegreePicker
            scope={alternative.scope}
            degreeId={alternative.strengthDegreeId}
            byNarrator={alternative.strengthByNarrator}
            onChange={(next) =>
              onUpdate({
                strengthDegreeId: next.degreeId,
                strengthByNarrator: next.byNarrator,
              })
            }
            hint="الدرجة الأعلى رتبةً تأخذ السطر الأعلى تحت الآية عند اعتماد ترتيب قوة الوجه في لوحة التحكم. اترك الوجه بلا درجة إن لم ترجّح، فيتأخر عن الأوجه المرجَّحة."
          />
        </div>
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

      <ScopePicker
        scope={alternative.scope}
        onChange={(scope) =>
          onUpdate({
            scope,
            // تضييق النطاق يُسقط تخصيصات رواة لم يعودوا في الوجه، فلا تبقى بيانات ميتة.
            strengthByNarrator: pruneStrengthMap(
              alternative.strengthByNarrator,
              resolveScope(scope, catalog)
            ),
          })
        }
      />

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
export function ScopePicker({
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
            const imamSymbol = imam.symbol?.trim() || '';

            return (
              <div key={imam.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleImam(imam.id)}
                  className={`w-full rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    allSelected ? 'text-white' : 'text-stone-700 hover:bg-stone-100'
                  }`}
                  style={{ backgroundColor: allSelected ? color : '#f5f5f4' }}
                  title={allSelected ? 'راويان مجتمعان: يظهر رمز الإمام' : 'اختيار الراويين يظهر رمز الإمام'}
                >
                  {imam.name}
                  {imamSymbol && (
                    <span className="ms-1 opacity-80" style={{ fontFamily: "'Amiri Quran', serif" }}>
                      {imamSymbol}
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

      <ScopeSelectionSummary scope={scope} />

      <p className="mt-1.5 text-[11px] text-stone-600">
        النطاق المختصر: <span className="font-medium text-stone-800">{describeScope(scope, { catalog })}</span>{' '}
        ({pickerMode === 'paths' ? selectedPathIds.size : selected.size} من{' '}
        {pickerMode === 'paths' ? catalog.paths.length : catalog.narrators.length})
      </p>
    </div>
  );
}

/**
 * بطاقة الاختيار: طريق واحد → اسمه، طريقان → رمز الراوي،
 * راوٍ واحد → اسمه، راويان → رمز الإمام.
 */
function ScopeSelectionSummary({ scope }: { scope: ReadingScope }) {
  const catalog = useTransmissionCatalog();
  const chips = resolveReaderChips(scope, catalog);
  if (chips.length === 0) {
    return (
      <p className="mt-2 rounded border border-dashed border-stone-200 px-2 py-1.5 text-[11px] text-stone-500">
        لم يُختر قارئ بعد. اختر طريقا ليظهر اسمه، أو راويين ليظهر رمز الإمام.
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50/50 px-2 py-1.5">
      <span className="text-[10px] font-semibold text-emerald-900">سيظهر في طرف السطر:</span>
      {chips.map((chip) => {
        const text =
          chip.kind === 'PATH'
            ? chip.name
            : chip.kind === 'IMAM'
              ? chip.symbol || chip.name
              : chip.name;
        const hint =
          chip.kind === 'PATH'
            ? 'طريق منفرد: يُذكر اسمه'
            : chip.kind === 'IMAM'
              ? 'اجتمع الراويان: رمز الإمام'
              : 'راوٍ منفرد: يُذكر اسمه';
        return (
          <span
            key={`${chip.kind}-${chip.id}`}
            title={hint}
            className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-bold text-emerald-900"
            style={{ fontFamily: "'Amiri Quran', serif" }}
          >
            <span className="text-[9px] font-medium text-stone-500">
              {chip.kind === 'IMAM' ? 'إمام' : chip.kind === 'PATH' ? 'طريق' : 'راوٍ'}
            </span>
            {text}
          </span>
        );
      })}
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

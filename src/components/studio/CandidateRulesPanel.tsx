// القواعد المرشحة من التصحيحات — Candidate Rules Panel (FR-ES-12.3/12.4، AC-02.4)
// مشروع التشجير - نظام القراءات العشر
//
// حلقة التعلم: تصحيح ← قاعدة مرشحة. هذا الجزء يعرض:
//
//   1) الأنماط المتكررة الفعلية: كل تصحيحات المحرر المحفوظة تُجمَّع نمطيا
//      (حتمي، بلا تقنيات احتمالية)، وما تكرر ≥ 3 مرات يُعرض كقاعدة مرشحة
//      بمراجعتها: عدد التصحيحات المشابهة، النمط المشترك، الأثر المتوقع —
//      ثم Review → Create Rule. لا إنشاء تلقائي أبدا (P-06).
//
//   2) «أنشئ قاعدة من تصحيح»: وصف تصحيح واحد (أو تعبئة مسبقة من رابط عميق
//      قادم من المحرر/التتبع) يقترح قاعدة EngineRule DRAFT كاملة:
//      Condition/Action/Scope/Priority — ويُحفظ فقط بيد المستخدم.
//
// كل منطق الاقتراح والتجميع في الوحدة النقيّة المختبرة candidate-rule.ts
// (لا منطق مكرر — P-07).

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EngineRule, RuleCondition } from '@/lib/tashjeer/model/v8';
import {
  PATTERN_REPEAT_THRESHOLD,
  detectRecurringPatterns,
  proposeCandidateRule,
  type CandidatePattern,
  type CorrectionContext,
} from '@/lib/tashjeer/decision/candidate-rule';
import { readCorrectionContexts, type CorrectionContextRef } from '@/lib/storage/tracking-store';
import { DIFFERENCE_TYPES, DIFFERENCE_TYPE_LABELS } from './labels';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface CandidateRulesPanelProps {
  onAdopt: (rule: EngineRule) => void;
  /** تعبئة مسبقة من رابط عميق (المحرر/التتبع: «أنشئ قاعدة من التصحيح»). */
  initial?: {
    differenceType?: string;
    relatedType?: string;
    engineMerged?: boolean;
    editorWantsMerge?: boolean;
    positionRef?: { ayahKey: number; variantId: string };
  };
}

export function CandidateRulesPanel({ onAdopt, initial }: CandidateRulesPanelProps) {
  const [differenceType, setDifferenceType] = useState(initial?.differenceType ?? 'FARSH');
  const [relatedType, setRelatedType] = useState(initial?.relatedType ?? 'MADD');
  const [engineMerged, setEngineMerged] = useState(initial?.engineMerged ?? true);
  const [editorWantsMerge, setEditorWantsMerge] = useState(initial?.editorWantsMerge ?? false);
  const [adopted, setAdopted] = useState(false);
  const [contexts, setContexts] = useState<CorrectionContextRef[] | null>(null);

  // إن وصل التصحيح من رابط عميق بعد أول عرض، نحدّث الحقول مرة واحدة.
  useEffect(() => {
    if (!initial) return;
    if (initial.differenceType) setDifferenceType(initial.differenceType);
    if (initial.relatedType) setRelatedType(initial.relatedType);
    if (initial.engineMerged !== undefined) setEngineMerged(initial.engineMerged);
    if (initial.editorWantsMerge !== undefined) setEditorWantsMerge(initial.editorWantsMerge);
  }, [initial]);

  // التصحيحات الفعلية من المستندات المخزنة (بلا تخزين مكرر — DM-16).
  useEffect(() => {
    setContexts(readCorrectionContexts());
  }, []);

  // الأنماط المتكررة (≥ الحد) من التصحيحات الفعلية — مرشحات للمراجعة لا
  // تُنشأ تلقائيا (P-06).
  const patterns = useMemo<CandidatePattern[]>(
    () => (contexts ? detectRecurringPatterns(contexts) : []),
    [contexts]
  );

  // عدد التصحيحات المشابهة للتصحيح المعروض في النموذج (الأثر المتوقع).
  const similarCount = useMemo(() => {
    if (!contexts) return 0;
    const wanted = { differenceType, engineMerged, editorWantsMerge };
    return contexts.filter(
      (item) =>
        item.differenceType === wanted.differenceType &&
        item.engineMerged === wanted.engineMerged &&
        item.editorWantsMerge === wanted.editorWantsMerge
    ).length;
  }, [contexts, differenceType, engineMerged, editorWantsMerge]);

  const correction: CorrectionContext = useMemo(
    () => ({ differenceType, relatedType, engineMerged, editorWantsMerge }),
    [differenceType, relatedType, engineMerged, editorWantsMerge]
  );

  const proposed = useMemo(() => proposeCandidateRule(correction), [correction]);
  const agrees = engineMerged === editorWantsMerge;

  const handleAdopt = () => {
    onAdopt(proposed);
    setAdopted(true);
  };

  const adoptPattern = (pattern: CandidatePattern) => {
    // Review → Create Rule: قرار المستخدم الصريح وحده ينشئ القاعدة (DRAFT).
    onAdopt(pattern.rule);
    // نعبئ النموذج بنمط المقبول حتى يراه المحقق في مكان واحد.
    setDifferenceType(pattern.differenceType);
    if (pattern.relatedType) setRelatedType(pattern.relatedType);
    setEngineMerged(pattern.engineMerged);
    setEditorWantsMerge(pattern.editorWantsMerge);
  };

  return (
    <div className="space-y-5">
      {/* الأنماط المتكررة الفعلية من التصحيحات المحفوظة */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">قواعد مرشحة من تصحيحاتك المتكررة</h3>
        <p className="mt-1 text-sm text-gray-500">
          تجمع كل تصحيح تكرر نمطه {toArabicDigits(PATTERN_REPEAT_THRESHOLD)} مرات أو أكثر،
          مقترحة للمراجعة — لا يُنشأ شيء تلقائيا (Review ← Create Rule).
        </p>

        {contexts === null ? (
          <p className="mt-3 text-xs text-gray-400">جارٍ قراءة التصحيحات…</p>
        ) : patterns.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-500">
            {contexts.length === 0
              ? 'لا تصحيحات محفوظة بعد: صحّح موضع اقترحه المحرك في المحرر ثم عد هنا.'
              : `توجد ${toArabicDigits(contexts.length)} تصحيحات محفوظة لكن لا نمط تكرر ${toArabicDigits(PATTERN_REPEAT_THRESHOLD)} مرات بعد.`}
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {patterns.map((pattern) => (
              <li
                key={pattern.key}
                className="rounded-lg border border-violet-200 bg-violet-50/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-violet-950">
                    {describePatternShort(pattern)}
                  </p>
                  <span className="rounded-full bg-violet-200 px-2.5 py-0.5 text-xs font-bold text-violet-900">
                    {toArabicDigits(pattern.count)} تصحيحا
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-1.5 text-xs md:grid-cols-3">
                  <Detail label="عدد التصحيحات المشابهة" value={toArabicDigits(pattern.count)} />
                  <Detail label="النمط المشترك" value={describePatternShort(pattern)} />
                  <Detail label="الأثر المتوقع" value={`${toArabicDigits(pattern.count)} مواضع تطابق الشرط`} />
                </dl>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      adoptPattern(pattern)
                    }
                    className="rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                    title="تقبل القاعدة المرشحة كمسودة (DRAFT) في ملف المحرك — لا تؤثر حتى تعتمد"
                  >
                    مراجعة وإنشاء القاعدة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDifferenceType(pattern.differenceType);
                      if (pattern.relatedType) setRelatedType(pattern.relatedType);
                      setEngineMerged(pattern.engineMerged);
                      setEditorWantsMerge(pattern.editorWantsMerge);
                    }}
                    className="rounded-lg border border-violet-300 bg-white px-3.5 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50"
                  >
                    معاينة في النموذج أدناه
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* تصحيح واحد ← قاعدة مرشحة (مع تعبئة مسبقة من المحرر/التتبع) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">إنشاء قاعدة من تصحيح</h3>
        <p className="mt-1 text-sm text-gray-500">
          صف تصحيحك: ماذا قرر المحرك، وماذا تريد أنت. يُقترح لك قانون مرشّح مسودة تراجعه
          قبل الاعتماد (AC-02.4).
        </p>

        {initial?.positionRef && (
          <p className="mt-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
            معبأ من تصحيح في المحرر ({Math.floor(initial.positionRef.ayahKey / 1000)}:
            {initial.positionRef.ayahKey % 1000}) —{' '}
            <Link
              href={`/editor?ayah=${initial.positionRef.ayahKey}&variant=${encodeURIComponent(initial.positionRef.variantId)}`}
              className="font-medium text-cyan-700 underline-offset-2 hover:underline"
            >
              افتح التصحيح في المحرر
            </Link>
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="نوع الاختلاف">
            <TypeSelect value={differenceType} onChange={setDifferenceType} />
          </Field>
          <Field label="النوع المرتبط">
            <TypeSelect value={relatedType} onChange={setRelatedType} />
          </Field>
          <Field label="قرار المحرك (A)">
            <DecisionSelect value={engineMerged} onChange={setEngineMerged} />
          </Field>
          <Field label="رغبة المحرر (B = النهائي)">
            <DecisionSelect value={editorWantsMerge} onChange={setEditorWantsMerge} />
          </Field>
        </div>

        {contexts !== null && (
          <p className="mt-3 text-xs text-gray-500">
            التصحيحات المشابهة لهذا النمط: {toArabicDigits(similarCount)} — الأثر المتوقع عند
            اعتماد القاعدة: {toArabicDigits(Math.max(similarCount, 1))} مواضع تطابق الشرط.
          </p>
        )}

        {agrees && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            المحرك والمحرر متفقان هنا — لا حاجة لقاعدة. غيّر رغبة المحرر لتوليد تصحيح فعلي.
          </p>
        )}
      </div>

      {/* القاعدة المرشحة المقترحة */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-violet-950">القاعدة المرشحة المقترحة</h4>
          <span className="rounded bg-violet-200 px-2 py-0.5 text-xs font-medium text-violet-800">مسودة</span>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <Detail label="الاسم" value={proposed.name} />
          <Detail label="الإجراء" value={proposed.actions[0]?.type === 'MERGE' ? 'دمج' : 'منع الدمج'} />
          <Detail label="الأولوية" value={toArabicDigits(proposed.priority)} />
          <Detail label="الخصوصية" value={proposed.specificity === 'AYAH' ? 'الآية' : 'المصحف'} />
        </dl>
        <div className="mt-3 rounded-lg bg-white p-3 text-xs text-gray-600">
          <p className="font-medium text-gray-700">الشرط:</p>
          <ul className="mt-1 space-y-0.5">
            {(proposed.conditions.all ?? [])
              .filter((item): item is RuleCondition => 'field' in item)
              .map((condition, index) => (
                <li key={index}>
                  {condition.field} {condition.op} {String(condition.value)}
                </li>
              ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={handleAdopt}
          disabled={agrees || adopted}
          className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adopted ? 'أُضيفت كقاعدة مسودة — افتحها في «القواعد ومنشئها»' : 'إضافة كقاعدة مسودة'}
        </button>
      </div>
    </div>
  );
}

/** وصف مختصر للنمط المشترك بالعربية. */
function describePatternShort(pattern: CandidatePattern): string {
  const direction = pattern.editorWantsMerge ? 'ادمج' : 'لا تدمج';
  const base = `${direction} ${DIFFERENCE_TYPE_LABELS[pattern.differenceType] ?? pattern.differenceType}`;
  return pattern.relatedType
    ? `${base} مع ${DIFFERENCE_TYPE_LABELS[pattern.relatedType] ?? pattern.relatedType}`
    : base;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function TypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
    >
      {DIFFERENCE_TYPES.map((type) => (
        <option key={type} value={type}>
          {DIFFERENCE_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  );
}

function DecisionSelect({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <select
      value={value ? 'merge' : 'separate'}
      onChange={(event) => onChange(event.target.value === 'merge')}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
    >
      <option value="merge">دمج</option>
      <option value="separate">فصل</option>
    </select>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded bg-white px-3 py-1.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}

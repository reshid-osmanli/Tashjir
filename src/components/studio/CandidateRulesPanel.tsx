// القواعد المرشحة من التصحيحات — Candidate Rules Panel (FR-ES-12.4، AC-02.4)
// مشروع التشجير - نظام القراءات العشر
//
// «أنشئ قاعدة من التصحيح»: يصف المستخدم تصحيحًا (ماذا قرر المحرك، وماذا
// يريد المحرر) فيقترح النظام قاعدة EngineRule مرشحة (DRAFT) جاهزة للمراجعة
// والاعتماد — لا إنشاء تلقائي (P-06). هذا حلقة التعلم: تصحيح ← قاعدة مرشحة.
//
// كل المنطق في الوحدة النقيّة المختبرة candidate-rule.ts (لا منطق مكرر — P-07).

'use client';

import { useMemo, useState } from 'react';
import type { EngineRule, RuleCondition } from '@/lib/tashjeer/model/v8';
import { proposeCandidateRule, type CorrectionContext } from '@/lib/tashjeer/decision/candidate-rule';
import { DIFFERENCE_TYPES, DIFFERENCE_TYPE_LABELS } from './labels';

interface CandidateRulesPanelProps {
  onAdopt: (rule: EngineRule) => void;
}

export function CandidateRulesPanel({ onAdopt }: CandidateRulesPanelProps) {
  const [differenceType, setDifferenceType] = useState('FARSH');
  const [relatedType, setRelatedType] = useState('MADD');
  const [engineMerged, setEngineMerged] = useState(true);
  const [editorWantsMerge, setEditorWantsMerge] = useState(false);
  const [adopted, setAdopted] = useState(false);

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

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">إنشاء قاعدة من تصحيح</h3>
        <p className="mt-1 text-sm text-gray-500">
          صف تصحيحك: ماذا قرر المحرك، وماذا تريد أنت. يُقترح لك قانون مرشّح مسودة تراجعه قبل الاعتماد (AC-02.4).
        </p>

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
          <Detail label="الأولوية" value={String(proposed.priority)} />
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

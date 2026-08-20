// محرر بيانات القاعدة العامة — Global Rule Meta Editor
//
// نافذة تحرير قاعدة عامة قائمة: عنوانها وفئتها ونطاقها ودرجات قوتها
// وحالتها وتفعيلها. لا تعدّل النمط نفسه، لأن النمط يُبنى من تحديد حقيقي
// في المصحف أو من معايير نحوية، وتغييره تغيير لهوية القاعدة لا لوصفها؛
// من أراد نمطا مختلفا أنشأ قاعدة جديدة من المحرر.
//
// هذا المكوّن مشترك بين المحرر (فهرس القواعد المدمج) وصفحة الفهرس المستقلة،
// حتى لا تختلف الصياغة ولا السلوك بين الشاشتين.

'use client';

import { useState } from 'react';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { describeGlobalPattern } from '@/lib/quran-logic/global-rule-engine';
import { resolveScope } from '@/lib/tashjeer/scope';
import { pruneStrengthMap } from '@/lib/tashjeer/strength-degrees';
import { readTransmissionCatalog } from '@/lib/transmissions/catalog';
import { saveGlobalRule, type GlobalRule } from '@/lib/storage/global-rules-store';
import { ScopePicker } from './VariantEditor';
import { StrengthDegreePicker } from './StrengthDegreePicker';
import type { VariantCategory } from '@/types';
import type { ReaderStrengthMap, ReadingScope, VerificationStatus } from '@/types/tashjeer';

const STATUS_OPTIONS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'REVIEW', label: 'قيد المراجعة' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'REJECTED', label: 'مرفوض' },
];

export function GlobalRuleMetaEditor({
  rule,
  onClose,
  onSaved,
}: {
  rule: GlobalRule;
  onClose: () => void;
  onSaved: (saved: GlobalRule) => void;
}) {
  const [title, setTitle] = useState(rule.title);
  const [category, setCategory] = useState<VariantCategory>(rule.category);
  const [scope, setScope] = useState<ReadingScope>(rule.scope);
  const [ruleLabel, setRuleLabel] = useState(rule.ruleLabel ?? '');
  const [lineOrder, setLineOrder] = useState(rule.lineOrder?.toString() ?? '');
  const [maddHarakat, setMaddHarakat] = useState(rule.maddHarakat?.toString() ?? '');
  const [description, setDescription] = useState(rule.description ?? '');
  const [sourceRef, setSourceRef] = useState(rule.sourceRef ?? '');
  const [status, setStatus] = useState<VerificationStatus>(rule.status);
  const [isActive, setIsActive] = useState(rule.isActive);
  const [strengthDegreeId, setStrengthDegreeId] = useState<string | undefined>(rule.strengthDegreeId);
  const [strengthByNarrator, setStrengthByNarrator] = useState<ReaderStrengthMap | undefined>(
    rule.strengthByNarrator
  );
  const [error, setError] = useState('');

  const save = () => {
    if (!title.trim()) {
      setError('اكتب عنوان القاعدة العامة.');
      return;
    }
    const narratorIds = resolveScope(scope, readTransmissionCatalog());
    if (narratorIds.length === 0) {
      setError('اختر قارئا أو راويا واحدا على الأقل لهذه القاعدة.');
      return;
    }
    const saved = saveGlobalRule({
      ...rule,
      title,
      category,
      scope,
      ruleLabel: ruleLabel.trim() || undefined,
      lineOrder: lineOrder === '' ? undefined : Math.max(1, Math.round(Number(lineOrder))),
      maddHarakat: maddHarakat === '' ? undefined : Number(maddHarakat),
      description: description.trim() || undefined,
      sourceRef: sourceRef.trim() || undefined,
      strengthDegreeId,
      // ما خُصِّص لراوٍ خرج من نطاق القاعدة لا يُحفظ، فلا تبقى تخصيصات معلّقة.
      strengthByNarrator: pruneStrengthMap(strengthByNarrator, narratorIds),
      status,
      isActive,
    });
    onSaved(saved);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`تحرير القاعدة العامة ${rule.title}`}
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">تحرير القاعدة العامة</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
              التطبيق الآلي: {describeGlobalPattern(rule.pattern)}. تعديل النمط نفسه يكون بإنشاء قاعدة
              جديدة من المحرر، أما هنا فتُحرَّر البيانات والنطاق والدرجات.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
          >
            إغلاق
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="عنوان القاعدة">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="input" autoFocus />
          </Field>
          <Field label="الفئة">
            <select value={category} onChange={(event) => setCategory(event.target.value as VariantCategory)} className="input">
              {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((value) => (
                <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
              ))}
            </select>
          </Field>
          <Field label="اسم الحكم المختصر">
            <input value={ruleLabel} onChange={(event) => setRuleLabel(event.target.value)} className="input" placeholder="مثال: إخفاء" />
          </Field>
          <Field label="رقم ترتيب السطر (يدوي)">
            <input type="number" min={1} value={lineOrder} onChange={(event) => setLineOrder(event.target.value)} className="input" placeholder="آلي" />
          </Field>
          <Field label="حركات المد (اختياري)">
            <input type="number" min={0} max={6} value={maddHarakat} onChange={(event) => setMaddHarakat(event.target.value)} className="input" placeholder="٤ أو ٥ أو ٦" />
          </Field>
          <Field label="الحالة">
            <select value={status} onChange={(event) => setStatus(event.target.value as VerificationStatus)} className="input">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="مرجع الاستقاء">
            <input value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} className="input" placeholder="مثال: طيبة النشر، باب المد" />
          </Field>
          <Field label="الشرح" className="md:col-span-2">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="input resize-y" placeholder="ما الذي يطبق، وما حدود القاعدة؟" />
          </Field>
        </div>

        <div className="mt-4 rounded-md border border-stone-200 p-3">
          <ScopePicker scope={scope} onChange={setScope} />
        </div>

        <div className="mt-4">
          <StrengthDegreePicker
            scope={scope}
            degreeId={strengthDegreeId}
            byNarrator={strengthByNarrator}
            onChange={(next) => {
              setStrengthDegreeId(next.degreeId);
              setStrengthByNarrator(next.byNarrator);
            }}
            hint="درجة قوة هذا الوجه عند كل راوٍ. تنطبق على كل مواضع القاعدة، ويمكن تخصيص موضع بعينه من شاشة تتبّع المواضع."
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs text-stone-700">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="accent-emerald-600" />
          القاعدة نشطة ومطبَّقة على المصحف
        </label>
        {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-stone-300 px-4 py-2 text-xs text-stone-700 hover:bg-stone-50">
            إلغاء
          </button>
          <button type="button" onClick={save} className="rounded bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700">
            حفظ القاعدة
          </button>
        </div>
      </div>
    </div>
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

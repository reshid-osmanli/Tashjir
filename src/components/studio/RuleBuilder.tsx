// منشئ القواعد الرسومي — Rule Builder (FR-ES-02، FR-ES-03)
// مشروع التشجير - نظام القراءات العشر
//
// إنشاء/تعديل قاعدة بلا كتابة كود: كل شيء بالنقر والاختيار. الشروط تُبنى
// بصورة AND بسيطة (حقول + معاملات + قيم)، والإجراءات تُختار من قائمة جاهزة.
// الناتج كيان EngineRule فقط — لا هياكل خاصة بالواجهة (P-02).

'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  EngineConfig,
  EngineRule,
  EngineRuleCategory,
  EngineRuleScope,
  RuleAction,
  RuleActionType,
  RuleCondition,
  RuleHardness,
  RuleStatus,
  SpecificityLevel,
  TestCase,
} from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';
import {
  RULE_TYPE_LABELS,
  CATEGORY_LABELS,
  SCOPE_LABELS,
  HARDNESS_LABELS,
  STATUS_LABELS,
  ACTION_LABELS,
  CONDITION_FIELDS,
  CONDITION_FIELD_LABELS,
  CONDITION_OPS,
  CONDITION_OP_LABELS,
  DIFFERENCE_TYPES,
  DIFFERENCE_TYPE_LABELS,
} from './labels';
import { WAQF_WASL_TEMPLATES, type RuleTemplate } from './templates';
import { previewRuleEdit, summarizePreview } from '@/lib/tashjeer/decision/rule-edit-preview';

const RULE_TYPES = Object.keys(RULE_TYPE_LABELS) as EngineRule['type'][];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as EngineRuleCategory[];
const SCOPES = Object.keys(SCOPE_LABELS) as EngineRuleScope[];
const HARDNESS = Object.keys(HARDNESS_LABELS) as RuleHardness[];
const STATUSES = Object.keys(STATUS_LABELS) as RuleStatus[];
const SPECIFICITIES: SpecificityLevel[] = ['MUSHAF', 'SURAH', 'AYAH', 'SEGMENT', 'WORD', 'CHARACTER'];
const ACTIONS = Object.keys(ACTION_LABELS) as RuleActionType[];

const SPECIFICITY_LABELS: Record<SpecificityLevel, string> = {
  MUSHAF: 'المصحف',
  SURAH: 'السورة',
  AYAH: 'الآية',
  SEGMENT: 'الجزء',
  WORD: 'الكلمة',
  CHARACTER: 'الحرف',
};

function emptyCondition(): RuleCondition {
  return { field: 'differenceType', op: 'equals', value: '' };
}

function ruleToDraft(rule: EngineRule | null): {
  id?: string;
  name: string;
  type: EngineRule['type'];
  category: EngineRuleCategory;
  scope: EngineRuleScope;
  priority: number;
  groupId: string;
  specificity: SpecificityLevel;
  hardness: RuleHardness;
  status: RuleStatus;
  conditions: RuleCondition[];
  actions: RuleAction[];
  protected: boolean;
  testCases: TestCase[];
} {
  if (!rule) {
    return {
      name: '',
      type: 'MERGE',
      category: 'MERGE',
      scope: 'MUSHAF',
      priority: 50,
      groupId: 'merge',
      specificity: 'MUSHAF',
      hardness: 'SOFT',
      status: 'DRAFT',
      conditions: [emptyCondition()],
      actions: [{ type: 'PREVENT_MERGE' }],
      protected: false,
      testCases: [],
    };
  }
  const flat = rule.conditions.all ?? [];
  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    category: rule.category,
    scope: rule.scope,
    priority: rule.priority,
    groupId: rule.groupId,
    specificity: rule.specificity,
    hardness: rule.hardness,
    status: rule.status,
    conditions: flat.length > 0 ? flat.filter((c): c is RuleCondition => 'field' in c) : [emptyCondition()],
    actions: rule.actions,
    protected: rule.protected ?? false,
    testCases: rule.testCases ?? [],
  };
}

interface RuleBuilderProps {
  rule: EngineRule | null;
  groups: Array<{ id: string; label: string }>;
  profile?: EngineConfig;
  onSave: (rule: EngineRule | Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'>) => void;
  onCancel: () => void;
}

export function RuleBuilder({ rule, groups, profile, onSave, onCancel }: RuleBuilderProps) {
  const [draft, setDraft] = useState(() => ruleToDraft(rule));

  useEffect(() => {
    setDraft(ruleToDraft(rule));
  }, [rule]);

  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }));
  };

  const addCondition = () => setDraft((current) => ({ ...current, conditions: [...current.conditions, emptyCondition()] }));
  const removeCondition = (index: number) =>
    setDraft((current) => ({ ...current, conditions: current.conditions.filter((_, idx) => idx !== index) }));

  const addAction = () => setDraft((current) => ({ ...current, actions: [...current.actions, { type: 'MERGE' }] }));
  const updateAction = (index: number, type: RuleActionType) =>
    setDraft((current) => ({ ...current, actions: current.actions.map((item, idx) => (idx === index ? { type } : item)) }));
  const removeAction = (index: number) =>
    setDraft((current) => ({ ...current, actions: current.actions.filter((_, idx) => idx !== index) }));

  const applyTemplate = (template: RuleTemplate) => {
    setDraft((current) => ({
      ...current,
      type: template.type,
      category: template.category,
      conditions: template.conditions.length > 0 ? template.conditions.map((condition) => ({ ...condition })) : [emptyCondition()],
      actions: template.actions.map((action) => ({ ...action })),
      name: current.name.trim() || template.label,
    }));
  };

  const addTestCase = () =>
    setDraft((current) => ({
      ...current,
      testCases: [...current.testCases, { name: `حالة ${current.testCases.length + 1}`, input: { differenceType: 'MADD', relatedType: 'TAHQIQ' }, expected: 'MERGE' }],
    }));
  const updateTestCase = (index: number, patch: Partial<TestCase>) =>
    setDraft((current) => ({
      ...current,
      testCases: current.testCases.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }));
  const removeTestCase = (index: number) =>
    setDraft((current) => ({ ...current, testCases: current.testCases.filter((_, idx) => idx !== index) }));

  const assembleRule = (): EngineRule => {
    const now = new Date().toISOString();
    return {
      id: draft.id ?? createEntityId('er'),
      name: draft.name.trim() || 'قاعدة بلا عنوان',
      type: draft.type,
      category: draft.category,
      scope: draft.scope,
      conditions: { all: draft.conditions.filter((c) => c.field) },
      actions: draft.actions,
      priority: draft.priority,
      groupId: draft.groupId,
      specificity: draft.specificity,
      hardness: draft.hardness,
      status: draft.status,
      protected: draft.protected,
      testCases: draft.testCases.length > 0 ? draft.testCases : undefined,
      version: rule?.version ?? 1,
      createdAt: rule?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const handleSave = () => {
    onSave(assembleRule());
  };

  // معاينة أثر التعديل قبل الحفظ (FR-ES-09.4): فقط عند تحرير قاعدة موجودة.
  const preview = useMemo(() => {
    if (!rule || !profile) return null;
    return previewRuleEdit(profile, rule, assembleRule());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, rule, profile]);

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">{draft.id ? 'تعديل قاعدة' : 'قاعدة جديدة'}</h3>
        <span className="text-xs text-gray-400">{draft.id}</span>
      </div>

      {/* الحقول الأساسية */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="اسم القاعدة">
          <input
            type="text"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="مثال: لا تدمج الفرش مع المد"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
        <Field label="النوع">
          <Select value={draft.type} onChange={(value) => setDraft((current) => ({ ...current, type: value as EngineRule['type'] }))} options={RULE_TYPES.map((type) => ({ value: type, label: RULE_TYPE_LABELS[type] }))} />
        </Field>
        <Field label="الفئة">
          <Select value={draft.category} onChange={(value) => setDraft((current) => ({ ...current, category: value as EngineRuleCategory }))} options={CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] }))} />
        </Field>
        <Field label="النطاق">
          <Select value={draft.scope} onChange={(value) => setDraft((current) => ({ ...current, scope: value as EngineRuleScope }))} options={SCOPES.map((scope) => ({ value: scope, label: SCOPE_LABELS[scope] }))} />
        </Field>
        <Field label="مجموعة الأولوية">
          <Select value={draft.groupId} onChange={(value) => setDraft((current) => ({ ...current, groupId: value }))} options={groups.map((group) => ({ value: group.id, label: group.label }))} />
        </Field>
        <Field label="الخصوصية (FR-ES-06)">
          <Select value={draft.specificity} onChange={(value) => setDraft((current) => ({ ...current, specificity: value as SpecificityLevel }))} options={SPECIFICITIES.map((specificity) => ({ value: specificity, label: SPECIFICITY_LABELS[specificity] }))} />
        </Field>
        <Field label="الأولوية (رقم — الأعلى أقوى)">
          <input
            type="number"
            value={draft.priority}
            onChange={(event) => setDraft((current) => ({ ...current, priority: Number(event.target.value) }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
        <Field label="الصلابة">
          <Select value={draft.hardness} onChange={(value) => setDraft((current) => ({ ...current, hardness: value as RuleHardness }))} options={HARDNESS.map((hardness) => ({ value: hardness, label: HARDNESS_LABELS[hardness] }))} />
        </Field>
        <Field label="الحالة">
          <Select value={draft.status} onChange={(value) => setDraft((current) => ({ ...current, status: value as RuleStatus }))} options={STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))} />
        </Field>
        <Field label="قاعدة محمية">
          <label className="flex items-center gap-2 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.protected}
              onChange={(event) => setDraft((current) => ({ ...current, protected: event.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            تتطلب تأكيدًا إضافيًا للتعديل أو الحذف
          </label>
        </Field>
      </div>

      {/* منشئ الشروط */}
      <div className="space-y-3">
        {/* قوالب الوقف/الوصل الجاهزة (FR-ES-16.2) */}
        <div>
          <h4 className="font-semibold text-gray-800">قوالب جاهزة</h4>
          <p className="mt-1 text-xs text-gray-500">قوالب الوقف/الوصل/الابتداء/ممنوع الوصل تملأ المسودة بلا كود (FR-ES-16).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WAQF_WASL_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                title={template.description}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-800">الشروط</h4>
          <button type="button" onClick={addCondition} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
            + شرط
          </button>
        </div>
        <p className="text-xs text-gray-500">كل الشروط مجمّعة بـ «و» (AND). يكفي تطابقها جميعًا لتفعيل القاعدة.</p>
        <div className="space-y-2">
          {draft.conditions.map((condition, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
              <Select
                value={condition.field}
                onChange={(value) => updateCondition(index, { field: value })}
                options={CONDITION_FIELDS.map((field) => ({ value: field, label: CONDITION_FIELD_LABELS[field] }))}
                compact
              />
              <Select
                value={condition.op}
                onChange={(value) => updateCondition(index, { op: value as RuleCondition['op'] })}
                options={CONDITION_OPS.map((op) => ({ value: op, label: CONDITION_OP_LABELS[op] }))}
                compact
              />
              {condition.op !== 'exists' && (
                <ConditionValue condition={condition} onChange={(value) => updateCondition(index, { value })} />
              )}
              <button
                type="button"
                onClick={() => removeCondition(index)}
                className="mr-auto rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                aria-label="حذف الشرط"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* منشئ الإجراءات */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-800">الإجراءات</h4>
          <button type="button" onClick={addAction} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
            + إجراء
          </button>
        </div>
        <div className="space-y-2">
          {draft.actions.map((action, index) => (
            <div key={index} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
              <Select
                value={action.type}
                onChange={(value) => updateAction(index, value as RuleActionType)}
                options={ACTIONS.map((type) => ({ value: type, label: ACTION_LABELS[type] }))}
              />
              <button
                type="button"
                onClick={() => removeAction(index)}
                className="mr-auto rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                aria-label="حذف الإجراء"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* حالات الاختبار (FR-ES-08) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-800">حالات الاختبار</h4>
          <button type="button" onClick={addTestCase} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
            + حالة
          </button>
        </div>
        <p className="text-xs text-gray-500">لكل حالة: مدخلات والنتيجة المتوقَّعة. تُشغَّل تلقائيًا لاكتشاف الانحدار عند التعديل (FR-ES-08).</p>
        <div className="space-y-2">
          {draft.testCases.map((testCase, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
              <input
                type="text"
                value={testCase.name}
                onChange={(event) => updateTestCase(index, { name: event.target.value })}
                placeholder="اسم الحالة"
                className="w-28 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Select
                value={testCase.expected}
                onChange={(value) => updateTestCase(index, { expected: value })}
                options={[
                  { value: 'MERGE', label: 'ادمج' },
                  { value: 'SEPARATE', label: 'لا تدمج' },
                  { value: 'CREATE', label: 'أنشئ' },
                  { value: 'SKIP', label: 'تجاوز' },
                  { value: 'BLOCK', label: 'احجب' },
                  { value: 'ALLOW', label: 'اسمح' },
                ]}
                compact
              />
              <button type="button" onClick={() => removeTestCase(index)} className="mr-auto rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50" aria-label="حذف الحالة">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* أزرار الحفظ */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
          إلغاء
        </button>
        <button type="button" onClick={handleSave} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          حفظ القاعدة
        </button>
      </div>

      {/* معاينة أثر التعديل قبل الحفظ (FR-ES-09.4) */}
      {preview && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            preview.introducesRegression
              ? 'border-red-200 bg-red-50 text-red-700'
              : preview.flipped.length > 0
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <p className="font-medium">معاينة الأثر: {summarizePreview(preview)}</p>
          {preview.flipped.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {preview.flipped.map((flipped) => (
                <li key={flipped.name}>
                  «{flipped.name}»: {flipped.before} ← {flipped.after}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** خيار قيمة الشرط: قائمة منسدلة للأنواع المعروفة، وحر لما عداها. */
function ConditionValue({ condition, onChange }: { condition: RuleCondition; onChange: (value: unknown) => void }) {
  if (condition.field === 'differenceType' || condition.field === 'relatedType' || condition.field === 'otherType') {
    const options = DIFFERENCE_TYPES.map((type) => ({ value: type, label: DIFFERENCE_TYPE_LABELS[type] }));
    return <Select value={String(condition.value ?? '')} onChange={onChange} options={options} allowFree compact />;
  }
  if (condition.field === 'sameReader') {
    return (
      <Select
        value={condition.value === true ? 'true' : 'false'}
        onChange={(value) => onChange(value === 'true')}
        options={[
          { value: 'true', label: 'نعم' },
          { value: 'false', label: 'لا' },
        ]}
        compact
      />
    );
  }
  return (
    <input
      type="text"
      value={String(condition.value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      placeholder="القيمة"
      className="w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
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

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  compact?: boolean;
  allowFree?: boolean;
}

function Select({ value, onChange, options, compact, allowFree }: SelectProps) {
  // خيار «قيمة أخرى» حر عند الحاجة (مثل أنواع الاختلاف غير المدرجة).
  const isKnown = allowFree ? options.some((option) => option.value === value) : true;
  return (
    <select
      value={isKnown ? value : '__custom__'}
      onChange={(event) => {
        if (event.target.value === '__custom__') return;
        onChange(event.target.value);
      }}
      className={`${compact ? 'w-32 px-2 py-1.5 text-sm' : 'w-full px-3 py-2'} rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500`}
    >
      {allowFree && !isKnown && <option value="__custom__">{String(value)}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

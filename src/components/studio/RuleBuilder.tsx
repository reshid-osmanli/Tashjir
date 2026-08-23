'use client';

// منشئ القواعد - Rule Builder
// FR-ES-02: نموذج إنشاء قاعدة بلا كود
// FR-ES-03: Condition & Action Builder بالنقر والاختيار

import { useState, useEffect } from 'react';
import { useEngineStudioStore } from '@/stores/engine-studio-store';
import type {
  EngineRule,
  EngineRuleCategory,
  EngineRuleScope,
  RuleHardness,
  RuleStatus,
  SpecificityLevel,
  RuleCondition,
  ConditionGroup,
  RuleAction,
  RuleActionType,
} from '@/lib/tashjeer/model/v8';

interface RuleBuilderProps {
  ruleId: string;
  onClose: () => void;
}

const categories: EngineRuleCategory[] = [
  'DETECTION', 'DIFFERENCE', 'VARIANT', 'MERGE', 'SPLIT',
  'ORDERING', 'RELATION', 'CONTEXT', 'WAQF', 'WASL',
  'IBTIDA', 'EXCEPTION', 'OVERRIDE', 'VALIDATION',
];

const scopes: EngineRuleScope[] = ['CHARACTER', 'WORD', 'RANGE', 'AYAH', 'SURAH', 'MUSHAF'];

const scopeLabels: Record<EngineRuleScope, string> = {
  CHARACTER: 'حرف',
  WORD: 'كلمة',
  RANGE: 'مدى',
  AYAH: 'آية',
  SURAH: 'سورة',
  MUSHAF: 'المصحف',
};

const specificityLabels: Record<SpecificityLevel, string> = {
  MUSHFAF: 'المصحف',
  SURAH: 'سورة',
  AYAH: 'آية',
  SEGMENT: 'مقطع',
  WORD: 'كلمة',
  CHARACTER: 'حرف',
};

const actionTypes: RuleActionType[] = [
  'CREATE_DIFFERENCE', 'CREATE_VARIANT', 'APPLY_RULE', 'MERGE',
  'PREVENT_MERGE', 'SPLIT', 'CHANGE_ORDER', 'SET_RANK',
  'CREATE_RELATION', 'REMOVE_RELATION', 'OVERRIDE_RESULT',
  'BLOCK_RESULT', 'ASSIGN_CONTEXT', 'GENERATE_CORRECTION',
];

const actionLabels: Record<RuleActionType, string> = {
  CREATE_DIFFERENCE: 'إنشاء اختلاف',
  CREATE_VARIANT: 'إنشاء وجه',
  APPLY_RULE: 'تطبيق قاعدة',
  MERGE: 'دمج',
  PREVENT_MERGE: 'منع الدمج',
  SPLIT: 'فصل',
  CHANGE_ORDER: 'تغيير الترتيب',
  SET_RANK: 'تعيين الرتبة',
  CREATE_RELATION: 'إنشاء علاقة',
  REMOVE_RELATION: 'حذف علاقة',
  OVERRIDE_RESULT: 'تجاوز النتيجة',
  BLOCK_RESULT: 'حظر النتيجة',
  ASSIGN_CONTEXT: 'تعيين السياق',
  GENERATE_CORRECTION: 'توليد تصحيح',
};

export function RuleBuilder({ ruleId, onClose }: RuleBuilderProps) {
  const { getRule, updateRule } = useEngineStudioStore();
  const rule = getRule(ruleId);
  const [isEditing, setIsEditing] = useState(false);

  const [name, setName] = useState(rule?.name ?? '');
  const [type, setType] = useState(rule?.type ?? 'MERGE');
  const [category, setCategory] = useState<EngineRuleCategory>(rule?.category ?? 'MERGE');
  const [scope, setScope] = useState<EngineRuleScope>(rule?.scope ?? 'MUSHAF');
  const [priority, setPriority] = useState(rule?.priority ?? 50);
  const [groupId, setGroupId] = useState(rule?.groupId ?? 'merge');
  const [specificity, setSpecificity] = useState<SpecificityLevel>(rule?.specificity ?? 'MUSHFAF');
  const [hardness, setHardness] = useState<RuleHardness>(rule?.hardness ?? 'SOFT');
  const [status, setStatus] = useState<RuleStatus>(rule?.status ?? 'DRAFT');
  const [conditions, setConditions] = useState<ConditionGroup>(rule?.conditions ?? { all: [] });
  const [actions, setActions] = useState<RuleAction[]>(rule?.actions ?? []);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setType(rule.type ?? 'MERGE');
      setCategory(rule.category);
      setScope(rule.scope ?? 'MUSHAF');
      setPriority(rule.priority);
      setGroupId(rule.groupId ?? 'fallback');
      setSpecificity(rule.specificity ?? 'MUSHFAF');
      setHardness(rule.hardness ?? 'SOFT');
      setStatus(rule.status ?? (rule.enabled === false ? 'DISABLED' : 'ACTIVE'));
      setConditions(rule.conditions);
      setActions(rule.actions);
    }
  }, [rule]);

  if (!rule) return null;

  const handleSave = () => {
    updateRule(ruleId, {
      name,
      type,
      category,
      scope,
      priority,
      groupId,
      specificity,
      hardness,
      status,
      conditions,
      actions,
    });
    setIsEditing(false);
  };

  const addCondition = () => {
    setConditions({
      ...conditions,
      all: [...(conditions.all ?? []), { field: '', op: 'equals', value: '' }],
    });
  };

  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    const all = [...(conditions.all ?? [])];
    all[index] = { ...all[index], ...patch } as RuleCondition;
    setConditions({ ...conditions, all });
  };

  const removeCondition = (index: number) => {
    setConditions({
      ...conditions,
      all: (conditions.all ?? []).filter((_, i) => i !== index),
    });
  };

  const addAction = () => {
    setActions([...actions, { type: 'MERGE' }]);
  };

  const updateAction = (index: number, patch: Partial<RuleAction>) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], ...patch };
    setActions(updated);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            {isEditing ? 'تعديل القاعدة' : rule.name}
          </h2>
          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
            {rule.id}
          </span>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              تعديل
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                إلغاء
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">الاسم</label>
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <div className="mt-1 text-gray-900">{name}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">النوع</label>
                {isEditing ? (
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as NonNullable<EngineRule['type']>)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="DIFFERENCE">اختلاف</option>
                    <option value="ORDERING">ترتيب</option>
                    <option value="MERGE">دمج</option>
                    <option value="RELATION">علاقة</option>
                    <option value="CONTEXT">سياق</option>
                    <option value="EXCEPTION">استثناء</option>
                  </select>
                ) : (
                  <div className="mt-1 text-gray-900">{type}</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">الفئة</label>
                {isEditing ? (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EngineRuleCategory)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 text-gray-900">{category}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">النطاق</label>
                {isEditing ? (
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as EngineRuleScope)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {scopes.map((s) => (
                      <option key={s} value={s}>{scopeLabels[s]}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 text-gray-900">{scopeLabels[scope]}</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">الخصوصية</label>
                {isEditing ? (
                  <select
                    value={specificity}
                    onChange={(e) => setSpecificity(e.target.value as SpecificityLevel)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {Object.entries(specificityLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 text-gray-900">{specificityLabels[specificity]}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">الأولوية</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                ) : (
                  <div className="mt-1 text-gray-900">{priority}</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">الصلابة</label>
                {isEditing ? (
                  <select
                    value={hardness}
                    onChange={(e) => setHardness(e.target.value as RuleHardness)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="SOFT">مرنة</option>
                    <option value="HARD">صلبة</option>
                  </select>
                ) : (
                  <div className="mt-1 text-gray-900">{hardness === 'HARD' ? 'صلبة' : 'مرنة'}</div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">الحالة</label>
              {isEditing ? (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RuleStatus)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="DRAFT">مسودة</option>
                  <option value="ACTIVE">نشطة</option>
                  <option value="DISABLED">معطلة</option>
                  <option value="DEPRECATED">مهجورة</option>
                  <option value="EXPERIMENTAL">تجريبية</option>
                </select>
              ) : (
                <div className="mt-1 text-gray-900">
                  {status === 'DRAFT' && 'مسودة'}
                  {status === 'ACTIVE' && 'نشطة'}
                  {status === 'DISABLED' && 'معطلة'}
                  {status === 'DEPRECATED' && 'مهجورة'}
                  {status === 'EXPERIMENTAL' && 'تجريبية'}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Conditions & Actions */}
          <div className="space-y-6">
            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">الشروط (IF)</h3>
                {isEditing && (
                  <button
                    type="button"
                    onClick={addCondition}
                    className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                  >
                    + شرط
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {(conditions.all ?? []).length === 0 ? (
                  <div className="text-sm text-gray-500">لا توجد شروط</div>
                ) : (
                  (conditions.all ?? []).map((cond, index) => {
                    if ('field' in cond) {
                      return (
                        <div key={index} className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={cond.field}
                                onChange={(e) => updateCondition(index, { field: e.target.value })}
                                placeholder="الحقل"
                                className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                              <select
                                value={cond.op}
                                onChange={(e) => updateCondition(index, { op: e.target.value as RuleCondition['op'] })}
                                className="rounded border border-gray-300 px-2 py-1 text-sm"
                              >
                                <option value="equals">يساوي</option>
                                <option value="not-equals">لا يساوي</option>
                                <option value="in">في</option>
                                <option value="not-in">ليس في</option>
                                <option value="exists">موجود</option>
                              </select>
                              <input
                                type="text"
                                value={String(cond.value ?? '')}
                                onChange={(e) => updateCondition(index, { value: e.target.value })}
                                placeholder="القيمة"
                                className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => removeCondition(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <div className="rounded bg-gray-50 px-3 py-2 text-sm">
                              <span className="font-mono">{cond.field}</span>{' '}
                              <span className="text-gray-500">{cond.op}</span>{' '}
                              <span className="font-medium">{String(cond.value)}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })
                )}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">الإجراءات (THEN)</h3>
                {isEditing && (
                  <button
                    type="button"
                    onClick={addAction}
                    className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                  >
                    + إجراء
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {actions.length === 0 ? (
                  <div className="text-sm text-gray-500">لا توجد إجراءات</div>
                ) : (
                  actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <select
                            value={action.type}
                            onChange={(e) => updateAction(index, { type: e.target.value as RuleActionType })}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                          >
                            {actionTypes.map((at) => (
                              <option key={at} value={at}>{actionLabels[at]}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeAction(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div className="rounded bg-emerald-50 px-3 py-2 text-sm">
                          <span className="font-medium">{actionLabels[action.type as RuleActionType] ?? action.type}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Test Cases */}
            <div>
              <h3 className="text-sm font-medium text-gray-700">
                حالات الاختبار ({rule.testCases?.length ?? 0})
              </h3>
              {rule.testCases && rule.testCases.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {rule.testCases.map((tc, index) => (
                    <div key={index} className="rounded bg-gray-50 px-3 py-2 text-sm">
                      <span className="font-medium">{tc.name}</span>
                      <span className="mr-2 text-gray-500">→ {tc.expected}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-500">لا توجد حالات اختبار</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

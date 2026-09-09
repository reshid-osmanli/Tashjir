// الأولويات وخط الأنابيب — Priority & Pipeline (FR-ES-01، FR-ES-04، FR-ES-06)
// مشروع التشجير - نظام القراءات العشر
//
// عرض وتحرير مجموعات الأولوية، وسلم حل التعارض، وترتيب التنفيذ (خط أنابيب
// القرار)، وترتيب القواعد داخل كل مجموعة بالسحب أو بالأسهم. هذه هي الطبقة
// التي تحسم «أي قاعدة تفوز» دون أي اختيار عشوائي (P-11).
//
// كل إعادة ترتيب تُترجم إلى أرقام صريحة (order/priority) تُحفظ في الملف
// وتُصدَّر؛ لا يعتمد المحرك على ترتيب المصفوفة وحده.

'use client';

import { useMemo, useState, type DragEvent } from 'react';
import type { EngineConfig, EngineRule, ConflictPolicyStep, PriorityGroup } from '@/lib/tashjeer/model/v8';
import { CONFLICT_POLICY_LABELS, PIPELINE_STAGE_LABELS } from './labels';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface PriorityPipelineProps {
  config: EngineConfig;
  onConflictPolicyChange: (policy: ConflictPolicyStep[]) => void;
  /** إعادة ترتيب مراحل التنفيذ (اختياري: إن غاب تُعرض المراحل للقراءة فقط). */
  onExecutionOrderChange?: (order: string[]) => void;
  /** تحديث مجموعة أولوية (ترتيبها أو اسمها). */
  onGroupChange?: (group: PriorityGroup) => void;
  /** تغيير رقم أولوية قاعدة بعينها. */
  onRulePriorityChange?: (ruleId: string, priority: number) => void;
  /** فتح قاعدة في المنشئ. */
  onOpenRule?: (ruleId: string) => void;
}

const ALL_POLICY_STEPS = Object.keys(CONFLICT_POLICY_LABELS) as ConflictPolicyStep[];

/** ينقل عنصرا من موضع إلى آخر ويعيد مصفوفة جديدة. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to > items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(from < to ? to - 1 : to, 0, moved);
  return next;
}

/** يُعيد ترتيب مراحل الأنابيب بخطوة واحدة (أسهم لوحة المفاتيح). */
export function reorderStages<T>(stages: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= stages.length) return stages;
  const next = [...stages];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * يعيد ترقيم أولويات قواعد مجموعة بعد إعادة ترتيبها يدويا: القاعدة الأولى
 * تأخذ أعلى رقم، مع فجوة ثابتة تسمح بإدراج لاحق دون إعادة ترقيم شامل.
 * الأولويات المرتّبة تُشتق من الترتيب المرئي، فتُطابق «ما تراه هو ما يقرره المحرك».
 */
export function renumberPriorities(orderedRuleIds: string[], step = 10): Array<{ ruleId: string; priority: number }> {
  const top = orderedRuleIds.length * step;
  return orderedRuleIds.map((ruleId, index) => ({ ruleId, priority: top - index * step }));
}

/** قائمة قابلة لإعادة الترتيب بالسحب والأسهم؛ عامة حتى تخدم الثلاثة أدناه. */
function ReorderableList<T>({
  items,
  keyOf,
  render,
  onReorder,
  disabled,
  direction = 'column',
  tone = 'emerald',
}: {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T, index: number) => React.ReactNode;
  onReorder?: (next: T[]) => void;
  disabled?: boolean;
  direction?: 'column' | 'row';
  tone?: 'emerald' | 'gray' | 'violet';
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const canReorder = Boolean(onReorder) && !disabled && items.length > 1;

  const handleDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragIndex === null || !onReorder) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const after =
      direction === 'column' ? event.clientY > rect.top + rect.height / 2 : event.clientX < rect.left + rect.width / 2; // RTL: اليسار = بعد
    const target = after ? index + 1 : index;
    onReorder(moveItem(items, dragIndex, target));
    setDragIndex(null);
    setOverIndex(null);
  };

  const border = tone === 'violet' ? 'border-violet-400' : tone === 'gray' ? 'border-gray-400' : 'border-emerald-500';

  return (
    <ol className={direction === 'column' ? 'space-y-2' : 'flex flex-wrap items-center gap-2'}>
      {items.map((item, index) => (
        <li
          key={keyOf(item)}
          draggable={canReorder}
          onDragStart={(event) => {
            setDragIndex(index);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', keyOf(item));
          }}
          onDragOver={(event) => {
            if (!canReorder) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setOverIndex(index);
          }}
          onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
          onDrop={(event) => handleDrop(event, index)}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          className={`flex items-center gap-2 ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''} ${
            overIndex === index && dragIndex !== index ? `rounded-lg ring-2 ring-offset-1 ${border.replace('border', 'ring')}` : ''
          } ${dragIndex === index ? 'opacity-50' : ''}`}
        >
          {render(item, index)}
          {canReorder && (
            <span className="flex flex-col text-[10px] leading-none text-gray-400">
              <button
                type="button"
                onClick={() => onReorder?.(reorderStages(items, index, -1))}
                disabled={index === 0}
                className="px-1 hover:text-gray-700 disabled:opacity-30"
                aria-label="تقديم"
                title="تقديم"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onReorder?.(reorderStages(items, index, 1))}
                disabled={index === items.length - 1}
                className="px-1 hover:text-gray-700 disabled:opacity-30"
                aria-label="تأخير"
                title="تأخير"
              >
                ▼
              </button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function PriorityPipeline({
  config,
  onConflictPolicyChange,
  onExecutionOrderChange,
  onGroupChange,
  onRulePriorityChange,
  onOpenRule,
}: PriorityPipelineProps) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const togglePolicyStep = (step: ConflictPolicyStep) => {
    if (config.conflictPolicy.includes(step)) {
      onConflictPolicyChange(config.conflictPolicy.filter((item) => item !== step));
    } else {
      onConflictPolicyChange([...config.conflictPolicy, step]);
    }
  };

  const sortedGroups = useMemo(() => [...config.priorityGroups].sort((a, b) => a.order - b.order), [config.priorityGroups]);

  /** إعادة ترتيب المجموعات: يُعاد إسناد order = 1..n بحسب الترتيب الجديد. */
  const reorderGroups = (next: PriorityGroup[]) => {
    if (!onGroupChange) return;
    next.forEach((group, index) => {
      const order = index + 1;
      if (group.order !== order) onGroupChange({ ...group, order });
    });
  };

  const rulesByGroup = useMemo(() => {
    const map = new Map<string, EngineRule[]>();
    for (const rule of config.rules) {
      const list = map.get(rule.groupId) ?? [];
      list.push(rule);
      map.set(rule.groupId, list);
    }
    for (const list of map.values()) list.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, 'ar'));
    return map;
  }, [config.rules]);

  const reorderRules = (next: EngineRule[]) => {
    if (!onRulePriorityChange) return;
    for (const { ruleId, priority } of renumberPriorities(next.map((rule) => rule.id))) {
      const current = next.find((rule) => rule.id === ruleId);
      if (current && current.priority !== priority) onRulePriorityChange(ruleId, priority);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* مجموعات الأولوية */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">مجموعات الأولوية</h3>
        <p className="mt-1 text-sm text-gray-500">
          سلم المجموعات: الأصغر ترتيبا أعم قاعدة. اسحب لإعادة الترتيب، وافتح مجموعة لترتيب قواعدها.
        </p>
        <div className="mt-3">
          <ReorderableList
            items={sortedGroups}
            keyOf={(group) => group.id}
            onReorder={onGroupChange ? reorderGroups : undefined}
            render={(group) => {
              const rules = rulesByGroup.get(group.id) ?? [];
              const open = openGroupId === group.id;
              return (
                <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenGroupId(open ? null : group.id)}
                      className="flex items-center gap-2 text-right font-medium text-gray-800 hover:text-emerald-700"
                      aria-expanded={open}
                    >
                      <span className="text-xs text-gray-400">{open ? '▾' : '◂'}</span>
                      {group.label}
                      <span className="text-xs text-gray-400">({toArabicDigits(rules.length)} قاعدة)</span>
                    </button>
                    <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600" title="رقم الترتيب المحفوظ">
                      {toArabicDigits(group.order)}
                    </span>
                  </div>
                  {open && (
                    <div className="mt-2 border-t border-gray-200 pt-2">
                      {rules.length === 0 ? (
                        <p className="text-xs text-gray-400">لا قواعد في هذه المجموعة.</p>
                      ) : (
                        <ReorderableList
                          items={rules}
                          keyOf={(rule) => rule.id}
                          onReorder={onRulePriorityChange ? reorderRules : undefined}
                          tone="gray"
                          render={(rule) => (
                            <div className="flex flex-1 items-center justify-between gap-2 rounded bg-white px-2 py-1.5 text-sm">
                              <button
                                type="button"
                                onClick={() => onOpenRule?.(rule.id)}
                                className="truncate text-right text-gray-800 hover:text-emerald-700"
                                title={rule.name}
                              >
                                {rule.name}
                                {rule.protected && <span className="mr-1 text-[10px] text-amber-700">محمية</span>}
                                {rule.status !== 'ACTIVE' && <span className="mr-1 text-[10px] text-gray-400">{rule.status}</span>}
                              </button>
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <span>أولوية</span>
                                <input
                                  type="number"
                                  value={rule.priority}
                                  onChange={(event) => onRulePriorityChange?.(rule.id, Number(event.target.value))}
                                  disabled={!onRulePriorityChange}
                                  className="w-16 rounded border border-gray-200 px-1 py-0.5 text-center text-xs"
                                  aria-label={`أولوية القاعدة ${rule.name}`}
                                />
                              </span>
                            </div>
                          )}
                        />
                      )}
                      <p className="mt-2 text-[11px] text-gray-400">
                        الأعلى رقما يُقيَّم أولا ضمن المجموعة. السحب يعيد الترقيم بفجوة عشرة حتى يبقى الرقم صريحا في الملف.
                      </p>
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
      </div>

      {/* سلم حل التعارض */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">سلم حل التعارض</h3>
        <p className="mt-1 text-sm text-gray-500">
          عند تعارض قاعدتين، يُجرَّب هذا السلم بالترتيب حتى يُحسم. انقر لتفعيل درجة، واسحب الدرجات المفعّلة لترتيبها.
        </p>
        <div className="mt-3">
          <ReorderableList
            items={config.conflictPolicy}
            keyOf={(step) => step}
            direction="row"
            onReorder={(next) => onConflictPolicyChange(next)}
            render={(step, index) => (
              <button
                type="button"
                onClick={() => togglePolicyStep(step)}
                className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
                title="انقر للإلغاء"
              >
                {CONFLICT_POLICY_LABELS[step]}
                <span className="mr-1 opacity-70">({toArabicDigits(index + 1)})</span>
              </button>
            )}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_POLICY_STEPS.filter((step) => !config.conflictPolicy.includes(step)).map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => togglePolicyStep(step)}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
              title="انقر للتفعيل في آخر السلم"
            >
              + {CONFLICT_POLICY_LABELS[step]}
            </button>
          ))}
        </div>
      </div>

      {/* خط أنابيب القرار */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 className="font-bold text-gray-900">خط أنابيب القرار (ترتيب التنفيذ)</h3>
        <p className="mt-1 text-sm text-gray-500">مراحل اتخاذ القرار بالترتيب. كل قرار يمرّ بهذه المراحل (FR-ES-04).</p>
        <div className="mt-4">
          <ReorderableList
            items={config.executionOrder}
            keyOf={(stage) => stage}
            direction="row"
            onReorder={onExecutionOrderChange}
            render={(stage, index) => (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                    {toArabicDigits(index + 1)}
                  </span>
                  <span className="text-sm font-medium text-emerald-800">{PIPELINE_STAGE_LABELS[stage] ?? stage}</span>
                </div>
                {index < config.executionOrder.length - 1 && <span className="text-gray-300">←</span>}
              </>
            )}
          />
        </div>
        <p className="mt-3 text-xs text-gray-400">
          {onExecutionOrderChange
            ? 'إعادة ترتيب المراحل تؤثر في كل قرار؛ راجع اختبارات القواعد بعدها. التغيير يُحفظ مع الملف الشخصي.'
            : 'ترتيب التنفيذ معروض للقراءة فقط في هذا السياق.'}
        </p>
      </div>
    </div>
  );
}

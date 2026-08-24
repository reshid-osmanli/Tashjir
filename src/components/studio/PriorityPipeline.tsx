// الأولويات وخط الأنابيب — Priority & Pipeline (FR-ES-01، FR-ES-04، FR-ES-06)
// مشروع التشجير - نظام القراءات العشر
//
// عرض مجموعات الأولوية وسلم حل التعارض وترتيب التنفيذ (خط أنابيب القرار).
// هذه هي الطبقة التي تحسم «أي قاعدة تفوز» دون أي اختيار عشوائي (P-11).

'use client';

import type { EngineConfig, ConflictPolicyStep } from '@/lib/tashjeer/model/v8';
import { CONFLICT_POLICY_LABELS, PIPELINE_STAGE_LABELS } from './labels';

interface PriorityPipelineProps {
  config: EngineConfig;
  onConflictPolicyChange: (policy: ConflictPolicyStep[]) => void;
}

const ALL_POLICY_STEPS = Object.keys(CONFLICT_POLICY_LABELS) as ConflictPolicyStep[];

export function PriorityPipeline({ config, onConflictPolicyChange }: PriorityPipelineProps) {
  const togglePolicyStep = (step: ConflictPolicyStep) => {
    if (config.conflictPolicy.includes(step)) {
      onConflictPolicyChange(config.conflictPolicy.filter((item) => item !== step));
    } else {
      onConflictPolicyChange([...config.conflictPolicy, step]);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* مجموعات الأولوية */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">مجموعات الأولوية</h3>
        <p className="mt-1 text-sm text-gray-500">سلم المجموعات: الأصغر ترتيبًا أعم قاعدة.</p>
        <ul className="mt-3 space-y-2">
          {config.priorityGroups.map((group) => (
            <li key={group.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="font-medium text-gray-800">{group.label}</span>
              <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">{group.order}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* سلم حل التعارض */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">سلم حل التعارض</h3>
        <p className="mt-1 text-sm text-gray-500">عند تعارض قاعدتين، يُجرَّب هذا السلم بالترتيب حتى يُحسم.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_POLICY_STEPS.map((step) => {
            const active = config.conflictPolicy.includes(step);
            const order = config.conflictPolicy.indexOf(step);
            return (
              <button
                key={step}
                type="button"
                onClick={() => togglePolicyStep(step)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {CONFLICT_POLICY_LABELS[step]}
                {active && <span className="mr-1 opacity-70">({order + 1})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* خط أنابيب القرار */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 className="font-bold text-gray-900">خط أنابيب القرار (ترتيب التنفيذ)</h3>
        <p className="mt-1 text-sm text-gray-500">مراحل اتخاذ القرار بالترتيب. كل قرار يمرّ بهذه المراحل (FR-ES-04).</p>
        <ol className="mt-4 flex flex-wrap items-center gap-2">
          {config.executionOrder.map((stage, index) => (
            <li key={`${stage}-${index}`} className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-emerald-800">{PIPELINE_STAGE_LABELS[stage] ?? stage}</span>
              </div>
              {index < config.executionOrder.length - 1 && <span className="text-gray-300">←</span>}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-gray-400">ترتيب التنفيذ الافتراضي معرَّض للعرض. إعادة ترتيبه ميزة متقدمة تؤثر في كل قرار.</p>
      </div>
    </div>
  );
}

/** يُعيد ترتيب مراحل الأنابيب (للاستخدام لاحقًا في السحب). */
export function reorderStages(stages: string[], index: number, delta: number): string[] {
  const target = index + delta;
  if (target < 0 || target >= stages.length) return stages;
  const next = [...stages];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

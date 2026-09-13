// سير اعتماد الساندبوكس — Draft → Test → Preview → Compare → Approve → Activate
'use client';

import type { EngineConfig, EngineRule, RuleStatus } from '@/lib/tashjeer/model/v8';
import { APPROVAL_STEPS, affectsOfficialData, nextApprovalStatus, deprecateRuleStatus } from '@/lib/tashjeer/decision/sandbox';
import { STATUS_LABELS } from './labels';

interface SandboxWorkflowProps {
  config: EngineConfig;
  rule: EngineRule | null;
  onStatus: (id: string, status: RuleStatus) => void;
}

export function SandboxWorkflow({ config, rule, onStatus }: SandboxWorkflowProps) {
  const drafts = config.rules.filter((item) => item.status === 'DRAFT' || item.status === 'EXPERIMENTAL');
  const selected = rule;

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-gray-900">Sandbox وسير الاعتماد</h3>
      <p className="text-sm text-gray-500">
        المسودة لا تؤثر على البيانات الرسمية حتى Activate. المسار: {APPROVAL_STEPS.join(' → ')}
      </p>
      <ol className="flex flex-wrap gap-2 text-xs">
        {APPROVAL_STEPS.map((step) => (
          <li key={step} className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
            {step}
          </li>
        ))}
      </ol>
      {selected && (
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <p>
            «{selected.name}» — {STATUS_LABELS[selected.status]} —{' '}
            {affectsOfficialData(selected) ? 'تمسّ الرسم الرسمي' : 'ساندبوكس فقط (لا تمسّ الرسم)'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onStatus(selected.id, nextApprovalStatus(selected.status))}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white"
            >
              {selected.status === 'DRAFT' || selected.status === 'EXPERIMENTAL' ? 'اعتماد وتفعيل' : 'الخطوة التالية'}
            </button>
            {selected.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => onStatus(selected.id, deprecateRuleStatus(selected.status))}
                className="rounded-lg border px-3 py-1.5"
              >
                عزل (Deprecated) دون حذف
              </button>
            )}
          </div>
        </div>
      )}
      <ul className="space-y-1 text-sm">
        {drafts.length === 0 ? (
          <li className="text-gray-400">لا مسودات في الساندبوكس.</li>
        ) : (
          drafts.map((item) => (
            <li key={item.id} className="flex justify-between rounded bg-amber-50 px-3 py-1.5">
              <span>{item.name}</span>
              <span className="text-amber-700">{STATUS_LABELS[item.status]}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

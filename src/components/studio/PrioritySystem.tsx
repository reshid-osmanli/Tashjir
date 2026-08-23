'use client';

// نظام الأولويات - Priority System
// FR-ES-01: Priority Groups وترتيب القواعد

import { useEngineStudioStore } from '@/stores/engine-studio-store';

export function PrioritySystem() {
  const { getActiveConfig, reorderPriorityGroups, moveRule } = useEngineStudioStore();
  const config = getActiveConfig();

  const sortedGroups = [...config.priorityGroups].sort((a, b) => a.order - b.order);

  const getRulesInGroup = (groupId: string) =>
    config.rules
      .filter((rule) => (rule.groupId ?? 'fallback') === groupId)
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const moveGroup = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedGroups.length) return;
    const next = [...sortedGroups];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    if (window.confirm(`تغيير أولوية مجموعة «${sortedGroups[index].label}»؟`)) {
      reorderPriorityGroups(next.map((group) => group.id));
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900">نظام الأولويات</h2>
        <p className="text-sm text-gray-500">
          مجموعات الأولوية وترتيبها — الأعلى أولوية أقوى (FR-ES-01)
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-3">
          {sortedGroups.map((group, index) => {
            const rulesInGroup = getRulesInGroup(group.id);
            return (
              <div key={group.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-medium text-gray-900">{group.label}</h3>
                      <p className="text-xs text-gray-500">
                        ترتيب: {group.order} · {rulesInGroup.length} قاعدة
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveGroup(index, 'up')}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === sortedGroups.length - 1}
                      onClick={() => moveGroup(index, 'down')}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                {rulesInGroup.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {rulesInGroup.slice(0, 5).map((rule, ruleIndex) => (
                      <div key={rule.id} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                        <span className="text-gray-700">{rule.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-500">P{rule.priority}</span>
                          <button type="button" disabled={ruleIndex === 0} onClick={() => moveRule(rule.id, 'up')} className="rounded px-1 text-xs text-gray-500 hover:bg-white disabled:opacity-30" aria-label="رفع أولوية القاعدة">↑</button>
                          <button type="button" disabled={ruleIndex === rulesInGroup.length - 1} onClick={() => moveRule(rule.id, 'down')} className="rounded px-1 text-xs text-gray-500 hover:bg-white disabled:opacity-30" aria-label="خفض أولوية القاعدة">↓</button>
                        </div>
                      </div>
                    ))}
                    {rulesInGroup.length > 5 && (
                      <div className="text-xs text-gray-500">
                        +{rulesInGroup.length - 5} قاعدة أخرى
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Policy Summary */}
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900">سياسة حل التعارض</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {config.conflictPolicy.map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                  {step}
                </span>
                {index < config.conflictPolicy.length - 1 && (
                  <span className="text-gray-400">←</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

// عارض خط أنابيب القرار - Pipeline Viewer
// FR-ES-04: عرض مراحل اتخاذ القرار

import { useEngineStudioStore } from '@/stores/engine-studio-store';

const stageLabels: Record<string, string> = {
  NORMALIZE: 'تطبيع المدخلات',
  CONTEXT: 'تحديد السياق',
  BLOCKING: 'قواعد المنع',
  EXCEPTIONS: 'الاستثناءات الصريحة',
  STRUCTURAL: 'القواعد البنائية',
  READER: 'قواعد القراء',
  DIFFERENCE: 'قواعد الاختلافات',
  MERGE: 'قواعد الدمج',
  ORDERING: 'الترتيب',
  FALLBACK: 'قواعد احتياطية',
};

export function PipelineViewer() {
  const { getActiveConfig, setExecutionOrder } = useEngineStudioStore();
  const config = getActiveConfig();

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const order = [...config.executionOrder];
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    setExecutionOrder(order);
  };

  const handleMoveDown = (index: number) => {
    if (index === config.executionOrder.length - 1) return;
    const order = [...config.executionOrder];
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    setExecutionOrder(order);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900">خط أنابيب القرار</h2>
        <p className="text-sm text-gray-500">
          ترتيب مراحل اتخاذ القرار — يمكن تعديله بحذر (FR-ES-04)
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-2">
          {config.executionOrder.map((stage, index) => (
            <div key={stage} className="flex items-center gap-3">
              {/* Step number */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                {index + 1}
              </div>

              {/* Connector */}
              {index > 0 && (
                <div className="absolute right-4 top-0 h-2 w-0.5 bg-gray-200" />
              )}

              {/* Stage card */}
              <div className="flex flex-1 items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {stageLabels[stage] ?? stage}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">{stage}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    title="نقل لأعلى"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === config.executionOrder.length - 1}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    title="نقل لأسفل"
                  >
                    ↓
                  </button>
                </div>
              </div>

              {/* Arrow */}
              {index < config.executionOrder.length - 1 && (
                <div className="text-center text-gray-400">↓</div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>تحذير:</strong> تغيير ترتيب التنفيذ قد يؤثر على نتائج المحرك. اختبر
            التغييرات في Playground قبل اعتمادها.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

// تتبع القرار - Decision Trace / Why?
// FR-ES-10: المحرك القابل للتفسير

import { useState } from 'react';
import { useEngineStudioStore } from '@/stores/engine-studio-store';
import { decideMerge } from '@/lib/tashjeer/decision/resolver';
import type { DecisionTraceStep } from '@/lib/tashjeer/decision/resolver';

export function DecisionTrace() {
  const { getActiveConfig } = useEngineStudioStore();
  const config = getActiveConfig();

  const [elementA, setElementA] = useState('MADD');
  const [elementB, setElementB] = useState('TAHQIQ');
  const [trace, setTrace] = useState<DecisionTraceStep[] | null>(null);
  const [decision, setDecision] = useState<{ merge: boolean; reason: string; priority: number } | null>(null);

  const handleTest = () => {
    const result = decideMerge(elementA, elementB, config);
    setTrace(result.trace);
    setDecision(result.decision);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900">تتبع القرار (Why?)</h2>
        <p className="text-sm text-gray-500">
          فهم سبب أي قرار للمحرك — القواعد المطابقة والفائزة والمتجاهلة (FR-ES-10)
        </p>
      </div>

      <div className="p-6">
        {/* Input */}
        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 font-medium text-gray-900">اختبار قرار الدمج</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">العنصر أ</label>
              <input
                type="text"
                value={elementA}
                onChange={(e) => setElementA(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">العنصر ب</label>
              <input
                type="text"
                value={elementB}
                onChange={(e) => setElementB(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleTest}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                اختبار
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        {decision && (
          <div className="mb-6 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">النتيجة</h3>
              <span
                className={`rounded-full px-4 py-1 text-sm font-medium ${
                  decision.merge
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {decision.merge ? 'ادمج' : 'لا تدمج'}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              <strong>السبب:</strong> {decision.reason}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              <strong>الأولوية:</strong> {decision.priority}
            </div>
          </div>
        )}

        {/* Trace */}
        {trace && (
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 font-medium text-gray-900">أثر القرار (Decision Trace)</h3>
            <div className="space-y-2">
              {trace.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 rounded p-3 ${
                    step.status === 'won'
                      ? 'bg-emerald-50'
                      : step.status === 'blocked'
                        ? 'bg-red-50'
                        : step.status === 'applied'
                          ? 'bg-blue-50'
                          : 'bg-gray-50'
                  }`}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-600">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-mono text-gray-700">
                        {step.stage}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          step.status === 'won'
                            ? 'bg-emerald-200 text-emerald-800'
                            : step.status === 'blocked'
                              ? 'bg-red-200 text-red-800'
                              : step.status === 'applied'
                                ? 'bg-blue-200 text-blue-800'
                                : step.status === 'skipped'
                                  ? 'bg-gray-200 text-gray-800'
                                  : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {step.status}
                      </span>
                      {step.priority !== undefined && (
                        <span className="text-xs text-gray-500">P{step.priority}</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">{step.message}</div>
                    {step.ruleId && (
                      <div className="mt-1 text-xs text-gray-500 font-mono">{step.ruleId}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

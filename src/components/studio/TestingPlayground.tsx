// ساحة اختبار المحرك — Testing Playground (FR-ES-09.1)
'use client';

import { useMemo, useState } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { testEngineAtPosition } from '@/lib/tashjeer/decision/playground';
import { DIFFERENCE_TYPES, DIFFERENCE_TYPE_LABELS } from './labels';

interface TestingPlaygroundProps {
  config: EngineConfig;
}

export function TestingPlayground({ config }: TestingPlaygroundProps) {
  const [a, setA] = useState('MADD');
  const [b, setB] = useState('TAHQIQ');
  const report = useMemo(
    () => testEngineAtPosition({ differenceType: a, relatedType: b, sameReader: true }, config),
    [a, b, config]
  );

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">ساحة الاختبار — Test Engine</h3>
        <p className="mt-1 text-sm text-gray-500">
          اختر موضعًا (زوج أنواع) وشغّل المحرك: المدخلات ← القواعد ← التعارضات ← الدمج ← الأوجه ← النهائي. كل شيء عبر Decision API.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-4">
        <label className="space-y-1 text-xs text-gray-500">
          العنصر أ
          <select value={a} onChange={(e) => setA(e.target.value)} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {DIFFERENCE_TYPES.map((type) => (
              <option key={type} value={type}>{DIFFERENCE_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          العنصر ب
          <select value={b} onChange={(e) => setB(e.target.value)} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {DIFFERENCE_TYPES.map((type) => (
              <option key={type} value={type}>{DIFFERENCE_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </label>
        <p className="mr-auto text-sm font-semibold text-emerald-800">{report.finalLabel}</p>
      </div>
      <ol className="space-y-2 text-sm">
        {report.trace.map((step, index) => (
          <li key={index} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <span className="font-mono text-xs text-gray-400">{step.stage}</span>{' '}
            {step.message}
            {typeof step.priority === 'number' && <span className="mr-2 text-xs text-gray-500">P{step.priority}</span>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-gray-500">
        قواعد مطبّقة: {report.rulesApplied.filter((r) => r.status === 'applied').map((r) => `${r.name} (P${r.priority})`).join(' · ') || 'لا شيء'}
      </p>
    </div>
  );
}

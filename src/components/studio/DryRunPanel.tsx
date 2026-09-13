// تشغيل جاف — Dry Run (FR-ES-09.2)
'use client';

import { useMemo, useState } from 'react';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { dryRunRule } from '@/lib/tashjeer/decision/dry-run';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { DIFFERENCE_TYPE_LABELS } from './labels';

interface DryRunPanelProps {
  config: EngineConfig;
  rule?: EngineRule | null;
  onApply?: () => void;
}

export function DryRunPanel({ config, rule, onApply }: DryRunPanelProps) {
  const [mode, setMode] = useState<'idle' | 'review'>('idle');
  const report = useMemo(() => dryRunRule(config, rule ?? undefined), [config, rule]);

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">تشغيل جاف (Dry Run)</h3>
        <p className="mt-1 text-sm text-gray-500">قراءة فقط حتى Apply صريح. لا يُكتب شيء في البيانات الرسمية.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="مطابق" value={report.matched} />
        <Stat label="سيُنشأ" value={report.wouldCreate} />
        <Stat label="سيُعدَّل" value={report.wouldModify} />
        <Stat label="سيُدمج" value={report.wouldMerge} />
        <Stat label="سيُتخطى" value={report.wouldSkip} />
        <Stat label="تعارض" value={report.conflicts} />
        <Stat label="ممنوع" value={report.forbidden} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode('idle')} className="rounded-lg border px-3 py-1.5 text-sm">إلغاء</button>
        <button type="button" onClick={() => setMode('review')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">مراجعة</button>
        <button
          type="button"
          onClick={() => onApply?.()}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
        >
          تطبيق
        </button>
      </div>
      {mode === 'review' && (
        <ul className="max-h-64 space-y-1 overflow-auto text-sm">
          {report.items.map((item) => (
            <li key={item.id} className="flex justify-between rounded bg-gray-50 px-3 py-1.5">
              <span>
                {DIFFERENCE_TYPE_LABELS[item.differenceType] ?? item.differenceType} +{' '}
                {DIFFERENCE_TYPE_LABELS[item.relatedType] ?? item.relatedType}
              </span>
              <span className="text-gray-500">{item.classification}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-center">
      <p className="text-lg font-bold">{toArabicDigits(String(value))}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

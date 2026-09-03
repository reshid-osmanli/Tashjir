// حوار «لماذا؟» في المحرر — Editor Why? Dialog (FR-ES-15.4)
// مشروع التشجير - نظام القراءات العشر
//
// يعرض سبب قرار الدمج لعنصر محدد من المحرر دون مغادرة شاشة العمل، وبنفس
// Decision Resolver المستخدم في الاستوديو والمحرك (P-07، FR-EN-03).

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { VariantCategory } from '@/types';
import { DIFFERENCE_TYPES, DIFFERENCE_TYPE_LABELS } from '../studio/labels';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { resolveMerge } from '@/lib/tashjeer/decision/api';
import { useEngineStudioStore } from '@/stores/engine-config-ui-store';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface WhyTraceDialogProps {
  category: VariantCategory;
  onClose: () => void;
}

function editorTypeToStudioType(category: VariantCategory): string {
  switch (category) {
    case 'MADUD':
      return 'MADD';
    case 'USUL':
      return 'TAHQIQ';
    case 'HAMZ':
      return 'HAMZ';
    case 'WAQF':
      return 'FORBIDDEN_WASL';
    case 'TAJWEED':
      return 'TAJWEED';
    default:
      return 'FARSH';
  }
}

export function WhyTraceDialog({ category, onClose }: WhyTraceDialogProps) {
  const { config, hydrate, loaded } = useEngineStudioStore();
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const a = editorTypeToStudioType(category);
  const [b, setB] = useState(a === 'MADD' ? 'FARSH' : 'MADD');
  const profile = loaded ? config : DEFAULT_SYSTEM_PROFILE;

  const result = useMemo(() => resolveMerge(a, b, profile), [a, b, profile]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" role="dialog" aria-modal="true" aria-label="لماذا هذا القرار؟">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">لماذا؟ — أثر القرار</h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              سبب دمج «{CATEGORY_LABELS[category]}» مع نوع آخر، كما يحسمه Decision Resolver من سياسات المحرك المفعّلة.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100">
            إغلاق
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-4">
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">العنصر المحدد</label>
              <div className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                {DIFFERENCE_TYPE_LABELS[a] ?? a}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-gray-500">قورن مع</label>
              <select
                value={b}
                onChange={(event) => setB(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {DIFFERENCE_TYPES.filter((type) => type !== a).map((type) => (
                  <option key={type} value={type}>
                    {DIFFERENCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mr-auto rounded-lg border border-gray-200 bg-white px-4 py-2">
              <p className="text-xs text-gray-500">النتيجة</p>
              <p className={`text-lg font-bold ${result.decision.merge ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.decision.merge ? 'ادمج' : 'لا تدمج'}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="mb-2 font-semibold text-gray-800">أثر القرار (Decision Trace)</h3>
            {result.trace.length === 0 ? (
              <p className="text-sm text-gray-400">لا خطوات مسجَّلة.</p>
            ) : (
              <ol className="space-y-1.5">
                {result.trace.map((step, index) => (
                  <li key={index} className={`flex items-start gap-3 rounded-lg border-r-4 px-3 py-2 text-sm ${TRACE_TONE[step.status]}`}>
                    <span className="mt-0.5 font-mono text-xs text-gray-400">{step.stage}</span>
                    <span className="flex-1 text-gray-700">{step.message}</span>
                    {typeof step.priority === 'number' && (
                      <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs text-gray-500">أولوية {toArabicDigits(step.priority)}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {result.appliedRules.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 font-semibold text-gray-800">قواعد مطابقة فاعلة</h3>
              <ul className="space-y-1">
                {result.appliedRules.map((rule) => (
                  <li key={rule.id} className="rounded bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
                    {rule.name} <span className="text-xs opacity-70">(أولوية {toArabicDigits(rule.priority)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            عدّل القواعد أو مصفوفة الدمج في استوديو المحرك ثم عد هنا لتُحسم نفس النتيجة نفسها.
          </p>
        </div>
      </div>
    </div>
  );
}

const TRACE_TONE: Record<string, string> = {
  applied: 'border-emerald-400 bg-emerald-50/50',
  won: 'border-emerald-500 bg-emerald-50/70',
  skipped: 'border-gray-300 bg-gray-50',
  lost: 'border-gray-300 bg-gray-50',
  blocked: 'border-red-400 bg-red-50/60',
  info: 'border-blue-300 bg-blue-50/50',
};

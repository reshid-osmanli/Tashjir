// لوحة اختبارات القواعد — Rule Tests Panel (FR-ES-08)
// مشروع التشجير - نظام القراءات العشر
//
// يُجري كل حالات اختبار القواعد المرفقة عبر واجهة القرار الموحّدة، ويعرض
// النتائج ومؤشر الانحدار: تغيّر قاعدة فانقلبت نتيجة مرجعية. نقية في العرض،
// وكل التقييم يتم في المشغّل المختبر (لا منطق مكرر — P-07).

'use client';

import { useMemo } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { runProfileTests, failingRules } from '@/lib/tashjeer/decision/rule-test-runner';

interface RuleTestsPanelProps {
  config: EngineConfig;
}

export function RuleTestsPanel({ config }: RuleTestsPanelProps) {
  const report = useMemo(() => runProfileTests(config), [config]);
  const failed = failingRules(report);

  if (report.total === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-400 shadow-sm">
        لا توجد حالات اختبار مرفقة بعد. أضف حالات إلى قواعدك من المنشئ لاكتشاف الانحدار تلقائيًا.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="إجمالي الحالات" value={report.total} tone="gray" />
        <SummaryCard label="ناجحة" value={report.passed} tone="emerald" />
        <SummaryCard label="فاشلة (انحدار)" value={report.failed} tone={report.failed > 0 ? 'red' : 'gray'} />
      </div>

      {failed.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          اكتُشف انحدار في {failed.length} قاعدة. راجع الحالات الفاشلة بالأسفل قبل الاعتماد.
        </div>
      )}

      <div className="space-y-3">
        {report.rules.map((ruleReport) => (
          <div key={ruleReport.ruleId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{ruleReport.ruleName}</h4>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ruleReport.failed > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {ruleReport.passed}/{ruleReport.total}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {ruleReport.results.map((result, index) => (
                <li key={index} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${result.passed ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {result.passed ? '✓' : '✕'}
                  </span>
                  <span className="text-gray-700">{result.caseName}</span>
                  <span className="mr-auto text-xs text-gray-400">{result.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'red' | 'gray' }) {
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

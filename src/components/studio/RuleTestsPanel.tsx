// لوحة اختبارات القواعد — Rule Tests Panel (FR-ES-08)
// مشروع التشجير - نظام القراءات العشر
//
// تُجري كل حالات اختبار القواعد المرفقة عبر واجهة القرار الموحّدة، وتعرض
// النتائج ومؤشر الانحدار: تغيّر قاعدة فانقلبت نتيجة مرجعية (Expected ← Current).
// كل التقييم في المشغّل النقيّ المختبر (`rule-test-runner`) — لا منطق مكرر هنا
// (P-07) — وهذه اللوحة عرض وتشغيل وتسجيل في التدقيق فقط.
//
// نفس الحالات تُشغَّل في `npm test` (tests/rule-test-suite.test.ts) فينكشف
// الانحدار في CI قبل أن يفسد النتائج.

'use client';

import { useMemo } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { runProfileTests, failingRules } from '@/lib/tashjeer/decision/rule-test-runner';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface RuleTestsPanelProps {
  config: EngineConfig;
  /** قاعدة مركّز عليها (من المستكشف) — يُقدَّم تقريرها. */
  focusRuleId?: string | null;
  /** تشغيل الاختبارات وتسجيل التشغيل في سجل التدقيق (FR-ES-08.4). */
  onRunTests?: () => void;
  /** فتح قاعدة في المنشئ. */
  onOpenRule?: (ruleId: string) => void;
}

export function RuleTestsPanel({ config, focusRuleId, onRunTests, onOpenRule }: RuleTestsPanelProps) {
  const report = useMemo(() => runProfileTests(config), [config]);
  const failed = failingRules(report);

  /** قاعدة مركّز عليها أولًا، ثم الباقي بترتيب التقرير. */
  const ordered = useMemo(() => {
    if (!focusRuleId) return report.rules;
    const focus = report.rules.filter((item) => item.ruleId === focusRuleId);
    return [...focus, ...report.rules.filter((item) => item.ruleId !== focusRuleId)];
  }, [report.rules, focusRuleId]);

  const rulesWithoutTests = useMemo(
    () => config.rules.filter((rule) => (rule.testCases?.length ?? 0) === 0),
    [config.rules]
  );

  if (report.total === 0) {
    return (
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-gray-500">
          لا توجد حالات اختبار مرفقة بعد. أضف حالات إلى قواعدك من المنشئ لاكتشاف الانحدار تلقائيًا.
        </p>
        {onRunTests && (
          <button
            type="button"
            onClick={onRunTests}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            تشغيل وتسجيل في التدقيق
          </button>
        )}
        {rulesWithoutTests.length > 0 && (
          <p className="text-xs text-gray-400">
            {toArabicDigits(rulesWithoutTests.length)} قاعدة بلا حالات اختبار — كل قاعدة يُفضَّل أن تحمل حالة مرجعية واحدة
            على الأقل.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-3 gap-4 md:min-w-[420px] md:flex-1">
          <SummaryCard label="إجمالي الحالات" value={report.total} tone="gray" />
          <SummaryCard label="ناجحة" value={report.passed} tone="emerald" />
          <SummaryCard label="فاشلة (انحدار)" value={report.failed} tone={report.failed > 0 ? 'red' : 'gray'} />
        </div>
        {onRunTests && (
          <button
            type="button"
            onClick={onRunTests}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            title="يُشغّل كل الحالات ويُسجّل التشغيل في سجل التدقيق"
          >
            تشغيل وتسجيل في التدقيق
          </button>
        )}
      </div>

      {failed.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">
            Regression detected — اكتُشف انحدار في {toArabicDigits(failed.length)} قاعدة.
          </p>
          <p className="mt-1 text-xs">
            راجع الحالات الفاشلة بالأسفل؛ الحفظ يتطلب تأكيدًا صريحًا بالتجاوز الموثّق (سبب يُحفظ في الإصدار وسجل
            التدقيق). ونفس الحالات تُشغَّل في `npm test` فيفشل البناء عند الانحدار.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {ordered.map((ruleReport) => (
          <div
            key={ruleReport.ruleId}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              ruleReport.failed > 0 ? 'border-red-200' : 'border-gray-200'
            } ${ruleReport.ruleId === focusRuleId ? 'ring-2 ring-emerald-200' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-gray-900">
                {ruleReport.ruleName}
                {ruleReport.ruleId === focusRuleId && (
                  <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">مركّز عليها</span>
                )}
              </h4>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    ruleReport.failed > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {toArabicDigits(ruleReport.passed)}/{toArabicDigits(ruleReport.total)}
                </span>
                {onOpenRule && (
                  <button
                    type="button"
                    onClick={() => onOpenRule(ruleReport.ruleId)}
                    className="rounded-lg border border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    فتح القاعدة
                  </button>
                )}
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {ruleReport.results.map((result, index) => (
                <li
                  key={index}
                  className={`flex flex-wrap items-center gap-3 rounded-lg px-3 py-1.5 text-sm ${
                    result.passed ? 'bg-gray-50' : 'bg-red-50'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      result.passed ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  >
                    {result.passed ? '✓' : '✕'}
                  </span>
                  <span className="text-gray-700">{result.caseName}</span>
                  {!result.passed && (
                    <span className="rounded bg-white px-2 py-0.5 text-xs text-red-700 ring-1 ring-red-200">
                      Expected: <span className="font-semibold">{result.expected}</span> / Current:{' '}
                      <span className="font-semibold">{result.actual}</span>
                    </span>
                  )}
                  <span className="mr-auto text-xs text-gray-400">{result.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {rulesWithoutTests.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-500 shadow-sm">
          <p className="font-medium text-gray-700">
            {toArabicDigits(rulesWithoutTests.length)} قاعدة بلا حالات اختبار:
          </p>
          <p className="mt-1">
            {rulesWithoutTests
              .slice(0, 12)
              .map((rule) => rule.name)
              .join('، ')}
            {rulesWithoutTests.length > 12 ? `… و${toArabicDigits(rulesWithoutTests.length - 12)} أخرى` : ''}
          </p>
        </div>
      )}
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
      <p className="text-3xl font-bold">{toArabicDigits(value)}</p>
      <p className="mt-1 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

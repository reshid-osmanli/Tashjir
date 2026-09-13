// ساحة الاختبار وأثر القرار — Why? & Trace Playground (FR-ES-09، FR-ES-10)
// مشروع التشجير - نظام القراءات العشر
//
// يختار المستخدم عنصرين فيُعرض قرار الدمج مع أثر كامل: القواعد المطابقة
// والفائزة والمتجاهلة وسببها. لا منطق مكرر: كل شيء يمرّ عبر Decision Resolver
// الموجود (P-07، FR-EN-03).

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { resolveMerge } from '@/lib/tashjeer/decision/api';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { DIFFERENCE_TYPES, DIFFERENCE_TYPE_LABELS } from './labels';
import { DecisionGraphView } from './DecisionGraphView';

interface WhyTracePlaygroundProps {
  config: EngineConfig;
  /** قاعدة يُراد إبراز دورها في الأثر (من رابط عميق أو من المستكشف). */
  focusRuleId?: string | null;
  /** فتح قاعدة في المنشئ (من رسم القرار). */
  onOpenRule?: (ruleId: string) => void;
}

export function WhyTracePlayground({ config, focusRuleId, onOpenRule }: WhyTracePlaygroundProps) {
  const [a, setA] = useState('MADD');
  const [b, setB] = useState('FARSH');

  const result = useMemo(() => resolveMerge(a, b, config), [a, b, config]);

  // قاعدة مُبرزة: إن كانت شروطها تُطابق نوعًا معروفًا نُعبّئ الساحة به حتى يرى
  // المستخدم أثر القاعدة فعلًا (لا اختيار يدويًا لازمًا).
  const focusRule = focusRuleId ? config.rules.find((rule) => rule.id === focusRuleId) ?? null : null;
  useEffect(() => {
    if (!focusRule) return;
    const fields = new Map<string, unknown>();
    const walk = (group: typeof focusRule.conditions) => {
      for (const item of group.all ?? []) {
        if ('field' in item) fields.set(item.field, item.value);
        else walk(item);
      }
    };
    walk(focusRule.conditions);
    const known = DIFFERENCE_TYPES as string[];
    const differenceType = fields.get('differenceType');
    const relatedType = fields.get('relatedType') ?? fields.get('otherType');
    if (typeof differenceType === 'string' && known.includes(differenceType)) setA(differenceType);
    if (typeof relatedType === 'string' && known.includes(relatedType)) setB(relatedType);
  }, [focusRule]);

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">ساحة الاختبار: لماذا؟</h3>
        <p className="mt-1 text-sm text-gray-500">
          اختر عنصرين لمعرفة قرار الدمج والقواعد التي حسمته. هذا هو «لماذا؟» متاحًا على أي قرار (FR-ES-10).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-4">
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">العنصر أ</label>
          <select
            value={a}
            onChange={(event) => setA(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {DIFFERENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {DIFFERENCE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">العنصر ب</label>
          <select
            value={b}
            onChange={(event) => setB(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {DIFFERENCE_TYPES.map((type) => (
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

      {/* أثر القرار */}
      <div>
        <h4 className="mb-2 font-semibold text-gray-800">أثر القرار (Decision Trace)</h4>
        {result.trace.length === 0 ? (
          <p className="text-sm text-gray-400">لا خطوات مسجَّلة.</p>
        ) : (
          <ol className="space-y-1.5">
            {result.trace.map((step, index) => (
              <li
                key={index}
                className={`flex items-start gap-3 rounded-lg border-r-4 px-3 py-2 text-sm ${TRACE_TONE[step.status]}`}
              >
                <span className="mt-0.5 font-mono text-xs text-gray-400">{step.stage}</span>
                <span className="flex-1 text-gray-700">{step.message}</span>
                {typeof step.priority === 'number' && (
                  <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs text-gray-500">أولوية {step.priority}</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* القواعد الفائزة */}
      {result.appliedRules.length > 0 && (
        <div>
          <h4 className="mb-2 font-semibold text-gray-800">قواعد مطابقة فاعلة</h4>
          <ul className="space-y-1">
            {result.appliedRules.map((rule) => (
              <li key={rule.id} className="rounded bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
                {rule.name} <span className="text-xs opacity-70">(أولوية {rule.priority})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* رسم منطق القرار (FR-ES-07.7.2): يقرأ الأثر نفسه لا منطقًا جديدًا */}
      <DecisionGraphView
        result={result}
        context={{ differenceType: a, relatedType: b, otherType: b }}
        inputLabel={`${DIFFERENCE_TYPE_LABELS[a] ?? a} + ${DIFFERENCE_TYPE_LABELS[b] ?? b}`}
        onOpenRule={onOpenRule}
      />

      {focusRule && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <p className="font-semibold">
            القاعدة المُبرزة: {focusRule.name}{' '}
            <span className="font-normal opacity-80">(أولوية {toArabicDigits(focusRule.priority)})</span>
          </p>
          <p className="mt-1">
            {result.trace.some((step) => step.ruleId === focusRule.id)
              ? 'ظهرت هذه القاعدة في أثر القرار أعلاه — انقر عقدها في الرسم لفتحها.'
              : 'لم تطابق هذه القاعدة المدخلين الحاليين؛ غيّر العنصرين أعلاه لرؤية أثرها، أو افتحها من المستكشف.'}
          </p>
          {onOpenRule && (
            <button
              type="button"
              onClick={() => onOpenRule(focusRule.id)}
              className="mt-2 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              فتح القاعدة في المنشئ
            </button>
          )}
        </div>
      )}

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        ملاحظة: القرار يُحسم بمصفوفة الدمج والقواعد المفعّلة معًا. عدّل القواعد أو المصفوفة ثم اختبر هنا قبل الاعتماد.
      </p>
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

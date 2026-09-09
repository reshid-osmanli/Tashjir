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
import { editorCategoryToStudioType } from '@/lib/tashjeer/decision/editor-bridge';
import { useEngineStudioStore } from '@/stores/engine-config-ui-store';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

/** عنصر على السطر المحدد: اختلاف بفئته، لتفسير «لماذا اجتمعا في سطر واحد؟». */
export interface WhyLineEntry {
  variantId: string;
  title: string;
  category: VariantCategory;
}

interface WhyTraceDialogProps {
  category: VariantCategory;
  onClose: () => void;
  /** قاعدة تُبرز في الأثر (من رابط عميق /editor?rule=...). */
  highlightRuleId?: string;
  /**
   * السطر المحدد إن وُجد: عند تعدد اختلافاته يُعرض قرار الدمج لكل زوج فعلي
   * على السطر (لماذا؟ لكل سطر — FR-ES-15.4)، لا افتراضا مجردا.
   */
  line?: { label: string; entries: WhyLineEntry[] } | null;
}

export function WhyTraceDialog({ category, onClose, highlightRuleId, line = null }: WhyTraceDialogProps) {
  const { config, hydrate, loaded } = useEngineStudioStore();
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const a = editorCategoryToStudioType(category);
  const [b, setB] = useState(a === 'MADD' ? 'FARSH' : 'MADD');
  const profile = loaded ? config : DEFAULT_SYSTEM_PROFILE;

  const result = useMemo(() => resolveMerge(a, b, profile), [a, b, profile]);

  // أزواج السطر الفعلية: كل اختلافين مختلفَي الفئة اجتمعا على السطر.
  const linePairs = useMemo(() => {
    if (!line || line.entries.length < 2) return [];
    const unique = new Map<string, WhyLineEntry>();
    for (const entry of line.entries) unique.set(entry.variantId, entry);
    const items = [...unique.values()];
    const pairs: Array<{ left: WhyLineEntry; right: WhyLineEntry; merge: boolean; reason: string }> = [];
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const decision = resolveMerge(
          editorCategoryToStudioType(items[i].category),
          editorCategoryToStudioType(items[j].category),
          profile
        ).decision;
        pairs.push({ left: items[i], right: items[j], merge: decision.merge, reason: decision.reason });
      }
    }
    return pairs;
  }, [line, profile]);

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
          {line && (
            <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50/50 p-4">
              <h3 className="text-sm font-semibold text-cyan-900">السطر المحدد: {line.label}</h3>
              {linePairs.length === 0 ? (
                <p className="mt-1 text-xs text-cyan-800">
                  على هذا السطر اختلاف واحد ({toArabicDigits(line.entries.length)} حكم)؛ لا قرار دمج بين اختلافات مختلفة هنا.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {linePairs.map((pair) => (
                    <li key={`${pair.left.variantId}-${pair.right.variantId}`} className="flex flex-wrap items-center gap-2 rounded bg-white px-3 py-1.5 text-xs">
                      <span className="font-medium text-stone-800">{pair.left.title}</span>
                      <span className="text-stone-400">مع</span>
                      <span className="font-medium text-stone-800">{pair.right.title}</span>
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${pair.merge ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                        {pair.merge ? 'يُدمجان' : 'لا يُدمجان'}
                      </span>
                      <span className="text-stone-500">{pair.reason}</span>
                      <button
                        type="button"
                        onClick={() => setB(editorCategoryToStudioType(pair.left.category === category ? pair.right.category : pair.left.category))}
                        className="mr-auto text-cyan-800 underline-offset-2 hover:underline"
                      >
                        الأثر الكامل
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {linePairs.some((pair) => !pair.merge) && (
                <p className="mt-2 text-[11px] text-amber-800">
                  زوج على هذا السطر يقول المحرك إنه لا يُدمج، ومع ذلك جمعهما السطر يدويا. يمكن اقتراح قاعدة من هذا التصحيح في الاستوديو.
                </p>
              )}
            </div>
          )}
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
                  <li
                    key={index}
                    className={`flex items-start gap-3 rounded-lg border-r-4 px-3 py-2 text-sm ${TRACE_TONE[step.status]} ${
                      highlightRuleId && step.ruleId === highlightRuleId ? 'ring-2 ring-violet-400' : ''
                    }`}
                  >
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
                  <li
                    key={rule.id}
                    className={`flex items-center justify-between gap-2 rounded bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 ${
                      highlightRuleId === rule.id ? 'ring-2 ring-violet-400' : ''
                    }`}
                  >
                    <span>
                      {rule.name} <span className="text-xs opacity-70">(أولوية {toArabicDigits(rule.priority)})</span>
                    </span>
                    <a href={`/studio?rule=${encodeURIComponent(rule.id)}`} className="text-xs text-emerald-700 underline-offset-2 hover:underline">
                      افتح في الاستوديو
                    </a>
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

/** قائمة أثر قرار مضغوطة قابلة لإعادة الاستعمال (التتبع، البطاقات). */
export function DecisionTraceList({
  trace,
  highlightRuleId,
  compact = false,
}: {
  trace: Array<{ stage: string; message: string; status: string; ruleId?: string; priority?: number }>;
  highlightRuleId?: string;
  compact?: boolean;
}) {
  if (trace.length === 0) return <p className="text-sm text-gray-400">لا خطوات مسجَّلة.</p>;
  return (
    <ol className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {trace.map((step, index) => (
        <li
          key={index}
          className={`flex items-start gap-2 rounded-lg border-r-4 px-2.5 py-1.5 ${compact ? 'text-[11px]' : 'text-sm'} ${TRACE_TONE[step.status] ?? TRACE_TONE.info} ${
            highlightRuleId && step.ruleId === highlightRuleId ? 'ring-2 ring-violet-400' : ''
          }`}
        >
          <span className="mt-0.5 font-mono text-[10px] text-gray-400">{step.stage}</span>
          <span className="flex-1 text-gray-700">{step.message}</span>
          {typeof step.priority === 'number' && (
            <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] text-gray-500">أولوية {toArabicDigits(step.priority)}</span>
          )}
        </li>
      ))}
    </ol>
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

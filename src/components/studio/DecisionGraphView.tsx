// عرض منطق القرار بصريًا — Visual Decision Graph (FR-ES-07.7.2)
// مشروع التشجير - نظام القراءات العشر
//
//   Input ↓ [Condition] ├─ نعم → [Rule A] → [Merge]
//                       └─ لا  → [Rule B] → [Split]
//
// يقرأ **نفس بيانات الأثر (Trace)** التي ينتجها Decision Resolver وتعرضها ساحة
// «لماذا؟» — لا محرك رسم منطقي جديد ولا قرار مكرر (P-07). الرسم SVG داخلي:
// عُقد ملوّنة بحالة الخطوة، فرعان «نعم/لا»، ونقر على عقدة قاعدة يفتحها، وإبراز
// للمسار من المدخل إلى النتيجة.

'use client';

import { useMemo, useState } from 'react';
import type { DecisionResult, DecisionTraceStep } from '@/lib/tashjeer/decision/resolver';
import type { DecisionContext } from '@/lib/tashjeer/decision/policy';
import {
  DECISION_NODE_HEIGHT,
  DECISION_NODE_WIDTH,
  OUTCOME_LABELS,
  buildDecisionGraph,
  buildDecisionGraphFromResult,
  pathToResult,
  type DecisionGraph,
  type DecisionNodeKind,
} from '@/lib/tashjeer/decision/decision-graph';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface DecisionGraphViewProps {
  /** نتيجة قرار من واجهة القرار الموحّدة (الطريق المعتاد). */
  result?: DecisionResult<unknown>;
  /** أو أثر مباشر (حين لا تكون النتيجة الكاملة متاحة). */
  trace?: DecisionTraceStep[];
  context?: DecisionContext;
  inputLabel?: string;
  outcome?: DecisionGraph['outcome'];
  resultLabel?: string;
  onOpenRule?: (ruleId: string) => void;
  /** عنوان اختياري فوق الرسم. */
  title?: string;
}

const NODE_STYLES: Record<DecisionNodeKind, { fill: string; stroke: string; text: string; label: string }> = {
  INPUT: { fill: '#eff6ff', stroke: '#93c5fd', text: '#1e3a8a', label: 'مدخل' },
  CONDITION: { fill: '#fefce8', stroke: '#fde047', text: '#713f12', label: 'شرط' },
  RULE: { fill: '#ecfdf5', stroke: '#6ee7b7', text: '#065f46', label: 'قاعدة' },
  STAGE: { fill: '#f5f3ff', stroke: '#c4b5fd', text: '#4c1d95', label: 'مرحلة' },
  OUTCOME: { fill: '#fff7ed', stroke: '#fdba74', text: '#7c2d12', label: 'حكم' },
  RESULT: { fill: '#f0fdfa', stroke: '#5eead4', text: '#134e4a', label: 'نتيجة' },
};

const STATUS_STROKE: Record<string, string> = {
  won: '#059669',
  blocked: '#dc2626',
  applied: '#2563eb',
  skipped: '#9ca3af',
  lost: '#9ca3af',
  info: '#9ca3af',
};

export function DecisionGraphView({
  result,
  trace,
  context,
  inputLabel,
  outcome,
  resultLabel,
  onOpenRule,
  title,
}: DecisionGraphViewProps) {
  const [highlight, setHighlight] = useState<string[] | null>(null);

  const graph = useMemo(() => {
    if (result) return buildDecisionGraphFromResult(result, { context, inputLabel, outcome, resultLabel });
    return buildDecisionGraph(trace ?? [], { context, inputLabel, outcome, resultLabel });
  }, [result, trace, context, inputLabel, outcome, resultLabel]);

  const nodeById = (id: string) => graph.byId.get(id);
  const isHighlighted = (id: string) => (highlight ? highlight.includes(id) : true);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-bold text-gray-900">{title ?? 'رسم منطق القرار'}</h4>
          <p className="mt-0.5 text-xs text-gray-500">
            يقرأ أثر القرار نفسه: {toArabicDigits(graph.stats.matched)} قاعدة مطابقة ·{' '}
            {toArabicDigits(graph.stats.skipped)} غير مطابقة · {toArabicDigits(graph.stats.stages)} مرحلة. الحكم:{' '}
            <span className="font-semibold text-gray-700">{OUTCOME_LABELS[graph.outcome]}</span>
          </p>
        </div>
        {highlight && (
          <button
            type="button"
            onClick={() => setHighlight(null)}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            إلغاء إبراز المسار
          </button>
        )}
      </header>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50/60" dir="rtl">
        <svg
          width={Math.max(graph.width, 480)}
          height={Math.max(graph.height, 200)}
          viewBox={`0 0 ${Math.max(graph.width, 480)} ${Math.max(graph.height, 200)}`}
          role="img"
          aria-label="رسم منطق القرار"
          className="select-none"
        >
          <defs>
            <marker id="decision-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
            </marker>
          </defs>

          {/* الحواف */}
          {graph.edges.map((edge) => {
            const from = nodeById(edge.from);
            const to = nodeById(edge.to);
            if (!from || !to) return null;
            const dimmed = !isHighlighted(edge.from) || !isHighlighted(edge.to);
            // RTL: نخرج من يسار العقدة الأولى إلى يمين التالية (الأعمدة تتناقص x).
            const x1 = from.x;
            const x2 = to.x + DECISION_NODE_WIDTH;
            const y1 = from.y + DECISION_NODE_HEIGHT / 2;
            const y2 = to.y + DECISION_NODE_HEIGHT / 2;
            const midX = (x1 + x2) / 2;
            const branchColor = edge.branch === 'نعم' ? '#059669' : edge.branch === 'لا' ? '#dc2626' : '#6b7280';
            return (
              <g key={edge.id} opacity={dimmed ? 0.2 : 1}>
                <path
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={branchColor}
                  strokeWidth={1.6}
                  markerEnd="url(#decision-arrow)"
                />
                {edge.branch && (
                  <text x={midX} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={11} fill={branchColor} fontWeight={700}>
                    {edge.branch}
                  </text>
                )}
              </g>
            );
          })}

          {/* العُقد */}
          {graph.nodes.map((node) => {
            const style = NODE_STYLES[node.kind];
            const dimmed = !isHighlighted(node.id);
            const stroke = node.status ? STATUS_STROKE[node.status] ?? style.stroke : style.stroke;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                opacity={dimmed ? 0.3 : 1}
                className={node.ruleId && onOpenRule ? 'cursor-pointer' : 'cursor-default'}
                onClick={() => {
                  setHighlight(pathToResult(graph, node.id));
                  if (node.ruleId && onOpenRule) onOpenRule(node.ruleId);
                }}
              >
                <title>{node.detail ?? node.label}</title>
                <rect
                  width={DECISION_NODE_WIDTH}
                  height={DECISION_NODE_HEIGHT}
                  rx={10}
                  fill={style.fill}
                  stroke={stroke}
                  strokeWidth={node.kind === 'OUTCOME' || node.kind === 'RESULT' ? 2 : 1.3}
                />
                <text x={DECISION_NODE_WIDTH - 10} y={18} textAnchor="end" fontSize={10} fill={style.text} opacity={0.75}>
                  {style.label}
                </text>
                <text x={DECISION_NODE_WIDTH - 10} y={34} textAnchor="end" fontSize={12} fontWeight={700} fill={style.text}>
                  {truncate(node.label, 26)}
                </text>
                {node.detail && (
                  <text x={DECISION_NODE_WIDTH - 10} y={50} textAnchor="end" fontSize={10} fill={style.text} opacity={0.8}>
                    {truncate(node.detail, 34)}
                  </text>
                )}
                {typeof node.priority === 'number' && (
                  <text x={10} y={50} fontSize={9} fill={style.text} opacity={0.7}>
                    {`أولوية ${toArabicDigits(node.priority)}`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
        {(Object.keys(NODE_STYLES) as DecisionNodeKind[]).map((kind) => (
          <span key={kind} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-5 rounded"
              style={{ background: NODE_STYLES[kind].fill, border: `1px solid ${NODE_STYLES[kind].stroke}` }}
            />
            {NODE_STYLES[kind].label}
          </span>
        ))}
        <span className="mr-auto">
          انقر عقدة لإبراز مسارها من المدخل؛ ونقر عقدة قاعدة يفتحها{onOpenRule ? ' في المنشئ' : ''}.
        </span>
      </div>
    </div>
  );
}

/** يقصّ نصًا ليناسب العقدة. */
function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// رسم اعتمادات القواعد — Rule Dependency Graph (FR-ES-07.7.1)
// مشروع التشجير - نظام القراءات العشر
//
// رسم عُقدي قابل للتنقل يعرض لكل قاعدة: Depends On / Overrides / Conflicts With /
// Triggers. الاشتقاق كله في `rule-dependencies` النقيّة (من الإعلان ومن بنية
// الشروط والإجراءات)، والرسم هنا SVG داخلي بلا مكتبة خارجية: تكبير/تصغير،
// سحب، إبراز الجيران عند النقر، وتركيز على قاعدة واحدة (رسم جزئي).
//
// RTL: العُقد تبدأ من اليمين وتتقدم يسارًا، والأسهم كذلك.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import {
  EDGE_KIND_COLORS,
  EDGE_KIND_LABELS,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  buildRuleGraph,
  isolatedRuleIds,
  subgraphAround,
  type DependencyEdgeKind,
} from '@/lib/tashjeer/rule-dependencies';
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from './labels';

interface RuleDependencyGraphProps {
  config: EngineConfig;
  /** قاعدة مركّز عليها (من المستكشف) — تُبرز جيرانها. */
  focusRuleId?: string | null;
  onOpenRule?: (ruleId: string) => void;
  /** عمق الجيران عند التركيز (١ = الجيران المباشرون). */
  depth?: number;
}

const EDGE_KINDS: DependencyEdgeKind[] = ['DEPENDS_ON', 'OVERRIDES', 'CONFLICTS_WITH', 'TRIGGERS'];

export function RuleDependencyGraph({ config, focusRuleId, onOpenRule, depth = 1 }: RuleDependencyGraphProps) {
  const [focus, setFocus] = useState<string | null>(focusRuleId ?? null);
  const [kinds, setKinds] = useState<Set<DependencyEdgeKind>>(new Set(EDGE_KINDS));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => setFocus(focusRuleId ?? null), [focusRuleId]);

  const full = useMemo(() => buildRuleGraph(config), [config]);
  const graph = useMemo(() => (focus ? subgraphAround(full, focus, depth) : full), [full, focus, depth]);
  const visibleEdges = useMemo(() => graph.edges.filter((edge) => kinds.has(edge.kind)), [graph, kinds]);
  const isolated = useMemo(() => new Set(isolatedRuleIds(graph)), [graph]);
  const neighborIds = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const edge of visibleEdges) {
      if (edge.from === focus) set.add(edge.to);
      if (edge.to === focus) set.add(edge.from);
    }
    return set;
  }, [focus, visibleEdges]);

  const nameOf = (id: string) => graph.byId.get(id)?.name ?? config.rules.find((rule) => rule.id === id)?.name ?? id;

  const toggleKind = (kind: DependencyEdgeKind) =>
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = dragStart.current;
    if (!dragging || !start) return;
    setPan({ x: start.panX + (event.clientX - start.x), y: start.panY + (event.clientY - start.y) });
  };
  const stopDrag = () => {
    setDragging(false);
    dragStart.current = null;
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">رسم اعتمادات القواعد</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {toArabicDigits(graph.nodes.length)} عقدة · {toArabicDigits(visibleEdges.length)} حافة · مشتقة من الإعلان ومن
            بنية الشروط والإجراءات. اسحب للتحريك، وانقر عقدة لإبراز جيرانها.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.4, value - 0.2))} className={TOOL_BUTTON}>
            −
          </button>
          <span className="text-xs text-gray-500">{toArabicDigits(Math.round(zoom * 100))}٪</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(2.4, value + 0.2))} className={TOOL_BUTTON}>
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className={TOOL_BUTTON}
          >
            ضبط
          </button>
          {focus && (
            <button type="button" onClick={() => setFocus(null)} className={TOOL_BUTTON}>
              إلغاء التركيز
            </button>
          )}
        </div>
      </header>

      {/* وسيلة الإيضاح + مرشّح الأنواع */}
      <div className="flex flex-wrap items-center gap-2">
        {EDGE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => toggleKind(kind)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
              kinds.has(kind) ? 'bg-white text-gray-700 ring-gray-300' : 'bg-gray-100 text-gray-400 ring-gray-200'
            }`}
            title={EDGE_KIND_LABELS[kind]}
          >
            <span className="inline-block h-2 w-6 rounded" style={{ background: EDGE_KIND_COLORS[kind] }} />
            {EDGE_KIND_LABELS[kind]}
          </button>
        ))}
        {full.cycles.length > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
            ⚠ {toArabicDigits(full.cycles.length)} دورة اعتماد
          </span>
        )}
        {isolated.size > 0 && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
            {toArabicDigits(isolated.size)} قاعدة معزولة
          </span>
        )}
      </div>

      {/* الرسم */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50/60" dir="rtl">
        <svg
          width="100%"
          height={Math.min(560, Math.max(240, graph.height * zoom + 40))}
          viewBox={`0 0 ${Math.max(graph.width, 320)} ${Math.max(graph.height, 200)}`}
          className={dragging ? 'cursor-grabbing touch-none select-none' : 'cursor-grab touch-none select-none'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerLeave={stopDrag}
          role="img"
          aria-label="رسم اعتمادات القواعد"
        >
          <defs>
            {EDGE_KINDS.map((kind) => (
              <marker
                key={kind}
                id={`arrow-${kind}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_KIND_COLORS[kind]} />
              </marker>
            ))}
          </defs>

          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {/* الحواف */}
            {visibleEdges.map((edge) => {
              const from = graph.byId.get(edge.from);
              const to = graph.byId.get(edge.to);
              if (!from || !to) return null;
              const dimmed = neighborIds ? !(neighborIds.has(edge.from) && neighborIds.has(edge.to)) : false;
              const x1 = from.x + (to.x < from.x ? 0 : GRAPH_NODE_WIDTH);
              const x2 = to.x + (to.x < from.x ? GRAPH_NODE_WIDTH : 0);
              const y1 = from.y + GRAPH_NODE_HEIGHT / 2;
              const y2 = to.y + GRAPH_NODE_HEIGHT / 2;
              const midX = (x1 + x2) / 2;
              return (
                <g key={edge.id} opacity={dimmed ? 0.18 : 1}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={EDGE_KIND_COLORS[edge.kind]}
                    strokeWidth={edge.kind === 'CONFLICTS_WITH' ? 2 : 1.6}
                    strokeDasharray={edge.declared ? undefined : '5 4'}
                    markerEnd={`url(#arrow-${edge.kind})`}
                  >
                    <title>{`${EDGE_KIND_LABELS[edge.kind]}: ${nameOf(edge.from)} ← ${nameOf(edge.to)}\n${edge.reason}`}</title>
                  </path>
                </g>
              );
            })}

            {/* العُقد */}
            {graph.nodes.map((node) => {
              const dimmed = neighborIds ? !neighborIds.has(node.id) : false;
              const conflicted = node.status === 'CONFLICTED';
              const fill = conflicted ? '#fef2f2' : isolated.has(node.id) ? '#f9fafb' : '#ffffff';
              const stroke = conflicted ? '#dc2626' : node.id === focus ? '#059669' : '#d1d5db';
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  opacity={dimmed ? 0.35 : 1}
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    setFocus(node.id === focus ? null : node.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onOpenRule?.(node.id);
                  }}
                >
                  <title>
                    {`${node.name}\n${node.id}\nالحالة: ${STATUS_LABELS[node.status]} · الأولوية: ${node.priority}\nانقر للتركيز، وانقر نقرًا مزدوجًا لفتح القاعدة`}
                  </title>
                  <rect
                    width={GRAPH_NODE_WIDTH}
                    height={GRAPH_NODE_HEIGHT}
                    rx={10}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={node.id === focus ? 2.4 : 1.2}
                  />
                  <text x={GRAPH_NODE_WIDTH - 10} y={20} textAnchor="end" className="fill-gray-900" fontSize={12} fontWeight={600}>
                    {truncate(node.name, 26)}
                  </text>
                  <text x={GRAPH_NODE_WIDTH - 10} y={36} textAnchor="end" className="fill-gray-500" fontSize={10}>
                    {`أولوية ${toArabicDigits(node.priority)} · ${STATUS_LABELS[node.status]}`}
                  </text>
                  <text x={GRAPH_NODE_WIDTH - 10} y={50} textAnchor="end" className="fill-gray-400" fontSize={9} direction="ltr">
                    {truncate(node.id, 28)}
                  </text>
                  {node.protected && (
                    <text x={12} y={20} fontSize={11} className="fill-amber-600">
                      🔒
                    </text>
                  )}
                  {node.usage > 0 && (
                    <text x={12} y={50} fontSize={9} className="fill-gray-400">
                      {`${toArabicDigits(node.usage)} إشارة`}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* تفاصيل العقدة المركّز عليها */}
      {focus && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-800">
            {nameOf(focus)}{' '}
            <span className="text-xs font-normal text-gray-500">
              (نقر مزدوج على العقدة يفتحها في المنشئ)
            </span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            {EDGE_KINDS.map((kind) => {
              const outgoing = visibleEdges.filter((edge) => edge.kind === kind && edge.from === focus);
              const incoming = visibleEdges.filter((edge) => edge.kind === kind && edge.to === focus);
              return (
                <div key={kind} className="rounded-lg bg-white p-2 ring-1 ring-gray-200">
                  <p className="font-semibold" style={{ color: EDGE_KIND_COLORS[kind] }}>
                    {EDGE_KIND_LABELS[kind]}
                  </p>
                  <p className="mt-1 text-gray-600">
                    منها: {outgoing.length > 0 ? outgoing.map((edge) => nameOf(edge.to)).join('، ') : '—'}
                  </p>
                  <p className="mt-0.5 text-gray-500">
                    إليها: {incoming.length > 0 ? incoming.map((edge) => nameOf(edge.from)).join('، ') : '—'}
                  </p>
                </div>
              );
            })}
          </div>
          {onOpenRule && (
            <button
              type="button"
              onClick={() => onOpenRule(focus)}
              className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              فتح القاعدة في المنشئ
            </button>
          )}
        </div>
      )}

      {full.cycles.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <p className="font-semibold">دورات اعتماد مكتشفة (قد تُعطّل الحسم):</p>
          <ul className="mt-1 space-y-1">
            {full.cycles.slice(0, 6).map((cycle, index) => (
              <li key={index}>
                {cycle.map((id) => nameOf(id)).join(' ← ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        الخط المتصل = علاقة معلنة في حقول القاعدة، والمتقطّع = مشتقة من بنية الشروط والإجراءات. الحالة:{' '}
        <span className={STATUS_BADGE_CLASSES.ACTIVE}>{STATUS_LABELS.ACTIVE}</span> وغيرها كما في المستكشف.
      </p>
    </div>
  );
}

const TOOL_BUTTON =
  'rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50';

/** يقصّ نصًا طويلاً لعرضه داخل العقدة. */
function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

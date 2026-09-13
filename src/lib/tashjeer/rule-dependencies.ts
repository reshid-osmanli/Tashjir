// رسم اعتمادات القواعد — Rule Dependency Graph (FR-ES-07.7.1)
// مشروع التشجير - نظام القراءات العشر
//
// يشتق لكل قاعدة أربع علاقات: `Depends On / Overrides / Conflicts With /
// Triggers`. العلاقات **المعلنة** تُقرأ من حقول القاعدة (dependsOn/overrides/
// conflictsWith)، و**المشتقة** من بنية الشروط والإجراءات:
//   - إحالة إجراء إلى معرّف قاعدة (params.ruleId / targetRuleId / value...)
//   - إجراء يكتب حقلًا تقرأه شروط قاعدة أخرى ← «تُطلق» (Triggers)
// فلا يُطلب من المستخدم إعلان ما هو مكتوب أصلًا في بنية القاعدة.
//
// الطبقة نقيّة بلا DOM: تعيد عُقدًا وحوافًا بإحداثيات محسوبة حتميًا، وترسمها
// الواجهة SVG (لا مكتبة خارجية). كل الترتيب حتمي (معرّفات) فيستقر الرسم بين
// تشغيلين (DM-13).

import type { EngineConfig, EngineRule, RuleStatus } from '@/lib/tashjeer/model/v8';
import { SPECIFICITY_RANK } from '@/lib/tashjeer/model/v8';
import { inferRuleSource } from './rule-diff';

/** أنواع الحواف في رسم الاعتمادات. */
export type DependencyEdgeKind = 'DEPENDS_ON' | 'OVERRIDES' | 'CONFLICTS_WITH' | 'TRIGGERS';

/** تسميات عربية لأنواع الحواف (تُستعمل في وسيلة الإيضاح والرسم). */
export const EDGE_KIND_LABELS: Record<DependencyEdgeKind, string> = {
  DEPENDS_ON: 'تعتمد على',
  OVERRIDES: 'تتجاوز',
  CONFLICTS_WITH: 'تتعارض مع',
  TRIGGERS: 'تُطلق',
};

/** ألوان الحواف (Tailwind hex) — ثابتة لتطابق وسيلة الإيضاح والرسم. */
export const EDGE_KIND_COLORS: Record<DependencyEdgeKind, string> = {
  DEPENDS_ON: '#059669',
  OVERRIDES: '#2563eb',
  CONFLICTS_WITH: '#dc2626',
  TRIGGERS: '#d97706',
};

export interface DependencyEdge {
  id: string;
  from: string;
  to: string;
  kind: DependencyEdgeKind;
  /** هل العلاقة معلنة صراحةً في حقول القاعدة (أم مشتقة من البنية)؟ */
  declared: boolean;
  reason: string;
}

export interface RuleGraphNode {
  id: string;
  name: string;
  status: RuleStatus;
  priority: number;
  groupId: string;
  category: EngineRule['category'];
  protected: boolean;
  source: ReturnType<typeof inferRuleSource>;
  /** عداد الاستخدام الخام: كم قاعدة أخرى تشير إليها. */
  usage: number;
  /** إحداثيات محسوبة للرسم (RTL: العمود ٠ في أقصى اليمين). */
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface RuleGraph {
  nodes: RuleGraphNode[];
  edges: DependencyEdge[];
  byId: Map<string, RuleGraphNode>;
  /** دورات في الاعتمادات (A تعتمد على B وتعتمد على A) — تُبرز كتحذير. */
  cycles: string[][];
  width: number;
  height: number;
}

/** أبعاد الرسم (بالبكسل المنطقي) — ثابتة حتى يستقر التخطيط. */
export const GRAPH_NODE_WIDTH = 190;
export const GRAPH_NODE_HEIGHT = 56;
export const GRAPH_COL_GAP = 250;
export const GRAPH_ROW_GAP = 78;
export const GRAPH_PADDING = 24;

/**
 * عدادات الاستخدام الخام (FR-ES-07.4: Usage في Metadata إذا سهُل):
 * لكل قاعدة كم قاعدة أخرى تعتمد عليها/تتجاوزها/تعلن تعارضها معها، وكم حالة
 * اختبار مرفقة بها. تُشتق من الملف فلا تخزين إضافي ولا تقدير.
 */
export function usageCounts(profile: EngineConfig): Map<string, { dependents: number; testCases: number; edges: number }> {
  const counts = new Map<string, { dependents: number; testCases: number; edges: number }>();
  const ensure = (id: string) => {
    const existing = counts.get(id);
    if (existing) return existing;
    const created = { dependents: 0, testCases: 0, edges: 0 };
    counts.set(id, created);
    return created;
  };
  for (const rule of profile.rules) {
    ensure(rule.id).testCases = rule.testCases?.length ?? 0;
    for (const id of rule.dependsOn ?? []) ensure(id).dependents += 1;
    for (const id of rule.overrides ?? []) ensure(id).dependents += 1;
    for (const id of rule.conflictsWith ?? []) ensure(id).dependents += 1;
  }
  return counts;
}

/** يجمع كل المعرّفات المحالة داخل معطيات إجراء (بحث عميق حتمي). */
function referencedIds(value: unknown, known: Set<string>, out: Set<string>): void {
  if (typeof value === 'string') {
    if (known.has(value)) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) referencedIds(item, known, out);
    return;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) referencedIds(record[key], known, out);
  }
}

/** الحقول التي تقرأها شروط القاعدة (مستهلكات). */
export function consumedFields(rule: EngineRule): Set<string> {
  const fields = new Set<string>();
  const walk = (group: EngineRule['conditions']) => {
    for (const item of group.all ?? []) {
      if ('field' in item) fields.add(item.field);
      else walk(item);
    }
    for (const item of group.any ?? []) {
      if ('field' in item) fields.add(item.field);
      else walk(item);
    }
    for (const item of group.not ?? []) {
      if ('field' in item) fields.add(item.field);
      else walk(item);
    }
  };
  walk(rule.conditions);
  return fields;
}

/** الحقول التي تكتبها إجراءات القاعدة (منتجات) — من params.field/set/context. */
export function producedFields(rule: EngineRule): Set<string> {
  const fields = new Set<string>();
  const keys = ['field', 'set', 'sets', 'assign', 'context', 'targetField'];
  for (const action of rule.actions) {
    const params = action.params ?? {};
    for (const key of keys) {
      const value = params[key];
      if (typeof value === 'string' && value.trim() !== '') fields.add(value.trim());
      if (Array.isArray(value)) {
        for (const item of value) if (typeof item === 'string') fields.add(item);
      }
    }
  }
  return fields;
}

/**
 * يبني رسم الاعتمادات كاملًا: عُقد بترتيب حتمي، وحواف معلنة ومشتقة، وكشف
 * الدورات، وإحداثيات للرسم.
 *
 * التخطيط: عمود لكل «طبقة اعتماد» (القواعد التي لا تعتمد على شيء في العمود
 * ٠)، وصفوف بترتيب المعرّف داخل العمود. RTL: العمود ٠ في أقصى اليمين.
 */
export function buildRuleGraph(profile: EngineConfig): RuleGraph {
  const rules = [...profile.rules].sort((a, b) => a.id.localeCompare(b.id));
  const known = new Set(rules.map((rule) => rule.id));
  const usage = usageCounts(profile);
  const edges: DependencyEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (from: string, to: string, kind: DependencyEdgeKind, declared: boolean, reason: string) => {
    if (from === to || !known.has(from) || !known.has(to)) return;
    const id = `${kind}:${from}->${to}`;
    if (seen.has(id)) return;
    seen.add(id);
    const counter = usage.get(to);
    if (counter) counter.edges += 1;
    edges.push({ id, from, to, kind, declared, reason });
  };

  // 1) العلاقات المعلنة في حقول القاعدة.
  for (const rule of rules) {
    for (const target of rule.dependsOn ?? []) {
      addEdge(rule.id, target, 'DEPENDS_ON', true, 'إعلان صريح في dependsOn');
    }
    for (const target of rule.overrides ?? []) {
      addEdge(rule.id, target, 'OVERRIDES', true, 'إعلان صريح في overrides');
    }
    for (const target of rule.conflictsWith ?? []) {
      addEdge(rule.id, target, 'CONFLICTS_WITH', true, 'إعلان صريح في conflictsWith');
      // التعارض علاقة متناظرة: تُرسم في الاتجاهين لفهمها بصريًا.
      addEdge(target, rule.id, 'CONFLICTS_WITH', true, 'إعلان صريح في conflictsWith (الطرف الآخر)');
    }
  }

  // 2) الإحالات داخل معطيات الإجراءات (APPLY_RULE / OVERRIDE_RESULT / ...).
  for (const rule of rules) {
    for (const action of rule.actions) {
      if (!action.params) continue;
      const referenced = new Set<string>();
      referencedIds(action.params, known, referenced);
      for (const target of Array.from(referenced).sort()) {
        addEdge(rule.id, target, 'TRIGGERS', false, `الإجراء ${action.type} يُحيل إلى القاعدة`);
      }
    }
  }

  // 3) الاشتقاق البنائي: إجراء يكتب حقلًا تقرأه شروط قاعدة أخرى ← تُطلقها.
  const consumers = rules.map((rule) => ({ rule, fields: consumedFields(rule) }));
  for (const rule of rules) {
    const produced = producedFields(rule);
    if (produced.size === 0) continue;
    for (const consumer of consumers) {
      if (consumer.rule.id === rule.id) continue;
      const shared = Array.from(produced)
        .filter((field) => consumer.fields.has(field))
        .sort();
      if (shared.length === 0) continue;
      addEdge(
        rule.id,
        consumer.rule.id,
        'TRIGGERS',
        false,
        `إجراء يكتب الحقل «${shared.join('، ')}» الذي تقرأه شروط القاعدة الأخرى`
      );
    }
  }

  // 4) الدورات في الاعتمادات (تُستثنى حواف التعارض لأنها متناظرة).
  const cycles = findCycles(edges);

  // 5) التخطيط: طبقات بعمق الاعتماد.
  const cols = computeColumns(rules, edges);
  const rowsByCol = new Map<number, number>();
  const nodes: RuleGraphNode[] = rules.map((rule) => {
    const col = cols.get(rule.id) ?? 0;
    const row = rowsByCol.get(col) ?? 0;
    rowsByCol.set(col, row + 1);
    const counters = usage.get(rule.id) ?? { dependents: 0, testCases: 0, edges: 0 };
    return {
      id: rule.id,
      name: rule.name,
      status: rule.status,
      priority: rule.priority,
      groupId: rule.groupId,
      category: rule.category,
      protected: Boolean(rule.protected),
      source: inferRuleSource(rule),
      usage: counters.dependents,
      col,
      row,
      // RTL: العمود ٠ في أقصى اليمين، وكلما زاد العمود اتجهنا يسارًا.
      x: 0,
      y: GRAPH_PADDING + row * GRAPH_ROW_GAP,
    };
  });

  const maxCol = nodes.reduce((max, node) => Math.max(max, node.col), 0);
  const maxRow = nodes.reduce((max, node) => Math.max(max, node.row), 0);
  const width = GRAPH_PADDING * 2 + (maxCol + 1) * GRAPH_COL_GAP;
  for (const node of nodes) {
    node.x = width - GRAPH_PADDING - GRAPH_NODE_WIDTH - node.col * GRAPH_COL_GAP;
  }
  const height = GRAPH_PADDING * 2 + (maxRow + 1) * GRAPH_ROW_GAP;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  edges.sort((a, b) => a.id.localeCompare(b.id));
  nodes.sort((a, b) => a.col - b.col || a.row - b.row || a.id.localeCompare(b.id));

  return { nodes, edges, byId, cycles, width, height };
}

/**
 * يحسب عمود كل عقدة: القواعد التي لا تعتمد على شيء في العمود ٠، ومن تعتمد
 * عليها في العمود التالي... (أطول مسار، مع كسر الدورات حتى لا يتعلّق الحساب).
 */
export function computeColumns(rules: EngineRule[], edges: DependencyEdge[]): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind === 'CONFLICTS_WITH') continue;
    const list = incoming.get(edge.to) ?? [];
    list.push(edge.from);
    incoming.set(edge.to, list);
  }
  const cols = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const cached = cols.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // دورة: تُكسر هنا ويُبرزها findCycles تحذيرًا.
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const depth = parents.length === 0 ? 0 : Math.max(...parents.map((parent) => depthOf(parent) + 1));
    visiting.delete(id);
    cols.set(id, depth);
    return depth;
  };
  for (const rule of rules) depthOf(rule.id);
  return cols;
}

/** يكشف الدورات في الحواف الموجّهة (DFS بمسار صريح) — مرتبة حتميًا. */
export function findCycles(edges: DependencyEdge[]): string[][] {
  const directed = edges.filter((edge) => edge.kind !== 'CONFLICTS_WITH');
  const adjacency = new Map<string, string[]>();
  for (const edge of directed) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  const cycles: string[][] = [];
  const seenCycle = new Set<string>();
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];

  const visit = (id: string) => {
    const current = state.get(id);
    if (current === 'done') return;
    if (current === 'visiting') {
      const start = path.indexOf(id);
      if (start >= 0) {
        const cycle = [...path.slice(start), id];
        const key = [...cycle].sort().join('|');
        if (!seenCycle.has(key)) {
          seenCycle.add(key);
          cycles.push(cycle);
        }
      }
      return;
    }
    state.set(id, 'visiting');
    path.push(id);
    for (const next of (adjacency.get(id) ?? []).slice().sort()) visit(next);
    path.pop();
    state.set(id, 'done');
  };

  for (const id of Array.from(adjacency.keys()).sort()) visit(id);
  return cycles.sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

/** علاقات قاعدة واحدة من الرسم (للعرض في بطاقة القاعدة). */
export interface RuleRelations {
  dependsOn: DependencyEdge[];
  dependedBy: DependencyEdge[];
  overrides: DependencyEdge[];
  overriddenBy: DependencyEdge[];
  conflicts: DependencyEdge[];
  triggers: DependencyEdge[];
  triggeredBy: DependencyEdge[];
  /** عُقد معزولة (لا علاقات لها) — تُعرض في الرسم بلون باهت. */
  isolated: boolean;
}

export function relationsOf(graph: RuleGraph, ruleId: string): RuleRelations {
  const outgoing = graph.edges.filter((edge) => edge.from === ruleId);
  const incoming = graph.edges.filter((edge) => edge.to === ruleId);
  const pick = (list: DependencyEdge[], kind: DependencyEdgeKind) => list.filter((edge) => edge.kind === kind);
  return {
    dependsOn: pick(outgoing, 'DEPENDS_ON'),
    dependedBy: pick(incoming, 'DEPENDS_ON'),
    overrides: pick(outgoing, 'OVERRIDES'),
    overriddenBy: pick(incoming, 'OVERRIDES'),
    conflicts: graph.edges.filter(
      (edge) => edge.kind === 'CONFLICTS_WITH' && (edge.from === ruleId || edge.to === ruleId)
    ),
    triggers: pick(outgoing, 'TRIGGERS'),
    triggeredBy: pick(incoming, 'TRIGGERS'),
    isolated: outgoing.length === 0 && incoming.length === 0,
  };
}

/**
 * يُنتج رسمًا جزئيًا حول قاعدة (الجيران حتى عمق معيّن) — للتنقل في الرسم
 * الكبير بلا فقد السياق (FR-ES-07.7.1: قابل للتنقل).
 */
export function subgraphAround(graph: RuleGraph, ruleId: string, depth = 1): RuleGraph {
  const keep = new Set<string>([ruleId]);
  let frontier = new Set<string>([ruleId]);
  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>();
    for (const edge of graph.edges) {
      if (frontier.has(edge.from) && !keep.has(edge.to)) next.add(edge.to);
      if (frontier.has(edge.to) && !keep.has(edge.from)) next.add(edge.from);
    }
    for (const id of next) keep.add(id);
    frontier = next;
    if (next.size === 0) break;
  }
  const nodes = graph.nodes.filter((node) => keep.has(node.id));
  const edges = graph.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return {
    nodes,
    edges,
    byId,
    cycles: graph.cycles.filter((cycle) => cycle.every((id) => keep.has(id))),
    width: graph.width,
    height: graph.height,
  };
}

/** هل القاعدة معزولة تمامًا في الرسم (لا اعتمادات ولا إطلاق)؟ */
export function isolatedRuleIds(graph: RuleGraph): string[] {
  const linked = new Set<string>();
  for (const edge of graph.edges) {
    linked.add(edge.from);
    linked.add(edge.to);
  }
  return graph.nodes.filter((node) => !linked.has(node.id)).map((node) => node.id);
}

/** رتبة الخصوصية (تُستعمل في وسيلة إيضاح الرسم) — إعادة تصدير مريحة. */
export { SPECIFICITY_RANK };

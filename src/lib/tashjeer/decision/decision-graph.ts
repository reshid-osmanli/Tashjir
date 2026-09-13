// رسم منطق القرار — Visual Decision Graph (FR-ES-07.7.2)
// مشروع التشجير - نظام القراءات العشر
//
//   Input
//     ↓
//   [Condition]
//     ├── نعم → [Rule A] → [Merge]
//     └── لا  → [Rule B] → [Split]
//
// هذا **عرض** لأثر القرار (Trace) نفسه الذي ينتجه Decision Resolver، لا محرك
// رسم منطقي جديد (P-07): لا قرار يُتخذ هنا، ولا منطق مطابقة يُعاد. يقرأ
// `DecisionTraceStep[]` ويبني عُقدًا وحوافًا بإحداثيات محسوبة حتميًا، فترسمها
// الواجهة SVG قابلة للتنقل (نقرة على عقدة تُبرز مسارها وتفتح القاعدة).
//
// الإحداثيات RTL: العمود ٠ (المدخل) في أقصى اليمين، ويتقدم القرار يسارًا.

import type { DecisionResult, DecisionTraceStep } from './resolver';
import type { DecisionContext } from './policy';

/** أنواع عُقد رسم القرار. */
export type DecisionNodeKind = 'INPUT' | 'CONDITION' | 'RULE' | 'STAGE' | 'OUTCOME' | 'RESULT';

/** الحكم الظاهر في عقدة النتيجة (من نفس أحكام مشغّل الاختبارات). */
export type DecisionOutcomeKind = 'MERGE' | 'SPLIT' | 'CREATE' | 'SKIP' | 'ALLOW' | 'BLOCK' | 'UNKNOWN';

/** تسميات عربية لأنواع العُقد. */
export const DECISION_NODE_LABELS: Record<DecisionNodeKind, string> = {
  INPUT: 'المدخل',
  CONDITION: 'الشرط',
  RULE: 'قاعدة',
  STAGE: 'مرحلة',
  OUTCOME: 'الحكم',
  RESULT: 'النتيجة',
};

/** تسميات عربية للأحكام. */
export const OUTCOME_LABELS: Record<DecisionOutcomeKind, string> = {
  MERGE: 'دمج',
  SPLIT: 'فصل',
  CREATE: 'إنشاء اختلاف',
  SKIP: 'لا إنشاء',
  ALLOW: 'مسموح',
  BLOCK: 'محجوب',
  UNKNOWN: 'غير محدّد',
};

export interface DecisionGraphNode {
  id: string;
  kind: DecisionNodeKind;
  /** العنوان القصير داخل العقدة. */
  label: string;
  /** سطر تفصيلي (السبب/الأولوية/الرسالة). */
  detail?: string;
  /** معرّف قاعدة إن كانت العقدة قاعدة (للنقر وفتح المنشئ). */
  ruleId?: string;
  /** حالة الخطوة في الأثر (تُترجم لونًا). */
  status?: DecisionTraceStep['status'];
  priority?: number;
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface DecisionGraphEdge {
  id: string;
  from: string;
  to: string;
  /** «نعم» / «لا» على فرع الشرط، أو تسمية المرحلة. */
  branch?: string;
}

export interface DecisionGraph {
  nodes: DecisionGraphNode[];
  edges: DecisionGraphEdge[];
  byId: Map<string, DecisionGraphNode>;
  outcome: DecisionOutcomeKind;
  width: number;
  height: number;
  /** عدد القواعد المطابقة/غير المطابقة (للعرض في رأس اللوحة). */
  stats: { matched: number; skipped: number; stages: number };
}

/** أبعاد الرسم (بكسل منطقي) — ثابتة حتى يستقر التخطيط بين تشغيلين. */
export const DECISION_NODE_WIDTH = 200;
export const DECISION_NODE_HEIGHT = 60;
export const DECISION_COL_GAP = 240;
export const DECISION_ROW_GAP = 84;
export const DECISION_PADDING = 24;
/** حد العُقد المعروضة لكل فرع قبل الطيّ («و n أخرى»). */
export const DECISION_MAX_BRANCH_NODES = 6;
/** حد مراحل الأثر المعروضة قبل الطيّ. */
export const DECISION_MAX_STAGE_NODES = 4;

export interface DecisionGraphOptions {
  /** تسمية عقدة المدخل (وإلا تُشتق من السياق). */
  inputLabel?: string;
  /** سياق القرار (يُشتق منه وصف المدخل: «مد + تحقيق»). */
  context?: DecisionContext;
  /** حكم صريح (وإلا يُستنتج من الأثر/النتيجة). */
  outcome?: DecisionOutcomeKind;
  /** نص النتيجة النهائي (وإلا آخر خطوة فائزة/محجوبة في الأثر). */
  resultLabel?: string;
  maxBranchNodes?: number;
  maxStageNodes?: number;
}

/** يشتق وصفًا عربيًا للمدخل من سياق القرار (نفس حقول ساحة «لماذا؟»). */
export function describeInput(context?: DecisionContext, fallback = 'سياق القرار'): string {
  if (!context) return fallback;
  const parts: string[] = [];
  if (typeof context.differenceType === 'string') parts.push(context.differenceType);
  if (typeof context.relatedType === 'string' && context.relatedType !== context.differenceType) {
    parts.push(context.relatedType);
  } else if (typeof context.otherType === 'string' && context.otherType !== context.differenceType) {
    parts.push(context.otherType);
  }
  if (typeof context.readerId === 'string') parts.push(`القارئ ${context.readerId}`);
  if (typeof context.context === 'string') parts.push(`سياق ${context.context}`);
  return parts.length > 0 ? parts.join(' + ') : fallback;
}

/**
 * يستنتج الحكم من نتيجة قرار (MERGE/SPLIT/CREATE/SKIP/ALLOW/BLOCK). لا قرار
 * هنا: فقط قراءة الحقول التي أنتجها Resolver فعلًا.
 */
export function outcomeFromDecision(decision: unknown): DecisionOutcomeKind {
  if (!decision || typeof decision !== 'object') return 'UNKNOWN';
  const value = decision as Record<string, unknown>;
  if (typeof value.merge === 'boolean') return value.merge ? 'MERGE' : 'SPLIT';
  if (typeof value.create === 'boolean') return value.create ? 'CREATE' : 'SKIP';
  if (typeof value.allowed === 'boolean') return value.allowed ? 'ALLOW' : 'BLOCK';
  if (typeof value.exclusive === 'boolean') return value.exclusive ? 'SPLIT' : 'MERGE';
  if (typeof value.valid === 'boolean') return value.valid ? 'ALLOW' : 'BLOCK';
  return 'UNKNOWN';
}

/** يبني رسم القرار من أثر (Trace) — الدالة الأساسية. */
export function buildDecisionGraph(
  trace: DecisionTraceStep[],
  options: DecisionGraphOptions = {}
): DecisionGraph {
  const maxBranch = options.maxBranchNodes ?? DECISION_MAX_BRANCH_NODES;
  const maxStages = options.maxStageNodes ?? DECISION_MAX_STAGE_NODES;
  const nodes: DecisionGraphNode[] = [];
  const edges: DecisionGraphEdge[] = [];
  const rowsByCol = new Map<number, number>();

  const place = (node: Omit<DecisionGraphNode, 'x' | 'y' | 'row'>): DecisionGraphNode => {
    const row = rowsByCol.get(node.col) ?? 0;
    rowsByCol.set(node.col, row + 1);
    const placed: DecisionGraphNode = { ...node, row, x: 0, y: DECISION_PADDING + row * DECISION_ROW_GAP };
    nodes.push(placed);
    return placed;
  };

  const link = (from: string, to: string, branch?: string) => {
    edges.push({ id: `${from}->${to}${branch ? `:${branch}` : ''}`, from, to, ...(branch ? { branch } : {}) });
  };

  // 1) المدخل.
  const input = place({
    id: 'input',
    kind: 'INPUT',
    label: DECISION_NODE_LABELS.INPUT,
    detail: options.inputLabel ?? describeInput(options.context),
    col: 0,
  });

  // 2) الشرط: خطوات MATCH من الأثر نفسه.
  const matchSteps = trace.filter((step) => step.stage === 'MATCH');
  const matchedSteps = matchSteps.filter((step) => step.status === 'applied' || step.status === 'won');
  const skippedSteps = matchSteps.filter((step) => step.status === 'skipped');
  const otherStages = trace.filter((step) => step.stage !== 'MATCH' && step.stage !== 'INPUT');

  const condition = place({
    id: 'condition',
    kind: 'CONDITION',
    label: DECISION_NODE_LABELS.CONDITION,
    detail: `${matchedSteps.length} مطابقة · ${skippedSteps.length} غير مطابقة`,
    col: 1,
  });
  link(input.id, condition.id);

  // 3) فرع «نعم»: القواعد المطابقة (مرتبة بالأولوية ثم المعرّف — عرض حتمي).
  const orderedMatched = [...matchedSteps].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.ruleId ?? a.message).localeCompare(b.ruleId ?? b.message)
  );
  const shownMatched = orderedMatched.slice(0, maxBranch);
  const yesIds: string[] = [];
  shownMatched.forEach((step, index) => {
    const id = `rule-${step.ruleId ?? index}`;
    const node = place({
      id,
      kind: 'RULE',
      label: step.ruleId ? step.ruleId : DECISION_NODE_LABELS.RULE,
      detail: step.message,
      ruleId: step.ruleId,
      status: step.status,
      priority: step.priority,
      col: 2,
    });
    yesIds.push(node.id);
    link(condition.id, node.id, 'نعم');
  });
  if (orderedMatched.length > shownMatched.length) {
    const node = place({
      id: 'rule-more',
      kind: 'RULE',
      label: `و ${orderedMatched.length - shownMatched.length} قاعدة أخرى`,
      detail: 'مطابقة أيضًا — تُعرض في الأثر الكامل',
      col: 2,
    });
    yesIds.push(node.id);
    link(condition.id, node.id, 'نعم');
  }

  // 4) فرع «لا»: القواعد التي لم تطابق (تُطوى في عقدة واحدة حتى لا يغرق الرسم).
  const noIds: string[] = [];
  if (skippedSteps.length > 0) {
    const node = place({
      id: 'rule-skipped',
      kind: 'RULE',
      label: `${skippedSteps.length} قاعدة لم تطابق`,
      detail: skippedSteps
        .slice(0, maxBranch)
        .map((step) => step.message)
        .join(' · '),
      status: 'skipped',
      col: 2,
    });
    noIds.push(node.id);
    link(condition.id, node.id, 'لا');
  }

  // 5) المراحل الأخرى من الأثر (MERGE/CONFLICT/EXCLUSION/ORDERING/...) كما هي،
  //    مسلسلة عمودًا لكل مرحلة حتى يبقى الرسم طبقيًا قابلا للقراءة، وتُطوى
  //    الزائدة في عقدة واحدة (الأثر الكامل يبقى في لوحة «لماذا؟»).
  const shownStages = otherStages.slice(0, maxStages);
  let stageSources = [...yesIds, ...noIds];
  if (stageSources.length === 0) stageSources = [condition.id];
  shownStages.forEach((step, index) => {
    const node = place({
      id: `stage-${index}-${step.stage}`,
      kind: 'STAGE',
      label: step.stage,
      detail: step.message,
      ruleId: step.ruleId,
      status: step.status,
      priority: step.priority,
      col: 3 + index,
    });
    for (const sourceId of stageSources) link(sourceId, node.id);
    stageSources = [node.id];
  });
  if (otherStages.length > shownStages.length) {
    const node = place({
      id: 'stage-more',
      kind: 'STAGE',
      label: `و ${otherStages.length - shownStages.length} مرحلة أخرى`,
      detail: 'تُعرض كاملة في لوحة الأثر («لماذا؟»)',
      col: 3 + shownStages.length,
    });
    for (const sourceId of stageSources) link(sourceId, node.id);
    stageSources = [node.id];
  }
  const previousCol = 2 + Math.max(shownStages.length, 0) + (otherStages.length > shownStages.length ? 1 : 0);

  // 6) الحكم (Merge/Split/...) ثم النتيجة النهائية.
  const outcome = options.outcome ?? 'UNKNOWN';
  const decidedStep =
    [...trace].reverse().find((step) => step.status === 'won' || step.status === 'blocked') ?? otherStages[otherStages.length - 1];
  const outcomeCol = previousCol + 1;
  const outcomeSources = stageSources;
  const outcomeNode = place({
    id: 'outcome',
    kind: 'OUTCOME',
    label: OUTCOME_LABELS[outcome],
    detail: decidedStep?.message,
    status: decidedStep?.status ?? (outcome === 'MERGE' || outcome === 'CREATE' || outcome === 'ALLOW' ? 'won' : 'blocked'),
    col: outcomeCol,
  });
  for (const sourceId of outcomeSources) {
    link(sourceId, outcomeNode.id);
  }

  const resultNode = place({
    id: 'result',
    kind: 'RESULT',
    label: DECISION_NODE_LABELS.RESULT,
    detail: options.resultLabel ?? decidedStep?.message ?? OUTCOME_LABELS[outcome],
    status: outcomeNode.status,
    col: outcomeCol + 1,
  });
  link(outcomeNode.id, resultNode.id);

  // 7) الإحداثيات النهائية (RTL: العمود ٠ أقصى اليمين).
  const maxCol = nodes.reduce((max, node) => Math.max(max, node.col), 0);
  const maxRow = nodes.reduce((max, node) => Math.max(max, node.row), 0);
  const width = DECISION_PADDING * 2 + (maxCol + 1) * DECISION_COL_GAP;
  const height = DECISION_PADDING * 2 + (maxRow + 1) * DECISION_ROW_GAP;
  for (const node of nodes) {
    node.x = width - DECISION_PADDING - DECISION_NODE_WIDTH - node.col * DECISION_COL_GAP;
  }

  return {
    nodes,
    edges,
    byId: new Map(nodes.map((node) => [node.id, node])),
    outcome,
    width,
    height,
    stats: { matched: matchedSteps.length, skipped: skippedSteps.length, stages: otherStages.length },
  };
}

/** يبني رسم القرار من نتيجة قرار كاملة (الطريق المعتاد من الواجهة). */
export function buildDecisionGraphFromResult<T>(
  result: DecisionResult<T>,
  options: DecisionGraphOptions = {}
): DecisionGraph {
  const reason =
    result.decision && typeof result.decision === 'object'
      ? ((result.decision as Record<string, unknown>).reason as string | undefined)
      : undefined;
  return buildDecisionGraph(result.trace, {
    ...options,
    outcome: options.outcome ?? outcomeFromDecision(result.decision),
    resultLabel: options.resultLabel ?? reason,
  });
}

/** مسار العُقد من المدخل إلى النتيجة (لإبرازه عند النقر — تنقّل في الرسم). */
export function pathToResult(graph: DecisionGraph, nodeId: string): string[] {
  const incoming = new Map<string, string>();
  for (const edge of graph.edges) if (!incoming.has(edge.to)) incoming.set(edge.to, edge.from);
  const path: string[] = [];
  let current: string | undefined = nodeId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    path.unshift(current);
    current = incoming.get(current);
  }
  return path;
}

/** العُقد المعزولة (لا حواف لها) — تُرسم باهتة. */
export function isolatedDecisionNodes(graph: DecisionGraph): string[] {
  const linked = new Set<string>();
  for (const edge of graph.edges) {
    linked.add(edge.from);
    linked.add(edge.to);
  }
  return graph.nodes.filter((node) => !linked.has(node.id)).map((node) => node.id);
}

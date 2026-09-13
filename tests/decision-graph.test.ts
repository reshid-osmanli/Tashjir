// اختبارات رسم منطق القرار — Visual Decision Graph (FR-ES-07.7.2)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس أن الرسم **يقرأ أثر القرار نفسه** (لا محرك منطقي جديد): المدخل ←
// الشرط ← فرعا «نعم/لا» ← الحكم (دمج/فصل) ← النتيجة، بإحداثيات RTL حتمية
// ومسار قابل للإبراز عند النقر.

import { describe, expect, it } from 'vitest';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { resolveMerge } from '@/lib/tashjeer/decision/api';
import {
  DECISION_NODE_WIDTH,
  DECISION_PADDING,
  OUTCOME_LABELS,
  buildDecisionGraph,
  buildDecisionGraphFromResult,
  describeInput,
  isolatedDecisionNodes,
  outcomeFromDecision,
  pathToResult,
} from '@/lib/tashjeer/decision/decision-graph';

describe('اشتقاق الحكم والمدخل (قراءة بيانات القرار لا إعادة حسابه)', () => {
  it('يستنتج الحكم من شكل النتيجة', () => {
    expect(outcomeFromDecision({ merge: true })).toBe('MERGE');
    expect(outcomeFromDecision({ merge: false })).toBe('SPLIT');
    expect(outcomeFromDecision({ create: true })).toBe('CREATE');
    expect(outcomeFromDecision({ allowed: false })).toBe('BLOCK');
    expect(outcomeFromDecision({ exclusive: true })).toBe('SPLIT');
    expect(outcomeFromDecision({})).toBe('UNKNOWN');
  });

  it('يصف المدخل من سياق القرار', () => {
    expect(describeInput({ differenceType: 'FARSH', relatedType: 'MADD' })).toBe('FARSH + MADD');
    expect(describeInput({ differenceType: 'MADD', otherType: 'MADD' })).toBe('MADD');
    expect(describeInput(undefined, 'سياق')).toBe('سياق');
  });
});

describe('بناء الرسم من أثر Resolver', () => {
  const merging = resolveMerge('MADD', 'TAHQIQ', DEFAULT_SYSTEM_PROFILE);
  const splitting = resolveMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE, { sameReader: true });

  it('مسار كامل: مدخل ← شرط ← قواعد ← حكم ← نتيجة (دمج)', () => {
    const graph = buildDecisionGraphFromResult(merging, {
      context: { differenceType: 'MADD', relatedType: 'TAHQIQ' },
    });
    expect(graph.outcome).toBe('MERGE');

    const kinds = graph.nodes.map((node) => node.kind);
    expect(kinds[0]).toBe('INPUT');
    expect(kinds).toContain('CONDITION');
    expect(kinds).toContain('OUTCOME');
    expect(kinds[kinds.length - 1]).toBe('RESULT');

    const outcome = graph.nodes.find((node) => node.kind === 'OUTCOME')!;
    expect(outcome.label).toBe(OUTCOME_LABELS.MERGE);
    expect(outcome.status).toBe('won');
    expect(graph.nodes.find((node) => node.kind === 'RESULT')?.detail).toContain('مرتبطان');
  });

  it('فرعا الشرط «نعم» و«لا» من خطوات MATCH نفسها', () => {
    const graph = buildDecisionGraphFromResult(splitting, {
      context: { differenceType: 'FARSH', relatedType: 'MADD', sameReader: true },
    });
    expect(graph.outcome).toBe('SPLIT');
    const condition = graph.nodes.find((node) => node.kind === 'CONDITION')!;
    const branches = graph.edges.filter((edge) => edge.from === condition.id).map((edge) => edge.branch);
    expect(branches).toContain('نعم');
    expect(branches).toContain('لا');
    expect(graph.stats.matched).toBeGreaterThan(0);
    expect(graph.stats.skipped).toBeGreaterThan(0);

    // القاعدة المطابقة تحمل معرّفها حتى تُفتح من الرسم (تنقّل).
    const ruleNodes = graph.nodes.filter((node) => node.kind === 'RULE' && node.ruleId);
    expect(ruleNodes.length).toBeGreaterThan(0);
    expect(ruleNodes.some((node) => node.ruleId === 'er-system-merge-farsh-madd')).toBe(true);
  });

  it('يطوي القواعد الكثيرة فلا ينفجر الرسم', () => {
    const manySteps = Array.from({ length: 20 }, (_, index) => ({
      stage: 'MATCH',
      ruleId: `er-${index}`,
      message: `طابقت: قاعدة ${index}`,
      status: 'applied' as const,
      priority: index,
    }));
    const graph = buildDecisionGraph(manySteps, { maxBranchNodes: 6 });
    const ruleNodes = graph.nodes.filter((node) => node.kind === 'RULE');
    expect(ruleNodes).toHaveLength(7); // ٦ معروضة + عقدة طيّ
    expect(ruleNodes[6]?.label).toContain('14 قاعدة أخرى');
  });

  it('المراحل الأخرى في الأثر تظهر كعُقد (CONFLICT/MERGE/...)', () => {
    const graph = buildDecisionGraphFromResult(splitting);
    const stages = graph.nodes.filter((node) => node.kind === 'STAGE').map((node) => node.label);
    expect(stages).toContain('MERGE');
    expect(graph.stats.stages).toBeGreaterThan(0);
  });

  it('بلا أثر: رسم أدنى يبقى صالحًا (مدخل ← شرط ← حكم ← نتيجة)', () => {
    const graph = buildDecisionGraph([], { outcome: 'SKIP', inputLabel: 'سياق فارغ' });
    expect(graph.nodes.map((node) => node.kind)).toEqual(['INPUT', 'CONDITION', 'OUTCOME', 'RESULT']);
    expect(graph.edges).toHaveLength(3);
    expect(isolatedDecisionNodes(graph)).toHaveLength(0);
  });
});

describe('الإحداثيات RTL والحتمية', () => {
  it('المدخل أقصى اليمين ويتقدم القرار يسارًا', () => {
    const graph = buildDecisionGraphFromResult(resolveMerge('MADD', 'TAHQIQ', DEFAULT_SYSTEM_PROFILE));
    const input = graph.byId.get('input')!;
    const result = graph.byId.get('result')!;
    expect(input.col).toBe(0);
    expect(result.col).toBeGreaterThan(input.col);
    expect(input.x).toBeGreaterThan(result.x);
    expect(input.x + DECISION_NODE_WIDTH).toBe(graph.width - DECISION_PADDING);
  });

  it('نفس الأثر يعطي نفس الرسم (حتمية)', () => {
    const first = buildDecisionGraphFromResult(resolveMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE));
    const second = buildDecisionGraphFromResult(resolveMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE));
    expect(second.nodes).toEqual(first.nodes);
    expect(second.edges).toEqual(first.edges);
  });
});

describe('التنقل في الرسم', () => {
  it('يُبرز المسار من عقدة إلى المدخل', () => {
    const graph = buildDecisionGraphFromResult(
      resolveMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE, { sameReader: true })
    );
    const path = pathToResult(graph, 'result');
    expect(path[0]).toBe('input');
    expect(path[path.length - 1]).toBe('result');
    expect(path).toContain('condition');

    const ruleNode = graph.nodes.find((node) => node.kind === 'RULE' && node.ruleId)!;
    expect(pathToResult(graph, ruleNode.id)).toEqual(['input', 'condition', ruleNode.id]);
  });
});

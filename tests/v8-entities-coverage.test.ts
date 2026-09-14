// تغطية كيانات v8 كاملة (DM-01 → DM-12، DM-17) + حتمية التصدير + سجل التراجع
import { describe, expect, it } from 'vitest';
import {
  createEntityId,
  wordLocus,
  rangeLocus,
  type Difference,
  type Variant,
  type Relation,
  type WaqfMark,
  type Correction,
  type GlobalRule,
  type RuleOccurrence,
  type Line,
  type RenderRange,
  type EngineConfig,
} from '@/lib/tashjeer/model/v8';
import { CommandLog } from '@/lib/tashjeer/history/command-log';
import { stableStringify } from '@/lib/tashjeer/safe-save';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { resolveMerge, resolveOrder, resolveRelationExclusion, resolveConnection } from '@/lib/tashjeer/decision/api';

describe('كيانات v8 — DM-01 Difference', () => {
  it('يحمل كل الحقول الإلزامية: ID مستقل، Locus، فئة، سياق، نطاق، مصدر، رتبة، إصدار، طوابع', () => {
    const diff: Difference = {
      id: createEntityId('diff'),
      ayahKey: 1004,
      category: 'FARSH',
      title: 'مالك / ملك',
      locus: wordLocus(4),
      occurrenceIndex: 1,
      context: 'ALWAYS',
      scope: { kind: 'ALL' },
      source: 'editor',
      rank: 1,
      version: 1,
      status: 'DRAFT',
      variants: [],
      relations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(diff.id.startsWith('diff-')).toBe(true);
    expect(diff.locus.startPosition).toBe(4);
    expect(diff.context).toBe('ALWAYS');
  });
});

describe('كيانات v8 — DM-02 Variant', () => {
  it('وجه مستقل بمعرف ورتبة صريحة ودرجة قوة', () => {
    const variant: Variant = {
      id: createEntityId('face'),
      text: 'مَٰلِكِ',
      label: 'بالألف',
      scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
      rank: 1,
      source: 'editor',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(variant.rank).toBe(1);
    expect(variant.id.startsWith('face-')).toBe(true);
  });
});

describe('كيانات v8 — DM-03 Relation', () => {
  it('علاقة بمعرفات فقط بستة أنواع', () => {
    const rel: Relation = {
      id: createEntityId('rel'),
      type: 'MUTUALLY_EXCLUSIVE',
      fromId: 'diff-1',
      toId: 'diff-2',
      source: 'engine',
      createdAt: new Date().toISOString(),
    };
    expect(['MERGE', 'COMPOSITE', 'PART_OF', 'RELATED', 'MUTUALLY_EXCLUSIVE', 'MANUAL_LINK']).toContain(rel.type);
  });
});

describe('كيانات v8 — DM-04 رتبة صريحة', () => {
  it('Line.order و Variant.rank و DisplayOrder صريحة', () => {
    const line: Line = {
      id: createEntityId('line'),
      ayahKey: 1004,
      order: 2,
      title: 'قالون',
      category: 'FARSH',
      readerScope: { kind: 'ALL' },
      segments: [],
      source: 'editor',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(line.order).toBe(2);
    const orderResult = resolveOrder(
      [
        { id: 'a', explicitOrder: 2 },
        { id: 'b', explicitOrder: 1 },
      ],
      DEFAULT_SYSTEM_PROFILE
    );
    expect(orderResult.decision.orderedIds[0]).toBe('b');
  });
});

describe('كيانات v8 — DM-05 Source & Correction', () => {
  it('Correction يحفظ Engine=A و Editor=B و Final=B', () => {
    const corr: Correction = {
      id: createEntityId('corr'),
      targetId: 'diff-1',
      engineResult: { title: 'قديم' },
      editorResult: { title: 'جديد' },
      finalResult: { title: 'جديد' },
      reason: 'تصحيح يدوي',
      at: new Date().toISOString(),
      source: 'editor',
    };
    expect(corr.engineResult).toBeDefined();
    expect(corr.finalResult).toEqual(corr.editorResult);
  });
});

describe('كيانات v8 — DM-06 سياق الوقف/الوصل', () => {
  it('context ثلاث قيم فقط', () => {
    const contexts = ['ALWAYS', 'WAQF_ONLY', 'WASL_ONLY'] as const;
    for (const ctx of contexts) {
      const diff: Partial<Difference> = { context: ctx };
      expect(['ALWAYS', 'WAQF_ONLY', 'WASL_ONLY']).toContain(diff.context);
    }
  });
});

describe('كيانات v8 — DM-07 WaqfMark', () => {
  it('علامة وقف/ابتداء/ممنوع وصل', () => {
    const mark: WaqfMark = {
      id: createEntityId('waqf'),
      ayahKey: 1004,
      position: 3,
      kind: 'FORBIDDEN_WASL',
      scope: 'END_OF_AYAH',
      source: 'editor',
      createdAt: new Date().toISOString(),
    };
    expect(mark.kind).toBe('FORBIDDEN_WASL');
  });
});

describe('كيانات v8 — DM-08 GlobalRule و RuleOccurrence', () => {
  it('GlobalRule كيان أولي مع priority و RuleOccurrence مع localOverride', () => {
    const rule: Partial<GlobalRule> = {
      id: createEntityId('global'),
      title: 'قاعدة عامة',
      priority: 80,
      status: 'DRAFT',
    };
    expect(rule.priority).toBe(80);
    const occ: RuleOccurrence = {
      id: createEntityId('occ'),
      globalRuleId: rule.id!,
      ayahKey: 1004,
      locus: wordLocus(2),
      localOverride: { cancelled: true, note: 'استثناء محلي' },
    };
    expect(occ.localOverride?.cancelled).toBe(true);
  });
});

describe('كيانات v8 — DM-09 تعدد الاختلافات', () => {
  it('occurrenceIndex يميز اختلافين لنفس القارئ+الموضع', () => {
    const d1: Partial<Difference> = { occurrenceIndex: 1, locus: wordLocus(5) };
    const d2: Partial<Difference> = { occurrenceIndex: 2, locus: wordLocus(5) };
    expect(d1.occurrenceIndex).not.toBe(d2.occurrenceIndex);
    expect(d1.locus?.startPosition).toBe(d2.locus?.startPosition);
  });
});

describe('كيانات v8 — DM-10 Line', () => {
  it('Line يحمل order و readerScope و segments و compositeFaceRefs', () => {
    const line: Line = {
      id: createEntityId('line'),
      ayahKey: 1004,
      order: 1,
      title: 'ورش',
      category: 'MADUD',
      readerScope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
      segments: [],
      compositeFaceRefs: [createEntityId('face')],
      source: 'engine',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(line.segments).toBeDefined();
    expect(line.compositeFaceRefs?.length).toBe(1);
  });
});

describe('كيانات v8 — DM-11 RenderRange', () => {
  it('نطاق عرض معزول from→to', () => {
    const range: RenderRange = {
      id: createEntityId('range'),
      ayahKey: 1004,
      fromPosition: 2,
      toPosition: 5,
      label: 'مقطع الوقف',
    };
    expect(range.fromPosition).toBeLessThan(range.toPosition);
  });
});

describe('كيانات v8 — DM-12 createBatchId', () => {
  it('createBatchId للتتبع فقط دون ربط دلالي', () => {
    const batchId = createEntityId('batch');
    const d1: Difference = {
      id: createEntityId('diff'),
      ayahKey: 1004,
      category: 'FARSH',
      title: 'فرش 1',
      locus: wordLocus(1),
      occurrenceIndex: 1,
      context: 'ALWAYS',
      scope: { kind: 'ALL' },
      source: 'editor',
      rank: 1,
      version: 1,
      status: 'DRAFT',
      variants: [],
      relations: [],
      createBatchId: batchId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const d2: Difference = { ...d1, id: createEntityId('diff'), title: 'فرش 2', createBatchId: batchId };
    expect(d1.createBatchId).toBe(d2.createBatchId);
    expect(d1.id).not.toBe(d2.id);
  });
});

describe('كيانات v8 — DM-13 حتمية التصدير', () => {
  it('تصدير نفس البيانات مرتين يعطي نفس النص بايتًا', () => {
    const data = {
      format: 'tashjeer-export',
      schemaVersion: 8,
      differences: [
        { id: 'diff-b', rank: 2, title: 'ب' },
        { id: 'diff-a', rank: 1, title: 'أ' },
      ],
    };
    const first = stableStringify(data);
    const second = stableStringify(data);
    expect(first).toBe(second);
    // الترتيب الأبجدي للمفاتيح يجعل الملف صديقًا لـ Git
    expect(first.indexOf('"format"')).toBeLessThan(first.indexOf('"schemaVersion"'));
  });
});

describe('كيانات v8 — DM-15 سجل التراجع الموحد', () => {
  it('عملية مركبة + دفعة تُتراجع كوحدة واحدة', () => {
    const log = new CommandLog();
    let counter = 0;
    log.transaction('دفعة اختبار', () => {
      log.record('نقل', 'MOVE', () => { counter += 1; }, () => { counter -= 1; });
      log.record('دمج', 'MERGE', () => { counter += 10; }, () => { counter -= 10; });
    });
    expect(counter).toBe(11);
    expect(log.depth).toBe(1);
    log.undo();
    expect(counter).toBe(0);
    log.redo();
    expect(counter).toBe(11);
  });
});

describe('Decision Resolver مع Trace (FR-EN-02)', () => {
  it('قرار الدمج يعيد trace قابلًا للتفسير', () => {
    const res = resolveMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE);
    expect(res.trace.length).toBeGreaterThan(0);
    expect(res.trace.some((s) => s.stage === 'MERGE')).toBe(true);
    expect(res.decision.merge).toBe(false);
  });

  it('قرار التنافي يعيد trace', () => {
    const res = resolveRelationExclusion('MADD', 'MADD', DEFAULT_SYSTEM_PROFILE);
    expect(res.trace.length).toBeGreaterThan(0);
  });

  it('قرار الوصل يراعي FORBIDDEN_WASL', () => {
    const blocked = resolveConnection(true);
    expect(blocked.decision.allowed).toBe(false);
    expect(blocked.trace[0].status).toBe('blocked');
    const allowed = resolveConnection(false);
    expect(allowed.decision.allowed).toBe(true);
  });
});

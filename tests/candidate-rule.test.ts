// اختبارات القواعد المرشحة من التصحيحات — Candidate Rules (FR-ES-12.3/.4)
// مشروع التشجير - نظام القراءات العشر
//
// حلقة التعلم: تصحيح ← قاعدة مرشحة (DRAFT) ← اعتماد. هذه الاختبارات تثبت أن
// المقترح يفرض رغبة المحرر، ويبقى مسودة لا تؤثر، ويصحبه حالة اختبار، وأن كشف
// الأنماط المتكررة يحترم الحدّ (P-06: لا إنشاء تلقائي بلا مراجعة).

import { describe, expect, it } from 'vitest';
import type { RuleCondition } from '@/lib/tashjeer/model/v8';
import {
  proposeCandidateRule,
  detectRecurringPatterns,
  PATTERN_REPEAT_THRESHOLD,
  type CorrectionContext,
} from '@/lib/tashjeer/decision/candidate-rule';

const flipCorrection: CorrectionContext = {
  differenceType: 'FARSH',
  relatedType: 'MADD',
  engineMerged: true, // المحرك دمج
  editorWantsMerge: false, // المحرر يريد الفصل
};

describe('اقتراح قاعدة من تصحيح (FR-ES-12.4)', () => {
  it('يفرض رغبة المحرر: فصل ← PREVENT_MERGE', () => {
    const rule = proposeCandidateRule(flipCorrection);
    expect(rule.actions).toContainEqual({ type: 'PREVENT_MERGE' });
    expect(rule.status).toBe('DRAFT');
  });

  it('يفرض رغبة المحرر: دمج ← MERGE', () => {
    const rule = proposeCandidateRule({ ...flipCorrection, editorWantsMerge: true });
    expect(rule.actions).toContainEqual({ type: 'MERGE' });
  });

  it('القاعدة المرشحة مسودة لا تؤثر، وتصحبها حالة اختبار', () => {
    const rule = proposeCandidateRule(flipCorrection);
    expect(rule.status).toBe('DRAFT');
    expect(rule.testCases).toHaveLength(1);
    expect(rule.testCases![0].expected).toBe('SEPARATE');
  });

  it('شرطها يطابق أنواع العناصر والقارئ', () => {
    const rule = proposeCandidateRule({ ...flipCorrection, readerId: 'qalon' });
    const fields = (rule.conditions.all ?? [])
      .filter((condition): condition is RuleCondition => 'field' in condition)
      .map((condition) => condition.field);
    expect(fields).toContain('differenceType');
    expect(fields).toContain('relatedType');
    expect(fields).toContain('readerId');
  });

  it('لكل اقتراح معرّف فريد', () => {
    const a = proposeCandidateRule(flipCorrection);
    const b = proposeCandidateRule(flipCorrection);
    expect(a.id).not.toBe(b.id);
  });
});

describe('كشف الأنماط المتكررة (FR-ES-12.3)', () => {
  it('يقترح قاعدة عند بلوغ الحدّ', () => {
    const corrections: CorrectionContext[] = Array.from({ length: PATTERN_REPEAT_THRESHOLD }, () => ({ ...flipCorrection }));
    const patterns = detectRecurringPatterns(corrections);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].count).toBe(PATTERN_REPEAT_THRESHOLD);
    expect(patterns[0].rule.actions[0].type).toBe('PREVENT_MERGE');
  });

  it('لا يقترح تحت الحدّ', () => {
    const corrections: CorrectionContext[] = Array.from({ length: PATTERN_REPEAT_THRESHOLD - 1 }, () => ({ ...flipCorrection }));
    expect(detectRecurringPatterns(corrections)).toHaveLength(0);
  });

  it('يفصل الأنماط المختلفة', () => {
    const corrections: CorrectionContext[] = [
      ...Array.from({ length: 3 }, () => ({ ...flipCorrection })),
      ...Array.from({ length: 4 }, () => ({ ...flipCorrection, differenceType: 'TAHQIQ', editorWantsMerge: true, engineMerged: false })),
    ];
    const patterns = detectRecurringPatterns(corrections);
    expect(patterns).toHaveLength(2);
    // الأعلى تكرارًا أولًا.
    expect(patterns[0].count).toBeGreaterThanOrEqual(patterns[1].count);
  });
});

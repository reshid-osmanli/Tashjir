// اختبارات نموذج v8 الموحّد (DM-01..DM-18) — معايير حتمية لا تعتمد على DOM.
import { describe, expect, it } from 'vitest';
import {
  createEntityId,
  wordLocus,
  rangeLocus,
  isContextActive,
  linkKindToRelationType,
  relationTypeToLinkRelation,
  SPECIFICITY_RANK,
} from '@/lib/tashjeer/model/v8';

describe('نموذج v8 — المعرّفات', () => {
  it('يولّد معرّفا بصيغة <prefix>-<shortid>', () => {
    const id = createEntityId('diff');
    expect(id.startsWith('diff-')).toBe(true);
    expect(createEntityId('diff')).not.toBe(id);
  });
});

describe('نموذج v8 — المواضع', () => {
  it('يبني موضع كلمة واحدة', () => {
    expect(wordLocus(5)).toEqual({ startPosition: 5, endPosition: 5 });
  });

  it('يبني مدى من كلمة إلى كلمة (FR-ED-08 الخطوة 1)', () => {
    expect(rangeLocus(3, 9)).toEqual({ startPosition: 3, endPosition: 9 });
  });
});

describe('نموذم v8 — سياق الوقف/الوصل (DM-06)', () => {
  it('ALWAYS نشط في الوقف والوصل', () => {
    expect(isContextActive('ALWAYS', 'WAQF')).toBe(true);
    expect(isContextActive('ALWAYS', 'WASL')).toBe(true);
  });
  it('WAQF_ONLY يظهر عند الوقف فقط', () => {
    expect(isContextActive('WAQF_ONLY', 'WAQF')).toBe(true);
    expect(isContextActive('WAQF_ONLY', 'WASL')).toBe(false);
  });
  it('WASL_ONLY يظهر عند الوصل فقط', () => {
    expect(isContextActive('WASL_ONLY', 'WASL')).toBe(true);
    expect(isContextActive('WASL_ONLY', 'WAQF')).toBe(false);
  });
});

describe('نموذج v8 — العلاقات (DM-03)', () => {
  it('يحوّل نوع رابط قديم إلى نوع علاقة موحّد', () => {
    expect(linkKindToRelationType('FACE_TO_FACE')).toBe('COMPOSITE');
    expect(linkKindToRelationType('LINE_TO_LINE')).toBe('MERGE');
    expect(linkKindToRelationType('SEGMENT_TO_LINE')).toBe('PART_OF');
    expect(linkKindToRelationType('SEGMENT_TO_RULE')).toBe('PART_OF');
  });
  it('يربط نوع علاقة بعلاقة عرض (MERGE→MERGE، غيره→REFERENCE)', () => {
    expect(relationTypeToLinkRelation('MERGE')).toBe('MERGE');
    expect(relationTypeToLinkRelation('COMPOSITE')).toBe('REFERENCE');
  });
});

describe('نموذج v8 — سلّم الخصوصية (FR-ES-06)', () => {
  it('MUSHAF أخص من WORD وأخص من CHARACTER', () => {
    expect(SPECIFICITY_RANK.MUSHAF).toBeGreaterThan(SPECIFICITY_RANK.WORD);
    expect(SPECIFICITY_RANK.WORD).toBeGreaterThan(SPECIFICITY_RANK.CHARACTER);
    expect(SPECIFICITY_RANK.CHARACTER).toBe(1);
  });
});

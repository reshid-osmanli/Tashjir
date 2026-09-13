// اختبارات التحقق من المرجع — Reference Validation (FR-ES-12.1، AC-07)
//
// عينة فروق مصطنعة تغطي التصنيفات الخمس:
//   Correct / Wrong / Missing / Extra / Conflict
// وكل تصنيف حتمي: نفس المدخلات تعطي نفس النتيجة دائما.

import { describe, expect, it } from 'vitest';
import type { Variant } from '@/types/tashjeer';
import type { GlobalRule } from '@/lib/storage/global-rules-store';
import type { RuleOccurrenceOverride } from '@/lib/storage/rule-occurrences-store';
import {
  classifyOverride,
  classifyVariant,
  validateAgainstReference,
  type ValidationVerdict,
} from '@/lib/tashjeer/reference-validation';

const NOW = '2026-09-13T00:00:00.000Z';

function makeFace(id: string, label: string, isBase = false): Variant['alternatives'][number] {
  return { id, text: `نص ${label}`, label, isBase, scope: { kind: 'ALL' } };
}

function makeVariant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: overrides.id ?? 'v1',
    ayahKey: 1004,
    category: 'MADUD',
    title: 'مد المنفصل',
    startPosition: 1,
    endPosition: 1,
    alternatives: [makeFace('v1-base', 'وجه المصحف', true), makeFace('v1-a', 'مد ٤')],
    status: 'DRAFT',
    origin: 'ENGINE',
    ...overrides,
  };
}

function makeSnapshotOf(variant: Pick<Variant, 'title' | 'category' | 'alternatives'>) {
  return {
    title: variant.title,
    category: variant.category,
    alternatives: JSON.parse(JSON.stringify(variant.alternatives)),
    capturedAt: NOW,
  };
}

function makeRule(id: string): GlobalRule {
  return {
    id,
    title: `قاعدة ${id}`,
    category: 'MADUD',
    scope: { kind: 'ALL' },
    status: 'DRAFT',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeOverride(
  ruleId: string,
  overrides: Partial<RuleOccurrenceOverride> = {}
): RuleOccurrenceOverride {
  return {
    id: `global:${ruleId}:1004:2:2:1:1`,
    ruleId,
    ayahKey: 1004,
    startPosition: 2,
    endPosition: 2,
    characterStart: 1,
    characterEnd: 1,
    state: 'APPLIED',
    matchedText: 'نِعْمَ',
    updatedAt: NOW,
    ...overrides,
  };
}

// ==================== تصنيف الاختلاف الواحد ====================

describe('تصنيف اختلاف مقارنة بلقطة المحرك (AC-07)', () => {
  it('Correct: الموضع مطابق لاقتراح المحرك', () => {
    const variant = makeVariant({ engineSnapshot: makeSnapshotOf(makeVariant()) });
    expect(classifyVariant(variant).verdict).toBe('CORRECT');
  });

  it('Wrong: غيّر المحرر العنوان', () => {
    const base = makeVariant();
    const variant = makeVariant({
      engineSnapshot: makeSnapshotOf(base),
      title: 'عنوان محرر',
    });
    expect(classifyVariant(variant).verdict).toBe('WRONG');
  });

  it('Wrong: غيّر المحرر الفئة', () => {
    const base = makeVariant();
    const variant = makeVariant({
      engineSnapshot: makeSnapshotOf(base),
      category: 'FARSH',
    });
    expect(classifyVariant(variant).verdict).toBe('WRONG');
  });

  it('Missing: حُذف وجه اقترحه المحرك بلا إضافة', () => {
    const base = makeVariant({
      alternatives: [
        makeFace('v1-base', 'وجه المصحف', true),
        makeFace('v1-a', 'مد ٤'),
        makeFace('v1-b', 'مد ٢'),
      ],
    });
    const variant = makeVariant({
      engineSnapshot: makeSnapshotOf(base),
      alternatives: [makeFace('v1-base', 'وجه المصحف', true), makeFace('v1-a', 'مد ٤')],
    });
    expect(classifyVariant(variant).verdict).toBe('MISSING');
  });

  it('Extra: أُضيف وجه لم يقترحه المحرك بلا حذف', () => {
    const base = makeVariant();
    const variant = makeVariant({
      engineSnapshot: makeSnapshotOf(base),
      alternatives: [
        makeFace('v1-base', 'وجه المصحف', true),
        makeFace('v1-a', 'مد ٤'),
        makeFace('v1-c', 'مد ٦'),
      ],
    });
    expect(classifyVariant(variant).verdict).toBe('EXTRA');
  });

  it('Wrong: تغيير مختلط (إضافة وحذف)', () => {
    const base = makeVariant({
      alternatives: [makeFace('v1-base', 'وجه المصحف', true), makeFace('v1-b', 'مد ٢')],
    });
    const variant = makeVariant({
      engineSnapshot: makeSnapshotOf(base),
      alternatives: [
        makeFace('v1-base', 'وجه المصحف', true),
        makeFace('v1-c', 'مد ٦'),
      ],
    });
    expect(classifyVariant(variant).verdict).toBe('WRONG');
  });

  it('Extra: أنشأه المحرر من الصفر (بلا لقطة)', () => {
    const variant = makeVariant({ id: 'v-edit', origin: 'EDITOR', engineSnapshot: undefined });
    expect(classifyVariant(variant).verdict).toBe('EXTRA');
  });

  it('Correct: لم يمسّه المحرر (بلا لقطة ومصدره المحرك)', () => {
    const variant = makeVariant({ engineSnapshot: undefined });
    expect(classifyVariant(variant).verdict).toBe('CORRECT');
  });
});

// ==================== الاستثناءات المحلية ====================

describe('تصنيف استثناء موضعي لموضع قاعدة (الحزمة 07)', () => {
  it('حذف موضعي = Missing: الموضع غير موجود في المرجع', () => {
    expect(classifyOverride(makeOverride('r1', { state: 'DELETED', reason: 'مستثنى' })).verdict).toBe(
      'MISSING'
    );
  });

  it('اعتماد الموضع = Correct', () => {
    expect(classifyOverride(makeOverride('r1', { state: 'CONFIRMED' })).verdict).toBe('CORRECT');
  });

  it('تخصيص رتبة السطر = Wrong (يختلف عن ترتيب المحرك)', () => {
    expect(classifyOverride(makeOverride('r1', { orderRank: 5 })).verdict).toBe('WRONG');
  });
});

// ==================== التحقق الكامل ====================

describe('validateAgainstReference على عينة مصطنعة (AC-07)', () => {
  it('يصنف العينة الخماسية تصنيفا صحيحا ويعيد ملخصا كميا', () => {
    const correct = makeVariant({ id: 'v-correct', engineSnapshot: makeSnapshotOf(makeVariant({ id: 'v-correct' })) });
    const wrong = makeVariant({
      id: 'v-wrong',
      engineSnapshot: makeSnapshotOf(makeVariant({ id: 'v-wrong', title: 'قبل' })),
      title: 'بعد',
    });
    const missing = makeVariant({
      id: 'v-missing',
      alternatives: [makeFace('vm-base', 'وجه المصحف', true)],
      engineSnapshot: makeSnapshotOf(
        makeVariant({
          id: 'v-missing',
          alternatives: [
            makeFace('vm-base', 'وجه المصحf', true),
            makeFace('vm-a', 'مد ٤'),
          ],
        })
      ),
    });
    const extra = makeVariant({ id: 'v-extra', origin: 'EDITOR' });
    const conflictA = makeVariant({ id: 'v-conflict-a', category: 'FARSH', alternatives: [makeFace('va-base', 'وجه المصحf', true), makeFace('va-a', 'فرش أ')] });
    const conflictB = makeVariant({ id: 'v-conflict-b', category: 'FARSH', alternatives: [makeFace('vb-base', 'وجه المصحf', true), makeFace('vb-a', 'فرش ب')] });

    const result = validateAgainstReference({
      documents: [
        {
          ayahKey: 1004,
          variants: [correct, wrong, missing, extra, conflictA, conflictB],
          links: [
            {
              id: 'link-conflict',
              ayahKey: 1004,
              kind: 'FACE_TO_FACE',
              relation: 'MERGE',
              from: { type: 'FACE', id: 'v-conflict-a::va-a' },
              to: { type: 'FACE', id: 'v-conflict-b::vb-a' },
              origin: 'EDITOR',
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
        },
      ],
      rules: [makeRule('r1')],
      overrides: [makeOverride('r1', { state: 'DELETED', reason: 'مستثنى' })],
    });

    const verdicts = new Map(result.positions.map((p) => [p.id, p.verdict]));
    expect(verdicts.get('variant:1004:v-correct')).toBe('CORRECT');
    expect(verdicts.get('variant:1004:v-wrong')).toBe('WRONG');
    expect(verdicts.get('variant:1004:v-missing')).toBe('MISSING');
    expect(verdicts.get('variant:1004:v-extra')).toBe('EXTRA');
    expect(verdicts.get('conflict:link-conflict')).toBe('CONFLICT');
    expect(verdicts.get('override:global:r1:1004:2:2:1:1')).toBe('MISSING');

    // الملخص الكمي أعلى الصفحة: conflictA/B بلا لقطة ولم يُمسا = Correct
    // (افتراض موثق: ما لم يُمسّه المحرر فمطابق لنتيجة المحرك).
    expect(result.summary.correct).toBe(3);
    expect(result.summary.wrong).toBe(1);
    expect(result.summary.missing).toBe(2); // وجه محذوف + موضع محذوف موضعيا
    expect(result.summary.extra).toBe(1);
    expect(result.summary.conflict).toBe(1);
    expect(result.summary.total).toBe(8);

    // كل موضع يحمل سببا حتميا ورابط فتح في المحرر
    for (const position of result.positions) {
      expect(position.reason.length).toBeGreaterThan(0);
      expect(position.ayahKey).toBe(1004);
    }
  });

  it('لا تعارض بلا رابط دمج يدوي (حتمي)', () => {
    const a = makeVariant({ id: 'v-a', category: 'FARSH' });
    const b = makeVariant({ id: 'v-b', category: 'FARSH' });
    const result = validateAgainstReference({
      documents: [{ ayahKey: 1004, variants: [a, b] }],
      rules: [],
      overrides: [],
    });
    const conflicts = result.positions.filter((p) => p.verdict === 'CONFLICT');
    expect(conflicts).toHaveLength(0);
  });

  it('التصنيفات الحتمية: نفس المدخلات تعطي نفس المخرجات', () => {
    const input = {
      documents: [
        {
          ayahKey: 1004,
          variants: [makeVariant({ engineSnapshot: makeSnapshotOf(makeVariant()) })],
        },
      ],
      rules: [],
      overrides: [],
    };
    const first = validateAgainstReference(input);
    const second = validateAgainstReference(input);
    expect(
      first.positions.map((p): ValidationVerdict => p.verdict)
    ).toEqual(second.positions.map((p) => p.verdict));
  });
});

// اختبارات نواة الإنشاء الذكي — Smart Create Core (FR-ED-08)
// مشروع التشجير - نظام القراءات العشر

import { describe, expect, it } from 'vitest';
import type { VariantCategory } from '@/types';
import { buildSmartCreateBatch, isSmartCreateReady, type SmartCreateInput } from '@/lib/tashjeer/smart-create';

const baseInput: SmartCreateInput = {
  ayahKey: 2004,
  selection: [{ startPosition: 3, endPosition: 3 }],
  baseTitle: 'مَٰلِكِ',
  types: ['MADUD', 'USUL', 'FARSH'],
  scope: { kind: 'ALL' },
};

describe('الإنشاء الجماعي يحافظ على الاستقلال (FR-ED-08، P-05)', () => {
  it('يُنشئ اختلافًا مستقلًا لكل نوع بمعرّف فريد ورتبة صريحة', () => {
    const { differences } = buildSmartCreateBatch(baseInput);
    expect(differences).toHaveLength(3);
    const ids = differences.map((d) => d.id);
    expect(new Set(ids).size).toBe(3);
    expect(differences.map((d) => d.rank)).toEqual([1, 2, 3]);
    expect(differences.map((d) => d.category)).toEqual(['MADUD', 'USUL', 'FARSH']);
  });

  it('كل اختلاف كيان كامل: مصدر محرر، حالة مسودة، سياق دائم، نطاق', () => {
    const { differences } = buildSmartCreateBatch(baseInput);
    for (const difference of differences) {
      expect(difference.source).toBe('editor');
      expect(difference.status).toBe('DRAFT');
      expect(difference.context).toBe('ALWAYS');
      expect(difference.scope).toEqual({ kind: 'ALL' });
      expect(difference.variants.length).toBeGreaterThanOrEqual(1);
      expect(difference.variants[0]!.isBase).toBe(true);
    }
  });

  it('يوسم الكل بمعرّف دفعة واحد للتتبع (لا يلغي الاستقلال)', () => {
    const { differences, batchId } = buildSmartCreateBatch(baseInput);
    expect(batchId).toBeTruthy();
    expect(differences.every((d) => d.createBatchId === batchId)).toBe(true);
  });
});

describe('العلاقات التلقائية بين الأنواع (FR-ED-08 الخطوة 5)', () => {
  it('ينشئ علاقة بين نوعين بمعرّفاتهما', () => {
    const { differences, relations } = buildSmartCreateBatch({
      ...baseInput,
      relations: [{ fromType: 'MADUD', toType: 'USUL', type: 'COMPOSITE' }],
    });
    expect(relations).toHaveLength(1);
    const from = differences.find((d) => d.category === 'MADUD')!;
    const to = differences.find((d) => d.category === 'USUL')!;
    expect(relations[0]!.fromId).toBe(from.id);
    expect(relations[0]!.toId).toBe(to.id);
    expect(relations[0]!.type).toBe('COMPOSITE');
    expect(relations[0]!.source).toBe('editor');
  });

  it('يتجاهل العلاقة بنوع غير مختار', () => {
    const { relations } = buildSmartCreateBatch({
      ...baseInput,
      relations: [{ fromType: 'MADUD', toType: 'HAMZ', type: 'RELATED' }],
    });
    expect(relations).toHaveLength(0);
  });
});

describe('التحديد البصري (FR-ED-08 الخطوة 1، G13)', () => {
  it('كلمة واحدة → موضع كلمة', () => {
    const { differences } = buildSmartCreateBatch({ ...baseInput, selection: [{ startPosition: 5, endPosition: 5 }] });
    const locus = differences[0]!.locus;
    expect(locus.startPosition).toBe(5);
    expect(locus.endPosition).toBe(5);
    expect(locus.loci).toBeUndefined();
  });

  it('مدى كلمة→كلمة → موضع مدى', () => {
    const { differences } = buildSmartCreateBatch({
      ...baseInput,
      selection: [{ startPosition: 2, endPosition: 4 }],
    });
    const locus = differences[0]!.locus;
    expect(locus.startPosition).toBe(2);
    expect(locus.endPosition).toBe(4);
  });

  it('مواضع متباعدة → مدى كلي مع loci منفصلة', () => {
    const { differences } = buildSmartCreateBatch({
      ...baseInput,
      selection: [
        { startPosition: 1, endPosition: 1 },
        { startPosition: 5, endPosition: 5 },
      ],
    });
    const locus = differences[0]!.locus;
    expect(locus.startPosition).toBe(1);
    expect(locus.endPosition).toBe(5);
    expect(locus.loci).toHaveLength(2);
  });
});

describe('جاهزية الإنشاء', () => {
  it('يتطلب تحديدًا ونوعًا واحدًا على الأقل', () => {
    expect(isSmartCreateReady({ selection: [{ startPosition: 1, endPosition: 1 }], types: ['FARSH' as VariantCategory] })).toBe(true);
    expect(isSmartCreateReady({ selection: [], types: ['FARSH'] })).toBe(false);
    expect(isSmartCreateReady({ selection: [{ startPosition: 1, endPosition: 1 }], types: [] })).toBe(false);
  });
});

// اختبارات فرق حقول القاعدة الحتمي — Rule Field Diff (FR-ES-07.3/.4/.6)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس: الحتمية (نفس المدخلات ← نفس النص)، وترتيب الحقول الثابت في الفرق،
// ومطابقة الفرق لما يراه Git في التصدير (DM-13)، واستنتاج مصدر قاعدة قديمة.

import { describe, expect, it } from 'vitest';
import type { EngineRule } from '@/lib/tashjeer/model/v8';
import {
  RULE_FIELD_ORDER,
  RULE_METADATA_FIELDS,
  canonicalClone,
  changedFieldLabels,
  diffRuleFields,
  inferRuleSource,
  renderFieldValue,
  sameValue,
  stableStringify,
  summarizeChanges,
} from '@/lib/tashjeer/rule-diff';

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'er-a',
    name: 'قاعدة أ',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }] },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 100,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('التسلسل الحتمي', () => {
  it('يرتّب مفاتيح الكائنات أبجديًا فلا يختلف النص بترتيب الكتابة', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('يحفظ ترتيب المصفوفات (ترتيبها معنى في الشروط)', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('يحذف قيم undefined فيبقى الناتج JSON صالحًا', () => {
    const clone = canonicalClone<EngineRule>(rule({ description: undefined }));
    expect('description' in clone).toBe(false);
    expect(clone.name).toBe('قاعدة أ');
    expect(() => JSON.parse(stableStringify(rule({ description: undefined })))).not.toThrow();
  });

  it('يقارن القيم كنسيًا لا بالمرجع', () => {
    expect(sameValue({ a: 1, b: [2] }, { b: [2], a: 1 })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe('فرق الحقول', () => {
  it('يُعيد الحقول المتغيّرة فقط بترتيب ثابت', () => {
    const changes = diffRuleFields(rule(), rule({ priority: 90, status: 'DISABLED' }));
    expect(changedFieldLabels(changes)).toEqual(['الأولوية', 'الحالة']);
    // الترتيب يتبع RULE_FIELD_ORDER لا ترتيب الاكتشاف.
    const orderIndex = changes.map((change) => RULE_FIELD_ORDER.indexOf(change.field as never));
    expect(orderIndex).toEqual([...orderIndex].sort((a, b) => a - b));
  });

  it('يسجّل قبل/بعد لكل حقل متغيّر', () => {
    const [change] = diffRuleFields(rule({ priority: 80 }), rule({ priority: 100 }));
    expect(change?.field).toBe('priority');
    expect(change?.before).toBe(80);
    expect(change?.after).toBe(100);
  });

  it('الإنشاء (قبل = null) يُسجّل الحقول ذات القيمة فقط', () => {
    const changes = diffRuleFields(null, rule({ description: 'وصف' }));
    expect(changes.some((change) => change.field === 'description')).toBe(true);
    expect(changes.every((change) => change.before === undefined)).toBe(true);
    expect(changes.some((change) => change.field === 'protected')).toBe(false);
  });

  it('لا فرق بين نسختين متطابقتين', () => {
    expect(diffRuleFields(rule(), rule())).toHaveLength(0);
  });

  it('يلخّص التغييرات عربيًا', () => {
    expect(summarizeChanges(diffRuleFields(rule({ priority: 80 }), rule({ priority: 100 })))).toBe(
      'الأولوية 80 ← 100'
    );
    expect(summarizeChanges([])).toBe('لا تغيير في الحقول');
  });
});

describe('عرض القيم وMetadata', () => {
  it('يعرض المصفوفات والكائنات والقيم الفارغة بصيغة مقروءة', () => {
    expect(renderFieldValue('protected', true)).toBe('نعم');
    expect(renderFieldValue('description', '')).toBe('—');
    expect(renderFieldValue('dependsOn', ['er-b', 'er-c'])).toBe('er-b، er-c');
    expect(
      renderFieldValue('testCases', [
        { name: 'حالة أ', input: {}, expected: 'MERGE' },
        { name: 'حالة ب', input: {}, expected: 'SEPARATE' },
      ])
    ).toBe('2 حالة: حالة أ، حالة ب');
  });

  it('حقول Metadata المطلوبة كلها معرّفة التسمية', () => {
    for (const field of RULE_METADATA_FIELDS) {
      expect(RULE_FIELD_ORDER).toContain(field);
    }
    expect(RULE_METADATA_FIELDS).toContain('description');
    expect(RULE_METADATA_FIELDS).toContain('source');
    expect(RULE_METADATA_FIELDS).toContain('testCases');
  });
});

describe('استنتاج المصدر (لا يُكسر ملف قديم)', () => {
  it('قواعد النظام ببادئتها أو بطابعها', () => {
    expect(inferRuleSource(rule({ id: 'er-system-merge' }))).toBe('SYSTEM');
    expect(inferRuleSource(rule({ id: 'er-x', createdAt: 'system', updatedAt: 'system' }))).toBe('SYSTEM');
  });

  it('المرشّحة من تصحيح ببادئتها، والمستوردة بحقلها', () => {
    expect(inferRuleSource(rule({ id: 'er-cand-1' }))).toBe('CANDIDATE');
    expect(inferRuleSource(rule({ id: 'er-1', source: 'IMPORTED' }))).toBe('IMPORTED');
  });

  it('ما عدا ذلك تحرير في الاستوديو', () => {
    expect(inferRuleSource(rule({ id: 'er-9' }))).toBe('EDITOR');
  });
});

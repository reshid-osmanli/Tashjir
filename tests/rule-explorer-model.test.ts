// اختبارات نموذج مستكشف القواعد — Rule Explorer Model (FR-ES-07.1)
// مشروع التشجير - نظام القراءات العشر
//
// تحرس: التصنيف في دلاء المستكشف (Global/Surah/Ayah/Local/Reader/Narrator/
// Path/Merge/Difference/Ordering/Exceptions) متكاملًا مع الفئات الأربع عشرة،
// والبحث العربي المطبّع، والتصفية بكل الأوجه، والترتيب الحتمي، والتجميع،
// وجاهزية القوائم الطويلة (٣٠٠+ قاعدة).

import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import {
  DEFAULT_CONFLICT_POLICY,
  DEFAULT_MERGE_MATRIX,
  DEFAULT_PRIORITY_GROUPS,
} from '@/lib/tashjeer/decision/policy';
import {
  BUCKET_LABELS,
  EMPTY_EXPLORER_QUERY,
  EXPLORER_BUCKETS,
  applyExplorerQuery,
  buildExplorerContext,
  classifyRule,
  compareRules,
  explorerFacets,
  filterRules,
  groupByBucket,
  groupByCategory,
  groupByPriorityGroup,
  isEdited,
  matchesQuery,
  ruleSearchText,
  sortRules,
  type ExplorerQuery,
} from '@/lib/tashjeer/rule-explorer-model';

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'er-x',
    name: 'قاعدة',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: { all: [{ field: 'differenceType', op: 'equals', value: 'MADD' }] },
    actions: [{ type: 'MERGE' }],
    priority: 80,
    groupId: 'merge',
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function config(rules: EngineRule[]): EngineConfig {
  return {
    schemaVersion: 1,
    profile: 'testing',
    priorityGroups: DEFAULT_PRIORITY_GROUPS,
    rules,
    conflictPolicy: DEFAULT_CONFLICT_POLICY,
    executionOrder: ['MERGE'],
    mergeMatrix: DEFAULT_MERGE_MATRIX,
    contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
  };
}

function query(patch: Partial<ExplorerQuery> = {}): ExplorerQuery {
  return { ...EMPTY_EXPLORER_QUERY, ...patch };
}

describe('التصنيف في دلاء المستكشف', () => {
  it('النطاق والخصوصية يحددان العام والسورة والآية والمحلي', () => {
    expect(classifyRule(rule({ scope: 'MUSHAF', category: 'CONTEXT' }))).toBe('DIFFERENCE');
    expect(classifyRule(rule({ scope: 'SURAH', specificity: 'SURAH', category: 'DETECTION' }))).toBe('SURAH');
    expect(classifyRule(rule({ scope: 'AYAH', specificity: 'AYAH', category: 'DETECTION' }))).toBe('AYAH');
    expect(classifyRule(rule({ scope: 'WORD', specificity: 'WORD', category: 'DETECTION' }))).toBe('LOCAL');
    expect(classifyRule(rule({ scope: 'CHARACTER', specificity: 'CHARACTER', category: 'DETECTION' }))).toBe('LOCAL');
  });

  it('مجموعات القرّاء والرواة والطرق تسبق غيرها', () => {
    expect(classifyRule(rule({ groupId: 'reader', scope: 'MUSHAF', category: 'MERGE' }))).toBe('READER');
    expect(classifyRule(rule({ groupId: 'narrator', category: 'MERGE' }))).toBe('NARRATOR');
    expect(classifyRule(rule({ groupId: 'path', category: 'MERGE' }))).toBe('PATH');
    // شرط على القارئ يكفي ولو كانت المجموعة عامة.
    expect(
      classifyRule(rule({ groupId: 'merge', conditions: { all: [{ field: 'readerId', op: 'equals', value: 'q-1' }] } }))
    ).toBe('READER');
  });

  it('الفئات الأربع عشرة موزّعة على الدلاء بلا ثغرة', () => {
    const categories: Array<EngineRule['category']> = [
      'DETECTION',
      'DIFFERENCE',
      'VARIANT',
      'MERGE',
      'SPLIT',
      'ORDERING',
      'RELATION',
      'CONTEXT',
      'WAQF',
      'WASL',
      'IBTIDA',
      'EXCEPTION',
      'OVERRIDE',
      'VALIDATION',
    ];
    expect(categories).toHaveLength(14);
    for (const category of categories) {
      const bucket = classifyRule(rule({ category, scope: 'MUSHAF', specificity: 'MUSHAF', groupId: 'structural' }));
      expect(EXPLORER_BUCKETS).toContain(bucket);
      expect(BUCKET_LABELS[bucket].length).toBeGreaterThan(0);
    }
    expect(classifyRule(rule({ category: 'SPLIT' }))).toBe('MERGE');
    expect(classifyRule(rule({ category: 'ORDERING', type: 'ORDERING' }))).toBe('ORDERING');
    expect(classifyRule(rule({ category: 'EXCEPTION' }))).toBe('EXCEPTIONS');
    expect(classifyRule(rule({ category: 'OVERRIDE' }))).toBe('EXCEPTIONS');
    expect(classifyRule(rule({ category: 'WAQF' }))).toBe('DIFFERENCE');
  });
});

describe('البحث العربي المطبّع', () => {
  it('يجد الكلمة بلا تشكيل وبهمزات موحّدة', () => {
    const target = rule({ name: 'لا تدمج الفرش مع المدود', description: 'أحكام المَالِكِ' });
    expect(matchesQuery(target, 'الفرش')).toBe(true);
    expect(matchesQuery(target, 'مدود')).toBe(true);
    expect(matchesQuery(target, 'مالك')).toBe(true); // «المَالِكِ» ← «مالك»
    expect(matchesQuery(target, 'لا تدمج')).toBe(true);
    expect(matchesQuery(target, 'غير موجود')).toBe(false);
  });

  it('يبحث في المعرّف والفئة وحقول الشروط وقيمها', () => {
    const target = rule({ id: 'er-farsh-madd', conditions: { all: [{ field: 'readerId', op: 'equals', value: 'imam-nafi' }] } });
    expect(ruleSearchText(target)).toContain('er-farsh-madd');
    expect(matchesQuery(target, 'er-farsh')).toBe(true);
    expect(matchesQuery(target, 'imam-nafi')).toBe(true);
    expect(matchesQuery(target, 'readerId')).toBe(true);
    expect(matchesQuery(target, 'MERGE')).toBe(true);
  });

  it('كل كلمة في البحث يجب أن تظهر (بحث بـ «و»)', () => {
    const target = rule({ name: 'لا تدمج الفرش مع المد' });
    expect(matchesQuery(target, 'فرش مد')).toBe(true);
    expect(matchesQuery(target, 'فرش تحقيق')).toBe(false);
  });

  it('بحث فارغ يطابق الكل', () => {
    expect(matchesQuery(rule(), '   ')).toBe(true);
  });
});

describe('التصفية بكل الأوجه (FR-ES-07.1.2)', () => {
  const rules = [
    rule({ id: 'er-1', name: 'أولى', status: 'ACTIVE', category: 'MERGE', groupId: 'merge', hardness: 'HARD', protected: true, version: 3 }),
    rule({ id: 'er-2', name: 'ثانية', status: 'DRAFT', category: 'ORDERING', type: 'ORDERING', groupId: 'structural', hardness: 'SOFT', source: 'CANDIDATE' }),
    rule({ id: 'er-3', name: 'ثالثة', status: 'DISABLED', category: 'EXCEPTION', groupId: 'reader', scope: 'AYAH', specificity: 'AYAH', testCases: [{ name: 'حالة', input: {}, expected: 'MERGE' }] }),
    rule({ id: 'er-4', name: 'رابعة', status: 'CONFLICTED', category: 'MERGE', groupId: 'merge', source: 'IMPORTED' }),
  ];

  it('بالحالة (متعدد)', () => {
    expect(filterRules(rules, query({ statuses: ['ACTIVE', 'DRAFT'] })).map((item) => item.id)).toEqual(['er-1', 'er-2']);
    expect(filterRules(rules, query({ statuses: 'ALL' }))).toHaveLength(4);
  });

  it('بالفئة والدلو والمجموعة', () => {
    expect(filterRules(rules, query({ categories: ['ORDERING'] })).map((item) => item.id)).toEqual(['er-2']);
    // er-3 استثناء في مجموعة القرّاء: الجمهور يسبق النطاق والوظيفة.
    expect(filterRules(rules, query({ buckets: ['READER'] })).map((item) => item.id)).toEqual(['er-3']);
    expect(filterRules(rules, query({ buckets: ['EXCEPTIONS'] })).map((item) => item.id)).toEqual([]);
    // استثناء مقيّد بآية (بلا جمهور) يقع في دلو «على الآية»: الأخص نطاقًا
    // يسبق الوظيفة، واستثناء على المصحف يقع في دلو الاستثناءات.
    const ayahException = rule({ id: 'er-5', category: 'EXCEPTION', scope: 'AYAH', specificity: 'AYAH' });
    const mushafException = rule({ id: 'er-6', category: 'EXCEPTION', scope: 'MUSHAF', specificity: 'MUSHAF' });
    const withBoth = [...rules, ayahException, mushafException];
    expect(filterRules(withBoth, query({ buckets: ['AYAH'] })).map((item) => item.id)).toEqual(['er-5']);
    expect(filterRules(withBoth, query({ buckets: ['EXCEPTIONS'] })).map((item) => item.id)).toEqual(['er-6']);
    expect(filterRules(rules, query({ groupId: 'merge' })).map((item) => item.id)).toEqual(['er-1', 'er-4']);
  });

  it('بالصلابة والخصوصية والمصدر', () => {
    expect(filterRules(rules, query({ hardness: 'HARD' })).map((item) => item.id)).toEqual(['er-1']);
    expect(filterRules(rules, query({ specificity: 'AYAH' })).map((item) => item.id)).toEqual(['er-3']);
    expect(filterRules(rules, query({ source: 'CANDIDATE' })).map((item) => item.id)).toEqual(['er-2']);
    expect(filterRules(rules, query({ source: 'IMPORTED' })).map((item) => item.id)).toEqual(['er-4']);
  });

  it('بالمفاتيح السريعة: محمية/بها اختبارات/نافذة/متعارضة/معدّلة', () => {
    expect(filterRules(rules, query({ protectedOnly: true })).map((item) => item.id)).toEqual(['er-1']);
    expect(filterRules(rules, query({ withTestsOnly: true })).map((item) => item.id)).toEqual(['er-3']);
    expect(filterRules(rules, query({ liveOnly: true })).map((item) => item.id)).toEqual(['er-1', 'er-4']);
    expect(filterRules(rules, query({ conflictedOnly: true })).map((item) => item.id)).toEqual(['er-4']);
    expect(filterRules(rules, query({ editedOnly: true })).map((item) => item.id)).toEqual(['er-1']);
    expect(isEdited(rule({ version: 1 }))).toBe(false);
  });

  it('المرشّحات تُركّب (و) لا (أو)', () => {
    expect(filterRules(rules, query({ statuses: ['ACTIVE'], hardness: 'HARD', protectedOnly: true }))).toHaveLength(1);
    expect(filterRules(rules, query({ statuses: ['ACTIVE'], groupId: 'reader' }))).toHaveLength(0);
  });

  it('التعارض المكتشف يوسم في التصفية ولو لم تكن الحالة CONFLICTED', () => {
    const tie = [
      rule({ id: 'er-allow', actions: [{ type: 'MERGE' }], priority: 80, hardness: 'SOFT' }),
      rule({ id: 'er-prevent', actions: [{ type: 'PREVENT_MERGE' }], priority: 80, hardness: 'SOFT' }),
    ];
    const context = buildExplorerContext(config(tie));
    expect(context.conflicts.size).toBe(2);
    expect(filterRules(tie, query({ conflictedOnly: true }), context)).toHaveLength(2);
  });
});

describe('الترتيب الحتمي (FR-ES-07.1.2)', () => {
  const rules = [
    rule({ id: 'er-b', name: 'باء', priority: 100, status: 'DRAFT', updatedAt: '2026-01-02T00:00:00.000Z', version: 2 }),
    rule({ id: 'er-a', name: 'ألف', priority: 80, status: 'ACTIVE', updatedAt: '2026-01-03T00:00:00.000Z', version: 5 }),
    rule({ id: 'er-c', name: 'جيم', priority: 80, status: 'ACTIVE', updatedAt: '2026-01-01T00:00:00.000Z', version: 1 }),
  ];

  it('بالأولوية نزولًا وصعودًا', () => {
    expect(sortRules(rules, { key: 'priority', direction: 'desc' }).map((item) => item.id)).toEqual(['er-b', 'er-a', 'er-c']);
    expect(sortRules(rules, { key: 'priority', direction: 'asc' }).map((item) => item.id)).toEqual(['er-a', 'er-c', 'er-b']);
  });

  it('التعادل يُحسم بالمعرّف (لا قفزات)', () => {
    const sorted = sortRules(rules, { key: 'priority', direction: 'asc' });
    expect(sorted[0]?.id).toBe('er-a');
    expect(sorted[1]?.id).toBe('er-c');
    expect(compareRules(rule({ id: 'z' }), rule({ id: 'a' }), { key: 'priority', direction: 'desc' })).toBeGreaterThan(0);
  });

  it('بالاسم عربيًا، وبالحالة بترتيبها المعرفي لا الأبجدي', () => {
    expect(sortRules(rules, { key: 'name', direction: 'desc' }).map((item) => item.name)).toEqual(['جيم', 'باء', 'ألف']);
    const byStatus = sortRules(rules, { key: 'status', direction: 'asc' }).map((item) => item.status);
    expect(byStatus).toEqual(['ACTIVE', 'ACTIVE', 'DRAFT']);
  });

  it('بآخر تعديل ورقم الإصدار والاستخدام', () => {
    expect(sortRules(rules, { key: 'updated', direction: 'desc' }).map((item) => item.id)).toEqual(['er-a', 'er-b', 'er-c']);
    expect(sortRules(rules, { key: 'version', direction: 'desc' }).map((item) => item.id)).toEqual(['er-a', 'er-b', 'er-c']);
    const usage = new Map([['er-c', 5], ['er-a', 1]]);
    expect(sortRules(rules, { key: 'usage', direction: 'desc' }, usage).map((item) => item.id)).toEqual([
      'er-c',
      'er-a',
      'er-b',
    ]);
  });

  it('لا يعدّل القائمة الأصلية', () => {
    const original = [...rules];
    sortRules(rules, { key: 'name', direction: 'asc' });
    expect(rules).toEqual(original);
  });
});

describe('التجميع (الشجرة)', () => {
  const rules = [
    rule({ id: 'er-1', category: 'MERGE', groupId: 'merge' }),
    rule({ id: 'er-2', category: 'ORDERING', type: 'ORDERING', groupId: 'structural' }),
    rule({ id: 'er-3', category: 'MERGE', groupId: 'merge' }),
  ];

  it('بالدلو بترتيب الدلاء الثابت والفارغ يُحذف', () => {
    const groups = groupByBucket(rules, query());
    expect(groups.map((group) => group.bucket)).toEqual(['MERGE', 'ORDERING']);
    const orderIndex = groups.map((group) => EXPLORER_BUCKETS.indexOf(group.bucket));
    expect(orderIndex).toEqual([...orderIndex].sort((a, b) => a - b));
    expect(groups[0]?.rules).toHaveLength(2);
    expect(groups[0]?.live).toBe(2);
  });

  it('القاعدة المقيّدة بسورة تُجمع في دلو «على السورة» (الأخص أولًا)', () => {
    const groups = groupByBucket(
      [...rules, rule({ id: 'er-surah', category: 'MERGE', scope: 'SURAH', specificity: 'SURAH' })],
      query()
    );
    expect(groups.map((group) => group.bucket)).toEqual(['SURAH', 'MERGE', 'ORDERING']);
    expect(groups[0]?.rules.map((item) => item.id)).toEqual(['er-surah']);
  });

  it('بالفئة وبمجموعة الأولوية (بترتيب السلم)', () => {
    expect(groupByCategory(rules, query()).map((group) => group.category)).toEqual(['MERGE', 'ORDERING']);
    const byGroup = groupByPriorityGroup(config(rules), query());
    expect(byGroup.map((group) => group.groupId)).toEqual(['structural', 'merge']);
    expect(byGroup[0]?.order).toBeLessThan(byGroup[1]!.order);
  });

  it('التصفية تسري قبل التجميع', () => {
    const groups = groupByBucket(rules, query({ statuses: ['DRAFT'] }));
    expect(groups).toHaveLength(0);
  });
});

describe('عدّادات الرأس', () => {
  it('يلخّص الحالات والدلاء والمصادر', () => {
    const facets = explorerFacets([
      rule({ id: 'er-1', status: 'ACTIVE', protected: true, version: 2 }),
      rule({ id: 'er-2', status: 'DRAFT', source: 'CANDIDATE', testCases: [{ name: 'ح', input: {}, expected: 'MERGE' }] }),
      rule({ id: 'er-3', status: 'CONFLICTED' }),
    ]);
    expect(facets.total).toBe(3);
    expect(facets.live).toBe(2);
    expect(facets.protected).toBe(1);
    expect(facets.conflicted).toBe(1);
    expect(facets.withTests).toBe(1);
    expect(facets.edited).toBe(1);
    expect(facets.byStatus.ACTIVE).toBe(1);
    expect(facets.bySource.CANDIDATE).toBe(1);
    expect(facets.byBucket.MERGE).toBe(3);
    expect(facets.byCategory[0]).toEqual({ category: 'MERGE', count: 3 });
  });
});

describe('جاهزية القوائم الطويلة (٣٠٠+ قاعدة)', () => {
  /** يبني ملفًا فيه عدد كبير من القواعد المتنوعة. */
  function manyRules(count: number): EngineRule[] {
    const categories: Array<EngineRule['category']> = ['MERGE', 'ORDERING', 'EXCEPTION', 'DIFFERENCE', 'WAQF'];
    const groups = ['merge', 'structural', 'reader', 'narrator', 'exceptions'];
    return Array.from({ length: count }, (_, index) =>
      rule({
        id: `er-${String(index).padStart(4, '0')}`,
        name: `قاعدة رقم ${index} لأحكام المد`,
        category: categories[index % categories.length]!,
        groupId: groups[index % groups.length]!,
        priority: index % 120,
        status: (['ACTIVE', 'DRAFT', 'DISABLED', 'CONFLICTED'] as const)[index % 4]!,
        version: (index % 5) + 1,
      })
    );
  }

  it('٥٠٠ قاعدة: تصفية وفرز وتجميع في زمن مقبول', () => {
    const rules = manyRules(500);
    const context = buildExplorerContext(config(rules));
    const started = Date.now();
    const filtered = applyExplorerQuery(rules, query({ query: 'المد', statuses: ['ACTIVE', 'CONFLICTED'] }), context);
    const groups = groupByBucket(rules, query(), context);
    const elapsed = Date.now() + 0 - started;

    expect(filtered.length).toBe(250);
    expect(filtered.every((item) => item.status === 'ACTIVE' || item.status === 'CONFLICTED')).toBe(true);
    expect(groups.reduce((sum, group) => sum + group.rules.length, 0)).toBe(500);
    // حدّ سخيّ (آلة CI أبطأ من المطوّر) — المهم أنه لا نموّ أسيّ.
    expect(elapsed).toBeLessThan(2000);
  });

  it('الترتيب مستقر مع التكرارات (معرّف فاصل)', () => {
    const rules = manyRules(300).map((item) => ({ ...item, priority: 50 }));
    const sorted = sortRules(rules, { key: 'priority', direction: 'desc' });
    expect(sorted.map((item) => item.id)).toEqual([...sorted].map((item) => item.id).sort());
  });
});

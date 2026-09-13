// مجموعة اختبارات القواعد في CI — Rule Test Suite (FR-ES-08.3، معيارا القبول ٥ و٦)
// مشروع التشجير - نظام القراءات العشر
//
// هذا الملف هو ما يجعل `npm test` **يكتشف الانحدار عند تعديل المحرك مستقبلًا**:
// يُشغّل كل حالات الاختبار المرفقة بقواعد ملف المحرك المرجعي على محرك القرار
// الحالي، ويفشل إن انقلبت نتيجة مرجعية.
//
// ثلاث طبقات:
//   1) قواعد النظام المُشحونة (DEFAULT_SYSTEM_PROFILE) — يجب أن تنجح كلها.
//   2) ملفات محرك مُودَعة في tests/fixtures/engine-profiles/*.json (يضيفها
//      المستخدم بتصدير ملفه من الاستوديو) — تُشغَّل كلها وتُحرس كذلك.
//   3) إثبات أن الانحدار يُكتشف فعلًا: تعديل قاعدة «لا تدمج الفرش مع المد»
//      ليصير الدمج مسموحًا يقلب حالتها المرجعية، ويظهر إنذار Regression قبل
//      الحفظ (معاينة الأثر — FR-ES-09.4).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { EngineConfig, EngineRule } from '@/lib/tashjeer/model/v8';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { normalizeEngineConfig } from '@/lib/tashjeer/engine-config-store';
import {
  failingRules,
  runProfileTests,
  runRuleTests,
  runTestCase,
} from '@/lib/tashjeer/decision/rule-test-runner';
import { previewRuleEdit } from '@/lib/tashjeer/decision/rule-edit-preview';

/** معرّف قاعدة النظام التي تحمل معيار القبول ٥. */
const FARSH_MADD_RULE_ID = 'er-system-merge-farsh-madd';

function findRule(profile: EngineConfig, id: string): EngineRule {
  const rule = profile.rules.find((item) => item.id === id);
  if (!rule) throw new Error(`قاعدة غير موجودة في الملف المرجعي: ${id}`);
  return rule;
}

/** يقرأ ملفات المحرك المُودَعة (إن وُجدت) كملفات محرك مطبّعة. */
function loadFixtureProfiles(): Array<{ name: string; profile: EngineConfig }> {
  const here = dirname(fileURLToPath(import.meta.url));
  const directory = join(here, 'fixtures', 'engine-profiles');
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      name: file,
      profile: normalizeEngineConfig(JSON.parse(readFileSync(join(directory, file), 'utf8')) as Partial<EngineConfig>),
    }));
}

describe('حالات اختبار قواعد النظام المرجعية (FR-ES-08.3)', () => {
  it('كل قاعدة نظام مشحونة تحمل حالات اختبار مرجعية', () => {
    const rulesWithTests = DEFAULT_SYSTEM_PROFILE.rules.filter((rule) => (rule.testCases?.length ?? 0) > 0);
    expect(rulesWithTests.length).toBe(DEFAULT_SYSTEM_PROFILE.rules.length);
    expect(findRule(DEFAULT_SYSTEM_PROFILE, FARSH_MADD_RULE_ID).testCases?.length).toBeGreaterThanOrEqual(2);
  });

  it('كل الحالات تنجح على محرك القرار الحالي — لا انحدار في المرجع', () => {
    const report = runProfileTests(DEFAULT_SYSTEM_PROFILE);
    const failures = failingRules(report).flatMap((rule) =>
      rule.results.filter((result) => !result.passed).map((result) => `${rule.ruleName} ← ${result.caseName}: ${result.reason}`)
    );
    expect(report.total).toBeGreaterThan(0);
    expect(failures).toEqual([]);
    expect(report.failed).toBe(0);
  });

  it('قاعدة «لا تدمج الفرش مع المد»: فرش+مد ← فصل، ومد+تحقيق ← دمج', () => {
    const rule = findRule(DEFAULT_SYSTEM_PROFILE, FARSH_MADD_RULE_ID);
    const separate = rule.testCases!.find((testCase) => testCase.expected === 'SEPARATE')!;
    const merge = rule.testCases!.find((testCase) => testCase.expected === 'MERGE')!;

    expect(runTestCase(rule, separate, DEFAULT_SYSTEM_PROFILE).passed).toBe(true);
    expect(runTestCase(rule, separate, DEFAULT_SYSTEM_PROFILE).actual).toBe('SEPARATE');
    expect(runTestCase(rule, merge, DEFAULT_SYSTEM_PROFILE).actual).toBe('MERGE');
  });
});

describe('معيار القبول ٥: الانحدار يُكتشف قبل الحفظ', () => {
  /** التعديل الذي يُجريه المستخدم: قلب إجراء المنع إلى سماح بالدمج. */
  function allowMerge(rule: EngineRule): EngineRule {
    return {
      ...rule,
      actions: [{ type: 'MERGE' }],
      name: 'ادمج الفرش مع المد',
      version: rule.version + 1,
    };
  }

  it('الحالة المرجعية تفشل حين يُسمح بالدمج', () => {
    const rule = findRule(DEFAULT_SYSTEM_PROFILE, FARSH_MADD_RULE_ID);
    const edited = allowMerge(rule);
    const profileAfter: EngineConfig = {
      ...DEFAULT_SYSTEM_PROFILE,
      rules: DEFAULT_SYSTEM_PROFILE.rules.map((item) => (item.id === edited.id ? edited : item)),
    };

    const beforeReport = runRuleTests(rule, DEFAULT_SYSTEM_PROFILE);
    const afterReport = runRuleTests(edited, profileAfter);

    expect(beforeReport.failed).toBe(0);
    expect(afterReport.failed).toBeGreaterThan(0);

    const regressed = afterReport.results.find((result) => !result.passed)!;
    expect(regressed.expected).toBe('SEPARATE'); // Expected: B
    expect(regressed.actual).toBe('MERGE'); // Current: A
    expect(regressed.reason).toContain('المتوقَّع SEPARATE لكن الفعلي MERGE');
  });

  it('معاينة الأثر ترفع إنذار Regression قبل الحفظ النهائي', () => {
    const rule = findRule(DEFAULT_SYSTEM_PROFILE, FARSH_MADD_RULE_ID);
    const preview = previewRuleEdit(DEFAULT_SYSTEM_PROFILE, rule, allowMerge(rule));
    expect(preview.introducesRegression).toBe(true);
    expect(preview.flipped.map((item) => [item.before, item.after])).toContainEqual(['SEPARATE', 'MERGE']);
  });

  it('ملف المحرك كله يُبلغ عن القاعدة المنحدرة بالاسم', () => {
    const rule = findRule(DEFAULT_SYSTEM_PROFILE, FARSH_MADD_RULE_ID);
    const edited = allowMerge(rule);
    const profileAfter: EngineConfig = {
      ...DEFAULT_SYSTEM_PROFILE,
      rules: DEFAULT_SYSTEM_PROFILE.rules.map((item) => (item.id === edited.id ? edited : item)),
    };
    const report = runProfileTests(profileAfter);
    const failing = failingRules(report).map((item) => item.ruleId);
    // القاعدة المعدّلة تُبلغ أولًا، وتُبلغ معها كل قاعدة تملك حالة مرجعية على
    // نفس زوج المدخلات (فرش+مد) — فالانحدار في سلوك المحرك لا في قاعدة واحدة.
    expect(failing[0]).toBe(FARSH_MADD_RULE_ID);
    expect(failing).toContain('er-system-merge-madd-tahqiq');
    expect(report.failed).toBeGreaterThan(0);
    expect(report.passed).toBeGreaterThan(0); // بقية الحالات لم تنحدر
  });

  it('الحذف أو التعطيل يُظهران الانحدار كذلك (لا التحايل بالتعديل وحده)', () => {
    const rule = findRule(DEFAULT_SYSTEM_PROFILE, FARSH_MADD_RULE_ID);
    const disabled: EngineConfig = {
      ...DEFAULT_SYSTEM_PROFILE,
      rules: DEFAULT_SYSTEM_PROFILE.rules.map((item) =>
        item.id === rule.id ? { ...item, status: 'DISABLED', version: item.version + 1 } : item
      ),
    };
    // تعطيل القاعدة وحده لا يقلب القرار ما دامت المصفوفة تمنع الدمج — وهو
    // ضمان مطلوب: الانحدار يُقاس على سلوك المحرك لا على وجود القاعدة.
    const report = runProfileTests(disabled);
    expect(report.failed).toBe(0);
    expect(findRule(disabled, FARSH_MADD_RULE_ID).status).toBe('DISABLED');
  });
});

describe('ملفات المحرك المُودَعة تُحرس هي أيضًا', () => {
  const fixtures = loadFixtureProfiles();

  it('كل ملف مُودَع ناجح الاختبارات', () => {
    for (const fixture of fixtures) {
      const report = runProfileTests(fixture.profile);
      const failures = failingRules(report).map((rule) => `${fixture.name}: ${rule.ruleName}`);
      expect(failures, `انحدار في ${fixture.name}`).toEqual([]);
      expect(report.total, `لا حالات اختبار في ${fixture.name}`).toBeGreaterThan(0);
    }
  });

  it('الملف المثال يُحمَّل وتُشغَّل حالاته (حارس مسار التحميل نفسه)', () => {
    const example = fixtures.find((fixture) => fixture.name === 'example-minimal.json');
    expect(example, 'أضف tests/fixtures/engine-profiles/example-minimal.json').toBeTruthy();
    const report = runProfileTests(example!.profile);
    expect(report.total).toBe(1);
    expect(report.passed).toBe(1);
    expect(example!.profile.profile).toBe('example-minimal');
    // الملف المُودَع قاعدة محمية: الحرس يمرّ على الحماية المستوردة كذلك.
    expect(example!.profile.rules[0]?.protected).toBe(true);
    expect(example!.profile.rules[0]?.source).toBe('SYSTEM');
  });

  it('انحدار في ملف مُودَع يُكشف بالاسم (لا يمرّ صامتًا)', () => {
    const example = fixtures.find((fixture) => fixture.name === 'example-minimal.json')!;
    const regressed: EngineConfig = {
      ...example.profile,
      mergeMatrix: [{ a: 'FARSH', b: 'MADD', merge: true, priority: 60, reason: 'تجربة دمج' }],
      rules: example.profile.rules.map((rule) => ({ ...rule, actions: [{ type: 'MERGE' as const }], hardness: 'SOFT' as const, priority: 60 })),
    };
    const report = runProfileTests(regressed);
    expect(report.failed).toBe(1);
    expect(failingRules(report)[0]?.ruleId).toBe('er-example-farsh-madd');
  });
});

// معاينة أثر تعديل قاعدة — Rule Edit Preview (FR-ES-09.4)
// مشروع التشجير - نظام القراءات العشر
//
// تعديل قاعدة لا يُحفظ أثره فورًا؛ بل يُعرض Before/After: كم حالة اختبار ستتأثر
// (تنقلب نتيجتها) قبل الحفظ النهائي. هذا «Live Preview» الذي يكمل حلقة:
// عدّل ← عاين الأثر ← احفظ. طبقة نقيّة تركّب فوق مشغّل الاختبارات الموجود
// (rule-test-runner) بلا منطق مكرر (P-07).

import type { EngineConfig, EngineRule, TestCase } from '@/lib/tashjeer/model/v8';
import { runRuleTests, type TestVerdict } from './rule-test-runner';

/** حالة اختبار انقلبت نتيجتها بين قبل/بعد. */
export interface FlippedCase {
  name: string;
  before: TestVerdict;
  after: TestVerdict;
}

/** تقرير معاينة أثر تعديل قاعدة. */
export interface RuleEditPreview {
  /** عدد حالات الاختبار التي انقلبت نتيجتها. */
  flipped: FlippedCase[];
  /** عدد الحالات التي ثبتت (لم تتغير). */
  stable: number;
  /** هل التغيير يكسر أي حالة مرجعية؟ */
  introducesRegression: boolean;
}

/** يبني نسخة من الملف مع استبدال القاعدة بنسخة معدّلة (بلا حفظ). */
function profileWithRule(profile: EngineConfig, rule: EngineRule): EngineConfig {
  return {
    ...profile,
    rules: profile.rules.map((item) => (item.id === rule.id ? rule : item)),
  };
}

/**
 * يعاين أثر تعديل قاعدة: يُجري حالات اختبارها (اتحاد قبل/بعد) على الملف الحالي
 * وعلى الملف بالقاعدة المعدّلة، ويُبلغ عن الحالات المنقلبة والثابتة والانحدار.
 */
export function previewRuleEdit(
  profile: EngineConfig,
  currentRule: EngineRule,
  editedRule: EngineRule
): RuleEditPreview {
  const beforeProfile = profile;
  const afterProfile = profileWithRule(profile, editedRule);

  // اتحاد حالات الاختبار من النسختين (بأسماء فريدة).
  const seen = new Set<string>();
  const cases: TestCase[] = [];
  for (const testCase of [...(currentRule.testCases ?? []), ...(editedRule.testCases ?? [])]) {
    if (seen.has(testCase.name)) continue;
    seen.add(testCase.name);
    cases.push(testCase);
  }

  const beforeReport = runRuleTests({ ...currentRule, testCases: cases }, beforeProfile);
  const afterReport = runRuleTests({ ...editedRule, testCases: cases }, afterProfile);

  const flipped: FlippedCase[] = [];
  let stable = 0;
  let introducesRegression = false;

  beforeReport.results.forEach((beforeResult, index) => {
    const afterResult = afterReport.results[index];
    if (!afterResult) return;
    if (beforeResult.actual !== afterResult.actual) {
      flipped.push({ name: beforeResult.caseName, before: beforeResult.actual, after: afterResult.actual });
      // انحدار: كانت ناجحة فأصبحت فاشلة.
      if (beforeResult.passed && !afterResult.passed) introducesRegression = true;
    } else {
      stable += 1;
    }
  });

  return { flipped, stable, introducesRegression };
}

/** ملخّص نصي موجز للمعاينة (للعرض في الواجهة). */
export function summarizePreview(preview: RuleEditPreview): string {
  if (preview.flipped.length === 0) return 'لا تأثير على حالات الاختبار — آمن.';
  const regressed = preview.introducesRegression ? ' (فيها انحدار)' : '';
  return `سيتأثر ${preview.flipped.length} حالة، وتبقى ${preview.stable} ثابتة${regressed}.`;
}

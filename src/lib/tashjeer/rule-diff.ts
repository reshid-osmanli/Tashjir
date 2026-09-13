// فرق حقول القاعدة الحتمي — Rule Field Diff (FR-ES-07.3/.4/.6)
// مشروع التشجير - نظام القراءات العشر
//
// ثلاث طبقات تحتاج الفرق نفسه بين نسختين من قاعدة: سجل التدقيق
// (Before/After)، سلسلة الإصدارات (مقارنة إصدارين)، وحزمة التصدير الحتمية.
// فالفروق تُحسب هنا مرة واحدة بترتيب حقول ثابت ومفاتيح مرتبة، ليكون الفرق
// مطابقًا للفرق الذي يراه Git في ملف التصدير (DM-13) ولا يتكرر المنطق (P-07).
//
// الطبقة نقيّة بلا DOM ولا تخزين، فتُختبر بمعزل عن الواجهة.

import type { AuditChange, EngineRule, RuleSource } from '@/lib/tashjeer/model/v8';

/**
 * ترتيب الحقول في الفرق والعرض: ثابت وصريح (P-04) حتى لا يقفز سطر في سجل
 * التدقيق بين تشغيلين.
 */
export const RULE_FIELD_ORDER = [
  'id',
  'name',
  'description',
  'type',
  'category',
  'scope',
  'priority',
  'groupId',
  'specificity',
  'hardness',
  'status',
  'source',
  'protected',
  'version',
  'conditions',
  'actions',
  'dependsOn',
  'overrides',
  'conflictsWith',
  'testCases',
  'createdAt',
  'updatedAt',
] as const;

export type RuleField = (typeof RULE_FIELD_ORDER)[number];

/** تسميات عربية لحقول القاعدة (Metadata كاملة — FR-ES-07.4). */
export const RULE_FIELD_LABELS: Record<RuleField, string> = {
  id: 'المعرّف',
  name: 'الاسم',
  description: 'الوصف',
  type: 'النوع',
  category: 'الفئة',
  scope: 'النطاق',
  priority: 'الأولوية',
  groupId: 'مجموعة الأولوية',
  specificity: 'الخصوصية',
  hardness: 'الصلابة',
  status: 'الحالة',
  source: 'المصدر',
  protected: 'محمية',
  version: 'الإصدار',
  conditions: 'الشروط',
  actions: 'الإجراءات',
  dependsOn: 'تعتمد على',
  overrides: 'تتجاوز',
  conflictsWith: 'تتعارض مع',
  testCases: 'حالات الاختبار',
  createdAt: 'أُنشئت في',
  updatedAt: 'آخر تعديل',
};

/** حقول Metadata التي تُعرض في بطاقة القاعدة (FR-ES-07.4). */
export const RULE_METADATA_FIELDS: RuleField[] = [
  'id',
  'name',
  'description',
  'category',
  'scope',
  'priority',
  'specificity',
  'status',
  'source',
  'createdAt',
  'updatedAt',
  'version',
  'dependsOn',
  'overrides',
  'conflictsWith',
  'testCases',
];

/**
 * تسلسل حتمي لأي قيمة: مفاتيح الكائنات تُرتَّب أبجديًا، وقيم `undefined`
 * تُحذف من الكائنات (وتُكتب `null` داخل المصفوفات) حتى يبقى الناتج JSON
 * صالحًا يمكن فكّه لنسخة كنسية. المصفوفات تبقى بترتيبها (ترتيبها معنى في
 * الشروط والإجراءات)، فيعطي نفس المدخلات نفس النص بايتًا — وهو أساس
 * المقارنة والتصدير (DM-13).
 */
export function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * نسخة كنسية من قيمة: مفاتيح مرتبة أبجديًا وبلا `undefined`، صالحة للتصدير
 * ولأخذ لقطة إصدار لا تتغيّر.
 */
export function canonicalClone<T>(value: T): T {
  return JSON.parse(stableStringify(value)) as T;
}


/** هل القيمتان متساويتان حتميًا (بالمقارنة الكنسية لا بالمرجع)؟ */
export function sameValue(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * يعرض قيمة حقل نصًا مقروءًا في الواجهة وسجل التدقيق: المصفوفات تُعدّ
 * («٣ حالات اختبار» style يُترك للواجهة)، والكائنات تُعرض كنص كنسي مختصر.
 */
export function renderFieldValue(field: RuleField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (Array.isArray(value)) {
    if (field === 'testCases') {
      const names = value
        .map((item) => (item && typeof item === 'object' ? String((item as { name?: string }).name ?? '?') : '?'))
        .join('، ');
      return `${value.length} حالة${names ? `: ${names}` : ''}`;
    }
    if (value.length === 0) return '—';
    return value.map((item) => (typeof item === 'string' ? item : stableStringify(item))).join('، ');
  }
  if (typeof value === 'object') return stableStringify(value);
  return String(value);
}

/**
 * يحسب فرق الحقول بين نسختين من قاعدة. `before = null` يعني إنشاءً جديدا:
 * كل الحقول ذات القيمة تُعدّ «بعد» بلا «قبل». الترتيب ثابت (RULE_FIELD_ORDER).
 */
export function diffRuleFields(before: EngineRule | null, after: EngineRule): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of RULE_FIELD_ORDER) {
    const nextValue = (after as unknown as Record<string, unknown>)[field];
    const prevValue = before ? (before as unknown as Record<string, unknown>)[field] : undefined;
    if (before === null) {
      // إنشاء: نسجّل الحقول ذات القيمة فقط (لا أسطر «— ← —»).
      if (nextValue === undefined || nextValue === null || nextValue === '') continue;
      if (Array.isArray(nextValue) && nextValue.length === 0) continue;
      changes.push({ field, label: RULE_FIELD_LABELS[field], before: undefined, after: nextValue });
      continue;
    }
    if (sameValue(prevValue, nextValue)) continue;
    changes.push({ field, label: RULE_FIELD_LABELS[field], before: prevValue, after: nextValue });
  }
  return changes;
}

/** أسماء الحقول المتغيّرة فقط (لملخّص عربي مختصر). */
export function changedFieldLabels(changes: AuditChange[]): string[] {
  return changes.map((change) => change.label);
}

/**
 * ملخّص عربي للتغييرات يُحفظ في قيد التدقيق: «الاسم، الأولوية ٨٠ إلى ١٠٠».
 * الأرقام العربية تُترك للواجهة (السجل يُصدَّر بأرقام ثابتة قابلة للمقارنة).
 */
export function summarizeChanges(changes: AuditChange[]): string {
  if (changes.length === 0) return 'لا تغيير في الحقول';
  return changes
    .map((change) => {
      const before = renderFieldValue(change.field as RuleField, change.before);
      const after = renderFieldValue(change.field as RuleField, change.after);
      if (before === '—') return `${change.label}: ${after}`;
      if (after === '—') return `${change.label}: حُذف (${before})`;
      return `${change.label} ${before} ← ${after}`;
    })
    .join('؛ ');
}

/**
 * يستنتج مصدر قاعدة قديمة بلا حقل `source` (لا يُكسر ملف مُصدَّر سابق):
 * قواعد النظام معرّفاتها ببادئة `er-system`، والمرشّحة من تصحيح بـ `er-cand`.
 */
export function inferRuleSource(rule: EngineRule): RuleSource {
  if (rule.source) return rule.source;
  if (rule.id.startsWith('er-system')) return 'SYSTEM';
  if (rule.id.startsWith('er-cand')) return 'CANDIDATE';
  if (rule.createdAt === 'system' || rule.updatedAt === 'system') return 'SYSTEM';
  return 'EDITOR';
}

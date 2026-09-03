// مخزن إعداد المحرك — Engine Config Store (DM-14، FR-ES-14، DM-13)
//
// يحفظ «ملف المحرك» (EngineConfig) محليًا ويعرضه للاستوديو. كل ما هو قابل
// للتهيئة (الأولويات، الدمج، منع الدمج، السياق، الاستثناءات، حل التعارض،
// ترتيب التنفيذ) يُدار من هنا بمعرّفات صريحة — لا ثوابت مشتتة ولا if-statements
// مبثوثة (FR-EN-01، P-02).
//
// المبدأ الحاكم هنا: التصدير حتمي وصديق لـ Git (DM-13). ترتيب المفاتيح ثابت،
// والعناصر مرتبة بمفاتيح مستقرة (المعرّف)، ولا طوابع زمنية متقلّبة؛ فيعطي Git
// فرقًا دقيقًا (Rule A priority: 80 → 100) لا فرقًا فوضويًا بسبب ترتيب JSON.
//
// طبقة نقيّة قابلة للاختبار بمعزل عن المتصفح: دوال الحفظ/التحميل تفحص window
// وتعود إلى الافتراضي عند غيابها، تمامًا كالمخازن القائمة في lib/storage.

import type {
  EngineConfig,
  EngineRule,
  PriorityGroup,
  MergeMatrixEntry,
  ConflictPolicyStep,
  SpecificityLevel,
} from '@/lib/tashjeer/model/v8';
import { SPECIFICITY_RANK } from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';
import {
  DEFAULT_SYSTEM_PROFILE,
  createDefaultEngineConfig,
  DEFAULT_PRIORITY_GROUPS,
  DEFAULT_CONFLICT_POLICY,
  DEFAULT_EXECUTION_ORDER,
  DEFAULT_MERGE_MATRIX,
} from '@/lib/tashjeer/decision/policy';

export const ENGINE_CONFIG_STORAGE_KEY = 'tashjeer:engine-config:v1';
export const ENGINE_CONFIG_EVENT = 'tashjeer:engine-config-change';
export const ENGINE_CONFIG_SCHEMA_VERSION = 1 as const;

/** نتيجة فحص سلامة ملف المحرك. */
export interface EngineConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** يبني ملف المحرك الافتراضي (السياسات الحالية للنظام). */
export function defaultEngineConfig(): EngineConfig {
  return createDefaultEngineConfig('default');
}

// ==================== التسلسل الحتمي (Git-friendly) ====================

/**
 * قاعدة بصيغة كنسية قابلة للتصدير: مفاتيح بترتيب ثابت، بلا طوابع زمنية
 * متقلّبة، وبلا حقول اختيارية فارغة. هذا ما يُكتب في ملف Git (DM-13).
 */
export interface CanonicalEngineRule
  extends Omit<EngineRule, 'createdAt' | 'updatedAt' | 'dependsOn' | 'overrides' | 'conflictsWith' | 'testCases' | 'protected'> {
  protected?: boolean;
  dependsOn?: string[];
  overrides?: string[];
  conflictsWith?: string[];
  testCases?: Array<{ name: string; input: unknown; expected: string }>;
}

/** يحوّل قاعدة إلى صيغتها الكنسية للتصدير الحتمي. */
export function toCanonicalRule(rule: EngineRule): CanonicalEngineRule {
  const canonical: CanonicalEngineRule = {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    category: rule.category,
    scope: rule.scope,
    conditions: rule.conditions,
    actions: rule.actions,
    priority: rule.priority,
    groupId: rule.groupId,
    specificity: rule.specificity,
    hardness: rule.hardness,
    status: rule.status,
    version: rule.version,
  };
  if (rule.protected) canonical.protected = true;
  if (rule.dependsOn && rule.dependsOn.length > 0) canonical.dependsOn = [...rule.dependsOn].sort();
  if (rule.overrides && rule.overrides.length > 0) canonical.overrides = [...rule.overrides].sort();
  if (rule.conflictsWith && rule.conflictsWith.length > 0) canonical.conflictsWith = [...rule.conflictsWith].sort();
  if (rule.testCases && rule.testCases.length > 0) canonical.testCases = rule.testCases;
  return canonical;
}

/** يرتّب مجموعات الأولوية حسب رقم ترتيبها (مستقر). */
function sortPriorityGroups(groups: PriorityGroup[]): PriorityGroup[] {
  return [...groups].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** يرتّب مصفوفة الدمج بمفتاح مستقر (a ثم b) حتى لا يقفز سطر بلا سبب. */
function sortMergeMatrix(matrix: MergeMatrixEntry[]): MergeMatrixEntry[] {
  return [...matrix].sort((a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b));
}

/** يرتّب القواعد بمعرّفها المستقر، فيبقى كل سطر في مكانه عند تعديل قيمة. */
function sortRulesById(rules: EngineRule[]): EngineRule[] {
  return [...rules].sort((a, b) => a.id.localeCompare(b.id, 'ar'));
}

/**
 * يبني الكائن الكنسي الكامل للتصدير: ترتيب مفاتيح ثابت، عناصر مرتبة بمفاتيح
 * مستقرة، بلا طوابع زمنية متقلّبة. نفس المدخلات ← نفس الخرج بايتًا (DM-13).
 */
export function toCanonicalConfig(config: EngineConfig): {
  schemaVersion: typeof ENGINE_CONFIG_SCHEMA_VERSION;
  profile: string;
  priorityGroups: PriorityGroup[];
  rules: CanonicalEngineRule[];
  conflictPolicy: ConflictPolicyStep[];
  executionOrder: string[];
  mergeMatrix: MergeMatrixEntry[];
  contexts: EngineConfig['contexts'];
} {
  return {
    schemaVersion: ENGINE_CONFIG_SCHEMA_VERSION,
    profile: config.profile,
    priorityGroups: sortPriorityGroups(config.priorityGroups),
    rules: sortRulesById(config.rules).map(toCanonicalRule),
    conflictPolicy: [...config.conflictPolicy],
    executionOrder: [...config.executionOrder],
    mergeMatrix: sortMergeMatrix(config.mergeMatrix),
    contexts: config.contexts,
  };
}

/**
 * يُسلسل ملف المحرك نصًا حتميًا صديقًا لـ Git (DM-13).
 * تكرار التصدير لنفس المدخلات يعطي الخرج نفسه بايتًا، فيظهر Git فرقًا دقيقًا
 * عند تعديل قاعدة واحدة.
 */
export function serializeEngineConfig(config: EngineConfig): string {
  return JSON.stringify(toCanonicalConfig(config), null, 2) + '\n';
}

// ==================== الفحص والاستيراد ====================

const REQUIRED_RULE_FIELDS: Array<keyof EngineRule> = [
  'id',
  'name',
  'type',
  'category',
  'scope',
  'conditions',
  'actions',
  'priority',
  'groupId',
  'specificity',
  'hardness',
  'status',
];

const VALID_RULE_TYPES = ['DIFFERENCE', 'ORDERING', 'MERGE', 'RELATION', 'CONTEXT', 'EXCEPTION'];
const VALID_HARDNESS = ['HARD', 'SOFT'];
const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'DISABLED', 'DEPRECATED', 'CONFLICTED', 'EXPERIMENTAL'];
const VALID_SPECIFICITIES = Object.keys(SPECIFICITY_RANK);

/** يفحص سلامة ملف المحرك قبل الحفظ أو الاستيراد. */
export function validateEngineConfig(config: unknown): EngineConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['ملف المحرك ليس كائنًا صالحًا'], warnings };
  }
  const cfg = config as Partial<EngineConfig>;

  if (cfg.schemaVersion !== ENGINE_CONFIG_SCHEMA_VERSION) {
    errors.push(`إصدار المخطط غير متوافق: متوقع ${ENGINE_CONFIG_SCHEMA_VERSION}`);
  }
  if (typeof cfg.profile !== 'string' || cfg.profile.trim() === '') {
    errors.push('اسم الملف (profile) مفقود');
  }
  if (!Array.isArray(cfg.rules)) {
    errors.push('قائمة القواعد مفقودة');
  }
  if (!Array.isArray(cfg.priorityGroups)) {
    errors.push('مجموعات الأولوية مفقودة');
  }
  if (!Array.isArray(cfg.conflictPolicy)) {
    errors.push('سلم حل التعارض مفقود');
  }
  if (!Array.isArray(cfg.executionOrder)) {
    errors.push('ترتيب التنفيذ مفقود');
  }
  if (!Array.isArray(cfg.mergeMatrix)) {
    errors.push('مصفوفة الدمج مفقودة');
  }

  const knownGroups = new Set((cfg.priorityGroups ?? []).map((group) => group?.id));
  const ruleIds = new Set<string>();

  for (const raw of cfg.rules ?? []) {
    if (!raw || typeof raw !== 'object') {
      errors.push('قاعدة غير صالحة في القائمة');
      continue;
    }
    const rule = raw as Partial<EngineRule>;
    for (const field of REQUIRED_RULE_FIELDS) {
      if (rule[field] === undefined || rule[field] === null) {
        errors.push(`القاعدة «${rule.id ?? '?'}» تنقصها الحقل ${String(field)}`);
      }
    }
    if (typeof rule.id !== 'string' || rule.id.trim() === '') {
      errors.push('قاعدة بلا معرّف');
      continue;
    }
    if (ruleIds.has(rule.id)) {
      errors.push(`معرّف قاعدة مكرر: ${rule.id}`);
    }
    ruleIds.add(rule.id);
    if (rule.type && !VALID_RULE_TYPES.includes(rule.type)) {
      errors.push(`نوع قاعدة غير معروف: ${rule.type}`);
    }
    if (rule.hardness && !VALID_HARDNESS.includes(rule.hardness)) {
      errors.push(`صلابة غير معروفة: ${rule.hardness}`);
    }
    if (rule.status && !VALID_STATUSES.includes(rule.status)) {
      errors.push(`حالة غير معروفة: ${rule.status}`);
    }
    if (rule.specificity && !VALID_SPECIFICITIES.includes(rule.specificity)) {
      errors.push(`خصوصية غير معروفة: ${rule.specificity}`);
    }
    if (rule.groupId && knownGroups.size > 0 && !knownGroups.has(rule.groupId)) {
      warnings.push(`القاعدة «${rule.id}» تنتمي لمجموعة غير معرفة: ${rule.groupId}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** يطبّع قاعدة مستوردة ويعيد بناء الحقول الناقصة (طوابع زمنية، إلخ). */
function normalizeRule(rule: Partial<EngineRule>, now: string): EngineRule {
  return {
    id: rule.id ?? createEntityId('er'),
    name: rule.name ?? 'قاعدة بلا عنوان',
    type: (rule.type as EngineRule['type']) ?? 'MERGE',
    category: (rule.category as EngineRule['category']) ?? 'MERGE',
    scope: (rule.scope as EngineRule['scope']) ?? 'MUSHAF',
    conditions: rule.conditions ?? { all: [] },
    actions: Array.isArray(rule.actions) ? rule.actions : [],
    priority: typeof rule.priority === 'number' ? rule.priority : 50,
    groupId: rule.groupId ?? 'fallback',
    specificity: (rule.specificity as SpecificityLevel) ?? 'MUSHAF',
    hardness: (rule.hardness as RuleHardness) ?? 'SOFT',
    status: (rule.status as RuleStatus) ?? 'DRAFT',
    version: typeof rule.version === 'number' ? rule.version : 1,
    protected: rule.protected ?? false,
    dependsOn: rule.dependsOn,
    overrides: rule.overrides,
    conflictsWith: rule.conflictsWith,
    testCases: rule.testCases,
    createdAt: rule.createdAt ?? now,
    updatedAt: rule.updatedAt ?? now,
  };
}

type RuleHardness = EngineRule['hardness'];
type RuleStatus = EngineRule['status'];

/** يطبّع ملف محرك كامل من مدخلات جزئية ويملأ الناقص. */
export function normalizeEngineConfig(value: Partial<EngineConfig> | null | undefined): EngineConfig {
  const now = new Date().toISOString();
  const base = createDefaultEngineConfig(value?.profile ?? 'default');
  if (!value || typeof value !== 'object') return base;

  return {
    schemaVersion: ENGINE_CONFIG_SCHEMA_VERSION,
    profile: typeof value.profile === 'string' && value.profile.trim() ? value.profile : base.profile,
    priorityGroups:
      Array.isArray(value.priorityGroups) && value.priorityGroups.length > 0
        ? sortPriorityGroups(value.priorityGroups as PriorityGroup[])
        : base.priorityGroups,
    rules: Array.isArray(value.rules)
      ? (value.rules as Partial<EngineRule>[]).map((rule) => normalizeRule(rule, now))
      : base.rules,
    conflictPolicy:
      Array.isArray(value.conflictPolicy) && value.conflictPolicy.length > 0
        ? (value.conflictPolicy as ConflictPolicyStep[])
        : base.conflictPolicy,
    executionOrder:
      Array.isArray(value.executionOrder) && value.executionOrder.length > 0
        ? value.executionOrder
        : base.executionOrder,
    mergeMatrix: Array.isArray(value.mergeMatrix)
      ? sortMergeMatrix(value.mergeMatrix as MergeMatrixEntry[])
      : base.mergeMatrix,
    contexts: value.contexts ?? base.contexts,
  };
}

/** نتيجة استيراد ملف محرك. */
export interface EngineConfigImportResult {
  config: EngineConfig;
  validation: EngineConfigValidation;
}

/**
 * يستورد ملف محرك من نص: يُحلّل، يفحص الإصدار والسلامة، يكشف التعارض
 * (المعرّفات المكررة)، ويُطبّع. لا يُكتب في التخزين: المستدعي يقرر الحفظ
 * بعد معاينة النتيجة (FR-ES-14.2: Preview قبل التطبيق).
 */
export function importEngineConfigText(text: string): EngineConfigImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      config: defaultEngineConfig(),
      validation: { valid: false, errors: ['النص ليس JSON صالحًا'], warnings: [] },
    };
  }
  const validation = validateEngineConfig(parsed);
  const config = normalizeEngineConfig(parsed as Partial<EngineConfig>);
  return { config, validation };
}

// ==================== الحفظ والتحميل (المتصفح) ====================

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** يحمّل ملف المحرك المحفوظ، أو الافتراضي عند الغياب/الفساد. */
export function loadEngineConfig(): EngineConfig {
  if (!isBrowser()) return defaultEngineConfig();
  try {
    const raw = window.localStorage.getItem(ENGINE_CONFIG_STORAGE_KEY);
    if (!raw) return defaultEngineConfig();
    const config = normalizeEngineConfig(JSON.parse(raw) as Partial<EngineConfig>);
    return config;
  } catch {
    return defaultEngineConfig();
  }
}

/** يحفظ ملف المحرك بعد الفحص، ويعيد النسخة المطابّعة. يُطلق حدث التغيير. */
export function saveEngineConfig(config: EngineConfig): { config: EngineConfig; validation: EngineConfigValidation } {
  const normalized = normalizeEngineConfig(config);
  const validation = validateEngineConfig(normalized);
  if (isBrowser()) {
    window.localStorage.setItem(ENGINE_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    // نحرس الاستدعاء: بعض بيئات الاختبار توفّر window.localStorage بلا DOM
    // كامل، فلا تتوفر dispatchEvent. الحدث لتوحيد الواجهات لا للصحة.
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(ENGINE_CONFIG_EVENT, { detail: normalized }));
    }
  }
  return { config: normalized, validation };
}

/** يعيد ملف المحرك إلى سياسات النظام الافتراضية. */
export function resetEngineConfig(): EngineConfig {
  return saveEngineConfig(defaultEngineConfig()).config;
}

// ==================== عمليات القواعد (نقيّة) ====================

/** يضيف قاعدة جديدة إلى ملف المحرك ويعيد النسخة الجديدة (بلا حفظ). */
export function addEngineRule(
  config: EngineConfig,
  rule: Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'> & Partial<Pick<EngineRule, 'version'>>
): EngineConfig {
  const now = new Date().toISOString();
  const full: EngineRule = {
    ...rule,
    id: rule.id ?? createEntityId('er'),
    version: rule.version ?? 1,
    createdAt: now,
    updatedAt: now,
  };
  return { ...config, rules: [...config.rules, full] };
}

/** يعدّل قاعدة بمعرّفها ويعيد النسخة الجديدة (بلا حفظ). */
export function updateEngineRule(config: EngineConfig, ruleId: string, patch: Partial<EngineRule>): EngineConfig {
  return {
    ...config,
    rules: config.rules.map((rule) =>
      rule.id === ruleId
        ? { ...rule, ...patch, updatedAt: new Date().toISOString(), version: rule.version + 1 }
        : rule
    ),
  };
}

/** يحذف قاعدة بمعرّفها ويعيد النسخة الجديدة (بلا حفظ). */
export function removeEngineRule(config: EngineConfig, ruleId: string): EngineConfig {
  return { ...config, rules: config.rules.filter((rule) => rule.id !== ruleId) };
}

/** يثبّت أولوية قاعدة صراحةً (FR-ES-01). */
export function setRulePriority(config: EngineConfig, ruleId: string, priority: number): EngineConfig {
  return updateEngineRule(config, ruleId, { priority: Math.round(priority) });
}

/** يغيّر حالة قاعدة (FR-ES-07). */
export function setRuleStatus(
  config: EngineConfig,
  ruleId: string,
  status: EngineRule['status']
): EngineConfig {
  return updateEngineRule(config, ruleId, { status });
}

// ==================== عمليات مصفوفة الدمج (نقيّة) ====================

/** يضيف صفًا إلى مصفوفة الدمج (FR-ES-05). */
export function addMergeMatrixEntry(config: EngineConfig, entry: MergeMatrixEntry): EngineConfig {
  return { ...config, mergeMatrix: [...config.mergeMatrix, entry] };
}

/** يعدّل صفًا في مصفوفة الدمج بمطابقة (a,b). */
export function updateMergeMatrixEntry(
  config: EngineConfig,
  index: number,
  patch: Partial<MergeMatrixEntry>
): EngineConfig {
  return {
    ...config,
    mergeMatrix: config.mergeMatrix.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)),
  };
}

/** يحذف صفًا من مصفوفة الدمج. */
export function removeMergeMatrixEntry(config: EngineConfig, index: number): EngineConfig {
  return { ...config, mergeMatrix: config.mergeMatrix.filter((_, idx) => idx !== index) };
}

// ==================== عمليات السياسة (نقيّة) ====================

/** يضبط سلم حل التعارض (FR-ES-06). */
export function setConflictPolicy(config: EngineConfig, policy: ConflictPolicyStep[]): EngineConfig {
  return { ...config, conflictPolicy: [...policy] };
}

/** يضبط ترتيب التنفيذ (FR-ES-04). */
export function setExecutionOrder(config: EngineConfig, order: string[]): EngineConfig {
  return { ...config, executionOrder: [...order] };
}

/** يضيف/يعدّل مجموعة أولوية. */
export function upsertPriorityGroup(config: EngineConfig, group: PriorityGroup): EngineConfig {
  const exists = config.priorityGroups.some((item) => item.id === group.id);
  const priorityGroups = exists
    ? config.priorityGroups.map((item) => (item.id === group.id ? group : item))
    : [...config.priorityGroups, group];
  return { ...config, priorityGroups: sortPriorityGroups(priorityGroups) };
}

// إعادة تصدير السياسات الافتراضية للواجهة (نقطة استيراد واحدة).
export {
  DEFAULT_SYSTEM_PROFILE,
  DEFAULT_PRIORITY_GROUPS,
  DEFAULT_CONFLICT_POLICY,
  DEFAULT_EXECUTION_ORDER,
  DEFAULT_MERGE_MATRIX,
  createDefaultEngineConfig,
};

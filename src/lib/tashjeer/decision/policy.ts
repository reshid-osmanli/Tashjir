// طبقة السياسة والمحركات — Policy Layer & Engine Config
//
// كل قرار قابل للتهيئة (أولوية، دمج، منع دمج، فصل، سياق، استثناء) ينتقل إلى
// نموذج Configuration موحّد يُدار رسوميا في Engine Studio (FR-EN-01). المحرك
// الكودي يبقى في lib/tashjeer/* والسياسات هنا فقط (P-08، P-02، P-07).
//
// PH0: تُبنى طبقة السياسة فارغة افتراضيا بسياسات النظام الحالية (§10). لا يوزَّع
// أي قرار بين ثوابت أو if-statements أو JSON متفرق (FR-EN-01).

import type {
  EngineConfig,
  EngineRule,
  PriorityGroup,
  MergeMatrixEntry,
  ConflictPolicyStep,
  SpecificityLevel,
} from '@/lib/tashjeer/model/v8';
import { normalizeEngineRule } from '@/lib/tashjeer/model/v8';

/** مجموعات الأولوية الافتراضية (FR-ES-01، ملحق ب). */
export const DEFAULT_PRIORITY_GROUPS: PriorityGroup[] = [
  { id: 'structural', label: 'قواعد بنائية', order: 10 },
  { id: 'blocking', label: 'قواعد منع', order: 20 },
  { id: 'exceptions', label: 'استثناءات صريحة', order: 30 },
  { id: 'reader', label: 'قواعد القراء', order: 40 },
  { id: 'narrator', label: 'قواعد الرواة', order: 50 },
  { id: 'path', label: 'قواعد الطرق', order: 60 },
  { id: 'difference', label: 'قواعد الاختلافات', order: 70 },
  { id: 'merge', label: 'قواعد الدمج', order: 80 },
  { id: 'fallback', label: 'قواعد احتياطية', order: 90 },
];

/** سلم حل التعارض الافتراضي (FR-ES-06). */
export const DEFAULT_CONFLICT_POLICY: ConflictPolicyStep[] = [
  'MOST_SPECIFIC',
  'HIGHEST_PRIORITY',
  'EXPLICIT',
  'LOCAL',
  'MANUAL',
];

/** ترتيب التنفيذ الافتراضي (FR-ES-04، ملحق ب). */
export const DEFAULT_EXECUTION_ORDER: string[] = [
  'NORMALIZE',
  'CONTEXT',
  'BLOCKING',
  'EXCEPTIONS',
  'STRUCTURAL',
  'READER',
  'DIFFERENCE',
  'MERGE',
  'ORDERING',
  'FALLBACK',
];

/** مصفوفة الدمج الافتراضية (FR-ES-05، ملحق ب). */
export const DEFAULT_MERGE_MATRIX: MergeMatrixEntry[] = [
  { a: 'MADD', b: 'TAHQIQ', merge: true, priority: 80, reason: 'مرتبطان' },
  { a: 'MADD', b: 'WASL', merge: true, priority: 70, reason: 'مرتبطان' },
  { a: 'FARSH', b: 'MADD', merge: false, priority: 100, reason: 'مستقلان' },
  { a: 'FARSH', b: 'TAHQIQ', merge: false, priority: 100, reason: 'مستقلان' },
  { a: 'MADD', b: 'MADD', merge: false, priority: 90, reason: 'متنافيان (مد ٢ ومد ٤)' },
];

/**
 * قواعد النظام الافتراضية: تعبّر عن السلوك الحالي للمحرك بصيغة EngineRule
 * موحّدة (لا ثوابت مشتتة). كلها قابلة للتعديل من Engine Studio لاحقا.
 */
export const DEFAULT_SYSTEM_RULES: EngineRule[] = [
  {
    id: 'er-system-merge-farsh-madd',
    name: 'لا تدمج الفرش مع المد',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: {
      all: [
        { field: 'differenceType', op: 'equals', value: 'FARSH' },
        { field: 'sameReader', op: 'equals', value: true },
      ],
    },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 100,
    groupId: 'merge',
    specificity: 'MUSHFAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    createdAt: 'system',
    updatedAt: 'system',
  },
  {
    id: 'er-system-merge-madd-tahqiq',
    name: 'ادمج المد مع التحقيق',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: {
      all: [
        { field: 'differenceType', op: 'equals', value: 'MADD' },
        { field: 'relatedType', op: 'equals', value: 'TAHQIQ' },
      ],
    },
    actions: [{ type: 'MERGE' }],
    priority: 80,
    groupId: 'merge',
    specificity: 'MUSHFAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    createdAt: 'system',
    updatedAt: 'system',
  },
  {
    id: 'er-system-merge-mutually-exclusive-madd',
    name: 'المدود المتعددة متنافية',
    type: 'MERGE',
    category: 'MERGE',
    scope: 'MUSHAF',
    conditions: {
      all: [
        { field: 'differenceType', op: 'equals', value: 'MADD' },
        { field: 'otherType', op: 'equals', value: 'MADD' },
      ],
    },
    actions: [{ type: 'PREVENT_MERGE' }],
    priority: 90,
    groupId: 'merge',
    specificity: 'MUSHFAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    createdAt: 'system',
    updatedAt: 'system',
  },
];

/** ملف المحرك الافتراضي (السياسات الحالية، قابل للاعتماد والتصدير). */
export const DEFAULT_SYSTEM_PROFILE: EngineConfig = {
  schemaVersion: 1,
  profile: 'default',
  priorityGroups: DEFAULT_PRIORITY_GROUPS,
  rules: DEFAULT_SYSTEM_RULES,
  conflictPolicy: DEFAULT_CONFLICT_POLICY,
  executionOrder: DEFAULT_EXECUTION_ORDER,
  mergeMatrix: DEFAULT_MERGE_MATRIX,
  contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
};

/** يبني ملف محرك فارغا بسياسات النظام (نقطة انطلاق Engine Studio). */
export function createDefaultEngineConfig(profile = 'default'): EngineConfig {
  return {
    ...DEFAULT_SYSTEM_PROFILE,
    profile,
    rules: DEFAULT_SYSTEM_RULES.map((rule) => ({ ...rule })),
    mergeMatrix: DEFAULT_MERGE_MATRIX.map((entry) => ({ ...entry })),
    priorityGroups: DEFAULT_PRIORITY_GROUPS.map((group) => ({ ...group })),
    contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
  };
}

/** يبني سياق قرار من حقول مسطّحة (FR-ES-03): القارئ، الفئة، السياق... */
export interface DecisionContext {
  [key: string]: unknown;
  differenceType?: string;
  relatedType?: string;
  otherType?: string;
  readerId?: string;
  narratorId?: string;
  pathId?: string;
  sameReader?: boolean;
  context?: 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY';
  position?: string;
  scope?: string;
  specificityLevel?: SpecificityLevel;
}

/** يبني سياق قرار من حقول مسطّحة. */
export function makeContext(fields: DecisionContext): DecisionContext {
  return fields;
}

/**
 * يطبع ملف المحرك قبل التصدير/الاستيراد. ترتيب القواعد في JSON ليس قرارا
 * تنفيذيا؛ Resolver يقرأ الأولوية والخصوصية صراحة. لذلك نرتبه بالمعرّف
 * الثابت لتبقى فروق Git دقيقة، مع حفظ ترتيب التنفيذ بوصفه سياسة دلالية.
 */
export function canonicalizeEngineConfig(config: EngineConfig): EngineConfig {
  return {
    schemaVersion: 1,
    profile: config.profile || 'default',
    priorityGroups: [...(config.priorityGroups ?? [])]
      .map((group) => ({ ...group }))
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    rules: [...(config.rules ?? [])]
      .map((rule) => ({ ...normalizeEngineRule(rule), conditions: structuredClone(rule.conditions), actions: structuredClone(rule.actions) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    conflictPolicy: [...(config.conflictPolicy ?? [])],
    executionOrder: [...(config.executionOrder ?? [])],
    mergeMatrix: [...(config.mergeMatrix ?? [])]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b) || b.priority - a.priority || a.reason.localeCompare(b.reason, 'ar')),
    contexts: {
      waqf: [...(config.contexts?.waqf ?? [])].sort(),
      wasl: [...(config.contexts?.wasl ?? [])].sort(),
      ibtida: [...(config.contexts?.ibtida ?? [])].sort(),
      forbiddenConnection: [...(config.contexts?.forbiddenConnection ?? [])].sort(),
    },
  };
}

export interface EngineConfigValidation {
  valid: boolean;
  errors: string[];
}

/** تحقق بنيوي محافظ قبل قبول ملف إعداد من المستخدم (FR-ES-14). */
export function validateEngineConfig(value: unknown): EngineConfigValidation {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return { valid: false, errors: ['الإعداد ليس كائنا JSON.'] };
  const config = value as Partial<EngineConfig>;
  if (config.schemaVersion !== 1) errors.push('إصدار مخطط إعداد المحرك غير مدعوم.');
  if (typeof config.profile !== 'string' || !config.profile.trim()) errors.push('اسم البروفايل مفقود.');
  if (!Array.isArray(config.priorityGroups)) errors.push('priorityGroups يجب أن تكون قائمة.');
  if (!Array.isArray(config.rules)) errors.push('rules يجب أن تكون قائمة.');
  if (!Array.isArray(config.mergeMatrix)) errors.push('mergeMatrix يجب أن تكون قائمة.');
  if (!Array.isArray(config.conflictPolicy)) errors.push('conflictPolicy يجب أن تكون قائمة.');
  if (!Array.isArray(config.executionOrder)) errors.push('executionOrder يجب أن تكون قائمة.');
  if (!config.contexts || typeof config.contexts !== 'object') errors.push('contexts مفقود.');

  if (Array.isArray(config.rules)) {
    const ids = new Set<string>();
    for (const [index, rule] of config.rules.entries()) {
      if (!rule || typeof rule.id !== 'string' || !rule.id.trim()) errors.push(`القاعدة ${index + 1} بلا id صالح.`);
      else if (ids.has(rule.id)) errors.push(`معرّف قاعدة مكرر: ${rule.id}.`);
      else ids.add(rule.id);
      if (!rule || typeof rule.name !== 'string') errors.push(`القاعدة ${index + 1} بلا اسم.`);
      if (!rule || !Number.isFinite(rule.priority)) errors.push(`أولوية القاعدة ${index + 1} غير صالحة.`);
      if (!rule || !rule.conditions || !Array.isArray(rule.actions)) errors.push(`بنية القاعدة ${index + 1} ناقصة.`);
    }
  }
  if (Array.isArray(config.mergeMatrix)) {
    for (const [index, entry] of config.mergeMatrix.entries()) {
      if (!entry || typeof entry.a !== 'string' || typeof entry.b !== 'string' || typeof entry.merge !== 'boolean' || !Number.isFinite(entry.priority)) {
        errors.push(`صف الدمج ${index + 1} غير صالح.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

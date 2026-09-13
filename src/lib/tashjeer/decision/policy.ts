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
 *
 * لكل قاعدة **Metadata كاملة** (وصف ومصدر — FR-ES-07.4) و**حالات اختبار**
 * مرجعية (FR-ES-08) تُشغَّل عند تعديلها وفي `npm test`؛ والقاعدتان الصلبتان
 * اللتان تحملان أصلًا من أصول الرواية موسومتان **محمية**: لا تُعدَّلان ولا
 * تُحذفان إلا بتأكيد إضافي صريح وسبب مكتوب.
 */
export const DEFAULT_SYSTEM_RULES: EngineRule[] = [
  {
    id: 'er-system-merge-farsh-madd',
    name: 'لا تدمج الفرش مع المد',
    description:
      'اختلاف الفرش (اللفظي) مستقل عن أحكام المد: لا يُدمجان في سطر واحد ولا يُضربان وجهًا، لأن كلًّا منهما بُعد قائم بذاته في الرواية.',
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
    specificity: 'MUSHAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    protected: true,
    source: 'SYSTEM',
    testCases: [
      {
        name: 'فرش + مد لنفس القارئ ← فصل',
        input: { differenceType: 'FARSH', relatedType: 'MADD', sameReader: true },
        expected: 'SEPARATE',
      },
      {
        name: 'مد + تحقيق ← دمج (لا تمنعه هذه القاعدة)',
        input: { differenceType: 'MADD', relatedType: 'TAHQIQ' },
        expected: 'MERGE',
      },
    ],
    createdAt: 'system',
    updatedAt: 'system',
  },
  {
    id: 'er-system-merge-madd-tahqiq',
    name: 'ادمج المد مع التحقيق',
    description:
      'حكم المد وحكم التحقيق في الموضع نفسه مرتبطان: يُدمجان في سطر واحد ما لم تتعارض قاعدة أعلى أولوية.',
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
    specificity: 'MUSHAF',
    hardness: 'SOFT',
    status: 'ACTIVE',
    version: 1,
    source: 'SYSTEM',
    testCases: [
      {
        name: 'مد + تحقيق ← دمج',
        input: { differenceType: 'MADD', relatedType: 'TAHQIQ' },
        expected: 'MERGE',
      },
      {
        name: 'فرش + مد ← فصل (خارج نطاق هذه القاعدة)',
        input: { differenceType: 'FARSH', relatedType: 'MADD', sameReader: true },
        expected: 'SEPARATE',
      },
    ],
    createdAt: 'system',
    updatedAt: 'system',
  },
  {
    id: 'er-system-merge-mutually-exclusive-madd',
    name: 'المدود المتعددة متنافية',
    description:
      'مدّان في الموضع نفسه وجهان متنافيان (مد ٢ ومد ٤ مثلًا): لا يُضربان ولا يُدمجان، بل يختار القارئ أحدهما.',
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
    specificity: 'MUSHAF',
    hardness: 'HARD',
    status: 'ACTIVE',
    version: 1,
    protected: true,
    source: 'SYSTEM',
    testCases: [
      {
        name: 'مد + مد ← فصل (تنافٍ)',
        input: { differenceType: 'MADD', otherType: 'MADD' },
        expected: 'SEPARATE',
      },
    ],
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

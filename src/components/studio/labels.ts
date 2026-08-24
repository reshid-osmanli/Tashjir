// تسميات استوديو المحرك — Engine Studio Labels
// مشروع التشجير - نظام القراءات العشر
//
// خرائط تسميات عربية للأنواع المعدودة في النموذج، حتى تُعرض الواجهة بالعربية
// بالكامل (NFR-07) دون أن يتكرر تعريف التسمية في كل مكوّن.

import type {
  EngineRule,
  EngineRuleCategory,
  EngineRuleScope,
  RuleActionType,
  RuleHardness,
  RuleStatus,
  ConflictPolicyStep,
} from '@/lib/tashjeer/model/v8';

export const RULE_TYPE_LABELS: Record<EngineRule['type'], string> = {
  DIFFERENCE: 'اختلاف',
  ORDERING: 'ترتيب',
  MERGE: 'دمج',
  RELATION: 'علاقة',
  CONTEXT: 'سياق',
  EXCEPTION: 'استثناء',
};

export const CATEGORY_LABELS: Record<EngineRuleCategory, string> = {
  DETECTION: 'كشف',
  DIFFERENCE: 'اختلاف',
  VARIANT: 'وجه',
  MERGE: 'دمج',
  SPLIT: 'فصل',
  ORDERING: 'ترتيب',
  RELATION: 'علاقة',
  CONTEXT: 'سياق',
  WAQF: 'وقف',
  WASL: 'وصل',
  IBTIDA: 'ابتداء',
  EXCEPTION: 'استثناء',
  OVERRIDE: 'تجاوز',
  VALIDATION: 'تحقق',
};

export const SCOPE_LABELS: Record<EngineRuleScope, string> = {
  CHARACTER: 'حرف',
  WORD: 'كلمة',
  RANGE: 'مدى',
  AYAH: 'آية',
  SURAH: 'سورة',
  MUSHAF: 'المصحف',
};

export const HARDNESS_LABELS: Record<RuleHardness, string> = {
  HARD: 'صلبة',
  SOFT: 'مرنة',
};

export const STATUS_LABELS: Record<RuleStatus, string> = {
  DRAFT: 'مسودة',
  ACTIVE: 'مفعّلة',
  DISABLED: 'معطّلة',
  DEPRECATED: 'متقادمة',
  CONFLICTED: 'متعرضة',
  EXPERIMENTAL: 'تجريبية',
};

export const ACTION_LABELS: Record<RuleActionType, string> = {
  CREATE_DIFFERENCE: 'إنشاء اختلاف',
  CREATE_VARIANT: 'إنشاء وجه',
  APPLY_RULE: 'تطبيق قاعدة',
  MERGE: 'دمج',
  PREVENT_MERGE: 'منع الدمج',
  SPLIT: 'فصل',
  CHANGE_ORDER: 'تغيير الترتيب',
  SET_RANK: 'تثبيت الرتبة',
  CREATE_RELATION: 'إنشاء علاقة',
  REMOVE_RELATION: 'إزالة علاقة',
  OVERRIDE_RESULT: 'تجاوز النتيجة',
  BLOCK_RESULT: 'حجب النتيجة',
  ASSIGN_CONTEXT: 'إسناد السياق',
  GENERATE_CORRECTION: 'توليد تصحيح',
};

export const CONFLICT_POLICY_LABELS: Record<ConflictPolicyStep, string> = {
  MOST_SPECIFIC: 'القاعدة الأخص',
  HIGHEST_PRIORITY: 'الأولوية الأعلى',
  EXPLICIT: 'القاعدة الصريحة',
  LOCAL: 'القاعدة المحلية',
  READER: 'قاعدة القارئ',
  MANUAL: 'قرار يدوي',
};

/** وصف موجز للمرحلة في خط أنابيب القرار (FR-ES-04). */
export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  NORMALIZE: 'تطبيع',
  CONTEXT: 'السياق (وقف/وصل)',
  BLOCKING: 'قواعد المنع',
  EXCEPTIONS: 'الاستثناءات',
  STRUCTURAL: 'القواعد البنائية',
  READER: 'قواعد القراء',
  NARRATOR: 'قواعد الرواة',
  PATH: 'قواعد الطرق',
  DIFFERENCE: 'قواعد الاختلافات',
  MERGE: 'قواعد الدمج',
  ORDERING: 'الترتيب',
  FALLBACK: 'القواعد الاحتياطية',
};

/** أصناف الأحكام الشائعة للاختيار في مصفوفة الدمج وساحة الاختبار. */
export const DIFFERENCE_TYPES = ['MADD', 'TAHQIQ', 'WASL', 'FARSH', 'HAMZ', 'TAJWEED'];

export const DIFFERENCE_TYPE_LABELS: Record<string, string> = {
  MADD: 'مد',
  TAHQIQ: 'تحقيق',
  WASL: 'صلة',
  FARSH: 'فرش',
  HAMZ: 'همز',
  TAJWEED: 'تجويد',
  FORBIDDEN_WASL: 'ممنوع الوصل',
};

/** معاملات المقارنة في منشئ الشروط (FR-ES-03). */
export const CONDITION_OPS = [
  'equals',
  'not-equals',
  'in',
  'not-in',
  'matches-pattern',
  'exists',
] as const;

export const CONDITION_OP_LABELS: Record<string, string> = {
  equals: 'يساوي',
  'not-equals': 'لا يساوي',
  in: 'ضمن',
  'not-in': 'ليس ضمن',
  'matches-pattern': 'يطابق نمطًا',
  exists: 'موجود',
};

/** الحقول المتاحة في منشئ الشروط (FR-ES-03). */
export const CONDITION_FIELDS = [
  'differenceType',
  'relatedType',
  'otherType',
  'readerId',
  'narratorId',
  'pathId',
  'sameReader',
  'context',
  'position',
] as const;

export const CONDITION_FIELD_LABELS: Record<string, string> = {
  differenceType: 'نوع الاختلاف',
  relatedType: 'النوع المرتبط',
  otherType: 'النوع الآخر',
  readerId: 'القارئ',
  narratorId: 'الراوي',
  pathId: 'الطريق',
  sameReader: 'نفس القارئ',
  context: 'السياق',
  position: 'الموضع',
};

/** ألوان حالة القاعدة لشارة الحالة. */
export const STATUS_BADGE_CLASSES: Record<RuleStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  DISABLED: 'bg-gray-100 text-gray-600',
  DEPRECATED: 'bg-gray-200 text-gray-500 line-through',
  CONFLICTED: 'bg-red-100 text-red-800',
  EXPERIMENTAL: 'bg-purple-100 text-purple-800',
};

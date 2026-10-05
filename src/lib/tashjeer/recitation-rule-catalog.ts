// طبقة كتالوج القواعد القرائية — Recitation Rule Catalog
// مشروع التشجير - نظام القراءات العشر
//
// هذه الطبقة هي المعرفة القابلة للتكوين Configuration/Domain Knowledge
// التي تفصل بين تعريف القاعدة وخيارها وتطبيقها (Spec §§3-8).
//
// المستويات الثلاثة:
//   Family  → المجموعة العليا (المدود، الفرش، الأصول...)
//   Type    → النوع داخل المجموعة (المد المتصل، المنفصل...)
//   Option  → الوجه/القيمة داخل النوع (4 حركات، 5 حركات...)
//   Occurrence → تطبيق القاعدة في موضع آية (Difference/Variant)
//
// لا تعتمد على الاسم العربي في أي قرار خوارزمي — القرار مبني على معرفات
// دلالية مستقرة مثل familyId = madd, ruleTypeId = madd_muttasil, optionId = madd_muttasil_4

import type { VariantCategory } from '@/types';
import type { RuleStatus } from '@/lib/tashjeer/model/v8';
import type { VariantEvidence } from '@/types/tashjeer';

// ==================== الأنواع الأساسية ====================

// دورة حياة القاعدة القرائية: DRAFT→TEST→PREVIEW→APPROVED→ACTIVE (Spec §14)
// نحتفظ بتوافق مع RuleStatus القديم بإضافة حالات جديدة
export type RecitationRuleStatus =
  | RuleStatus
  | 'TEST'
  | 'PREVIEW'
  | 'APPROVED';

export type EditorMode = 'MANUAL_TEXT' | 'RULE_DRIVEN' | 'HYBRID';
export type DetectionMode = 'MANUAL' | 'PATTERN' | 'STRUCTURAL' | 'HYBRID';
export type OptionMode = 'SINGLE' | 'MULTIPLE';

export type EvidenceSource = 'TAYYIBAH' | 'NASHR' | 'JANNAH' | 'OTHER';

export interface RuleCatalogEvidence {
  id: string;
  source: EvidenceSource;
  text: string;
  reference?: string;
  url?: string;
}

// ==================== تعريف المجموعة العليا ====================

export interface RecitationRuleFamily {
  id: string; // e.g., "madd"
  code: string; // e.g., "MADD" — معرف دلالي مستقر
  name: string; // الاسم العربي للعرض فقط
  description?: string;
  order: number;
  status: RecitationRuleStatus;
  editorMode: EditorMode;
  renderCategory: VariantCategory;
}

// ==================== تعريف النوع داخل المجموعة ====================

export interface RecitationRuleType {
  id: string; // e.g., "madd_muttasil"
  familyId: string; // "madd"
  code: string; // "MUTTASIL"
  name: string; // "المد المتصل"
  description?: string;
  detectionMode: DetectionMode;
  optionMode: OptionMode;
  defaultRelationPolicy?: string;
  defaultPriority?: number;
  status: RecitationRuleStatus;
  order: number;
  // مخطط واجهة المحرر الديناميكي — بسيط قابل للتوسع
  fields?: Array<{
    id: string;
    component: 'select' | 'number' | 'text';
    required: boolean;
    label?: string;
  }>;
}

// ==================== تعريف الخيار/الوجه داخل النوع ====================

export interface RecitationRuleOption {
  id: string; // e.g., "madd_muttasil_4"
  ruleTypeId: string; // "madd_muttasil"
  label: string; // "4 حركات" — للعرض
  numericValue: number; // 4
  unit: 'HARAKAT' | string; // HARAKAT
  order: number;
  status: RecitationRuleStatus;
  description?: string;
  evidences?: RuleCatalogEvidence[];
}

// ==================== تعريف Detection (قابل للتوسع) ====================

export type MatchPredicateKind =
  | 'MADD_LETTER'
  | 'HAMZA'
  | 'SAKIN'
  | 'SHADDA'
  | 'EXACT_LETTER';

export interface MatchConstraint {
  kind: MatchPredicateKind;
  baseLetter?: string;
  position?: 'START' | 'END' | 'INDEX' | 'END_OF_WORD';
  value?: number;
}

export interface SequenceDetection {
  type: 'SEQUENCE';
  constraints: Array<
    MatchConstraint & {
      relation?: 'FOLLOWED_BY' | 'FOLLOWED_BY_WORD' | 'PRECEDED_BY';
      target?: string;
      scope?: 'SAME_WORD' | 'NEXT_WORD' | 'PREV_WORD';
    }
  >;
}

export type RuleDetectionDefinition = SequenceDetection | { type: 'MANUAL' } | { type: 'PATTERN'; patternRef: string };

export interface RecitationRuleDetection {
  id: string;
  ruleTypeId: string;
  mode: DetectionMode;
  definition: RuleDetectionDefinition;
  description?: string;
}

// ==================== الكتالوج الكامل ====================

export interface RecitationRuleCatalog {
  schemaVersion: 1;
  families: RecitationRuleFamily[];
  types: RecitationRuleType[];
  options: RecitationRuleOption[];
  detections?: RecitationRuleDetection[];
  updatedAt: string;
}

// ==================== الثوابت والافتراضيات ====================

export const RECITATION_CATALOG_KEY = 'tashjeer:recitation-rule-catalog:v1';
export const RECITATION_CATALOG_EVENT = 'tashjeer:recitation-catalog-change';

function nowIso(): string {
  return new Date().toISOString();
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_FAMILIES: RecitationRuleFamily[] = [
  {
    id: 'madd',
    code: 'MADD',
    name: 'المدود',
    description: 'أحكام المدود بأنواعها ومقاديرها',
    order: 1,
    status: 'ACTIVE',
    editorMode: 'RULE_DRIVEN',
    renderCategory: 'MADUD',
  },
  {
    id: 'farsh',
    code: 'FARSH',
    name: 'الفرش',
    description: 'اختلافات فرش الحروف',
    order: 2,
    status: 'ACTIVE',
    editorMode: 'MANUAL_TEXT',
    renderCategory: 'FARSH',
  },
  {
    id: 'usul',
    code: 'USUL',
    name: 'الأصول',
    description: 'أصول القراءات',
    order: 3,
    status: 'ACTIVE',
    editorMode: 'HYBRID',
    renderCategory: 'USUL',
  },
  {
    id: 'hamz',
    code: 'HAMZ',
    name: 'الهمز',
    description: 'أحكام الهمز',
    order: 4,
    status: 'ACTIVE',
    editorMode: 'HYBRID',
    renderCategory: 'HAMZ',
  },
  {
    id: 'waqf',
    code: 'WAQF',
    name: 'الوقف',
    description: 'أحكام الوقف والابتداء',
    order: 5,
    status: 'ACTIVE',
    editorMode: 'MANUAL_TEXT',
    renderCategory: 'WAQF',
  },
  {
    id: 'tajweed',
    code: 'TAJWEED',
    name: 'التجويد',
    description: 'أحكام التجويد',
    order: 6,
    status: 'ACTIVE',
    editorMode: 'HYBRID',
    renderCategory: 'TAJWEED',
  },
  {
    id: 'tahqiq',
    code: 'TAHQIQ',
    name: 'التحقيق',
    description: 'تحقيق القراءات',
    order: 7,
    status: 'ACTIVE',
    editorMode: 'MANUAL_TEXT',
    renderCategory: 'TAHQIQ',
  },
];

export const DEFAULT_TYPES: RecitationRuleType[] = [
  {
    id: 'madd_muttasil',
    familyId: 'madd',
    code: 'MUTTASIL',
    name: 'المد المتصل',
    description: 'حرف مد بعده همزة في نفس الكلمة',
    detectionMode: 'PATTERN',
    optionMode: 'SINGLE',
    status: 'ACTIVE',
    order: 1,
    fields: [
      { id: 'ruleType', component: 'select', required: true, label: 'نوع المد' },
      { id: 'ruleOption', component: 'select', required: true, label: 'مقدار المد' },
    ],
  },
  {
    id: 'madd_munfasil',
    familyId: 'madd',
    code: 'MUNFASIL',
    name: 'المد المنفصل',
    description: 'حرف مد في آخر الكلمة وبعده همزة في أول الكلمة التالية',
    detectionMode: 'PATTERN',
    optionMode: 'SINGLE',
    status: 'ACTIVE',
    order: 2,
    fields: [
      { id: 'ruleType', component: 'select', required: true, label: 'نوع المد' },
      { id: 'ruleOption', component: 'select', required: true, label: 'مقدار المد' },
    ],
  },
  {
    id: 'madd_lazim',
    familyId: 'madd',
    code: 'LAZIM',
    name: 'المد اللازم',
    description: 'حرف مد بعده سكون لازم',
    detectionMode: 'PATTERN',
    optionMode: 'SINGLE',
    status: 'ACTIVE',
    order: 3,
  },
  {
    id: 'madd_arid',
    familyId: 'madd',
    code: 'ARID',
    name: 'المد العارض للسكون',
    description: 'حرف مد بعده سكون عارض للوقف',
    detectionMode: 'STRUCTURAL',
    optionMode: 'SINGLE',
    status: 'ACTIVE',
    order: 4,
  },
];

export const DEFAULT_OPTIONS: RecitationRuleOption[] = [
  // متصل
  {
    id: 'madd_muttasil_4',
    ruleTypeId: 'madd_muttasil',
    label: '4 حركات',
    numericValue: 4,
    unit: 'HARAKAT',
    order: 1,
    status: 'ACTIVE',
  },
  {
    id: 'madd_muttasil_5',
    ruleTypeId: 'madd_muttasil',
    label: '5 حركات',
    numericValue: 5,
    unit: 'HARAKAT',
    order: 2,
    status: 'ACTIVE',
  },
  {
    id: 'madd_muttasil_6',
    ruleTypeId: 'madd_muttasil',
    label: '6 حركات',
    numericValue: 6,
    unit: 'HARAKAT',
    order: 3,
    status: 'ACTIVE',
  },
  // منفصل
  {
    id: 'madd_munfasil_2',
    ruleTypeId: 'madd_munfasil',
    label: '2 حركات',
    numericValue: 2,
    unit: 'HARAKAT',
    order: 1,
    status: 'ACTIVE',
  },
  {
    id: 'madd_munfasil_4',
    ruleTypeId: 'madd_munfasil',
    label: '4 حركات',
    numericValue: 4,
    unit: 'HARAKAT',
    order: 2,
    status: 'ACTIVE',
  },
  {
    id: 'madd_munfasil_5',
    ruleTypeId: 'madd_munfasil',
    label: '5 حركات',
    numericValue: 5,
    unit: 'HARAKAT',
    order: 3,
    status: 'ACTIVE',
  },
  {
    id: 'madd_munfasil_6',
    ruleTypeId: 'madd_munfasil',
    label: '6 حركات',
    numericValue: 6,
    unit: 'HARAKAT',
    order: 4,
    status: 'ACTIVE',
  },
  // لازم
  {
    id: 'madd_lazim_6',
    ruleTypeId: 'madd_lazim',
    label: '6 حركات',
    numericValue: 6,
    unit: 'HARAKAT',
    order: 1,
    status: 'ACTIVE',
  },
  // عارض
  {
    id: 'madd_arid_2',
    ruleTypeId: 'madd_arid',
    label: '2 حركات',
    numericValue: 2,
    unit: 'HARAKAT',
    order: 1,
    status: 'ACTIVE',
  },
  {
    id: 'madd_arid_4',
    ruleTypeId: 'madd_arid',
    label: '4 حركات',
    numericValue: 4,
    unit: 'HARAKAT',
    order: 2,
    status: 'ACTIVE',
  },
  {
    id: 'madd_arid_6',
    ruleTypeId: 'madd_arid',
    label: '6 حركات',
    numericValue: 6,
    unit: 'HARAKAT',
    order: 3,
    status: 'ACTIVE',
  },
];

export const DEFAULT_DETECTIONS: RecitationRuleDetection[] = [
  {
    id: 'det-madd-muttasil',
    ruleTypeId: 'madd_muttasil',
    mode: 'PATTERN',
    definition: {
      type: 'SEQUENCE',
      constraints: [
        { kind: 'MADD_LETTER' },
        { relation: 'FOLLOWED_BY', target: 'HAMZA', scope: 'SAME_WORD', kind: 'HAMZA' },
      ],
    },
    description: 'حرف مد متبوع بهمزة في نفس الكلمة',
  },
  {
    id: 'det-madd-munfasil',
    ruleTypeId: 'madd_munfasil',
    mode: 'PATTERN',
    definition: {
      type: 'SEQUENCE',
      constraints: [
        { kind: 'MADD_LETTER', position: 'END_OF_WORD' },
        { relation: 'FOLLOWED_BY_WORD', target: 'HAMZA', scope: 'NEXT_WORD', kind: 'HAMZA' },
      ],
    },
    description: 'حرف مد في آخر الكلمة متبوع بهمزة في أول الكلمة التالية',
  },
];

function defaultCatalog(): RecitationRuleCatalog {
  return {
    schemaVersion: 1,
    families: DEFAULT_FAMILIES,
    types: DEFAULT_TYPES,
    options: DEFAULT_OPTIONS,
    detections: DEFAULT_DETECTIONS,
    updatedAt: nowIso(),
  };
}

// ==================== التخزين المحلي ====================

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readCatalog(): RecitationRuleCatalog {
  if (!isBrowser()) return defaultCatalog();
  try {
    const raw = window.localStorage.getItem(RECITATION_CATALOG_KEY);
    if (!raw) return defaultCatalog();
    const parsed = JSON.parse(raw) as RecitationRuleCatalog;
    if (!parsed.families || !parsed.types || !parsed.options) return defaultCatalog();
    return normalizeCatalog(parsed);
  } catch {
    return defaultCatalog();
  }
}

function writeCatalog(catalog: RecitationRuleCatalog): void {
  if (!isBrowser()) return;
  const normalized = normalizeCatalog(catalog);
  normalized.updatedAt = nowIso();
  window.localStorage.setItem(RECITATION_CATALOG_KEY, JSON.stringify(normalized));
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(RECITATION_CATALOG_EVENT, { detail: normalized }));
  }
}

function normalizeCatalog(catalog: RecitationRuleCatalog): RecitationRuleCatalog {
  return {
    schemaVersion: 1,
    families: (catalog.families ?? []).map((f) => ({
      ...f,
      code: f.code.trim(),
      status: f.status ?? 'ACTIVE',
      order: typeof f.order === 'number' ? f.order : 0,
    })),
    types: (catalog.types ?? []).map((t) => ({
      ...t,
      code: t.code.trim(),
      status: t.status ?? 'ACTIVE',
      order: typeof t.order === 'number' ? t.order : 0,
    })),
    options: (catalog.options ?? []).map((o) => ({
      ...o,
      status: o.status ?? 'ACTIVE',
      numericValue: typeof o.numericValue === 'number' ? o.numericValue : Number(o.numericValue) || 0,
      order: typeof o.order === 'number' ? o.order : 0,
      unit: o.unit ?? 'HARAKAT',
    })),
    detections: catalog.detections ?? [],
    updatedAt: catalog.updatedAt ?? nowIso(),
  };
}

// ==================== واجهة القراءة ====================

export function loadRecitationCatalog(): RecitationRuleCatalog {
  return readCatalog();
}

export function listFamilies(): RecitationRuleFamily[] {
  return readCatalog().families.slice().sort((a, b) => a.order - b.order);
}

export function listTypes(familyId?: string): RecitationRuleType[] {
  const catalog = readCatalog();
  const types = familyId ? catalog.types.filter((t) => t.familyId === familyId) : catalog.types;
  return types.slice().sort((a, b) => a.order - b.order);
}

export function listOptions(ruleTypeId?: string): RecitationRuleOption[] {
  const catalog = readCatalog();
  const opts = ruleTypeId ? catalog.options.filter((o) => o.ruleTypeId === ruleTypeId) : catalog.options;
  return opts
    .filter((o) => o.status === 'ACTIVE' || o.status === 'EXPERIMENTAL')
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function getFamily(idOrCode: string): RecitationRuleFamily | undefined {
  const catalog = readCatalog();
  return catalog.families.find((f) => f.id === idOrCode || f.code === idOrCode);
}

export function getRuleType(idOrCode: string): RecitationRuleType | undefined {
  const catalog = readCatalog();
  return catalog.types.find((t) => t.id === idOrCode || t.code === idOrCode);
}

export function getRuleOption(id: string): RecitationRuleOption | undefined {
  const catalog = readCatalog();
  return catalog.options.find((o) => o.id === id);
}

export function getOptionsForType(ruleTypeId: string): RecitationRuleOption[] {
  return listOptions(ruleTypeId);
}

export function getTypeForOption(optionId: string): RecitationRuleType | undefined {
  const opt = getRuleOption(optionId);
  if (!opt) return undefined;
  return getRuleType(opt.ruleTypeId);
}

export function getFamilyForType(ruleTypeId: string): RecitationRuleFamily | undefined {
  const type = getRuleType(ruleTypeId);
  if (!type) return undefined;
  return getFamily(type.familyId);
}

// ==================== واجهة الكتابة ====================

export function saveFamily(family: RecitationRuleFamily): RecitationRuleFamily {
  const catalog = readCatalog();
  const idx = catalog.families.findIndex((f) => f.id === family.id);
  const toSave = { ...family, code: family.code.trim(), name: family.name.trim() };
  if (idx >= 0) catalog.families[idx] = toSave;
  else catalog.families.push(toSave);
  writeCatalog(catalog);
  return toSave;
}

export function saveRuleType(ruleType: RecitationRuleType): RecitationRuleType {
  const catalog = readCatalog();
  const idx = catalog.types.findIndex((t) => t.id === ruleType.id);
  const toSave = { ...ruleType, code: ruleType.code.trim(), name: ruleType.name.trim() };
  if (idx >= 0) catalog.types[idx] = toSave;
  else catalog.types.push(toSave);
  writeCatalog(catalog);
  return toSave;
}

export function saveRuleOption(option: RecitationRuleOption): RecitationRuleOption {
  validateOption(option);
  const catalog = readCatalog();
  const idx = catalog.options.findIndex((o) => o.id === option.id);
  const toSave = { ...option, label: option.label.trim() };
  if (idx >= 0) catalog.options[idx] = toSave;
  else catalog.options.push(toSave);
  writeCatalog(catalog);
  return toSave;
}

export function deleteFamily(id: string): void {
  const catalog = readCatalog();
  catalog.families = catalog.families.filter((f) => f.id !== id);
  // حذف الأنواع والخيارات التابعة — قرار صريح
  const typeIds = new Set(catalog.types.filter((t) => t.familyId === id).map((t) => t.id));
  catalog.types = catalog.types.filter((t) => t.familyId !== id);
  catalog.options = catalog.options.filter((o) => !typeIds.has(o.ruleTypeId));
  writeCatalog(catalog);
}

export function deleteRuleType(id: string): void {
  const catalog = readCatalog();
  catalog.types = catalog.types.filter((t) => t.id !== id);
  catalog.options = catalog.options.filter((o) => o.ruleTypeId !== id);
  catalog.detections = (catalog.detections ?? []).filter((d) => d.ruleTypeId !== id);
  writeCatalog(catalog);
}

export function deleteRuleOption(id: string): void {
  const catalog = readCatalog();
  catalog.options = catalog.options.filter((o) => o.id !== id);
  writeCatalog(catalog);
}

export function resetCatalog(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(RECITATION_CATALOG_KEY);
  writeCatalog(defaultCatalog());
}

// ==================== التحقق ====================

export function validateOption(option: RecitationRuleOption): void {
  if (!Number.isInteger(option.numericValue) || option.numericValue <= 0) {
    throw new Error(`قيمة المد يجب أن تكون عددًا صحيحًا موجبًا — المُعطى: ${option.numericValue}`);
  }
  if (option.numericValue > 10) {
    throw new Error(`قيمة المد كبيرة جدًا: ${option.numericValue}`);
  }
  if (!option.label.trim()) {
    throw new Error('تسمية الخيار مطلوبة');
  }
}

export function createFamilyId(): string {
  return genId('fam');
}

export function createRuleTypeId(): string {
  return genId('rtype');
}

export function createRuleOptionId(): string {
  return genId('ropt');
}

// ==================== دوال مساعدة للهوية الدلالية ====================

export function familyIdFromCategory(category: VariantCategory): string | undefined {
  const map: Record<string, string> = {
    MADUD: 'madd',
    FARSH: 'farsh',
    USUL: 'usul',
    HAMZ: 'hamz',
    WAQF: 'waqf',
    TAJWEED: 'tajweed',
    TAHQIQ: 'tahqiq',
  };
  return map[category];
}

export function categoryFromFamilyId(familyId: string): VariantCategory | undefined {
  const map: Record<string, VariantCategory> = {
    madd: 'MADUD',
    farsh: 'FARSH',
    usul: 'USUL',
    hamz: 'HAMZ',
    waqf: 'WAQF',
    tajweed: 'TAJWEED',
    tahqiq: 'TAHQIQ',
  };
  return map[familyId];
}

// ==================== Choice Group ====================

export function generateChoiceGroupId(input: {
  ayahKey: number;
  startPosition: number;
  endPosition: number;
  characterRange?: { start: { position: number; characterIndex: number }; end: { position: number; characterIndex: number } };
  ruleFamilyId?: string;
  ruleTypeId?: string;
}): string {
  const { ayahKey, startPosition, endPosition, characterRange, ruleFamilyId, ruleTypeId } = input;
  const familyPart = ruleFamilyId ? `:family:${ruleFamilyId}` : '';
  const typePart = ruleTypeId ? `:type:${ruleTypeId}` : '';
  if (characterRange) {
    return `ayah:${ayahKey}:locus:${startPosition}.${characterRange.start.characterIndex}-${endPosition}.${characterRange.end.characterIndex}${familyPart}${typePart}`;
  }
  return `ayah:${ayahKey}:locus:${startPosition}-${endPosition}${familyPart}${typePart}`;
}

// ==================== ربط Detection بـ GlobalRule (Spec §§17-19) ====================
// تحويل تعريف الكشف إلى نمط يمكن استعماله في GlobalRule.pattern
// بدون وضع منطق مدّ خاص داخل combination-engine أو resolver

export function detectionToPattern(detection: RecitationRuleDetection): unknown {
  // pattern بسيط: يحتوي على قيود MatchPredicate
  return {
    kind: 'RECIATION_RULE',
    ruleTypeId: detection.ruleTypeId,
    constraints: (detection.definition as any)?.constraints ?? detection.definition,
    description: detection.description,
  };
}

// إنشاء GlobalRule من نوع قاعدة — يُستعمل عند التعميم التلقائي
export function createGlobalRuleFromType(
  ruleTypeId: string,
  base: { title: string; scope: any; priority?: number }
): { pattern: unknown; category: VariantCategory } {
  const ruleType = getRuleType(ruleTypeId);
  if (!ruleType) throw new Error(`نوع القاعدة غير موجود: ${ruleTypeId}`);
  const family = getFamily(ruleType.familyId);
  const detection = (readCatalog().detections ?? []).find((d) => d.ruleTypeId === ruleTypeId);
  return {
    pattern: detection ? detectionToPattern(detection) : { kind: 'RECIATION_RULE', ruleTypeId },
    category: (family?.renderCategory as VariantCategory) ?? 'MADUD',
  };
}

// ==================== تصدير افتراضي ====================

export function exportCatalog(): RecitationRuleCatalog {
  return readCatalog();
}

export function importCatalog(catalog: RecitationRuleCatalog): void {
  writeCatalog(catalog);
}

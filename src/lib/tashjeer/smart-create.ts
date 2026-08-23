// المعالج الذكي الموحد - Smart Create Wizard Logic
// FR-ED-08: الإنشاء الذكي الموحد (Smart Create Wizard)
// FR-ED-09: تحديد عدة كلمات معًا
//
// معالج واحد من 7 خطوات يوحّد كل عمليات الإنشاء:
//   1. التحديد البصري (كلمة/حروف/مدى)
//   2. مكونات المجموعة (اختلافات + أوجه)
//   3. الأهداف (تطبيق على أوجه متعددة)
//   4. النطاق البشري (قراء/رواة/طرق)
//   5. العلاقات (إنشاء علاقات تلقائية)
//   6. النطاق الجغرافي (موضع/آية/سورة/مصحف)
//   7. سياق الوقف/الوصل + المراجعة

import type { Variant, VariantAlternative, ReadingScope } from '@/types/tashjeer';
import type { VariantCategory } from '@/types';
import type { RecitationContext, Relation, RelationType } from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';

// ==================== أنواع البيانات ====================

/** خطوة المعالج الحالية. */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** بيانات التحديد (الخطوة 1). */
export interface WizardSelection {
  /** الكلمات المحددة. */
  positions: number[];
  /** الحروف المحددة (اختياري). */
  characterAnchors?: Array<{ position: number; characterIndex: number }>;
  /** مدى من كلمة إلى كلمة (اختياري). */
  range?: { start: number; end: number };
  /** عدة مواضع متفرقة. */
  multipleLoci?: Array<{ start: number; end: number }>;
}

/** مكون المجموعة (الخطوة 2). */
export interface WizardComponent {
  id: string;
  category: VariantCategory;
  title: string;
  rank: number;
  variants: WizardVariantDef[];
}

/** تعريف وجه داخل المعالج. */
export interface WizardVariantDef {
  id: string;
  label: string;
  text: string;
  strengthDegreeId?: string;
  rank: number;
}

/** هدف التطبيق (الخطوة 3). */
export interface WizardTarget {
  componentId: string;
  selected: boolean;
}

/** النطاق البشري (الخطوة 4). */
export interface WizardScope {
  kind: 'ALL' | 'ALL_EXCEPT' | 'NARRATORS' | 'IMAMS' | 'PATHS';
  narratorIds?: string[];
  imamIds?: string[];
  pathIds?: string[];
}

/** علاقة مطلوبة (الخطوة 5). */
export interface WizardRelation {
  fromComponentId: string;
  toComponentId: string;
  type: RelationType;
}

/** النطاق الجغرافي (الخطوة 6). */
export type WizardGeneralizationScope = 'LOCUS_ONLY' | 'AYAH' | 'SURAH' | 'MUSHAF';

/** سياق الوقف/الوصل (الخطوة 7). */
export interface WizardContext {
  context: RecitationContext;
}

/** الحالة الكاملة للمعالج. */
export interface WizardState {
  currentStep: WizardStep;
  selection: WizardSelection;
  components: WizardComponent[];
  targets: WizardTarget[];
  scope: WizardScope;
  relations: WizardRelation[];
  generalizationScope: WizardGeneralizationScope;
  context: WizardContext;
}

/** نتيجة المعالج: الكيانات المُنشأة. */
export interface WizardResult {
  variants: Variant[];
  relations: Relation[];
  generalizationScope: WizardGeneralizationScope;
  batchId: string;
}

// ==================== الحالة الأولية ====================

export function createInitialWizardState(): WizardState {
  return {
    currentStep: 1,
    selection: { positions: [] },
    components: [],
    targets: [],
    scope: { kind: 'ALL' },
    relations: [],
    generalizationScope: 'LOCUS_ONLY',
    context: { context: 'ALWAYS' },
  };
}

// ==================== التنقل بين الخطوات ====================

export function canGoNext(state: WizardState): boolean {
  switch (state.currentStep) {
    case 1:
      return state.selection.positions.length > 0 || (state.selection.multipleLoci?.length ?? 0) > 0;
    case 2:
      return state.components.length > 0;
    case 3:
      return state.targets.some((t) => t.selected);
    case 4:
      return true; // النطاق الافتراضي ALL مقبول
    case 5:
      return true; // العلاقات اختيارية
    case 6:
      return true;
    case 7:
      return true;
    default:
      return false;
  }
}

export function canGoBack(state: WizardState): boolean {
  return state.currentStep > 1;
}

export function goNext(state: WizardState): WizardState {
  if (!canGoNext(state) || state.currentStep === 7) return state;
  return { ...state, currentStep: (state.currentStep + 1) as WizardStep };
}

export function goBack(state: WizardState): WizardState {
  if (!canGoBack(state)) return state;
  return { ...state, currentStep: (state.currentStep - 1) as WizardStep };
}

// ==================== إدارة المكونات ====================

export function addComponent(state: WizardState, component: Omit<WizardComponent, 'id'>): WizardState {
  const id = createEntityId('comp');
  const newComponent: WizardComponent = { ...component, id };
  return {
    ...state,
    components: [...state.components, newComponent],
    targets: [...state.targets, { componentId: id, selected: true }],
  };
}

export function removeComponent(state: WizardState, componentId: string): WizardState {
  return {
    ...state,
    components: state.components.filter((c) => c.id !== componentId),
    targets: state.targets.filter((t) => t.componentId !== componentId),
    relations: state.relations.filter(
      (r) => r.fromComponentId !== componentId && r.toComponentId !== componentId
    ),
  };
}

export function updateComponent(
  state: WizardState,
  componentId: string,
  patch: Partial<WizardComponent>
): WizardState {
  return {
    ...state,
    components: state.components.map((c) => (c.id === componentId ? { ...c, ...patch } : c)),
  };
}

// ==================== إدارة الأهداف ====================

export function toggleTarget(state: WizardState, componentId: string): WizardState {
  return {
    ...state,
    targets: state.targets.map((t) =>
      t.componentId === componentId ? { ...t, selected: !t.selected } : t
    ),
  };
}

export function selectAllTargets(state: WizardState): WizardState {
  return {
    ...state,
    targets: state.targets.map((t) => ({ ...t, selected: true })),
  };
}

// ==================== إدارة العلاقات ====================

export function addRelation(state: WizardState, relation: WizardRelation): WizardState {
  return {
    ...state,
    relations: [...state.relations, relation],
  };
}

export function removeRelation(state: WizardState, index: number): WizardState {
  return {
    ...state,
    relations: state.relations.filter((_, i) => i !== index),
  };
}

// ==================== التنفيذ النهائي ====================

/**
 * ينفذ المعالج وينشئ الكيانات المطلوبة.
 */
export function executeWizard(state: WizardState): WizardResult {
  const batchId = createEntityId('batch');
  const now = new Date().toISOString();
  const variants: Variant[] = [];
  const relations: Relation[] = [];

  // تحديد الموضع.
  const startPosition = state.selection.range?.start ?? Math.min(...state.selection.positions);
  const endPosition = state.selection.range?.end ?? Math.max(...state.selection.positions);

  // تحويل النطاق.
  const scope: ReadingScope = {
    kind: state.scope.kind,
    narratorIds: state.scope.narratorIds,
    imamIds: state.scope.imamIds,
    pathIds: state.scope.pathIds,
  };

  // إنشاء الاختلافات.
  for (const component of state.components) {
    const variantId = createEntityId('v');

    // إنشاء الأوجه.
    const alternatives: VariantAlternative[] = [
      {
        id: `${variantId}-base`,
        text: component.title,
        label: 'وجه المصحف',
        isBase: true,
        scope,
      },
      ...component.variants.map((vDef) => ({
        id: createEntityId('face'),
        text: vDef.text,
        label: vDef.label,
        isBase: false,
        scope,
        strengthDegreeId: vDef.strengthDegreeId,
        rank: vDef.rank,
      })),
    ];

    const variant: Variant = {
      id: variantId,
      ayahKey: 0, // سيُملأ من المحرر
      category: component.category,
      title: component.title,
      startPosition,
      endPosition,
      targetKind: 'WORDS',
      status: 'DRAFT',
      origin: 'EDITOR',
      alternatives,
      orderRank: component.rank,
      recitationMode: state.context.context === 'ALWAYS' ? undefined : state.context.context,
    };

    variants.push(variant);
  }

  // إنشاء العلاقات.
  for (const rel of state.relations) {
    const fromVariant = variants.find((v) => v.title === state.components.find((c) => c.id === rel.fromComponentId)?.title);
    const toVariant = variants.find((v) => v.title === state.components.find((c) => c.id === rel.toComponentId)?.title);

    if (fromVariant && toVariant) {
      const relation: Relation = {
        id: createEntityId('rel'),
        type: rel.type,
        fromId: fromVariant.id,
        toId: toVariant.id,
        source: 'editor',
        createdAt: now,
      };
      relations.push(relation);
    }
  }

  return {
    variants,
    relations,
    generalizationScope: state.generalizationScope,
    batchId,
  };
}

// ==================== ملخص المعالج ====================

export interface WizardSummary {
  selectionDescription: string;
  componentsCount: number;
  selectedTargetsCount: number;
  relationsCount: number;
  scopeDescription: string;
  generalizationDescription: string;
  contextDescription: string;
  totalEntitiesToCreate: number;
}

export function buildWizardSummary(state: WizardState): WizardSummary {
  const selectionDescription =
    state.selection.multipleLoci?.length
      ? `${state.selection.multipleLoci.length} مواضع متفرقة`
      : state.selection.range
        ? `من الكلمة ${state.selection.range.start} إلى ${state.selection.range.end}`
        : `${state.selection.positions.length} كلمات`;

  const scopeDescription =
    state.scope.kind === 'ALL'
      ? 'كل الرواة'
      : state.scope.kind === 'ALL_EXCEPT'
        ? `كل الرواة عدا ${state.scope.narratorIds?.length ?? 0}`
        : state.scope.kind === 'NARRATORS'
          ? `${state.scope.narratorIds?.length ?? 0} راوٍ`
          : state.scope.kind === 'IMAMS'
            ? `${state.scope.imamIds?.length ?? 0} إمام`
            : `${state.scope.pathIds?.length ?? 0} طريق`;

  const generalizationDescription =
    state.generalizationScope === 'LOCUS_ONLY'
      ? 'هذا الموضع فقط'
      : state.generalizationScope === 'AYAH'
        ? 'الآية كاملة'
        : state.generalizationScope === 'SURAH'
          ? 'السورة كاملة'
          : 'المصحف كله (قاعدة عامة)';

  const contextDescription =
    state.context.context === 'ALWAYS'
      ? 'دائمًا'
      : state.context.context === 'WAQF_ONLY'
        ? 'وقفا فقط'
        : 'وصلا فقط';

  const selectedTargetsCount = state.targets.filter((t) => t.selected).length;

  return {
    selectionDescription,
    componentsCount: state.components.length,
    selectedTargetsCount,
    relationsCount: state.relations.length,
    scopeDescription,
    generalizationDescription,
    contextDescription,
    totalEntitiesToCreate: state.components.length,
  };
}

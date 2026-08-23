// حلقة التعلم الكاملة - Learning Loop
// FR-ES-12: Reference Validation + Candidate Rules + Create Rule from Correction
// FR-ES-15: Bidirectional linking between Editor and Studio
//
// الحلقة:
//   Engine يقترح ← Editor يصحح ← Correction يتحول إلى Candidate Rule
//   ← Rule تُختبر وتُعتمد ← Engine يُعاد تشغيله ← مقارنة النتائج
//   ← Reference Data تتحسن

import type {
  Correction,
  EngineRule,
  EngineConfig,
  ConditionGroup,
  RuleAction,
  RuleCondition,
} from '@/lib/tashjeer/model/v8';
import type { Variant } from '@/types/tashjeer';
import {
  createEntityId,
  correctionEngineResult,
  correctionEditorResult,
} from '@/lib/tashjeer/model/v8';

// ==================== أنواع البيانات ====================

/** نتيجة المقارنة مع البيانات المرجعية. */
export type ValidationStatus = 'CORRECT' | 'WRONG' | 'MISSING' | 'EXTRA' | 'CONFLICT';

/** عنصر في تقرير التحقق المرجعي. */
export interface ValidationItem {
  ayahKey: number;
  variantId: string;
  variantTitle: string;
  status: ValidationStatus;
  engineResult?: string;
  referenceResult?: string;
  editorResult?: string;
  reason?: string;
}

/** تقرير التحقق المرجعي. */
export interface ValidationReport {
  totalItems: number;
  correct: number;
  wrong: number;
  missing: number;
  extra: number;
  conflict: number;
  accuracy: number;
  items: ValidationItem[];
}

/** نمط تصحيح متكرر. */
export interface CorrectionPattern {
  id: string;
  /** وصف النمط. */
  description: string;
  /** عدد مرات التكرار. */
  count: number;
  /** القارئ/الرواة المشتركون. */
  commonReaders: string[];
  /** الفئة المشتركة. */
  commonCategory?: string;
  /** السياق المشترك (وقف/وصل). */
  commonContext?: 'WAQF_ONLY' | 'WASL_ONLY' | 'ALWAYS';
  /** الشروط المقترحة للقاعدة. */
  suggestedConditions: ConditionGroup;
  /** الإجراء المقترح للقاعدة. */
  suggestedAction: RuleAction;
  /** التصحيحات المكونة للنمط. */
  correctionIds: string[];
}

/** قاعدة مرشحة من التصحيحات. */
/** إدخال مرن لقاعدة مرشحة مستوردة من سجل قديم. */
export type CorrectionPatternInput = Omit<CorrectionPattern, 'suggestedAction'> & {
  suggestedAction: RuleAction | { type: string; params?: Record<string, unknown>; parameters?: Record<string, unknown> };
};

export interface CandidateRule {
  id: string;
  pattern: CorrectionPattern;
  suggestedRule: Partial<EngineRule>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// ==================== التحقق المرجعي ====================

/**
 * يقارن نتائج المحرك بالبيانات المرجعية المعتمدة.
 */
export function validateAgainstReference(
  engineVariants: Variant[],
  referenceVariants: Variant[],
  editorVariants: Variant[]
): ValidationReport {
  const items: ValidationItem[] = [];

  // خريطة للاختلافات المرجعية حسب الموضع.
  const refMap = new Map<string, Variant>();
  for (const ref of referenceVariants) {
    const key = `${ref.ayahKey}-${ref.startPosition}-${ref.endPosition}-${ref.title}`;
    refMap.set(key, ref);
  }

  // خريطة للاختلافات من المحرك.
  const engineMap = new Map<string, Variant>();
  for (const eng of engineVariants) {
    const key = `${eng.ayahKey}-${eng.startPosition}-${eng.endPosition}-${eng.title}`;
    engineMap.set(key, eng);
  }

  // خريطة للاختلافات من المحرر.
  const editorMap = new Map<string, Variant>();
  for (const ed of editorVariants) {
    const key = `${ed.ayahKey}-${ed.startPosition}-${ed.endPosition}-${ed.title}`;
    editorMap.set(key, ed);
  }

  // فحص كل اختلاف مرجعي.
  for (const [key, refVariant] of refMap) {
    const engineVariant = engineMap.get(key);
    const editorVariant = editorMap.get(key);

    if (!engineVariant && !editorVariant) {
      // MISSING: في المرجع لكن ليس في المحرك ولا المحرر.
      items.push({
        ayahKey: refVariant.ayahKey,
        variantId: refVariant.id,
        variantTitle: refVariant.title,
        status: 'MISSING',
        referenceResult: refVariant.title,
        reason: 'موجود في المرجع لكن لم يولده المحرك',
      });
    } else if (engineVariant && !editorVariant) {
      // CORRECT: المحرك وجده والمرجع يؤكده.
      items.push({
        ayahKey: refVariant.ayahKey,
        variantId: refVariant.id,
        variantTitle: refVariant.title,
        status: 'CORRECT',
        engineResult: engineVariant.title,
        referenceResult: refVariant.title,
      });
    } else if (!engineVariant && editorVariant) {
      // EXTRA: المحرر أضافه لكنه ليس في المرجع.
      items.push({
        ayahKey: refVariant.ayahKey,
        variantId: refVariant.id,
        variantTitle: refVariant.title,
        status: 'EXTRA',
        editorResult: editorVariant.title,
        referenceResult: refVariant.title,
        reason: 'أضافه المحرر لكنه ليس في المرجع',
      });
    } else if (engineVariant && editorVariant) {
      // قد يكون CORRECT أو CONFLICT.
      const engineMatchesRef = engineVariant.title === refVariant.title;
      const editorMatchesRef = editorVariant.title === refVariant.title;

      if (engineMatchesRef && editorMatchesRef) {
        items.push({
          ayahKey: refVariant.ayahKey,
          variantId: refVariant.id,
          variantTitle: refVariant.title,
          status: 'CORRECT',
          engineResult: engineVariant.title,
          referenceResult: refVariant.title,
          editorResult: editorVariant.title,
        });
      } else {
        items.push({
          ayahKey: refVariant.ayahKey,
          variantId: refVariant.id,
          variantTitle: refVariant.title,
          status: 'CONFLICT',
          engineResult: engineVariant.title,
          referenceResult: refVariant.title,
          editorResult: editorVariant.title,
          reason: 'تعارض بين المحرك والمرجع والمحرر',
        });
      }
    }
  }

  // فحص الاختلافات في المحرك لكن ليست في المرجع (WRONG).
  for (const [key, engineVariant] of engineMap) {
    if (!refMap.has(key)) {
      items.push({
        ayahKey: engineVariant.ayahKey,
        variantId: engineVariant.id,
        variantTitle: engineVariant.title,
        status: 'WRONG',
        engineResult: engineVariant.title,
        reason: 'ولده المحرك لكنه ليس في المرجع',
      });
    }
  }

  // حساب الإحصائيات.
  const correct = items.filter((i) => i.status === 'CORRECT').length;
  const wrong = items.filter((i) => i.status === 'WRONG').length;
  const missing = items.filter((i) => i.status === 'MISSING').length;
  const extra = items.filter((i) => i.status === 'EXTRA').length;
  const conflict = items.filter((i) => i.status === 'CONFLICT').length;
  const totalItems = items.length;
  const accuracy = totalItems > 0 ? (correct / totalItems) * 100 : 0;

  return {
    totalItems,
    correct,
    wrong,
    missing,
    extra,
    conflict,
    accuracy,
    items,
  };
}

// ==================== اكتشاف الأنماط ====================

/**
 * يكتشف أنماط التصحيح المتكررة من قائمة التصحيحات.
 */
export function discoverCorrectionPatterns(corrections: Correction[]): CorrectionPattern[] {
  const patterns: CorrectionPattern[] = [];

  // تجميع التصحيحات حسب الخصائص المشتركة.
  const groups = new Map<string, Correction[]>();

  for (const correction of corrections) {
    const key = buildCorrectionKey(correction);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(correction);
  }

  // تحويل المجموعات إلى أنماط.
  for (const [key, group] of groups) {
    if (group.length >= 2) {
      // نمط متكرر (مرتين على الأقل).
      const pattern = buildPatternFromGroup(key, group);
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }

  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * يبني مفتاح تجميع للتصحيح.
 */
function buildCorrectionKey(correction: Correction): string {
  const metadata = correction.metadata;
  const parts = [
    `target:${correction.targetType ?? 'DIFFERENCE'}`,
    `category:${metadata?.category ?? 'unknown'}`,
    `context:${metadata?.context ?? 'ALWAYS'}`,
  ];
  const readers = metadata?.readerIds;
  if (readers && readers.length > 0) {
    // لا نرتب مصفوفة المستند الأصلية in-place؛ السجل جزء من بيانات المرجع.
    parts.push(`readers:${[...readers].sort().join(',')}`);
  }
  return parts.join('|');
}

/** يحول إجراء استيراد قديم إلى الشكل الذي يفهمه Resolver. */
function normalizeSuggestedAction(action: CorrectionPatternInput['suggestedAction']): RuleAction {
  const legacyAliases: Record<string, RuleAction['type']> = {
    OVERRIDE_VARIANT: 'OVERRIDE_RESULT',
    MODIFY_VARIANT: 'OVERRIDE_RESULT',
    MERGE_VARIANTS: 'MERGE',
    SKIP_VARIANT: 'BLOCK_RESULT',
  };
  return {
    type: legacyAliases[action.type] ?? action.type as RuleAction['type'],
    params: action.params ?? action.parameters,
  };
}

function titleOf(value: unknown): string | undefined {
  if (value && typeof value === 'object' && 'title' in value) {
    const title = (value as Record<string, unknown>).title;
    return typeof title === 'string' ? title : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

/**
 * يبني نمطًا من مجموعة تصحيحات.
 */
function buildPatternFromGroup(_key: string, corrections: Correction[]): CorrectionPattern | null {
  const first = corrections[0];
  if (!first) return null;

  const metadata = first.metadata;
  const category = metadata?.category;
  const context = metadata?.context;
  const readerIds = metadata?.readerIds ?? [];
  const conditions: RuleCondition[] = [];

  if (category) conditions.push({ field: 'category', op: 'equals', value: category });
  if (context && context !== 'ALWAYS') conditions.push({ field: 'context', op: 'equals', value: context });
  if (readerIds.length > 0) conditions.push({ field: 'readerId', op: 'in', value: [...readerIds] });

  const action: RuleAction = {
    type: 'OVERRIDE_RESULT',
    params: {
      originalTitle: titleOf(correctionEngineResult(first)),
      correctedTitle: titleOf(correctionEditorResult(first)),
    },
  };

  return {
    id: createEntityId('pattern'),
    description: `نمط تصحيح متكرر: ${category ?? 'unknown'}${context ? ` (${context})` : ''}`,
    count: corrections.length,
    commonReaders: [...readerIds],
    commonCategory: category,
    commonContext: context,
    suggestedConditions: { all: conditions },
    suggestedAction: action,
    correctionIds: corrections.map((correction) => correction.id),
  };
}

// ==================== إنشاء قاعدة من تصحيح ====================

/**
 * ينشئ قاعدة مرشحة من تصحيح واحد. المرشح لا ينشط تلقائيا أبدا.
 */
export function createCandidateFromCorrection(
  correction: Correction,
  _profile: EngineConfig
): CandidateRule {
  const metadata = correction.metadata;
  const category = metadata?.category;
  const context = metadata?.context;
  const conditions: RuleCondition[] = [];

  if (category) conditions.push({ field: 'category', op: 'equals', value: category });
  if (context && context !== 'ALWAYS') conditions.push({ field: 'context', op: 'equals', value: context });
  if (metadata?.readerIds?.length) {
    conditions.push({ field: 'readerId', op: 'in', value: [...metadata.readerIds] });
  }

  const action: RuleAction = {
    type: 'OVERRIDE_RESULT',
    params: {
      originalTitle: titleOf(correctionEngineResult(correction)),
      correctedTitle: titleOf(correctionEditorResult(correction)),
    },
  };

  const suggestedRule: Partial<EngineRule> = {
    id: createEntityId('rule'),
    name: `قاعدة من تصحيح: ${correction.id}`,
    description: `قاعدة مقترحة من التصحيح ${correction.id}`,
    type: 'EXCEPTION',
    category: 'OVERRIDE',
    scope: 'MUSHAF',
    conditions: { all: conditions },
    actions: [action],
    priority: 100,
    groupId: 'exceptions',
    specificity: 'MUSHFAF',
    hardness: 'SOFT',
    status: 'DRAFT',
    enabled: false,
    source: 'CORRECTION',
    metadata: { sourceCorrectionId: correction.id },
  };

  const pattern: CorrectionPattern = {
    id: createEntityId('pattern'),
    description: `تصحيح واحد: ${correction.id}`,
    count: 1,
    commonReaders: [...(metadata?.readerIds ?? [])],
    commonCategory: category,
    commonContext: context,
    suggestedConditions: { all: conditions },
    suggestedAction: action,
    correctionIds: [correction.id],
  };

  return {
    id: createEntityId('candidate'),
    pattern,
    suggestedRule,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
}

/** ينشئ قاعدة مرشحة من نمط تصحيحات متكرر. */
export function createCandidateFromPattern(
  input: CorrectionPatternInput,
  _profile: EngineConfig
): CandidateRule {
  const action = normalizeSuggestedAction(input.suggestedAction);
  const pattern: CorrectionPattern = {
    ...input,
    suggestedAction: action,
  };
  const suggestedRule: Partial<EngineRule> = {
    id: createEntityId('rule'),
    name: `قاعدة من نمط: ${pattern.description}`,
    description: `قاعدة مقترحة من ${pattern.count} تصحيحات متكررة`,
    type: 'EXCEPTION',
    category: 'OVERRIDE',
    scope: 'MUSHAF',
    conditions: pattern.suggestedConditions,
    actions: [action],
    priority: 100,
    groupId: 'exceptions',
    specificity: 'MUSHFAF',
    hardness: 'SOFT',
    status: 'DRAFT',
    enabled: false,
    source: 'CORRECTION_PATTERN',
    metadata: {
      patternId: pattern.id,
      correctionCount: pattern.count,
    },
  };

  return {
    id: createEntityId('candidate'),
    pattern,
    suggestedRule,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
}

// ==================== تحليل المحرك ====================

/** ملخص أخطاء المحرك. */
export interface EngineErrorSummary {
  totalErrors: number;
  byType: Map<string, number>;
  byCategory: Map<string, number>;
  mostCommonError?: string;
}

/**
 * يلخص أخطاء المحرك من تقرير التحقق.
 */
export function summarizeEngineErrors(report: ValidationReport): EngineErrorSummary {
  const errors = report.items.filter((i) => i.status !== 'CORRECT');
  const byType = new Map<string, number>();
  const byCategory = new Map<string, number>();

  for (const error of errors) {
    // حسب النوع.
    const type = error.status;
    byType.set(type, (byType.get(type) || 0) + 1);

    // حسب الفئة (من عنوان الاختلاف).
    const category = extractCategoryFromTitle(error.variantTitle);
    if (category) {
      byCategory.set(category, (byCategory.get(category) || 0) + 1);
    }
  }

  // العثور على الخطأ الأكثر شيوعًا.
  let mostCommonError: string | undefined;
  let maxCount = 0;
  for (const [type, count] of byType) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonError = type;
    }
  }

  return {
    totalErrors: errors.length,
    byType,
    byCategory,
    mostCommonError,
  };
}

/**
 * يستخرج الفئة من عنوان الاختلاف.
 */
function extractCategoryFromTitle(title: string): string | undefined {
  // محاولة بسيطة لاستخراج الفئة من العنوان.
  const patterns = [
    { regex: /مد|مدها|مدّ/i, category: 'MADD' },
    { regex: /همز|همزة/i, category: 'HAMZ' },
    { regex: /إدغام/i, category: 'IDGHAM' },
    { regex: /إخفاء/i, category: 'IKHFA' },
    { regex: /إظهار/i, category: 'IZHAR' },
    { regex: /إقلاب/i, category: 'IQLAB' },
  ];

  for (const { regex, category } of patterns) {
    if (regex.test(title)) {
      return category;
    }
  }

  return undefined;
}

// ==================== الربط الثنائي ====================

/**
 * يولد رابطًا من المحرر إلى Engine Studio.
 */
export function generateEditorToStudioLink(
  variantId: string,
  correctionId?: string
): string {
  const params = new URLSearchParams();
  params.set('variantId', variantId);
  if (correctionId) {
    params.set('correctionId', correctionId);
  }
  return `/studio?${params.toString()}`;
}

/**
 * يولد رابطًا من Engine Studio إلى المحرر.
 */
export function generateStudioToEditorLink(
  ruleId: string,
  ayahKey?: number
): string {
  const params = new URLSearchParams();
  params.set('ruleId', ruleId);
  if (ayahKey) {
    params.set('ayahKey', ayahKey.toString());
  }
  return `/editor?${params.toString()}`;
}

/**
 * يستخرج المعرفات من رابط المحرر.
 */
export function parseEditorLink(url: string): {
  variantId?: string;
  correctionId?: string;
} {
  const params = new URL(url, 'http://localhost').searchParams;
  return {
    variantId: params.get('variantId') || undefined,
    correctionId: params.get('correctionId') || undefined,
  };
}

/**
 * يستخرج المعرفات من رابط الاستوديو.
 */
export function parseStudioLink(url: string): {
  ruleId?: string;
  ayahKey?: number;
} {
  const params = new URL(url, 'http://localhost').searchParams;
  return {
    ruleId: params.get('ruleId') || undefined,
    ayahKey: params.get('ayahKey') ? parseInt(params.get('ayahKey')!) : undefined,
  };
}

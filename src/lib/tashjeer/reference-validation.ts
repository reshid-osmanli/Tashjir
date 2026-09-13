// التحقق من المرجع — Reference Validation (FR-ES-12.1)
// مشروع التشجير - نظام القراءات العشر
//
// يقارن نتيجة المحرك بالنتيجة المرجعية المعتمدة بشريا (Final — ما ثبّته
// المحرر) على المواضع، ويصنّف كل موضع تصنيفا حتميا:
//
//   Correct  المرجع يتفق مع نتيجة المحرك.
//   Wrong    المرجع يغيّر محتوى ما اقترحه المحرك.
//   Missing  المرجع يفتقر إلى وجه/موضع اقترحه المحرك.
//   Extra    المرجع يحمل ما لم يقترحه المحرك (إضافة المحرر).
//   Conflict قرار يدوي يتعارض صراحة مع قرار المحرك (رابط دمج بين متنافيين).
//
// «المرجعي» هنا هو كل ما ثبت بقرار المحرر (Final) — الطبقة الموثوقة حتى
// اعتماد مرجع خارجي مستقبلًا. كل القواعد حتمية وقابلة للاختبار بلا متصفح.

import type { VariantCategory } from '@/types';
import type { TashjeerLink, Variant } from '@/types/tashjeer';
import type { GlobalRule } from '@/lib/storage/global-rules-store';
import type { RuleOccurrenceOverride } from '@/lib/storage/rule-occurrences-store';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { editorCategoryToStudioType } from './decision/editor-bridge';
import { resolveRelationExclusion } from './decision/api';

/** تصنيف الموضع الواحد (FR-ES-12.1). */
export type ValidationVerdict = 'CORRECT' | 'WRONG' | 'MISSING' | 'EXTRA' | 'CONFLICT';

/** موضع واحد محسوم التصنيف في التحقق من المرجع. */
export interface ValidationPosition {
  id: string;
  ayahKey: number;
  surahNumber: number;
  ayahNumber: number;
  verdict: ValidationVerdict;
  category: VariantCategory;
  title: string;
  /** سبب التصنيف الحتمي، للعرض للمراجع. */
  reason: string;
  /** مصدر نتيجة المحرك في هذا الموضع. */
  source: 'ENGINE' | 'EDITOR';
  /** سياق الأداء للموضع (وقف/وصل) — يدخل مفتاح التجميع في مستكشف الأخطاء. */
  context?: 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY';
  /** هدف رابط «فتح في المحرر» (الاختلاف أو الموضع المشتق). */
  variantId?: string;
  globalRuleId?: string;
}

/** ملخص كمي للتصنيفات الخمس. */
export interface ValidationSummary {
  total: number;
  correct: number;
  wrong: number;
  missing: number;
  extra: number;
  conflict: number;
}

/** مدخلات التحقق: مستندات + قواعد عامة + استثناءاتها المحلية + ملف المحرك. */
export interface ValidationInput {
  documents: Array<{
    ayahKey: number;
    variants: Variant[];
    links?: TashjeerLink[];
  }>;
  rules: GlobalRule[];
  overrides: RuleOccurrenceOverride[];
  profile?: EngineConfig;
}

export interface ValidationResult {
  positions: ValidationPosition[];
  summary: ValidationSummary;
}

// ==================== تصنيف الاختلاف الواحد ====================

/** مفتاح وجه للمقارنة الحتمية: التسمية + النص + نوع النطاق. */
function faceKey(face: { label?: string; text?: string; scopeKind?: string }): string {
  return `${face.label ?? ''}|${face.text ?? ''}|${face.scopeKind ?? 'ALL'}`;
}

/** أوجه غير أساسية بصيغة موحدة قابلة للمقارنة (لقطة أو حال حالية). */
function comparableFaces(alternatives: Variant['alternatives']): Array<{
  id: string;
  label: string;
  text: string;
  scopeKind: string;
}> {
  return alternatives
    .filter((alternative) => !alternative.isBase)
    .map((alternative) => ({
      id: alternative.id,
      label: alternative.label,
      text: alternative.text,
      scopeKind: alternative.scope?.kind ?? 'ALL',
    }));
}

/**
 * يصنّف اختلافًا واحدا مقارنة بلقطة المحرك المحفوظة (A) وحالته الحالية (B):
 *   - بدون لقطة ومصدره المحرر  → EXTRA (أضافه من الصفر).
 *   - بدون لقطة ومصدره المحرك  → CORRECT (كما وجده، لم يمسّ).
 *   - بلقطة: عنوان/فئة تغيّرًا  → WRONG؛ أوجه حُذفت بلا إضافة → MISSING؛
 *     أوجه أُضيفت بلا حذف → EXTRA؛ كلاهما → WRONG؛ بلا فرق → CORRECT.
 */
export function classifyVariant(variant: Variant): { verdict: ValidationVerdict; reason: string } {
  if (!variant.engineSnapshot) {
    if (variant.origin === 'EDITOR') {
      return { verdict: 'EXTRA', reason: 'أضافه المحرر من الصفر — لم يقترح المحرك هذا الموضع.' };
    }
    return { verdict: 'CORRECT', reason: 'الموضع كما وجده المحرك (بلا لقطة محرك، لم يُمس).' };
  }

  const engine = variant.engineSnapshot;
  if (engine.title !== variant.title || engine.category !== variant.category) {
    return { verdict: 'WRONG', reason: 'غيّر المحرر عنوان/فئة الموضع عن اقتراح المحرك.' };
  }

  const engineFaces = comparableFaces(engine.alternatives);
  const finalFaces = comparableFaces(variant.alternatives);
  const engineKeys = new Set(engineFaces.map(faceKey));
  const finalKeys = new Set(finalFaces.map(faceKey));

  const removed = engineFaces.filter((face) => !finalKeys.has(faceKey(face)));
  const added = finalFaces.filter((face) => !engineKeys.has(faceKey(face)));

  if (removed.length > 0 && added.length > 0) {
    return {
      verdict: 'WRONG',
      reason: `تغيير مختلط: ${added.length} وجوه أُضيفت و${removed.length} وجوه حُذفت عن اقتراح المحرك.`,
    };
  }
  if (removed.length > 0) {
    return {
      verdict: 'MISSING',
      reason: `المرجع يفتقر إلى ${removed.length} من أوجه المحرك: ${removed.map((face) => face.label || face.text).join('، ')}.`,
    };
  }
  if (added.length > 0) {
    return {
      verdict: 'EXTRA',
      reason: `المرجع يحمل ${added.length} وجها لم يقترحها المحرك: ${added.map((face) => face.label || face.text).join('، ')}.`,
    };
  }
  return { verdict: 'CORRECT', reason: 'الموضع مطابق لاقتراح المحرك.' };
}

// ==================== الاستثناءات المحلية لمواضع القواعد ====================

/** يصنّف استثناء موضعي على موضع قاعدة عامة (الحزمة 07). */
export function classifyOverride(override: RuleOccurrenceOverride): {
  verdict: ValidationVerdict;
  reason: string;
} {
  if (override.state === 'DELETED') {
    return {
      verdict: 'MISSING',
      reason: override.reason
        ? `حُذف موضع المحرك محليا: ${override.reason}`
        : 'حُذف موضع المحرك محليا (تجاوز موضعي).',
    };
  }
  if (override.state === 'CONFIRMED') {
    return { verdict: 'CORRECT', reason: 'عُتمد الموضع مطابقا لنتيجة المحرك بعد المراجعة.' };
  }
  if (typeof override.orderRank === 'number') {
    return {
      verdict: 'WRONG',
      reason: `تجاوز محلي غيّر ترتيب سطر الموضع إلى ${override.orderRank} بخلاف ترتيب المحرك.`,
    };
  }
  if (override.strengthDegreeId || override.strengthByNarrator) {
    return { verdict: 'WRONG', reason: 'تجاوز محلي خصّص درجة قوة لهذا الموضع وحده.' };
  }
  return { verdict: 'CORRECT', reason: 'الموضع مطبَّق كما اقترحه المحرك.' };
}

// ==================== التعارض مع قرارات المحرك ====================

/**
 * قرارات يدوية تتعارض صراحة مع المحرك: رابط دمج يدوي بين وجهين يقرّر
 * Decision Resolver أنهما متنافيان (لا يُضربان) → Conflict.
 * حسم التنافي عبر الواجهة الموحّدة نفسها (P-07).
 */
function conflictPositions(
  ayahKey: number,
  variants: Variant[],
  links: TashjeerLink[] | undefined,
  profile: EngineConfig | undefined
): ValidationPosition[] {
  const positions: ValidationPosition[] = [];
  if (!links) return positions;
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  for (const link of links) {
    if (link.relation !== 'MERGE') continue;
    if (link.kind === 'FACE_TO_FACE' && link.from.type === 'FACE' && link.to.type === 'FACE') {
      const fromVariant = variantById.get(link.from.id.split('::')[0]);
      const toVariant = variantById.get(link.to.id.split('::')[0]);
      if (!fromVariant || !toVariant) continue;
      const a = editorCategoryToStudioType(fromVariant.category);
      const b = editorCategoryToStudioType(toVariant.category);
      const { decision } = resolveRelationExclusion(a, b, profile);
      if (decision.exclusive) {
        positions.push({
          id: `conflict:${link.id}`,
          ayahKey,
          surahNumber: Math.floor(ayahKey / 1000),
          ayahNumber: ayahKey % 1000,
          verdict: 'CONFLICT',
          category: fromVariant.category,
          title: `${fromVariant.title} ↔ ${toVariant.title}`,
          reason: `رابط دمج يدوي بين وجهين يقرر المحرك أنهما متنافيان (${a} × ${b}).`,
          source: 'EDITOR',
          context: fromVariant.recitationMode,
          variantId: fromVariant.id,
        });
      }
    } else if (link.kind === 'LINE_TO_LINE' && link.from.type === 'LINE' && link.to.type === 'LINE') {
      // أسطر العرض ببادئة variant:: تحمل معرّف اختلافها: يمكن حسم تنافيهما حتميا.
      const fromId = link.from.id.startsWith('variant::') ? link.from.id.slice('variant::'.length) : '';
      const toId = link.to.id.startsWith('variant::') ? link.to.id.slice('variant::'.length) : '';
      const fromVariant = fromId ? variantById.get(fromId) : undefined;
      const toVariant = toId ? variantById.get(toId) : undefined;
      if (!fromVariant || !toVariant) continue;
      const a = editorCategoryToStudioType(fromVariant.category);
      const b = editorCategoryToStudioType(toVariant.category);
      const { decision } = resolveRelationExclusion(a, b, profile);
      if (decision.exclusive) {
        positions.push({
          id: `conflict:${link.id}`,
          ayahKey,
          surahNumber: Math.floor(ayahKey / 1000),
          ayahNumber: ayahKey % 1000,
          verdict: 'CONFLICT',
          category: fromVariant.category,
          title: `سطر «${fromVariant.title}» دُمج يدويا بسطر «${toVariant.title}»`,
          reason: `دمج سطرين يدويا بينهما تنافٍ بحسب قرار المحرك (${a} × ${b}).`,
          source: 'EDITOR',
          context: fromVariant.recitationMode,
          variantId: fromVariant.id,
        });
      }
    }
  }
  return positions;
}

// ==================== واجهة التحقق ====================

/**
 * يقارن نتيجة المحرك بالمرجعي (Final) على كل المواضع ويعيد المواضع
 * مصنفة + ملخصا كميا. بلا تخزين مكرر (DM-16): يقرأ الكيانات نفسها.
 */
export function validateAgainstReference(input: ValidationInput): ValidationResult {
  const positions: ValidationPosition[] = [];
  const rulesById = new Map(input.rules.map((rule) => [rule.id, rule]));

  for (const doc of input.documents) {
    for (const variant of doc.variants) {
      const { verdict, reason } = classifyVariant(variant);
      positions.push({
        id: `variant:${doc.ayahKey}:${variant.id}`,
        ayahKey: doc.ayahKey,
        surahNumber: Math.floor(doc.ayahKey / 1000),
        ayahNumber: doc.ayahKey % 1000,
        verdict,
        category: variant.category,
        title: variant.title,
        reason,
        source: variant.origin === 'EDITOR' ? 'EDITOR' : 'ENGINE',
        context: variant.recitationMode,
        variantId: variant.id,
        globalRuleId: variant.globalRuleId,
      });
    }
    positions.push(...conflictPositions(doc.ayahKey, doc.variants, doc.links, input.profile));
  }

  for (const override of input.overrides) {
    const rule = rulesById.get(override.ruleId);
    if (!rule) continue;
    const { verdict, reason } = classifyOverride(override);
    positions.push({
      id: `override:${override.id}`,
      ayahKey: override.ayahKey,
      surahNumber: Math.floor(override.ayahKey / 1000),
      ayahNumber: override.ayahKey % 1000,
      verdict,
      category: rule.category,
      title: `${rule.title}${override.matchedText ? ` · ${override.matchedText}` : ''}`,
      reason,
      source: 'ENGINE',
      variantId: override.id,
      globalRuleId: rule.id,
    });
  }

  const summary: ValidationSummary = {
    total: positions.length,
    correct: positions.filter((p) => p.verdict === 'CORRECT').length,
    wrong: positions.filter((p) => p.verdict === 'WRONG').length,
    missing: positions.filter((p) => p.verdict === 'MISSING').length,
    extra: positions.filter((p) => p.verdict === 'EXTRA').length,
    conflict: positions.filter((p) => p.verdict === 'CONFLICT').length,
  };

  return { positions, summary };
}

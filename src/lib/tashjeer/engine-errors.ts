// مستكشف أخطاء المحرك — Engine Error Explorer (FR-ES-12.2)
// مشروع التشجير - نظام القراءات العشر
//
// يجمع أخطاء المحرك المتكررة من نتائج التحقق من المرجع (T3) حسب نمط
// حتمي مغلقة الأبعاد:
//
//   النمط = الفئة (نوع القاعدة) × التصنيف (فئة القرار) × السياق (وقف/وصل) × المصدر
//
// بلا تقنيات تجميع احتمالية: نفس المدخلات تعطي نفس المجموعات دائما،
// ومن كل نمط تُفتح المواضع المتأثرة في المحرر (تحديد موحد).

import type { VariantCategory } from '@/types';
import type { ValidationPosition, ValidationVerdict } from './reference-validation';

/** نمط خطأ متكرر: مفتاح حتمي + عدّاد + مواضعه المتأثرة. */
export interface ErrorPattern {
  key: string;
  category: VariantCategory;
  verdict: ValidationVerdict;
  source: 'ENGINE' | 'EDITOR';
  context: 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY';
  /** عدد المواضع المتأثرة بهذا النمط. */
  count: number;
  /** المواضع المتأثرة (تُفتح من هنا في المحرر). */
  positions: ValidationPosition[];
}

/** تسمية التصنيف بالعربية (مغلقة — لا منطق عرض في الواجهات). */
export const VERDICT_LABELS: Record<ValidationVerdict, string> = {
  CORRECT: 'صحيح',
  WRONG: 'خاطئ',
  MISSING: 'مفقود',
  EXTRA: 'زائد',
  CONFLICT: 'متعارض',
};

/** تسمية سياق الأداء بالعربية. */
export const CONTEXT_LABELS: Record<'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY', string> = {
  ALWAYS: 'وقف/وصل',
  WAQF_ONLY: 'وقف فقط',
  WASL_ONLY: 'وصل فقط',
};

/** تسمية المصدر بالعربية. */
export const SOURCE_LABELS: Record<'ENGINE' | 'EDITOR', string> = {
  ENGINE: 'المحرك',
  EDITOR: 'المحرر',
};

/**
 * يجمع مواضع التحقق التي هي أخطاء (كل تصنيفات غير Correct) في أنماط
 * حتمية. الترتيب: الأكبر عددا أولا — «النمط A — ٥٢، النمط B — ٣١...».
 */
export function groupEngineErrors(positions: ValidationPosition[]): ErrorPattern[] {
  const groups = new Map<string, ErrorPattern>();

  for (const position of positions) {
    if (position.verdict === 'CORRECT') continue;
    const context = position.context ?? 'ALWAYS';
    const key = `${position.category}|${position.verdict}|${position.source}|${context}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.positions.push(position);
    } else {
      groups.set(key, {
        key,
        category: position.category,
        verdict: position.verdict,
        source: position.source,
        context,
        count: 1,
        positions: [position],
      });
    }
  }

  return [...groups.values()].sort(
    (first, second) => second.count - first.count || first.key.localeCompare(second.key, 'ar')
  );
}

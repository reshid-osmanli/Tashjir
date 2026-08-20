// مصدر تشجير الآية للعرض النهائي - Ayah Tashjeer Source
//
// صفحة المصحف يجب أن ترسم التشجير المحفوظ **والنتيجة المشتقة من القواعد
// العامة** دون أن يفتح المستخدم كل آية في المحرر ويحفظها. القاعدة العامة
// تُحفظ مرة واحدة، ثم تظهر أسطرها في كل موضع مطابق:
//
//   المحرر → حفظ القاعدة أو المستند → /quran ⇒ النتيجة المشجَّرة.
//
// هذه الوحدة هي مصدر الحقيقة لذلك القرار: هل لهذه الآية تشجير يُعرض؟
// وأي مستند يُمرَّر إلى خط الرسم نفسه الذي يستعمله المحرر؟

import { getSurahAyahs } from '@/data/quran';
import { findGlobalRuleMatchesInAyah } from '@/lib/quran-logic/global-rule-engine';
import {
  createDocument,
  hasDocument,
  listDocuments,
  loadDocument,
} from '@/lib/storage/document-store';
import { listGlobalRules } from '@/lib/storage/global-rules-store';
import type { TashjeerDocument } from '@/types/tashjeer';

/** القواعد النشطة ذات النمط الآلي: مصدر التشجير عبر المصحف بلا مستند لكل آية. */
function activePatternRules() {
  return listGlobalRules().filter((rule) => rule.isActive && Boolean(rule.pattern));
}

/** هل تطابق هذه الآية قاعدة عامة نشطة؟ */
export function ayahMatchesActiveGlobalRule(ayahKey: number): boolean {
  for (const rule of activePatternRules()) {
    if (findGlobalRuleMatchesInAyah(rule, ayahKey).length > 0) return true;
  }
  return false;
}

/**
 * هل لهذه الآية تشجير يُعرض في المصحف؟
 *
 * نعم إن كان لها مستند محفوظ، أو إن طابقت قاعدة عامة نشطة. البذور التجريبية
 * لا تُعرض من تلقاء نفسها: ظهورها مشروط بحفظ المحقق للمستند.
 */
export function ayahHasTashjeerContent(ayahKey: number): boolean {
  if (hasDocument(ayahKey)) return true;
  return ayahMatchesActiveGlobalRule(ayahKey);
}

/**
 * مستند العرض: المحفوظ إن وُجد، وإلا مستند مشتق من القواعد العامة (بلا حفظ).
 * يُمرَّر إلى نفس خط رسم المحرر فتتطابق النتيجتان.
 */
export function resolveAyahDocument(ayahKey: number): TashjeerDocument | null {
  const saved = loadDocument(ayahKey);
  if (saved) return saved;
  if (!ayahMatchesActiveGlobalRule(ayahKey)) return null;
  return createDocument(ayahKey);
}

/**
 * معرّفات آيات السورة التي لها تشجير يُعرض: محفوظ أو مشتق من قاعدة عامة.
 *
 * الفحص لكل آية × كل قاعدة النشطة؛ السورة الأطول (البقرة) مع بضع قواعد
 * تبقى في حدود مقبول لصفحة المصحف.
 */
export function surahAyahsWithTashjeer(surahNumber: number): Set<number> {
  const keys = new Set<number>();

  for (const entry of listDocuments()) {
    if (entry.surahNumber === surahNumber) keys.add(entry.ayahKey);
  }

  const rules = activePatternRules();
  if (rules.length === 0) return keys;

  for (const ayah of getSurahAyahs(surahNumber)) {
    if (keys.has(ayah.key)) continue;
    for (const rule of rules) {
      if (findGlobalRuleMatchesInAyah(rule, ayah.key).length > 0) {
        keys.add(ayah.key);
        break;
      }
    }
  }

  return keys;
}

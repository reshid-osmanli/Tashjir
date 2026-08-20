// مخزن التتبع - Tracking Store
//
// نظام التتبع يجيب عن أسئلة المحقق الأربعة:
//
//   ماذا وجد المحرك؟      → مواضع القواعد المشتقة (isGlobalDerived) والاختلافات
//                            الأساسية التي لم يمسها المحرر (origin: ENGINE).
//   ماذا أضاف المحرر؟      → الاختلافات التي أنشئت يدويا (origin: EDITOR).
//   ماذا صحّح المحرر؟      → سجل التعديل editLog: القيم قبل/بعد لكل تصحيح.
//   ما الفرق بينهما؟       → كل موضع معدَّل يعرض فروقه، والرتب اليدوية تظهر
//                            بإزاحتها عن ترتيب المحرك.
//
// التتبع لا يخزن شيئا جديدا: يقرأ المستندات المخزنة وسجل استثناءات القواعد
// ويجمعها في صورة قابلة للتصفية حسب الفئة (المدود، الفرش، الأصول...) والمصدر
// والحالة، مع رابط مباشر لفتح الموضع في المحرر.

import type { VariantCategory } from '@/types';
import type { DocumentEditEntry, Variant, VerificationStatus } from '@/types/tashjeer';
import { loadDocument, listDocuments } from './document-store';
import { listGlobalRules } from './global-rules-store';
import { listOccurrenceOverrides } from './rule-occurrences-store';

/** مصدر الموضع كما يظهر في التتبع. */
export type TrackingSource = 'ENGINE' | 'EDITOR';

/** سطر تتبع واحد: موضع قاعدة/اختلاف مع حالته وتصحيحاته. */
export interface TrackingRow {
  id: string;
  ayahKey: number;
  surahNumber: number;
  ayahNumber: number;
  variantId: string;
  title: string;
  category: VariantCategory;
  /** من وجد هذا الموضع: المحرك أم المحرر. */
  source: TrackingSource;
  /** هل عُدّل يدويا بعد أن اقترحه المحرك؟ */
  manuallyModified: boolean;
  /** حالة التوثيق الحالية. */
  status: VerificationStatus;
  /** آخر تعديل يدوي على هذا الموضع. */
  lastEditedAt?: string;
  /** فروق التصحيح اليدوي: ملخصات قبل/بعد. */
  edits: Array<Pick<DocumentEditEntry, 'at' | 'action' | 'summary' | 'changes' | 'actor'>>;
  /** موضع مشتق من قاعدة عامة (يرد اسمها للعرض). */
  globalRuleId?: string;
  globalRuleTitle?: string;
  /** رتبة الترتيب اليدوية إن ثُبّتت. */
  orderRank?: number;
}

/** إحصاءات التتبع حسب الفئة والمصدر. */
export interface TrackingSummary {
  total: number;
  engine: number;
  editor: number;
  modified: number;
  byCategory: Record<string, number>;
}

export interface TrackingFilters {
  category?: VariantCategory | 'ALL';
  source?: TrackingSource | 'MODIFIED' | 'ALL';
}

/** يقرأ كل مواضع التتبع من المستندات المخزنة. */
export function readTrackingRows(filters: TrackingFilters = {}): TrackingRow[] {
  const rulesById = new Map(listGlobalRules().map((rule) => [rule.id, rule]));
  const rows: TrackingRow[] = [];

  for (const entry of listDocuments()) {
    const document = loadDocument(entry.ayahKey);
    if (!document) continue;

    const log = document.editLog ?? [];
    const editsByTarget = new Map<string, DocumentEditEntry[]>();
    for (const logEntry of log) {
      const key = `${logEntry.targetType}:${logEntry.targetId}`;
      const existing = editsByTarget.get(key) ?? [];
      existing.push(logEntry);
      editsByTarget.set(key, existing);
    }

    for (const variant of document.variants) {
      rows.push(rowForVariant(variant, document.ayahKey, editsByTarget, rulesById));
    }
  }

  return rows
    .filter((row) => (filters.category ? filters.category === 'ALL' || row.category === filters.category : true))
    .filter((row) => {
      if (!filters.source || filters.source === 'ALL') return true;
      if (filters.source === 'MODIFIED') return row.manuallyModified;
      return row.source === filters.source;
    })
    .sort(
      (first, second) =>
        first.ayahKey - second.ayahKey ||
        (second.lastEditedAt ?? '').localeCompare(first.lastEditedAt ?? '')
    );
}

function rowForVariant(
  variant: Variant,
  ayahKey: number,
  editsByTarget: Map<string, DocumentEditEntry[]>,
  rulesById: Map<string, { id: string; title: string }>
): TrackingRow {
  const variantEdits = editsByTarget.get(`VARIANT:${variant.id}`) ?? [];
  const alternativeEdits = variant.alternatives.flatMap(
    (alternative) => editsByTarget.get(`ALTERNATIVE:${alternative.id}`) ?? []
  );
  const edits = [...variantEdits, ...alternativeEdits].sort((first, second) =>
    first.at.localeCompare(second.at)
  );

  // المصدر: الاختلافات المشتقة من القواعد العامة يجدها المحرك، وما أنشأه
  // المحرر يوسم EDITOR عند الإنشاء. ما عدّله المحرر يبقى على مصدره الأول مع
  // وسم «معدل يدويا».
  const source: TrackingSource = variant.origin === 'EDITOR' ? 'EDITOR' : 'ENGINE';

  return {
    id: `${ayahKey}:${variant.id}`,
    ayahKey,
    surahNumber: Math.floor(ayahKey / 1000),
    ayahNumber: ayahKey % 1000,
    variantId: variant.id,
    title: variant.title,
    category: variant.category,
    source,
    manuallyModified: edits.length > 0,
    status: variant.status,
    lastEditedAt: edits[edits.length - 1]?.at,
    edits: edits.map(({ at, action, summary, changes, actor }) => ({
      at,
      action,
      summary,
      changes,
      actor,
    })),
    globalRuleId: variant.globalRuleId,
    globalRuleTitle: variant.globalRuleId
      ? rulesById.get(variant.globalRuleId)?.title
      : undefined,
    orderRank: variant.orderRank,
  };
}

/** ملخص التتبع: كم وجد المحرك، وكم أضاف المحرر، وكم عُدّل. */
export function trackingSummary(rows: TrackingRow[]): TrackingSummary {
  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
  }

  return {
    total: rows.length,
    engine: rows.filter((row) => row.source === 'ENGINE').length,
    editor: rows.filter((row) => row.source === 'EDITOR').length,
    modified: rows.filter((row) => row.manuallyModified).length,
    byCategory,
  };
}

/** توزيع حالات استثناءات القواعد العامة على المصحف، لصفحة التتبع. */
export function readOccurrenceOverrideSummary(): {
  deleted: number;
  confirmed: number;
  edited: number;
} {
  const overrides = listOccurrenceOverrides();
  return {
    deleted: overrides.filter((item) => item.state === 'DELETED').length,
    confirmed: overrides.filter((item) => item.state === 'CONFIRMED').length,
    edited: overrides.filter(
      (item) => item.strengthDegreeId || item.strengthByNarrator || typeof item.orderRank === 'number'
    ).length,
  };
}

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
import { findGlobalRuleMatches, getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
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
  source: TrackingSource;
  manuallyModified: boolean;
  status: VerificationStatus;
  lastEditedAt?: string;
  edits: Array<Pick<DocumentEditEntry, 'at' | 'action' | 'summary' | 'changes' | 'actor'>>;
  globalRuleId?: string;
  globalRuleTitle?: string;
  orderRank?: number;
  /** بيانات التصحيح النهائية: Engine + Editor + Final */
  correction?: { engine?: string; editor?: string; final: string };
  recitationMode?: string;
  batchGroupId?: string;
  isIndependent?: boolean;
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
  /**
   * عند اختيار فئة (المدود، الفرش...) يفحص القواعد العامة المطابقة ويضيف
   * مواضعها. الحد يمنع تجميد الواجهة إن أصابت القاعدة آلاف المواضع.
   */
  scanGlobalMatches?: boolean;
  matchLimit?: number;
}

/** أقصى عدد مواضع مشتقة تُدرج لكل قاعدة عند المسح. */
const DEFAULT_MATCH_LIMIT = 80;

/** يقرأ كل مواضع التتبع من المستندات المخزنة والقواعد العامة. */
export function readTrackingRows(filters: TrackingFilters = {}): TrackingRow[] {
  const rules = listGlobalRules();
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const rows: TrackingRow[] = [];
  const seen = new Set<string>();

  const push = (row: TrackingRow) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    rows.push(row);
  };

  for (const entry of listDocuments()) {
    const document = loadDocument(entry.ayahKey);
    if (!document) continue;

    const log = document.editLog ?? [];
    const editsByTarget = indexEdits(log);

    for (const variant of getEffectiveVariants(document)) {
      push(rowForVariant(variant, document.ayahKey, editsByTarget, rulesById));
    }

    for (const logEntry of log) {
      if (
        logEntry.targetType === 'VARIANT' ||
        logEntry.targetType === 'ALTERNATIVE' ||
        logEntry.targetType === 'RULE'
      ) {
        continue;
      }
      push(rowForEdit(logEntry, document.ayahKey));
    }
  }

  for (const override of listOccurrenceOverrides()) {
    const rule = rulesById.get(override.ruleId);
    if (!rule) continue;
    const id = `${override.ayahKey}:${override.id}`;
    if (seen.has(id)) continue;
    push({
      id,
      ayahKey: override.ayahKey,
      surahNumber: Math.floor(override.ayahKey / 1000),
      ayahNumber: override.ayahKey % 1000,
      variantId: override.id,
      title: `${rule.title}${override.matchedText ? ` · ${override.matchedText}` : ''}`,
      category: rule.category,
      source: 'ENGINE',
      manuallyModified: true,
      status: override.state === 'DELETED' ? 'REJECTED' : rule.status,
      lastEditedAt: override.updatedAt,
      edits: [
        {
          at: override.updatedAt,
          action:
            override.state === 'DELETED'
              ? 'حذف موضعي'
              : typeof override.orderRank === 'number'
                ? 'تعديل ترتيب السطر'
                : 'تعديل موضع قاعدة',
          summary: override.reason ?? 'تصحيح يدوي لموضع القاعدة العامة',
          actor: 'محرر محلي',
          changes: [
            ...(typeof override.orderRank === 'number'
              ? [{ field: 'orderRank', after: override.orderRank }]
              : []),
            ...(override.strengthDegreeId
              ? [{ field: 'strengthDegreeId', after: override.strengthDegreeId }]
              : []),
          ],
        },
      ],
      globalRuleId: rule.id,
      globalRuleTitle: rule.title,
      orderRank: override.orderRank ?? rule.orderRank,
    });
  }

  const category = filters.category && filters.category !== 'ALL' ? filters.category : undefined;
  if (filters.scanGlobalMatches && category) {
    const limit = filters.matchLimit ?? DEFAULT_MATCH_LIMIT;
    for (const rule of rules) {
      if (!rule.isActive || !rule.pattern || rule.category !== category) continue;
      const matches = findGlobalRuleMatches(rule, { limit });
      for (const match of matches) {
        const ayahKey = match.ayahKey ?? 0;
        const variantId = [
          'global',
          rule.id,
          ayahKey,
          match.startPosition,
          match.endPosition,
          match.characterRange.start.characterIndex,
          match.characterRange.end.characterIndex,
        ].join(':');
        push({
          id: `${ayahKey}:${variantId}`,
          ayahKey,
          surahNumber: Math.floor(ayahKey / 1000),
          ayahNumber: ayahKey % 1000,
          variantId,
          title: `${rule.title} · ${match.matchedText}`,
          category: rule.category,
          source: 'ENGINE',
          manuallyModified: false,
          status: rule.status,
          edits: [],
          globalRuleId: rule.id,
          globalRuleTitle: rule.title,
          orderRank: rule.orderRank,
        });
      }
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

function indexEdits(log: DocumentEditEntry[]): Map<string, DocumentEditEntry[]> {
  const editsByTarget = new Map<string, DocumentEditEntry[]>();
  for (const logEntry of log) {
    const key = `${logEntry.targetType}:${logEntry.targetId}`;
    const existing = editsByTarget.get(key) ?? [];
    existing.push(logEntry);
    editsByTarget.set(key, existing);
  }
  return editsByTarget;
}

function rowForEdit(entry: DocumentEditEntry, ayahKey: number): TrackingRow {
  return {
    id: `edit:${entry.id}`,
    ayahKey,
    surahNumber: Math.floor(ayahKey / 1000),
    ayahNumber: ayahKey % 1000,
    variantId: entry.targetId,
    title: entry.summary,
    category: entry.category ?? 'FARSH',
    source: 'EDITOR',
    manuallyModified: true,
    status: 'DRAFT',
    lastEditedAt: entry.at,
    edits: [
      {
        at: entry.at,
        action: entry.action,
        summary: entry.summary,
        changes: entry.changes,
        actor: entry.actor,
      },
    ],
  };
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
  const ruleEdits = editsByTarget.get(`RULE:${variant.id}`) ?? [];
  const edits = [...variantEdits, ...alternativeEdits, ...ruleEdits].sort((first, second) => first.at.localeCompare(second.at));

  const source: TrackingSource = variant.source === 'EDITOR' || variant.origin === 'EDITOR' ? 'EDITOR' : 'ENGINE';

  return {
    id: `${ayahKey}:${variant.id}`,
    ayahKey,
    surahNumber: Math.floor(ayahKey / 1000),
    ayahNumber: ayahKey % 1000,
    variantId: variant.id,
    title: variant.title,
    category: variant.category,
    source,
    manuallyModified: edits.length > 0 || (variant as any).modifiedBy === 'EDITOR',
    status: variant.status,
    lastEditedAt: edits[edits.length - 1]?.at ?? (variant as any).editorModifiedAt,
    edits: edits.map(({ at, action, summary, changes, actor }) => ({ at, action, summary, changes, actor })),
    globalRuleId: variant.globalRuleId,
    globalRuleTitle: variant.globalRuleId ? rulesById.get(variant.globalRuleId)?.title : undefined,
    orderRank: variant.orderRank,
    correction: (variant as any).correction ?? { final: variant.title, engine: (variant as any).engineSnapshot?.title, editor: variant.title },
    recitationMode: (variant as any).recitationMode ?? (variant as any).waqfContext?.mode,
    batchGroupId: (variant as any).batchGroupId,
    isIndependent: (variant as any).isIndependent,
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

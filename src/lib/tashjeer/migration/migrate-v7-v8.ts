// ترحيل v7 → v8 — Migration (DM-18, NFR-05)
//
// يحوّل المستند القائم (TashjeerDocument، الموسوم داخليا v8 لكنه بنيويًا
// قديم: variants/links/boundaries/segments/editLog) إلى النموذج الموحّد v8
// (differences/relations/waqfMarks/corrections/renderRanges/auditLog).
//
// - الترحيل حتمي وآمن: لا يفقد بيانات (P-13)، ويُجرى بعد نسخة احتياطية.
// - كل كيان يحتفظ بمعرّفه الأصلي (P-03)، ويُضاف له ما يلزم فقط.
// - لا يُعدّل المستند الأصلي (دالة نقية).

import type {
  TashjeerDocument,
  Variant,
  TashjeerLink,
  RecitationBoundary,
  LineSegment as LegacyLineSegment,
  DocumentEditEntry,
} from '@/types/tashjeer';
import type {
  Difference,
  Variant as V8Variant,
  VariantEvidence,
  Relation,
  RelationType,
  WaqfMark,
  WaqfMarkKind,
  Correction,
  RenderRange,
  Line,
  LineSegment,
  TashjeerDocumentV8,
  RecitationContext,
  Locus,
} from '@/lib/tashjeer/model/v8';
import { createEntityId, linkKindToRelationType } from '@/lib/tashjeer/model/v8';
import { resolveOccurrenceIndices } from '@/lib/tashjeer/multi-difference';

/**
 * اسم إجراء التصحيح اليدوي لعلاقة التنافي كما يسجَّله المحرر في سجل التعديل.
 * الترحيل يحوّل كل سطر بهذا الإجراء إلى Correction في v8: اقتراح المحرك
 * (قبل) ← قرار المحرر (بعد). القيمة ثابتة تعاقدية بين المخزن والترحيل.
 */
export const LOCUS_RELATION_CORRECTION_ACTION = 'تصحيح علاقة التنافي';

/** يحوّل سياق الأداء القديم إلى الجديد (DM-06). */
function toContext(variant: Variant): RecitationContext {
  if (variant.recitationMode === 'WAQF_ONLY') return 'WAQF_ONLY';
  if (variant.recitationMode === 'WASL_ONLY') return 'WASL_ONLY';
  return 'ALWAYS';
}

/**
 * النطاق في النموذج القديم على الأوجه (VariantAlternative) لا على الاختلاف
 * (Variant). نشتقّ نطاق الاختلاف من أول وجه غير أساسي (أو أول وجه). يبقى
 * معرّف الموضع ثابتا (P-03) ولا يُفقد نطاق. عند غياب الأوجه نسقط إلى العام.
 */
function deriveScope(variant: Variant): Variant['alternatives'][number]['scope'] {
  const first = variant.alternatives.find((alt) => !alt.isBase) ?? variant.alternatives[0];
  return first?.scope ?? { kind: 'ALL' };
}

function toLocus(variant: Variant): Locus {
  const base: Locus = {
    startPosition: variant.startPosition,
    endPosition: variant.endPosition,
  };
  if (variant.characterRange) base.characterRange = variant.characterRange;
  if (variant.loci && variant.loci.length > 0) {
    base.loci = variant.loci.map((locus) => ({
      startPosition: locus.startPosition,
      endPosition: locus.endPosition,
      characterRange: locus.characterRange,
    }));
  }
  return base;
}

function toV8Variant(alt: Variant['alternatives'][number], rankIndex: number): V8Variant {
  return {
    id: alt.id,
    text: alt.text,
    label: alt.label,
    scope: alt.scope,
    isBase: alt.isBase,
    strengthDegreeId: alt.strengthDegreeId,
    strengthByNarrator: alt.strengthByNarrator,
    rank: rankIndex + 1,
    ruleLabel: alt.ruleLabel,
    maddHarakat: alt.maddHarakat,
    notes: alt.notes,
    evidences: (alt.evidences as VariantEvidence[] | undefined)?.map((evidence) => ({
      id: evidence.id,
      source: evidence.source,
      text: evidence.text,
      reference: evidence.reference,
      url: evidence.url,
    })),
    source: 'editor',
    copiedFrom: alt.copiedFrom,
    createdAt: alt.createdAt ?? alt.id,
    updatedAt: alt.updatedAt ?? alt.id,
  };
}

/** يحوّل اختلافا قديما (Variant) إلى اختلاف موحّد (Difference). */
export function migrateVariantToDifference(
  variant: Variant,
  ayahKey: number,
  occurrenceIndex: number,
  positionRank: number
): Difference {
  const variants = variant.alternatives
    .filter((alt) => !alt.isBase)
    .map((alt, index) => toV8Variant(alt, index));

  const difference: Difference = {
    id: variant.id,
    ayahKey,
    category: variant.category,
    title: variant.title,
    locus: toLocus(variant),
    occurrenceIndex,
    context: toContext(variant),
    scope: deriveScope(variant),
    source: variant.origin === 'ENGINE' ? 'engine' : 'editor',
    rank: typeof variant.orderRank === 'number' ? variant.orderRank : positionRank + 1,
    version: 1,
    status: variant.status,
    variants,
    relations: [],
    orderRank: variant.orderRank,
    variantOrder: variant.alternativeOrder,
    isGlobalDerived: variant.isGlobalDerived,
    globalRuleId: variant.globalRuleId,
    sourceRef: variant.sourceRef,
    description: variant.description,
    copiedFrom: variant.copiedFrom,
    createdAt: variant.createdAt ?? variant.id,
    updatedAt: variant.updatedAt ?? variant.id,
  };

  if (variant.engineSnapshot) {
    difference.engineSnapshot = {
      title: variant.engineSnapshot.title,
      category: variant.engineSnapshot.category,
      variants: variant.engineSnapshot.alternatives.map((alt, index) => toV8Variant(alt, index)),
      capturedAt: variant.engineSnapshot.capturedAt,
    };
  }
  if (variant.editorModifiedAt) difference.editorModifiedAt = variant.editorModifiedAt;

  return difference;
}

/** يحوّل رابطا قديما إلى علاقة موحّدة (DM-03). */
export function migrateLinkToRelation(link: TashjeerLink): Relation {
  // علاقة الموضع اليدوية (FR-ED-03): طرفاها اختلافان، وقرارها يحدد النوع.
  if (link.kind === 'DIFFERENCE_TO_DIFFERENCE') {
    const type: RelationType =
      link.locusVerdict === 'EXCLUSIVE' ? 'MUTUALLY_EXCLUSIVE' : 'RELATED';
    return {
      id: link.id,
      type,
      fromId: `DIFFERENCE:${link.from.id}`,
      toId: `DIFFERENCE:${link.to.id}`,
      note: link.notes,
      source: link.origin === 'ENGINE' ? 'engine' : 'editor',
      createdAt: link.createdAt,
    };
  }
  const type: RelationType = linkKindToRelationType(link.kind);
  return {
    id: link.id,
    type,
    fromId: link.from.type === 'FACE' ? link.from.id.slice(link.from.id.indexOf('::') + 2) : link.from.id,
    toId: link.to.type === 'FACE' ? link.to.id.slice(link.to.id.indexOf('::') + 2) : link.to.id,
    note: link.notes,
    source: link.origin === 'ENGINE' ? 'engine' : 'editor',
    createdAt: link.createdAt,
  };
}

/** يحوّل علامة وقف/ابتداء قديمة إلى WaqfMark (DM-07). */
export function migrateBoundaryToWaqfMark(boundary: RecitationBoundary, ayahKey: number): WaqfMark {
  const kindMap: Record<RecitationBoundary['kind'], WaqfMarkKind> = {
    WAQF: 'WAQF',
    IBTIDA: 'IBTIDA',
    NO_WASL: 'FORBIDDEN_WASL',
    WASL: 'WASL',
  };
  return {
    id: boundary.id,
    ayahKey,
    position: boundary.position,
    characterIndex: undefined,
    kind: kindMap[boundary.kind],
    scope: boundary.connectsToNextAyah ? 'END_OF_AYAH' : 'INTERNAL',
    connectsToNextAyah: boundary.connectsToNextAyah,
    label: boundary.label,
    notes: boundary.notes,
    source: 'editor',
    createdAt: boundary.id,
  };
}

function migrateSegment(segment: LegacyLineSegment, ayahKey: number): LineSegment {
  return {
    id: segment.id,
    ayahKey,
    title: segment.title,
    startPosition: segment.startPosition,
    endPosition: segment.endPosition,
    characterRange: segment.characterRange,
    notes: segment.notes,
    origin: segment.origin === 'ENGINE' ? 'engine' : 'editor',
    createdAt: segment.createdAt,
    updatedAt: segment.updatedAt,
  };
}

/**
 * يحوّل مستندا كاملا إلى النموذج الموحّد v8.
 * دالة نقية: لا تعدّل `document`، وتُرجع مستندا جديدا.
 */
export function migrateDocumentToV8(
  document: TashjeerDocument,
  options?: { appVersion?: string; profile?: string }
): TashjeerDocumentV8 {
  // فهرس التعدد (DM-09): المخزّن على الاختلاف يُحترم، والمفقود يُشتق
  // بالترتيب ضمن مجموعة (قارئ × موضع) — الدالة نفسها التي يستعملها المحرر.
  const occurrenceIndex = resolveOccurrenceIndices(document.variants);

  const differences: Difference[] = document.variants.map((variant, index) =>
    migrateVariantToDifference(
      variant,
      document.ayahKey,
      occurrenceIndex.get(variant.id) ?? 1,
      index
    )
  );

  // العلاقات على مستوى المستند من الروابط القديمة.
  const relations: Relation[] = (document.links ?? []).map(migrateLinkToRelation);

ain
  }

  const waqfMarks: WaqfMark[] = (document.boundaries ?? []).map((boundary) =>
    migrateBoundaryToWaqfMark(boundary, document.ayahKey)
  );

  const corrections: Correction[] = [...(document.corrections ?? [])];
  for (const variant of document.variants) {
    if (!variant.engineSnapshot) continue;
    corrections.push({
      id: createEntityId('corr'),
      targetId: variant.id,
      engineResult: variant.engineSnapshot,
      editorResult: null,
      finalResult: {
        title: variant.title,
        category: variant.category,
        alternatives: variant.alternatives,
      },
      at: variant.engineSnapshot.capturedAt,
      source: 'editor',
    });
  }

  // تصحيحات علاقات التنافي اليدوية (FR-ED-03): المحرك يقترح (قبل) والمحرر
  // يقرر (بعد = النهائي). تُسجَّل في سجل التعديل بإجراء ثابت، وهنا تُرفَع
  // إلى Correction موحّدة بهدفها (رابط الموضع) وسببها.
  for (const entry of document.editLog ?? []) {
    if (entry.action !== LOCUS_RELATION_CORRECTION_ACTION) continue;
    const change = entry.changes?.find((item) => item.field === 'locusRelation');
    corrections.push({
      id: createEntityId('corr'),
      targetId: entry.targetId,
      engineResult: change?.before ?? null,
      editorResult: change?.after ?? null,
      finalResult: change?.after ?? null,
      reason: entry.summary,
      at: entry.at,
      source: 'editor',
    });
  }

  const renderRanges: RenderRange[] = [];
  if (document.readingWindow?.focusSegment) {
    renderRanges.push({
      id: createEntityId('range'),
      ayahKey: document.ayahKey,
      fromPosition: document.readingWindow.focusSegment.startPosition,
      toPosition: document.readingWindow.focusSegment.endPosition,
      label: 'نطاق العرض المعزول',
    });
  }

  const lines: Line[] = [...(document.lines ?? []), ...(document.manualLines ?? []).filter((line) => !document.lines?.some((saved) => saved.id === line.id)).map((line) => ({
    id: line.id,
    ayahKey: document.ayahKey,
    order: line.lane,
    title: line.title,
    category: line.category,
    readerScope: line.scope ?? { kind: 'ALL' },
    segments: (document.segments ?? []).filter(
      (segment) =>
        segment.startPosition >= line.startPosition && segment.endPosition <= line.endPosition
    ).map((segment) => migrateSegment(segment, document.ayahKey)),
    compositeFaceRefs: [],
    source: 'editor' as const,
    locked: line.isHidden,
    createdAt: line.id,
    updatedAt: line.id,
  }))];

  const auditLog = (document.editLog ?? []).map((entry: DocumentEditEntry) => ({
    id: entry.id,
    at: entry.at,
    actor: entry.actor,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    summary: entry.summary,
    changes: entry.changes,
    source: (entry.origin === 'ENGINE' ? 'engine' : 'editor') as 'engine' | 'editor',
  }));

  return {
    format: 'tashjeer-export',
    schemaVersion: 8,
    exportedAt: new Date().toISOString(),
    meta: {
      appVersion: options?.appVersion ?? '0.1.0',
      profile: options?.profile ?? 'default',
    },
    ayahKey: document.ayahKey,
    surahNumber: document.surahNumber,
    ayahNumber: document.ayahNumber,
    differences,
    lines,
    relations,
    waqfMarks,
    ruleOccurrences: [],
    renderRanges,
    corrections,
    mergeRecords: document.mergeRecords,
    deletedItems: document.deletedItems,
    suspendedLinks: document.suspendedLinks,
    auditLog,
    readingWindow: {
      linkNextAyah: document.readingWindow?.linkNextAyah === true,
      focusSegment: document.readingWindow?.focusSegment ?? null,
    },
    lineOrder: document.lineOrder ?? [],
    createdAt: document.meta?.createdAt ?? new Date().toISOString(),
    updatedAt: document.meta?.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * يُنشئ نسخة احتياطية نصية قبل الترحيل (NFR-04).
 * يُرجع JSON يمكن حفظه أو إرجاعه عند الفشل.
 */
export function backupBeforeMigration(original: unknown): string {
  return JSON.stringify(
    { backedUpAt: new Date().toISOString(), schemaVersion: (original as { schemaVersion?: number })?.schemaVersion, payload: original },
    null,
    2
  );
}

/**
 * يُرحّل مستندا مع نسخة احتياطية، ويعيد المستند المحوّل والنسخة الاحتياطية.
 * يرمي عند فشل الترحيل مع إبقاء النسخة الاحتياطية متاحة.
 */
export function migrateWithBackup(
  document: TashjeerDocument,
  options?: { appVersion?: string; profile?: string }
): { v8: TashjeerDocumentV8; backup: string } {
  const backup = backupBeforeMigration(document);
  const v8 = migrateDocumentToV8(document, options);
  return { v8, backup };
}

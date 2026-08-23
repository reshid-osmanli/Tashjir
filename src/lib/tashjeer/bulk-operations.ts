// العمليات الجماعية - Bulk Operations
// FR-ED-07: التحديد المتعدد والحذف الجماعي
//
// يوفر:
//   - حذف جماعي لعدة أوجه/اختلافات/أسطر
//   - تأكيد كمي قبل التنفيذ
//   - حساب العلاقات التي ستفقد مرجعها
//   - سجل التراجع لعملية واحدة

import type { Variant, TashjeerLink } from '@/types/tashjeer';

// ==================== أنواع العمليات الجماعية ====================

export type BulkTargetKind = 'DIFFERENCE' | 'FACE' | 'SEGMENT' | 'LINE';

export interface BulkDeleteTarget {
  kind: BulkTargetKind;
  id: string;
  label: string;
}

export interface BulkDeleteConfirmation {
  /** عدد العناصر المحددة. */
  totalCount: number;
  /** ملخص الأنواع. */
  summary: Record<BulkTargetKind, number>;
  /** العلاقات التي ستفقد مرجعها. */
  orphanedRelations: Array<{
    linkId: string;
    description: string;
  }>;
  /** تحذير للمستخدم. */
  warning: string | null;
}

// ==================== الحساب ====================

/**
 * يحسب بيانات التأكيد لحذف جماعي.
 */
export function calculateBulkDeleteConfirmation(
  targets: BulkDeleteTarget[],
  links: TashjeerLink[],
  _variants: Variant[]
): BulkDeleteConfirmation {
  const summary: Record<BulkTargetKind, number> = {
    DIFFERENCE: 0,
    FACE: 0,
    SEGMENT: 0,
    LINE: 0,
  };

  for (const target of targets) {
    summary[target.kind]++;
  }

  // حساب العلاقات اليتيمة.
  const targetIds = new Set(targets.map((t) => t.id));
  const orphanedRelations: Array<{ linkId: string; description: string }> = [];

  for (const link of links) {
    const fromOrphaned = targetIds.has(link.from.id);
    const toOrphaned = targetIds.has(link.to.id);

    if (fromOrphaned || toOrphaned) {
      const orphanedSide = fromOrphaned ? link.from : link.to;
      const survivingSide = fromOrphaned ? link.to : link.from;
      orphanedRelations.push({
        linkId: link.id,
        description: `علاقة ${link.kind} (${link.relation}): ${orphanedSide.type} ${orphanedSide.id} → ${survivingSide.type} ${survivingSide.id}`,
      });
    }
  }

  // تحذير إن كانت هناك علاقات يتيمة.
  const warning = orphanedRelations.length > 0
    ? `${orphanedRelations.length} علاقة ستفقد مرجعها`
    : null;

  return {
    totalCount: targets.length,
    summary,
    orphanedRelations,
    warning,
  };
}

// ==================== التنفيذ ====================

/**
 * يُرجع قائمة الاختلافات بعد حذف العناصر المحددة.
 */
export function applyBulkDeleteDifferences(
  variants: Variant[],
  idsToDelete: string[]
): Variant[] {
  const deleteSet = new Set(idsToDelete);
  return variants.filter((v) => !deleteSet.has(v.id));
}

/**
 * يُرجع قائمة الأوجه بعد حذف أوجه محددة من اختلافاتها.
 */
export function applyBulkDeleteFaces(
  variants: Variant[],
  facesToDelete: Array<{ variantId: string; alternativeId: string }>
): Variant[] {
  const deleteMap = new Map<string, Set<string>>();
  for (const face of facesToDelete) {
    if (!deleteMap.has(face.variantId)) {
      deleteMap.set(face.variantId, new Set());
    }
    deleteMap.get(face.variantId)!.add(face.alternativeId);
  }

  return variants.map((variant) => {
    const faceIds = deleteMap.get(variant.id);
    if (!faceIds) return variant;
    return {
      ...variant,
      alternatives: variant.alternatives.filter((alt) => !faceIds.has(alt.id)),
    };
  });
}

/**
 * يُرجع قائمة الروابط بعد إزالة العلاقات اليتيمة.
 */
export function pruneOrphanedLinks(
  links: TashjeerLink[],
  deletedIds: string[]
): TashjeerLink[] {
  const deleteSet = new Set(deletedIds);
  return links.filter(
    (link) => !deleteSet.has(link.from.id) && !deleteSet.has(link.to.id)
  );
}

// ==================== واجهة رسالة التأكيد ====================

/**
 * يبني رسالة تأكيد عربية مفهومة للمستخدم.
 */
export function buildConfirmationMessage(confirmation: BulkDeleteConfirmation): string {
  const parts: string[] = [];

  if (confirmation.summary.DIFFERENCE > 0) {
    parts.push(`${confirmation.summary.DIFFERENCE} اختلاف`);
  }
  if (confirmation.summary.FACE > 0) {
    parts.push(`${confirmation.summary.FACE} وجه`);
  }
  if (confirmation.summary.SEGMENT > 0) {
    parts.push(`${confirmation.summary.SEGMENT} جزء`);
  }
  if (confirmation.summary.LINE > 0) {
    parts.push(`${confirmation.summary.LINE} سطر`);
  }

  const items = parts.join(' و');
  let message = `حذف ${items}؟`;

  if (confirmation.warning) {
    message += `\n\n⚠️ تحذير: ${confirmation.warning}`;
  }

  return message;
}

// ==================== التحقق من الحذف المسموح ====================

/**
 * يتحقق من أن الحذف لا يفقد بيانات محمية.
 * القواعد المحمية لا تُحذف إلا بتأكيد إضافي صريح.
 */
export function validateBulkDelete(
  targets: BulkDeleteTarget[],
  protectedIds: Set<string>
): { valid: boolean; blockedIds: string[]; reason?: string } {
  const blockedIds = targets
    .filter((t) => protectedIds.has(t.id))
    .map((t) => t.id);

  if (blockedIds.length > 0) {
    return {
      valid: false,
      blockedIds,
      reason: `${blockedIds.length} عنصر محمي لا يمكن حذفه`,
    };
  }

  return { valid: true, blockedIds: [] };
}

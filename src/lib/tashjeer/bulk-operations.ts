import type { TashjeerDocument, TashjeerLink } from '@/types/tashjeer';
import type { MultiSelection } from './multi-selection';

export function deletionImpact(document: TashjeerDocument, selection: MultiSelection) {
  const ids = new Set(selection.ids);
  const differences = selection.kind === 'DIFFERENCE' ? document.variants.filter((item) => ids.has(item.id)) : [];
  const faces = selection.kind === 'FACE' ? document.variants.find((item) => item.id === selection.ownerId)?.alternatives.filter((face) => ids.has(face.id)) ?? [] : [];
  const endpoints = new Set(differences.flatMap((item) => [item.id, ...item.alternatives.map((face) => `${item.id}::${face.id}`)]));
  for (const face of faces) endpoints.add(`${selection.ownerId}::${face.id}`);
  const links = (document.links ?? []).filter((link) => endpoints.has(link.from.id) || endpoints.has(link.to.id));
  return { differences, faces, links, count: differences.length + faces.length };
}

/** Deletion archives the entities and links; undo restores the exact snapshot. */
export function deleteItems(document: TashjeerDocument, selection: MultiSelection): TashjeerDocument {
  const impact = deletionImpact(document, selection);
  if (!impact.count) return document;
  const ids = new Set(selection.kind === 'DIFFERENCE' ? impact.differences.map((item) => item.id) : impact.faces.map((item) => item.id));
  const links = new Set(impact.links.map((item) => item.id));
  return {
    ...document,
    variants: selection.kind === 'DIFFERENCE'
      ? document.variants.filter((item) => !ids.has(item.id))
      : document.variants.map((item) => item.id !== selection.ownerId ? item : {
        ...item, alternatives: item.alternatives.filter((face) => !ids.has(face.id)),
        alternativeOrder: item.alternativeOrder?.filter((id) => !ids.has(id)),
      }),
    branches: document.branches.filter((branch) => selection.kind === 'DIFFERENCE' ? !ids.has(branch.variantId) : branch.variantId !== selection.ownerId || !ids.has(branch.alternativeId)),
    links: (document.links ?? []).filter((link) => !links.has(link.id)),
    lines: document.lines?.map((line) => {
      const removedFaces = new Set(selection.kind === 'FACE' ? impact.faces.map((face) => face.id) : impact.differences.flatMap((item) => item.alternatives.map((face) => face.id)));
      return { ...line,
        compositeFaceRefs: line.compositeFaceRefs?.filter((id) => !removedFaces.has(id)),
        segments: line.segments.filter((segment) => selection.kind === 'DIFFERENCE'
          ? !segment.differenceIds?.some((id) => ids.has(id))
          : !(segment.differenceIds?.includes(selection.ownerId!) && segment.faceIds?.some((id) => ids.has(id)))),
      };
    }),
    deletedItems: [...(document.deletedItems ?? []), {
      at: new Date().toISOString(), source: 'editor', kind: selection.kind,
      ownerId: selection.ownerId, entities: structuredClone(selection.kind === 'DIFFERENCE' ? impact.differences : impact.faces), links: structuredClone(impact.links),
    }],
  };
}

export interface DeletedItems {
  at: string;
  source: 'editor';
  kind: MultiSelection['kind'];
  ownerId?: string;
  entities: unknown[];
  links: TashjeerLink[];
}

/** سطر مرسوم بأحكامه، بالقدر الذي تحتاجه هذه الوحدة (بلا استيراد المحرك). */
export interface RenderedLineShape {
  id: string;
  entries: Array<{ variantId: string }>;
}

/**
 * اختلافات الأسطر المحددة «الحصرية» (FR-ED-07 — حذف جماعي للأسطر).
 *
 * أسطر المحرر مشتقة من الاختلافات، والسطر الواحد قد يشترك في اختلاف مع سطر
 * آخر (الأسطر المركّبة). فحذف أسطر لا يجوز أن يمسّ قراءة يعرضها سطر باقٍ:
 * يُحذف الاختلاف الذي لا يظهر في أي سطر خارج التحديد، ويُبلَّغ عن المشترك
 * ليبقى. الأجزاء (`segment:`) ليست اختلافات فتُستثنى من العدّ.
 */
export function exclusiveLineDifferences(
  lines: RenderedLineShape[],
  lineIds: string[]
): { exclusive: string[]; shared: string[] } {
  const selected = new Set(lineIds);
  const inside = new Set<string>();
  const outside = new Set<string>();
  for (const line of lines) {
    for (const entry of line.entries) {
      if (!entry.variantId || entry.variantId.startsWith('segment:')) continue;
      (selected.has(line.id) ? inside : outside).add(entry.variantId);
    }
  }
  const exclusive: string[] = [];
  const shared: string[] = [];
  for (const id of inside) (outside.has(id) ? shared : exclusive).push(id);
  return { exclusive, shared };
}

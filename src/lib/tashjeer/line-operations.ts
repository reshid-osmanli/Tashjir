import type { ClassicLine } from './classic-tashjeer';
import type { Line } from './model/v8';
import type { TashjeerDocument } from '@/types/tashjeer';
import { moveLineToIndex } from './manual-links';

/** A gap is zero-based BEFORE removal; a rank is one-based AFTER removal. */
export function planLineInsertion(ids: string[], id: string, gap: number) {
  const from = ids.indexOf(id);
  if (from < 0 || !Number.isInteger(gap) || gap < 0 || gap > ids.length) return null;
  const rank = gap > from ? gap : gap + 1;
  if (rank === from + 1) return null;
  return { rank, fromRank: from + 1, order: moveLineToIndex(ids, id, rank), affected: Math.abs(rank - from - 1) + 1 };
}

/** Materialize the rendered identities, never invent a new line identity on move. */
export function captureLines(document: TashjeerDocument, rendered: ClassicLine[]): Line[] {
  const existing = new Map(document.lines?.map((line) => [line.id, line]));
  const now = new Date().toISOString();
  return rendered.map((line, index) => existing.get(line.id) ?? {
    id: line.id,
    ayahKey: document.ayahKey,
    order: index + 1,
    title: line.label,
    category: line.category,
    readerScope: { kind: 'NARRATORS', narratorIds: [...line.narratorIds] },
    segments: line.entries.map((entry) => {
      const segment = entry.variantId.startsWith('segment:') ? document.segments?.find((item) => item.id === entry.variantId.slice(8)) : undefined;
      if (segment) return { ...segment, origin: segment.origin === 'ENGINE' ? 'engine' as const : 'editor' as const };
      return {
        id: `segment:${line.id}:${entry.variantId}:${entry.alternativeId}`,
        ayahKey: document.ayahKey, title: entry.ruleLabel,
        startPosition: entry.startPosition, endPosition: entry.endPosition,
        differenceIds: [entry.variantId], faceIds: entry.alternativeId ? [entry.alternativeId] : [],
        origin: 'engine' as const, createdAt: now, updatedAt: now,
      };
    }),
    compositeFaceRefs: [...new Set(line.entries.map((entry) => entry.alternativeId).filter(Boolean))],
    source: line.source === 'MANUAL' ? 'editor' : 'engine',
    createdAt: now,
    updatedAt: now,
  });
}

/** Keep unaffected objects (including their timestamps) literally unchanged. */
export function applyLineRanks(lines: Line[], order: string[]): Line[] {
  const ranks = new Map(order.map((id, index) => [id, index + 1]));
  return lines.map((line) => {
    const rank = ranks.get(line.id);
    return rank === undefined || rank === line.order ? line : { ...line, order: rank };
  });
}

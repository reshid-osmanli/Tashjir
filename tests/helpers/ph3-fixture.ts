import { createDocument } from '@/lib/storage/document-store';
import type { ClassicLine } from '@/lib/tashjeer/classic-tashjeer';
import type { TashjeerDocument, Variant } from '@/types/tashjeer';

export function ph3Document(): TashjeerDocument {
  const document = createDocument(1004);
  const difference = (id: string, position: number): Variant => ({
    id, ayahKey: 1004, title: id, category: 'FARSH', startPosition: position, endPosition: position, status: 'DRAFT', origin: 'EDITOR',
    alternatives: Array.from({ length: 5 }, (_, i) => ({ id: `${id}-face-${i}`, label: `وجه ${i}`, text: 'مَلِكِ', scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] }, notes: 'الأصل', createdAt: '2000-01-01', updatedAt: '2000-01-02' })),
  });
  return { ...document, variants: [difference('d1', 1), difference('d2', 2), difference('d3', 3)], branches: [],
    manualLines: Array.from({ length: 25 }, (_, i) => ({ id: `line-${i + 1}`, title: `سطر ${i + 1}`, label: `سطر ${i + 1}`, category: 'FARSH', lane: i, startPosition: 1, endPosition: 3 })),
    links: [
      { id: 'inside', ayahKey: 1004, kind: 'FACE_TO_FACE', relation: 'REFERENCE', from: { type: 'FACE', id: 'd1::d1-face-0' }, to: { type: 'FACE', id: 'd1::d1-face-1' }, origin: 'EDITOR', createdAt: '2000', updatedAt: '2000' },
      { id: 'outside', ayahKey: 1004, kind: 'FACE_TO_FACE', relation: 'REFERENCE', from: { type: 'FACE', id: 'd1::d1-face-0' }, to: { type: 'FACE', id: 'd2::d2-face-0' }, origin: 'EDITOR', createdAt: '2000', updatedAt: '2000' },
    ], editLog: [],
  };
}

/** Geometry is irrelevant to domain operations; browser tests use the real renderer. */
export function ph3Lines(): ClassicLine[] {
  return Array.from({ length: 25 }, (_, i) => ({
    id: `line-${i + 1}`, label: `سطر ${i + 1}`, category: 'FARSH', source: 'MANUAL', narratorIds: ['narrator-warsh'],
    entries: [{ variantId: 'd1', alternativeId: `d1-face-${i % 5}`, category: 'FARSH', ruleLabel: 'فرش', startPosition: 1, endPosition: 1 }],
  } as ClassicLine));
}

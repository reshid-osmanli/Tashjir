import type { ClassicLine } from './classic-tashjeer';
import type { Line } from './model/v8';
import { createEntityId } from './model/v8';
import { applyLineRanks, captureLines } from './line-operations';
import type { TashjeerDocument, TashjeerLink } from '@/types/tashjeer';
import { resolveLineMerge } from './decision/line-merge';
import type { EngineConfig } from './model/v8';
import { coalesceLineOrder } from './manual-links';

export interface MergeRecord { relationId: string; before: Line[]; after: Line; orderBefore?: string[]; orderAfter?: string[]; at: string; source: 'editor'; restoredAt?: string }

export function mergeLines(document: TashjeerDocument, rendered: ClassicLine[], fromId: string, toId: string, profile: EngineConfig, overrideReason?: string): { document: TashjeerDocument; error?: string } {
  const reject = (error: string) => ({ document, error });
  const first = rendered.find((line) => line.id === fromId), second = rendered.find((line) => line.id === toId);
  if (!first || !second || fromId === toId) return reject('السطران غير صالحين للدمج.');
  const lines = captureLines(document, rendered);
  const from = lines.find((line) => line.id === fromId)!, to = lines.find((line) => line.id === toId)!;
  if (from.locked || to.locked) return reject('أحد السطرين مقفل.');
  const decision = resolveLineMerge(first, second, profile);
  if (!decision.allowed && !overrideReason?.trim()) return reject(decision.reasons.join('؛ '));
  if (document.links?.some((link) => link.kind === 'LINE_TO_LINE' && link.relation === 'MERGE' && [fromId, toId].includes(link.from.id) && [fromId, toId].includes(link.to.id))) return reject('علاقة الدمج موجودة بالفعل.');
  const now = new Date().toISOString();
  const link: TashjeerLink = { id: createEntityId('merge'), ayahKey: document.ayahKey, kind: 'LINE_TO_LINE', relation: 'MERGE', from: { type: 'LINE', id: fromId }, to: { type: 'LINE', id: toId }, origin: 'EDITOR', createdAt: now, updatedAt: now, notes: overrideReason ?? 'دمج بالسحب من المحرر' };
  const after: Line = { ...from, source: 'editor', updatedAt: now,
    segments: [...from.segments, ...to.segments.filter((segment) => !from.segments.some((item) => item.id === segment.id))],
    compositeFaceRefs: [...new Set([...(from.compositeFaceRefs ?? []), ...(to.compositeFaceRefs ?? [])])],
    readerScope: { kind: 'NARRATORS', narratorIds: [...new Set([...first.narratorIds, ...second.narratorIds])] },
  };
  const orderBefore = coalesceLineOrder(document.lineOrder, rendered.map((line) => line.id));
  const orderAfter = orderBefore.filter((id) => id !== toId);
  const mergedLines = applyLineRanks(lines.filter((line) => line.id !== toId).map((line) => line.id === fromId ? after : line), orderAfter);
  const finalLine = mergedLines.find((line) => line.id === fromId)!;
  return { document: { ...document,
    lines: mergedLines,
    links: [...(document.links ?? []), link],
    mergeRecords: [...(document.mergeRecords ?? []), { relationId: link.id, before: structuredClone([from, to]), after: structuredClone(finalLine), orderBefore, orderAfter, at: now, source: 'editor' }],
    corrections: [...(document.corrections ?? []), ...(!decision.allowed ? [{ id: createEntityId('correction'), targetId: fromId, engineResult: decision, editorResult: finalLine, finalResult: finalLine, reason: overrideReason, at: now, source: 'editor' as const }] : [])],
  } };
}

/** Split only while its saved post-merge entities still match; otherwise explain. */
export function unmergeLines(document: TashjeerDocument, relationId: string): { document: TashjeerDocument; error?: string } {
  const record = document.mergeRecords?.find((item) => item.relationId === relationId && !item.restoredAt);
  if (!record) return { document, error: 'لا توجد لقطة أصلية لهذا الدمج. استخدم التراجع عن إنشائه.' };
  const current = document.lines?.find((line) => line.id === record.after.id);
  if (JSON.stringify(current) !== JSON.stringify(record.after)) return { document, error: 'تغيّر السطر بعد الدمج؛ تراجع عن التعديلات اللاحقة قبل الفك حتى لا تفقد بياناتها.' };
  if (document.mergeRecords?.some((item) => !item.restoredAt && item.relationId !== relationId && item.before.some((line) => line.id === record.after.id) && item.at >= record.at)) return { document, error: 'هذا السطر جزء من دمج لاحق؛ فك الدمج اللاحق أولًا.' };
  const currentOrder = [...(document.lines ?? [])].sort((a, b) => a.order - b.order).map((line) => line.id);
  if (record.orderAfter && JSON.stringify(currentOrder) !== JSON.stringify(record.orderAfter)) return { document, error: 'تغيّر ترتيب الأسطر بعد الدمج؛ تراجع عن النقل اللاحق قبل الفك.' };
  const originalIds = new Set(record.before.map((line) => line.id));
  const originals = [...(document.lines ?? []).filter((line) => !originalIds.has(line.id)), ...structuredClone(record.before)];
  return { document: { ...document,
    lines: applyLineRanks(originals, record.orderBefore ?? originals.sort((a, b) => a.order - b.order).map((line) => line.id)).sort((a, b) => a.order - b.order),
    links: (document.links ?? []).filter((link) => link.id !== relationId),
    mergeRecords: document.mergeRecords?.map((item) => item.relationId === relationId ? { ...item, restoredAt: new Date().toISOString() } : item),
  } };
}

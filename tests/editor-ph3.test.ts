import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import { ph3Document, ph3Lines } from './helpers/ph3-fixture';
import { captureLines, applyLineRanks, planLineInsertion } from '@/lib/tashjeer/line-operations';
import { pasteClipboard, snapshotClipboard } from '@/lib/tashjeer/clipboard';
import { selectRange } from '@/lib/tashjeer/multi-selection';
import { mergeLines, unmergeLines } from '@/lib/tashjeer/merge-operations';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { migrateDocumentToV8 } from '@/lib/tashjeer/migration/migrate-v7-v8';

beforeEach(() => vi.stubGlobal('window', { localStorage: new MemoryStorage() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function setup() {
  const { useEditorStore } = await import('@/stores/editor-store');
  const { useConfirmStore } = await import('@/lib/ui/confirm-store');
  useEditorStore.setState({ document: ph3Document(), past: [], future: [], selection: null, multiSelection: null, clipboard: null });
  return { store: useEditorStore, confirm: useConfirmStore };
}

describe('PH3 — insertion/ranks', () => {
  it('Line 10 → rank 20 shifts exactly 11 lines, preserves every ID, segment and link; Undo/Redo and JSON', async () => {
    const { store } = await setup();
    const rendered = ph3Lines(), ids = rendered.map((line) => line.id);
    const before = { ...store.getState().document!, lines: captureLines(store.getState().document!, rendered) };
    store.setState({ document: before });
    const plan = planLineInsertion(ids, 'line-10', 20)!;
    expect(plan.rank).toBe(20); expect(plan.affected).toBe(11);
    store.getState().setLineOrder(plan.order, rendered);
    const after = store.getState().document!;
    expect(after.lineOrder?.[19]).toBe('line-10');
    expect(after.lines?.find((line) => line.id === 'line-10')?.order).toBe(20);
    expect(after.lines?.filter((line, i) => line !== before.lines[i])).toHaveLength(11);
    expect(after.lines?.map((line) => line.segments)).toEqual(before.lines.map((line) => line.segments));
    expect(after.links).toEqual(before.links);
    expect(migrateDocumentToV8(after).lines.find((line) => line.id === 'line-10')?.order).toBe(20);
    store.getState().save();
    const saved = store.getState().document;
    const { loadDocument } = await import('@/lib/storage/document-store');
    expect(loadDocument(1004)?.lines).toEqual(after.lines);
    store.getState().undo(); expect(store.getState().document).toEqual(before);
    store.getState().redo(); expect(store.getState().document).toEqual(saved);
  });
  it('upward/top/bottom insertion and adjacent/self/invalid gaps are unambiguous', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(planLineInsertion(ids, 'd', 0)?.order).toEqual(['d', 'a', 'b', 'c']);
    expect(planLineInsertion(ids, 'a', 4)?.order).toEqual(['b', 'c', 'd', 'a']);
    expect(planLineInsertion(ids, 'b', 1)).toBeNull();
    expect(planLineInsertion(ids, 'b', 2)).toBeNull();
    expect(planLineInsertion(ids, 'x', 2)).toBeNull();
    expect(planLineInsertion(ids, 'b', NaN)).toBeNull();
  });
  it('no-op order never creates a phantom undo step', async () => {
    const { store } = await setup();
    store.getState().setLineOrder([]);
    expect(store.getState().past).toHaveLength(0);
  });
});

describe('PH3 — clipboard', () => {
  it('copies only selected faces, deep-clones metadata, remaps internal links and suspends external links', () => {
    const document = ph3Document();
    const clipboard = snapshotClipboard(document, { kind: 'FACES', sourceVariantId: 'd1', value: document.variants[0].alternatives.slice(0, 2) });
    const pasted = pasteClipboard(document, clipboard, 'd3');
    const faces = pasted.document.variants[2].alternatives.slice(5);
    expect(faces).toHaveLength(2); expect(pasted.document.variants[1]).toBe(document.variants[1]);
    expect(faces[0].copiedFrom).toBe('d1-face-0'); expect(faces[0].createdAt).not.toBe('2000-01-01');
    expect(faces[0].id).not.toBe('d1-face-0'); expect(faces[0].scope).not.toBe(document.variants[0].alternatives[0].scope);
    faces[0].scope.narratorIds!.push('other');
    expect(document.variants[0].alternatives[0].scope.narratorIds).toHaveLength(1);
    expect(pasted.document.links).toHaveLength(3);
    expect(pasted.document.links?.at(-1)?.from.id).toBe(`d3::${faces[0].id}`);
    expect(pasted.document.suspendedLinks).toHaveLength(1);
    expect(pasted.document.suspendedLinks?.[0].original.id).toBe('outside');
  });
  it('copies differences with fresh face/evidence IDs, explicit order and timestamps', () => {
    const document = ph3Document();
    const source = document.variants[0];
    source.alternativeOrder = source.alternatives.map((face) => face.id).reverse();
    source.alternatives[0].evidences = [{ id: 'evidence', source: 'TAYYIBAH', text: 'شاهد' }];
    const result = pasteClipboard(document, snapshotClipboard(document, { kind: 'DIFFERENCE', value: source }));
    const copy = result.document.variants.at(-1)!;
    expect(copy.copiedFrom).toBe(source.id);
    expect(copy.alternativeOrder?.[0]).toBe(copy.alternatives[4].id);
    expect(copy.alternatives[0].evidences?.[0].id).not.toBe('evidence');
    expect(copy.alternatives[0].evidences?.[0].source).toBe('TAYYIBAH');
    expect(migrateDocumentToV8(result.document).differences.at(-1)?.createdAt).toBe(copy.createdAt);
  });
  it('cut waits for confirmation, moves rather than copies, remaps links; cancel/undo preserve source', async () => {
    const { store, confirm } = await setup(); confirm.getState().setHostMounted(true);
    const before = store.getState().document!;
    store.getState().selectAlternative('d1', 'd1-face-0'); store.getState().cutSelection();
    expect(store.getState().document).toBe(before); expect(store.getState().past).toHaveLength(0);
    store.getState().selectVariant('d3');
    let pending = store.getState().requestPasteSelection();
    expect(confirm.getState().pending?.title).toContain('نقل');
    confirm.getState().resolve(false); await pending;
    expect(store.getState().document).toBe(before);
    pending = store.getState().requestPasteSelection(); confirm.getState().resolve(true); await pending;
    expect(store.getState().document?.variants[0].alternatives).toHaveLength(4);
    expect(store.getState().document?.variants[2].alternatives.at(-1)?.id).toBe('d1-face-0');
    expect(store.getState().document?.links?.[0].from.id).toBe('d3::d1-face-0');
    expect(store.getState().clipboard).toBeNull(); expect(store.getState().past).toHaveLength(1);
    store.getState().undo(); expect(store.getState().document).toEqual(before);
  });
  it('refuses stale cuts, invalid destinations and cross-document moves without deleting anything', () => {
    const document = ph3Document();
    const clipboard = { ...snapshotClipboard(document, { kind: 'FACE', sourceVariantId: 'd1', value: document.variants[0].alternatives[0] }), mode: 'CUT' as const };
    expect(pasteClipboard(document, clipboard).document).toBe(document);
    expect(pasteClipboard({ ...document, ayahKey: 1005 }, clipboard, 'd3').error).toContain('مستندين');
    document.variants[0].alternatives[0].notes = 'تعديل لاحق';
    expect(pasteClipboard(document, clipboard, 'd3').error).toContain('تغيّر المصدر');
    expect(document.variants[0].alternatives).toHaveLength(5);
  });
  it('rejects a destination changed while a confirmation is open', async () => {
    const { store, confirm } = await setup(); confirm.getState().setHostMounted(true);
    store.getState().selectAlternative('d1', 'd1-face-0'); store.getState().copySelection(); store.getState().selectVariant('d2');
    const pending = store.getState().requestPasteSelection();
    store.getState().selectVariant('d3'); confirm.getState().resolve(true); await pending;
    expect(store.getState().past).toHaveLength(0);
  });
});

describe('PH3 — bulk and history', () => {
  it('range/toggle operate on filtered IDs, not mounted rows', () => {
    let selection = selectRange({ kind: 'DIFFERENCE', ids: [] }, 'b', ['a', 'b', 'c', 'd'], {});
    selection = selectRange(selection, 'd', ['a', 'b', 'c', 'd'], { shift: true });
    expect(selection.ids).toEqual(['b', 'c', 'd']);
    expect(selectRange(selection, 'c', ['b', 'c'], { toggle: true }).ids).toEqual(['b']);
  });
  it('five faces delete only after confirmation, archive impacted links, and undo restores all five', async () => {
    const { store, confirm } = await setup(); confirm.getState().setHostMounted(true);
    const before = store.getState().document!;
    const ids = before.variants[0].alternatives.map((face) => face.id);
    let pending = store.getState().requestDeleteItems({ kind: 'FACE', ownerId: 'd1', ids });
    expect(confirm.getState().pending?.title).toBe('حذف ٥ أوجه؟');
    expect(confirm.getState().pending?.impacts?.[1].count).toBe(2);
    confirm.getState().resolve(false); await pending; expect(store.getState().document).toBe(before);
    pending = store.getState().requestDeleteItems({ kind: 'FACE', ownerId: 'd1', ids });
    confirm.getState().resolve(true); await pending;
    expect(store.getState().document?.variants[0].alternatives).toHaveLength(0);
    expect(store.getState().document?.deletedItems?.[0].links).toHaveLength(2);
    expect(store.getState().document?.links).toHaveLength(0);
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo(); expect(store.getState().document).toEqual(before);
  });
  it('move → merge → paste → bulk delete → 4 Undo restores the exact initial document, then 4 Redo restores final', async () => {
    const { store } = await setup(); const before = store.getState().document!; const lines = ph3Lines();
    store.getState().setLineOrder(planLineInsertion(lines.map((line) => line.id), 'line-10', 20)!.order, lines);
    await store.getState().requestMergeLines(lines, 'line-1', 'line-2');
    store.getState().selectAlternative('d1', 'd1-face-0'); store.getState().copySelection(); store.getState().selectVariant('d3');
    await store.getState().requestPasteSelection();
    await store.getState().requestDeleteItems({ kind: 'FACE', ownerId: 'd2', ids: before.variants[1].alternatives.map((face) => face.id) });
    const after = store.getState().document!; expect(store.getState().past).toHaveLength(4);
    for (let i = 0; i < 4; i++) store.getState().undo();
    expect(store.getState().document).toEqual(before);
    for (let i = 0; i < 4; i++) store.getState().redo();
    expect(store.getState().document).toEqual(after);
  });
});

describe('PH3 — merge provenance and policy', () => {
  it('keeps both original IDs in MERGE and archived snapshots; safe split restores them', () => {
    const before = ph3Document(); const lines = ph3Lines();
    const result = mergeLines(before, lines, 'line-1', 'line-2', DEFAULT_SYSTEM_PROFILE, 'قرار يدوي للاختبار');
    expect(result.error).toBeUndefined();
    expect(result.document.lines).toHaveLength(24);
    expect(result.document.lines?.map((line) => line.order)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1));
    const relation = result.document.links!.at(-1)!;
    expect(relation.from.id).toBe('line-1'); expect(relation.to.id).toBe('line-2');
    expect(migrateDocumentToV8(result.document).relations.at(-1)?.fromId).toBe('line-1');
    const split = unmergeLines(result.document, relation.id);
    expect(split.error).toBeUndefined(); expect(split.document.lines).toHaveLength(25);
    const changed = { ...result.document, lines: applyLineRanks(result.document.lines!, ['line-3', 'line-1']) };
    expect(unmergeLines(changed, relation.id).error).toContain('تغيّر');
  });
  it('a denied matrix decision is explained with priority, then explicit override creates Correction in one undo step', async () => {
    const { store, confirm } = await setup(); confirm.getState().setHostMounted(true);
    const lines = ph3Lines(); lines[0].category = 'MADUD'; lines[0].entries[0].category = 'MADUD';
    const pending = store.getState().requestMergeLines(lines, 'line-1', 'line-2');
    expect(confirm.getState().pending?.message).toContain('الأولوية');
    expect(confirm.getState().pending?.confirmLabel).toBe('تجاوز بقرار يدوي موثق');
    expect(store.getState().document?.mergeRecords).toBeUndefined();
    confirm.getState().resolve(true); await pending;
    expect(store.getState().document?.corrections).toHaveLength(1);
    expect(store.getState().past).toHaveLength(1);
    store.getState().save();
    const { loadDocument } = await import('@/lib/storage/document-store');
    expect(loadDocument(1004)?.mergeRecords).toHaveLength(1);
    expect(loadDocument(1004)?.corrections).toHaveLength(1);
  });
});

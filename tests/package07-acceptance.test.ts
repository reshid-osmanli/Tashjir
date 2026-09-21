import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getAyahWordsByKey, makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';
import type { Variant, TashjeerLink } from '@/types/tashjeer';

const AYAH = makeAyahKey(1, 2);
const OTHER = makeAyahKey(1, 3);
beforeEach(() => vi.stubGlobal('window', { localStorage: new MemoryStorage() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function setup() {
  const rules = await import('@/lib/storage/global-rules-store');
  const occurrences = await import('@/lib/storage/rule-occurrences-store');
  const engine = await import('@/lib/quran-logic/global-rule-engine');
  const documents = await import('@/lib/storage/document-store');
  const { useEditorStore: store } = await import('@/stores/editor-store');
  const { useConfirmStore: confirm } = await import('@/lib/ui/confirm-store');
  const pattern = engine.buildCharacterPattern(AYAH, {
    start: { position: 1, characterIndex: 1 }, end: { position: 1, characterIndex: 1 },
  }, { defaultHarakaMode: 'IGNORE' });
  // Deliberately reversed names and creation order. Type rank, never either, wins.
  rules.saveGlobalRuleBatch((['FARSH', 'TAHQIQ', 'USUL'] as const).map((category, i) => ({
    id: category, title: ['ألف', 'ياء', 'باء'][i], category,
    scope: { kind: 'NARRATORS' as const, narratorIds: ['narrator-qalun'] },
    pattern, status: 'DRAFT' as const, isActive: true,
    description: 'الوصف الأصلي', strengthDegreeId: 'base-degree', recitationMode: 'WAQF_ONLY' as const,
  })), { rankMode: 'TYPE' });
  store.getState().openAyah(AYAH);
  const effective = () => engine.getEffectiveVariants(store.getState().document!);
  const at = (type: string) => effective().find(v => v.globalRuleId === type && v.startPosition === 1)!;
  const distant = () => engine.getEffectiveVariants(documents.createDocument(OTHER));
  expect(at('TAHQIQ')).toBeDefined();
  expect(distant().some(v => v.globalRuleId === 'TAHQIQ')).toBe(true);
  return { rules, occurrences, engine, documents, store, confirm, effective, at, distant };
}

async function render(variants: Variant[], perVariant = false, links: TashjeerLink[] = []) {
  const { layoutAyah, DEFAULT_LAYOUT_OPTIONS } = await import('@/lib/tashjeer/layout-engine');
  const { generateClassicTashjeer } = await import('@/lib/tashjeer/classic-tashjeer');
  const { DEFAULT_ENGINE_SETTINGS } = await import('@/lib/tashjeer/engine-settings');
  const { TashjeerFigure } = await import('@/components/editor/TashjeerFigure');
  const layout = layoutAyah(AYAH, getAyahWordsByKey(AYAH), DEFAULT_LAYOUT_OPTIONS);
  const engine = { ...DEFAULT_ENGINE_SETTINGS, ...(perVariant ? { lineComposition: 'PER_VARIANT' as const } : {}) };
  const classic = generateClassicTashjeer(variants, layout, {
    categories: ['TAHQIQ', 'USUL', 'FARSH', 'MADUD'], narratorIds: [],
    showLabels: true, showGrid: false, showRulers: false, showAnchors: true,
  }, DEFAULT_LAYOUT_OPTIONS, { engine, links });
  const markup = renderToStaticMarkup(createElement(TashjeerFigure, {
    layout, classic, viewBox: { x: -150, y: 0, width: 1300, height: classic.totalHeight },
    fontSize: 34, showLabels: true, boundaries: [], baseNarratorName: 'حفص', engine,
  }));
  return { classic, markup };
}

describe('PH6 acceptance — real multi-type occurrences', () => {
  it('TAHQIQ=1, USUL=2, FARSH=3 even with previous batches; no rank inferred from names', async () => {
    const { rules, at, effective } = await setup();
    expect(['TAHQIQ', 'USUL', 'FARSH'].map(t => at(t).orderRank)).toEqual([1, 2, 3]);
    const batch = at('TAHQIQ').createBatchId;
    expect(batch).toBeTruthy();
    expect(at('FARSH').createBatchId).toBe(batch);
    rules.saveGlobalRuleBatch([{ ...rules.listGlobalRules()[0], id: 'later', category: 'TAHQIQ', orderRank: undefined }], { rankMode: 'TYPE' });
    expect(rules.listGlobalRules().find(r => r.id === 'later')?.orderRank).toBe(1);
    for (const rule of rules.listGlobalRules()) rules.saveGlobalRule({ ...rule, title: 'اسم معكوس ' + rule.id });
    const { classic } = await render(effective(), true);
    const ranks = classic.lines.flatMap(line => line.entries.map(entry => entry.orderRank!));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(at('TAHQIQ').recitationMode).toBe('WAQF_ONLY');
  });

  it('edit one type: text/description/scope/rank/strength stay local; log has before/after/editor; Undo/Redo', async () => {
    const ctx = await setup();
    const { store, rules, occurrences, at, distant, effective } = ctx;
    const tahqiq = at('TAHQIQ');
    const untouched = effective().filter(v => v.id !== tahqiq.id);
    const other = distant(); const mothers = rules.listGlobalRules();
    const manual = store.getState().document!.variants;
    store.getState().setDerivedLocalOverride(tahqiq.id, {
      title: 'تحقيق محلي', text: 'بديل · نص', description: 'وصف محلي', orderRank: 9,
      scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] }, strengthDegreeId: 'local-degree',
    });
    expect(at('TAHQIQ')).toMatchObject({ id: tahqiq.id, hasLocalOverride: true, orderRank: 9, description: 'وصف محلي' });
    expect(at('TAHQIQ').alternatives[0]).toMatchObject({ text: 'بديل · نص', strengthDegreeId: 'local-degree' });
    expect(effective().filter(v => v.id !== tahqiq.id)).toEqual(untouched);
    expect(distant()).toEqual(other); expect(rules.listGlobalRules()).toEqual(mothers);
    expect(store.getState().document!.variants).toEqual(manual);
    expect(occurrences.listOccurrenceOverrides()).toHaveLength(1);
    expect(occurrences.listOccurrenceLog()[0]).toMatchObject({ source: 'editor', occurrenceId: tahqiq.id,
      changes: expect.arrayContaining([{ field: 'العنوان', before: 'ياء', after: 'تحقيق محلي' }, { field: 'الرتبة', before: '1', after: '9' }]),
    });
    store.getState().undo(); expect(at('TAHQIQ')).toEqual(tahqiq);
    store.getState().redo(); expect(at('TAHQIQ').orderRank).toBe(9);
  });

  it('source badges and numeric ordering reach the shared figure; overlapping types have separate levels', async () => {
    const { at, store } = await setup();
    store.getState().setDerivedLocalOverride(at('TAHQIQ').id, { text: 'خاص', ruleLabel: 'تحقيق محلي' });
    const { classic, markup } = await render([at('FARSH'), at('USUL'), at('TAHQIQ')]);
    const entries = classic.lines.flatMap(line => line.entries);
    expect(entries.some(e => e.source === 'GLOBAL_RULE' && e.hasLocalOverride)).toBe(true);
    expect(markup).toContain('قاعدة عامة'); expect(markup).toContain('متجاوز محليًا');
    expect(markup).toContain('data-local-override="true"');
    for (const line of classic.lines) {
      expect(line.entries.map(e => e.orderRank)).toEqual(line.entries.map(e => e.orderRank).sort((a, b) => a! - b!));
      expect(new Set(line.entries.map(e => e.rowOffset)).size).toBe(line.entries.length);
    }
  });

  it('deleting FARSH through shared selection is confirmed, local, and undoable', async () => {
    const { store, confirm, at, distant, effective, rules } = await setup();
    const farsh = at('FARSH'); const others = distant(); const mothers = rules.listGlobalRules();
    confirm.getState().setHostMounted(true);
    const request = store.getState().requestDeleteItems({ kind: 'DIFFERENCE', ids: [farsh.id] });
    expect(confirm.getState().pending?.undoable).toBe(true);
    expect(effective().some(v => v.id === farsh.id)).toBe(true);
    confirm.getState().resolve(true); expect(await request).toBe(true);
    expect(effective().some(v => v.id === farsh.id)).toBe(false);
    expect(at('USUL')).toBeDefined(); expect(at('TAHQIQ')).toBeDefined();
    expect(distant()).toEqual(others); expect(rules.listGlobalRules()).toEqual(mothers);
    store.getState().undo(); expect(at('FARSH')).toEqual(farsh);
  });

  it('original matchedText never becomes the editable text or title, including the separator', async () => {
    const { store, at, occurrences } = await setup();
    const original = at('TAHQIQ');
    store.getState().setDerivedLocalOverride(original.id, { title: 'أ · ب', text: 'ج · د' });
    store.getState().setDerivedLocalOverride(original.id, { description: 'تعديل آخر' });
    expect(occurrences.overrideById(original.id)?.matchedText).toBe(original.globalMatchedText);
    expect(at('TAHQIQ').id).toBe(original.id);
    store.getState().clearDerivedLocalOverride(original.id);
    expect(at('TAHQIQ')).toEqual(original);
    store.getState().undo(); expect(at('TAHQIQ').alternatives[0].text).toBe('ج · د');
  });

  it('parent edits retain overridden fields but unpatched fields continue inheriting', async () => {
    const { store, rules, at } = await setup();
    store.getState().setDerivedLocalOverride(at('TAHQIQ').id, { title: 'عنوان ثابت', orderRank: 8 });
    const rule = rules.listGlobalRules().find(r => r.id === 'TAHQIQ')!;
    rules.saveGlobalRule({ ...rule, title: 'عنوان أم جديد', description: 'وصف أم جديد', orderRank: 11 });
    expect(at('TAHQIQ').title).toContain('عنوان ثابت'); expect(at('TAHQIQ').orderRank).toBe(8);
    expect(at('TAHQIQ').description).toBe('وصف أم جديد');
  });

  it('equal-size scope and strength maps still produce meaningful changes in occurrenceLog', async () => {
    const { store, at, occurrences } = await setup();
    const id = at('TAHQIQ').id;
    store.getState().setDerivedLocalOverride(id, { scope: { kind: 'NARRATORS', narratorIds: ['a'] }, strengthByNarrator: { a: 'one' } });
    store.getState().setDerivedLocalOverride(id, { scope: { kind: 'NARRATORS', narratorIds: ['b'] }, strengthByNarrator: { b: 'two' } });
    const log = occurrences.exportOccurrenceData().log.at(-1)!;
    expect(log.changes?.find(c => c.field === 'النطاق')?.before).toContain('"a"');
    expect(log.changes?.find(c => c.field === 'النطاق')?.after).toContain('"b"');
    expect(log.changes?.find(c => c.field === 'القوة بحسب الراوي')?.after).toContain('two');
  });

  it('reload + export/import preserves ranks/overrides/IDs and never saves derived copies', async () => {
    const { store, at, documents, effective, occurrences } = await setup();
    store.getState().setDerivedLocalOverride(at('TAHQIQ').id, { title: 'خاص', orderRank: 7, strengthDegreeId: 'strong' });
    store.getState().deleteDerivedOccurrence(at('FARSH').id);
    const expected = effective(); const data = occurrences.exportOccurrenceData();
    store.getState().save(); store.getState().openAyah(AYAH); expect(effective()).toEqual(expected);
    const exported = documents.exportDocument(store.getState().document!, { exportedAt: '2026-09-21T00:00:00.000Z' });
    const parsed = JSON.parse(exported);
    expect(parsed.documents[0].variants.some((v: Variant) => v.isGlobalDerived)).toBe(false);
    expect(parsed.ruleOccurrences).toHaveLength(2);
    vi.stubGlobal('window', { localStorage: new MemoryStorage() }); vi.resetModules();
    const freshDocuments = await import('@/lib/storage/document-store');
    expect(freshDocuments.importDocuments(exported, true).errors).toEqual([]);
    const freshEngine = await import('@/lib/quran-logic/global-rule-engine');
    const freshOccurrences = await import('@/lib/storage/rule-occurrences-store');
    expect(freshEngine.getEffectiveVariants(freshDocuments.loadDocument(AYAH)!)).toEqual(expected);
    expect(freshOccurrences.exportOccurrenceData()).toEqual(data);
  });

  it('parent deletion counts ALL matches (>5000), cancellation is inert and Undo restores all exceptions', async () => {
    const { store, at, rules, occurrences, engine, confirm, effective } = await setup();
    const id = at('TAHQIQ').id;
    store.getState().setDerivedLocalOverride(id, { title: 'خاص' });
    store.getState().deleteDerivedOccurrence(id);
    expect(occurrences.occurrenceStats('TAHQIQ')).toMatchObject({ edited: 1, deleted: 1, local: 1 });
    const before = effective(); const snapshot = occurrences.exportOccurrenceData(); const mothers = rules.listGlobalRules();
    const count = engine.findGlobalRuleMatches(mothers.find(r => r.id === 'TAHQIQ')!).length;
    expect(count).toBeGreaterThan(5000);
    confirm.getState().setHostMounted(true);
    let pending = store.getState().requestDeleteItems({ kind: 'RULE', ids: ['TAHQIQ'] });
    expect(confirm.getState().pending?.impacts?.[1].count).toBe(count);
    expect(confirm.getState().pending?.impacts?.[2].count).toBe(1);
    confirm.getState().resolve(false); expect(await pending).toBe(false);
    expect(rules.listGlobalRules()).toEqual(mothers);
    pending = store.getState().requestDeleteItems({ kind: 'RULE', ids: ['TAHQIQ'] });
    confirm.getState().resolve(true); await pending;
    expect(effective().some(v => v.globalRuleId === 'TAHQIQ')).toBe(false);
    expect(occurrences.listOccurrenceOverrides('TAHQIQ')).toEqual([]);
    store.getState().undo(); expect(effective()).toEqual(before);
    expect(rules.listGlobalRules()).toEqual(mothers); expect(occurrences.exportOccurrenceData()).toEqual(snapshot);
  });

  it('unified clipboard copies a derived type/face; clone has fresh identity and no stale derived badges', async () => {
    const { store, at, rules } = await setup();
    const id = at('TAHQIQ').id; const mothers = rules.listGlobalRules();
    store.getState().setDerivedLocalOverride(id, { text: 'نسخة محلية' });
    store.getState().selectVariant(id); store.getState().copySelection();
    await store.getState().requestPasteSelection();
    const copy = store.getState().document!.variants.find(v => v.copiedFrom === id)!;
    expect(copy).toBeDefined(); expect(copy.id).not.toBe(id);
    expect(copy.alternatives[0].text).toBe('نسخة محلية'); expect(copy.hasLocalOverride).toBeUndefined();
    expect(copy.isGlobalDerived).toBeUndefined(); expect(copy.globalRuleId).toBeUndefined();
    store.getState().updateVariant(copy.id, { title: 'نسخة معدّلة' });
    expect(at('TAHQIQ').title).not.toContain('نسخة معدّلة'); expect(rules.listGlobalRules()).toEqual(mothers);
    store.getState().undo(); store.getState().undo();
    expect(store.getState().document!.variants.some(v => v.id === copy.id)).toBe(false);
    store.getState().copyFaces(id, [at('TAHQIQ').alternatives[0].id]);
    expect(store.getState().clipboard?.kind).toBe('FACE');
  });

  it('cut of one occurrence moves only its entries into target line, no materialization; Undo restores links', async () => {
    const { store, at, rules } = await setup();
    const source = at('TAHQIQ'), target = at('FARSH'); const mothers = rules.listGlobalRules();
    const manual = store.getState().document!.variants;
    store.getState().selectAlternative(source.id, source.alternatives[0].id); store.getState().cutSelection();
    store.getState().setSelection({ kind: 'LINE', id: 'target-line', differenceId: target.id });
    await store.getState().requestPasteSelection();
    expect(store.getState().document!.links).toEqual(expect.arrayContaining([expect.objectContaining({
      kind: 'DIFFERENCE_TO_LINE', from: { type: 'RULE', id: source.id },
      to: { type: 'FACE', id: `${target.id}::${target.alternatives[0].id}` },
    })]));
    expect(store.getState().document!.variants).toEqual(manual); expect(rules.listGlobalRules()).toEqual(mothers);
    expect(store.getState().clipboard).toBeNull();
    store.getState().undo(); expect(store.getState().document!.links ?? []).toEqual([]);
  });

  it('derived merge uses policy, records correction when necessary, and split keeps siblings/data untouched', async () => {
    const { store, at, rules } = await setup();
    const source = at('TAHQIQ'), target = at('FARSH'), sibling = at('USUL'); const mothers = rules.listGlobalRules();
    const link = await store.getState().requestAddLink({ kind: 'FACE_TO_FACE', relation: 'MERGE',
      from: { type: 'FACE', id: `${source.id}::${source.alternatives[0].id}` },
      to: { type: 'FACE', id: `${target.id}::${target.alternatives[0].id}` },
    });
    expect(link?.allowed).toBe(true); expect(link?.trace.length).toBeGreaterThan(0);
    expect(store.getState().document!.links?.[0].kind).toBe('DIFFERENCE_TO_LINE');
    if (link?.warning) expect(store.getState().document!.corrections?.at(-1)?.source).toBe('editor');
    expect(at('USUL')).toEqual(sibling); expect(rules.listGlobalRules()).toEqual(mothers);
    const merged = await render([source, sibling, target], true, store.getState().document!.links);
    expect(merged.classic.lines).toHaveLength(2);
    expect(merged.classic.lines.find(line => line.entries.some(e => e.variantId === sibling.id))!.entries.map(e => e.variantId)).toEqual([sibling.id]);
    expect(merged.classic.lines.find(line => line.entries.some(e => e.variantId === source.id))!.entries.map(e => e.variantId)).toEqual([source.id, target.id]);
    store.getState().deleteLink(link!.linkId!);
    expect(store.getState().document!.links).toEqual([]); expect(at('TAHQIQ')).toEqual(source);
    store.getState().undo(); expect(store.getState().document!.links).toHaveLength(1);
  });
});

describe('PH6 word destination — sparse relocation through package 04 clipboard', () => {
  it('move to another ayah preserves original identity, local edit, siblings, Quran visibility and Undo', async () => {
    const { store, at, engine, documents, occurrences, rules } = await setup();
    const source = at('TAHQIQ'); const mothers = rules.listGlobalRules();
    const originals = engine.getEffectiveVariants(documents.createDocument(AYAH));
    store.getState().setDerivedLocalOverride(source.id, { title: 'خاص قبل النقل' });
    store.getState().selectVariant(source.id); store.getState().cutSelection();
    // This ayah does not match the alif pattern, so /quran must discover the incoming override.
    const destination = makeAyahKey(112, 3);
    store.getState().openAyah(destination);
    store.getState().selectWord(getAyahWordsByKey(destination)[0].id);
    await store.getState().requestPasteSelection();
    const moved = engine.getEffectiveVariants(store.getState().document!).find(v => v.id === source.id)!;
    expect(moved).toMatchObject({ ayahKey: destination, startPosition: 1, targetKind: 'WORDS', hasLocalOverride: true });
    expect(moved.title).toContain('خاص قبل النقل'); expect(moved.globalMatch?.ayahKey).toBe(AYAH);
    expect(store.getState().document!.variants.some(v => v.id === source.id)).toBe(false);
    expect(engine.getEffectiveVariants(documents.createDocument(AYAH))).toEqual(originals.filter(v => v.id !== source.id));
    expect(rules.listGlobalRules()).toEqual(mothers);
    const quran = await import('@/lib/tashjeer/ayah-tashjeer-source');
    expect(quran.ayahHasTashjeerContent(destination)).toBe(true);
    expect(quran.surahAyahsWithTashjeer(112).has(destination)).toBe(true);
    expect(engine.getEffectiveVariants(quran.resolveAyahDocument(destination)!).some(v => v.id === source.id)).toBe(true);
    store.getState().setDerivedLocalOverride(source.id, { description: 'بعد النقل' });
    expect(occurrences.overrideById(source.id)?.ayahKey).toBe(AYAH);
    expect(occurrences.overrideById(source.id)?.patch?.placement?.ayahKey).toBe(destination);
    store.getState().undo(); store.getState().undo();
    expect(engine.getEffectiveVariants(store.getState().document!).some(v => v.id === source.id)).toBe(false);
    expect(engine.getEffectiveVariants(documents.createDocument(AYAH)).find(v => v.id === source.id)?.title).toContain('خاص قبل النقل');
    store.getState().redo(); expect(engine.getEffectiveVariants(store.getState().document!).some(v => v.id === source.id)).toBe(true);
    store.getState().clearDerivedLocalOverride(source.id);
    expect(engine.getEffectiveVariants(documents.createDocument(AYAH)).find(v => v.id === source.id)).toEqual(source);
  });

  it('copy to a selected word changes only the new local copy geometry', async () => {
    const { store, at, engine, documents } = await setup();
    const source = at('USUL');
    store.getState().selectVariant(source.id); store.getState().copySelection();
    store.getState().openAyah(OTHER);
    store.getState().selectWord(getAyahWordsByKey(OTHER)[1].id);
    await store.getState().requestPasteSelection();
    const copy = store.getState().document!.variants.find(v => v.copiedFrom === source.id)!;
    expect(copy).toMatchObject({ ayahKey: OTHER, startPosition: 2, endPosition: 2, targetKind: 'WORDS' });
    expect(copy.globalMatch).toBeUndefined(); expect(copy.globalRuleId).toBeUndefined();
    expect(engine.getEffectiveVariants(documents.createDocument(AYAH)).find(v => v.id === source.id)).toEqual(source);
    store.getState().undo(); expect(store.getState().document!.variants.some(v => v.id === copy.id)).toBe(false);
  });

  it('move then delete stays sparse and exported relocation survives import; deleting parent removes incoming occurrence', async () => {
    const { store, at, engine, documents, rules, occurrences } = await setup();
    const id = at('FARSH').id;
    store.getState().selectVariant(id); store.getState().cutSelection();
    store.getState().openAyah(OTHER); store.getState().selectWord(getAyahWordsByKey(OTHER)[1].id);
    await store.getState().requestPasteSelection();
    const exported = documents.exportDocument(store.getState().document!);
    const moved = engine.getEffectiveVariants(store.getState().document!).find(v => v.id === id)!;
    store.getState().deleteDerivedOccurrence(id);
    expect(occurrences.overrideById(id)?.patch?.placement?.ayahKey).toBe(OTHER);
    expect(engine.getEffectiveVariants(store.getState().document!).some(v => v.id === id)).toBe(false);
    store.getState().undo(); expect(engine.getEffectiveVariants(store.getState().document!).find(v => v.id === id)).toEqual(moved);
    rules.deleteGlobalRule('FARSH'); expect(engine.getEffectiveVariants(store.getState().document!).some(v => v.id === id)).toBe(false);
    vi.stubGlobal('window', { localStorage: new MemoryStorage() }); vi.resetModules();
    const fresh = await import('@/lib/storage/document-store');
    expect(fresh.importDocuments(exported, true).errors).toEqual([]);
    const freshEngine = await import('@/lib/quran-logic/global-rule-engine');
    expect(freshEngine.getEffectiveVariants(fresh.loadDocument(OTHER)!).find(v => v.id === id)).toEqual(moved);
  });

  it('stale clipboard and invalid destinations never remove the source', async () => {
    const { store, at, occurrences } = await setup();
    const source = at('TAHQIQ');
    store.getState().selectVariant(source.id); store.getState().cutSelection();
    store.getState().setDerivedLocalOverride(source.id, { text: 'تغيير بعد القص' });
    store.getState().selectWord(getAyahWordsByKey(AYAH)[1].id);
    await store.getState().requestPasteSelection();
    expect(store.getState().clipboardNotice).toContain('تغيّر الموضع');
    expect(occurrences.overrideById(source.id)?.patch?.placement).toBeUndefined();
    expect(at('TAHQIQ').startPosition).toBe(1);
    expect(() => store.getState().setDerivedLocalOverride(source.id, {
      placement: { ayahKey: AYAH, startPosition: 999, endPosition: 999 },
    })).toThrow('موضع النقل خارج الآية');
    expect(occurrences.overrideById(source.id)?.patch?.placement).toBeUndefined();
  });
});

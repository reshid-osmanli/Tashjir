// اختبارات الحزمة 04 — السحب والنقل والدمج والحافظة والحذف الجماعي
// مشروع التشجير - نظام القراءات العشر
//
// تحرس هذه الاختبارات ما أضافته الحزمة فوق البنية القائمة:
//   1. AC-04: «اختلاف ٢ + اختلاف ٣» من سطر ← Ctrl+C ← تحديد سطر آخر ←
//      Ctrl+V ← العنصران فقط في السطر الهدف بمعرّفات جديدة، تعديلهما لا
//      يمس الأصل، وبقية المستند لم تتغير، وUndo يعكس كل شيء.
//   2. القرار المحسوم «X = نقل»: القص ينقل بلا استنساخ، والمقصوص يختفي من
//      سطره الطبيعي عرضيًا (رابط إلحاق) مع بقاء معرّفه وعلاقاته.
//   3. دلالة العرض للرابط الجديد DIFFERENCE_TO_LINE: نقل أحكام الاختلاف
//      وحدها (لا السطر الطبيعي كله) إلى سطر المرساة الوجهي المستقرة.
// (سلسلة AC-6 الكاملة نقل←دمج←لصق←حذف جماعي←4×Undo محروسة أصلًا في
//  tests/editor-ph3.test.ts، وسحب الترتيب المنطقي في manual-links.)

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import { ph3Document } from './helpers/ph3-fixture';
import { snapshotClipboard, pasteClipboard, pasteAnchorFace } from '@/lib/tashjeer/clipboard';
import {
  applyManualLinks,
  moveDifferenceIntoLine,
  rebuildLineFromEntries,
} from '@/lib/tashjeer/manual-links';
import { getAyahWordsByKey, makeAyahKey } from '@/data/quran';
import { getSeedVariants } from '@/data/variants/seed-variants';
import { layoutAyah, DEFAULT_LAYOUT_OPTIONS } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer, type ClassicLine, type ClassicLineEntry } from '@/lib/tashjeer/classic-tashjeer';
import type { TashjeerLink, ViewFilter } from '@/types/tashjeer';

beforeEach(() => vi.stubGlobal('window', { localStorage: new MemoryStorage() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function setup() {
  const { useEditorStore } = await import('@/stores/editor-store');
  useEditorStore.setState({
    document: ph3Document(),
    past: [],
    future: [],
    selection: null,
    multiSelection: null,
    clipboard: null,
  });
  return { store: useEditorStore };
}

describe('AC-04 — اللصق الجزئي داخل سطر هدف', () => {
  it('نقطة الدالة النقية: نسخة بمعرّفات جديدة وروابط إلحاق، والأصل لا يُمس', () => {
    const document = ph3Document();
    const sources = [document.variants[0], document.variants[1]]; // «اختلاف ٢ + اختلاف ٣»
    const clipboard = snapshotClipboard(document, { kind: 'DIFFERENCES', value: sources });
    const anchor = { faceKey: pasteAnchorFace(document, 'd3')! };
    expect(anchor.faceKey).toBe('d3::d3-face-0'); // أول وجه غير مصحفي مرساةً

    const pasted = pasteClipboard(document, clipboard, undefined, anchor);
    expect(pasted.error).toBeUndefined();

    // العنصران فقط، بمعرّفات جديدة وتوثيق copiedFrom وطوابع جديدة ومصدر محرر.
    const clones = pasted.document.variants.slice(3);
    expect(clones).toHaveLength(2);
    expect(clones.map((clone) => clone.copiedFrom)).toEqual(['d1', 'd2']);
    expect(clones.every((clone) => clone.source === 'editor')).toBe(true);
    expect(clones.every((clone) => clone.createdAt !== '2000-01-01')).toBe(true);
    expect(clones[0].id).not.toBe('d1');

    // روابط الإلحاق تشير للنسخ الجديدة لا للأصل، وترسو على وجه السطر الهدف.
    const anchorLinks = pasted.document.links!.filter((link) => link.kind === 'DIFFERENCE_TO_LINE');
    expect(anchorLinks).toHaveLength(2);
    expect(anchorLinks.map((link) => link.from.id)).toEqual(clones.map((clone) => clone.id));
    expect(anchorLinks.every((link) => link.to.id === 'd3::d3-face-0')).toBe(true);
    expect(anchorLinks.every((link) => link.origin === 'EDITOR')).toBe(true);

    // بقية المستند لم تتغير: الأصلان بالمرجع نفسه، وروابطهما بلا تعليق
    // (الروابط الداخلية المنسوخة تتعامل معها اختبارات editor-ph3).
    expect(pasted.document.variants[0]).toBe(document.variants[0]);
    expect(pasted.document.variants[2]).toBe(document.variants[2]);

    // تعديل النسخة لا يمس الأصل (استقلال البيانات الكامل).
    clones[0].title = 'معدّل على النسخة';
    expect(document.variants[0].title).toBe('d1');
  });

  it('القص ينقل بلا استنساخ ولا حذف: المعرّف محفوظ والعلاقات قائمة', () => {
    const document = ph3Document();
    const clipboard = {
      ...snapshotClipboard(document, { kind: 'DIFFERENCE', value: document.variants[0] }),
      mode: 'CUT' as const,
    };
    const pasted = pasteClipboard(document, clipboard, undefined, { faceKey: 'd3::d3-face-0' });
    expect(pasted.error).toBeUndefined();

    // لا نسخة جديدة: ثلاثة اختلافات كما كانت، بالمرجع نفسه.
    expect(pasted.document.variants).toHaveLength(3);
    expect(pasted.document.variants[0]).toBe(document.variants[0]);

    // النقل رابط إلحاق بالأصل نفسه — لا استنساخ ولا تغيير معرّف.
    const moveLinks = pasted.document.links!.filter((link) => link.kind === 'DIFFERENCE_TO_LINE');
    expect(moveLinks).toHaveLength(1);
    expect(moveLinks[0].from.id).toBe('d1');
    expect(moveLinks[0].to.id).toBe('d3::d3-face-0');
    expect(pasted.ids).toEqual(['d1']);

    // العلاقات القائمة للمقصوص باقية (الروابط الأصلية + رابط النقل).
    expect(pasted.document.links!.some((link) => link.id === 'inside')).toBe(true);
    expect(pasted.document.links!.some((link) => link.id === 'outside')).toBe(true);
  });

  it('بلا سطر هدف يُرفض النقل بأمان، والرسو على وجه المقصوص نفسه ممنوع', () => {
    const document = ph3Document();
    const clipboard = {
      ...snapshotClipboard(document, { kind: 'DIFFERENCE', value: document.variants[0] }),
      mode: 'CUT' as const,
    };
    const noAnchor = pasteClipboard(document, clipboard);
    expect(noAnchor.error).toContain('حدد سطرًا');
    expect(noAnchor.document).toBe(document); // لا شيء تغيّر — المصدر محفوظ

    const selfAnchor = pasteClipboard(document, clipboard, undefined, { faceKey: 'd1::d1-face-0' });
    expect(selfAnchor.error).toContain('نفسه');
    expect(selfAnchor.document).toBe(document);

    // تغيّر المصدر بعد القص يُبطل العملية بدل نقل بيانات قديمة.
    const stale = pasteClipboard(
      { ...document, variants: document.variants.map((variant) => (variant.id === 'd1' ? { ...variant, title: 'تغيّر' } : variant)) },
      clipboard,
      undefined,
      { faceKey: 'd3::d3-face-0' }
    );
    expect(stale.error).toContain('تغيّر المصدر');
  });

  it('سيناريو المخزن كاملًا: تحديد ← Ctrl+C ← سطر آخر ← Ctrl+V ← تراجع واحد', async () => {
    const { store } = await setup();
    const before = store.getState().document!;

    // تحديد «اختلاف ٢ + اختلاف ٣» متعددًا ثم نسخه (Ctrl+C).
    store.getState().setMultiSelection({ kind: 'DIFFERENCE', ids: ['d1', 'd2'] });
    store.getState().copySelection();
    expect(store.getState().clipboard?.kind).toBe('DIFFERENCES');

    // تحديد سطر آخر (التحديد الموحد: LINE باختلاف مرسى d3) ثم لصق (Ctrl+V).
    store.getState().setSelection({ kind: 'LINE', id: 'line-24', lineId: 'line-24', differenceId: 'd3' });
    await store.getState().requestPasteSelection();

    const after = store.getState().document!;
    expect(after.variants).toHaveLength(5);
    expect(after.links!.filter((link) => link.kind === 'DIFFERENCE_TO_LINE')).toHaveLength(2);
    expect(after.editLog?.at(-1)?.action).toBe('لصق من الحافظة');
    expect(after.editLog?.at(-1)?.summary).toContain('داخل السطر المحدد');

    // تراجع واحد يعكس اللصق كله: النسختان ورابطاهما يختفون دفعة واحدة.
    store.getState().undo();
    expect(store.getState().document).toEqual(before);
  });

  it('سيناريو القص من المخزن: ينقل ويفرّغ الحافظة بعد التأكيد', async () => {
    const { store } = await setup();
    store.getState().selectVariant('d1');
    store.getState().cutSelection();
    store.getState().setSelection({ kind: 'LINE', id: 'line-24', lineId: 'line-24', differenceId: 'd3' });
    await store.getState().requestPasteSelection();

    const after = store.getState().document!;
    expect(after.variants).toHaveLength(3); // نُقل لا نُسخ
    expect(store.getState().clipboard).toBeNull(); // فُرّغت الحافظة بعد النقل
    expect(after.links!.some((link) => link.kind === 'DIFFERENCE_TO_LINE' && link.from.id === 'd1')).toBe(true);
    expect(after.editLog?.at(-1)?.action).toBe('نقل من الحافظة');

    store.getState().undo();
    expect(store.getState().document!.links!.some((link) => link.kind === 'DIFFERENCE_TO_LINE')).toBe(false);
  });

  it('اللصق بتحديد اختلاف (لا سطر) يبقى بسلوك المستند العام بلا روابط إلحاق', async () => {
    const { store } = await setup();
    store.getState().selectVariant('d1');
    store.getState().copySelection();
    store.getState().selectVariant('d3');
    await store.getState().requestPasteSelection();
    const after = store.getState().document!;
    expect(after.variants).toHaveLength(4);
    expect(after.links!.some((link) => link.kind === 'DIFFERENCE_TO_LINE')).toBe(false);
  });
});

// ==================== دلالة العرض للرابط الجديد ====================

const fullFilter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

// البقرة ٩: اختلافان بأسطر متعددة — أرضية واقعية لاختبار النقل العرضي.
const AYAH_KEY = makeAyahKey(2, 9);

function buildTashjeer() {
  const variants = getSeedVariants(AYAH_KEY);
  const words = getAyahWordsByKey(AYAH_KEY);
  const layout = layoutAyah(AYAH_KEY, words, DEFAULT_LAYOUT_OPTIONS);
  return { variants, layout, classic: generateClassicTashjeer(variants, layout, fullFilter, DEFAULT_LAYOUT_OPTIONS) };
}

function makeLink(partial: Partial<TashjeerLink> & Pick<TashjeerLink, 'kind' | 'from' | 'to'>): TashjeerLink {
  return {
    id: `test-link-${Math.random().toString(36).slice(2, 8)}`,
    ayahKey: AYAH_KEY,
    relation: 'MERGE',
    origin: 'EDITOR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe('DIFFERENCE_TO_LINE — نقل أحكام الاختلاف وحدها إلى سطر المرساة', () => {
  it('يجمع أحكام الاختلاف في سطر المرساة ويخلّي بقية الأسطر منه', () => {
    const { variants, layout, classic } = buildTashjeer();
    const sourceId = 'v-2-9-yakhdaun';
    const anchorVariant = variants.find((variant) => variant.id === 'v-2-9-munfasil')!;
    const anchorFace = anchorVariant.alternatives.find((face) => !face.isBase)!;
    const link = makeLink({
      kind: 'DIFFERENCE_TO_LINE',
      from: { type: 'RULE', id: sourceId },
      to: { type: 'FACE', id: `${anchorVariant.id}::${anchorFace.id}` },
    });

    // قبل النقل: أحكام الاختلاف موزعة، وسطر المرساة الذي سيستقبلها.
    const targetBefore = classic.lines.find((line) =>
      line.entries.some((entry) => entry.variantId === anchorVariant.id && entry.alternativeId === anchorFace.id)
    )!;
    const movedKeys = classic.lines
      .filter((line) => line !== targetBefore)
      .flatMap((line) => line.entries.filter((entry) => entry.variantId === sourceId))
      .map((entry) => `${entry.variantId}::${entry.alternativeId}`);
    expect(movedKeys.length).toBeGreaterThan(0);

    const { lines, appliedMergeIds } = applyManualLinks(classic.lines, layout, [link], []);
    expect(appliedMergeIds).toContain(link.id);

    // كل الأسطر ما عدا الهدف خالية من الاختلاف المنقول — «العنصران فقط»
    // أما سطره الطبيعي فلا يُسحب معه (عكس دمج LINE_TO_LINE).
    const target = lines.find((line) => line.id === targetBefore.id)!;
    for (const other of lines) {
      if (other === target) continue;
      expect(other.entries.every((entry) => entry.variantId !== sourceId)).toBe(true);
    }

    // الهدف يحمل أحكامه الأصلية + المنقولة في نهايته، بلا تكرار.
    const targetKeys = target.entries.map((entry) => `${entry.variantId}::${entry.alternativeId}`);
    expect(new Set(targetKeys).size).toBe(targetKeys.length);
    const anchorIndex = target.entries.findIndex((entry) => `${entry.variantId}::${entry.alternativeId}` === `${anchorVariant.id}::${anchorFace.id}`);
    const movedIndexes = movedKeys.map((key) => targetKeys.indexOf(key));
    expect(Math.min(...movedIndexes)).toBeGreaterThan(anchorIndex);

    // التجميعات المشتقة أُعيد بناؤها من الأحكام الجديدة.
    expect(target.marks).toHaveLength(target.entries.flatMap((entry) => entry.marks).length);
    expect(target.startPosition).toBe(Math.min(...target.entries.map((entry) => entry.startPosition)));
    expect(target.endPosition).toBe(Math.max(...target.entries.map((entry) => entry.endPosition)));
    expect(target.ruleLabel).toBe([...new Set(target.entries.map((entry) => entry.ruleLabel).filter(Boolean))].join(' + '));
    expect(target.linkIds).toContain(link.id);
  });

  it('يُلحق الأحكام الجديدة في نهاية سطر مرساة لا يحويها (فرع الإضافة)', () => {
    const { layout, classic } = buildTashjeer();
    const sourceId = 'v-2-9-yakhdaun';
    // «الإشباع» سطره لا يحوي وجه يخادعون، فيُلحق الحكم إلحاقًا لا ازدواجًا.
    const link = makeLink({
      kind: 'DIFFERENCE_TO_LINE',
      from: { type: 'RULE', id: sourceId },
      to: { type: 'FACE', id: 'v-2-9-munfasil::a-munfasil-ishbaa' },
    });
    const targetBefore = classic.lines.find((line) => line.id === 'combo::v-2-9-munfasil:a-munfasil-ishbaa')!;
    const { lines, appliedMergeIds } = applyManualLinks(classic.lines, layout, [link], []);
    expect(appliedMergeIds).toContain(link.id);
    const target = lines.find((line) => line.id === targetBefore.id)!;
    // الحكم المنقول في نهاية أحكام الهدف (أدنى رتبة متاحة — القرار المحسوم).
    expect(target.entries.at(-1)?.variantId).toBe(sourceId);
    expect(target.entries).toHaveLength(targetBefore.entries.length + 1);
    // السطران المصدران: المفرغ يُسقط، والمشترك يُعاد بناؤه بلا الحكم المنقول.
    expect(lines).toHaveLength(classic.lines.length - 1);
    const shared = lines.find((line) => line.id === 'combo::v-2-9-munfasil:a-munfasil-qasr|v-2-9-yakhdaun:a-yakhdaun-alif')!;
    expect(shared.entries.every((entry) => entry.variantId !== sourceId)).toBe(true);
    expect(shared.entries.length).toBe(targetBefore.entries.length);
    expect(shared.linkIds ?? []).not.toContain(link.id);
  });

  it('يحذف الرابط يعيد الاختلاف إلى سطره الطبيعي (فك الإلحاق)', () => {
    const { layout, classic } = buildTashjeer();
    const sourceId = 'v-2-9-yakhdaun';
    const link = makeLink({
      kind: 'DIFFERENCE_TO_LINE',
      from: { type: 'RULE', id: sourceId },
      to: { type: 'FACE', id: 'v-2-9-munfasil::a-munfasil-ishbaa' },
    });
    const moved = applyManualLinks(classic.lines, layout, [link], []);
    const unrestrained = applyManualLinks(classic.lines, layout, [], []);
    // بلا الرابط يعود توزيع الأحكام كما أنتجه المحرك بالضبط.
    expect(unrestrained.lines).toEqual(classic.lines);
    expect(moved.lines).not.toEqual(classic.lines);
  });

  it('مرساة مفقودة أو اختلاف بلا أحكام ظاهرة: لا يُطبَّق ولا يكسر الناتج', () => {
    const { layout, classic } = buildTashjeer();
    const dangling = makeLink({
      kind: 'DIFFERENCE_TO_LINE',
      from: { type: 'RULE', id: 'v-2-9-yakhdaun' },
      to: { type: 'FACE', id: 'nope::missing' },
    });
    const { lines, appliedMergeIds } = applyManualLinks(classic.lines, layout, [dangling], []);
    expect(appliedMergeIds).toHaveLength(0);
    expect(lines).toHaveLength(classic.lines.length);
    expect(moveDifferenceIntoLine(classic.lines, dangling)).toBeNull();

    const noEntries = makeLink({
      kind: 'DIFFERENCE_TO_LINE',
      from: { type: 'RULE', id: 'variant-غير-موجود' },
      to: { type: 'FACE', id: 'v-2-9-yakhdaun::x' },
    });
    expect(moveDifferenceIntoLine(classic.lines, noEntries)).toBeNull();
  });

  it('rebuildLineFromEntries: اختزال الوسوم والمدى والنصوص من الأحكام', () => {
    const entry = (variantId: string, alternativeId: string, ruleLabel: string, start: number, end: number): ClassicLineEntry =>
      ({
        variantId,
        alternativeId,
        category: 'FARSH',
        categoryLabel: 'فرش',
        ruleLabel,
        readingText: `${ruleLabel}-نص`,
        readingLabel: `${ruleLabel}-وصف`,
        color: '#000',
        marks: [{ position: start } as never],
        startPosition: start,
        endPosition: end,
        emphasisStartX: 0,
        emphasisEndX: 0,
        labelX: 0,
        emphases: [],
      }) as ClassicLineEntry;
    const base = { id: 'ln', entries: [], marks: [], startPosition: 99, endPosition: 0 } as unknown as ClassicLine;
    const rebuilt = rebuildLineFromEntries(
      base,
      [entry('a', '1', 'إمالة', 5, 6), entry('b', '1', 'إمالة', 2, 3), entry('c', '1', 'مد', 9, 9)],
      'link-1'
    );
    expect(rebuilt.ruleLabel).toBe('إمالة + مد'); // بلا تكرار، بترتيب الأحكام
    expect(rebuilt.startPosition).toBe(2);
    expect(rebuilt.endPosition).toBe(9);
    expect(rebuilt.marks.map((mark) => mark.position)).toEqual([2, 5, 9]); // مرتبة
    expect(rebuilt.readingText).toBe('إمالة-نص … مد-نص');
    expect(rebuilt.linkIds).toEqual(['link-1']);
    expect(rebuilt.id).toBe('ln'); // الهوية لا تُمس
  });
});

// ==================== FR-ED-07: تحديد متعدد وحذف جماعي في كل القوائم ====================

/** أسطر مرسومة مصطنعة: d1 مشترك بين سطرين، وd2/d3 حصريان. */
function bulkLines() {
  return [
    { id: 'line-1', entries: [{ variantId: 'd1' }] },
    { id: 'line-2', entries: [{ variantId: 'd1' }, { variantId: 'd2' }] },
    { id: 'line-3', entries: [{ variantId: 'd3' }] },
  ];
}

async function setupWithConfirm() {
  const { useEditorStore } = await import('@/stores/editor-store');
  const { useConfirmStore } = await import('@/lib/ui/confirm-store');
  useEditorStore.setState({ document: ph3Document(), past: [], future: [], selection: null, multiSelection: null, clipboard: null });
  useConfirmStore.getState().setHostMounted(true);
  return { store: useEditorStore, confirm: useConfirmStore };
}

describe('FR-ED-07 — حذف جماعي للأسطر: الحصري وحده', () => {
  it('exclusiveLineDifferences: الحصري يُحذف والمشترك مع سطر باقٍ يبقى', async () => {
    const { exclusiveLineDifferences } = await import('@/lib/tashjeer/bulk-operations');
    expect(exclusiveLineDifferences(bulkLines(), ['line-1'])).toEqual({ exclusive: [], shared: ['d1'] });
    expect(exclusiveLineDifferences(bulkLines(), ['line-2', 'line-3'])).toEqual({
      exclusive: ['d2', 'd3'],
      shared: ['d1'],
    });
    // الأجزاء ليست اختلافات فلا تُحسب.
    expect(exclusiveLineDifferences([{ id: 'l', entries: [{ variantId: 'segment:s1' }] }], ['l'])).toEqual({
      exclusive: [],
      shared: [],
    });
  });

  it('تحديد سطرين وحذفهما: تأكيد كمي بالحصري والمشترك، ثم تراجع واحد', async () => {
    const { store, confirm } = await setupWithConfirm();
    const before = store.getState().document!;

    store.getState().setMultiSelection({ kind: 'LINE', ids: ['line-2', 'line-3'] });
    let pending = store.getState().requestDeleteItems({ kind: 'LINE', ids: ['line-2', 'line-3'] }, { rendered: bulkLines() });
    expect(confirm.getState().pending?.title).toBe('حذف ٢ أسطر؟');
    // أسطر · اختلافات حصرية · أوجه · روابط · مشترك يبقى
    expect(confirm.getState().pending?.impacts).toEqual([
      { label: 'أسطر', count: 2 },
      { label: 'اختلافات حصرية', count: 2 },
      { label: 'أوجه تُحذف معها', count: 10 },
      { label: 'روابط ستُؤرشف', count: 1 },
      { label: 'اختلافات مشتركة تبقى', count: 1 },
    ]);

    // الإلغاء لا يمسّ شيئا ولا يترك خطوة تراجع.
    confirm.getState().resolve(false);
    await pending;
    expect(store.getState().document).toBe(before);
    expect(store.getState().past).toHaveLength(0);

    pending = store.getState().requestDeleteItems({ kind: 'LINE', ids: ['line-2', 'line-3'] }, { rendered: bulkLines() });
    confirm.getState().resolve(true);
    await pending;

    const after = store.getState().document!;
    expect(after.variants.map((variant) => variant.id)).toEqual(['d1']); // المشترك بقي
    expect(after.deletedItems?.[0].kind).toBe('DIFFERENCE');
    // الرابط الذي طرفاه في المحذوف أُرشيف وحده؛ ورابط d1 الداخلي بقي سليمًا.
    expect(after.links?.map((link) => link.id)).toEqual(['inside']);
    expect(after.deletedItems?.[0].links.map((link) => link.id)).toEqual(['outside']);
    expect(store.getState().past).toHaveLength(1); // دفعة واحدة = خطوة واحدة
    expect(store.getState().multiSelection).toBeNull();

    store.getState().undo();
    expect(store.getState().document).toEqual(before);
  });

  it('أسطر بلا اختلاف حصري: لا يُحذف شيء ويُبلَّغ بالسبب', async () => {
    const { store } = await setupWithConfirm();
    const before = store.getState().document!;
    const done = await store.getState().requestDeleteItems({ kind: 'LINE', ids: ['line-1'] }, { rendered: bulkLines() });
    expect(done).toBe(false);
    expect(store.getState().document).toBe(before);
    expect(store.getState().clipboardNotice).toContain('لا تملك اختلافات حصرية');
    expect(store.getState().past).toHaveLength(0);
  });
});

describe('FR-ED-07 — حذف جماعي للقواعد العامة', () => {
  async function seedRules() {
    const context = await setupWithConfirm();
    const { saveGlobalRule } = await import('@/lib/storage/global-rules-store');
    const { buildCharacterPattern } = await import('@/lib/quran-logic/global-rule-engine');
    const pattern = buildCharacterPattern(makeAyahKey(1, 1), {
      start: { position: 1, characterIndex: 1 },
      end: { position: 1, characterIndex: 3 },
    });
    const first = saveGlobalRule({ id: 'rule-a', title: 'قاعدة ألف', category: 'MADUD', scope: { kind: 'ALL' }, pattern, status: 'APPROVED', isActive: true, createdAt: '2000-01-01' });
    const second = saveGlobalRule({ id: 'rule-b', title: 'قاعدة باء', category: 'USUL', scope: { kind: 'ALL' }, pattern, status: 'DRAFT', isActive: true, createdAt: '2000-01-02' });
    return { ...context, rules: [first, second] };
  }

  it('تحديد قاعدتين وحذفهما: تأكيد كمي بمواضعها واستثناءاتها، وتراجع يعيدهما معا', async () => {
    const { store, confirm, rules } = await seedRules();
    const { listGlobalRules, deleteGlobalRule } = await import('@/lib/storage/global-rules-store');
    const { deleteOccurrence } = await import('@/lib/storage/rule-occurrences-store');
    const { findGlobalRuleMatches } = await import('@/lib/quran-logic/global-rule-engine');

    // استثناء موضعي مسجّل على القاعدة الأولى: يجب أن يُذكر في التأكيد ويعود مع التراجع.
    const matches = findGlobalRuleMatches({ id: rules[0].id, pattern: rules[0].pattern }, { limit: 10 });
    deleteOccurrence(rules[0].id, matches[0], 'خطأ في هذا الموضع');
    expect(listGlobalRules()).toHaveLength(2);

    let pending = store.getState().requestDeleteItems({ kind: 'RULE', ids: ['rule-a', 'rule-b'] });
    expect(confirm.getState().pending?.title).toBe('حذف ٢ قواعد عامة؟');
    expect(confirm.getState().pending?.impacts?.[0]).toEqual({ label: 'قواعد عامة', count: 2 });
    expect(confirm.getState().pending?.impacts?.[1].count).toBeGreaterThan(0); // مواضع مشتقة
    expect(confirm.getState().pending?.impacts?.[2].count).toBe(1); // استثناء مسجّل

    confirm.getState().resolve(false);
    await pending;
    expect(listGlobalRules()).toHaveLength(2); // الإلغاء لا يمسّ المخزن

    pending = store.getState().requestDeleteItems({ kind: 'RULE', ids: ['rule-a', 'rule-b'] });
    confirm.getState().resolve(true);
    await pending;
    expect(listGlobalRules()).toHaveLength(0);
    expect(store.getState().past).toHaveLength(1); // القاعدتان في خطوة واحدة
    expect(store.getState().document?.editLog?.at(-1)?.action).toBe('حذف جماعي لقواعد عامة');

    store.getState().undo();
    expect(listGlobalRules().map((rule) => rule.id).sort()).toEqual(['rule-a', 'rule-b']);
    // الاستثناء الموضعي عاد مع القاعدة (اللقطة الموحّدة تلتقط المخزنين).
    const { overrideById, occurrenceIdFor } = await import('@/lib/storage/rule-occurrences-store');
    expect(overrideById(occurrenceIdFor('rule-a', matches[0]))?.state).toBe('DELETED');
    // والقاعدة المحذوفة منفردة تبقى ممكنة (لم تُكسر).
    deleteGlobalRule('rule-a');
    expect(listGlobalRules().map((rule) => rule.id)).toEqual(['rule-b']);
  });
});

describe('FR-ED-07.4 — حذف جماعي لمواضع قاعدة كـ localOverride', () => {
  it('يُسجَّل تجاوز محلي لكل موضع، والقاعدة الأم باقية، وتراجع واحد يعيد الكل', async () => {
    const { store, confirm } = await setupWithConfirm();
    const { saveGlobalRule, listGlobalRules } = await import('@/lib/storage/global-rules-store');
    const { buildCharacterPattern, findGlobalRuleMatches } = await import('@/lib/quran-logic/global-rule-engine');
    const { overrideById, occurrenceIdFor } = await import('@/lib/storage/rule-occurrences-store');

    const pattern = buildCharacterPattern(makeAyahKey(1, 1), {
      start: { position: 1, characterIndex: 1 },
      end: { position: 1, characterIndex: 3 },
    });
    const rule = saveGlobalRule({ id: 'rule-c', title: 'قاعدة جيم', category: 'FARSH', scope: { kind: 'ALL' }, pattern, status: 'DRAFT', isActive: true, createdAt: '2000-01-01' });
    const matches = findGlobalRuleMatches({ id: rule.id, pattern: rule.pattern }, { limit: 5 });
    expect(matches.length).toBeGreaterThan(2);
    const chosen = matches.slice(0, 2);

    let pending = store.getState().requestDeleteOccurrencesBulk(rule.id, chosen, 'موضعان لا ينطبقان');
    expect(confirm.getState().pending?.title).toBe('حذف موضعين من «قاعدة جيم»؟');
    expect(confirm.getState().pending?.impacts?.[0]).toEqual({ label: 'مواضع تُحذف محليًا', count: 2 });
    expect(confirm.getState().pending?.impacts?.[2]).toEqual({ label: 'قواعد أم تبقى', count: 1 });

    confirm.getState().resolve(false);
    await pending;
    expect(chosen.every((match) => overrideById(occurrenceIdFor(rule.id, match)) === undefined)).toBe(true);

    pending = store.getState().requestDeleteOccurrencesBulk(rule.id, chosen, 'موضعان لا ينطبقان');
    confirm.getState().resolve(true);
    await pending;

    // localOverride لكل موضع: القاعدة باقية وبقية مواضعها لم تُمس.
    expect(listGlobalRules().map((item) => item.id)).toEqual(['rule-c']);
    for (const match of chosen) {
      const override = overrideById(occurrenceIdFor(rule.id, match))!;
      expect(override.state).toBe('DELETED');
      expect(override.reason).toBe('موضعان لا ينطبقان');
    }
    expect(overrideById(occurrenceIdFor(rule.id, matches[2]))).toBeUndefined();
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().document?.editLog?.at(-1)?.action).toBe('حذف جماعي لمواضع قاعدة');

    store.getState().undo();
    expect(chosen.every((match) => overrideById(occurrenceIdFor(rule.id, match)) === undefined)).toBe(true);
  });
});

// ==================== FR-ED-06: مستوى «قاعدة» ونسخ السطر بأجزائه ====================

async function seedTwoRules() {
  const { store, confirm } = await setupWithConfirm();
  const { saveGlobalRule } = await import('@/lib/storage/global-rules-store');
  const { buildCharacterPattern } = await import('@/lib/quran-logic/global-rule-engine');
  const pattern = buildCharacterPattern(makeAyahKey(1, 1), {
    start: { position: 1, characterIndex: 1 },
    end: { position: 1, characterIndex: 3 },
  });
  const first = saveGlobalRule({
    id: 'rule-src-1', title: 'مد منفصل', category: 'MADUD', scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] },
    pattern, maddHarakat: 4, status: 'APPROVED', isActive: true, createdAt: '2000-01-01',
  });
  const second = saveGlobalRule({
    id: 'rule-src-2', title: 'إمالة', category: 'USUL', scope: { kind: 'ALL' },
    pattern, status: 'REVIEW', isActive: false, createdAt: '2000-01-02',
  });
  return { store, confirm, rules: [first, second] };
}

describe('FR-ED-06 — مستوى «قاعدة» في الحافظة الموحّدة', () => {
  it('cloneRulesForClipboard: معرّفات جديدة وcopiedFrom ومسودة ودفعة مشتركة', async () => {
    const { cloneRulesForClipboard } = await import('@/lib/tashjeer/clipboard');
    const { rules } = await seedTwoRules();

    const clones = cloneRulesForClipboard(rules);
    expect(clones.map((clone) => clone.copiedFrom)).toEqual(['rule-src-1', 'rule-src-2']);
    expect(clones.every((clone) => clone.id !== 'rule-src-1' && clone.id !== 'rule-src-2')).toBe(true);
    expect(clones.every((clone) => clone.status === 'DRAFT')).toBe(true); // التوثيق لا يُورَّث
    expect(clones[0].createBatchId).toBe(clones[1].createBatchId); // دفعة واحدة للتراجع (DM-08)
    expect(clones.every((clone) => clone.createdAt !== '2000-01-01')).toBe(true);
    expect(clones[0].title).toBe('مد منفصل — نسخة');
    expect(clones[1].isActive).toBe(false); // حالة التفعيل تُحفظ كما هي
    // الأصل لا يُمس والنطاق مستقل.
    expect(rules[0].title).toBe('مد منفصل');
    expect(rules[0].scope).not.toBe(clones[0].scope);

    // قاعدة واحدة: لا دفعة جديدة، و`copiedFrom` يوثّق الأصل وحده.
    const single = cloneRulesForClipboard([rules[0]]);
    expect(single[0].createBatchId).toBeUndefined();
    expect(single[0].copiedFrom).toBe('rule-src-1');
  });

  it('نسخ قاعدتين ← Ctrl+V: نسخ مستقلة بمعرّفات جديدة، تعديلها لا يمس الأصل، وتراجع واحد', async () => {
    const { store, confirm } = await seedTwoRules();
    const { listGlobalRules, saveGlobalRule } = await import('@/lib/storage/global-rules-store');

    store.getState().setMultiSelection({ kind: 'RULE', ids: ['rule-src-1', 'rule-src-2'] });
    store.getState().copySelection();
    expect(store.getState().clipboard?.kind).toBe('RULES');

    const pending = store.getState().requestPasteSelection();
    expect(confirm.getState().pending?.title).toContain('لصق نسخ مستقلة من القواعد العامة');
    expect(confirm.getState().pending?.impacts?.[0]).toEqual({ label: 'قواعد عامة', count: 2 });
    confirm.getState().resolve(true);
    await pending;

    const after = listGlobalRules();
    expect(after).toHaveLength(4);
    const clones = after.filter((rule) => rule.copiedFrom);
    expect(clones).toHaveLength(2);
    expect(clones.map((rule) => rule.copiedFrom).sort()).toEqual(['rule-src-1', 'rule-src-2']);
    expect(store.getState().past).toHaveLength(1); // اللصق كله خطوة واحدة

    // تعديل النسخة لا يمس الأصل.
    saveGlobalRule({ ...clones[0], title: 'معدّل على النسخة' });
    expect(listGlobalRules().find((rule) => rule.id === 'rule-src-1')?.title).toBe('مد منفصل');

    store.getState().undo();
    expect(listGlobalRules().map((rule) => rule.id).sort()).toEqual(['rule-src-1', 'rule-src-2']);
  });

  it('القص ينقل القاعدة: تُحذف الأصول بعد التأكيد، والتراجع يعيدها', async () => {
    const { store, confirm } = await seedTwoRules();
    const { listGlobalRules } = await import('@/lib/storage/global-rules-store');

    store.getState().setSelection({ kind: 'RULE', id: 'rule-src-1' });
    store.getState().cutSelection();
    expect(store.getState().clipboard?.kind).toBe('RULE');
    expect(store.getState().clipboard?.mode).toBe('CUT');
    expect(listGlobalRules()).toHaveLength(2); // القص وحده لا يغيّر المخزن

    const pending = store.getState().requestPasteSelection();
    expect(confirm.getState().pending?.title).toContain('نقل القواعد العامة');
    confirm.getState().resolve(true);
    await pending;

    const after = listGlobalRules();
    expect(after).toHaveLength(2); // نُقلت لا نُسخت
    expect(after.map((rule) => rule.id)).not.toContain('rule-src-1');
    expect(after.find((rule) => rule.copiedFrom === 'rule-src-1')).toBeDefined();
    expect(store.getState().clipboard).toBeNull(); // فُرّغت بعد النقل
    expect(store.getState().past).toHaveLength(1);

    store.getState().undo();
    expect(listGlobalRules().some((rule) => rule.id === 'rule-src-1')).toBe(true);
  });

  it('مسار المستند يرفض حمولة قواعد صراحة ولا يلمس المستند', async () => {
    const document = ph3Document();
    const { rules } = await seedTwoRules();
    const clipboard = snapshotClipboard(document, { kind: 'RULE', value: rules[0] });
    const result = pasteClipboard(document, clipboard);
    expect(result.error).toContain('مخزن القواعد');
    expect(result.document).toBe(document);
    expect(result.ids).toEqual([]);
  });
});

describe('FR-ED-06.1 — نسخ سطر كامل بأجزائه', () => {
  it('الأجزاء تُستنسخ بمعرّفات جديدة وcopiedFrom، وروابطها الخارجة تُعلَّق للمراجعة', async () => {
    const { store } = await setup();
    const withSegment = {
      ...store.getState().document!,
      segments: [
        {
          id: 'seg-1', ayahKey: 1004, title: 'جزء الاختبار', startPosition: 1, endPosition: 2,
          origin: 'EDITOR' as const, createdAt: '2000-01-01', updatedAt: '2000-01-02',
        },
      ],
      links: [
        ...(store.getState().document!.links ?? []),
        {
          id: 'seg-link', ayahKey: 1004, kind: 'SEGMENT_TO_LINE' as const, relation: 'MERGE' as const,
          from: { type: 'SEGMENT' as const, id: 'seg-1' }, to: { type: 'LINE' as const, id: 'line-9' },
          origin: 'EDITOR' as const, createdAt: '2000', updatedAt: '2000',
        },
      ],
    };
    store.setState({ document: withSegment });

    store.getState().copyLine('line-1', 'سطر ١', ['d1', 'd2'], ['seg-1']);
    const clipboard = store.getState().clipboard!;
    expect(clipboard.kind).toBe('LINE');
    expect(clipboard.kind === 'LINE' && clipboard.value.segments).toHaveLength(1);

    store.getState().pasteSelection();
    const after = store.getState().document!;

    // الاختلافات والأجزاء معا: نسخ مستقلة بمعرّفات جديدة وتوثيق الأصل.
    expect(after.variants).toHaveLength(5);
    expect(after.segments).toHaveLength(2);
    const segmentCopy = after.segments!.at(-1)!;
    expect(segmentCopy.id).not.toBe('seg-1');
    expect(segmentCopy.copiedFrom).toBe('seg-1');
    expect(segmentCopy.createdAt).not.toBe('2000-01-01');
    expect(segmentCopy.origin).toBe('EDITOR');

    // رابط الجزء يشير إلى سطر خارج مجموعة النسخ: يُعلَّق ولا يُستنسخ خطأ.
    expect(after.links?.some((link) => link.id === 'seg-link')).toBe(true);
    expect(after.suspendedLinks?.some((item) => item.original.id === 'seg-link')).toBe(true);
    expect(after.suspendedLinks?.at(-1)?.mappedFrom).toBe(segmentCopy.id);

    // الأصل لم يتغير.
    expect(after.segments![0]).toBe(withSegment.segments![0]);

    store.getState().undo();
    expect(store.getState().document).toEqual(withSegment);
  });
});

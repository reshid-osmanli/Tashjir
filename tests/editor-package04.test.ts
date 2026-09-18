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

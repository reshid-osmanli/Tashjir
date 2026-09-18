// اختبارات استكمال الحزمة 06 — المعالج الذكي الموحّد
// مشروع التشجير - نظام القراءات العشر
//
// ما تضيفه هذه الاختبارات فوق ملفات smart-create القائمة:
//  1) علاقات المعالج تمر عبر Resolver (قاعدة 3): ما خالف اقتراح السياسة
//     يُوثَّق علاقة يدوية DIFFERENCE_TO_DIFFERENCE + Correction يسبق السياسة
//     في محرك التراكيب — لا علاقة معروضة بلا أثر («لا علاقات خفية» معكوسًا).
//  2) علاقة «جزء من» (PART_OF) بنيوية مرجعية بلا دلالة تنافٍ.
//  3) نطاق «الآية» (الخطوة 6): إنشاء مباشر على كل المواضع المطابقة للنمط
//     الحتمي في الآية الحالية بلا حفظ أي قاعدة عامة، في معاملة واحدة.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAyahWordsByKey, makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';
import { splitQuranCharacters } from '@/lib/quran-logic/characters';
import {
  buildCharacterPattern,
  findGlobalRuleMatchesInAyah,
} from '@/lib/quran-logic/global-rule-engine';
import {
  manualDifferenceRelationsOf,
  resolveExclusiveGroups,
} from '@/lib/tashjeer/decision/editor-bridge';
import { buildSmartCreateBatch, buildSmartCreateMultiTargetBatch } from '@/lib/tashjeer/smart-create';

const AYAH_KEY = makeAyahKey(1, 4);
const BASMALA_KEY = makeAyahKey(1, 1);

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadStore() {
  const { useEditorStore } = await import('@/stores/editor-store');
  return useEditorStore;
}

describe('علاقات المعالج تمر عبر Resolver (حزمة 06 قاعدة 3)', () => {
  it('تنافٍ يخالف السياسة: علاقة يدوية موثقة + Correction، والمحرك يلتزمها', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    // مد + فرش في الموضع نفسه: سياسة المحرك الافتراضية تجمعهما (مرتبطان)،
    // والمستخدم اختار في المعالج «متنافيان» — فيُوثَّق القرار ويسبق السياسة.
    const batch = buildSmartCreateBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 2, endPosition: 2 }],
      baseTitle: 'مالك',
      types: ['MADUD', 'FARSH'],
      scope: { kind: 'ALL' },
      relations: [{ fromType: 'MADUD', toType: 'FARSH', type: 'MUTUALLY_EXCLUSIVE' }],
    });
    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    // علاقة يدوية موثقة بصيغة DIFFERENCE_TO_DIFFERENCE يقرؤها Resolver.
    const manuals = manualDifferenceRelationsOf(document.links ?? []);
    expect(manuals).toHaveLength(1);
    expect(manuals[0]!.relation).toBe('MUTUALLY_EXCLUSIVE');
    expect(manuals[0]!.fromId).toBe(batch.differences[0]!.id);
    expect(manuals[0]!.toId).toBe(batch.differences[1]!.id);

    // المحرك يلتزم القرار اليدوي عند تغذيته من روابط المستند (كما يفعل
    // classic-tashjeer): الاختلافان في مجموعة تنافٍ واحدة (لا يُضربان).
    const created = document.variants.filter((variant) =>
      batch.differences.some((difference) => difference.id === variant.id)
    );
    const { groups } = resolveExclusiveGroups(created, undefined, manuals);
    expect(groups.get(batch.differences[0]!.id)).toBe(groups.get(batch.differences[1]!.id));

    // التصحيح الموثق (A = المحرك، B = المحرر، النهائي = B).
    const corrections = document.corrections ?? [];
    expect(corrections).toHaveLength(1);
    expect(corrections[0]!.source).toBe('editor');
    expect(corrections[0]!.targetId).toBe(batch.differences[0]!.id);

    // تراجع واحد يزيل الاختلافات والعلاقة والتصحيح معًا (تنفيذ ذري).
    const historyDepth = useEditorStore.getState().past.length;
    useEditorStore.getState().undo();
    const undone = useEditorStore.getState().document!;
    expect(undone.links?.length ?? 0).toBe(0);
    expect(undone.corrections?.length ?? 0).toBe(0);
    expect(useEditorStore.getState().past.length).toBe(historyDepth - 1);
  });

  it('ارتباط يوافق السياسة: رابط بنيوي فقط بلا تجاوز موثق ولا تصحيح', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    const batch = buildSmartCreateBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 2, endPosition: 2 }],
      baseTitle: 'مالك',
      types: ['USUL', 'MADUD'],
      scope: { kind: 'ALL' },
      relations: [{ fromType: 'USUL', toType: 'MADUD', type: 'RELATED' }],
    });
    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    // يوافق اقتراح السياسة: الرابط البنيوي للعرض يكفي، لا علاقة يدوية ولا تصحيح.
    expect(document.links).toHaveLength(1);
    expect(document.links![0]!.kind).toBe('FACE_TO_FACE');
    expect(document.links![0]!.relation).toBe('REFERENCE');
    expect(manualDifferenceRelationsOf(document.links ?? [])).toHaveLength(0);
    expect(document.corrections?.length ?? 0).toBe(0);

    // والسياسة وحدها تبقی حاكمة: المجموعتان منفصلتان (فئتان مختلفتان تجتمعان).
    const created = document.variants.filter((variant) =>
      batch.differences.some((difference) => difference.id === variant.id)
    );
    const { groups } = resolveExclusiveGroups(created);
    expect(groups.get(batch.differences[0]!.id)).not.toBe(groups.get(batch.differences[1]!.id));
  });

  it('«جزء من»: رابط بنيوي مرجعي بلا دلالة تنافٍ ولا تصحيح', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(AYAH_KEY);

    const batch = buildSmartCreateBatch({
      ayahKey: AYAH_KEY,
      selection: [{ startPosition: 2, endPosition: 2 }],
      baseTitle: 'مالك',
      types: ['FARSH', 'USUL'],
      scope: { kind: 'ALL' },
      relations: [{ fromType: 'FARSH', toType: 'USUL', type: 'PART_OF' }],
    });
    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    expect(document.links).toHaveLength(1);
    const link = document.links![0]!;
    expect(link.kind).toBe('FACE_TO_FACE');
    expect(link.relation).toBe('REFERENCE');
    expect(manualDifferenceRelationsOf(document.links ?? [])).toHaveLength(0);
    expect(document.corrections?.length ?? 0).toBe(0);
  });
});

describe('نطاق «الآية» المباشر بلا قاعدة (الخطوة 6)', () => {
  /** نمط حرف «م» في البسملة (تجاهل الحركة): يطابق بسم والرحمن والرحيم. */
  function meemPattern() {
    const words = getAyahWordsByKey(BASMALA_KEY);
    const meemIndex = splitQuranCharacters(words[0]!.text).find((character) =>
      character.text.includes('م')
    )!.index;
    return buildCharacterPattern(
      BASMALA_KEY,
      {
        start: { position: 1, characterIndex: meemIndex },
        end: { position: 1, characterIndex: meemIndex },
      },
      { defaultHarakaMode: 'IGNORE' }
    );
  }

  it('النمط الحتمي يطابق مواضع متعددة في الآية الواحدة', () => {
    const matches = findGlobalRuleMatchesInAyah({ id: 'ayah-direct', pattern: meemPattern() }, BASMALA_KEY);
    // البسملة فيها أكثر من موضع لحرف الميم، وكلها بمدى حرفي (العدد الدقيق
    // شأن محرك القواعد وله اختباراته؛ هنا يثبت تعدد المواضع لا عدّادها).
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches.every((match) => match.characterRange)).toBe(true);
  });

  it('تُنشئ البنية على كل موضع مطابق في معاملة واحدة بلا قاعدة عامة، وتراجع واحد يزيلها', async () => {
    const useEditorStore = await loadStore();
    useEditorStore.getState().openAyah(BASMALA_KEY);
    const beforeCount = useEditorStore.getState().document!.variants.length;
    const historyDepth = useEditorStore.getState().past.length;

    const { listGlobalRules } = await import('@/lib/storage/global-rules-store');
    expect(listGlobalRules()).toHaveLength(0);

    // محاكاة مسار المعالج: المواضع المطابقة ← أهداف الإسناد الدفعي.
    const matches = findGlobalRuleMatchesInAyah({ id: 'ayah-direct', pattern: meemPattern() }, BASMALA_KEY);
    const batch = buildSmartCreateMultiTargetBatch({
      ayahKey: BASMALA_KEY,
      selection: matches.map((match) => ({
        startPosition: match.startPosition,
        endPosition: match.endPosition,
        characterRange: match.characterRange,
      })),
      baseTitle: 'م',
      types: ['MADUD', 'HAMZ'],
      scope: { kind: 'ALL' },
      relations: [{ fromType: 'MADUD', toType: 'HAMZ', type: 'RELATED' }],
      targets: matches.map((match) => [
        { startPosition: match.startPosition, endPosition: match.endPosition, characterRange: match.characterRange },
      ]),
      titles: matches.map((match) => match.matchedText),
    });
    useEditorStore.getState().applySmartCreateBatch(batch);

    const document = useEditorStore.getState().document!;
    // نوعان مستقلان × عدد المواضع المطابقة، وكل هدف حمل علامته على موضعه.
    expect(document.variants.length).toBe(beforeCount + matches.length * 2);
    for (const difference of batch.differences) {
      const created = document.variants.find((variant) => variant.id === difference.id);
      expect(created).toBeDefined();
      expect(created!.targetKind).toBe('CHARACTERS');
      expect(created!.characterRange).toBeDefined();
    }
    // لا قاعدة عامة حُفظت: مستوى الآية إنشاء مباشر بلا قاعدة (الحزمة 06 الخطوة 6).
    expect(listGlobalRules()).toHaveLength(0);
    // معاملة واحدة: خطوة تراجع واحدة رغم تعدد الكيانات.
    expect(useEditorStore.getState().past.length).toBe(historyDepth + 1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document!.variants.length).toBe(beforeCount);
    expect(useEditorStore.getState().document!.links?.length ?? 0).toBe(0);
  });
});

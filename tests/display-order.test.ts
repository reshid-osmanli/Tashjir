// اختبارات الترتيب الصريح للظهور (FR-ED-14، DM-04، DM-17)
//
// المطلوب حرفيًا من المالك:
//
//   «عند تعديل رموز القراء أو الرواة أو الطرق من الإعدادات، يجب ألا يتغير ترتيب
//    ظهورهم عشوائيا بناء على الاسم أو ترتيب الإدخال أو تاريخ الإضافة. الظهور
//    بجانب السطر يعتمد بدقّة على رقم ترتيب الإمام/القارئ/الراوي/الطريق المحدد
//    في البيانات: Order 1 → Order 2 → Order 3 → Order 4 (دائمًا بهذا الترتيب).
//    حتى لو تغير: الاسم، الرمز، النص، إعداد العرض. لا يتغير الترتيب الأساسي إلا
//    بتعديل رقم الترتيب نفسه.»
//
// فاختبارات هذا ملف أربعة أبواب:
//   1) الاسم/الرمز/إعداد العرض لا تحرّك أحدًا (معيار القبول ١).
//   2) تغيير الرقم وحده يعيد الترتيب في كل الواجهات وفي التصدير (معيار ١).
//   3) الحتمية: نفس البيانات ← نفس الترتيب بعد إعادة التحميل والاستيراد (T1.5).
//   4) الترحيل اللطيف وفضّ التعارض بالأصغر معرفًا (T1.4، §8).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';
import {
  createDefaultTransmissionCatalog,
  insertWithShift,
  movePeer,
  normalizeTransmissionCatalog,
  readTransmissionCatalog,
  saveTransmissionCatalog,
  TRANSMISSION_CATALOG_VERSION,
  type TransmissionCatalog,
} from '@/lib/transmissions/catalog';
import {
  compareExplicitOrder,
  detectDisplayOrderConflicts,
  displayOrderOfImam,
  displayOrderOfNarrator,
  displayOrderOfPath,
  imamChipDisplayOrder,
  isSortedByDisplayOrder,
  pathDisplayKey,
  resolveDisplayOrderConflicts,
  sortNarratorIds,
} from '@/lib/tashjeer/display-order';
import { allNarratorIds, resolveScope } from '@/lib/tashjeer/scope';
import { chipsForUnits, getImamsWithSymbols } from '@/lib/tashjeer/reader-symbols';
import { getNarratorsByDisplayOrder } from '@/lib/tashjeer/symbols';
import { compareAlternatives, leadNarratorOrder, orderVariantsForReading } from '@/lib/tashjeer/ordering';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import type { Variant, VariantAlternative, ViewFilter } from '@/types/tashjeer';
import type { Narrator } from '@/types';

// ==================== أدوات ====================

/** كتالوج معدَّل بدالة نقية، ثم مُطبَّع كما يُطبَّع عند الحفظ. */
function withCatalog(
  change: (catalog: TransmissionCatalog) => TransmissionCatalog
): TransmissionCatalog {
  return normalizeTransmissionCatalog(change(createDefaultTransmissionCatalog()));
}

/**
 * «بصمة الترتيب» في كل الواجهات دفعة واحدة.
 *
 * إن لم تتغير هذه البصمة بتغيير الاسم أو الرمز فالترتيب لم يتغير؛ وإن تغيرت
 * بتغيير الرقم وحده فالرقم هو الحاكم. هذا هو جوهر معيار القبول الأول.
 */
function displayFingerprint(catalog: TransmissionCatalog): Record<string, unknown> {
  const scope = { kind: 'ALL' as const };
  return {
    narrators: allNarratorIds(catalog),
    imams: getImamsWithSymbols(catalog).map((imam) => imam.id),
    narratorsList: getNarratorsByDisplayOrder(catalog).map((narrator) => narrator.id),
    chips: chipsForUnits(
      resolveScope(scope, catalog).map((narratorId) => ({ narratorId })),
      catalog
    ).map((chip) => `${chip.kind}:${chip.id}`),
    resolved: resolveScope(scope, catalog),
    exportOrders: catalog.imams
      .map((imam) => `${imam.id}=${imam.order}`)
      .concat(catalog.narrators.map((narrator) => `${narrator.id}=${narrator.order}`))
      .concat(catalog.paths.map((path) => `${path.id}=${path.order}`)),
  };
}

const ayahKey = makeAyahKey(1, 2);
const layout = layoutAyah(ayahKey, getAyahWords(1, 2), DEFAULT_LAYOUT_OPTIONS);
const filter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

function alternative(id: string, narratorIds: string[], text: string): VariantAlternative {
  return {
    id,
    text,
    label: text,
    scope: { kind: 'NARRATORS', narratorIds },
  };
}

function variant(id: string, alternatives: VariantAlternative[]): Variant {
  return {
    id,
    ayahKey,
    category: 'FARSH',
    title: id,
    startPosition: 4,
    endPosition: 4,
    status: 'DRAFT',
    alternatives: [
      { id: `${id}-base`, text: 'الأصل', label: 'الأصل', isBase: true, scope: { kind: 'ALL' } },
      ...alternatives,
    ],
  };
}

/** ترتيب الأسطر (قارئ كل سطر) كما يرسمها المحرك في اللوحة. */
function lineReaders(catalog: TransmissionCatalog): string[] {
  const result = generateClassicTashjeer(
    [
      variant('farsh', [
        alternative('a-hafs', ['narrator-hafs'], 'وجه حفص'),
        alternative('a-qalun', ['narrator-qalun'], 'وجه قالون'),
        alternative('a-layth', ['narrator-al-layth'], 'وجه الليث'),
      ]),
    ],
    layout,
    filter,
    DEFAULT_LAYOUT_OPTIONS,
    { engine: { ...DEFAULT_ENGINE_SETTINGS, lineComposition: 'PER_VARIANT' }, catalog }
  );
  return result.lines.map((line) => line.readers[0]?.narratorId ?? line.narratorIds[0] ?? '');
}

// ==================== 1) الاسم والرمز لا يحكمان الترتيب ====================

describe('الاسم والرمز وإعداد العرض لا تغيّر ترتيب الظهور', () => {
  it('إعادة تسمية قارئ من «عاصم» إلى «زميل عاصم» لا تحرّكه من ترتيبه', () => {
    const base = createDefaultTransmissionCatalog();
    const renamed = withCatalog((catalog) => ({
      ...catalog,
      imams: catalog.imams.map((imam) =>
        imam.id === 'imam-asim' ? { ...imam, name: 'زميل عاصم' } : imam
      ),
      narrators: catalog.narrators.map((narrator) =>
        narrator.id === 'narrator-hafs' ? { ...narrator, name: 'حفص المعدَّل' } : narrator
      ),
    }));

    expect(displayOrderOfImam('imam-asim', renamed)).toBe(displayOrderOfImam('imam-asim', base));
    // الاسم الجديد أبجديًا متأخر جدا، ولو كان الاسم يحكم لتغيّر الموضع.
    expect(displayFingerprint(renamed)).toEqual(displayFingerprint(base));
  });

  it('تغيير الرموز وحده لا يغيّر الترتيب في أي واجهة', () => {
    const base = createDefaultTransmissionCatalog();
    const resymbolled = withCatalog((catalog) => ({
      ...catalog,
      imams: catalog.imams.map((imam) => ({ ...imam, symbol: `رمز-${imam.id}` })),
      narrators: catalog.narrators.map((narrator) => ({ ...narrator, symbol: 'ظ' })),
      paths: catalog.paths.map((path) => ({ ...path, symbol: 'ط' })),
    }));

    expect(displayFingerprint(resymbolled)).toEqual(displayFingerprint(base));
    expect(getImamsWithSymbols(resymbolled)[0].symbol).toBe('رمز-imam-nafi');
  });

  it('كسر التعادل بالمعرّف لا بالاسم: التساوي لا يُحسم أبجديًا عربيًا', () => {
    // راويان برقم واحد: الأصغر معرفًا أولًا مهما كان اسمهما.
    const catalog = withCatalog((base) => ({
      ...base,
      narrators: base.narrators.map((narrator) =>
        narrator.id === 'narrator-qalun'
          ? { ...narrator, name: 'يزيد', order: 2 }
          : narrator.id === 'narrator-warsh'
            ? { ...narrator, name: 'إبراهيم', order: 2 }
            : narrator
      ),
    }));

    const ids = allNarratorIds(catalog).slice(0, 2);
    expect(ids).toEqual(['narrator-qalun', 'narrator-warsh']);
    // «إبراهيم» أبجديًا قبل «يزيد»، ولو حكم الاسم ل انعكس الترتيب.
    expect(ids[0]).not.toBe('narrator-warsh');
  });

  it('ترتيب المصفوفة الخام (تاريخ الإدخال) لا يحكم الظهور', () => {
    const shuffled = withCatalog((catalog) => ({
      ...catalog,
      narrators: [...catalog.narrators].reverse(),
      imams: [...catalog.imams].reverse(),
      paths: [...catalog.paths].reverse(),
    }));

    expect(displayFingerprint(shuffled)).toEqual(
      displayFingerprint(createDefaultTransmissionCatalog())
    );
  });
});

// ==================== 2) الرقم وحده يغيّر الترتيب ====================

describe('تغيير رقم الترتيب يعيد ترتيب الظهور في كل الواجهات', () => {
  /** ينقل حفصًا من ٩ إلى ٥ بإدراج مع إزاحة، كما تفعل لوحة التحكم. */
  function hafsToFive(): TransmissionCatalog {
    return withCatalog((catalog) => {
      const hafs = catalog.narrators.find((narrator) => narrator.id === 'narrator-hafs')!;
      return { ...catalog, narrators: insertWithShift(catalog.narrators, hafs, 5) };
    });
  }

  it('يحرّكه في قائمة الرواة ومحدد النطاقات والتصفية', () => {
    const catalog = hafsToFive();

    expect(displayOrderOfNarrator('narrator-hafs', catalog)).toBe(5);
    expect(allNarratorIds(catalog)[4]).toBe('narrator-hafs');
    expect(catalog.narrators.map((narrator) => narrator.id).indexOf('narrator-hafs')).toBe(4);
    // الإزاحة خطوة واحدة بلا قفز: من كان قبل ٥ بقي، ومن كان ٥ فصاعدًا تقدّم.
    expect(displayOrderOfNarrator('narrator-al-bazzi', catalog)).toBe(3);
    expect(displayOrderOfNarrator('narrator-qunbul', catalog)).toBe(4);
    expect(displayOrderOfNarrator('narrator-al-duri-abu-amr', catalog)).toBe(6);
    expect(isSortedByDisplayOrder(catalog.narrators)).toBe(true);
  });

  it('يحرّكه في بطاقات الرموز بجانب السطر وفي ترتيب الأسطر', () => {
    const base = createDefaultTransmissionCatalog();
    // الليث (١٣) يصير خامسًا، فيتقدم على حفص (٩) في ترتيب الأمة على اللوحة.
    const catalog = withCatalog((current) => ({
      ...current,
      narrators: insertWithShift(
        current.narrators,
        current.narrators.find((narrator) => narrator.id === 'narrator-al-layth')!,
        5
      ),
    }));

    expect(lineReaders(base)).toEqual(['narrator-qalun', 'narrator-hafs', 'narrator-al-layth']);
    expect(lineReaders(catalog)).toEqual(['narrator-qalun', 'narrator-al-layth', 'narrator-hafs']);
  });

  it('يحرّكه في ترتيب الأوجه (قوة الوجه متساوية فيسقط إلى الترتيب الصريح)', () => {
    const catalog = hafsToFive();
    const alt = (id: string, narratorIds: string[]): VariantAlternative =>
      alternative(id, narratorIds, id);

    const before = leadNarratorOrder(alt('x', ['narrator-hafs']), createDefaultTransmissionCatalog());
    const after = leadNarratorOrder(alt('x', ['narrator-hafs']), catalog);
    expect(before).toBe(9);
    expect(after).toBe(5);
  });

  it('يحرّكه في التصدير: الرتبة المصدَّرة هي الرقم الحاكم نفسه', async () => {
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
    const store = await import('@/lib/storage/document-store');
    const catalog = hafsToFive();
    saveTransmissionCatalog(catalog);

    const entries = store.displayOrderOfCatalog(catalog);
    const hafs = entries.find((entry) => entry.id === 'narrator-hafs');
    expect(hafs).toMatchObject({ kind: 'NARRATOR', displayOrder: 5 });
    vi.unstubAllGlobals();
  });

  it('لا يغيّر أي معرّف: المعرّفات مقدسة', () => {
    const base = createDefaultTransmissionCatalog();
    const catalog = hafsToFive();

    expect(catalog.narrators.map((narrator) => narrator.id).sort()).toEqual(
      base.narrators.map((narrator) => narrator.id).sort()
    );
    expect(catalog.narrators.find((narrator) => narrator.id === 'narrator-hafs')?.imamId).toBe(
      'imam-asim'
    );
  });

  it('رقم الطريق يحرّك الطريق داخل راويه ولا يتجاوز راويًا آخر', () => {
    const swapped = withCatalog((catalog) => ({
      ...catalog,
      paths: movePeer(
        catalog.paths.filter((path) => path.narratorId === 'narrator-warsh'),
        'path-warsh-al-asbahani',
        0
      ).concat(catalog.paths.filter((path) => path.narratorId !== 'narrator-warsh')),
    }));

    expect(displayOrderOfPath('path-warsh-al-asbahani', swapped)).toBe(1);
    expect(pathDisplayKey('path-warsh-al-asbahani', swapped)).toBeLessThan(
      pathDisplayKey('path-warsh-al-azraq', swapped)
    );
    // ورش (٢) قبل البزي (٣) مهما تبدلت طرقه: الكسر أقل من واحد دائمًا.
    expect(pathDisplayKey('path-warsh-al-azraq', swapped)).toBeLessThan(
      displayOrderOfNarrator('narrator-al-bazzi', swapped)
    );
  });

  it('بطاقة الإمام تأخذ موضع أول رواته، لا رقم الإمام بين الأئمة', () => {
    const catalog = createDefaultTransmissionCatalog();
    expect(imamChipDisplayOrder('imam-asim', ['narrator-hafs', 'narrator-shubah'], catalog)).toBe(9);
    expect(imamChipDisplayOrder('imam-nafi', ['narrator-qalun', 'narrator-warsh'], catalog)).toBe(1);
  });
});

// ==================== 3) الحتمية ====================

describe('حتمية ترتيب الظهور', () => {
  it('نفس البيانات تعطي نفس الترتيب بعد إعادة تحميل (حفظ ثم قراءة)', () => {
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
    const catalog = withCatalog((base) => ({
      ...base,
      narrators: insertWithShift(
        base.narrators,
        base.narrators.find((narrator) => narrator.id === 'narrator-ruways')!,
        3
      ),
    }));
    saveTransmissionCatalog(catalog);

    const reloaded = readTransmissionCatalog();
    expect(displayFingerprint(reloaded)).toEqual(displayFingerprint(catalog));
    // الرقم محفوظ صريحًا لا مشتقًا: إعادة الحفظ لا تغيّره.
    expect(saveTransmissionCatalog(reloaded).narrators.map((narrator) => narrator.order)).toEqual(
      reloaded.narrators.map((narrator) => narrator.order)
    );
    vi.unstubAllGlobals();
  });

  it('التصدير ثم الاستيراد يعيد ترتيب الظهور نفسه', async () => {
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
    vi.resetModules();
    const store = await import('@/lib/storage/document-store');
    const catalogModule = await import('@/lib/transmissions/catalog');

    const moved = catalogModule.movePeer(
      catalogModule.createDefaultTransmissionCatalog().narrators,
      'narrator-hafs',
      0
    );
    const catalog = catalogModule.normalizeTransmissionCatalog({
      ...catalogModule.createDefaultTransmissionCatalog(),
      narrators: moved,
    });
    catalogModule.saveTransmissionCatalog(catalog);

    const exported = store.displayOrderOfCatalog(catalog);
    // كتالوج «جهاز آخر»: ترتيب مصفوفة مختلف وأرقام قديمة.
    const other = catalogModule.normalizeTransmissionCatalog({
      ...catalogModule.createDefaultTransmissionCatalog(),
      narrators: [...catalogModule.createDefaultTransmissionCatalog().narrators].reverse(),
    });
    const applied = store.applyDisplayOrder(other, exported);

    expect(applied.conflicts).toHaveLength(0);
    // التطبيع يعيد الفرز بالرقم الصريح، فتتطابق المصفوفتان عنصرًا بعنصر.
    const restored = catalogModule.normalizeTransmissionCatalog(applied.catalog);
    expect(restored.narrators.map((narrator) => `${narrator.id}:${narrator.order}`)).toEqual(
      catalog.narrators.map((narrator) => `${narrator.id}:${narrator.order}`)
    );
    expect(allNarratorIds(applied.catalog)).toEqual(allNarratorIds(catalog));
    vi.unstubAllGlobals();
  });

  it('الفرز مستقر: لا يعتمد على ترتيب المصفوفة الداخلة', () => {
    const catalog = createDefaultTransmissionCatalog();
    const ids = catalog.narrators.map((narrator) => narrator.id);
    const rotations = [0, 5, 11, 19].map((offset) =>
      sortNarratorIds([...ids.slice(offset), ...ids.slice(0, offset)], catalog)
    );
    for (const rotation of rotations) expect(rotation).toEqual(sortNarratorIds(ids, catalog));
  });

  it('قائمة التصدير مرتبة حتميًا بالنوع ثم المعرّف', () => {
    const catalog = createDefaultTransmissionCatalog();
    const entries = [
      ...catalog.imams.map((imam) => ({ id: imam.id, kind: 'IMAM' as const, displayOrder: imam.order })),
      ...catalog.narrators.map((narrator) => ({
        id: narrator.id,
        kind: 'NARRATOR' as const,
        displayOrder: narrator.order,
      })),
    ].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    expect(entries.slice(0, 10).every((entry) => entry.kind === 'IMAM')).toBe(true);
  });
});

// ==================== 4) الترحيل اللطيف وفضّ التعارض ====================

describe('الترحيل من بيانات قديمة بلا رقم صريح', () => {
  /** كتالوج بإصدار ١: رقم الراوي كان «ترتيبه داخل إمامه» (١ أو ٢). */
  function legacyV1Catalog(): Partial<TransmissionCatalog> {
    const base = createDefaultTransmissionCatalog();
    return {
      schemaVersion: 1,
      imams: base.imams,
      paths: base.paths,
      narrators: base.narrators.map((narrator, index) => ({
        ...narrator,
        order: (index % 2) + 1,
        legacyOrderInTayyibah: index + 1,
      })),
    };
  }

  it('يُعبّئ الرقم الصريح من ترتيب الطيبة القائم فلا يتغير الظهور المعتاد', () => {
    const migrated = normalizeTransmissionCatalog(legacyV1Catalog());
    const base = createDefaultTransmissionCatalog();

    expect(migrated.schemaVersion).toBe(TRANSMISSION_CATALOG_VERSION);
    expect(migrated.narrators.map((narrator) => narrator.order)).toEqual(
      base.narrators.map((narrator) => narrator.order)
    );
    expect(displayFingerprint(migrated)).toEqual(displayFingerprint(base));
  });

  it('من لا ترتيب طيبة له يُرقَّم بعد آخر معروف بلا تكرار', () => {
    const legacy = legacyV1Catalog();
    const extra: Narrator = {
      id: 'narrator-added',
      imamId: 'imam-nafi',
      name: 'راوٍ مضاف',
      slug: 'added',
      order: 1,
      legacyOrderInTayyibah: undefined,
    };
    const migrated = normalizeTransmissionCatalog({
      ...legacy,
      narrators: [...(legacy.narrators ?? []), extra],
    });

    const added = migrated.narrators.find((narrator) => narrator.id === 'narrator-added');
    expect(added?.order).toBe(21);
    expect(detectDisplayOrderConflicts(migrated)).toHaveLength(0);
  });

  it('بيانات الإصدار الحالي لا يُعاد كتابة أرقامها', () => {
    const catalog = withCatalog((base) => ({
      ...base,
      narrators: base.narrators.map((narrator) =>
        narrator.id === 'narrator-hafs' ? { ...narrator, order: 77 } : narrator
      ),
    }));
    const again = normalizeTransmissionCatalog(catalog);
    expect(displayOrderOfNarrator('narrator-hafs', again)).toBe(77);
  });
});

describe('منع التعارض: لا رقمان متساويان أبدًا', () => {
  it('التطبيع يفضّ التعادل حتميًا بالأصغر معرفًا', () => {
    const raw = {
      schemaVersion: TRANSMISSION_CATALOG_VERSION,
      imams: [
        { id: 'imam-b', name: 'ب', slug: 'b', order: 1 },
        { id: 'imam-a', name: 'أ', slug: 'a', order: 1 },
        { id: 'imam-c', name: 'ج', slug: 'c', order: 2 },
      ],
      narrators: [],
      paths: [],
    };
    expect(detectDisplayOrderConflicts(raw)).toHaveLength(1);

    const normalized = normalizeTransmissionCatalog(raw);
    expect(normalized.imams.map((imam) => `${imam.id}:${imam.order}`)).toEqual([
      'imam-a:1',
      'imam-b:2',
      'imam-c:3',
    ]);
    expect(detectDisplayOrderConflicts(normalized)).toHaveLength(0);
  });

  it('الفضّ لا يتأثر بترتيب المصفوفة الداخلة (حتمي)', () => {
    const peers = [
      { id: 'c', order: 2 },
      { id: 'a', order: 2 },
      { id: 'b', order: 2 },
    ];
    const once = resolveDisplayOrderConflicts(peers).map((peer) => `${peer.id}:${peer.order}`);
    const twice = resolveDisplayOrderConflicts([...peers].reverse()).map(
      (peer) => `${peer.id}:${peer.order}`
    );
    expect(once).toEqual(['a:1', 'b:2', 'c:3']);
    expect(twice).toEqual(once);
  });

  it('بلا تعارض لا يُعاد الترقيم: الفجوات المقصودة تبقى', () => {
    const peers = [
      { id: 'a', order: 1 },
      { id: 'b', order: 5 },
      { id: 'c', order: 9 },
    ];
    expect(resolveDisplayOrderConflicts(peers)).toEqual(peers);
    expect(resolveDisplayOrderConflicts(peers)[0]).toBe(peers[0]);
  });

  it('كل سحب في لوحة التحكم ينتج أرقامًا صريحة بلا تعارض', () => {
    const catalog = createDefaultTransmissionCatalog();
    for (let target = 0; target < catalog.narrators.length; target += 1) {
      const moved = movePeer(catalog.narrators, 'narrator-hafs', target);
      expect(detectDisplayOrderConflicts({ narrators: moved })).toHaveLength(0);
      expect(isSortedByDisplayOrder([...moved].sort(compareExplicitOrder))).toBe(true);
      expect(moved).toHaveLength(catalog.narrators.length);
      expect(moved[target].id).toBe('narrator-hafs');
      expect(moved[target].order).toBe(target + 1);
    }
  });

  it('تعارض الطرق يُفحص داخل كل راوٍ لا على الكتالوج كله', () => {
    const catalog = createDefaultTransmissionCatalog();
    // الأزرق وابن الحصين كلاهما «١» لأن أقرانهما مختلفون: ليس تعارضًا.
    expect(detectDisplayOrderConflicts(catalog)).toHaveLength(0);
    expect(displayOrderOfPath('path-warsh-al-azraq', catalog)).toBe(1);
    expect(displayOrderOfPath('path-bazzi-ibn-al-husayn', catalog)).toBe(1);

    const broken = {
      ...catalog,
      paths: catalog.paths.map((path) =>
        path.id === 'path-warsh-al-asbahani' ? { ...path, order: 1 } : path
      ),
    };
    const conflicts = detectDisplayOrderConflicts(broken);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: 'PATH', group: 'narrator-warsh', order: 1 });
  });
});

describe('الترتيب الصريح مستقل عن ترتيب المواضع والأسطر', () => {
  it('رتبة الموضع اليدوية لا يمسها رقم القارئ (ترتيبان صريحان مستقلان)', () => {
    const plan = buildReadingPlan(4, [], DEFAULT_ENGINE_SETTINGS.traversal);
    const late = { ...variant('late', [alternative('late-a', ['narrator-warsh'], 'متأخر')]), orderRank: 2 };
    const early = { ...variant('early', [alternative('early-a', ['narrator-hafs'], 'متقدم')]), orderRank: 1 };

    // `orderVariantsForReading` لا يأخذ كتالوجًا أصلًا: ترتيب المواضع قرار
    // المحقق (orderRank) ثم خطة القراءة، ولا علاقة له بأرقام القرّاء.
    expect(orderVariantsForReading([late, early], plan).map((item) => item.id)).toEqual([
      'early',
      'late',
    ]);

    const movedCatalog = withCatalog((catalog) => ({
      ...catalog,
      narrators: insertWithShift(
        catalog.narrators,
        catalog.narrators.find((narrator) => narrator.id === 'narrator-hafs')!,
        1
      ),
    }));
    expect(displayOrderOfNarrator('narrator-hafs', movedCatalog)).toBe(1);
    expect(orderVariantsForReading([late, early], plan).map((item) => item.id)).toEqual([
      'early',
      'late',
    ]);
  });

  it('أما ترتيب الأوجه داخل الموضع فيتبع الرقم الصريح', () => {
    const base = createDefaultTransmissionCatalog();
    const moved = withCatalog((catalog) => ({
      ...catalog,
      narrators: insertWithShift(
        catalog.narrators,
        catalog.narrators.find((narrator) => narrator.id === 'narrator-hafs')!,
        1
      ),
    }));

    const face = variant('faces', [
      alternative('q', ['narrator-qalun'], 'وجه قالون'),
      alternative('h', ['narrator-hafs'], 'وجه حفص'),
    ]);
    const engine = { ...DEFAULT_ENGINE_SETTINGS, alternativeOrder: 'TAYYIBAH' as const };
    const sorted = (catalog: TransmissionCatalog) =>
      face.alternatives
        .filter((alt) => !alt.isBase)
        .sort((first, second) => compareAlternatives(face, first, second, engine, catalog))
        .map((alt) => alt.id);

    expect(sorted(base)).toEqual(['q', 'h']);
    expect(sorted(moved)).toEqual(['h', 'q']);
  });
});

// اختبارات الاستيراد مع الترحيل التلقائي والنسخ الاحتياطي (NFR-04، AC-04، DM-13)
//
// الحارس هنا ثلاثة أشياء:
//   1) ملف v7 (وما قبله) يُستورد ويُرقّى إلى v8 تلقائيا دون تدخل،
//   2) تُحفظ نسخة احتياطية من كل مستند قديم قبل تغييره ويُبلَّغ عنها في التقرير،
//   3) التصدير حتمي: المستند نفسه يعطي البايتات نفسها عند تثبيت الطابع الزمني.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const AYAH_KEY = makeAyahKey(2, 4);

function legacyV7Bundle() {
  return {
    format: 'tashjeer-export',
    schemaVersion: 7,
    exportedAt: '2026-01-01T00:00:00.000Z',
    globalRules: [],
    ayahs: [],
    documents: [
      {
        schemaVersion: 7,
        ayahKey: AYAH_KEY,
        surahNumber: 2,
        ayahNumber: 4,
        variants: [
          {
            id: 'variant-legacy',
            ayahKey: AYAH_KEY,
            category: 'MADUD',
            title: 'مد قديم',
            startPosition: 2,
            endPosition: 2,
            alternatives: [
              { id: 'alt-base', text: 'أصل', label: 'أصل', isBase: true, scope: { kind: 'ALL' } },
              { id: 'alt-madd', text: 'مد', label: 'مد', scope: { kind: 'NARRATORS', narratorIds: ['narrator-warsh'] } },
            ],
            status: 'DRAFT',
            origin: 'EDITOR',
          },
        ],
        branches: [],
        manualLines: [],
        boundaries: [],
        layout: { forcedLineBreakAfter: [], lineOffsets: {} },
        lineOrder: [],
        links: [],
        segments: [],
        editLog: [],
        meta: {
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          author: 'محقق',
          status: 'DRAFT',
        },
      },
    ],
  };
}

describe('الاستيراد مع الترحيل التلقائي', () => {
  it('يرقّي مستند v7 إلى v8 ويحفظ نسخة احتياطية ويبلّغ عنها', async () => {
    const store = await import('@/lib/storage/document-store');

    const result = store.importDocuments(JSON.stringify(legacyV7Bundle()), true);

    expect(result.errors).toEqual([]);
    expect(result.imported).toBe(1);
    expect(result.migrated).toHaveLength(1);
    expect(result.migrated[0]).toMatchObject({ ayahKey: AYAH_KEY, fromVersion: 7, toVersion: 8 });
    expect(result.migrated[0].backupKey).toMatch(/^tashjeer:backup:/);

    const restored = store.loadDocument(AYAH_KEY);
    expect(restored?.schemaVersion).toBe(8);
    expect(restored?.readingWindow).toEqual({ linkNextAyah: false, focusSegment: null });
    // المعرّفات لا تتغير بالترحيل (P-03).
    expect(restored?.variants[0].id).toBe('variant-legacy');
    expect(restored?.variants[0].alternatives.map((alt) => alt.id)).toEqual(['alt-base', 'alt-madd']);

    const backups = store.listMigrationBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].ayahKey).toBe(AYAH_KEY);
    expect(backups[0].schemaVersion).toBe(7);

    const original = store.readMigrationBackup(backups[0].key);
    expect(original?.schemaVersion).toBe(7);
    expect(original?.variants[0].id).toBe('variant-legacy');

    store.deleteMigrationBackup(backups[0].key);
    expect(store.listMigrationBackups()).toHaveLength(0);
  });

  it('لا يرحّل مستند v8 مكتملا ولا ينشئ له نسخة احتياطية', async () => {
    const store = await import('@/lib/storage/document-store');
    store.saveDocument(store.createDocument(AYAH_KEY));
    const json = store.exportDocuments([AYAH_KEY]);

    vi.unstubAllGlobals();
    vi.resetModules();
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
    const fresh = await import('@/lib/storage/document-store');

    const result = fresh.importDocuments(json, true);
    expect(result.imported).toBe(1);
    expect(result.migrated).toHaveLength(0);
    expect(fresh.listMigrationBackups()).toHaveLength(0);
  });

  it('يحذّر من ملف بإصدار أحدث من المدعوم دون رفضه', async () => {
    const store = await import('@/lib/storage/document-store');
    const bundle = { ...legacyV7Bundle(), schemaVersion: 99 };
    const result = store.importDocuments(JSON.stringify(bundle), true);
    expect(result.imported).toBe(1);
    expect(result.warnings.some((warning) => warning.includes('99'))).toBe(true);
  });
});

describe('التصدير v8 الحتمي', () => {
  it('يحمل الصورة الموحّدة v8 وملف المحرك إلى جانب المستندات', async () => {
    const store = await import('@/lib/storage/document-store');
    const { DEFAULT_SYSTEM_PROFILE } = await import('@/lib/tashjeer/decision/policy');

    store.importDocuments(JSON.stringify(legacyV7Bundle()), true);
    const document = store.loadDocument(AYAH_KEY)!;
    const withFocus = { ...document, readingWindow: { linkNextAyah: false, focusSegment: { startPosition: 1, endPosition: 2 } } };
    store.saveDocument(withFocus);

    const bundle = JSON.parse(store.exportDocuments([AYAH_KEY], { engineConfig: DEFAULT_SYSTEM_PROFILE }));

    expect(bundle.schemaVersion).toBe(8);
    expect(bundle.documents).toHaveLength(1);
    expect(bundle.v8).toHaveLength(1);
    const v8 = bundle.v8[0];
    expect(v8.schemaVersion).toBe(8);
    expect(v8.ayahKey).toBe(AYAH_KEY);
    expect(v8.differences).toHaveLength(1);
    expect(v8.differences[0].id).toBe('variant-legacy');
    expect(v8.differences[0].variants).toHaveLength(1);
    expect(v8.renderRanges).toHaveLength(1);
    expect(v8.renderRanges[0].id).toMatch(/^range-/);
    expect(bundle.engineConfig.profile).toBe('default');
    expect(Array.isArray(bundle.engineConfig.rules)).toBe(true);
  });

  it('يعطي المستند نفسه البايتات نفسها عند تثبيت الطابع الزمني (DM-13)', async () => {
    const store = await import('@/lib/storage/document-store');
    const { DEFAULT_SYSTEM_PROFILE } = await import('@/lib/tashjeer/decision/policy');
    const degrees = await import('@/lib/tashjeer/strength-degrees');
    // سلّم الدرجات المحفوظ ثابت الطابع؛ غير المحفوظ يُبنى بطابع اللحظة.
    degrees.saveStrengthDegrees(degrees.createDefaultStrengthDegrees());

    store.importDocuments(JSON.stringify(legacyV7Bundle()), true);
    const document = store.loadDocument(AYAH_KEY)!;
    // لقطة محرك تولّد تصحيحا في الصورة v8، لضمان أن معرّفاته حتمية أيضا.
    const withSnapshot = {
      ...document,
      variants: document.variants.map((variant) => ({
        ...variant,
        engineSnapshot: {
          title: variant.title,
          category: variant.category,
          alternatives: variant.alternatives,
          capturedAt: '2026-01-02T00:00:00.000Z',
        },
      })),
    };
    store.saveDocument(withSnapshot);

    const options = { exportedAt: '2026-02-01T00:00:00.000Z', engineConfig: DEFAULT_SYSTEM_PROFILE };
    const first = store.exportDocuments([AYAH_KEY], options);
    const second = store.exportDocuments([AYAH_KEY], options);

    expect(first).toBe(second);
    const parsed = JSON.parse(first);
    expect(parsed.v8[0].corrections).toHaveLength(1);
    expect(parsed.v8[0].corrections[0].id).toBe(`corr-${AYAH_KEY}-variant-legacy-1`);
  });
});

describe('رتب العرض الصريحة في التصدير والاستيراد (DM-04)', () => {
  it('يصدّر رتب القراء والرواة والطرق ويعيد تطبيقها عند الاستيراد على الكيانات المعروفة فقط', async () => {
    const store = await import('@/lib/storage/document-store');
    const catalogModule = await import('@/lib/transmissions/catalog');

    const bundle = JSON.parse(store.exportAyahDocument(AYAH_KEY, { engineConfig: null }));
    expect(Array.isArray(bundle.displayOrder)).toBe(true);
    const catalog = catalogModule.readTransmissionCatalog();
    expect(bundle.displayOrder).toHaveLength(catalog.imams.length + catalog.narrators.length + catalog.paths.length);
    // ترتيب حتمي: الأئمة ثم الرواة ثم الطرق، وداخل كل نوع بالمعرّف.
    const kinds = bundle.displayOrder.map((entry: { kind: string }) => entry.kind);
    expect(kinds.indexOf('NARRATOR')).toBeGreaterThan(kinds.lastIndexOf('IMAM'));

    const firstNarrator = catalog.narrators[0];
    const patched = {
      ...bundle,
      displayOrder: [
        { id: firstNarrator.id, kind: 'NARRATOR', displayOrder: 999 },
        { id: 'narrator-ghost', kind: 'NARRATOR', displayOrder: 1 },
      ],
    };
    const result = store.importDocuments(JSON.stringify(patched), true);
    const after = catalogModule.readTransmissionCatalog();
    expect(after.narrators.find((narrator) => narrator.id === firstNarrator.id)?.order).toBe(999);
    expect(after.narrators.some((narrator) => narrator.id === 'narrator-ghost')).toBe(false);
    expect(result.warnings.some((warning) => warning.includes('غير معروفة'))).toBe(true);
  });

  it('applyDisplayOrder دالة نقيّة لا تغيّر ما لم يتغير', async () => {
    const { applyDisplayOrder, displayOrderOfCatalog } = await import('@/lib/storage/document-store');
    const { createDefaultTransmissionCatalog } = await import('@/lib/transmissions/catalog');
    const catalog = createDefaultTransmissionCatalog();
    const same = applyDisplayOrder(catalog, displayOrderOfCatalog(catalog));
    expect(same.applied).toBe(0);
    expect(same.unknown).toBe(0);
  });
});

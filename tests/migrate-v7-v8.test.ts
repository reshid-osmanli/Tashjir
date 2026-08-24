// اختبارات ترحيل v7 → v8 (DM-18، NFR-05) — حتمية بلا DOM.
import { describe, expect, it } from 'vitest';
import type { TashjeerDocument } from '@/types/tashjeer';
import { migrateDocumentToV8, migrateVariantToDifference, migrateWithBackup } from '@/lib/tashjeer/migration/migrate-v7-v8';

function baseDocument(): TashjeerDocument {
  return {
    schemaVersion: 8,
    ayahKey: 2004,
    surahNumber: 2,
    ayahNumber: 4,
    variants: [],
    branches: [],
    manualLines: [],
    boundaries: [],
    layout: { forcedLineBreakAfter: [], lineOffsets: {} },
    lineOrder: [],
    links: [],
    segments: [],
    editLog: [],
    readingWindow: { linkNextAyah: false, focusSegment: null },
    meta: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', author: 'x', status: 'DRAFT' },
  };
}

describe('ترحيل v7 → v8 — الاختلاف (Difference/DM-01)', () => {
  it('يحوّل Variant إلى Difference مع حفظ المعرّف (P-03)', () => {
    const doc = baseDocument();
    doc.variants = [
      {
        id: 'variant-abc',
        ayahKey: 2004,
        category: 'FARSH',
        title: 'فرش',
        startPosition: 11,
        endPosition: 11,
        alternatives: [
          { id: 'base-1', text: 'ملك', label: 'حفص', scope: { kind: 'ALL' as const }, isBase: true },
          { id: 'alt-1', text: 'مَٰلِكِ', label: 'بالألف', scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] } },
        ],
        status: 'DRAFT',
        origin: 'EDITOR',
      },
    ];
    const v8 = migrateDocumentToV8(doc);
    expect(v8.schemaVersion).toBe(8);
    expect(v8.differences).toHaveLength(1);
    const diff = v8.differences[0];
    expect(diff.id).toBe('variant-abc');
    expect(diff.category).toBe('FARSH');
    // الوجه الأساس لا يُورد بين الأوجه (DM-02).
    expect(diff.variants).toHaveLength(1);
    expect(diff.variants[0].id).toBe('alt-1');
    expect(diff.source).toBe('editor');
  });

  it('يحسب occurrenceIndex لتعدد الاختلافات في الموضع نفسه (DM-09)', () => {
    const doc = baseDocument();
    const mk = (id: string, category: 'MADUD' | 'FARSH') =>
      ({
        id,
        ayahKey: 2004,
        category,
        title: category,
        startPosition: 7,
        endPosition: 7,
        alternatives: [{ id: `${id}-a`, text: 'x', label: 'x', scope: { kind: 'ALL' as const } }],
        status: 'DRAFT' as const,
        origin: 'EDITOR' as const,
      });
    doc.variants = [mk('v1', 'MADUD'), mk('v2', 'MADUD'), mk('v2b', 'FARSH')];
    const v8 = migrateDocumentToV8(doc);
    const indices = Object.fromEntries(v8.differences.map((d) => [d.id, d.occurrenceIndex]));
    expect(indices['v1']).toBe(1);
    expect(indices['v2']).toBe(2);
    expect(indices['v2b']).toBe(3);
  });
});

describe('ترحيل v7 → v8 — العلاقات والوقف (DM-03، DM-07)', () => {
  it('يحوّل الروابط إلى علاقات موحّدة ويصلها بالاختلاف', () => {
    const doc = baseDocument();
    doc.variants = [
      { id: 'v1', ayahKey: 2004, category: 'MADUD', title: 'm', startPosition: 1, endPosition: 1, alternatives: [{ id: 'v1-a', text: 'x', label: 'x', scope: { kind: 'ALL' as const } }], status: 'DRAFT', origin: 'EDITOR' },
      { id: 'v2', ayahKey: 2004, category: 'USUL', title: 't', startPosition: 2, endPosition: 2, alternatives: [{ id: 'v2-a', text: 'y', label: 'y', scope: { kind: 'ALL' as const } }], status: 'DRAFT', origin: 'EDITOR' },
    ];
    doc.links = [
      {
        id: 'link-1',
        ayahKey: 2004,
        kind: 'FACE_TO_FACE',
        relation: 'REFERENCE',
        from: { type: 'FACE', id: 'v1::v1-a' },
        to: { type: 'FACE', id: 'v2::v2-a' },
        origin: 'EDITOR',
        createdAt: 't',
        updatedAt: 't',
      },
    ];
    const v8 = migrateDocumentToV8(doc);
    expect(v8.relations).toHaveLength(1);
    expect(v8.relations[0].type).toBe('COMPOSITE');
    expect(v8.differences[0].relations.some((r) => r.id === 'link-1')).toBe(true);
  });

  it('يحوّل علامات الوقف إلى WaqfMark (NO_WASL → FORBIDDEN_WASL)', () => {
    const doc = baseDocument();
    doc.boundaries = [
      { id: 'b1', kind: 'WAQF', position: 3, scope: { kind: 'ALL' as const } },
      { id: 'b2', kind: 'NO_WASL', position: 9, connectsToNextAyah: true },
    ];
    const v8 = migrateDocumentToV8(doc);
    expect(v8.waqfMarks).toHaveLength(2);
    expect(v8.waqfMarks[0].kind).toBe('WAQF');
    expect(v8.waqfMarks[1].kind).toBe('FORBIDDEN_WASL');
    expect(v8.waqfMarks[1].scope).toBe('END_OF_AYAH');
  });
});

describe('ترحيل v7 → v8 — التصحيح (DM-05)', () => {
  it('يولّد Correction من لقطة المحرك (Engine=A)', () => {
    const doc = baseDocument();
    doc.variants = [
      {
        id: 'v1',
        ayahKey: 2004,
        category: 'MADUD',
        title: 'مد',
        startPosition: 1,
        endPosition: 1,
        alternatives: [{ id: 'v1-a', text: 'x', label: 'x', scope: { kind: 'ALL' as const } }],
        status: 'DRAFT',
        origin: 'ENGINE',
        engineSnapshot: { title: 'مد', category: 'MADUD', alternatives: [{ id: 'v1-a', text: 'a', label: 'a', scope: { kind: 'ALL' as const } }], capturedAt: '2026-01-01T00:00:00.000Z' },
      },
    ];
    const v8 = migrateDocumentToV8(doc);
    expect(v8.corrections).toHaveLength(1);
    expect(v8.corrections[0].targetId).toBe('v1');
    expect(v8.corrections[0].engineResult).toBeTruthy();
    expect(v8.differences[0].engineSnapshot).toBeTruthy();
  });
});

describe('الترحيل مع نسخة احتياطية (NFR-04)', () => {
  it('migrateWithBackup يعيد المستند والنسخة الاحتياطية ولا يعدّل الأصل', () => {
    const doc = baseDocument();
    doc.variants = [{ id: 'v1', ayahKey: 2004, category: 'FARSH', title: 'f', startPosition: 1, endPosition: 1, alternatives: [{ id: 'v1-a', text: 'x', label: 'x', scope: { kind: 'ALL' as const } }], status: 'DRAFT', origin: 'EDITOR' }];
    const before = JSON.parse(JSON.stringify(doc));
    const { v8, backup } = migrateWithBackup(doc);
    expect(v8.differences).toHaveLength(1);
    expect(backup).toContain('backedUpAt');
    expect(doc.variants).toEqual(before.variants);
  });

  it('migrateVariantToDifference نقي ولا يلمس المدخل', () => {
    const v = { id: 'v1', ayahKey: 2004, category: 'FARSH' as const, title: 'f', startPosition: 1, endPosition: 1, alternatives: [{ id: 'a', text: 'x', label: 'x', scope: { kind: 'ALL' as const } }], status: 'DRAFT' as const, origin: 'EDITOR' as const };
    const out = migrateVariantToDifference(v, 2004, 1, 0);
    expect(out.id).toBe('v1');
    expect(v.title).toBe('f');
  });
});

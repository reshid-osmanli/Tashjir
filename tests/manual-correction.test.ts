// اختبارات التصحيح اليدوي وترتيب القواعد والتتبع
//
// ترتيب قواعد المصحف: إدراج الرتبة يزيح المتأثرين، لا يستبدلهم.
// رتبة الموضع الواحد تسبق رتبة القاعدة.
// والتتبع يميز ما وجده المحرك مما أضافه المحرر وما عُدّل يدويا.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import type { GlobalRuleMatch } from '@/lib/quran-logic/global-rule-engine';
import { MemoryStorage } from './helpers/memory-storage';

// الفاتحة ٤: فيها اختلاف البذرة (ملك/مالك) فيعمل عليها اختبار التتبع.
const AYAH_KEY = makeAyahKey(1, 4);

function makeRule(overrides: Partial<{ id: string; orderRank: number }> = {}) {
  return {
    id: overrides.id ?? 'rule-test',
    title: 'قاعدة اختبار',
    category: 'MADUD' as const,
    scope: { kind: 'ALL' as const },
    status: 'DRAFT' as const,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(overrides.orderRank !== undefined ? { orderRank: overrides.orderRank } : {}),
  };
}

function makeMatch(startPosition = 2): GlobalRuleMatch {
  return {
    ayahKey: AYAH_KEY,
    startPosition,
    endPosition: startPosition,
    characterRange: {
      start: { position: startPosition, characterIndex: 0 },
      end: { position: startPosition, characterIndex: 2 },
    },
    matchedText: 'نِعْمَة',
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadModules() {
  const [rules, occurrences, engine, documents, tracking] = await Promise.all([
    import('@/lib/storage/global-rules-store'),
    import('@/lib/storage/rule-occurrences-store'),
    import('@/lib/quran-logic/global-rule-engine'),
    import('@/lib/storage/document-store'),
    import('@/lib/storage/tracking-store'),
  ]);
  return { rules, occurrences, engine, documents, tracking };
}

describe('رقم ترتيب السطر للقواعد العامة', () => {
  it('إدراج رتبة مشغولة يزيح المتأثرين رتبة واحدة بلا تعادل', async () => {
    const { rules } = await loadModules();

    rules.saveGlobalRule(makeRule({ id: 'a', orderRank: 1 }));
    rules.saveGlobalRule(makeRule({ id: 'b', orderRank: 2 }));
    rules.saveGlobalRule(makeRule({ id: 'c', orderRank: 3 }));

    // c تريد الرتبة 2 المشغولة بـ b: تُدرج فيها وتُزاح b إلى 3.
    rules.setGlobalRuleOrderRank('c', 2);

    const byId = new Map(rules.listGlobalRules().map((rule) => [rule.id, rule.orderRank]));
    expect(byId.get('a')).toBe(1);
    expect(byId.get('c')).toBe(2);
    expect(byId.get('b')).toBe(3);
  });

  it('إلغاء الترتيب يعيد القاعدة إلى قاعدة المحرك ويعاد الترقيم', async () => {
    const { rules } = await loadModules();

    rules.saveGlobalRule(makeRule({ id: 'a', orderRank: 1 }));
    rules.saveGlobalRule(makeRule({ id: 'b', orderRank: 2 }));

    rules.setGlobalRuleOrderRank('a', null);

    const byId = new Map(rules.listGlobalRules().map((rule) => [rule.id, rule.orderRank]));
    expect(byId.get('a')).toBeUndefined();
    expect(byId.get('b')).toBe(1);
  });

  it('رتبة فوق العدد الحالي تثبَّت في آخر رتبة متاحة', async () => {
    const { rules } = await loadModules();

    rules.saveGlobalRule(makeRule({ id: 'a', orderRank: 1 }));
    rules.saveGlobalRule(makeRule({ id: 'b', orderRank: 2 }));
    rules.setGlobalRuleOrderRank('a', 99);

    const byId = new Map(rules.listGlobalRules().map((rule) => [rule.id, rule.orderRank]));
    expect(byId.get('a')).toBe(2);
    expect(byId.get('b')).toBe(1);
  });
});

describe('رتبة الموضع الواحد من القاعدة', () => {
  it('تخصيص الموضع يسبق رتبة القاعدة في الاختلاف المشتق', async () => {
    const { rules, occurrences, engine } = await loadModules();
    const saved = rules.saveGlobalRule(makeRule({ id: 'r1', orderRank: 4 }));

    const variant = engine.variantFromGlobalMatch(saved, makeMatch());
    expect(variant.orderRank).toBe(4);
    expect(variant.origin).toBe('ENGINE');

    occurrences.setOccurrenceOrderRank('r1', makeMatch(), 1);
    const afterOverride = engine.variantFromGlobalMatch(
      saved,
      makeMatch(),
      occurrences.listOccurrenceOverrides('r1')[0]
    );
    expect(afterOverride.orderRank).toBe(1);

    // إلغاء التخصيص يعيد رتبة القاعدة.
    occurrences.setOccurrenceOrderRank('r1', makeMatch(), null);
    const cleared = occurrences.listOccurrenceOverrides('r1')[0];
    expect(cleared?.orderRank).toBeUndefined();
  });

  it('تخصيص الرتبة لا يمحو تخصيص الدرجة ولا العكس', async () => {
    const { rules, occurrences } = await loadModules();
    rules.saveGlobalRule(makeRule({ id: 'r1' }));

    occurrences.setOccurrenceStrength('r1', makeMatch(), { strengthDegreeId: 'rajih' });
    occurrences.setOccurrenceOrderRank('r1', makeMatch(), 2);

    const override = occurrences.listOccurrenceOverrides('r1')[0];
    expect(override?.strengthDegreeId).toBe('rajih');
    expect(override?.orderRank).toBe(2);
  });
});

describe('التتبع', () => {
  it('يميز ما وجده المحرك مما أضافه المحرر وما عُدّل يدويا', async () => {
    const { documents, tracking, engine } = await loadModules();

    // آية محفوظة فيها: اختلاف أساسي (المحرك) واختلاف أضافه المحرر، وسجل تعديل.
    const document = documents.createDocument(AYAH_KEY);
    const withEditorVariant = {
      ...document,
      variants: [
        ...document.variants,
        {
          ...document.variants[0],
          id: 'variant-editor-1',
          title: 'إضافة المحرر',
          origin: 'EDITOR' as const,
        },
      ],
      editLog: [
        documents.makeEditEntry({
          action: 'تعديل اختلاف',
          targetType: 'VARIANT',
          targetId: document.variants[0]?.id ?? 'variant-base',
          summary: 'تعديل ترتيب الموضع',
        }),
      ],
    };
    documents.saveDocument(withEditorVariant);

    const rows = tracking.readTrackingRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const editorRow = rows.find((row) => row.variantId === 'variant-editor-1');
    expect(editorRow?.source).toBe('EDITOR');
    expect(editorRow?.manuallyModified).toBe(false);

    const engineRow = rows.find((row) => row.variantId === document.variants[0]?.id);
    expect(engineRow?.source).toBe('ENGINE');
    expect(engineRow?.manuallyModified).toBe(true);
    expect(engineRow?.edits).toHaveLength(1);

    // التصفية: المعدل يدويا فقط.
    const modifiedOnly = tracking.readTrackingRows({ source: 'MODIFIED' });
    expect(modifiedOnly.every((row) => row.manuallyModified)).toBe(true);

    // التصفية بالفئة.
    const byCategory = tracking.readTrackingRows({
      category: document.variants[0]?.category ?? 'FARSH',
    });
    expect(byCategory.every((row) => row.category === document.variants[0]?.category)).toBe(true);
  });

  it('الملخص يحصي المصادر والمعدَّل', async () => {
    const { documents, tracking } = await loadModules();
    const document = documents.createDocument(AYAH_KEY);
    documents.saveDocument(document);

    const summary = tracking.trackingSummary(tracking.readTrackingRows());
    expect(summary.total).toBeGreaterThanOrEqual(document.variants.length);
    expect(summary.engine + summary.editor).toBe(summary.total);
    expect(summary.byCategory[document.variants[0]?.category ?? 'FARSH']).toBeGreaterThanOrEqual(1);
  });
});

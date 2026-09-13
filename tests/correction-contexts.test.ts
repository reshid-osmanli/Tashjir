// اختبارات جمع التصحيحات واقتراح القواعد من الأنماط المتكررة (FR-ES-12.3)
//
// حلقة التعلم: تصحيحات محفوظة ← جمع سياقاتها ← تجميع حتمي ← ما تكرر ≥ 3
// يظهر كقاعدة مرشحة بعددها — ولا يُنشأ شيء تلقائيا (P-06): الاكتشاف
// يرجع اقتراحات فقط، والنشر قرار المستخدم.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import type { TashjeerDocument } from '@/types/tashjeer';
import { MemoryStorage } from './helpers/memory-storage';

const AYAH_KEY = makeAyahKey(1, 4);
const NOW = '2026-09-13T00:00:00.000Z';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadModules() {
  const [documents, tracking, candidate] = await Promise.all([
    import('@/lib/storage/document-store'),
    import('@/lib/storage/tracking-store'),
    import('@/lib/tashjeer/decision/candidate-rule'),
  ]);
  return { documents, tracking, candidate };
}

/** اختلاف بمصدر المحرك (A) عدّله المحرر (B) → تصحيح. */
function correctedVariant(index: number) {
  const snapshot = {
    title: `الموضع ${index} — قبل`,
    category: 'FARSH' as const,
    alternatives: [
      { id: `v${index}-base`, text: 'وجه المصحف', label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' as const } },
      { id: `v${index}-a`, text: 'نص أ', label: 'وجه أ', scope: { kind: 'ALL' as const } },
    ],
    capturedAt: NOW,
  };
  return {
    id: `v${index}`,
    ayahKey: AYAH_KEY,
    category: 'FARSH' as const,
    title: `الموضع ${index} — بعد`,
    startPosition: 1 + index,
    endPosition: 1 + index,
    alternatives: snapshot.alternatives,
    status: 'DRAFT' as const,
    origin: 'ENGINE' as const,
    engineSnapshot: snapshot,
    editorModifiedAt: NOW,
  };
}

/** اختلاف لم يُمس: لقطة مطابقة → ليس تصحيحا. */
function untouchedVariant() {
  const alternatives = [
    { id: 'vu-base', text: 'وجه المصحف', label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' as const } },
    { id: 'vu-a', text: 'نص أ', label: 'وجه أ', scope: { kind: 'ALL' as const } },
  ];
  return {
    id: 'vu',
    ayahKey: AYAH_KEY,
    category: 'FARSH' as const,
    title: 'موضع لم يُمس',
    startPosition: 9,
    endPosition: 9,
    alternatives,
    status: 'DRAFT' as const,
    origin: 'ENGINE' as const,
    engineSnapshot: {
      title: 'موضع لم يُمس',
      category: 'FARSH' as const,
      alternatives,
      capturedAt: NOW,
    },
  };
}

function saveDocumentWithVariants(documents: { loadOrCreateDocument: (key: number) => TashjeerDocument; saveDocument: (doc: TashjeerDocument) => TashjeerDocument }, variants: TashjeerDocument['variants']) {
  const doc = documents.loadOrCreateDocument(AYAH_KEY);
  documents.saveDocument({ ...doc, variants });
}

describe('جمع سياقات التصحيحات من المستندات (readCorrectionContexts)', () => {
  it('يجمع كل موضع عدّله المحرر بعد لقطة محرك، ويستبعد ما لم يُمس', async () => {
    const { documents, tracking } = await loadModules();
    saveDocumentWithVariants(documents, [correctedVariant(1), correctedVariant(2), untouchedVariant()]);

    const contexts = tracking.readCorrectionContexts();
    expect(contexts).toHaveLength(2);
    for (const context of contexts) {
      expect(context.ayahKey).toBe(AYAH_KEY);
      expect(context.differenceType).toBe('FARSH');
      // التصحيح هنا: المحرك اقترح (A) والمحرر غيّر (B)
      expect(context.engineMerged).toBe(true);
      expect(context.editorWantsMerge).toBe(false);
    }
  });

  it('لا سياقات بلا مستندات', async () => {
    const { tracking } = await loadModules();
    expect(tracking.readCorrectionContexts()).toHaveLength(0);
  });
});

describe('القاعدة المرشحة من نمط متكرر (FR-ES-12.3، AC-02.4)', () => {
  it('نمط تكرر 3 مرات يظهر مرشحا بعدد مواضعه — واقتراح لا إنشاء', async () => {
    const { documents, tracking, candidate } = await loadModules();
    saveDocumentWithVariants(
      documents,
      [correctedVariant(1), correctedVariant(2), correctedVariant(3), correctedVariant(4)]
    );

    const contexts = tracking.readCorrectionContexts();
    const patterns = candidate.detectRecurringPatterns(contexts);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].count).toBe(4);
    expect(patterns[0].differenceType).toBe('FARSH');
    expect(patterns[0].engineMerged).toBe(true);
    expect(patterns[0].editorWantsMerge).toBe(false);
    // القاعدة المقترحة تبقى DRAFT حتى يعتمد المستخدم (P-06)
    expect(patterns[0].rule.status).toBe('DRAFT');
    expect(patterns[0].rule.actions).toContainEqual({ type: 'PREVENT_MERGE' });
  });

  it('تحت الحد (3) لا يُقترح شيء', async () => {
    const { documents, tracking, candidate } = await loadModules();
    saveDocumentWithVariants(documents, [correctedVariant(1), correctedVariant(2)]);

    const contexts = tracking.readCorrectionContexts();
    const patterns = candidate.detectRecurringPatterns(contexts);
    expect(patterns).toHaveLength(0);
    expect(candidate.PATTERN_REPEAT_THRESHOLD).toBe(3);
  });
});

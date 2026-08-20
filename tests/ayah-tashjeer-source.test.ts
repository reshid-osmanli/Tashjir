// اختبارات مصدر تشجير الآية لصفحة المصحف
//
// بعد حفظ قاعدة عامة يجب أن تظهر أسطرها في /quran دون حفظ مستند لكل آية.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import { MemoryStorage } from './helpers/memory-storage';

const AYAH_KEY = makeAyahKey(1, 4);

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadModules() {
  const [source, documents] = await Promise.all([
    import('@/lib/tashjeer/ayah-tashjeer-source'),
    import('@/lib/storage/document-store'),
  ]);
  return { source, documents };
}

describe('مصدر تشجير الآية', () => {
  it('آية بلا مستند ولا قاعدة عامة لا تُعرض مشجَّرة', async () => {
    const { source } = await loadModules();
    expect(source.ayahHasTashjeerContent(makeAyahKey(3, 1))).toBe(false);
    expect(source.resolveAyahDocument(makeAyahKey(3, 1))).toBeNull();
  });

  it('الآية المحفوظة تُعرض بتشجيرها حتى بلا قاعدة عامة', async () => {
    const { source, documents } = await loadModules();
    documents.saveDocument(documents.createDocument(AYAH_KEY));

    expect(source.ayahHasTashjeerContent(AYAH_KEY)).toBe(true);
    const resolved = source.resolveAyahDocument(AYAH_KEY);
    expect(resolved?.ayahKey).toBe(AYAH_KEY);
    expect(resolved?.variants.length).toBeGreaterThan(0);
  });

  it('surahAyahsWithTashjeer يشمل الآيات المحفوظة في السورة', async () => {
    const { source, documents } = await loadModules();
    documents.saveDocument(documents.createDocument(AYAH_KEY));

    const keys = source.surahAyahsWithTashjeer(1);
    expect(keys.has(AYAH_KEY)).toBe(true);
  });
});

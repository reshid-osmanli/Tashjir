// اختبار ترحيل ملفات jeson_exemp الحقيقية v7 → v8 (DM-18، AC-04)
// يغطي استيراد tashjeer-2-4.json و tashjeer-2-45.json مع نسخة احتياطية وتصدير حتمي

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';

function examplePath(name: string): string {
  return resolve(process.cwd(), 'jeson_exemp', name);
}

function loadBundle(name: string): string | null {
  const path = examplePath(name);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('ترحيل jeson_exemp الحقيقي v7→v8', () => {
  it.each(['tashjeer-2-4.json', 'tashjeer-2-45.json'])(
    'يستورد %s بنجاح مع ترحيل تلقائي ونسخة احتياطية ثم يعيد التصدير بلا فقد',
    async (fileName) => {
      const raw = loadBundle(fileName);
      if (!raw) {
        console.warn(`ملف ${fileName} غير موجود — تخطي`);
        return;
      }
      const store = await import('@/lib/storage/document-store');
      const { DEFAULT_SYSTEM_PROFILE } = await import('@/lib/tashjeer/decision/policy');

      const result = store.importDocuments(raw, true);
      expect(result.errors).toEqual([]);
      expect(result.imported).toBeGreaterThan(0);
      // يجب أن يكون هناك ترحيل من v7 إلى v8
      expect(result.migrated.length).toBeGreaterThan(0);
      expect(result.migrated[0].fromVersion).toBe(7);
      expect(result.migrated[0].toVersion).toBe(8);
      expect(result.migrated[0].backupKey).toMatch(/^tashjeer:backup:/);

      // تحقق من النسخة الاحتياطية
      const backups = store.listMigrationBackups();
      expect(backups.length).toBeGreaterThan(0);

      // تصدير v8 وإعادة استيراد
      const exported = store.exportDocuments(undefined, {
        exportedAt: '2026-09-14T00:00:00.000Z',
        engineConfig: DEFAULT_SYSTEM_PROFILE,
      });
      const parsed = JSON.parse(exported);
      expect(parsed.schemaVersion).toBe(8);
      expect(parsed.v8).toBeDefined();
      expect(parsed.v8.length).toBeGreaterThan(0);
      // كل اختلاف له معرف مستقل ومحفوظ (P-03)
      for (const doc of parsed.v8) {
        for (const diff of doc.differences) {
          expect(typeof diff.id).toBe('string');
          expect(diff.id.length).toBeGreaterThan(0);
          // الوجه المستقل له رتبة صريحة (DM-02، DM-04)
          for (const variant of diff.variants) {
            expect(typeof variant.rank).toBe('number');
          }
        }
        // WaqfMark و RenderRange و Corrections موجودة كبنية (حتى لو فارغة)
        expect(Array.isArray(doc.waqfMarks)).toBe(true);
        expect(Array.isArray(doc.renderRanges)).toBe(true);
        expect(Array.isArray(doc.corrections)).toBe(true);
      }

      // إعادة استيراد نفس الملف المصدّر v8 بلا فقد
      vi.unstubAllGlobals();
      vi.resetModules();
      vi.stubGlobal('window', { localStorage: new MemoryStorage() });
      const fresh = await import('@/lib/storage/document-store');
      const secondResult = fresh.importDocuments(exported, true);
      expect(secondResult.errors).toEqual([]);
      expect(secondResult.imported).toBe(parsed.documents.length);
      // لا ترحيل جديد لأننا الآن v8
      expect(secondResult.migrated.length).toBe(0);
    }
  );

  it('تصدير نفس المستند مرتين يعطي ملفين متطابقين byte-stable (DM-13)', async () => {
    const raw = loadBundle('tashjeer-2-4.json');
    if (!raw) return;
    const store = await import('@/lib/storage/document-store');
    const { DEFAULT_SYSTEM_PROFILE } = await import('@/lib/tashjeer/decision/policy');
    const degrees = await import('@/lib/tashjeer/strength-degrees');
    degrees.saveStrengthDegrees(degrees.createDefaultStrengthDegrees());

    store.importDocuments(raw, true);
    const keys = store.listDocuments().map((d) => d.ayahKey);
    const opts = { exportedAt: '2026-09-14T00:00:00.000Z', engineConfig: DEFAULT_SYSTEM_PROFILE };
    const first = store.exportDocuments(keys, opts);
    const second = store.exportDocuments(keys, opts);
    expect(first).toBe(second);
  });
});

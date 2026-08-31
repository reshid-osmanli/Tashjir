// اختبارات تخزين ملفات المحرك المتعددة — Named Profile Storage (FR-ES-11)
// مشروع التشجير - نظام القراءات العشر

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load() {
  return import('@/lib/tashjeer/profile-storage');
}

async function loadDefaultConfig() {
  const { createDefaultEngineConfig } = await import('@/lib/tashjeer/engine-config-store');
  return createDefaultEngineConfig('experimental');
}

describe('تخزين ملفات المحرك المتعددة (FR-ES-11)', () => {
  it('يحفظ ويحمّل ملفًا باسم', async () => {
    const storage = await load();
    const config = await loadDefaultConfig();
    storage.saveProfile('experimental', config);
    const loaded = storage.loadProfile('experimental');
    expect(loaded.profile).toBe('experimental');
    expect(storage.profileExists('experimental')).toBe(true);
  });

  it('يسرد الملفات المحفوظة', async () => {
    const storage = await load();
    const config = await loadDefaultConfig();
    storage.saveProfile('testing', config);
    storage.saveProfile('legacy', config);
    const names = storage.listProfiles().map((entry) => entry.name);
    expect(names).toContain('testing');
    expect(names).toContain('legacy');
  });

  it('يحمّل الافتراضي عند غياب الملف', async () => {
    const storage = await load();
    const loaded = storage.loadProfile('nonexistent');
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.rules.length).toBeGreaterThan(0);
  });

  it('يحذف ملفًا ولا يحذف «default»', async () => {
    const storage = await load();
    const config = await loadDefaultConfig();
    storage.saveProfile('testing', config);
    storage.saveProfile('default', config);
    storage.deleteProfile('testing');
    expect(storage.profileExists('testing')).toBe(false);
    // default محمي من الحذف.
    storage.deleteProfile('default');
    // لا يرمي ولا يحذف فعليًا (default يُعاد إنشاؤه عند التحميل).
    expect(storage.loadProfile('default').profile).toBe('default');
  });
});

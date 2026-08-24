// تخزين ملفات المحرك المتعددة — Named Profile Storage (FR-ES-11)
// مشروع التشجير - نظام القراءات العشر
//
// يدعم عدة ملفات سياسات (Default/Experimental/Testing/Legacy/Reference) قابلة
// للتبديل والمقارنة والساندبوكس: قاعدة Draft في ملف تجريبي لا تؤثر في البيانات
// الرسمية حتى الاعتماد. طبقة نقيّة قابلة للاختبار بمعزل عن المتصفح، منفصلة عن
// مخزن الملف النشط (engine-config-store) فلا تتعارض معه.

import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { createDefaultEngineConfig, validateEngineConfig, normalizeEngineConfig } from './engine-config-store';

const PROFILE_INDEX_KEY = 'tashjeer:engine-profile-index:v1';
const profileKey = (name: string) => `tashjeer:engine-profile:${name}:v1`;

export const DEFAULT_PROFILE_NAME = 'default';

export interface ProfileIndexEntry {
  name: string;
  savedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** يقرأ فهرس الملفات المحفوظة. */
export function listProfiles(): ProfileIndexEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(PROFILE_INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as ProfileIndexEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: ProfileIndexEntry[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(entries));
}

/** يحفظ ملف سياسات باسم معيّن بعد الفحص. يُرجع النسخة المطابّعة وحالتها. */
export function saveProfile(
  name: string,
  config: EngineConfig
): { config: EngineConfig; valid: boolean; errors: string[] } {
  const normalized = normalizeEngineConfig({ ...config, profile: name });
  const validation = validateEngineConfig(normalized);
  if (isBrowser()) {
    window.localStorage.setItem(profileKey(name), JSON.stringify(normalized));
    const entries = listProfiles().filter((entry) => entry.name !== name);
    entries.push({ name, savedAt: new Date().toISOString() });
    writeIndex(entries);
  }
  return { config: normalized, valid: validation.valid, errors: validation.errors };
}

/** يحمّل ملف سياسات بالاسم، أو الافتراضي عند الغياب. */
export function loadProfile(name: string): EngineConfig {
  if (!isBrowser()) return createDefaultEngineConfig(name);
  try {
    const raw = window.localStorage.getItem(profileKey(name));
    if (!raw) return createDefaultEngineConfig(name);
    return normalizeEngineConfig({ ...(JSON.parse(raw) as Partial<EngineConfig>), profile: name });
  } catch {
    return createDefaultEngineConfig(name);
  }
}

/** يحذف ملف سياسات بالاسم (لا يحذف «default»). */
export function deleteProfile(name: string): void {
  if (name === DEFAULT_PROFILE_NAME) return;
  if (!isBrowser()) return;
  window.localStorage.removeItem(profileKey(name));
  writeIndex(listProfiles().filter((entry) => entry.name !== name));
}

/** هل الملف موجود محفوظًا؟ */
export function profileExists(name: string): boolean {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(profileKey(name)) !== null;
}

// قوالب المعالج الذكي وتفضيلاته — Wizard Templates & Prefs (FR-ED-08)
// مشروع التشجير - نظام القراءات العشر
//
// «الإنشاء السريع» للأنماط الشائعة يحفظ إعداد آخر معالج **كقالب** (مثال:
// «مد + تحقيق + صلة» قالب يعاد استخدامه بنقرة)، وحفظ التفضيلات يقصّر الخطوات
// للمتقدمين بتخطي الخطوات المكتملة الافتراضية. القوالب والتفضيلات شخصية
// محلية: تُحفظ في المتصفح ولا تدخل في التصدير.

import type { VariantCategory } from '@/types';

/** وضع العلاقات كما يختاره المستخدم في الخطوة 5. */
export type WizardRelationMode = 'RELATED_TREE' | 'MUTUALLY_EXCLUSIVE' | 'NONE' | 'CUSTOM';

/** سياق الوقف/الوصل الافتراضي للمجموعة (الخطوة 7). */
export type WizardContextMode = 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY';

/** نطاق التطبيق الجغرافي (الخطوة 6). */
export type WizardApplicationScope = 'LOCAL' | 'SURAH' | 'AYAH_RANGE' | 'MUSHAF';

/** إعداد معالج محفوظ: كل ما يلزم لإعادة الإنشاء بنقرة واحدة. */
export interface WizardTemplateConfig {
  types: VariantCategory[];
  /** نص الأوجه لكل نوع (سطر لكل وجه) كما يُكتب في الخطوة 3. */
  faces: Partial<Record<VariantCategory, string>>;
  relationMode: WizardRelationMode;
  context: WizardContextMode;
  applicationScope?: WizardApplicationScope;
}

export interface WizardSavedTemplate {
  id: string;
  name: string;
  hint?: string;
  config: WizardTemplateConfig;
  createdAt: string;
  updatedAt: string;
}

export const WIZARD_TEMPLATES_KEY = 'tashjeer:wizard-templates:v1';
export const WIZARD_PREFS_KEY = 'tashjeer:wizard-prefs:v1';

/** تفضيلات المعالج: الوضع المتقدم يتخطى الخطوات المكتملة الافتراضية. */
export interface WizardPrefs {
  advanced: boolean;
}

const DEFAULT_PREFS: WizardPrefs = { advanced: false };

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

const KNOWN_CATEGORIES: VariantCategory[] = ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'];

function sanitizeConfig(value: unknown): WizardTemplateConfig | null {
  if (!value || typeof value !== 'object') return null;
  const config = value as Partial<WizardTemplateConfig>;
  const types = Array.isArray(config.types)
    ? config.types.filter((type): type is VariantCategory => KNOWN_CATEGORIES.includes(type as VariantCategory))
    : [];
  if (types.length === 0) return null;
  const faces: Partial<Record<VariantCategory, string>> = {};
  if (config.faces && typeof config.faces === 'object') {
    for (const type of types) {
      const raw = (config.faces as Record<string, unknown>)[type];
      if (typeof raw === 'string' && raw.trim()) faces[type] = raw;
    }
  }
  const relationMode: WizardRelationMode =
    config.relationMode === 'MUTUALLY_EXCLUSIVE' ||
    config.relationMode === 'NONE' ||
    config.relationMode === 'CUSTOM'
      ? config.relationMode
      : 'RELATED_TREE';
  const context: WizardContextMode =
    config.context === 'WAQF_ONLY' || config.context === 'WASL_ONLY' ? config.context : 'ALWAYS';
  const applicationScope: WizardApplicationScope =
    config.applicationScope === 'SURAH' ||
    config.applicationScope === 'AYAH_RANGE' ||
    config.applicationScope === 'MUSHAF'
      ? config.applicationScope
      : 'LOCAL';
  return { types, faces, relationMode, context, applicationScope };
}

function readTemplates(): WizardSavedTemplate[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(WIZARD_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const templates: WizardSavedTemplate[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const candidate = item as Partial<WizardSavedTemplate>;
      const config = sanitizeConfig(candidate.config);
      if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !config) continue;
      templates.push({
        id: candidate.id,
        name: candidate.name,
        hint: typeof candidate.hint === 'string' ? candidate.hint : undefined,
        config,
        createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
      });
    }
    return templates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function writeTemplates(templates: WizardSavedTemplate[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(WIZARD_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // امتلاء التخزين لا يعطل المعالج.
  }
}

/** يعيد قوالب المستخدم المحفوظة مرتبة بالأحدث استخدامًا. */
export function listWizardTemplates(): WizardSavedTemplate[] {
  return readTemplates();
}

/** يحفظ إعداد المعالج الحالي قالبًا مسمى يُعاد استخدامه بنقرة. */
export function saveWizardTemplate(name: string, config: WizardTemplateConfig, hint?: string): WizardSavedTemplate {
  const clean = sanitizeConfig(config);
  if (!clean) throw new Error('القالب فارغ: اختر نوعًا واحدًا على الأقل قبل الحفظ.');
  const now = new Date().toISOString();
  const template: WizardSavedTemplate = {
    id: `wtpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'قالب بلا اسم',
    hint: hint?.trim() || undefined,
    config: clean,
    createdAt: now,
    updatedAt: now,
  };
  writeTemplates([template, ...readTemplates()]);
  return template;
}

/** يلمس القالب عند استعماله فيصعد إلى أول القائمة (الأحدث استعمالًا أولًا). */
export function touchWizardTemplate(id: string): void {
  const templates = readTemplates();
  const target = templates.find((item) => item.id === id);
  if (!target) return;
  target.updatedAt = new Date().toISOString();
  writeTemplates(templates);
}

/** يحذف قالب مستخدم (القوالب المدمجة لا تُحذف). */
export function deleteWizardTemplate(id: string): void {
  writeTemplates(readTemplates().filter((item) => item.id !== id));
}

/** يعيد تفضيلات المعالج (الوضع المتقدم/الموجه). */
export function readWizardPrefs(): WizardPrefs {
  if (!isBrowser()) return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(WIZARD_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<WizardPrefs>;
    return { advanced: parsed.advanced === true };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** يحفظ تفضيلات المعالج. */
export function saveWizardPrefs(prefs: WizardPrefs): WizardPrefs {
  const next = { advanced: prefs.advanced === true };
  if (!isBrowser()) return next;
  try {
    window.localStorage.setItem(WIZARD_PREFS_KEY, JSON.stringify(next));
  } catch {
    // امتلاء التخزين لا يعطل المعالج.
  }
  return next;
}

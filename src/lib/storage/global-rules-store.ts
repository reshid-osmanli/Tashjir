// مخزن القواعد العامة للمصحف - Global Rules Store
//
// القاعدة العامة ليست اختلافا موضعيا: لا ترتبط بكلمة أو آية، بل تسجل حكما
// أو أصلا يخص قارئا/رواية في المصحف كله. تحفظ مستقلة عن مستندات الآيات حتى
// لا نكررها 6236 مرة، وتدخل في كل ملف JSON مصدّر لإبقاء سياق العمل كاملا.

import type { VariantCategory } from '@/types';
import type {
  ReadingScope,
  VariantEvidence,
  VerificationStatus,
} from '@/types/tashjeer';

const GLOBAL_RULES_KEY = 'tashjeer:global-rules:v1';

export interface GlobalRule {
  id: string;
  /** عنوان واضح للقاعدة، مثل: مد المنفصل لورش. */
  title: string;
  category: VariantCategory;
  /** من تنطبق عليه القاعدة. */
  scope: ReadingScope;
  /** اسم الحكم المختصر المستخدم في التشجير والتصفية. */
  ruleLabel?: string;
  /** قيمة المد إن كانت القاعدة من المدود. */
  maddHarakat?: number;
  description?: string;
  sourceRef?: string;
  evidences?: VariantEvidence[];
  status: VerificationStatus;
  /** إبقاء القاعدة في السجل مع إيقاف تطبيقها المؤقت. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** يعيد القواعد العامة مرتبة بالأحدث تعديلا. */
export function listGlobalRules(): GlobalRule[] {
  return readRules().sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

/** ينشئ قاعدة عامة أو يحدّثها، ثم يعيد النسخة المحفوظة. */
export function saveGlobalRule(rule: Omit<GlobalRule, 'createdAt' | 'updatedAt'> & Partial<Pick<GlobalRule, 'createdAt'>>): GlobalRule {
  const now = new Date().toISOString();
  const rules = readRules();
  const existing = rules.find((item) => item.id === rule.id);
  const saved: GlobalRule = {
    ...rule,
    title: rule.title.trim(),
    createdAt: existing?.createdAt ?? rule.createdAt ?? now,
    updatedAt: now,
  };

  writeRules([...rules.filter((item) => item.id !== saved.id), saved]);
  return saved;
}

/** يحذف القاعدة العامة من المصحف كله. */
export function deleteGlobalRule(id: string): void {
  writeRules(readRules().filter((rule) => rule.id !== id));
}

/** يحفظ مجموعة قواعد مستوردة مع دمجها بالمعرّف. */
export function upsertGlobalRules(rules: GlobalRule[]): void {
  if (!Array.isArray(rules) || rules.length === 0) return;
  const current = readRules();
  const byId = new Map(current.map((rule) => [rule.id, rule]));

  for (const candidate of rules) {
    if (!isValidRule(candidate)) continue;
    const existing = byId.get(candidate.id);
    // عند الاستيراد لا نستبدل بيانات أحدث محليا إلا إن كان الملف أحدث.
    if (!existing || candidate.updatedAt >= existing.updatedAt) {
      byId.set(candidate.id, normalizeRule(candidate));
    }
  }

  writeRules([...byId.values()]);
}

/** معرّف متين كفاية للتخزين المحلي. */
export function createGlobalRuleId(): string {
  return `global-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readRules(): GlobalRule[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(GLOBAL_RULES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRule).map(normalizeRule);
  } catch {
    return [];
  }
}

function writeRules(rules: GlobalRule[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(GLOBAL_RULES_KEY, JSON.stringify(rules));
}

function isValidRule(value: unknown): value is GlobalRule {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as GlobalRule).id === 'string' &&
      typeof (value as GlobalRule).title === 'string' &&
      typeof (value as GlobalRule).category === 'string' &&
      (value as GlobalRule).scope
  );
}

function normalizeRule(rule: GlobalRule): GlobalRule {
  const now = new Date().toISOString();
  return {
    ...rule,
    title: rule.title.trim(),
    status: rule.status ?? 'DRAFT',
    isActive: rule.isActive ?? true,
    evidences: Array.isArray(rule.evidences) ? rule.evidences : [],
    createdAt: rule.createdAt ?? now,
    updatedAt: rule.updatedAt ?? rule.createdAt ?? now,
  };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

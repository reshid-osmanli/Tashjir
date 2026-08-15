// مخزن القواعد العامة للمصحف - Global Rules Store
//
// القاعدة العامة ليست اختلافا موضعيا: لا ترتبط بكلمة أو آية، بل تسجل حكما
// أو أصلا يخص قارئا/رواية في المصحف كله. تحفظ مستقلة عن مستندات الآيات حتى
// لا نكررها 6236 مرة، وتدخل في كل ملف JSON مصدّر لإبقاء سياق العمل كاملا.

import type { VariantCategory } from '@/types';
import type {
  GlobalRulePattern,
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
  /** نمط اختياري يجعل القاعدة قابلة للتطبيق الآلي على المصحف كله.
   * القواعد القديمة التي لا تحمل نمطا تبقى وصفية فقط. */
  pattern?: GlobalRulePattern;
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
  const saved = normalizeRule({
    ...rule,
    title: rule.title.trim(),
    createdAt: existing?.createdAt ?? rule.createdAt ?? now,
    updatedAt: now,
  });

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
    pattern: isValidPattern(rule.pattern) ? rule.pattern : undefined,
    evidences: Array.isArray(rule.evidences) ? rule.evidences : [],
    createdAt: rule.createdAt ?? now,
    updatedAt: rule.updatedAt ?? rule.createdAt ?? now,
  };
}

/** تتحقق من الحد الأدنى للنمط قبل إدخاله إلى محرك التطبيق. */
function isValidPattern(value: unknown): value is GlobalRulePattern {
  if (!value || typeof value !== 'object') return false;
  const pattern = value as Partial<GlobalRulePattern>;
  if (pattern.version !== 1 || (pattern.kind !== 'CHARACTERS' && pattern.kind !== 'MORPHOLOGY')) {
    return false;
  }
  if (!Array.isArray(pattern.words) || pattern.words.length === 0) return false;

  if (pattern.kind === 'CHARACTERS') {
    if (
      typeof pattern.wordCount !== 'number' ||
      !Number.isInteger(pattern.wordCount) ||
      pattern.wordCount < 1 ||
      pattern.wordCount !== pattern.words.length
    ) {
      return false;
    }

    const wordCount = pattern.wordCount;
    const offsets = new Set<number>();
    return pattern.words.every((word) => {
      if (!word || typeof word !== 'object') return false;
      const candidate = word as {
        offset?: unknown;
        constraints?: unknown;
        exactLength?: unknown;
      };
      if (
        typeof candidate.offset !== 'number' ||
        !Number.isInteger(candidate.offset) ||
        candidate.offset < 0 ||
        candidate.offset >= wordCount ||
        offsets.has(candidate.offset) ||
        !Array.isArray(candidate.constraints) ||
        candidate.constraints.length === 0
      ) {
        return false;
      }
      offsets.add(candidate.offset);
      if (
        candidate.exactLength !== undefined &&
        (typeof candidate.exactLength !== 'number' || !Number.isInteger(candidate.exactLength) || candidate.exactLength < 1)
      ) {
        return false;
      }
      return candidate.constraints.every((constraint) => {
        if (!constraint || typeof constraint !== 'object') return false;
        const item = constraint as Record<string, unknown>;
        const validSet = ['EXACT', 'IKHFAA', 'IZHAR', 'IDGHAM', 'IQLAB', 'QALQALAH', 'GHUNNAH', 'MAD'];
        const validMode = ['EXACT', 'IGNORE', 'NONE'];
        const validAnchor = ['START', 'END', 'INDEX'];
        return (
          typeof item.baseLetter === 'string' &&
          item.baseLetter.length > 0 &&
          (item.letterSet === undefined || (typeof item.letterSet === 'string' && validSet.includes(item.letterSet))) &&
          typeof item.marks === 'string' &&
          typeof item.harakaMode === 'string' &&
          validMode.includes(item.harakaMode) &&
          typeof item.anchor === 'string' &&
          validAnchor.includes(item.anchor) &&
          typeof item.value === 'number' &&
          Number.isInteger(item.value) &&
          item.value >= (item.anchor === 'INDEX' ? 1 : 0)
        );
      });
    }) && offsets.size === wordCount;
  }

  if (pattern.wordCount !== 1 || pattern.words.length !== 1) return false;
  const word = pattern.words[0] as {
    offset?: unknown;
    template?: unknown;
    prefix?: unknown;
    suffix?: unknown;
    harakaMode?: unknown;
  } | undefined;
  return Boolean(
    word &&
      word.offset === 0 &&
      typeof word.harakaMode === 'string' &&
      ['EXACT', 'IGNORE', 'NONE'].includes(word.harakaMode) &&
      (typeof word.template === 'string' || typeof word.prefix === 'string' || typeof word.suffix === 'string') &&
      [word.template, word.prefix, word.suffix].some((item) => typeof item === 'string' && item.length > 0)
  );
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

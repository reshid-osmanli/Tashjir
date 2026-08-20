// مخزن القواعد العامة للمصحف - Global Rules Store
//
// القاعدة العامة ليست اختلافا موضعيا: لا ترتبط بكلمة أو آية، بل تسجل حكما
// أو أصلا يخص قارئا/رواية في المصحف كله. تحفظ مستقلة عن مستندات الآيات حتى
// لا نكررها 6236 مرة، وتدخل في كل ملف JSON مصدّر لإبقاء سياق العمل كاملا.

import type { VariantCategory } from '@/types';
import type {
  GlobalRulePattern,
  ReaderStrengthMap,
  ReadingScope,
  VariantEvidence,
  VerificationStatus,
} from '@/types/tashjeer';
import { clearRuleOccurrences } from './rule-occurrences-store';

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
  /**
   * رقم ترتيب السطر للقاعدة: رتبة افتراضية تأخذها مواضع القاعدة في ترتيب
   * أسطر التشجير، يحددها المحرر يدويا عند الإنشاء ويمكن تعديلها لاحقا.
   * الأصغر يعلو. تخصيص الموضع الواحد (occurrence override) يسبق هذه الرتبة.
   */
  orderRank?: number;
  /** درجة قوة الوجه العامة (معرّف من سلّم الدرجات القابل للتحرير).
   * أعلى الدرجات رتبةً هي «الوجه المقدَّم» بعد دمج المفهومين.
   */
  strengthDegreeId?: string;
  /**
   * درجة القوة لكل راوٍ على حدة: معرّف الراوي ← معرّف الدرجة.
   * فالوجه قد يكون مقدَّما عند راوٍ مؤخَّرا عند آخر، ولا يصح توحيدهما.
   */
  strengthByNarrator?: ReaderStrengthMap;
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

/**
 * يحذف القاعدة العامة من المصحف كله، ومعها كل ما سُجِّل على مواضعها.
 *
 * حذف القاعدة كلها غير حذف موضع منها: هذا يمحو الحكم من المصحف، وذاك
 * يستثني موضعا واحدا. انظر `deleteOccurrence` للحذف الموضعي.
 */
export function deleteGlobalRule(id: string): void {
  writeRules(readRules().filter((rule) => rule.id !== id));
  clearRuleOccurrences(id);
}

/**
 * يثبّت رقم ترتيب السطر لقاعدة عامة، ويعيد ترقيم رتب بقية القواعد تلقائيا.
 *
 * الإدراج لا الاستبدال: قاعدة تأخذ رتبة مشغولة تزيح صاحبتها ومن بعدها
 * رتبة واحدة، فلا يقع تعادل ولا تتسرب فجوات في الترقيم. تمرير null يحرر
 * القاعدة من الترتيب اليدوي فتعتمد قاعدة المحرك.
 */
export function setGlobalRuleOrderRank(ruleId: string, rank: number | null): void {
  const rules = readRules();
  const target = rules.find((rule) => rule.id === ruleId);
  if (!target) return;

  if (rank === null || !Number.isFinite(rank)) {
    target.orderRank = undefined;
    writeRules(compactRuleRanks(rules));
    return;
  }

  const wanted = Math.max(1, Math.round(rank));
  const ranked = rules
    .filter((rule) => rule.id !== ruleId && typeof rule.orderRank === 'number')
    .sort((first, second) => (first.orderRank ?? 0) - (second.orderRank ?? 0));

  // حجز خانة الرتبة المطلوبة للقاعدة، وإزاحة كل من يقع بعدها رتبة واحدة.
  let cursor = 1;
  for (const rule of ranked) {
    if (cursor === wanted) cursor += 1;
    rule.orderRank = cursor;
    cursor += 1;
  }
  target.orderRank = Math.min(wanted, cursor);

  writeRules(rules);
}

/**
 * يعيد ترقيم رتب القواعد المرقّمة ١، ٢، ٣... بلا فجوات ولا تعادل.
 *
 * المدخلات غير المرقّمة تبقى بلا رتبة (تعتمد ترتيب المحرك).
 */
export function compactRuleRanks(rules: GlobalRule[]): GlobalRule[] {
  const ranked = rules.filter((rule) => typeof rule.orderRank === 'number');
  const unranked = rules.filter((rule) => typeof rule.orderRank !== 'number');

  const next = [...ranked].sort((first, second) => (first.orderRank ?? 0) - (second.orderRank ?? 0));
  next.forEach((rule, index) => {
    rule.orderRank = index + 1;
  });

  return [...next, ...unranked].map(normalizeRule);
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
    strengthByNarrator: normalizeStrengthMap(rule.strengthByNarrator),
    evidences: Array.isArray(rule.evidences) ? rule.evidences : [],
    createdAt: rule.createdAt ?? now,
    updatedAt: rule.updatedAt ?? rule.createdAt ?? now,
  };
}

/** تتحقق من الحد الأدنى للنمط قبل إدخاله إلى محرك التطبيق. */
export function isValidPattern(value: unknown): value is GlobalRulePattern {
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

    const scope = (pattern as { matchScope?: unknown }).matchScope;
    if (scope !== undefined && (typeof scope !== 'string' || !['WORDS', 'INSIDE_WORD', 'BOTH'].includes(scope))) {
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
        const validMode = ['EXACT', 'IGNORE', 'NONE', 'SAKIN'];
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

  // النمط الصرفي: كلمة واحدة أو حتى أربع كلمات متجاورة.
  if (
    typeof pattern.wordCount !== 'number' ||
    !Number.isInteger(pattern.wordCount) ||
    pattern.wordCount < 1 ||
    pattern.wordCount > MAX_MORPHOLOGY_WORDS ||
    pattern.words.length !== pattern.wordCount
  ) {
    return false;
  }

  const morphologyOffsets = new Set<number>();
  for (const candidate of pattern.words) {
    const word = candidate as unknown as Record<string, unknown> | undefined;
    if (!word) return false;
    if (
      typeof word.offset !== 'number' ||
      !Number.isInteger(word.offset) ||
      word.offset < 0 ||
      word.offset >= pattern.wordCount ||
      morphologyOffsets.has(word.offset)
    ) {
      return false;
    }
    morphologyOffsets.add(word.offset);
    if (!isValidMorphologyWord(word)) return false;
  }

  return morphologyOffsets.size === pattern.wordCount;
}

/** أقصى عدد كلمات متجاورة في القاعدة الصرفية الواحدة. */
export const MAX_MORPHOLOGY_WORDS = 4;

function isValidMorphologyWord(word: Record<string, unknown>): boolean {
  if (typeof word.harakaMode !== 'string' || !['EXACT', 'IGNORE', 'NONE', 'SAKIN'].includes(word.harakaMode)) {
    return false;
  }

  const literals = [word.template, word.prefix, word.suffix];
  if (literals.some((item) => item !== undefined && typeof item !== 'string')) return false;

  if (!isValidEnumList(word.morphologyFeatures, MORPHOLOGY_FEATURES)) return false;
  if (!isValidEnumList(word.excludedMorphologyFeatures, MORPHOLOGY_FEATURES)) return false;
  if (!isValidEnumList(word.endingHaraka, WORD_ENDING_HARAKAT)) return false;
  if (!isValidEnumList(word.precededBy, PARTICLE_CLASSES)) return false;
  if (!isValidEnumList(word.followedBy, PARTICLE_CLASSES)) return false;
  if (
    word.startsWithSet !== undefined &&
    (typeof word.startsWithSet !== 'string' || !LETTER_SETS.includes(word.startsWithSet))
  ) {
    return false;
  }
  if (
    word.endsWithSet !== undefined &&
    (typeof word.endsWithSet !== 'string' || !LETTER_SETS.includes(word.endsWithSet))
  ) {
    return false;
  }
  if (
    word.ayahPosition !== undefined &&
    (typeof word.ayahPosition !== 'string' ||
      !['ANY', 'FIRST', 'LAST', 'NOT_LAST'].includes(word.ayahPosition))
  ) {
    return false;
  }
  if (!isValidBound(word.minLength) || !isValidBound(word.maxLength)) return false;
  if (
    typeof word.minLength === 'number' &&
    typeof word.maxLength === 'number' &&
    word.minLength > word.maxLength
  ) {
    return false;
  }

  // لا بد من معيار واحد على الأقل، وإلا طابقت القاعدة كل كلمة في المصحف.
  const hasLiteral = literals.some((item) => typeof item === 'string' && item.length > 0);
  const hasCriteria = [
    word.morphologyFeatures,
    word.excludedMorphologyFeatures,
    word.endingHaraka,
    word.precededBy,
    word.followedBy,
  ].some((item) => Array.isArray(item) && item.length > 0);
  const hasBounds =
    typeof word.minLength === 'number' ||
    typeof word.maxLength === 'number' ||
    typeof word.startsWithSet === 'string' ||
    typeof word.endsWithSet === 'string' ||
    (typeof word.ayahPosition === 'string' && word.ayahPosition !== 'ANY');

  return hasLiteral || hasCriteria || hasBounds;
}

const LETTER_SETS = ['IKHFAA', 'IZHAR', 'IDGHAM', 'IQLAB', 'QALQALAH', 'GHUNNAH', 'MAD'];

const MORPHOLOGY_FEATURES = [
  'TAA_MARBUTA',
  'TAA_MAFTUHA',
  'ALIF_MAQSURA',
  'ALIF_MAMDUDA',
  'NISBA_YAA',
  'DUAL_SUFFIX',
  'SOUND_MASCULINE_PLURAL',
  'SOUND_FEMININE_PLURAL',
  'DEFINITE_AL',
  'TANWEEN',
  'SHADDA',
  'HAMZA',
  'MADD_LETTER',
  'NOON_SAKINA_END',
  'MEEM_SAKINA_END',
  'PLURAL_WAW',
  'HAMZAT_WASL_START',
  'SHAMSI_AL',
  'QAMARI_AL',
  'ATTACHED_PRONOUN',
];

const WORD_ENDING_HARAKAT = [
  'DAMMA',
  'FATHA',
  'KASRA',
  'SUKUN',
  'TANWEEN_DAMM',
  'TANWEEN_FATH',
  'TANWEEN_KASR',
];

const PARTICLE_CLASSES = [
  'JARR',
  'NASB',
  'JAZM',
  'INNA',
  'KANA',
  'NIDA',
  'ISTIFHAM',
  'SHART',
  'ATF',
  'NAFY',
  'MAWSUL',
];

function isValidEnumList(value: unknown, allowed: string[]): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => typeof item === 'string' && allowed.includes(item));
}

function isValidBound(value: unknown): boolean {
  if (value === undefined) return true;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** يزيل من خريطة الدرجات كل مدخل فارغ، فلا تُحفظ قيم بلا معنى. */
function normalizeStrengthMap(map: ReaderStrengthMap | undefined): ReaderStrengthMap | undefined {
  if (!map || typeof map !== 'object') return undefined;
  const next: ReaderStrengthMap = {};
  for (const [narratorId, degreeId] of Object.entries(map)) {
    if (typeof narratorId === 'string' && typeof degreeId === 'string' && degreeId.trim()) {
      next[narratorId] = degreeId;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

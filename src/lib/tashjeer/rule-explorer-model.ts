// نموذج مستكشف القواعد — Rule Explorer Model (FR-ES-07.1)
// مشروع التشجير - نظام القراءات العشر
//
// منطق المستكشف كله هنا نقيًا (تصنيف/بحث/تصفية/ترتيب/تجميع) حتى يُختبر بلا
// DOM ويبقى المكوّن عرضًا فقط. التصنيف يتكامل مع فئات القواعد الأربع عشرة
// (`EngineRuleCategory`) ومع النطاق ومجموعة الأولوية، فيُنتج دلاء المستكشف
// المطلوبة: Global / Surah / Ayah / Local / Reader / Narrator / Path / Merge /
// Difference / Ordering / Exceptions.
//
// كل الترتيب حتمي: عند التعادل يُحسم بالمعرّف، فلا يقفز صف بلا سبب (DM-13).

import type { EngineConfig, EngineRule, RuleHardness, RuleSource, RuleStatus, SpecificityLevel } from '@/lib/tashjeer/model/v8';
import { SPECIFICITY_RANK } from '@/lib/tashjeer/model/v8';
import { normalizeArabic } from '@/lib/utils/arabic';
import { inferRuleSource } from './rule-diff';
import { conflictedRuleReasons, isLive } from './rule-status-flow';

/** دلاء تصنيف المستكشف (بترتيب عرض ثابت). */
export const EXPLORER_BUCKETS = [
  'GLOBAL',
  'SURAH',
  'AYAH',
  'LOCAL',
  'READER',
  'NARRATOR',
  'PATH',
  'MERGE',
  'DIFFERENCE',
  'ORDERING',
  'EXCEPTIONS',
] as const;

export type ExplorerBucket = (typeof EXPLORER_BUCKETS)[number];

/** تسميات عربية للدلاء. */
export const BUCKET_LABELS: Record<ExplorerBucket, string> = {
  GLOBAL: 'عام (على المصحف)',
  SURAH: 'على السورة',
  AYAH: 'على الآية',
  LOCAL: 'محلّي (كلمة/حرف/مدى)',
  READER: 'قواعد القرّاء',
  NARRATOR: 'قواعد الرواة',
  PATH: 'قواعد الطرق',
  MERGE: 'الدمج والفصل',
  DIFFERENCE: 'الاختلافات والأوجه',
  ORDERING: 'الترتيب',
  EXCEPTIONS: 'الاستثناءات والتجاوزات',
};

/** تلميح يشرح ما يدخل الدلو (يُعرض في رأس المجموعة). */
export const BUCKET_HINTS: Record<ExplorerBucket, string> = {
  GLOBAL: 'نطاقها المصحف كله ولا تخصّ قارئًا أو راويًا.',
  SURAH: 'مقيّدة بسورة (نطاق أو خصوصية).',
  AYAH: 'مقيّدة بآية.',
  LOCAL: 'على كلمة أو حرف أو مدى داخل الكلمة.',
  READER: 'مجموعة أولوية القرّاء أو شرط على readerId.',
  NARRATOR: 'مجموعة أولوية الرواة أو شرط على narratorId.',
  PATH: 'مجموعة أولوية الطرق أو شرط على pathId.',
  MERGE: 'فئات MERGE/SPLIT/RELATION: متى يُدمج ومتى لا.',
  DIFFERENCE: 'فئات DETECTION/DIFFERENCE/VARIANT/CONTEXT/WAQF/WASL/IBTIDA.',
  ORDERING: 'فئة ORDERING: ترتيب الأوجه والأسطر.',
  EXCEPTIONS: 'فئتا EXCEPTION/OVERRIDE و VALIDATION: استثناءات صريحة.',
};

/**
 * أولوية الدلاء عند التصنيف (الأول مطابقة يفوز) — ثابتة وموثّقة، ومرتّبة من
 * الأخص إلى الأعم:
 *   1) الجمهور (قرّاء/رواة/طرق): أدلّ معلومة للتنقل.
 *   2) التضييق بالنطاق (سورة/آية/محلي): أضيق من العام فيُقدَّم على الوظيفة.
 *   3) الوظيفة (استثناءات/ترتيب/دمج/اختلافات).
 *   4) العام (المصحف): الدلو الاحتياطي.
 * القاعدة العامة على المصحف إذن تقع في دلو وظيفتها (دمج/ترتيب...) لا في «عام»،
 * فيبقى دلو «عام» لما لا وظيفة أوضح له.
 */
const BUCKET_PRECEDENCE: ExplorerBucket[] = [
  'READER',
  'NARRATOR',
  'PATH',
  'SURAH',
  'AYAH',
  'LOCAL',
  'EXCEPTIONS',
  'ORDERING',
  'MERGE',
  'DIFFERENCE',
  'GLOBAL',
];

const MERGE_CATEGORIES = new Set(['MERGE', 'SPLIT', 'RELATION']);
const DIFFERENCE_CATEGORIES = new Set([
  'DETECTION',
  'DIFFERENCE',
  'VARIANT',
  'CONTEXT',
  'WAQF',
  'WASL',
  'IBTIDA',
]);
const EXCEPTION_CATEGORIES = new Set(['EXCEPTION', 'OVERRIDE', 'VALIDATION']);
const LOCAL_SCOPES = new Set(['CHARACTER', 'WORD', 'RANGE']);

/** دلاء «الوظيفة» (تُشتق من الفئة، و`type` احتياط لها). */
const FUNCTION_BUCKETS: ExplorerBucket[] = ['EXCEPTIONS', 'ORDERING', 'MERGE', 'DIFFERENCE'];

/** هل شروط القاعدة تُحيل إلى حقل بعينه (قارئ/راوي/طريق/سورة/آية)؟ */
function conditionsReference(rule: EngineRule, field: string): boolean {
  const walk = (group: EngineRule['conditions']): boolean => {
    for (const item of group.all ?? []) {
      if ('field' in item) {
        if (item.field === field) return true;
      } else if (walk(item)) return true;
    }
    for (const item of group.any ?? []) {
      if ('field' in item) {
        if (item.field === field) return true;
      } else if (walk(item)) return true;
    }
    for (const item of group.not ?? []) {
      if ('field' in item) {
        if (item.field === field) return true;
      } else if (walk(item)) return true;
    }
    return false;
  };
  return walk(rule.conditions);
}

/**
 * يصنّف قاعدة في دلو واحد من دلاء المستكشف. التصنيف مشتق من النطاق والفئة
 * ومجموعة الأولوية وحقول الشروط — لا حقل جديد يُخزَّن، فلا يمكن أن يتعارض
 * التصنيف مع القاعدة نفسها (مصدر حقيقة واحد — P-07).
 */
export function classifyRule(rule: EngineRule): ExplorerBucket {
  const groupId = rule.groupId.toLowerCase();
  const candidates = new Set<ExplorerBucket>();

  if (groupId.includes('reader') || conditionsReference(rule, 'readerId')) candidates.add('READER');
  if (groupId.includes('narrator') || conditionsReference(rule, 'narratorId')) candidates.add('NARRATOR');
  if (groupId.includes('path') || conditionsReference(rule, 'pathId')) candidates.add('PATH');
  // الدوال الوظيفية تُشتق من **الفئة** (١٤ قيمة، الأخص)، ولا يُلتفت إلى
  // `type` إلا إن لم تقل الفئة شيئًا — وإلا لغلبت «MERGE» العامة على فئة أدق
  // مثل CONTEXT/WAQF وصار التصنيف مضلِّلا.
  if (EXCEPTION_CATEGORIES.has(rule.category)) candidates.add('EXCEPTIONS');
  if (rule.category === 'ORDERING') candidates.add('ORDERING');
  if (MERGE_CATEGORIES.has(rule.category)) candidates.add('MERGE');
  if (DIFFERENCE_CATEGORIES.has(rule.category)) candidates.add('DIFFERENCE');
  if (!FUNCTION_BUCKETS.some((bucket) => candidates.has(bucket))) {
    if (rule.type === 'EXCEPTION') candidates.add('EXCEPTIONS');
    if (rule.type === 'ORDERING') candidates.add('ORDERING');
    if (rule.type === 'MERGE' || rule.type === 'RELATION') candidates.add('MERGE');
    if (rule.type === 'DIFFERENCE') candidates.add('DIFFERENCE');
  }
  if (rule.scope === 'AYAH' || rule.specificity === 'AYAH' || conditionsReference(rule, 'ayahKey')) candidates.add('AYAH');
  if (rule.scope === 'SURAH' || rule.specificity === 'SURAH' || conditionsReference(rule, 'surahNumber')) {
    candidates.add('SURAH');
  }
  if (LOCAL_SCOPES.has(rule.scope) || SPECIFICITY_RANK[rule.specificity] <= SPECIFICITY_RANK.SEGMENT) {
    candidates.add('LOCAL');
  }
  if (rule.scope === 'MUSHAF' || rule.specificity === 'MUSHAF') candidates.add('GLOBAL');

  for (const bucket of BUCKET_PRECEDENCE) {
    if (candidates.has(bucket)) return bucket;
  }
  return 'GLOBAL';
}

// ==================== البحث والتصفية والترتيب ====================

export type ExplorerSortKey = 'priority' | 'name' | 'status' | 'updated' | 'usage' | 'version' | 'specificity';
export type SortDirection = 'asc' | 'desc';

/** مصادر القواعد للتصفية. */
export const RULE_SOURCES: RuleSource[] = ['SYSTEM', 'EDITOR', 'CANDIDATE', 'IMPORTED'];

export const SOURCE_LABELS: Record<RuleSource, string> = {
  SYSTEM: 'سياسة النظام',
  EDITOR: 'تحرير في الاستوديو',
  CANDIDATE: 'مرشّحة من تصحيح',
  IMPORTED: 'مستوردة',
};

/** ترتيب عرض الحالات في الفرز بالحالة (ثابت، لا أبجدي عشوائي). */
export const STATUS_ORDER: Record<RuleStatus, number> = {
  ACTIVE: 0,
  CONFLICTED: 1,
  EXPERIMENTAL: 2,
  DRAFT: 3,
  DISABLED: 4,
  DEPRECATED: 5,
};

/** استعلام المستكشف: بحث + تصفية + ترتيب. */
export interface ExplorerQuery {
  query: string;
  statuses: RuleStatus[] | 'ALL';
  categories: string[] | 'ALL';
  buckets: ExplorerBucket[] | 'ALL';
  groupId: string | 'ALL';
  hardness: RuleHardness | 'ALL';
  specificity: SpecificityLevel | 'ALL';
  source: RuleSource | 'ALL';
  protectedOnly: boolean;
  withTestsOnly: boolean;
  liveOnly: boolean;
  conflictedOnly: boolean;
  editedOnly: boolean;
  sort: { key: ExplorerSortKey; direction: SortDirection };
}

export const EMPTY_EXPLORER_QUERY: ExplorerQuery = {
  query: '',
  statuses: 'ALL',
  categories: 'ALL',
  buckets: 'ALL',
  groupId: 'ALL',
  hardness: 'ALL',
  specificity: 'ALL',
  source: 'ALL',
  protectedOnly: false,
  withTestsOnly: false,
  liveOnly: false,
  conflictedOnly: false,
  editedOnly: false,
  sort: { key: 'priority', direction: 'desc' },
};

/**
 * نص البحث المطبّع لقاعدة: الاسم + الوصف + المعرّف + الفئة + المجموعة +
 * أسماء حقول الشروط والقيم، بلا تشكيل وبهمزات موحّدة، فيجد «مد» في
 * «المدود» و«مالك» في «مَالِكِ».
 */
export function ruleSearchText(rule: EngineRule): string {
  const values: unknown[] = [];
  const walk = (group: EngineRule['conditions']) => {
    for (const list of [group.all ?? [], group.any ?? [], group.not ?? []]) {
      for (const item of list) {
        if ('field' in item) {
          values.push(item.field, item.op, item.value);
        } else {
          walk(item);
        }
      }
    }
  };
  walk(rule.conditions);
  for (const action of rule.actions) {
    values.push(action.type, action.params ? JSON.stringify(action.params) : '');
  }
  return normalizeArabic(
    [
      rule.name,
      rule.description ?? '',
      rule.id,
      rule.category,
      rule.type,
      rule.scope,
      rule.groupId,
      rule.status,
      rule.specificity,
      rule.hardness,
      ...(rule.testCases ?? []).map((testCase) => testCase.name),
      ...values.map((value) => (typeof value === 'string' ? value : JSON.stringify(value ?? ''))),
    ]
      .join(' ')
      .toLowerCase()
  );
}

/** هل القاعدة تطابق نص البحث (فارغ = تطابق الكل)؟ */
export function matchesQuery(rule: EngineRule, query: string, searchText = ruleSearchText(rule)): boolean {
  const normalized = normalizeArabic(query.trim().toLowerCase());
  if (!normalized) return true;
  // كل كلمة في البحث يجب أن تظهر (بحث بـ «و» — الأدق للمستكشف).
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => searchText.includes(token));
}

/** سياق التصفية المشتق من الملف (أسباب التعارض وعدادات الاستخدام). */
export interface ExplorerContext {
  /** معرّف القاعدة ← عدد القواعد التي تشير إليها (الاستخدام الخام). */
  usage: Map<string, number>;
  /** معرّف القاعدة ← أسباب وسمها متعارضة. */
  conflicts: Map<string, string[]>;
}

/** يبني سياق المستكشف من ملف المحرك. */
export function buildExplorerContext(profile: EngineConfig): ExplorerContext {
  const usage = new Map<string, number>();
  for (const rule of profile.rules) usage.set(rule.id, 0);
  for (const rule of profile.rules) {
    for (const target of [...(rule.dependsOn ?? []), ...(rule.overrides ?? []), ...(rule.conflictsWith ?? [])]) {
      if (usage.has(target)) usage.set(target, (usage.get(target) ?? 0) + 1);
    }
  }
  return { usage, conflicts: conflictedRuleReasons(profile) };
}

/** هل القاعدة «معدّلة» (إصدارها > ١) — للتصفية بـ «معدّلة فقط». */
export function isEdited(rule: EngineRule): boolean {
  return rule.version > 1;
}

/** يصفّي القواعد بحسب الاستعلام (بلا فرز). */
export function filterRules(
  rules: EngineRule[],
  query: ExplorerQuery,
  context?: ExplorerContext
): EngineRule[] {
  const statuses = query.statuses === 'ALL' ? null : new Set(query.statuses);
  const categories = query.categories === 'ALL' ? null : new Set(query.categories);
  const buckets = query.buckets === 'ALL' ? null : new Set(query.buckets);
  const normalizedQuery = query.query.trim();

  return rules.filter((rule) => {
    if (statuses && !statuses.has(rule.status)) return false;
    if (categories && !categories.has(rule.category)) return false;
    if (buckets && !buckets.has(classifyRule(rule))) return false;
    if (query.groupId !== 'ALL' && rule.groupId !== query.groupId) return false;
    if (query.hardness !== 'ALL' && rule.hardness !== query.hardness) return false;
    if (query.specificity !== 'ALL' && rule.specificity !== query.specificity) return false;
    if (query.source !== 'ALL' && inferRuleSource(rule) !== query.source) return false;
    if (query.protectedOnly && !rule.protected) return false;
    if (query.withTestsOnly && (rule.testCases?.length ?? 0) === 0) return false;
    if (query.liveOnly && !isLive(rule)) return false;
    if (query.conflictedOnly) {
      const conflicted = rule.status === 'CONFLICTED' || Boolean(context?.conflicts.get(rule.id)?.length);
      if (!conflicted) return false;
    }
    if (query.editedOnly && !isEdited(rule)) return false;
    if (normalizedQuery && !matchesQuery(rule, normalizedQuery)) return false;
    return true;
  });
}

/** يقارن قاعدتين بحسب مفتاح الفرز (حتمي: التعادل يُحسم بالمعرّف). */
export function compareRules(
  a: EngineRule,
  b: EngineRule,
  sort: ExplorerQuery['sort'],
  usage?: Map<string, number>
): number {
  const factor = sort.direction === 'asc' ? 1 : -1;
  let result = 0;
  switch (sort.key) {
    case 'priority':
      result = a.priority - b.priority;
      break;
    case 'name':
      // الاسم يُقارن عربيًا (لا لاتينيًا) ويتبع اتجاه الفرز كغيره.
      result = a.name.localeCompare(b.name, 'ar');
      break;
    case 'status':
      result = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      break;
    case 'updated':
      result = String(a.updatedAt).localeCompare(String(b.updatedAt)) || a.version - b.version;
      break;
    case 'usage':
      result = (usage?.get(a.id) ?? 0) - (usage?.get(b.id) ?? 0);
      break;
    case 'version':
      result = a.version - b.version;
      break;
    case 'specificity':
      result = SPECIFICITY_RANK[a.specificity] - SPECIFICITY_RANK[b.specificity];
      break;
  }
  if (result === 0) return a.id.localeCompare(b.id);
  return result * factor;
}

/** يرتّب القواعد (نسخة جديدة، لا تعديل في المكان). */
export function sortRules(
  rules: EngineRule[],
  sort: ExplorerQuery['sort'],
  usage?: Map<string, number>
): EngineRule[] {
  return [...rules].sort((a, b) => compareRules(a, b, sort, usage));
}

/** تصفية + فرز في خطوة واحدة (الطريق المعتاد من المكوّن). */
export function applyExplorerQuery(
  rules: EngineRule[],
  query: ExplorerQuery,
  context?: ExplorerContext
): EngineRule[] {
  return sortRules(filterRules(rules, query, context), query.sort, context?.usage);
}

// ==================== التجميع (الشجرة) ====================

export interface ExplorerGroup {
  bucket: ExplorerBucket;
  label: string;
  hint: string;
  rules: EngineRule[];
  /** عدد النافذة منها (لشارة في رأس المجموعة). */
  live: number;
  conflicted: number;
}

/** يجمّع القواعد في دلاء المستكشف (بترتيب الدلاء الثابت، والفارغ يُحذف). */
export function groupByBucket(
  rules: EngineRule[],
  query: ExplorerQuery,
  context?: ExplorerContext
): ExplorerGroup[] {
  const sorted = applyExplorerQuery(rules, query, context);
  const map = new Map<ExplorerBucket, EngineRule[]>();
  for (const rule of sorted) {
    const bucket = classifyRule(rule);
    const list = map.get(bucket) ?? [];
    list.push(rule);
    map.set(bucket, list);
  }
  const groups: ExplorerGroup[] = [];
  for (const bucket of EXPLORER_BUCKETS) {
    const list = map.get(bucket);
    if (!list || list.length === 0) continue;
    groups.push({
      bucket,
      label: BUCKET_LABELS[bucket],
      hint: BUCKET_HINTS[bucket],
      rules: list,
      live: list.filter(isLive).length,
      conflicted: list.filter((rule) => rule.status === 'CONFLICTED' || context?.conflicts.has(rule.id)).length,
    });
  }
  return groups;
}

/** يجمّع القواعد بحسب الفئة (١٤ فئة) — العرض الثاني في الشجرة. */
export function groupByCategory(
  rules: EngineRule[],
  query: ExplorerQuery,
  context?: ExplorerContext
): Array<{ category: string; rules: EngineRule[] }> {
  const sorted = applyExplorerQuery(rules, query, context);
  const map = new Map<string, EngineRule[]>();
  for (const rule of sorted) {
    const list = map.get(rule.category) ?? [];
    list.push(rule);
    map.set(rule.category, list);
  }
  return Array.from(map.entries())
    .map(([category, list]) => ({ category, rules: list }))
    .sort((a, b) => b.rules.length - a.rules.length || a.category.localeCompare(b.category));
}

/** يجمّع القواعد بحسب مجموعة الأولوية (بترتيب المجموعات في السلم). */
export function groupByPriorityGroup(
  profile: EngineConfig,
  query: ExplorerQuery,
  context?: ExplorerContext
): Array<{ groupId: string; label: string; order: number; rules: EngineRule[] }> {
  const sorted = applyExplorerQuery(profile.rules, query, context);
  const labels = new Map(profile.priorityGroups.map((group) => [group.id, group.label]));
  const orders = new Map(profile.priorityGroups.map((group) => [group.id, group.order]));
  const map = new Map<string, EngineRule[]>();
  for (const rule of sorted) {
    const list = map.get(rule.groupId) ?? [];
    list.push(rule);
    map.set(rule.groupId, list);
  }
  return Array.from(map.entries())
    .map(([groupId, rules]) => ({
      groupId,
      label: labels.get(groupId) ?? groupId,
      order: orders.get(groupId) ?? Number.MAX_SAFE_INTEGER,
      rules,
    }))
    .sort((a, b) => a.order - b.order || a.groupId.localeCompare(b.groupId));
}

/** عدّادات رأس المستكشف (ملخّص ما هو معروض). */
export function explorerFacets(rules: EngineRule[], context?: ExplorerContext): {
  total: number;
  live: number;
  protected: number;
  conflicted: number;
  withTests: number;
  edited: number;
  byStatus: Record<RuleStatus, number>;
  byBucket: Record<ExplorerBucket, number>;
  byCategory: Array<{ category: string; count: number }>;
  bySource: Record<RuleSource, number>;
} {
  const byStatus = {
    DRAFT: 0,
    ACTIVE: 0,
    DISABLED: 0,
    DEPRECATED: 0,
    CONFLICTED: 0,
    EXPERIMENTAL: 0,
  } as Record<RuleStatus, number>;
  const byBucket = Object.fromEntries(EXPLORER_BUCKETS.map((bucket) => [bucket, 0])) as Record<ExplorerBucket, number>;
  const bySource = { SYSTEM: 0, EDITOR: 0, CANDIDATE: 0, IMPORTED: 0 } as Record<RuleSource, number>;
  const categoryCounts = new Map<string, number>();

  let live = 0;
  let protectedCount = 0;
  let conflicted = 0;
  let withTests = 0;
  let edited = 0;
  for (const rule of rules) {
    byStatus[rule.status] += 1;
    byBucket[classifyRule(rule)] += 1;
    bySource[inferRuleSource(rule)] += 1;
    categoryCounts.set(rule.category, (categoryCounts.get(rule.category) ?? 0) + 1);
    if (isLive(rule)) live += 1;
    if (rule.protected) protectedCount += 1;
    if (rule.status === 'CONFLICTED' || context?.conflicts.has(rule.id)) conflicted += 1;
    if ((rule.testCases?.length ?? 0) > 0) withTests += 1;
    if (isEdited(rule)) edited += 1;
  }

  return {
    total: rules.length,
    live,
    protected: protectedCount,
    conflicted,
    withTests,
    edited,
    byStatus,
    byBucket,
    bySource,
    byCategory: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
  };
}

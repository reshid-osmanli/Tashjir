// مواضع تطبيق القواعد العامة - Global Rule Occurrence Overrides
//
// القاعدة العامة تنطبق على المصحف كله، لكن التطبيق الآلي ليس معصوما: قد
// يوافق النمطُ موضعا لا يريده المحقق، أو يحتاج الموضع تعديل درجة أو ملاحظة.
//
// الحل المعتمد هنا: لا نحفظ 2344 نسخة من القاعدة، بل نحفظ **الاستثناءات
// فقط**. كل موضع لم يُمسّ يبقى مشتقا من القاعدة بلا تكلفة تخزين، وكل موضع
// عدّله المحقق أو حذفه يُسجَّل سطرا واحدا بمعرّفه.
//
// وأهم قيد في هذا الملف: الحذف موضعي لا يتعدى صاحبه. حذف القاعدة من
// «مَالِكِ» في الفاتحة لا يمسّها في غيرها، ويُسجَّل في سجل يبيّن أين حُذفت
// ومتى ولماذا، فيبقى عمل المحقق قابلا للمراجعة والتراجع.

import type { VariantCategory } from '@/types';
import type { ReaderStrengthMap, ReadingScope } from '@/types/tashjeer';
import type { GlobalRuleMatch } from '@/lib/quran-logic/global-rule-engine';

const OCCURRENCES_KEY = 'tashjeer:rule-occurrences:v1';
export const RULE_OCCURRENCES_EVENT = 'tashjeer:rule-occurrences-change';

/** حالة الموضع الواحد من تطبيق القاعدة. */
export type OccurrenceState =
  /** مطبَّق (الوضع الافتراضي لكل موضع لم يُمسّ). */
  | 'APPLIED'
  /** محذوف في هذا الموضع وحده. */
  | 'DELETED'
  /** روجع واعتُمد؛ يفيد في تتبع ما بقي بلا مراجعة. */
  | 'CONFIRMED';

/** استثناء مسجَّل على موضع بعينه من مواضع قاعدة عامة. */
export interface RuleOccurrenceOverride {
  /** المعرّف المركّب: global:<ruleId>:<ayahKey>:<start>:<end>:<charStart>:<charEnd> */
  id: string;
  ruleId: string;
  ayahKey: number;
  startPosition: number;
  endPosition: number;
  characterStart: number;
  characterEnd: number;
  state: OccurrenceState;
  /** سبب الحذف أو الملاحظة، يظهر في السجل. */
  reason?: string;
  /** تخصيص درجة القوة لهذا الموضع وحده، إن خالف درجة القاعدة. */
  strengthDegreeId?: string;
  strengthByNarrator?: ReaderStrengthMap;
  /**
   * رتبة ترتيب السطر لهذا الموضع وحده، إن خالف رتبة القاعدة العامة.
   * تصحيح موضعي لترتيب المحرك دون المساس بسائر مواضع القاعدة.
   */
  orderRank?: number;
  /**
   * الترقيع المحلي (FR-ED-10): قيم بديلة تُعرض في هذا الموضع وحده بدل
   * قيم القاعدة الأمّ، بلا نسخ القاعدة وبلا مساس بسائر المواضع.
   * غياب الحقل يعني أن الموضع مشتق خالص من القاعدة.
   */
  patch?: LocalOverridePatch;
  /** نص الموضع وقت التسجيل، ليقرأ المحقق السجل دون فتح الآية. */
  matchedText?: string;
  updatedAt: string;
}

/**
 * حقول القاعدة القابلة للتجاوز في موضع واحد (FR-ED-10/T2).
 * كل حقل غائب يبقى مشتقا من القاعدة الأمّ.
 */
export interface LocalOverridePatch {
  title?: string;
  category?: VariantCategory;
  description?: string;
  sourceRef?: string;
  ruleLabel?: string;
  maddHarakat?: number;
  scope?: ReadingScope;
  /** بديل نص الوجه المعروض (تصحيح إملائي/ضبط موضعي). */
  text?: string;
  label?: string;
  notes?: string;
  /** ملاحظة المحقق على سبب التجاوز، تظهر في السجل. */
  note?: string;
}

/** تغيير واحد مسجَّل قبل/بعد في سجل المواضع. */
export interface OccurrenceChange {
  field: string;
  before?: string;
  after?: string;
}

/** سطر في سجل التغييرات، يحفظ تاريخ ما جرى على المواضع. */
export interface OccurrenceLogEntry {
  id: string;
  ruleId: string;
  occurrenceId: string;
  ayahKey: number;
  action: 'DELETE' | 'RESTORE' | 'CONFIRM' | 'EDIT';
  reason?: string;
  matchedText?: string;
  /** قيم الحقول قبل التعديل وبعده (FR-ED-10: تتبع قبل/بعد). */
  changes?: OccurrenceChange[];
  at: string;
}

const MAX_LOG_ENTRIES = 500;

export interface OccurrenceStoreShape {
  overrides: RuleOccurrenceOverride[];
  log: OccurrenceLogEntry[];
}

// ==================== المعرّف ====================

/**
 * معرّف الموضع. مركّب من القاعدة والآية ومدى الكلمات ومدى الحروف، وهو
 * المعرّف نفسه الذي يولّده `variantFromGlobalMatch`، فيلتقي المخزنان على
 * مفتاح واحد بلا جدول ربط.
 */
export function occurrenceIdFor(ruleId: string, match: GlobalRuleMatch): string {
  return [
    'global',
    ruleId,
    match.ayahKey ?? 'ayah',
    match.startPosition,
    match.endPosition,
    match.characterRange.start.characterIndex,
    match.characterRange.end.characterIndex,
  ].join(':');
}

// ==================== القراءة ====================

/** كل الاستثناءات المسجَّلة، أو ما يخص قاعدة بعينها. */
export function listOccurrenceOverrides(ruleId?: string): RuleOccurrenceOverride[] {
  const overrides = readStore().overrides;
  return ruleId ? overrides.filter((item) => item.ruleId === ruleId) : overrides;
}

/** خريطة سريعة بالمعرّف، للاستعمال داخل حلقات العرض. */
export function occurrenceOverrideMap(ruleId?: string): Map<string, RuleOccurrenceOverride> {
  return new Map(listOccurrenceOverrides(ruleId).map((item) => [item.id, item]));
}

/** معرّفات المواضع المحذوفة، وهي ما يستبعده محرك الاشتقاق. */
export function deletedOccurrenceIds(ruleId?: string): Set<string> {
  return new Set(
    listOccurrenceOverrides(ruleId)
      .filter((item) => item.state === 'DELETED')
      .map((item) => item.id)
  );
}

/** سجل التغييرات بالأحدث أولا. */
export function listOccurrenceLog(ruleId?: string, limit = 100): OccurrenceLogEntry[] {
  const log = readStore().log;
  const filtered = ruleId ? log.filter((entry) => entry.ruleId === ruleId) : log;
  return [...filtered].sort((first, second) => second.at.localeCompare(first.at)).slice(0, limit);
}

/** إحصاء حالة مواضع قاعدة: كم حُذف وكم روجع. */
export function occurrenceStats(ruleId: string): {
  deleted: number;
  confirmed: number;
  edited: number;
} {
  const overrides = listOccurrenceOverrides(ruleId);
  return {
    deleted: overrides.filter((item) => item.state === 'DELETED').length,
    confirmed: overrides.filter((item) => item.state === 'CONFIRMED').length,
    edited: overrides.filter(
      (item) =>
        item.strengthDegreeId ||
        item.strengthByNarrator ||
        typeof item.orderRank === 'number' ||
        (item.patch !== undefined && Object.keys(item.patch).length > 0)
    ).length,
  };
}

/** هل يحمل هذا الاستثناء أي تجاوز محلي (ترقيع أو درجة أو رتبة)؟ */
export function hasLocalOverride(override: RuleOccurrenceOverride | undefined): boolean {
  if (!override) return false;
  return Boolean(
    override.strengthDegreeId ||
      override.strengthByNarrator ||
      typeof override.orderRank === 'number' ||
      (override.patch !== undefined && Object.keys(override.patch).length > 0)
  );
}

// ==================== الكتابة ====================

/** يحذف تطبيق القاعدة في موضع واحد فقط، ويسجّل ذلك في السجل. */
export function deleteOccurrence(
  ruleId: string,
  match: GlobalRuleMatch,
  reason?: string
): RuleOccurrenceOverride {
  // الحذف لا يمحو التخصيصات: قد يرجع المحقق عن حذفه، فيجد تخصيصه كما تركه.
  const current = findOverride(occurrenceIdFor(ruleId, match));
  const override = upsertOverride({
    ...overrideBaseFrom(ruleId, match),
    strengthDegreeId: current?.strengthDegreeId,
    strengthByNarrator: current?.strengthByNarrator,
    orderRank: current?.orderRank,
    patch: current?.patch,
    state: 'DELETED',
    reason: reason?.trim() || undefined,
  });
  appendLog(override, 'DELETE', reason);
  return override;
}

/** يعيد تطبيق القاعدة في موضع حُذف سابقا. */
export function restoreOccurrence(occurrenceId: string): void {
  const store = readStore();
  const existing = store.overrides.find((item) => item.id === occurrenceId);
  if (!existing) return;

  // لا يُترك سطر بلا فائدة: إن لم يبق فيه تخصيص، حُذف السطر أصلا.
  const stillUseful = hasLocalOverride(existing);
  const next: RuleOccurrenceOverride = {
    ...existing,
    state: 'APPLIED',
    reason: undefined,
    updatedAt: new Date().toISOString(),
  };

  writeStore({
    overrides: stillUseful
      ? store.overrides.map((item) => (item.id === occurrenceId ? next : item))
      : store.overrides.filter((item) => item.id !== occurrenceId),
    log: pushLog(store.log, entryFrom(next, 'RESTORE')),
  });
}

/** يعلّم الموضع بأنه روجع واعتُمد. */
export function confirmOccurrence(ruleId: string, match: GlobalRuleMatch): RuleOccurrenceOverride {
  const current = findOverride(occurrenceIdFor(ruleId, match));
  const override = upsertOverride({
    ...overrideBaseFrom(ruleId, match),
    strengthDegreeId: current?.strengthDegreeId,
    strengthByNarrator: current?.strengthByNarrator,
    orderRank: current?.orderRank,
    patch: current?.patch,
    state: 'CONFIRMED',
  });
  appendLog(override, 'CONFIRM');
  return override;
}

/** يخصّص درجة قوة لموضع واحد دون المساس ببقية المواضع. */
export function setOccurrenceStrength(
  ruleId: string,
  match: GlobalRuleMatch,
  strength: { strengthDegreeId?: string; strengthByNarrator?: ReaderStrengthMap }
): RuleOccurrenceOverride {
  const current = findOverride(occurrenceIdFor(ruleId, match));
  const override = upsertOverride({
    ...overrideBaseFrom(ruleId, match),
    state: current?.state === 'DELETED' ? 'DELETED' : current?.state ?? 'APPLIED',
    reason: current?.reason,
    strengthDegreeId: strength.strengthDegreeId,
    strengthByNarrator: strength.strengthByNarrator,
    orderRank: current?.orderRank,
    patch: current?.patch,
  });
  appendLog(override, 'EDIT');
  return override;
}

/**
 * يثبّت رتبة ترتيب السطر لموضع واحد من مواضع القاعدة.
 *
 * تصحيح موضعي لأخطاء ترتيب المحرك: يُحدَّث الموضع المعني دون إعادة تشغيل
 * المحرك ولا تعديل القاعدة في بقية المصحف.
 */
export function setOccurrenceOrderRank(
  ruleId: string,
  match: GlobalRuleMatch,
  orderRank: number | null
): RuleOccurrenceOverride {
  const current = findOverride(occurrenceIdFor(ruleId, match));
  const base = overrideBaseFrom(ruleId, match);
  const override = upsertOverride({
    ...base,
    state: current?.state ?? 'APPLIED',
    reason: current?.reason,
    strengthDegreeId: current?.strengthDegreeId,
    strengthByNarrator: current?.strengthByNarrator,
    orderRank: orderRank === null ? undefined : Math.max(1, Math.round(orderRank)),
    patch: current?.patch,
  });
  appendLog(
    override,
    'EDIT',
    orderRank === null ? 'إلغاء ترتيب السطر اليدوي للموضع' : `تعديل ترتيب السطر إلى ${orderRank}`
  );
  return override;
}

/**
 * يثبّت ترقيعًا محليًا على موضع واحد (FR-ED-10/T2): دمج لا استبدال،
 * فالحقول غير المذكورة تبقى كما هي (مشتقة أو مرقّعة سابقًا).
 *
 * تمرير `undefined` لحقل يحرّره من التجاوز فيعود مشتقًا من القاعدة الأمّ.
 * الحالة (محذوف/معتمد) لا تتغير بالتحرير.
 */
export function setLocalOverride(
  ruleId: string,
  match: GlobalRuleMatch,
  patch: LocalOverridePatch
): RuleOccurrenceOverride {
  const current = findOverride(occurrenceIdFor(ruleId, match));
  const merged: LocalOverridePatch = { ...(current?.patch ?? {}) };
  for (const [key, value] of Object.entries(patch) as Array<[keyof LocalOverridePatch, unknown]>) {
    if (value === undefined) delete merged[key];
    else (merged as Record<string, unknown>)[key] = value;
  }
  const nextPatch = Object.keys(merged).length > 0 ? merged : undefined;

  const override = upsertOverride({
    ...overrideBaseFrom(ruleId, match),
    state: current?.state ?? 'APPLIED',
    reason: current?.reason,
    strengthDegreeId: current?.strengthDegreeId,
    strengthByNarrator: current?.strengthByNarrator,
    orderRank: current?.orderRank,
    patch: nextPatch,
  });
  appendLogWithChanges(override, 'EDIT', diffPatch(current?.patch, nextPatch), patch.note?.trim() || undefined);
  return override;
}

/**
 * يلغي التجاوز المحلي لموضع (FR-ED-10): يمحو الترقيع وتخصيصات الدرجة
 * والرتبة فيعود الموضع مشتقًا خالصًا من القاعدة الأمّ.
 *
 * الحالة محفوظة: المحذوف يبقى محذوفًا (يُرجع بزر الإرجاع لا هنا)،
 * والمعتمد يبقى معتمدًا — فالإلغاء يخص القيم لا الحالة.
 */
export function clearLocalOverride(occurrenceId: string, note?: string): void {
  const store = readStore();
  const existing = store.overrides.find((item) => item.id === occurrenceId);
  if (!existing || !hasLocalOverride(existing)) return;

  const next: RuleOccurrenceOverride = {
    ...existing,
    strengthDegreeId: undefined,
    strengthByNarrator: undefined,
    orderRank: undefined,
    patch: undefined,
    updatedAt: new Date().toISOString(),
  };
  writeStore({
    overrides: store.overrides.map((item) => (item.id === occurrenceId ? next : item)),
    log: pushLog(
      store.log,
      entryFrom(next, 'EDIT', note?.trim() || 'إلغاء التجاوز المحلي: عودة إلى قيم القاعدة الأمّ', [
        { field: 'التجاوز المحلي', before: 'قيم مخصصة', after: 'قيم القاعدة الأمّ' },
      ])
    ),
  });
}

/** الاستثناء المسجَّل لمعرّف موضع بعينه، إن وُجد. */
export function overrideById(occurrenceId: string): RuleOccurrenceOverride | undefined {
  return findOverride(occurrenceId);
}

/** يزيل كل ما سُجِّل لقاعدة، ويُستدعى عند حذف القاعدة نفسها. */
export function clearRuleOccurrences(ruleId: string): void {
  const store = readStore();
  writeStore({
    overrides: store.overrides.filter((item) => item.ruleId !== ruleId),
    log: store.log.filter((entry) => entry.ruleId !== ruleId),
  });
}

/** يدمج استثناءات مستوردة، مع تقديم الأحدث. */
export function upsertOccurrenceOverrides(
  overrides: RuleOccurrenceOverride[],
  log: OccurrenceLogEntry[] = []
): void {
  if (!Array.isArray(overrides)) return;
  const store = readStore();
  const byId = new Map(store.overrides.map((item) => [item.id, item]));

  for (const candidate of overrides) {
    if (!isValidOverride(candidate)) continue;
    const existing = byId.get(candidate.id);
    if (!existing || candidate.updatedAt >= existing.updatedAt) byId.set(candidate.id, sanitizeOverride(candidate));
  }

  const logById = new Map([...store.log, ...(Array.isArray(log) ? log : [])].map((e) => [e.id, e]));
  writeStore({ overrides: [...byId.values()], log: [...logById.values()] });
}

/** لقطة كاملة للتصدير مع بقية بيانات المشروع. */
export function exportOccurrenceData(): OccurrenceStoreShape {
  return readStore();
}

/** يستعيد لقطة استثناءات سابقة (تراجع/إعادة، FR-ED-10). */
export function restoreOccurrenceData(snapshot: OccurrenceStoreShape): void {
  const overrides = Array.isArray(snapshot?.overrides) ? snapshot.overrides.filter(isValidOverride) : [];
  const log = Array.isArray(snapshot?.log) ? snapshot.log.filter(isValidLogEntry) : [];
  writeStore({ overrides: overrides.map(sanitizeOverride), log });
}

/** التسميات العربية لحقول الترقيع في سجل قبل/بعد. */
export const PATCH_FIELD_LABELS: Record<keyof LocalOverridePatch, string> = {
  title: 'العنوان',
  category: 'النوع',
  description: 'الوصف',
  sourceRef: 'المصدر',
  ruleLabel: 'الحكم',
  maddHarakat: 'المد',
  scope: 'النطاق',
  text: 'النص',
  label: 'التسمية',
  notes: 'الملاحظات',
  note: 'سبب التجاوز',
};

/** يحسب فرق حقل بحقل بين ترقيعين لعرضه قبل/بعد في السجل. */
export function diffPatch(
  before: LocalOverridePatch | undefined,
  after: LocalOverridePatch | undefined
): OccurrenceChange[] {
  const changes: OccurrenceChange[] = [];
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]) as Set<keyof LocalOverridePatch>;
  for (const key of keys) {
    const label = PATCH_FIELD_LABELS[key] ?? key;
    const prev = formatPatchValue((before as Record<string, unknown> | undefined)?.[key]);
    const next = formatPatchValue((after as Record<string, unknown> | undefined)?.[key]);
    if (prev !== next) changes.push({ field: label, before: prev, after: next });
  }
  return changes;
}

function formatPatchValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const scope = value as { kind?: unknown; narratorIds?: unknown; imamIds?: unknown; pathIds?: unknown };
    if (typeof scope.kind === 'string') {
      if (scope.kind === 'ALL') return 'الكل';
      const count = [scope.narratorIds, scope.imamIds, scope.pathIds]
        .filter(Array.isArray)
        .reduce((total, ids) => total + (ids as unknown[]).length, 0);
      return `${scope.kind} (${count})`;
    }
    return 'مخصص';
  }
  return String(value);
}

// ==================== أدوات داخلية ====================

/** الاستثناء المسجَّل لموضع بعينه، إن وُجد. */
function findOverride(occurrenceId: string): RuleOccurrenceOverride | undefined {
  return readStore().overrides.find((item) => item.id === occurrenceId);
}

function overrideBaseFrom(
  ruleId: string,
  match: GlobalRuleMatch
): Omit<RuleOccurrenceOverride, 'state' | 'updatedAt'> {
  return {
    id: occurrenceIdFor(ruleId, match),
    ruleId,
    ayahKey: match.ayahKey ?? 0,
    startPosition: match.startPosition,
    endPosition: match.endPosition,
    characterStart: match.characterRange.start.characterIndex,
    characterEnd: match.characterRange.end.characterIndex,
    matchedText: match.matchedText,
  };
}

function upsertOverride(
  value: Omit<RuleOccurrenceOverride, 'updatedAt'>
): RuleOccurrenceOverride {
  const store = readStore();
  const next: RuleOccurrenceOverride = { ...value, updatedAt: new Date().toISOString() };
  writeStore({
    overrides: [...store.overrides.filter((item) => item.id !== next.id), next],
    log: store.log,
  });
  return next;
}

function appendLog(
  override: RuleOccurrenceOverride,
  action: OccurrenceLogEntry['action'],
  reason?: string
): void {
  appendLogWithChanges(override, action, undefined, reason);
}

function appendLogWithChanges(
  override: RuleOccurrenceOverride,
  action: OccurrenceLogEntry['action'],
  changes: OccurrenceChange[] | undefined,
  reason?: string
): void {
  const store = readStore();
  writeStore({
    overrides: store.overrides,
    log: pushLog(store.log, entryFrom(override, action, reason, changes)),
  });
}

function entryFrom(
  override: RuleOccurrenceOverride,
  action: OccurrenceLogEntry['action'],
  reason?: string,
  changes?: OccurrenceChange[]
): OccurrenceLogEntry {
  return {
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ruleId: override.ruleId,
    occurrenceId: override.id,
    ayahKey: override.ayahKey,
    action,
    reason: reason?.trim() || override.reason,
    matchedText: override.matchedText,
    changes: changes && changes.length > 0 ? changes : undefined,
    at: new Date().toISOString(),
  };
}

function pushLog(log: OccurrenceLogEntry[], entry: OccurrenceLogEntry): OccurrenceLogEntry[] {
  // السجل للمراجعة القريبة لا للأرشفة الأبدية؛ نبقي الأحدث ضمن حد معقول
  // حتى لا يمتلئ التخزين المحلي ويعطّل حفظ المستندات.
  return [...log, entry].slice(-MAX_LOG_ENTRIES);
}

function readStore(): OccurrenceStoreShape {
  if (!isBrowser()) return { overrides: [], log: [] };

  try {
    const raw = window.localStorage.getItem(OCCURRENCES_KEY);
    if (!raw) return { overrides: [], log: [] };
    const parsed = JSON.parse(raw) as Partial<OccurrenceStoreShape>;
    return {
      overrides: Array.isArray(parsed.overrides)
        ? parsed.overrides.filter(isValidOverride).map(sanitizeOverride)
        : [],
      log: Array.isArray(parsed.log) ? parsed.log.filter(isValidLogEntry) : [],
    };
  } catch {
    return { overrides: [], log: [] };
  }
}

/** يطهّر الاستثناء المقروء: يُبقي من الترقيع الحقول المعروفة الصحيحة فقط. */
function sanitizeOverride(item: RuleOccurrenceOverride): RuleOccurrenceOverride {
  if (!item.patch || typeof item.patch !== 'object') return { ...item, patch: undefined };
  const patch = item.patch as Record<string, unknown>;
  const next: LocalOverridePatch = {};
  if (typeof patch.title === 'string' && patch.title.trim()) next.title = patch.title;
  if (typeof patch.category === 'string' && patch.category) next.category = patch.category as VariantCategory;
  if (typeof patch.description === 'string') next.description = patch.description;
  if (typeof patch.sourceRef === 'string') next.sourceRef = patch.sourceRef;
  if (typeof patch.ruleLabel === 'string') next.ruleLabel = patch.ruleLabel;
  if (typeof patch.maddHarakat === 'number' && Number.isFinite(patch.maddHarakat)) {
    next.maddHarakat = patch.maddHarakat;
  }
  if (isValidScopeValue(patch.scope)) next.scope = patch.scope as ReadingScope;
  if (typeof patch.text === 'string' && patch.text) next.text = patch.text;
  if (typeof patch.label === 'string') next.label = patch.label;
  if (typeof patch.notes === 'string') next.notes = patch.notes;
  if (typeof patch.note === 'string') next.note = patch.note;
  return { ...item, patch: Object.keys(next).length > 0 ? next : undefined };
}

function isValidScopeValue(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const scope = value as { kind?: unknown; narratorIds?: unknown; imamIds?: unknown; pathIds?: unknown };
  if (!['ALL', 'ALL_EXCEPT', 'NARRATORS', 'IMAMS', 'PATHS'].includes(scope.kind as string)) return false;
  for (const ids of [scope.narratorIds, scope.imamIds, scope.pathIds]) {
    if (ids !== undefined && (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string'))) {
      return false;
    }
  }
  return true;
}

function writeStore(store: OccurrenceStoreShape): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(OCCURRENCES_KEY, JSON.stringify(store));
  // بيئات الاختبار قد تُبدّل window بكائن مصغّر بلا نظام أحداث؛ الإشعار تحسين لا شرط.
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(RULE_OCCURRENCES_EVENT, { detail: store }));
  }
}

function isValidOverride(value: unknown): value is RuleOccurrenceOverride {
  if (!value || typeof value !== 'object') return false;
  const item = value as RuleOccurrenceOverride;
  return (
    typeof item.id === 'string' &&
    typeof item.ruleId === 'string' &&
    typeof item.ayahKey === 'number' &&
    ['APPLIED', 'DELETED', 'CONFIRMED'].includes(item.state)
  );
}

function isValidLogEntry(value: unknown): value is OccurrenceLogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as OccurrenceLogEntry;
  return typeof entry.id === 'string' && typeof entry.ruleId === 'string' && typeof entry.at === 'string';
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

// مخزن واجهة استوديو المحرك — Engine Studio UI Store
// مشروع التشجير - نظام القراءات العشر
//
// يربط مكونات الاستوديو بطبقة التخزين النقيّة (engine-config-store) وبطبقة
// الحوكمة (rule-governance): نسخة العمل من ملف المحرك، علامة «غير محفوظ»،
// سجل تدقيق الاستوديو، وسلاسل إصدارات القواعد.
//
// القاعدة الحاكمة هنا: **لا طريق ثانٍ للتغيير**. كل تعديل على قاعدة يمرّ
// `rule-governance` فيلتقط إصدارًا ويكتب قيد تدقيق، فلا تستطيع لوحة أن تعدّل
// بلا أثر. وكل قرار يمرّ عبر Decision Resolver الموجود (P-07).

import { create } from 'zustand';

import {
  loadEngineConfig,
  saveEngineConfig,
  resetEngineConfig,
  serializeEngineConfig,
  importEngineConfigText,
  addEngineRule,
  updateEngineRule,
  setRulePriority,
  addMergeMatrixEntry,
  updateMergeMatrixEntry,
  removeMergeMatrixEntry,
  addRelationPolicy,
  updateRelationPolicy,
  removeRelationPolicy,
  setConflictPolicy,
  setExecutionOrder,
  upsertPriorityGroup,
} from '@/lib/tashjeer/engine-config-store';
import {
  captureEngineVersion,
  getEngineVersion,
  listEngineVersions,
  type EngineConfigVersion,
} from '@/lib/tashjeer/engine-config-history';
import {
  DEFAULT_AUDIT_ACTOR,
  listAuditEntries,
  recordAudit,
  replaceAuditTrail,
  type AuditFilter,
  filterAuditEntries,
} from '@/lib/tashjeer/rule-audit';
import {
  allVersionEntries,
  getRuleVersionChain,
  listRuleVersions,
  replaceRuleVersions,
} from '@/lib/tashjeer/rule-versions';
import {
  ensureRuleBaselines,
  governConflictSync,
  governRollback,
  governRuleChange,
  governRuleRemoval,
  governStatusChange,
  recordProfileAction,
  restoreDeletedRule,
  type GovernanceMeta,
} from '@/lib/tashjeer/rule-governance';
import { conflictedRuleReasons } from '@/lib/tashjeer/rule-status-flow';
import { runProfileTests, type ProfileTestReport } from '@/lib/tashjeer/decision/rule-test-runner';
import {
  buildGovernanceBundle,
  detectStudioImport,
  parseGovernanceBundle,
  serializeGovernanceBundle,
} from '@/lib/tashjeer/engine-governance';

type RuleDraft = Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'> & Partial<Pick<EngineRule, 'version'>>;

/** نتيجة عملية محكومة (قد تُرفض لسبب يُعرض للمستخدم). */
export interface GovernedResult {
  ok: boolean;
  error?: string;
}

interface EngineStudioState {
  config: EngineConfig;
  loaded: boolean;
  dirty: boolean;
  selectedRuleId: string | null;
  /** آخر ملف محفوظ فعليا (لحساب أثر التغييرات غير المحفوظة). */
  savedConfig: EngineConfig | null;
  /** سجل الإصدارات على مستوى الملف (الأحدث أولا) — FR-ES-07. */
  versions: EngineConfigVersion[];
  /** سجل تدقيق الاستوديو (الأحدث أولًا) — FR-ES-07.6. */
  audit: StudioAuditEntry[];
  /** سلاسل إصدارات القواعد: معرّف القاعدة ← السلسلة (الأقدم أولًا) — FR-ES-07.3. */
  ruleVersions: Record<string, EngineRuleVersion[]>;
  /** أسباب التعارض غير المحسوم لكل قاعدة (كشف للعرض، لا تعديل صامت). */
  conflicts: Map<string, string[]>;
  /** آخر تقرير لاختبارات القواعد (FR-ES-08). */
  testReport: ProfileTestReport | null;

  hydrate: () => void;
  setSelectedRule: (id: string | null) => void;
  /** يحفظ الملف ويلتقط نسخة في السجل مع ملاحظة اختيارية (ويُسجَّل تدقيقًا). */
  persist: (note?: string) => void;
  applyImported: (config: EngineConfig) => void;
  resetToDefault: () => void;
  /** يعيد نسخة من السجل إلى الملف الحي ويحفظها (تراجع موثّق، غير مدمّر). */
  rollbackTo: (versionId: string) => boolean;
  /** يتجاهل التغييرات غير المحفوظة ويعود لآخر ملف محفوظ. */
  discardChanges: () => void;

  // ==================== القواعد (كلها محكومة) ====================
  /** حفظ قاعدة (إنشاء أو تعديل) مع سبب وتوثيق انحدار إن وُجد. */
  saveRule: (rule: EngineRule | RuleDraft, meta?: GovernanceMeta) => GovernedResult;
  addRule: (rule: RuleDraft, meta?: GovernanceMeta) => GovernedResult;
  updateRule: (ruleId: string, patch: Partial<EngineRule>, meta?: GovernanceMeta) => GovernedResult;
  removeRule: (ruleId: string, meta?: GovernanceMeta) => GovernedResult;
  /** استرجاع قاعدة حُذفت من سلسلة إصداراتها (التاريخ لا يُفقد). */
  restoreRule: (ruleId: string, meta?: GovernanceMeta) => GovernedResult;
  setRulePriorityAction: (ruleId: string, priority: number, meta?: GovernanceMeta) => GovernedResult;
  /** تغيير حالة محكوم: يرفض الانتقال غير المسموح أو الناقص سببًا. */
  setRuleStatusAction: (ruleId: string, status: EngineRule['status'], meta?: GovernanceMeta) => GovernedResult;
  /** وسم الحماية (FR-ES-07.5). */
  setRuleProtected: (ruleId: string, value: boolean, meta?: GovernanceMeta) => GovernedResult;
  /** رجوع موثّق لإصدار أقدم من سلسلة القاعدة (FR-ES-07.3.2). */
  rollbackRule: (ruleId: string, version: number, meta?: GovernanceMeta) => GovernedResult;
  /** كتابة وسم التعارض المكتشف في الملف (تطبيق صريح للكشف التلقائي). */
  syncConflictTags: (meta?: GovernanceMeta) => { tagged: number; cleared: number };

  addMergeEntry: (entry: MergeMatrixEntry) => void;
  updateMergeEntry: (index: number, patch: Partial<MergeMatrixEntry>) => void;
  removeMergeEntry: (index: number) => void;
  addRelationEntry: (entry: RelationPolicyEntry) => void;
  updateRelationEntry: (index: number, patch: Partial<RelationPolicyEntry>) => void;
  removeRelationEntry: (index: number) => void;

  setConflictPolicyAction: (policy: ConflictPolicyStep[]) => void;
  setExecutionOrderAction: (order: string[]) => void;
  upsertGroup: (group: PriorityGroup) => void;

  // ==================== الاختبارات والتصدير ====================
  /** يشغّل اختبارات القواعد ويسجّل التشغيل في التدقيق (FR-ES-08.4). */
  runTests: (meta?: GovernanceMeta) => ProfileTestReport;
  exportText: () => string;
  previewImport: (text: string) => { valid: boolean; errors: string[]; warnings: string[] };
  importText: (text: string) => { valid: boolean; errors: string[]; warnings: string[] };
  /** تصدير حزمة الحوكمة: الإعداد + الإصدارات + التدقيق + ملخّص الاختبارات. */
  exportBundleText: () => string;
  importBundleText: (text: string) => { valid: boolean; errors: string[]; warnings: string[] };

  // ==================== قراءات مشتقة ====================
  chainOf: (ruleId: string) => EngineRuleVersion[];
  auditFiltered: (filter?: AuditFilter) => StudioAuditEntry[];
}

const emptyConfig: EngineConfig = {
  schemaVersion: 1,
  profile: 'default',
  priorityGroups: [],
  rules: [],
  conflictPolicy: [],
  executionOrder: [],
  mergeMatrix: [],
  contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
};

/** يحدّث حالة الحوكمة المشتقة (التدقيق + السلاسل + التعارضات) من التخزين. */
function governanceState(config: EngineConfig) {
  return {
    audit: listAuditEntries(),
    ruleVersions: listRuleVersions(),
    conflicts: conflictedRuleReasons(config),
  };
}

export const useEngineStudioStore = create<EngineStudioState>((set, get) => ({
  config: emptyConfig,
  loaded: false,
  dirty: false,
  selectedRuleId: null,
  savedConfig: null,
  versions: [],
  audit: [],
  ruleVersions: {},
  conflicts: new Map(),
  testReport: null,

  hydrate: () => {
    if (get().loaded) return;
    const config = loadEngineConfig();
    let versions = listEngineVersions();
    // أول تشغيل بعد إضافة السجل: نلتقط الملف الحالي كنسخة أساس حتى يكون
    // للتراجع نقطة انطلاق دائما.
    if (versions.length === 0) {
      const base = captureEngineVersion(config, { source: 'SAVE', note: 'نسخة الأساس' });
      versions = base ? [base] : [];
    }
    // نسخة أساس لكل قاعدة: بلا إصدار أول لا يوجد مرجع للرجوع إليه.
    ensureRuleBaselines(config.rules);
    set({ config, savedConfig: config, versions, loaded: true, dirty: false, ...governanceState(config) });
  },

  setSelectedRule: (id) => set({ selectedRuleId: id }),

  persist: (note) => {
    const { config: saved } = saveEngineConfig(get().config);
    const captured = captureEngineVersion(saved, { source: 'SAVE', note });
    recordProfileAction('PROFILE_PUBLISHED', saved, { reason: note });
    set((state) => ({
      config: saved,
      savedConfig: saved,
      dirty: false,
      versions: captured ? [captured, ...state.versions] : state.versions,
      ...governanceState(saved),
    }));
  },

  applyImported: (config) =>
    set((state) => ({ config, dirty: true, selectedRuleId: null, conflicts: conflictedRuleReasons(config), audit: state.audit })),

  resetToDefault: () => {
    const config = resetEngineConfig();
    const captured = captureEngineVersion(config, { source: 'RESET', note: 'إعادة الضبط إلى سياسات النظام' });
    recordProfileAction('PROFILE_RESET', config, { reason: 'إعادة الضبط إلى سياسات النظام' });
    ensureRuleBaselines(config.rules);
    set((state) => ({
      config,
      savedConfig: config,
      dirty: false,
      selectedRuleId: null,
      versions: captured ? [captured, ...state.versions] : state.versions,
      ...governanceState(config),
    }));
  },

  rollbackTo: (versionId) => {
    const version = getEngineVersion(versionId);
    if (!version) return false;
    const { config: saved } = saveEngineConfig(version.config);
    const captured = captureEngineVersion(saved, {
      source: 'ROLLBACK',
      note: `استرجاع النسخة ${version.seq}`,
      restoredFrom: version.id,
    });
    recordProfileAction('PROFILE_ROLLED_BACK', saved, { reason: `استرجاع النسخة ${version.seq}` });
    // سلاسل قواعد النسخة المسترجعة قد تحمل قواعد عادت إلى الملف: نضمن لها أساسًا.
    ensureRuleBaselines(saved.rules);
    set((state) => ({
      config: saved,
      savedConfig: saved,
      dirty: false,
      selectedRuleId: null,
      versions: captured ? [captured, ...state.versions] : state.versions,
      ...governanceState(saved),
    }));
    return true;
  },

  discardChanges: () => {
    const saved = get().savedConfig ?? loadEngineConfig();
    set({ config: saved, dirty: false, selectedRuleId: null, conflicts: conflictedRuleReasons(saved) });
  },

  // ==================== القواعد ====================

  saveRule: (rule, meta) => {
    const state = get();
    const draft = rule as EngineRule;
    const existing = state.config.rules.find((item) => item.id === draft.id) ?? null;
    if (!existing) {
      // قاعدة جديدة: تُضاف ثم تُحوكم (إصدار أول + تدقيق).
      const withId = addEngineRule(state.config, draft);
      const added = withId.rules[withId.rules.length - 1];
      if (!added) return { ok: false, error: 'تعذّرت إضافة القاعدة' };
      const governed = governRuleChange(withId, null, added, meta);
      set({ config: governed.config, dirty: true, selectedRuleId: added.id, ...governanceState(governed.config) });
      return { ok: true };
    }
    const governed = governRuleChange(state.config, existing, { ...existing, ...draft }, meta);
    if (!governed.changed) return { ok: true }; // حفظ مطابق: لا ضجيج في السجل
    set({ config: governed.config, dirty: true, ...governanceState(governed.config) });
    return { ok: true };
  },

  addRule: (rule, meta) => {
    const state = get();
    const withId = addEngineRule(state.config, rule);
    const added = withId.rules[withId.rules.length - 1];
    if (!added) return { ok: false, error: 'تعذّرت إضافة القاعدة' };
    const governed = governRuleChange(withId, null, added, meta);
    set({ config: governed.config, dirty: true, ...governanceState(governed.config) });
    return { ok: true };
  },

  updateRule: (ruleId, patch, meta) => {
    const state = get();
    const before = state.config.rules.find((rule) => rule.id === ruleId) ?? null;
    if (!before) return { ok: false, error: 'القاعدة غير موجودة' };
    const patched = updateEngineRule(state.config, ruleId, patch);
    const after = patched.rules.find((rule) => rule.id === ruleId);
    if (!after) return { ok: false, error: 'القاعدة غير موجودة بعد التعديل' };
    const governed = governRuleChange(patched, before, after, meta);
    set({ config: governed.config, dirty: true, ...governanceState(governed.config) });
    return { ok: true };
  },

  removeRule: (ruleId, meta) => {
    const state = get();
    const rule = state.config.rules.find((item) => item.id === ruleId);
    if (!rule) return { ok: false, error: 'القاعدة غير موجودة' };
    const removed = governRuleRemoval(state.config, rule, meta);
    set({
      config: removed.config,
      dirty: true,
      selectedRuleId: state.selectedRuleId === ruleId ? null : state.selectedRuleId,
      ...governanceState(removed.config),
    });
    return { ok: true };
  },

  restoreRule: (ruleId, meta) => {
    const state = get();
    const restored = restoreDeletedRule(state.config, ruleId, meta);
    if (!restored) return { ok: false, error: 'لا سلسلة إصدارات محفوظة لهذه القاعدة، أو أنها موجودة أصلًا.' };
    set({ config: restored.config, dirty: true, ...governanceState(restored.config) });
    return { ok: true };
  },

  setRulePriorityAction: (ruleId, priority, meta) => {
    const state = get();
    const before = state.config.rules.find((rule) => rule.id === ruleId) ?? null;
    if (!before) return { ok: false, error: 'القاعدة غير موجودة' };
    const patched = setRulePriority(state.config, ruleId, priority);
    const after = patched.rules.find((rule) => rule.id === ruleId)!;
    const governed = governRuleChange(patched, before, after, meta);
    set({ config: governed.config, dirty: true, ...governanceState(governed.config) });
    return { ok: true };
  },

  setRuleStatusAction: (ruleId, status, meta) => {
    const result = governStatusChange(get().config, ruleId, status, meta);
    if ('error' in result && result.error) return { ok: false, error: result.error };
    set({ config: result.config, dirty: true, ...governanceState(result.config) });
    return { ok: true };
  },

  setRuleProtected: (ruleId, value, meta) => {
    const state = get();
    const before = state.config.rules.find((rule) => rule.id === ruleId) ?? null;
    if (!before) return { ok: false, error: 'القاعدة غير موجودة' };
    const after: EngineRule = { ...before, protected: value };
    const governed = governRuleChange(state.config, before, after, {
      ...meta,
      reason: meta?.reason ?? (value ? 'وسم القاعدة محمية' : 'رفع وسم الحماية'),
    });
    set({ config: governed.config, dirty: true, ...governanceState(governed.config) });
    return { ok: true };
  },

  rollbackRule: (ruleId, version, meta) => {
    const result = governRollback(get().config, ruleId, version, meta);
    if ('error' in result) return { ok: false, error: result.error };
    set({ config: result.config, dirty: true, ...governanceState(result.config) });
    return { ok: true };
  },

  syncConflictTags: (meta) => {
    const { config, result } = governConflictSync(get().config, meta);
    const changed = result.tagged.length + result.cleared.length;
    set({ config, dirty: changed > 0 ? true : get().dirty, ...governanceState(config) });
    return { tagged: result.tagged.length, cleared: result.cleared.length };
  },

  // ==================== مصفوفة الدمج والسياسات ====================

  addMergeEntry: (entry) => set((state) => ({ config: addMergeMatrixEntry(state.config, entry), dirty: true })),
  updateMergeEntry: (index, patch) =>
    set((state) => ({ config: updateMergeMatrixEntry(state.config, index, patch), dirty: true })),
  removeMergeEntry: (index) =>
    set((state) => ({ config: removeMergeMatrixEntry(state.config, index), dirty: true })),
  addRelationEntry: (entry) => set((state) => ({ config: addRelationPolicy(state.config, entry), dirty: true })),
  updateRelationEntry: (index, patch) =>
    set((state) => ({ config: updateRelationPolicy(state.config, index, patch), dirty: true })),
  removeRelationEntry: (index) =>
    set((state) => ({ config: removeRelationPolicy(state.config, index), dirty: true })),

  setConflictPolicyAction: (policy) =>
    set((state) => ({ config: setConflictPolicy(state.config, policy), dirty: true })),
  setExecutionOrderAction: (order) =>
    set((state) => ({ config: setExecutionOrder(state.config, order), dirty: true })),
  upsertGroup: (group) => set((state) => ({ config: upsertPriorityGroup(state.config, group), dirty: true })),

  // ==================== الاختبارات والتصدير ====================

  runTests: (meta) => {
    const report = runProfileTests(get().config);
    recordAudit({
      action: 'TESTS_RUN',
      actor: meta?.actor ?? DEFAULT_AUDIT_ACTOR,
      reason: meta?.reason,
      summary: `تشغيل اختبارات القواعد: ${report.passed}/${report.total} ناجحة، ${report.failed} فاشلة`,
    });
    set({ audit: listAuditEntries(), testReport: report });
    return report;
  },

  exportText: () => serializeEngineConfig(get().config),

  importText: (text) => {
    const kind = detectStudioImport(text);
    if (kind === 'GOVERNANCE') return get().importBundleText(text);
    const { config, validation } = importEngineConfigText(text);
    const currentIds = new Set(get().config.rules.map((rule) => rule.id));
    const collisions = config.rules.filter((rule) => currentIds.has(rule.id)).length;
    const result = collisions > 0
      ? { ...validation, warnings: [...validation.warnings, `تعارض استيراد: ${collisions} معرّف قاعدة سيستبدل نظيره في المسودة الحالية`] }
      : validation;
    if (result.valid) {
      // الاستيراد لا يُنشر تلقائيا: يبقى «غير محفوظ» حتى يمرّ ببوابة النشر.
      recordProfileAction('PROFILE_IMPORTED', config);
      set({ config, dirty: true, selectedRuleId: null, ...governanceState(config) });
    }
    return { valid: result.valid, errors: result.errors, warnings: result.warnings };
  },

  exportBundleText: () => {
    const state = get();
    return serializeGovernanceBundle(
      buildGovernanceBundle(state.config, {
        ruleVersions: allVersionEntries(),
        auditTrail: state.audit,
      })
    );
  },

  importBundleText: (text) => {
    const { bundle, validation } = parseGovernanceBundle(text);
    if (!validation.valid || !bundle) {
      return { valid: false, errors: validation.errors, warnings: validation.warnings };
    }
    // استيراد الحزمة يعيد السجلين معها (round-trip): التدقيق والإصدارات.
    replaceAuditTrail(bundle.auditTrail);
    const chains: Record<string, EngineRuleVersion[]> = {};
    for (const entry of bundle.ruleVersions) {
      const list = chains[entry.ruleId] ?? [];
      list.push(entry);
      chains[entry.ruleId] = list;
    }
    for (const ruleId of Object.keys(chains)) chains[ruleId] = [...chains[ruleId]].sort((a, b) => a.version - b.version);
    replaceRuleVersions(chains);
    recordProfileAction('PROFILE_IMPORTED', bundle.config, { reason: 'استيراد حزمة حوكمة' });
    ensureRuleBaselines(bundle.config.rules);
    set({ config: bundle.config, dirty: true, selectedRuleId: null, ...governanceState(bundle.config) });
    return { valid: true, errors: validation.errors, warnings: validation.warnings };
  },

  chainOf: (ruleId) => get().ruleVersions[ruleId] ?? getRuleVersionChain(ruleId),

  auditFiltered: (filter) => filterAuditEntries(get().audit, filter),
}));

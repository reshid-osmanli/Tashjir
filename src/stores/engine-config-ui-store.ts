// مخزن واجهة استوديو المحرك — Engine Studio UI Store
// مشروع التشجير - نظام القراءات العشر
//
// يربط مكونات الاستوديو بطبقة التخزين النقيّة (engine-config-store). يحمل
// نسخة العمل من ملف المحرك وعلامة «غير محفوظ»، ويعرض إجراءات نقيّة فوقها،
// ثم يحفظ عند الطلب. كل قرار يمرّ عبر Decision Resolver الموجود (P-07) لا
// عبر منطق مكرر في الواجهة.

import { create } from 'zustand';
import type { EngineConfig, EngineRule, MergeMatrixEntry, PriorityGroup, ConflictPolicyStep, RelationPolicyEntry } from '@/lib/tashjeer/model/v8';
import {
  loadEngineConfig,
  saveEngineConfig,
  resetEngineConfig,
  serializeEngineConfig,
  importEngineConfigText,
  addEngineRule,
  updateEngineRule,
  removeEngineRule,
  applyPriorityShift,
  setRuleStatus,
  type RulePriorityShift,
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

type RuleDraft = Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'> & Partial<Pick<EngineRule, 'version'>>;

interface EngineStudioState {
  config: EngineConfig;
  loaded: boolean;
  dirty: boolean;
  selectedRuleId: string | null;
  /** آخر ملف محفوظ فعليا (لحساب أثر التغييرات غير المحفوظة). */
  savedConfig: EngineConfig | null;
  /** سجل الإصدارات (الأحدث أولا) — FR-ES-07. */
  versions: EngineConfigVersion[];

  hydrate: () => void;
  setSelectedRule: (id: string | null) => void;
  /** يحفظ الملف ويلتقط نسخة في السجل مع ملاحظة اختيارية. */
  persist: (note?: string) => void;
  applyImported: (config: EngineConfig) => void;
  resetToDefault: () => void;
  /** يعيد نسخة من السجل إلى الملف الحي ويحفظها (تراجع موثّق، غير مدمّر). */
  rollbackTo: (versionId: string) => boolean;
  /** يتجاهل التغييرات غير المحفوظة ويعود لآخر ملف محفوظ. */
  discardChanges: () => void;

  addRule: (rule: RuleDraft) => void;
  updateRule: (ruleId: string, patch: Partial<EngineRule>) => void;
  removeRule: (ruleId: string) => void;
  /** يثبّت الأولوية ويعيد تقرير الإزاحة (من زُيحت +1 لتفادي التصادم). */
  setRulePriorityAction: (ruleId: string, priority: number) => RulePriorityShift[];
  setRuleStatusAction: (ruleId: string, status: EngineRule['status']) => void;

  addMergeEntry: (entry: MergeMatrixEntry) => void;
  updateMergeEntry: (index: number, patch: Partial<MergeMatrixEntry>) => void;
  removeMergeEntry: (index: number) => void;
  addRelationEntry: (entry: RelationPolicyEntry) => void;
  updateRelationEntry: (index: number, patch: Partial<RelationPolicyEntry>) => void;
  removeRelationEntry: (index: number) => void;

  setConflictPolicyAction: (policy: ConflictPolicyStep[]) => void;
  setExecutionOrderAction: (order: string[]) => void;
  upsertGroup: (group: PriorityGroup) => void;

  exportText: () => string;
  previewImport: (text: string) => { valid: boolean; errors: string[]; warnings: string[] };
  importText: (text: string) => { valid: boolean; errors: string[]; warnings: string[] };
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

export const useEngineStudioStore = create<EngineStudioState>((set, get) => ({
  config: emptyConfig,
  loaded: false,
  dirty: false,
  selectedRuleId: null,
  savedConfig: null,
  versions: [],

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
    set({ config, savedConfig: config, versions, loaded: true, dirty: false });
  },

  setSelectedRule: (id) => set({ selectedRuleId: id }),

  persist: (note) => {
    const { config: saved } = saveEngineConfig(get().config);
    const captured = captureEngineVersion(saved, { source: 'SAVE', note });
    set((state) => ({
      config: saved,
      savedConfig: saved,
      dirty: false,
      versions: captured ? [captured, ...state.versions] : state.versions,
    }));
  },

  applyImported: (config) => set({ config, dirty: true, selectedRuleId: null }),

  resetToDefault: () => {
    const config = resetEngineConfig();
    const captured = captureEngineVersion(config, { source: 'RESET', note: 'إعادة الضبط إلى سياسات النظام' });
    set((state) => ({
      config,
      savedConfig: config,
      dirty: false,
      selectedRuleId: null,
      versions: captured ? [captured, ...state.versions] : state.versions,
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
    set((state) => ({
      config: saved,
      savedConfig: saved,
      dirty: false,
      selectedRuleId: null,
      versions: captured ? [captured, ...state.versions] : state.versions,
    }));
    return true;
  },

  discardChanges: () =>
    set((state) => ({ config: state.savedConfig ?? loadEngineConfig(), dirty: false, selectedRuleId: null })),

  addRule: (rule) => set((state) => ({ config: addEngineRule(state.config, rule), dirty: true })),
  updateRule: (ruleId, patch) =>
    set((state) => ({ config: updateEngineRule(state.config, ruleId, patch), dirty: true })),
  removeRule: (ruleId) =>
    set((state) => ({
      config: removeEngineRule(state.config, ruleId),
      dirty: true,
      selectedRuleId: state.selectedRuleId === ruleId ? null : state.selectedRuleId,
    })),
  setRulePriorityAction: (ruleId, priority) => {
    const { rules, shifts } = applyPriorityShift(get().config.rules, ruleId, priority);
    set((state) => ({ config: { ...state.config, rules }, dirty: true }));
    return shifts;
  },
  setRuleStatusAction: (ruleId, status) =>
    set((state) => ({ config: setRuleStatus(state.config, ruleId, status), dirty: true })),

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

  exportText: () => serializeEngineConfig(get().config),
  previewImport: (text) => {
    const result = importEngineConfigText(text);
    const currentIds = new Set(get().config.rules.map((rule) => rule.id));
    const collisions = result.config.rules.filter((rule) => currentIds.has(rule.id)).length;
    return collisions > 0
      ? { ...result.validation, warnings: [...result.validation.warnings, `تعارض استيراد: ${collisions} معرّف قاعدة سيستبدل نظيره في المسودة الحالية`] }
      : result.validation;
  },
  importText: (text) => {
    const { config, validation } = importEngineConfigText(text);
    const currentIds = new Set(get().config.rules.map((rule) => rule.id));
    const collisions = config.rules.filter((rule) => currentIds.has(rule.id)).length;
    const result = collisions > 0
      ? { ...validation, warnings: [...validation.warnings, `تعارض استيراد: ${collisions} معرّف قاعدة سيستبدل نظيره في المسودة الحالية`] }
      : validation;
    if (result.valid) {
      // الاستيراد لا يُنشر تلقائيا: يبقى «غير محفوظ» حتى يمرّ ببوابة النشر.
      set({ config, dirty: true, selectedRuleId: null });
    }
    return { valid: result.valid, errors: result.errors, warnings: result.warnings };
  },
}));

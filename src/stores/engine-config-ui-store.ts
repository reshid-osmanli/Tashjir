// مخزن واجهة استوديو المحرك — Engine Studio UI Store
// مشروع التشجير - نظام القراءات العشر
//
// يربط مكونات الاستوديو بطبقة التخزين النقيّة (engine-config-store). يحمل
// نسخة العمل من ملف المحرك وعلامة «غير محفوظ»، ويعرض إجراءات نقيّة فوقها،
// ثم يحفظ عند الطلب. كل قرار يمرّ عبر Decision Resolver الموجود (P-07) لا
// عبر منطق مكرر في الواجهة.

import { create } from 'zustand';
import type { EngineConfig, EngineRule, MergeMatrixEntry, PriorityGroup, ConflictPolicyStep } from '@/lib/tashjeer/model/v8';
import {
  loadEngineConfig,
  saveEngineConfig,
  resetEngineConfig,
  serializeEngineConfig,
  importEngineConfigText,
  addEngineRule,
  updateEngineRule,
  removeEngineRule,
  setRulePriority,
  setRuleStatus,
  addMergeMatrixEntry,
  updateMergeMatrixEntry,
  removeMergeMatrixEntry,
  setConflictPolicy,
  setExecutionOrder,
  upsertPriorityGroup,
} from '@/lib/tashjeer/engine-config-store';

type RuleDraft = Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'> & Partial<Pick<EngineRule, 'version'>>;

interface EngineStudioState {
  config: EngineConfig;
  loaded: boolean;
  dirty: boolean;
  selectedRuleId: string | null;

  hydrate: () => void;
  setSelectedRule: (id: string | null) => void;
  persist: () => void;
  applyImported: (config: EngineConfig) => void;
  resetToDefault: () => void;

  addRule: (rule: RuleDraft) => void;
  updateRule: (ruleId: string, patch: Partial<EngineRule>) => void;
  removeRule: (ruleId: string) => void;
  setRulePriorityAction: (ruleId: string, priority: number) => void;
  setRuleStatusAction: (ruleId: string, status: EngineRule['status']) => void;

  addMergeEntry: (entry: MergeMatrixEntry) => void;
  updateMergeEntry: (index: number, patch: Partial<MergeMatrixEntry>) => void;
  removeMergeEntry: (index: number) => void;

  setConflictPolicyAction: (policy: ConflictPolicyStep[]) => void;
  setExecutionOrderAction: (order: string[]) => void;
  upsertGroup: (group: PriorityGroup) => void;

  exportText: () => string;
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

  hydrate: () => {
    if (get().loaded) return;
    set({ config: loadEngineConfig(), loaded: true, dirty: false });
  },

  setSelectedRule: (id) => set({ selectedRuleId: id }),

  persist: () => {
    const { config: saved } = saveEngineConfig(get().config);
    set({ config: saved, dirty: false });
  },

  applyImported: (config) => set({ config, dirty: true, selectedRuleId: null }),

  resetToDefault: () => set({ config: resetEngineConfig(), dirty: false, selectedRuleId: null }),

  addRule: (rule) => set((state) => ({ config: addEngineRule(state.config, rule), dirty: true })),
  updateRule: (ruleId, patch) =>
    set((state) => ({ config: updateEngineRule(state.config, ruleId, patch), dirty: true })),
  removeRule: (ruleId) =>
    set((state) => ({
      config: removeEngineRule(state.config, ruleId),
      dirty: true,
      selectedRuleId: state.selectedRuleId === ruleId ? null : state.selectedRuleId,
    })),
  setRulePriorityAction: (ruleId, priority) =>
    set((state) => ({ config: setRulePriority(state.config, ruleId, priority), dirty: true })),
  setRuleStatusAction: (ruleId, status) =>
    set((state) => ({ config: setRuleStatus(state.config, ruleId, status), dirty: true })),

  addMergeEntry: (entry) => set((state) => ({ config: addMergeMatrixEntry(state.config, entry), dirty: true })),
  updateMergeEntry: (index, patch) =>
    set((state) => ({ config: updateMergeMatrixEntry(state.config, index, patch), dirty: true })),
  removeMergeEntry: (index) =>
    set((state) => ({ config: removeMergeMatrixEntry(state.config, index), dirty: true })),

  setConflictPolicyAction: (policy) =>
    set((state) => ({ config: setConflictPolicy(state.config, policy), dirty: true })),
  setExecutionOrderAction: (order) =>
    set((state) => ({ config: setExecutionOrder(state.config, order), dirty: true })),
  upsertGroup: (group) => set((state) => ({ config: upsertPriorityGroup(state.config, group), dirty: true })),

  exportText: () => serializeEngineConfig(get().config),
  importText: (text) => {
    const { config, validation } = importEngineConfigText(text);
    if (validation.valid) {
      set({ config, dirty: true, selectedRuleId: null });
    }
    return { valid: validation.valid, errors: validation.errors, warnings: validation.warnings };
  },
}));

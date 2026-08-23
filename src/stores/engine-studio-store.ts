// حالة Engine Studio - Engine Studio Store
// مشروع التشجير - نظام القراءات العشر
//
// هذا المخزن يحمل حالة Engine Studio: ملف المحرك النشط، القواعد، السياسات،
// وسجل التغييرات. يدعم التحديد الموحد مع المحرر (FR-ES-15).
//
// المبادئ:
//   - كل قرار قابل للتهيئة موجود هنا فقط (FR-EN-01)
//   - لا يكتب المستخدم شروطا برمجية أبدا (FR-ES-02)
//   - Git-friendly: ترتيب مستقر، معرّفات صريحة (DM-13)

import { create } from 'zustand';
import type {
  EngineConfig,
  EngineRule,
  PriorityGroup,
  MergeMatrixEntry,
  ConflictPolicyStep,
  RuleCondition,
  ConditionGroup,
  RuleAction,
  EngineRuleCategory,
  EngineRuleScope,
  RuleHardness,
  RuleStatus,
  SpecificityLevel,
  TestCase,
  EntityId,
} from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';
import {
  createDefaultEngineConfig,
  DEFAULT_SYSTEM_PROFILE,
  type DecisionContext,
} from '@/lib/tashjeer/decision/policy';

/** بروفايل محرك متاح للمقارنة (FR-ES-11). */
export interface EngineProfile {
  id: string;
  name: string;
  description?: string;
  config: EngineConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** سجل تغيير في Engine Studio (Audit Trail). */
export interface StudioAuditEntry {
  id: EntityId;
  at: string;
  action: string;
  targetType: 'RULE' | 'MATRIX' | 'PRIORITY' | 'CONFIG' | 'PROFILE';
  targetId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

/** قاعدة مرشحة من التصحيحات (FR-ES-12). */
export interface CandidateRule {
  id: EntityId;
  pattern: string;
  count: number;
  suggestedCondition: ConditionGroup;
  suggestedAction: RuleAction;
  reason: string;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

/** حالة التحديد في Engine Studio (يرتبط بالتحديد الموحد FR-ED-02). */
export interface StudioSelection {
  kind: 'RULE' | 'MATRIX_ENTRY' | 'PRIORITY_GROUP' | 'PROFILE' | 'CANDIDATE';
  id: string;
}

interface EngineStudioState {
  // ---------- البروفايلات ----------
  profiles: EngineProfile[];
  activeProfileId: string;

  // ---------- التحديد ----------
  selection: StudioSelection | null;

  // ---------- السجل ----------
  auditLog: StudioAuditEntry[];

  // ---------- القواعد المرشحة ----------
  candidateRules: CandidateRule[];

  // ---------- إجراءات البروفايلات ----------
  createProfile: (name: string, description?: string) => string;
  duplicateProfile: (profileId: string, newName: string) => string;
  deleteProfile: (profileId: string) => void;
  activateProfile: (profileId: string) => void;
  renameProfile: (profileId: string, name: string) => void;

  // ---------- إجراءات القواعد ----------
  createRule: (rule: Omit<EngineRule, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => string;
  updateRule: (ruleId: string, patch: Partial<EngineRule>) => void;
  deleteRule: (ruleId: string) => void;
  duplicateRule: (ruleId: string) => string;
  moveRule: (ruleId: string, direction: 'up' | 'down') => void;
  setRulePriority: (ruleId: string, priority: number) => void;
  setRuleStatus: (ruleId: string, status: RuleStatus) => void;
  addTestCase: (ruleId: string, testCase: TestCase) => void;
  removeTestCase: (ruleId: string, testCaseIndex: number) => void;

  // ---------- إجراءات مصفوفة الدمج ----------
  addMergeMatrixEntry: (entry: MergeMatrixEntry) => void;
  updateMergeMatrixEntry: (index: number, patch: Partial<MergeMatrixEntry>) => void;
  removeMergeMatrixEntry: (index: number) => void;

  // ---------- إجراءات مجموعات الأولوية ----------
  addPriorityGroup: (group: PriorityGroup) => void;
  updatePriorityGroup: (groupId: string, patch: Partial<PriorityGroup>) => void;
  removePriorityGroup: (groupId: string) => void;
  reorderPriorityGroups: (orderedIds: string[]) => void;

  // ---------- إجراءات سياسة التعارض ----------
  setConflictPolicy: (policy: ConflictPolicyStep[]) => void;

  // ---------- إجراءات ترتيب التنفيذ ----------
  setExecutionOrder: (order: string[]) => void;

  // ---------- التحديد ----------
  select: (selection: StudioSelection | null) => void;

  // ---------- التصدير والاستيراد ----------
  exportConfig: () => EngineConfig;
  importConfig: (config: EngineConfig) => void;
  exportProfile: (profileId: string) => EngineConfig;
  importProfile: (profileId: string, config: EngineConfig) => void;

  // ---------- القواعد المرشحة ----------
  addCandidateRule: (candidate: Omit<CandidateRule, 'id' | 'createdAt' | 'status'>) => void;
  approveCandidateRule: (candidateId: string) => void;
  rejectCandidateRule: (candidateId: string) => void;
  createRuleFromCandidate: (candidateId: string) => string | null;

  // ---------- أدوات مساعدة ----------
  getActiveConfig: () => EngineConfig;
  getRule: (ruleId: string) => EngineRule | undefined;
  getRulesByCategory: (category: EngineRuleCategory) => EngineRule[];
  getRulesByStatus: (status: RuleStatus) => EngineRule[];
}

export const useEngineStudioStore = create<EngineStudioState>((set, get) => {
  const defaultProfile: EngineProfile = {
    id: 'profile-default',
    name: 'الافتراضي',
    description: 'السياسات الحالية للنظام',
    config: createDefaultEngineConfig('default'),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    profiles: [defaultProfile],
    activeProfileId: defaultProfile.id,
    selection: null,
    auditLog: [],
    candidateRules: [],

    // ==================== البروفايلات ====================

    createProfile: (name, description) => {
      const id = `profile-${createEntityId('prof')}`;
      const profile: EngineProfile = {
        id,
        name,
        description,
        config: createDefaultEngineConfig(name),
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        profiles: [...state.profiles, profile],
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'إنشاء بروفايل',
            targetType: 'PROFILE',
            targetId: id,
            summary: `إنشاء بروفايل «${name}»`,
          },
        ],
      }));
      return id;
    },

    duplicateProfile: (profileId, newName) => {
      const source = get().profiles.find((p) => p.id === profileId);
      if (!source) return '';
      const id = `profile-${createEntityId('prof')}`;
      const profile: EngineProfile = {
        id,
        name: newName,
        description: `نسخة من ${source.name}`,
        config: JSON.parse(JSON.stringify(source.config)),
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        profiles: [...state.profiles, profile],
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'نسخ بروفايل',
            targetType: 'PROFILE',
            targetId: id,
            summary: `نسخ بروفايل «${source.name}» إلى «${newName}»`,
          },
        ],
      }));
      return id;
    },

    deleteProfile: (profileId) => {
      const profile = get().profiles.find((p) => p.id === profileId);
      if (!profile || profile.isActive) return;
      set((state) => ({
        profiles: state.profiles.filter((p) => p.id !== profileId),
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'حذف بروفايل',
            targetType: 'PROFILE',
            targetId: profileId,
            summary: `حذف بروفايل «${profile.name}»`,
          },
        ],
      }));
    },

    activateProfile: (profileId) => {
      const profile = get().profiles.find((p) => p.id === profileId);
      if (!profile) return;
      set((state) => ({
        profiles: state.profiles.map((p) => ({
          ...p,
          isActive: p.id === profileId,
        })),
        activeProfileId: profileId,
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'تفعيل بروفايل',
            targetType: 'PROFILE',
            targetId: profileId,
            summary: `تفعيل بروفايل «${profile.name}»`,
          },
        ],
      }));
    },

    renameProfile: (profileId, name) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.id === profileId ? { ...p, name, updatedAt: new Date().toISOString() } : p
        ),
      }));
    },

    // ==================== القواعد ====================

    createRule: (rule) => {
      const id = createEntityId('er');
      const newRule: EngineRule = {
        ...rule,
        id,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: {
                  ...p.config,
                  rules: [...p.config.rules, newRule],
                },
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'إنشاء قاعدة',
            targetType: 'RULE',
            targetId: id,
            summary: `إنشاء قاعدة «${rule.name}»`,
            after: newRule,
          },
        ],
      }));
      return id;
    },

    updateRule: (ruleId, patch) => {
      set((state) => {
        const activeProfile = state.profiles.find((p) => p.isActive);
        const rule = activeProfile?.config.rules.find((r) => r.id === ruleId);
        return {
          profiles: state.profiles.map((p) =>
            p.isActive
              ? {
                  ...p,
                  config: {
                    ...p.config,
                    rules: p.config.rules.map((r) =>
                      r.id === ruleId
                        ? { ...r, ...patch, version: r.version + 1, updatedAt: new Date().toISOString() }
                        : r
                    ),
                  },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
          auditLog: [
            ...state.auditLog,
            {
              id: createEntityId('audit'),
              at: new Date().toISOString(),
              action: 'تعديل قاعدة',
              targetType: 'RULE',
              targetId: ruleId,
              summary: `تعديل قاعدة «${rule?.name ?? ruleId}»: ${Object.keys(patch).join('، ')}`,
              before: rule,
              after: { ...rule, ...patch },
            },
          ],
        };
      });
    },

    deleteRule: (ruleId) => {
      set((state) => {
        const activeProfile = state.profiles.find((p) => p.isActive);
        const rule = activeProfile?.config.rules.find((r) => r.id === ruleId);
        return {
          profiles: state.profiles.map((p) =>
            p.isActive
              ? {
                  ...p,
                  config: {
                    ...p.config,
                    rules: p.config.rules.filter((r) => r.id !== ruleId),
                  },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
          auditLog: [
            ...state.auditLog,
            {
              id: createEntityId('audit'),
              at: new Date().toISOString(),
              action: 'حذف قاعدة',
              targetType: 'RULE',
              targetId: ruleId,
              summary: `حذف قاعدة «${rule?.name ?? ruleId}»`,
              before: rule,
            },
          ],
        };
      });
    },

    duplicateRule: (ruleId) => {
      const activeProfile = get().profiles.find((p) => p.isActive);
      const rule = activeProfile?.config.rules.find((r) => r.id === ruleId);
      if (!rule) return '';
      const id = createEntityId('er');
      const newRule: EngineRule = {
        ...rule,
        id,
        name: `${rule.name} — نسخة`,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: {
                  ...p.config,
                  rules: [...p.config.rules, newRule],
                },
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'نسخ قاعدة',
            targetType: 'RULE',
            targetId: id,
            summary: `نسخ قاعدة «${rule.name}»`,
          },
        ],
      }));
      return id;
    },

    moveRule: (ruleId, direction) => {
      set((state) => ({
        profiles: state.profiles.map((p) => {
          if (!p.isActive) return p;
          const rules = [...p.config.rules];
          const index = rules.findIndex((r) => r.id === ruleId);
          if (index === -1) return p;
          const targetIndex = direction === 'up' ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= rules.length) return p;
          [rules[index], rules[targetIndex]] = [rules[targetIndex], rules[index]];
          return {
            ...p,
            config: { ...p.config, rules },
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },

    setRulePriority: (ruleId, priority) => {
      get().updateRule(ruleId, { priority });
    },

    setRuleStatus: (ruleId, status) => {
      get().updateRule(ruleId, { status });
    },

    addTestCase: (ruleId, testCase) => {
      const rule = get().getRule(ruleId);
      if (!rule) return;
      get().updateRule(ruleId, {
        testCases: [...(rule.testCases ?? []), testCase],
      });
    },

    removeTestCase: (ruleId, testCaseIndex) => {
      const rule = get().getRule(ruleId);
      if (!rule) return;
      get().updateRule(ruleId, {
        testCases: (rule.testCases ?? []).filter((_, i) => i !== testCaseIndex),
      });
    },

    // ==================== مصفوفة الدمج ====================

    addMergeMatrixEntry: (entry) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: {
                  ...p.config,
                  mergeMatrix: [...p.config.mergeMatrix, entry],
                },
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'إضافة صف مصفوفة الدمج',
            targetType: 'MATRIX',
            targetId: `${entry.a}-${entry.b}`,
            summary: `إضافة قاعدة دمج: ${entry.a} ↔ ${entry.b}`,
            after: entry,
          },
        ],
      }));
    },

    updateMergeMatrixEntry: (index, patch) => {
      set((state) => ({
        profiles: state.profiles.map((p) => {
          if (!p.isActive) return p;
          const matrix = [...p.config.mergeMatrix];
          if (index < 0 || index >= matrix.length) return p;
          matrix[index] = { ...matrix[index], ...patch };
          return {
            ...p,
            config: { ...p.config, mergeMatrix: matrix },
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },

    removeMergeMatrixEntry: (index) => {
      set((state) => {
        const activeProfile = state.profiles.find((p) => p.isActive);
        const entry = activeProfile?.config.mergeMatrix[index];
        return {
          profiles: state.profiles.map((p) => {
            if (!p.isActive) return p;
            return {
              ...p,
              config: {
                ...p.config,
                mergeMatrix: p.config.mergeMatrix.filter((_, i) => i !== index),
              },
              updatedAt: new Date().toISOString(),
            };
          }),
          auditLog: [
            ...state.auditLog,
            {
              id: createEntityId('audit'),
              at: new Date().toISOString(),
              action: 'حذف صف مصفوفة الدمج',
              targetType: 'MATRIX',
              targetId: entry ? `${entry.a}-${entry.b}` : String(index),
              summary: `حذف قاعدة دمج: ${entry?.a ?? '?'} ↔ ${entry?.b ?? '?'}`,
              before: entry,
            },
          ],
        };
      });
    },

    // ==================== مجموعات الأولوية ====================

    addPriorityGroup: (group) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: {
                  ...p.config,
                  priorityGroups: [...p.config.priorityGroups, group],
                },
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      }));
    },

    updatePriorityGroup: (groupId, patch) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: {
                  ...p.config,
                  priorityGroups: p.config.priorityGroups.map((g) =>
                    g.id === groupId ? { ...g, ...patch } : g
                  ),
                },
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      }));
    },

    removePriorityGroup: (groupId) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: {
                  ...p.config,
                  priorityGroups: p.config.priorityGroups.filter((g) => g.id !== groupId),
                },
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      }));
    },

    reorderPriorityGroups: (orderedIds) => {
      set((state) => ({
        profiles: state.profiles.map((p) => {
          if (!p.isActive) return p;
          const groups = orderedIds
            .map((id, index) => {
              const group = p.config.priorityGroups.find((g) => g.id === id);
              return group ? { ...group, order: (index + 1) * 10 } : null;
            })
            .filter((g): g is PriorityGroup => g !== null);
          return {
            ...p,
            config: { ...p.config, priorityGroups: groups },
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },

    // ==================== سياسة التعارض ====================

    setConflictPolicy: (policy) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: { ...p.config, conflictPolicy: policy },
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'تعديل سياسة التعارض',
            targetType: 'CONFIG',
            targetId: 'conflictPolicy',
            summary: `تعديل سلم حل التعارض إلى: ${policy.join(' ← ')}`,
          },
        ],
      }));
    },

    // ==================== ترتيب التنفيذ ====================

    setExecutionOrder: (order) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: { ...p.config, executionOrder: order },
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      }));
    },

    // ==================== التحديد ====================

    select: (selection) => set({ selection }),

    // ==================== التصدير والاستيراد ====================

    exportConfig: () => {
      const activeProfile = get().profiles.find((p) => p.isActive);
      return activeProfile?.config ?? DEFAULT_SYSTEM_PROFILE;
    },

    importConfig: (config) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.isActive
            ? {
                ...p,
                config: JSON.parse(JSON.stringify(config)),
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
        auditLog: [
          ...state.auditLog,
          {
            id: createEntityId('audit'),
            at: new Date().toISOString(),
            action: 'استيراد إعداد المحرك',
            targetType: 'CONFIG',
            targetId: 'import',
            summary: `استيراد إعداد محرك (${config.rules.length} قاعدة)`,
          },
        ],
      }));
    },

    exportProfile: (profileId) => {
      const profile = get().profiles.find((p) => p.id === profileId);
      return profile?.config ?? DEFAULT_SYSTEM_PROFILE;
    },

    importProfile: (profileId, config) => {
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.id === profileId
            ? {
                ...p,
                config: JSON.parse(JSON.stringify(config)),
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      }));
    },

    // ==================== القواعد المرشحة ====================

    addCandidateRule: (candidate) => {
      const id = createEntityId('cand');
      set((state) => ({
        candidateRules: [
          ...state.candidateRules,
          {
            ...candidate,
            id,
            createdAt: new Date().toISOString(),
            status: 'PENDING',
          },
        ],
      }));
    },

    approveCandidateRule: (candidateId) => {
      set((state) => ({
        candidateRules: state.candidateRules.map((c) =>
          c.id === candidateId ? { ...c, status: 'APPROVED' as const } : c
        ),
      }));
    },

    rejectCandidateRule: (candidateId) => {
      set((state) => ({
        candidateRules: state.candidateRules.map((c) =>
          c.id === candidateId ? { ...c, status: 'REJECTED' as const } : c
        ),
      }));
    },

    createRuleFromCandidate: (candidateId) => {
      const candidate = get().candidateRules.find((c) => c.id === candidateId);
      if (!candidate) return null;
      const ruleId = get().createRule({
        name: `قاعدة من نمط: ${candidate.pattern}`,
        type: 'MERGE',
        category: 'MERGE',
        scope: 'MUSHAF',
        conditions: candidate.suggestedCondition,
        actions: [candidate.suggestedAction],
        priority: 80,
        groupId: 'merge',
        specificity: 'MUSHFAF',
        hardness: 'SOFT',
        status: 'DRAFT',
      });
      get().approveCandidateRule(candidateId);
      return ruleId;
    },

    // ==================== أدوات مساعدة ====================

    getActiveConfig: () => {
      const activeProfile = get().profiles.find((p) => p.isActive);
      return activeProfile?.config ?? DEFAULT_SYSTEM_PROFILE;
    },

    getRule: (ruleId) => {
      const config = get().getActiveConfig();
      return config.rules.find((r) => r.id === ruleId);
    },

    getRulesByCategory: (category) => {
      const config = get().getActiveConfig();
      return config.rules.filter((r) => r.category === category);
    },

    getRulesByStatus: (status) => {
      const config = get().getActiveConfig();
      return config.rules.filter((r) => r.status === status);
    },
  };
});

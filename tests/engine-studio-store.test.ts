// اختبارات Engine Studio Store
// FR-ES-01..16, FR-EN-01..04

import { describe, it, expect, beforeEach } from 'vitest';
import { useEngineStudioStore } from '@/stores/engine-studio-store';

describe('Engine Studio Store', () => {
  beforeEach(() => {
    // إعادة تعيين المخزن قبل كل اختبار.
    useEngineStudioStore.setState({
      profiles: [
        {
          id: 'profile-default',
          name: 'الافتراضي',
          config: {
            schemaVersion: 1,
            profile: 'default',
            priorityGroups: [
              { id: 'structural', label: 'قواعد بنائية', order: 10 },
              { id: 'blocking', label: 'قواعد منع', order: 20 },
              { id: 'merge', label: 'قواعد الدمج', order: 80 },
            ],
            rules: [
              {
                id: 'er-system-merge-farsh-madd',
                name: 'لا تدمج الفرش مع المد',
                type: 'MERGE' as const,
                category: 'MERGE' as const,
                scope: 'MUSHAF' as const,
                conditions: { all: [] },
                actions: [{ type: 'PREVENT_MERGE' as const }],
                priority: 100,
                groupId: 'merge',
                specificity: 'MUSHFAF' as const,
                hardness: 'HARD' as const,
                status: 'ACTIVE' as const,
                version: 1,
                createdAt: 'system',
                updatedAt: 'system',
              },
            ],
            conflictPolicy: ['MOST_SPECIFIC' as const, 'HIGHEST_PRIORITY' as const],
            executionOrder: ['NORMALIZE', 'CONTEXT', 'BLOCKING', 'MERGE', 'ORDERING'],
            mergeMatrix: [
              { a: 'MADD', b: 'TAHQIQ', merge: true, priority: 80, reason: 'مرتبطان' },
              { a: 'FARSH', b: 'MADD', merge: false, priority: 100, reason: 'مستقلان' },
            ],
            contexts: { waqf: [], wasl: [], ibtida: [], forbiddenConnection: [] },
          },
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      activeProfileId: 'profile-default',
      selection: null,
      auditLog: [],
      candidateRules: [],
    });
  });

  // ==================== البروفايلات ====================

  describe('Profiles', () => {
    it('ينشئ بروفايلا جديدا', () => {
      const id = useEngineStudioStore.getState().createProfile('تجريبي', 'للاختبار');
      expect(id).toBeTruthy();
      const state = useEngineStudioStore.getState();
      expect(state.profiles.length).toBe(2);
      const newProfile = state.profiles.find((p) => p.id === id);
      expect(newProfile?.name).toBe('تجريبي');
      expect(newProfile?.isActive).toBe(false);
    });

    it('ينسخ بروفايلا', () => {
      const id = useEngineStudioStore.getState().duplicateProfile('profile-default', 'نسخة');
      expect(id).toBeTruthy();
      const state = useEngineStudioStore.getState();
      expect(state.profiles.length).toBe(2);
      const copy = state.profiles.find((p) => p.id === id);
      expect(copy?.config.rules.length).toBe(1);
    });

    it('يفعّل بروفايلا', () => {
      const id = useEngineStudioStore.getState().createProfile('جديد');
      useEngineStudioStore.getState().activateProfile(id);
      const state = useEngineStudioStore.getState();
      expect(state.activeProfileId).toBe(id);
      expect(state.profiles.find((p) => p.id === id)?.isActive).toBe(true);
      expect(state.profiles.find((p) => p.id === 'profile-default')?.isActive).toBe(false);
    });

    it('لا يحذف البروفايل النشط', () => {
      useEngineStudioStore.getState().deleteProfile('profile-default');
      const state = useEngineStudioStore.getState();
      expect(state.profiles.length).toBe(1); // لم يُحذف
    });
  });

  // ==================== القواعد ====================

  describe('Rules', () => {
    it('ينشئ قاعدة جديدة', () => {
      const id = useEngineStudioStore.getState().createRule({
        name: 'قاعدة اختبار',
        type: 'DIFFERENCE',
        category: 'DIFFERENCE',
        scope: 'WORD',
        conditions: { all: [{ field: 'readerId', op: 'equals', value: 'QALUN' }] },
        actions: [{ type: 'CREATE_DIFFERENCE' }],
        priority: 50,
        groupId: 'difference',
        specificity: 'WORD',
        hardness: 'SOFT',
        status: 'DRAFT',
      });
      expect(id).toBeTruthy();
      const state = useEngineStudioStore.getState();
      expect(state.getActiveConfig().rules.length).toBe(2);
      const rule = state.getRule(id);
      expect(rule?.name).toBe('قاعدة اختبار');
      expect(rule?.version).toBe(1);
    });

    it('يعدّل قاعدة ويزيد إصدارها', () => {
      useEngineStudioStore.getState().updateRule('er-system-merge-farsh-madd', { priority: 120 });
      const rule = useEngineStudioStore.getState().getRule('er-system-merge-farsh-madd');
      expect(rule?.priority).toBe(120);
      expect(rule?.version).toBe(2);
    });

    it('يحذف قاعدة', () => {
      useEngineStudioStore.getState().deleteRule('er-system-merge-farsh-madd');
      expect(useEngineStudioStore.getState().getActiveConfig().rules.length).toBe(0);
    });

    it('ينسخ قاعدة', () => {
      const id = useEngineStudioStore.getState().duplicateRule('er-system-merge-farsh-madd');
      expect(id).toBeTruthy();
      const state = useEngineStudioStore.getState();
      expect(state.getActiveConfig().rules.length).toBe(2);
      const copy = state.getRule(id);
      expect(copy?.name).toContain('نسخة');
    });

    it('يرشّح القواعد حسب الفئة', () => {
      const mergeRules = useEngineStudioStore.getState().getRulesByCategory('MERGE');
      expect(mergeRules.length).toBe(1);
      expect(mergeRules[0].name).toBe('لا تدمج الفرش مع المد');
    });

    it('يرشّح القواعد حسب الحالة', () => {
      const active = useEngineStudioStore.getState().getRulesByStatus('ACTIVE');
      expect(active.length).toBe(1);
    });
  });

  // ==================== مصفوفة الدمج ====================

  describe('Merge Matrix', () => {
    it('يضيف صفا جديدا', () => {
      useEngineStudioStore.getState().addMergeMatrixEntry({
        a: 'HAMZ',
        b: 'MADD',
        merge: true,
        priority: 75,
        reason: 'مرتبطان',
      });
      expect(useEngineStudioStore.getState().getActiveConfig().mergeMatrix.length).toBe(3);
    });

    it('يعدّل صفا موجودا', () => {
      useEngineStudioStore.getState().updateMergeMatrixEntry(0, { merge: false });
      expect(useEngineStudioStore.getState().getActiveConfig().mergeMatrix[0].merge).toBe(false);
    });

    it('يحذف صفا', () => {
      useEngineStudioStore.getState().removeMergeMatrixEntry(0);
      expect(useEngineStudioStore.getState().getActiveConfig().mergeMatrix.length).toBe(1);
    });
  });

  // ==================== سياسة التعارض ====================

  describe('Conflict Policy', () => {
    it('يعدّل سلم حل التعارض', () => {
      useEngineStudioStore.getState().setConflictPolicy(['HIGHEST_PRIORITY', 'MANUAL']);
      expect(useEngineStudioStore.getState().getActiveConfig().conflictPolicy).toEqual(['HIGHEST_PRIORITY', 'MANUAL']);
    });
  });

  // ==================== التصدير والاستيراد ====================

  describe('Export/Import', () => {
    it('يصدّر إعداد المحرك', () => {
      const config = useEngineStudioStore.getState().exportConfig();
      expect(config.schemaVersion).toBe(1);
      expect(config.rules.length).toBe(1);
      expect(config.mergeMatrix.length).toBe(2);
    });

    it('يستورد إعداد محرك', () => {
      const config = useEngineStudioStore.getState().exportConfig();
      config.rules.push({
        id: 'er-imported',
        name: 'قاعدة مستوردة',
        type: 'ORDERING',
        category: 'ORDERING',
        scope: 'AYAH',
        conditions: { all: [] },
        actions: [],
        priority: 60,
        groupId: 'ordering',
        specificity: 'AYAH',
        hardness: 'SOFT',
        status: 'ACTIVE',
        version: 1,
        createdAt: 'import',
        updatedAt: 'import',
      });
      useEngineStudioStore.getState().importConfig(config);
      expect(useEngineStudioStore.getState().getActiveConfig().rules.length).toBe(2);
    });
  });

  // ==================== القواعد المرشحة ====================

  describe('Candidate Rules', () => {
    it('يضيف قاعدة مرشحة', () => {
      useEngineStudioStore.getState().addCandidateRule({
        pattern: 'القارئ X + سياق WAQF + نوع Y',
        count: 23,
        suggestedCondition: {
          all: [
            { field: 'context', op: 'equals', value: 'WAQF_ONLY' },
          ],
        },
        suggestedAction: { type: 'PREVENT_MERGE' },
        reason: 'نمط تصحيح متكرر',
      });
      const state = useEngineStudioStore.getState();
      expect(state.candidateRules.length).toBe(1);
      expect(state.candidateRules[0].status).toBe('PENDING');
    });

    it('ينشئ قاعدة من مرشحة', () => {
      useEngineStudioStore.getState().addCandidateRule({
        pattern: 'نمط اختبار',
        count: 5,
        suggestedCondition: { all: [{ field: 'differenceType', op: 'equals', value: 'FARSH' }] },
        suggestedAction: { type: 'PREVENT_MERGE' },
        reason: 'اختبار',
      });
      const candidateId = useEngineStudioStore.getState().candidateRules[0].id;
      const ruleId = useEngineStudioStore.getState().createRuleFromCandidate(candidateId);
      const state = useEngineStudioStore.getState();
      expect(ruleId).toBeTruthy();
      expect(state.getActiveConfig().rules.length).toBe(2);
      expect(state.candidateRules[0].status).toBe('APPROVED');
    });

    it('يرفض قاعدة مرشحة', () => {
      useEngineStudioStore.getState().addCandidateRule({
        pattern: 'نمط مرفوض',
        count: 3,
        suggestedCondition: { all: [] },
        suggestedAction: { type: 'MERGE' },
        reason: 'غير مهم',
      });
      const candidateId = useEngineStudioStore.getState().candidateRules[0].id;
      useEngineStudioStore.getState().rejectCandidateRule(candidateId);
      const state = useEngineStudioStore.getState();
      expect(state.candidateRules[0].status).toBe('REJECTED');
    });
  });

  // ==================== السجل ====================

  describe('Audit Trail', () => {
    it('يسجّل إنشاء قاعدة', () => {
      useEngineStudioStore.getState().createRule({
        name: 'قاعدة مسجلة',
        type: 'MERGE',
        category: 'MERGE',
        scope: 'MUSHAF',
        conditions: { all: [] },
        actions: [],
        priority: 50,
        groupId: 'merge',
        specificity: 'MUSHFAF',
        hardness: 'SOFT',
        status: 'DRAFT',
      });
      const state = useEngineStudioStore.getState();
      expect(state.auditLog.length).toBeGreaterThan(0);
      const lastEntry = state.auditLog[state.auditLog.length - 1];
      expect(lastEntry.action).toBe('إنشاء قاعدة');
    });

    it('يسجّل تعديل قاعدة', () => {
      useEngineStudioStore.getState().updateRule('er-system-merge-farsh-madd', { priority: 150 });
      const state = useEngineStudioStore.getState();
      expect(state.auditLog.length).toBeGreaterThan(0);
      const lastEntry = state.auditLog[state.auditLog.length - 1];
      expect(lastEntry.action).toBe('تعديل قاعدة');
      expect(lastEntry.before).toBeTruthy();
      expect(lastEntry.after).toBeTruthy();
    });
  });
});

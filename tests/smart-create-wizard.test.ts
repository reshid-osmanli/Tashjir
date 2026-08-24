// اختبارات المعالج الذكي - Smart Create Wizard Tests
// FR-ED-08، FR-ED-09

import { describe, it, expect } from 'vitest';
import {
  createInitialWizardState,
  canGoNext,
  canGoBack,
  goNext,
  goBack,
  addComponent,
  removeComponent,
  toggleTarget,
  addRelation,
  removeRelation,
  executeWizard,
  buildWizardSummary,
} from '@/lib/tashjeer/smart-create';

describe('Smart Create Wizard (FR-ED-08/09)', () => {
  describe('Navigation', () => {
    it('يبدأ من الخطوة 1', () => {
      const state = createInitialWizardState();
      expect(state.currentStep).toBe(1);
    });

    it('لا يتقدم بدون تحديد', () => {
      const state = createInitialWizardState();
      expect(canGoNext(state)).toBe(false);
    });

    it('يتقدم عند وجود تحديد', () => {
      const state = {
        ...createInitialWizardState(),
        selection: { positions: [3] },
      };
      expect(canGoNext(state)).toBe(true);
    });

    it('ينتقل من خطوة 1 إلى 2', () => {
      const state = {
        ...createInitialWizardState(),
        selection: { positions: [3] },
      };
      const next = goNext(state);
      expect(next.currentStep).toBe(2);
    });

    it('يعود من خطوة 2 إلى 1', () => {
      const state = {
        ...createInitialWizardState(),
        currentStep: 2 as const,
        selection: { positions: [3] },
      };
      const prev = goBack(state);
      expect(prev.currentStep).toBe(1);
    });

    it('لا يعود من الخطوة 1', () => {
      const state = createInitialWizardState();
      expect(canGoBack(state)).toBe(false);
    });
  });

  describe('Components', () => {
    it('يضيف مكونًا جديدًا', () => {
      const state = createInitialWizardState();
      const next = addComponent(state, {
        category: 'MADUD',
        title: 'مد طبيعي',
        rank: 1,
        variants: [
          { id: 'v1', label: 'وجه 1', text: 'مد', rank: 1 },
        ],
      });
      expect(next.components.length).toBe(1);
      expect(next.components[0].title).toBe('مد طبيعي');
      expect(next.components[0].id).toBeTruthy();
    });

    it('يضيف هدفًا تلقائيًا مع المكون', () => {
      const state = createInitialWizardState();
      const next = addComponent(state, {
        category: 'MADUD',
        title: 'مد',
        rank: 1,
        variants: [],
      });
      expect(next.targets.length).toBe(1);
      expect(next.targets[0].selected).toBe(true);
    });

    it('يزيل مكونًا وأهدافه وعلاقاته', () => {
      let state = createInitialWizardState();
      state = addComponent(state, {
        category: 'MADUD',
        title: 'مد',
        rank: 1,
        variants: [],
      });
      const compId = state.components[0].id;
      state = addComponent(state, {
        category: 'FARSH',
        title: 'فرش',
        rank: 2,
        variants: [],
      });
      state = addRelation(state, {
        fromComponentId: compId,
        toComponentId: state.components[1].id,
        type: 'RELATED',
      });

      const next = removeComponent(state, compId);
      expect(next.components.length).toBe(1);
      expect(next.targets.length).toBe(1);
      expect(next.relations.length).toBe(0);
    });
  });

  describe('Targets', () => {
    it('يبدّل تحديد الهدف', () => {
      let state = createInitialWizardState();
      state = addComponent(state, {
        category: 'MADUD',
        title: 'مد',
        rank: 1,
        variants: [],
      });
      const compId = state.components[0].id;
      expect(state.targets[0].selected).toBe(true);

      const next = toggleTarget(state, compId);
      expect(next.targets[0].selected).toBe(false);

      const next2 = toggleTarget(next, compId);
      expect(next2.targets[0].selected).toBe(true);
    });
  });

  describe('Relations', () => {
    it('يضيف علاقة', () => {
      let state = createInitialWizardState();
      state = addComponent(state, { category: 'MADUD', title: 'مد', rank: 1, variants: [] });
      state = addComponent(state, { category: 'FARSH', title: 'فرش', rank: 2, variants: [] });

      const next = addRelation(state, {
        fromComponentId: state.components[0].id,
        toComponentId: state.components[1].id,
        type: 'RELATED',
      });
      expect(next.relations.length).toBe(1);
      expect(next.relations[0].type).toBe('RELATED');
    });

    it('يزيل علاقة', () => {
      let state = createInitialWizardState();
      state = addComponent(state, { category: 'MADUD', title: 'مد', rank: 1, variants: [] });
      state = addComponent(state, { category: 'FARSH', title: 'فرش', rank: 2, variants: [] });
      state = addRelation(state, {
        fromComponentId: state.components[0].id,
        toComponentId: state.components[1].id,
        type: 'RELATED',
      });
      expect(state.relations.length).toBe(1);

      const next = removeRelation(state, 0);
      expect(next.relations.length).toBe(0);
    });
  });

  describe('Execution', () => {
    it('ينشئ اختلافات من المعالج', () => {
      let state = createInitialWizardState();
      state = {
        ...state,
        selection: { positions: [3], range: { start: 3, end: 3 } },
      };
      state = addComponent(state, {
        category: 'MADUD',
        title: 'مد طبيعي',
        rank: 1,
        variants: [
          { id: 'v1', label: 'وجه 1', text: 'بالألف', rank: 1 },
          { id: 'v2', label: 'وجه 2', text: 'بالواو', rank: 2 },
        ],
      });

      const result = executeWizard(state);
      expect(result.variants.length).toBe(1);
      expect(result.variants[0].title).toBe('مد طبيعي');
      expect(result.variants[0].category).toBe('MADUD');
      expect(result.variants[0].alternatives.length).toBe(3); // base + 2 faces
      expect(result.batchId).toBeTruthy();
    });

    it('ينشئ عدة اختلافات مستقلة', () => {
      let state = createInitialWizardState();
      state = {
        ...state,
        selection: { positions: [3], range: { start: 3, end: 3 } },
      };
      state = addComponent(state, {
        category: 'MADUD',
        title: 'مد',
        rank: 1,
        variants: [{ id: 'v1', label: 'وجه 1', text: 'مد', rank: 1 }],
      });
      state = addComponent(state, {
        category: 'FARSH',
        title: 'فرش',
        rank: 2,
        variants: [{ id: 'v2', label: 'وجه 1', text: 'فرش', rank: 1 }],
      });

      const result = executeWizard(state);
      expect(result.variants.length).toBe(2);
      expect(result.variants[0].id).not.toBe(result.variants[1].id);
    });

    it('ينشئ علاقات بين الاختلافات', () => {
      let state = createInitialWizardState();
      state = {
        ...state,
        selection: { positions: [3], range: { start: 3, end: 3 } },
      };
      state = addComponent(state, {
        category: 'MADUD',
        title: 'مد',
        rank: 1,
        variants: [{ id: 'v1', label: 'وجه', text: 'مد', rank: 1 }],
      });
      state = addComponent(state, {
        category: 'FARSH',
        title: 'فرش',
        rank: 2,
        variants: [{ id: 'v2', label: 'وجه', text: 'فرش', rank: 1 }],
      });
      state = addRelation(state, {
        fromComponentId: state.components[0].id,
        toComponentId: state.components[1].id,
        type: 'RELATED',
      });

      const result = executeWizard(state);
      expect(result.relations.length).toBe(1);
      expect(result.relations[0].type).toBe('RELATED');
    });

    it('يضبط سياق الوقف/الوصل', () => {
      let state = createInitialWizardState();
      state = {
        ...state,
        selection: { positions: [3], range: { start: 3, end: 3 } },
        context: { context: 'WAQF_ONLY' },
      };
      state = addComponent(state, {
        category: 'WAQF',
        title: 'وقف',
        rank: 1,
        variants: [{ id: 'v1', label: 'وجه', text: 'وقف', rank: 1 }],
      });

      const result = executeWizard(state);
      expect(result.variants[0].recitationMode).toBe('WAQF_ONLY');
    });

    it('يعيد نطاق التعميم', () => {
      let state = createInitialWizardState();
      state = {
        ...state,
        selection: { positions: [3], range: { start: 3, end: 3 } },
        generalizationScope: 'MUSHAF',
      };
      state = addComponent(state, {
        category: 'MADUD',
        title: 'مد',
        rank: 1,
        variants: [{ id: 'v1', label: 'وجه', text: 'مد', rank: 1 }],
      });

      const result = executeWizard(state);
      expect(result.generalizationScope).toBe('MUSHAF');
    });
  });

  describe('Summary', () => {
    it('يبني ملخصًا صحيحًا', () => {
      let state = createInitialWizardState();
      state = {
        ...state,
        selection: { positions: [3, 5], range: { start: 3, end: 5 } },
      };
      state = addComponent(state, {
        category: 'MADUD',
        title: 'مد',
        rank: 1,
        variants: [],
      });

      const summary = buildWizardSummary(state);
      expect(summary.selectionDescription).toContain('3');
      expect(summary.componentsCount).toBe(1);
      expect(summary.selectedTargetsCount).toBe(1);
      expect(summary.totalEntitiesToCreate).toBe(1);
    });

    it('يصف المواضع المتفرقة', () => {
      const state = {
        ...createInitialWizardState(),
        selection: {
          positions: [3, 7],
          multipleLoci: [{ start: 3, end: 3 }, { start: 7, end: 7 }],
        },
      };
      const summary = buildWizardSummary(state);
      expect(summary.selectionDescription).toContain('متفرقة');
    });

    it('يصف النطاق الجغرافي', () => {
      const state = {
        ...createInitialWizardState(),
        generalizationScope: 'MUSHAF' as const,
      };
      const summary = buildWizardSummary(state);
      expect(summary.generalizationDescription).toContain('المصحف');
    });
  });
});

describe('سلامة الإنشاء الدفعي', () => {
  it('لا ينشئ المكونات التي أزيلت من أهداف العملية', () => {
    let state = createInitialWizardState();
    state = { ...state, selection: { positions: [2] } };
    state = addComponent(state, { category: 'MADUD', title: 'مد', rank: 1, variants: [] });
    state = addComponent(state, { category: 'FARSH', title: 'فرش', rank: 2, variants: [] });
    state = toggleTarget(state, state.components[1].id);

    const result = executeWizard(state);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].title).toBe('مد');
    expect(result.variants[0].createBatchId).toBe(result.batchId);
  });

  it('يحفظ المواضع المتباعدة بلا ملء الفجوة ويربط العلاقات بالمعرّف لا بالعنوان', () => {
    let state = createInitialWizardState();
    state = {
      ...state,
      selection: {
        positions: [2, 6],
        multipleLoci: [{ start: 2, end: 2 }, { start: 6, end: 6 }],
      },
    };
    state = addComponent(state, { category: 'MADUD', title: 'عنوان مكرر', rank: 1, variants: [] });
    state = addComponent(state, { category: 'FARSH', title: 'عنوان مكرر', rank: 2, variants: [] });
    state = addRelation(state, {
      fromComponentId: state.components[0].id,
      toComponentId: state.components[1].id,
      type: 'RELATED',
    });

    const result = executeWizard(state);
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].loci).toEqual([
      { startPosition: 2, endPosition: 2 },
      { startPosition: 6, endPosition: 6 },
    ]);
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].fromId).not.toBe(result.relations[0].toId);
  });
});

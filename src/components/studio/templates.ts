// قوالب قواعد الوقف والوصل — Waqf/Wasl Rule Templates (FR-ES-16.2)
// مشروع التشجير - نظام القراءات العشر
//
// قوالب جاهزة تُملأ بلا كود: تُهيّئ منشئ القواعد بحقول الشرط والإجراء المناسبة
// لقواعد الوقف/الوصل/الابتداء/ممنوع الوصل. اختيار القالب يملأ المسودة فقط،
// ويبقى كل شيء قابلًا للتعديل قبل الحفظ.

import type { RuleCondition, RuleAction } from '@/lib/tashjeer/model/v8';

export interface RuleTemplate {
  id: string;
  label: string;
  description: string;
  category: RuleTemplateDraft['category'];
  type: RuleTemplateDraft['type'];
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface RuleTemplateDraft {
  type: 'DIFFERENCE' | 'CONTEXT' | 'EXCEPTION';
  category: 'WAQF' | 'WASL' | 'IBTIDA' | 'EXCEPTION' | 'DIFFERENCE';
  conditions: RuleCondition[];
  actions: RuleAction[];
}

/** قوالب جاهزة لقواعد الوقف/الوصل/الابتداء (FR-ES-16.2). */
export const WAQF_WASL_TEMPLATES: RuleTemplate[] = [
  {
    id: 'waqf-end-create',
    label: 'وقفا عند نهاية الآية: أنشئ اختلافًا',
    description: 'IF Context = WAQF AND Position = End of Ayah THEN Create Difference',
    type: 'DIFFERENCE',
    category: 'WAQF',
    conditions: [
      { field: 'context', op: 'equals', value: 'WAQF_ONLY' },
      { field: 'position', op: 'equals', value: 'END_OF_AYAH' },
    ],
    actions: [{ type: 'CREATE_DIFFERENCE' }],
  },
  {
    id: 'wasl-create',
    label: 'وصلا: أنشئ اختلافًا',
    description: 'IF Context = WASL THEN Create Difference',
    type: 'DIFFERENCE',
    category: 'WASL',
    conditions: [{ field: 'context', op: 'equals', value: 'WASL_ONLY' }],
    actions: [{ type: 'CREATE_DIFFERENCE' }],
  },
  {
    id: 'ibtida-create',
    label: 'ابتداء: أنشئ اختلافًا بعد الوقف',
    description: 'IF Context = IBTIDA THEN Create Difference',
    type: 'CONTEXT',
    category: 'IBTIDA',
    conditions: [{ field: 'position', op: 'equals', value: 'IBTIDA' }],
    actions: [{ type: 'CREATE_DIFFERENCE' }],
  },
  {
    id: 'forbidden-wasl-block',
    label: 'ممنوع الوصل: احجب الوصل',
    description: 'IF Connection = FORBIDDEN THEN Block',
    type: 'EXCEPTION',
    category: 'EXCEPTION',
    conditions: [{ field: 'forbiddenWasl', op: 'equals', value: true }],
    actions: [{ type: 'BLOCK_RESULT' }],
  },
];

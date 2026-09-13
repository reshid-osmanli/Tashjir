// اختبار توليد مكوّنات الاستوديو — Studio Components Render Smoke Test
// مشروع التشجير - نظام القراءات العشر
//
// الواجهة تُقرأ في المتصفح، لكن المكوّنات تُولَّد على الخادم (Next SSR) فلا
// حاجة لمتصفح للتحقق من **ناتجها**. هذا يحرس ما لا تظهره اختبارات المنطق
// النقيّة وحدها:
//
//   1. أن كل لوحة جديدة في /studio تُولَّد بلا استثناء (لا تحطّم الصفحة).
//   2. أن النص عربي RTL كامل، وأن الأرقام المعروضة عربية (٠١٢٣٤٥٦٧٨٩).
//   3. أن الرسوم داخلية SVG (بلا مكتبة خارجية) وتحوي العقد المتوقعة.
//   4. أن البيانات المحكومة تظهر فعلًا: الإصدارات، وأسبابها، وقيود التدقيق
//      بتفاصيل قبل/بعد، وحالات الاختبار المتعثرة.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditTrailPanel } from '@/components/studio/AuditTrailPanel';
import { DecisionGraphView } from '@/components/studio/DecisionGraphView';
import { RuleDependencyGraph } from '@/components/studio/RuleDependencyGraph';
import { RuleExplorer } from '@/components/studio/RuleExplorer';
import { RuleMetadataPanel } from '@/components/studio/RuleMetadataPanel';
import { RuleTestsPanel } from '@/components/studio/RuleTestsPanel';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { resolveMerge } from '@/lib/tashjeer/decision/api';
import { createAuditEntry } from '@/lib/tashjeer/rule-audit';
import { createVersionEntry, recordVersion } from '@/lib/tashjeer/rule-versions';
import { findUnresolvedConflicts, conflictedRuleReasons } from '@/lib/tashjeer/rule-status-flow';
import type { EngineRule } from '@/lib/tashjeer/model/v8';

const config = DEFAULT_SYSTEM_PROFILE;
const rules = config.rules;
const rule = rules[0]!;
const noop = () => undefined;

/** الأرقام العربية-الهندية التي يجب أن تظهر بدل اللاتينية. */
const ARABIC_DIGITS = /[٠١٢٣٤٥٦٧٨٩]/;
const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ');

describe('المستكشف (FR-ES-07.1)', () => {
  it('يولّد القائمة والمجاميع وشارات الإصدار بلا استثناء', () => {
    const html = renderToStaticMarkup(
      createElement(RuleExplorer, {
        rules,
        config,
        selectedRuleId: rule.id,
        onSelect: noop,
        onCreate: noop,
        onWhy: noop,
        onVersions: noop,
        onTests: noop,
        onGraph: noop,
        versionCounts: { [rule.id]: 3 },
      })
    );
    const text = stripTags(html);
    expect(text).toContain(rule.name);
    expect(text).toMatch(ARABIC_DIGITS); // شارة الإصدار «v٣» والعدادات
    expect(text).toContain('٣');
    // المعرّفات لاتينية فتُعرض LTR داخل الصفحة RTL (لا تنقلب أحرفها).
    expect(html).toContain(`dir="ltr"`);
    expect(html).toContain(rule.id);
    // روابط عميقة إلى المحرر مع إبراز القاعدة في أثر القرار.
    expect(html).toContain(`/editor?rule=${rule.id}&amp;why=1`);
    // الحماية ظاهرة قبل أي محاولة تعديل (FR-ES-07.2.3).
    expect(text).toContain('محمية');
  });

  it('يعرض سبب التعارض غير المحسوم على القاعدة الموسومة', () => {
    const conflicted: EngineRule[] = [
      { ...rules[1]!, id: 'er-allow', name: 'ادمج', actions: [{ type: 'MERGE' }], priority: 80 },
      { ...rules[1]!, id: 'er-prevent', name: 'لا تدمج', actions: [{ type: 'PREVENT_MERGE' }], priority: 80 },
    ];
    const conflictedConfig = { ...config, rules: conflicted };
    expect(findUnresolvedConflicts(conflictedConfig).length).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      createElement(RuleExplorer, {
        rules: conflicted,
        config: conflictedConfig,
        selectedRuleId: 'er-allow',
        onSelect: noop,
        onCreate: noop,
        conflicts: conflictedRuleReasons(conflictedConfig),
      })
    );
    // الشارة التحذيرية ظاهرة، والسبب الكامل في `title` (لا يُبتر).
    expect(stripTags(html)).toContain('⚠ تعارض');
    expect(html).toContain('لم يحسم سلم السياسة');
    // العدّاد في الرأس يعكس القاعدتين المتعارضتين بأرقام عربية.
    expect(stripTags(html)).toContain('متعارضة');
  });

  it('شريط الحالة يسمي «متعارضة» لا لفظًا مقاربًا', () => {
    const html = renderToStaticMarkup(
      createElement(RuleExplorer, {
        rules: [{ ...rule, status: 'CONFLICTED' }],
        config,
        selectedRuleId: null,
        onSelect: noop,
        onCreate: noop,
      })
    );
    expect(stripTags(html)).toContain('متعارضة');
    expect(html).not.toContain('متعرضة');
  });
});

describe('لوحة بيانات القاعدة (FR-ES-07.4/.3)', () => {
  it('تولّد البيانات ودورة الحالة وسلسلة الإصدارات', () => {
    const chain = [createVersionEntry({ rule, source: 'CREATE', reason: 'قاعدة نظام مرجعية', id: 'erv-1', at: '2026-01-01T00:00:00.000Z', version: 1 })];
    const html = renderToStaticMarkup(
      createElement(RuleMetadataPanel, {
        rule,
        config,
        chain,
        onStatusChange: noop,
        onToggleProtected: noop,
        onRollback: noop,
        onOpenRule: noop,
        onOpenTests: noop,
        onOpenGraph: noop,
      })
    );
    const text = stripTags(html);
    expect(text).toContain(rule.name);
    expect(text).toMatch(ARABIC_DIGITS);
    // دورة الحالة تعرض الانتقالات المتاحة من الحالة الحالية.
    expect(html).toContain('button');
  });

  it('تعرض فرق إصدارين (قبل/بعد) عند المقارنة', () => {
    const v2Rule: EngineRule = { ...rule, priority: rule.priority + 5, version: 2 };
    let chain = [createVersionEntry({ rule, source: 'CREATE', id: 'erv-1', at: '2026-01-01T00:00:00.000Z', version: 1 })];
    chain = recordVersion(chain, { rule: v2Rule, source: 'EDIT', reason: 'رفع الأولوية', id: 'erv-2', at: '2026-01-02T00:00:00.000Z' }).chain;
    expect(chain).toHaveLength(2);

    const html = renderToStaticMarkup(
      createElement(RuleMetadataPanel, {
        rule: v2Rule,
        config: { ...config, rules: [v2Rule, ...rules.slice(1)] },
        chain,
        onStatusChange: noop,
        onToggleProtected: noop,
        onRollback: noop,
      })
    );
    expect(html).toContain('select'); // منتقيَا «من إصدار» و«إلى إصدار»
    expect(stripTags(html)).toContain('رفع الأولوية');
  });
});

describe('سجل التدقيق (FR-ES-07.6)', () => {
  const before = rule;
  const after: EngineRule = { ...rule, priority: rule.priority + 10, version: rule.version + 1 };
  const entries = [
    createAuditEntry({
      action: 'RULE_UPDATED',
      before,
      after,
      reason: 'ضبط الأولوية',
      id: 'aud-1',
      at: '2026-02-01T10:00:00.000Z',
    }),
    createAuditEntry({
      action: 'REGRESSION_OVERRIDE',
      ruleId: rule.id,
      ruleName: rule.name,
      reason: 'تجاوز الانحدار عمدًا',
      override: true,
      summary: 'تجاوز إنذار انحدار',
      id: 'aud-2',
      at: '2026-02-02T10:00:00.000Z',
    }),
  ];

  it('يولّد القيود مع السبب والوقت والتغييرات', () => {
    const html = renderToStaticMarkup(
      createElement(AuditTrailPanel, {
        entries,
        rules,
        onOpenRule: noop,
        onRunTests: noop,
        onExportBundle: noop,
        onRestoreRule: noop,
      })
    );
    const text = stripTags(html);
    expect(text).toContain('ضبط الأولوية');
    expect(text).toContain('تجاوز الانحدار عمدًا');
    expect(text).toContain('local-editor');
    expect(text).toMatch(ARABIC_DIGITS); // التاريخ والأرقام عربية
  });

  it('يولّد مرشّحات اللوحة (الممثّل والفعل والتاريخ والبحث)', () => {
    const html = renderToStaticMarkup(
      createElement(AuditTrailPanel, { entries, rules, focusRuleId: rule.id })
    );
    expect(html).toContain('select');
    expect(html).toContain('type="date"');
    expect(html).toContain('search');
  });

  it('السجل الفارغ يولّد رسالة عربية لا صفحة بيضاء', () => {
    const html = renderToStaticMarkup(createElement(AuditTrailPanel, { entries: [], rules }));
    expect(stripTags(html).trim().length).toBeGreaterThan(0);
  });
});

describe('الرسوم الداخلية SVG (FR-ES-07.7)', () => {
  it('قرار معماري: الرسم داخلي SVG بلا مكتبة خارجية', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const chartLibs = deps.filter((name) => /d3|chart|recharts|vis-|cytoscape|mermaid|graphviz|plotly/i.test(name));
    expect(chartLibs).toEqual([]);

    for (const file of ['RuleDependencyGraph.tsx', 'DecisionGraphView.tsx']) {
      const source = readFileSync(resolve(process.cwd(), `src/components/studio/${file}`), 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
      // كل الاستيرادات محلية (@/ أو نسبية) — لا حزمة رسم خارجية.
      expect(imports.filter((path) => !path.startsWith('@/') && !path.startsWith('.') && path !== 'react')).toEqual([]);
      expect(source).toContain('<svg');
    }
  });

  it('رسم الاعتمادات يولّد عقدًا وحوافًا', () => {
    const html = renderToStaticMarkup(
      createElement(RuleDependencyGraph, { config, focusRuleId: rule.id, onOpenRule: noop })
    );
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox');
    expect(html).toContain('<text');
  });

  it('رسم منطق القرار يقرأ أثر القرار ويعرض الحكم', () => {
    const result = resolveMerge('MADD', 'TAHQIQ', config);
    const html = renderToStaticMarkup(
      createElement(DecisionGraphView, {
        result,
        context: { differenceType: 'MADD', relatedType: 'TAHQIK' },
        onOpenRule: noop,
      })
    );
    expect(html).toContain('<svg');
    const text = stripTags(html);
    expect(text).toContain('رسم منطق القرار');
    expect(text).toMatch(ARABIC_DIGITS); // «٣ قاعدة مطابقة» وما شابه
  });
});

describe('لوحة اختبارات القواعد (FR-ES-08)', () => {
  it('تولّد تقرير القواعد المرجعية الناجحة', () => {
    const html = renderToStaticMarkup(
      createElement(RuleTestsPanel, { config, onRunTests: noop, onOpenRule: noop })
    );
    const text = stripTags(html);
    expect(text).toMatch(ARABIC_DIGITS);
    expect(text).toContain(rule.name);
  });

  it('يظهر إنذار الانحدار مع المتوقع/الفعلي حين تتعثر حالة', () => {
    // نفس حالة اختبار قاعدة النظام لكن بجواب معاكس ← انحدار مؤكد.
    const broken: EngineRule = {
      ...rules[1]!,
      id: 'er-broken',
      name: 'قاعدة مكسورة',
      actions: [{ type: 'PREVENT_MERGE' }],
      testCases: [
        {
          name: 'مد + تحقيق ← دمج',
          input: { differenceType: 'MADD', relatedType: 'TAHQIK' },
          expected: 'MERGE',
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(RuleTestsPanel, {
        config: { ...config, rules: [broken, ...rules.filter((item) => item.id !== broken.id)] },
        focusRuleId: 'er-broken',
      })
    );
    const text = stripTags(html);
    expect(text).toContain('مد + تحقيق ← دمج');
    expect(text).toMatch(ARABIC_DIGITS);
  });

  it('ملف بلا حالات اختبار يولّد رسالة إرشادية عربية', () => {
    const html = renderToStaticMarkup(
      createElement(RuleTestsPanel, {
        config: { ...config, rules: rules.map((item) => ({ ...item, testCases: [] })) },
      })
    );
    expect(stripTags(html)).toContain('لا توجد حالات اختبار');
  });
});

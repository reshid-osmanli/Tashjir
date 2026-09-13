// صفحة استوديو المحرك — Engine Studio Page (FR-ES-01..16)
// مشروع التشجير - نظام القراءات العشر
//
// بيئة رسومية لتعليم المحرك: الأولويات، القواعد، متى يُدمج ومتى لا، سياسات
// القرار، واختبارها — مع **حوكمة كاملة** (الحزمة ١١): مستكشف مصنّف، دورة حالة
// محكومة، إصدارات ورجوع موثّق، بيانات وصفية كاملة، قواعد محمية بتأكيد إضافي،
// سجل تدقيق قابل للتصفية، رسما الاعتمادات والقرار، واختبارات لكل قاعدة مع كشف
// الانحدار قبل الحفظ.
//
// كل قرار يمرّ عبر Decision Resolver، وكل تغيير يمرّ عبر rule-governance — لا
// منطق مكرر ولا طريق ثانٍ للتغيير (P-07).

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EngineRule, RuleStatus } from '@/lib/tashjeer/model/v8';
import { confirmAction } from '@/lib/ui/confirm-store';
import { confirmWithReason } from '@/lib/ui/reason-confirm-store';
import { ReasonDialogHost } from '@/components/ui/ReasonDialogHost';
import { useEngineStudioStore, type GovernedResult } from '@/stores/engine-config-ui-store';
import { findTransition } from '@/lib/tashjeer/rule-status-flow';
import { RuleExplorer } from '@/components/studio/RuleExplorer';
import { RuleBuilder } from '@/components/studio/RuleBuilder';
import { RuleMetadataPanel } from '@/components/studio/RuleMetadataPanel';
import { MergeMatrixPanel } from '@/components/studio/MergeMatrixPanel';
import { PriorityPipeline } from '@/components/studio/PriorityPipeline';
import { WhyTracePlayground } from '@/components/studio/WhyTracePlayground';
import { ExportImportPanel } from '@/components/studio/ExportImportPanel';
import { Dashboard } from '@/components/studio/Dashboard';
import { RuleTestsPanel } from '@/components/studio/RuleTestsPanel';
import { CandidateRulesPanel } from '@/components/studio/CandidateRulesPanel';
import { ProfileComparePanel } from '@/components/studio/ProfileComparePanel';
import { PublishHistoryPanel } from '@/components/studio/PublishHistoryPanel';
import { AuditTrailPanel } from '@/components/studio/AuditTrailPanel';
import { RuleDependencyGraph } from '@/components/studio/RuleDependencyGraph';
import { STATUS_LABELS } from '@/components/studio/labels';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

type Section =
  | 'dashboard'
  | 'rules'
  | 'merge'
  | 'priority'
  | 'why'
  | 'tests'
  | 'graph'
  | 'audit'
  | 'candidates'
  | 'compare'
  | 'publish'
  | 'io';

const SECTIONS: Array<{ id: Section; label: string; hint: string }> = [
  { id: 'dashboard', label: 'لوحة المعلومات', hint: 'نظرة عامة' },
  { id: 'rules', label: 'مستكشف القواعد ومنشئها', hint: 'FR-ES-02/03/07' },
  { id: 'merge', label: 'مصفوفة الدمج', hint: 'FR-ES-05' },
  { id: 'priority', label: 'الأولويات والأنابيب', hint: 'FR-ES-01/04/06' },
  { id: 'why', label: 'ساحة لماذا؟ ورسم القرار', hint: 'FR-ES-09/10/07.7' },
  { id: 'tests', label: 'اختبارات القواعد', hint: 'FR-ES-08' },
  { id: 'graph', label: 'رسم الاعتمادات', hint: 'FR-ES-07.7' },
  { id: 'audit', label: 'سجل التدقيق', hint: 'FR-ES-07.6' },
  { id: 'candidates', label: 'قاعدة من تصحيح', hint: 'FR-ES-12' },
  { id: 'compare', label: 'مقارنة الملفات', hint: 'FR-ES-11' },
  { id: 'publish', label: 'النشر والسجل', hint: 'FR-ES-07/14' },
  { id: 'io', label: 'التصدير والاستيراد', hint: 'FR-ES-14' },
];

/** معاملات الرابط العميق (FR-ES-15): القسم، القاعدة، وتصحيح مسبق التعبئة. */
interface StudioDeepLink {
  section?: Section;
  ruleId?: string;
  candidate?: { differenceType?: string; relatedType?: string; engineMerged?: boolean; editorWantsMerge?: boolean };
}

function readDeepLink(): StudioDeepLink {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const section = params.get('section') as Section | null;
  const ruleId = params.get('rule') ?? undefined;
  const flag = (key: string): boolean | undefined => {
    const value = params.get(key);
    if (value === null) return undefined;
    return value === '1' || value === 'true';
  };
  const differenceType = params.get('differenceType') ?? undefined;
  const relatedType = params.get('relatedType') ?? undefined;
  const engineMerged = flag('engineMerged');
  const editorWantsMerge = flag('editorWantsMerge');
  const hasCandidate = differenceType || relatedType || engineMerged !== undefined || editorWantsMerge !== undefined;
  return {
    section: section && SECTIONS.some((item) => item.id === section) ? section : ruleId ? 'rules' : undefined,
    ruleId,
    candidate: hasCandidate ? { differenceType, relatedType, engineMerged, editorWantsMerge } : undefined,
  };
}

/** إشعار عملية محكومة (نجاح أو رفض بسبب). */
interface Notice {
  kind: 'ok' | 'err';
  text: string;
}

export default function EngineStudioPage() {
  const [section, setSection] = useState<Section>('dashboard');
  const [creatingNew, setCreatingNew] = useState(false);
  const [deepLink, setDeepLink] = useState<StudioDeepLink>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  const {
    config,
    loaded,
    dirty,
    selectedRuleId,
    savedConfig,
    versions,
    audit,
    ruleVersions,
    conflicts,
    hydrate,
    persist,
    resetToDefault,
    rollbackTo,
    discardChanges,
    setSelectedRule,
    saveRule,
    addRule,
    removeRule,
    restoreRule,
    setRulePriorityAction,
    setRuleStatusAction,
    setRuleProtected,
    rollbackRule,
    syncConflictTags,
    addMergeEntry,
    updateMergeEntry,
    removeMergeEntry,
    setConflictPolicyAction,
    setExecutionOrderAction,
    upsertGroup,
    runTests,
    exportText,
    importText,
    exportBundleText,
  } = useEngineStudioStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // الروابط العميقة: /studio?rule=... يفتح القاعدة، و?section=candidates مع
  // معاملات التصحيح يعبّئ لوحة «قاعدة من تصحيح» (FR-ES-15).
  useEffect(() => {
    const link = readDeepLink();
    setDeepLink(link);
    if (link.section) setSection(link.section);
    if (link.ruleId) setSelectedRule(link.ruleId);
  }, [setSelectedRule]);

  const selectedRule = selectedRuleId ? config.rules.find((rule) => rule.id === selectedRuleId) ?? null : null;
  const builderRule = creatingNew ? null : selectedRule;
  const selectedChain = useMemo(
    () => (selectedRuleId ? ruleVersions[selectedRuleId] ?? [] : []),
    [selectedRuleId, ruleVersions]
  );
  const versionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rule of config.rules) counts[rule.id] = (ruleVersions[rule.id] ?? []).length || rule.version;
    return counts;
  }, [config.rules, ruleVersions]);

  /** يعرض نتيجة عملية محكومة (الرفض بسبب يظهر للمستخدم لا بصمت). */
  const notify = (result: GovernedResult, successText: string) => {
    setNotice(result.ok ? { kind: 'ok', text: successText } : { kind: 'err', text: result.error ?? 'تعذّر التنفيذ' });
  };

  const openRule = (ruleId: string) => {
    setSelectedRule(ruleId);
    setCreatingNew(false);
    setSection('rules');
  };

  const handleSaveRule = (
    rule: EngineRule | Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'>,
    meta?: { reason?: string; override?: boolean }
  ) => {
    const result = saveRule(rule as EngineRule, meta);
    setCreatingNew(false);
    notify(result, meta?.override ? 'حُفظ التعديل الموثّق وأُضيف إصدار جديد.' : 'حُفظت القاعدة وأُضيف إصدار جديد.');
  };

  /** تغيير حالة محكوم: اعتماد/سبب بحسب الانتقال والحماية (FR-ES-07.2). */
  const handleStatusChange = async (rule: EngineRule, status: RuleStatus) => {
    const transition = findTransition(rule.status, status);
    if (!transition) {
      setNotice({ kind: 'err', text: `الانتقال من «${STATUS_LABELS[rule.status]}» إلى «${STATUS_LABELS[status]}» غير مسموح.` });
      return;
    }
    const needsReason = transition.requiresReason || rule.protected;
    const impacts = [
      { label: 'قاعدة تشير إليها', count: dependentCount(config.rules, rule.id) },
      { label: 'حالة اختبار مرفقة', count: rule.testCases?.length ?? 0 },
    ];

    if (needsReason) {
      const answer = await confirmWithReason({
        title: transition.label,
        message: `${transition.hint} الانتقال: «${STATUS_LABELS[rule.status]}» ← «${STATUS_LABELS[status]}».`,
        warnings: rule.protected ? ['القاعدة محمية: التغيير يحتاج تأكيدًا إضافيًا صريحًا بسبب مكتوب.'] : [],
        impacts,
        undoable: true,
        confirmLabel: transition.label,
        reasonLabel: 'سبب تغيير الحالة (إلزامي — يُحفظ في الإصدار وسجل التدقيق)',
        tone: status === 'DEPRECATED' || status === 'DISABLED' ? 'danger' : 'default',
      });
      if (!answer.confirmed) return;
      notify(setRuleStatusAction(rule.id, status, { reason: answer.reason }), `انتقلت القاعدة إلى «${STATUS_LABELS[status]}» بإصدار موثّق.`);
      return;
    }

    if (transition.requiresApproval) {
      const ok = await confirmAction({
        title: transition.label,
        message: `${transition.hint} الانتقال: «${STATUS_LABELS[rule.status]}» ← «${STATUS_LABELS[status]}».`,
        impacts,
        undoable: true,
        confirmLabel: transition.label,
      });
      if (!ok) return;
    }
    notify(setRuleStatusAction(rule.id, status, {}), `انتقلت القاعدة إلى «${STATUS_LABELS[status]}».`);
  };

  /** وسم الحماية: رفعه هو الاتجاه الحسّاس فيطلب سببًا (FR-ES-07.5). */
  const handleToggleProtected = async (rule: EngineRule, value: boolean) => {
    if (value) {
      notify(setRuleProtected(rule.id, true, { reason: 'وسم القاعدة محمية' }), 'وُسمت القاعدة محمية.');
      return;
    }
    const answer = await confirmWithReason({
      title: 'رفع الحماية عن قاعدة',
      message: `رفع الحماية عن «${rule.name}» يجعل تعديلها وحذفها بلا تأكيد إضافي.`,
      warnings: ['يُحفظ السبب في إصدار القاعدة وسجل التدقيق.'],
      undoable: true,
      confirmLabel: 'رفع الحماية',
      reasonLabel: 'سبب رفع الحماية (إلزامي)',
      tone: 'danger',
    });
    if (!answer.confirmed) return;
    notify(setRuleProtected(rule.id, false, { reason: answer.reason }), 'رُفعت الحماية عن القاعدة.');
  };

  /** رجوع موثّق لإصدار أقدم (FR-ES-07.3.2). */
  const handleRollback = async (rule: EngineRule, version: number) => {
    const answer = await confirmWithReason({
      title: `الرجوع إلى الإصدار v${toArabicDigits(version)}`,
      message: `يُنشئ الرجوع إصدارًا جديدًا (v${toArabicDigits(selectedChain.length + 1)}) بمحتوى الإصدار v${toArabicDigits(version)}، ولا يحذف أي إصدار وسيط.`,
      warnings: ['الرجوع موثّق: السبب يُحفظ في الإصدار الجديد وسجل التدقيق.'],
      undoable: true,
      confirmLabel: 'رجوع موثّق',
      reasonLabel: 'سبب الرجوع (إلزامي)',
      tone: 'danger',
    });
    if (!answer.confirmed) return;
    notify(
      rollbackRule(rule.id, version, { reason: answer.reason }),
      `رجعت القاعدة إلى محتوى الإصدار v${toArabicDigits(version)} وأُصدر كإصدار جديد.`
    );
  };

  /** حذف قاعدة: محمية ← سبب إلزامي، وغير محمية ← تأكيد كمي (FR-ES-07.5). */
  const handleRemove = async (rule: EngineRule) => {
    const dependents = dependentCount(config.rules, rule.id);
    const impacts = [
      { label: 'قاعدة تشير إليها', count: dependents },
      { label: 'حالة اختبار مرفقة', count: rule.testCases?.length ?? 0 },
      { label: 'إصدار محفوظ في السلسلة', count: (ruleVersions[rule.id] ?? []).length },
    ];
    const message =
      'تُزال القاعدة من ملف المحرك الحالي، وتبقى سلسلة إصداراتها محفوظة فيمكن استرجاعها من سجل التدقيق.';

    if (rule.protected) {
      const answer = await confirmWithReason({
        title: `حذف قاعدة محمية: «${rule.name}»`,
        message: `${message} القاعدة محمية، فالحذف يحتاج تأكيدًا إضافيًا صريحًا.`,
        warnings: ['حذف قاعدة محمية يغيّر سلوك المحرك الافتراضي.'],
        impacts,
        undoable: true,
        confirmLabel: 'حذف بالسبب',
        reasonLabel: 'سبب حذف القاعدة المحمية (إلزامي)',
        tone: 'danger',
      });
      if (!answer.confirmed) return;
      notify(removeRule(rule.id, { reason: answer.reason, override: true }), 'حُذفت القاعدة وبقي تاريخ إصداراتها.');
      return;
    }

    const ok = await confirmAction({
      title: `حذف القاعدة «${rule.name}»`,
      message,
      impacts,
      undoable: true,
      confirmLabel: 'حذف',
      tone: 'danger',
    });
    if (!ok) return;
    notify(removeRule(rule.id, { reason: 'حذف من المستكشف' }), 'حُذفت القاعدة وبقي تاريخ إصداراتها.');
  };

  /** تطبيق وسم التعارض التلقائي على الملف (الكشف تلقائي، والكتابة صريحة). */
  const handleSyncConflicts = async () => {
    if (conflicts.size === 0) {
      setNotice({ kind: 'ok', text: 'لا تعارض غير محسوم في الملف حاليًا.' });
      return;
    }
    const ok = await confirmAction({
      title: 'تطبيق وسم التعارض التلقائي',
      message:
        'تُوسم القواعد المعنية بتعارض غير محسوم في سلم السياسة بحالة «متعارضة»، ويُرفع الوسم عمن حُسم تعارضها. كل تغيير يُسجَّل إصدارًا وتدقيقًا.',
      impacts: [{ label: 'قاعدة معنية بالتعارض', count: conflicts.size }],
      undoable: true,
      confirmLabel: 'تطبيق الوسم',
    });
    if (!ok) return;
    const result = syncConflictTags({ reason: 'مزامنة الوسم التلقائي للتعارض', actor: 'engine-policy' });
    setNotice({
      kind: 'ok',
      text: `وُسمت ${toArabicDigits(result.tagged)} قاعدة بالتعارض، ورُفع الوسم عن ${toArabicDigits(result.cleared)}.`,
    });
  };

  /** تصدير حزمة الحوكمة إلى الحافظة/التنزيل. */
  const handleExportBundle = () => {
    const text = exportBundleText();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tashjeer-engine-governance.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'ok', text: 'صُدِّرت حزمة الحوكمة: الإعداد + إصدارات القواعد + سجل التدقيق + ملخّص الاختبارات.' });
  };

  return (
    <div className="space-y-4">
      {/* حوار التأكيد بسبب إلزامي (المحمية/الانحدار/الرجوع/الحذف) */}
      <ReasonDialogHost />

      {/* رأس الصفحة */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">استوديو المحرك</h1>
          <p className="text-sm text-gray-500">
            الملف: <span className="font-medium text-gray-700">{config.profile}</span>
            {dirty && <span className="mr-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">غير محفوظ</span>}
            {conflicts.size > 0 && (
              <button
                type="button"
                onClick={handleSyncConflicts}
                className="mr-2 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200"
                title="تطبيق وسم CONFLICTED على القواعد المعنية"
              >
                ⚠ {toArabicDigits(conflicts.size)} تعارض غير محسوم — وسمها
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmAction({
                title: 'إعادة إعداد المحرك إلى سياسات النظام',
                message: 'تُستبدل القواعد ومصفوفة الدمج والسياسات الحالية بالافتراضية، ويُفقد ما لم يُحفظ. سجل التدقيق وإصدارات القواعد لا تُمحى.',
                impacts: [
                  { label: 'قاعدة', count: config.rules.length },
                  { label: 'صف في مصفوفة الدمج', count: config.mergeMatrix.length },
                ],
                undoable: false,
                confirmLabel: 'إعادة الضبط',
                tone: 'danger',
              });
              if (ok) {
                resetToDefault();
                setNotice({ kind: 'ok', text: 'أُعيد الملف إلى سياسات النظام، وسُجّل ذلك في التدقيق.' });
              }
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            إعادة الضبط
          </button>
          <button
            type="button"
            onClick={() => setSection('publish')}
            disabled={!dirty}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="تشغيل جاف قبل النشر: ما الذي سيتبدّل؟"
          >
            مراجعة قبل النشر
          </button>
          <button
            type="button"
            onClick={() => {
              persist();
              setNotice({ kind: 'ok', text: 'نُشر الملف والتُقطت نسخة في السجل، وسُجّل النشر في التدقيق.' });
            }}
            disabled={!dirty}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            حفظ
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
          role="status"
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs underline opacity-70 hover:opacity-100">
            إخفاء
          </button>
        </div>
      )}

      {!loaded ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">جارٍ التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          {/* الشريط الجانبي للأقسام */}
          <nav className="flex gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white p-2 shadow-sm lg:h-fit lg:flex-col lg:overflow-visible">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setCreatingNew(false);
                }}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-right transition-colors lg:w-full ${
                  section === item.id ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-emerald-50'
                }`}
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className={`text-xs ${section === item.id ? 'text-emerald-100' : 'text-gray-400'}`}>{item.hint}</span>
              </button>
            ))}
          </nav>

          {/* المحتوى */}
          <div className="min-w-0 space-y-4">
            {section === 'dashboard' && (
              <Dashboard
                config={config}
                conflicts={conflicts}
                auditCount={audit.length}
                onSyncConflicts={handleSyncConflicts}
                onOpenSection={(target) => setSection(target as Section)}
              />
            )}

            {section === 'rules' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_1fr]">
                <div className="h-[70vh] min-h-[520px] xl:sticky xl:top-4 xl:h-[calc(100vh-8rem)]">
                  <RuleExplorer
                    rules={config.rules}
                    config={config}
                    selectedRuleId={selectedRuleId}
                    conflicts={conflicts}
                    versionCounts={versionCounts}
                    onSelect={(id) => {
                      setSelectedRule(id);
                      setCreatingNew(false);
                    }}
                    onCreate={() => {
                      setSelectedRule(null);
                      setCreatingNew(true);
                    }}
                    onWhy={(id) => {
                      setSelectedRule(id);
                      setSection('why');
                    }}
                    onVersions={(id) => openRule(id)}
                    onTests={(id) => {
                      setSelectedRule(id);
                      setSection('tests');
                    }}
                    onGraph={(id) => {
                      setSelectedRule(id);
                      setSection('graph');
                    }}
                  />
                </div>
                <div className="space-y-4">
                  {creatingNew || builderRule ? (
                    <RuleBuilder
                      rule={builderRule}
                      groups={config.priorityGroups}
                      profile={config}
                      onSave={handleSaveRule}
                      onCancel={() => {
                        setCreatingNew(false);
                        setSelectedRule(null);
                      }}
                    />
                  ) : (
                    <EmptyRuleState />
                  )}

                  {selectedRule && !creatingNew && (
                    <>
                      <SelectedRuleActions
                        rule={selectedRule}
                        onPriority={(id, priority) =>
                          notify(setRulePriorityAction(id, priority, { reason: 'تعديل الأولوية من البطاقة' }), 'حُدِّثت الأولوية بإصدار موثّق.')
                        }
                        onStatus={(id, status) => {
                          void handleStatusChange(selectedRule, status);
                        }}
                        onRemove={() => void handleRemove(selectedRule)}
                      />
                      <RuleMetadataPanel
                        rule={selectedRule}
                        config={config}
                        chain={selectedChain}
                        onStatusChange={(status) => void handleStatusChange(selectedRule, status)}
                        onToggleProtected={(value) => void handleToggleProtected(selectedRule, value)}
                        onRollback={(version) => void handleRollback(selectedRule, version)}
                        onOpenRule={openRule}
                        onOpenTests={(id) => {
                          setSelectedRule(id);
                          setSection('tests');
                        }}
                        onOpenGraph={(id) => {
                          setSelectedRule(id);
                          setSection('graph');
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {section === 'merge' && (
              <MergeMatrixPanel
                matrix={config.mergeMatrix}
                onAdd={addMergeEntry}
                onUpdate={updateMergeEntry}
                onRemove={removeMergeEntry}
              />
            )}

            {section === 'priority' && (
              <PriorityPipeline
                config={config}
                onConflictPolicyChange={setConflictPolicyAction}
                onExecutionOrderChange={setExecutionOrderAction}
                onGroupChange={upsertGroup}
                onRulePriorityChange={(ruleId, priority) =>
                  setRulePriorityAction(ruleId, priority, { reason: 'إعادة ترتيب الأولويات' })
                }
                onOpenRule={openRule}
              />
            )}

            {section === 'why' && <WhyTracePlayground config={config} focusRuleId={selectedRuleId} onOpenRule={openRule} />}

            {section === 'tests' && (
              <RuleTestsPanel
                config={config}
                focusRuleId={selectedRuleId}
                onRunTests={() => {
                  const report = runTests({ reason: 'تشغيل من لوحة الاختبارات' });
                  setNotice({
                    kind: report.failed > 0 ? 'err' : 'ok',
                    text: `شُغِّلت ${toArabicDigits(report.total)} حالة: ${toArabicDigits(report.passed)} ناجحة و${toArabicDigits(report.failed)} فاشلة، وسُجّل التشغيل في التدقيق.`,
                  });
                }}
                onOpenRule={openRule}
              />
            )}

            {section === 'graph' && (
              <RuleDependencyGraph config={config} focusRuleId={selectedRuleId} onOpenRule={openRule} depth={1} />
            )}

            {section === 'audit' && (
              <AuditTrailPanel
                entries={audit}
                rules={config.rules}
                focusRuleId={selectedRuleId}
                onOpenRule={openRule}
                onRestoreRule={async (ruleId) => {
                  const answer = await confirmWithReason({
                    title: 'استرجاع قاعدة حُذفت',
                    message:
                      'يُعاد آخر إصدار محفوظ من سلسلة القاعدة إلى ملف المحرك بحالة «معطّلة» (لا تُفعَّل صامتة)، ويُصدَر إصدار جديد موثّق.',
                    undoable: true,
                    confirmLabel: 'استرجاع',
                    reasonLabel: 'سبب الاسترجاع (إلزامي)',
                  });
                  if (!answer.confirmed) return;
                  notify(restoreRule(ruleId, { reason: answer.reason }), 'استُرجعت القاعدة من آخر إصدار محفوظ (معطّلة).');
                }}
                onRunTests={() => {
                  runTests({ reason: 'تشغيل من لوحة التدقيق' });
                  setNotice({ kind: 'ok', text: 'شُغِّلت الاختبارات وسُجّلت في التدقيق.' });
                }}
                onExportBundle={handleExportBundle}
              />
            )}

            {section === 'candidates' && (
              <CandidateRulesPanel
                initial={deepLink.candidate}
                onAdopt={(rule) => {
                  notify(addRule(rule, { reason: 'اعتماد قاعدة مرشّحة من تصحيح' }), 'اعتمدت القاعدة المرشّحة وأُضيفت إصدارًا أولًا.');
                  setSection('rules');
                }}
              />
            )}

            {section === 'compare' && <ProfileComparePanel config={config} />}

            {section === 'publish' && (
              <PublishHistoryPanel
                config={config}
                savedConfig={savedConfig}
                dirty={dirty}
                versions={versions}
                onPublish={(note) => {
                  persist(note);
                  setNotice({ kind: 'ok', text: 'نُشر الملف والتُقطت نسخة في السجل.' });
                }}
                onDiscard={discardChanges}
                onRollback={(versionId) => {
                  const ok = rollbackTo(versionId);
                  setNotice(
                    ok
                      ? { kind: 'ok', text: 'استُرجعت النسخة إلى الملف الحي وسُجّل ذلك في السجل والتدقيق.' }
                      : { kind: 'err', text: 'تعذّر الاسترجاع: النسخة غير موجودة.' }
                  );
                }}
                onOpenRule={openRule}
              />
            )}

            {section === 'io' && (
              <ExportImportPanel
                onExport={exportText}
                onImport={(text) => {
                  const result = importText(text);
                  setNotice(
                    result.valid
                      ? { kind: 'ok', text: 'استُورد الملف بنجاح؛ احفظ لتثبيته (وسُجّل الاستيراد في التدقيق).' }
                      : { kind: 'err', text: result.errors[0] ?? 'فشل الاستيراد.' }
                  );
                  return result;
                }}
                onExportBundle={handleExportBundle}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** عدد القواعد التي تشير إلى قاعدة (اعتماد/تجاوز/تعارض). */
function dependentCount(rules: EngineRule[], ruleId: string): number {
  return rules.filter(
    (rule) =>
      rule.id !== ruleId &&
      (rule.dependsOn?.includes(ruleId) || rule.overrides?.includes(ruleId) || rule.conflictsWith?.includes(ruleId))
  ).length;
}

function EmptyRuleState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-400">
      اختر قاعدة من المستكشف لتعديلها ورؤية بياناتها وإصداراتها، أو أنشئ قاعدة جديدة.
    </div>
  );
}

function SelectedRuleActions({
  rule,
  onPriority,
  onStatus,
  onRemove,
}: {
  rule: EngineRule;
  onPriority: (id: string, priority: number) => void;
  onStatus: (id: string, status: EngineRule['status']) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium text-gray-600">إجراءات سريعة على المحدد</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500" htmlFor="quick-priority">
          الأولوية:
        </label>
        <input
          id="quick-priority"
          type="number"
          value={rule.priority}
          onChange={(event) => onPriority(rule.id, Number(event.target.value))}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={() => onStatus(rule.id, rule.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {rule.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}
        </button>
        <button
          type="button"
          onClick={() => onRemove(rule.id)}
          className="mr-auto rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          حذف القاعدة
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        الانتقالات المحكومة والسبب الإلزامي في بطاقة «دورة الحالة» بالأسفل — وهذه أختصار سريع يمرّ بنفس الحراسة.
      </p>
    </div>
  );
}

// صفحة استوديو المحرك — Engine Studio Page (FR-ES-01..16)
// مشروع التشجير - نظام القراءات العشر
//
// بيئة رسومية لتعليم المحرك: الأولويات، القواعد، متى يُدمج ومتى لا، سياسات
// القرار، واختبارها. تنقل قرارات المحرك من كونها منطقًا داخليًا مبعثرًا إلى
// طبقة قرار وسياسة موحدة يديرها المستخدم رسوميًا (FR-ES، FR-EN-01).
//
// كل قرار هنا يمرّ عبر Decision Resolver الموجود لا عبر منطق مكرر (P-07).

'use client';

import { confirmAction } from '@/lib/ui/confirm-store';
import { useEffect, useState } from 'react';
import type { EngineRule } from '@/lib/tashjeer/model/v8';
import { useEngineStudioStore } from '@/stores/engine-config-ui-store';
import { RuleExplorer } from '@/components/studio/RuleExplorer';
import { RuleBuilder } from '@/components/studio/RuleBuilder';
import { MergeMatrixPanel } from '@/components/studio/MergeMatrixPanel';
import { PriorityPipeline } from '@/components/studio/PriorityPipeline';
import { WhyTracePlayground } from '@/components/studio/WhyTracePlayground';
import { ExportImportPanel } from '@/components/studio/ExportImportPanel';
import { Dashboard } from '@/components/studio/Dashboard';
import { RuleTestsPanel } from '@/components/studio/RuleTestsPanel';
import { CandidateRulesPanel } from '@/components/studio/CandidateRulesPanel';
import { ProfileComparePanel } from '@/components/studio/ProfileComparePanel';
import { PublishHistoryPanel } from '@/components/studio/PublishHistoryPanel';
import { EngineSettingsPanel } from '@/components/studio/EngineSettingsPanel';

type Section = 'dashboard' | 'rules' | 'merge' | 'priority' | 'why' | 'tests' | 'candidates' | 'compare' | 'publish' | 'io' | 'settings';

const SECTIONS: Array<{ id: Section; label: string; hint: string }> = [
  { id: 'dashboard', label: 'لوحة المعلومات', hint: 'نظرة عامة' },
  { id: 'rules', label: 'القواعد ومنشئها', hint: 'FR-ES-02/03/07' },
  { id: 'merge', label: 'مصفوفة الدمج', hint: 'FR-ES-05' },
  { id: 'priority', label: 'الأولويات والأنابيب', hint: 'FR-ES-01/04/06' },
  { id: 'why', label: 'ساحة لماذا؟', hint: 'FR-ES-09/10' },
  { id: 'tests', label: 'اختبارات القواعد', hint: 'FR-ES-08' },
  { id: 'candidates', label: 'قاعدة من تصحيح', hint: 'FR-ES-12' },
  { id: 'compare', label: 'مقارنة الملفات', hint: 'FR-ES-11' },
  { id: 'publish', label: 'النشر والسجل', hint: 'FR-ES-07/14' },
  { id: 'io', label: 'التصدير والاستيراد', hint: 'FR-ES-14' },
  { id: 'settings', label: 'إعدادات سلوك المحرك', hint: 'FR-EN-01' },
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

export default function EngineStudioPage() {
  const [section, setSection] = useState<Section>('dashboard');
  const [creatingNew, setCreatingNew] = useState(false);
  const [deepLink, setDeepLink] = useState<StudioDeepLink>({});

  const {
    config,
    loaded,
    dirty,
    selectedRuleId,
    savedConfig,
    versions,
    hydrate,
    persist,
    resetToDefault,
    rollbackTo,
    discardChanges,
    setSelectedRule,
    addRule,
    updateRule,
    removeRule,
    setRulePriorityAction,
    setRuleStatusAction,
    addMergeEntry,
    updateMergeEntry,
    removeMergeEntry,
    addRelationEntry,
    updateRelationEntry,
    removeRelationEntry,
    setConflictPolicyAction,
    setExecutionOrderAction,
    upsertGroup,
    exportText,
    previewImport,
    importText,
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

  const handleSaveRule = (rule: EngineRule | Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'>) => {
    const existing = 'createdAt' in rule && config.rules.some((item) => item.id === rule.id);
    if (existing) {
      const { id, ...patch } = rule as EngineRule;
      updateRule(id, patch);
    } else {
      addRule(rule as Omit<EngineRule, 'createdAt' | 'updatedAt' | 'version'>);
    }
    setCreatingNew(false);
  };

  return (
    <div className="space-y-4">
      {/* رأس الصفحة */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">استوديو المحرك</h1>
          <p className="text-sm text-gray-500">
            الملف: <span className="font-medium text-gray-700">{config.profile}</span>
            {dirty && <span className="mr-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">غير محفوظ</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmAction({
                title: 'إعادة إعداد المحرك إلى سياسات النظام',
                message: 'تُستبدل القواعد ومصفوفة الدمج والسياسات الحالية بالافتراضية، ويُفقد ما لم يُحفظ.',
                impacts: [
                  { label: 'قاعدة', count: config.rules.length },
                  { label: 'صف في مصفوفة الدمج', count: config.mergeMatrix.length },
                ],
                undoable: false,
                confirmLabel: 'إعادة الضبط',
              });
              if (ok) resetToDefault();
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
            onClick={() => persist()}
            disabled={!dirty}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            حفظ
          </button>
        </div>
      </div>

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
          <div className="min-w-0">
            {section === 'dashboard' && <Dashboard config={config} />}

            {section === 'rules' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
                <RuleExplorer
                  rules={config.rules}
                  selectedRuleId={selectedRuleId}
                  onSelect={(id) => {
                    setSelectedRule(id);
                    setCreatingNew(false);
                  }}
                  onCreate={() => {
                    setSelectedRule(null);
                    setCreatingNew(true);
                  }}
                />
                <div>
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
                    <SelectedRuleActions
                      rule={selectedRule}
                      onPriority={setRulePriorityAction}
                      onStatus={setRuleStatusAction}
                      onRemove={async (id) => {
                        const dependents = config.rules.filter(
                          (rule) => rule.dependsOn?.includes(id) || rule.overrides?.includes(id)
                        ).length;
                        const ok = await confirmAction({
                          title: selectedRule.protected ? 'حذف قاعدة محمية' : `حذف القاعدة «${selectedRule.name}»`,
                          message: selectedRule.protected
                            ? 'هذه قاعدة محمية من قواعد النظام؛ حذفها يغيّر سلوك المحرك الافتراضي.'
                            : 'تُحذف القاعدة من ملف المحرك الحالي.',
                          impacts: [
                            { label: 'قاعدة تعتمد عليها', count: dependents },
                            { label: 'حالة اختبار مرفقة', count: selectedRule.testCases?.length ?? 0 },
                          ],
                          undoable: false,
                          confirmLabel: 'حذف',
                        });
                        if (ok) removeRule(id);
                      }}
                    />
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
                relations={config.relations ?? []}
                onAddRelation={addRelationEntry}
                onUpdateRelation={updateRelationEntry}
                onRemoveRelation={removeRelationEntry}
              />
            )}

            {section === 'priority' && (
              <PriorityPipeline
                config={config}
                onConflictPolicyChange={setConflictPolicyAction}
                onExecutionOrderChange={setExecutionOrderAction}
                onGroupChange={upsertGroup}
                onRulePriorityChange={setRulePriorityAction}
                onOpenRule={(ruleId) => {
                  setSelectedRule(ruleId);
                  setCreatingNew(false);
                  setSection('rules');
                }}
              />
            )}

            {section === 'why' && <WhyTracePlayground config={config} />}

            {section === 'tests' && <RuleTestsPanel config={config} />}

            {section === 'candidates' && (
              <CandidateRulesPanel
                initial={deepLink.candidate}
                onAdopt={(rule) => {
                  addRule(rule);
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
                onPublish={(note) => persist(note)}
                onDiscard={discardChanges}
                onRollback={rollbackTo}
                onOpenRule={(ruleId) => {
                  setSelectedRule(ruleId);
                  setCreatingNew(false);
                  setSection('rules');
                }}
              />
            )}

            {section === 'io' && <ExportImportPanel onExport={exportText} onPreviewImport={previewImport} onImport={importText} />}

            {section === 'settings' && <EngineSettingsPanel />}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyRuleState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-400">
      اختر قاعدة من القائمة لتعديلها، أو أنشئ قاعدة جديدة.
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
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium text-gray-600">إجراءات سريعة على المحدد</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">الأولوية:</label>
        <input
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
    </div>
  );
}

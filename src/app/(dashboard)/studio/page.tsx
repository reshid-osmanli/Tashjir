'use client';

// Engine Studio - مركز إعداد وتعليم المحرك
// FR-ES-01..16، FR-EN-01..06
//
// بيئة رسومية لتعليم المحرك: الأولويات، متى يُدمج ومتى لا يُدمج، سياسات
// القرار، القواعد، واختبارها — دون العودة إلى الكود أو تحرير JSON يدويًا.

import { useState } from 'react';
import { RuleExplorer } from '@/components/studio/RuleExplorer';
import { RuleBuilder } from '@/components/studio/RuleBuilder';
import { MergeMatrix } from '@/components/studio/MergeMatrix';
import { PrioritySystem } from '@/components/studio/PrioritySystem';
import { PipelineViewer } from '@/components/studio/PipelineViewer';
import { DecisionTrace } from '@/components/studio/DecisionTrace';
import { ProfileManager } from '@/components/studio/ProfileManager';
import { ConfigExportImport } from '@/components/studio/ConfigExportImport';
import { CandidateRules } from '@/components/studio/CandidateRules';

type StudioTab = 'rules' | 'matrix' | 'priority' | 'pipeline' | 'trace' | 'profiles' | 'candidates' | 'export';

const tabs: { id: StudioTab; label: string; icon: string; description: string }[] = [
  { id: 'rules', label: 'القواعد', icon: '📋', description: 'استكشاف وإنشاء القواعد' },
  { id: 'matrix', label: 'مصفوفة الدمج', icon: '🔀', description: 'قرارات الدمج والتنافي' },
  { id: 'priority', label: 'الأولويات', icon: '📊', description: 'مجموعات الأولوية' },
  { id: 'pipeline', label: 'خط الأنابيب', icon: '🔄', description: 'مراحل اتخاذ القرار' },
  { id: 'trace', label: 'التتبع', icon: '🔍', description: 'Why? وأثر القرار' },
  { id: 'profiles', label: 'البروفايلات', icon: '📦', description: 'ملفات المحرك' },
  { id: 'candidates', label: 'المرشحات', icon: '💡', description: 'قواعد مقترحة' },
  { id: 'export', label: 'التصدير', icon: '💾', description: 'تصدير واستيراد' },
];

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('rules');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Engine Studio</h1>
              <p className="text-sm text-gray-500">
                مركز إعداد وتعليم المحرك — قرارات الدمج والأولوية والسياسات
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                البروفايل النشط: الافتراضي
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-l border-gray-200 bg-white">
          <nav className="p-4">
            <ul className="space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-right transition-colors ${
                      activeTab === tab.id
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{tab.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{tab.label}</div>
                      <div className="text-xs text-gray-500">{tab.description}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <RuleExplorer
                selectedRuleId={selectedRuleId}
                onSelectRule={setSelectedRuleId}
              />
              {selectedRuleId && (
                <RuleBuilder
                  ruleId={selectedRuleId}
                  onClose={() => setSelectedRuleId(null)}
                />
              )}
            </div>
          )}

          {activeTab === 'matrix' && <MergeMatrix />}
          {activeTab === 'priority' && <PrioritySystem />}
          {activeTab === 'pipeline' && <PipelineViewer />}
          {activeTab === 'trace' && <DecisionTrace />}
          {activeTab === 'profiles' && <ProfileManager />}
          {activeTab === 'candidates' && <CandidateRules />}
          {activeTab === 'export' && <ConfigExportImport />}
        </main>
      </div>
    </div>
  );
}

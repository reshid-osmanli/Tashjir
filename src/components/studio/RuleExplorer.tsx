'use client';

// مستكشف القواعد - Rule Explorer
// FR-ES-07: شجرة/قائمة قواعد مصنفة مع بحث وتصفية وترتيب

import { useState, useMemo } from 'react';
import { useEngineStudioStore } from '@/stores/engine-studio-store';
import type { EngineRule, EngineRuleCategory, RuleStatus } from '@/lib/tashjeer/model/v8';

interface RuleExplorerProps {
  selectedRuleId: string | null;
  onSelectRule: (ruleId: string) => void;
}

const categoryLabels: Record<EngineRuleCategory, string> = {
  DETECTION: 'كشف',
  DIFFERENCE: 'اختلاف',
  VARIANT: 'وجه',
  MERGE: 'دمج',
  SPLIT: 'فصل',
  ORDERING: 'ترتيب',
  RELATION: 'علاقة',
  CONTEXT: 'سياق',
  WAQF: 'وقف',
  WASL: 'وصل',
  IBTIDA: 'ابتداء',
  EXCEPTION: 'استثناء',
  OVERRIDE: 'تجاوز',
  VALIDATION: 'تحقق',
};

const statusLabels: Record<RuleStatus, string> = {
  DRAFT: 'مسودة',
  ACTIVE: 'نشطة',
  DISABLED: 'معطلة',
  DEPRECATED: 'مهجورة',
  CONFLICTED: 'متعارضة',
  EXPERIMENTAL: 'تجريبية',
};

const statusColors: Record<RuleStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  DISABLED: 'bg-red-100 text-red-700',
  DEPRECATED: 'bg-orange-100 text-orange-700',
  CONFLICTED: 'bg-yellow-100 text-yellow-700',
  EXPERIMENTAL: 'bg-blue-100 text-blue-700',
};

export function RuleExplorer({ selectedRuleId, onSelectRule }: RuleExplorerProps) {
  const { getActiveConfig, createRule, deleteRule, duplicateRule } = useEngineStudioStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<EngineRuleCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'ALL'>('ALL');

  const config = getActiveConfig();
  const rules = config.rules;

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      const matchesSearch =
        searchQuery === '' ||
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'ALL' || rule.category === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || rule.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [rules, searchQuery, categoryFilter, statusFilter]);

  const handleCreateRule = () => {
    const id = createRule({
      name: 'قاعدة جديدة',
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
    onSelectRule(id);
  };

  const handleDuplicate = (ruleId: string) => {
    const newId = duplicateRule(ruleId);
    if (newId) onSelectRule(newId);
  };

  const handleDelete = (ruleId: string) => {
    if (confirm('هل أنت متأكد من حذف هذه القاعدة؟')) {
      deleteRule(ruleId);
      if (selectedRuleId === ruleId) onSelectRule('');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            القواعد ({filteredRules.length} / {rules.length})
          </h2>
          <button
            type="button"
            onClick={handleCreateRule}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + قاعدة جديدة
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="بحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EngineRuleCategory | 'ALL')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">كل الفئات</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RuleStatus | 'ALL')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">كل الحالات</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rules List */}
      <div className="max-h-[600px] overflow-y-auto">
        {filteredRules.length === 0 ? (
          <div className="p-8 text-center text-gray-500">لا توجد قواعد مطابقة</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredRules.map((rule) => (
              <RuleItem
                key={rule.id}
                rule={rule}
                isSelected={selectedRuleId === rule.id}
                onSelect={() => onSelectRule(rule.id)}
                onDuplicate={() => handleDuplicate(rule.id)}
                onDelete={() => handleDelete(rule.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface RuleItemProps {
  rule: EngineRule;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function RuleItem({ rule, isSelected, onSelect, onDuplicate, onDelete }: RuleItemProps) {
  return (
    <li
      className={`cursor-pointer p-4 transition-colors ${
        isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{rule.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[rule.status]}`}>
              {statusLabels[rule.status]}
            </span>
            {rule.protected && <span className="text-xs text-gray-500">🔒</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="rounded bg-gray-100 px-2 py-0.5">{categoryLabels[rule.category]}</span>
            <span>أولوية: {rule.priority}</span>
            <span>إصدار: v{rule.version}</span>
            <span className="font-mono">{rule.id}</span>
          </div>
          {rule.testCases && rule.testCases.length > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              {rule.testCases.length} حالة اختبار
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="نسخ"
          >
            📋
          </button>
          {!rule.protected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              title="حذف"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// مستكشف القواعد — Rule Explorer (FR-ES-07)
// مشروع التشجير - نظام القراءات العشر
//
// قائمة القواعد مع بحث وتصفية وفرز (بالأولوية/الحالة/الفئة)، وقائمة قابلة
// للتمرير (FR-ED-01) لاحتواء مئات القواعد. اختيار قاعدة يفتحها في المنشئ.

'use client';

import { useMemo, useState } from 'react';
import type { EngineRule, RuleStatus } from '@/lib/tashjeer/model/v8';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_BADGE_CLASSES } from './labels';

type SortKey = 'priority' | 'name' | 'status';

interface RuleExplorerProps {
  rules: EngineRule[];
  selectedRuleId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function RuleExplorer({ rules, selectedRuleId, onSelect, onCreate }: RuleExplorerProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('priority');

  const categories = useMemo(() => {
    const set = new Set(rules.map((rule) => rule.category));
    return ['ALL', ...Array.from(set)];
  }, [rules]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim();
    const result = rules.filter((rule) => {
      if (statusFilter !== 'ALL' && rule.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && rule.category !== categoryFilter) return false;
      if (normalizedQuery && !rule.name.includes(normalizedQuery) && !rule.id.includes(normalizedQuery)) return false;
      return true;
    });
    result.sort((a, b) => {
      if (sortKey === 'priority') return b.priority - a.priority || a.id.localeCompare(b.id);
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'ar');
      return a.status.localeCompare(b.status) || a.id.localeCompare(b.id);
    });
    return result;
  }, [rules, query, statusFilter, categoryFilter, sortKey]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* رأس ثابت: بحث وتصفية وفرز */}
      <div className="space-y-3 border-b border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">القواعد ({filtered.length})</h3>
          <button type="button" onClick={onCreate} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
            قاعدة جديدة
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث بالاسم أو المعرّف..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as RuleStatus | 'ALL')}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">كل الحالات</option>
            {(Object.keys(STATUS_LABELS) as RuleStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'ALL' ? 'كل الفئات' : CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
              </option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="priority">الأولوية</option>
            <option value="name">الاسم</option>
            <option value="status">الحالة</option>
          </select>
        </div>
      </div>

      {/* قائمة قابلة للتمرير */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">لا قواعد مطابقة.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((rule) => (
              <li key={rule.id}>
                <button
                  type="button"
                  onClick={() => onSelect(rule.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-emerald-50 ${
                    selectedRuleId === rule.id ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{rule.name}</p>
                    <p className="truncate text-xs text-gray-400">
                      {CATEGORY_LABELS[rule.category]} · {rule.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                      {rule.priority}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[rule.status]}`}>
                      {STATUS_LABELS[rule.status]}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

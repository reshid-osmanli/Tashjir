'use client';

// عرض القواعد في قائمة الاختلافات - FR-ED-15
// القواعد العامة تظهر كعناصر مستقلة قابلة للتحديد والتعديل

import { useMemo } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useEngineStudioStore } from '@/stores/engine-studio-store';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface RulesInDifferencesListProps {
  ayahKey: number;
  onNavigateToStudio?: (ruleId: string) => void;
}

export function RulesInDifferencesList({
  ayahKey,
  onNavigateToStudio,
}: RulesInDifferencesListProps) {
  const document = useEditorStore((state) => state.document);
  const rules = useEngineStudioStore((state) => state.rules);

  // البحث عن القواعد التي تطبق على هذه الآية.
  const applicableRules = useMemo(() => {
    if (!document) return [];

    return rules.filter((rule) => {
      // القواعد العامة (scope = MUSHAF) تنطبق على كل الآيات.
      if (rule.scope === 'MUSHAF') return true;

      // القواعد الخاصة بالسورة.
      if (rule.scope === 'SURAH' && rule.metadata?.surahNumber === document.surahNumber) {
        return true;
      }

      // القواعد الخاصة بالآية.
      if (rule.scope === 'AYAH' && rule.metadata?.ayahKeys?.includes(ayahKey)) {
        return true;
      }

      return false;
    });
  }, [document, rules, ayahKey]);

  if (applicableRules.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-purple-900">
        القواعد المطبقة ({toArabicDigits(applicableRules.length)})
      </h3>

      <div className="space-y-2">
        {applicableRules.map((rule) => (
          <RuleItem
            key={rule.id}
            rule={rule}
            onNavigate={() => onNavigateToStudio?.(rule.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface RuleItemProps {
  rule: any; // EngineRule
  onNavigate: () => void;
}

function RuleItem({ rule, onNavigate }: RuleItemProps) {
  const categoryLabel = CATEGORY_LABELS[rule.category as keyof typeof CATEGORY_LABELS] || rule.category;
  const categoryColor = getCategoryColor(rule.category);
  const categorySoftColor = getCategorySoftColor(rule.category);

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-purple-200 bg-white p-3 transition-colors hover:border-purple-300 hover:bg-purple-50"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-medium text-gray-900">{rule.name}</span>
          {rule.enabled ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              مفعّلة
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              معطّلة
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
          <span
            className="rounded px-1.5 py-0.5"
            style={{ backgroundColor: categorySoftColor, color: categoryColor }}
          >
            {categoryLabel}
          </span>
          <span>أولوية: {toArabicDigits(rule.priority)}</span>
          <span>النطاق: {rule.scope}</span>
        </div>

        {rule.description && (
          <p className="mt-1 text-xs text-gray-500">{rule.description}</p>
        )}
      </div>

      <button
        onClick={onNavigate}
        className="ml-3 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-200"
      >
        فتح في الاستوديو ←
      </button>
    </div>
  );
}

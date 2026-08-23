'use client';

// عرض القواعد في قائمة الاختلافات - FR-ED-15
// القاعدة كيان مستقل يصل إليه المحرر والاستوديو بالتحديد الموحد نفسه.

import { useMemo } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useEngineStudioStore } from '@/stores/engine-studio-store';
import { useSelectionStore } from '@/stores/selection-store';
import type { EngineRule } from '@/lib/tashjeer/model/v8';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import type { VariantCategory } from '@/types';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface RulesInDifferencesListProps {
  ayahKey: number;
  onNavigateToStudio?: (ruleId: string) => void;
}

const policyCategoryLabels: Record<string, string> = {
  DETECTION: 'كشف', DIFFERENCE: 'اختلاف', VARIANT: 'وجه', MERGE: 'دمج', SPLIT: 'فصل',
  ORDERING: 'ترتيب', RELATION: 'علاقة', CONTEXT: 'سياق', WAQF: 'وقف', WASL: 'وصل',
  IBTIDA: 'ابتداء', EXCEPTION: 'استثناء', OVERRIDE: 'تجاوز', VALIDATION: 'تحقق',
  CORRECTION_BASED: 'تصحيح مرجعي',
};

function isVariantCategory(category: string): category is VariantCategory {
  return category in CATEGORY_LABELS;
}

function isApplicable(rule: EngineRule, ayahKey: number, surahNumber: number): boolean {
  const scope = rule.scope ?? 'MUSHAF';
  if (scope === 'MUSHAF') return true;
  if (scope === 'SURAH') return rule.metadata?.surahNumber === undefined || rule.metadata.surahNumber === surahNumber;
  if (scope === 'AYAH') return !rule.metadata?.ayahKeys || rule.metadata.ayahKeys.includes(ayahKey);
  // قواعد الكلمة والحرف والمدى تظهر عند الآية التي فُتح لها المحرر؛ الحسم
  // الفعلي للمطابقة يظل من مسؤولية Decision Resolver.
  return true;
}

export function RulesInDifferencesList({ ayahKey, onNavigateToStudio }: RulesInDifferencesListProps) {
  const document = useEditorStore((state) => state.document);
  const rules = useEngineStudioStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId)?.config.rules ?? []
  );
  const select = useSelectionStore((state) => state.select);

  const applicableRules = useMemo(() => {
    if (!document) return [];
    return rules
      .filter((rule) => isApplicable(rule, ayahKey, document.surahNumber))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'ar'));
  }, [document, rules, ayahKey]);

  if (applicableRules.length === 0) return null;

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
            onSelect={() => select({ kind: 'RULE', id: rule.id }, 'differences-list')}
            onNavigate={() => onNavigateToStudio?.(rule.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RuleItem({ rule, onSelect, onNavigate }: { rule: EngineRule; onSelect: () => void; onNavigate: () => void }) {
  const category = rule.category;
  const isDataCategory = isVariantCategory(category);
  const categoryLabel = isDataCategory ? CATEGORY_LABELS[category] : policyCategoryLabels[category] ?? category;
  const categoryColor = isDataCategory ? getCategoryColor(category) : '#7e22ce';
  const categorySoftColor = isDataCategory ? getCategorySoftColor(category) : '#f3e8ff';
  const enabled = rule.enabled !== false && rule.status !== 'DISABLED' && rule.status !== 'DEPRECATED';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className="flex cursor-pointer items-center justify-between rounded-lg border border-purple-200 bg-white p-3 transition-colors hover:border-purple-300 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-medium text-gray-900">{rule.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {enabled ? 'مفعّلة' : 'غير مفعّلة'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
          <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: categorySoftColor, color: categoryColor }}>
            {categoryLabel}
          </span>
          <span>أولوية: {toArabicDigits(rule.priority)}</span>
          <span>النطاق: {rule.scope ?? 'MUSHAF'}</span>
        </div>
        {rule.description && <p className="mt-1 text-xs text-gray-500">{rule.description}</p>}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onNavigate();
        }}
        className="ms-3 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-200"
      >
        فتح في الاستوديو ←
      </button>
    </div>
  );
}

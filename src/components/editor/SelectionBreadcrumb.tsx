'use client';

// سلسلة سياق التحديد - Selection Breadcrumb
// FR-ED-02.2: تحديد متعدد المستويات مع سلسلة سياق
//
// مثال: الآية 2:4 ← Line 25 ← Segment X ← Difference Y ← Variant Z

import { useSelectionStore, type BreadcrumbItem } from '@/stores/selection-store';

const kindLabels: Record<string, string> = {
  WORD: 'كلمة',
  CHARACTER: 'حرف',
  LOCUS: 'موضع',
  LINE: 'سطر',
  SEGMENT: 'جزء',
  DIFFERENCE: 'اختلاف',
  FACE: 'وجه',
  RULE: 'قاعدة',
  COMPOSITE_FACE: 'وجه مركب',
  WAQF_MARK: 'علامة وقف',
};

interface SelectionBreadcrumbProps {
  /** استدعاء عند النقر على عنصر في السلسلة. */
  onNavigate?: (item: BreadcrumbItem) => void;
}

export function SelectionBreadcrumb({ onNavigate }: SelectionBreadcrumbProps) {
  const breadcrumb = useSelectionStore((state) => state.breadcrumb);
  const select = useSelectionStore((state) => state.select);

  if (breadcrumb.length === 0) return null;

  const handleClick = (item: BreadcrumbItem) => {
    if (onNavigate) {
      onNavigate(item);
    } else {
      select({ kind: item.kind, id: item.id });
    }
  };

  return (
    <nav className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
      {breadcrumb.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1">
          {index > 0 && <span className="text-gray-400">←</span>}
          <button
            type="button"
            onClick={() => handleClick(item)}
            className={`flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
              index === breadcrumb.length - 1
                ? 'bg-emerald-100 font-medium text-emerald-800'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="text-gray-500">{kindLabels[item.kind] ?? item.kind}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}

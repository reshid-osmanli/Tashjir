'use client';

// لوحة التتبع الموحدة - FR-ED-16
// عرض Engine/Editor/Final لكل تصحيح

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';

type TrackingFilter = 'ALL' | 'ENGINE_ONLY' | 'EDITOR_ONLY' | 'CORRECTED';

export function UnifiedTrackingPanel() {
  const document = useEditorStore((state) => state.document);
  const [filter, setFilter] = useState<TrackingFilter>('ALL');
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string | null>(null);

  // بناء قائمة التتبع من التصحيحات.
  const trackingItems = useMemo(() => {
    if (!document?.corrections) return [];

    return document.corrections.map((correction) => {
      const hasEngineResult = correction.engineResult !== null && correction.engineResult !== undefined;
      const hasEditorResult = correction.editorResult !== null && correction.editorResult !== undefined;

      let status: 'ENGINE_ONLY' | 'EDITOR_ONLY' | 'CORRECTED' | 'UNKNOWN';
      if (hasEngineResult && hasEditorResult) {
        status = 'CORRECTED';
      } else if (hasEngineResult) {
        status = 'ENGINE_ONLY';
      } else if (hasEditorResult) {
        status = 'EDITOR_ONLY';
      } else {
        status = 'UNKNOWN';
      }

      return {
        correction,
        status,
        finalResult: correction.editorResult ?? correction.engineResult,
      };
    });
  }, [document]);

  // تطبيق الفلتر.
  const filteredItems = useMemo(() => {
    if (filter === 'ALL') return trackingItems;
    return trackingItems.filter((item) => item.status === filter);
  }, [trackingItems, filter]);

  // حساب الإحصائيات.
  const stats = useMemo(() => {
    const engineOnly = trackingItems.filter((i) => i.status === 'ENGINE_ONLY').length;
    const editorOnly = trackingItems.filter((i) => i.status === 'EDITOR_ONLY').length;
    const corrected = trackingItems.filter((i) => i.status === 'CORRECTED').length;
    return { engineOnly, editorOnly, corrected, total: trackingItems.length };
  }, [trackingItems]);

  if (!document) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
        لا يوجد مستند مفتوح
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900">التتبع الموحد</h2>
        <p className="mt-1 text-sm text-gray-600">
          عرض نتائج المحرك وقرارات المحرر والنتيجة النهائية
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 border-b border-gray-200 p-4">
        <StatCard
          label="المحرك فقط"
          value={stats.engineOnly}
          color="blue"
        />
        <StatCard
          label="المحرر فقط"
          value={stats.editorOnly}
          color="amber"
        />
        <StatCard
          label="مصحّح"
          value={stats.corrected}
          color="green"
        />
        <StatCard
          label="الإجمالي"
          value={stats.total}
          color="gray"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b border-gray-200 p-4">
        <FilterButton
          label="الكل"
          count={stats.total}
          active={filter === 'ALL'}
          onClick={() => setFilter('ALL')}
        />
        <FilterButton
          label="المحرك"
          count={stats.engineOnly}
          active={filter === 'ENGINE_ONLY'}
          onClick={() => setFilter('ENGINE_ONLY')}
        />
        <FilterButton
          label="المحرر"
          count={stats.editorOnly}
          active={filter === 'EDITOR_ONLY'}
          onClick={() => setFilter('EDITOR_ONLY')}
        />
        <FilterButton
          label="مصحّح"
          count={stats.corrected}
          active={filter === 'CORRECTED'}
          onClick={() => setFilter('CORRECTED')}
        />
      </div>

      {/* Items List */}
      <div className="max-h-[500px] overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            لا توجد عناصر مطابقة للفلتر
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <TrackingItem
                key={item.correction.id}
                item={item}
                isSelected={selectedCorrectionId === item.correction.id}
                onSelect={() => setSelectedCorrectionId(item.correction.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: 'blue' | 'amber' | 'green' | 'gray';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{toArabicDigits(value)}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

interface FilterButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function FilterButton({ label, count, active, onClick }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label} ({toArabicDigits(count)})
    </button>
  );
}

interface TrackingItemProps {
  item: {
    correction: any;
    status: string;
    finalResult: any;
  };
  isSelected: boolean;
  onSelect: () => void;
}

function TrackingItem({ item, isSelected, onSelect }: TrackingItemProps) {
  const { correction, status, finalResult } = item;

  const statusConfig = {
    ENGINE_ONLY: {
      label: 'المحرك',
      color: 'blue',
      icon: '🤖',
    },
    EDITOR_ONLY: {
      label: 'المحرر',
      color: 'amber',
      icon: '✏️',
    },
    CORRECTED: {
      label: 'مصحّح',
      color: 'green',
      icon: '✓',
    },
    UNKNOWN: {
      label: 'غير معروف',
      color: 'gray',
      icon: '?',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.UNKNOWN;

  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    amber: 'border-amber-200 bg-amber-50',
    green: 'border-green-200 bg-green-50',
    gray: 'border-gray-200 bg-gray-50',
  };

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
        isSelected
          ? `${colorClasses[config.color as keyof typeof colorClasses]} ring-2 ring-blue-500`
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="font-medium text-gray-900">
            {correction.targetType === 'VARIANT' ? 'اختلاف' : 'سطر'}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              config.color === 'blue'
                ? 'bg-blue-100 text-blue-700'
                : config.color === 'amber'
                ? 'bg-amber-100 text-amber-700'
                : config.color === 'green'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {config.label}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {new Date(correction.timestamp).toLocaleString('ar-SA')}
        </span>
      </div>

      {/* Three-way comparison */}
      {isSelected && (
        <div className="mt-3 space-y-2">
          {/* Engine Result */}
          {correction.engineResult && (
            <div className="rounded border border-blue-200 bg-blue-50 p-2">
              <div className="text-xs font-medium text-blue-900">🤖 نتيجة المحرك</div>
              <div className="mt-1 text-sm text-blue-800">
                {formatResult(correction.engineResult)}
              </div>
            </div>
          )}

          {/* Editor Result */}
          {correction.editorResult && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2">
              <div className="text-xs font-medium text-amber-900">✏️ قرار المحرر</div>
              <div className="mt-1 text-sm text-amber-800">
                {formatResult(correction.editorResult)}
              </div>
            </div>
          )}

          {/* Final Result */}
          <div className="rounded border border-green-200 bg-green-50 p-2">
            <div className="text-xs font-medium text-green-900">✓ النتيجة النهائية</div>
            <div className="mt-1 text-sm text-green-800">
              {formatResult(finalResult)}
            </div>
          </div>

          {/* Reason */}
          {correction.reason && (
            <div className="rounded border border-gray-200 bg-gray-50 p-2">
              <div className="text-xs font-medium text-gray-700">السبب</div>
              <div className="mt-1 text-sm text-gray-600">{correction.reason}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatResult(result: any): string {
  if (!result) return 'لا يوجد';
  if (typeof result === 'string') return result;
  if (result.title) return result.title;
  if (result.text) return result.text;
  return JSON.stringify(result);
}

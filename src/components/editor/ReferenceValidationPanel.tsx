'use client';

// لوحة التحقق المرجعي - FR-ES-12
// مقارنة نتائج المحرك بالبيانات المرجعية المعتمدة

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { validateAgainstReference, type ValidationReport } from '@/lib/tashjeer/learning-loop';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

export function ReferenceValidationPanel() {
  const document = useEditorStore((state) => state.document);
  const [showDetails, setShowDetails] = useState(false);

  // مقارنة المحرك بالمرجع.
  const report = useMemo((): ValidationReport | null => {
    if (!document) return null;

    // في التطبيق الفعلي، سيتم تحميل البيانات المرجعية من ملف أو API.
    // هنا نستخدم الاختلافات الحالية كمرجع للتوضيح.
    const engineVariants = document.variants.filter((v) => v.origin === 'ENGINE');
    const editorVariants = document.variants.filter((v) => v.origin === 'EDITOR');
    const referenceVariants = document.variants.filter((v) => v.status === 'APPROVED');

    return validateAgainstReference(engineVariants, referenceVariants, editorVariants);
  }, [document]);

  if (!document || !report) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
        لا يوجد مستند مفتوح
      </div>
    );
  }

  const accuracyColor =
    report.accuracy >= 90
      ? 'text-green-600'
      : report.accuracy >= 70
      ? 'text-amber-600'
      : 'text-red-600';

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900">التحقق المرجعي</h2>
        <p className="mt-1 text-sm text-gray-600">
          مقارنة نتائج المحرك بالبيانات المرجعية المعتمدة
        </p>
      </div>

      {/* Accuracy Score */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-600">دقة المحرك</div>
            <div className={`text-4xl font-bold ${accuracyColor}`}>
              {toArabicDigits(Math.round(report.accuracy))}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-600">إجمالي العناصر</div>
            <div className="text-2xl font-bold text-gray-900">
              {toArabicDigits(report.totalItems)}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-2 border-b border-gray-200 p-4">
        <ValidationStat
          label="صحيح"
          value={report.correct}
          color="green"
          icon="✓"
        />
        <ValidationStat
          label="خاطئ"
          value={report.wrong}
          color="red"
          icon="✗"
        />
        <ValidationStat
          label="مفقود"
          value={report.missing}
          color="amber"
          icon="?"
        />
        <ValidationStat
          label="إضافي"
          value={report.extra}
          color="blue"
          icon="+"
        />
        <ValidationStat
          label="تعارض"
          value={report.conflict}
          color="purple"
          icon="!"
        />
      </div>

      {/* Details Toggle */}
      <div className="p-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          {showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'} ({toArabicDigits(report.items.length)} عنصر)
        </button>
      </div>

      {/* Details List */}
      {showDetails && (
        <div className="max-h-[400px] overflow-y-auto border-t border-gray-200 p-4">
          <div className="space-y-2">
            {report.items.map((item, index) => (
              <ValidationItem key={index} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ValidationStatProps {
  label: string;
  value: number;
  color: 'green' | 'red' | 'amber' | 'blue' | 'purple';
  icon: string;
}

function ValidationStat({ label, value, color, icon }: ValidationStatProps) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className={`rounded-lg border p-2 text-center ${colorClasses[color]}`}>
      <div className="text-lg font-bold">
        {icon} {toArabicDigits(value)}
      </div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

interface ValidationItemProps {
  item: any;
}

function ValidationItem({ item }: ValidationItemProps) {
  const statusConfig = {
    CORRECT: {
      label: 'صحيح',
      color: 'green',
      icon: '✓',
      bgColor: 'bg-green-50 border-green-200',
    },
    WRONG: {
      label: 'خاطئ',
      color: 'red',
      icon: '✗',
      bgColor: 'bg-red-50 border-red-200',
    },
    MISSING: {
      label: 'مفقود',
      color: 'amber',
      icon: '?',
      bgColor: 'bg-amber-50 border-amber-200',
    },
    EXTRA: {
      label: 'إضافي',
      color: 'blue',
      icon: '+',
      bgColor: 'bg-blue-50 border-blue-200',
    },
    CONFLICT: {
      label: 'تعارض',
      color: 'purple',
      icon: '!',
      bgColor: 'bg-purple-50 border-purple-200',
    },
  };

  const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.WRONG;

  return (
    <div className={`rounded-lg border p-3 ${config.bgColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="font-medium text-gray-900">{item.variantTitle}</span>
          <span className="text-xs text-gray-500">
            آية {toArabicDigits(item.ayahKey % 1000)}
          </span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            config.color === 'green'
              ? 'bg-green-100 text-green-700'
              : config.color === 'red'
              ? 'bg-red-100 text-red-700'
              : config.color === 'amber'
              ? 'bg-amber-100 text-amber-700'
              : config.color === 'blue'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          }`}
        >
          {config.label}
        </span>
      </div>

      {/* Details */}
      <div className="mt-2 space-y-1 text-xs">
        {item.engineResult && (
          <div className="flex gap-2">
            <span className="font-medium text-gray-600">المحرك:</span>
            <span className="text-gray-800">{item.engineResult}</span>
          </div>
        )}
        {item.referenceResult && (
          <div className="flex gap-2">
            <span className="font-medium text-gray-600">المرجع:</span>
            <span className="text-gray-800">{item.referenceResult}</span>
          </div>
        )}
        {item.editorResult && (
          <div className="flex gap-2">
            <span className="font-medium text-gray-600">المحرر:</span>
            <span className="text-gray-800">{item.editorResult}</span>
          </div>
        )}
        {item.reason && (
          <div className="flex gap-2">
            <span className="font-medium text-gray-600">السبب:</span>
            <span className="text-gray-800">{item.reason}</span>
          </div>
        )}
      </div>
    </div>
  );
}

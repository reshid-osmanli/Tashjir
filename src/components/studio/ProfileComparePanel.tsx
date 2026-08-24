// مقارنة ملفات المحرك — Profile Compare Panel (FR-ES-11)
// مشروع التشجير - نظام القراءات العشر
//
// يقارن ملف المحرك الحالي بالملف الافتراضي للنظام على أزواج العناصر الشائعة،
// ويصنّف النتائج: متطابق / متغيّر / متحسّن / متراجع. يساعد على تقرير ما إذا كان
// تعديل الملف آمنًا للاعتماد (لا تراجع عن المرجع). كل المنطق في الوحدة النقيّة
// المختبرة profile-compare.ts (لا منطق مكرر — P-07).

'use client';

import { useMemo } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import { compareProfiles, isSafeToAdopt, DEFAULT_COMPARE_INPUTS } from '@/lib/tashjeer/decision/profile-compare';
import { DIFFERENCE_TYPE_LABELS } from './labels';

interface ProfileComparePanelProps {
  config: EngineConfig;
}

const CLASS_LABELS: Record<string, string> = {
  SAME: 'متطابق',
  CHANGED: 'متغيّر',
  IMPROVED: 'متحسّن',
  REGRESSED: 'متراجع',
};

const CLASS_TONES: Record<string, string> = {
  SAME: 'bg-gray-100 text-gray-600',
  CHANGED: 'bg-amber-100 text-amber-700',
  IMPROVED: 'bg-emerald-100 text-emerald-700',
  REGRESSED: 'bg-red-100 text-red-700',
};

export function ProfileComparePanel({ config }: ProfileComparePanelProps) {
  const report = useMemo(() => compareProfiles(DEFAULT_SYSTEM_PROFILE, config), [config]);
  const safe = isSafeToAdopt(report);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">مقارنة بالملف الافتراضي</h3>
        <p className="mt-1 text-sm text-gray-500">
          يقارن قرارات ملفك الحالي بسياسات النظام الافتراضية على الأزواج الشائعة. «متحسّن/متراجع» يحتاج مرجعًا معتمدًا (FR-ES-11).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="متطابق" value={report.same} tone="gray" />
        <Stat label="متغيّر" value={report.changed} tone="amber" />
        <Stat label="متحسّن" value={report.improved} tone="emerald" />
        <Stat label="متراجع" value={report.regressed} tone={report.regressed > 0 ? 'red' : 'gray'} />
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          safe ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
        }`}
      >
        {safe
          ? 'لا تراجع عن المرجع — الملف آمن للاعتماد.'
          : `يوجد ${report.regressed} موضعًا تراجعت فيه عن المرجع. راجعها قبل الاعتماد.`}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-right text-gray-500">
              <th className="px-3 py-2 font-medium">الزوج</th>
              <th className="px-3 py-2 font-medium">الافتراضي</th>
              <th className="px-3 py-2 font-medium">الحالي</th>
              <th className="px-3 py-2 font-medium">التصنيف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.items.map((item) => {
              const input = DEFAULT_COMPARE_INPUTS.find((entry) => entry.id === item.id);
              return (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    {DIFFERENCE_TYPE_LABELS[input?.differenceType ?? ''] ?? input?.differenceType} +{' '}
                    {DIFFERENCE_TYPE_LABELS[input?.relatedType ?? ''] ?? input?.relatedType}
                  </td>
                  <td className="px-3 py-2">{item.aMerge ? 'دمج' : 'فصل'}</td>
                  <td className="px-3 py-2">{item.bMerge ? 'دمج' : 'فصل'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASS_TONES[item.class]}`}>
                      {CLASS_LABELS[item.class]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'red' | 'amber' | 'gray' }) {
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

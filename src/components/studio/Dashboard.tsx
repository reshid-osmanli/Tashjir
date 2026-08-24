// لوحة معلومات المحرك — Engine Decision Dashboard (FR-ES-13)
// مشروع التشجير - نظام القراءات العشر
//
// نظرة عامة على ملف المحرك: عدد القواعد، المفعّل منها، حالات القواعد، حجم
// مصفوفة الدمج. بيانات وصفية فقط لا تغيّر النتيجة تلقائيًا.

'use client';

import { useMemo } from 'react';
import type { EngineConfig, RuleStatus } from '@/lib/tashjeer/model/v8';
import { auditProfile } from '@/lib/tashjeer/decision/profile-audit';
import { STATUS_LABELS } from './labels';

interface DashboardProps {
  config: EngineConfig;
}

export function Dashboard({ config }: DashboardProps) {
  const stats = useMemo(() => {
    const byStatus = new Map<RuleStatus, number>();
    let active = 0;
    for (const rule of config.rules) {
      byStatus.set(rule.status, (byStatus.get(rule.status) ?? 0) + 1);
      if (rule.status === 'ACTIVE') active += 1;
    }
    return {
      total: config.rules.length,
      active,
      byStatus,
      mergeEntries: config.mergeMatrix.length,
      groups: config.priorityGroups.length,
    };
  }, [config]);

  const audit = useMemo(() => auditProfile(config), [config]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="إجمالي القواعد" value={stats.total} tone="emerald" />
        <StatCard label="قواعد مفعّلة" value={stats.active} tone="emerald" />
        <StatCard label="صفوف مصفوفة الدمج" value={stats.mergeEntries} tone="blue" />
        <StatCard label="مشكلات في الفحص" value={audit.issueCount} tone={audit.issueCount > 0 ? 'amber' : 'emerald'} />
      </div>

      {audit.issueCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="font-bold text-amber-900">فحص الملف</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
            {audit.priorityCollisions.length > 0 && (
              <li>
                تصادم أولويات: {audit.priorityCollisions.length} مجموعة فيها قواعد تتساوى بالأولوية داخل المجموعة.
              </li>
            )}
            {audit.catchAllRules.length > 0 && (
              <li>قواعد شاملة بلا شروط: {audit.catchAllRules.length} (تطابق كل سياق).</li>
            )}
            {audit.mergeConflicts.length > 0 && (
              <li>
                تعارض أفعال دمج: {audit.mergeConflicts.length} (قاعدة تسمح وأخرى تمنع على نفس النوع) — راجعها في سلم
                حل التعارض.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-bold text-gray-900">توزيع القواعد حسب الحالة</h3>
        {stats.total === 0 ? (
          <p className="text-sm text-gray-400">لا قواعد بعد.</p>
        ) : (
          <div className="space-y-2">
            {Array.from(stats.byStatus.entries()).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-28 text-sm text-gray-600">{STATUS_LABELS[status]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${stats.total === 0 ? 0 : (count / stats.total) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-sm font-medium text-gray-700">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'blue' | 'amber' }) {
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

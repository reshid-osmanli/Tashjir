// مصفوفة الدمج — Merge Matrix (FR-ES-05)
// مشروع التشجير - نظام القراءات العشر
//
// جدول قابل للتحرير الرسومي يقرر متى يُدمج عنصران ومتى لا يُدمجان، بأولوية
// وسبب. كل قرارات الدمج في المحرر والمحرك تصدر عن هذه المصفوفة عبر Decision
// Resolver (P-07).

'use client';

import { useState } from 'react';
import type { MergeMatrixEntry } from '@/lib/tashjeer/model/v8';
import { DIFFERENCE_TYPES, DIFFERENCE_TYPE_LABELS } from './labels';

interface MergeMatrixPanelProps {
  matrix: MergeMatrixEntry[];
  onAdd: (entry: MergeMatrixEntry) => void;
  onUpdate: (index: number, patch: Partial<MergeMatrixEntry>) => void;
  onRemove: (index: number) => void;
}

export function MergeMatrixPanel({ matrix, onAdd, onUpdate, onRemove }: MergeMatrixPanelProps) {
  const [draft, setDraft] = useState<MergeMatrixEntry>({
    a: 'MADD',
    b: 'TAHQIQ',
    merge: true,
    priority: 70,
    reason: '',
  });

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">مصفوفة الدمج</h3>
        <p className="mt-1 text-sm text-gray-500">
          متى يُدمج عنصران ومتى لا يُدمجان. البحث غير حساس لترتيب العنصرين، والأعلى أولوية يفوز عند التعارض.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-right text-gray-500">
              <th className="px-3 py-2 font-medium">العنصر أ</th>
              <th className="px-3 py-2 font-medium">العنصر ب</th>
              <th className="px-3 py-2 font-medium">الدمج</th>
              <th className="px-3 py-2 font-medium">الأولوية</th>
              <th className="px-3 py-2 font-medium">السبب</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matrix.map((entry, index) => (
              <tr key={`${entry.a}-${entry.b}-${index}`} className="hover:bg-gray-50">
                <td className="px-3 py-2">{DIFFERENCE_TYPE_LABELS[entry.a] ?? entry.a}</td>
                <td className="px-3 py-2">{DIFFERENCE_TYPE_LABELS[entry.b] ?? entry.b}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onUpdate(index, { merge: !entry.merge })}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      entry.merge ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {entry.merge ? 'ادمج' : 'لا تدمج'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={entry.priority}
                    onChange={(event) => onUpdate(index, { priority: Number(event.target.value) })}
                    className="w-16 rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={entry.reason}
                    onChange={(event) => onUpdate(index, { reason: event.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </td>
                <td className="px-3 py-2 text-left">
                  <button type="button" onClick={() => onRemove(index)} className="rounded px-2 py-1 text-red-600 hover:bg-red-50">
                    حذف
                  </button>
                </td>
              </tr>
            ))}
            {matrix.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-400">
                  لا صفوف بعد. أضف صفًا بالأسفل.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* إضافة صف */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">العنصر أ</label>
          <select
            value={draft.a}
            onChange={(event) => setDraft((current) => ({ ...current, a: event.target.value }))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {DIFFERENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {DIFFERENCE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">العنصر ب</label>
          <select
            value={draft.b}
            onChange={(event) => setDraft((current) => ({ ...current, b: event.target.value }))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {DIFFERENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {DIFFERENCE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">الدمج</label>
          <select
            value={draft.merge ? 'yes' : 'no'}
            onChange={(event) => setDraft((current) => ({ ...current, merge: event.target.value === 'yes' }))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="yes">ادمج</option>
            <option value="no">لا تدمج</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">الأولوية</label>
          <input
            type="number"
            value={draft.priority}
            onChange={(event) => setDraft((current) => ({ ...current, priority: Number(event.target.value) }))}
            className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="block text-xs text-gray-500">السبب</label>
          <input
            type="text"
            value={draft.reason}
            onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
            placeholder="مرتبطان / مستقلان / ..."
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            onAdd({ ...draft, reason: draft.reason.trim() || '—' });
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          إضافة
        </button>
      </div>
    </div>
  );
}

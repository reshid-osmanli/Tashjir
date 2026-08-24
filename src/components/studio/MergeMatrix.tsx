'use client';

// مصفوفة الدمج - Merge Matrix Editor
// FR-ES-05: نظام قرار الدمج ومصفوفة الدمج

import { useState } from 'react';
import { useEngineStudioStore } from '@/stores/engine-studio-store';

const elementTypes = [
  'MADD', 'TAHQIQ', 'WASL', 'FARSH', 'USUL', 'HAMZ', 'SILA', 'TASHEEL',
  'IMALA', 'ISHMAM', 'NAQL', 'IDGHAM', 'IKHFA', 'IQLAB', 'QALQALA',
];

const elementLabels: Record<string, string> = {
  MADD: 'مد',
  TAQIQ: 'تحقيق',
  TAHQIQ: 'تحقيق',
  WASL: 'صلة',
  FARSH: 'فرش',
  USUL: 'أصول',
  HAMZ: 'همز',
  SILA: 'صلة',
  TASHEEL: 'تسهيل',
  IMALA: 'إمالة',
  ISHMAM: 'إشمام',
  NAQL: 'نقل',
  IDGHAM: 'إدغام',
  IKHFA: 'إخفاء',
  IQLAB: 'إقلاب',
  QALQALA: 'قلقلة',
};

export function MergeMatrix() {
  const { getActiveConfig, addMergeMatrixEntry, updateMergeMatrixEntry, removeMergeMatrixEntry } =
    useEngineStudioStore();
  const config = getActiveConfig();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newA, setNewA] = useState('MADD');
  const [newB, setNewB] = useState('TAHQIQ');
  const [newMerge, setNewMerge] = useState(true);
  const [newPriority, setNewPriority] = useState(80);
  const [newReason, setNewReason] = useState('');

  const handleAdd = () => {
    addMergeMatrixEntry({
      a: newA,
      b: newB,
      merge: newMerge,
      priority: newPriority,
      reason: newReason || `${elementLabels[newA] ?? newA} و${elementLabels[newB] ?? newB}`,
    });
    setShowAddForm(false);
    setNewReason('');
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">مصفوفة الدمج</h2>
          <p className="text-sm text-gray-500">
            تحديد متى يُدمج عنصران ومتى لا يُدمجان — قرارات الدمج تصدر عن هذه السياسات (FR-ES-05)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + إضافة صف
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-gray-700">العنصر أ</label>
              <select
                value={newA}
                onChange={(e) => setNewA(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {elementTypes.map((t) => (
                  <option key={t} value={t}>{elementLabels[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">العنصر ب</label>
              <select
                value={newB}
                onChange={(e) => setNewB(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {elementTypes.map((t) => (
                  <option key={t} value={t}>{elementLabels[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">القرار</label>
              <select
                value={newMerge ? 'yes' : 'no'}
                onChange={(e) => setNewMerge(e.target.value === 'yes')}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="yes">ادمج</option>
                <option value="no">لا تدمج</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">الأولوية</label>
              <input
                type="number"
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">السبب</label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="سبب القرار"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
            >
              إضافة
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right font-medium text-gray-700">العنصر أ</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">العنصر ب</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">القرار</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">الأولوية</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">السبب</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {config.mergeMatrix.map((entry, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{elementLabels[entry.a] ?? entry.a}</td>
                <td className="px-4 py-3 font-medium">{elementLabels[entry.b] ?? entry.b}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                      entry.merge
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {entry.merge ? 'ادمج' : 'لا تدمج'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-mono">{entry.priority}</td>
                <td className="px-4 py-3 text-gray-500">{entry.reason}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateMergeMatrixEntry(index, { merge: !entry.merge })}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title="عكس القرار"
                    >
                      🔄
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMergeMatrixEntry(index)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="حذف"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {config.mergeMatrix.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  المصفوفة فارغة — أضف قواعد الدمج
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

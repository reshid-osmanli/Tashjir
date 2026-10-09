// مصفوفة الدمج — Merge Matrix (FR-ES-05)
// مشروع التشجير - نظام القراءات العشر
//
// جدول قابل للتحرير الرسومي يقرر متى يُدمج عنصران ومتى لا يُدمجان، بأولوية
// وسبب. كل قرارات الدمج في المحرر والمحرك تصدر عن هذه المصفوفة عبر Decision
// Resolver (P-07).

'use client';

import { useState } from 'react';
import type { MergeMatrixEntry, RelationPolicyEntry, RelationPolicyKind } from '@/lib/tashjeer/model/v8';
import { createEntityId } from '@/lib/tashjeer/model/v8';
import { DIFFERENCE_TYPES, DIFFERENCE_TYPE_LABELS } from './labels';

// Immutable UI identity tables. Keys denote finite controls, never row positions.
const UI_MergeMatrixPanel_0 = {
  "MADD": "A1737",
  "TAHQIQ": "A1738",
  "WASL": "A1739",
  "FARSH": "A1740",
  "HAMZ": "A1741",
  "TAJWEED": "A1742"
} as const;

const UI_MergeMatrixPanel_1 = {
  "MADD": "A1744",
  "TAHQIQ": "A1745",
  "WASL": "A1746",
  "FARSH": "A1747",
  "HAMZ": "A1748",
  "TAJWEED": "A1749"
} as const;

const UI_MergeMatrixPanel_2 = {
  "RELATED": "A1759",
  "INDEPENDENT": "A1760",
  "PARENT_CHILD": "A1761",
  "MERGEABLE": "A1762",
  "MUTUALLY_EXCLUSIVE": "A1763"
} as const;

const UI_MergeMatrixPanel_3 = {
  "MADD": "A1768",
  "TAHQIQ": "A1769",
  "WASL": "A1770",
  "FARSH": "A1771",
  "HAMZ": "A1772",
  "TAJWEED": "A1773"
} as const;

const UI_MergeMatrixPanel_4 = {
  "MADD": "A1775",
  "TAHQIQ": "A1776",
  "WASL": "A1777",
  "FARSH": "A1778",
  "HAMZ": "A1779",
  "TAJWEED": "A1780"
} as const;

const UI_MergeMatrixPanel_5 = {
  "RELATED": "A1782",
  "INDEPENDENT": "A1783",
  "PARENT_CHILD": "A1784",
  "MERGEABLE": "A1785",
  "MUTUALLY_EXCLUSIVE": "A1786"
} as const;



interface MergeMatrixPanelProps {
  matrix: MergeMatrixEntry[];
  onAdd: (entry: MergeMatrixEntry) => void;
  onUpdate: (index: number, patch: Partial<MergeMatrixEntry>) => void;
  onRemove: (index: number) => void;
  relations?: RelationPolicyEntry[];
  onAddRelation?: (entry: RelationPolicyEntry) => void;
  onUpdateRelation?: (index: number, patch: Partial<RelationPolicyEntry>) => void;
  onRemoveRelation?: (index: number) => void;
}

const RELATION_LABELS: Record<RelationPolicyKind, string> = {
  RELATED: 'مترابطان',
  INDEPENDENT: 'مستقلان',
  PARENT_CHILD: 'أب ← ابن',
  MERGEABLE: 'قابلان للدمج',
  MUTUALLY_EXCLUSIVE: 'متنافيان',
};

export function MergeMatrixPanel({
  matrix,
  onAdd,
  onUpdate,
  onRemove,
  relations = [],
  onAddRelation,
  onUpdateRelation,
  onRemoveRelation,
}: MergeMatrixPanelProps) {
  const [draft, setDraft] = useState<MergeMatrixEntry>({
    a: 'MADD',
    b: 'TAHQIQ',
    merge: true,
    priority: 70,
    reason: '',
  });
  const [relationDraft, setRelationDraft] = useState<RelationPolicyEntry>({
    id: '',
    a: 'MADD',
    b: 'TAHQIQ',
    relation: 'RELATED',
    priority: 70,
    reason: '',
  });

  return (
    <div data-ui-id="A163" className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">مصفوفة الدمج</h3>
        <p className="mt-1 text-sm text-gray-500">
          متى يُدمج عنصران ومتى لا يُدمجان. البحث غير حساس لترتيب العنصرين، والأعلى أولوية يفوز عند التعارض.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table data-ui-id="A1729" className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-right text-gray-500">
              <th className="px-3 py-2 font-medium">العنصر أ</th>
              <th className="px-3 py-2 font-medium">العنصر ب</th>
              <th className="px-3 py-2 font-medium">الدمج</th>
              <th className="px-3 py-2 font-medium" title="مشروط: القيمة افتراض، والقواعد المطابقة للسياق تحسم">مشروط</th>
              <th className="px-3 py-2 font-medium">الأولوية</th>
              <th className="px-3 py-2 font-medium">السبب</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matrix.map((entry, index) => (
              <tr data-ui-id="A1730" key={`${entry.a}-${entry.b}-${index}`} className="hover:bg-gray-50">
                <td className="px-3 py-2">{DIFFERENCE_TYPE_LABELS[entry.a] ?? entry.a}</td>
                <td className="px-3 py-2">{DIFFERENCE_TYPE_LABELS[entry.b] ?? entry.b}</td>
                <td className="px-3 py-2">
                  <button data-ui-id="A1731"
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
                  <button data-ui-id="A1732"
                    type="button"
                    onClick={() => onUpdate(index, { conditional: !entry.conditional })}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      entry.conditional ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                    }`}
                    title={
                      entry.conditional
                        ? 'مشروط بالسياق: القواعد المطابقة (وقف/وصل/راوٍ...) تحسم، وهذه القيمة افتراض عند غيابها'
                        : 'غير مشروط: القيمة تُطبَّق دائما ما لم تتعارض قواعد الدمج'
                    }
                  >
                    {entry.conditional ? 'مشروط' : 'مطلق'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <input data-ui-id="A1733"
                    type="number"
                    value={entry.priority}
                    onChange={(event) => onUpdate(index, { priority: Number(event.target.value) })}
                    className="w-16 rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <input data-ui-id="A1734"
                    type="text"
                    value={entry.reason}
                    onChange={(event) => onUpdate(index, { reason: event.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </td>
                <td className="px-3 py-2 text-left">
                  <button data-ui-id="A1735" type="button" onClick={() => onRemove(index)} className="rounded px-2 py-1 text-red-600 hover:bg-red-50">
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
          <select data-ui-id="A1736"
            value={draft.a}
            onChange={(event) => setDraft((current) => ({ ...current, a: event.target.value }))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {DIFFERENCE_TYPES.map((type) => (
              <option data-ui-id={UI_MergeMatrixPanel_0[type as keyof typeof UI_MergeMatrixPanel_0]} key={type} value={type}>
                {DIFFERENCE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">العنصر ب</label>
          <select data-ui-id="A1743"
            value={draft.b}
            onChange={(event) => setDraft((current) => ({ ...current, b: event.target.value }))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {DIFFERENCE_TYPES.map((type) => (
              <option data-ui-id={UI_MergeMatrixPanel_1[type as keyof typeof UI_MergeMatrixPanel_1]} key={type} value={type}>
                {DIFFERENCE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">الدمج</label>
          <select data-ui-id="A1750"
            value={draft.merge ? 'yes' : 'no'}
            onChange={(event) => setDraft((current) => ({ ...current, merge: event.target.value === 'yes' }))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option data-ui-id="A1751" value="yes">ادمج</option>
            <option data-ui-id="A1752" value="no">لا تدمج</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-gray-500">الأولوية</label>
          <input data-ui-id="A1753"
            type="number"
            value={draft.priority}
            onChange={(event) => setDraft((current) => ({ ...current, priority: Number(event.target.value) }))}
            className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="block text-xs text-gray-500">السبب</label>
          <input data-ui-id="A1754"
            type="text"
            value={draft.reason}
            onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
            placeholder="مرتبطان / مستقلان / ..."
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button data-ui-id="A1755"
          type="button"
          onClick={() => {
            onAdd({ ...draft, reason: draft.reason.trim() || '—' });
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          إضافة
        </button>
      </div>

      {/* سياسات العلاقات بين الكيانات: مستقلة عن صفوف الدمج وتُقرأ عبر Resolver. */}
      <div className="space-y-3 border-t border-gray-100 pt-5">
        <div>
          <h4 className="font-bold text-gray-900">العلاقات بين الكيانات</h4>
          <p className="mt-1 text-sm text-gray-500">Related · Independent · Parent-Child · Mergeable · Mutually Exclusive. لا تُنسخ السياسة إلى مواضع الآيات.</p>
        </div>
        {relations.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table data-ui-id="A1756" className="w-full text-sm">
              <thead className="bg-gray-50 text-right text-gray-500">
                <tr><th className="px-2 py-1.5">أ</th><th className="px-2 py-1.5">ب</th><th className="px-2 py-1.5">العلاقة</th><th className="px-2 py-1.5">الأولوية</th><th className="px-2 py-1.5">السبب</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {relations.map((entry, index) => (
                  <tr data-ui-instance={String(entry.id)} data-ui-id="A1757" key={entry.id}>
                    <td className="px-2 py-1.5">{DIFFERENCE_TYPE_LABELS[entry.a] ?? entry.a}</td>
                    <td className="px-2 py-1.5">{DIFFERENCE_TYPE_LABELS[entry.b] ?? entry.b}</td>
                    <td className="px-2 py-1.5">
                      <select data-ui-id="A1758" value={entry.relation} onChange={(event) => onUpdateRelation?.(index, { relation: event.target.value as RelationPolicyKind })} className="rounded border border-gray-300 px-1.5 py-1 text-xs">
                        {(Object.keys(RELATION_LABELS) as RelationPolicyKind[]).map((kind) => <option data-ui-id={UI_MergeMatrixPanel_2[kind as keyof typeof UI_MergeMatrixPanel_2]} key={kind} value={kind}>{RELATION_LABELS[kind]}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5"><input data-ui-id="A1764" type="number" value={entry.priority} onChange={(event) => onUpdateRelation?.(index, { priority: Number(event.target.value) })} className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs" /></td>
                    <td className="px-2 py-1.5"><input data-ui-id="A1765" type="text" value={entry.reason} onChange={(event) => onUpdateRelation?.(index, { reason: event.target.value })} className="w-full min-w-28 rounded border border-gray-300 px-1.5 py-1 text-xs" /></td>
                    <td className="px-2 py-1.5"><button data-ui-id="A1766" type="button" onClick={() => onRemoveRelation?.(index)} className="text-xs text-red-600 hover:underline">حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
          <label className="space-y-1 text-xs text-gray-500">أ<select data-ui-id="A1767" value={relationDraft.a} onChange={(event) => setRelationDraft((current) => ({ ...current, a: event.target.value }))} className="block rounded border border-gray-300 px-2 py-1.5 text-sm">{DIFFERENCE_TYPES.map((type) => <option data-ui-id={UI_MergeMatrixPanel_3[type as keyof typeof UI_MergeMatrixPanel_3]} key={type} value={type}>{DIFFERENCE_TYPE_LABELS[type]}</option>)}</select></label>
          <label className="space-y-1 text-xs text-gray-500">ب<select data-ui-id="A1774" value={relationDraft.b} onChange={(event) => setRelationDraft((current) => ({ ...current, b: event.target.value }))} className="block rounded border border-gray-300 px-2 py-1.5 text-sm">{DIFFERENCE_TYPES.map((type) => <option data-ui-id={UI_MergeMatrixPanel_4[type as keyof typeof UI_MergeMatrixPanel_4]} key={type} value={type}>{DIFFERENCE_TYPE_LABELS[type]}</option>)}</select></label>
          <label className="space-y-1 text-xs text-gray-500">العلاقة<select data-ui-id="A1781" value={relationDraft.relation} onChange={(event) => setRelationDraft((current) => ({ ...current, relation: event.target.value as RelationPolicyKind }))} className="block rounded border border-gray-300 px-2 py-1.5 text-sm">{(Object.keys(RELATION_LABELS) as RelationPolicyKind[]).map((kind) => <option data-ui-id={UI_MergeMatrixPanel_5[kind as keyof typeof UI_MergeMatrixPanel_5]} key={kind} value={kind}>{RELATION_LABELS[kind]}</option>)}</select></label>
          <label className="space-y-1 text-xs text-gray-500">الأولوية<input data-ui-id="A1787" type="number" value={relationDraft.priority} onChange={(event) => setRelationDraft((current) => ({ ...current, priority: Number(event.target.value) }))} className="block w-20 rounded border border-gray-300 px-2 py-1.5 text-sm" /></label>
          <label className="min-w-40 flex-1 space-y-1 text-xs text-gray-500">السبب<input data-ui-id="A1788" type="text" value={relationDraft.reason} onChange={(event) => setRelationDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="حسب السياق" className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" /></label>
          <button data-ui-id="A1789" type="button" disabled={!onAddRelation} onClick={() => { onAddRelation?.({ ...relationDraft, id: createEntityId('rel'), reason: relationDraft.reason.trim() || 'سياسة علاقة' }); setRelationDraft((current) => ({ ...current, reason: '' })); }} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">إضافة علاقة</button>
        </div>
      </div>
    </div>
  );
}

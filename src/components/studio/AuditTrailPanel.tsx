// لوحة سجل التدقيق — Audit Trail Panel (FR-ES-07.6)
// مشروع التشجير - نظام القراءات العشر
//
// يعرض كل تعديل في Engine Studio: `User, Action, Rule, Before, After, Reason,
// Timestamp` — قابلًا للتصفية (بالمنفّذ/الفعل/القاعدة/المدى الزمني/نص البحث/
// التجاوزات فقط) وللتصدير ضمن حزمة الحوكمة الحتمية.
//
// القائمة طويلة-جاهزة بنافذة عرض (useWindowedList): سجل التدقيق ينمو بلا حدّ
// عملي، فلا يُرسم كله.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineRule, StudioAuditAction, StudioAuditEntry } from '@/lib/tashjeer/model/v8';
import { useWindowedList } from '@/hooks/useWindowedList';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { formatWhen, formatRelative } from '@/lib/utils/format-date';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_DANGER_ACTIONS,
  auditFacets,
  countByAction,
  filterAuditEntries,
  serializeAuditTrail,
  type AuditFilter,
} from '@/lib/tashjeer/rule-audit';
import { renderFieldValue, type RuleField } from '@/lib/tashjeer/rule-diff';

interface AuditTrailPanelProps {
  entries: StudioAuditEntry[];
  rules: EngineRule[];
  /** قاعدة مركّز عليها السجل (من رابط عميق أو من بطاقة قاعدة). */
  focusRuleId?: string | null;
  onOpenRule?: (ruleId: string) => void;
  /** تشغيل تشغيل الاختبارات وتسجيله (FR-ES-08.4). */
  onRunTests?: () => void;
  /** تصدير الحزمة كاملة (الإعداد + الإصدارات + التدقيق). */
  onExportBundle?: () => void;
  /** استرجاع قاعدة حُذفت من سلسلة إصداراتها (التاريخ لا يُفقد — FR-ES-07.3). */
  onRestoreRule?: (ruleId: string) => void;
}

const ALL_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as StudioAuditAction[];

export function AuditTrailPanel({
  entries,
  rules,
  focusRuleId,
  onOpenRule,
  onRunTests,
  onExportBundle,
  onRestoreRule,
}: AuditTrailPanelProps) {
  const [actor, setActor] = useState<string>('ALL');
  const [actions, setActions] = useState<StudioAuditAction[]>([]);
  const [ruleId, setRuleId] = useState<string>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [overrideOnly, setOverrideOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRuleId(focusRuleId ?? 'ALL');
  }, [focusRuleId]);

  const filter = useMemo<AuditFilter>(
    () => ({
      actor,
      actions: actions.length > 0 ? actions : undefined,
      ruleId,
      from: from ? new Date(from).toISOString() : undefined,
      // نهاية اليوم (لا منتصفه) حتى يشمل التصفية قيود اليوم الأخير.
      to: to ? new Date(new Date(to).getTime() + 86_399_999).toISOString() : undefined,
      query,
      overrideOnly,
    }),
    [actor, actions, ruleId, from, to, query, overrideOnly]
  );

  const visible = useMemo(() => filterAuditEntries(entries, filter), [entries, filter]);
  const facets = useMemo(() => auditFacets(entries), [entries]);
  const counts = useMemo(() => countByAction(entries), [entries]);
  const windowed = useWindowedList(listRef, visible.length, { estimateHeight: 66, overscan: 10, threshold: 40 });
  const nameOf = (id: string) => rules.find((rule) => rule.id === id)?.name ?? id;

  const toggleAction = (action: StudioAuditAction) =>
    setActions((current) => (current.includes(action) ? current.filter((item) => item !== action) : [...current, action]));

  const toggleExpand = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const downloadAudit = () => {
    const text = serializeAuditTrail(visible);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tashjeer-audit-trail.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* ==================== الرأس والعدّادات ==================== */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">سجل التدقيق (Audit Trail)</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              كل تعديل في الاستوديو: من، وماذا، وعلى أي قاعدة، وقبل/بعد، ولماذا، ومتى. {toArabicDigits(entries.length)} قيدًا
              محفوظًا، والمعروض {toArabicDigits(visible.length)}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onRunTests && (
              <button
                type="button"
                onClick={onRunTests}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                title="يُشغّل اختبارات القواعد ويُسجّل التشغيل في السجل"
              >
                تشغيل الاختبارات
              </button>
            )}
            <button
              type="button"
              onClick={downloadAudit}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              title="تنزيل السجل المعروض بصيغة حتمية (DM-13)"
            >
              تنزيل المعروض
            </button>
            {onExportBundle && (
              <button
                type="button"
                onClick={onExportBundle}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                تصدير حزمة الحوكمة
              </button>
            )}
          </div>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="قيود" value={entries.length} />
          <Stat label="منفّذون" value={facets.actors.length} />
          <Stat label="قواعد ممسوسة" value={facets.rules.length} />
          <Stat
            label="تجاوزات موثّقة"
            value={entries.filter((entry) => entry.override).length}
            tone={entries.some((entry) => entry.override) ? 'amber' : 'gray'}
          />
        </div>

        {/* أفعال سريعة */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {counts.map((item) => (
            <button
              key={item.action}
              type="button"
              onClick={() => toggleAction(item.action)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                actions.includes(item.action)
                  ? 'bg-emerald-600 text-white'
                  : AUDIT_DANGER_ACTIONS.includes(item.action)
                    ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                    : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
              }`}
            >
              {AUDIT_ACTION_LABELS[item.action]} <span className="opacity-70">{toArabicDigits(item.count)}</span>
            </button>
          ))}
          {actions.length > 0 && (
            <button type="button" onClick={() => setActions([])} className="text-xs text-gray-500 underline hover:text-gray-700">
              إلغاء تصفية الأفعال
            </button>
          )}
        </div>
      </section>

      {/* ==================== المرشّحات ==================== */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-gray-500">بحث</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="السبب، الملخّص، المعرّف…"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-gray-500">المنفّذ (User)</span>
            <select
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">كل المنفّذين</option>
              {facets.actors.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-gray-500">القاعدة (Rule)</span>
            <select
              value={ruleId}
              onChange={(event) => setRuleId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">كل القواعد</option>
              {facets.rules.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-gray-500">من تاريخ</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-gray-500">إلى تاريخ</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={overrideOnly}
              onChange={(event) => setOverrideOnly(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            التجاوزات الموثّقة فقط (قاعدة محمية / انحدار)
          </label>
          <button
            type="button"
            onClick={() => {
              setActor('ALL');
              setActions([]);
              setRuleId('ALL');
              setFrom('');
              setTo('');
              setQuery('');
              setOverrideOnly(false);
            }}
            className="mr-auto text-xs text-gray-500 underline hover:text-gray-700"
          >
            مسح المرشّحات
          </button>
        </div>
      </section>

      {/* ==================== القائمة (نافذة عرض) ==================== */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
          {visible.length === 0 ? 'لا قيود مطابقة.' : `الأحدث أولًا — ${toArabicDigits(visible.length)} قيدًا`}
          {actions.length === 0 && ALL_ACTIONS.length > 0 && <span className="sr-only">كل الأفعال</span>}
        </div>
        <div
          ref={listRef}
          className="max-h-[70vh] min-h-0 overscroll-contain overflow-y-scroll [scrollbar-gutter:stable] touch-pan-y"
          tabIndex={0}
          aria-label="سجل التدقيق القابل للتمرير"
        >
          <ul className="divide-y divide-gray-100">
            {windowed.active && windowed.topPad > 0 && <li aria-hidden style={{ height: windowed.topPad }} />}
            {visible.map((entry, index) => {
              if (windowed.active && (index < windowed.start || index > windowed.end)) return null;
              const danger = AUDIT_DANGER_ACTIONS.includes(entry.action) || entry.override;
              const open = expanded.has(entry.id);
              return (
                <li
                  key={entry.id}
                  ref={(element) => {
                    if (windowed.active) windowed.measure(index, element);
                  }}
                  className={`px-4 py-3 ${danger ? 'bg-red-50/40' : ''}`}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
                        danger ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {AUDIT_ACTION_LABELS[entry.action]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800">{entry.summary}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
                        <span title={formatWhen(entry.at)}>{formatRelative(entry.at)}</span>
                        <span>·</span>
                        <span>{formatWhen(entry.at)}</span>
                        <span>·</span>
                        <span>بواسطة {entry.actor}</span>
                        {typeof entry.version === 'number' && (
                          <>
                            <span>·</span>
                            <span>v{toArabicDigits(entry.version)}</span>
                          </>
                        )}
                        {entry.override && (
                          <span className="rounded bg-red-100 px-1.5 text-red-700">تجاوز تحذير</span>
                        )}
                      </p>
                      {entry.reason && <p className="mt-1 text-xs text-gray-600">السبب: {entry.reason}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {entry.ruleId && onOpenRule && entry.action !== 'RULE_DELETED' && (
                        <button
                          type="button"
                          onClick={() => onOpenRule(entry.ruleId!)}
                          className="rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          title={entry.ruleId}
                        >
                          {nameOf(entry.ruleId)}
                        </button>
                      )}
                      {entry.ruleId && entry.action === 'RULE_DELETED' && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500" title={entry.ruleId}>
                          {entry.ruleName ?? entry.ruleId}
                        </span>
                      )}
                      {/* الحذف لا يمحو التاريخ: استرجاع من سلسلة الإصدارات */}
                      {entry.ruleId && entry.action === 'RULE_DELETED' && onRestoreRule && !rules.some((rule) => rule.id === entry.ruleId) && (
                        <button
                          type="button"
                          onClick={() => onRestoreRule(entry.ruleId!)}
                          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-100"
                          title="يُعاد آخر إصدار محفوظ من سلسلة القاعدة (معطّلة) بإصدار جديد موثّق"
                        >
                          استرجاع
                        </button>
                      )}
                      {(entry.changes?.length ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(entry.id)}
                          className="rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"
                          aria-expanded={open}
                        >
                          {open ? 'إخفاء قبل/بعد' : `قبل/بعد (${toArabicDigits(entry.changes!.length)})`}
                        </button>
                      )}
                    </div>
                  </div>

                  {open && entry.changes && (
                    <table className="mt-2 w-full text-right text-[11px]">
                      <tbody className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                        {entry.changes.map((change) => (
                          <tr key={change.field}>
                            <td className="w-32 px-2 py-1 font-medium text-gray-600">{change.label}</td>
                            <td className="px-2 py-1 text-red-700">
                              {renderFieldValue(change.field as RuleField, change.before)}
                            </td>
                            <td className="px-2 py-1 text-emerald-700">
                              {renderFieldValue(change.field as RuleField, change.after)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              );
            })}
            {windowed.active && windowed.bottomPad > 0 && <li aria-hidden style={{ height: windowed.bottomPad }} />}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'amber' }) {
  const tones = { gray: 'border-gray-200 bg-gray-50 text-gray-700', amber: 'border-amber-200 bg-amber-50 text-amber-800' }[tone];
  return (
    <div className={`rounded-lg border p-3 ${tones}`}>
      <p className="text-2xl font-bold">{toArabicDigits(value)}</p>
      <p className="mt-0.5 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

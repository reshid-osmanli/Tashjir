// بطاقة القاعدة: Metadata + دورة الحالة + الإصدارات والرجوع (FR-ES-07.2/.3/.4/.5)
// مشروع التشجير - نظام القراءات العشر
//
// ثلاث لوحات في واحدة:
//   1) **Metadata كاملة**: المعرّف، الاسم، الوصف، الفئة، النطاق، الأولوية،
//      الخصوصية، الحالة، المصدر، الإنشاء، آخر تعديل، الإصدار، الاعتمادات،
//      التجاوزات، التعارضات، حالات الاختبار — مع عدادات الاستخدام الخام.
//   2) **دورة الحالة**: الانتقالات المسموحة فقط (من `rule-status-flow`)، وكل
//      انتقال يبيّن هل يحتاج اعتمادًا أو سببًا، والقاعدة المحمية تطلب تأكيدًا
//      إضافيًا.
//   3) **الإصدارات**: خط زمني v١ ← v٢ ← v٣ بكل من Created/Modified/By/Reason،
//      فرق بين إصدارين بحقول القاعدة، ورجوع موثّق يُنشئ إصدارًا جديدًا.
//
// المكوّن عرض فقط: كل الحكم في الطبقة النقيّة المختبرة.

'use client';

import { useMemo, useState } from 'react';
import type { EngineConfig, EngineRule, EngineRuleVersion, RuleStatus } from '@/lib/tashjeer/model/v8';
import { formatWhen } from '@/lib/utils/format-date';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import {
  RULE_FIELD_LABELS,
  renderFieldValue,
  inferRuleSource,
  type RuleField,
} from '@/lib/tashjeer/rule-diff';
import { diffVersions, chainSummary } from '@/lib/tashjeer/rule-versions';
import {
  allowedTransitions,
  buildEditGuard,
  conflictedRuleReasons,
} from '@/lib/tashjeer/rule-status-flow';
import { relationsOf, buildRuleGraph } from '@/lib/tashjeer/rule-dependencies';
import { CATEGORY_LABELS, HARDNESS_LABELS, SCOPE_LABELS, STATUS_BADGE_CLASSES, STATUS_LABELS } from './labels';
import { BUCKET_LABELS, classifyRule } from '@/lib/tashjeer/rule-explorer-model';
import { SOURCE_LABELS } from '@/lib/tashjeer/rule-explorer-model';
import { VERSION_SOURCE_LABELS } from '@/lib/tashjeer/rule-versions';

interface RuleMetadataPanelProps {
  rule: EngineRule;
  config: EngineConfig;
  /** سلسلة إصدارات القاعدة (الأقدم أولًا). */
  chain: EngineRuleVersion[];
  onStatusChange: (status: RuleStatus) => void | Promise<void>;
  onToggleProtected: (value: boolean) => void | Promise<void>;
  onRollback: (version: number) => void | Promise<void>;
  onOpenRule?: (ruleId: string) => void;
  onOpenTests?: (ruleId: string) => void;
  onOpenGraph?: (ruleId: string) => void;
}

export function RuleMetadataPanel({
  rule,
  config,
  chain,
  onStatusChange,
  onToggleProtected,
  onRollback,
  onOpenRule,
  onOpenTests,
  onOpenGraph,
}: RuleMetadataPanelProps) {
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);

  const guard = useMemo(() => buildEditGuard(config, rule), [config, rule]);
  const summary = useMemo(() => chainSummary(chain), [chain]);
  const relations = useMemo(() => relationsOf(buildRuleGraph(config), rule.id), [config, rule.id]);
  const conflictReasons = useMemo(() => conflictedRuleReasons(config).get(rule.id) ?? [], [config, rule.id]);
  const transitions = useMemo(() => allowedTransitions(rule.status), [rule.status]);
  const source = inferRuleSource(rule);
  const bucket = classifyRule(rule);

  const diff = useMemo(() => {
    if (compareFrom === null || compareTo === null || compareFrom === compareTo) return null;
    const [from, to] = compareFrom < compareTo ? [compareFrom, compareTo] : [compareTo, compareFrom];
    return diffVersions(chain, from, to);
  }, [chain, compareFrom, compareTo]);

  const nameOf = (ruleId: string) => config.rules.find((item) => item.id === ruleId)?.name ?? ruleId;

  return (
    <div className="space-y-4">
      {/* ==================== 1) Metadata كاملة ==================== */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-900">بيانات القاعدة (Metadata)</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              كل حقل من حقول FR-ES-07.4 مع عدادات الاستخدام الخام — تُشتق من الملف ولا تُخزَّن مرتين.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[rule.status]}`}>
              {STATUS_LABELS[rule.status]}
            </span>
            {rule.protected && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">🔒 محمية</span>
            )}
            {conflictReasons.length > 0 && rule.status !== 'CONFLICTED' && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700" title={conflictReasons.join(' ؛ ')}>
                ⚠ تعارض مكتشف
              </span>
            )}
          </div>
        </header>

        {guard.warnings.length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {guard.warnings.map((warning, index) => (
              <li
                key={index}
                className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  rule.protected ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-600'
                }`}
              >
                {warning}
              </li>
            ))}
          </ul>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <MetaRow label="المعرّف (ID)">
            <span dir="ltr" className="font-mono text-xs text-gray-700">
              {rule.id}
            </span>
          </MetaRow>
          <MetaRow label="الاسم">{rule.name}</MetaRow>
          <MetaRow label="الوصف" full>
            {rule.description?.trim() ? rule.description : <span className="text-gray-400">بلا وصف</span>}
          </MetaRow>
          <MetaRow label="الفئة">{CATEGORY_LABELS[rule.category] ?? rule.category}</MetaRow>
          <MetaRow label="دلو المستكشف">{BUCKET_LABELS[bucket]}</MetaRow>
          <MetaRow label="النطاق">{SCOPE_LABELS[rule.scope]}</MetaRow>
          <MetaRow label="الخصوصية (Specificity)">{rule.specificity}</MetaRow>
          <MetaRow label="الأولوية">{toArabicDigits(rule.priority)}</MetaRow>
          <MetaRow label="مجموعة الأولوية">
            {config.priorityGroups.find((group) => group.id === rule.groupId)?.label ?? rule.groupId}
          </MetaRow>
          <MetaRow label="الصلابة">{HARDNESS_LABELS[rule.hardness]}</MetaRow>
          <MetaRow label="الحالة">{STATUS_LABELS[rule.status]}</MetaRow>
          <MetaRow label="المصدر (Source)">{SOURCE_LABELS[source]}</MetaRow>
          <MetaRow label="أُنشئت (CreatedAt)">{formatWhen(rule.createdAt)}</MetaRow>
          <MetaRow label="آخر تعديل (UpdatedAt)">{formatWhen(rule.updatedAt)}</MetaRow>
          <MetaRow label="الإصدار (Version)">
            v{toArabicDigits(rule.version)}{' '}
            <span className="text-xs text-gray-400">({toArabicDigits(summary.count)} في السلسلة)</span>
          </MetaRow>
          <MetaRow label="حالات الاختبار (TestCases)">
            <button
              type="button"
              onClick={() => onOpenTests?.(rule.id)}
              className="text-emerald-700 underline decoration-emerald-300 hover:text-emerald-800"
            >
              {toArabicDigits(rule.testCases?.length ?? 0)} حالة
            </button>
          </MetaRow>

          <MetaRow label="تعتمد على (Dependencies)" full>
            <RefList
              ids={rule.dependsOn ?? []}
              derived={relations.dependsOn.map((edge) => edge.to)}
              nameOf={nameOf}
              onOpen={onOpenRule}
              empty="لا اعتمادات"
            />
          </MetaRow>
          <MetaRow label="تتجاوز (Overrides)" full>
            <RefList
              ids={rule.overrides ?? []}
              derived={relations.overrides.map((edge) => edge.to)}
              nameOf={nameOf}
              onOpen={onOpenRule}
              empty="لا تجاوزات"
            />
          </MetaRow>
          <MetaRow label="تتعارض مع (Conflicts)" full>
            <RefList
              ids={rule.conflictsWith ?? []}
              derived={relations.conflicts.map((edge) => (edge.from === rule.id ? edge.to : edge.from))}
              nameOf={nameOf}
              onOpen={onOpenRule}
              empty="لا تعارضات معلنة"
              danger
            />
            {conflictReasons.length > 0 && (
              <ul className="mt-1 space-y-1">
                {conflictReasons.map((reason, index) => (
                  <li key={index} className="text-xs text-red-700">
                    ⚠ {reason}
                  </li>
                ))}
              </ul>
            )}
          </MetaRow>
          <MetaRow label="يُعتمد عليها / تُطلق" full>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Counter label="قاعدة تشير إليها" value={guard.dependentCount} />
              <Counter label="تعتمد عليها" value={relations.dependedBy.length} />
              <Counter label="تُطلق" value={relations.triggers.length} />
              <Counter label="تُطلَق منها" value={relations.triggeredBy.length} />
              <button
                type="button"
                onClick={() => onOpenGraph?.(rule.id)}
                className="text-emerald-700 underline decoration-emerald-300 hover:text-emerald-800"
              >
                فتح الرسم
              </button>
            </div>
          </MetaRow>
        </dl>

        {/* الحماية (FR-ES-07.5) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div>
            <p className="text-sm font-medium text-gray-800">قاعدة محمية</p>
            <p className="mt-0.5 text-xs text-gray-500">
              لا تغيير ولا حذف إلا بتأكيد إضافي صريح وسبب مكتوب يُحفظ في الإصدار وسجل التدقيق.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleProtected(!rule.protected)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              rule.protected
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {rule.protected ? '🔒 رفع الحماية' : 'وسم كمحمية'}
          </button>
        </div>
      </section>

      {/* ==================== 2) دورة الحالة ==================== */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">دورة الحالة (Rule Status)</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          الانتقالات المحكومة فقط — لا قفزات، والإيقاف موثّق لا حذف. الحالة الحالية:{' '}
          <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_BADGE_CLASSES[rule.status]}`}>
            {STATUS_LABELS[rule.status]}
          </span>
        </p>

        {transitions.length === 0 ? (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            لا انتقال متاحًا من هذه الحالة (حالة ختامية).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {transitions.map((transition) => (
              <li key={transition.to} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {STATUS_LABELS[rule.status]} ← {STATUS_LABELS[transition.to]}
                    <span className="mr-2 text-xs text-gray-500">({transition.label})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{transition.hint}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {transition.requiresApproval && <Tag>يعتمد بتأكيد</Tag>}
                    {transition.requiresReason && <Tag>سبب إلزامي</Tag>}
                    {transition.affectsEngine && <Tag tone="amber">يغيّر سلوك المحرك</Tag>}
                    {rule.protected && <Tag tone="red">قاعدة محمية</Tag>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onStatusChange(transition.to)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    transition.to === 'DEPRECATED' || transition.to === 'DISABLED'
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {transition.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ==================== 3) الإصدارات والرجوع ==================== */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-900">سلسلة الإصدارات (Versioning)</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {toArabicDigits(summary.count)} إصدار · الأحدث v{toArabicDigits(summary.latest ?? 0)} ·{' '}
              {toArabicDigits(summary.reasons)} منها بسبب موثّق. لا يُحذف إصدار أبدًا.
            </p>
          </div>
          {summary.sizeNotice && (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
              السلسلة طويلة ({toArabicDigits(summary.count)} إصدارًا) — تُعرض كاملة بلا حذف تلقائي.
            </span>
          )}
        </header>

        {chain.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            لا إصدارات محفوظة بعد؛ يُلتقط الإصدار الأول عند أول حفظ.
          </p>
        ) : (
          <>
            {/* مقارنة إصدارين */}
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">
              <span className="text-xs font-medium text-gray-600">فرق بين إصدارين:</span>
              <VersionSelect chain={chain} value={compareFrom} onChange={setCompareFrom} label="من" />
              <VersionSelect chain={chain} value={compareTo} onChange={setCompareTo} label="إلى" />
              {diff && (
                <span className="text-xs text-gray-500">
                  {toArabicDigits(diff.changes.length)} حقل متغيّر بين v{toArabicDigits(diff.from?.version ?? 0)} وv
                  {toArabicDigits(diff.to?.version ?? 0)}
                </span>
              )}
            </div>

            {diff && (
              <div className="mb-4 overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-1.5 font-semibold">الحقل</th>
                      <th className="px-3 py-1.5 font-semibold">قبل</th>
                      <th className="px-3 py-1.5 font-semibold">بعد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {diff.changes.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-gray-400">
                          لا فرق بين الإصدارين.
                        </td>
                      </tr>
                    )}
                    {diff.changes.map((change) => (
                      <tr key={change.field}>
                        <td className="px-3 py-1.5 font-medium text-gray-700">{change.label}</td>
                        <td className="px-3 py-1.5 text-red-700">
                          {renderFieldValue(change.field as RuleField, change.before)}
                        </td>
                        <td className="px-3 py-1.5 text-emerald-700">
                          {renderFieldValue(change.field as RuleField, change.after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500">
                  نفس فرق الحقول الذي يُحفظ في سجل التدقيق ويُرى في ملف التصدير الحتمي (DM-13).
                </p>
              </div>
            )}

            {/* الخط الزمني (الأحدث أولًا) */}
            <ol className="space-y-2">
              {[...chain].reverse().map((entry) => (
                <li
                  key={entry.id}
                  className={`rounded-lg border p-3 ${
                    entry.version === rule.version ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-gray-900 px-2 py-0.5 text-xs font-bold text-white">
                      v{toArabicDigits(entry.version)}
                    </span>
                    <span className="text-xs font-medium text-gray-700">{VERSION_SOURCE_LABELS[entry.source]}</span>
                    {typeof entry.rollbackOf === 'number' && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] text-blue-800">
                        رجوع إلى v{toArabicDigits(entry.rollbackOf)}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">{formatWhen(entry.at)}</span>
                    <span className="text-[11px] text-gray-500">بواسطة {entry.by}</span>
                    {entry.version === rule.version && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">الحالي</span>
                    )}
                    {entry.version !== rule.version && (
                      <button
                        type="button"
                        onClick={() => onRollback(entry.version)}
                        className="mr-auto rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                        title="يُنشئ إصدارًا جديدًا بمحتوى هذا الإصدار، ولا يحذف ما بينهما"
                      >
                        رجوع إلى هذا الإصدار
                      </button>
                    )}
                  </div>
                  {entry.reason && <p className="mt-1.5 text-xs text-gray-600">السبب: {entry.reason}</p>}
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600">
                      لقطة الإصدار (JSON)
                    </summary>
                    <pre dir="ltr" className="mt-1 max-h-56 overflow-auto rounded bg-gray-900 p-2 text-left text-[10px] leading-relaxed text-gray-100">
                      {JSON.stringify(entry.rule, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}

// ==================== أجزاء العرض ====================

function MetaRow({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800">{children}</dd>
    </div>
  );
}

function Tag({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'amber' | 'red' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
  }[tone];
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tones}`}>{children}</span>;
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded bg-white px-2 py-0.5 text-gray-600 ring-1 ring-gray-200">
      {label}: <span className="font-semibold text-gray-800">{toArabicDigits(value)}</span>
    </span>
  );
}

/** قائمة إحالات: المعلنة صريحة، والمشتقة من البنية تُعرض بوسم «مشتقة». */
function RefList({
  ids,
  derived,
  nameOf,
  onOpen,
  empty,
  danger,
}: {
  ids: string[];
  derived: string[];
  nameOf: (id: string) => string;
  onOpen?: (id: string) => void;
  empty: string;
  danger?: boolean;
}) {
  const declared = new Set(ids);
  const all = Array.from(new Set([...ids, ...derived]));
  if (all.length === 0) return <span className="text-xs text-gray-400">{empty}</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {all.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpen?.(id)}
          className={`rounded px-2 py-0.5 text-xs ring-1 ${
            danger
              ? 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100'
              : 'bg-white text-gray-700 ring-gray-200 hover:bg-emerald-50'
          }`}
          title={id}
        >
          {nameOf(id)}
          {!declared.has(id) && <span className="mr-1 text-[10px] text-gray-400">(مشتقة)</span>}
        </button>
      ))}
    </div>
  );
}

function VersionSelect({
  chain,
  value,
  onChange,
  label,
}: {
  chain: EngineRuleVersion[];
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-gray-600">
      {label}
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">—</option>
        {[...chain].reverse().map((entry) => (
          <option key={entry.version} value={entry.version}>
            v{toArabicDigits(entry.version)} ({VERSION_SOURCE_LABELS[entry.source]})
          </option>
        ))}
      </select>
    </label>
  );
}

/** تسمية حقل Metadata (تُستعمل في لوحات أخرى) — إعادة تصدير مريحة. */
export { RULE_FIELD_LABELS };

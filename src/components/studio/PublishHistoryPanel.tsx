// النشر والسجل — Publish Gate & Version History (FR-ES-07، FR-ES-11، FR-ES-14)
// مشروع التشجير - نظام القراءات العشر
//
// قبل الحفظ: تشغيل جاف (dry run) يعرض أثر التغييرات غير المحفوظة مقارنة بآخر
// ملف محفوظ: القرارات التي تتبدّل على مجموعة المدخلات المرجعية، ونتائج
// اختبارات القواعد، وسجل التدقيق المتوقَّع. الحفظ يلتقط نسخة في السجل،
// والسجل يتيح الاسترجاع إلى أي نسخة سابقة بتأكيد كمي.
//
// كل الحسابات من طبقات نقيّة مختبرة (profile-compare، rule-test-runner،
// engine-config-history)؛ لا منطق قرار مكرر هنا (P-07).

'use client';

import { useMemo, useState } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import type { EngineConfigVersion } from '@/lib/tashjeer/engine-config-history';
import { diffEngineConfigs } from '@/lib/tashjeer/engine-config-history';
import { compareProfiles, isSafeToAdopt } from '@/lib/tashjeer/decision/profile-compare';
import { runProfileTests } from '@/lib/tashjeer/decision/rule-test-runner';
import { confirmAction } from '@/lib/ui/confirm-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface PublishHistoryPanelProps {
  config: EngineConfig;
  savedConfig: EngineConfig | null;
  dirty: boolean;
  versions: EngineConfigVersion[];
  onPublish: (note?: string) => void;
  onDiscard: () => void;
  onRollback: (versionId: string) => void;
  onOpenRule?: (ruleId: string) => void;
}

const SOURCE_LABELS: Record<EngineConfigVersion['source'], string> = {
  SAVE: 'حفظ',
  ROLLBACK: 'استرجاع',
  IMPORT: 'استيراد',
  RESET: 'إعادة ضبط',
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'arab' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PublishHistoryPanel({
  config,
  savedConfig,
  dirty,
  versions,
  onPublish,
  onDiscard,
  onRollback,
  onOpenRule,
}: PublishHistoryPanelProps) {
  const [note, setNote] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // التشغيل الجاف: أثر التغييرات غير المحفوظة.
  const dryRun = useMemo(() => {
    const tests = runProfileTests(config);
    const audit = diffEngineConfigs(savedConfig, config);
    const compare = savedConfig ? compareProfiles(savedConfig, config) : null;
    return { tests, audit, compare };
  }, [config, savedConfig]);

  const blocking = dryRun.tests.failed > 0 || (dryRun.compare ? !isSafeToAdopt(dryRun.compare) : false);

  const publish = async () => {
    if (!dirty) return;
    const ok = await confirmAction({
      title: 'نشر إعداد المحرك',
      message: blocking
        ? 'التشغيل الجاف كشف تراجعا أو اختبارات فاشلة. يمكنك النشر مع ذلك، وسيبقى الاسترجاع متاحا من السجل.'
        : 'سيُحفظ الإعداد ويُلتقط في سجل الإصدارات، ويؤثر في كل قرار دمج/تنافٍ في المحرر فورا.',
      impacts: [
        { label: 'تغيير في سجل التدقيق', count: dryRun.audit.length },
        { label: 'قرار يتبدّل على المدخلات المرجعية', count: dryRun.compare?.changed ?? 0 },
        { label: 'تراجع مكتشف', count: dryRun.compare?.regressed ?? 0 },
        { label: 'اختبار قاعدة فاشل', count: dryRun.tests.failed },
      ],
      undoable: true,
      tone: blocking ? 'danger' : 'default',
      confirmLabel: 'نشر',
    });
    if (!ok) return;
    onPublish(note);
    setNote('');
  };

  const discard = async () => {
    if (!dirty) return;
    const ok = await confirmAction({
      title: 'تجاهل التغييرات غير المحفوظة',
      message: 'يعود الإعداد إلى آخر نسخة محفوظة.',
      impacts: [{ label: 'تغيير سيُفقد', count: dryRun.audit.length }],
      undoable: false,
      tone: 'danger',
      confirmLabel: 'تجاهل',
    });
    if (ok) onDiscard();
  };

  const rollback = async (version: EngineConfigVersion) => {
    const impact = diffEngineConfigs(config, version.config);
    const compare = compareProfiles(config, version.config);
    const ok = await confirmAction({
      title: `استرجاع النسخة ${toArabicDigits(version.seq)}`,
      message: 'تُستبدل النسخة الحية بهذه النسخة وتُحفظ فورا. النسخة الحالية تبقى في السجل فيمكن العودة إليها.',
      impacts: [
        { label: 'تغيير سيُطبَّق', count: impact.length },
        { label: 'قرار يتبدّل على المدخلات المرجعية', count: compare.changed },
        { label: 'قاعدة في النسخة المستهدفة', count: version.stats.rules },
      ],
      undoable: true,
      confirmLabel: 'استرجاع',
    });
    if (ok) onRollback(version.id);
  };

  return (
    <div className="space-y-5">
      {/* بوابة النشر */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">بوابة النشر (تشغيل جاف)</h3>
            <p className="mt-1 text-sm text-gray-500">
              يقارن الإعداد الجاري بآخر نسخة محفوظة قبل أن يمسّ أي قرار حي. لا شيء يُنشر تلقائيا.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !dirty ? 'bg-gray-100 text-gray-500' : blocking ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {!dirty ? 'لا تغييرات معلّقة' : blocking ? 'يحتاج مراجعة' : 'جاهز للنشر'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="تغييرات" value={dryRun.audit.length} tone={dryRun.audit.length > 0 ? 'blue' : 'gray'} />
          <Stat label="قرارات تتبدّل" value={dryRun.compare?.changed ?? 0} tone={(dryRun.compare?.changed ?? 0) > 0 ? 'amber' : 'gray'} />
          <Stat label="تراجعات" value={dryRun.compare?.regressed ?? 0} tone={(dryRun.compare?.regressed ?? 0) > 0 ? 'red' : 'gray'} />
          <Stat
            label="اختبارات فاشلة"
            value={dryRun.tests.failed}
            tone={dryRun.tests.failed > 0 ? 'red' : dryRun.tests.total > 0 ? 'emerald' : 'gray'}
            hint={`من ${toArabicDigits(dryRun.tests.total)}`}
          />
        </div>

        {dirty && dryRun.audit.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {dryRun.audit.map((entry, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {entry.ruleId && onOpenRule ? (
                  <button type="button" onClick={() => onOpenRule(entry.ruleId!)} className="text-right hover:text-emerald-700 hover:underline">
                    {entry.label}
                  </button>
                ) : (
                  <span>{entry.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {dirty && dryRun.compare && dryRun.compare.changed > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200">
            <table className="w-full text-xs">
              <thead className="bg-amber-50 text-amber-900">
                <tr>
                  <th className="px-2 py-1.5 text-right font-medium">المدخل</th>
                  <th className="px-2 py-1.5 text-right font-medium">المحفوظ</th>
                  <th className="px-2 py-1.5 text-right font-medium">الجاري</th>
                  <th className="px-2 py-1.5 text-right font-medium">التصنيف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {dryRun.compare.items
                  .filter((item) => item.class !== 'SAME')
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5 font-mono">{item.id}</td>
                      <td className="px-2 py-1.5">{item.aMerge ? 'ادمج' : 'لا تدمج'}</td>
                      <td className="px-2 py-1.5">{item.bMerge ? 'ادمج' : 'لا تدمج'}</td>
                      <td className={`px-2 py-1.5 font-semibold ${item.class === 'REGRESSED' ? 'text-red-700' : item.class === 'IMPROVED' ? 'text-emerald-700' : 'text-amber-800'}`}>
                        {item.class === 'REGRESSED' ? 'تراجع' : item.class === 'IMPROVED' ? 'تحسّن' : 'تغيّر'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[200px] text-xs text-gray-600">
            ملاحظة الإصدار (اختياري)
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="مثال: منع دمج الفرش مع المد في الوقف"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <button
            type="button"
            onClick={publish}
            disabled={!dirty}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            نشر وحفظ نسخة
          </button>
          <button
            type="button"
            onClick={discard}
            disabled={!dirty}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            تجاهل التغييرات
          </button>
        </div>
      </div>

      {/* سجل الإصدارات */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">سجل الإصدارات وتدقيق التغييرات</h3>
        <p className="mt-1 text-sm text-gray-500">
          كل نشر يلتقط نسخة كاملة مع ما تغيّر فيها. الاسترجاع يعيد نسخة بعينها ويُسجَّل بدوره؛ لا شيء يُمحى.
        </p>
        {versions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">لا نسخ بعد.</p>
        ) : (
          <ol className="mt-3 divide-y divide-gray-100">
            {versions.map((version, index) => {
              const open = expandedId === version.id;
              return (
                <li key={version.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                      {toArabicDigits(version.seq)}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{SOURCE_LABELS[version.source]}</span>
                    <span className="text-xs text-gray-500">{formatWhen(version.createdAt)}</span>
                    {index === 0 && <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">الحالية</span>}
                    {version.note && <span className="text-sm text-gray-800">{version.note}</span>}
                    <span className="mr-auto text-[11px] text-gray-400">
                      {toArabicDigits(version.stats.rules)} قاعدة · {toArabicDigits(version.stats.active)} مفعّلة · {toArabicDigits(version.stats.matrix)} صف دمج
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : version.id)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {open ? 'إخفاء التفاصيل' : `التفاصيل (${toArabicDigits(version.audit.length)})`}
                    </button>
                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => rollback(version)}
                        className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        استرجاع
                      </button>
                    )}
                  </div>
                  {open && (
                    <ul className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                      {version.audit.length === 0 && <li className="text-gray-400">لا تغييرات مسجّلة (نسخة مطابقة).</li>}
                      {version.audit.map((entry, entryIndex) => (
                        <li key={entryIndex} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                          {entry.ruleId && onOpenRule ? (
                            <button type="button" onClick={() => onOpenRule(entry.ruleId!)} className="text-right hover:text-emerald-700 hover:underline">
                              {entry.label}
                            </button>
                          ) : (
                            <span>{entry.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: number; tone: 'gray' | 'blue' | 'amber' | 'red' | 'emerald'; hint?: string }) {
  const tones: Record<typeof tone, string> = {
    gray: 'bg-gray-50 text-gray-600',
    blue: 'bg-blue-50 text-blue-800',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-800',
    emerald: 'bg-emerald-50 text-emerald-800',
  };
  return (
    <div className={`rounded-lg p-3 ${tones[tone]}`}>
      <div className="text-xl font-bold">{toArabicDigits(value)}</div>
      <div className="text-xs">
        {label}
        {hint && <span className="mr-1 opacity-70">{hint}</span>}
      </div>
    </div>
  );
}

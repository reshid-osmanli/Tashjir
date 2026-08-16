// فهرس القواعد والاختلافات المدمج في المحرر — Integrated Rules Index
//
// كان الفهرس صفحة مستقلة تُفتح خارج المحرر، فكان المحقق يقطع عمله للبحث أو
// للتتبع. هذا الحوار يدمج الفهرس كله في المحرر: بحث وتصفية في كل القواعد
// العامة واختلافات الآيات، وتتبّع مواضع أي قاعدة موضعا موضعا، وتحريرها
// وإيقافها وحذفها، والانتقال إلى أي اختلاف محلي في مكانه — كل ذلك دون
// مغادرة شاشة العمل.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { describeScope, resolveScope } from '@/lib/tashjeer/scope';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { getSurahOrFirst } from '@/data/quran';
import { describeGlobalPattern } from '@/lib/quran-logic/global-rule-engine';
import {
  deleteGlobalRule,
  listGlobalRules,
  saveGlobalRule,
  type GlobalRule,
} from '@/lib/storage/global-rules-store';
import { listDocuments, loadDocument } from '@/lib/storage/document-store';
import { occurrenceStats } from '@/lib/storage/rule-occurrences-store';
import { RuleOccurrenceReview } from './RuleOccurrenceReview';
import { GlobalRuleMetaEditor } from './GlobalRuleMetaEditor';
import { StatusBadge } from './VariantsPanel';
import type { VariantCategory } from '@/types';
import type { ReadingScope, Variant, VerificationStatus } from '@/types/tashjeer';

interface RulesIndexDialogProps {
  /** الآية المفتوحة الآن؛ يبدأ التتبع منها ويُعلَّم ما يخصها. */
  currentAyahKey: number;
  onClose: () => void;
  /** الانتقال إلى آية واختلاف داخل المحرر نفسه. */
  onNavigate: (ayahKey: number, variantId?: string) => void;
  /** يُستدعى بعد أي تعديل يغيّر الاشتقاقات (حذف قاعدة، تحرير، تتبع). */
  onRulesChanged: () => void;
}

type IndexRow = {
  key: string;
  type: 'LOCAL' | 'GLOBAL';
  title: string;
  category: VariantCategory;
  status: VerificationStatus;
  scope: ReadingScope;
  description?: string;
  sourceRef?: string;
  updatedAt: string;
  isActive: boolean;
  surahName?: string;
  ayahNumber?: number;
  ayahKey?: number;
  variantId?: string;
  targetText: string;
  globalRule?: GlobalRule;
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as VariantCategory[];

export function RulesIndexDialog({
  currentAyahKey,
  onClose,
  onNavigate,
  onRulesChanged,
}: RulesIndexDialogProps) {
  const catalog = useTransmissionCatalog();
  // مفتاح الاستثناءات ضمن الاعتماديات ليُعاد العدّ بعد التتبع.
  const occurrences = useRuleOccurrences();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<VariantCategory | 'ALL'>('ALL');
  const [type, setType] = useState<'ALL' | 'LOCAL' | 'GLOBAL'>('ALL');
  const [readerId, setReaderId] = useState('');
  const [reviewingRule, setReviewingRule] = useState<GlobalRule | null>(null);
  const [editingRule, setEditingRule] = useState<GlobalRule | null>(null);

  const refresh = () => setVersion((current) => current + 1);

  const rows = useMemo(() => {
    void version;
    void occurrences.key;
    return readIndexRows();
  }, [version, occurrences.key]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ar');
    return rows.filter((row) => {
      if (category !== 'ALL' && row.category !== category) return false;
      if (type !== 'ALL' && row.type !== type) return false;
      if (readerId && !resolveScope(row.scope, catalog).includes(readerId)) return false;
      if (!normalized) return true;
      const haystack = [
        row.title,
        row.description,
        row.sourceRef,
        row.surahName,
        row.targetText,
        describeScope(row.scope, { catalog }),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('ar');
      return haystack.includes(normalized);
    });
  }, [catalog, category, query, readerId, rows, type]);

  // Escape يغلق الفهرس، إلا إذا كانت نافذة تتبع أو تحرير فوقه فهي أولى.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !reviewingRule && !editingRule) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingRule, onClose, reviewingRule]);

  const toggleActive = (rule: GlobalRule) => {
    saveGlobalRule({ ...rule, isActive: !rule.isActive });
    refresh();
    onRulesChanged();
  };

  const removeRule = (rule: GlobalRule) => {
    if (!window.confirm(`حذف القاعدة العامة «${rule.title}» من المصحف كله؟ يُحذف معها سجل مواضعها.`)) return;
    deleteGlobalRule(rule.id);
    refresh();
    onRulesChanged();
  };

  const localCount = rows.filter((row) => row.type === 'LOCAL').length;
  const globalCount = rows.filter((row) => row.type === 'GLOBAL').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="فهرس القواعد والاختلافات"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="border-b border-stone-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-stone-900">فهرس القواعد والاختلافات</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500">
                كل ما أُضيف إلى المشروع في مكان واحد داخل المحرر: {globalCount} قاعدة عامة
                و{localCount} اختلافا موضعيا. ابحث، تتبّع المواضع، حرّر، وانتقل — دون مغادرة الشاشة.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
            >
              إغلاق
            </button>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(200px,1fr)_140px_140px_180px]">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث: العنوان، الحكم، السورة، المرجع..."
              className="input"
              autoFocus
            />
            <select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="input">
              <option value="ALL">المحلي والعام</option>
              <option value="GLOBAL">قواعد عامة</option>
              <option value="LOCAL">اختلافات الآيات</option>
            </select>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as typeof category)}
              className="input"
            >
              <option value="ALL">كل الفئات</option>
              {ALL_CATEGORIES.map((value) => (
                <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
              ))}
            </select>
            <select value={readerId} onChange={(event) => setReaderId(event.target.value)} className="input">
              <option value="">كل القراء والرواة</option>
              {catalog.imams.map((imam) => (
                <optgroup key={imam.id} label={imam.name}>
                  {catalog.narrators
                    .filter((narrator) => narrator.imamId === imam.id)
                    .map((narrator) => (
                      <option key={narrator.id} value={narrator.id}>{narrator.name}</option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {visible.length === 0 ? (
            <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-xs text-stone-500">
              لا توجد نتائج توافق هذه التصفية. أنشئ قاعدة من تحديد الحروف أو اختلافا من الكلمات المعلّمة.
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((row) => (
                <li key={row.key} className="rounded-lg border border-stone-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: getCategorySoftColor(row.category),
                            color: getCategoryColor(row.category),
                          }}
                        >
                          {CATEGORY_LABELS[row.category]}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            row.type === 'GLOBAL'
                              ? row.isActive
                                ? 'bg-violet-100 text-violet-800'
                                : 'bg-stone-200 text-stone-600'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {row.type === 'GLOBAL'
                            ? row.isActive
                              ? 'قاعدة عامة · نشطة'
                              : 'قاعدة عامة · موقوفة'
                            : 'اختلاف آية'}
                        </span>
                        <StatusBadge status={row.status} />
                        {row.surahName && (
                          <span className="text-[10px] text-stone-500">
                            {row.surahName} · آية {row.ayahNumber}
                          </span>
                        )}
                        {row.ayahKey === currentAyahKey && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                            الآية المفتوحة
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold text-stone-900">{row.title || 'بلا عنوان'}</h3>
                      <p className="mt-0.5 text-[11px] text-stone-600">
                        {row.targetText} · {describeScope(row.scope, { catalog })}
                      </p>
                      {row.globalRule?.pattern && (
                        <p className="mt-0.5 text-[10px] text-violet-700">
                          التطبيق: {describeGlobalPattern(row.globalRule.pattern)}
                        </p>
                      )}
                      {row.globalRule?.pattern && <RuleStats ruleId={row.globalRule.id} refreshKey={occurrences.key} />}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {row.type === 'LOCAL' && row.ayahKey && (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigate(row.ayahKey!, row.variantId);
                            onClose();
                          }}
                          className="rounded border border-emerald-200 px-2 py-1 text-[11px] text-emerald-800 hover:bg-emerald-50"
                        >
                          فتح في مكانه
                        </button>
                      )}
                      {row.globalRule && (
                        <>
                          {row.globalRule.pattern && (
                            <button
                              type="button"
                              onClick={() => setReviewingRule(row.globalRule ?? null)}
                              className="rounded border border-violet-200 px-2 py-1 text-[11px] text-violet-800 hover:bg-violet-50"
                              title="مراجعة مواضع القاعدة في المصحف كله موضعا موضعا بالسابق والتالي"
                            >
                              تتبّع المواضع
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingRule(row.globalRule ?? null)}
                            className="rounded border border-stone-300 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
                          >
                            تحرير
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(row.globalRule!)}
                            className="rounded border border-amber-300 px-2 py-1 text-[11px] text-amber-800 hover:bg-amber-50"
                            title="إيقاف القاعدة يخفيها من كل المصحف دون حذف بياناتها"
                          >
                            {row.isActive ? 'إيقاف' : 'تفعيل'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRule(row.globalRule!)}
                            className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
                          >
                            حذف
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {reviewingRule && (
        <RuleOccurrenceReview
          rule={reviewingRule}
          startAtAyahKey={currentAyahKey}
          onOpenInEditor={(ayahKey) => {
            setReviewingRule(null);
            onRulesChanged();
            onNavigate(ayahKey);
            onClose();
          }}
          onClose={() => {
            setReviewingRule(null);
            refresh();
            onRulesChanged();
          }}
        />
      )}

      {editingRule && (
        <GlobalRuleMetaEditor
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSaved={() => {
            setEditingRule(null);
            refresh();
            onRulesChanged();
          }}
        />
      )}
    </div>
  );
}

/** إحصاء سريع لحالة مواضع القاعدة من مخزن الاستثناءات وحده. */
function RuleStats({ ruleId, refreshKey }: { ruleId: string; refreshKey: string }) {
  const stats = useMemo(() => {
    void refreshKey;
    return occurrenceStats(ruleId);
  }, [ruleId, refreshKey]);
  if (stats.deleted === 0 && stats.confirmed === 0 && stats.edited === 0) return null;

  return (
    <p className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
      {stats.confirmed > 0 && (
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{stats.confirmed} معتمدا</span>
      )}
      {stats.deleted > 0 && (
        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-800">{stats.deleted} محذوفا موضعيا</span>
      )}
      {stats.edited > 0 && (
        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-800">{stats.edited} بدرجة مخصَّصة</span>
      )}
    </p>
  );
}

function readIndexRows(): IndexRow[] {
  const local: IndexRow[] = [];
  for (const entry of listDocuments()) {
    const document = loadDocument(entry.ayahKey);
    if (!document) continue;
    const surahName = getSurahOrFirst(document.surahNumber).name;
    for (const variant of document.variants) {
      local.push(toLocalRow(document.ayahKey, document.ayahNumber, document.meta.updatedAt, surahName, variant));
    }
  }

  const global = listGlobalRules().map(
    (rule): IndexRow => ({
      key: `global:${rule.id}`,
      type: 'GLOBAL',
      title: rule.title,
      category: rule.category,
      status: rule.status,
      scope: rule.scope,
      description: rule.description,
      sourceRef: rule.sourceRef,
      updatedAt: rule.updatedAt,
      isActive: rule.isActive,
      targetText: rule.ruleLabel || 'قاعدة عامة للمصحف كله',
      globalRule: rule,
    })
  );

  return [...local, ...global].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

function toLocalRow(
  ayahKey: number,
  ayahNumber: number,
  updatedAt: string,
  surahName: string,
  variant: Variant
): IndexRow {
  const drawable = variant.alternatives.filter((alternative) => !alternative.isBase);
  const targetText =
    variant.targetKind === 'CHARACTERS' && variant.characterRange
      ? `حروف: كلمة ${variant.characterRange.start.position}/${variant.characterRange.start.characterIndex} إلى ${variant.characterRange.end.position}/${variant.characterRange.end.characterIndex}`
      : `الكلمات ${variant.startPosition}${variant.endPosition !== variant.startPosition ? `–${variant.endPosition}` : ''}`;

  return {
    key: `local:${ayahKey}:${variant.id}`,
    type: 'LOCAL',
    title: variant.title,
    category: variant.category,
    status: variant.status,
    scope: drawable[0]?.scope ?? { kind: 'ALL' },
    description: variant.description,
    sourceRef: variant.sourceRef,
    updatedAt,
    isActive: true,
    surahName,
    ayahNumber,
    ayahKey,
    variantId: variant.id,
    targetText: `${targetText} · ${drawable.length} وجها`,
  };
}

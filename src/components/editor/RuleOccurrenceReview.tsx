// تتبّع مواضع القاعدة العامة — مراجعة موضعا موضعا
//
// حين تُطبَّق قاعدة على المصحف كله قد تصيب آلاف المواضع، فلا يكفي أن يُقال
// للمحقق «طُبِّقت في 2344 موضعا». هذه الشاشة تمشي به على المواضع واحدا
// واحدا بـ«التالي» و«السابق»، تعرض له الآية كاملة والموضع مُميَّزا فيها،
// فيؤكّد الصواب ويحذف الخطأ ويخصّص الدرجة لموضع بعينه.
//
// وأصل التصميم هنا: الحذف موضعي. حذف القاعدة من موضع لا يمسّها في غيره،
// ويُسجَّل في سجل ظاهر في التبويب الثاني يبيّن أين حُذفت ومتى ولماذا.

'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAyahByKey, getAyahWordsByKey, getSurahOrFirst } from '@/data/quran';
import { findGlobalRuleMatches, type GlobalRuleMatch } from '@/lib/quran-logic/global-rule-engine';
import { characterBoundsForWord, splitQuranCharacters } from '@/lib/quran-logic/characters';
import {
  confirmOccurrence,
  deleteOccurrence,
  listOccurrenceLog,
  occurrenceIdFor,
  restoreOccurrence,
  setOccurrenceStrength,
  type OccurrenceLogEntry,
  type RuleOccurrenceOverride,
} from '@/lib/storage/rule-occurrences-store';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { describeScope } from '@/lib/tashjeer/scope';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import type { GlobalRule } from '@/lib/storage/global-rules-store';
import type { ReaderStrengthMap } from '@/types/tashjeer';
import { StrengthDegreePicker } from './StrengthDegreePicker';

interface RuleOccurrenceReviewProps {
  rule: GlobalRule;
  onClose: () => void;
  /** اسم الآية المفتوحة في المحرر، ليبدأ الاستعراض منها إن كانت من المواضع. */
  startAtAyahKey?: number;
  /**
   * فتح آية الموضع داخل المحرر نفسه دون إعادة تحميل الصفحة. عند غيابه
   * (كصفحة الفهرس المستقلة) يُستعمل رابط عادي إلى المحرر.
   */
  onOpenInEditor?: (ayahKey: number) => void;
}

type OccurrenceFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'DELETED' | 'EDITED';

const FILTER_LABELS: Record<OccurrenceFilter, string> = {
  ALL: 'كل المواضع',
  PENDING: 'ما لم يُراجَع',
  CONFIRMED: 'ما اعتُمد',
  DELETED: 'ما حُذف',
  EDITED: 'ما خُصِّصت درجته',
};

const ACTION_LABELS: Record<OccurrenceLogEntry['action'], string> = {
  DELETE: 'حذف موضعي',
  RESTORE: 'إرجاع',
  CONFIRM: 'اعتماد',
  EDIT: 'تعديل درجة',
};

export function RuleOccurrenceReview({ rule, onClose, startAtAyahKey, onOpenInEditor }: RuleOccurrenceReviewProps) {
  const catalog = useTransmissionCatalog();
  const strengthDegrees = useStrengthDegrees();
  const occurrences = useRuleOccurrences(rule.id);
  const [tab, setTab] = useState<'REVIEW' | 'LOG'>('REVIEW');
  const [filter, setFilter] = useState<OccurrenceFilter>('ALL');
  const [index, setIndex] = useState(0);
  const [reason, setReason] = useState('');
  const [scanning, setScanning] = useState(true);
  const [matches, setMatches] = useState<GlobalRuleMatch[]>([]);

  // فحص المصحف كله مرة واحدة عند الفتح. الفحص الكامل يستغرق أجزاء من الثانية،
  // لكن تكراره مع كل ضغطة «التالي» إسراف؛ فنُبقي النتيجة في الذاكرة ونحدّث
  // الحالات فوقها من مخزن الاستثناءات.
  useEffect(() => {
    if (!rule.pattern) {
      setMatches([]);
      setScanning(false);
      return;
    }
    setScanning(true);
    // نؤخّر الفحص إطارا حتى تُرسم الشاشة وتظهر رسالة الانتظار.
    const timer = window.setTimeout(() => {
      setMatches(findGlobalRuleMatches({ id: rule.id, pattern: rule.pattern }));
      setScanning(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [rule.id, rule.pattern]);

  const overrideMap = useMemo(
    () => new Map(occurrences.overrides.map((item) => [item.id, item])),
    [occurrences.overrides]
  );

  const rows = useMemo(
    () =>
      matches.map((match) => {
        const id = occurrenceIdFor(rule.id, match);
        return { id, match, override: overrideMap.get(id) };
      }),
    [matches, overrideMap, rule.id]
  );

  const visible = useMemo(() => rows.filter((row) => passesFilter(row.override, filter)), [rows, filter]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      deleted: rows.filter((row) => row.override?.state === 'DELETED').length,
      confirmed: rows.filter((row) => row.override?.state === 'CONFIRMED').length,
      edited: rows.filter((row) => row.override?.strengthDegreeId || row.override?.strengthByNarrator).length,
    }),
    [rows]
  );

  // عند تغيّر المرشّح أو المواضع نُبقي المؤشر داخل الحدود، وإلا خرج الاستعراض فارغا.
  useEffect(() => {
    setIndex((current) => (visible.length === 0 ? 0 : Math.min(current, visible.length - 1)));
  }, [visible.length]);

  // البدء من الآية المفتوحة في المحرر: أقرب ما يبحث عنه المحقق هو ما أمامه.
  const [jumped, setJumped] = useState(false);
  useEffect(() => {
    if (jumped || scanning || !startAtAyahKey || visible.length === 0) return;
    const found = visible.findIndex((row) => row.match.ayahKey === startAtAyahKey);
    if (found >= 0) setIndex(found);
    setJumped(true);
  }, [jumped, scanning, startAtAyahKey, visible]);

  const current = visible[index];

  // لوحة المفاتيح: الأسهم للتنقل كما في التنقل بين الآيات.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (tab !== 'REVIEW') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowLeft') setIndex((value) => Math.min(value + 1, Math.max(visible.length - 1, 0)));
      if (event.key === 'ArrowRight') setIndex((value) => Math.max(value - 1, 0));
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, tab, visible.length]);

  const step = (delta: number) => {
    setReason('');
    setIndex((value) => Math.min(Math.max(value + delta, 0), Math.max(visible.length - 1, 0)));
  };

  const handleDelete = () => {
    if (!current) return;
    deleteOccurrence(rule.id, current.match, reason);
    setReason('');
    occurrences.refresh();
  };

  const handleRestore = () => {
    if (!current) return;
    restoreOccurrence(current.id);
    occurrences.refresh();
  };

  const handleConfirm = () => {
    if (!current) return;
    confirmOccurrence(rule.id, current.match);
    occurrences.refresh();
    // الاعتماد خطوة مراجعة، فينتقل تلقائيا إلى ما يليه توفيرا لنقرة.
    step(1);
  };

  const handleStrength = (next: { degreeId?: string; byNarrator?: ReaderStrengthMap }) => {
    if (!current) return;
    setOccurrenceStrength(rule.id, current.match, {
      strengthDegreeId: next.degreeId,
      strengthByNarrator: next.byNarrator,
    });
    occurrences.refresh();
  };

  const log = useMemo(() => {
    // المفتاح ضمن الاعتماديات ليُعاد قراءة السجل بعد كل حذف أو إرجاع.
    void occurrences.key;
    return listOccurrenceLog(rule.id, 200);
  }, [rule.id, occurrences.key]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="تتبع مواضع القاعدة"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="border-b border-stone-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-stone-900">تتبّع تطبيق القاعدة: {rule.title}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500">
                راجع كل موضع على حدة. الحذف هنا موضعي لا يمسّ بقية المواضع، ويُسجَّل في السجل بتاريخه وسببه.
                {' · '}
                {describeScope(rule.scope, { catalog })}
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tab active={tab === 'REVIEW'} onClick={() => setTab('REVIEW')}>
              استعراض المواضع
            </Tab>
            <Tab active={tab === 'LOG'} onClick={() => setTab('LOG')}>
              سجل التغييرات ({log.length})
            </Tab>
            <div className="ms-auto flex flex-wrap gap-1.5 text-[11px]">
              <Stat label="مطابق" value={counts.total} tone="stone" />
              <Stat label="معتمد" value={counts.confirmed} tone="emerald" />
              <Stat label="محذوف موضعيا" value={counts.deleted} tone="rose" />
              <Stat label="درجة مخصَّصة" value={counts.edited} tone="indigo" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'LOG' ? (
            <LogTable log={log} />
          ) : scanning ? (
            <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-xs text-stone-600">
              يجري فحص المصحف كله لهذه القاعدة…
            </p>
          ) : !rule.pattern ? (
            <p className="rounded border border-dashed border-amber-300 bg-amber-50 px-4 py-8 text-center text-xs text-amber-800">
              هذه قاعدة وصفية بلا نمط آلي، فليس لها مواضع تُتتبَّع. أضف نمطا حرفيا أو صرفيا ليعمل التتبع.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(FILTER_LABELS) as OccurrenceFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFilter(value);
                      setIndex(0);
                    }}
                    className={`rounded border px-2.5 py-1 text-[11px] ${
                      filter === value
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {FILTER_LABELS[value]}
                  </button>
                ))}
              </div>

              {visible.length === 0 ? (
                <p className="mt-4 rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-xs text-stone-600">
                  لا موضع يطابق هذا المرشّح.
                </p>
              ) : (
                current && (
                  <OccurrenceCard
                    key={current.id}
                    match={current.match}
                    override={current.override}
                    position={index + 1}
                    total={visible.length}
                    reason={reason}
                    onReasonChange={setReason}
                    onPrevious={() => step(-1)}
                    onNext={() => step(1)}
                    onFirst={() => setIndex(0)}
                    onLast={() => setIndex(visible.length - 1)}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                    onConfirm={handleConfirm}
                    onStrengthChange={handleStrength}
                    onOpenInEditor={onOpenInEditor}
                    rule={rule}
                    degreeLabel={
                      strengthDegrees.degrees.find(
                        (degree) => degree.id === (current.override?.strengthDegreeId ?? rule.strengthDegreeId)
                      )?.label
                    }
                  />
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OccurrenceCard({
  match,
  override,
  position,
  total,
  reason,
  onReasonChange,
  onPrevious,
  onNext,
  onFirst,
  onLast,
  onDelete,
  onRestore,
  onConfirm,
  onStrengthChange,
  onOpenInEditor,
  rule,
  degreeLabel,
}: {
  match: GlobalRuleMatch;
  override?: RuleOccurrenceOverride;
  position: number;
  total: number;
  reason: string;
  onReasonChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onConfirm: () => void;
  onStrengthChange: (next: { degreeId?: string; byNarrator?: ReaderStrengthMap }) => void;
  onOpenInEditor?: (ayahKey: number) => void;
  rule: GlobalRule;
  degreeLabel?: string;
}) {
  const ayah = match.ayahKey ? getAyahByKey(match.ayahKey) : undefined;
  const surah = ayah ? getSurahOrFirst(ayah.surahNumber) : undefined;
  const words = useMemo(() => (match.ayahKey ? getAyahWordsByKey(match.ayahKey) : []), [match.ayahKey]);
  const deleted = override?.state === 'DELETED';

  return (
    <article className="mt-4 rounded-lg border border-stone-200">
      {/* شريط التنقل: مطابق لتنقل الآيات في المحرر حتى لا يتعلم المحقق نمطين. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <NavButton onClick={onFirst} disabled={position === 1} label="الأول">
            ⏮
          </NavButton>
          <NavButton onClick={onPrevious} disabled={position === 1} label="السابق">
            السابق ›
          </NavButton>
          <span className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-800">
            الموضع {position} من {total}
          </span>
          <NavButton onClick={onNext} disabled={position === total} label="التالي">
            ‹ التالي
          </NavButton>
          <NavButton onClick={onLast} disabled={position === total} label="الأخير">
            ⏭
          </NavButton>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-stone-600">
          <StateBadge override={override} />
          {surah && ayah && (onOpenInEditor ? (
            <button
              type="button"
              onClick={() => onOpenInEditor(ayah.key)}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-emerald-800 hover:bg-emerald-50"
              title="فتح الآية في المحرر مباشرة دون مغادرة الجلسة"
            >
              فتح في المحرر: {surah.name} {ayah.ayahNumber}
            </button>
          ) : (
            <a
              href={`/editor?ayah=${ayah.key}`}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-emerald-800 hover:bg-emerald-50"
            >
              فتح في المحرر: {surah.name} {ayah.ayahNumber}
            </a>
          ))}
        </div>
      </div>

      {/* نص الآية مع تمييز الموضع */}
      <div className="px-4 py-4">
        <p
          dir="rtl"
          className="text-2xl leading-[2.4] text-stone-900"
          style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
        >
          {words.map((word) => {
            const inRange = word.position >= match.startPosition && word.position <= match.endPosition;
            if (!inRange) {
              return (
                <span key={word.position} className="text-stone-700">
                  {word.text}{' '}
                </span>
              );
            }
            return (
              <span
                key={word.position}
                className={`rounded px-0.5 ${deleted ? 'bg-rose-100 text-rose-900 line-through decoration-rose-400' : 'bg-emerald-100 text-emerald-950'}`}
              >
                {highlightWord(word.text, word.position, match)}{' '}
              </span>
            );
          })}
        </p>
        <p className="mt-2 text-[11px] text-stone-500">
          الكلمات {match.startPosition}–{match.endPosition} · النص المطابق:{' '}
          <span style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>{match.matchedText}</span>
          {degreeLabel ? ` · الدرجة: ${degreeLabel}` : ''}
        </p>
      </div>

      {/* الإجراءات */}
      <div className="border-t border-stone-200 px-4 py-3">
        {deleted ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-[11px] text-rose-900">
              القاعدة محذوفة في هذا الموضع وحده.
              {override?.reason ? ` السبب: ${override.reason}` : ''}
              {override?.updatedAt ? ` (${formatDate(override.updatedAt)})` : ''}
            </p>
            <button
              type="button"
              onClick={onRestore}
              className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
            >
              إرجاع القاعدة إلى هذا الموضع
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[16rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium text-stone-700">
                سبب الحذف من هذا الموضع (يُحفظ في السجل)
              </span>
              <input
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                className="input"
                placeholder="مثال: الموضع مستثنى عند أهل الأداء."
              />
            </label>
            <button
              type="button"
              onClick={onDelete}
              className="rounded bg-rose-600 px-3 py-2 text-[11px] font-medium text-white hover:bg-rose-700"
            >
              حذف من هذا الموضع فقط
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded bg-emerald-600 px-3 py-2 text-[11px] font-medium text-white hover:bg-emerald-700"
            >
              اعتماد الموضع والانتقال
            </button>
          </div>
        )}
      </div>

      {/* درجة القوة لهذا الموضع وحده */}
      <div className="border-t border-stone-200 px-4 py-3">
        <StrengthDegreePicker
          scope={rule.scope}
          degreeId={override?.strengthDegreeId ?? rule.strengthDegreeId}
          byNarrator={override?.strengthByNarrator ?? rule.strengthByNarrator}
          onChange={onStrengthChange}
          hint="هذه الدرجة تخص هذا الموضع وحده. تعديلها هنا لا يغيّر درجة القاعدة في بقية المصحف."
        />
      </div>
    </article>
  );
}

/**
 * يميّز داخل الكلمة الحروفَ الداخلة في المطابقة.
 *
 * التمييز على مستوى الكلمة وحده لا يكفي حين تكون القاعدة على حرف واحد
 * (كنون ساكنة قبل حرف إخفاء)، فيظن المحقق أن الحكم على الكلمة كلها.
 */
function highlightWord(text: string, position: number, match: GlobalRuleMatch): ReactNode {
  const bounds = characterBoundsForWord(match.characterRange, position, text);
  const characters = splitQuranCharacters(text);
  if (!bounds || (bounds.start === 1 && bounds.end === characters.length)) return text;

  const join = (from: number, to: number) =>
    characters
      .slice(from, to)
      .map((character) => character.text)
      .join('');

  return (
    <>
      {join(0, bounds.start - 1)}
      <mark className="rounded bg-amber-200 px-0.5 text-stone-950">{join(bounds.start - 1, bounds.end)}</mark>
      {join(bounds.end, characters.length)}
    </>
  );
}

function LogTable({ log }: { log: OccurrenceLogEntry[] }) {
  if (log.length === 0) {
    return (
      <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-xs text-stone-600">
        لم يُسجَّل بعد أي حذف أو تعديل على مواضع هذه القاعدة.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-stone-200">
      <table className="w-full text-xs">
        <thead className="bg-stone-50 text-stone-700">
          <tr>
            <th className="px-3 py-2 text-start font-semibold">الإجراء</th>
            <th className="px-3 py-2 text-start font-semibold">الموضع</th>
            <th className="px-3 py-2 text-start font-semibold">النص</th>
            <th className="px-3 py-2 text-start font-semibold">السبب</th>
            <th className="px-3 py-2 text-start font-semibold">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {log.map((entry) => {
            const ayah = entry.ayahKey ? getAyahByKey(entry.ayahKey) : undefined;
            return (
              <tr key={entry.id} className="border-t border-stone-100">
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      entry.action === 'DELETE'
                        ? 'bg-rose-100 text-rose-800'
                        : entry.action === 'RESTORE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : entry.action === 'CONFIRM'
                            ? 'bg-cyan-100 text-cyan-900'
                            : 'bg-indigo-100 text-indigo-900'
                    }`}
                  >
                    {ACTION_LABELS[entry.action]}
                  </span>
                </td>
                <td className="px-3 py-2 text-stone-700">
                  {ayah ? `${getSurahOrFirst(ayah.surahNumber).name} ${ayah.ayahNumber}` : '—'}
                </td>
                <td className="px-3 py-2 text-stone-800" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
                  {entry.matchedText ?? '—'}
                </td>
                <td className="px-3 py-2 text-stone-600">{entry.reason ?? '—'}</td>
                <td className="px-3 py-2 text-stone-500">{formatDate(entry.at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ==================== عناصر صغيرة ====================

function passesFilter(override: RuleOccurrenceOverride | undefined, filter: OccurrenceFilter): boolean {
  switch (filter) {
    case 'PENDING':
      return !override || override.state === 'APPLIED';
    case 'CONFIRMED':
      return override?.state === 'CONFIRMED';
    case 'DELETED':
      return override?.state === 'DELETED';
    case 'EDITED':
      return Boolean(override?.strengthDegreeId || override?.strengthByNarrator);
    default:
      return true;
  }
}

function StateBadge({ override }: { override?: RuleOccurrenceOverride }) {
  if (override?.state === 'DELETED') {
    return <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">محذوف هنا</span>;
  }
  if (override?.state === 'CONFIRMED') {
    return <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">معتمد</span>;
  }
  return <span className="rounded bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-700">لم يُراجَع</span>;
}

function NavButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-[11px] font-medium ${
        active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-800',
    emerald: 'bg-emerald-100 text-emerald-900',
    rose: 'bg-rose-100 text-rose-900',
    indigo: 'bg-indigo-100 text-indigo-900',
  };
  return (
    <span className={`rounded px-2 py-1 ${tones[tone] ?? tones.stone}`}>
      {label}: {value}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

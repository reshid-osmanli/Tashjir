// منشئ قاعدة عامة من داخل المحرر
//
// يتيح للمحقق تحويل التحديد الحرفي الحالي إلى قاعدة واحدة للمصحف كله، مع
// ضبط مطابقة الحركة لكل حرف. كما يتيح نمطا صرفيا محدودا (قالب/بادئة/لاحقة)
// مبنيا على المطابقة الحتمية، لا على التخمين أو الذكاء الاصطناعي.

'use client';

import { useMemo, useState } from 'react';
import { getAyahWordsByKey, getAyahByKey, getSurahOrFirst } from '@/data/quran';
import { characterCount } from '@/lib/quran-logic/characters';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { resolveScope } from '@/lib/tashjeer/scope';
import { pruneStrengthMap } from '@/lib/tashjeer/strength-degrees';
import {
  buildCharacterPattern,
  describeGlobalPattern,
  findGlobalRuleMatches,
  GLOBAL_CHARACTER_SET_LABELS,
} from '@/lib/quran-logic/global-rule-engine';
import {
  createGlobalRuleId,
  saveGlobalRule,
  setGlobalRuleOrderRank,
  type GlobalRule,
} from '@/lib/storage/global-rules-store';
import {
  MORPHOLOGY_FEATURE_HINTS,
  MORPHOLOGY_FEATURE_LABELS,
  PARTICLE_CLASS_LABELS,
  WORD_ENDING_HARAKA_LABELS,
} from '@/lib/quran-logic/arabic-grammar';
import type { VariantCategory } from '@/types';
import type {
  AyahWordPosition,
  CharacterMatchScope,
  CharacterRange,
  GlobalCharacterPattern,
  GlobalCharacterSet,
  GlobalMorphologyPattern,
  GlobalMorphologyWordPattern,
  GlobalRulePattern,
  GlobalWordCharacterPattern,
  HarakaMatchMode,
  MorphologyFeature,
  ParticleClass,
  ReaderStrengthMap,
  ReadingScope,
  VerificationStatus,
  WordEndingHaraka,
} from '@/types/tashjeer';
import { ScopePicker } from './VariantEditor';
import { StrengthDegreePicker } from './StrengthDegreePicker';

/** بيانات ابتدائية تُزرع في النموذج عند التعميم من وجه أو اختلاف قائم. */
export interface GlobalRuleSeed {
  title?: string;
  category?: VariantCategory;
  scope?: ReadingScope;
  ruleLabel?: string;
  maddHarakat?: number;
  description?: string;
  sourceRef?: string;
  strengthDegreeId?: string;
  strengthByNarrator?: ReaderStrengthMap;
  orderRank?: number;
}

interface GlobalRuleBuilderProps {
  ayahKey: number;
  characterRange: CharacterRange | null;
  initialKind?: GlobalRulePattern['kind'];
  /** يملأ الحقول الوصفية من وجه/اختلاف قائم عند «التعميم على المصحف». */
  seed?: GlobalRuleSeed;
  onClose: () => void;
  onSaved: (rule: GlobalRule, matchCount: number) => void;
}

const STATUS_OPTIONS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'REVIEW', label: 'قيد المراجعة' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'REJECTED', label: 'مرفوض' },
];

const MODE_OPTIONS: Array<{ value: HarakaMatchMode; label: string }> = [
  { value: 'EXACT', label: 'مطابقة الضبط المحدد' },
  { value: 'IGNORE', label: 'تجاهل الحركة (أي حركة)' },
  { value: 'SAKIN', label: 'ساكن (بعلامة السكون أو معرّى)' },
  { value: 'NONE', label: 'بلا أي علامة فقط' },
];

const MATCH_SCOPE_OPTIONS: Array<{ value: CharacterMatchScope; label: string; hint: string }> = [
  { value: 'WORDS', label: 'بين الكلمات كما حُدِّد', hint: 'يطابق التتابع موزعا على الكلمات كما في الموضع المصدر: نهاية كلمة فبداية أخرى.' },
  { value: 'INSIDE_WORD', label: 'داخل الكلمة الواحدة', hint: 'يبحث عن التتابع نفسه حروفا متجاورة في جوف كل كلمة، مثل النون الساكنة في «أَنتُمْ».' },
  { value: 'BOTH', label: 'بين الكلمات وداخلها معا', hint: 'الدقة الكاملة للأحكام الصوتية: الحكم يجري بين الكلمتين وفي داخل الكلمة سواء.' },
];

export function GlobalRuleBuilder({
  ayahKey,
  characterRange,
  initialKind = 'CHARACTERS',
  seed,
  onClose,
  onSaved,
}: GlobalRuleBuilderProps) {
  const catalog = useTransmissionCatalog();
  const [kind, setKind] = useState<GlobalRulePattern['kind']>(initialKind);
  const [characterPattern, setCharacterPattern] = useState<GlobalCharacterPattern | null>(() => {
    if (!characterRange) return null;
    try {
      return buildCharacterPattern(ayahKey, characterRange);
    } catch {
      return null;
    }
  });
  const [morphologyWords, setMorphologyWords] = useState<GlobalMorphologyWordPattern[]>([
    { offset: 0, harakaMode: 'IGNORE' },
  ]);
  const [strengthDegreeId, setStrengthDegreeId] = useState<string | undefined>(seed?.strengthDegreeId);
  const [strengthByNarrator, setStrengthByNarrator] = useState<ReaderStrengthMap | undefined>(seed?.strengthByNarrator);
  const [title, setTitle] = useState(seed?.title ?? '');
  const [category, setCategory] = useState<VariantCategory>(seed?.category ?? 'TAJWEED');
  const [scope, setScope] = useState<ReadingScope>(seed?.scope ?? { kind: 'ALL' });
  const [ruleLabel, setRuleLabel] = useState(seed?.ruleLabel ?? '');
  const [maddHarakat, setMaddHarakat] = useState(seed?.maddHarakat?.toString() ?? '');
  const [orderRank, setOrderRank] = useState(
    typeof seed?.orderRank === 'number' ? seed.orderRank.toString() : ''
  );
  const [description, setDescription] = useState(seed?.description ?? '');
  const [sourceRef, setSourceRef] = useState(seed?.sourceRef ?? '');
  const [status, setStatus] = useState<VerificationStatus>('DRAFT');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  /** كل كلمات القاعدة الصرفية يجب أن تحمل معيارا، وإلا طابقت كل شيء. */
  const morphologyHasCriteria = useMemo(
    () => morphologyWords.length > 0 && morphologyWords.every((word) => hasAnyCriteria(word)),
    [morphologyWords]
  );

  const pattern = useMemo<GlobalRulePattern | null>(() => {
    if (kind === 'CHARACTERS') return characterPattern;
    if (!morphologyHasCriteria) return null;
    return {
      kind: 'MORPHOLOGY',
      version: 1,
      wordCount: morphologyWords.length,
      words: morphologyWords.map((word, index) => ({ ...cleanMorphologyWord(word), offset: index })),
      sourceAyahKey: ayahKey,
    } satisfies GlobalMorphologyPattern;
  }, [ayahKey, characterPattern, kind, morphologyHasCriteria, morphologyWords]);

  const matches = useMemo(
    () => (pattern ? findGlobalRuleMatches({ id: 'preview', pattern }) : []),
    [pattern]
  );

  const sourceWords = useMemo(() => getAyahWordsByKey(ayahKey), [ayahKey]);
  const sourceAyah = useMemo(() => getAyahByKey(ayahKey), [ayahKey]);

  const updateConstraintMode = (wordOffset: number, constraintIndex: number, mode: HarakaMatchMode) => {
    setCharacterPattern((current) => {
      if (!current) return current;
      return {
        ...current,
        words: current.words.map((word) =>
          word.offset !== wordOffset
            ? word
            : {
                ...word,
                constraints: word.constraints.map((constraint, index) =>
                  index === constraintIndex ? { ...constraint, harakaMode: mode } : constraint
                ),
              }
        ),
      };
    });
  };

  const updateConstraintSet = (wordOffset: number, constraintIndex: number, letterSet: GlobalCharacterSet) => {
    setCharacterPattern((current) => {
      if (!current) return current;
      return {
        ...current,
        words: current.words.map((word) =>
          word.offset !== wordOffset
            ? word
            : {
                ...word,
                constraints: word.constraints.map((constraint, index) =>
                  index === constraintIndex ? { ...constraint, letterSet } : constraint
                ),
              }
        ),
      };
    });
  };

  const toggleExactLength = (wordOffset: number, checked: boolean) => {
    setCharacterPattern((current) => {
      if (!current) return current;
      const sourcePosition = (current.sourceRange?.start.position ?? 1) + wordOffset;
      const sourceWord = sourceWords.find((word) => word.position === sourcePosition);
      const sourceLength = sourceWord ? characterCount(sourceWord.text) : undefined;
      return {
        ...current,
        words: current.words.map((word) =>
          word.offset === wordOffset
            ? { ...word, exactLength: checked ? word.exactLength ?? sourceLength : undefined }
            : word
        ),
      };
    });
  };

  const save = () => {
    setError('');
    if (!title.trim()) {
      setError('اكتب عنوانا واضحا للقاعدة.');
      return;
    }
    if (!pattern) {
      setError(
        kind === 'CHARACTERS'
          ? 'لا يوجد تحديد حرفي صالح. أغلق النافذة وحدد حروفا من المصحف أولا.'
          : 'فعّل معيارا صرفيا أو نحويا واحدا على الأقل، وإلا طابقت القاعدة كل كلمة في المصحف.'
      );
      return;
    }
    if (resolveScope(scope, catalog).length === 0) {
      setError('اختر قارئا أو راويا واحدا على الأقل.');
      return;
    }

    const saved = saveGlobalRule({
      id: createGlobalRuleId(),
      title,
      category,
      scope,
      ruleLabel: ruleLabel.trim() || undefined,
      maddHarakat: maddHarakat === '' ? undefined : Number(maddHarakat),
      pattern,
      strengthDegreeId,
      strengthByNarrator: pruneStrengthMap(strengthByNarrator, resolveScope(scope, catalog)),
      description: description.trim() || undefined,
      sourceRef: sourceRef.trim() || undefined,
      orderRank: orderRank === '' ? undefined : Math.max(1, Math.round(Number(orderRank))),
      evidences: [],
      status,
      isActive,
    });
    // ضبط الرتبة عبر المضبّط الرسمي يعيد ترقيم القواعد المتأثرة تلقائيا.
    if (saved.orderRank) setGlobalRuleOrderRank(saved.id, saved.orderRank);
    onSaved(saved, matches.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إنشاء قاعدة عامة من المحرر"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">قاعدة عامة للمصحف من المحرر</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500">
              تحفظ القاعدة مرة واحدة، ثم يفحصها المحرك في كل آيات المصحف دون نسخها إلى ٦٢٣٦ مستندا.
              المطابقة حرفية وحتمية ولا تعبر حدود الآية.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50">
            إغلاق
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-violet-200 bg-violet-50/60 p-3">
            <span className="text-xs font-semibold text-violet-950">نوع القاعدة</span>
            <button
              type="button"
              onClick={() => setKind('CHARACTERS')}
              disabled={!characterRange}
              className={`rounded border px-2.5 py-1 text-[11px] ${kind === 'CHARACTERS' ? 'border-violet-700 bg-violet-700 text-white' : 'border-violet-200 bg-white text-violet-900'} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              حروف من التحديد الحالي
            </button>
            <button
              type="button"
              onClick={() => setKind('MORPHOLOGY')}
              className={`rounded border px-2.5 py-1 text-[11px] ${kind === 'MORPHOLOGY' ? 'border-violet-700 bg-violet-700 text-white' : 'border-violet-200 bg-white text-violet-900'}`}
            >
              قاعدة نحوية وصرفية
            </button>
            <span className="ms-auto text-[11px] text-violet-900/75">
              {pattern ? describeGlobalPattern(pattern) : 'لم يكتمل النمط بعد'}
            </span>
          </div>

          {kind === 'CHARACTERS' && characterPattern ? (
            <>
              <section className="mt-4 rounded-md border border-teal-200 bg-teal-50/50 p-3">
                <h3 className="text-xs font-bold text-teal-950">أين يُبحث عن هذا التتابع؟</h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-teal-900/75">
                  الحكم الصوتي الواحد قد يجري بين كلمتين («مِنْ ثَمَرَةٍ») ويجري داخل الكلمة الواحدة («أَنتُمْ»).
                  اختر «بين الكلمات وداخلها» لتشمل القاعدة الحالتين معا بدقة.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MATCH_SCOPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      title={option.hint}
                      onClick={() =>
                        setCharacterPattern((current) =>
                          current ? { ...current, matchScope: option.value } : current
                        )
                      }
                      className={`rounded border px-2.5 py-1 text-[11px] ${
                        (characterPattern.matchScope ?? 'WORDS') === option.value
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : 'border-teal-200 bg-white text-teal-900 hover:bg-teal-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {(characterPattern.matchScope === 'INSIDE_WORD' || characterPattern.matchScope === 'BOTH') && (
                  <p className="mt-2 rounded bg-white px-2 py-1.5 text-[10px] leading-relaxed text-teal-900/80">
                    {characterPattern.words.reduce((total, word) => total + word.constraints.length, 0) < 2
                      ? 'تنبيه: البحث داخل الكلمة يتطلب تحديد حرفين متتابعين على الأقل، وإلا لم يطابق داخل الكلمات شيئا.'
                      : 'داخل الكلمة تُبسط قيود الكلمات إلى تتابع واحد متجاور من الحروف بترتيب التلاوة، وتُهمل مراسي البداية/النهاية وقيود الطول.'}
                  </p>
                )}
              </section>
              <CharacterPatternEditor
                pattern={characterPattern}
                sourceWords={sourceWords}
                onModeChange={updateConstraintMode}
                onLetterSetChange={updateConstraintSet}
                onExactLengthChange={toggleExactLength}
              />
            </>
          ) : kind === 'CHARACTERS' ? (
            <p className="mt-4 rounded border border-dashed border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              التحديد الحرفي غير صالح. أغلق النافذة وحدد بداية ونهاية داخل المصحف.
            </p>
          ) : (
            <MorphologySequenceEditor words={morphologyWords} onChange={setMorphologyWords} />
          )}

          <section className="mt-5 grid gap-3 md:grid-cols-2">
            <Field label="عنوان القاعدة">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="input" autoFocus placeholder="مثال: إخفاء النون الساكنة قبل حروف الإخفاء" />
            </Field>
            <Field label="الفئة">
              <select value={category} onChange={(event) => setCategory(event.target.value as VariantCategory)} className="input">
                {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}
              </select>
            </Field>
            <Field label="اسم الحكم الذي يظهر تحت الكلمة">
              <input value={ruleLabel} onChange={(event) => setRuleLabel(event.target.value)} className="input" placeholder="مثال: إخفاء" />
            </Field>
            <Field label="حركات المد (اختياري)">
              <input type="number" min={0} max={6} value={maddHarakat} onChange={(event) => setMaddHarakat(event.target.value)} className="input" placeholder="٢، ٤، ٥، ٦" />
            </Field>
            <Field label="رقم ترتيب السطر (اختياري)">
              <input
                type="number"
                min={1}
                value={orderRank}
                onChange={(event) => setOrderRank(event.target.value)}
                className="input"
                placeholder="أصغر رقم يعلو في التشجير"
              />
              <span className="mt-1 block text-[10px] leading-relaxed text-stone-500">
                رتبة أسطر القاعدة في التشجير. تعديله لاحقا ممكن من خصائص القاعدة، والقواعد
                المتأثرة تُعاد ترقيمها تلقائيا.
              </span>
            </Field>
            <Field label="حالة التوثيق">
              <select value={status} onChange={(event) => setStatus(event.target.value as VerificationStatus)} className="input">
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="مرجع القاعدة">
              <input value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} className="input" placeholder="النشر، طيبة النشر، أو المرجع" />
            </Field>
            <Field label="شرح وحدود التطبيق" className="md:col-span-2">
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="input resize-y" placeholder="اكتب ما يراجعه العالم، وما لا تشملُه القاعدة." />
            </Field>
          </section>

          <section className="mt-4 rounded-md border border-stone-200 p-3">
            <ScopePicker scope={scope} onChange={setScope} />
          </section>

          <section className="mt-4">
            <StrengthDegreePicker
              scope={scope}
              degreeId={strengthDegreeId}
              byNarrator={strengthByNarrator}
              onChange={(next) => {
                setStrengthDegreeId(next.degreeId);
                setStrengthByNarrator(next.byNarrator);
              }}
              hint="تُطبَّق هذه الدرجة على كل مواضع القاعدة في المصحف، ثم يمكن تعديل درجة موضع بعينه من شاشة تتبّع المواضع."
            />
          </section>

          <section className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-emerald-950">المعاينة على المصحف كله</h3>
                <p className="mt-0.5 text-[11px] text-emerald-900/75">
                  {matches.length} موضعا مطابقا حاليا — القاعدة لا تعبر من آخر آية إلى أول التالية.
                </p>
              </div>
              {sourceAyah && (
                <span className="text-[11px] text-emerald-900/75">
                  المصدر: {getSurahOrFirst(sourceAyah.surahNumber).name} · آية {sourceAyah.ayahNumber}
                </span>
              )}
            </div>
            {matches.length > 0 && (
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {matches.slice(0, 6).map((match, index) => {
                  const ayah = match.ayahKey ? getAyahByKey(match.ayahKey) : undefined;
                  return (
                    <li key={`${match.ayahKey}-${match.startPosition}-${index}`} className="rounded border border-emerald-100 bg-white px-2 py-1.5 text-[11px] text-stone-700">
                      {ayah ? `${getSurahOrFirst(ayah.surahNumber).name} ${ayah.ayahNumber}` : 'آية'}
                      {' · '}
                      <span className="font-medium" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>{match.matchedText}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {matches.length > 6 && <p className="mt-1 text-[10px] text-emerald-800">تظهر أول ستة مواضع فقط في المعاينة؛ سيطبق الحفظ العدد الكامل.</p>}
          </section>

          <label className="mt-4 flex items-center gap-2 text-xs text-stone-700">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="accent-emerald-600" />
            تفعيل القاعدة في المحرر وفي كل مواضع المصحف
          </label>
          {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded border border-stone-300 px-4 py-2 text-xs text-stone-700 hover:bg-stone-50">إلغاء</button>
          <button type="button" onClick={save} className="rounded bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700">حفظ وتطبيق القاعدة</button>
        </footer>
      </div>
    </div>
  );
}

function CharacterPatternEditor({
  pattern,
  sourceWords,
  onModeChange,
  onLetterSetChange,
  onExactLengthChange,
}: {
  pattern: GlobalCharacterPattern;
  sourceWords: ReturnType<typeof getAyahWordsByKey>;
  onModeChange: (wordOffset: number, constraintIndex: number, mode: HarakaMatchMode) => void;
  onLetterSetChange: (wordOffset: number, constraintIndex: number, letterSet: GlobalCharacterSet) => void;
  onExactLengthChange: (wordOffset: number, checked: boolean) => void;
}) {
  return (
    <section className="mt-4 rounded-md border border-cyan-200 bg-cyan-50/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-cyan-950">قيود الحروف — بدقة مستقلة لكل حرف</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-cyan-900/75">
            «مطابقة الضبط» تشترط الحركة والعلامات المختارة، و«تجاهل الحركة» يطابق الحرف مهما كانت حركته.
            الحرف في بداية/نهاية الكلمة مربوط بالطرف، أما الداخلي فرَقمه ثابت عمدا.
          </p>
        </div>
        <span className="rounded bg-white px-2 py-1 text-[11px] text-cyan-900">{pattern.wordCount} كلمة متجاورة</span>
      </div>

      <div className="mt-3 space-y-3">
        {pattern.words.map((wordPattern) => {
          const sourcePosition = (pattern.sourceRange?.start.position ?? 1) + wordPattern.offset;
          const sourceWord = sourceWords.find((word) => word.position === sourcePosition);
          return (
            <div key={wordPattern.offset} className="rounded border border-cyan-100 bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-stone-800">
                  الكلمة {wordPattern.offset + 1}{sourceWord ? ` · ${sourceWord.text}` : ''}
                </p>
                <label className="flex items-center gap-1.5 text-[11px] text-stone-700">
                  <input type="checkbox" checked={wordPattern.exactLength !== undefined} onChange={(event) => onExactLengthChange(wordPattern.offset, event.target.checked)} className="accent-cyan-700" />
                  مطابقة طول الكلمة تماما
                </label>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {wordPattern.constraints.map((constraint, constraintIndex) => (
                  <div key={`${wordPattern.offset}-${constraintIndex}`} className="rounded border border-stone-200 px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg text-stone-900" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
                        {constraint.baseLetter}{constraint.marks}
                      </span>
                      <span className="text-[10px] text-stone-500">{anchorLabel(constraint.anchor, constraint.value)}</span>
                    </div>
                    <label className="mt-1.5 block text-[10px] text-stone-600">
                      نوع الحرف
                      <select value={constraint.letterSet ?? 'EXACT'} onChange={(event) => onLetterSetChange(wordPattern.offset, constraintIndex, event.target.value as GlobalCharacterSet)} className="input mt-1 text-[11px]">
                        {(Object.keys(GLOBAL_CHARACTER_SET_LABELS) as GlobalCharacterSet[]).map((value) => (
                          <option key={value} value={value}>{GLOBAL_CHARACTER_SET_LABELS[value]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-1.5 block text-[10px] text-stone-600">
                      طريقة مطابقة الحركة
                      <select value={constraint.harakaMode} onChange={(event) => onModeChange(wordPattern.offset, constraintIndex, event.target.value as HarakaMatchMode)} className="input mt-1 text-[11px]">
                        {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** الخصائص الصرفية مقسّمة إلى مجموعات ليقرأها المحقق سريعا. */
const FEATURE_GROUPS: Array<{ title: string; features: MorphologyFeature[] }> = [
  { title: 'علامات التأنيث', features: ['TAA_MARBUTA', 'TAA_MAFTUHA', 'ALIF_MAQSURA', 'ALIF_MAMDUDA'] },
  { title: 'العدد والنسب والضمائر', features: ['DUAL_SUFFIX', 'SOUND_MASCULINE_PLURAL', 'SOUND_FEMININE_PLURAL', 'NISBA_YAA', 'PLURAL_WAW', 'ATTACHED_PRONOUN'] },
  { title: 'التعريف وبداية الكلمة', features: ['DEFINITE_AL', 'SHAMSI_AL', 'QAMARI_AL', 'HAMZAT_WASL_START'] },
  { title: 'الضبط والصوت', features: ['TANWEEN', 'SHADDA', 'HAMZA', 'MADD_LETTER', 'NOON_SAKINA_END', 'MEEM_SAKINA_END'] },
];

/** المجموعات المتاحة لقيدي أول الكلمة وآخرها. */
const LETTER_SET_OPTIONS: Array<Exclude<GlobalCharacterSet, 'EXACT'>> = [
  'IKHFAA',
  'IZHAR',
  'IDGHAM',
  'IQLAB',
  'QALQALAH',
  'GHUNNAH',
  'MAD',
];

const AYAH_POSITION_OPTIONS: Array<{ value: AyahWordPosition; label: string }> = [
  { value: 'ANY', label: 'أي موضع من الآية' },
  { value: 'FIRST', label: 'أول كلمة في الآية' },
  { value: 'LAST', label: 'آخر كلمة في الآية' },
  { value: 'NOT_LAST', label: 'ما عدا آخر كلمة' },
];

/** قوالب جاهزة لأكثر ما يُسأل عنه، تختصر على المحقق بناء المعايير يدويا. */
const MORPHOLOGY_PRESETS: Array<{ label: string; description: string; word: GlobalMorphologyWordPattern }> = [
  {
    label: 'كل ما ينتهي بتاء التأنيث',
    description: 'كل كلمة آخرها تاء مربوطة، مثل: رحمة، جنة.',
    word: { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['TAA_MARBUTA'] },
  },
  {
    label: 'وزن «فُعْلَى»',
    description: 'القالب الصرفي مع ألف التأنيث المقصورة، مثل: الكبرى، الحسنى.',
    word: { offset: 0, harakaMode: 'EXACT', template: 'فُعْلَى' },
  },
  {
    label: 'جمع المؤنث السالم',
    description: 'كل كلمة آخرها ألف وتاء، مثل: المؤمنات، الصالحات.',
    word: { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['SOUND_FEMININE_PLURAL'] },
  },
  {
    label: 'اسم مجرور بعد حرف جر',
    description: 'كلمة تسبقها أداة جر مباشرة وآخرها كسرة أو تنوين كسر.',
    word: {
      offset: 0,
      harakaMode: 'IGNORE',
      precededBy: ['JARR'],
      endingHaraka: ['KASRA', 'TANWEEN_KASR'],
    },
  },
  {
    label: 'منوّن بتنوين الفتح',
    description: 'كل كلمة آخرها تنوين فتح، وهو موضع الوقف بالألف.',
    word: { offset: 0, harakaMode: 'IGNORE', endingHaraka: ['TANWEEN_FATH'] },
  },
  {
    label: 'المعرّف بأل في آخر الآية',
    description: 'كلمة تبدأ بأل التعريف وتقع آخر الآية، لمسائل الوقف.',
    word: { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['DEFINITE_AL'], ayahPosition: 'LAST' },
  },
];

/** هل في نمط الكلمة معيار مفعّل واحد على الأقل؟ */
function hasAnyCriteria(word: GlobalMorphologyWordPattern): boolean {
  return Boolean(
    word.template?.trim() ||
      word.prefix?.trim() ||
      word.suffix?.trim() ||
      word.startsWithSet ||
      word.endsWithSet ||
      word.morphologyFeatures?.length ||
      word.excludedMorphologyFeatures?.length ||
      word.endingHaraka?.length ||
      word.precededBy?.length ||
      word.followedBy?.length ||
      (word.ayahPosition && word.ayahPosition !== 'ANY') ||
      word.minLength ||
      word.maxLength
  );
}

/** يحذف الحقول الفارغة قبل الحفظ، فلا يُخزَّن معيار غير مفعّل. */
function cleanMorphologyWord(word: GlobalMorphologyWordPattern): GlobalMorphologyWordPattern {
  const list = <T,>(value: T[] | undefined): T[] | undefined =>
    value && value.length > 0 ? value : undefined;

  return {
    offset: word.offset,
    harakaMode: word.harakaMode,
    template: word.template?.trim() || undefined,
    prefix: word.prefix?.trim() || undefined,
    suffix: word.suffix?.trim() || undefined,
    startsWithSet: word.startsWithSet || undefined,
    endsWithSet: word.endsWithSet || undefined,
    morphologyFeatures: list(word.morphologyFeatures),
    excludedMorphologyFeatures: list(word.excludedMorphologyFeatures),
    endingHaraka: list(word.endingHaraka),
    precededBy: list(word.precededBy),
    followedBy: list(word.followedBy),
    ayahPosition: word.ayahPosition && word.ayahPosition !== 'ANY' ? word.ayahPosition : undefined,
    minLength: word.minLength && word.minLength > 0 ? word.minLength : undefined,
    maxLength: word.maxLength && word.maxLength > 0 ? word.maxLength : undefined,
  };
}

/** أقصى عدد كلمات متجاورة في القاعدة الصرفية. */
const MAX_SEQUENCE_WORDS = 4;

/** قوالب جاهزة لسلاسل الكلمات: أحكام النون الساكنة والتنوين بين الكلمتين. */
const SEQUENCE_PRESETS: Array<{
  label: string;
  description: string;
  words: GlobalMorphologyWordPattern[];
}> = [
  {
    label: 'إخفاء: نون ساكنة + حرف إخفاء',
    description: 'كلمة تنتهي بنون ساكنة تليها كلمة أولها حرف من حروف الإخفاء الخمسة عشر، بغضّ النظر عن حركته.',
    words: [
      { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['NOON_SAKINA_END'] },
      { offset: 1, harakaMode: 'IGNORE', startsWithSet: 'IKHFAA' },
    ],
  },
  {
    label: 'إظهار: نون ساكنة + حرف حلقي',
    description: 'كلمة تنتهي بنون ساكنة تليها كلمة أولها حرف من حروف الإظهار الحلقية الستة.',
    words: [
      { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['NOON_SAKINA_END'] },
      { offset: 1, harakaMode: 'IGNORE', startsWithSet: 'IZHAR' },
    ],
  },
  {
    label: 'إدغام: نون ساكنة + حرف يرملون',
    description: 'كلمة تنتهي بنون ساكنة تليها كلمة أولها حرف من حروف الإدغام (يرملون).',
    words: [
      { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['NOON_SAKINA_END'] },
      { offset: 1, harakaMode: 'IGNORE', startsWithSet: 'IDGHAM' },
    ],
  },
  {
    label: 'إقلاب: نون ساكنة + باء',
    description: 'كلمة تنتهي بنون ساكنة تليها كلمة أولها باء.',
    words: [
      { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['NOON_SAKINA_END'] },
      { offset: 1, harakaMode: 'IGNORE', startsWithSet: 'IQLAB' },
    ],
  },
  {
    label: 'إخفاء شفوي: ميم ساكنة + باء',
    description: 'كلمة تنتهي بميم ساكنة تليها كلمة أولها باء.',
    words: [
      { offset: 0, harakaMode: 'IGNORE', morphologyFeatures: ['MEEM_SAKINA_END'] },
      { offset: 1, harakaMode: 'IGNORE', startsWithSet: 'IQLAB' },
    ],
  },
  {
    label: 'مد منفصل: واو الجماعة + همزة وصلية أولى',
    description: 'كلمة آخرها حرف مد (كواو الجماعة) تليها كلمة أولها همزة — أصل المد المنفصل.',
    words: [
      { offset: 0, harakaMode: 'IGNORE', endsWithSet: 'MAD' },
      { offset: 1, harakaMode: 'IGNORE', morphologyFeatures: ['HAMZA'] },
    ],
  },
];

/**
 * محرر سلسلة الكلمات في القاعدة النحوية/الصرفية.
 *
 * كل كلمة في السلسلة لها معاييرها المستقلة، والكلمات متجاورة وجوبا داخل
 * الآية الواحدة. هذا يجعل «نون ساكنة في آخر كلمة + حرف إخفاء في أول
 * التالية» قاعدة مبنية بالمعايير لا بتعداد الحروف.
 */
function MorphologySequenceEditor({
  words,
  onChange,
}: {
  words: GlobalMorphologyWordPattern[];
  onChange: (words: GlobalMorphologyWordPattern[]) => void;
}) {
  const setWord = (index: number, word: GlobalMorphologyWordPattern) =>
    onChange(words.map((item, position) => (position === index ? word : item)));

  const addWord = () => {
    if (words.length >= MAX_SEQUENCE_WORDS) return;
    onChange([...words, { offset: words.length, harakaMode: 'IGNORE' }]);
  };

  const removeWord = (index: number) => {
    if (words.length <= 1) return;
    onChange(words.filter((_, position) => position !== index).map((word, position) => ({ ...word, offset: position })));
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-violet-200 bg-violet-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-violet-950">سلسلة الكلمات ({words.length} من {MAX_SEQUENCE_WORDS})</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-violet-900/75">
              كلمات متجاورة داخل الآية الواحدة، لكل واحدة معاييرها. تصلح لأحكام
              «كلمة تنتهي بكذا تليها كلمة تبدأ بكذا».
            </p>
          </div>
          <button
            type="button"
            onClick={addWord}
            disabled={words.length >= MAX_SEQUENCE_WORDS}
            className="rounded border border-violet-300 bg-white px-2.5 py-1 text-[11px] text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + كلمة تالية
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SEQUENCE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title={preset.description}
              onClick={() => onChange(preset.words.map((word) => ({ ...word })))}
              className="rounded border border-violet-300 bg-white px-2 py-1 text-[11px] text-violet-900 hover:bg-violet-100"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {words.map((word, index) => (
        <div key={index} className="rounded-md border border-stone-300">
          <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-1.5">
            <span className="text-[11px] font-bold text-stone-800">
              {words.length === 1 ? 'الكلمة' : `الكلمة ${index + 1}${index === 0 ? ' (الأولى)' : index === words.length - 1 ? ' (الأخيرة)' : ''}`}
            </span>
            {words.length > 1 && (
              <button
                type="button"
                onClick={() => removeWord(index)}
                className="rounded border border-rose-200 px-2 py-0.5 text-[10px] text-rose-700 hover:bg-rose-50"
              >
                حذف هذه الكلمة
              </button>
            )}
          </div>
          <div className="p-1">
            <MorphologyPatternEditor word={word} onChange={(next) => setWord(index, next)} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * محرر القاعدة الصرفية والنحوية.
 *
 * المعايير هنا كلها تجتمع بـ«و» لا بـ«أو»: كل ما تفعّله يضيّق النتيجة. أما
 * داخل المعيار الواحد (كقائمة الأدوات السابقة) فيكفي تحقق واحد منها.
 * وسبب هذا التقسيم أن المحقق يبني القاعدة بالاستثناء لا بالجمع: يبدأ من
 * علامة ظاهرة ثم يستبعد ما لا يريد.
 */
function MorphologyPatternEditor({
  word,
  onChange,
}: {
  word: GlobalMorphologyWordPattern;
  onChange: (word: GlobalMorphologyWordPattern) => void;
}) {
  const patch = (changes: Partial<GlobalMorphologyWordPattern>) => onChange({ ...word, ...changes });

  const toggleInList = <T,>(list: T[] | undefined, value: T): T[] | undefined => {
    const current = list ?? [];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    return next.length > 0 ? next : undefined;
  };

  const toggleFeature = (feature: MorphologyFeature, excluded: boolean) => {
    if (excluded) {
      patch({
        excludedMorphologyFeatures: toggleInList(word.excludedMorphologyFeatures, feature),
        // لا يُطلب الشيء ويُستثنى في آن واحد.
        morphologyFeatures: word.morphologyFeatures?.filter((item) => item !== feature),
      });
    } else {
      patch({
        morphologyFeatures: toggleInList(word.morphologyFeatures, feature),
        excludedMorphologyFeatures: word.excludedMorphologyFeatures?.filter((item) => item !== feature),
      });
    }
  };

  return (
    <section className="mt-4 space-y-3">
      <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-amber-950">قاعدة على القواعد النحوية والصرفية</h3>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-amber-900/80">
              كل معيار تفعّله يضيّق النتيجة (تجتمع بـ«و»)، وداخل المعيار الواحد يكفي تحقق خيار واحد.
              وليس هنا تحليل إعرابي احتمالي: الشرط إما علامة ظاهرة في الرسم والضبط، أو أداة من قائمة معدودة.
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {MORPHOLOGY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title={preset.description}
              onClick={() => onChange({ ...preset.word, offset: word.offset })}
              className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-900 hover:bg-amber-100"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange({ offset: word.offset, harakaMode: word.harakaMode })}
            className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] text-stone-600 hover:bg-stone-100"
          >
            تفريغ كل المعايير
          </button>
        </div>
      </div>

      {/* الصرف: القالب والبناء */}
      <div className="rounded-md border border-stone-200 p-3">
        <h4 className="text-[11px] font-bold text-stone-800">أولا: بنية الكلمة (صرف)</h4>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <Field label="القالب الصرفي (اختياري)">
            <input
              value={word.template ?? ''}
              onChange={(event) => patch({ template: event.target.value })}
              className="input"
              dir="rtl"
              placeholder="فُعْلَى أو فَعِيلَة"
              style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
            />
            <span className="mt-1 block text-[10px] text-stone-500">
              ف وع ول خانات للجذر، وما سواها حرف حرفي يُطابَق كما هو.
            </span>
          </Field>
          <Field label="سياسة الحركات في القالب والبادئة واللاحقة">
            <select
              value={word.harakaMode}
              onChange={(event) => patch({ harakaMode: event.target.value as HarakaMatchMode })}
              className="input"
            >
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="بادئة حرفية (اختياري)">
            <input value={word.prefix ?? ''} onChange={(event) => patch({ prefix: event.target.value })} className="input" placeholder="ال" dir="rtl" />
          </Field>
          <Field label="لاحقة حرفية (اختياري)">
            <input value={word.suffix ?? ''} onChange={(event) => patch({ suffix: event.target.value })} className="input" placeholder="ة" dir="rtl" />
          </Field>
          <Field label="أول حرف من مجموعة تجويدية (اختياري)">
            <select
              value={word.startsWithSet ?? ''}
              onChange={(event) => patch({ startsWithSet: (event.target.value || undefined) as GlobalMorphologyWordPattern['startsWithSet'] })}
              className="input"
            >
              <option value="">بلا تقييد</option>
              {LETTER_SET_OPTIONS.map((value) => (
                <option key={value} value={value}>{GLOBAL_CHARACTER_SET_LABELS[value]}</option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-stone-500">
              همزة الوصل ٱ تُتخطى، فالحرف المنطوق بعدها هو المعتبر.
            </span>
          </Field>
          <Field label="آخر حرف من مجموعة تجويدية (اختياري)">
            <select
              value={word.endsWithSet ?? ''}
              onChange={(event) => patch({ endsWithSet: (event.target.value || undefined) as GlobalMorphologyWordPattern['endsWithSet'] })}
              className="input"
            >
              <option value="">بلا تقييد</option>
              {LETTER_SET_OPTIONS.map((value) => (
                <option key={value} value={value}>{GLOBAL_CHARACTER_SET_LABELS[value]}</option>
              ))}
            </select>
          </Field>
          <Field label="أقل عدد حروف (اختياري)">
            <input
              type="number"
              min={1}
              max={20}
              value={word.minLength ?? ''}
              onChange={(event) => patch({ minLength: event.target.value ? Number(event.target.value) : undefined })}
              className="input"
            />
          </Field>
          <Field label="أكثر عدد حروف (اختياري)">
            <input
              type="number"
              min={1}
              max={20}
              value={word.maxLength ?? ''}
              onChange={(event) => patch({ maxLength: event.target.value ? Number(event.target.value) : undefined })}
              className="input"
            />
          </Field>
        </div>
      </div>

      {/* الصرف: الخصائص */}
      <div className="rounded-md border border-stone-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-bold text-stone-800">ثانيا: الخصائص الصرفية</h4>
          <span className="text-[10px] text-stone-500">
            انقر مرة لاشتراط الخاصية، ومرة على «استثناء» لمنعها.
          </span>
        </div>
        <div className="mt-2 space-y-2.5">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold text-stone-500">{group.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {group.features.map((feature) => {
                  const required = word.morphologyFeatures?.includes(feature) ?? false;
                  const excluded = word.excludedMorphologyFeatures?.includes(feature) ?? false;
                  return (
                    <span key={feature} className="inline-flex overflow-hidden rounded border border-stone-300">
                      <button
                        type="button"
                        title={MORPHOLOGY_FEATURE_HINTS[feature]}
                        onClick={() => toggleFeature(feature, false)}
                        className={`px-2 py-1 text-[11px] ${required ? 'bg-emerald-600 text-white' : 'bg-white text-stone-700 hover:bg-stone-50'}`}
                      >
                        {MORPHOLOGY_FEATURE_LABELS[feature]}
                      </button>
                      <button
                        type="button"
                        title={`استثناء: ${MORPHOLOGY_FEATURE_HINTS[feature]}`}
                        onClick={() => toggleFeature(feature, true)}
                        className={`border-s border-stone-300 px-1.5 py-1 text-[11px] ${excluded ? 'bg-rose-600 text-white' : 'bg-stone-50 text-stone-500 hover:bg-rose-50'}`}
                        aria-label={`استثناء ${MORPHOLOGY_FEATURE_LABELS[feature]}`}
                      >
                        استثناء
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* النحو */}
      <div className="rounded-md border border-stone-200 p-3">
        <h4 className="text-[11px] font-bold text-stone-800">ثالثا: السياق النحوي</h4>
        <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
          الشرط النحوي هنا محسوس: أداة قبل الكلمة أو بعدها من قائمة مغلقة، أو حركة آخرها الظاهرة في الضبط،
          أو موقعها من الآية. ولا يُدَّعى إعراب لا تدل عليه علامة.
        </p>

        <div className="mt-2.5">
          <p className="text-[10px] font-semibold text-stone-500">حركة آخر الكلمة (يكفي واحدة)</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(Object.keys(WORD_ENDING_HARAKA_LABELS) as WordEndingHaraka[]).map((haraka) => {
              const active = word.endingHaraka?.includes(haraka) ?? false;
              return (
                <button
                  key={haraka}
                  type="button"
                  onClick={() => patch({ endingHaraka: toggleInList(word.endingHaraka, haraka) })}
                  className={`rounded border px-2 py-1 text-[11px] ${active ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}`}
                >
                  {WORD_ENDING_HARAKA_LABELS[haraka]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ParticleSelector
            title="تسبقها أداة من نوع"
            selected={word.precededBy}
            onToggle={(value) => patch({ precededBy: toggleInList(word.precededBy, value) })}
          />
          <ParticleSelector
            title="تليها أداة من نوع"
            selected={word.followedBy}
            onToggle={(value) => patch({ followedBy: toggleInList(word.followedBy, value) })}
          />
        </div>

        <div className="mt-3 max-w-sm">
          <Field label="موقع الكلمة من الآية">
            <select
              value={word.ayahPosition ?? 'ANY'}
              onChange={(event) => patch({ ayahPosition: event.target.value as AyahWordPosition })}
              className="input"
            >
              {AYAH_POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </section>
  );
}

function ParticleSelector({
  title,
  selected,
  onToggle,
}: {
  title: string;
  selected?: ParticleClass[];
  onToggle: (value: ParticleClass) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-500">{title} (يكفي واحدة)</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(Object.keys(PARTICLE_CLASS_LABELS) as ParticleClass[]).map((particleClass) => {
          const active = selected?.includes(particleClass) ?? false;
          return (
            <button
              key={particleClass}
              type="button"
              onClick={() => onToggle(particleClass)}
              className={`rounded border px-2 py-1 text-[11px] ${active ? 'border-violet-700 bg-violet-700 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}`}
            >
              {PARTICLE_CLASS_LABELS[particleClass]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function anchorLabel(anchor: GlobalWordCharacterPattern['constraints'][number]['anchor'], value: number): string {
  if (anchor === 'START') return value === 0 ? 'أول الكلمة' : `من البداية + ${value}`;
  if (anchor === 'END') return value === 0 ? 'آخر الكلمة' : `من النهاية − ${value}`;
  return `الحرف رقم ${value}`;
}

function Field({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

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
import {
  buildCharacterPattern,
  describeGlobalPattern,
  findGlobalRuleMatches,
  GLOBAL_CHARACTER_SET_LABELS,
} from '@/lib/quran-logic/global-rule-engine';
import {
  createGlobalRuleId,
  saveGlobalRule,
  type GlobalRule,
} from '@/lib/storage/global-rules-store';
import type { VariantCategory } from '@/types';
import type {
  CharacterRange,
  GlobalCharacterPattern,
  GlobalCharacterSet,
  GlobalMorphologyPattern,
  GlobalRulePattern,
  GlobalWordCharacterPattern,
  HarakaMatchMode,
  ReadingScope,
  VerificationStatus,
} from '@/types/tashjeer';
import { ScopePicker } from './VariantEditor';

interface GlobalRuleBuilderProps {
  ayahKey: number;
  characterRange: CharacterRange | null;
  initialKind?: GlobalRulePattern['kind'];
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
  { value: 'NONE', label: 'بلا حركة فقط' },
];

export function GlobalRuleBuilder({
  ayahKey,
  characterRange,
  initialKind = 'CHARACTERS',
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
  const [template, setTemplate] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [morphologyMode, setMorphologyMode] = useState<HarakaMatchMode>('IGNORE');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VariantCategory>('TAJWEED');
  const [scope, setScope] = useState<ReadingScope>({ kind: 'ALL' });
  const [ruleLabel, setRuleLabel] = useState('');
  const [maddHarakat, setMaddHarakat] = useState('');
  const [description, setDescription] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [status, setStatus] = useState<VerificationStatus>('DRAFT');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  const pattern = useMemo<GlobalRulePattern | null>(() => {
    if (kind === 'CHARACTERS') return characterPattern;
    if (!template.trim() && !prefix.trim() && !suffix.trim()) return null;
    return {
      kind: 'MORPHOLOGY',
      version: 1,
      wordCount: 1,
      words: [
        {
          offset: 0,
          template: template.trim() || undefined,
          prefix: prefix.trim() || undefined,
          suffix: suffix.trim() || undefined,
          harakaMode: morphologyMode,
        },
      ],
      sourceAyahKey: ayahKey,
    } satisfies GlobalMorphologyPattern;
  }, [ayahKey, characterPattern, kind, morphologyMode, prefix, suffix, template]);

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
          : 'أدخل قالبا صرفيا أو بادئة أو لاحقة واحدة على الأقل.'
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
      description: description.trim() || undefined,
      sourceRef: sourceRef.trim() || undefined,
      evidences: [],
      status,
      isActive,
    });
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
              قالب صرفي محدود
            </button>
            <span className="ms-auto text-[11px] text-violet-900/75">
              {pattern ? describeGlobalPattern(pattern) : 'لم يكتمل النمط بعد'}
            </span>
          </div>

          {kind === 'CHARACTERS' && characterPattern ? (
            <CharacterPatternEditor
              pattern={characterPattern}
              sourceWords={sourceWords}
              onModeChange={updateConstraintMode}
              onLetterSetChange={updateConstraintSet}
              onExactLengthChange={toggleExactLength}
            />
          ) : kind === 'CHARACTERS' ? (
            <p className="mt-4 rounded border border-dashed border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              التحديد الحرفي غير صالح. أغلق النافذة وحدد بداية ونهاية داخل المصحف.
            </p>
          ) : (
            <MorphologyPatternEditor
              template={template}
              prefix={prefix}
              suffix={suffix}
              mode={morphologyMode}
              onTemplateChange={setTemplate}
              onPrefixChange={setPrefix}
              onSuffixChange={setSuffix}
              onModeChange={setMorphologyMode}
            />
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

function MorphologyPatternEditor({
  template,
  prefix,
  suffix,
  mode,
  onTemplateChange,
  onPrefixChange,
  onSuffixChange,
  onModeChange,
}: {
  template: string;
  prefix: string;
  suffix: string;
  mode: HarakaMatchMode;
  onTemplateChange: (value: string) => void;
  onPrefixChange: (value: string) => void;
  onSuffixChange: (value: string) => void;
  onModeChange: (value: HarakaMatchMode) => void;
}) {
  return (
    <section className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3">
      <h3 className="text-xs font-bold text-amber-950">قاعدة صرفية نمطية حتمية</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-900/80">
        اكتب قالبا مثل «فَعْلَى» أو «فَعِيلَة». الحروف ف وع ول خانات للجذر، وما سواها حرف حرفي.
        ويمكن الاكتفاء بلاحقة مثل «ة» للبحث عن كل كلمة تنتهي بتاء مربوطة. هذا ليس تحليلا نحويا ولا تخمينا لجذر الكلمة.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="القالب الصرفي (اختياري)">
          <input value={template} onChange={(event) => onTemplateChange(event.target.value)} className="input" dir="rtl" placeholder="فَعْلَى أو فَعِيلَة" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }} />
        </Field>
        <Field label="سياسة الحركات في القالب">
          <select value={mode} onChange={(event) => onModeChange(event.target.value as HarakaMatchMode)} className="input">
            {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="بادئة حرفية (اختياري)">
          <input value={prefix} onChange={(event) => onPrefixChange(event.target.value)} className="input" placeholder="ال" />
        </Field>
        <Field label="لاحقة حرفية (اختياري)">
          <input value={suffix} onChange={(event) => onSuffixChange(event.target.value)} className="input" placeholder="ة" />
        </Field>
      </div>
    </section>
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

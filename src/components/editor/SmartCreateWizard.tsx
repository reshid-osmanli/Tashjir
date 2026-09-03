// معالج الإنشاء الذكي الموحّد — Smart Create Wizard (FR-ED-08)
// مشروع التشجير - نظام القراءات العشر
//
// معالج واحد من ٧ خطوات يجمع ميزات الإنشاء المتفرقة السابقة في مكان واحد:
//  ١ التحديد البصري (كلمة/مدى) ← ٢ الأنواع والأوجه ← ٣ الأوجه ↑
//  ٤ نطاق القراء ← ٥ العلاقات ← ٦ النطاق الجغرافي/التعميم ← ٧ السياق والمراجعة
//
// لا يكتب المستخدم أي كود؛ المعالج يُنتج كيانات النموذج الموحّد عبر
// `buildSmartCreateBatch` ثم يطبّقها على المستند في معاملة واحدة. التعميم
// على المصحف يُنشئ قاعدة عامة حتمية لكل نوع (بلا نسخ آلاف المستندات).

'use client';

import { useMemo, useState } from 'react';
import type { VariantCategory } from '@/types';
import type { CharacterRange, ReadingScope } from '@/types/tashjeer';
import {
  buildSmartCreateBatch,
  type SmartCreateInput,
  type SmartSelectionLocus,
  type SmartVariantSpec,
} from '@/lib/tashjeer/smart-create';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { describeLoci } from '@/lib/tashjeer/loci';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useEditorStore } from '@/stores/editor-store';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { buildCharacterPattern, findGlobalRuleMatches } from '@/lib/quran-logic/global-rule-engine';
import {
  createGlobalRuleId,
  saveGlobalRule,
  setGlobalRuleOrderRank,
} from '@/lib/storage/global-rules-store';
import { resolveScope } from '@/lib/tashjeer/scope';
import { ScopePicker } from './VariantEditor';

interface SmartCreateWizardProps {
  selectionText: string;
  initialLoci: SmartSelectionLocus[];
  onClose: () => void;
  onComplete?: (message: string) => void;
}

type RelationMode = 'RELATED_TREE' | 'MUTUALLY_EXCLUSIVE' | 'NONE';
type ApplicationScope = 'LOCAL' | 'MUSHAF';
type ContextMode = 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY';

const CATEGORY_ORDER: VariantCategory[] = ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'];

const STEP_LABELS = ['التحديد', 'الأنواع', 'الأوجه', 'القرّاء', 'العلاقات', 'النطاق', 'المراجعة'] as const;

export function SmartCreateWizard({
  selectionText,
  initialLoci,
  onClose,
  onComplete,
}: SmartCreateWizardProps) {
  const { document, applySmartCreateBatch } = useEditorStore();

  const words = useMemo(() => (document ? documentWindowWords(document) : []), [document]);

  const hasCharacterSelection = initialLoci.some((locus) => locus.characterRange);
  const characterRange: CharacterRange | undefined = useMemo(() => {
    const found = initialLoci.find((locus) => locus.characterRange)?.characterRange;
    return found ?? undefined;
  }, [initialLoci]);

  const initialStart = initialLoci[0]?.startPosition ?? 1;
  const initialEnd = initialLoci[0]?.endPosition ?? initialLoci[initialLoci.length - 1]?.endPosition ?? 1;

  const [step, setStep] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<VariantCategory[]>(['USUL', 'FARSH', 'MADUD']);
  const [variantsText, setVariantsText] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<ReadingScope>({ kind: 'ALL' });
  const [relationMode, setRelationMode] = useState<RelationMode>('RELATED_TREE');
  const [applicationScope, setApplicationScope] = useState<ApplicationScope>('LOCAL');
  const [context, setContext] = useState<ContextMode>('ALWAYS');
  const [startPosition, setStartPosition] = useState(initialStart);
  const [endPosition, setEndPosition] = useState(initialEnd);
  const [error, setError] = useState('');
  const [mushafCounts, setMushafCounts] = useState<Array<{ type: VariantCategory; count: number }>>([]);

  const loci = useMemo<SmartSelectionLocus[]>(
    () =>
      hasCharacterSelection && startPosition === initialStart && endPosition === initialEnd
        ? initialLoci
        : [{ startPosition: Math.min(startPosition, endPosition), endPosition: Math.max(startPosition, endPosition) }],
    [hasCharacterSelection, initialEnd, initialLoci, initialStart, startPosition, endPosition]
  );

  const selectedText = useMemo(() => {
    if (document && hasCharacterSelection === false) {
      const items = loci.length > 0 ? loci : [{ startPosition, endPosition }];
      return items
        .map((range) => {
          if (range.startPosition === range.endPosition) {
            return words.filter((word) => word.position === range.startPosition).map((word) => word.text).join(' ');
          }
          return words
            .filter((word) => word.position >= range.startPosition && word.position <= range.endPosition)
            .map((word) => word.text)
            .join(' ');
        })
        .filter(Boolean)
        .join('  ·  ');
    }
    return selectionText;
  }, [document, endPosition, hasCharacterSelection, loci, selectionText, startPosition, words]);

  const variantsByType = useMemo<Partial<Record<VariantCategory, SmartVariantSpec[]>>>(() => {
    const result: Partial<Record<VariantCategory, SmartVariantSpec[]>> = {};
    for (const type of selectedTypes) {
      const raw = variantsText[type] ?? '';
      const faces = raw
        .split(/[\n,،]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((label) => ({ label, text: selectedText }));
      if (faces.length > 0) result[type] = faces;
    }
    return result;
  }, [selectedText, selectedTypes, variantsText]);

  const relations = useMemo(() => {
    if (relationMode === 'NONE' || selectedTypes.length < 2) return [];
    const first = selectedTypes[0]!;
    return selectedTypes.slice(1).map((type) => ({
      fromType: first,
      toType: type,
      type: relationMode === 'RELATED_TREE' ? ('RELATED' as const) : ('MUTUALLY_EXCLUSIVE' as const),
    }));
  }, [relationMode, selectedTypes]);

  const selectedTextLabel = selectedText || selectionText;
  const baseTitle = selectedTextLabel.trim();

  const canCreateLocal = selectedTypes.length > 0 && loci.length > 0 && Boolean(baseTitle);
  const canGeneralize = applicationScope === 'MUSHAF' && Boolean(characterRange) && canCreateLocal;
  const canCreate = applicationScope === 'LOCAL' ? canCreateLocal : canGeneralize;

  const preview = useMemo(() => {
    if (!canCreateLocal) return { differences: 0, faces: 0, relations: 0 };
    const input: SmartCreateInput = {
      ayahKey: document?.ayahKey ?? 0,
      selection: loci,
      baseTitle,
      types: selectedTypes,
      scope,
      context,
      relations,
      variants: variantsByType,
    };
    const result = buildSmartCreateBatch(input);
    return {
      differences: result.differences.length,
      faces: result.differences.reduce((total, difference) => total + difference.variants.length, 0),
      relations: result.relations.length,
    };
  }, [baseTitle, canCreateLocal, context, document?.ayahKey, loci, relations, scope, selectedTypes, variantsByType]);

  const runMushafPreview = () => {
    if (!characterRange || !document) return;
    setError('');
    const pattern = buildCharacterPattern(document.ayahKey, characterRange);
    const counts = selectedTypes.map((type) => {
      const rule = {
        id: createGlobalRuleId(),
        pattern,
      };
      const matches = findGlobalRuleMatches(rule, { limit: 100000 });
      return { type, count: matches.length };
    });
    setMushafCounts(counts);
  };

  const create = () => {
    if (!document) return;
    setError('');

    if (applicationScope === 'LOCAL') {
      if (!canCreateLocal) {
        setError('حدد موضعًا ونوعًا واحدًا على الأقل قبل الإنشاء.');
        return;
      }
      const input: SmartCreateInput = {
        ayahKey: document.ayahKey,
        selection: loci,
        baseTitle,
        types: selectedTypes,
        scope,
        context,
        relations,
        variants: variantsByType,
      };
      applySmartCreateBatch(buildSmartCreateBatch(input));
      onComplete?.(`أُنشئت ${selectedTypes.length} اختلافات مستقلة بمعرّفاتها وعلاقاتها في خطوة واحدة.`);
      onClose();
      return;
    }

    if (!canGeneralize || !characterRange) {
      setError('للتعميم على المصحف حدد حروفًا داخل الآية ثم اختر الأنواع. يمكنك لاحقًا تعديل كل موضع المحلي دون المساس بالبقية.');
      return;
    }

    let created = 0;
    for (let index = 0; index < selectedTypes.length; index += 1) {
      const type = selectedTypes[index]!;
      const saved = saveGlobalRule({
        id: createGlobalRuleId(),
        title: `${baseTitle} — ${CATEGORY_LABELS[type]}`,
        category: type,
        scope,
        ruleLabel: CATEGORY_LABELS[type],
        pattern: buildCharacterPattern(document.ayahKey, characterRange),
        status: 'DRAFT',
        isActive: true,
        orderRank: index + 1,
      });
      if (saved.orderRank) setGlobalRuleOrderRank(saved.id, saved.orderRank);
      created += 1;
    }
    onComplete?.(`أُنشئت ${created} قواعد عامة مستقلة على المصحف كله — تظهر في كل موضع مطابق بلا نسخ.`);
    onClose();
  };

  const toggleType = (type: VariantCategory) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  };

  const pickWord = (position: number) => {
    if (startPosition === initialStart && endPosition === initialEnd && startPosition === endPosition) {
      setStartPosition(position);
    } else {
      setEndPosition(position);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" role="dialog" aria-modal="true" aria-label="المعالج الذكي لإنشاء الاختلافات والأوجه">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">المعالج الذكي الموحّد</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-stone-500">
              أنشئ عدة اختلافات وأوجه وعلاقات دفعة واحدة من تحديد بصري، دون العودة لإنشاء كل عنصر منفصل.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100">
            إغلاق
          </button>
        </header>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-stone-100 px-4 py-2">
          {STEP_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${
                index === step ? 'bg-emerald-600 text-white' : index < step ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-500'
              }`}
            >
              {toArabicDigits(index + 1)}. {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ١ — التحديد البصري</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                انقر على الكلمة الأولى ثم الأخيرة لتحديد مدى «كلمة ← كلمة». إن كنت حدّدت حروفًا، يبقى المدى الحرفي كما في المحرر.
              </p>
              <div className="flex flex-wrap gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                {words.map((word) => {
                  const inRange = word.position >= Math.min(startPosition, endPosition) && word.position <= Math.max(startPosition, endPosition);
                  return (
                    <button
                      key={word.position}
                      type="button"
                      onClick={() => pickWord(word.position)}
                      className={`rounded-md border px-2 py-1 text-lg transition ${
                        inRange ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-300'
                      }`}
                      style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                    >
                      {word.text}
                    </button>
                  );
                })}
              </div>
              <p className="rounded bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-900">
                المحدد: {describeLoci(loci)}
              </p>
              <p className="rounded bg-stone-50 px-3 py-2 text-sm leading-loose text-stone-900" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
                {selectedText}
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٢ — الأنواع المستقلة</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                كل نوع يُنشأ كيانًا مستقلًا برتبته الصريحة (تحقيق=١، أصول=٢، فرش=٣…)؛ تعديل أحدها لا يمس الآخر.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {CATEGORY_ORDER.map((type) => (
                  <label key={type} className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition ${selectedTypes.includes(type) ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-stone-200 bg-white text-stone-700'}`}>
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={() => toggleType(type)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    {CATEGORY_LABELS[type]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-stone-500">
                الرتب: {selectedTypes.map((type, index) => `${toArabicDigits(index + 1)} = ${CATEGORY_LABELS[type]}`).join(' · ')}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٣ — الأوجه المستقلة لكل نوع</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                اكتب أسماء الأوجه سطرًا سطرًا (أو مفصولة بفاصلة). كل وجه كيان مستقل برتبته داخل نوعه، ويُحرَّر لاحقًا بدقته ودرجته وأدلته.
              </p>
              {selectedTypes.length === 0 && <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">اختر نوعًا واحدًا على الأقل أولًا.</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {selectedTypes.map((type) => (
                  <div key={type} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <label className="mb-1 block text-xs font-semibold text-stone-700">{CATEGORY_LABELS[type]}</label>
                    <textarea
                      value={variantsText[type] ?? ''}
                      onChange={(event) => setVariantsText((current) => ({ ...current, [type]: event.target.value }))}
                      rows={3}
                      className="w-full rounded border border-stone-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="مثال: بالألف، بالسين، بالأشمام"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-stone-500">
                الفارغ يعني إنشاء وجه المصحف (الأساس) فقط؛ يمكنك إضافة الأوجه لاحقًا من محرر الوجه.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٤ — نطاق القرّاء</h3>
              <p className="text-xs leading-relaxed text-stone-500">
                اختر الأئمة/الرواة/الطرق كما في محرر الوجه؛ يُختصر النطاق تلقائيًا.
              </p>
              <ScopePicker scope={scope} onChange={setScope} />
              <p className="rounded bg-stone-50 px-3 py-2 text-xs text-stone-600">
                النطاق المختصر: <span className="font-medium">{describeLoci(loci)}</span> — {resolveScope(scope).length} راويًا
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٥ — العلاقات بين الأنواع</h3>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${relationMode === 'RELATED_TREE' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={relationMode === 'RELATED_TREE'} onChange={() => setRelationMode('RELATED_TREE')} className="accent-emerald-600" />
                  علاقة «مرتبط» من النوع الأول إلى كل نوع لاحق
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${relationMode === 'MUTUALLY_EXCLUSIVE' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={relationMode === 'MUTUALLY_EXCLUSIVE'} onChange={() => setRelationMode('MUTUALLY_EXCLUSIVE')} className="accent-emerald-600" />
                  تنافٍ (لا يُضربّا معًا) بين النوع الأول وكل نوع لاحق
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${relationMode === 'NONE' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={relationMode === 'NONE'} onChange={() => setRelationMode('NONE')} className="accent-emerald-600" />
                  لا أُنشئ علاقات تلقائية
                </label>
              </div>
              <p className="text-xs text-stone-500">قد تُعين العلاقة لاحقًا من لوحة العلاقات. قرارات الدمج نفسها محسومة في السياسات لا هنا.</p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٦ — النطاق الجغرافي (التعميم)</h3>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${applicationScope === 'LOCAL' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={applicationScope === 'LOCAL'} onChange={() => setApplicationScope('LOCAL')} className="accent-emerald-600" />
                  هذا الموضع فقط
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${applicationScope === 'MUSHAF' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input
                    type="radio"
                    checked={applicationScope === 'MUSHAF'}
                    onChange={() => setApplicationScope('MUSHAF')}
                    disabled={!characterRange}
                    className="accent-emerald-600"
                  />
                  المصحف كله (قاعدة عامة حتمية لكل نوع)
                </label>
              </div>
              {characterRange ? (
                <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  حدّدت حروفًا؛ يمكن إنشاء قواعد عامة على المصحف لكل نوع مختار دون نسخ آلاف المستندات.
                </p>
              ) : (
                <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  التعميم على المصحف يدعم التحديد الحرفي داخل الآية. إن كان التحديد كلمات، أنشئ الموضع محليًا ثم «حفظ كقاعدة» من المحرر.
                </p>
              )}
              {applicationScope === 'MUSHAF' && characterRange && mushafCounts.length === 0 && (
                <button type="button" onClick={runMushafPreview} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50">
                  معاينة عدد المواضع المتطابقة
                </button>
              )}
              {mushafCounts.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
                  {mushafCounts.map(({ type, count }) => (
                    <li key={type}>{CATEGORY_LABELS[type]}: {toArabicDigits(count)} موضعًا مطابقًا</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-800">الخطوة ٧ — السياق والمراجعة</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${context === 'ALWAYS' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={context === 'ALWAYS'} onChange={() => setContext('ALWAYS')} className="accent-emerald-600" />
                  وقفًا ووصلًا
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${context === 'WAQF_ONLY' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={context === 'WAQF_ONLY'} onChange={() => setContext('WAQF_ONLY')} className="accent-emerald-600" />
                  وقفًا فقط
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${context === 'WASL_ONLY' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'}`}>
                  <input type="radio" checked={context === 'WASL_ONLY'} onChange={() => setContext('WASL_ONLY')} className="accent-emerald-600" />
                  وصلًا فقط
                </label>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-sm font-semibold text-stone-800">ملخص الإنشاء</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <Summary value={toArabicDigits(preview.differences)} label="اختلافًا مستقلاً" />
                  <Summary value={toArabicDigits(preview.faces)} label="وجهًا" />
                  <Summary value={toArabicDigits(preview.relations)} label="علاقة تلقائية" />
                </div>
                <p className="mt-2 text-xs text-stone-600">
                  الهدف: {applicationScope === 'LOCAL' ? 'هذه الآية' : 'المصحف كله'} · النطاق: من {selectedTextLabel} · العلاقات: {relationMode === 'NONE' ? 'لا تلقائية' : relationMode === 'RELATED_TREE' ? 'مرتبط' : 'متنافٍ'}
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-3">
          <div>
            {error && <p className="text-xs text-red-700">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              السابق
            </button>
            {step < 6 ? (
              <button type="button" onClick={() => setStep((current) => current + 1)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                التالي
              </button>
            ) : (
              <button
                type="button"
                onClick={create}
                disabled={!canCreate}
                className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                إنشاء
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-2 py-2">
      <p className="text-lg font-bold text-stone-900">{value}</p>
      <p className="text-[10px] text-stone-500">{label}</p>
    </div>
  );
}

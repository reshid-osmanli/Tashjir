// لوحة الاختلافات - Variants Panel
// مشروع التشجير - نظام القراءات العشر
//
// هذه اللوحة هي مكان العمل العلمي الفعلي: عرض اختلافات الآية، وإضافة اختلاف
// جديد من الكلمات المعلّمة، وتحرير الأوجه ونطاقاتها وأدلتها.
//
// ترتيب العرض يتبع القاعدة المعتمدة: من آخر الآية إلى أولها.

'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { describeScope, resolveScope } from '@/lib/tashjeer/scope';
import { VariantEditor } from './VariantEditor';
import { GlobalRuleBuilder, type GlobalRuleSeed } from './GlobalRuleBuilder';
import { RulesIndexDialog } from './RulesIndexDialog';
import { characterCount, rangeFromCharacterAnchors, textForCharacterRange } from '@/lib/quran-logic/characters';
import { listGlobalRules, type GlobalRule } from '@/lib/storage/global-rules-store';
import { findGlobalRuleMatchesInAyah } from '@/lib/quran-logic/global-rule-engine';
import { deletedOccurrenceIds, occurrenceIdFor } from '@/lib/storage/rule-occurrences-store';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { RuleOccurrenceReview } from './RuleOccurrenceReview';
import type { VariantCategory } from '@/types';
import type { Variant, VariantLocus } from '@/types/tashjeer';
import { boundsOfLoci, buildLociFromMarks, describeLoci, lociOfVariant } from '@/lib/tashjeer/loci';

export function VariantsPanel() {
  const {
    document,
    markedPositions,
    markedCharacters,
    markingMode,
    selectedVariantId,
    selectedAlternativeId,
    draftCategory,
    setDraftCategory,
    selectVariant,
    selectAlternative,
    deleteVariant,
    deleteAlternativesBulk,
    updateVariant,
    clearMarks,
    addVariant,
    addVariantGroup,
    addSiblingVariant,
    refreshDerivedBranches,
    openAyah,
  } = useEditorStore();

  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [showGlobalBuilder, setShowGlobalBuilder] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);
  const [globalBuilderKind, setGlobalBuilderKind] = useState<'CHARACTERS' | 'MORPHOLOGY'>('CHARACTERS');
  const [globalBuilderSeed, setGlobalBuilderSeed] = useState<GlobalRuleSeed | undefined>(undefined);
  // مدى حروف بديل عن التحديد الحالي، يُستعمل عند تعميم اختلاف حرفي قائم.
  const [globalBuilderRange, setGlobalBuilderRange] = useState<import('@/types/tashjeer').CharacterRange | null>(null);
  const [reviewingRule, setReviewingRule] = useState<GlobalRule | null>(null);
  const [showRulesIndex, setShowRulesIndex] = useState(false);
  const [showBatchBuilder, setShowBatchBuilder] = useState(false);
  const [batchCategories, setBatchCategories] = useState<VariantCategory[]>(['USUL', 'FARSH', 'MADUD']);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLLIElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  // استثناءات المواضع كلها: تغيّرها يعيد حساب عدّادات هذه اللوحة فورا.
  const occurrences = useRuleOccurrences();
  const catalog = useTransmissionCatalog();

  const words = useMemo(
    () => documentWindowWords(document),
    [document]
  );

  const markedCharacterRange = useMemo(
    () => rangeFromCharacterAnchors(markedCharacters),
    [markedCharacters]
  );

  const draftLoci = useMemo(() => {
    const wordLengths = new Map(words.map((word) => [word.position, characterCount(word.text)]));
    return buildLociFromMarks({
      mode: markingMode,
      positions: markedPositions,
      characters: markedCharacters,
      wordLengths,
    });
  }, [markingMode, markedCharacters, markedPositions, words]);

  const markedText = useMemo(() => {
    if (draftLoci.length === 0) return '';
    return draftLoci
      .map((locus) =>
        locus.characterRange
          ? textForCharacterRange(words, locus.characterRange)
          : words
              .filter((word) => word.position >= locus.startPosition && word.position <= locus.endPosition)
              .map((word) => word.text)
              .join(' ')
      )
      .filter(Boolean)
      .join('  ·  ');
  }, [draftLoci, words]);

  const hasMarks = draftLoci.length > 0;

  const activeGlobalRules = useMemo(() => {
    if (!document) return [];
    // المفتاح ضمن الاعتماديات ليُعاد العدّ بعد حذف موضع أو إرجاعه.
    void occurrences.key;
    const deleted = deletedOccurrenceIds();

    return listGlobalRules()
      .filter((rule) => rule.isActive && rule.pattern)
      .map((rule) => {
        const matches = findGlobalRuleMatchesInAyah(rule, document.ayahKey);
        const removedHere = matches.filter((match) => deleted.has(occurrenceIdFor(rule.id, match))).length;
        return { rule, matches, removedHere };
      })
      .filter((item) => item.matches.length > 0);
  }, [document, occurrences.key]);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedVariantId]);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const update = () => {
      setCanScrollUp(element.scrollTop > 2);
      setCanScrollDown(element.scrollTop + element.clientHeight < element.scrollHeight - 2);
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [document?.variants.length]);

  if (!document) return null;

  const editingVariant = document.variants.find((variant) => variant.id === editingVariantId);

  const createVariantFromLoci = (loci: VariantLocus[], openEditor: boolean) => {
    if (loci.length === 0 || !document) return;

    const bounds = boundsOfLoci(loci);
    const title = loci
      .map((locus) =>
        locus.characterRange
          ? textForCharacterRange(words, locus.characterRange)
          : words
              .filter((word) => word.position >= locus.startPosition && word.position <= locus.endPosition)
              .map((word) => word.text)
              .join(' ')
      )
      .filter(Boolean)
      .join('  ·  ');

    const id = `v-${document.ayahKey}-${bounds.startPosition}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const isCharacters = loci.some((locus) => Boolean(locus.characterRange));

    addVariant({
      id,
      category: draftCategory,
      title: title || 'اختلاف',
      startPosition: bounds.startPosition,
      endPosition: bounds.endPosition,
      targetKind: isCharacters ? 'CHARACTERS' : 'WORDS',
      characterRange: loci.length === 1 ? loci[0].characterRange : undefined,
      loci: loci.length > 1 ? loci : undefined,
      status: 'DRAFT',
      alternatives: [
        {
          id: `${id}-base`,
          text: title || 'وجه المصحف',
          label: 'وجه المصحف',
          isBase: true,
          scope: { kind: 'ALL' },
        },
      ],
    });

    if (openEditor) {
      selectVariant(id);
      setEditingVariantId(id);
    }
  };

  /** اختلاف واحد: المواضع المتباعدة تبقى منفصلة على السطر نفسه. */
  const handleCreateVariant = () => {
    createVariantFromLoci(draftLoci, true);
  };

  /** اختلاف مستقل لكل موضع، يجمعها المحرك في سطر الراوي إن اتفق النطاق. */
  const handleCreatePerLocus = () => {
    draftLoci.forEach((locus, index) => {
      createVariantFromLoci([locus], index === 0);
    });
  };

  /** إنشاء جماعي، لكن كل نوع يبقى كيانا مستقلا بمعرّفه ورتبته. */
  const handleCreateBatch = () => {
    if (draftLoci.length === 0 || batchCategories.length === 0) return;
    const bounds = boundsOfLoci(draftLoci);
    const baseText = markedText || 'وجه المصحف';
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    addVariantGroup(
      batchCategories.map((category, index) => {
        const id = `v-${document.ayahKey}-${bounds.startPosition}-${stamp}-${index + 1}`;
        return {
          id,
          category,
          title: `${baseText} — ${CATEGORY_LABELS[category]}`,
          startPosition: bounds.startPosition,
          endPosition: bounds.endPosition,
          targetKind: draftLoci.some((locus) => locus.characterRange) ? ('CHARACTERS' as const) : ('WORDS' as const),
          characterRange: draftLoci.length === 1 ? draftLoci[0].characterRange : undefined,
          loci: draftLoci.length > 1 ? draftLoci : undefined,
          orderRank: index + 1,
          status: 'DRAFT' as const,
          alternatives: [
            {
              id: `${id}-base`,
              text: baseText,
              label: 'وجه المصحف',
              isBase: true,
              scope: { kind: 'ALL' as const },
            },
          ],
        };
      })
    );
    setShowBatchBuilder(false);
  };

  return (
    <aside className="flex h-full min-h-0 w-[340px] shrink-0 flex-col overflow-hidden border-s border-stone-200 bg-white">
      <header className="border-b border-stone-200 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-stone-900">اختلافات الآية</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {toArabicDigits(document.variants.length)} اختلافا — مرتبة من آخر الآية إلى أولها
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRulesIndex(true)}
            className="shrink-0 rounded border border-violet-200 px-2 py-1 text-[10px] text-violet-800 hover:bg-violet-50"
            title="فهرس القواعد والاختلافات كاملا داخل المحرر: بحث وتتبع وتحرير"
          >
            الفهرس
          </button>
        </div>
      </header>

      {/* إرشاد منهجي مختصر: كل موضع اختلاف مستقل، والمحرك هو الذي يجمع. */}
      <p className="border-b border-stone-100 bg-emerald-50/60 px-4 py-2 text-[11px] leading-relaxed text-emerald-950">
        علّم الكلمات أو الحروف المتباعدة: كل موضع علامة مستقلة على السطر نفسه، بلا خط يملأ ما
        بينهما. سجّل المد والفرش والأصول اختلافا اختلافا؛ يجمعها المحرك في سطر الراوي ويضرب أوجهه.
      </p>

      {/* القواعد العامة المطبقة على هذه الآية، مع بقائها محفوظة مرة واحدة فقط. */}
      <section className="border-b border-stone-200 bg-violet-50/50 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-violet-950">قواعد عامة في هذا الموضع</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-violet-900/75">
              تظهر هنا النتائج المشتقة من قواعد المصحف، ولا تُنسخ إلى قائمة اختلافات الآية.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setGlobalBuilderKind('MORPHOLOGY');
              setGlobalBuilderSeed(undefined);
              setGlobalBuilderRange(null);
              setShowGlobalBuilder(true);
            }}
            className="shrink-0 rounded border border-violet-300 bg-white px-2 py-1 text-[10px] text-violet-900 hover:bg-violet-100"
            title="قاعدة بالمعايير النحوية والصرفية: كلمة أو سلسلة كلمات متجاورة"
          >
            + قاعدة نحوية
          </button>
        </div>
        {globalNotice && (
          <p role="status" className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">{globalNotice}</p>
        )}
        {activeGlobalRules.length === 0 ? (
          <p className="mt-2 text-[11px] text-violet-900/65">لا توجد قاعدة نمطية نشطة مطابقة لهذه الآية.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {activeGlobalRules.map(({ rule, matches, removedHere }) => (
              <li key={rule.id} className="rounded border border-violet-100 bg-white px-2 py-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-stone-800">{rule.ruleLabel || rule.title}</span>
                  <span className="shrink-0 text-violet-800">
                    {matches.length - removedHere} من {matches.length} موضع
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  {removedHere > 0 ? (
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-800">
                      حُذف هنا {removedHere} موضعا
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-400">مطبَّقة في هذه الآية</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setReviewingRule(rule)}
                    className="shrink-0 rounded border border-violet-300 px-1.5 py-0.5 text-[10px] text-violet-900 hover:bg-violet-50"
                    title="مراجعة مواضع القاعدة في المصحف كله موضعا موضعا"
                  >
                    تتبّع المواضع
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* إنشاء اختلاف من الكلمات المعلّمة */}
      <section className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <h3 className="text-xs font-semibold text-stone-700">اختلاف جديد</h3>

        {!hasMarks ? (
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
            {markingMode === 'CHARACTERS'
              ? 'فعّل أداة التعليم (M) ثم انقر كل حرف في خليته. المتصل يصير موضعا واحدا، والمتباعد مواضع منفصلة.'
              : 'فعّل أداة التعليم (M) ثم انقر الكلمات. المتباعدة تُحفظ مواضع منفصلة، لا مدى يملأ ما بينها.'}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
              <p
                className="text-base leading-loose text-stone-900"
                style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
              >
                {markedText}
              </p>
              <p className="mt-1 text-[11px] text-stone-500">
                {toArabicDigits(draftLoci.length)} موضعا منفصلا: {toArabicDigits(describeLoci(draftLoci))}
              </p>
            </div>

            <div className="flex flex-wrap gap-1">
              {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setDraftCategory(category)}
                  className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                    draftCategory === category
                      ? 'border-stone-800 bg-stone-800 text-white'
                      : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowBatchBuilder((value) => !value)}
              className="w-full rounded-md border border-cyan-500 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-950 hover:bg-cyan-100"
            >
              + إنشاء عدة اختلافات مستقلة دفعة واحدة
            </button>
            {showBatchBuilder && (
              <div className="rounded-md border border-cyan-200 bg-white p-2">
                <p className="text-[10px] leading-relaxed text-cyan-950">
                  اختر الأنواع. ستنشأ بمعرّفات مستقلة ورتب متتابعة، ويمكن تحرير كل واحد وحذفه وربطه دون التأثير في غيره.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => (
                    <label key={category} className="flex items-center gap-1 rounded border border-stone-200 px-1.5 py-1 text-[10px]">
                      <input
                        type="checkbox"
                        checked={batchCategories.includes(category)}
                        onChange={() =>
                          setBatchCategories((current) =>
                            current.includes(category)
                              ? current.filter((item) => item !== category)
                              : [...current, category]
                          )
                        }
                        className="accent-cyan-700"
                      />
                      {CATEGORY_LABELS[category]}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={batchCategories.length === 0}
                  onClick={handleCreateBatch}
                  className="mt-2 w-full rounded bg-cyan-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-cyan-800 disabled:opacity-50"
                >
                  إنشاء {toArabicDigits(batchCategories.length)} اختلافات مستقلة
                </button>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCreateVariant}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                اختلاف واحد بمواضع منفصلة
              </button>
              {draftLoci.length > 1 && (
                <button
                  type="button"
                  onClick={handleCreatePerLocus}
                  className="rounded-md border border-emerald-600 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                  title="كل كلمة أو حرف اختلاف مستقل: مد هنا وفرش هناك. يجمعها المحرك في سطر الراوي."
                >
                  اختلاف مستقل لكل موضع
                </button>
              )}
              {markingMode === 'CHARACTERS' && markedCharacterRange && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalBuilderKind('CHARACTERS');
                    setGlobalBuilderSeed(undefined);
                    setGlobalBuilderRange(null);
                    setShowGlobalBuilder(true);
                  }}
                  className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100"
                  title="حفظ نمط الحروف وتطبيقه في كل المصحف"
                >
                  حفظ كقاعدة في كل المصحف
                </button>
              )}
              <button
                type="button"
                onClick={clearMarks}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100 sm:col-span-2"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}
      </section>

      {/* قائمة الاختلافات: مساحة مستقلة لا تدفع اللوحة خارج الشاشة. */}
      <div className="relative min-h-0 flex-1">
        {canScrollUp && (
          <button
            type="button"
            onClick={() => listRef.current?.scrollBy({ top: -320, behavior: 'smooth' })}
            className="absolute start-1/2 top-1 z-20 -translate-x-1/2 rounded-full border border-stone-300 bg-white/95 px-4 py-0.5 text-xs shadow-md hover:bg-stone-50"
            aria-label="الصعود في قائمة الاختلافات"
          >
            ↑
          </button>
        )}
        <div
          ref={listRef}
          className="h-full overscroll-contain overflow-y-scroll scroll-smooth pb-10 pt-1 [scrollbar-gutter:stable] touch-pan-y"
          tabIndex={0}
          aria-label="قائمة الاختلافات القابلة للتمرير"
        >
        {document.variants.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-stone-500">
            لا توجد اختلافات مسجّلة في هذه الآية بعد.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {document.variants.map((variant) => (
              <VariantRow
                key={variant.id}
                variant={variant}
                catalog={catalog}
                isSelected={variant.id === selectedVariantId}
                selectedAlternativeId={variant.id === selectedVariantId ? selectedAlternativeId : null}
                rowRef={variant.id === selectedVariantId ? selectedRowRef : undefined}
                onSelect={() => selectVariant(variant.id === selectedVariantId ? null : variant.id)}
                onSelectAlternative={(alternativeId) => selectAlternative(variant.id, alternativeId)}
                onRecitationModeChange={(recitationMode) => updateVariant(variant.id, { recitationMode })}
                onEdit={() => setEditingVariantId(variant.id)}
                onAddSibling={(sourceId) => {
                  // ينشئ شقيقا مستقلا بنفس الموضع ونطاق القراء، مع ترك
                  // النص والرتبة للمستخدم في محرر الوجه (FR-ED-03، DM-09).
                  const source = document.variants.find((v) => v.id === sourceId);
                  if (!source) return;
                  const promptTitle = window.prompt(
                    'عنوان الاختلاف الشقيق (اتركه فارغا لاستخدام الافتراضي):',
                    `${source.title} — اختلاف ${source.occurrenceGroupId ? 'لاحق' : 'ثان'}`
                  );
                  if (promptTitle === null) return; // إلغاء
                  const createdId = addSiblingVariant(sourceId, {
                    title: promptTitle.trim() || `${source.title} (${(source.occurrenceIndex ?? 1) + 1})`,
                    alternatives: source.alternatives.map((alt, index) => ({
                      ...structuredClone(alt),
                      id: `${sourceId}-sib-${Date.now().toString(36)}-${index}`,
                    })),
                  });
                  if (createdId) {
                    setEditingVariantId(createdId);
                  }
                }}
                onGeneralize={
                  variant.targetKind === 'CHARACTERS' && variant.characterRange
                    ? () => {
                        // التعميم: نفس مدى الحروف يصبح قاعدة للمصحف كله،
                        // وتنتقل بيانات الاختلاف ووجهه الأول إلى القاعدة.
                        const first = variant.alternatives.find((alternative) => !alternative.isBase);
                        setGlobalBuilderKind('CHARACTERS');
                        setGlobalBuilderRange(variant.characterRange ?? null);
                        setGlobalBuilderSeed({
                          title: variant.title,
                          category: variant.category,
                          scope: first?.scope,
                          ruleLabel: first?.ruleLabel ?? first?.label,
                          maddHarakat: first?.maddHarakat,
                          description: variant.description,
                          sourceRef: variant.sourceRef,
                          strengthDegreeId: first?.strengthDegreeId,
                          strengthByNarrator: first?.strengthByNarrator,
                          orderRank: variant.orderRank,
                        });
                        setShowGlobalBuilder(true);
                      }
                    : undefined
                }
                onDelete={() => {
                  if (window.confirm(`حذف الاختلاف «${variant.title}»؟`)) {
                    deleteVariant(variant.id);
                  }
                }}
                onBulkDeleteFaces={(faceIds) => {
                  if (faceIds.length === 0) return;
                  if (
                    window.confirm(
                      `حذف ${toArabicDigits(faceIds.length)} وجهًا دفعة واحدة؟ تتوفر خاصية التراجع بعد الحذف.`
                    )
                  ) {
                    deleteAlternativesBulk(variant.id, faceIds);
                  }
                }}
              />
            ))}
          </ul>
        )}
        </div>
        {canScrollDown && (
          <button
            type="button"
            onClick={() => listRef.current?.scrollBy({ top: 320, behavior: 'smooth' })}
            className="absolute bottom-1 start-1/2 z-20 -translate-x-1/2 rounded-full border border-stone-300 bg-white/95 px-4 py-0.5 text-xs shadow-md hover:bg-stone-50"
            aria-label="النزول في قائمة الاختلافات"
          >
            ↓
          </button>
        )}
      </div>

      {editingVariant && (
        <VariantEditor
          variant={editingVariant}
          onClose={() => setEditingVariantId(null)}
          onGeneralize={
            editingVariant.targetKind === 'CHARACTERS' && editingVariant.characterRange
              ? () => {
                  const first = editingVariant.alternatives.find((alternative) => !alternative.isBase);
                  setEditingVariantId(null);
                  setGlobalBuilderKind('CHARACTERS');
                  setGlobalBuilderRange(editingVariant.characterRange ?? null);
                  setGlobalBuilderSeed({
                    title: editingVariant.title,
                    category: editingVariant.category,
                    scope: first?.scope,
                    ruleLabel: first?.ruleLabel ?? first?.label,
                    maddHarakat: first?.maddHarakat,
                    description: editingVariant.description,
                    sourceRef: editingVariant.sourceRef,
                    strengthDegreeId: first?.strengthDegreeId,
                    strengthByNarrator: first?.strengthByNarrator,
                    orderRank: editingVariant.orderRank,
                  });
                  setShowGlobalBuilder(true);
                }
              : undefined
          }
        />
      )}

      {reviewingRule && (
        <RuleOccurrenceReview
          rule={reviewingRule}
          startAtAyahKey={document.ayahKey}
          onOpenInEditor={(ayahKey) => {
            setReviewingRule(null);
            refreshDerivedBranches();
            openAyah(ayahKey);
          }}
          onClose={() => {
            setReviewingRule(null);
            refreshDerivedBranches();
          }}
        />
      )}

      {showGlobalBuilder && (
        <GlobalRuleBuilder
          ayahKey={document.ayahKey}
          characterRange={globalBuilderRange ?? markedCharacterRange}
          initialKind={globalBuilderKind}
          seed={globalBuilderSeed}
          onClose={() => {
            setShowGlobalBuilder(false);
            setGlobalBuilderSeed(undefined);
            setGlobalBuilderRange(null);
          }}
          onSaved={(rule, matchCount) => {
            setShowGlobalBuilder(false);
            setGlobalBuilderSeed(undefined);
            setGlobalBuilderRange(null);
            clearMarks();
            refreshDerivedBranches();
            setGlobalNotice(`تم حفظ القاعدة وتطبيقها على ${matchCount} موضع في المصحف.`);
            // بعد الحفظ يُفتح التتبع مباشرة ليدقق المحقق المواضع واحدا واحدا.
            setReviewingRule(rule);
          }}
        />
      )}

      {showRulesIndex && (
        <RulesIndexDialog
          currentAyahKey={document.ayahKey}
          onClose={() => setShowRulesIndex(false)}
          onNavigate={(ayahKey, variantId) => {
            openAyah(ayahKey);
            if (variantId) selectVariant(variantId);
          }}
          onRulesChanged={refreshDerivedBranches}
        />
      )}
    </aside>
  );
}

// ==================== صف الاختلاف ====================

function VariantRow({
  variant,
  catalog,
  isSelected,
  selectedAlternativeId,
  rowRef,
  onSelect,
  onSelectAlternative,
  onRecitationModeChange,
  onEdit,
  onAddSibling,
  onGeneralize,
  onDelete,
  onBulkDeleteFaces,
}: {
  variant: Variant;
  catalog: import('@/lib/transmissions/catalog').TransmissionCatalog;
  isSelected: boolean;
  selectedAlternativeId: string | null;
  rowRef?: RefObject<HTMLLIElement | null>;
  onSelect: () => void;
  onSelectAlternative: (alternativeId: string) => void;
  onRecitationModeChange: (mode: Variant['recitationMode']) => void;
  onEdit: () => void;
  /**
   * يضيف اختلافا شقيقا مستقلا بنفس القارئ والكلمة (FR-ED-03، DM-09).
   * كل اختلاف يحتفظ بهويته ورتبته وأوجه، والتنافي يحسمه المحرك.
   */
  onAddSibling: (sourceId: string) => void;
  /** يحوّل هذا الاختلاف الحرفي إلى قاعدة عامة على المصحف كله. */
  onGeneralize?: () => void;
  onDelete: () => void;
  /** يحذف الأوجه المحددة دفعة واحدة (FR-ED-07). */
  onBulkDeleteFaces: (faceIds: string[]) => void;
}) {
  const drawnAlternatives = variant.alternatives.filter((alternative) => !alternative.isBase);
  const [checkedFaces, setCheckedFaces] = useState<Set<string>>(new Set());

  // عدد أعضاء مجموعة التعدد: يحسب من الـstore لأن الصف لا يستقبل المستند.
  const siblingsCount = useEditorStore((state) => {
    if (!variant.occurrenceGroupId) return 0;
    return state.document?.variants.filter(
      (item) => item.occurrenceGroupId === variant.occurrenceGroupId
    ).length ?? 0;
  });

  // إخلاء التحديد المتعدد عند مغادرة هذا الاختلاف حتى لا تبقى علامات معلَّقة.
  useEffect(() => {
    if (!isSelected) setCheckedFaces(new Set());
  }, [isSelected]);

  const toggleFaceCheck = (faceId: string) => {
    setCheckedFaces((current) => {
      const next = new Set(current);
      if (next.has(faceId)) next.delete(faceId);
      else next.add(faceId);
      return next;
    });
  };

  return (
    <li ref={rowRef} data-difference-id={variant.id} className={isSelected ? 'bg-emerald-50/60 ring-2 ring-inset ring-emerald-500' : ''}>
      <div className="px-4 py-3">
        <button type="button" onClick={onSelect} className="w-full text-start">
          <div className="flex items-start justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: getCategorySoftColor(variant.category),
                  color: getCategoryColor(variant.category),
                }}
              >
                {CATEGORY_LABELS[variant.category]}
              </span>
              {variant.origin === 'EDITOR' && (
                <span
                  className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800"
                  title="أضافه المحرر يدويا — يظهر في التتبع ضمن «ما أضافه المحرر»"
                >
                  من المحرر
                </span>
              )}
              {variant.occurrenceGroupId && (
                <span
                  className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900"
                  title={`اختلاف ضمن مجموعة تعدد (${toArabicDigits(variant.occurrenceIndex ?? 0)} من المجموعة). كل اختلاف مستقل وقابل للتعديل والحذف.`}
                >
                  {toArabicDigits(variant.occurrenceIndex ?? 0)}/{toArabicDigits(siblingsCount)} ضمن المجموعة
                </span>
              )}
            </span>
            <StatusBadge status={variant.status} />
          </div>

          <p className="mt-1.5 text-sm font-medium leading-relaxed text-stone-900">
            {variant.title}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            {toArabicDigits(describeLoci(lociOfVariant(variant)))} — {toArabicDigits(drawnAlternatives.length)} وجها مرسوما
          </p>
        </button>

        {isSelected && (
          <>
          <label className="mt-2 flex items-center justify-between gap-2 rounded border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] text-cyan-950">
            <span>سياق الأداء</span>
            <select
              value={variant.recitationMode ?? 'ALWAYS'}
              onChange={(event) =>
                onRecitationModeChange(
                  event.target.value === 'ALWAYS'
                    ? undefined
                    : (event.target.value as NonNullable<Variant['recitationMode']>)
                )
              }
              className="h-6 rounded border border-cyan-300 bg-white px-1 text-[10px]"
            >
              <option value="ALWAYS">وقفا ووصلا</option>
              <option value="WAQF_ONLY">وقفا فقط</option>
              <option value="WASL_ONLY">وصلا فقط</option>
            </select>
          </label>
          <ul className="mt-2 space-y-1.5">
            {variant.alternatives.map((alternative) => (
              <li
                key={alternative.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectAlternative(alternative.id);
                }}
                className={`cursor-pointer rounded border bg-white px-2 py-1.5 transition ${
                  alternative.id === selectedAlternativeId
                    ? 'border-cyan-600 ring-2 ring-cyan-200'
                    : 'border-stone-200 hover:border-cyan-300'
                }`}
                data-face-id={alternative.id}
                title="انقر لتحديد هذا الوجه؛ يمكن نسخه أو قصه ثم لصقه في اختلاف آخر. أو ضع علامة للحذف الجماعي."
              >
                <div className="flex items-baseline justify-between gap-2">
                  <input
                    type="checkbox"
                    checked={checkedFaces.has(alternative.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggleFaceCheck(alternative.id)}
                    className="h-3.5 w-3.5 shrink-0 accent-rose-600"
                    aria-label={`تحديد الوجه ${alternative.label} للحذف الجماعي`}
                  />
                  <span
                    className="text-sm text-stone-900"
                    style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                  >
                    {alternative.text}
                  </span>
                  {alternative.isBase && (
                    <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                      وجه المصحف
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-stone-600">{alternative.label}</p>
                <p className="text-[11px] text-stone-500">
                  {describeScope(alternative.scope, { catalog })} ({resolveScope(alternative.scope, catalog).length} راويا)
                </p>
              </li>
            ))}
          </ul>
          {checkedFaces.size > 0 && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800">
              <span>محدَّد {toArabicDigits(checkedFaces.size)} وجهًا للحذف الجماعي</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCheckedFaces(new Set())}
                  className="rounded border border-rose-300 bg-white px-2 py-0.5 text-rose-700 hover:bg-rose-100"
                >
                  إلغاء التحديد
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onBulkDeleteFaces([...checkedFaces]);
                    setCheckedFaces(new Set());
                  }}
                  className="rounded bg-rose-600 px-2 py-0.5 font-medium text-white hover:bg-rose-700"
                >
                  حذف المحدد
                </button>
              </div>
            </div>
          )}
          </>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-stone-300 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-100"
          >
            تحرير
          </button>
          <button
            type="button"
            onClick={() => onAddSibling(variant.id)}
            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 hover:bg-amber-100"
            title="إضافة اختلاف آخر مستقل بنفس القارئ والكلمة (FR-ED-03). يبقى كل اختلاف قابلا للتعديل والحذف على حدة."
          >
            + شقيق لنفس القارئ
          </button>
          {onGeneralize && (
            <button
              type="button"
              onClick={onGeneralize}
              className="rounded border border-violet-300 px-2 py-1 text-[11px] text-violet-800 hover:bg-violet-50"
              title="تحويل هذا الاختلاف الحرفي إلى قاعدة تُطبَّق على كل المصحف، مع نقل بياناته ودرجاته"
            >
              تعميم على المصحف
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
          >
            حذف
          </button>
        </div>
      </div>
    </li>
  );
}

export function StatusBadge({ status }: { status: Variant['status'] }) {
  const styles: Record<Variant['status'], { label: string; className: string }> = {
    DRAFT: { label: 'مسودة', className: 'bg-stone-100 text-stone-600' },
    REVIEW: { label: 'قيد المراجعة', className: 'bg-amber-100 text-amber-800' },
    APPROVED: { label: 'معتمد', className: 'bg-emerald-100 text-emerald-800' },
    REJECTED: { label: 'مرفوض', className: 'bg-red-100 text-red-800' },
  };

  const style = styles[status];

  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

// لوحة الاختلافات - Variants Panel
// مشروع التشجير - نظام القراءات العشر
//
// هذه اللوحة هي مكان العمل العلمي الفعلي: عرض اختلافات الآية، وإضافة اختلاف
// جديد من الكلمات المعلّمة، وتحرير الأوجه ونطاقاتها وأدلتها.
//
// ترتيب العرض يتبع القاعدة المعتمدة: من آخر الآية إلى أولها.

'use client';

import { selectRange } from '@/lib/tashjeer/multi-selection';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { ScrollableList } from '@/components/ui/ScrollableList';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { describeScope, resolveScope } from '@/lib/tashjeer/scope';
import { VariantEditor } from './VariantEditor';
import { SmartCreateWizard } from './SmartCreateWizard';
import { GlobalRuleBuilder, type GlobalRuleSeed } from './GlobalRuleBuilder';
import { RulesIndexDialog } from './RulesIndexDialog';
import { characterCount, rangeFromCharacterAnchors, textForCharacterRange } from '@/lib/quran-logic/characters';
import { listGlobalRules, type GlobalRule } from '@/lib/storage/global-rules-store';
import { findGlobalRuleMatchesInAyah } from '@/lib/quran-logic/global-rule-engine';
import { deletedOccurrenceIds, occurrenceIdFor } from '@/lib/storage/rule-occurrences-store';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { RuleOccurrenceReview } from './RuleOccurrenceReview';
import type { Variant } from '@/types/tashjeer';
import { buildLociFromMarks, describeLoci, lociOfVariant } from '@/lib/tashjeer/loci';
import {
  buildSmartCreateBatch,
  buildSmartCreateMultiTargetBatch,
  type SmartVariantSpec,
} from '@/lib/tashjeer/smart-create';
import {
  listWizardTemplates,
  touchWizardTemplate,
  type WizardTemplateConfig,
} from '@/lib/tashjeer/wizard-templates';

export function VariantsPanel() {
  const {
    document,
    markedPositions,
    markedCharacters,
    markingMode,
    selectedVariantId,
    selectedAlternativeId,
    selectVariant,
    selectAlternative,
    multiSelection,
    setMultiSelection,
    requestDeleteItems,
    updateVariant,
    clearMarks,
    applySmartCreateBatch,
    smartWizardRequest,
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
  const [showSmartWizard, setShowSmartWizard] = useState(false);
  // قوالب المستخدم للإنشاء السريع بنقرة (تُحفظ من المعالج نفسه).
  const [quickTemplates, setQuickTemplates] = useState(() => listWizardTemplates());
  // آخر طلب فتح استُهلك من الاختصار N أو زر «إنشاء» عام.
  const consumedWizardRequest = useRef(0);
  const [listSearch, setListSearch] = useState('');
  // مرجع الصف المحدد: يُرسم دائمًا حتى خارج نافذة التنافذ ليعمل التمرير إليه.
  const selectedRowRef = useRef<HTMLLIElement>(null);
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

  const visibleVariants = useMemo(() => {
    const query = listSearch.trim().toLowerCase();
    if (!query || !document) return document?.variants ?? [];
    return document.variants.filter((variant) => {
      const title = variant.title.toLowerCase();
      const category = CATEGORY_LABELS[variant.category] ?? variant.category;
      const status = variant.status.toLowerCase();
      const source = variant.isGlobalDerived ? 'قاعدة عامة' : variant.origin === 'EDITOR' ? 'محرر' : 'محرك';
      return (
        title.includes(query) ||
        category.includes(query) ||
        status.includes(query) ||
        source.includes(query)
      );
    });
  }, [document, listSearch]);


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


  // الاختصار N أو زر «إنشاء» عام يفتح المعالج — باب الإنشاء الواحد (T3).
  useEffect(() => {
    if (smartWizardRequest > consumedWizardRequest.current) {
      consumedWizardRequest.current = smartWizardRequest;
      setShowSmartWizard(true);
    }
  }, [smartWizardRequest]);

  if (!document) return null;

  const editingVariant = document.variants.find((variant) => variant.id === editingVariantId);

  /** نص موضع واحد من التحديد لعناوين الإسناد الدفعي (FR-ED-09). */
  const titleOfLocus = (locus: (typeof draftLoci)[number]): string =>
    locus.characterRange
      ? textForCharacterRange(words, locus.characterRange)
      : words
          .filter((word) => word.position >= locus.startPosition && word.position <= locus.endPosition)
          .map((word) => word.text)
          .join(' ');

  /**
   * الإنشاء السريع (T3): قالب جاهز أو محفوظ يُطبَّق على التحديد الحالي بنقرة
   * واحدة عبر نواة المعالج نفسها — القدرة نفسها والباب واحد. المواضع المتفرقة
   * تُسند دفعة واحدة (FR-ED-09) في معاملة واحدة قابلة للتراجع الجماعي.
   */
  const handleQuickCreate = (config: WizardTemplateConfig, templateId?: string) => {
    if (draftLoci.length === 0 || config.types.length === 0) return;
    const variants: Partial<Record<(typeof config.types)[number], SmartVariantSpec[]>> = {};
    for (const type of config.types) {
      const faces = (config.faces[type] ?? '')
        .split(/[\n,،]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((label) => ({ label }));
      if (faces.length > 0) variants[type] = faces;
    }
    const first = config.types[0]!;
    const relations =
      config.relationMode === 'NONE' || config.types.length < 2
        ? []
        : config.types.slice(1).map((type) => ({
            fromType: first,
            toType: type,
            type: (config.relationMode === 'MUTUALLY_EXCLUSIVE' ? 'MUTUALLY_EXCLUSIVE' : 'RELATED') as
              | 'RELATED'
              | 'MUTUALLY_EXCLUSIVE',
          }));
    const baseTitle = markedText.trim() || 'اختلاف';
    const input = {
      ayahKey: document.ayahKey,
      selection: draftLoci,
      baseTitle,
      types: config.types,
      scope: { kind: 'ALL' as const },
      context: config.context,
      relations,
      variants,
    };
    // هدف واحد أو بنية مركبة؛ والأهداف المتفرقة تُكرر عليها البنية كلها.
    const result =
      draftLoci.length > 1
        ? buildSmartCreateMultiTargetBatch({
            ...input,
            targets: draftLoci.map((locus) => [locus]),
            titles: draftLoci.map((locus) => titleOfLocus(locus) || baseTitle),
          })
        : buildSmartCreateBatch(input);
    applySmartCreateBatch(result);
    if (templateId) {
      touchWizardTemplate(templateId);
      setQuickTemplates(listWizardTemplates());
    }
    clearMarks();
    refreshDerivedBranches();
    setGlobalNotice(
      `إنشاء سريع: ${toArabicDigits(result.differences.length)} اختلافات مستقلة و${toArabicDigits(result.relations.length)} علاقات في خطوة واحدة.`
    );
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

      {/* رسالة تعدد الموضع الواحد: تظهر عند إنشاء اختلاف ثانٍ فأكثر للموضع نفسه، وتُصرَف. */}
      <MultiDifferenceBanner />

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

      {/* الإنشاء عبر باب واحد: المعالج الذكي + الإنشاء السريع بالقوالب (T3). */}
      <section className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <h3 className="text-xs font-semibold text-stone-700">اختلاف جديد</h3>

        {!hasMarks ? (
          <div className="mt-1.5 space-y-2">
            <p className="text-xs leading-relaxed text-stone-500">
              {markingMode === 'CHARACTERS'
                ? 'فعّل أداة التعليم (M) ثم انقر كل حرف في خليته، أو افتح المعالج وحدد الموضع بداخله.'
                : 'فعّل أداة التعليم (M) ثم انقر الكلمات (Ctrl+نقر يعلّم دون تبديل الأداة)، أو افتح المعالج وحدد الموضع بداخله.'}
            </p>
            <button
              type="button"
              onClick={() => setShowSmartWizard(true)}
              className="w-full rounded-md border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-100"
              title="الاختصار N — التحديد البصري متاح داخل المعالج نفسه"
            >
              🧭 إنشاء ذكي (N)
            </button>
          </div>
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

            <button
              type="button"
              onClick={() => setShowSmartWizard(true)}
              className="w-full rounded-md border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-100"
              title="المعالج الموحّد (N): أنواع وأوجه ونطاق قرّاء وعلاقات وسياق وتعميم في خطوات واضحة"
            >
              🧭 المعالج الذكي الموحّد (٧ خطوات)
            </button>

            <div className="rounded-md border border-cyan-200 bg-white p-2">
              <p className="text-[10px] leading-relaxed text-cyan-950">
                إنشاء سريع بنقرة: القالب نفسه عبر نواة المعالج — والمواضع المتفرقة تُسند دفعة واحدة.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {QUICK_CREATE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleQuickCreate(template.config)}
                    title={template.hint}
                    className="rounded border border-cyan-300 bg-cyan-50 px-2 py-1 text-[10px] text-cyan-950 hover:bg-cyan-100"
                  >
                    ⚡ {template.label}
                  </button>
                ))}
                {quickTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleQuickCreate(template.config, template.id)}
                    title={template.hint ?? 'قالب محفوظ من المعالج'}
                    className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-[10px] text-violet-950 hover:bg-violet-100"
                  >
                    ⚡ {template.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
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


          <p className="px-4 py-6 text-center text-xs text-stone-500">
            {document.variants.length === 0
              ? 'لا توجد اختلافات مسجّلة في هذه الآية بعد.'
              : 'لا نتائج مطابقة للبحث أو التصفية.'}
          </p>

            {visibleVariants.map((variant, index) => {
              // خارج النافذة: لا يُرسم إلا الصف المحدد (ليبقى التمرير إليه ممكنا).
              if (range.active && (index < range.start || index > range.end) && variant.id !== selectedVariantId) {
                return null;
              }
              return (
              <VariantRow
                key={variant.id}
                variant={variant}
                catalog={catalog}
                isSelected={variant.id === selectedVariantId}
                selectedAlternativeId={variant.id === selectedVariantId ? selectedAlternativeId : null}
                rowRef={variant.id === selectedVariantId ? selectedRowRef : undefined}

                onSelectAlternative={(alternativeId) => selectAlternative(variant.id, alternativeId)}
                onRecitationModeChange={(recitationMode) => updateVariant(variant.id, { recitationMode })}
                onEdit={() => setEditingVariantId(variant.id)}
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
                onDelete={() => void requestDeleteItems({ kind: 'DIFFERENCE', ids: [variant.id] })}
                onBulkDeleteFaces={(faceIds) => requestDeleteItems({ kind: 'FACE', ownerId: variant.id, ids: faceIds })}
              />
              );
            })}
          </ul>
        )}
      />

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

      {showSmartWizard && (
        <SmartCreateWizard
          selectionText={markedText}
          initialLoci={draftLoci.length > 0 ? draftLoci : [{ startPosition: 1, endPosition: 1 }]}
          onClose={() => setShowSmartWizard(false)}
          onComplete={(message) => {
            clearMarks();
            refreshDerivedBranches();
            setQuickTemplates(listWizardTemplates());
            setGlobalNotice(message);
          }}
          onRequestFullBuilder={(seed) => {
            // المنشئ الكامل امتداد للمعالج لا بديل عنه: يُزرع بإعداد المعالج.
            setShowSmartWizard(false);
            setGlobalBuilderKind(markedCharacterRange ? 'CHARACTERS' : 'MORPHOLOGY');
            setGlobalBuilderSeed(seed);
            setGlobalBuilderRange(null);
            setShowGlobalBuilder(true);
          }}
        />
      )}
    </aside>
  );
}

/** قوالب الإنشاء السريع المدمجة: بنقرة عبر نواة المعالج نفسها (T3). */
const QUICK_CREATE_TEMPLATES: Array<{ id: string; label: string; hint: string; config: WizardTemplateConfig }> = [
  {
    id: 'quick-farsh',
    label: 'فرش واحد',
    hint: 'اختلاف فرشي واحد على التحديد — كل موضع متفرق يأخذ نسخته',
    config: { types: ['FARSH'], faces: {}, relationMode: 'NONE', context: 'ALWAYS' },
  },
  {
    id: 'quick-madd-group',
    label: 'مد + تحقيق + صلة',
    hint: 'مد بأوجه: تحقيق، تحقيق + صلة، صلة + فرش — في عملية واحدة',
    config: {
      types: ['MADUD'],
      faces: { MADUD: 'تحقيق\nتحقيق + صلة\nصلة + فرش' },
      relationMode: 'NONE',
      context: 'ALWAYS',
    },
  },
  {
    id: 'quick-farsh-usul',
    label: 'فرش + أصول',
    hint: 'اختلافان مستقلان مرتبطان — على كل موضع محدد',
    config: { types: ['FARSH', 'USUL'], faces: {}, relationMode: 'RELATED_TREE', context: 'ALWAYS' },
  },
];

// ==================== صف الاختلاف ====================

function VariantRow({
  variant,
  catalog,
  isSelected,
  selectedAlternativeId,
  rowRef,
  onMeasure,
  onSelect,
  isChecked,
  onSelectAlternative,
  onRecitationModeChange,
  onEdit,
  onGeneralize,
  onDelete,
  onBulkDeleteFaces,
}: {
  variant: Variant;
  catalog: import('@/lib/transmissions/catalog').TransmissionCatalog;
  isSelected: boolean;
  selectedAlternativeId: string | null;
  rowRef?: RefObject<HTMLLIElement | null>;
  /** قياس ارتفاع الصف للتنافذ (اختياري). */
  onMeasure?: (element: HTMLLIElement | null) => void;
  isChecked?: boolean;
  onSelect: (event: React.MouseEvent) => void;
  onSelectAlternative: (alternativeId: string) => void;
  onRecitationModeChange: (mode: Variant['recitationMode']) => void;
  onEdit: () => void;
  /** يحوّل هذا الاختلاف الحرفي إلى قاعدة عامة على المصحف كله. */
  onGeneralize?: () => void;
  onDelete: () => void;
  /** يحذف الأوجه المحددة دفعة واحدة (FR-ED-07). */
  onBulkDeleteFaces: (faceIds: string[]) => Promise<boolean>;
}) {
  const drawnAlternatives = variant.alternatives.filter((alternative) => !alternative.isBase);
  const multi = useEditorStore((state) => state.multiSelection);
  const setMulti = useEditorStore((state) => state.setMultiSelection);
  const checkedFaces = new Set(multi?.kind === 'FACE' && multi.ownerId === variant.id ? multi.ids : []);
  const setCheckedFaces = (faces: Set<string>) => setMulti({ kind: 'FACE', ownerId: variant.id, ids: [...faces], anchor: multi?.anchor });
  const copyFaces = useEditorStore((state) => state.copyFaces);
  const listRef = useRef<HTMLUListElement | null>(null);
  const chooseFace = (faceId: string, modifiers: { shift?: boolean; toggle?: boolean }) => {
    onSelectAlternative(faceId);
    setMulti(selectRange(multi?.kind === 'FACE' && multi.ownerId === variant.id ? multi : { kind: 'FACE', ownerId: variant.id, ids: [] }, faceId, variant.alternatives.map((face) => face.id), modifiers));
  };
  const toggleFaceCheck = (faceId: string) => chooseFace(faceId, { toggle: true });
  const rangeFaceCheck = (faceId: string) => chooseFace(faceId, { shift: true });

  /** Ctrl+A داخل قائمة الأوجه يحدد كل الأوجه، وCtrl+C ينسخ المحدد. */
  const handleFaceListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
    if (event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      event.stopPropagation();
      setCheckedFaces(new Set(variant.alternatives.map((alternative) => alternative.id)));
    } else if (event.key.toLowerCase() === 'x' && checkedFaces.size > 0) {
      event.preventDefault(); event.stopPropagation();
      useEditorStore.getState().cutSelection();
    } else if ((event.key === 'c' || event.key === 'C') && checkedFaces.size > 0) {
      event.preventDefault();
      event.stopPropagation();
      copyFaces(variant.id, [...checkedFaces]);
    }
  };

  return (
    <li
      ref={(element) => {
        if (rowRef) rowRef.current = element;
        onMeasure?.(element);
      }}
      data-difference-id={variant.id}

    >
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
          <ul
            ref={listRef}
            className="mt-2 space-y-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            tabIndex={0}
            onKeyDown={handleFaceListKeyDown}
            aria-label="أوجه الموضع: Shift للمدى، Ctrl+A للكل، Ctrl+C للنسخ"
          >
            {variant.alternatives.map((alternative) => (
              <li
                key={alternative.id}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.shiftKey) {
                    rangeFaceCheck(alternative.id);
                    return;
                  }
                  if (event.ctrlKey || event.metaKey) {
                    toggleFaceCheck(alternative.id);
                    return;
                  }
                  chooseFace(alternative.id, {});
                }}
                className={`cursor-pointer rounded border bg-white px-2 py-1.5 transition ${
                  alternative.id === selectedAlternativeId
                    ? 'border-cyan-600 ring-2 ring-cyan-200'
                    : 'border-stone-200 hover:border-cyan-300'
                }`}
                data-selected={checkedFaces.has(alternative.id)}
                data-face-id={alternative.id}
                title="انقر لتحديد هذا الوجه؛ يمكن نسخه أو قصه ثم لصقه في اختلاف آخر. أو ضع علامة للحذف الجماعي."
              >
                <div className="flex items-baseline justify-between gap-2">
                  <input
                    type="checkbox"
                    checked={checkedFaces.has(alternative.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (event.shiftKey) {
                        event.preventDefault();
                        rangeFaceCheck(alternative.id);
                      }
                    }}
                    onChange={(event) => {
                      if ((event.nativeEvent as MouseEvent).shiftKey) return;
                      toggleFaceCheck(alternative.id);
                    }}
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800">
              <span>محدَّد {toArabicDigits(checkedFaces.size)} من {toArabicDigits(variant.alternatives.length)} وجها</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCheckedFaces(new Set(variant.alternatives.map((alternative) => alternative.id)))}
                  className="rounded border border-rose-300 bg-white px-2 py-0.5 text-rose-700 hover:bg-rose-100"
                  title="Ctrl+A"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => copyFaces(variant.id, [...checkedFaces])}
                  className="rounded border border-cyan-300 bg-white px-2 py-0.5 text-cyan-800 hover:bg-cyan-50"
                  title="Ctrl+C: نسخ الأوجه المحددة للصقها في موضع آخر"
                >
                  نسخ المحدد
                </button>
                <button
                  type="button"
                  onClick={() => setCheckedFaces(new Set())}
                  className="rounded border border-rose-300 bg-white px-2 py-0.5 text-rose-700 hover:bg-rose-100"
                >
                  إلغاء التحديد
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await onBulkDeleteFaces([...checkedFaces])) setCheckedFaces(new Set());
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

/**
 * شريط «تعدد الموضع الواحد»: يظهر بعد إنشاء اختلاف لمنطقة بلغت اختلافين
 * فأكثر، ليؤكد أن الجديد كيان مستقل بفهرس تالٍ لا بديل عن الموجود.
 */
function MultiDifferenceBanner() {
  const notice = useEditorStore((state) => state.lastMultiDifferenceNotice);
  const clear = useEditorStore((state) => state.clearMultiDifferenceNotice);
  if (!notice) return null;

  const countLabel =
    notice.count === 2
      ? 'اختلافان لموضع واحد'
      : notice.count <= 10
        ? `${toArabicDigits(notice.count)} اختلافات لموضع واحد`
        : `${toArabicDigits(notice.count)} اختلافا لموضع واحد`;

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-2 border-b border-cyan-200 bg-cyan-50/70 px-4 py-2"
    >
      <div className="text-[11px] leading-relaxed text-cyan-950">
        <p className="font-semibold">{countLabel}</p>
        <p className="mt-0.5 text-cyan-900/80">
          الموضع: {toArabicDigits(notice.locusLabel)} —{' '}
          {notice.categories.map((category) => CATEGORY_LABELS[category]).join(' + ')}
        </p>
        <p className="mt-0.5 text-cyan-900/70">
          الجديد مستقل بمعرفه وفهرسه؛ حدّد أي اختلاف في اللوحة المجاورة لتفحّصه.
        </p>
      </div>
      <button
        type="button"
        onClick={clear}
        className="shrink-0 rounded border border-cyan-300 px-2 py-0.5 text-[10px] text-cyan-900 hover:bg-cyan-100"
        aria-label="صرف الرسالة"
      >
        فهمت
      </button>
    </div>
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

// لوحة الاختلافات - Variants Panel
// مشروع التشجير - نظام القراءات العشر
//
// هذه اللوحة هي مكان العمل العلمي الفعلي: عرض اختلافات الآية، وإضافة اختلاف
// جديد من الكلمات المعلّمة، وتحرير الأوجه ونطاقاتها وأدلتها.
//
// ترتيب العرض يتبع القاعدة المعتمدة: من آخر الآية إلى أولها.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useEditorStore } from '@/stores/editor-store';
import { getAyahWordsByKey } from '@/data/quran';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { describeScope, resolveScope } from '@/lib/tashjeer/scope';
import { VariantEditor } from './VariantEditor';
import { GlobalRuleBuilder } from './GlobalRuleBuilder';
import { rangeFromCharacterAnchors, textForCharacterRange } from '@/lib/quran-logic/characters';
import { listGlobalRules, type GlobalRule } from '@/lib/storage/global-rules-store';
import { findGlobalRuleMatchesInAyah } from '@/lib/quran-logic/global-rule-engine';
import { deletedOccurrenceIds, occurrenceIdFor } from '@/lib/storage/rule-occurrences-store';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { RuleOccurrenceReview } from './RuleOccurrenceReview';
import type { VariantCategory } from '@/types';
import type { Variant } from '@/types/tashjeer';

export function VariantsPanel() {
  const {
    document,
    markedPositions,
    markedCharacters,
    markingMode,
    selectedVariantId,
    draftCategory,
    setDraftCategory,
    selectVariant,
    deleteVariant,
    clearMarks,
    addVariant,
    refreshDerivedBranches,
  } = useEditorStore();

  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [showGlobalBuilder, setShowGlobalBuilder] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);
  const [globalBuilderKind, setGlobalBuilderKind] = useState<'CHARACTERS' | 'MORPHOLOGY'>('CHARACTERS');
  const [reviewingRule, setReviewingRule] = useState<GlobalRule | null>(null);
  // استثناءات المواضع كلها: تغيّرها يعيد حساب عدّادات هذه اللوحة فورا.
  const occurrences = useRuleOccurrences();
  const catalog = useTransmissionCatalog();

  const words = useMemo(
    () => (document ? getAyahWordsByKey(document.ayahKey) : []),
    [document]
  );

  const markedCharacterRange = useMemo(
    () => rangeFromCharacterAnchors(markedCharacters),
    [markedCharacters]
  );

  const markedText = useMemo(() => {
    if (markingMode === 'CHARACTERS' && markedCharacterRange) {
      return textForCharacterRange(words, markedCharacterRange);
    }
    return markedPositions
      .map((position) => words.find((word) => word.position === position)?.text ?? '')
      .join(' ');
  }, [markedCharacterRange, markedPositions, markingMode, words]);

  const hasMarks =
    markingMode === 'CHARACTERS' ? markedCharacterRange !== null : markedPositions.length > 0;

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

  if (!document) return null;

  const editingVariant = document.variants.find((variant) => variant.id === editingVariantId);

  /** ينشئ اختلافا جديدا من الكلمات المعلّمة، بوجه أساس واحد جاهز للتحرير. */
  const handleCreateVariant = () => {
    if (!hasMarks) return;

    const characterRange = markingMode === 'CHARACTERS' ? markedCharacterRange : null;
    const start = characterRange
      ? characterRange.start.position
      : Math.min(...markedPositions);
    const end = characterRange
      ? characterRange.end.position
      : Math.max(...markedPositions);
    const baseText = characterRange
      ? textForCharacterRange(words, characterRange)
      : words
          .filter((word) => word.position >= start && word.position <= end)
          .map((word) => word.text)
          .join(' ');

    const id = `v-${document.ayahKey}-${start}-${Date.now().toString(36)}`;

    addVariant({
      id,
      category: draftCategory,
      title: baseText,
      startPosition: start,
      endPosition: end,
      targetKind: characterRange ? 'CHARACTERS' : 'WORDS',
      characterRange: characterRange ?? undefined,
      status: 'DRAFT',
      alternatives: [
        {
          id: `${id}-base`,
          text: baseText,
          label: 'وجه المصحف',
          isBase: true,
          scope: { kind: 'ALL' },
        },
      ],
    });

    selectVariant(id);
    setEditingVariantId(id);
  };

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-s border-stone-200 bg-white">
      <header className="border-b border-stone-200 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-stone-900">اختلافات الآية</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {document.variants.length} اختلافا — مرتبة من آخر الآية إلى أولها
            </p>
          </div>
          <Link
            href="/variants"
            className="shrink-0 rounded border border-violet-200 px-2 py-1 text-[10px] text-violet-800 hover:bg-violet-50"
            title="إضافة قاعدة عامة أو البحث في كل الاختلافات"
          >
            الفهرس
          </Link>
        </div>
      </header>

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
              setShowGlobalBuilder(true);
            }}
            className="shrink-0 rounded border border-violet-300 bg-white px-2 py-1 text-[10px] text-violet-900 hover:bg-violet-100"
            title="إضافة قاعدة صرفية نمطية حتمية"
          >
            + قاعدة صرفية
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
              ? 'فعّل أداة التعليم (M) ثم انقر على خلايا الحروف؛ احرص على تحديد بداية المدى ونهايته.'
              : 'فعّل أداة التعليم (M) ثم انقر على الكلمات التي يقع فيها الاختلاف.'}
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
                {markedCharacterRange
                  ? `الحروف: كلمة ${markedCharacterRange.start.position} / حرف ${markedCharacterRange.start.characterIndex} إلى كلمة ${markedCharacterRange.end.position} / حرف ${markedCharacterRange.end.characterIndex}`
                  : `الكلمات ${Math.min(...markedPositions)}–${Math.max(...markedPositions)}`}
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

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCreateVariant}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                إنشاء الاختلاف في الآية
              </button>
              {markingMode === 'CHARACTERS' && markedCharacterRange && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalBuilderKind('CHARACTERS');
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

      {/* قائمة الاختلافات */}
      <div className="flex-1 overflow-y-auto">
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
                onSelect={() => selectVariant(variant.id === selectedVariantId ? null : variant.id)}
                onEdit={() => setEditingVariantId(variant.id)}
                onDelete={() => {
                  if (window.confirm(`حذف الاختلاف «${variant.title}»؟`)) {
                    deleteVariant(variant.id);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {editingVariant && (
        <VariantEditor variant={editingVariant} onClose={() => setEditingVariantId(null)} />
      )}

      {reviewingRule && (
        <RuleOccurrenceReview
          rule={reviewingRule}
          startAtAyahKey={document.ayahKey}
          onClose={() => {
            setReviewingRule(null);
            refreshDerivedBranches();
          }}
        />
      )}

      {showGlobalBuilder && (
        <GlobalRuleBuilder
          ayahKey={document.ayahKey}
          characterRange={markedCharacterRange}
          initialKind={globalBuilderKind}
          onClose={() => setShowGlobalBuilder(false)}
          onSaved={(_rule, matchCount) => {
            setShowGlobalBuilder(false);
            clearMarks();
            refreshDerivedBranches();
            setGlobalNotice(`تم حفظ القاعدة وتطبيقها على ${matchCount} موضع في المصحف.`);
          }}
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
  onSelect,
  onEdit,
  onDelete,
}: {
  variant: Variant;
  catalog: import('@/lib/transmissions/catalog').TransmissionCatalog;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const drawnAlternatives = variant.alternatives.filter((alternative) => !alternative.isBase);

  return (
    <li className={isSelected ? 'bg-emerald-50/60' : ''}>
      <div className="px-4 py-3">
        <button type="button" onClick={onSelect} className="w-full text-start">
          <div className="flex items-start justify-between gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: getCategorySoftColor(variant.category),
                color: getCategoryColor(variant.category),
              }}
            >
              {CATEGORY_LABELS[variant.category]}
            </span>
            <StatusBadge status={variant.status} />
          </div>

          <p className="mt-1.5 text-sm font-medium leading-relaxed text-stone-900">
            {variant.title}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">
            {variant.targetKind === 'CHARACTERS' && variant.characterRange
              ? `حروف: ${variant.characterRange.start.position}/${variant.characterRange.start.characterIndex} إلى ${variant.characterRange.end.position}/${variant.characterRange.end.characterIndex}`
              : `الكلمات ${variant.startPosition}${variant.endPosition !== variant.startPosition ? `–${variant.endPosition}` : ''}`}{' '}
            — {drawnAlternatives.length} وجها مرسوما
          </p>
        </button>

        {isSelected && (
          <ul className="mt-2 space-y-1.5">
            {variant.alternatives.map((alternative) => (
              <li
                key={alternative.id}
                className="rounded border border-stone-200 bg-white px-2 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
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
        )}

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-stone-300 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-100"
          >
            تحرير
          </button>
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

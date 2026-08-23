// لوحة الاختلافات - Variants Panel v2 - بيئة احترافية
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
import { findGlobalRuleMatchesInAyah, getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { deletedOccurrenceIds, occurrenceIdFor } from '@/lib/storage/rule-occurrences-store';
import { useRuleOccurrences } from '@/hooks/useRuleOccurrences';
import { RuleOccurrenceReview } from './RuleOccurrenceReview';
import { MultiDifferenceBuilder } from './MultiDifferenceBuilder';
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
    selectedFaceIds,
    multiSelectedVariantIds,
    draftCategory,
    setDraftCategory,
    selectVariant,
    selectAlternative,
    toggleSelectedFace,
    toggleMultiVariant,
    selectMultipleVariants,
    deleteVariant,
    updateVariant,
    duplicateVariant,
    mergeVariants,
    moveVariant,
    clearMarks,
    addVariant,
    addVariantGroup,
    addVariantGroupWithRelations,
    copySelection,
    cutSelection,
    pasteSelection,
    refreshDerivedBranches,
    openAyah,
  } = useEditorStore();

  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [showGlobalBuilder, setShowGlobalBuilder] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);
  const [globalBuilderKind, setGlobalBuilderKind] = useState<'CHARACTERS' | 'MORPHOLOGY'>('CHARACTERS');
  const [globalBuilderSeed, setGlobalBuilderSeed] = useState<GlobalRuleSeed | undefined>(undefined);
  const [globalBuilderRange, setGlobalBuilderRange] = useState<import('@/types/tashjeer').CharacterRange | null>(null);
  const [reviewingRule, setReviewingRule] = useState<GlobalRule | null>(null);
  const [showRulesIndex, setShowRulesIndex] = useState(false);
  const [showBatchBuilder, setShowBatchBuilder] = useState(false);
  const [batchCategories, setBatchCategories] = useState<VariantCategory[]>(['USUL', 'FARSH', 'MADUD']);
  const [batchWithLinks, setBatchWithLinks] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showDerived, setShowDerived] = useState(true);
  const [showMultiBuilder, setShowMultiBuilder] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLLIElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const occurrences = useRuleOccurrences();
  const catalog = useTransmissionCatalog();

  const words = useMemo(() => documentWindowWords(document), [document]);
  const markedCharacterRange = useMemo(() => rangeFromCharacterAnchors(markedCharacters), [markedCharacters]);

  const draftLoci = useMemo(() => {
    const wordLengths = new Map(words.map((word) => [word.position, characterCount(word.text)]));
    return buildLociFromMarks({ mode: markingMode, positions: markedPositions, characters: markedCharacters, wordLengths });
  }, [markingMode, markedCharacters, markedPositions, words]);

  const markedText = useMemo(() => {
    if (draftLoci.length === 0) return '';
    return draftLoci
      .map((locus) => (locus.characterRange ? textForCharacterRange(words, locus.characterRange) : words.filter((w) => w.position >= locus.startPosition && w.position <= locus.endPosition).map((w) => w.text).join(' ')))
      .filter(Boolean)
      .join('  ·  ');
  }, [draftLoci, words]);

  const hasMarks = draftLoci.length > 0;
  const effectiveVariants = useMemo(() => (document ? getEffectiveVariants(document) : []), [document, occurrences.key]);
  const localVariants = useMemo(() => document?.variants ?? [], [document]);
  const derivedVariants = useMemo(() => effectiveVariants.filter((v) => v.isGlobalDerived), [effectiveVariants]);

  const displayedVariants = useMemo(() => {
    let list = showDerived ? effectiveVariants : localVariants;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((v) => v.title.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) || v.category.toLowerCase().includes(q));
    }
    return list;
  }, [effectiveVariants, localVariants, showDerived, searchQuery]);

  const activeGlobalRules = useMemo(() => {
    if (!document) return [];
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
    if (selectedVariantId) {
      window.dispatchEvent(new CustomEvent('tashjeer:scroll-to-variant', { detail: { variantId: selectedVariantId } }));
    }
  }, [selectedVariantId]);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const update = () => {
      setCanScrollUp(element.scrollTop > 4);
      setCanScrollDown(element.scrollTop + element.clientHeight < element.scrollHeight - 4);
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(element);
    const mo = new MutationObserver(update);
    mo.observe(element, { childList: true, subtree: true });
    return () => {
      element.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [displayedVariants.length]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let isDown = false;
    let startY = 0;
    let startScroll = 0;
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, input, select, li')) return;
      isDown = true;
      startY = e.clientY;
      startScroll = el.scrollTop;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };
    const onMove = (e: MouseEvent) => {
      if (!isDown) return;
      el.scrollTop = startScroll - (e.clientY - startY);
    };
    const onUp = () => {
      isDown = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!document) return null;
  const editingVariant = (document.variants.find((v) => v.id === editingVariantId) ?? effectiveVariants.find((v) => v.id === editingVariantId) ?? null) as Variant | null;

  const createVariantFromLoci = (loci: VariantLocus[], openEditor: boolean, categoryOverride?: VariantCategory, extra?: Partial<Variant>) => {
    if (loci.length === 0 || !document) return;
    const bounds = boundsOfLoci(loci);
    const title = loci
      .map((locus) => (locus.characterRange ? textForCharacterRange(words, locus.characterRange) : words.filter((w) => w.position >= locus.startPosition && w.position <= locus.endPosition).map((w) => w.text).join(' ')))
      .filter(Boolean)
      .join('  ·  ');
    const id = `v-${document.ayahKey}-${bounds.startPosition}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const isCharacters = loci.some((locus) => Boolean(locus.characterRange));
    addVariant({
      id,
      category: categoryOverride ?? draftCategory,
      title: title || 'اختلاف',
      startPosition: bounds.startPosition,
      endPosition: bounds.endPosition,
      targetKind: isCharacters ? 'CHARACTERS' : 'WORDS',
      characterRange: loci.length === 1 ? loci[0].characterRange : undefined,
      loci: loci.length > 1 ? loci : undefined,
      status: 'DRAFT',
      alternatives: [{ id: `${id}-base`, text: title || 'وجه المصحف', label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' } }],
      ...extra,
    } as any);
    if (openEditor) {
      selectVariant(id);
      setEditingVariantId(id);
    }
  };

  const handleCreateVariant = () => createVariantFromLoci(draftLoci, true);
  const handleCreatePerLocus = () => {
    draftLoci.forEach((locus, index) => createVariantFromLoci([locus], index === 0));
  };

  const handleCreateBatch = () => {
    if (draftLoci.length === 0 || batchCategories.length === 0) return;
    const bounds = boundsOfLoci(draftLoci);
    const baseText = markedText || 'وجه المصحف';
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const batchGroupId = `batch-${stamp}`;
    if (batchWithLinks && batchCategories.length > 1) {
      const baseCat = batchCategories[0];
      const baseId = `v-${document.ayahKey}-${bounds.startPosition}-${stamp}-1`;
      const baseVariant = {
        id: baseId,
        category: baseCat,
        title: `${baseText} — ${CATEGORY_LABELS[baseCat]}`,
        startPosition: bounds.startPosition,
        endPosition: bounds.endPosition,
        targetKind: draftLoci.some((l) => l.characterRange) ? ('CHARACTERS' as const) : ('WORDS' as const),
        characterRange: draftLoci.length === 1 ? draftLoci[0].characterRange : undefined,
        loci: draftLoci.length > 1 ? draftLoci : undefined,
        orderRank: 1,
        status: 'DRAFT' as const,
        alternatives: [{ id: `${baseId}-base`, text: baseText, label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' as const } }],
        batchGroupId,
        isIndependent: true,
      };
      const related = batchCategories.slice(1).map((category, index) => {
        const id = `v-${document.ayahKey}-${bounds.startPosition}-${stamp}-${index + 2}`;
        return {
          id,
          category,
          title: `${baseText} — ${CATEGORY_LABELS[category]}`,
          startPosition: bounds.startPosition,
          endPosition: bounds.endPosition,
          targetKind: draftLoci.some((l) => l.characterRange) ? ('CHARACTERS' as const) : ('WORDS' as const),
          characterRange: draftLoci.length === 1 ? draftLoci[0].characterRange : undefined,
          loci: draftLoci.length > 1 ? draftLoci : undefined,
          orderRank: index + 2,
          status: 'DRAFT' as const,
          alternatives: [{ id: `${id}-base`, text: baseText, label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' as const } }],
          batchGroupId,
          isIndependent: true,
        };
      });
      addVariantGroupWithRelations({ base: baseVariant as any, related: related as any, createLinks: true, batchGroupId });
    } else {
      addVariantGroup(
        batchCategories.map((category, index) => {
          const id = `v-${document.ayahKey}-${bounds.startPosition}-${stamp}-${index + 1}`;
          return {
            id,
            category,
            title: `${baseText} — ${CATEGORY_LABELS[category]}`,
            startPosition: bounds.startPosition,
            endPosition: bounds.endPosition,
            targetKind: draftLoci.some((l) => l.characterRange) ? ('CHARACTERS' as const) : ('WORDS' as const),
            characterRange: draftLoci.length === 1 ? draftLoci[0].characterRange : undefined,
            loci: draftLoci.length > 1 ? draftLoci : undefined,
            orderRank: index + 1,
            status: 'DRAFT' as const,
            alternatives: [{ id: `${id}-base`, text: baseText, label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' as const } }],
            batchGroupId,
            isIndependent: true,
          } as any;
        })
      );
    }
    setShowBatchBuilder(false);
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) setDragOverId(id);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    if (e.shiftKey) {
      if (confirm(`هل تريد دمج الاختلاف؟`)) mergeVariants(draggedId, targetId);
    } else {
      const targetIndex = displayedVariants.findIndex((v) => v.id === targetId);
      if (targetIndex !== -1 && confirm(`هل تريد نقل هذا السطر إلى هذا الموضع؟`)) moveVariant(draggedId, targetIndex);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <aside className="flex h-full min-h-0 w-[360px] shrink-0 flex-col overflow-hidden border-s border-stone-200 bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.04)]">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-stone-900">اختلافات الآية</h2>
            <p className="mt-0.5 text-[11px] text-stone-500">{toArabicDigits(localVariants.length)} محلي · {toArabicDigits(derivedVariants.length)} قواعد · {toArabicDigits(displayedVariants.length)} معروض</p>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setShowDerived((v) => !v)} className={`rounded border px-2 py-1 text-[10px] ${showDerived ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-stone-300 bg-white text-stone-600'}`}>{showDerived ? 'إخفاء المشتق' : 'إظهار المشتق'}</button>
            <button type="button" onClick={() => setShowRulesIndex(true)} className="rounded border border-violet-200 px-2 py-1 text-[10px] text-violet-800 hover:bg-violet-50">الفهرس</button>
          </div>
        </div>
        <div className="mt-2 flex gap-1">
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث..." className="h-7 flex-1 rounded border border-stone-300 px-2 text-[11px]" />
          {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="h-7 rounded border border-stone-300 px-2 text-[10px]">مسح</button>}
        </div>
        {multiSelectedVariantIds.length > 0 && (
          <div className="mt-2 flex gap-1 rounded bg-cyan-50 p-1.5 text-[10px]">
            <span>{toArabicDigits(multiSelectedVariantIds.length)} محدد</span>
            <button type="button" onClick={copySelection} className="rounded border border-cyan-300 bg-white px-1.5 py-0.5">نسخ</button>
            <button type="button" onClick={cutSelection} className="rounded border border-cyan-300 bg-white px-1.5 py-0.5">قص</button>
            <button type="button" onClick={() => selectMultipleVariants([])} className="rounded border border-stone-300 bg-white px-1.5 py-0.5">إلغاء</button>
          </div>
        )}
      </header>

      <p className="border-b border-stone-100 bg-emerald-50/60 px-4 py-2 text-[11px] leading-relaxed text-emerald-950">كل اختلاف مستقل. سحب لنقل، Shift+سحب لدمج، اختيار ينقل المحرر فورا.</p>

      <section className="border-b border-stone-200 bg-violet-50/40 px-4 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div><h3 className="text-[11px] font-semibold text-violet-950">قواعد عامة</h3><p className="mt-0.5 text-[10px] text-violet-900/70">تظهر كاختلافات مستقلة قابلة للتحرير.</p></div>
          <button type="button" onClick={() => { setGlobalBuilderKind('MORPHOLOGY'); setGlobalBuilderSeed(undefined); setGlobalBuilderRange(null); setShowGlobalBuilder(true); }} className="shrink-0 rounded border border-violet-300 bg-white px-2 py-1 text-[10px] text-violet-900 hover:bg-violet-100">+ قاعدة</button>
        </div>
        {globalNotice && <p role="status" className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">{globalNotice}</p>}
        {activeGlobalRules.length === 0 ? <p className="mt-2 text-[10px] text-violet-900/60">لا توجد قواعد مطابقة.</p> : <ul className="mt-2 max-h-32 space-y-1 overflow-auto">{activeGlobalRules.map(({ rule, matches, removedHere }) => <li key={rule.id} className="flex items-center justify-between rounded border border-violet-100 bg-white px-2 py-1 text-[10px]"><span className="truncate font-medium">{rule.ruleLabel || rule.title} · {matches.length - removedHere}/{matches.length}</span><button type="button" onClick={() => setReviewingRule(rule)} className="rounded border border-violet-300 px-1.5 py-0.5 text-[9px] text-violet-900 hover:bg-violet-50">تتبع</button></li>)}</ul>}
      </section>

      <section className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <h3 className="text-xs font-semibold text-stone-700">اختلاف جديد</h3>
        {!hasMarks ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-stone-500">{markingMode === 'CHARACTERS' ? 'فعّل التعليم (M) ثم انقر الحروف.' : 'فعّل التعليم (M) ثم انقر الكلمات. يمكنك تحديد عدة كلمات معا.'}</p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
              <p className="text-base leading-loose text-stone-900" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>{markedText}</p>
              <p className="mt-1 text-[10px] text-stone-500">{toArabicDigits(draftLoci.length)} موضعا: {toArabicDigits(describeLoci(draftLoci))}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => (
                <button key={category} type="button" onClick={() => setDraftCategory(category)} className={`rounded border px-2 py-1 text-[10px] ${draftCategory === category ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'}`}>{CATEGORY_LABELS[category]}</button>
              ))}
            </div>
            <button type="button" onClick={() => setShowMultiBuilder(true)} className="w-full rounded-md bg-gradient-to-r from-violet-600 to-cyan-600 px-3 py-2 text-xs font-bold text-white shadow hover:from-violet-700 hover:to-cyan-700">✨ إنشاء ذكي متعدد الأنواع والأوجه</button>
            <button type="button" onClick={() => setShowBatchBuilder((v) => !v)} className="w-full rounded-md border border-cyan-500 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-950 hover:bg-cyan-100">+ إنشاء سريع متعدد الفئات</button>
            {showBatchBuilder && (
              <div className="rounded-md border border-cyan-200 bg-white p-2">
                <p className="text-[10px] leading-relaxed text-cyan-950">اختر الأنواع. كل نوع كيان مستقل.</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => (
                    <label key={category} className="flex items-center gap-1 rounded border border-stone-200 px-1.5 py-1 text-[10px]">
                      <input type="checkbox" checked={batchCategories.includes(category)} onChange={() => setBatchCategories((cur) => cur.includes(category) ? cur.filter((i) => i !== category) : [...cur, category])} className="accent-cyan-700" />{CATEGORY_LABELS[category]}
                    </label>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-1 text-[10px] text-stone-700"><input type="checkbox" checked={batchWithLinks} onChange={(e) => setBatchWithLinks(e.target.checked)} className="accent-cyan-700" />إنشاء علاقات تلقائيا</label>
                <button type="button" disabled={batchCategories.length === 0} onClick={handleCreateBatch} className="mt-2 w-full rounded bg-cyan-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-cyan-800 disabled:opacity-50">إنشاء {toArabicDigits(batchCategories.length)} اختلافات</button>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={handleCreateVariant} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">اختلاف واحد</button>
              {draftLoci.length > 1 && <button type="button" onClick={handleCreatePerLocus} className="rounded-md border border-emerald-600 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50">مستقل لكل موضع</button>}
              {markingMode === 'CHARACTERS' && markedCharacterRange && <button type="button" onClick={() => { setGlobalBuilderKind('CHARACTERS'); setGlobalBuilderSeed(undefined); setGlobalBuilderRange(null); setShowGlobalBuilder(true); }} className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100">قاعدة للمصحف</button>}
              <button type="button" onClick={clearMarks} className="rounded-md border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100 sm:col-span-2">إلغاء</button>
            </div>
          </div>
        )}
      </section>

      <div className="relative min-h-0 flex-1 bg-white">
        {canScrollUp && <button type="button" onClick={() => listRef.current?.scrollBy({ top: -400, behavior: 'smooth' })} className="absolute start-1/2 top-2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-stone-300 bg-white/90 text-xs shadow-md backdrop-blur hover:bg-stone-50">↑</button>}
        <div ref={listRef} className="custom-scrollbar h-full overscroll-contain overflow-y-auto overflow-x-hidden scroll-smooth pb-16 pt-1 [scrollbar-gutter:stable] touch-pan-y" tabIndex={0} aria-label="قائمة الاختلافات">
          {displayedVariants.length === 0 ? <p className="px-4 py-6 text-center text-xs text-stone-500">لا توجد اختلافات.</p> : <ul className="divide-y divide-stone-100">{displayedVariants.map((variant, idx) => <VariantRow key={variant.id} variant={variant} catalog={catalog} index={idx} isSelected={variant.id === selectedVariantId} isMultiSelected={multiSelectedVariantIds.includes(variant.id)} selectedAlternativeId={variant.id === selectedVariantId ? selectedAlternativeId : null} selectedFaceIds={variant.id === selectedVariantId ? selectedFaceIds : []} rowRef={variant.id === selectedVariantId ? selectedRowRef : undefined} isDragged={draggedId === variant.id} isDragOver={dragOverId === variant.id} onDragStart={() => handleDragStart(variant.id)} onDragOver={(e) => handleDragOver(e, variant.id)} onDrop={(e) => handleDrop(e, variant.id)} onSelect={() => selectVariant(variant.id === selectedVariantId ? null : variant.id)} onToggleMulti={(e) => { e.stopPropagation(); toggleMultiVariant(variant.id); }} onSelectAlternative={(altId) => selectAlternative(variant.id, altId)} onToggleFace={(faceId) => toggleSelectedFace(variant.id, faceId)} onRecitationModeChange={(mode) => updateVariant(variant.id, { recitationMode: mode, waqfContext: mode ? { mode } : undefined } as any)} onEdit={() => setEditingVariantId(variant.id)} onDuplicate={() => duplicateVariant(variant.id)} onGeneralize={variant.targetKind === 'CHARACTERS' && variant.characterRange ? () => { const first = variant.alternatives.find((a) => !a.isBase); setGlobalBuilderKind('CHARACTERS'); setGlobalBuilderRange(variant.characterRange ?? null); setGlobalBuilderSeed({ title: variant.title, category: variant.category, scope: first?.scope, ruleLabel: first?.ruleLabel ?? first?.label, maddHarakat: first?.maddHarakat, description: variant.description, sourceRef: variant.sourceRef, strengthDegreeId: first?.strengthDegreeId, strengthByNarrator: first?.strengthByNarrator, orderRank: variant.orderRank }); setShowGlobalBuilder(true); } : undefined} onDelete={() => { if (window.confirm(`حذف «${variant.title}»؟`)) deleteVariant(variant.id); }} />)}</ul>}
        </div>
        {canScrollDown && <button type="button" onClick={() => listRef.current?.scrollBy({ top: 400, behavior: 'smooth' })} className="absolute bottom-2 start-1/2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-stone-300 bg-white/90 text-xs shadow-md backdrop-blur hover:bg-stone-50">↓</button>}
      </div>

      <footer className="border-t border-stone-200 bg-stone-50 px-3 py-1.5 text-[10px] text-stone-500"><span>Ctrl+C نسخ · Ctrl+V لصق · سحب لنقل · Shift+سحب لدمج</span><button type="button" onClick={pasteSelection} className="ms-2 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[10px]">لصق</button></footer>

      {editingVariant && <VariantEditor variant={editingVariant} onClose={() => setEditingVariantId(null)} onGeneralize={editingVariant.targetKind === 'CHARACTERS' && editingVariant.characterRange ? () => { const first = editingVariant.alternatives.find((a) => !a.isBase); setEditingVariantId(null); setGlobalBuilderKind('CHARACTERS'); setGlobalBuilderRange(editingVariant.characterRange ?? null); setGlobalBuilderSeed({ title: editingVariant.title, category: editingVariant.category, scope: first?.scope, ruleLabel: first?.ruleLabel ?? first?.label, maddHarakat: first?.maddHarakat, description: editingVariant.description, sourceRef: editingVariant.sourceRef, strengthDegreeId: first?.strengthDegreeId, strengthByNarrator: first?.strengthByNarrator, orderRank: editingVariant.orderRank }); setShowGlobalBuilder(true); } : undefined} />}

      {reviewingRule && <RuleOccurrenceReview rule={reviewingRule} startAtAyahKey={document.ayahKey} onOpenInEditor={(ayahKey) => { setReviewingRule(null); refreshDerivedBranches(); openAyah(ayahKey); }} onClose={() => { setReviewingRule(null); refreshDerivedBranches(); }} />}

      {showGlobalBuilder && <GlobalRuleBuilder ayahKey={document.ayahKey} characterRange={globalBuilderRange ?? markedCharacterRange} initialKind={globalBuilderKind} seed={globalBuilderSeed} onClose={() => { setShowGlobalBuilder(false); setGlobalBuilderSeed(undefined); setGlobalBuilderRange(null); }} onSaved={(rule, matchCount) => { setShowGlobalBuilder(false); setGlobalBuilderSeed(undefined); setGlobalBuilderRange(null); clearMarks(); refreshDerivedBranches(); setGlobalNotice(`تم حفظ القاعدة على ${matchCount} موضع.`); setReviewingRule(rule); }} />}

      {showRulesIndex && <RulesIndexDialog currentAyahKey={document.ayahKey} onClose={() => setShowRulesIndex(false)} onNavigate={(ayahKey, variantId) => { openAyah(ayahKey); if (variantId) selectVariant(variantId); }} onRulesChanged={refreshDerivedBranches} />}

      {showMultiBuilder && <MultiDifferenceBuilder onClose={() => setShowMultiBuilder(false)} />}

      <style>{`.custom-scrollbar::-webkit-scrollbar{width:8px;height:8px}.custom-scrollbar::-webkit-scrollbar-thumb{background:#d6d3d1;border-radius:4px}.custom-scrollbar::-webkit-scrollbar-thumb:hover{background:#a8a29e}.custom-scrollbar::-webkit-scrollbar-track{background:#f5f5f4}`}</style>
    </aside>
  );
}

function VariantRow({
  variant,
  catalog,
  index,
  isSelected,
  isMultiSelected,
  selectedAlternativeId,
  selectedFaceIds,
  rowRef,
  isDragged,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onSelect,
  onToggleMulti,
  onSelectAlternative,
  onToggleFace,
  onRecitationModeChange,
  onEdit,
  onDuplicate,
  onGeneralize,
  onDelete,
}: {
  variant: Variant;
  catalog: import('@/lib/transmissions/catalog').TransmissionCatalog;
  index: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  selectedAlternativeId: string | null;
  selectedFaceIds: string[];
  rowRef?: RefObject<HTMLLIElement | null>;
  isDragged: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onSelect: () => void;
  onToggleMulti: (e: React.MouseEvent) => void;
  onSelectAlternative: (alternativeId: string) => void;
  onToggleFace: (faceId: string) => void;
  onRecitationModeChange: (mode: Variant['recitationMode']) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onGeneralize?: () => void;
  onDelete: () => void;
}) {
  const drawn = variant.alternatives.filter((a) => !a.isBase);
  const isDerived = variant.isGlobalDerived;
  return (
    <li ref={rowRef as any} data-difference-id={variant.id} draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} className={`group relative select-none transition-all ${isSelected ? 'bg-emerald-50/70 ring-2 ring-inset ring-emerald-500' : ''} ${isMultiSelected ? 'bg-cyan-50 ring-1 ring-cyan-300' : ''} ${isDragged ? 'opacity-50' : ''} ${isDragOver ? 'bg-amber-50 ring-2 ring-amber-400' : ''} hover:bg-stone-50`}>
      {isDragOver && <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-amber-500" />}
      <div className="flex items-start gap-1 px-3 py-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded bg-stone-100 text-[10px] text-stone-500 group-hover:bg-stone-200" title="سحب لنقل، Shift+سحب لدمج">⋮⋮</span>
        <input type="checkbox" checked={isMultiSelected} onClick={onToggleMulti} onChange={() => {}} className="mt-1 accent-cyan-600" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onSelect} className="w-full text-start">
            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded bg-stone-800 px-1 py-0.5 text-[9px] text-white">{toArabicDigits(index + 1)}</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: getCategorySoftColor(variant.category), color: getCategoryColor(variant.category) }}>{CATEGORY_LABELS[variant.category]}</span>
              {variant.origin === 'EDITOR' && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] text-emerald-800">محرر</span>}
              {isDerived && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] text-violet-800">قاعدة</span>}
              {variant.batchGroupId && <span className="rounded bg-cyan-100 px-1 py-0.5 text-[8px] text-cyan-800">مجموعة</span>}
              <StatusBadge status={variant.status} />
              {variant.recitationMode && variant.recitationMode !== 'ALWAYS' && <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] text-amber-800">{variant.recitationMode === 'WAQF_ONLY' ? 'وقفا فقط' : 'وصلا فقط'}</span>}
            </div>
            <p className="mt-1 truncate text-[13px] font-medium leading-relaxed text-stone-900" title={variant.title}>{variant.title}</p>
            <p className="mt-0.5 text-[10px] text-stone-500">{toArabicDigits(describeLoci(lociOfVariant(variant)))} · {toArabicDigits(drawn.length)} وجه · {variant.id.slice(0, 10)}</p>
          </button>
          {isSelected && (
            <>
              <label className="mt-2 flex items-center justify-between gap-2 rounded border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] text-cyan-950"><span>الأداء</span><select value={variant.recitationMode ?? 'ALWAYS'} onChange={(e) => onRecitationModeChange(e.target.value === 'ALWAYS' ? undefined : (e.target.value as any))} className="h-6 rounded border border-cyan-300 bg-white px-1 text-[10px]"><option value="ALWAYS">وقفا ووصلا</option><option value="WAQF_ONLY">وقفا فقط</option><option value="WASL_ONLY">وصلا فقط</option></select></label>
              <ul className="mt-2 space-y-1">
                {variant.alternatives.map((alt) => (
                  <li key={alt.id} onClick={(e) => { e.stopPropagation(); if (e.ctrlKey || e.metaKey) onToggleFace(alt.id); else onSelectAlternative(alt.id); }} className={`cursor-pointer rounded border bg-white px-2 py-1.5 transition ${selectedFaceIds.includes(alt.id) || alt.id === selectedAlternativeId ? 'border-cyan-600 ring-2 ring-cyan-200' : 'border-stone-200 hover:border-cyan-300'}`} data-face-id={alt.id}>
                    <div className="flex items-baseline justify-between gap-2"><span className="text-sm text-stone-900" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>{alt.text}</span>{alt.isBase && <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[9px] text-stone-600">أساس</span>}</div>
                    <p className="mt-0.5 text-[10px] text-stone-600">{alt.label}</p>
                    <p className="text-[10px] text-stone-500">{describeScope(alt.scope, { catalog })} ({resolveScope(alt.scope, catalog).length})</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={onEdit} className="rounded border border-stone-300 px-2 py-1 text-[10px] text-stone-700 hover:bg-stone-100">تحرير</button><button type="button" onClick={onDuplicate} className="rounded border border-stone-300 px-2 py-1 text-[10px] text-stone-700 hover:bg-stone-100">نسخ</button>{onGeneralize && <button type="button" onClick={onGeneralize} className="rounded border border-violet-300 px-2 py-1 text-[10px] text-violet-800 hover:bg-violet-50">تعميم</button>}<button type="button" onClick={onDelete} className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-700 hover:bg-red-50">حذف</button></div>
        </div>
      </div>
    </li>
  );
}

export function StatusBadge({ status }: { status: Variant['status'] }) {
  const styles: Record<Variant['status'], { label: string; className: string }> = {
    DRAFT: { label: 'مسودة', className: 'bg-stone-100 text-stone-600' },
    REVIEW: { label: 'مراجعة', className: 'bg-amber-100 text-amber-800' },
    APPROVED: { label: 'معتمد', className: 'bg-emerald-100 text-emerald-800' },
    REJECTED: { label: 'مرفوض', className: 'bg-red-100 text-red-800' },
  };
  const style = styles[status];
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${style.className}`}>{style.label}</span>;
}

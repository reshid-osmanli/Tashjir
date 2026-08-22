// أدوات الوقف والابتداء ومواضع الأسطر - Recitation Controls v2 - احترافي
'use client';

import { useMemo, useState } from 'react';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { layoutAyah } from '@/lib/tashjeer/layout-engine';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useEditorStore } from '@/stores/editor-store';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { OrderRankControl } from './OrderRankControl';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { buildReadingPlan } from '@/lib/tashjeer/reading-plan';
import { normalizeScope } from '@/lib/tashjeer/scope';
import { getNarratorSymbol } from '@/lib/tashjeer/symbols';
import { documentReadingWindow, nextAyahKeyInSurah } from '@/lib/tashjeer/reading-window';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { parseAyahKey } from '@/data/quran';
import type { VariantCategory } from '@/types';
import type { RecitationBoundaryKind } from '@/types/tashjeer';

const BOUNDARY_LABELS: Record<RecitationBoundaryKind, string> = {
  WAQF: 'وقف بعد الكلمة',
  IBTIDA: 'ابتداء من الكلمة',
  WASL: 'وصل بعد الكلمة',
  NO_WASL: 'ممنوع الوصل',
};

const WAQF_DESCRIPTIONS: Record<string, string> = {
  WAQF: 'قف هنا - ينتهي مقطع القراءة',
  IBTIDA: 'ابدأ من هنا - بداية مقطع جديد',
  WASL: 'صل بما بعده - يظهر حكم الوصل',
  NO_WASL: 'ممنوع الوصل - حاجز علمي يمنع الوصل',
};

export function RecitationControls() {
  const catalog = useTransmissionCatalog();
  const { document, selectedWordId, addBoundary, updateBoundary, deleteBoundary, setLinkNextAyah, setFocusSegment, updateVariant } = useEditorStore();
  const [kind, setKind] = useState<RecitationBoundaryKind>('WAQF');
  const [label, setLabel] = useState('');
  const [isSpecific, setIsSpecific] = useState(false);
  const [narratorIds, setNarratorIds] = useState<string[]>([]);
  const [waqfMode, setWaqfMode] = useState<'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY'>('ALWAYS');

  const words = useMemo(() => documentWindowWords(document), [document]);
  const selectedPosition = words.find((word) => word.id === selectedWordId)?.position;
  const readingWindow = useMemo(() => documentReadingWindow(document), [document]);
  const nextKey = document ? nextAyahKeyInSurah(document.ayahKey) : null;
  const focusSegment = document?.readingWindow?.focusSegment ?? null;
  const plan = useMemo(() => buildReadingPlan(words.length, document?.boundaries ?? []), [document?.boundaries, words.length]);
  const effectiveVariants = useMemo(() => (document ? getEffectiveVariants(document) : []), [document]);

  if (!document) return null;

  const add = () => {
    if (!selectedPosition) return;
    const scope = isSpecific ? normalizeScope(narratorIds, catalog) : { kind: 'ALL' as const };
    addBoundary({
      id: `boundary-${document.ayahKey}-${selectedPosition}-${Date.now().toString(36)}`,
      kind,
      position: selectedPosition,
      label: label.trim() || WAQF_DESCRIPTIONS[kind],
      scope,
      connectsToNextAyah: kind === 'WASL' && selectedPosition === words.length,
    });
    setLabel('');
    // عند وضع وقف، أظهر المقطع المحدد فقط بشكل احترافي
    if (kind === 'WAQF') {
      setFocusSegment({ startPosition: 1, endPosition: selectedPosition });
    } else if (kind === 'IBTIDA') {
      setFocusSegment({ startPosition: selectedPosition, endPosition: words.length });
    }
  };

  const toggleNarrator = (narratorId: string) => {
    setNarratorIds((cur) => (cur.includes(narratorId) ? cur.filter((id) => id !== narratorId) : [...cur, narratorId]));
  };

  // اختلافات في حالة الوقف فقط أو الوصل فقط
  const waqfOnlyVariants = effectiveVariants.filter((v) => v.recitationMode === 'WAQF_ONLY');
  const waslOnlyVariants = effectiveVariants.filter((v) => v.recitationMode === 'WASL_ONLY');

  return (
    <Section title="الوقف والابتداء - احترافي">
      <p className="mb-2 text-[11px] leading-relaxed text-stone-500">حدد الكلمة ثم سجل الوقف/الابتداء. المحرر يحدد الجزء المحدد فقط ويعطيه منفصلا، وعند الوصل يولد الاختلاف حسب الوصل. خيار ممنوع الوصل يمنع الوصل علميا.</p>

      {selectedPosition ? (
        <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/50 p-2.5">
          <p className="text-[11px] font-bold text-violet-900">الكلمة المحددة: {toArabicDigits(selectedPosition)} — <span style={{ fontFamily: "'Amiri Quran', serif" }}>{words[selectedPosition - 1]?.text}</span></p>

          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(BOUNDARY_LABELS) as RecitationBoundaryKind[]).map((option) => (
              <button key={option} type="button" onClick={() => setKind(option)} className={`rounded border px-1.5 py-1.5 text-[10px] font-medium ${kind === option ? 'border-violet-700 bg-violet-700 text-white shadow' : 'border-violet-200 bg-white text-violet-800 hover:bg-violet-100'}`} title={WAQF_DESCRIPTIONS[option]}>
                {option === 'WAQF' ? '⏸ وقف' : option === 'IBTIDA' ? '▶ ابتداء' : option === 'WASL' ? '↔ وصل' : '🚫 ممنوع'}
              </button>
            ))}
          </div>

          <div className="rounded bg-white p-1.5 text-[10px] text-violet-800">{WAQF_DESCRIPTIONS[kind]}</div>

          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="وصف: وقف كافٍ، وصل أولى..." className="input h-7 text-[11px]" />

          <div className="flex gap-1">
            <select value={waqfMode} onChange={(e) => setWaqfMode(e.target.value as any)} className="h-7 flex-1 rounded border border-stone-300 bg-white px-1 text-[10px]">
              <option value="ALWAYS">وقفا ووصلا</option>
              <option value="WAQF_ONLY">وقفا فقط - يسقط عند الوصل</option>
              <option value="WASL_ONLY">وصلا فقط - يظهر عند الوصل بآية أخرى</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-stone-700"><input type="checkbox" checked={isSpecific} onChange={(e) => setIsSpecific(e.target.checked)} className="accent-violet-700" />يخص بعض الرواة</label>

          {isSpecific && (
            <div className="flex max-h-20 flex-wrap gap-1 overflow-auto border-t border-violet-100 pt-1.5">
              {catalog.narrators.map((n) => {
                const active = narratorIds.includes(n.id);
                return <button key={n.id} type="button" onClick={() => toggleNarrator(n.id)} className={`rounded border px-1.5 py-0.5 text-[10px] ${active ? 'border-violet-700 bg-violet-700 text-white' : 'border-stone-200 bg-white text-stone-600'}`}>{n.name}</button>;
              })}
            </div>
          )}

          <button type="button" onClick={add} className="w-full rounded bg-violet-700 px-2 py-2 text-[11px] font-bold text-white shadow hover:bg-violet-800">تسجيل {BOUNDARY_LABELS[kind]} + تحديد المقطع</button>
        </div>
      ) : (
        <p className="rounded bg-stone-50 p-2 text-[11px] text-stone-500">انقر على كلمة في المحرر لتفعيل أدوات الوقف.</p>
      )}

      {document.boundaries.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {document.boundaries.map((b) => (
            <li key={b.id} className="rounded border border-stone-200 bg-white p-2">
              <div className="flex items-center gap-1.5">
                <select value={b.kind} onChange={(e) => updateBoundary(b.id, { kind: e.target.value as RecitationBoundaryKind })} className="h-6 rounded border border-stone-300 bg-white px-1 text-[10px]">
                  <option value="WAQF">⏸ وقف</option>
                  <option value="IBTIDA">▶ ابتداء</option>
                  <option value="WASL">↔ وصل</option>
                  <option value="NO_WASL">🚫 ممنوع الوصل</option>
                </select>
                <span className="text-[10px] text-stone-600">ك{toArabicDigits(b.position)}</span>
                <button type="button" onClick={() => { setFocusSegment({ startPosition: b.kind === 'IBTIDA' ? b.position : 1, endPosition: b.kind === 'WAQF' ? b.position : words.length }); }} className="rounded bg-cyan-50 px-1.5 py-0.5 text-[9px] text-cyan-800">إظهار المقطع فقط</button>
                <button type="button" onClick={() => deleteBoundary(b.id)} className="ms-auto text-[10px] text-red-700 hover:underline">حذف</button>
              </div>
              <input value={b.label ?? ''} onChange={(e) => updateBoundary(b.id, { label: e.target.value })} placeholder="وصف العلامة" className="mt-1 h-6 w-full rounded border border-stone-200 px-1.5 text-[10px]" />
              {b.kind === 'WASL' && b.position === words.length && (
                <label className="mt-1 flex items-center gap-1 text-[10px] text-sky-800"><input type="checkbox" checked={b.connectsToNextAyah ?? false} onChange={(e) => updateBoundary(b.id, { connectsToNextAyah: e.target.checked })} className="accent-sky-700" />وصل بالآية التالية</label>
              )}
              {b.kind === 'NO_WASL' && <p className="mt-1 rounded bg-red-50 px-1.5 py-0.5 text-[9px] text-red-800">يمنع الوصل بعد هذه الكلمة - لا يستطيع المستخدم الوصل</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded bg-stone-50 p-2">
        <p className="text-[10px] font-semibold text-stone-700">خطة الأداء</p>
        <p className="mt-0.5 text-[11px] text-stone-600" dir="ltr">{plan.positions.length ? plan.positions.map((p) => toArabicDigits(p)).join(' ← ') : '—'}</p>
        {plan.connectsToNextAyah && <p className="mt-1 text-[10px] text-sky-700">موصول بالآية التالية - يختلف الحكم عند الوصل</p>}
        {plan.forbiddenWaslAfter.length > 0 && <p className="mt-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-800">ممنوع الوصل بعد: {plan.forbiddenWaslAfter.map((p) => toArabicDigits(p)).join('، ')}</p>}
      </div>

      {(waqfOnlyVariants.length > 0 || waslOnlyVariants.length > 0) && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2">
          <p className="text-[10px] font-semibold text-amber-900">اختلافات مشروطة بالوقف/الوصل</p>
          {waqfOnlyVariants.length > 0 && <p className="mt-1 text-[10px] text-amber-800">وقفا فقط ({toArabicDigits(waqfOnlyVariants.length)}): {waqfOnlyVariants.map((v) => v.title).join('، ').slice(0, 80)}</p>}
          {waslOnlyVariants.length > 0 && <p className="mt-1 text-[10px] text-amber-800">وصلا فقط ({toArabicDigits(waslOnlyVariants.length)}): {waslOnlyVariants.map((v) => v.title).join('، ').slice(0, 80)}</p>}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-stone-700">تشجير مقطع وحده - يظهر النص المحدد فقط</p>
        <p className="text-[10px] leading-relaxed text-stone-500">عند اختيار موضع الوقف، يظهر فقط النص المحدد دون بقية الجزء ليظهر المحرك الرموز بشكل احترافي.</p>
        <div className="flex flex-wrap gap-1">
          {plan.segments.map((segment) => {
            const isActive = focusSegment?.startPosition === segment.startPosition && focusSegment?.endPosition === segment.endPosition;
            return <button key={`${segment.startPosition}-${segment.endPosition}`} type="button" onClick={() => setFocusSegment(isActive ? null : { startPosition: segment.startPosition, endPosition: segment.endPosition })} className={`rounded border px-1.5 py-1 text-[10px] ${isActive ? 'border-cyan-700 bg-cyan-700 text-white shadow' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}>{toArabicDigits(segment.startPosition)}–{toArabicDigits(segment.endPosition)}{segment.endsWithWaqf ? ' ⏸' : ''}</button>;
          })}
        </div>
        {selectedPosition && <button type="button" onClick={() => setFocusSegment({ startPosition: 1, endPosition: selectedPosition })} className="w-full rounded border border-cyan-200 bg-cyan-50 px-2 py-1.5 text-[10px] font-bold text-cyan-900 hover:bg-cyan-100">✂️ قص عند الكلمة المحددة وإظهار المقطع فقط (١–{toArabicDigits(selectedPosition)})</button>}
        {focusSegment && <button type="button" onClick={() => setFocusSegment(null)} className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-[10px] text-stone-700 hover:bg-stone-50">إلغاء الحصر وإظهار الآية كاملة</button>}
      </div>

      <div className="mt-3 rounded border border-sky-200 bg-sky-50/60 p-2">
        <p className="text-[10px] font-semibold text-sky-900">وصل الآيتين - احترافي</p>
        {nextKey ? (
          <>
            <label className="mt-1 flex items-center gap-1.5 text-[11px] text-sky-900"><input type="checkbox" checked={readingWindow.isLinked} disabled={plan.forbiddenWaslAfter.includes(readingWindow.firstAyahEndPosition)} onChange={(e) => setLinkNextAyah(e.target.checked)} className="accent-sky-700 disabled:cursor-not-allowed" />ضم الآية {toArabicDigits(parseAyahKey(nextKey).ayahNumber)} - عند الوصل يختلف الحكم</label>
            {plan.forbiddenWaslAfter.includes(readingWindow.firstAyahEndPosition) ? <p className="mt-1 rounded bg-red-50 px-1.5 py-1 text-[10px] text-red-800">الوصل ممنوع بعلامة عند نهاية الآية.</p> : <p className="mt-1 text-[10px] leading-relaxed text-sky-800">عند الوصل تتسلسل المواضع عبر الآيتين، فيمكن توليد اختلاف حسب الوصل، كأنك توصل وتقطع بين آيتين.</p>}
          </>
        ) : <p className="mt-1 text-[10px] text-sky-800">آخر آية في السورة.</p>}
      </div>
    </Section>
  );
}

export function TextLayoutControls() {
  const { document, selectedWordId, toggleForcedLineBreak, setLineOffset } = useEditorStore();
  const engine = useEngineSettings();
  const words = useMemo(() => documentWindowWords(document), [document]);
  const selected = words.find((word) => word.id === selectedWordId);
  const layout = useMemo(() => (document ? layoutAyah(document.ayahKey, words, document.layout) : null), [document, words]);
  if (!document) return null;
  const breaks = document.layout.forcedLineBreakAfter;
  return (
    <Section title="مواضع أسطر النص">
      {engine.singleLineText && <p className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-900">وضع السطر الواحد مفعّل - نص الآية في سطر واحد.</p>}
      {selected ? <button type="button" onClick={() => toggleForcedLineBreak(selected.position)} className={`w-full rounded border px-2 py-1.5 text-[11px] ${breaks.includes(selected.position) ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}`}>{breaks.includes(selected.position) ? 'إلغاء كسر السطر' : 'كسر السطر بعد الكلمة'}</button> : <p className="text-[11px] text-stone-500">اختر كلمة لضبط الكسر.</p>}
      {breaks.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{breaks.map((pos) => <button key={pos} type="button" onClick={() => toggleForcedLineBreak(pos)} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 hover:bg-amber-200">بعد {pos} ×</button>)}</div>}
      <div className="mt-3 space-y-2">
        <p className="text-[10px] font-medium text-stone-600">إزاحة كل سطر نصي ({layout?.lineCount ?? 1}):</p>
        {Array.from({ length: layout?.lineCount ?? 1 }, (_, lineIndex) => (
          <label key={lineIndex} className="block text-[10px] text-stone-600">السطر {lineIndex + 1}: {document.layout.lineOffsets[lineIndex] ?? 0}<input type="range" min={-80} max={80} step={2} value={document.layout.lineOffsets[lineIndex] ?? 0} onChange={(e) => setLineOffset(lineIndex, Number(e.target.value))} className="mt-1 w-full accent-emerald-600" /></label>
        ))}
      </div>
    </Section>
  );
}

export function ManualLinesControls() {
  const { document, selectedWordId, addManualLine, updateManualLine, deleteManualLine } = useEditorStore();
  const [title, setTitle] = useState('سطر إرشادي');
  const [category, setCategory] = useState<VariantCategory>('WAQF');
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const words = useMemo(() => documentWindowWords(document), [document]);
  const selected = words.find((word) => word.id === selectedWordId);
  if (!document) return null;
  const startPosition = Number(startInput) || selected?.position || 0;
  const endPosition = Number(endInput) || startPosition;
  const validRange = startPosition >= 1 && endPosition >= startPosition && endPosition <= words.length;
  const add = () => {
    if (!validRange) return;
    addManualLine({ id: `line-${document.ayahKey}-${startPosition}-${Date.now().toString(36)}`, title: title.trim() || 'سطر يدوي', category, startPosition, endPosition, lane: document.manualLines.length, label: 'يدوي' });
    setStartInput(''); setEndInput('');
  };
  return (
    <Section title="الأسطر اليدوية">
      <p className="mb-2 text-[11px] text-stone-500">سطر دلالي مستقل للشرح.</p>
      <div className="flex gap-1"><input value={title} onChange={(e) => setTitle(e.target.value)} className="input h-7 min-w-0 flex-1 text-[11px]" placeholder="عنوان" /><select value={category} onChange={(e) => setCategory(e.target.value as VariantCategory)} className="h-7 rounded border border-stone-300 bg-white px-1 text-[10px]">{(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((o) => <option key={o} value={o}>{CATEGORY_LABELS[o]}</option>)}</select></div>
      <div className="mt-1.5 grid grid-cols-2 gap-1"><label className="text-[10px] text-stone-600">من كلمة<input type="number" min={1} max={words.length} value={startInput} onChange={(e) => setStartInput(e.target.value)} placeholder={selected ? String(selected.position) : '1'} className="mt-0.5 h-6 w-full rounded border border-stone-200 px-1 text-[10px]" /></label><label className="text-[10px] text-stone-600">إلى كلمة<input type="number" min={1} max={words.length} value={endInput} onChange={(e) => setEndInput(e.target.value)} placeholder={selected ? String(selected.position) : 'نفسها'} className="mt-0.5 h-6 w-full rounded border border-stone-200 px-1 text-[10px]" /></label></div>
      <button type="button" disabled={!validRange} onClick={add} className="mt-1.5 w-full rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 disabled:opacity-40">إضافة سطر</button>
      {document.manualLines.length > 0 && <ul className="mt-2 space-y-1.5">{document.manualLines.map((line) => <li key={line.id} className="rounded border border-stone-200 p-1.5"><div className="flex items-center gap-1"><input value={line.title} onChange={(e) => updateManualLine(line.id, { title: e.target.value })} className="h-6 min-w-0 flex-1 rounded border border-stone-200 px-1.5 text-[10px]" /><select value={line.category} onChange={(e) => updateManualLine(line.id, { category: e.target.value as VariantCategory })} className="h-6 max-w-14 rounded border border-stone-200 bg-white px-1 text-[9px]">{(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((o) => <option key={o} value={o}>{CATEGORY_LABELS[o]}</option>)}</select><button type="button" onClick={() => deleteManualLine(line.id)} className="text-[10px] text-red-700 hover:underline">حذف</button></div></li>)}</ul>}
    </Section>
  );
}

export function TashjeerOrderControls() {
  const catalog = useTransmissionCatalog();
  const { document, selectedVariantId, selectVariant, setEffectiveOrderRank, moveAlternative, resetAlternativeOrder } = useEditorStore();
  const ordered = useMemo(() => {
    if (!document) return [];
    return [...getEffectiveVariants(document)].sort((first, second) => {
      const firstRank = first.orderRank;
      const secondRank = second.orderRank;
      if (typeof firstRank === 'number' && typeof secondRank === 'number' && firstRank !== secondRank) return firstRank - secondRank;
      if (typeof firstRank === 'number' && typeof secondRank !== 'number') return -1;
      if (typeof firstRank !== 'number' && typeof secondRank === 'number') return 1;
      return second.endPosition - first.endPosition || second.startPosition - first.startPosition;
    });
  }, [document]);
  if (!document) return null;
  return (
    <Section title="ترتيب التشجير">
      <p className="mb-2 text-[11px] leading-relaxed text-stone-500">ترتيب الأسطر تحت الآية من أعلى لأسفل. رتبة يدوية تسبق قاعدة المحرك.</p>
      {ordered.length === 0 ? <p className="rounded bg-stone-50 p-2 text-[11px] text-stone-500">لا مواضع.</p> : <ol className="space-y-2">{ordered.map((variant, index) => {
        const drawable = variant.alternatives.filter((a) => !a.isBase);
        const explicit = variant.alternativeOrder ?? [];
        const known = new Set(drawable.map((a) => a.id));
        const sequence = [...explicit.filter((id) => known.has(id)), ...drawable.filter((a) => !explicit.includes(a.id)).map((a) => a.id)];
        const isSelected = variant.id === selectedVariantId;
        return <li key={variant.id} className={`rounded border p-2 ${isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-200 bg-white'}`}><div className="flex items-center gap-1.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-stone-700 text-[10px] font-bold text-white">{index + 1}</span><button type="button" onClick={() => { selectVariant(isSelected ? null : variant.id); if (!isSelected) window.dispatchEvent(new CustomEvent('tashjeer:scroll-to-variant', { detail: { variantId: variant.id } })); }} className="min-w-0 flex-1 truncate text-start text-[11px] font-medium text-stone-800 hover:underline">{variant.title}</button><span className="shrink-0 text-[10px] text-stone-500">{variant.startPosition === variant.endPosition ? `ك${variant.startPosition}` : `ك${variant.startPosition}–${variant.endPosition}`}</span></div><div className="mt-1.5"><OrderRankControl value={variant.orderRank} onChange={(rank) => setEffectiveOrderRank(variant.id, rank)} compact hint={variant.isGlobalDerived ? 'تخصيص لهذا الموضع من القاعدة.' : undefined} /></div>{sequence.length > 1 && <ul className="mt-1.5 space-y-1 border-t border-stone-100 pt-1.5">{sequence.map((altId, altIdx) => { const alt = drawable.find((a) => a.id === altId); if (!alt) return null; const symbols = alt.scope ? '' : ''; return <li key={altId} className="flex items-center gap-1"><span className="w-3 shrink-0 text-[9px] text-stone-400">{altIdx + 1}</span><span className="min-w-0 flex-1 truncate text-[10px] text-stone-700">{alt.ruleLabel || alt.label || alt.text}</span><button type="button" onClick={() => moveAlternative(variant.id, altId, -1)} disabled={altIdx === 0} className="rounded border border-stone-200 px-1 text-[9px] text-stone-600 hover:bg-stone-50 disabled:opacity-30">▲</button><button type="button" onClick={() => moveAlternative(variant.id, altId, 1)} disabled={altIdx === sequence.length - 1} className="rounded border border-stone-200 px-1 text-[9px] text-stone-600 hover:bg-stone-50 disabled:opacity-30">▼</button></li>; })}{variant.alternativeOrder && <li><button type="button" onClick={() => resetAlternativeOrder(variant.id)} className="text-[10px] text-stone-500 hover:underline">إعادة لترتيب المحرك</button></li>}</ul>}</li>;
      })}</ol>}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-stone-100 px-4 py-3 last:border-b-0"><h3 className="mb-2 text-xs font-bold text-stone-800">{title}</h3>{children}</section>;
}

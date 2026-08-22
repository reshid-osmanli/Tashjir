// محرر الاختلاف - Variant Editor v2 - احترافي
'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getImamColor } from '@/lib/tashjeer/color-system';
import { describeScope, normalizeScope, resolveScope } from '@/lib/tashjeer/scope';
import { getNarratorSymbol } from '@/lib/tashjeer/symbols';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { characterCount } from '@/lib/quran-logic/characters';
import { pruneStrengthMap } from '@/lib/tashjeer/strength-degrees';
import { StrengthDegreePicker } from './StrengthDegreePicker';
import { OrderRankControl } from './OrderRankControl';
import type { VariantCategory } from '@/types';
import { resolveReaderChips } from '@/lib/tashjeer/reader-symbols';
import { boundsOfLoci, describeLoci, lociOfVariant } from '@/lib/tashjeer/loci';
import type { EvidenceSource, ReadingScope, Variant, VariantAlternative, VariantLocus, VerificationStatus } from '@/types/tashjeer';

interface VariantEditorProps {
  variant: Variant;
  onClose: () => void;
  onGeneralize?: () => void;
}

const STATUS_OPTIONS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'REVIEW', label: 'قيد المراجعة' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'REJECTED', label: 'مرفوض' },
];

const SOURCE_OPTIONS: Array<{ value: EvidenceSource; label: string }> = [
  { value: 'TAYYIBAH', label: 'طيبة النشر' },
  { value: 'NASHR', label: 'النشر' },
  { value: 'JANNAH', label: 'الجنة' },
  { value: 'OTHER', label: 'مصدر آخر' },
];

export function VariantEditor({ variant, onClose, onGeneralize }: VariantEditorProps) {
  const { updateVariant, addAlternative, updateAlternative, deleteAlternative, setEffectiveOrderRank, duplicateAlternative } = useEditorStore();
  const catalog = useTransmissionCatalog();
  const [activeAlternativeId, setActiveAlternativeId] = useState<string | null>(variant.alternatives.find((a) => !a.isBase)?.id ?? null);
  const activeAlternative = variant.alternatives.find((a) => a.id === activeAlternativeId);

  const handleAddAlternative = () => {
    const id = `${variant.id}-alt-${Date.now().toString(36)}`;
    addAlternative(variant.id, { id, text: variant.title, label: 'وجه جديد', scope: { kind: 'NARRATORS', narratorIds: [] } });
    setActiveAlternativeId(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`تحرير ${variant.title}`}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">تحرير الاختلاف - تحديد دقيق</h2>
            <p className="text-[11px] text-stone-500">المواضع: {describeLoci(lociOfVariant(variant))} · ID: {variant.id} · {variant.isIndependent ? 'مستقل' : 'عادي'} · مجموعة: {variant.batchGroupId ?? '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            {onGeneralize && variant.targetKind === 'CHARACTERS' && variant.characterRange && <button type="button" onClick={onGeneralize} className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-900 hover:bg-violet-100">تعميم على المصحف</button>}
            <button type="button" onClick={onClose} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100">إغلاق</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <section className="grid gap-3 md:grid-cols-2">
            <Field label="العنوان - Line → Segment → Difference">
              <input type="text" value={variant.title} onChange={(e) => updateVariant(variant.id, { title: e.target.value })} className="input" />
            </Field>
            <Field label="الفئة">
              <select value={variant.category} onChange={(e) => updateVariant(variant.id, { category: e.target.value as VariantCategory })} className="input">
                {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
              </select>
            </Field>
            <Field label="نوع فرعي - مد / صلة / فرش"><input type="text" value={variant.subType ?? ''} onChange={(e) => updateVariant(variant.id, { subType: e.target.value || undefined })} placeholder="تحقيق، صلة، فرش" className="input" /></Field>
            <Field label="مستقل - نفس القارئ نفس الكلمة"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={variant.isIndependent ?? true} onChange={(e) => updateVariant(variant.id, { isIndependent: e.target.checked })} className="accent-emerald-600" />نعم - لا يدمج تلقائيا</label></Field>
            <Field label="من الكلمة"><input type="number" min={1} value={variant.startPosition} onChange={(e) => { const s = Math.max(1, Number(e.target.value)); updateVariant(variant.id, { startPosition: s, endPosition: Math.max(s, variant.endPosition) }); }} className="input" /></Field>
            <Field label="إلى الكلمة"><input type="number" min={variant.startPosition} value={variant.endPosition} onChange={(e) => updateVariant(variant.id, { endPosition: Math.max(variant.startPosition, Number(e.target.value)) })} className="input" /></Field>

            <div className="md:col-span-2"><OrderRankControl value={variant.orderRank} onChange={(rank) => setEffectiveOrderRank(variant.id, rank)} hint="رتبة الموضع في ترتيب المرور. الأصغر يعلو." /></div>

            <Field label="سياق الأداء - وقفا فقط / وصلا فقط">
              <select value={variant.recitationMode ?? 'ALWAYS'} onChange={(e) => updateVariant(variant.id, { recitationMode: e.target.value === 'ALWAYS' ? undefined : (e.target.value as any), waqfContext: e.target.value === 'ALWAYS' ? undefined : { mode: e.target.value as any } } as any)} className="input">
                <option value="ALWAYS">وقفا ووصلا - دائما</option>
                <option value="WAQF_ONLY">وقفا فقط - يسقط عند الوصل بآية أخرى</option>
                <option value="WASL_ONLY">وصلا فقط - يظهر عند الوصل</option>
              </select>
            </Field>

            <Field label="منع الوصل"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={variant.waqfContext?.forbidsWasl ?? false} onChange={(e) => updateVariant(variant.id, { waqfContext: { mode: variant.recitationMode ?? 'ALWAYS', forbidsWasl: e.target.checked, requiresWaqf: variant.waqfContext?.requiresWaqf, note: variant.waqfContext?.note } } as any)} className="accent-red-600" />ممنوع الوصل بعد هذا الموضع</label></Field>

            <Field label="الحالة"><select value={variant.status} onChange={(e) => updateVariant(variant.id, { status: e.target.value as VerificationStatus })} className="input">{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            <Field label="مرجع"><input type="text" value={variant.sourceRef ?? ''} onChange={(e) => updateVariant(variant.id, { sourceRef: e.target.value })} placeholder="النشر - فرش" className="input" /></Field>
            <Field label="المصدر والنتيجة - Engine + Editor + Final" className="md:col-span-2">
              <div className="rounded border border-stone-200 bg-stone-50 p-2 text-[11px]">
                <div className="grid grid-cols-3 gap-2"><span>Engine: {variant.engineSnapshot?.title ?? variant.correction?.engine ?? '—'}</span><span>Editor: {variant.correction?.editor ?? variant.title}</span><span>Final: {variant.correction?.final ?? variant.title}</span></div>
                <div className="mt-1 text-[10px] text-stone-500">المصدر: {variant.source ?? variant.origin ?? '—'} · عُدل بواسطة: {variant.modifiedBy ?? '—'} · {variant.editorModifiedAt ? `آخر تعديل ${variant.editorModifiedAt}` : 'لم يعدل'}</div>
              </div>
            </Field>
            <Field label="الشرح" className="md:col-span-2"><textarea value={variant.description ?? ''} onChange={(e) => updateVariant(variant.id, { description: e.target.value })} rows={2} className="input resize-y" placeholder="شرح" /></Field>
          </section>

          <TargetEditor variant={variant} onUpdate={(patch) => updateVariant(variant.id, patch)} />
          <LociEditor variant={variant} onUpdate={(patch) => updateVariant(variant.id, patch)} />

          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-stone-900">الأوجه - تحديد دقيق للاختلاف</h3><button type="button" onClick={handleAddAlternative} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">+ إضافة وجه</button></div>
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <ul className="space-y-1.5">
                {variant.alternatives.map((alt) => {
                  const count = resolveScope(alt.scope, catalog).length;
                  const active = alt.id === activeAlternativeId;
                  return <li key={alt.id}><button type="button" onClick={() => setActiveAlternativeId(alt.id)} className={`w-full rounded-md border px-2.5 py-2 text-start transition-colors ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-stone-200 bg-white hover:bg-stone-50'}`}><span className="block text-sm text-stone-900" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>{alt.text || '—'}</span><span className="mt-0.5 block text-[11px] text-stone-600">{alt.label}</span><span className="block text-[10px] text-stone-500">{alt.isBase ? 'وجه المصحف · ' : ''}{count} راويا · ID:{alt.id.slice(0, 8)}</span></button></li>;
                })}
              </ul>
              {activeAlternative ? <AlternativeEditor variantId={variant.id} alternative={activeAlternative} onUpdate={(patch) => updateAlternative(variant.id, activeAlternative.id, patch)} onDelete={() => { deleteAlternative(variant.id, activeAlternative.id); setActiveAlternativeId(null); }} onDuplicate={() => duplicateAlternative(variant.id, activeAlternative.id)} /> : <p className="rounded-md border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">اختر وجها.</p>}
            </div>
          </section>
        </div>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar{width:8px}.custom-scrollbar::-webkit-scrollbar-thumb{background:#d6d3d1;border-radius:4px}`}</style>
    </div>
  );
}

function TargetEditor({ variant, onUpdate }: { variant: Variant; onUpdate: (patch: Partial<Variant>) => void }) {
  const editorDocument = useEditorStore((state) => state.document);
  const words = useMemo(() => documentWindowWords(editorDocument ?? { ayahKey: variant.ayahKey }), [editorDocument, variant.ayahKey]);
  const isCharacters = variant.targetKind === 'CHARACTERS';
  const range = variant.characterRange;
  const startWord = words.find((w) => w.position === (range?.start.position ?? variant.startPosition));
  const endWord = words.find((w) => w.position === (range?.end.position ?? variant.endPosition));

  const setCharacterRange = (patch: { startPosition?: number; startIndex?: number; endPosition?: number; endIndex?: number }) => {
    const startPosition = patch.startPosition ?? range?.start.position ?? variant.startPosition;
    const endPosition = patch.endPosition ?? range?.end.position ?? variant.endPosition;
    const startText = words.find((w) => w.position === startPosition)?.text ?? '';
    const endText = words.find((w) => w.position === endPosition)?.text ?? '';
    const startIndex = Math.min(Math.max(1, patch.startIndex ?? range?.start.characterIndex ?? 1), Math.max(characterCount(startText), 1));
    const endIndex = Math.min(Math.max(1, patch.endIndex ?? range?.end.characterIndex ?? 1), Math.max(characterCount(endText), 1));
    const start = { position: Math.min(startPosition, endPosition), characterIndex: startIndex };
    const end = { position: Math.max(startPosition, endPosition), characterIndex: endIndex };
    if (start.position === end.position && start.characterIndex > end.characterIndex) end.characterIndex = start.characterIndex;
    onUpdate({ targetKind: 'CHARACTERS', startPosition: start.position, endPosition: end.position, characterRange: { start, end } });
  };

  return (
    <section className="mt-4 rounded-md border border-cyan-200 bg-cyan-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-xs font-bold text-cyan-950">دقة الموضع - Line → Segment → Difference</h3><p className="mt-0.5 text-[11px] text-cyan-900/75">تحديد دقيق لكل اختلاف/جزء/قاعدة بعنصر مستقل.</p></div>
        <div className="flex rounded-md border border-cyan-200 bg-white p-0.5 text-[11px]">
          <button type="button" onClick={() => onUpdate({ targetKind: 'WORDS', characterRange: undefined })} className={`rounded px-2 py-1 ${!isCharacters ? 'bg-cyan-700 text-white' : 'text-stone-600 hover:bg-cyan-50'}`}>كلمات</button>
          <button type="button" onClick={() => setCharacterRange({})} className={`rounded px-2 py-1 ${isCharacters ? 'bg-cyan-700 text-white' : 'text-stone-600 hover:bg-cyan-50'}`}>حروف</button>
        </div>
      </div>
      {isCharacters && range && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label={`بداية ${startWord ? `«${startWord.text}»` : ''}`}><div className="grid grid-cols-2 gap-2"><input type="number" min={1} max={words.length} value={range.start.position} onChange={(e) => setCharacterRange({ startPosition: Number(e.target.value) })} className="input" /><input type="number" min={1} max={characterCount(startWord?.text ?? '') || 1} value={range.start.characterIndex} onChange={(e) => setCharacterRange({ startIndex: Number(e.target.value) })} className="input" /></div></Field>
          <Field label={`نهاية ${endWord ? `«${endWord.text}»` : ''}`}><div className="grid grid-cols-2 gap-2"><input type="number" min={1} max={words.length} value={range.end.position} onChange={(e) => setCharacterRange({ endPosition: Number(e.target.value) })} className="input" /><input type="number" min={1} max={characterCount(endWord?.text ?? '') || 1} value={range.end.characterIndex} onChange={(e) => setCharacterRange({ endIndex: Number(e.target.value) })} className="input" /></div></Field>
        </div>
      )}
    </section>
  );
}

function LociEditor({ variant, onUpdate }: { variant: Variant; onUpdate: (patch: Partial<Variant>) => void }) {
  const loci = lociOfVariant(variant);
  const commit = (next: VariantLocus[]) => {
    const bounds = boundsOfLoci(next);
    onUpdate({ loci: next.length > 1 ? next : next.length === 1 ? undefined : [], startPosition: bounds.startPosition, endPosition: bounds.endPosition, characterRange: next.length === 1 ? next[0].characterRange : variant.characterRange, targetKind: next.some((l) => l.characterRange) ? 'CHARACTERS' : variant.targetKind });
  };
  const splitIntoWords = () => {
    const positions: VariantLocus[] = [];
    for (const locus of loci) for (let pos = locus.startPosition; pos <= locus.endPosition; pos++) positions.push({ startPosition: pos, endPosition: pos });
    commit(positions);
  };
  return (
    <section className="mt-4 rounded-md border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xs font-bold text-amber-950">مواضع منفصلة</h3><p className="mt-0.5 text-[11px] text-amber-900/75">كل موضع علامة مستقلة.</p></div><div className="flex gap-1"><button type="button" onClick={splitIntoWords} className="rounded border border-amber-300 bg-white px-2 py-1 text-[10px] text-amber-900 hover:bg-amber-100">فصل الكلمات</button><button type="button" onClick={() => commit([...loci, { startPosition: variant.endPosition, endPosition: variant.endPosition }])} className="rounded border border-amber-300 bg-white px-2 py-1 text-[10px] text-amber-900 hover:bg-amber-100">+ موضع</button></div></div>
      <ul className="mt-2 space-y-1.5">{loci.map((locus, index) => <li key={`${locus.startPosition}-${locus.endPosition}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-1.5"><label className="text-[10px] text-stone-600">من<input type="number" min={1} value={locus.startPosition} onChange={(e) => { const s = Math.max(1, Number(e.target.value)); commit(loci.map((it, i) => (i === index ? { ...it, startPosition: s, endPosition: Math.max(s, it.endPosition) } : it))); }} className="input mt-0.5 h-7 text-xs" /></label><label className="text-[10px] text-stone-600">إلى<input type="number" min={locus.startPosition} value={locus.endPosition} onChange={(e) => { const en = Math.max(locus.startPosition, Number(e.target.value)); commit(loci.map((it, i) => (i === index ? { ...it, endPosition: en } : it))); }} className="input mt-0.5 h-7 text-xs" /></label><button type="button" disabled={loci.length <= 1} onClick={() => commit(loci.filter((_, i) => i !== index))} className="self-end rounded border border-red-200 px-2 py-1 text-[10px] text-red-700 disabled:opacity-30">حذف</button></li>)}</ul>
    </section>
  );
}

function AlternativeEditor({ alternative, onUpdate, onDelete, onDuplicate }: { variantId: string; alternative: VariantAlternative; onUpdate: (patch: Partial<VariantAlternative>) => void; onDelete: () => void; onDuplicate: () => void }) {
  const catalog = useTransmissionCatalog();
  return (
    <div className="space-y-4 rounded-md border border-stone-200 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="نص الوجه"><input type="text" value={alternative.text} onChange={(e) => onUpdate({ text: e.target.value })} className="input" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif", fontSize: '1.05rem' }} /></Field>
        <Field label="وصف"><input type="text" value={alternative.label} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="بالألف، بالتسهيل" className="input" /></Field>
      </div>
      <div className="grid gap-3 rounded-md border border-emerald-100 bg-emerald-50/40 p-3 md:grid-cols-3">
        <Field label="اسم الحكم"><input type="text" value={alternative.ruleLabel ?? ''} onChange={(e) => onUpdate({ ruleLabel: e.target.value || undefined })} placeholder="إمالة، سكت" className="input" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }} /></Field>
        <Field label="حركات المد"><input type="number" min={0} max={6} value={alternative.maddHarakat ?? ''} onChange={(e) => onUpdate({ maddHarakat: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="٤" className="input" /></Field>
        <div className="md:col-span-3"><StrengthDegreePicker scope={alternative.scope} degreeId={alternative.strengthDegreeId} byNarrator={alternative.strengthByNarrator} onChange={(next) => onUpdate({ strengthDegreeId: next.degreeId, strengthByNarrator: next.byNarrator })} hint="الدرجة الأعلى تأخذ السطر الأعلى." /></div>
      </div>
      <label className="flex items-center gap-2 text-xs text-stone-700"><input type="checkbox" checked={alternative.isBase ?? false} onChange={(e) => onUpdate({ isBase: e.target.checked })} className="h-3.5 w-3.5 accent-emerald-600" />وجه المصحف المطبوع - لا يُرسم له خط</label>
      <ScopePicker scope={alternative.scope} onChange={(scope) => onUpdate({ scope, strengthByNarrator: pruneStrengthMap(alternative.strengthByNarrator, resolveScope(scope, catalog)) })} />
      <Field label="ملاحظات"><textarea value={alternative.notes ?? ''} onChange={(e) => onUpdate({ notes: e.target.value })} rows={2} className="input resize-y" placeholder="ملاحظة" /></Field>
      <EvidenceList evidences={alternative.evidences ?? []} onChange={(evidences) => onUpdate({ evidences })} />
      <div className="flex gap-2">
        <button type="button" onClick={onDuplicate} className="rounded border border-stone-300 px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50">نسخ هذا الوجه</button>
        {!alternative.isBase && <button type="button" onClick={onDelete} className="rounded border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50">حذف الوجه</button>}
      </div>
    </div>
  );
}

export function ScopePicker({ scope, onChange }: { scope: ReadingScope; onChange: (scope: ReadingScope) => void }) {
  const catalog = useTransmissionCatalog();
  const [pickerMode, setPickerMode] = useState<'narrators' | 'paths'>(scope.kind === 'PATHS' ? 'paths' : 'narrators');
  const selected = useMemo(() => new Set(resolveScope(scope, catalog)), [scope, catalog]);
  const selectedPathIds = useMemo(() => (scope.kind === 'PATHS' ? new Set(scope.pathIds ?? []) : new Set<string>()), [scope]);
  const toggleNarrator = (narratorId: string) => {
    const next = new Set(selected);
    if (next.has(narratorId)) next.delete(narratorId); else next.add(narratorId);
    onChange(normalizeScope([...next], catalog));
  };
  const toggleImam = (imamId: string) => {
    const imamNarrators = catalog.narrators.filter((n) => n.imamId === imamId);
    const allSelected = imamNarrators.every((n) => selected.has(n.id));
    const next = new Set(selected);
    for (const n of imamNarrators) { if (allSelected) next.delete(n.id); else next.add(n.id); }
    onChange(normalizeScope([...next], catalog));
  };
  const togglePath = (pathId: string) => {
    const nextPaths = new Set(selectedPathIds);
    if (nextPaths.has(pathId)) nextPaths.delete(pathId); else nextPaths.add(pathId);
    if (nextPaths.size > 0) onChange({ kind: 'PATHS', pathIds: [...nextPaths] }); else onChange({ kind: 'NARRATORS', narratorIds: [] });
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2"><span className="text-xs font-semibold text-stone-700">طريقة التحديد - ترتيب صريح</span><div className="flex gap-1"><button type="button" onClick={() => { setPickerMode('narrators'); if (scope.kind === 'PATHS') onChange({ kind: 'NARRATORS', narratorIds: resolveScope(scope, catalog) }); }} className={`rounded px-2.5 py-1 text-[11px] font-semibold ${pickerMode === 'narrators' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>القراء والرواة</button><button type="button" onClick={() => { setPickerMode('paths'); if (scope.kind !== 'PATHS') { const narratorIds = resolveScope(scope, catalog); const pathIds = catalog.paths.filter((p) => narratorIds.includes(p.narratorId)).map((p) => p.id); onChange({ kind: 'PATHS', pathIds }); } }} className={`rounded px-2.5 py-1 text-[11px] font-semibold ${pickerMode === 'paths' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>الطرق</button></div></div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-stone-500">{pickerMode === 'narrators' ? 'اختر الأئمة أو الرواة (حسب order):' : 'اختر الطرق:'}</span><div className="flex gap-1.5"><button type="button" onClick={() => { if (pickerMode === 'paths') onChange({ kind: 'PATHS', pathIds: catalog.paths.map((p) => p.id) }); else onChange({ kind: 'ALL' }); }} className="rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100">الجميع</button><button type="button" onClick={() => { if (pickerMode === 'paths') onChange({ kind: 'PATHS', pathIds: [] }); else onChange({ kind: 'NARRATORS', narratorIds: [] }); }} className="rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100">تفريغ</button></div></div>
      {pickerMode === 'narrators' ? (
        <div className="grid grid-cols-2 gap-1.5 rounded-md border border-stone-200 p-2 md:grid-cols-5">
          {catalog.imams.slice().sort((a, b) => a.order - b.order).map((imam) => {
            const imamNarrators = catalog.narrators.filter((n) => n.imamId === imam.id).sort((a, b) => a.order - b.order);
            const allSelected = imamNarrators.every((n) => selected.has(n.id));
            const color = getImamColor(imam.id);
            return <div key={imam.id} className="space-y-1"><button type="button" onClick={() => toggleImam(imam.id)} className={`w-full rounded px-1.5 py-1 text-[11px] font-medium ${allSelected ? 'text-white' : 'text-stone-700 hover:bg-stone-100'}`} style={{ backgroundColor: allSelected ? color : '#f5f5f4' }}>{imam.name}{imam.symbol ? ` (${imam.symbol})` : ''}</button>{imamNarrators.map((narrator) => { const isSelected = selected.has(narrator.id); const symbol = getNarratorSymbol(narrator.id, catalog); return <button key={narrator.id} type="button" onClick={() => toggleNarrator(narrator.id)} className={`flex w-full items-center justify-between gap-1 rounded border px-1.5 py-1 text-[11px] ${isSelected ? 'border-transparent text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`} style={{ backgroundColor: isSelected ? color : undefined }}><span>{narrator.name}</span>{symbol && <span style={{ fontFamily: "'Amiri Quran', serif" }}>{symbol}</span>}</button>; })}</div>;
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 rounded-md border border-stone-200 p-2 md:grid-cols-5">
          {catalog.imams.slice().sort((a, b) => a.order - b.order).map((imam) => {
            const imamNarrators = catalog.narrators.filter((n) => n.imamId === imam.id).sort((a, b) => a.order - b.order);
            const color = getImamColor(imam.id);
            return <div key={imam.id} className="space-y-2 rounded border border-stone-100 bg-stone-50/50 p-1.5"><div className="rounded px-1.5 py-0.5 text-center text-[11px] font-bold text-white" style={{ backgroundColor: color }}>{imam.name}</div>{imamNarrators.map((narrator) => { const paths = catalog.paths.filter((p) => p.narratorId === narrator.id).sort((a, b) => a.order - b.order); return <div key={narrator.id} className="space-y-1"><div className="border-b border-stone-200 px-1 pb-0.5 text-[10px] font-bold text-stone-700">{narrator.name}</div><div className="space-y-0.5">{paths.map((path) => { const isPathSelected = selectedPathIds.has(path.id); const clean = path.shortName.split(' / ')[1] || path.shortName; return <button key={path.id} type="button" onClick={() => togglePath(path.id)} className={`w-full rounded px-1 py-0.5 text-start text-[9px] font-medium ${isPathSelected ? 'text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`} style={{ backgroundColor: isPathSelected ? color : undefined }} title={path.fullName}>{clean}</button>; })}</div></div>; })}</div>;
          })}
        </div>
      )}
      <ScopeSelectionSummary scope={scope} />
      <p className="mt-1.5 text-[11px] text-stone-600">النطاق: <span className="font-medium text-stone-800">{describeScope(scope, { catalog })}</span> ({pickerMode === 'paths' ? selectedPathIds.size : selected.size})</p>
    </div>
  );
}

function ScopeSelectionSummary({ scope }: { scope: ReadingScope }) {
  const catalog = useTransmissionCatalog();
  const chips = resolveReaderChips(scope, catalog);
  if (chips.length === 0) return <p className="mt-2 rounded border border-dashed border-stone-200 px-2 py-1.5 text-[11px] text-stone-500">لم يُختر قارئ بعد.</p>;
  return <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50/50 px-2 py-1.5"><span className="text-[10px] font-semibold text-emerald-900">سيظهر:</span>{chips.map((chip) => { const text = chip.kind === 'PATH' ? chip.name : chip.kind === 'IMAM' ? chip.symbol || chip.name : chip.name; return <span key={`${chip.kind}-${chip.id}`} className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-bold text-emerald-900" style={{ fontFamily: "'Amiri Quran', serif" }}><span className="text-[9px] font-medium text-stone-500">{chip.kind === 'IMAM' ? 'إمام' : chip.kind === 'PATH' ? 'طريق' : 'راوٍ'}</span>{text}</span>; })}</div>;
}

function EvidenceList({ evidences, onChange }: { evidences: NonNullable<VariantAlternative['evidences']>; onChange: (evidences: NonNullable<VariantAlternative['evidences']>) => void }) {
  const addEvidence = () => onChange([...evidences, { id: `ev-${Date.now().toString(36)}`, source: 'NASHR', text: '', reference: '' }]);
  return (
    <div><div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-semibold text-stone-700">الأدلة</span><button type="button" onClick={addEvidence} className="rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100">إضافة دليل</button></div>{evidences.length === 0 ? <p className="rounded border border-dashed border-stone-300 px-2.5 py-2 text-[11px] text-stone-500">لا يوجد دليل.</p> : <ul className="space-y-2">{evidences.map((ev, index) => <li key={ev.id} className="rounded border border-stone-200 p-2"><div className="grid gap-2 md:grid-cols-[130px_1fr_auto]"><select value={ev.source} onChange={(e) => onChange(evidences.map((it, i) => (i === index ? { ...it, source: e.target.value as EvidenceSource } : it)))} className="input text-xs">{SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><input type="text" value={ev.reference ?? ''} onChange={(e) => onChange(evidences.map((it, i) => (i === index ? { ...it, reference: e.target.value } : it)))} placeholder="المرجع" className="input text-xs" /><button type="button" onClick={() => onChange(evidences.filter((_, i) => i !== index))} className="rounded border border-red-200 px-2 text-[11px] text-red-700 hover:bg-red-50">حذف</button></div><textarea value={ev.text} onChange={(e) => onChange(evidences.map((it, i) => (i === index ? { ...it, text: e.target.value } : it)))} rows={2} placeholder="نص الدليل" className="input mt-2 resize-y text-xs" /></li>)}</ul>}</div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-xs font-medium text-stone-700">{label}</span>{children}</label>;
}

// لوحة العلاقات والأجزاء والترتيب - Relations Panel v2 - بيئة احترافية
'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor } from '@/lib/tashjeer/color-system';
import { shiftLineInOrder, orderSnapshotOf, coalesceLineOrder } from '@/lib/tashjeer/manual-links';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { VariantCategory } from '@/types';
import type { LinkEndpoint, LineSegment, TashjeerLink, TashjeerLinkKind, TashjeerLinkRelation } from '@/types/tashjeer';
import type { ClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';

type LinkTab = 'FACE' | 'LINE' | 'SEGMENT' | 'ORDER';

const TABS: Array<{ id: LinkTab; label: string; hint: string }> = [
  { id: 'FACE', label: 'وجه ↔ وجه', hint: 'الأوجه المركبة: هذا الوجه متفق مع وجه آخر، أيا كان قارئه. النقر ينتقل للمحرر فورا.' },
  { id: 'LINE', label: 'سطر ↔ سطر', hint: 'دمج سطرين: اسحب Line 10 إلى Line 20، تأكيد، ثم يعاد حساب الترتيب.' },
  { id: 'SEGMENT', label: 'جزء → قاعدة', hint: 'جزء محدد من الآية يُربط بسطر أو قاعدة.' },
  { id: 'ORDER', label: 'ترتيب الأسطر', hint: 'سحب لإعادة الترتيب، تأكيد، ثم تحدث الأرقام والـJSON.' },
];

export function RelationsPanel() {
  const document = useEditorStore((state) => state.document);
  const filter = useEditorStore((state) => state.filter);
  const catalog = useTransmissionCatalog();
  const engine = useEngineSettings();
  const strengthDegrees = useStrengthDegrees();
  const { classic } = useAyahTashjeer(document, filter, {}, { catalog, engine, strengthDegrees });
  const [tab, setTab] = useState<LinkTab>('FACE');

  if (!document) return null;

  return (
    <section className="border-b border-stone-200 px-4 py-3">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-stone-900">العلاقات والتحكم اليدوي<span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">تصحيح المحرك</span></h3>
      <div className="mb-2 flex flex-wrap gap-1">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-md border px-2 py-1 text-[10.5px] transition-colors ${tab === item.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}>{item.label}</button>
        ))}
      </div>
      <p className="mb-2 text-[10px] leading-relaxed text-stone-500">{TABS.find((i) => i.id === tab)?.hint}</p>
      {tab === 'FACE' && <FaceLinkEditor classic={classic} />}
      {tab === 'LINE' && <LineLinkEditor classic={classic} />}
      {tab === 'SEGMENT' && <SegmentEditor classic={classic} />}
      {tab === 'ORDER' && <LineOrderEditor classic={classic} />}
      <LinksList links={document.links ?? []} segments={document.segments ?? []} classic={classic} />
    </section>
  );
}

function FaceLinkEditor({ classic }: { classic: ClassicTashjeer }) {
  const document = useEditorStore((state) => state.document);
  const addLink = useEditorStore((state) => state.addLink);
  const selectVariant = useEditorStore((state) => state.selectVariant);
  const variants = useMemo(() => (document ? getEffectiveVariants(document) : []), [document]);

  const faces = useMemo(
    () =>
      variants.flatMap((variant) =>
        variant.alternatives.filter((a) => !a.isBase).map((alt) => ({ key: `${variant.id}::${alt.id}`, variantId: variant.id, alternativeId: alt.id, label: `${variant.title} — ${alt.label}`, category: variant.category, position: variant.startPosition }))
      ),
    [variants]
  );

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (faces.length < 2) return <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-[11px] text-stone-600">يلزم وجهان على الأقل.</p>;

  const submit = () => {
    if (!from || !to || from === to) { setError('اختر وجهين مختلفين.'); return; }
    addLink({ kind: 'FACE_TO_FACE', relation, from: { type: 'FACE', id: from }, to: { type: 'FACE', id: to }, notes });
    setTo(''); setNotes(''); setError('');
  };

  return (
    <div className="space-y-2 rounded-md border border-stone-200 p-2.5">
      <FaceSelect faces={faces} value={from} onChange={(v) => { setFrom(v); const f = faces.find((x) => x.key === v); if (f) { selectVariant(f.variantId); window.dispatchEvent(new CustomEvent('tashjeer:scroll-to-variant', { detail: { variantId: f.variantId } })); } }} label="الوجه الأساسي - ينتقل للمحرر" />
      <FaceSelect faces={faces} value={to} onChange={setTo} label="الوجه المرتبط" />
      <RelationSelect value={relation} onChange={setRelation} />
      <NotesInput value={notes} onChange={setNotes} placeholder="هذان الوجهان يقرآن معا." />
      {error && <p className="text-[10px] text-rose-700">{error}</p>}
      <button type="button" onClick={submit} className="w-full rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700">{relation === 'MERGE' ? 'إنشاء الوجه المركب' : 'تسجيل العلاقة'}</button>
      <p className="text-[10px] leading-relaxed text-stone-500">القرار قرار المحقق، حتى لو اختلف القارئ. {classic.appliedLinkIds.merge.length > 0 && 'روابط مفعّلة ظاهرة الآن.'}</p>
    </div>
  );
}

function FaceSelect({ faces, value, onChange, label }: { faces: Array<{ key: string; label: string; category: VariantCategory; position?: number }>; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium text-stone-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input h-8 py-0 text-[11px]">
        <option value="">— اختر وجها —</option>
        {faces.map((face) => <option key={face.key} value={face.key}>[{CATEGORY_LABELS[face.category]}] {face.label} {face.position ? `(ك${face.position})` : ''}</option>)}
      </select>
    </label>
  );
}

function LineLinkEditor({ classic }: { classic: ClassicTashjeer }) {
  const addLink = useEditorStore((state) => state.addLink);
  const selectLine = useEditorStore((state) => state.selectLine);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (classic.lines.length < 2) return <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-[11px] text-stone-600">لا أسطر كافية.</p>;

  const submit = () => {
    if (!from || !to || from === to) { setError('اختر سطرين مختلفين.'); return; }
    if (!confirm(`هل تريد ${relation === 'MERGE' ? 'دمج' : 'ربط'} السطرين؟`)) return;
    addLink({ kind: 'LINE_TO_LINE', relation, from: { type: 'LINE', id: from }, to: { type: 'LINE', id: to }, notes });
    setFrom(''); setTo(''); setNotes(''); setError('');
  };

  return (
    <div className="space-y-2 rounded-md border border-stone-200 p-2.5">
      <LineSelect lines={classic.lines} value={from} onChange={(v) => { setFrom(v); const line = classic.lines.find((l) => l.id === v); if (line) selectLine(line.id, line.variantId, line.startPosition); }} label="السطر الأول - ينتقل للمحرر" />
      <LineSelect lines={classic.lines} value={to} onChange={setTo} label="السطر المدمج به" />
      <RelationSelect value={relation} onChange={setRelation} />
      <NotesInput value={notes} onChange={setNotes} placeholder="مثال: Line 10 مرتبط بـ Line 25" />
      {error && <p className="text-[10px] text-rose-700">{error}</p>}
      <button type="button" onClick={submit} className="w-full rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700">{relation === 'MERGE' ? 'دمج السطرين (مع تأكيد)' : 'تسجيل العلاقة'}</button>
    </div>
  );
}

function LineSelect({ lines, value, onChange, label }: { lines: ClassicTashjeer['lines']; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium text-stone-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input h-8 py-0 text-[11px]">
        <option value="">— اختر سطرا —</option>
        {lines.map((line, index) => <option key={line.id} value={line.id}>{toArabicDigits(index + 1)}. {line.label} · {line.ruleLabel.slice(0, 40)}</option>)}
      </select>
    </label>
  );
}

function SegmentEditor({ classic }: { classic: ClassicTashjeer }) {
  const document = useEditorStore((state) => state.document);
  const markedPositions = useEditorStore((state) => state.markedPositions);
  const markedCharacters = useEditorStore((state) => state.markedCharacters);
  const addSegment = useEditorStore((state) => state.addSegment);
  const addLink = useEditorStore((state) => state.addLink);
  const variants = useMemo(() => (document ? getEffectiveVariants(document) : []), [document]);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [targetType, setTargetType] = useState<'LINE' | 'RULE'>('LINE');
  const [targetId, setTargetId] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');

  const effectiveStart = start || (markedPositions.length ? String(Math.min(...markedPositions)) : '');
  const effectiveEnd = end || (markedPositions.length ? String(Math.max(...markedPositions)) : '');

  const create = () => {
    const startPosition = Number(effectiveStart);
    const endPosition = Number(effectiveEnd);
    if (!title.trim() || !Number.isFinite(startPosition) || !Number.isFinite(endPosition)) { setError('اكتب العنوان والمدى.'); return; }
    if (endPosition < startPosition || startPosition < 1) { setError('مدى غير صالح.'); return; }
    const characterRange = markedCharacters.length >= 2 ? { start: { position: Math.min(...markedCharacters.map((a) => a.position)), characterIndex: Math.min(...markedCharacters.map((a) => a.characterIndex)) }, end: { position: Math.max(...markedCharacters.map((a) => a.position)), characterIndex: Math.max(...markedCharacters.map((a) => a.characterIndex)) } } : undefined;
    const segment = addSegment({ title, startPosition, endPosition, characterRange, notes });
    if (!segment) return;
    if (targetId) {
      if (!confirm(`هل تريد ربط الجزء «${title}»؟`)) { setTitle(''); setNotes(''); setError(''); return; }
      addLink({ kind: targetType === 'LINE' ? 'SEGMENT_TO_LINE' : 'SEGMENT_TO_RULE', relation, from: { type: 'SEGMENT', id: segment.id }, to: targetType === 'LINE' ? { type: 'LINE', id: targetId } : { type: 'RULE', id: targetId }, notes });
    }
    setTitle(''); setNotes(''); setError('');
  };

  return (
    <div className="space-y-2 rounded-md border border-stone-200 p-2.5">
      <label className="block"><span className="mb-0.5 block text-[10px] font-medium text-stone-600">عنوان الجزء</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="input h-8 py-0 text-[11px]" placeholder="مثال: صلة الهاء" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="mb-0.5 block text-[10px] font-medium text-stone-600">من كلمة</span><input type="number" min={1} value={effectiveStart} onChange={(e) => setStart(e.target.value)} className="input h-8 py-0 text-[11px]" placeholder={markedPositions.length ? toArabicDigits(Math.min(...markedPositions)) : '١'} /></label>
        <label className="block"><span className="mb-0.5 block text-[10px] font-medium text-stone-600">إلى كلمة</span><input type="number" min={1} value={effectiveEnd} onChange={(e) => setEnd(e.target.value)} className="input h-8 py-0 text-[11px]" placeholder={markedPositions.length ? toArabicDigits(Math.max(...markedPositions)) : '١'} /></label>
      </div>
      {markedCharacters.length >= 2 && <p className="rounded bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">مدى حرفي معلّم</p>}
      {markedPositions.length > 0 && markedCharacters.length < 2 && <p className="rounded bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">كلمات معلّمة: {markedPositions.map((p) => toArabicDigits(p)).join('، ')}</p>}
      <div className="rounded border border-stone-200 p-2">
        <p className="mb-1 text-[10px] font-semibold text-stone-700">ربط الجزء</p>
        <div className="mb-1.5 flex gap-1">
          <button type="button" onClick={() => setTargetType('LINE')} className={`flex-1 rounded border px-2 py-1 text-[10px] ${targetType === 'LINE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600'}`}>بسطر آخر</button>
          <button type="button" onClick={() => setTargetType('RULE')} className={`flex-1 rounded border px-2 py-1 text-[10px] ${targetType === 'RULE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600'}`}>بقاعدة</button>
        </div>
        {targetType === 'LINE' ? <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="input h-8 py-0 text-[11px]"><option value="">— بلا رابط —</option>{classic.lines.map((line, index) => <option key={line.id} value={line.id}>{toArabicDigits(index + 1)}. {line.label}</option>)}</select> : <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="input h-8 py-0 text-[11px]"><option value="">— بلا رابط —</option>{variants.map((v) => <option key={v.id} value={v.id}>[{CATEGORY_LABELS[v.category]}] {v.title}</option>)}</select>}
        {targetId && <div className="mt-1.5"><RelationSelect value={relation} onChange={setRelation} compact /></div>}
      </div>
      <NotesInput value={notes} onChange={setNotes} placeholder="ملاحظة" />
      {error && <p className="text-[10px] text-rose-700">{error}</p>}
      <button type="button" onClick={create} className="w-full rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700">إنشاء الجزء{targetId ? ' وربطه' : ''}</button>
    </div>
  );
}

function LineOrderEditor({ classic }: { classic: ClassicTashjeer }) {
  const document = useEditorStore((state) => state.document);
  const setLineOrder = useEditorStore((state) => state.setLineOrder);
  const moveLineInOrder = useEditorStore((state) => state.moveLineInOrder);
  const resetLineOrder = useEditorStore((state) => state.resetLineOrder);
  const selectLine = useEditorStore((state) => state.selectLine);
  const savedOrder = document?.lineOrder;
  const engineOrder = useMemo(() => orderSnapshotOf(classic.lines), [classic.lines]);
  const hasManualOrder = (savedOrder?.length ?? 0) > 0;
  const workingOrder = useMemo(() => coalesceLineOrder(hasManualOrder ? savedOrder : undefined, engineOrder), [hasManualOrder, savedOrder, engineOrder]);

  const orderForIndex = (lineId: string): number => {
    const index = workingOrder.indexOf(lineId);
    return index === -1 ? engineOrder.indexOf(lineId) + 1 : index + 1;
  };

  if (classic.lines.length === 0) return <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-[11px] text-stone-600">لا أسطر معروضة.</p>;

  return (
    <div className="rounded-md border border-stone-200 p-2.5">
      <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold text-stone-700">{hasManualOrder ? 'ترتيب يدوي مثبّت' : 'ترتيب المحرك'}</p>{hasManualOrder && <button type="button" onClick={() => { if (confirm('هل تريد العودة لترتيب المحرك؟')) resetLineOrder(); }} className="rounded border border-stone-300 px-2 py-0.5 text-[10px] text-stone-600 hover:bg-stone-50">عودة للمحرك</button>}</div>
      <ol className="max-h-80 space-y-1 overflow-y-auto custom-scrollbar">
        {classic.lines.map((line) => {
          const currentOrder = orderForIndex(line.id);
          return (
            <li key={line.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', line.id); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const dragged = e.dataTransfer.getData('text/plain'); if (dragged && dragged !== line.id) { if (confirm(`هل تريد نقل السطر إلى هذا الموضع؟`)) moveLineInOrder(workingOrder, dragged, currentOrder); } }} className="flex cursor-grab items-center gap-1.5 rounded border border-stone-100 bg-white px-2 py-1.5 hover:bg-stone-50">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getCategoryColor(line.category) }} />
              <input type="number" min={1} max={classic.lines.length} value={currentOrder} onChange={(e) => { const t = Number(e.target.value); if (!Number.isFinite(t)) return; if (confirm(`هل تريد نقل هذا السطر إلى الموضع ${t}؟`)) moveLineInOrder(workingOrder, line.id, t); }} className="h-6 w-11 shrink-0 rounded border border-stone-300 bg-white px-1 text-center text-[11px] tabular-nums" />
              <button type="button" onClick={() => { if (confirm('هل تريد نقل هذا السطر؟')) setLineOrder(shiftLineInOrder(workingOrder, line.id, -1)); }} className="rounded border border-stone-200 px-1.5 text-[10px] text-stone-600 hover:bg-stone-50">↑</button>
              <button type="button" onClick={() => { if (confirm('هل تريد نقل هذا السطر؟')) setLineOrder(shiftLineInOrder(workingOrder, line.id, 1)); }} className="rounded border border-stone-200 px-1.5 text-[10px] text-stone-600 hover:bg-stone-50">↓</button>
              <button type="button" onClick={() => selectLine(line.id, line.variantId, line.startPosition)} className="min-w-0 flex-1 truncate text-start text-[10.5px] text-stone-700 hover:underline" title="انقر للانتقال إلى السطر في المحرر">{line.label} · {line.ruleLabel}</button>
              {(line.linkIds?.length ?? 0) > 0 && <span className="shrink-0 rounded bg-violet-100 px-1 text-[9px] text-violet-800">{toArabicDigits(line.linkIds?.length ?? 0)}</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10px] leading-relaxed text-stone-500">سحب السطر ثم إفلاته مع تأكيد. IDs ثابتة، العلاقات لا تتلف.</p>
    </div>
  );
}

const KIND_LABELS: Record<TashjeerLinkKind, string> = { FACE_TO_FACE: 'وجه ↔ وجه', LINE_TO_LINE: 'سطر ↔ سطر', SEGMENT_TO_LINE: 'جزء → سطر', SEGMENT_TO_RULE: 'جزء → قاعدة' };
const RELATION_LABELS: Record<TashjeerLinkRelation, string> = { MERGE: 'دمج', REFERENCE: 'مرجعي' };

function LinksList({ links, segments, classic }: { links: TashjeerLink[]; segments: LineSegment[]; classic: ClassicTashjeer }) {
  const deleteLink = useEditorStore((state) => state.deleteLink);
  const updateLink = useEditorStore((state) => state.updateLink);
  const deleteSegment = useEditorStore((state) => state.deleteSegment);
  const selectVariant = useEditorStore((state) => state.selectVariant);
  const segmentTitles = new Map(segments.map((s) => [s.id, s.title]));
  if (links.length === 0 && segments.length === 0) return null;
  const describe = (endpoint: LinkEndpoint): string => {
    if (endpoint.type === 'SEGMENT') return `جزء «${segmentTitles.get(endpoint.id) ?? 'محذوف'}»`;
    return `${endpoint.type === 'FACE' ? 'وجه' : endpoint.type === 'LINE' ? 'سطر' : 'قاعدة'} ${shortId(endpoint.id)}`;
  };
  return (
    <div className="mt-3 rounded-md border border-stone-200 bg-stone-50/60 p-2.5">
      <p className="mb-1.5 text-[10px] font-semibold text-stone-700">العلاقات والأجزاء ({toArabicDigits(links.length + segments.length)})</p>
      <ul className="space-y-1.5">
        {links.map((link) => {
          const active = classic.appliedLinkIds.merge.includes(link.id) || classic.appliedLinkIds.reference.includes(link.id);
          return (
            <li key={link.id} className="rounded border border-stone-200 bg-white px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-[10.5px] font-medium text-stone-800">{KIND_LABELS[link.kind]} · {RELATION_LABELS[link.relation]}</p><p className="truncate text-[10px] text-stone-600">{describe(link.from)} ← {describe(link.to)}</p></div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`rounded px-1 py-0.5 text-[9px] ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{active ? 'مفعّلة' : 'معلّقة'}</span>
                  {link.relation === 'MERGE' ? <button type="button" onClick={() => updateLink(link.id, { relation: 'REFERENCE' })} className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-600 hover:bg-stone-50">فك الدمج</button> : <button type="button" onClick={() => updateLink(link.id, { relation: 'MERGE' })} className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-600 hover:bg-stone-50">دمج</button>}
                  <button type="button" onClick={() => { if (confirm('هل تريد حذف العلاقة؟')) deleteLink(link.id); }} className="rounded border border-rose-200 px-1.5 py-0.5 text-[9px] text-rose-700 hover:bg-rose-50">حذف</button>
                </div>
              </div>
              {link.notes && <p className="mt-0.5 text-[9.5px] text-stone-500">{link.notes}</p>}
              <button type="button" onClick={() => { const vid = link.from.id.includes('::') ? link.from.id.split('::')[0] : link.from.id; if (vid) { selectVariant(vid); window.dispatchEvent(new CustomEvent('tashjeer:scroll-to-variant', { detail: { variantId: vid } })); } }} className="mt-1 text-[9px] text-cyan-700 hover:underline">انتقال إلى الموضع في المحرر →</button>
            </li>
          );
        })}
        {segments.map((segment) => (
          <li key={segment.id} className="rounded border border-stone-200 bg-white px-2 py-1.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10.5px] font-medium text-stone-800">جزء: {segment.title}</p><p className="text-[10px] text-stone-600">الكلمات {toArabicDigits(segment.startPosition)}–{toArabicDigits(segment.endPosition)}</p></div><button type="button" onClick={() => { if (confirm('حذف الجزء؟')) deleteSegment(segment.id); }} className="shrink-0 rounded border border-rose-200 px-1.5 py-0.5 text-[9px] text-rose-700 hover:bg-rose-50">حذف</button></div></li>
        ))}
      </ul>
    </div>
  );
}

function shortId(id: string): string { return id.length > 28 ? `${id.slice(0, 25)}…` : id; }

function RelationSelect({ value, onChange, compact = false }: { value: TashjeerLinkRelation; onChange: (value: TashjeerLinkRelation) => void; compact?: boolean }) {
  return <div className={`flex gap-1 ${compact ? '' : 'mt-0.5'}`}><button type="button" onClick={() => onChange('MERGE')} className={`flex-1 rounded border px-2 py-1 text-[10px] ${value === 'MERGE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600'}`}>دمج في سطر</button><button type="button" onClick={() => onChange('REFERENCE')} className={`flex-1 rounded border px-2 py-1 text-[10px] ${value === 'REFERENCE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600'}`}>مرجعي فقط</button></div>;
}
function NotesInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="mb-0.5 block text-[10px] font-medium text-stone-600">ملاحظة</span><input value={value} onChange={(e) => onChange(e.target.value)} className="input h-8 py-0 text-[11px]" placeholder={placeholder} /></label>;
}

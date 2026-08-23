// لوحة الخصائص - Properties Panel v2 - بيئة احترافية
// مشروع التشجير - نظام القراءات العشر

'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { getWordById, stripHarakat, getAyahByKey, getSurah } from '@/data/quran';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getImamColor } from '@/lib/tashjeer/color-system';
import { describeScope, getFullNarratorName, resolveScope } from '@/lib/tashjeer/scope';
import { StatusBadge } from './VariantsPanel';
import {
  ManualLinesControls,
  RecitationControls,
  TashjeerOrderControls,
  TextLayoutControls,
} from './RecitationControls';
import { RelationsPanel } from './RelationsPanel';
import { OrderRankControl } from './OrderRankControl';
import { coalesceLineOrder, orderSnapshotOf, shiftLineInOrder } from '@/lib/tashjeer/manual-links';
import { listGlobalRules } from '@/lib/storage/global-rules-store';
import { faceEndpointKey } from '@/types/tashjeer';
import { sortNarratorIdsExplicit } from '@/lib/tashjeer/explicit-order';
import type { VariantCategory } from '@/types';
import type { TashjeerLinkRelation, VerificationStatus, Variant } from '@/types/tashjeer';
import type { ClassicLine, ClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';

const STATUS_OPTIONS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'REVIEW', label: 'قيد المراجعة' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'REJECTED', label: 'مرفوض' },
];

export function PropertiesPanel() {
  const {
    document,
    filter,
    selection,
    selectedWordId,
    selectedVariantId,
    selectedBranchId,
    selectedFaceIds,
    toggleNarrator,
    setFilter,
    setDocumentStatus,
    moveBranchLane,
    setBranchLane,
    setBranchRowOffset,
    resetBranchPosition,
    setEffectiveOrderRank,
    moveLineInOrder,
    setLineOrder,
    resetLineOrder,
    addLink,
    selectVariant,
    selectLine,
  } = useEditorStore();

  const catalog = useTransmissionCatalog();
  const engine = useEngineSettings();
  const strengthDegrees = useStrengthDegrees();
  const { stats, classic, layout } = useAyahTashjeer(document, filter, {}, { catalog, engine, strengthDegrees });

  const selectedWord = useMemo(() => (selectedWordId ? getWordById(selectedWordId) : undefined), [selectedWordId]);

  const effectiveVariants = useMemo(() => (document ? getEffectiveVariants(document) : []), [document]);
  const selectedVariant = effectiveVariants.find((variant) => variant.id === selectedVariantId) as Variant | undefined;
  const selectedLine = classic.lines.find((line) => line.id === selectedBranchId) ?? classic.lines.find((line) => line.variantId === selectedVariantId);
  const selectedBranch = document?.branches.find((branch) => branch.id === selectedBranchId);

  const relatedLinks = useMemo(() => {
    if (!document || !selectedVariantId) return [];
    return (document.links ?? []).filter(
      (link) =>
        link.from.id.includes(selectedVariantId) ||
        link.to.id.includes(selectedVariantId) ||
        link.from.id === selectedVariantId ||
        link.to.id === selectedVariantId
    );
  }, [document, selectedVariantId]);

  const relatedSegments = useMemo(() => {
    if (!document || !selectedVariant) return [];
    return (document.segments ?? []).filter((seg) => seg.startPosition >= selectedVariant.startPosition && seg.endPosition <= selectedVariant.endPosition);
  }, [document, selectedVariant]);

  if (!document) return null;

  const ayah = getAyahByKey(document.ayahKey);
  const page = getSurah(document.surahNumber)?.page ?? document.surahNumber;

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-e border-stone-200 bg-white custom-scrollbar">
      <Section title="المستند والسياق الموحد">
        <Row label="السورة:الآية" value={`${document.surahNumber}:${document.ayahNumber}`} />
        <Row label="الصفحة" value={page} />
        <Row label="آخر تعديل" value={formatDate(document.meta.updatedAt)} />
        <Row label="التحديد الحالي" value={selection ? `${selection.kind}:${selection.id.slice(0, 12)} موضع ${selection.position ?? '-'}` : 'لا يوجد'} />
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-medium text-stone-600">حالة المستند</span>
          <select value={document.meta.status} onChange={(e) => setDocumentStatus(e.target.value as VerificationStatus)} className="input text-xs">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="إحصاءات الآية">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="الاختلافات" value={stats.variantsCount} />
          <Stat label="الأوجه" value={stats.alternativesCount} />
          <Stat label="الخطوط" value={stats.branchesCount} />
          <Stat label="مغطاة" value={stats.coveredWords} />
        </div>
        <div className="mt-3 space-y-1">
          {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((cat) => {
            const count = stats.categories[cat];
            if (count === 0) return null;
            return (
              <div key={cat} className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: getCategoryColor(cat) }} />
                <span className="flex-1 text-[11px] text-stone-700">{CATEGORY_LABELS[cat]}</span>
                <span className="text-[11px] tabular-nums text-stone-500">{count}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {selectedWord && (
        <Section title="الكلمة المحددة">
          <p className="text-xl leading-loose text-stone-900" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>{selectedWord.text}</p>
          <Row label="الترتيب" value={toArabicDigits(selectedWord.position)} />
          <Row label="بلا تشكيل" value={stripHarakat(selectedWord.text)} />
          <Row label="المعرّف" value={selectedWord.id} />
          <Row label="الآية" value={`${document.surahNumber}:${document.ayahNumber}`} />
          <Row label="الصفحة" value={page} />
        </Section>
      )}

      {selectedVariant && (
        <Section title="العنصر المحدد - تفاصيل شاملة">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-stone-900">{selectedVariant.title}</span>
            <StatusBadge status={selectedVariant.status} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded bg-stone-50 p-2 text-[11px]">
            <Row label="رقم السطر" value={selectedVariant.orderRank ? toArabicDigits(selectedVariant.orderRank) : 'تلقائي'} />
            <Row label="ID السطر" value={selectedVariant.id.slice(0, 14)} />
            <Row label="الآية" value={`${document.surahNumber}:${document.ayahNumber}`} />
            <Row label="الصفحة" value={page} />
            <Row label="نوع السطر" value={CATEGORY_LABELS[selectedVariant.category]} />
            <Row label="المدى" value={`${selectedVariant.startPosition}–${selectedVariant.endPosition}`} />
            <Row label="المصدر" value={selectedVariant.isGlobalDerived ? 'قاعدة عامة' : selectedVariant.origin === 'EDITOR' ? 'محرر' : 'محرك'} />
            <Row label="الأوجه" value={toArabicDigits(selectedVariant.alternatives.length)} />
            <Row label="المجموعة" value={selectedVariant.batchGroupId?.slice(0, 10) ?? '—'} />
            <Row label="مستقل" value={selectedVariant.isIndependent ? 'نعم' : 'لا'} />
            <Row label="الأداء" value={selectedVariant.recitationMode ?? 'دائما'} />
            <Row label="تصحيح" value={selectedVariant.correction ? `${selectedVariant.correction.engine ?? '—'} → ${selectedVariant.correction.final}` : '—'} />
          </div>

          <div className="my-2">
            <OrderRankControl
              value={selectedVariant.orderRank}
              inherited={selectedVariant.isGlobalDerived && selectedVariant.globalRuleId ? listGlobalRules().find((r) => r.id === selectedVariant.globalRuleId)?.orderRank : undefined}
              onChange={(rank) => setEffectiveOrderRank(selectedVariant.id, rank)}
              hint="الأصغر يعلو. يظهر في التتبع و JSON."
            />
          </div>

          {selectedVariant.description && <p className="mt-2 text-[11px] leading-relaxed text-stone-600">{selectedVariant.description}</p>}
          {selectedVariant.sourceRef && <p className="mt-1 text-[11px] text-stone-500">المرجع: {selectedVariant.sourceRef}</p>}

          <div className="mt-2">
            <p className="text-[11px] font-semibold text-stone-700">القواعد المرتبطة</p>
            <ul className="mt-1 space-y-1">
              {selectedVariant.alternatives.map((alt) => (
                <li key={alt.id} className="rounded border border-stone-200 bg-white px-2 py-1 text-[10px]">
                  <span className="font-medium">{alt.ruleLabel || alt.label}</span> · {describeScope(alt.scope, { catalog })} · {alt.maddHarakat ? `${toArabicDigits(alt.maddHarakat)} حركات` : 'بلا مد'}
                </li>
              ))}
            </ul>
          </div>

          {relatedLinks.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-stone-700">العلاقات ({toArabicDigits(relatedLinks.length)})</p>
              <ul className="mt-1 space-y-1">
                {relatedLinks.map((link) => (
                  <li key={link.id} className="rounded bg-violet-50 px-2 py-1 text-[10px] text-violet-900">{link.kind} {link.relation} {link.from.id.slice(0, 8)} → {link.to.id.slice(0, 8)}</li>
                ))}
              </ul>
            </div>
          )}

          {relatedSegments.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-stone-700">الأجزاء المرتبطة ({toArabicDigits(relatedSegments.length)})</p>
              <ul className="mt-1 space-y-1">
                {relatedSegments.map((seg) => (
                  <li key={seg.id} className="rounded bg-emerald-50 px-2 py-1 text-[10px] text-emerald-900">{seg.title} {seg.startPosition}–{seg.endPosition}</li>
                ))}
              </ul>
            </div>
          )}

          <FaceComposeQuick selectedVariant={selectedVariant} variants={effectiveVariants} onCompose={(from, to, relation) => addLink({ kind: 'FACE_TO_FACE', relation, from: { type: 'FACE', id: from }, to: { type: 'FACE', id: to } })} />
        </Section>
      )}

      {selectedLine && (
        <Section title="السطر المحدد في المحرر">
          <Row label="البطاقة" value={selectedLine.label} />
          <Row label="الحكم" value={selectedLine.ruleLabel} />
          <Row label="الفئة" value={CATEGORY_LABELS[selectedLine.category]} />
          <Row label="القراء" value={selectedLine.readers.map((r) => r.name).join('، ').slice(0, 60)} />
          <Row label="الرموز" value={selectedLine.symbols.join(' ')} />
          <Row label="الترتيب" value={selectedLine.lane + 1} />
          <SelectedLineOrder line={selectedLine} classic={classic} savedOrder={document?.lineOrder ?? []} onMove={(base, lineId, target) => moveLineInOrder(base, lineId, target)} onShift={(base, lineId, delta) => setLineOrder(shiftLineInOrder(base, lineId, delta))} onReset={resetLineOrder} />
          <LineComposeQuick line={selectedLine} lines={classic.lines} onCompose={(from, to, relation) => addLink({ kind: 'LINE_TO_LINE', relation, from: { type: 'LINE', id: from }, to: { type: 'LINE', id: to } })} />
        </Section>
      )}

      {selectedBranch && (
        <Section title="موضع الخط الهندسي">
          <Row label="الفئة" value={CATEGORY_LABELS[selectedBranch.category]} />
          <Row label="المسار" value={selectedBranch.lane + 1} />
          <Row label="الجهة" value={selectedBranch.side === 'TOP' ? 'أعلى' : 'أسفل'} />
          <p className="mt-2 text-[11px] text-stone-600">{selectedBranch.label}</p>
          <LinePlacementControls lane={selectedBranch.lane} rowOffset={selectedBranch.rowOffset ?? 0} isManual={selectedBranch.isManual ?? false} onMove={(d) => moveBranchLane(selectedBranch.id, d)} onLaneChange={(lane) => setBranchLane(selectedBranch.id, lane)} onOffsetChange={(off) => setBranchRowOffset(selectedBranch.id, off)} onReset={() => resetBranchPosition(selectedBranch.id)} />
          <EvidenceView variantId={selectedBranch.variantId} alternativeId={selectedBranch.alternativeId} catalog={catalog} />
        </Section>
      )}

      <Section title="تصفية الرواة - ترتيب صريح">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">{filter.narratorIds.length === 0 ? 'كل الرواة' : `${filter.narratorIds.length} مختار`}</span>
          {filter.narratorIds.length > 0 && <button type="button" onClick={() => setFilter({ narratorIds: [] })} className="rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100">إلغاء</button>}
        </div>
        <div className="space-y-2">
          {catalog.imams
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((imam) => (
              <div key={imam.id}>
                <p className="mb-1 text-[11px] font-medium" style={{ color: getImamColor(imam.id) }}>{toArabicDigits(imam.order)}. {imam.name} {imam.symbol ? `(${imam.symbol})` : ''}</p>
                <div className="flex flex-wrap gap-1">
                  {catalog.narrators
                    .filter((n) => n.imamId === imam.id)
                    .sort((a, b) => a.order - b.order)
                    .map((narrator) => {
                      const active = filter.narratorIds.includes(narrator.id);
                      return (
                        <button key={narrator.id} type="button" onClick={() => toggleNarrator(narrator.id)} title={getFullNarratorName(narrator.id, catalog)} className={`rounded border px-1.5 py-0.5 text-[11px] ${active ? 'border-transparent text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`} style={{ backgroundColor: active ? getImamColor(imam.id) : undefined }}>
                          {toArabicDigits(narrator.order)}. {narrator.name} {narrator.symbol ? `(${narrator.symbol})` : ''}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>
      </Section>

      <TashjeerOrderControls />
      <TextLayoutControls />
      <RecitationControls />
      <ManualLinesControls />
      <RelationsPanel />
    </aside>
  );
}

function EvidenceView({ variantId, alternativeId, catalog }: { variantId: string; alternativeId: string; catalog: import('@/lib/transmissions/catalog').TransmissionCatalog }) {
  const document = useEditorStore((state) => state.document);
  const variants = useMemo(() => (document ? getEffectiveVariants(document) : []), [document]);
  const alternative = variants.find((v) => v.id === variantId)?.alternatives.find((a) => a.id === alternativeId);
  if (!alternative) return null;
  const evidences = alternative.evidences ?? [];
  return (
    <div className="mt-3 border-t border-stone-100 pt-2">
      <p className="mb-1 text-[11px] font-semibold text-stone-700">النطاق (ترتيب صريح)</p>
      <p className="text-[11px] text-stone-600">{describeScope(alternative.scope, { catalog })} ({resolveScope(alternative.scope, catalog).length})</p>
      <p className="mb-1 mt-2 text-[11px] font-semibold text-stone-700">الأدلة</p>
      {evidences.length === 0 ? <p className="text-[11px] text-amber-700">لا يوجد دليل مسجّل.</p> : <ul className="space-y-1.5">{evidences.map((ev) => <li key={ev.id} className="rounded bg-stone-50 px-2 py-1.5"><p className="text-[11px] font-medium text-stone-700">{sourceLabel(ev.source)}{ev.reference ? ` — ${ev.reference}` : ''}</p>{ev.text && <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">{ev.text}</p>}</li>)}</ul>}
      {alternative.notes && <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">ملاحظة: {alternative.notes}</p>}
    </div>
  );
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = { TAYYIBAH: 'طيبة', NASHR: 'النشر', JANNAH: 'الجنة', OTHER: 'آخر' };
  return labels[source] ?? source;
}

function SelectedLineOrder({ line, classic, savedOrder, onMove, onShift, onReset }: { line: ClassicLine; classic: ClassicTashjeer; savedOrder: string[]; onMove: (base: string[], lineId: string, target: number) => void; onShift: (base: string[], lineId: string, delta: number) => void; onReset: () => void }) {
  const engineOrder = orderSnapshotOf(classic.lines);
  const hasManual = savedOrder.length > 0;
  const base = coalesceLineOrder(hasManual ? savedOrder : undefined, engineOrder);
  const current = Math.max(1, base.indexOf(line.id) + 1 || classic.lines.findIndex((item) => item.id === line.id) + 1);
  return (
    <div className="mt-2 rounded-md border border-cyan-200 bg-cyan-50/50 p-2">
      <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-cyan-950">رقم ترتيب الصف</p>{hasManual && <button type="button" onClick={onReset} className="text-[10px] text-cyan-800 hover:underline">عودة للمحرك</button>}</div>
      <div className="mt-1.5 flex items-center gap-1.5"><input type="number" min={1} max={classic.lines.length} value={current} onChange={(e) => { const t = Number(e.target.value); if (!Number.isFinite(t)) return; onMove(base, line.id, t); }} className="h-7 w-14 rounded border border-cyan-300 bg-white px-1 text-center text-[11px] tabular-nums" aria-label="ترتيب الصف" /><button type="button" onClick={() => onShift(base, line.id, -1)} className="rounded border border-cyan-300 bg-white px-2 py-0.5 text-xs text-cyan-800">↑</button><button type="button" onClick={() => onShift(base, line.id, 1)} className="rounded border border-cyan-300 bg-white px-2 py-0.5 text-xs text-cyan-800">↓</button><span className="text-[10px] text-cyan-900/70">من {toArabicDigits(classic.lines.length)}</span></div>
      <p className="mt-1 text-[10px] leading-relaxed text-cyan-900/75">تغيير الرقم ينقل الصف ويُزيح المتأثرين تلقائيا.</p>
    </div>
  );
}

function FaceComposeQuick({ selectedVariant, variants, onCompose }: { selectedVariant: Variant; variants: Variant[]; onCompose: (from: string, to: string, relation: TashjeerLinkRelation) => void }) {
  const [target, setTarget] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');
  const faces = variants.flatMap((v) => v.alternatives.filter((a) => !a.isBase).map((a) => ({ key: faceEndpointKey(v.id, a.id), label: `${v.title} — ${a.label}`, variantId: v.id })));
  const own = selectedVariant.alternatives.filter((a) => !a.isBase);
  if (own.length === 0 || faces.length < 2) return null;
  const from = faceEndpointKey(selectedVariant.id, own[0].id);
  return (
    <div className="mt-3 rounded-md border border-violet-200 bg-violet-50/40 p-2">
      <p className="text-[11px] font-semibold text-violet-950">وجه مركّب يدويا</p>
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="input mt-1.5 h-7 py-0 text-[11px]"><option value="">— الوجه المرتبط —</option>{faces.filter((f) => f.key !== from).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
      <div className="mt-1.5 flex gap-1"><button type="button" onClick={() => setRelation('MERGE')} className={`flex-1 rounded border px-2 py-1 text-[10px] ${relation === 'MERGE' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 text-violet-800'}`}>دمج في سطر</button><button type="button" onClick={() => setRelation('REFERENCE')} className={`flex-1 rounded border px-2 py-1 text-[10px] ${relation === 'REFERENCE' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 text-violet-800'}`}>مرجعي</button></div>
      <button type="button" disabled={!target} onClick={() => { if (!target) return; onCompose(from, target, relation); setTarget(''); }} className="mt-1.5 w-full rounded bg-violet-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-violet-800 disabled:opacity-40">إنشاء العلاقة</button>
    </div>
  );
}

function LineComposeQuick({ line, lines, onCompose }: { line: ClassicLine; lines: ClassicLine[]; onCompose: (from: string, to: string, relation: TashjeerLinkRelation) => void }) {
  const [target, setTarget] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');
  if (lines.length < 2) return null;
  return (
    <div className="mt-2 rounded-md border border-violet-200 bg-violet-50/40 p-2">
      <p className="text-[11px] font-semibold text-violet-950">ربط هذا السطر</p>
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="input mt-1.5 h-7 py-0 text-[11px]"><option value="">— السطر المدمج به —</option>{lines.filter((item) => item.id !== line.id).map((item, index) => <option key={item.id} value={item.id}>{toArabicDigits(index + 1)}. {item.label} · {item.ruleLabel.slice(0, 28)}</option>)}</select>
      <div className="mt-1.5 flex gap-1"><button type="button" onClick={() => setRelation('MERGE')} className={`flex-1 rounded border px-2 py-1 text-[10px] ${relation === 'MERGE' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 text-violet-800'}`}>دمج</button><button type="button" onClick={() => setRelation('REFERENCE')} className={`flex-1 rounded border px-2 py-1 text-[10px] ${relation === 'REFERENCE' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 text-violet-800'}`}>مرجعي</button></div>
      <button type="button" disabled={!target} onClick={() => { if (!target) return; onCompose(line.id, target, relation); setTarget(''); }} className="mt-1.5 w-full rounded bg-violet-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-violet-800 disabled:opacity-40">ربط السطرين</button>
    </div>
  );
}

function LinePlacementControls({ lane, rowOffset, isManual, onMove, onLaneChange, onOffsetChange, onReset }: { lane: number; rowOffset: number; isManual: boolean; onMove: (delta: number) => void; onLaneChange: (lane: number) => void; onOffsetChange: (offset: number) => void; onReset: () => void }) {
  return (
    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/40 p-2">
      <div className="flex items-center justify-between"><p className="text-[11px] font-semibold text-emerald-900">موضع السطر</p>{isManual && <button type="button" onClick={onReset} className="text-[10px] text-emerald-800 hover:underline">عودة للتلقائي</button>}</div>
      <div className="mt-1.5 flex items-center gap-1.5"><button type="button" onClick={() => onMove(-1)} className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs text-emerald-800">↑</button><label className="flex flex-1 items-center gap-1 text-[10px] text-stone-600">المسار<input type="number" min={0} value={lane} onChange={(e) => onLaneChange(Number(e.target.value))} className="h-6 w-12 rounded border border-stone-300 bg-white px-1 text-center text-[11px]" /></label><button type="button" onClick={() => onMove(1)} className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs text-emerald-800">↓</button></div>
      <label className="mt-2 block text-[10px] text-stone-600">الإزاحة: {rowOffset}<input type="range" min={-80} max={80} step={2} value={rowOffset} onChange={(e) => onOffsetChange(Number(e.target.value))} className="mt-1 w-full accent-emerald-600" /></label>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-stone-200 px-4 py-3"><h3 className="mb-2 text-xs font-bold text-stone-900">{title}</h3>{children}</section>;
}
function Row({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-baseline justify-between gap-2 py-0.5"><span className="text-[11px] text-stone-500">{label}</span><span className="text-[11px] font-medium text-stone-800">{value}</span></div>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-stone-50 px-2 py-1.5"><div className="text-lg font-bold tabular-nums text-stone-900">{value}</div><div className="text-[11px] text-stone-500">{label}</div></div>;
}
function formatDate(value: string): string {
  try { return new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); } catch { return '—'; }
}

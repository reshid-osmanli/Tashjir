// لوحة الخصائص - Properties Panel
// مشروع التشجير - نظام القراءات العشر
//
// لوحة القراءة والتفتيش: تعرض ما هو محدد الآن (كلمة أو خط)، وإحصاءات الآية،
// وحالة المستند، وتصفية الرواة.
//
// تصفية الرواة هنا هي أقوى أداة تدقيق في المحرر: باختيار راو واحد
// تظهر خطوطه وحدها، فيتحقق المدقق من قراءته كاملة في الآية دفعة واحدة.

'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { getWordById, stripHarakat } from '@/data/quran';
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
import { WaqfMarksPanel } from './WaqfMarksPanel';
import { RelationsPanel } from './RelationsPanel';
import { OrderRankControl } from './OrderRankControl';
import { coalesceLineOrder, orderSnapshotOf, shiftLineInOrder } from '@/lib/tashjeer/manual-links';
import { listGlobalRules } from '@/lib/storage/global-rules-store';
import { faceEndpointKey } from '@/types/tashjeer';
import type { VariantCategory } from '@/types';
import type { TashjeerLinkRelation, VerificationStatus } from '@/types/tashjeer';
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
    selectedWordId,
    selectedVariantId,
    selectedBranchId,
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
  } = useEditorStore();

  const catalog = useTransmissionCatalog();
  const engine = useEngineSettings();
  const strengthDegrees = useStrengthDegrees();
  const { stats, classic } = useAyahTashjeer(document, filter, {}, { catalog, engine, strengthDegrees });

  const selectedWord = useMemo(
    () => (selectedWordId ? getWordById(selectedWordId) : undefined),
    [selectedWordId]
  );

  const effectiveVariants = useMemo(
    () => (document ? getEffectiveVariants(document) : []),
    [document]
  );
  const selectedVariant = effectiveVariants.find((variant) => variant.id === selectedVariantId);
  const selectedBranch = document?.branches.find((branch) => branch.id === selectedBranchId);
  const selectedLine =
    classic.lines.find((line) => line.id === selectedBranchId) ??
    classic.lines.find((line) => line.variantId === selectedVariantId);

  if (!document) return null;

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-e border-stone-200 bg-white">
      {/* حالة المستند */}
      <Section title="المستند">
        <Row label="الموضع" value={`${document.surahNumber}:${document.ayahNumber}`} />
        <Row label="آخر تعديل" value={formatDate(document.meta.updatedAt)} />
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-medium text-stone-600">حالة المستند</span>
          <select
            value={document.meta.status}
            onChange={(event) => setDocumentStatus(event.target.value as VerificationStatus)}
            className="input text-xs"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </Section>

      {/* الإحصاءات */}
      <Section title="إحصاءات الآية">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="الاختلافات" value={stats.variantsCount} />
          <Stat label="الأوجه" value={stats.alternativesCount} />
          <Stat label="الخطوط الظاهرة" value={stats.branchesCount} />
          <Stat label="الكلمات المغطاة" value={stats.coveredWords} />
        </div>

        <div className="mt-3 space-y-1.5">
          {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => {
            const count = stats.categories[category];
            if (count === 0) return null;

            return (
              <div key={category} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getCategoryColor(category) }}
                />
                <span className="flex-1 text-[11px] text-stone-700">
                  {CATEGORY_LABELS[category]}
                </span>
                <span className="text-[11px] tabular-nums text-stone-500">{count}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* الكلمة المحددة */}
      {selectedWord && (
        <Section title="الكلمة المحددة">
          <p
            className="text-xl leading-loose text-stone-900"
            style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
          >
            {selectedWord.text}
          </p>
          <Row label="الترتيب" value={toArabicDigits(selectedWord.position)} />
          <Row label="بلا تشكيل" value={stripHarakat(selectedWord.text)} />
          <Row label="المعرّف" value={selectedWord.id} />
        </Section>
      )}

      {/* خصائص القاعدة: رقم ترتيب السطر قابل للتحرير دائما، بما فيه المشتق من قاعدة عامة */}
      {selectedVariant && (
        <Section title="خصائص القاعدة">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-stone-900">{selectedVariant.title}</span>
            <StatusBadge status={selectedVariant.status} />
          </div>
          <Row label="الفئة" value={CATEGORY_LABELS[selectedVariant.category]} />
          <Row
            label="المصدر"
            value={
              selectedVariant.isGlobalDerived
                ? 'المحرك (قاعدة عامة)'
                : selectedVariant.origin === 'EDITOR'
                  ? 'المحرر (إضافة يدوية)'
                  : 'المحرك (بيانات أساسية)'
            }
          />
          {selectedVariant.isGlobalDerived && (
            <p className="mb-2 rounded bg-violet-50 px-2 py-1 text-[11px] text-violet-800">
              مشتق من قاعدة عامة — ترتيب السطر هنا تخصيص لهذا الموضع وحده.
            </p>
          )}

          <div className="my-2">
            <OrderRankControl
              value={selectedVariant.orderRank}
              inherited={
                selectedVariant.isGlobalDerived && selectedVariant.globalRuleId
                  ? listGlobalRules().find((rule) => rule.id === selectedVariant.globalRuleId)?.orderRank
                  : undefined
              }
              onChange={(rank) => setEffectiveOrderRank(selectedVariant.id, rank)}
              hint="الأصغر يعلو في التشجير. تغيير الرقم يُحفظ في JSON ويظهر في التتبع."
            />
          </div>

          <Row
            label={selectedVariant.targetKind === 'CHARACTERS' ? 'مدى الحروف' : 'المدى'}
            value={
              selectedVariant.targetKind === 'CHARACTERS' && selectedVariant.characterRange
                ? `${toArabicDigits(selectedVariant.characterRange.start.position)}/${toArabicDigits(selectedVariant.characterRange.start.characterIndex)} – ${toArabicDigits(selectedVariant.characterRange.end.position)}/${toArabicDigits(selectedVariant.characterRange.end.characterIndex)}`
                : `${selectedVariant.startPosition}–${selectedVariant.endPosition}`
            }
          />
          {selectedVariant.description && (
            <p className="mt-2 text-[11px] leading-relaxed text-stone-600">
              {selectedVariant.description}
            </p>
          )}
          {selectedVariant.sourceRef && (
            <p className="mt-1 text-[11px] text-stone-500">المرجع: {selectedVariant.sourceRef}</p>
          )}

          <FaceComposeQuick
            selectedVariant={selectedVariant}
            variants={effectiveVariants}
            onCompose={(from, to, relation) =>
              addLink({
                kind: 'FACE_TO_FACE',
                relation,
                from: { type: 'FACE', id: from },
                to: { type: 'FACE', id: to },
              })
            }
          />
        </Section>
      )}

      {/* السطر المحدد: رقم ترتيبه قابل للتغيير مباشرة دون إعادة تشغيل المحرك */}
      {selectedLine && (
        <Section title="السطر المحدد">
          <Row label="البطاقة" value={selectedLine.label} />
          <Row label="الحكم" value={selectedLine.ruleLabel} />
          <Row label="الفئة" value={CATEGORY_LABELS[selectedLine.category]} />
          <SelectedLineOrder
            line={selectedLine}
            classic={classic}
            savedOrder={document?.lineOrder ?? []}
            onMove={(base, lineId, target) => moveLineInOrder(base, lineId, target)}
            onShift={(base, lineId, delta) => setLineOrder(shiftLineInOrder(base, lineId, delta))}
            onReset={resetLineOrder}
          />
          <LineComposeQuick
            line={selectedLine}
            lines={classic.lines}
            onCompose={(from, to, relation) =>
              addLink({
                kind: 'LINE_TO_LINE',
                relation,
                from: { type: 'LINE', id: from },
                to: { type: 'LINE', id: to },
              })
            }
          />
        </Section>
      )}

      {/* الخط المحدد وأدلته (مسار المحرك القديم إن وُجد) */}
      {selectedBranch && (
        <Section title="موضع الخط الهندسي">
          <Row label="الفئة" value={CATEGORY_LABELS[selectedBranch.category]} />
          <Row label="المسار" value={selectedBranch.lane + 1} />
          <Row label="الجهة" value={selectedBranch.side === 'TOP' ? 'أعلى النص' : 'أسفل النص'} />
          <p className="mt-2 text-[11px] text-stone-600">{selectedBranch.label}</p>

          <LinePlacementControls
            lane={selectedBranch.lane}
            rowOffset={selectedBranch.rowOffset ?? 0}
            isManual={selectedBranch.isManual ?? false}
            onMove={(delta) => moveBranchLane(selectedBranch.id, delta)}
            onLaneChange={(lane) => setBranchLane(selectedBranch.id, lane)}
            onOffsetChange={(offset) => setBranchRowOffset(selectedBranch.id, offset)}
            onReset={() => resetBranchPosition(selectedBranch.id)}
          />

          <EvidenceView
            variantId={selectedBranch.variantId}
            alternativeId={selectedBranch.alternativeId}
            catalog={catalog}
          />
        </Section>
      )}

      {/* تصفية الرواة */}
      <Section title="تصفية الرواة">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            {filter.narratorIds.length === 0
              ? 'كل الرواة ظاهرون'
              : `${filter.narratorIds.length} راويا مختارا`}
          </span>
          {filter.narratorIds.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter({ narratorIds: [] })}
              className="rounded border border-stone-300 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100"
            >
              إلغاء التصفية
            </button>
          )}
        </div>

        <div className="space-y-2">
          {catalog.imams.map((imam) => (
            <div key={imam.id}>
              <p className="mb-1 text-[11px] font-medium" style={{ color: getImamColor(imam.id) }}>
                {imam.name}
              </p>
              <div className="flex flex-wrap gap-1">
                {catalog.narrators.filter((narrator) => narrator.imamId === imam.id).map((narrator) => {
                  const active = filter.narratorIds.includes(narrator.id);
                  return (
                    <button
                      key={narrator.id}
                      type="button"
                      onClick={() => toggleNarrator(narrator.id)}
                      title={getFullNarratorName(narrator.id, catalog)}
                      className={`rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                      style={{ backgroundColor: active ? getImamColor(imam.id) : undefined }}
                    >
                      {narrator.name}
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
      <WaqfMarksPanel />
      <ManualLinesControls />
      <RelationsPanel />
    </aside>
  );
}

// ==================== عرض الأدلة ====================

function EvidenceView({
  variantId,
  alternativeId,
  catalog,
}: {
  variantId: string;
  alternativeId: string;
  catalog: import('@/lib/transmissions/catalog').TransmissionCatalog;
}) {
  const document = useEditorStore((state) => state.document);
  const variants = useMemo(() => (document ? getEffectiveVariants(document) : []), [document]);

  const alternative = variants
    .find((variant) => variant.id === variantId)
    ?.alternatives.find((item) => item.id === alternativeId);

  if (!alternative) return null;

  const evidences = alternative.evidences ?? [];

  return (
    <div className="mt-3 border-t border-stone-100 pt-2">
      <p className="mb-1 text-[11px] font-semibold text-stone-700">النطاق</p>
      <p className="text-[11px] text-stone-600">
        {describeScope(alternative.scope, { catalog })} ({resolveScope(alternative.scope, catalog).length} راويا)
      </p>

      <p className="mb-1 mt-2 text-[11px] font-semibold text-stone-700">الأدلة</p>
      {evidences.length === 0 ? (
        <p className="text-[11px] text-amber-700">
          لا يوجد دليل مسجّل لهذا الوجه. لا يصح اعتماده قبل توثيقه.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {evidences.map((evidence) => (
            <li key={evidence.id} className="rounded bg-stone-50 px-2 py-1.5">
              <p className="text-[11px] font-medium text-stone-700">
                {sourceLabel(evidence.source)}
                {evidence.reference ? ` — ${evidence.reference}` : ''}
              </p>
              {evidence.text && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                  {evidence.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {alternative.notes && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          ملاحظة: {alternative.notes}
        </p>
      )}
    </div>
  );
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    TAYYIBAH: 'طيبة النشر',
    NASHR: 'النشر',
    JANNAH: 'الجنة',
    OTHER: 'مصدر آخر',
  };
  return labels[source] ?? source;
}

// ==================== ترتيب السطر المحدد ====================

function SelectedLineOrder({
  line,
  classic,
  savedOrder,
  onMove,
  onShift,
  onReset,
}: {
  line: ClassicLine;
  classic: ClassicTashjeer;
  savedOrder: string[];
  onMove: (base: string[], lineId: string, target: number) => void;
  onShift: (base: string[], lineId: string, delta: number) => void;
  onReset: () => void;
}) {
  const engineOrder = orderSnapshotOf(classic.lines);
  const hasManual = savedOrder.length > 0;
  const base = coalesceLineOrder(hasManual ? savedOrder : undefined, engineOrder);
  const current = Math.max(1, base.indexOf(line.id) + 1 || classic.lines.findIndex((item) => item.id === line.id) + 1);

  return (
    <div className="mt-2 rounded-md border border-cyan-200 bg-cyan-50/50 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-cyan-950">رقم ترتيب الصف</p>
        {hasManual && (
          <button type="button" onClick={onReset} className="text-[10px] text-cyan-800 hover:underline">
            عودة لترتيب المحرك
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={classic.lines.length}
          value={current}
          onChange={(event) => {
            const target = Number(event.target.value);
            if (!Number.isFinite(target)) return;
            onMove(base, line.id, target);
          }}
          className="h-7 w-14 rounded border border-cyan-300 bg-white px-1 text-center text-[11px] tabular-nums"
          aria-label="رقم ترتيب الصف"
        />
        <button
          type="button"
          onClick={() => onShift(base, line.id, -1)}
          className="rounded border border-cyan-300 bg-white px-2 py-0.5 text-xs text-cyan-800"
          title="أعلى"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onShift(base, line.id, 1)}
          className="rounded border border-cyan-300 bg-white px-2 py-0.5 text-xs text-cyan-800"
          title="أسفل"
        >
          ↓
        </button>
        <span className="text-[10px] text-cyan-900/70">من {toArabicDigits(classic.lines.length)}</span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-cyan-900/75">
        تغيير الرقم ينقل الصف ويُزيح المتأثرين تلقائيا، بلا إعادة تشغيل المحرك وبلا تلف العلاقات.
      </p>
    </div>
  );
}

function FaceComposeQuick({
  selectedVariant,
  variants,
  onCompose,
}: {
  selectedVariant: import('@/types/tashjeer').Variant;
  variants: import('@/types/tashjeer').Variant[];
  onCompose: (from: string, to: string, relation: TashjeerLinkRelation) => void;
}) {
  const [target, setTarget] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');
  const faces = variants.flatMap((variant) =>
    variant.alternatives
      .filter((alternative) => !alternative.isBase)
      .map((alternative) => ({
        key: faceEndpointKey(variant.id, alternative.id),
        label: `${variant.title} — ${alternative.label}`,
      }))
  );
  const own = selectedVariant.alternatives.filter((alternative) => !alternative.isBase);
  if (own.length === 0 || faces.length < 2) return null;

  const from = faceEndpointKey(selectedVariant.id, own[0].id);

  return (
    <div className="mt-3 rounded-md border border-violet-200 bg-violet-50/40 p-2">
      <p className="text-[11px] font-semibold text-violet-950">وجه مركّب يدويا</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-violet-900/75">
        اربط هذا الوجه بوجه آخر — ولو كان من قارئ مختلف. القرار قرار المحقق لا افتراض المحرك.
      </p>
      <select
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        className="input mt-1.5 h-7 py-0 text-[11px]"
      >
        <option value="">— الوجه المرتبط به —</option>
        {faces
          .filter((face) => face.key !== from)
          .map((face) => (
            <option key={face.key} value={face.key}>
              {face.label}
            </option>
          ))}
      </select>
      <div className="mt-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => setRelation('MERGE')}
          className={`flex-1 rounded border px-2 py-1 text-[10px] ${relation === 'MERGE' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 text-violet-800'}`}
        >
          دمج في سطر
        </button>
        <button
          type="button"
          onClick={() => setRelation('REFERENCE')}
          className={`flex-1 rounded border px-2 py-1 text-[10px] ${relation === 'REFERENCE' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 text-violet-800'}`}
        >
          ربط مرجعي
        </button>
      </div>
      <button
        type="button"
        disabled={!target}
        onClick={() => {
          if (!target) return;
          onCompose(from, target, relation);
          setTarget('');
        }}
        className="mt-1.5 w-full rounded bg-violet-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-violet-800 disabled:opacity-40"
      >
        إنشاء العلاقة
      </button>
    </div>
  );
}

function LineComposeQuick({
  line,
  lines,
  onCompose,
}: {
  line: ClassicLine;
  lines: ClassicLine[];
  onCompose: (from: string, to: string, relation: TashjeerLinkRelation) => void;
}) {
  const [target, setTarget] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');
  if (lines.length < 2) return null;

  return (
    <div className="mt-2 rounded-md border border-violet-200 bg-violet-50/40 p-2">
      <p className="text-[11px] font-semibold text-violet-950">ربط هذا السطر بسطر آخر</p>
      <select
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        className="input mt-1.5 h-7 py-0 text-[11px]"
      >
        <option value="">— السطر المدمج به —</option>
        {lines
          .filter((item) => item.id !== line.id)
          .map((item, index) => (
            <option key={item.id} value={item.id}>
              {toArabicDigits(index + 1)}. {item.label} · {item.ruleLabel.slice(0, 28)}
            </option>
          ))}
      </select>
      <div className="mt-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => setRelation('MERGE')}
          className={`flex-1 rounded border px-2 py-1 text-[10px] ${relation === 'MERGE' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 text-violet-800'}`}
        >
          دمج
        </button>
        <button
          type="button"
          onClick={() => setRelation('REFERENCE')}
          className={`flex-1 rounded border px-2 py-1 text-[10px] ${relation === 'REFERENCE' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 text-violet-800'}`}
        >
          مرجعي
        </button>
      </div>
      <button
        type="button"
        disabled={!target}
        onClick={() => {
          if (!target) return;
          onCompose(line.id, target, relation);
          setTarget('');
        }}
        className="mt-1.5 w-full rounded bg-violet-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-violet-800 disabled:opacity-40"
      >
        ربط السطرين
      </button>
    </div>
  );
}

// ==================== موضع السطر ====================

function LinePlacementControls({
  lane,
  rowOffset,
  isManual,
  onMove,
  onLaneChange,
  onOffsetChange,
  onReset,
}: {
  lane: number;
  rowOffset: number;
  isManual: boolean;
  onMove: (delta: number) => void;
  onLaneChange: (lane: number) => void;
  onOffsetChange: (offset: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/40 p-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-emerald-900">موضع السطر</p>
        {isManual && (
          <button type="button" onClick={onReset} className="text-[10px] text-emerald-800 hover:underline">
            عودة للتلقائي
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <button type="button" onClick={() => onMove(-1)} className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs text-emerald-800">
          ↑
        </button>
        <label className="flex flex-1 items-center gap-1 text-[10px] text-stone-600">
          المسار
          <input
            type="number"
            min={0}
            value={lane}
            onChange={(event) => onLaneChange(Number(event.target.value))}
            className="h-6 w-12 rounded border border-stone-300 bg-white px-1 text-center text-[11px]"
          />
        </label>
        <button type="button" onClick={() => onMove(1)} className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs text-emerald-800">
          ↓
        </button>
      </div>
      <label className="mt-2 block text-[10px] text-stone-600">
        الإزاحة الدقيقة: {rowOffset}
        <input
          type="range"
          min={-80}
          max={80}
          step={2}
          value={rowOffset}
          onChange={(event) => onOffsetChange(Number(event.target.value))}
          className="mt-1 w-full accent-emerald-600"
        />
      </label>
    </div>
  );
}

// ==================== عناصر مشتركة ====================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-stone-200 px-4 py-3">
      <h3 className="mb-2 text-xs font-bold text-stone-900">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[11px] text-stone-500">{label}</span>
      <span className="text-[11px] font-medium text-stone-800">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-stone-50 px-2 py-1.5">
      <div className="text-lg font-bold tabular-nums text-stone-900">{value}</div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(value)
    );
  } catch {
    return '—';
  }
}

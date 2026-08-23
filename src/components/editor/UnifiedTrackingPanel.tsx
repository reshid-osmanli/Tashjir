'use client';

// لوحة التتبع الموحدة - FR-ED-16
// تبني العرض من المستند نفسه: Correction v8 أو لقطات المحرك القديمة، لا من
// مخزن منفصل قد يناقض مصدر الحقيقة.

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useSelectionStore } from '@/stores/selection-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import {
  correctionEditorResult,
  correctionEngineResult,
  correctionFinalResult,
  correctionTimestamp,
  type Correction,
} from '@/lib/tashjeer/model/v8';
import { CreateRuleFromCorrectionButton } from './CreateRuleFromCorrectionButton';

type TrackingFilter = 'ALL' | 'ENGINE_ONLY' | 'EDITOR_ONLY' | 'CORRECTED';
type TrackingStatus = Exclude<TrackingFilter, 'ALL'> | 'UNKNOWN';

interface TrackingItemData {
  correction: Correction;
  status: TrackingStatus;
  finalResult: unknown;
}

function deriveCorrections(document: NonNullable<ReturnType<typeof useEditorStore.getState>['document']>): Correction[] {
  const explicit = document.corrections ?? [];
  const knownTargets = new Set(explicit.map((correction) => correction.targetId));
  const fromLegacySnapshots: Correction[] = document.variants
    .filter((variant) => variant.engineSnapshot && !knownTargets.has(variant.id))
    .map((variant) => ({
      id: `legacy-correction-${variant.id}`,
      targetId: variant.id,
      targetType: 'VARIANT',
      engineResult: variant.engineSnapshot,
      editorResult: {
        title: variant.title,
        category: variant.category,
        alternatives: variant.alternatives,
      },
      finalResult: {
        title: variant.title,
        category: variant.category,
        alternatives: variant.alternatives,
      },
      at: variant.editorModifiedAt ?? variant.engineSnapshot?.capturedAt,
      source: 'editor',
      metadata: { category: variant.category, ayahKey: document.ayahKey },
    }));
  return [...explicit, ...fromLegacySnapshots];
}

function classifyCorrection(correction: Correction): TrackingStatus {
  const engine = correctionEngineResult(correction);
  const editor = correctionEditorResult(correction);
  if (engine !== undefined && editor !== undefined) return 'CORRECTED';
  if (engine !== undefined) return 'ENGINE_ONLY';
  if (editor !== undefined) return 'EDITOR_ONLY';
  return 'UNKNOWN';
}

export function UnifiedTrackingPanel() {
  const document = useEditorStore((state) => state.document);
  const select = useSelectionStore((state) => state.select);
  const [filter, setFilter] = useState<TrackingFilter>('ALL');
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string | null>(null);

  const trackingItems = useMemo<TrackingItemData[]>(() => {
    if (!document) return [];
    return deriveCorrections(document).map((correction) => ({
      correction,
      status: classifyCorrection(correction),
      finalResult: correctionFinalResult(correction),
    }));
  }, [document]);

  const filteredItems = useMemo(
    () => (filter === 'ALL' ? trackingItems : trackingItems.filter((item) => item.status === filter)),
    [trackingItems, filter]
  );
  const stats = useMemo(() => ({
    engineOnly: trackingItems.filter((item) => item.status === 'ENGINE_ONLY').length,
    editorOnly: trackingItems.filter((item) => item.status === 'EDITOR_ONLY').length,
    corrected: trackingItems.filter((item) => item.status === 'CORRECTED').length,
    total: trackingItems.length,
  }), [trackingItems]);

  if (!document) {
    return <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">لا يوجد مستند مفتوح</div>;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900">التتبع الموحد</h2>
        <p className="mt-1 text-sm text-gray-600">عرض نتيجة المحرك وقرار المحرر والنتيجة النهائية من نفس المستند</p>
      </div>
      <div className="grid grid-cols-4 gap-3 border-b border-gray-200 p-4">
        <StatCard label="المحرك فقط" value={stats.engineOnly} color="blue" />
        <StatCard label="المحرر فقط" value={stats.editorOnly} color="amber" />
        <StatCard label="مصحّح" value={stats.corrected} color="green" />
        <StatCard label="الإجمالي" value={stats.total} color="gray" />
      </div>
      <div className="flex flex-wrap gap-2 border-b border-gray-200 p-4">
        <FilterButton label="الكل" count={stats.total} active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        <FilterButton label="المحرك" count={stats.engineOnly} active={filter === 'ENGINE_ONLY'} onClick={() => setFilter('ENGINE_ONLY')} />
        <FilterButton label="المحرر" count={stats.editorOnly} active={filter === 'EDITOR_ONLY'} onClick={() => setFilter('EDITOR_ONLY')} />
        <FilterButton label="مصحّح" count={stats.corrected} active={filter === 'CORRECTED'} onClick={() => setFilter('CORRECTED')} />
      </div>
      <div className="max-h-[500px] overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-gray-500">لا توجد عناصر مطابقة للفلتر</div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <TrackingItem
                key={item.correction.id}
                item={item}
                isSelected={selectedCorrectionId === item.correction.id}
                onSelect={() => {
                  setSelectedCorrectionId(item.correction.id);
                  select({ kind: 'DIFFERENCE', id: item.correction.targetId, differenceId: item.correction.targetId }, 'tracking');
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'amber' | 'green' | 'gray' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200', amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200', gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return <div className={`rounded-lg border p-3 ${colorClasses[color]}`}><div className="text-2xl font-bold">{toArabicDigits(value)}</div><div className="text-xs font-medium">{label}</div></div>;
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {label} ({toArabicDigits(count)})
    </button>
  );
}

function TrackingItem({ item, isSelected, onSelect }: { item: TrackingItemData; isSelected: boolean; onSelect: () => void }) {
  const { correction, status, finalResult } = item;
  const statusConfig: Record<TrackingStatus, { label: string; color: 'blue' | 'amber' | 'green' | 'gray'; icon: string }> = {
    ENGINE_ONLY: { label: 'المحرك', color: 'blue', icon: '🤖' },
    EDITOR_ONLY: { label: 'المحرر', color: 'amber', icon: '✏️' },
    CORRECTED: { label: 'مصحّح', color: 'green', icon: '✓' },
    UNKNOWN: { label: 'غير معروف', color: 'gray', icon: '?' },
  };
  const config = statusConfig[status];
  const colorClasses = { blue: 'border-blue-200 bg-blue-50', amber: 'border-amber-200 bg-amber-50', green: 'border-green-200 bg-green-50', gray: 'border-gray-200 bg-gray-50' };
  const timestamp = correctionTimestamp(correction);

  return (
    <div onClick={onSelect} className={`cursor-pointer rounded-lg border p-3 transition-colors ${isSelected ? `${colorClasses[config.color]} ring-2 ring-blue-500` : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="font-medium text-gray-900">{correction.targetType === 'LINE' ? 'سطر' : 'اختلاف'}</span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium">{config.label}</span>
        </div>
        {timestamp && <span className="text-xs text-gray-500">{formatDate(timestamp)}</span>}
      </div>
      {isSelected && (
        <div className="mt-3 space-y-2">
          <ResultBox label="🤖 نتيجة المحرك" color="blue" value={correctionEngineResult(correction)} />
          <ResultBox label="✏️ قرار المحرر" color="amber" value={correctionEditorResult(correction)} />
          <ResultBox label="✓ النتيجة النهائية" color="green" value={finalResult} />
          {correction.reason && <div className="rounded border border-gray-200 bg-gray-50 p-2"><div className="text-xs font-medium text-gray-700">السبب</div><div className="mt-1 text-sm text-gray-600">{correction.reason}</div></div>}
          <CreateRuleFromCorrectionButton correction={correction} />
        </div>
      )}
    </div>
  );
}

function ResultBox({ label, color, value }: { label: string; color: 'blue' | 'amber' | 'green'; value: unknown }) {
  if (value === undefined || value === null) return null;
  const colors = { blue: 'border-blue-200 bg-blue-50 text-blue-800', amber: 'border-amber-200 bg-amber-50 text-amber-800', green: 'border-green-200 bg-green-50 text-green-800' };
  return <div className={`rounded border p-2 ${colors[color]}`}><div className="text-xs font-medium">{label}</div><div className="mt-1 text-sm">{formatResult(value)}</div></div>;
}

function formatResult(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    if (typeof record.title === 'string') return record.title;
    if (typeof record.text === 'string') return record.text;
    try { return JSON.stringify(record); } catch { return 'نتيجة غير قابلة للعرض'; }
  }
  return result === undefined || result === null ? 'لا يوجد' : String(result);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ar-SA');
}

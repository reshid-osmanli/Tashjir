'use client';

import { useMemo, useState } from 'react';
import { getQiraahByOrder } from '@/data/qiraat-data/qiraat';
import { getLocalAyahWords, LocalAyahWord } from '@/data/quran';
import { useEditorStore } from '@/stores/editor-store';
import { LineType, TashjeerLine } from '@/types';

interface PropertiesPanelProps {
  ayahId: number;
  surahId: number;
}

const lineTypeLabels: Record<LineType, string> = {
  USUL: 'أصول',
  FARSH: 'فرش',
  MADUD: 'مدود',
  HAMZ: 'همز',
  WAQF: 'وقف',
  TAJWEED: 'تجويد',
};

export function PropertiesPanel({ ayahId, surahId }: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<'word' | 'tashjeer' | 'qiraat'>('word');
  const {
    currentLineType,
    currentQiraahId,
    currentTool,
    selectedLineId,
    selectedWordId,
  } = useEditorStore();

  const words = useMemo(() => getLocalAyahWords(ayahId, surahId), [ayahId, surahId]);
  const wordById = useMemo(() => new Map(words.map((word) => [word.id, word])), [words]);
  const selectedWord = selectedWordId ? wordById.get(selectedWordId) : undefined;
  const selectedLine = useMemo(
    () => readStoredLine(surahId, ayahId, selectedLineId),
    [ayahId, selectedLineId, surahId]
  );
  const currentQiraah = getQiraahByOrder(currentQiraahId);

  return (
    <div className="properties-panel w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-bold text-gray-900">لوحة الخصائص</h3>
        <p className="text-sm text-gray-500 mt-1">
          سورة {surahId} - آية {ayahId}
        </p>
      </div>

      <div className="flex border-b border-gray-200">
        <TabButton
          active={activeTab === 'word'}
          onClick={() => setActiveTab('word')}
          label="الكلمة"
        />
        <TabButton
          active={activeTab === 'tashjeer'}
          onClick={() => setActiveTab('tashjeer')}
          label="التشجير"
        />
        <TabButton
          active={activeTab === 'qiraat'}
          onClick={() => setActiveTab('qiraat')}
          label="القراءات"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'word' && (
          <WordProperties selectedWord={selectedWord} totalWords={words.length} />
        )}
        {activeTab === 'tashjeer' && (
          <TashjeerProperties
            selectedLine={selectedLine}
            selectedLineId={selectedLineId}
            currentLineType={currentLineType}
            wordById={wordById}
          />
        )}
        {activeTab === 'qiraat' && (
          <QiraatProperties
            currentTool={currentTool}
            currentLineType={currentLineType}
            qiraahLabel={currentQiraah ? `${currentQiraah.narrator} عن ${currentQiraah.name}` : '-'}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-medium transition-colors ${
        active
          ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
      type="button"
    >
      {label}
    </button>
  );
}

function WordProperties({
  selectedWord,
  totalWords,
}: {
  selectedWord?: LocalAyahWord;
  totalWords: number;
}) {
  if (!selectedWord) {
    return (
      <div className="space-y-4">
        <PropertySection title="ملخص الآية">
          <PropertyRow label="عدد الكلمات" value={totalWords} />
          <PropertyRow label="الكلمة المحددة" value="-" />
        </PropertySection>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PropertySection title="معلومات الكلمة">
        <PropertyRow label="النص" value={selectedWord.text} />
        <PropertyRow label="بدون تشكيل" value={stripHarakat(selectedWord.text)} />
        <PropertyRow label="الترتيب" value={selectedWord.position} />
      </PropertySection>

      <PropertySection title="التحليل">
        <PropertyRow label="الحروف" value={stripHarakat(selectedWord.text).length} />
        <PropertyRow label="الحركات" value={countHarakat(selectedWord.text)} />
      </PropertySection>
    </div>
  );
}

function TashjeerProperties({
  selectedLine,
  selectedLineId,
  currentLineType,
  wordById,
}: {
  selectedLine: TashjeerLine | null;
  selectedLineId: number | null;
  currentLineType: LineType;
  wordById: Map<number, LocalAyahWord>;
}) {
  if (!selectedLine) {
    return (
      <div className="space-y-4">
        <PropertySection title="خط التشجير">
          <PropertyRow label="الأداة الحالية" value={lineTypeLabels[currentLineType]} />
          <PropertyRow label="الخط المحدد" value={selectedLineId ? String(selectedLineId) : '-'} />
        </PropertySection>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PropertySection title="خط التشجير">
        <PropertyRow label="النوع" value={lineTypeLabels[selectedLine.type]} />
        <PropertyRow label="عدد العقد" value={selectedLine.nodes.length} />
        <PropertyRow label="الموضع الرأسي" value={Math.round(selectedLine.yPosition)} />
      </PropertySection>

      <PropertySection title="العقد">
        <div className="space-y-2">
          {selectedLine.nodes.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد عقد في هذا الخط.</p>
          ) : (
            selectedLine.nodes.map((node) => (
              <NodeItem
                key={String(node.id)}
                word={wordById.get(node.wordId)?.text ?? `#${node.wordId}`}
                qiraah={getQiraahLabel(node.qiraahId)}
                position={getNodePositionLabel(node.position)}
              />
            ))
          )}
        </div>
      </PropertySection>
    </div>
  );
}

function QiraatProperties({
  currentTool,
  currentLineType,
  qiraahLabel,
}: {
  currentTool: string;
  currentLineType: LineType;
  qiraahLabel: string;
}) {
  return (
    <div className="space-y-4">
      <PropertySection title="الاختيار الحالي">
        <PropertyRow label="الرواية" value={qiraahLabel} />
        <PropertyRow label="نوع الخط" value={lineTypeLabels[currentLineType]} />
        <PropertyRow label="الأداة" value={getToolLabel(currentTool)} />
      </PropertySection>
    </div>
  );
}

function PropertySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-900 mb-2">{title}</h4>
      <div className="bg-gray-50 rounded-lg p-3">{children}</div>
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-left">{value}</span>
    </div>
  );
}

function NodeItem({
  word,
  qiraah,
  position,
}: {
  word: string;
  qiraah: string;
  position: string;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-2">
      <div className="text-sm font-medium text-gray-900">{word}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>{qiraah}</span>
        <span>{position}</span>
      </div>
    </div>
  );
}

function readStoredLine(surahId: number, ayahId: number, selectedLineId: number | null): TashjeerLine | null {
  if (!selectedLineId || typeof window === 'undefined') return null;

  try {
    const serialized = window.localStorage.getItem(`tashjeer-lines:${surahId}:${ayahId}`);
    const lines = serialized ? (JSON.parse(serialized) as TashjeerLine[]) : [];
    return lines.find((line) => String(line.id) === String(selectedLineId)) ?? null;
  } catch {
    return null;
  }
}

function stripHarakat(value: string): string {
  return value.replace(/[\u064B-\u065F\u0670]/g, '');
}

function countHarakat(value: string): number {
  return [...value].filter((char) => /[\u064B-\u065F\u0670]/.test(char)).length;
}

function getQiraahLabel(qiraahId?: number): string {
  const qiraah = qiraahId ? getQiraahByOrder(qiraahId) : undefined;
  return qiraah ? qiraah.narrator : '-';
}

function getNodePositionLabel(position: string): string {
  if (position === 'TOP') return 'أعلى';
  if (position === 'MIDDLE') return 'وسط';
  return 'أسفل';
}

function getToolLabel(tool: string): string {
  const labels: Record<string, string> = {
    select: 'تحديد',
    'line-usul': 'خط أصول',
    'line-farsh': 'خط فرش',
    'line-madud': 'خط مدود',
    delete: 'حذف',
  };
  return labels[tool] ?? tool;
}

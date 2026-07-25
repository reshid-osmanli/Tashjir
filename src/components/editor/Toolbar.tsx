'use client';

import { LineType } from '@/types';
import { QIRAAT_ORDER_TAYYIBAH } from '@/data/qiraat-data/qiraat';
import { getLineColor } from '@/lib/tashjeer/color-system';
import { useEditorStore } from '@/stores/editor-store';

interface ToolbarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onResetView: () => void;
  showProperties: boolean;
  onToggleProperties: () => void;
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
}

export function Toolbar({
  zoom,
  onZoomChange,
  onResetView,
  showProperties,
  onToggleProperties,
  hasUnsavedChanges = false,
  onSave,
}: ToolbarProps) {
  const {
    currentTool,
    currentQiraahId,
    showGrid,
    showRulers,
    setCurrentTool,
    setCurrentLineType,
    setCurrentQiraah,
    toggleGrid,
    toggleRulers,
  } = useEditorStore();

  const chooseLineTool = (type: LineType, tool: 'line-usul' | 'line-farsh' | 'line-madud') => {
    setCurrentLineType(type);
    setCurrentTool(tool);
  };

  return (
    <div className="toolbar flex flex-wrap items-center justify-between gap-3 bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700 ml-2">إضافة خط:</span>

        <ToolbarButton
          color={getLineColor('USUL')}
          label="أصول"
          onClick={() => chooseLineTool('USUL', 'line-usul')}
          title="إضافة خط أصول"
          active={currentTool === 'line-usul'}
        />

        <ToolbarButton
          color={getLineColor('FARSH')}
          label="فرش"
          onClick={() => chooseLineTool('FARSH', 'line-farsh')}
          title="إضافة خط فرش"
          active={currentTool === 'line-farsh'}
        />

        <ToolbarButton
          color={getLineColor('MADUD')}
          label="مدود"
          onClick={() => chooseLineTool('MADUD', 'line-madud')}
          title="إضافة خط مدود"
          active={currentTool === 'line-madud'}
        />

        <select
          value={currentQiraahId}
          onChange={(event) => setCurrentQiraah(Number(event.target.value))}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          title="الرواية"
        >
          {QIRAAT_ORDER_TAYYIBAH.map((qiraah) => (
            <option key={qiraah.id} value={qiraah.id}>
              {qiraah.narrator} عن {qiraah.name}
            </option>
          ))}
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          color="#64748b"
          label="تحديد"
          onClick={() => setCurrentTool('select')}
          title="تحديد كلمة أو خط"
          active={currentTool === 'select'}
        />

        <ToolbarButton
          color="#dc2626"
          label="حذف"
          onClick={() => setCurrentTool('delete')}
          title="حذف عقدة أو خط"
          active={currentTool === 'delete'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton
          color="#64748b"
          label="-"
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
          title="تصغير"
        />

        <span className="text-sm text-gray-600 w-16 text-center">
          {Math.round(zoom * 100)}%
        </span>

        <ToolbarButton
          color="#64748b"
          label="+"
          onClick={() => onZoomChange(Math.min(3, zoom + 0.1))}
          title="تكبير"
        />

        <ToolbarButton
          color="#64748b"
          label="ضبط"
          onClick={onResetView}
          title="إعادة ضبط العرض"
        />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          color={showGrid ? '#059669' : '#64748b'}
          label="شبكة"
          onClick={toggleGrid}
          title="إظهار الشبكة"
          active={showGrid}
        />

        <ToolbarButton
          color={showRulers ? '#059669' : '#64748b'}
          label="مساطر"
          onClick={toggleRulers}
          title="إظهار المساطر"
          active={showRulers}
        />

        <ToolbarButton
          color={showProperties ? '#059669' : '#64748b'}
          label="خصائص"
          onClick={onToggleProperties}
          title="لوحة الخصائص"
          active={showProperties}
        />

        <ToolbarButton
          color={hasUnsavedChanges ? '#d97706' : '#059669'}
          label={hasUnsavedChanges ? 'حفظ*' : 'حفظ'}
          onClick={onSave ?? (() => {})}
          title="حفظ التشجير محليًا"
          active={hasUnsavedChanges}
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  color,
  label,
  onClick,
  title,
  active = false,
}: {
  color: string;
  label: string;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-9 min-w-9 px-2 flex items-center justify-center rounded-lg border text-sm font-bold transition-all ${
        active
          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
      }`}
      style={{ color: active ? undefined : color }}
      type="button"
    >
      {label}
    </button>
  );
}

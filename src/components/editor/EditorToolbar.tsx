// شريط أدوات المحرر - Editor Toolbar
// مشروع التشجير - نظام القراءات العشر
//
// الشريط مقسّم إلى مجموعات منطقية:
//   الأدوات | التراجع | العرض | التصفية | الحفظ والتصدير
// كل زر له اختصار لوحة مفاتيح معروض في التلميح (title).

'use client';

import Link from 'next/link';
import { ClipboardControls } from './ClipboardControls';
import { HistoryControls } from './HistoryControls';
import { useEditorStore, type EditorTool } from '@/stores/editor-store';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor } from '@/lib/tashjeer/color-system';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { saveEngineSettings } from '@/lib/tashjeer/engine-settings';
import { formatPercent, toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { VariantCategory } from '@/types';

// Immutable UI identity tables. Keys denote finite controls, never row positions.
const UI_EditorToolbar_0 = {
  "select": "A745",
  "mark": "A746",
  "erase": "A747"
} as const;

const UI_EditorToolbar_1 = {
  "1": "A758",
  "2": "A761",
  "3": "A762",
  "4": "A763",
  "0.25": "A755",
  "0.5": "A756",
  "0.75": "A757",
  "1.25": "A759",
  "1.5": "A760"
} as const;

const UI_EditorToolbar_2 = {
  "TAHQIQ": "A776",
  "USUL": "A777",
  "FARSH": "A778",
  "MADUD": "A779",
  "HAMZ": "A780",
  "WAQF": "A781",
  "TAJWEED": "A782"
} as const;



/** مستويات تكبير جاهزة، حتى لا يضطر المحقق إلى نقر «+» عشر مرات. */
const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

interface EditorToolbarProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onExport: () => void;
  onImport: () => void;
  onShowShortcuts: () => void;
}

const TOOLS: Array<{ id: EditorTool; label: string; hint: string; icon: string }> = [
  { id: 'select', label: 'تحديد', hint: 'أداة التحديد (V)', icon: '⌖' },
  { id: 'mark', label: 'تعليم', hint: 'تعليم كلمات لإنشاء اختلاف (M)', icon: '✚' },
  { id: 'erase', label: 'مسح', hint: 'إخفاء خط بالنقر عليه (E)', icon: '⌫' },
];

export function EditorToolbar({
  fontSize,
  onFontSizeChange,
  onExport,
  onImport,
  onShowShortcuts,
}: EditorToolbarProps) {
  const {
    currentTool,
    setTool,
    markingMode,
    setMarkingMode,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetView,
    filter,
    setFilter,
    toggleCategory,
    undo,
    redo,
    canUndo,
    canRedo,
    save,
    isDirty,
    showPropertiesPanel,
    togglePropertiesPanel,
    showVariantsPanel,
    toggleVariantsPanel,
    regenerateBranches,
  } = useEditorStore();

  // إعدادات المحرك في متناول اليد: تكوين السطر وسطر النص الواحد يُبدَّلان
  // كثيرا أثناء العمل، فلا يُطلب من المحقق فتح لوحة التحكم لكل تبديل.
  const engine = useEngineSettings();

  return (
    <div data-ui-id="A101" className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-stone-200 bg-white px-3 py-2">
      {/* الأدوات */}
      <Group label="الأدوات" data-ui-id="A102">
        {TOOLS.map((tool) => (
          <ToolButton data-ui-id={UI_EditorToolbar_0[tool.id as keyof typeof UI_EditorToolbar_0]}
            key={tool.id}
            active={currentTool === tool.id}
            title={tool.hint}
            onClick={() => setTool(tool.id)}
          >
            <span aria-hidden className="text-base leading-none">
              {tool.icon}
            </span>
            <span>{tool.label}</span>
          </ToolButton>
        ))}
      </Group>

      <Group data-ui-id="A748" label="نمط التعليم">
        <span className="ms-1 text-[11px] text-stone-500">حدّد:</span>
        <ToggleButton data-ui-id="A749"
          active={markingMode === 'WORDS'}
          title="تحديد كلمات كاملة لإنشاء اختلاف"
          onClick={() => setMarkingMode('WORDS')}
        >
          كلمات
        </ToggleButton>
        <ToggleButton data-ui-id="A750"
          active={markingMode === 'CHARACTERS'}
          title="تحديد حروف مرئية مع تشكيلها لإنشاء حكم تجويد دقيق"
          onClick={() => setMarkingMode('CHARACTERS')}
        >
          حروف
        </ToggleButton>
      </Group>

      <Divider />

      {/* التراجع */}
      <Group data-ui-id="A751" label="التاريخ">
        <ToolButton data-ui-id="A103" title="تراجع (Ctrl+Z)" onClick={undo} disabled={!canUndo()}>
          تراجع
        </ToolButton>
        <ToolButton data-ui-id="A104" title="إعادة (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo()}>
          إعادة
        </ToolButton>
      </Group>

      <Divider />

      <ClipboardControls />
      <HistoryControls />

      {/* العرض */}
      <Group data-ui-id="A752" label="العرض">
        <ToolButton data-ui-id="A753" title="تصغير (Ctrl+-)" onClick={zoomOut}>
          −
        </ToolButton>
        <select
          data-ui-id="A137"
          value={ZOOM_PRESETS.includes(round2(zoom)) ? String(round2(zoom)) : 'custom'}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next > 0) setZoom(next);
          }}
          title="مستوى التكبير"
          aria-label="مستوى التكبير"
          className="h-7 min-w-20 rounded-md border border-stone-200 bg-white px-1 text-center text-xs text-stone-700"
        >
          {!ZOOM_PRESETS.includes(round2(zoom)) && (
            <option data-ui-id="A754" value="custom">{formatPercent(zoom)}</option>
          )}
          {ZOOM_PRESETS.map((preset) => (
            <option data-ui-id={UI_EditorToolbar_1[String(preset) as keyof typeof UI_EditorToolbar_1]} key={preset} value={preset}>
              {formatPercent(preset)}
            </option>
          ))}
        </select>
        <ToolButton data-ui-id="A764" title="تكبير (Ctrl+=)" onClick={zoomIn}>
          +
        </ToolButton>
        <ToolButton data-ui-id="A765" title="ملء العرض وإعادة الضبط (Ctrl+0)" onClick={resetView}>
          ملء العرض
        </ToolButton>

        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          حجم الخط
          <input data-ui-id="A766"
            type="range"
            min={24}
            max={72}
            step={2}
            value={fontSize}
            onChange={(event) => onFontSizeChange(Number(event.target.value))}
            className="h-1 w-24 accent-emerald-600"
            aria-label="حجم خط المصحف"
          />
          <span className="w-7 text-center">{toArabicDigits(fontSize)}</span>
        </label>
      </Group>

      <Divider />

      {/* تكوين الشجرة: ما يميز التشجير المعتمد عن العرض الموضعي */}
      <Group data-ui-id="A767" label="تكوين الشجرة">
        <ToggleButton data-ui-id="A768"
          active={engine.lineComposition === 'COMBINED'}
          title="سطر لكل تركيب قراءة: يجتمع المد والفرش والإدغام في سطر الراوي الواحد"
          onClick={() =>
            saveEngineSettings({
              ...engine,
              lineComposition: engine.lineComposition === 'COMBINED' ? 'PER_VARIANT' : 'COMBINED',
            })
          }
        >
          {engine.lineComposition === 'COMBINED' ? 'أوجه مركّبة' : 'سطر لكل وجه'}
        </ToggleButton>
        <ToggleButton data-ui-id="A769"
          active={engine.singleLineText}
          title="نص الآية في سطر واحد مهما طال، مع التمرير الأفقي"
          onClick={() => saveEngineSettings({ ...engine, singleLineText: !engine.singleLineText })}
        >
          سطر واحد
        </ToggleButton>
      </Group>

      <Divider />

      {/* خيارات الرسم */}
      <Group data-ui-id="A770" label="الرسم">
        <ToggleButton data-ui-id="A771"
          active={filter.showLabels}
          title="بطاقات الأوجه (L)"
          onClick={() => setFilter({ showLabels: !filter.showLabels })}
        >
          البطاقات
        </ToggleButton>
        <ToggleButton data-ui-id="A772"
          active={filter.showGrid}
          title="الشبكة (G)"
          onClick={() => setFilter({ showGrid: !filter.showGrid })}
        >
          الشبكة
        </ToggleButton>
        <ToggleButton data-ui-id="A773"
          active={filter.showRulers}
          title="المساطر"
          onClick={() => setFilter({ showRulers: !filter.showRulers })}
        >
          المساطر
        </ToggleButton>
        <ToggleButton data-ui-id="A774"
          active={filter.showAnchors}
          title="نقاط الارتباط على الكلمات"
          onClick={() => setFilter({ showAnchors: !filter.showAnchors })}
        >
          الارتباط
        </ToggleButton>
      </Group>

      <Divider />

      {/* تصفية الفئات */}
      <Group data-ui-id="A775" label="الفئات">
        {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((category) => {
          const active = filter.categories.includes(category);
          return (
            <button data-ui-id={UI_EditorToolbar_2[category as keyof typeof UI_EditorToolbar_2]}
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              title={`إظهار أو إخفاء ${CATEGORY_LABELS[category]}`}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                active
                  ? 'border-stone-300 bg-stone-50 text-stone-800'
                  : 'border-stone-200 bg-white text-stone-400'
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: active ? getCategoryColor(category) : '#d6d3d1',
                }}
              />
              {CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </Group>

      {/* اليسار: اللوحات والحفظ */}
      <div className="ms-auto flex items-center gap-2">
        <ToggleButton data-ui-id="A783"
          active={showVariantsPanel}
          title="لوحة الاختلافات (B)"
          onClick={toggleVariantsPanel}
        >
          الاختلافات
        </ToggleButton>
        <ToggleButton data-ui-id="A784"
          active={showPropertiesPanel}
          title="لوحة الخصائص (P)"
          onClick={togglePropertiesPanel}
        >
          الخصائص
        </ToggleButton>

        <Divider />

        <ToolButton data-ui-id="A785" title="إعادة توليد الخطوط من الاختلافات" onClick={regenerateBranches}>
          إعادة التوليد
        </ToolButton>
        <ToolButton data-ui-id="A135" title="تصدير المستند إلى ملف JSON" onClick={onExport}>
          تصدير
        </ToolButton>
        <ToolButton data-ui-id="A786" title="استيراد مستند من ملف JSON" onClick={onImport}>
          استيراد
        </ToolButton>
        <Link data-ui-id="A787"
          href="/tracking"
          title="ماذا وجد المحرك وماذا صحّحت؟ — صفحة التتبع"
          className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-700 transition-colors hover:bg-stone-50"
        >
          التتبع
        </Link>
        <ToolButton data-ui-id="A788" title="اختصارات لوحة المفاتيح" onClick={onShowShortcuts}>
          ؟
        </ToolButton>

        <button
          type="button"
          data-ui-id="A136"
          onClick={save}
          title="حفظ (Ctrl+S)"
          className={`rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors ${
            isDirty ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {isDirty ? 'حفظ التغييرات' : 'محفوظ'}
        </button>
      </div>
    </div>
  );
}

// ==================== عناصر واجهة صغيرة ====================

/** تقريب لمنزلتين، حتى تُطابق قيمة التكبير أحد المستويات الجاهزة. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function Group({ label, children, ...attributes }: React.HTMLAttributes<HTMLDivElement> & { label: string }) {
  return (
    <div {...attributes} className="flex items-center gap-1" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px bg-stone-200" aria-hidden />;
}

function ToolButton({
  children,
  title,
  active = false,
  disabled = false,
  className,
  ...attributes
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      {...attributes}
      title={title}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

function ToggleButton(props: {
  'data-ui-id'?: string;
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active: boolean;
}) {
  return <ToolButton {...props} />;
}

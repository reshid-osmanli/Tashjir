// ضبط اللوحات ووضع الإخفاء - Panel Layout Controls (FR-ED-12)
//
// واجهة واحدة للمنطق نفسه في موضعين:
//   • `PanelLayoutMenu` — قائمة منبثقة في شريط أدوات المحرر، للضبط السريع
//     أثناء العمل بلا مغادرة الآية.
//   • `PanelLayoutSettings` — البطاقة الكاملة في /settings، وفيها حساسية
//     الحواف والأزمنة وشرح السلوك.
//
// كل لوحة لها مفتاحان مستقلان: **ظاهرة** (تُرسم أصلًا) و**مثبتة** (تأخذ
// مساحتها ولا تُخفى تلقائيًا). ومنهما يُشتق وضعها الفعلي، فيرى المستخدم
// الأثر بكلمة واحدة: في التخطيط / فوقية / مخفية.

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePanelStore } from '@/stores/panel-store';
import {
  PANEL_EDGE,
  PANEL_IDS,
  PANEL_LABELS,
  countHiddenPanels,
  countOverlayPanels,
  panelPlacement,
  type PanelEdge,
  type PanelId,
  type PanelPlacement,
} from '@/lib/ui/panel-layout';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

const EDGE_LABELS: Record<PanelEdge, string> = {
  top: 'الحافة العلوية',
  start: 'الحافة اليمنى',
  end: 'الحافة اليسرى',
  bottom: 'الحافة السفلية',
};

const PLACEMENT_LABELS: Record<PanelPlacement, string> = {
  flow: 'في التخطيط',
  overlay: 'فوقية بالحواف',
  hidden: 'مخفية',
};

/** وصف مختصر لحالة لوحة، كما يفهمها المستخدم لا كما تُخزَّن. */
function describePlacement(placement: PanelPlacement, id: PanelId): string {
  if (placement === 'overlay') {
    const edge = PANEL_EDGE[id];
    return edge ? `فوقية — تكشفها ${EDGE_LABELS[edge]}` : 'فوقية';
  }
  return PLACEMENT_LABELS[placement];
}

// ==================== القائمة المنبثقة في المحرر ====================

export function PanelLayoutMenu() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const prefs = usePanelStore((state) => state.prefs);
  const toggleAutoHide = usePanelStore((state) => state.toggleAutoHide);
  const togglePanelVisible = usePanelStore((state) => state.togglePanelVisible);
  const togglePanelPinned = usePanelStore((state) => state.togglePanelPinned);
  const compactLayout = usePanelStore((state) => state.compactLayout);
  const resetLayout = usePanelStore((state) => state.resetLayout);

  // النقر خارج القائمة يغلقها، وEsc كذلك — سلوك القوائم المعتاد.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const hidden = countHiddenPanels(prefs);
  const overlay = countOverlayPanels(prefs);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="إظهار اللوحات وإخفاؤها ووضع الإخفاء التلقائي (H)"
        className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
          prefs.autoHide
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
        }`}
      >
        اللوحات
        {overlay > 0 && <span className="ms-1 text-emerald-700">({toArabicDigits(overlay)})</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="ضبط اللوحات"
          className="absolute end-0 top-full z-50 mt-1 w-[19rem] rounded-xl border border-stone-200 bg-white p-3 shadow-2xl"
        >
          <label className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
            <span className="text-[11px] leading-relaxed text-emerald-950">
              <span className="block font-semibold">الإخفاء التلقائي بالحواف</span>
              اللوحة غير المثبتة لا تأخذ مساحة، وتظهر فوق المحتوى عند ملامسة حافتها.
            </span>
            <Switch checked={prefs.autoHide} onChange={toggleAutoHide} label="الإخفاء التلقائي" />
          </label>

          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {PANEL_IDS.map((id) => {
              const panel = prefs.panels[id];
              const placement = panelPlacement(prefs, id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-stone-200 px-2 py-1.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-stone-800">
                      {PANEL_LABELS[id]}
                    </span>
                    <span className="block truncate text-[10px] text-stone-500">
                      {describePlacement(placement, id)}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => togglePanelVisible(id)}
                    aria-pressed={panel.visible}
                    title={panel.visible ? 'إخفاء اللوحة' : 'إظهار اللوحة'}
                    className={`rounded border px-1.5 py-1 text-[10px] ${
                      panel.visible
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-stone-300 bg-white text-stone-500'
                    }`}
                  >
                    {panel.visible ? 'ظاهرة' : 'مخفية'}
                  </button>

                  <button
                    type="button"
                    onClick={() => togglePanelPinned(id)}
                    aria-pressed={panel.pinned}
                    disabled={!panel.visible}
                    title={
                      panel.pinned
                        ? 'فكّ التثبيت: تصير فوقية تُكشف من الحافة'
                        : 'تثبيت: تبقى ظاهرة وتأخذ مساحتها'
                    }
                    className="rounded border border-stone-300 bg-white px-1.5 py-1 text-[10px] text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                  >
                    {panel.pinned ? '📌 مثبّتة' : 'تثبيت'}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-2">
            <button
              type="button"
              onClick={compactLayout}
              className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[10px] text-stone-700 hover:bg-stone-50"
            >
              وضع الشاشة الصغيرة
            </button>
            <button
              type="button"
              onClick={resetLayout}
              className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[10px] text-stone-700 hover:bg-stone-50"
            >
              استعادة الافتراضي
            </button>
            <span className="ms-auto text-[10px] text-stone-500">
              الاختصار <kbd className="rounded border border-stone-300 bg-stone-50 px-1">H</kbd>
              {hidden > 0 && ` · ${toArabicDigits(hidden)} مخفية`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== بطاقة الإعدادات ====================

export function PanelLayoutSettings() {
  const prefs = usePanelStore((state) => state.prefs);
  const setAutoHide = usePanelStore((state) => state.setAutoHide);
  const setPanelVisible = usePanelStore((state) => state.setPanelVisible);
  const setPanelPinned = usePanelStore((state) => state.setPanelPinned);
  const setSensitivity = usePanelStore((state) => state.setSensitivity);
  const compactLayout = usePanelStore((state) => state.compactLayout);
  const resetLayout = usePanelStore((state) => state.resetLayout);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="max-w-2xl text-xs leading-relaxed text-emerald-950">
          <p className="font-semibold">وضع الإخفاء التلقائي (الاحترافي)</p>
          <p className="mt-1">
            كل لوحة غير مثبتة تصير <strong>طبقة فوقية</strong>: لا تأخذ مساحة من المحرر،
            وتظهر فوق المحتوى عند ملامسة حافتها ثم تختفي بعد الابتعاد، بلا إزاحة
            لتخطيط المحرر ولا لمواضع الكلمات والأسطر. اللوحة المثبتة تبقى ظاهرة
            وتأخذ مساحتها. والتفضيل عام للمشروع يُحفظ في هذا المتصفح ويُستعاد في
            الجلسة التالية.
          </p>
          <p className="mt-1 text-emerald-800">
            الحواف: العلوية ← الشريط العلوي وشريط الآيات · اليمنى ← لوحة الخصائص ·
            اليسرى ← لوحة الاختلافات · السفلى ← شريط الحالة. وقائمة التطبيق
            الجانبية تنطوي إلى شريط رفيع يتمدد فوق المحتوى عند المرور عليه.
          </p>
        </div>
        <Switch checked={prefs.autoHide} onChange={setAutoHide} label="الإخفاء التلقائي" />
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <table className="w-full text-right text-xs">
          <thead className="bg-stone-50 text-[11px] text-stone-600">
            <tr>
              <th className="px-3 py-2 font-medium">اللوحة</th>
              <th className="px-3 py-2 font-medium">الحالة</th>
              <th className="px-3 py-2 font-medium">ظاهرة</th>
              <th className="px-3 py-2 font-medium">مثبتة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {PANEL_IDS.map((id) => {
              const panel = prefs.panels[id];
              const placement = panelPlacement(prefs, id);
              return (
                <tr key={id}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-stone-800">{PANEL_LABELS[id]}</span>
                    <span className="block text-[10px] text-stone-500">
                      {PANEL_EDGE[id] ? EDGE_LABELS[PANEL_EDGE[id]!] : 'بلا حافة مستقلة'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-stone-600">
                    {describePlacement(placement, id)}
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={panel.visible}
                      onChange={(value) => setPanelVisible(id, value)}
                      label={`إظهار ${PANEL_LABELS[id]}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={panel.pinned}
                      disabled={!panel.visible}
                      onChange={(value) => setPanelPinned(id, value)}
                      label={`تثبيت ${PANEL_LABELS[id]}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SensitivityField
          label={`منطقة الحافة: ${toArabicDigits(prefs.edgeZonePx)}px`}
          hint="عرض الشريط الذي يُفعّل الكشف عند الحافة (١٢–١٦ أنسب)."
          value={prefs.edgeZonePx}
          min={4}
          max={48}
          step={1}
          onChange={(edgeZonePx) => setSensitivity({ edgeZonePx })}
        />
        <SensitivityField
          label={`زمن الظهور: ${toArabicDigits(prefs.revealDelayMs)}ms`}
          hint="كم يمكث المؤشر في الحافة قبل الكشف؛ يمنع الفتح العرضي عند العبور."
          value={prefs.revealDelayMs}
          min={0}
          max={600}
          step={10}
          onChange={(revealDelayMs) => setSensitivity({ revealDelayMs })}
        />
        <SensitivityField
          label={`مهلة الإخفاء: ${toArabicDigits(prefs.hideDelayMs)}ms`}
          hint="مهلة بعد الابتعاد قبل الإخفاء؛ تمنع الوميض بين الحافة واللوحة."
          value={prefs.hideDelayMs}
          min={0}
          max={2000}
          step={20}
          onChange={(hideDelayMs) => setSensitivity({ hideDelayMs })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={compactLayout}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
        >
          وضع الشاشة الصغيرة (إخفاء مفعّل، بلا تثبيت)
        </button>
        <button
          type="button"
          onClick={resetLayout}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
        >
          استعادة الافتراضي
        </button>
        <span className="ms-auto text-[11px] text-stone-500">
          في المحرر: مفتاح <kbd className="rounded border border-stone-300 bg-stone-50 px-1">H</kbd>{' '}
          لتبديل الوضع، و<kbd className="rounded border border-stone-300 bg-stone-50 px-1">Esc</kbd>{' '}
          لإغلاق المكشوف، ومقابض عائمة على كل حافة للمس.
        </span>
      </div>
    </div>
  );
}

// ==================== عناصر صغيرة ====================

function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-emerald-600' : 'bg-stone-300'
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
          checked ? 'end-1' : 'end-6'
        }`}
      />
    </button>
  );
}

function SensitivityField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-stone-200 p-3 text-xs text-stone-700">
      <span className="block font-medium text-stone-800">{label}</span>
      <span className="mt-0.5 block text-[11px] leading-relaxed text-stone-500">{hint}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-emerald-600"
      />
    </label>
  );
}

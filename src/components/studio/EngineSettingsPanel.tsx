// إعدادات سلوك المحرك — المصدر الوحيد لإعدادات الرسم والترتيب (FR-EN-01)
//
// نُقلت هنا من /admin. التخزين ما زال في engine-settings لأن المحرك الكودي
// يقرأه مباشرة؛ هذه اللوحة هي واجهة التحرير الوحيدة، فلا توجد نسخة ثانية.

'use client';

import { useEffect, useState } from 'react';
import {
  resetEngineSettings,
  saveEngineSettings,
  type AlternativeOrderRule,
  type LineCompositionMode,
  type LineSpanMode,
  type SymbolDisplay,
  type TashjeerEngineSettings,
  type TieBreakOrder,
} from '@/lib/tashjeer/engine-settings';
import { useEngineSettings } from '@/hooks/useEngineSettings';

export function EngineSettingsPanel() {
  const initial = useEngineSettings();
  const [settings, setSettings] = useState<TashjeerEngineSettings>(initial);
  const [message, setMessage] = useState('');

  useEffect(() => setSettings(initial), [initial]);

  // يتغير المفتاح عند تبديل صفحة/تحديث الإعداد من نافذة أخرى، مع إبقاء التحرير
  // الجاري مستقلا حتى يضغط المستخدم حفظا صريحا.
  const save = () => {
    setSettings(saveEngineSettings(settings));
    setMessage('تم حفظ إعدادات المحرك. ستقرأها صفحات المحرر والمصحف من المصدر نفسه.');
  };

  const reset = () => {
    const next = resetEngineSettings();
    setSettings(next);
    setMessage('أعيدت إعدادات العرض إلى السلوك الافتراضي.');
  };

  return (
    <div data-ui-id="A171" className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <header data-ui-id="A1700">
        <p className="text-xs font-semibold text-violet-700">إعدادات التنفيذ المرئي</p>
        <h3 className="mt-1 text-lg font-bold text-gray-900">إعدادات محرك التشجير</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          هذه إعدادات سلوك الرسم والترتيب التي كانت في لوحة الإدارة. أما الأولويات والدمج والقواعد فتُحفظ في ملف EngineConfig أعلاه؛ كلاهما يمر من هنا إلى المحرك دون نسخة مكررة.
        </p>
      </header>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-950">
        <strong>الترتيب المعتمد:</strong> يبدأ المحرك من آخر موضع اختلاف في الآية إلى أولها.
        لا تغيّر الفئة أو ترتيب الإدخال هذه القاعدة المنهجية.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectInput data-ui-id="A2080" label="كسر التعادل عند الموضع نفسه" value={settings.tieBreakOrder} onChange={(value) => setSettings({ ...settings, tieBreakOrder: value as TieBreakOrder })}>
          <option data-ui-id="A1701" value="TAYYIBAH">ترتيب طيبة النشر</option>
          <option data-ui-id="A1702" value="SYMBOL">ترتيب الرمز</option>
          <option data-ui-id="A1703" value="MANUAL">المسارات اليدوية أولا</option>
        </SelectInput>
        <SelectInput data-ui-id="A2081" label="تكوين السطر" value={settings.lineComposition} onChange={(value) => setSettings({ ...settings, lineComposition: value as LineCompositionMode })}>
          <option data-ui-id="A1704" value="COMBINED">سطر لكل تركيب قراءة (المعتمد)</option>
          <option data-ui-id="A1705" value="PER_VARIANT">سطر لكل وجه في كل موضع</option>
        </SelectInput>
        <SelectInput data-ui-id="A2082" label="ترتيب أوجه الموضع الواحد" value={settings.alternativeOrder} onChange={(value) => setSettings({ ...settings, alternativeOrder: value as AlternativeOrderRule })}>
          <option data-ui-id="A1706" value="STRENGTH">قوة الوجه في الكتاب</option>
          <option data-ui-id="A1707" value="TAYYIBAH">ترتيب طيبة النشر</option>
          <option data-ui-id="A1708" value="MANUAL">ترتيب المحقق لكل موضع</option>
        </SelectInput>
        <SelectInput data-ui-id="A2083" label="ما يظهر في طرف السطر" value={settings.symbolDisplay} onChange={(value) => setSettings({ ...settings, symbolDisplay: value as SymbolDisplay })}>
          <option data-ui-id="A1709" value="SYMBOLS">رموز القراء</option>
          <option data-ui-id="A1710" value="NAMES">الأسماء</option>
          <option data-ui-id="A1711" value="BOTH">الرمز مع الاسم</option>
        </SelectInput>
        <SelectInput data-ui-id="A2084" label="امتداد السطر الأفقي" value={settings.lineSpan} onChange={(value) => setSettings({ ...settings, lineSpan: value as LineSpanMode })}>
          <option data-ui-id="A1712" value="FULL_AYAH">يمتد مع الآية كلها</option>
          <option data-ui-id="A1713" value="VARIANT_SPAN">يقتصر على مدى الاختلاف</option>
        </SelectInput>

        <div className="grid gap-2 rounded-lg border border-gray-200 p-3">
          <CheckboxInput data-ui-id="A2085" label="إظهار اسم الحكم تحت الكلمة" checked={settings.showRuleUnderWord} onChange={(value) => setSettings({ ...settings, showRuleUnderWord: value })} />
          <CheckboxInput data-ui-id="A2086" label="إظهار حركات المد في الهامش" checked={settings.showMaddColumn} onChange={(value) => setSettings({ ...settings, showMaddColumn: value })} />
          <CheckboxInput data-ui-id="A2087" label="نص الآية في سطر واحد مهما طال" checked={settings.singleLineText} onChange={(value) => setSettings({ ...settings, singleLineText: value })} />
        </div>

        <RangeInput data-ui-id="A2088" label="تباعد أسطر الشجرة" value={settings.rowSpacing} min={0.7} max={2} step={0.1} onChange={(value) => setSettings({ ...settings, rowSpacing: value })} />
        <RangeInput data-ui-id="A2089" label="المسافة بين النص وأول سطر" value={settings.textToTreeGap} min={0.7} max={2} step={0.1} onChange={(value) => setSettings({ ...settings, textToTreeGap: value })} />
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <button data-ui-id="A1714" type="button" onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">استعادة الافتراضي</button>
        <button data-ui-id="A1715" type="button" onClick={save} className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700">حفظ إعدادات المحرك</button>
      </div>
    </div>
  );
}

function SelectInput({ 'data-ui-id': uiId, label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode } & { 'data-ui-id'?: string }) {
  return <label data-ui-id="A1716" className="block text-sm text-gray-700"><span className="mb-1 block font-medium">{label}</span><select data-ui-id={uiId} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">{children}</select></label>;
}

function CheckboxInput({ 'data-ui-id': uiId, label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void } & { 'data-ui-id'?: string }) {
  return <label data-ui-id="A1718" className="flex items-center gap-2 text-sm text-gray-700"><input data-ui-id={uiId} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-violet-600" />{label}</label>;
}

function RangeInput({ 'data-ui-id': uiId, label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void } & { 'data-ui-id'?: string }) {
  return <label data-ui-id="A1720" className="block text-sm text-gray-700"><span className="mb-1 flex justify-between"><span>{label}</span><output className="font-mono text-xs text-violet-700">{value.toLocaleString('ar')}</output></span><input data-ui-id={uiId} type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-violet-600" /></label>;
}

'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_APP_SETTINGS,
  LocalAppSettings,
  readStoredSettings,
  saveStoredSettings,
} from '@/lib/local-app-data';

export default function SettingsPage() {
  const [settings, setSettings] = useState<LocalAppSettings>(DEFAULT_APP_SETTINGS);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setSettings(readStoredSettings());
  }, []);

  const updateSetting = <K extends keyof LocalAppSettings>(key: K, value: LocalAppSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage('');
  };

  const saveSettings = () => {
    saveStoredSettings(settings);
    setMessage('تم حفظ الإعدادات محليا.');
  };

  const resetSettings = () => {
    setSettings(DEFAULT_APP_SETTINGS);
    saveStoredSettings(DEFAULT_APP_SETTINGS);
    setMessage('تمت استعادة الإعدادات الافتراضية.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-600">إعدادات التطبيق والمحرر المحفوظة في هذا المتصفح.</p>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <section className="rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold text-gray-900">إعدادات عامة</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="اسم التطبيق"
            value={settings.appName}
            onChange={(value) => updateSetting('appName', value)}
          />
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold text-gray-900">إعدادات المحرر</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField
            label="حجم الخط الافتراضي"
            value={settings.fontSize}
            onChange={(value) => updateSetting('fontSize', clamp(value, 16, 48))}
            min={16}
            max={48}
          />
          <NumberField
            label="التكبير الافتراضي"
            value={settings.defaultZoom}
            onChange={(value) => updateSetting('defaultZoom', clamp(value, 0.5, 3))}
            min={0.5}
            max={3}
            step={0.1}
          />
          <ToggleRow
            label="الحفظ التلقائي"
            description="حفظ تغييرات التشجير في التخزين المحلي."
            checked={settings.autoSave}
            onChange={(checked) => updateSetting('autoSave', checked)}
          />
          {settings.autoSave && (
            <NumberField
              label="فترة الحفظ التلقائي"
              value={settings.autoSaveInterval}
              onChange={(value) => updateSetting('autoSaveInterval', clamp(value, 10, 120))}
              min={10}
              max={120}
              suffix="ثانية"
            />
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold text-gray-900">إعدادات العرض</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleRow
            label="إظهار الشبكة"
            description="تفعيل شبكة القياس في المحرر."
            checked={settings.showGrid}
            onChange={(checked) => updateSetting('showGrid', checked)}
          />
          <ToggleRow
            label="إظهار المساطر"
            description="تفعيل المساطر في المحرر."
            checked={settings.showRulers}
            onChange={(checked) => updateSetting('showRulers', checked)}
          />
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          onClick={resetSettings}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-gray-700 hover:bg-gray-50"
          type="button"
        >
          استعادة الافتراضي
        </button>
        <button
          onClick={saveSettings}
          className="rounded-lg bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700"
          type="button"
        >
          حفظ الإعدادات
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          min={min}
          max={max}
          step={step}
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-12 rounded-full transition-colors ${
          checked ? 'bg-emerald-600' : 'bg-gray-300'
        }`}
        type="button"
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'right-1' : 'right-7'
          }`}
        />
      </button>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

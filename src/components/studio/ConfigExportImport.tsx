'use client';

// تصدير واستيراد إعداد المحرك - Config Export/Import
// FR-ES-14: Git-friendly Export/Import

import { useState } from 'react';
import { useEngineStudioStore } from '@/stores/engine-studio-store';
import { validateEngineConfig } from '@/lib/tashjeer/decision/policy';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';

export function ConfigExportImport() {
  const { exportConfig, importConfig, getActiveConfig } = useEngineStudioStore();
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleExport = () => {
    const config = exportConfig();
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `engine-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportToClipboard = () => {
    const config = exportConfig();
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json);
  };

  const handleImport = () => {
    setImportError(null);
    setImportSuccess(false);
    try {
      const parsed: unknown = JSON.parse(importText);
      const validation = validateEngineConfig(parsed);
      if (!validation.valid) {
        setImportError(`ملف غير صالح: ${validation.errors.join(' ')}`);
        return;
      }
      importConfig(parsed as EngineConfig);
      setImportSuccess(true);
      setImportText('');
    } catch (err) {
      setImportError(`خطأ في التحليل: ${err instanceof Error ? err.message : 'JSON غير صالح'}`);
    }
  };

  const config = getActiveConfig();

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900">تصدير إعداد المحرك</h2>
          <p className="text-sm text-gray-500">
            تصدير Git-friendly: ترتيب مستقر، معرّفات صريحة، إصدار (DM-13)
          </p>
        </div>
        <div className="p-6">
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{config.rules.length}</div>
              <div className="text-sm text-gray-500">قاعدة</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{config.mergeMatrix.length}</div>
              <div className="text-sm text-gray-500">صف دمج</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{config.priorityGroups.length}</div>
              <div className="text-sm text-gray-500">مجموعة أولوية</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              💾 تحميل JSON
            </button>
            <button
              type="button"
              onClick={handleExportToClipboard}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              📋 نسخ إلى الحافظة
            </button>
          </div>
        </div>
      </div>

      {/* Import */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900">استيراد إعداد المحرك</h2>
          <p className="text-sm text-gray-500">
            استيراد مع التحقق من الصحة والتوافق
          </p>
        </div>
        <div className="p-6">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"schemaVersion": 1, "profile": "...", "rules": [...], ...}'
            className="h-48 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {importError && (
            <div className="mt-2 rounded bg-red-50 p-3 text-sm text-red-700">{importError}</div>
          )}
          {importSuccess && (
            <div className="mt-2 rounded bg-emerald-50 p-3 text-sm text-emerald-700">
              تم الاستيراد بنجاح!
            </div>
          )}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={!importText.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              استيراد
            </button>
          </div>
        </div>
      </div>

      {/* Directory Structure */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900">بنية ملف التصدير</h2>
        </div>
        <div className="p-6">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100" dir="ltr">
{`engine-config/
├── schema-version: 1
├── profile: "default"
├── priorityGroups: [...]
├── rules: [...]
├── conflictPolicy: [...]
├── executionOrder: [...]
├── mergeMatrix: [...]
└── contexts: {...}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

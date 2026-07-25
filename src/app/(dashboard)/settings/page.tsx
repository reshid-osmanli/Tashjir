// صفحة الإعدادات - Settings Page
// مشروع التشجير - نظام القراءات العشر
//
// إعدادات المحرر وبيانات المحرر (المستخدم)، وأدوات إدارة البيانات المحلية:
// تصدير كل العمل نسخة احتياطية، أو استيراده، أو مسحه.

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_APP_SETTINGS,
  formatLocalDate,
  readStoredSettings,
  saveStoredSettings,
  type LocalAppSettings,
} from '@/lib/local-app-data';
import {
  deleteDocument,
  exportDocuments,
  importDocuments,
  listDocuments,
  type DocumentIndexEntry,
} from '@/lib/storage/document-store';
import { MUSHAF_SOURCE, TOTAL_AYAHS, TOTAL_WORDS, getSurahOrFirst } from '@/data/quran';

export default function SettingsPage() {
  const [settings, setSettings] = useState<LocalAppSettings>(DEFAULT_APP_SETTINGS);
  const [documents, setDocuments] = useState<DocumentIndexEntry[]>([]);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(readStoredSettings());
    setDocuments(listDocuments());
  }, []);

  const update = <K extends keyof LocalAppSettings>(key: K, value: LocalAppSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage('');
  };

  const save = () => {
    saveStoredSettings(settings);
    setMessage('تم حفظ الإعدادات.');
  };

  const reset = () => {
    setSettings(DEFAULT_APP_SETTINGS);
    saveStoredSettings(DEFAULT_APP_SETTINGS);
    setMessage('تمت استعادة الإعدادات الافتراضية.');
  };

  /** نسخة احتياطية كاملة من كل مستندات التشجير. */
  const exportAll = () => {
    const json = exportDocuments();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `tashjeer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    setMessage(`تم تصدير ${documents.length} مستندا.`);
  };

  const importAll = async (file: File) => {
    const result = importDocuments(await file.text(), true);
    setDocuments(listDocuments());
    setMessage(
      result.errors.length > 0
        ? result.errors[0]
        : `تم استيراد ${result.imported} مستندا وتخطي ${result.skipped}.`
    );
  };

  const removeDocument = (entry: DocumentIndexEntry) => {
    const surahName = getSurahOrFirst(entry.surahNumber).name;
    if (!window.confirm(`حذف تشجير ${surahName} ${entry.ayahNumber}؟ لا يمكن التراجع.`)) return;

    deleteDocument(entry.ayahKey);
    setDocuments(listDocuments());
    setMessage('تم حذف المستند.');
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-stone-900">الإعدادات</h1>
        <p className="mt-0.5 text-sm text-stone-600">
          كل البيانات محفوظة في هذا المتصفح فقط. صدّر نسخة احتياطية قبل تفريغ بيانات المتصفح.
        </p>
      </header>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <Card title="بيانات المحرر">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="اسم المحرر" hint="يُسجَّل في بيانات كل مستند تنشئه">
            <input
              type="text"
              value={settings.authorName}
              onChange={(event) => update('authorName', event.target.value)}
              className="input"
            />
          </Field>
          <Field label="اسم التطبيق">
            <input
              type="text"
              value={settings.appName}
              onChange={(event) => update('appName', event.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Card>

      <Card title="افتراضيات المحرر">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={`حجم خط المصحف: ${settings.fontSize}`}>
            <input
              type="range"
              min={24}
              max={54}
              step={2}
              value={settings.fontSize}
              onChange={(event) => update('fontSize', Number(event.target.value))}
              className="w-full accent-emerald-600"
            />
          </Field>

          <Field label={`التكبير الافتراضي: ${Math.round(settings.defaultZoom * 100)}%`}>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.defaultZoom}
              onChange={(event) => update('defaultZoom', Number(event.target.value))}
              className="w-full accent-emerald-600"
            />
          </Field>

          <Toggle
            label="إظهار الشبكة"
            description="شبكة قياس خلف اللوحة تساعد على ضبط المواضع."
            checked={settings.showGrid}
            onChange={(checked) => update('showGrid', checked)}
          />
          <Toggle
            label="إظهار المساطر"
            description="خطوط قياس أفقية بأرقام الإحداثيات."
            checked={settings.showRulers}
            onChange={(checked) => update('showRulers', checked)}
          />
          <Toggle
            label="إظهار بطاقات الأوجه"
            description="بطاقة بجانب كل خط تبيّن الوجه ومن يقرأ به."
            checked={settings.showLabels}
            onChange={(checked) => update('showLabels', checked)}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-xs text-stone-700 hover:bg-stone-50"
          >
            استعادة الافتراضي
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
          >
            حفظ الإعدادات
          </button>
        </div>
      </Card>

      <Card title="البيانات المحفوظة">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportAll}
            disabled={documents.length === 0}
            className="rounded-md bg-stone-800 px-4 py-2 text-xs font-medium text-white hover:bg-stone-900 disabled:opacity-40"
          >
            تصدير نسخة احتياطية ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-xs text-stone-700 hover:bg-stone-50"
          >
            استيراد نسخة
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importAll(file);
              event.target.value = '';
            }}
          />
        </div>

        {documents.length === 0 ? (
          <p className="text-xs text-stone-500">لا توجد مستندات محفوظة بعد.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-md border border-stone-200">
            {documents.map((entry) => (
              <li key={entry.ayahKey} className="flex items-center justify-between gap-3 px-3 py-2">
                <div>
                  <p className="text-sm text-stone-900">
                    {getSurahOrFirst(entry.surahNumber).name} {entry.ayahNumber}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    {entry.variantsCount} اختلافا · {entry.branchesCount} خطا ·{' '}
                    {formatLocalDate(entry.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeDocument(entry)}
                  className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="عن البيانات">
        <dl className="grid gap-2 text-xs text-stone-600 md:grid-cols-3">
          <div>
            <dt className="font-medium text-stone-800">نص المصحف</dt>
            <dd>{MUSHAF_SOURCE}</dd>
          </div>
          <div>
            <dt className="font-medium text-stone-800">الآيات</dt>
            <dd>{TOTAL_AYAHS.toLocaleString('ar')}</dd>
          </div>
          <div>
            <dt className="font-medium text-stone-800">الكلمات</dt>
            <dd>{TOTAL_WORDS.toLocaleString('ar')}</dd>
          </div>
        </dl>
        <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          الاختلافات المرفقة مع المشروع مسجّلة بحالة «مسودة» وهي للتشغيل والاختبار.
          لا يصح اعتمادها علميا قبل مراجعة مختص مجاز ومقابلتها على النشر وطيبة النشر.
        </p>
      </Card>
    </div>
  );
}

// ==================== عناصر مشتركة ====================

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-bold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-500">{hint}</span>}
    </label>
  );
}

function Toggle({
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
    <div className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
      <div>
        <div className="text-xs font-medium text-stone-800">{label}</div>
        <p className="text-[11px] text-stone-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-emerald-600' : 'bg-stone-300'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? 'end-1' : 'end-6'
          }`}
        />
      </button>
    </div>
  );
}

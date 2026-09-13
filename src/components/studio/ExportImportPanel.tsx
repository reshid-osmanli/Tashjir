// تصدير واستيراد إعداد المحرك — Export/Import (FR-ES-14، DM-13)
// مشروع التشجير - نظام القراءات العشر
//
// التصدير حتمي وصديق لـ Git: ترتيب مفاتيح ثابت، عناصر مرتبة بمفاتيح مستقرة،
// بلا طوابع زمنية متقلّبة. الاستيراد يفحص الإصدار والسلامة ويكشف التعارض
// قبل التطبيق، مع معاينة الأخطاء.

'use client';

import { useState } from 'react';

interface ExportImportPanelProps {
  onExport: () => string;
  onPreviewImport: (text: string) => { valid: boolean; errors: string[]; warnings: string[] };
  onImport: (text: string) => { valid: boolean; errors: string[]; warnings: string[] };
}

export function ExportImportPanel({ onExport, onPreviewImport, onImport }: ExportImportPanelProps) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; messages: string[] } | null>(null);
  const [validated, setValidated] = useState(false);

  const handleExport = () => {
    setText(onExport());
    setFeedback({ kind: 'ok', messages: ['صُدِّر إعداد المحرك بصيغة حتمية صديقة لـ Git.'] });
  };

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ kind: 'ok', messages: ['نُسخ النص إلى الحافظة.'] });
    } catch {
      setFeedback({ kind: 'err', messages: ['تعذّر النسخ التلقائي. انسخ النص يدويًا.'] });
    }
  };

  const handlePreview = () => {
    const result = onPreviewImport(text);
    setValidated(result.valid);
    if (result.valid) {
      setFeedback({ kind: 'ok', messages: [...(result.warnings ?? []), 'الفحص سليم. راجع النص ثم اضغط «تطبيق الاستيراد»؛ لم يُغيّر الملف بعد.'] });
    } else {
      setFeedback({ kind: 'err', messages: result.errors.length > 0 ? result.errors : ['فشل فحص الاستيراد.'] });
    }
  };

  const handleImport = () => {
    const result = onImport(text);
    setValidated(false);
    if (result.valid) {
      setFeedback({ kind: 'ok', messages: ['استورد الإعداد بنجاح كمسودة غير محفوظة. راجع بوابة النشر قبل التثبيت.'] });
    } else {
      setFeedback({ kind: 'err', messages: result.errors.length > 0 ? result.errors : ['فشل الاستيراد.'] });
    }
  };

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">تصدير واستيراد إعداد المحرك</h3>
        <p className="mt-1 text-sm text-gray-500">
          التصدير حتمي: نفس الإعداد يعطي نفس النص بايتًا، فيظهر Git فرقًا دقيقًا. الاستيراد يفحص السلامة والإصدار والتعارض.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleExport} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          تصدير (نسخة Git)
        </button>
        <button type="button" onClick={handleCopy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          نسخ النص
        </button>
        <button type="button" onClick={handlePreview} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          فحص ومعاينة الاستيراد
        </button>
        {validated && <button type="button" onClick={handleImport} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">تطبيق الاستيراد</button>}
      </div>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            feedback.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          <ul className="list-disc space-y-0.5 pr-4">
            {feedback.messages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="الصق هنا إعداد محرك مُصدَّرًا للاستيراد..."
        dir="ltr"
        className="h-72 w-full rounded-lg border border-gray-300 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

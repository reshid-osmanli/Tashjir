// صفحة المحرر - Editor Page
// مشروع التشجير - نظام القراءات العشر
//
// تجميع المحرر: شريط الأدوات، مستعرض الآيات، لوحة الخصائص، اللوحة، لوحة الاختلافات.
//
// التخطيط بالترتيب المنطقي في واجهة عربية (RTL):
//   [لوحة الخصائص]  [اللوحة]  [لوحة الاختلافات]
// والأولوية للوحة الرسم، فهي تأخذ كل المساحة المتبقية.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { AyahNavigator } from '@/components/editor/AyahNavigator';
import { TashjeerCanvas } from '@/components/editor/TashjeerCanvas';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { VariantsPanel } from '@/components/editor/VariantsPanel';
import { ShortcutsDialog } from '@/components/editor/ShortcutsDialog';
import { useEditorStore } from '@/stores/editor-store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { exportDocuments, importDocuments } from '@/lib/storage/document-store';
import { makeAyahKey, parseAyahKey } from '@/data/quran';

/** الآية الافتراضية عند فتح المحرر: الفاتحة 4، وفيها اختلاف مشهور. */
const DEFAULT_AYAH_KEY = makeAyahKey(1, 4);

export default function EditorPage() {
  const [fontSize, setFontSize] = useState(34);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    document,
    isDirty,
    openAyah,
    replaceDocument,
    showPropertiesPanel,
    showVariantsPanel,
    currentTool,
  } = useEditorStore();

  // تعطّل الاختصارات أثناء فتح نافذة، حتى لا تتضارب مع الكتابة فيها.
  useKeyboardShortcuts(!showShortcuts);

  // فتح الآية الافتراضية عند أول تحميل.
  useEffect(() => {
    if (!document) openAyah(DEFAULT_AYAH_KEY);
  }, [document, openAyah]);

  // تحذير المتصفح عند مغادرة الصفحة مع وجود تعديلات غير محفوظة.
  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  /** يصدّر المستند الحالي إلى ملف JSON قابل للمشاركة والمراجعة. */
  const handleExport = useCallback(() => {
    if (!document) return;

    const json = exportDocuments([document.ayahKey]);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');

    anchor.href = url;
    anchor.download = `tashjeer-${document.surahNumber}-${document.ayahNumber}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    showToast('تم تصدير المستند.');
  }, [document, showToast]);

  const handleImportClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleImportFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const result = importDocuments(text, true);

      if (result.errors.length > 0) {
        showToast(result.errors[0]);
        return;
      }

      showToast(`تم استيراد ${result.imported} مستندا.`);

      // نفتح أول مستند مستورد ليراه المستخدم فورا.
      try {
        const bundle = JSON.parse(text) as { documents?: Array<{ ayahKey: number }> };
        const first = bundle.documents?.[0];
        if (first) openAyah(first.ayahKey);
      } catch {
        // تجاهل: الاستيراد نجح والفهرس محدّث، وفتح المستند تحسين فقط.
      }
    },
    [openAyah, showToast]
  );

  const ayahKey = document?.ayahKey ?? DEFAULT_AYAH_KEY;
  const { surahNumber, ayahNumber } = parseAyahKey(ayahKey);

  return (
    <div className="-m-4 flex h-[calc(100dvh-73px)] flex-col overflow-hidden bg-stone-100 md:-m-6">
      <EditorToolbar
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        onExport={handleExport}
        onImport={handleImportClick}
        onShowShortcuts={() => setShowShortcuts(true)}
      />

      <AyahNavigator ayahKey={ayahKey} onNavigate={openAyah} />

      <div className="flex min-h-0 flex-1">
        {showPropertiesPanel && <PropertiesPanel />}

        <main className="min-w-0 flex-1">
          <TashjeerCanvas fontSize={fontSize} />
        </main>

        {showVariantsPanel && <VariantsPanel />}
      </div>

      <StatusBar
        surahNumber={surahNumber}
        ayahNumber={ayahNumber}
        tool={currentTool}
        isDirty={isDirty}
      />

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImportFile(file);
          event.target.value = '';
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* منفذ إعادة تحميل المستند من الخارج، مستخدم في الاختبارات وأدوات التطوير */}
      <span className="hidden" data-replace-document={typeof replaceDocument} />
    </div>
  );
}

function StatusBar({
  surahNumber,
  ayahNumber,
  tool,
  isDirty,
}: {
  surahNumber: number;
  ayahNumber: number;
  tool: string;
  isDirty: boolean;
}) {
  const toolLabels: Record<string, string> = {
    select: 'تحديد',
    mark: 'تعليم الكلمات',
    erase: 'مسح الخطوط',
  };

  return (
    <div className="flex items-center justify-between border-t border-stone-200 bg-white px-3 py-1.5 text-[11px] text-stone-600">
      <div className="flex items-center gap-4">
        <span>
          الموضع: {surahNumber}:{ayahNumber}
        </span>
        <span>الأداة: {toolLabels[tool] ?? tool}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={isDirty ? 'text-amber-700' : 'text-emerald-700'}>
          {isDirty ? 'تعديلات غير محفوظة' : 'كل التعديلات محفوظة'}
        </span>
        <span className="text-stone-400">التخزين: محلي في هذا المتصفح</span>
      </div>
    </div>
  );
}

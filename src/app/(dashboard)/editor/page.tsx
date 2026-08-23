// صفحة المحرر - Editor Page v2 - بيئة احترافية
// تجميع المحرر كأداة قرار لمحرك الترتيب

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
import { exportDocument, importDocuments } from '@/lib/storage/document-store';
import { makeAyahKey, parseAyahKey } from '@/data/quran';
import { formatAyahRef } from '@/lib/utils/arabic-numbers';

const DEFAULT_AYAH_KEY = makeAyahKey(1, 4);

export default function EditorPage() {
  const [fontSize, setFontSize] = useState(34);
  const [requestedRoute, setRequestedRoute] = useState({ ayahKey: DEFAULT_AYAH_KEY, variantId: null as string | null });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [revealedEdge, setRevealedEdge] = useState<'top' | 'start' | 'end' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoHide, setAutoHide] = useState(false);

  const {
    document,
    isDirty,
    selectedVariantId,
    openAyah,
    selectVariant,
    replaceDocument,
    showPropertiesPanel,
    showVariantsPanel,
    currentTool,
    focusMode,
    pinnedPanels,
    setFocusMode,
    setPinnedPanel,
    togglePropertiesPanel,
    toggleVariantsPanel,
  } = useEditorStore();

  useKeyboardShortcuts(!showShortcuts);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestedRoute({ ayahKey: Number(params.get('ayah')) || DEFAULT_AYAH_KEY, variantId: params.get('variant') });
  }, []);

  const requestedAyahKey = requestedRoute.ayahKey;
  const requestedVariantId = requestedRoute.variantId;
  const appliedRouteRef = useRef<string | null>(null);
  useEffect(() => {
    const routeKey = `${requestedAyahKey}:${requestedVariantId ?? ''}`;
    if (appliedRouteRef.current === routeKey) return;
    appliedRouteRef.current = routeKey;
    if (!document || document.ayahKey !== requestedAyahKey) openAyah(requestedAyahKey);
  }, [document, openAyah, requestedAyahKey, requestedVariantId]);

  useEffect(() => {
    if (document?.ayahKey === requestedAyahKey && requestedVariantId && requestedVariantId !== selectedVariantId) {
      selectVariant(requestedVariantId);
    }
  }, [document, requestedAyahKey, requestedVariantId, selectVariant, selectedVariantId]);

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

  const handleExport = useCallback(() => {
    if (!document) return;
    const json = exportDocument(document);
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
      try {
        const bundle = JSON.parse(text) as { documents?: Array<{ ayahKey: number }> };
        const first = bundle.documents?.[0];
        if (first) openAyah(first.ayahKey);
      } catch {
        // ignore parse errors for toast navigation
      }
    },
    [openAyah, showToast]
  );

  const ayahKey = document?.ayahKey ?? DEFAULT_AYAH_KEY;
  const { surahNumber, ayahNumber } = parseAyahKey(ayahKey);

  const isToolbarVisible = !focusMode || revealedEdge === 'top' || pinnedPanels.toolbar;
  const isPropsVisible = showPropertiesPanel && (!focusMode || revealedEdge === 'start' || pinnedPanels.properties);
  const isVariantsVisible = showVariantsPanel && (!focusMode || revealedEdge === 'end' || pinnedPanels.variants);

  return (
    <div className="-m-4 flex h-[calc(100dvh-73px)] flex-col overflow-hidden bg-stone-100 md:-m-6">
      {isToolbarVisible && (
        <div className={focusMode ? 'absolute inset-x-0 top-0 z-40 shadow-xl' : ''} onMouseLeave={() => focusMode && setRevealedEdge(null)}>
          <div className="flex items-center justify-between border-b border-stone-200 bg-white px-2 py-1 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="text-stone-600">إظهار/إخفاء النوافذ:</span>
              <button type="button" onClick={togglePropertiesPanel} className={`rounded border px-2 py-0.5 ${showPropertiesPanel ? 'bg-stone-800 text-white' : 'bg-white'}`}>خصائص</button>
              <button type="button" onClick={toggleVariantsPanel} className={`rounded border px-2 py-0.5 ${showVariantsPanel ? 'bg-stone-800 text-white' : 'bg-white'}`}>اختلافات</button>
              <button type="button" onClick={() => setPinnedPanel('toolbar', !pinnedPanels.toolbar)} className={`rounded border px-2 py-0.5 ${pinnedPanels.toolbar ? 'bg-emerald-600 text-white' : 'bg-white'}`}>تثبيت علوي</button>
              <label className="ms-2 flex items-center gap-1"><input type="checkbox" checked={autoHide} onChange={(e) => setAutoHide(e.target.checked)} className="accent-stone-800" />إخفاء تلقائي</label>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { setFocusMode(!focusMode); setRevealedEdge(null); }} className="rounded bg-stone-900 px-2.5 py-1 text-white hover:bg-stone-700">{focusMode ? 'تثبيت الواجهة' : 'وضع التركيز'}</button>
            </div>
          </div>
          <EditorToolbar fontSize={fontSize} onFontSizeChange={setFontSize} onExport={handleExport} onImport={handleImportClick} onShowShortcuts={() => setShowShortcuts(true)} />
          <AyahNavigator ayahKey={ayahKey} onNavigate={openAyah} />
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {isPropsVisible && (
          <div className={focusMode ? 'absolute inset-y-0 start-0 z-30 shadow-2xl' : 'contents'} onMouseLeave={() => focusMode && !pinnedPanels.properties && setRevealedEdge(null)}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-2 py-1 text-[10px]">
                <span>الخصائص</span>
                <button type="button" onClick={() => setPinnedPanel('properties', !pinnedPanels.properties)} className={`rounded border px-1.5 py-0.5 ${pinnedPanels.properties ? 'bg-emerald-600 text-white' : 'bg-white'}`}>{pinnedPanels.properties ? 'مثبت' : 'تثبيت'}</button>
              </div>
              <PropertiesPanel />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <TashjeerCanvas fontSize={fontSize} />
        </main>

        {isVariantsVisible && (
          <div className={focusMode ? 'absolute inset-y-0 end-0 z-30 shadow-2xl' : 'contents'} onMouseLeave={() => focusMode && !pinnedPanels.variants && setRevealedEdge(null)}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-2 py-1 text-[10px]">
                <span>الاختلافات</span>
                <button type="button" onClick={() => setPinnedPanel('variants', !pinnedPanels.variants)} className={`rounded border px-1.5 py-0.5 ${pinnedPanels.variants ? 'bg-emerald-600 text-white' : 'bg-white'}`}>{pinnedPanels.variants ? 'مثبت' : 'تثبيت'}</button>
              </div>
              <VariantsPanel />
            </div>
          </div>
        )}

        {focusMode && (
          <>
            <div className="absolute inset-x-16 top-0 z-20 h-3 bg-transparent" onMouseEnter={() => setRevealedEdge('top')} />
            <div className="absolute inset-y-10 start-0 z-20 w-3 bg-transparent" onMouseEnter={() => setRevealedEdge('start')} />
            <div className="absolute inset-y-10 end-0 z-20 w-3 bg-transparent" onMouseEnter={() => setRevealedEdge('end')} />
          </>
        )}
      </div>

      {!focusMode && <StatusBar surahNumber={surahNumber} ayahNumber={ayahNumber} tool={currentTool} isDirty={isDirty} />}

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}

      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImportFile(file); e.target.value = ''; }} />

      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}

      <span className="hidden" data-replace-document={typeof replaceDocument} />
    </div>
  );
}

function StatusBar({ surahNumber, ayahNumber, tool, isDirty }: { surahNumber: number; ayahNumber: number; tool: string; isDirty: boolean }) {
  const toolLabels: Record<string, string> = { select: 'تحديد', mark: 'تعليم الكلمات', erase: 'مسح الخطوط' };
  return (
    <div className="flex items-center justify-between border-t border-stone-200 bg-white px-3 py-1.5 text-[11px] text-stone-600">
      <div className="flex items-center gap-4"><span>الموضع: {formatAyahRef(surahNumber, ayahNumber)}</span><span>الأداة: {toolLabels[tool] ?? tool}</span></div>
      <div className="flex items-center gap-3"><span className={isDirty ? 'text-amber-700' : 'text-emerald-700'}>{isDirty ? 'تعديلات غير محفوظة' : 'كل التعديلات محفوظة'}</span><span className="text-stone-400">التخزين: محلي</span></div>
    </div>
  );
}

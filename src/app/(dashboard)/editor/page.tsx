// صفحة المحرر - Editor Page
// مشروع التشجير - نظام القراءات العشر
//
// تجميع المحرر: شريط الأدوات، مستعرض الآيات، لوحة الخصائص، اللوحة، لوحة الاختلافات.
//
// التخطيط بالترتيب المنطقي في واجهة عربية (RTL):
//   [لوحة الخصائص]  [اللوحة]  [لوحة الاختلافات]
// والأولوية للوحة الرسم، فهي تأخذ كل المساحة المتبقية.
//
// ============================ وضع اللوحات (FR-ED-12) ============================
//
// كل شريط ولوحة هنا ملفوف في `PanelFrame`/`PanelGroupFrame`، فيُرسم في التدفق
// (يأخذ مساحته) أو كطبقة فوقية على حافته (لا يأخذ مساحة وتكشفه الحافة) أو لا
// يُرسم. القرار كله في `lib/ui/panel-layout` والحالة في `stores/panel-store`،
// وهذه الصفحة تملك آلة الكشف الواحدة (`usePanelAutoHide`) وتوزّعها بالسياق.
//
// والقاعدة التي تحرسها: **الإخفاء لا يزيح التخطيط**. الطبقة الفوقية `absolute`
// فوق اللوحة المركزية، فلا تتحرك كلمات المصحف ولا أسطر التشجير ولا مواضع
// البطاقات عند الكشف أو الإخفاء — لا «قفز» مزعج.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { AyahNavigator } from '@/components/editor/AyahNavigator';
import { TashjeerCanvas } from '@/components/editor/TashjeerCanvas';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { VariantsPanel } from '@/components/editor/VariantsPanel';
import { SelectionBreadcrumb } from '@/components/editor/SelectionBreadcrumb';
import { ShortcutsDialog } from '@/components/editor/ShortcutsDialog';
import { PanelEdgeHandle, PanelFrame, PanelGroupFrame, PanelSlot, PanelAutoHideProvider } from '@/components/editor/PanelFrame';
import { useEditorStore } from '@/stores/editor-store';
import { usePanelStore } from '@/stores/panel-store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePanelAutoHide } from '@/hooks/usePanelAutoHide';
import { describeImportResult, exportDocument, importDocuments } from '@/lib/storage/document-store';
import { makeAyahKey, parseAyahKey } from '@/data/quran';
import { formatAyahRef, toArabicDigits } from '@/lib/utils/arabic-numbers';
import { countOverlayPanels } from '@/lib/ui/panel-layout';

/** الآية الافتراضية عند فتح المحرر: الفاتحة 4، وفيها اختلاف مشهور. */
const DEFAULT_AYAH_KEY = makeAyahKey(1, 4);

export default function EditorPage() {
  const [fontSize, setFontSize] = useState(34);
  const [requestedRoute, setRequestedRoute] = useState({
    ayahKey: DEFAULT_AYAH_KEY,
    variantId: null as string | null,
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // منطقة العمل التي تُقاس حوافها: الحاوية كلها لا النافذة، حتى لا تتداخل
  // الحافة مع قائمة التطبيق الجانبية.
  const workspaceRef = useRef<HTMLDivElement>(null);
  const panelAutoHide = usePanelAutoHide(workspaceRef);
  const panelPrefs = usePanelStore((state) => state.prefs);
  const toggleAutoHide = usePanelStore((state) => state.toggleAutoHide);
  const overlayCount = countOverlayPanels(panelPrefs);

  const {
    document,
    isDirty,
    selectedVariantId,
    openAyah,
    selectVariant,
    replaceDocument,
    currentTool,
  } = useEditorStore();

  // تعطّل الاختصارات أثناء فتح نافذة، حتى لا تتضارب مع الكتابة فيها.
  useKeyboardShortcuts(!showShortcuts);

  // فتح الآية المطلوبة من المصحف/فهرس الاختلافات، أو الفاتحة 4 افتراضيا.
  // الرابط يحمل الآية لأن الانتقال من أي صفحة يجب ألا يعيد المحرر إلى المثال.
  // القراءة من location داخل effect بدلا من useSearchParams تجعل صفحة المحرر
  // قابلة للبناء الساكن أيضا. الرابط ما زال يدعم ?ayah=...&variant=....
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestedRoute({
      ayahKey: Number(params.get('ayah')) || DEFAULT_AYAH_KEY,
      variantId: params.get('variant'),
    });
    // رابط عميق إلى «لماذا؟» (FR-ES-15): ?why=1 أو ?rule=<معرّف قاعدة استوديو>.
    const rule = params.get('rule');
    if (params.get('why') === '1' || rule) {
      useEditorStore.getState().requestWhy({ ruleId: rule ?? undefined });
    }
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
    // يشمل الاختلافات المحفوظة والمشتقة من القواعد العامة (معرّفها global:...).
    if (document?.ayahKey === requestedAyahKey && requestedVariantId && requestedVariantId !== selectedVariantId) {
      selectVariant(requestedVariantId);
    }
  }, [document, requestedAyahKey, requestedVariantId, selectVariant, selectedVariantId]);

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

      showToast(describeImportResult(result));

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
    <PanelAutoHideProvider value={panelAutoHide}>
      <div
        ref={workspaceRef}
        className="-m-4 relative flex h-[calc(100dvh-73px)] flex-col overflow-hidden bg-stone-100 md:-m-6"
      >
        {/* الشريط العلوي: لوحتان (الأدوات والآيات) على حافة واحدة فترصّان معا. */}
        <PanelGroupFrame panels={['toolbar', 'navigator']} overlayClassName="bg-stone-100">
          <PanelSlot panel="toolbar">
            <EditorToolbar
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              onExport={handleExport}
              onImport={handleImportClick}
              onShowShortcuts={() => setShowShortcuts(true)}
            />
          </PanelSlot>
          <PanelSlot panel="navigator">
            <AyahNavigator ayahKey={ayahKey} onNavigate={openAyah} />
          </PanelSlot>
        </PanelGroupFrame>

        <div className="relative flex min-h-0 flex-1">
          <PanelFrame panel="properties" overlayClassName="h-full">
            <PropertiesPanel />
          </PanelFrame>

          <main className="flex min-w-0 flex-1 flex-col">
            <PanelFrame panel="breadcrumb">
              <SelectionBreadcrumb />
            </PanelFrame>
            <div className="min-h-0 flex-1">
              <TashjeerCanvas fontSize={fontSize} />
            </div>
          </main>

          <PanelFrame panel="variants" overlayClassName="h-full">
            <VariantsPanel />
          </PanelFrame>

          {/* مقابض عائمة دائمة على كل حافة فيها ما يُكشف: بديل اللمس، وطريقة
              كشف صريحة لا تعتمد على دقة ملامسة الحافة نفسها. */}
          <PanelEdgeHandle edge="top" label="إظهار الشريط العلوي" />
          <PanelEdgeHandle edge="start" label="إظهار اللوحة اليمنى" />
          <PanelEdgeHandle edge="end" label="إظهار اللوحة اليسرى" />
        </div>

        <PanelFrame panel="statusbar" overlayClassName="bg-white">
          <StatusBar
            surahNumber={surahNumber}
            ayahNumber={ayahNumber}
            tool={currentTool}
            isDirty={isDirty}
          />
        </PanelFrame>

        <PanelEdgeHandle edge="bottom" label="إظهار شريط الحالة" />

        <button
          type="button"
          onClick={toggleAutoHide}
          aria-pressed={panelPrefs.autoHide}
          className={`fixed bottom-5 end-5 z-50 rounded-full border px-3 py-2 text-[11px] font-medium shadow-xl transition-colors ${
            panelPrefs.autoHide
              ? 'border-emerald-300 bg-emerald-700 text-white hover:bg-emerald-800'
              : 'border-stone-300 bg-stone-900 text-white hover:bg-stone-700'
          }`}
          title="إخفاء الأشرطة واللوحات غير المثبتة؛ تُكشف بملامسة حافة الشاشة أو بالمقابض العائمة (H)"
        >
          {panelPrefs.autoHide
            ? `وضع اللوحات مفعّل${overlayCount > 0 ? ` (${toArabicDigits(overlayCount)} فوقية)` : ''}`
            : 'وضع إخفاء اللوحات'}
        </button>

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
    </PanelAutoHideProvider>
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
          الموضع: {formatAyahRef(surahNumber, ayahNumber)}
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

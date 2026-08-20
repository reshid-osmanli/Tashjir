// عرض تشجير الآية في صفحة المصحف - Quran Ayah Tashjeer View
//
// الهدف: أن يجد القارئ النتيجة النهائية مشجَّرة واحترافية في /quran مباشرة،
// بلا حاجة لفتح المحرر. المبدأ الحاكم هنا: **نفس خط الأنابيب** الذي يرسم به
// المحرر لوحته هو الذي يرسم هذه البطاقة — نفس المستند المحفوظ، ونفس المحرك،
// ونفس الروابط والترتيب اليدوي — فتتطابق النتيجتان حرفيا:
//
//   المحرر → حفظ البيانات → /quran ⇒ نتائج متطابقة.
//
// البطاقة تعرض أسطر الأوجه تحت نص الآية مع رموز القراء، وتكشف حالة التوثيق
// وعدد الروابط اليدوية، وتتيح الفتح في المحرر للتصحيح.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDocument } from '@/lib/storage/document-store';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { TashjeerFigure } from '@/components/editor/TashjeerFigure';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { VariantCategory } from '@/types';
import type { TashjeerDocument, ViewFilter } from '@/types/tashjeer';

/** تصفية كاملة: كل الفئات وكل الرواة، كما يرسم المحرر افتراضيا. */
const FULL_FILTER: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: false,
};

export function AyahTashjeerView({
  ayahKey,
  defaultOpen = true,
}: {
  ayahKey: number;
  /** هل تُفتح البطاقة مكشوفة افتراضيا (عرض التشجير مباشرة). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [document, setDocument] = useState<TashjeerDocument | null>(null);

  // قراءة المستند بعد التركيب: التخزين المحلي غير متاح وقت التصيير الأولي،
  // والقراءة في effect تضمن توافق الماء بين الخادم والمتصفح.
  useEffect(() => {
    setDocument(loadDocument(ayahKey));
  }, [ayahKey]);

  const catalog = useTransmissionCatalog();
  const engine = useEngineSettings();
  const strengthDegrees = useStrengthDegrees();
  const { layout, classic, viewBox } = useAyahTashjeer(
    document,
    FULL_FILTER,
    {},
    { catalog, engine, strengthDegrees }
  );

  if (!document) return null;

  const manualLinks = (document.links ?? []).length;
  const segments = (document.segments ?? []).length;
  const manualOrder = (document.lineOrder ?? []).length > 0;
  const editorEdits = (document.editLog ?? []).length;
  const categories = new Set(document.variants.map((variant) => variant.category));

  const statusBadge =
    document.meta.status === 'APPROVED'
      ? { label: 'معتمد', className: 'bg-emerald-100 text-emerald-800' }
      : document.meta.status === 'REVIEW'
        ? { label: 'قيد المراجعة', className: 'bg-amber-100 text-amber-800' }
        : { label: 'مسودة', className: 'bg-stone-100 text-stone-700' };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
          <span className="text-[11px] text-stone-700">
            التشجير المحفوظ: {toArabicDigits(classic.lines.length)} سطرا ·{' '}
            {toArabicDigits(document.variants.length)} اختلافا
          </span>
          {[...categories].map((category: VariantCategory) => (
            <span
              key={category}
              className="rounded bg-white px-1.5 py-0.5 text-[10px] text-stone-600 ring-1 ring-stone-200"
            >
              {CATEGORY_LABELS[category]}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] text-emerald-800 hover:bg-emerald-50"
          >
            {open ? 'طي التشجير' : 'إظهار التشجير'}
          </button>
          <Link
            href={`/editor?ayah=${ayahKey}`}
            className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
          >
            فتح في المحرر
          </Link>
        </div>
      </div>

      {open && (
        <div className="overflow-x-auto bg-[#fdfaf2] p-3" dir="rtl">
          <svg
            className="mx-auto block h-auto w-full"
            style={{ maxWidth: 'min(1100px, 100%)' }}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          >
            <TashjeerFigure
              layout={layout}
              classic={classic}
              viewBox={viewBox}
              fontSize={34}
              showLabels
              boundaries={document.boundaries}
              baseNarratorName={
                catalog.narrators.find((narrator) => narrator.id === 'narrator-hafs')?.name ?? 'حفص'
              }
              engine={engine}
            />
          </svg>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-emerald-100 px-4 py-2 text-[10px] text-stone-500">
        {manualLinks > 0 && (
          <span className="text-violet-700">
            علاقات يدوية: {toArabicDigits(manualLinks)} (أوجه مركبة / دمج أسطر)
          </span>
        )}
        {segments > 0 && (
          <span className="text-violet-700">أجزاء مربوطة: {toArabicDigits(segments)}</span>
        )}
        {manualOrder && <span className="text-cyan-700">ترتيب أسطر يدوي مثبَّت</span>}
        {editorEdits > 0 && <span>تصحيحات المحرر المسجلة: {toArabicDigits(editorEdits)}</span>}
        <span>آخر حفظ: {formatDate(document.meta.updatedAt)}</span>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return '—';
  }
}

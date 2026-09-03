// معالج الإنشاء الذكي - Smart Create Wizard (FR-ED-08)
// مشروع التشجير - نظام القراءات العشر
//
// يوحّد إنشاء اختلاف واحد، أو عدة اختلافات، أو عدة أوجه، أو كل ذلك دفعة
// واحدة. الفكرة: «ما يحتاجه المحقق من كلمات في الموضع يولَّد ككيانات مستقلة
// متجاورة، يستقل كل منها عن الباقين».
//
// الخطوات المبسّطة (دون أرقام ظاهرة للمستخدم):
//   1) المعالج يستقبل التحديد الحالي (معلّم من المحرر) كمدخل؛
//   2) يعرض حقائق اختلاف واحد لكل فئة مختارة، كل اختلاف بوجه افتراضي واحد
//      قابل للتحرير لاحقا من VariantEditor؛
//   3) «إنشاء» ينتج كيانات مستقلة بمعرّفات ورتب صريحة، قابلة للتعديل الفردي.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor, getCategorySoftColor } from '@/lib/tashjeer/color-system';
import { boundsOfLoci, describeLoci } from '@/lib/tashjeer/loci';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { VariantCategory } from '@/types';
import type { VariantLocus } from '@/types/tashjeer';

interface SmartCreateWizardProps {
  open: boolean;
  loci: VariantLocus[];
  markedText: string;
  /** يُستدعى عند الإغلاق أو الإلغاء. */
  onClose: () => void;
  /** يُستدعى بعد إنشاء الاختلافات بنجاح، مع تمرير معرّفات الكيانات. */
  onCreated?: (variantIds: string[]) => void;
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as VariantCategory[];

/**
 * معالج الإنشاء الذكي: خطوة واحدة لتحديد عدة أنواع، ثم مراجعة، ثم إنشاء.
 * كل نوع ينتج اختلافا مستقلا (P-05: الإنشاء الجماعي لا يلغي الاستقلال).
 */
export function SmartCreateWizard({
  open,
  loci,
  markedText,
  onClose,
  onCreated,
}: SmartCreateWizardProps) {
  const { addVariantGroup, openAyah } = useEditorStore();
  const [selectedCategories, setSelectedCategories] = useState<VariantCategory[]>(['USUL', 'FARSH', 'MADUD']);
  const [recitationMode, setRecitationMode] = useState<'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY'>('ALWAYS');
  const [defaultTitle, setDefaultTitle] = useState('');

  // تطبيع العنوان عند فتح المعالج بحسب النص المعلّم.
  useEffect(() => {
    if (open && !defaultTitle && markedText) {
      setDefaultTitle(markedText);
    }
  }, [open, defaultTitle, markedText]);

  const bounds = useMemo(() => (loci.length > 0 ? boundsOfLoci(loci) : null), [loci]);

  if (!open) return null;

  const toggle = (category: VariantCategory) => {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category]
    );
  };

  const handleCreate = () => {
    if (!bounds || selectedCategories.length === 0 || loci.length === 0) return;
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const baseText = defaultTitle.trim() || markedText || 'اختلاف';
    const built = selectedCategories.map((category, index) => {
      const id = `v-smart-${bounds.startPosition}-${stamp}-${index + 1}`;
      return {
        id,
        category,
        title: `${baseText} — ${CATEGORY_LABELS[category]}`,
        startPosition: bounds.startPosition,
        endPosition: bounds.endPosition,
        targetKind: loci.some((locus) => locus.characterRange) ? ('CHARACTERS' as const) : ('WORDS' as const),
        characterRange: loci.length === 1 ? loci[0].characterRange : undefined,
        loci: loci.length > 1 ? loci : undefined,
        orderRank: index + 1,
        status: 'DRAFT' as const,
        recitationMode: recitationMode === 'ALWAYS' ? undefined : (recitationMode as 'WAQF_ONLY' | 'WASL_ONLY'),
        alternatives: [
          {
            id: `${id}-base`,
            text: baseText,
            label: 'وجه المصحف',
            isBase: true,
            scope: { kind: 'ALL' as const },
          },
          {
            id: `${id}-alt-1`,
            text: baseText,
            label: 'الوجه الافتراضي',
            scope: { kind: 'NARRATORS' as const, narratorIds: [] },
            // يُفتح محرر الوجه بعد الإنشاء ليُحرَّر النصّ والمقدار.
          },
        ],
      };
    });
    addVariantGroup(built);
    onCreated?.(built.map((item) => item.id));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="معالج الإنشاء الذكي للاختلافات"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">معالج الإنشاء الذكي</h2>
            <p className="text-xs text-stone-500">
              خطوة واحدة لإنشاء عدة اختلافات مستقلة من تحديد واحد (FR-ED-08).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
          >
            إلغاء
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* معاينة التحديد الحالي */}
          <section>
            <h3 className="text-xs font-semibold text-stone-700">التحديد الحالي</h3>
            <div className="mt-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-2">
              <p
                className="text-base leading-loose text-stone-900"
                style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
              >
                {markedText || 'لم يُحدّد شيء. عد إلى المحرر وعلّم كلمات.'}
              </p>
              <p className="mt-1 text-[11px] text-stone-500">
                {toArabicDigits(loci.length)} موضعا منفصلا:{' '}
                {loci.length > 0 ? toArabicDigits(describeLoci(loci)) : '—'}
              </p>
            </div>
            {loci.length === 0 && (
              <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800">
                يلزم تحديد كلمة أو أكثر في المحرر قبل فتح المعالج. ستنشأ كل اختلافات الموضع المحدد.
              </p>
            )}
          </section>

          {/* اختيار الفئات */}
          <section>
            <h3 className="text-xs font-semibold text-stone-700">الفئات التي ستنشأ ككيانات مستقلة</h3>
            <p className="mt-0.5 text-[11px] text-stone-500">
              كل فئة تتحول إلى اختلاف مستقل بمعرّفه ورتبته. تحرير أيّ منها لاحقا لا يمس الباقي.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((category) => {
                const active = selectedCategories.includes(category);
                return (
                  <label
                    key={category}
                    className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition-colors ${
                      active
                        ? 'border-stone-800 text-stone-900'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                    style={active ? { backgroundColor: getCategorySoftColor(category), color: getCategoryColor(category) } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggle(category)}
                      className="h-3.5 w-3.5 accent-violet-600"
                    />
                    <span className="font-medium">{CATEGORY_LABELS[category]}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* عنوان افتراضي وسياق الأداء */}
          <section className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-700">عنوان افتراضي (اختياري)</span>
              <input
                type="text"
                value={defaultTitle}
                onChange={(event) => setDefaultTitle(event.target.value)}
                placeholder={markedText || 'يستخدم النص المحدد افتراضيا'}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-700">سياق الأداء (DM-06)</span>
              <select
                value={recitationMode}
                onChange={(event) => setRecitationMode(event.target.value as 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY')}
                className="input"
              >
                <option value="ALWAYS">دائما (وقفا ووصلا)</option>
                <option value="WAQF_ONLY">وقفا فقط (يسقط عند الوصل)</option>
                <option value="WASL_ONLY">وصلا فقط (يظهر عند الوصل)</option>
              </select>
            </label>
          </section>

          {/* معاينة ما سيُنشأ */}
          <section>
            <h3 className="text-xs font-semibold text-stone-700">معاينة قبل الإنشاء</h3>
            <div className="mt-1.5 rounded border border-stone-200 bg-stone-50 px-2 py-2 text-[11px] text-stone-700">
              {selectedCategories.length === 0 ? (
                <span className="text-stone-500">اختر فئة واحدة على الأقل.</span>
              ) : (
                <ul className="space-y-1">
                  {selectedCategories.map((category, index) => (
                    <li key={category} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: getCategorySoftColor(category), color: getCategoryColor(category) }}
                        >
                          {CATEGORY_LABELS[category]}
                        </span>
                        <span className="font-medium">{baseTitlePreview(defaultTitle, markedText)}</span>
                      </span>
                      <span className="text-stone-500">رتبة {toArabicDigits(index + 1)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-5 py-3">
          <span className="text-[11px] text-stone-500">
            ذر واحد: لقطة تراجع واحدة. التراجع يزيل كل ما أُنشئ.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={loci.length === 0 || selectedCategories.length === 0}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              إنشاء {toArabicDigits(selectedCategories.length)} اختلافا مستقلا
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function baseTitlePreview(defaultTitle: string, markedText: string): string {
  const t = defaultTitle.trim() || markedText || 'اختلاف';
  return t.length > 40 ? `${t.slice(0, 37)}…` : t;
}

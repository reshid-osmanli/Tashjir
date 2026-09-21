// محرر التجاوز المحلي لموضع قاعدة عامة — Local Override Editor (FR-ED-10/T2)
//
// يحرر المحقق قيم موضع واحد في هذه الآية وحدها: ما يُترك فارغًا يبقى مشتقًا
// من القاعدة الأمّ، وما يُملأ يُحفظ ترقيعًا محليًا لا يمس سائر المواضع.
// الحفظ تراجع واحد، والقاعدة الأمّ وسائر الآيات خارج التأثير دائمًا.

'use client';

import { useState } from 'react';
import { toArabicDigits, fromArabicDigits } from '@/lib/utils/arabic-numbers';
import type { VariantCategory } from '@/types';
import type { ReadingScope, Variant } from '@/types/tashjeer';
import type { GlobalRule } from '@/lib/storage/global-rules-store';
import type { LocalOverridePatch } from '@/lib/storage/rule-occurrences-store';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { ScopePicker } from './VariantEditor';
import { StrengthDegreePicker } from './StrengthDegreePicker';
import { OrderRankControl } from './OrderRankControl';

interface LocalOverrideEditorProps {
  /** الاختلاف المشتق الظاهر (بعد دمج أي ترقيع سابق). */
  variant: Variant;
  /** القاعدة الأمّ التي اشتُق منها. */
  rule: GlobalRule;
  /** الترقيع الحالي إن وُجد، لملء الحقول. */
  currentPatch?: LocalOverridePatch;
  /** نص المطابقة الأصلي قبل أي ترقيع. */
  originalText: string;
  onSave: (patch: LocalOverridePatch) => void;
  onClose: () => void;
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as VariantCategory[];

export function LocalOverrideEditor({
  variant,
  rule,
  currentPatch,
  originalText,
  onSave,
  onClose,
}: LocalOverrideEditorProps) {
  const patch = currentPatch ?? {};
  const face = variant.alternatives[0];

  const [title, setTitle] = useState(patch.title ?? '');
  const [category, setCategory] = useState<VariantCategory>(patch.category ?? rule.category);
  const [ruleLabel, setRuleLabel] = useState(patch.ruleLabel ?? '');
  const [description, setDescription] = useState(patch.description ?? '');
  const [sourceRef, setSourceRef] = useState(patch.sourceRef ?? '');
  const [text, setText] = useState(patch.text ?? '');
  const [label, setLabel] = useState(patch.label ?? '');
  const [notes, setNotes] = useState(patch.notes ?? '');
  const [madd, setMadd] = useState(patch.maddHarakat !== undefined ? toArabicDigits(patch.maddHarakat) : '');
  const [note, setNote] = useState(patch.note ?? '');
  const [customScope, setCustomScope] = useState(patch.scope !== undefined);
  const [scope, setScope] = useState<ReadingScope>(patch.scope ?? rule.scope);

  const [orderRank, setOrderRank] = useState(patch.orderRank);
  const [strength, setStrength] = useState({ degreeId: patch.strengthDegreeId, byNarrator: patch.strengthByNarrator });

  const handleSave = () => {
    // ما ساوى قيمة القاعدة الأمّ يُحرَّر من التجاوز (undefined) فيعود مشتقًا.
    const trimmed = (value: string) => {
      const clean = value.trim();
      return clean ? clean : undefined;
    };
    const differs = (value: string | undefined, base: string | undefined) =>
      value !== undefined && value !== (base ?? '');

    const nextTitle = trimmed(title);
    const nextRuleLabel = trimmed(ruleLabel);
    const nextDescription = trimmed(description);
    const nextSourceRef = trimmed(sourceRef);
    const nextText = text ? text : undefined;
    const nextLabel = trimmed(label);
    const nextNotes = trimmed(notes);
    const nextNote = trimmed(note);
    const maddNumber = madd.trim() === '' ? undefined : Number(fromArabicDigits(madd));

    const next: LocalOverridePatch = {
      orderRank, strengthDegreeId: strength.degreeId, strengthByNarrator: strength.byNarrator,
      title: differs(nextTitle, rule.title) ? nextTitle : undefined,
      category: category !== rule.category ? category : undefined,
      ruleLabel: differs(nextRuleLabel, rule.ruleLabel) ? nextRuleLabel : undefined,
      description: differs(nextDescription, rule.description) ? nextDescription : undefined,
      sourceRef: differs(nextSourceRef, rule.sourceRef) ? nextSourceRef : undefined,
      text: nextText !== undefined && nextText !== originalText ? nextText : undefined,
      label:
        differs(nextLabel, rule.ruleLabel ?? rule.title) && nextLabel !== nextRuleLabel
          ? nextLabel
          : undefined,
      notes: differs(nextNotes, rule.description) ? nextNotes : undefined,
      maddHarakat:
        maddNumber !== undefined && Number.isFinite(maddNumber) && maddNumber !== rule.maddHarakat
          ? maddNumber
          : undefined,
      scope:
        customScope && JSON.stringify(scope) !== JSON.stringify(rule.scope) ? scope : undefined,
      note: nextNote,
    };
    onSave(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="تحرير محلي لموضع قاعدة"
    >
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="border-b border-stone-200 px-5 py-4">
          <h2 className="text-sm font-bold text-stone-900">تحرير محلي — هذه الآية وحدها</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
            الموضع «{variant.title}» من قاعدة «{rule.title}». ما يُترك فارغًا يبقى مشتقًا من
            القاعدة الأمّ، وما يُملأ يخص هذا الموضع وحده ولا يمس سائر المصحف.
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-xs">
          <OrderRankControl value={orderRank} inherited={rule.orderRank} onChange={rank => setOrderRank(rank ?? undefined)} />
          <StrengthDegreePicker scope={customScope ? scope : rule.scope} degreeId={strength.degreeId}
            byNarrator={strength.byNarrator} onChange={next => setStrength({ degreeId: next.degreeId, byNarrator: next.byNarrator })}
            hint="تجاوز قوة هذا الموضع فقط؛ بلا تخصيص يتبع درجة القاعدة الأمّ." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-medium text-stone-700">العنوان</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={rule.title}
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-stone-700">النوع</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as VariantCategory)}
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {CATEGORY_LABELS[item]}
                    {item === rule.category ? ' (الأمّ)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-stone-700">الحكم المختصر</span>
              <input
                value={ruleLabel}
                onChange={(event) => setRuleLabel(event.target.value)}
                placeholder={rule.ruleLabel ?? rule.title}
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-stone-700">المد بالحركات</span>
              <input
                type="text"
                inputMode="numeric"
                min={1}
                max={6}
                value={madd}
                onChange={(event) => setMadd(toArabicDigits(event.target.value))}
                placeholder={rule.maddHarakat !== undefined ? String(rule.maddHarakat) : '—'}
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block font-medium text-stone-700">نص الوجه المعروض</span>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={originalText}
              className="w-full rounded border border-stone-300 px-2 py-1.5"
              style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-medium text-stone-700">تسمية الوجه (البطاقة)</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={face?.label ?? rule.ruleLabel ?? rule.title}
              className="w-full rounded border border-stone-300 px-2 py-1.5"
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-medium text-stone-700">الوصف</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={rule.description ?? '—'}
              rows={2}
              className="w-full rounded border border-stone-300 px-2 py-1.5"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-medium text-stone-700">المصدر</span>
              <input
                value={sourceRef}
                onChange={(event) => setSourceRef(event.target.value)}
                placeholder={rule.sourceRef ?? '—'}
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-stone-700">ملاحظات الوجه</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={rule.description ?? '—'}
                className="w-full rounded border border-stone-300 px-2 py-1.5"
              />
            </label>
          </div>

          <div className="rounded border border-stone-200 p-2">
            <label className="flex cursor-pointer items-center gap-2 text-stone-700">
              <input
                type="checkbox"
                checked={customScope}
                onChange={(event) => setCustomScope(event.target.checked)}
              />
              <span className="font-medium">تخصيص النطاق (القرّاء) لهذا الموضع وحده</span>
            </label>
            {customScope && (
              <div className="mt-2">
                <ScopePicker scope={scope} onChange={setScope} />
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block font-medium text-stone-700">سبب التجاوز (يُحفظ في السجل)</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="مثال: الكتاب يقدّم هذا الوجه في هذه الآية"
              className="w-full rounded border border-stone-300 px-2 py-1.5"
            />
          </label>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-stone-300 px-4 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
          >
            حفظ التجاوز المحلي
          </button>
        </footer>
      </div>
    </div>
  );
}

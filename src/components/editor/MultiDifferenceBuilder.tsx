// منشئ اختلافات متعددة مستقلة في عملية واحدة - Multi Difference Builder
// الميزة الأهم: إنشاء عدة اختلافات وأوجه دفعة واحدة مع علاقات

'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { documentWindowWords } from '@/lib/tashjeer/reading-window';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { describeScope } from '@/lib/tashjeer/scope';
import { characterCount, textForCharacterRange } from '@/lib/quran-logic/characters';
import { boundsOfLoci, buildLociFromMarks } from '@/lib/tashjeer/loci';
import type { VariantCategory } from '@/types';
import type { Variant, VariantAlternative } from '@/types/tashjeer';

interface FaceDraft {
  id: string;
  label: string;
  ruleLabel: string;
  category: VariantCategory;
  scopeKind: 'ALL' | 'NARRATORS' | 'IMAMS';
  narratorIds: string[];
  maddHarakat?: number;
  recitationMode?: 'ALWAYS' | 'WAQF_ONLY' | 'WASL_ONLY';
}

export function MultiDifferenceBuilder({ onClose }: { onClose: () => void }) {
  const { document, markedPositions, markedCharacters, markingMode, addVariantGroupWithRelations } = useEditorStore();
  const catalog = useTransmissionCatalog();
  const words = useMemo(() => documentWindowWords(document), [document]);

  const draftLoci = useMemo(() => {
    const wordLengths = new Map(words.map((w) => [w.position, characterCount(w.text)]));
    return buildLociFromMarks({ mode: markingMode, positions: markedPositions, characters: markedCharacters, wordLengths });
  }, [markingMode, markedCharacters, markedPositions, words]);

  const markedText = useMemo(() => {
    if (draftLoci.length === 0) return '';
    return draftLoci
      .map((locus) => (locus.characterRange ? textForCharacterRange(words, locus.characterRange) : words.filter((w) => w.position >= locus.startPosition && w.position <= locus.endPosition).map((w) => w.text).join(' ')))
      .filter(Boolean)
      .join('  ·  ');
  }, [draftLoci, words]);

  const [baseCategory, setBaseCategory] = useState<VariantCategory>('MADUD');
  const [faces, setFaces] = useState<FaceDraft[]>([
    { id: 'face-1', label: 'تحقيق', ruleLabel: 'تحقيق', category: 'USUL', scopeKind: 'ALL', narratorIds: [] },
    { id: 'face-2', label: 'صلة', ruleLabel: 'صلة', category: 'USUL', scopeKind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
    { id: 'face-3', label: 'فرش', ruleLabel: 'فرش', category: 'FARSH', scopeKind: 'ALL', narratorIds: [] },
  ]);
  const [createLinks, setCreateLinks] = useState(true);
  const [linkMode, setLinkMode] = useState<'MERGE' | 'REFERENCE'>('MERGE');

  if (!document) return null;
  if (draftLoci.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
          <h3 className="text-sm font-bold">منشئ متعدد الاختلافات</h3>
          <p className="mt-2 text-xs text-stone-600">علّم كلمة أو أكثر أولا ثم افتح هذه الأداة.</p>
          <button type="button" onClick={onClose} className="mt-4 w-full rounded bg-stone-800 px-3 py-2 text-xs text-white">إغلاق</button>
        </div>
      </div>
    );
  }

  const addFace = () => {
    setFaces((prev) => [
      ...prev,
      { id: `face-${Date.now()}`, label: `وجه ${prev.length + 1}`, ruleLabel: `حكم ${prev.length + 1}`, category: 'USUL', scopeKind: 'ALL', narratorIds: [] },
    ]);
  };

  const updateFace = (id: string, patch: Partial<FaceDraft>) => {
    setFaces((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeFace = (id: string) => {
    setFaces((prev) => prev.filter((f) => f.id !== id));
  };

  const handleCreate = () => {
    const bounds = boundsOfLoci(draftLoci);
    const batchGroupId = `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const isChars = draftLoci.some((l) => Boolean(l.characterRange));

    const variants = faces.map((face, index) => {
      const id = `v-${document.ayahKey}-${bounds.startPosition}-${batchGroupId}-${index + 1}`;
      const scope = face.scopeKind === 'ALL' ? { kind: 'ALL' as const } : face.scopeKind === 'IMAMS' ? { kind: 'IMAMS' as const, imamIds: face.narratorIds } : { kind: 'NARRATORS' as const, narratorIds: face.narratorIds };
      const alt: VariantAlternative = {
        id: `${id}-alt-${index + 1}`,
        text: markedText || face.label,
        label: face.label,
        ruleLabel: face.ruleLabel,
        scope,
        maddHarakat: face.maddHarakat,
      };
      const variant: any = {
        id,
        category: face.category,
        title: `${markedText} — ${face.label}`,
        startPosition: bounds.startPosition,
        endPosition: bounds.endPosition,
        targetKind: isChars ? 'CHARACTERS' : 'WORDS',
        characterRange: draftLoci.length === 1 ? draftLoci[0].characterRange : undefined,
        loci: draftLoci.length > 1 ? draftLoci : undefined,
        status: 'DRAFT',
        alternatives: [{ id: `${id}-base`, text: markedText || 'وجه المصحف', label: 'وجه المصحف', isBase: true, scope: { kind: 'ALL' } }, alt],
        orderRank: index + 1,
        recitationMode: face.recitationMode ?? 'ALWAYS',
        waqfContext: face.recitationMode ? { mode: face.recitationMode } : undefined,
        batchGroupId,
        isIndependent: true,
        subType: face.label,
        source: 'EDITOR',
        origin: 'EDITOR',
        correction: { final: `${markedText} — ${face.label}`, editor: `${markedText} — ${face.label}` },
      };
      return variant;
    });

    if (variants.length === 0) return;

    if (createLinks && variants.length > 1) {
      const base = variants[0];
      const related = variants.slice(1);
      addVariantGroupWithRelations({ base, related, createLinks: true, batchGroupId });
    } else {
      // بدون روابط، إنشاء مستقل
      const { addVariantGroup } = useEditorStore.getState();
      addVariantGroup(variants);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
        <header className="border-b border-stone-200 bg-stone-50 px-5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900">إنشاء عدة اختلافات مستقلة دفعة واحدة</h3>
              <p className="mt-0.5 text-[11px] text-stone-600">النص المحدد: <span className="font-bold" style={{ fontFamily: "'Amiri Quran', serif" }}>{markedText}</span> · {toArabicDigits(draftLoci.length)} موضعا</p>
            </div>
            <button type="button" onClick={onClose} className="rounded px-2 text-stone-500 hover:bg-stone-200">×</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-3 flex gap-2">
            <label className="text-[11px] text-stone-600">فئة الأساس<input type="hidden" value={baseCategory} /></label>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((cat) => (
                <button key={cat} type="button" onClick={() => setBaseCategory(cat)} className={`rounded border px-2 py-1 text-[10px] ${baseCategory === cat ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white'}`}>{CATEGORY_LABELS[cat]}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {faces.map((face, idx) => (
              <div key={face.id} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-white">{toArabicDigits(idx + 1)}</span>
                  <input value={face.label} onChange={(e) => updateFace(face.id, { label: e.target.value })} placeholder="تحقيق / صلة / فرش" className="h-7 flex-1 rounded border border-stone-300 px-2 text-[11px]" />
                  <input value={face.ruleLabel} onChange={(e) => updateFace(face.id, { ruleLabel: e.target.value })} placeholder="اسم الحكم" className="h-7 w-24 rounded border border-stone-300 px-2 text-[11px]" />
                  <button type="button" onClick={() => removeFace(face.id)} className="rounded border border-red-200 px-1.5 py-1 text-[10px] text-red-700">حذف</button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <select value={face.category} onChange={(e) => updateFace(face.id, { category: e.target.value as VariantCategory })} className="h-7 rounded border border-stone-300 bg-white px-1 text-[10px]">
                    {(Object.keys(CATEGORY_LABELS) as VariantCategory[]).map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
                  </select>
                  <select value={face.recitationMode ?? 'ALWAYS'} onChange={(e) => updateFace(face.id, { recitationMode: e.target.value as any })} className="h-7 rounded border border-stone-300 bg-white px-1 text-[10px]">
                    <option value="ALWAYS">وقفا ووصلا</option>
                    <option value="WAQF_ONLY">وقفا فقط</option>
                    <option value="WASL_ONLY">وصلا فقط</option>
                  </select>
                  <input type="number" min={1} max={6} value={face.maddHarakat ?? ''} onChange={(e) => updateFace(face.id, { maddHarakat: e.target.value ? Number(e.target.value) : undefined })} placeholder="حركات المد" className="h-7 rounded border border-stone-300 px-1 text-[10px]" />
                </div>
                <div className="mt-2">
                  <p className="text-[10px] text-stone-500">النطاق:</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button type="button" onClick={() => updateFace(face.id, { scopeKind: 'ALL', narratorIds: [] })} className={`rounded border px-1.5 py-0.5 text-[9px] ${face.scopeKind === 'ALL' ? 'bg-stone-800 text-white' : 'bg-white'}`}>الجميع</button>
                    {catalog.narrators.slice(0, 10).map((n) => (
                      <button key={n.id} type="button" onClick={() => updateFace(face.id, { scopeKind: 'NARRATORS', narratorIds: [n.id] })} className={`rounded border px-1.5 py-0.5 text-[9px] ${face.narratorIds.includes(n.id) ? 'bg-emerald-600 text-white' : 'bg-white'}`}>{n.name}</button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addFace} className="mt-3 w-full rounded border border-dashed border-stone-300 px-3 py-2 text-xs text-stone-600 hover:bg-stone-50">+ إضافة وجه آخر</button>

          <div className="mt-4 rounded bg-cyan-50 p-3">
            <label className="flex items-center gap-2 text-[11px] text-cyan-900"><input type="checkbox" checked={createLinks} onChange={(e) => setCreateLinks(e.target.checked)} className="accent-cyan-700" />إنشاء علاقات تلقائيا بين الأوجه (مد مرتبط بتحقيق+صلة+فرش)</label>
            {createLinks && (
              <div className="mt-2 flex gap-1">
                <button type="button" onClick={() => setLinkMode('MERGE')} className={`rounded border px-2 py-1 text-[10px] ${linkMode === 'MERGE' ? 'bg-cyan-700 text-white' : 'bg-white'}`}>دمج في سطر</button>
                <button type="button" onClick={() => setLinkMode('REFERENCE')} className={`rounded border px-2 py-1 text-[10px] ${linkMode === 'REFERENCE' ? 'bg-cyan-700 text-white' : 'bg-white'}`}>ربط مرجعي</button>
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-cyan-800">الإنشاء الجماعي شيء، واستقلال البيانات شيء آخر. كل اختلاف سيبقى بمعرّفه المستقل وقابل للتحرير دون التأثير على الباقي.</p>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-5 py-3">
          <span className="text-[10px] text-stone-500">سيُنشأ {toArabicDigits(faces.length)} اختلافات مستقلة</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded border border-stone-300 bg-white px-4 py-1.5 text-xs">إلغاء</button>
            <button type="button" onClick={handleCreate} className="rounded bg-emerald-600 px-5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">إنشاء المجموعة</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

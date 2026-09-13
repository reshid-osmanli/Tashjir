'use client';
import { useEditorStore, type EditorHistoryEntry } from '@/stores/editor-store';
import { confirmAction } from '@/lib/ui/confirm-store';
import { toArabicDigits as ar } from '@/lib/utils/arabic-numbers';
import type { TashjeerDocument } from '@/types/tashjeer';

/** Uses the existing document history, never a second competing command stack. */
export function HistoryControls() {
  const { past, future, document } = useEditorStore();
  const snapshots = [...past, ...(document ? [document] : []), ...future];
  // الحالة الحالية مستند صريح، والبقية لقطات موحّدة (مستند + استثناءات + قواعد).
  const docOf = (snapshot: TashjeerDocument | EditorHistoryEntry): TashjeerDocument =>
    'occurrences' in snapshot ? snapshot.document : snapshot;
  const jump = async (index: number) => {
    const count = Math.abs(index - past.length);
    if (!count || !document) return;
    if (!await confirmAction({ title: 'الانتقال إلى هذه الحالة؟', impacts: [{ label: 'عمليات سيُغيّر تطبيقها', count }], undoable: true, tone: 'default' })) return;
    const state = useEditorStore.getState();
    if (state.document !== document || state.past !== past || state.future !== future) return;
    if (index < past.length) for (let i = 0; i < count; i++) useEditorStore.getState().undo();
    else for (let i = 0; i < count; i++) useEditorStore.getState().redo();
  };
  return <details className="relative text-xs" dir="rtl">
    <summary className="cursor-pointer rounded border border-stone-300 px-2 py-1">سجل العمليات ({ar(past.length)})</summary>
    <ol aria-label="حالات سجل العمليات" className="absolute start-0 top-full z-40 mt-1 max-h-72 w-72 overflow-auto rounded border bg-white p-2 shadow-xl">
      {snapshots.map((snapshot, index) => <li key={index}>
        <button type="button" aria-current={index === past.length ? 'step' : undefined} disabled={index === past.length}
          onClick={() => void jump(index)} className="w-full rounded px-2 py-1 text-start hover:bg-stone-100 disabled:bg-emerald-50 disabled:text-emerald-800">
          {ar(index)} · {index === 0 ? 'أقدم حالة محفوظة' : docOf(snapshot).editLog?.at(-1)?.action ?? 'تعديل المستند'}{index === past.length ? ' — الحالية' : ''}
        </button>
      </li>)}
    </ol>
  </details>;
}

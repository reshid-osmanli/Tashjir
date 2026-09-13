// قائمة سياق العنصر النشط — Selection Context Menu (FR-ED-02.6)
// مشروع التشجير - نظام القراءات العشر
//
// الزر الأيمن على أي عنصر (في اللوحة أو في القوائم) يفتح قائمة أوامره:
// نسخ، قص، لصق، حذف، ترتيب، نسخ المعرّف… الأوامر ممكَّنة من الوحدة النقية
// المشتركة (selection-commands.ts) فلا يتفرق قرار التمكين بين لوحة وأخرى.
// عمليات التحرير العميقة (دمج/نقل متقدم) تبقى لحزمة 04؛ هذه القائمة تبني
// القاعدة: تحديد موحّد + أوامر ممكَّنة عليه.

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '@/stores/editor-store';
import { selectionCommands, type SelectionCommand } from '@/lib/tashjeer/selection-commands';

export interface ContextMenuState {
  x: number;
  y: number;
}

interface SelectionContextMenuProps {
  state: ContextMenuState | null;
  onClose: () => void;
}

export function SelectionContextMenu({ state, onClose }: SelectionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const clipboard = useEditorStore((state) => state.clipboard);
  const selection = useEditorStore((state) => state.selection);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!state) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, state]);

  if (!state || !mounted || !selection) return null;

  const commands = selectionCommands(selection, { hasClipboard: clipboard !== null });
  if (commands.length === 0) return null;

  // تحافظ القائمة على بقاء عنصرها النشط هو المحدَّد: النقر على الأمر ينفّذه
  // على التحديد الموحّد الحالي (مصدر الحقيقة الواحد).
  const run = (command: SelectionCommand) => {
    const store = useEditorStore.getState();
    switch (command.id) {
      case 'COPY':
        store.copySelection();
        break;
      case 'CUT':
        store.cutSelection();
        break;
      case 'PASTE':
        store.pasteSelection();
        break;
      case 'DELETE':
        deleteActive(store);
        break;
      case 'COPY_ID':
        void navigator.clipboard?.writeText(selection.id);
        break;
      case 'EDIT':
        if (selection.kind === 'RULE' && selection.differenceId) {
          window.location.assign(`/studio?rule=${encodeURIComponent(selection.id)}`);
        }
        break;
      default:
        break;
    }
    onClose();
  };

  // موضع داخل الشاشة دائمًا، فلا تخرج القائمة عن الإطار مهما كان النقر قرب الحافة.
  const x = Math.min(state.x, window.innerWidth - 220);
  const y = Math.min(state.y, window.innerHeight - Math.min(60 + commands.length * 30, 320));

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`أوامر العنصر المحدد`}
      className="fixed z-[70] min-w-[190px] overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-2xl"
      style={{ left: x, top: y }}
    >
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          role="menuitem"
          disabled={!command.enabled}
          onClick={() => run(command)}
          title={command.hint}
          className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-right text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            command.danger ? 'text-rose-700 hover:bg-rose-50' : 'text-stone-700 hover:bg-emerald-50'
          }`}
        >
          <span>{command.label}</span>
          {command.id === 'COPY_ID' && <Kbd>{selection.id.slice(0, 14)}</Kbd>}
        </button>
      ))}
    </div>,
    window.document.body
  );
}

/** حذف العنصر النشط عبر إجراء المخزن المناسب لنوعه (بالتأكيد الكمي في الحوارات). */
function deleteActive(store: ReturnType<typeof useEditorStore.getState>): void {
  const selection = store.selection;
  if (!selection) return;
  if (selection.kind === 'DIFFERENCE') {
    void store.deleteVariant(selection.id);
  } else if (selection.kind === 'FACE' && selection.differenceId) {
    store.deleteAlternative(selection.differenceId, selection.faceId ?? selection.id);
  } else if (selection.kind === 'SEGMENT') {
    store.deleteSegment(selection.id);
  } else if (selection.kind === 'WAQF_MARK') {
    store.deleteBoundary(selection.id);
  }
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[9px] text-stone-400" dir="ltr">
      {children}
    </span>
  );
}

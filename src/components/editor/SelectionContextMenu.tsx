// قائمة سياق العنصر النشط — Selection Context Menu (FR-ED-02.6) · A130
// مشروع التشجير - نظام القراءات العشر
//
// الزر الأيمن على أي عنصر (في اللوحة أو في القوائم) يفتح قائمة أوامره:
// نسخ، قص، لصق، حذف، ترتيب، نسخ المعرّف… الأوامر ممكَّنة من الوحدة النقية
// المشتركة (selection-commands.ts)، وتُنفَّذ كلها عبر الخطة المشتركة
// (selection-command-actions.ts) فلا يوجد أمر يبدو فعّالا ولا يفعل شيئا.
// عمليات التحرير العميقة (دمج/نقل متقدم) تبقى لحزمة 04؛ هذه القائمة تبني
// القاعدة: تحديد موحّد + أوامر ممكَّنة عليه.

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '@/stores/editor-store';
import { selectionCommands, type SelectionCommand } from '@/lib/tashjeer/selection-commands';
import { commandIsFunctional, executeSelectionCommand, planSelectionCommand } from '@/lib/editor/selection-command-actions';

// Immutable UI identity tables. Keys denote finite controls, never row positions.
const UI_SelectionContextMenu_0 = {
  "COPY": "A1259",
  "CUT": "A1260",
  "PASTE": "A1261",
  "DELETE": "A1262",
  "COPY_ID": "A1263",
  "LINK": "A1264",
  "MOVE_UP": "A1265",
  "MOVE_DOWN": "A1266",
  "WHY": "A1267",
  "UNLINK": "A1268",
  "EDIT": "A1269"
} as const;

const SHORTCUT_OF: Partial<Record<SelectionCommand['id'], string>> = {
  COPY: 'Control+C', CUT: 'Control+X', PASTE: 'Control+V',
  MOVE_UP: 'Alt+ArrowUp', MOVE_DOWN: 'Alt+ArrowDown',
};

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

  const commands = selectionCommands(selection, { hasClipboard: clipboard !== null })
    // لا نعرض أمرا لا ينفّذ إجراء حقيقيا: عنصر يوهم بالعمل أسوأ من عنصر غائب.
    .filter((command) => commandIsFunctional(planSelectionCommand(command, selection)));
  if (commands.length === 0) return null;

  // تحافظ القائمة على بقاء عنصرها النشط هو المحدَّد: النقر على الأمر ينفّذه
  // على التحديد الموحّد الحالي (مصدر الحقيقة الواحد).
  const run = (command: SelectionCommand) => {
    const plan = planSelectionCommand(command, selection);
    onClose();
    void executeSelectionCommand(plan).then((message) => {
      // إشعار قصير في الشريط الموحّد: كل ضغطة لها أثر مرئي/مسموع.
      if (message) useEditorStore.setState({ clipboardNotice: message });
    });
  };

  // موضع داخل الشاشة دائمًا: إحداثيات غير صالحة لا تُسقط القائمة خارجها.
  const estimatedHeight = 60 + commands.length * 30;
  const rawX = Number.isFinite(state.x) ? state.x : window.innerWidth / 2;
  const rawY = Number.isFinite(state.y) ? state.y : window.innerHeight / 2;
  const x = Math.max(8, Math.min(rawX, window.innerWidth - 220));
  const y = Math.max(8, Math.min(rawY, window.innerHeight - Math.min(estimatedHeight, 320)));

  return createPortal(
    <div
      ref={menuRef}
      data-ui-id="A130"
      role="menu"
      aria-label={`أوامر العنصر المحدد: ${selection.id}`}
      className="fixed z-[70] min-w-[190px] overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-2xl"
      style={{ left: x, top: y }}
    >
      <div className="border-b border-stone-100 px-3 py-1 text-[10px] text-stone-400" dir="ltr">
        {selection.kind} · {selection.id.slice(0, 24)}
      </div>
      {commands.map((command) => (
        <button data-ui-id={UI_SelectionContextMenu_0[command.id as keyof typeof UI_SelectionContextMenu_0]}
          key={command.id}
          type="button"
          role="menuitem"
          disabled={!command.enabled}
          aria-disabled={!command.enabled}
          aria-keyshortcuts={SHORTCUT_OF[command.id]}
          onClick={() => run(command)}
          title={command.hint ?? command.label}
          data-command-state={command.enabled ? 'ready' : 'disabled'}
          data-command-id={command.id}
          className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-right text-[12px] transition-colors duration-100
            focus-visible:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500
            active:translate-y-px active:bg-emerald-100
            disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 ${
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

function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[9px] text-stone-400" dir="ltr">
      {children}
    </span>
  );
}

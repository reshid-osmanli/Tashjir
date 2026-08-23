// سجل العمليات الموحّد — Unified Command Log (DM-15, FR-ED-13)
//
// سجل تراجع واحد على مستوى المستند يغطي كل العمليات: النقل، الدمج، الفصل،
// الحذف الفردي والجماعي، اللصق، التعميم، إنشاء مجموعة، إعادة الترتيب، تعديل
// الرتبة، وضع/إزالة علامات الوقف، التعديلات المحلية. العمليات الدفعية تُتراجع
// كوحدة واحدة، ولا تُفقد بيانات (P-13). مكوّن نقي بلا DOM فيتسنى اختباره.

import { createEntityId } from '@/lib/tashjeer/model/v8';

export type CommandKind =
  | 'MOVE'
  | 'MERGE'
  | 'UNMERGE'
  | 'DELETE'
  | 'DELETE_MANY'
  | 'PASTE'
  | 'CUT'
  | 'GENERALIZE'
  | 'CREATE_GROUP'
  | 'REORDER'
  | 'SET_RANK'
  | 'WAQF_MARK'
  | 'LOCAL_OVERRIDE'
  | 'BATCH';

export interface Command {
  id: string;
  label: string;
  kind: CommandKind;
  timestamp: string;
  /** يُطبّق الأثر (يُستعمل عند redo). */
  do: () => void;
  /** يلغي الأثر (يُستعمل عند undo). */
  undo: () => void;
  /** معرّف الدفعة عندما يكون جزءا من عملية دفعية. */
  batchId?: string;
}

/** دفعة: مجموعة أوامر تُعامل وحدة واحدة للتراجع/الإعادة. */
interface BatchCommand extends Command {
  kind: 'BATCH';
  commands: Command[];
}

function isBatch(command: Command): command is BatchCommand {
  return command.kind === 'BATCH' && 'commands' in command;
}

/**
 * سجل أوامر متعدد الخطوات (غير محدود عمليا لطول الجلسة) مع Undo/Redo،
 * وقائمة عمليات قابلة للقفز إليها.
 */
export class CommandLog {
  private done: Command[] = [];
  private undone: Command[] = [];
  private pendingBatch: BatchCommand | null = null;

  /** يُستدعى بعد كل التزام (للتتبع/التوثيق). */
  onCommit?: (command: Command) => void;

  /** هل يوجد ما يُتراجع عنه؟ */
  get canUndo(): boolean {
    return this.done.length > 0;
  }

  /** هل يوجد ما يُعاد تنفيذه؟ */
  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  /** عمق التراجع الحالي. */
  get depth(): number {
    return this.done.length;
  }

  /**
   * يسجّل أمرا منفردا ويُطبّق أثره (do) فورا.
   * النمط: يمرّر المستدعي do (يطبّق الأثر) و undo (يعكسه)، وهنا نُطبّق do
   * مباشرة ثم ندفع الأمر، فيتسق السلوك مع undo/redo (FR-ED-13).
   */
  record(
    label: string,
    kind: CommandKind,
    doFn: () => void,
    undoFn: () => void
  ): Command {
    const command: Command = {
      id: createEntityId('cmd'),
      label,
      kind,
      timestamp: new Date().toISOString(),
      do: doFn,
      undo: undoFn,
    };

    command.do();
    if (this.pendingBatch) {
      this.pendingBatch.commands.push(command);
      return command;
    }

    this.done.push(command);
    this.undone = [];
    this.onCommit?.(command);
    return command;
  }

  /**
   * يُجمّع عدة أوامر مسجّلة داخله في دفعة واحدة تُتراجع كوحدة.
   * يُستعمل للتعميم/الإنشاء الجماعي/الحذف الجماعي (FR-ED-13.3، P-05).
   */
  transaction<T>(label: string, fn: () => T): T {
    const batch: BatchCommand = {
      id: createEntityId('batch'),
      label,
      kind: 'BATCH',
      timestamp: new Date().toISOString(),
      commands: [],
      do: () => batch.commands.forEach((command) => command.do()),
      undo: () => {
        for (let i = batch.commands.length - 1; i >= 0; i -= 1) batch.commands[i].undo();
      },
    };

    const previous = this.pendingBatch;
    this.pendingBatch = batch;
    let result: T;
    try {
      result = fn();
    } finally {
      this.pendingBatch = previous;
    }

    if (batch.commands.length > 0) {
      this.done.push(batch);
      this.undone = [];
      this.onCommit?.(batch);
    }
    return result;
  }

  /** يتراجع عن آخر أمر (أو دفعة كاملة). */
  undo(): Command | null {
    const command = this.done.pop();
    if (!command) return null;
    command.undo();
    this.undone.push(command);
    return command;
  }

  /** يُعيد تنفيذ آخر أمر مُتراجع عنه. */
  redo(): Command | null {
    const command = this.undone.pop();
    if (!command) return null;
    command.do();
    this.done.push(command);
    return command;
  }

  /** قائمة العمليات المرتكبة (للقفز إلى حالة). */
  history(): Array<{ id: string; label: string; kind: CommandKind; batch?: boolean }> {
    return this.done.map((command) => ({
      id: command.id,
      label: command.label,
      kind: command.kind,
      batch: isBatch(command),
    }));
  }

  /** يقفز إلى عمق معين: يتراجع/يُعيد حتى يصل لعدد أوامر مُطبَّقة = targetDepth. */
  jumpTo(targetDepth: number): void {
    const maxDepth = this.done.length + this.undone.length;
    const clamped = Math.max(0, Math.min(targetDepth, maxDepth));
    while (this.done.length > clamped) this.undo();
    while (this.done.length < clamped) this.redo();
  }

  /** يُفرغ السجل (بعد الحفظ عادة). */
  clear(): void {
    this.done = [];
    this.undone = [];
  }
}

/** يبني أمرا من لقطة قبل/بعد على كائن قابل للتعديل (Snapshot-based Undo). */
export function snapshotCommand<T>(
  label: string,
  kind: CommandKind,
  target: { state: T },
  before: T,
  after: T,
  apply: (value: T) => void
): Command {
  return {
    id: createEntityId('cmd'),
    label,
    kind,
    timestamp: new Date().toISOString(),
    do: () => {
      target.state = after;
      apply(after);
    },
    undo: () => {
      target.state = before;
      apply(before);
    },
  };
}

// اختبارات سجل العمليات الموحّد (DM-15، FR-ED-13)
import { describe, expect, it } from 'vitest';
import { CommandLog, snapshotCommand } from '@/lib/tashjeer/history/command-log';

describe('سجل العمليات — Undo/Redo', () => {
  it('يسجّل ويرجع عن أمر منفرد', () => {
    const log = new CommandLog();
    let value = 0;
    log.record('زيادة', 'SET_RANK', () => { value = 1; }, () => { value = 0; });
    expect(value).toBe(1);
    expect(log.canUndo).toBe(true);
    log.undo();
    expect(value).toBe(0);
    expect(log.canRedo).toBe(true);
    log.redo();
    expect(value).toBe(1);
  });

  it('لا يتجاوز التراجع حدود السجل', () => {
    const log = new CommandLog();
    log.undo();
    expect(log.canUndo).toBe(false);
    log.redo();
    expect(log.canRedo).toBe(false);
  });
});

describe('سجل العمليات — الدفعة كوحدة (FR-ED-13.3)', () => {
  it('التراجع عن الدفعة يرجع كل أوامرها دفعة واحدة', () => {
    const log = new CommandLog();
    let a = 0;
    let b = 0;
    log.transaction('تعميم', () => {
      log.record('أ', 'GENERALIZE', () => { a = 1; }, () => { a = 0; });
      log.record('ب', 'GENERALIZE', () => { b = 1; }, () => { b = 0; });
    });
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(log.depth).toBe(1); // الدفعة وحدة واحدة
    log.undo();
    expect(a).toBe(0);
    expect(b).toBe(0);
    log.redo();
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

describe('سجل العمليات — القفز إلى حالة', () => {
  it('jumpTo يعيد/يتراجع حتى العمق المطلوب', () => {
    const log = new CommandLog();
    const state: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      log.record(`خطوة ${i}`, 'MOVE', () => state.push(i), () => state.pop());
    }
    expect(state).toEqual([0, 1, 2]);
    log.jumpTo(1);
    expect(state).toEqual([0]);
    log.jumpTo(3);
    expect(state).toEqual([0, 1, 2]);
  });

  it('history يعيد قائمة العمليات', () => {
    const log = new CommandLog();
    log.record('أ', 'MOVE', () => {}, () => {});
    log.record('ب', 'MERGE', () => {}, () => {});
    const h = log.history();
    expect(h).toHaveLength(2);
    expect(h[1].kind).toBe('MERGE');
  });
});

describe('لقطة التراجع (Snapshot-based)', () => {
  it('snapshotCommand يطبّق ويُلغي عبر اللقطة', () => {
    const log = new CommandLog();
    const target = { state: 'before' };
    const cmd = snapshotCommand('تبديل', 'LOCAL_OVERRIDE', target, 'before', 'after', () => {});
    cmd.do();
    expect(target.state).toBe('after');
    cmd.undo();
    expect(target.state).toBe('before');
    expect(cmd.kind).toBe('LOCAL_OVERRIDE');
  });
});

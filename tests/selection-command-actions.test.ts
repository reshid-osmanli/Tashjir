// أوامر A130/A129: لا أمر بلا إجراء حقيقي (المرحلة الأولى)
//
// كل الأوامر المعروضة مُخطَّطة إلى إجراء ملموس في المخزن. الذي لا يُدعم
// لا يُعرض كزر فعّال، بل يُعلَّل بسبب واضح. تُختبر الخطة نقية بلا DOM.

import { describe, expect, it } from 'vitest';
import { selectionCommands, type SelectionCommand } from '@/lib/tashjeer/selection-commands';
import {
  commandIsFunctional,
  planSelectionCommand,
  type SelectionCommandPlan,
} from '@/lib/editor/selection-command-actions';
import type { EditorSelection } from '@/types/tashjeer';

const selection = (s: EditorSelection): EditorSelection => s;

const KINDS: EditorSelection[] = [
  { kind: 'DIFFERENCE', id: 'd1', differenceId: 'd1' },
  { kind: 'FACE', id: 'f1', differenceId: 'd1', faceId: 'f1' },
  { kind: 'SEGMENT', id: 's1' },
  { kind: 'LINE', id: 'line-3', lineId: 'line-3', differenceId: 'd1', position: 4 },
  { kind: 'LINE', id: 'manual::line-3', lineId: 'manual::line-3' },
  { kind: 'RULE', id: 'rule-1', differenceId: 'd1' },
  { kind: 'COMPOSITE_FACE', id: 'link-1' },
  { kind: 'WAQF_MARK', id: 'w1' },
  { kind: 'WORD', id: '1004001' },
  { kind: 'CHARACTER', id: '1004001:2', wordId: 1004001 },
  { kind: 'LOCUS', id: 'locus-1' },
];

function plan(id: SelectionCommand['id'], s: EditorSelection): SelectionCommandPlan {
  return planSelectionCommand(id, s);
}

describe('كل الأوامر المعروضة تنفّذ إجراءً', () => {
  it('لا توجد خطة unsupported لأي أمر ممكّن في أي نوع تحديد', () => {
    for (const s of KINDS) {
      const commands = selectionCommands(s, { hasClipboard: true });
      for (const command of commands) {
        const result = planSelectionCommand(command, s);
        expect(result.type, `${s.kind}/${command.id}: ${JSON.stringify(result)}`).not.toBe('unsupported');
        expect(commandIsFunctional(result)).toBe(true);
      }
    }
  });

  it('الأوامر الستة التي كانت تبتلعها default:break صارت خططا حقيقية', () => {
    expect(plan('LINK', selection({ kind: 'FACE', id: 'f1', differenceId: 'd1', faceId: 'f1' }))).toEqual({ type: 'link', kind: 'FACE', id: 'd1::f1' });
    expect(plan('LINK', selection({ kind: 'LINE', id: 'line-3', lineId: 'line-3' }))).toEqual({ type: 'link', kind: 'LINE', id: 'line-3' });
    expect(plan('MOVE_UP', selection({ kind: 'LINE', id: 'line-3', lineId: 'line-3' }))).toEqual({ type: 'move-line', delta: -1 });
    expect(plan('MOVE_DOWN', selection({ kind: 'LINE', id: 'line-3', lineId: 'line-3' }))).toEqual({ type: 'move-line', delta: 1 });
    expect(plan('WHY', selection({ kind: 'RULE', id: 'rule-1', differenceId: 'd1' }))).toEqual({ type: 'why', ruleId: 'rule-1', differenceId: 'd1' });
    expect(plan('UNLINK', selection({ kind: 'COMPOSITE_FACE', id: 'link-1' }))).toEqual({ type: 'unlink', linkId: 'link-1' });
  });

  it('EDIT يفتح المحرر الصحيح لكل نوع بدل نوع واحد فقط', () => {
    expect(plan('EDIT', selection({ kind: 'DIFFERENCE', id: 'd1' }))).toEqual({ type: 'edit', target: { kind: 'DIFFERENCE', id: 'd1' } });
    expect(plan('EDIT', selection({ kind: 'FACE', id: 'f1', differenceId: 'd1', faceId: 'f1' }))).toEqual({ type: 'edit', target: { kind: 'FACE', id: 'f1', ownerId: 'd1' } });
    expect(plan('EDIT', selection({ kind: 'SEGMENT', id: 's1' }))).toEqual({ type: 'edit', target: { kind: 'SEGMENT', id: 's1' } });
    expect(plan('EDIT', selection({ kind: 'RULE', id: 'rule-1' }))).toEqual({ type: 'edit', target: { kind: 'RULE', id: 'rule-1' } });
    expect(plan('EDIT', selection({ kind: 'LINE', id: 'line-3', lineId: 'line-3', differenceId: 'd1', position: 4 }))).toEqual({
      type: 'edit', target: { kind: 'LINE', id: 'line-3', ownerId: 'd1', position: 4 },
    });
  });

  it('DELETE يوجّه كل نوع إلى إجراء المخزن الصحيح', () => {
    expect(plan('DELETE', selection({ kind: 'DIFFERENCE', id: 'd1' }))).toEqual({ type: 'delete', target: { kind: 'DIFFERENCE', id: 'd1' } });
    expect(plan('DELETE', selection({ kind: 'FACE', id: 'f1', differenceId: 'd1', faceId: 'f1' }))).toEqual({ type: 'delete', target: { kind: 'FACE', id: 'f1', ownerId: 'd1' } });
    expect(plan('DELETE', selection({ kind: 'COMPOSITE_FACE', id: 'link-1' }))).toEqual({ type: 'delete', target: { kind: 'COMPOSITE_FACE', id: 'link-1' } });
  });

  it('PASTE يمرّ بالتأكيد وCOPY_ID يحمل المعرّف', () => {
    expect(plan('PASTE', selection({ kind: 'DIFFERENCE', id: 'd1' }))).toEqual({ type: 'paste' });
    expect(plan('COPY_ID', selection({ kind: 'DIFFERENCE', id: 'd1' }))).toEqual({ type: 'copy-id', text: 'd1' });
    expect(commandIsFunctional({ type: 'copy-id', text: '' })).toBe(false);
  });

  it('نسخ سطر بلا اختلاف مرساة يُخفى ولا يُعرض كزر ميت', () => {
    const bare = selection({ kind: 'LINE', id: 'manual::line-3', lineId: 'manual::line-3' });
    expect(selectionCommands(bare, { hasClipboard: false }).some((command) => command.id === 'COPY')).toBe(false);
    expect(planSelectionCommand('COPY', bare).type).toBe('unsupported');
    const anchored = selection({ kind: 'LINE', id: 'line-3', lineId: 'line-3', differenceId: 'd1' });
    expect(selectionCommands(anchored, { hasClipboard: false }).some((command) => command.id === 'COPY')).toBe(true);
    expect(planSelectionCommand('COPY', anchored)).toEqual({ type: 'copy' });
  });

  it('أمر غير مدعوم يُعلَّل ولا يُعرض كزر فعّال', () => {
    const result = plan('LINK', selection({ kind: 'RULE', id: 'r' }));
    expect(result.type).toBe('unsupported');
    expect(commandIsFunctional(result)).toBe(false);
    expect(planSelectionCommand('COPY', null as unknown as EditorSelection).type).toBe('unsupported');
  });
});

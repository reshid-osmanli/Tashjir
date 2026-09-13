import type { ClassicLine } from '../classic-tashjeer';
import type { EngineConfig } from '../model/v8';
import { resolveMerge } from './api';
import { editorCategoryToStudioType, resolveLinkPolicy } from './editor-bridge';

/** Only this adapter translates rendered line contents into Decision API queries. */
export function resolveLineMerge(from: ClassicLine, to: ClassicLine, profile: EngineConfig) {
  const relation = resolveLinkPolicy({ kind: 'LINE_TO_LINE', relation: 'MERGE', from: { type: 'LINE', id: from.id }, to: { type: 'LINE', id: to.id } }, profile);
  const first = [...new Set(from.entries.map((entry) => entry.category).concat(from.category))];
  const second = [...new Set(to.entries.map((entry) => entry.category).concat(to.category))];
  const pairs = first.flatMap((a) => second.map((b) => resolveMerge(editorCategoryToStudioType(a), editorCategoryToStudioType(b), profile)));
  const blocked = pairs.filter((result) => !result.decision.merge);
  return {
    allowed: relation.decision.allowed && blocked.length === 0,
    reasons: [
      ...(!relation.decision.allowed ? [relation.decision.reason] : []),
      ...blocked.map((result) => `${result.decision.reason} — الأولوية ${result.decision.priority}`),
    ],
    trace: [...relation.trace, ...pairs.flatMap((result) => result.trace)],
    ruleNames: [...new Set([...relation.appliedRules, ...pairs.flatMap((result) => result.appliedRules)].map((rule) => rule.name))],
  };
}

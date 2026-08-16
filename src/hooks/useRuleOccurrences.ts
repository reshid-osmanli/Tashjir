// خطاف استثناءات مواضع القواعد
//
// حذف موضع أو تخصيص درجته يجب أن ينعكس على اللوحة فورا، دون إعادة فتح
// الآية. هذا الخطاف يعطي مفتاحا يتغير عند كل تعديل، فتُعاد الاشتقاقات.

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listOccurrenceLog,
  listOccurrenceOverrides,
  RULE_OCCURRENCES_EVENT,
  type OccurrenceLogEntry,
  type RuleOccurrenceOverride,
} from '@/lib/storage/rule-occurrences-store';

export interface RuleOccurrencesState {
  overrides: RuleOccurrenceOverride[];
  log: OccurrenceLogEntry[];
  /** مفتاح يتغير عند كل تعديل؛ يُمرَّر إلى الخطافات التي تشتق الاختلافات. */
  key: string;
  refresh: () => void;
}

export function useRuleOccurrences(ruleId?: string): RuleOccurrencesState {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ overrides: RuleOccurrenceOverride[]; log: OccurrenceLogEntry[] }>(
    () => ({ overrides: [], log: [] })
  );

  const refresh = useCallback(() => {
    setState({ overrides: listOccurrenceOverrides(ruleId), log: listOccurrenceLog(ruleId) });
    setVersion((current) => current + 1);
  }, [ruleId]);

  useEffect(() => {
    refresh();
    window.addEventListener(RULE_OCCURRENCES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(RULE_OCCURRENCES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  return { ...state, key: `${ruleId ?? 'all'}:${version}`, refresh };
}

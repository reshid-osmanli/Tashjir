// خطاف القواعد العامة — Global Rules Hook
//
// أي تغيير في القواعد (إنشاء، تحرير، حذف، تراجع) يجب أن ينعكس على اللوحات
// فورًا دون إعادة فتح. يعيد القائمة ومفتاح إصدار يتغير مع كل كتابة.

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GLOBAL_RULES_EVENT,
  listGlobalRules,
  type GlobalRule,
} from '@/lib/storage/global-rules-store';

export interface GlobalRulesState {
  rules: GlobalRule[];
  /** مفتاح يتغير عند كل تعديل؛ يُمرَّر للاعتماديات التي تشتق من القواعد. */
  key: string;
  refresh: () => void;
}

export function useGlobalRules(): GlobalRulesState {
  const [version, setVersion] = useState(0);
  const [rules, setRules] = useState<GlobalRule[]>(() => []);

  const refresh = useCallback(() => {
    setRules(listGlobalRules());
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(GLOBAL_RULES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(GLOBAL_RULES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  return { rules, key: `global-rules:${version}`, refresh };
}

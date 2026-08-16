// خطاف سلّم درجات قوة الوجه
//
// يبقي كل واجهة (المحرر، الفهرس، الإعدادات) على السلّم نفسه لحظة تعديله،
// حتى لا يختار المحقق درجة حذفها في تبويب آخر.

'use client';

import { useEffect, useState } from 'react';
import {
  readStrengthDegrees,
  STRENGTH_DEGREES_EVENT,
  type StrengthDegreeCatalog,
} from '@/lib/tashjeer/strength-degrees';

export function useStrengthDegrees(): StrengthDegreeCatalog {
  const [degrees, setDegrees] = useState<StrengthDegreeCatalog>(() => readStrengthDegrees());

  useEffect(() => {
    const refresh = () => setDegrees(readStrengthDegrees());
    window.addEventListener(STRENGTH_DEGREES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    refresh();

    return () => {
      window.removeEventListener(STRENGTH_DEGREES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return degrees;
}

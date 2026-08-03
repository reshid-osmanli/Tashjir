// خطاف الكتالوج المحلي للقراءات

'use client';

import { useEffect, useState } from 'react';
import {
  readTransmissionCatalog,
  TRANSMISSION_CATALOG_EVENT,
  type TransmissionCatalog,
} from '@/lib/transmissions/catalog';

/** يحدّث الواجهة فور حفظ لوحة التحكم لأي قارئ أو راو أو طريق. */
export function useTransmissionCatalog(): TransmissionCatalog {
  const [catalog, setCatalog] = useState<TransmissionCatalog>(() => readTransmissionCatalog());

  useEffect(() => {
    const refresh = () => setCatalog(readTransmissionCatalog());
    window.addEventListener(TRANSMISSION_CATALOG_EVENT, refresh);
    // مفيد عند استيراد/تعديل التخزين من تبويب آخر.
    window.addEventListener('storage', refresh);
    refresh();

    return () => {
      window.removeEventListener(TRANSMISSION_CATALOG_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return catalog;
}

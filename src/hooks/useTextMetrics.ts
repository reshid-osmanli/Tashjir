// خطاف قياس النص - Text Metrics Hook
//
// يعطي المحرر مقياسا حقيقيا بالخط المرسوم به النص، ولا يُبنى إلا بعد تحميل
// خط المصحف: القياس قبل تحميل الخط يقع على خط بديل فيخطئ بمقدار محسوس.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { createCanvasTextMetrics } from '@/lib/tashjeer/text-metrics';
import type { TextMetricsProvider } from '@/lib/tashjeer/layout-engine';

/**
 * @param enabled تعطيله يعيد القياس النموذجي الحتمي، وهو مفيد للمقارنة
 *                والتصدير المتطابق مع الاختبارات.
 */
export function useTextMetrics(enabled = true): TextMetricsProvider | undefined {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) {
      setFontsReady(true);
      return;
    }

    let cancelled = false;
    void fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (!enabled || !fontsReady) return undefined;
    return createCanvasTextMetrics() ?? undefined;
  }, [enabled, fontsReady]);
}

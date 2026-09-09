// خطاف ملف سياسات المحرك المفعّل — Active Engine Config Hook
// مشروع التشجير - نظام القراءات العشر
//
// يقرأ ملف Engine Studio المحفوظ ويتابع تغيّره (حدث الحفظ أو تبويب آخر)،
// فتعاد حسابات التشجير في المحرر وصفحة المصحف بنفس السياسات التي يراها
// المستخدم في الاستوديو. القرار نفسه يبقى في Decision Resolver (P-07).

'use client';

import { useEffect, useState } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { ENGINE_CONFIG_EVENT, loadEngineConfig } from '@/lib/tashjeer/engine-config-store';

export function useEngineConfig(): EngineConfig {
  const [config, setConfig] = useState<EngineConfig>(() => loadEngineConfig());

  useEffect(() => {
    const refresh = () => setConfig(loadEngineConfig());
    window.addEventListener(ENGINE_CONFIG_EVENT, refresh);
    window.addEventListener('storage', refresh);
    refresh();

    return () => {
      window.removeEventListener(ENGINE_CONFIG_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return config;
}

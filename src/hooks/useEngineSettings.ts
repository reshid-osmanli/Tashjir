// خطاف إعدادات محرك التشجير

'use client';

import { useEffect, useState } from 'react';
import {
  ENGINE_SETTINGS_EVENT,
  readEngineSettings,
  type TashjeerEngineSettings,
} from '@/lib/tashjeer/engine-settings';

export function useEngineSettings(): TashjeerEngineSettings {
  const [settings, setSettings] = useState<TashjeerEngineSettings>(() => readEngineSettings());

  useEffect(() => {
    const refresh = () => setSettings(readEngineSettings());
    window.addEventListener(ENGINE_SETTINGS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    refresh();

    return () => {
      window.removeEventListener(ENGINE_SETTINGS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return settings;
}

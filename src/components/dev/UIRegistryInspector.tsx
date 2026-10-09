'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  commitInspectorState,
  readRememberedInspectorState,
  resolveInspectorActivation,
} from './ui-inspector-activation';

/** Code-split: the overlay and its styles download only once the inspector is switched on. */
const UIRegistryInspectorPanel = dynamic(
  () => import('./UIRegistryInspectorPanel').then((module) => module.UIRegistryInspectorPanel),
  { ssr: false, loading: () => null },
);

/**
 * UI ID Inspector entry point. Mounted on every page of every build (src/app/layout.tsx), so it
 * works on the production build that Vercel serves. Until it is switched on it renders nothing
 * and adds one keydown listener. Switch it on with `?uiInspector=1` or Alt+Shift+I.
 */
export function UIRegistryInspector() {
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);

  const setInspectorEnabled = useCallback((next: boolean) => {
    enabledRef.current = next;
    setEnabled(next);
    commitInspectorState(next);
  }, []);

  useEffect(() => {
    setInspectorEnabled(resolveInspectorActivation(window.location.search, readRememberedInspectorState()));

    const onKeyDown = (event: KeyboardEvent) => {
      // `code` is the physical key: on macOS Option+Shift+I produces a different `key`.
      if (event.repeat || event.code !== 'KeyI' || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      setInspectorEnabled(!enabledRef.current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setInspectorEnabled]);

  const disable = useCallback(() => setInspectorEnabled(false), [setInspectorEnabled]);

  return enabled ? <UIRegistryInspectorPanel onDisable={disable} /> : null;
}

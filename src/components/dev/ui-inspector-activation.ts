/**
 * UI ID Inspector — activation rules.
 *
 * The inspector ships in every build, including the production build that Vercel
 * serves, and stays inert until someone turns it on. Three ways to do that:
 *
 *   - URL: `?uiInspector=1` turns it on, `?uiInspector=0` turns it off. This is the
 *     way to open a preview or production link with the inspector already active.
 *   - Keyboard: Alt+Shift+I toggles it. Matched on the physical key (`KeyI`), so it
 *     also works where Option+Shift+I produces a different character.
 *   - The on-screen "UI ID Inspector" button, shown only while the inspector is active.
 *
 * The state is remembered per browser tab in sessionStorage, so a reload or a move to
 * another page keeps the inspector where the user left it. The URL is kept in step with
 * the state, so a reload always reproduces what is on screen.
 */

export const UI_INSPECTOR_QUERY_PARAM = 'uiInspector';
export const UI_INSPECTOR_STORAGE_KEY = 'tashjir:ui-inspector';

export type InspectorQueryDirective = 'on' | 'off';

/** Reads `?uiInspector=…`. Returns null when the parameter is absent or not recognised. */
export function parseInspectorQuery(search: string): InspectorQueryDirective | null {
  const params = new URLSearchParams(search);
  if (!params.has(UI_INSPECTOR_QUERY_PARAM)) return null;
  const value = (params.get(UI_INSPECTOR_QUERY_PARAM) ?? '').trim().toLowerCase();
  if (value === '' || value === '1' || value === 'on' || value === 'true') return 'on';
  if (value === '0' || value === 'off' || value === 'false') return 'off';
  return null;
}

/** The URL wins over the remembered tab state, so a shared link always shows what it says. */
export function resolveInspectorActivation(search: string, rememberedEnabled: boolean): boolean {
  const directive = parseInspectorQuery(search);
  if (directive === null) return rememberedEnabled;
  return directive === 'on';
}

/**
 * Returns the URL with the parameter set to `1` (enabled) or removed (disabled).
 * Returns null when the URL already says what is requested, so no history entry is written.
 */
export function withInspectorQuery(href: string, enabled: boolean): string | null {
  const url = new URL(href);
  const current = url.searchParams.get(UI_INSPECTOR_QUERY_PARAM);
  if (enabled) {
    if (current === '1') return null;
    url.searchParams.set(UI_INSPECTOR_QUERY_PARAM, '1');
  } else {
    if (!url.searchParams.has(UI_INSPECTOR_QUERY_PARAM)) return null;
    url.searchParams.delete(UI_INSPECTOR_QUERY_PARAM);
  }
  return url.toString();
}

function tabStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Whether this tab last left the inspector on. Defaults to off. */
export function readRememberedInspectorState(): boolean {
  try {
    return tabStorage()?.getItem(UI_INSPECTOR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Applies a state change to the current document: remembers it for this tab and mirrors it
 * in the URL. Storage can be unavailable (for example in some privacy modes); the URL still works then.
 */
export function commitInspectorState(enabled: boolean): void {
  try {
    tabStorage()?.setItem(UI_INSPECTOR_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Storage unavailable: the URL parameter remains the source of truth.
  }
  const next = withInspectorQuery(window.location.href, enabled);
  if (next !== null) window.history.replaceState(window.history.state, '', next);
}

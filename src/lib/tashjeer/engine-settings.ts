// إعدادات محرك التشجير
//
// الإعدادات هنا تخص طريقة العرض والترتيب فقط، وليست حكما علميا على القراءة.
// المادة العلمية (الأوجه، الطرق، الوقف) تبقى في مستند الآية وتخضع للمراجعة.

export type TraversalOrder = 'END_TO_START' | 'START_TO_END';
export type TieBreakOrder = 'TAYYIBAH' | 'SYMBOL' | 'MANUAL';
export type SymbolDisplay = 'SYMBOLS' | 'NAMES' | 'BOTH';

export interface TashjeerEngineSettings {
  /** القاعدة الصحيحة الافتراضية: من آخر الآية إلى أولها. */
  traversal: TraversalOrder;
  /** ترتيب الأوجه المتساوية في الموضع نفسه. */
  tieBreakOrder: TieBreakOrder;
  /** ما الذي يظهر على بطاقة السطر. */
  symbolDisplay: SymbolDisplay;
  /** معامل المسافة الرأسية بين الأسطر (0.7–2). */
  rowSpacing: number;
  /** معامل الفراغ بين النص وأول سطر (0.7–2). */
  textToTreeGap: number;
}

export const ENGINE_SETTINGS_STORAGE_KEY = 'tashjeer:engine-settings:v1';
export const ENGINE_SETTINGS_EVENT = 'tashjeer:engine-settings-change';

export const DEFAULT_ENGINE_SETTINGS: TashjeerEngineSettings = {
  traversal: 'END_TO_START',
  tieBreakOrder: 'TAYYIBAH',
  symbolDisplay: 'BOTH',
  rowSpacing: 1,
  textToTreeGap: 1,
};

export function normalizeEngineSettings(
  value: Partial<TashjeerEngineSettings> | null | undefined
): TashjeerEngineSettings {
  return {
    // هذا إعداد منهجي لا خيار تجميلي: لا نحفظ في لوحة الإدارة ترتيبا يبدأ
    // من أول الآية، حتى لا ينتج ملف معتمد بتشجير مقلوب.
    traversal: 'END_TO_START',
    tieBreakOrder:
      value?.tieBreakOrder === 'SYMBOL' || value?.tieBreakOrder === 'MANUAL'
        ? value.tieBreakOrder
        : 'TAYYIBAH',
    symbolDisplay:
      value?.symbolDisplay === 'SYMBOLS' || value?.symbolDisplay === 'NAMES'
        ? value.symbolDisplay
        : 'BOTH',
    rowSpacing: clampNumber(value?.rowSpacing, 0.7, 2, DEFAULT_ENGINE_SETTINGS.rowSpacing),
    textToTreeGap: clampNumber(value?.textToTreeGap, 0.7, 2, DEFAULT_ENGINE_SETTINGS.textToTreeGap),
  };
}

export function readEngineSettings(): TashjeerEngineSettings {
  if (!isBrowser()) return { ...DEFAULT_ENGINE_SETTINGS };

  try {
    const raw = window.localStorage.getItem(ENGINE_SETTINGS_STORAGE_KEY);
    return normalizeEngineSettings(raw ? (JSON.parse(raw) as Partial<TashjeerEngineSettings>) : null);
  } catch {
    return { ...DEFAULT_ENGINE_SETTINGS };
  }
}

export function saveEngineSettings(settings: TashjeerEngineSettings): TashjeerEngineSettings {
  const normalized = normalizeEngineSettings(settings);
  if (isBrowser()) {
    window.localStorage.setItem(ENGINE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(ENGINE_SETTINGS_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function resetEngineSettings(): TashjeerEngineSettings {
  return saveEngineSettings({ ...DEFAULT_ENGINE_SETTINGS });
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

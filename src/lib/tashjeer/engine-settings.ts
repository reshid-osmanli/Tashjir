// إعدادات محرك التشجير
//
// الإعدادات هنا تخص طريقة العرض والترتيب فقط، وليست حكما علميا على القراءة.
// المادة العلمية (الأوجه، الطرق، الوقف) تبقى في مستند الآية وتخضع للمراجعة.

export type TraversalOrder = 'END_TO_START' | 'START_TO_END';
export type TieBreakOrder = 'TAYYIBAH' | 'SYMBOL' | 'MANUAL';
export type SymbolDisplay = 'SYMBOLS' | 'NAMES' | 'BOTH';

/**
 * قاعدة ترتيب الأوجه داخل الموضع الواحد.
 *
 * - STRENGTH: قوة الوجه كما في الكتاب المعتمد (حقل `strength` في الوجه).
 *   هذه هي القاعدة التي طلبها صاحب المشروع؛ فالكتاب يقدّم الأقوى أداءً.
 * - TAYYIBAH: ترتيب أول راوٍ في الوجه حسب طيبة النشر.
 * - MANUAL: ترتيب المحقق الصريح المحفوظ في `variant.alternativeOrder`.
 */
export type AlternativeOrderRule = 'STRENGTH' | 'TAYYIBAH' | 'MANUAL';

/** امتداد السطر الأفقي تحت الآية. */
export type LineSpanMode =
  /** يمتد مع الآية كلها (المطلوب في المصحف المشجّر). */
  | 'FULL_AYAH'
  /** يقتصر على مدى كلمات الاختلاف. */
  | 'VARIANT_SPAN';

export interface TashjeerEngineSettings {
  /** القاعدة الصحيحة الافتراضية: من آخر الآية إلى أولها. */
  traversal: TraversalOrder;
  /** ترتيب الأوجه المتساوية في الموضع نفسه. */
  tieBreakOrder: TieBreakOrder;
  /** قاعدة ترتيب أوجه الموضع الواحد فيما بينها. */
  alternativeOrder: AlternativeOrderRule;
  /** ما الذي يظهر على بطاقة السطر. */
  symbolDisplay: SymbolDisplay;
  /** هل يمتد السطر مع الآية كلها أم مع مدى الاختلاف فقط. */
  lineSpan: LineSpanMode;
  /** إظهار أرقام حركات المد في الهامش الأيمن. */
  showMaddColumn: boolean;
  /** إظهار اسم الحكم تحت الكلمة تماما. */
  showRuleUnderWord: boolean;
  /** معامل المسافة الرأسية بين الأسطر (0.7–2). */
  rowSpacing: number;
  /** معامل الفراغ بين النص وأول سطر (0.7–2). */
  textToTreeGap: number;
}

export const ENGINE_SETTINGS_STORAGE_KEY = 'tashjeer:engine-settings:v2';
export const ENGINE_SETTINGS_EVENT = 'tashjeer:engine-settings-change';

export const DEFAULT_ENGINE_SETTINGS: TashjeerEngineSettings = {
  traversal: 'END_TO_START',
  tieBreakOrder: 'TAYYIBAH',
  alternativeOrder: 'STRENGTH',
  symbolDisplay: 'SYMBOLS',
  lineSpan: 'FULL_AYAH',
  showMaddColumn: true,
  showRuleUnderWord: true,
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
    tieBreakOrder: oneOf(value?.tieBreakOrder, ['TAYYIBAH', 'SYMBOL', 'MANUAL'], 'TAYYIBAH'),
    alternativeOrder: oneOf(
      value?.alternativeOrder,
      ['STRENGTH', 'TAYYIBAH', 'MANUAL'],
      DEFAULT_ENGINE_SETTINGS.alternativeOrder
    ),
    symbolDisplay: oneOf(
      value?.symbolDisplay,
      ['SYMBOLS', 'NAMES', 'BOTH'],
      DEFAULT_ENGINE_SETTINGS.symbolDisplay
    ),
    lineSpan: oneOf(value?.lineSpan, ['FULL_AYAH', 'VARIANT_SPAN'], DEFAULT_ENGINE_SETTINGS.lineSpan),
    showMaddColumn: value?.showMaddColumn ?? DEFAULT_ENGINE_SETTINGS.showMaddColumn,
    showRuleUnderWord: value?.showRuleUnderWord ?? DEFAULT_ENGINE_SETTINGS.showRuleUnderWord,
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

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

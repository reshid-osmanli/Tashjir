// درجات قوة الوجه - Strength Degrees
//
// كان في المشروع مفهومان منفصلان يقولان الشيء نفسه:
//   1. «الوجه المقدَّم»: الوجه الذي يُبدأ به في الأداء.
//   2. «قوة الوجه»: رقم مجرد (١ = الأقوى) يرتّب أسطر الموضع الواحد.
//
// دُمج المفهومان هنا في مقياس واحد قابل للتحرير: قائمة درجات مرتّبة، أعلاها
// رتبة هي «الوجه المقدَّم». هذا يمنع التناقض بين حقلين يصفان الترجيح نفسه،
// ويسمح للمحقق بأن يزيد الدرجات على الأربع المعهودة أو ينقصها من الإعدادات.
//
// ملاحظة منهجية مهمة: القوة ليست صفة مطلقة للوجه، بل تختلف باختلاف القارئ.
// فوجهٌ مقدَّم عند قالون قد يكون مؤخَّرا عند ورش. لذلك تُسجَّل الدرجة **لكل
// راوٍ على حدة** (`strengthByNarrator`)، مع درجة عامة اختيارية لمن لم يُخصَّص.

import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import type { ReadingScope, ReaderStrengthMap } from '@/types/tashjeer';
import { resolveScope } from './scope';

export const STRENGTH_DEGREES_VERSION = 1;
export const STRENGTH_DEGREES_STORAGE_KEY = 'tashjeer:strength-degrees:v1';
export const STRENGTH_DEGREES_EVENT = 'tashjeer:strength-degrees-change';

/** درجة واحدة في سلّم قوة الوجه. */
export interface StrengthDegree {
  id: string;
  /** الاسم الكامل: مقدَّم، راجح، جائز، مؤخَّر... */
  label: string;
  /** اختصار يظهر على بطاقة السطر عند ضيق المساحة. */
  shortLabel: string;
  /** الرتبة: الأصغر أقوى، ويُرسم سطره أعلى تحت الآية. */
  rank: number;
  /** شرح يقرأه المحقق قبل الاختيار. */
  description?: string;
  /** لون البطاقة في الواجهات (hex). */
  color: string;
  /**
   * هل هذه الدرجة هي «الوجه المقدَّم»؟ درجة واحدة فقط تحمل هذه العلامة،
   * وهي التي كانت تُسمّى في الإصدار السابق «الوجه المقدَّم» مستقلة عن القوة.
   */
  isPreferred?: boolean;
}

export interface StrengthDegreeCatalog {
  schemaVersion: number;
  updatedAt: string;
  degrees: StrengthDegree[];
}

/** رتبة الوجه الذي لم تُسجَّل له درجة: بعد كل المسجَّل، فلا يتقدم غير المرجَّح. */
export const UNGRADED_RANK = Number.POSITIVE_INFINITY;

/** الدرجات الأربع المعهودة في كتب الأداء، وهي بذرة قابلة للتوسعة. */
export function createDefaultStrengthDegrees(): StrengthDegreeCatalog {
  return normalizeStrengthDegrees({
    schemaVersion: STRENGTH_DEGREES_VERSION,
    updatedAt: new Date().toISOString(),
    degrees: [
      {
        id: 'muqaddam',
        label: 'مقدَّم',
        shortLabel: 'مقدَّم',
        rank: 1,
        color: '#047857',
        isPreferred: true,
        description: 'الوجه الذي يُبدأ به في الأداء ويُقرأ به أولا عند التلقي.',
      },
      {
        id: 'rajih',
        label: 'راجح',
        shortLabel: 'راجح',
        rank: 2,
        color: '#0e7490',
        description: 'وجه صحيح مرجَّح عند أهل الأداء، ويأتي بعد المقدَّم.',
      },
      {
        id: 'jaiz',
        label: 'جائز',
        shortLabel: 'جائز',
        rank: 3,
        color: '#a16207',
        description: 'وجه صحيح مقروء به من غير ترجيح.',
      },
      {
        id: 'muakhkhar',
        label: 'مؤخَّر',
        shortLabel: 'مؤخَّر',
        rank: 4,
        color: '#b45309',
        description: 'وجه صحيح لكنه مؤخَّر في الأداء، يُقرأ به آخرا.',
      },
    ],
  });
}

/**
 * يجعل السلّم صالحا للاستعمال مهما كان مصدره (تخزين قديم، ملف مستورد، تحرير يدوي).
 *
 * القواعد: لا معرّفات مكررة، الرتب أعداد صحيحة متتابعة من 1 بعد الترتيب،
 * ودرجة واحدة فقط تحمل علامة «المقدَّم» وهي صاحبة الرتبة الأولى إن لم يُعلَّم غيرها.
 */
export function normalizeStrengthDegrees(
  value: Partial<StrengthDegreeCatalog> | null | undefined
): StrengthDegreeCatalog {
  const raw = Array.isArray(value?.degrees) ? value!.degrees! : [];
  const seen = new Set<string>();

  const cleaned = raw
    .filter((degree): degree is StrengthDegree => Boolean(degree && typeof degree === 'object'))
    .map((degree, index) => ({
      ...degree,
      id: typeof degree.id === 'string' && degree.id.trim() ? degree.id.trim() : `degree-${index + 1}`,
      label: typeof degree.label === 'string' && degree.label.trim() ? degree.label.trim() : `درجة ${index + 1}`,
      rank: positiveInteger(degree.rank, index + 1),
    }))
    .filter((degree) => {
      if (seen.has(degree.id)) return false;
      seen.add(degree.id);
      return true;
    })
    .sort((first, second) => first.rank - second.rank || first.label.localeCompare(second.label, 'ar'))
    .map((degree, index) => ({
      id: degree.id,
      label: degree.label,
      shortLabel:
        typeof degree.shortLabel === 'string' && degree.shortLabel.trim()
          ? degree.shortLabel.trim()
          : degree.label,
      rank: index + 1,
      description: typeof degree.description === 'string' && degree.description.trim()
        ? degree.description.trim()
        : undefined,
      color: typeof degree.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(degree.color)
        ? degree.color
        : FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      isPreferred: degree.isPreferred === true,
    }));

  const degrees = cleaned.length > 0 ? cleaned : createSeedDegrees();

  // «الوجه المقدَّم» علامة واحدة لا تتعدد: أول من حملها، وإلا فصاحب الرتبة الأولى.
  const preferredIndex = degrees.findIndex((degree) => degree.isPreferred);
  const chosen = preferredIndex === -1 ? 0 : preferredIndex;

  return {
    schemaVersion: STRENGTH_DEGREES_VERSION,
    updatedAt:
      typeof value?.updatedAt === 'string' && value.updatedAt ? value.updatedAt : new Date().toISOString(),
    degrees: degrees.map((degree, index) => ({ ...degree, isPreferred: index === chosen })),
  };
}

export function readStrengthDegrees(): StrengthDegreeCatalog {
  if (!isBrowser()) return createDefaultStrengthDegrees();

  try {
    const raw = window.localStorage.getItem(STRENGTH_DEGREES_STORAGE_KEY);
    if (!raw) return createDefaultStrengthDegrees();
    return normalizeStrengthDegrees(JSON.parse(raw) as Partial<StrengthDegreeCatalog>);
  } catch {
    return createDefaultStrengthDegrees();
  }
}

export function saveStrengthDegrees(catalog: Partial<StrengthDegreeCatalog>): StrengthDegreeCatalog {
  const normalized = normalizeStrengthDegrees({ ...catalog, updatedAt: new Date().toISOString() });
  if (isBrowser()) {
    window.localStorage.setItem(STRENGTH_DEGREES_STORAGE_KEY, JSON.stringify(normalized));
    // بيئات الاختبار قد تُبدّل window بكائن مصغّر بلا نظام أحداث؛ الإشعار تحسين لا شرط.
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(STRENGTH_DEGREES_EVENT, { detail: normalized }));
    }
  }
  return normalized;
}

export function resetStrengthDegrees(): StrengthDegreeCatalog {
  return saveStrengthDegrees(createDefaultStrengthDegrees());
}

/** معرّف درجة جديدة، متين كفاية للتخزين المحلي. */
export function createStrengthDegreeId(): string {
  return `degree-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ==================== الاستعلام ====================

export function findStrengthDegree(
  degreeId: string | undefined,
  catalog?: StrengthDegreeCatalog
): StrengthDegree | undefined {
  if (!degreeId) return undefined;
  const degrees = (catalog ?? readStrengthDegrees()).degrees;
  return degrees.find((degree) => degree.id === degreeId);
}

/** الدرجة المعلَّمة بأنها «الوجه المقدَّم». */
export function preferredStrengthDegree(catalog: StrengthDegreeCatalog): StrengthDegree | undefined {
  return catalog.degrees.find((degree) => degree.isPreferred) ?? catalog.degrees[0];
}

/** رتبة درجة بمعرّفها؛ غير المعروف يتأخر عن كل معروف. */
export function strengthRank(degreeId: string | undefined, catalog: StrengthDegreeCatalog): number {
  return findStrengthDegree(degreeId, catalog)?.rank ?? UNGRADED_RANK;
}

/** حامل الدرجات لأي كيان مرجَّح: وجه في موضع، أو قاعدة عامة. */
export interface StrengthGraded {
  /** الدرجة العامة لكل راوٍ لم تُخصَّص له درجة. */
  strengthDegreeId?: string;
  /** درجة كل راوٍ على حدة: معرّف الراوي ← معرّف الدرجة. */
  strengthByNarrator?: ReaderStrengthMap;
  /** الحقل الرقمي القديم (١ = الأقوى) قبل توحيد المفهومين. */
  strength?: number;
}

/** درجة راوٍ بعينه في وجه: تخصيصه أولا، ثم الدرجة العامة. */
export function narratorStrengthDegreeId(
  graded: StrengthGraded,
  narratorId: string
): string | undefined {
  return graded.strengthByNarrator?.[narratorId] ?? graded.strengthDegreeId;
}

/** ملخص القوة المستعمل في الترتيب والعرض. */
export interface ResolvedStrength {
  /** أقوى رتبة في الوجه (الأصغر)؛ لانهاية إن لم تُسجَّل درجة. */
  rank: number;
  /** الدرجة الممثِّلة للوجه: صاحبة أقوى رتبة. */
  degree?: StrengthDegree;
  /** هل يختلف الرواة في درجة هذا الوجه؟ */
  isMixed: boolean;
  /** درجة كل راوٍ بعد تطبيق الدرجة العامة على من لم يُخصَّص. */
  perNarrator: Array<{ narratorId: string; degree?: StrengthDegree }>;
}

/**
 * يحسب قوة الوجه من درجات رواته.
 *
 * القاعدة: يمثّل الوجهَ **أقوى** درجة أعطاها له أحد رواته، لأن السطر واحد
 * لا يتجزأ، وتقديمه عند من قدّمه أولى من تأخيره عند من أخّره. أما اختلاف
 * الرواة فيبقى محفوظا ويظهر في البطاقة (`isMixed` و`perNarrator`).
 */
export function resolveStrength(
  graded: StrengthGraded,
  scope: ReadingScope,
  degrees: StrengthDegreeCatalog,
  catalog?: TransmissionCatalog
): ResolvedStrength {
  const narratorIds = resolveScope(scope, catalog);
  const perNarrator = narratorIds.map((narratorId) => ({
    narratorId,
    degree: findStrengthDegree(narratorStrengthDegreeId(graded, narratorId), degrees),
  }));

  const ranks = perNarrator
    .map((item) => item.degree?.rank)
    .filter((rank): rank is number => typeof rank === 'number');

  // القواعد المحفوظة قبل هذا الإصدار تحمل رقما مجردا؛ نقرؤه رتبةً مباشرة
  // حتى لا يفقد عملُ المحقق السابق ترتيبَه بعد الترقية.
  const legacyRank =
    typeof graded.strength === 'number' && Number.isFinite(graded.strength)
      ? Math.max(1, Math.round(graded.strength))
      : undefined;

  const fallbackDegree = findStrengthDegree(graded.strengthDegreeId, degrees);
  if (ranks.length === 0) {
    const rank = fallbackDegree?.rank ?? legacyRank ?? UNGRADED_RANK;
    return {
      rank,
      degree: fallbackDegree ?? degrees.degrees.find((degree) => degree.rank === legacyRank),
      isMixed: false,
      perNarrator,
    };
  }

  const best = Math.min(...ranks);
  const uniqueRanks = new Set(perNarrator.map((item) => item.degree?.rank ?? UNGRADED_RANK));

  return {
    rank: best,
    degree: degrees.degrees.find((degree) => degree.rank === best),
    isMixed: uniqueRanks.size > 1,
    perNarrator,
  };
}

/** يزيل من خريطة الدرجات كل راوٍ خرج من نطاق الوجه، فلا تبقى بيانات معلّقة. */
export function pruneStrengthMap(
  map: ReaderStrengthMap | undefined,
  narratorIds: string[]
): ReaderStrengthMap | undefined {
  if (!map) return undefined;
  const allowed = new Set(narratorIds);
  const next: ReaderStrengthMap = {};
  for (const [narratorId, degreeId] of Object.entries(map)) {
    if (allowed.has(narratorId) && degreeId) next[narratorId] = degreeId;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** وصف عربي مختصر للقوة، صالح للبطاقات والفهارس. */
export function describeStrength(resolved: ResolvedStrength): string {
  if (!resolved.degree) return 'بلا درجة';
  return resolved.isMixed ? `${resolved.degree.label} (تختلف بالرواة)` : resolved.degree.label;
}

// ==================== أدوات داخلية ====================

const FALLBACK_COLORS = ['#047857', '#0e7490', '#a16207', '#b45309', '#7c3aed', '#be123c'];

function createSeedDegrees(): StrengthDegree[] {
  return [
    { id: 'muqaddam', label: 'مقدَّم', shortLabel: 'مقدَّم', rank: 1, color: '#047857', isPreferred: true },
    { id: 'rajih', label: 'راجح', shortLabel: 'راجح', rank: 2, color: '#0e7490' },
    { id: 'jaiz', label: 'جائز', shortLabel: 'جائز', rank: 3, color: '#a16207' },
    { id: 'muakhkhar', label: 'مؤخَّر', shortLabel: 'مؤخَّر', rank: 4, color: '#b45309' },
  ];
}

function positiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return rounded >= 1 ? rounded : fallback;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

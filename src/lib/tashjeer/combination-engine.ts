// محرك الأوجه المركّبة - Reading Combination Engine
//
// المشكلة التي وُضع لها هذا الملف:
//
//   كان السطر في المحرك السابق = «وجه واحد في موضع واحد». وهذا يخالف
//   التشجير المعتمد. القارئ لا يُشجَّر له وجه المد وحده، بل تُشجَّر له
//   **قراءته للآية كاملة**: مدٌّ في أول الآية، وفرشٌ في كلمة، وإدغامٌ في
//   أخرى — كلها في سطر واحد، لأن الراوي يقرأ الآية مرة واحدة لا ثلاثا.
//
//   فإن كان له في موضع منها وجهان (تحقيق وتقليل، أو قصر وتوسط وطول)، تعدّدت
//   سطوره بعدد ضرب أوجهه بعضها في بعض: سطر بالتحقيق مع القصر، وسطر بالتحقيق
//   مع التوسط... ثم يأتي التقليل بالترتيب نفسه.
//
// وهذا ما يفعله هذا المحرك: يبني لكل «وحدة قراءة» (راوٍ أو طريق) كل تراكيب
// أوجهها في الآية، ثم يجمع الوحدات المتفقة في تركيب واحد في سطر واحد.
//
// الترتيب — وهو مطلب صاحب المشروع الصريح:
//   1. ترتيب الأمة: قالون أولا، ومعه من وافقه في التركيب نفسه، ثم من بعده.
//   2. عند الوحدة الواحدة: الوجه المقدَّم أولا (التحقيق قبل التقليل)، ثم ما
//      دونه، بحسب سلّم درجات القوة أو ترتيب المحقق الصريح.
//   3. الموضع الأول في ترتيب المرور هو «الأبطأ تغيّرا»: تُستوفى كل أوجه ما
//      بعده قبل الانتقال إلى وجهه الثاني، كما في المصاحف المشجّرة.
//
// حماية من الانفجار العددي: عشرة مواضع لكل منها ثلاثة أوجه تعني ٥٩ ألف
// تركيب. لذلك يوجد سقف صريح لعدد تراكيب الوحدة الواحدة (`maxPerUnit`).

import type { Variant, VariantAlternative } from '@/types/tashjeer';
import type { TransmissionCatalog } from '@/lib/transmissions/catalog';
import type { TashjeerEngineSettings } from './engine-settings';
import type { StrengthDegreeCatalog } from './strength-degrees';
import type { ReadingPlan } from './reading-plan';
import { createDefaultStrengthDegrees } from './strength-degrees';
import {
  compareAlternatives,
  orderVariantsForReading,
  strengthRankForNarrator,
} from './ordering';
import { allNarratorIds, resolveScope } from './scope';
import { pathsOfNarrator, type ReadingUnit } from './reader-symbols';
import { narratorTayyibahOrder } from './symbols';
import { exclusiveLocusKey } from './loci';

/** اختيار وجه في موضع من مواضع الآية. */
export interface CombinationPick {
  variant: Variant;
  alternative: VariantAlternative;
}

/** تركيب قراءة كامل لآية: ما يُرسم في سطر واحد. */
export interface ReadingCombination {
  /** بصمة التركيب: معرّفات الأوجه بترتيب المرور. */
  id: string;
  /** الأوجه المختارة، مرتبة بترتيب مرور المواضع. */
  picks: CombinationPick[];
  /** وحدات القراءة التي تقرأ بهذا التركيب بعينه. */
  units: ReadingUnit[];
  /** الرواة الذين تشملهم الوحدات (قد يكون الراوي حاضرا بطريق واحد منه). */
  narratorIds: string[];
  /** الوحدة الرائدة: أقدمها في ترتيب طيبة النشر. */
  leadUnit: ReadingUnit;
  /** ترتيب الرائد في الطيبة (١ لقالون). */
  leadOrder: number;
  /** ترتيب هذا التركيب بين تراكيب رائده (٠ = الوجه المقدَّم). */
  rankInLead: number;
}

export interface CombinationOptions {
  catalog?: TransmissionCatalog;
  engine: TashjeerEngineSettings;
  strengthDegrees?: StrengthDegreeCatalog;
  /** سقف تراكيب الوحدة الواحدة، حماية من الانفجار العددي. */
  maxPerUnit?: number;
}

const DEFAULT_MAX_PER_UNIT = 48;

/**
 * يبني تراكيب القراءة لكل وحدات القراءة في الآية.
 *
 * الوحدات المرجعة لا تشمل من قرأ بوجه المصحف في كل المواضع: هؤلاء لا سطر
 * لهم أصلا، فالنص المكتوب هو وجههم.
 */
export function buildReadingCombinations(
  variants: Variant[],
  plan: ReadingPlan,
  options: CombinationOptions
): ReadingCombination[] {
  const { catalog, engine } = options;
  const strengthDegrees = options.strengthDegrees ?? createDefaultStrengthDegrees();
  const maxPerUnit = options.maxPerUnit ?? DEFAULT_MAX_PER_UNIT;

  const orderedVariants = orderVariantsForReading(variants, plan);
  const units = buildReadingUnits(orderedVariants, catalog);

  interface Draft {
    picks: CombinationPick[];
    units: ReadingUnit[];
    ranks: Map<string, number>;
  }

  const drafts = new Map<string, Draft>();

  for (const unit of units) {
    // المواضع المستقلة تُضرب. أما اختلافان في الموضع نفسه والفئة نفسها
    // (مد ٢ ومد ٤ مسجّلان اختلافا مستقلا) فأوجه متنافية لموضع واحد.
    const buckets = new Map<string, CombinationPick[]>();
    const bucketOrder: string[] = [];

    for (const variant of orderedVariants) {
      const applicable = variant.alternatives
        .filter((alt) => !alt.isBase && alternativeAppliesToUnit(alt, unit, catalog))
        .sort((first, second) =>
          compareAlternativesForUnit(
            variant,
            first,
            second,
            unit,
            engine,
            catalog,
            strengthDegrees
          )
        );

      if (applicable.length === 0) continue;

      const key = exclusiveLocusKey(variant);
      const existing = buckets.get(key);
      const picks = applicable.map((alternative) => ({ variant, alternative }));
      if (existing) {
        existing.push(...picks);
      } else {
        buckets.set(key, picks);
        bucketOrder.push(key);
      }
    }

    const choices = bucketOrder.map((key) => {
      const picks = buckets.get(key) ?? [];
      return [...picks].sort((first, second) =>
        compareAlternativesForUnit(
          first.variant,
          first.alternative,
          second.alternative,
          unit,
          engine,
          catalog,
          strengthDegrees
        )
      );
    });

    if (choices.length === 0) continue;

    const combos = enumerateCombinations(choices, maxPerUnit);

    combos.forEach((combo, rank) => {
      const picks = combo;
      const id = picks.map((pick) => `${pick.variant.id}:${pick.alternative.id}`).join('|');

      const draft = drafts.get(id) ?? { picks, units: [], ranks: new Map<string, number>() };
      draft.units.push(unit);
      draft.ranks.set(unitKey(unit), rank);
      drafts.set(id, draft);
    });
  }

  const combinations: ReadingCombination[] = [...drafts.entries()].map(([id, draft]) => {
    const sortedUnits = [...draft.units].sort(
      (first, second) => unitOrder(first, catalog) - unitOrder(second, catalog)
    );
    const leadUnit = sortedUnits[0];

    return {
      id,
      picks: draft.picks,
      units: sortedUnits,
      narratorIds: [...new Set(sortedUnits.map((unit) => unit.narratorId))],
      leadUnit,
      leadOrder: unitOrder(leadUnit, catalog),
      rankInLead: draft.ranks.get(unitKey(leadUnit)) ?? 0,
    };
  });

  // الترتيب النهائي: ترتيب الأمة أولا، ثم ترتيب أوجه الرائد نفسه.
  return combinations.sort(
    (first, second) =>
      first.leadOrder - second.leadOrder ||
      first.rankInLead - second.rankInLead ||
      first.id.localeCompare(second.id, 'ar')
  );
}

/**
 * وحدات القراءة في هذه الآية.
 *
 * الأصل أن الوحدة هي الراوي. لكن إن خُصّ بعض طرق الراوي بوجه في هذه الآية
 * (كالأزرق عن ورش)، انقسم الراوي إلى طرقه، لأن طريقيه صارا يقرآن قراءتين.
 * أما إن شمل الحكم طرقه كلها فالراوي وحدة واحدة، فلا نضاعف سطوره بلا فائدة.
 */
export function buildReadingUnits(
  variants: Variant[],
  catalog?: TransmissionCatalog
): ReadingUnit[] {
  const referencedPaths = new Set<string>();
  for (const variant of variants) {
    for (const alt of variant.alternatives) {
      if (alt.isBase) continue;
      if (alt.scope.kind !== 'PATHS') continue;
      for (const pathId of alt.scope.pathIds ?? []) referencedPaths.add(pathId);
    }
  }

  const units: ReadingUnit[] = [];

  for (const narratorId of allNarratorIds(catalog)) {
    const paths = pathsOfNarrator(narratorId, catalog);
    const referenced = paths.filter((path) => referencedPaths.has(path.id));

    if (referenced.length > 0 && referenced.length < paths.length) {
      for (const path of paths) units.push({ narratorId, pathId: path.id });
      continue;
    }

    units.push({ narratorId });
  }

  return units;
}

/** هل يقرأ بهذا الوجه صاحبُ هذه الوحدة؟ */
export function alternativeAppliesToUnit(
  alt: VariantAlternative,
  unit: ReadingUnit,
  catalog?: TransmissionCatalog
): boolean {
  if (alt.scope.kind === 'PATHS' && alt.scope.pathIds?.length) {
    const pathIds = new Set(alt.scope.pathIds);
    if (unit.pathId) return pathIds.has(unit.pathId);

    // وحدة راوٍ كامل: لا يشمله حكم الطرق إلا إن عمّ طرقه كلها.
    const paths = pathsOfNarrator(unit.narratorId, catalog);
    return paths.length > 0 && paths.every((path) => pathIds.has(path.id));
  }

  return resolveScope(alt.scope, catalog).includes(unit.narratorId);
}

/**
 * ترتيب وجهين عند وحدة بعينها.
 *
 * الفرق عن الترتيب العام: درجة القوة قد تختلف باختلاف الراوي، فالوجه
 * المقدَّم عند قالون قد يكون مؤخَّرا عند ورش. وترتيب سطور الراوي يتبع درجته
 * هو، لا درجة أقوى رواة الوجه.
 */
function compareAlternativesForUnit(
  variant: Variant,
  first: VariantAlternative,
  second: VariantAlternative,
  unit: ReadingUnit,
  engine: TashjeerEngineSettings,
  catalog: TransmissionCatalog | undefined,
  strengthDegrees: StrengthDegreeCatalog
): number {
  const explicit = variant.alternativeOrder ?? [];
  if (explicit.length > 0) {
    const firstIndex = explicit.indexOf(first.id);
    const secondIndex = explicit.indexOf(second.id);
    if (firstIndex !== -1 && secondIndex !== -1 && firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }
    if (firstIndex !== -1 && secondIndex === -1) return -1;
    if (firstIndex === -1 && secondIndex !== -1) return 1;
  }

  if (engine.alternativeOrder !== 'MANUAL') {
    const firstRank = strengthRankForNarrator(first, unit.narratorId, strengthDegrees, catalog);
    const secondRank = strengthRankForNarrator(second, unit.narratorId, strengthDegrees, catalog);
    if (firstRank !== secondRank) return firstRank - secondRank;
  }

  return compareAlternatives(variant, first, second, engine, catalog, strengthDegrees);
}

/**
 * ضرب الأوجه بعضها في بعض.
 *
 * الموضع الأخير في القائمة هو الأسرع تغيّرا: تُستوفى أوجهه كلها قبل أن
 * ينتقل الموضع الذي قبله إلى وجهه الثاني. وهو ترتيب المصحف المشجّر: يُثبَّت
 * أول ما يمر به القارئ ثم تُستوفى فروعه.
 */
export function enumerateCombinations<T>(choices: T[][], maxCount: number): T[][] {
  if (choices.length === 0) return [];

  let result: T[][] = [[]];

  for (const options of choices) {
    const next: T[][] = [];
    for (const prefix of result) {
      for (const option of options) {
        if (next.length >= maxCount) break;
        next.push([...prefix, option]);
      }
      if (next.length >= maxCount) break;
    }
    result = next;
  }

  return result;
}

function unitKey(unit: ReadingUnit): string {
  return unit.pathId ? `${unit.narratorId}#${unit.pathId}` : unit.narratorId;
}

/**
 * ترتيب الوحدة في الأمة: ترتيب راويها في الطيبة، وترتيب الطريق داخل الراوي
 * كسرا صغيرا بعده، حتى يبقى الأزرق قبل الأصبهاني في سطور ورش.
 */
function unitOrder(unit: ReadingUnit, catalog?: TransmissionCatalog): number {
  const base = narratorTayyibahOrder(unit.narratorId, catalog);
  if (!unit.pathId) return base;

  const paths = pathsOfNarrator(unit.narratorId, catalog);
  const index = paths.findIndex((path) => path.id === unit.pathId);
  return base + (index === -1 ? 0.5 : (index + 1) / (paths.length + 1)) * 0.9;
}

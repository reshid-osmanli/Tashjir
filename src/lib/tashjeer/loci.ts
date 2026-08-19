// مواضع الاختلاف المنفصلة - Disjoint Variant Loci
//
// المشكلة التي يعالجها هذا الملف:
//
//   كان إنشاء الاختلاف من كلمتين متباعدتين يملأ كل ما بينهما، فيُرسم خط
//   غليظ من أول الآية إلى آخرها لصلةٍ في كلمتين. والمطلوب: كل كلمة (أو
//   مدى حروف متصل) موضع مستقل، والعلامات على تلك المواضع وحدها، والسطر
//   واحد يجمعها إن اشتركت في الوجه.
//
//   كذلك كانت الاختلافات المسجّلة في الموضع نفسه (مد ٢ ومد ٤) تُضرب في
//   المحرك كبعدين مستقلين. وهي في الحقيقة أوجه متنافية لموضع واحد.

import type {
  CharacterAnchor,
  CharacterRange,
  Variant,
  VariantLocus,
} from '@/types/tashjeer';
import { compareCharacterAnchors } from '@/lib/quran-logic/characters';

/** موضع واحد بعد التحقق: مدى كلمات، ونطاق حروف اختياري. */
export function normalizeLocus(locus: VariantLocus): VariantLocus {
  const startPosition = Math.max(1, Math.round(locus.startPosition));
  const endPosition = Math.max(startPosition, Math.round(locus.endPosition));
  if (!locus.characterRange) return { startPosition, endPosition };

  return {
    startPosition: Math.min(startPosition, locus.characterRange.start.position),
    endPosition: Math.max(endPosition, locus.characterRange.end.position),
    characterRange: locus.characterRange,
  };
}

/**
 * مواضع الاختلاف الفعلية.
 *
 * إن سجّل المحقق `loci` استُعملت كما هي. وإلا فالموضع هو المدى القديم
 * (start/end وcharacterRange) حفاظا على الملفات السابقة.
 */
export function lociOfVariant(variant: Variant): VariantLocus[] {
  if (Array.isArray(variant.loci) && variant.loci.length > 0) {
    return variant.loci.map(normalizeLocus);
  }

  return [
    normalizeLocus({
      startPosition: variant.startPosition,
      endPosition: variant.endPosition,
      characterRange: variant.targetKind === 'CHARACTERS' ? variant.characterRange : undefined,
    }),
  ];
}

/** هل للاختلاف أكثر من موضع منفصل؟ */
export function hasDisjointLoci(variant: Variant): boolean {
  return lociOfVariant(variant).length > 1;
}

/** أرقام الكلمات التي يقع فيها الاختلاف فعلا، بلا ملء الفجوات. */
export function positionsOfVariant(variant: Variant): number[] {
  const positions = new Set<number>();
  for (const locus of lociOfVariant(variant)) {
    for (let position = locus.startPosition; position <= locus.endPosition; position++) {
      positions.add(position);
    }
  }
  return [...positions].sort((first, second) => first - second);
}

/** يجمع الكلمات المتجاورة في مجموعات، ويبقي المتباعدة منفصلة. */
export function clusterWordPositions(positions: number[]): number[][] {
  const ordered = [...new Set(positions)].sort((first, second) => first - second);
  if (ordered.length === 0) return [];

  const clusters: number[][] = [[ordered[0]]];
  for (let index = 1; index < ordered.length; index++) {
    const position = ordered[index];
    const current = clusters[clusters.length - 1];
    if (position === current[current.length - 1] + 1) {
      current.push(position);
    } else {
      clusters.push([position]);
    }
  }
  return clusters;
}

/**
 * يجمع نقرات الحروف في نطاقات متصلة.
 *
 * حرفان متصلان إن كانا في الكلمة نفسها بفهرسين متتابعين، أو في كلمتين
 * متجاورتين بحيث يكون الثاني أول حرف في كلمته (مد منفصل وأشباهه).
 * أما كلمة من أول الآية وحرف من آخرها فموضعان منفصلان.
 */
export function clusterCharacterAnchors(
  anchors: CharacterAnchor[],
  wordLengths: Map<number, number> = new Map()
): CharacterRange[] {
  if (anchors.length === 0) return [];

  const ordered = [...anchors].sort(compareCharacterAnchors);
  const clusters: CharacterAnchor[][] = [[ordered[0]]];

  for (let index = 1; index < ordered.length; index++) {
    const previous = clusters[clusters.length - 1][clusters[clusters.length - 1].length - 1];
    const next = ordered[index];
    if (areAnchorsContiguous(previous, next, wordLengths)) {
      clusters[clusters.length - 1].push(next);
    } else {
      clusters.push([next]);
    }
  }

  return clusters.map((cluster) => ({
    start: { ...cluster[0] },
    end: { ...cluster[cluster.length - 1] },
  }));
}

function areAnchorsContiguous(
  first: CharacterAnchor,
  second: CharacterAnchor,
  wordLengths: Map<number, number>
): boolean {
  if (first.position === second.position) {
    return second.characterIndex === first.characterIndex + 1;
  }

  if (second.position !== first.position + 1 || second.characterIndex !== 1) return false;

  const firstLength = wordLengths.get(first.position);
  if (typeof firstLength === 'number') return first.characterIndex === firstLength;
  // بلا طول معلوم: حرف في كلمة تالية مباشرة يُعدّ امتدادا للنطاق (مد منفصل).
  return true;
}

/** يبني مواضع الاختلاف من الكلمات أو الحروف المعلّمة، بلا ملء الفجوات. */
export function buildLociFromMarks(input: {
  mode: 'WORDS' | 'CHARACTERS';
  positions: number[];
  characters: CharacterAnchor[];
  wordLengths?: Map<number, number>;
}): VariantLocus[] {
  if (input.mode === 'CHARACTERS') {
    return clusterCharacterAnchors(input.characters, input.wordLengths ?? new Map()).map((range) =>
      normalizeLocus({
        startPosition: range.start.position,
        endPosition: range.end.position,
        characterRange: range,
      })
    );
  }

  return clusterWordPositions(input.positions).map((cluster) =>
    normalizeLocus({
      startPosition: cluster[0],
      endPosition: cluster[cluster.length - 1],
    })
  );
}

/** يضبط start/end الاختلاف على اتحاد مواضعه. */
export function boundsOfLoci(loci: VariantLocus[]): { startPosition: number; endPosition: number } {
  if (loci.length === 0) return { startPosition: 1, endPosition: 1 };
  return {
    startPosition: Math.min(...loci.map((locus) => locus.startPosition)),
    endPosition: Math.max(...loci.map((locus) => locus.endPosition)),
  };
}

/**
 * مفتاح تنافي الأوجه: الفئة + حدود المواضع.
 *
 * مدٌّ ٢ ومدٌّ ٤ في الحروف نفسها فئة واحدة فيتنافيان. أما مدّاً وتقليلاً
 * في الكلمة نفسها ففئتان فيجتمعان في السطر بالضرب.
 */
export function exclusiveLocusKey(variant: Variant): string {
  const signature = lociOfVariant(variant)
    .map((locus) => {
      if (locus.characterRange) {
        const { start, end } = locus.characterRange;
        return `c:${start.position}.${start.characterIndex}-${end.position}.${end.characterIndex}`;
      }
      return `w:${locus.startPosition}-${locus.endPosition}`;
    })
    .join('+');
  return `${variant.category}::${signature}`;
}

/** هل يتقاطع موضعا اختلاف في كلمة واحدة على الأقل؟ */
export function variantsSharePosition(first: Variant, second: Variant): boolean {
  const secondPositions = new Set(positionsOfVariant(second));
  return positionsOfVariant(first).some((position) => secondPositions.has(position));
}

/**
 * مفتاح التنافي داخل الآية: الفئة + مجموعة المواضع المتداخلة.
 *
 * مدّان في كلمتين منفصلتين يبقيان بعدين مستقلين فيجتمعان في السطر.
 * أما مدّان أو صلتان يتقاطعان في كلمة فوجهان متنافيان لموضع واحد، ولو
 * اختلفا في حدود المدى المسجّل (كما في الملفات القديمة التي تملأ الفجوة).
 */
export function exclusiveGroupKeys(variants: Variant[]): Map<string, string> {
  const ids = variants.map((variant) => variant.id);
  const parent = new Map(ids.map((id) => [id, id]));

  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (first: string, second: string) => {
    const a = find(first);
    const b = find(second);
    if (a !== b) parent.set(a, b);
  };

  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const first = variants[i];
      const second = variants[j];
      if (first.category !== second.category) continue;
      if (variantsSharePosition(first, second)) union(first.id, second.id);
    }
  }

  const keys = new Map<string, string>();
  for (const variant of variants) {
    keys.set(variant.id, `${variant.category}::${find(variant.id)}`);
  }
  return keys;
}

/** عنوان مختصر للمواضع: «ك٨ و ك١٠» أو مدى واحد. */
export function describeLoci(loci: VariantLocus[]): string {
  if (loci.length === 0) return '';
  return loci
    .map((locus) => {
      if (locus.characterRange) {
        const { start, end } = locus.characterRange;
        if (start.position === end.position && start.characterIndex === end.characterIndex) {
          return `ك${start.position}/ح${start.characterIndex}`;
        }
        return `ك${start.position}/ح${start.characterIndex}–ك${end.position}/ح${end.characterIndex}`;
      }
      if (locus.startPosition === locus.endPosition) return `ك${locus.startPosition}`;
      return `ك${locus.startPosition}–${locus.endPosition}`;
    })
    .join(' و ');
}

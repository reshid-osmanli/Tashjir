// محرك القواعد العامة - Global Quran Rule Engine
//
// هذا الملف لا يستعمل ذكاء اصطناعيا ولا تخمينا لغويا. القاعدة التي ينشئها
// المحقق تتحول إلى شروط حتمية على الرسم العثماني: حروف محددة، وعلامات ضبط
// يختار المحقق إن كانت مطلوبة، وعلاقة الحرف ببداية/نهاية الكلمة. لذلك يمكن
// فحص المصحف كله وإعادة النتيجة نفسها في كل مرة.

import { getAyahWordsByKey, SURAHS } from '@/data/quran';
import {
  characterBoundsForWord,
  splitQuranCharacters,
  textForCharacterRange,
  type QuranCharacter,
} from '@/lib/quran-logic/characters';
import {
  endingHarakaOf,
  hasMorphologyFeature,
  isParticleOfClass,
  MORPHOLOGY_FEATURE_LABELS,
  PARTICLE_CLASS_LABELS,
  WORD_ENDING_HARAKA_LABELS,
} from '@/lib/quran-logic/arabic-grammar';
import {
  HURUF_ALIDGHAM,
  HURUF_ALIQLAB,
  HURUF_ALIKHFAA,
  HURUF_GHUNNAH,
  HURUF_IZHAR,
  HURUF_MAD,
  HURUF_QALQALAH,
} from '@/lib/quran-logic/tajweed';
import type {
  AyahWordPosition,
  CharacterRange,
  GlobalCharacterConstraint,
  GlobalCharacterPattern,
  GlobalCharacterSet,
  GlobalMorphologyWordPattern,
  GlobalRulePattern,
  GlobalWordCharacterPattern,
  HarakaMatchMode,
  MorphologyFeature,
  TashjeerDocument,
  Variant,
} from '@/types/tashjeer';
import { listGlobalRules, type GlobalRule } from '@/lib/storage/global-rules-store';
import {
  occurrenceIdFor,
  occurrenceOverrideMap,
  type RuleOccurrenceOverride,
} from '@/lib/storage/rule-occurrences-store';

/** كلمة بالحد الأدنى الذي يحتاجه المحرك؛ يسهل اختبار المحرك دون تحميل المصحف. */
export interface RuleEngineWord {
  position: number;
  text: string;
  id?: number;
  ayahKey?: number;
}

/** نتيجة مطابقة موضع واحد داخل آية. */
export interface GlobalRuleMatch {
  ruleId?: string;
  ayahKey?: number;
  startPosition: number;
  endPosition: number;
  characterRange: CharacterRange;
  matchedText: string;
}

/** المجموعات الجاهزة التي يمكن للمحقق استعمالها دون كتابة حروفها يدويا. */
export const GLOBAL_CHARACTER_SETS: Record<Exclude<GlobalCharacterSet, 'EXACT'>, string[]> = {
  IKHFAA: HURUF_ALIKHFAA,
  IZHAR: HURUF_IZHAR,
  IDGHAM: HURUF_ALIDGHAM,
  IQLAB: HURUF_ALIQLAB,
  QALQALAH: HURUF_QALQALAH,
  GHUNNAH: HURUF_GHUNNAH,
  MAD: HURUF_MAD,
};

export const GLOBAL_CHARACTER_SET_LABELS: Record<GlobalCharacterSet, string> = {
  EXACT: 'الحرف المحدد فقط',
  IKHFAA: 'أي حرف من حروف الإخفاء',
  IZHAR: 'أي حرف من حروف الإظهار',
  IDGHAM: 'أي حرف من حروف الإدغام',
  IQLAB: 'حرف الإقلاب (الباء)',
  QALQALAH: 'أي حرف من حروف القلقلة',
  GHUNNAH: 'النون أو الميم',
  MAD: 'أي حرف مد',
};

export interface BuildCharacterPatternOptions {
  /** سياسة ابتدائية لكل حرف؛ يمكن للواجهة تعديل كل قيد بعدها منفردا. */
  defaultHarakaMode?: HarakaMatchMode;
}

/**
 * يبني نمط قاعدة من مدى الحروف الذي حدده المحقق في آية المصدر.
 *
 * الحروف الواقعة في أول/آخر الكلمة تحفظ نسبتها إلى الطرف، فلا تفشل القاعدة
 * لمجرد أن الكلمة النظيرة أطول أو أقصر. الحرف الداخلي يحفظ رقمه المطلق؛ وهذا
 * مقصود للدقة لأن المحرك لا ينبغي أن يخمن موضعا آخر.
 */
export function buildCharacterPattern(
  ayahKey: number,
  range: CharacterRange,
  options: BuildCharacterPatternOptions = {}
): GlobalCharacterPattern {
  const words = getAyahWordsByKey(ayahKey);
  const firstPosition = Math.min(range.start.position, range.end.position);
  const lastPosition = Math.max(range.start.position, range.end.position);
  const normalizedRange = normalizeRange(range);

  if (words.length === 0) throw new Error('لا توجد كلمات للآية المحددة.');
  if (firstPosition < 1 || lastPosition > words.length) {
    throw new Error('مدى الحروف خارج كلمات الآية.');
  }
  if (
    normalizedRange.start.position > normalizedRange.end.position ||
    (normalizedRange.start.position === normalizedRange.end.position &&
      normalizedRange.start.characterIndex > normalizedRange.end.characterIndex)
  ) {
    throw new Error('بداية مدى الحروف تأتي بعد نهايته.');
  }

  const defaultHarakaMode = options.defaultHarakaMode ?? 'EXACT';
  const patterns: GlobalWordCharacterPattern[] = [];

  for (let position = firstPosition; position <= lastPosition; position += 1) {
    const word = words.find((item) => item.position === position);
    if (!word) throw new Error(`تعذر العثور على الكلمة رقم ${position}.`);

    const bounds = characterBoundsForWord(normalizedRange, position, word.text);
    if (!bounds) throw new Error(`مدى الحروف لا يشمل الكلمة رقم ${position}.`);

    const characters = splitQuranCharacters(word.text);
    const constraints = characters
      .slice(bounds.start - 1, bounds.end)
      .map((character, index) => {
        const characterIndex = bounds.start + index;
        return {
          baseLetter: baseLetter(character),
          letterSet: 'EXACT',
          marks: marksOf(character),
          harakaMode: defaultHarakaMode,
          ...anchorForSelection(characterIndex, characters.length, bounds),
        } satisfies GlobalCharacterConstraint;
      });

    if (constraints.length === 0) throw new Error(`لم يحدد أي حرف من الكلمة رقم ${position}.`);

    patterns.push({
      offset: position - firstPosition,
      constraints,
      // إذا حُددت الكلمة كلها، فمطابقة طولها جزء من الدقة. أما تحديد طرف
      // واحد فقط فيبقي أطوال الكلمات الأخرى حرة.
      exactLength: bounds.start === 1 && bounds.end === characters.length
        ? characters.length
        : undefined,
    });
  }

  return {
    kind: 'CHARACTERS',
    version: 1,
    wordCount: lastPosition - firstPosition + 1,
    words: patterns,
    sourceAyahKey: ayahKey,
    sourceRange: normalizedRange,
  };
}

/**
 * يطابق التتابع الحرفي نفسه داخل كلمة واحدة.
 *
 * القاعدة الصوتية (كنون ساكنة قبل حرف إخفاء) تجري بين الكلمتين وتجري في
 * جوف الكلمة الواحدة: «مِنْ ثَمَرَةٍ» و«أَنتُمْ» حكمهما واحد. هذه الدالة
 * تبسط قيود الكلمات إلى سلسلة واحدة مرتبة ثم تبحث عنها حروفا **متجاورة**
 * داخل الكلمة، فلا يفرَّق التتابع ولا يُدّعى حكم بين حرفين بينهما فاصل.
 */
export function matchCharacterPatternInsideWord(
  word: RuleEngineWord,
  pattern: GlobalCharacterPattern,
  ayahKey?: number,
  ruleId?: string
): GlobalRuleMatch[] {
  const sequence = flattenedConstraints(pattern);
  if (sequence.length < 2) return [];

  const characters = splitQuranCharacters(word.text);
  if (characters.length < sequence.length) return [];

  const matches: GlobalRuleMatch[] = [];
  for (let start = 0; start + sequence.length <= characters.length; start += 1) {
    let all = true;
    for (let index = 0; index < sequence.length; index += 1) {
      if (!matchesConstraint(characters[start + index], sequence[index])) {
        all = false;
        break;
      }
    }
    if (!all) continue;

    const characterRange: CharacterRange = {
      start: { position: word.position, characterIndex: start + 1 },
      end: { position: word.position, characterIndex: start + sequence.length },
    };
    matches.push({
      ruleId,
      ayahKey,
      startPosition: word.position,
      endPosition: word.position,
      characterRange,
      matchedText: textForCharacterRange([word], characterRange),
    });
  }

  return matches;
}

/** قيود النمط الحرفي مبسوطة سلسلة واحدة بترتيب التلاوة. */
function flattenedConstraints(pattern: GlobalCharacterPattern): GlobalCharacterConstraint[] {
  return [...pattern.words]
    .sort((first, second) => first.offset - second.offset)
    .flatMap((word) => word.constraints);
}

/** يطابق نمطا حرفيا في نافذة كلمات متجاورة. */
export function matchCharacterPatternInWords(
  words: RuleEngineWord[],
  pattern: GlobalCharacterPattern,
  startIndex: number,
  ayahKey?: number,
  ruleId?: string
): GlobalRuleMatch | null {
  if (pattern.wordCount < 1 || pattern.words.length !== pattern.wordCount) return null;
  if (startIndex < 0 || startIndex + pattern.wordCount > words.length) return null;

  const matchedRanges: Array<{ position: number; start: number; end: number }> = [];
  const wordPatterns = [...pattern.words].sort((first, second) => first.offset - second.offset);

  for (const wordPattern of wordPatterns) {
    const word = words[startIndex + wordPattern.offset];
    if (!word || wordPattern.offset < 0 || wordPattern.offset >= pattern.wordCount) return null;

    // لا نقبل نافذة غير متجاورة، ولا نسمح بأن تتسلل القاعدة من نهاية آية
    // إلى أول كلمة الآية التالية عند استعمال قائمة أكبر من آية واحدة.
    if (wordPattern.offset > 0) {
      const previous = words[startIndex + wordPattern.offset - 1];
      if (!previous || word.position !== previous.position + 1) return null;
      if (
        typeof ayahKey === 'number' &&
        ((word.ayahKey !== undefined && word.ayahKey !== ayahKey) ||
          (previous.ayahKey !== undefined && previous.ayahKey !== ayahKey))
      ) {
        return null;
      }
    }

    const characters = splitQuranCharacters(word.text);
    if (wordPattern.exactLength !== undefined && characters.length !== wordPattern.exactLength) {
      return null;
    }

    const indexes: number[] = [];
    for (const constraint of wordPattern.constraints) {
      const index = resolveConstraintIndex(constraint, characters.length);
      if (index < 1 || index > characters.length) return null;
      if (!matchesConstraint(characters[index - 1], constraint)) return null;
      indexes.push(index);
    }

    if (indexes.length === 0) return null;
    matchedRanges.push({
      position: word.position,
      start: Math.min(...indexes),
      end: Math.max(...indexes),
    });
  }

  const first = matchedRanges[0];
  const last = matchedRanges[matchedRanges.length - 1];
  const characterRange: CharacterRange = {
    start: { position: first.position, characterIndex: first.start },
    end: { position: last.position, characterIndex: last.end },
  };

  return {
    ruleId,
    ayahKey,
    startPosition: words[startIndex].position,
    endPosition: words[startIndex + pattern.wordCount - 1].position,
    characterRange,
    matchedText: textForCharacterRange(words, characterRange),
  };
}

/** سياق الكلمة داخل آيتها؛ تحتاجه المعايير النحوية (ما قبلها وما بعدها وموقعها). */
export interface MorphologyWordContext {
  /** الكلمة السابقة مباشرة في الآية نفسها. */
  previous?: RuleEngineWord;
  /** الكلمة التالية مباشرة في الآية نفسها. */
  next?: RuleEngineWord;
  /** هل هي أول كلمة في الآية؟ */
  isFirst?: boolean;
  /** هل هي آخر كلمة في الآية؟ */
  isLast?: boolean;
}

/**
 * يطابق نمطا صرفيا/نحويا حتميا في كلمة واحدة.
 *
 * كل المعايير تُجمع بـ AND: القالب، والبادئة واللاحقة، والخصائص الصرفية،
 * والمستثنيات، وحركة الآخر، والأداة قبل الكلمة أو بعدها، وموقعها من الآية،
 * وطولها. ترك المعيار فارغا يعني عدم التقييد به.
 */
export function matchMorphologyPatternInWord(
  word: RuleEngineWord,
  pattern: GlobalMorphologyWordPattern,
  context: MorphologyWordContext = {}
): boolean {
  const actual = splitQuranCharacters(word.text);
  if (actual.length === 0) return false;

  const template = pattern.template ? splitPatternCharacters(pattern.template) : [];

  // المعايير النحوية والصرفية تُفحص أولا لأنها أرخص من مطابقة القالب حرفا حرفا.
  if (!matchesGrammarCriteria(word, pattern, context, actual.length)) return false;

  if (template.length > 0) {
    if (actual.length !== template.length) return false;
    const rootLetters = new Map<string, string>();

    for (let index = 0; index < template.length; index += 1) {
      const expected = template[index];
      const candidate = actual[index];
      const expectedBase = baseLetter(expected);
      const candidateBase = baseLetter(candidate);

      if (isRootPlaceholder(expectedBase)) {
        const previous = rootLetters.get(expectedBase);
        if (previous && previous !== candidateBase) return false;
        rootLetters.set(expectedBase, candidateBase);
      } else if (expectedBase !== candidateBase) {
        return false;
      }

      if (!matchesMarks(marksOf(candidate), marksOf(expected), pattern.harakaMode)) {
        return false;
      }
    }
  }

  if (pattern.prefix && !matchesLiteralEdge(actual, pattern.prefix, 'START', pattern.harakaMode)) {
    return false;
  }
  if (pattern.suffix && !matchesLiteralEdge(actual, pattern.suffix, 'END', pattern.harakaMode)) {
    return false;
  }

  // قاعدة بلا أي معيار تطابق المصحف كله، وهذا خطأ تحرير لا نتيجة مقصودة.
  return (
    template.length > 0 ||
    Boolean(pattern.prefix || pattern.suffix) ||
    hasGrammarCriteria(pattern)
  );
}

/** هل في النمط معيار نحوي/صرفي واحد على الأقل (خارج القالب والبادئة واللاحقة)؟ */
export function hasGrammarCriteria(pattern: GlobalMorphologyWordPattern): boolean {
  return Boolean(
    pattern.morphologyFeatures?.length ||
      pattern.excludedMorphologyFeatures?.length ||
      pattern.endingHaraka?.length ||
      pattern.precededBy?.length ||
      pattern.followedBy?.length ||
      pattern.startsWithSet ||
      pattern.endsWithSet ||
      (pattern.ayahPosition && pattern.ayahPosition !== 'ANY') ||
      typeof pattern.minLength === 'number' ||
      typeof pattern.maxLength === 'number'
  );
}

function matchesGrammarCriteria(
  word: RuleEngineWord,
  pattern: GlobalMorphologyWordPattern,
  context: MorphologyWordContext,
  characterCount: number
): boolean {
  if (typeof pattern.minLength === 'number' && characterCount < pattern.minLength) return false;
  if (typeof pattern.maxLength === 'number' && characterCount > pattern.maxLength) return false;

  if (pattern.startsWithSet || pattern.endsWithSet) {
    const characters = splitQuranCharacters(word.text);
    if (characters.length === 0) return false;
    if (pattern.startsWithSet) {
      const first = baseLetter(characters[0]);
      // همزة الوصل تُتخطى: الحرف المنطوق بعدها هو المعتبر في الأحكام الصوتية.
      const effective = first === 'ٱ' && characters.length > 1 ? baseLetter(characters[1]) : first;
      if (!GLOBAL_CHARACTER_SETS[pattern.startsWithSet]?.includes(effective)) return false;
    }
    if (pattern.endsWithSet) {
      const last = baseLetter(characters[characters.length - 1]);
      if (!GLOBAL_CHARACTER_SETS[pattern.endsWithSet]?.includes(last)) return false;
    }
  }

  if (pattern.morphologyFeatures?.length) {
    // مطلوبة كلها: «فُعْلَى» + ألف مقصورة أضيق من كل منهما وحده.
    const allPresent = pattern.morphologyFeatures.every((feature) =>
      hasMorphologyFeature(word.text, feature)
    );
    if (!allPresent) return false;
  }

  if (pattern.excludedMorphologyFeatures?.length) {
    const anyExcluded = pattern.excludedMorphologyFeatures.some((feature) =>
      hasMorphologyFeature(word.text, feature)
    );
    if (anyExcluded) return false;
  }

  if (pattern.endingHaraka?.length) {
    const ending = endingHarakaOf(word.text);
    if (!ending || !pattern.endingHaraka.includes(ending)) return false;
  }

  if (pattern.precededBy?.length) {
    if (!context.previous) return false;
    const matches = pattern.precededBy.some((particleClass) =>
      isParticleOfClass(context.previous!.text, particleClass)
    );
    if (!matches) return false;
  }

  if (pattern.followedBy?.length) {
    if (!context.next) return false;
    const matches = pattern.followedBy.some((particleClass) =>
      isParticleOfClass(context.next!.text, particleClass)
    );
    if (!matches) return false;
  }

  switch (pattern.ayahPosition) {
    case 'FIRST':
      return context.isFirst === true;
    case 'LAST':
      return context.isLast === true;
    case 'NOT_LAST':
      return context.isLast !== true;
    default:
      return true;
  }
}

/** يطابق نمط قاعدة في كلمات آية واحدة فقط. */
export function matchPatternInAyah(
  words: RuleEngineWord[],
  pattern: GlobalRulePattern,
  ayahKey?: number,
  ruleId?: string
): GlobalRuleMatch[] {
  if (words.length === 0) return [];
  const matches: GlobalRuleMatch[] = [];

  if (pattern.kind === 'CHARACTERS') {
    const scope = pattern.matchScope ?? 'WORDS';

    if (scope === 'WORDS' || scope === 'BOTH') {
      for (let startIndex = 0; startIndex <= words.length - pattern.wordCount; startIndex += 1) {
        const match = matchCharacterPatternInWords(words, pattern, startIndex, ayahKey, ruleId);
        if (match) matches.push(match);
      }
    }

    if (scope === 'INSIDE_WORD' || scope === 'BOTH') {
      for (const word of words) {
        for (const match of matchCharacterPatternInsideWord(word, pattern, ayahKey, ruleId)) {
          // BOTH قد يجد التتابع نفسه مرتين إذا كانت القاعدة كلمة واحدة؛
          // نستبعد المكرر بمداه الحرفي حتى لا يُعرض الموضع الواحد مرتين.
          const duplicate = matches.some(
            (existing) =>
              existing.characterRange.start.position === match.characterRange.start.position &&
              existing.characterRange.start.characterIndex === match.characterRange.start.characterIndex &&
              existing.characterRange.end.position === match.characterRange.end.position &&
              existing.characterRange.end.characterIndex === match.characterRange.end.characterIndex
          );
          if (!duplicate) matches.push(match);
        }
      }
      matches.sort(
        (first, second) =>
          first.characterRange.start.position - second.characterRange.start.position ||
          first.characterRange.start.characterIndex - second.characterRange.start.characterIndex
      );
    }

    return matches;
  }

  const ordered = [...words].sort((first, second) => first.position - second.position);
  const wordPatterns = [...pattern.words].sort((first, second) => first.offset - second.offset);
  const windowSize = Math.max(pattern.wordCount, wordPatterns.length);

  for (let index = 0; index + windowSize <= ordered.length; index += 1) {
    // كل كلمات النافذة يجب أن توافق نمطها بمعاييرها وسياقها الخاص.
    let all = true;
    for (const wordPattern of wordPatterns) {
      const wordIndex = index + wordPattern.offset;
      const word = ordered[wordIndex];
      if (!word) {
        all = false;
        break;
      }
      // النافذة متجاورة: لا فجوة بين مواقع الكلمات.
      if (wordPattern.offset > 0) {
        const previous = ordered[wordIndex - 1];
        if (!previous || word.position !== previous.position + 1) {
          all = false;
          break;
        }
      }
      const context: MorphologyWordContext = {
        previous: ordered[wordIndex - 1],
        next: ordered[wordIndex + 1],
        isFirst: wordIndex === 0,
        isLast: wordIndex === ordered.length - 1,
      };
      if (!matchMorphologyPatternInWord(word, wordPattern, context)) {
        all = false;
        break;
      }
    }
    if (!all) continue;

    const firstWord = ordered[index + wordPatterns[0].offset];
    const lastPattern = wordPatterns[wordPatterns.length - 1];
    const lastWord = ordered[index + lastPattern.offset];

    const firstCharacters = splitQuranCharacters(firstWord.text);
    const firstBounds = highlightBoundsForMorphology(wordPatterns[0], firstCharacters.length);
    const lastCharacters = splitQuranCharacters(lastWord.text);
    const lastBounds = highlightBoundsForMorphology(lastPattern, lastCharacters.length);

    const characterRange: CharacterRange = {
      start: { position: firstWord.position, characterIndex: firstBounds.start },
      end: { position: lastWord.position, characterIndex: lastBounds.end },
    };
    matches.push({
      ruleId,
      ayahKey,
      startPosition: firstWord.position,
      endPosition: lastWord.position,
      characterRange,
      matchedText: textForCharacterRange(words, characterRange),
    });
  }

  return matches;
}

/** يبحث عن مواضع قاعدة في آية واحدة. */
export function findGlobalRuleMatchesInAyah(
  rule: Pick<GlobalRule, 'id' | 'pattern'>,
  ayahKey: number
): GlobalRuleMatch[] {
  if (!rule.pattern) return [];
  return matchPatternInAyah(
    getAyahWordsByKey(ayahKey),
    rule.pattern,
    ayahKey,
    rule.id
  );
}

/**
 * يفحص المصحف كله. لا يعبر حدود الآيات، حتى لو كان آخر حرف من آية يوافق
 * أول حرف من الآية التالية؛ هذا يمنع نتائج غير موجودة في سياق التلاوة.
 */
export function findGlobalRuleMatches(
  rule: Pick<GlobalRule, 'id' | 'pattern'>,
  options: { limit?: number } = {}
): GlobalRuleMatch[] {
  if (!rule.pattern) return [];
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const matches: GlobalRuleMatch[] = [];

  for (const surah of SURAHS) {
    for (let ayahNumber = 1; ayahNumber <= surah.ayahsCount; ayahNumber += 1) {
      const ayahKey = surah.number * 1000 + ayahNumber;
      const inAyah = findGlobalRuleMatchesInAyah(rule, ayahKey);
      matches.push(...inAyah);
      if (matches.length >= limit) return matches.slice(0, limit);
    }
  }

  return matches;
}

/**
 * يضيف مواضع القواعد العامة النشطة إلى اختلافات آية دون حفظ نسخ مكررة.
 *
 * المواضع التي حذفها المحقق فرديا تُستبعد هنا وحدها، فتبقى القاعدة عاملة في
 * سائر المصحف. والمواضع التي خُصِّصت لها درجة قوة تأخذ تخصيصها لا درجة القاعدة.
 */
export function getEffectiveVariants(document: TashjeerDocument): Variant[] {
  const derived: Variant[] = [];
  const overrides = occurrenceOverrideMap();

  for (const rule of listGlobalRules()) {
    if (!rule.isActive || !rule.pattern) continue;
    for (const match of findGlobalRuleMatchesInAyah(rule, document.ayahKey)) {
      const override = overrides.get(occurrenceIdFor(rule.id, match));
      if (override?.state === 'DELETED') continue;
      derived.push(variantFromGlobalMatch(rule, match, override));
    }
  }

  return [...document.variants, ...derived];
}

/**
 * يعيد بناء مطابقة القاعدة من اختلاف مشتق، لتعديل رتبة موضعه من الخصائص
 * دون المرور بشاشة تتبّع المواضع.
 */
export function matchFromDerivedVariant(variant: Variant): GlobalRuleMatch | null {
  if (!variant.isGlobalDerived || !variant.globalRuleId || !variant.characterRange) return null;
  const separator = variant.title.indexOf(' · ');
  return {
    ruleId: variant.globalRuleId,
    ayahKey: variant.ayahKey,
    startPosition: variant.startPosition,
    endPosition: variant.endPosition,
    characterRange: variant.characterRange,
    matchedText: separator === -1 ? variant.title : variant.title.slice(separator + 3),
  };
}

/** يحول نتيجة المطابقة إلى اختلاف مشتق يفهمه محرك التشجير الحالي. */
export function variantFromGlobalMatch(
  rule: GlobalRule,
  match: GlobalRuleMatch,
  override?: RuleOccurrenceOverride
): Variant {
  const id = occurrenceIdFor(rule.id, match);
  return {
    id,
    ayahKey: match.ayahKey ?? 0,
    category: rule.category,
    title: `${rule.title} · ${match.matchedText}`,
    startPosition: match.startPosition,
    endPosition: match.endPosition,
    targetKind: 'CHARACTERS',
    characterRange: match.characterRange,
    status: rule.status,
    isGlobalDerived: true,
    globalRuleId: rule.id,
    // المحرك مصدر هذا الموضع؛ التصحيح اليدوي يظهر في سجل التعديل والتتبع.
    origin: 'ENGINE',
    // رتبة ترتيب السطر: تخصيص الموضع يسبق رتبة القاعدة العامة.
    orderRank: override?.orderRank ?? rule.orderRank,
    description: rule.description,
    sourceRef: rule.sourceRef,
    alternatives: [
      {
        id: `${id}:alternative`,
        text: match.matchedText,
        label: rule.ruleLabel || rule.title,
        scope: rule.scope,
        ruleLabel: rule.ruleLabel,
        maddHarakat: rule.maddHarakat,
        notes: rule.description,
        evidences: rule.evidences,
        // تخصيص الموضع يسبق درجة القاعدة، فقد يرجّح المحقق الوجه هنا
        // ويؤخّره هناك بحسب السياق.
        strengthDegreeId: override?.strengthDegreeId ?? rule.strengthDegreeId,
        strengthByNarrator: override?.strengthByNarrator ?? rule.strengthByNarrator,
      },
    ],
  };
}

// ==================== الحروف والمطابقة ====================

function normalizeRange(range: CharacterRange): CharacterRange {
  const first = { ...range.start };
  const last = { ...range.end };
  if (
    first.position > last.position ||
    (first.position === last.position && first.characterIndex > last.characterIndex)
  ) {
    return { start: last, end: first };
  }
  return { start: first, end: last };
}

function anchorForSelection(
  characterIndex: number,
  characterCount: number,
  bounds: { start: number; end: number }
): Pick<GlobalCharacterConstraint, 'anchor' | 'value'> {
  // كتلة في أول الكلمة تبقى بادئة، وكتلة في آخرها تبقى لاحقة. الكتلة
  // الوسطية تحفظ الرقم المطلق بدلا من اختراع جذر أو موضع غير محدد.
  if (bounds.start === 1 && bounds.end < characterCount) {
    return { anchor: 'START', value: characterIndex - 1 };
  }
  if (bounds.end === characterCount && bounds.start > 1) {
    return { anchor: 'END', value: characterCount - characterIndex };
  }
  if (bounds.start === 1 && bounds.end === characterCount) {
    return { anchor: 'START', value: characterIndex - 1 };
  }
  return { anchor: 'INDEX', value: characterIndex };
}

function resolveConstraintIndex(
  constraint: GlobalCharacterConstraint,
  characterCount: number
): number {
  switch (constraint.anchor) {
    case 'START':
      return constraint.value + 1;
    case 'END':
      return characterCount - constraint.value;
    case 'INDEX':
      return constraint.value;
    default:
      return 0;
  }
}

function matchesConstraint(
  actual: QuranCharacter,
  constraint: GlobalCharacterConstraint
): boolean {
  return (
    matchesBaseLetter(baseLetter(actual), constraint) &&
    matchesMarks(marksOf(actual), constraint.marks, constraint.harakaMode)
  );
}

function matchesBaseLetter(
  actual: string,
  constraint: Pick<GlobalCharacterConstraint, 'baseLetter' | 'letterSet'>
): boolean {
  const set = constraint.letterSet ?? 'EXACT';
  if (set === 'EXACT') return actual === constraint.baseLetter;
  return GLOBAL_CHARACTER_SETS[set].includes(actual);
}

function matchesMarks(
  actual: string,
  expected: string,
  mode: HarakaMatchMode
): boolean {
  if (mode === 'IGNORE') return true;
  if (mode === 'NONE') return actual.length === 0;
  // «ساكن»: علامة السكون بصورتيها أو حرف معرّى من الحركة (رسم النون والميم
  // الساكنتين قبل الإدغام والإخفاء في الضبط العثماني).
  if (mode === 'SAKIN') return isSakinMarks(actual);
  return actual === expected;
}

const SUKUN_MARK_FORMS = ['\u0652', '\u06E1'];
const VOWEL_MARK_FORMS = [
  '\u064E', '\u064F', '\u0650', // فتحة ضمة كسرة
  '\u064B', '\u064C', '\u064D', // تنوين متراكب
  '\u0656', '\u0657', '\u065E', // تنوين متتابع
];

/** هل هذه العلامات علامات حرف ساكن في الأداء؟ */
function isSakinMarks(marks: string): boolean {
  if (SUKUN_MARK_FORMS.some((mark) => marks.includes(mark))) return true;
  if (marks.includes('\u0651')) return false; // الشدة تنفي السكون
  return !VOWEL_MARK_FORMS.some((mark) => marks.includes(mark));
}

function matchesLiteralEdge(
  actual: QuranCharacter[],
  literal: string,
  edge: 'START' | 'END',
  mode: HarakaMatchMode
): boolean {
  const expected = splitPatternCharacters(literal);
  if (expected.length === 0 || expected.length > actual.length) return false;
  const start = edge === 'START' ? 0 : actual.length - expected.length;

  for (let index = 0; index < expected.length; index += 1) {
    const candidate = actual[start + index];
    const wanted = expected[index];
    if (baseLetter(candidate) !== baseLetter(wanted)) return false;
    if (!matchesMarks(marksOf(candidate), marksOf(wanted), mode)) return false;
  }
  return true;
}

function splitPatternCharacters(text: string): QuranCharacter[] {
  // التطويل جزء طباعي في القوالب وليس حرفا من الوزن.
  return splitQuranCharacters(text.replace(/[\u0640\s]/g, ''));
}

function baseLetter(character: QuranCharacter): string {
  return Array.from(character.text)[0] ?? '';
}

function marksOf(character: QuranCharacter): string {
  return Array.from(character.text).slice(1).join('');
}

function isRootPlaceholder(letter: string): boolean {
  return letter === 'ف' || letter === 'ع' || letter === 'ل';
}

function highlightBoundsForMorphology(
  pattern: GlobalMorphologyWordPattern,
  characterCount: number
): { start: number; end: number } {
  if (!pattern.template && pattern.suffix) {
    const suffixLength = splitPatternCharacters(pattern.suffix).length;
    return {
      start: Math.max(1, characterCount - suffixLength + 1),
      end: characterCount,
    };
  }
  // معيار على آخر الكلمة وحده (نون ساكنة، مجموعة حروف): يُعلَّم آخر حرف.
  if (!pattern.template && !pattern.prefix && isEndOnlyPattern(pattern)) {
    return { start: characterCount, end: characterCount };
  }
  // معيار على أول الكلمة وحده (مجموعة حروف في البداية): يُعلَّم أول حرف.
  if (!pattern.template && !pattern.suffix && isStartOnlyPattern(pattern)) {
    return { start: 1, end: 1 };
  }
  // القالب الصرفي يصف الكلمة كلها، وهو ما يحتاجه الخط في المراجعة.
  return { start: 1, end: characterCount };
}

/** هل معايير النمط كلها تخص آخر الكلمة؟ عندها يعلَّم آخر حرف فقط. */
function isEndOnlyPattern(pattern: GlobalMorphologyWordPattern): boolean {
  const endFeatures: MorphologyFeature[] = ['NOON_SAKINA_END', 'MEEM_SAKINA_END', 'PLURAL_WAW', 'TAA_MARBUTA', 'TAA_MAFTUHA'];
  const hasEndCriteria = Boolean(
    pattern.endsWithSet ||
      pattern.endingHaraka?.length ||
      pattern.morphologyFeatures?.some((feature) => endFeatures.includes(feature))
  );
  const hasOtherCriteria = Boolean(
    pattern.startsWithSet ||
      pattern.prefix ||
      pattern.morphologyFeatures?.some((feature) => !endFeatures.includes(feature))
  );
  return hasEndCriteria && !hasOtherCriteria;
}

/** هل معايير النمط كلها تخص أول الكلمة؟ عندها يعلَّم أول حرف فقط. */
function isStartOnlyPattern(pattern: GlobalMorphologyWordPattern): boolean {
  const startFeatures: MorphologyFeature[] = ['HAMZAT_WASL_START', 'DEFINITE_AL', 'SHAMSI_AL', 'QAMARI_AL'];
  const hasStartCriteria = Boolean(
    pattern.startsWithSet ||
      pattern.morphologyFeatures?.some((feature) => startFeatures.includes(feature))
  );
  const hasOtherCriteria = Boolean(
    pattern.endsWithSet ||
      pattern.suffix ||
      pattern.endingHaraka?.length ||
      pattern.morphologyFeatures?.some((feature) => !startFeatures.includes(feature))
  );
  return hasStartCriteria && !hasOtherCriteria;
}

/** ملخص قصير للعرض في الواجهات. */
export function describeGlobalPattern(pattern?: GlobalRulePattern): string {
  if (!pattern) return 'قاعدة وصفية بلا تطبيق آلي';
  if (pattern.kind === 'CHARACTERS') {
    const words = pattern.words
      .map((word) =>
        word.constraints
          .map((constraint) =>
            constraint.letterSet && constraint.letterSet !== 'EXACT'
              ? constraint.letterSet
              : constraint.baseLetter
          )
          .join('')
      )
      .filter(Boolean)
      .join(' … ');
    const scopeLabel =
      pattern.matchScope === 'INSIDE_WORD'
        ? ' — داخل الكلمة الواحدة'
        : pattern.matchScope === 'BOTH'
          ? ' — بين الكلمات وداخلها'
          : '';
    return `${pattern.wordCount} كلمة متجاورة: ${words || 'قيود حروف'}${scopeLabel}`;
  }
  if (pattern.words.length === 1) return describeMorphologyWord(pattern.words[0]);
  return [...pattern.words]
    .sort((first, second) => first.offset - second.offset)
    .map((word, index) => `${index + 1}) ${describeMorphologyWord(word)}`)
    .join(' ثم ');
}

/** أسماء مواقع الكلمة من الآية، للعرض في وصف القاعدة. */
const AYAH_POSITION_LABELS: Record<AyahWordPosition, string> = {
  ANY: 'أي موضع',
  FIRST: 'أول الآية',
  LAST: 'آخر الآية',
  NOT_LAST: 'غير آخر الآية',
};

/**
 * يصف القاعدة الصرفية/النحوية بعبارة عربية واحدة.
 *
 * الوصف مبني على المعايير المفعّلة فقط: القاعدة قد تكون قالبا صرفيا خالصا،
 * أو شرطا نحويا خالصا (كأن تسبقها أداة جر)، أو مزيجا منهما. لذلك نجمع
 * الأجزاء المتحققة ثم نصلها، بدل قالب ثابت يظهر فيه فراغ عند غياب المعيار.
 */
function describeMorphologyWord(word: GlobalMorphologyWordPattern): string {
  const parts: string[] = [];

  if (word.template) parts.push(`قالب «${word.template}»`);
  if (word.prefix) parts.push(`تبدأ بـ«${word.prefix}»`);
  if (word.suffix) parts.push(`تنتهي بـ«${word.suffix}»`);
  if (word.startsWithSet) parts.push(`أولها ${GLOBAL_CHARACTER_SET_LABELS[word.startsWithSet]}`);
  if (word.endsWithSet) parts.push(`آخرها ${GLOBAL_CHARACTER_SET_LABELS[word.endsWithSet]}`);

  if (word.morphologyFeatures?.length) {
    parts.push(word.morphologyFeatures.map((feature) => MORPHOLOGY_FEATURE_LABELS[feature]).join(' + '));
  }
  if (word.excludedMorphologyFeatures?.length) {
    const excluded = word.excludedMorphologyFeatures
      .map((feature) => MORPHOLOGY_FEATURE_LABELS[feature])
      .join('، ');
    parts.push(`بلا ${excluded}`);
  }
  if (word.endingHaraka?.length) {
    const harakat = word.endingHaraka.map((haraka) => WORD_ENDING_HARAKA_LABELS[haraka]).join(' أو ');
    parts.push(`آخرها ${harakat}`);
  }
  if (word.precededBy?.length) {
    parts.push(`بعد ${word.precededBy.map((item) => PARTICLE_CLASS_LABELS[item]).join(' أو ')}`);
  }
  if (word.followedBy?.length) {
    parts.push(`قبل ${word.followedBy.map((item) => PARTICLE_CLASS_LABELS[item]).join(' أو ')}`);
  }
  if (word.ayahPosition && word.ayahPosition !== 'ANY') {
    parts.push(AYAH_POSITION_LABELS[word.ayahPosition]);
  }
  if (word.minLength && word.maxLength) parts.push(`طولها ${word.minLength}-${word.maxLength} حرفا`);
  else if (word.minLength) parts.push(`طولها ${word.minLength} حروف فأكثر`);
  else if (word.maxLength) parts.push(`طولها ${word.maxLength} حروف فأقل`);

  if (parts.length === 0) return 'قاعدة صرفية بلا معايير مفعّلة';

  const scope =
    word.harakaMode === 'EXACT'
      ? 'بمطابقة الضبط'
      : word.harakaMode === 'SAKIN'
        ? 'بشرط السكون'
        : 'بتجاهل الضبط';
  return `كلمة: ${parts.join('، ')} (${scope})`;
}

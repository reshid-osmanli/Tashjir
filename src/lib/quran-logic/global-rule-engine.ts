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
  HURUF_ALIDGHAM,
  HURUF_ALIQLAB,
  HURUF_ALIKHFAA,
  HURUF_GHUNNAH,
  HURUF_IZHAR,
  HURUF_MAD,
  HURUF_QALQALAH,
} from '@/lib/quran-logic/tajweed';
import type {
  CharacterRange,
  GlobalCharacterConstraint,
  GlobalCharacterPattern,
  GlobalCharacterSet,
  GlobalMorphologyWordPattern,
  GlobalRulePattern,
  GlobalWordCharacterPattern,
  HarakaMatchMode,
  TashjeerDocument,
  Variant,
} from '@/types/tashjeer';
import { listGlobalRules, type GlobalRule } from '@/lib/storage/global-rules-store';

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

/** يطابق قالبا صرفيا حتميا في كلمة واحدة. */
export function matchMorphologyPatternInWord(
  word: RuleEngineWord,
  pattern: GlobalMorphologyWordPattern
): boolean {
  const actual = splitQuranCharacters(word.text);
  const template = pattern.template ? splitPatternCharacters(pattern.template) : [];

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

  return template.length > 0 || Boolean(pattern.prefix || pattern.suffix);
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
    for (let startIndex = 0; startIndex <= words.length - pattern.wordCount; startIndex += 1) {
      const match = matchCharacterPatternInWords(words, pattern, startIndex, ayahKey, ruleId);
      if (match) matches.push(match);
    }
    return matches;
  }

  const wordPattern = pattern.words[0];
  for (const word of words) {
    if (!matchMorphologyPatternInWord(word, wordPattern)) continue;

    const characters = splitQuranCharacters(word.text);
    const bounds = highlightBoundsForMorphology(wordPattern, characters.length);
    const characterRange: CharacterRange = {
      start: { position: word.position, characterIndex: bounds.start },
      end: { position: word.position, characterIndex: bounds.end },
    };
    matches.push({
      ruleId,
      ayahKey,
      startPosition: word.position,
      endPosition: word.position,
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

/** يضيف مواضع القواعد العامة النشطة إلى اختلافات آية دون حفظ نسخ مكررة. */
export function getEffectiveVariants(document: TashjeerDocument): Variant[] {
  const derived: Variant[] = [];
  for (const rule of listGlobalRules()) {
    if (!rule.isActive || !rule.pattern) continue;
    for (const match of findGlobalRuleMatchesInAyah(rule, document.ayahKey)) {
      derived.push(variantFromGlobalMatch(rule, match));
    }
  }
  return [...document.variants, ...derived];
}

/** يحول نتيجة المطابقة إلى اختلاف مشتق يفهمه محرك التشجير الحالي. */
export function variantFromGlobalMatch(rule: GlobalRule, match: GlobalRuleMatch): Variant {
  const id = `global:${rule.id}:${match.ayahKey ?? 'ayah'}:${match.startPosition}:${match.endPosition}:${match.characterRange.start.characterIndex}:${match.characterRange.end.characterIndex}`;
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
  return actual === expected;
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
  // القالب الصرفي يصف الكلمة كلها، وهو ما يحتاجه الخط في المراجعة.
  return { start: 1, end: characterCount };
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
    return `${pattern.wordCount} كلمة متجاورة: ${words || 'قيود حروف'}`;
  }
  const word = pattern.words[0];
  return `قالب صرفي: ${word.template || ''}${word.suffix ? ` / النهاية ${word.suffix}` : ''}`;
}

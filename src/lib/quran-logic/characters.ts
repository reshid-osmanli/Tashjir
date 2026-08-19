// أدوات الحروف القرآنية - Quran Character Utilities
//
// لا يصح عدّ المحارف البرمجية مباشرة عند تحديد حرف من الرسم العثماني؛
// فالحركات وعلامات الضبط محارف مستقلة في Unicode لكنها تتبع الحرف الذي قبلها.
// هذه الدوال تجمع الحرف الأساسي مع ما يتبعه من علامات ضبط، ليكون «الحرف» في
// واجهة المحرر هو ما يراه المحقق فعلا عند النقر، لا حركة منفصلة بلا حرف.

import type { CharacterAnchor, CharacterRange } from '@/types/tashjeer';
import {
  DEFAULT_LETTER_RATIO,
  LETTER_WIDTH_RATIO,
  ZERO_WIDTH_PATTERN,
} from '@/lib/tashjeer/layout-engine';

/** مجموعة حرف مرئي: حرف أساسي ومعه التشكيل/علامات الضبط التابعة له. */
export interface QuranCharacter {
  /** ترتيب الحرف داخل الكلمة (1-based). */
  index: number;
  /** النص كما يظهر، بما فيه العلامات التابعة. */
  text: string;
}

/**
 * يفصل الكلمة إلى حروف ظاهرة. تتبع كل علامة Unicode من فئة Mark الحرف السابق.
 * هذا يكفي للرسم العثماني الذي يضع علامات الوقف والضبط بعد الحرف، ويحافظ على
 * التشكيل عند تحديد حرف أو عند تصدير نطاقه.
 */
export function splitQuranCharacters(text: string): QuranCharacter[] {
  const result: QuranCharacter[] = [];

  for (const codePoint of Array.from(text)) {
    if (/^\p{Mark}$/u.test(codePoint) && result.length > 0) {
      result[result.length - 1].text += codePoint;
    } else {
      result.push({ index: result.length + 1, text: codePoint });
    }
  }

  return result;
}

/** عدد الحروف المرئية داخل كلمة. */
export function characterCount(text: string): number {
  return splitQuranCharacters(text).length;
}

/** يقارن مرجعين لحرفين بترتيب المصحف. */
export function compareCharacterAnchors(first: CharacterAnchor, second: CharacterAnchor): number {
  if (first.position !== second.position) return first.position - second.position;
  return first.characterIndex - second.characterIndex;
}

/**
 * يبني نطاقا متصلا من مجموعة نقرات على الحروف.
 * لا تحفظ الواجهة قائمة النقرات في المستند؛ تحفظ البداية والنهاية فقط، وهو ما
 * يجعل JSON صغيرا ومفهوما ويكفي لتمثيل المدى كله بصورة حتمية.
 */
export function rangeFromCharacterAnchors(anchors: CharacterAnchor[]): CharacterRange | null {
  if (anchors.length === 0) return null;
  const ordered = [...anchors].sort(compareCharacterAnchors);
  return {
    start: { ...ordered[0] },
    end: { ...ordered[ordered.length - 1] },
  };
}

/** هل يقع حرف ما داخل نطاق الحروف (شاملا طرفيه)؟ */
export function isCharacterInRange(anchor: CharacterAnchor, range?: CharacterRange): boolean {
  if (!range) return false;
  return (
    compareCharacterAnchors(anchor, range.start) >= 0 &&
    compareCharacterAnchors(anchor, range.end) <= 0
  );
}

/** يعيد حدّي الحروف المشمولين في كلمة من نطاق، أو null إن كانت خارج النطاق. */
export function characterBoundsForWord(
  range: CharacterRange | undefined,
  position: number,
  wordText: string
): { start: number; end: number } | null {
  if (!range || position < range.start.position || position > range.end.position) return null;

  const count = characterCount(wordText);
  if (count === 0) return null;

  const start = position === range.start.position ? range.start.characterIndex : 1;
  const end = position === range.end.position ? range.end.characterIndex : count;
  if (start < 1 || end < start || end > count) return null;
  return { start, end };
}

/**
 * يستخرج نص الحروف التي يشملها النطاق من قائمة كلمات آية. تستعمله واجهة
 * الإنشاء في عنوان الاختلاف ووجه الأساس، فيظهر المقصود بالحروف لا بالكلمة
 * كلها. الكلمات الواقعة بين الطرفين تفصل بمسافة كما في النص الأصلي.
 */
export function textForCharacterRange(
  words: Array<{ position: number; text: string }>,
  range: CharacterRange
): string {
  const parts: string[] = [];

  for (const word of words) {
    const bounds = characterBoundsForWord(range, word.position, word.text);
    if (!bounds) continue;
    const characters = splitQuranCharacters(word.text);
    parts.push(
      characters
        .slice(bounds.start - 1, bounds.end)
        .map((character) => character.text)
        .join('')
    );
  }

  return parts.join(' ');
}

/**
 * إحداثي تقريبي لنطاق حروف داخل صندوق كلمة RTL.
 * النص نفسه يبقى مرسوما ككلمة واحدة حتى لا تنكسر الوصلات العربية؛ أما هذا
 * الحساب فيستعمل فقط لخلايا النقر ولتثبيت وصلة التشجير على الحرف المقصود.
 */
export function characterRangeCenterX(
  box: { x: number; width: number; text: string },
  start: number,
  end = start
): number {
  const cells = characterHitBoxes(box);
  if (cells.length === 0) return box.x + box.width / 2;
  const safeStart = Math.min(Math.max(start, 1), cells.length);
  const safeEnd = Math.min(Math.max(end, safeStart), cells.length);
  const slice = cells.slice(safeStart - 1, safeEnd);
  return slice.reduce((sum, cell) => sum + cell.centerX, 0) / slice.length;
}

/** خلية نقر لحرف مرئي واحد داخل صندوق كلمة RTL. */
export interface CharacterHitBox {
  index: number;
  text: string;
  x: number;
  width: number;
  centerX: number;
}

/**
 * يقسم صندوق الكلمة إلى خلايا نقر: خلية لكل حرف مرئي مع تشكيله.
 * العرض يتبع نسب حروف المحرك لا القسمة المتساوية، فالنقر يصيب الحرف المرئي.
 */
export function characterHitBoxes(box: { x: number; width: number; text: string }): CharacterHitBox[] {
  const characters = splitQuranCharacters(box.text);
  if (characters.length === 0) return [];

  const rawWidths = characters.map((character) => visibleLetterWidth(character.text));
  const total = rawWidths.reduce((sum, width) => sum + width, 0);
  const scale = total > 0 ? box.width / total : 1;

  let cursor = box.x + box.width;
  return characters.map((character, arrayIndex) => {
    const width = Math.max(rawWidths[arrayIndex] * scale, 0.5);
    const x = cursor - width;
    cursor = x;
    return {
      index: character.index,
      text: character.text,
      x,
      width,
      centerX: x + width / 2,
    };
  });
}

/** عرض تقريبي للحرف المرئي. الحركات بلا عرض، والألف تبقى قابلة للنقر. */
export function visibleLetterWidth(glyph: string): number {
  let ratio = 0;
  for (const char of glyph) {
    if (ZERO_WIDTH_PATTERN.test(char)) continue;
    ratio += LETTER_WIDTH_RATIO[char] ?? DEFAULT_LETTER_RATIO;
  }
  return Math.max(ratio, 0.22);
}

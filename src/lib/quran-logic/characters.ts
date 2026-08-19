// أدوات الحروف القرآنية - Quran Character Utilities
//
// لا يصح عدّ المحارف البرمجية مباشرة عند تحديد حرف من الرسم العثماني؛
// فالحركات وعلامات الضبط محارف مستقلة في Unicode لكنها تتبع الحرف الذي قبلها.
// هذه الدوال تجمع الحرف الأساسي مع ما يتبعه من علامات ضبط، ليكون «الحرف» في
// واجهة المحرر هو ما يراه المحقق فعلا عند النقر، لا حركة منفصلة بلا حرف.

import type { CharacterAnchor, CharacterRange } from '@/types/tashjeer';

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

/** صندوق كلمة بالقدر الذي تحتاجه حسابات مواضع الحروف. */
export interface CharacterBoxGeometry {
  x: number;
  width: number;
  text: string;
  /** حدود الحروف من الحافة اليمنى، إن قِيست في محرك التخطيط. */
  characterOffsets?: number[];
}

/**
 * حدود حرف واحد داخل صندوق كلمة RTL: حافته اليمنى وعرضه.
 *
 * تعتمد الحدود المقيسة (`characterOffsets`) إن وُجدت، وإلا قسمت الكلمة
 * بالتساوي. والفرق بينهما هو الفرق بين وصلة تقع على الحرف ووصلة تقع بجواره:
 * حروف العربية شديدة التفاوت في العرض، فالقسمة المتساوية تخطئ دائما في
 * الكلمات المختلطة مثل «ٱلرَّحِيمُ».
 */
export function characterCellBounds(
  box: CharacterBoxGeometry,
  characterIndex: number
): { rightX: number; leftX: number; width: number; centerX: number } {
  const count = Math.max(characterCount(box.text), 1);
  const index = Math.min(Math.max(characterIndex, 1), count);
  const offsets = box.characterOffsets;

  if (offsets && offsets.length === count + 1) {
    const rightX = box.x + box.width - offsets[index - 1];
    const leftX = box.x + box.width - offsets[index];
    return { rightX, leftX, width: rightX - leftX, centerX: (rightX + leftX) / 2 };
  }

  const cell = box.width / count;
  const rightX = box.x + box.width - (index - 1) * cell;
  const leftX = rightX - cell;
  return { rightX, leftX, width: cell, centerX: (rightX + leftX) / 2 };
}

/**
 * إحداثي مركز نطاق حروف داخل صندوق كلمة RTL.
 *
 * النص نفسه يبقى مرسوما ككلمة واحدة حتى لا تنكسر الوصلات العربية؛ أما هذا
 * الحساب فيستعمل لخلايا النقر ولتثبيت وصلة التشجير على الحرف المقصود.
 */
export function characterRangeCenterX(
  box: CharacterBoxGeometry,
  start: number,
  end = start
): number {
  const count = Math.max(characterCount(box.text), 1);
  const safeStart = Math.min(Math.max(start, 1), count);
  const safeEnd = Math.min(Math.max(end, safeStart), count);

  // لأن الكلمة RTL: الحرف الأول عند الطرف الأيمن، والنطاق يمتد يسارا.
  const rightX = characterCellBounds(box, safeStart).rightX;
  const leftX = characterCellBounds(box, safeEnd).leftX;
  return (rightX + leftX) / 2;
}

/** طرفا نطاق حروف داخل صندوق كلمة: يمينه ويساره بعد القياس. */
export function characterRangeBounds(
  box: CharacterBoxGeometry,
  start: number,
  end = start
): { rightX: number; leftX: number } {
  const count = Math.max(characterCount(box.text), 1);
  const safeStart = Math.min(Math.max(start, 1), count);
  const safeEnd = Math.min(Math.max(end, safeStart), count);
  return {
    rightX: characterCellBounds(box, safeStart).rightX,
    leftX: characterCellBounds(box, safeEnd).leftX,
  };
}

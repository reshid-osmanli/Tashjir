// علامات ارتباط الأسطر بالكلمات - Line Marks
//
// حساب نقاط ارتباط أسطر التشجير بكلمات الآية أو بحروف داخلها. كان هذا
// المنطق حبيس محرك التشجير الكلاسيكي، ثم احتاجته الروابط اليدوية (دمج
// الأسطر وربط الأجزاء) فأُخرج إلى وحدة مستقلة يقرأ منها المحركان.
//
// العلامة (ClassicMark) هي نقطة الارتباط التي يرسم منها المحرك الوصلة
// الرأسية من الكلمة/الحرف إلى سطر القراءة تحتها.

import type { CharacterRange, Variant } from '@/types/tashjeer';
import type { AyahLayout } from '@/types/tashjeer';
import { characterBoundsForWord, characterRangeCenterX } from '@/lib/quran-logic/characters';
import { lociOfVariant } from './loci';
import type { ClassicMark } from './classic-tashjeer';

/** علامات مواضع الاختلاف على كلماته أو حروفه، بلا تكرار. */
export function marksForVariant(variant: Variant, layout: AyahLayout): ClassicMark[] {
  const marks: ClassicMark[] = [];
  for (const locus of lociOfVariant(variant)) {
    marks.push(
      ...marksForWordRange(
        locus.startPosition,
        locus.endPosition,
        layout,
        locus.characterRange
      )
    );
  }

  const seen = new Set<string>();
  return marks.filter((mark) => {
    const key = `${mark.position}:${mark.characterStart ?? ''}:${mark.characterEnd ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** علامات مدى كلمات متصل، مع دقة الحروف إن حُدد مدى حرفي. */
export function marksForWordRange(
  startPosition: number,
  endPosition: number,
  layout: AyahLayout,
  characterRange?: CharacterRange
): ClassicMark[] {
  const marks: ClassicMark[] = [];
  for (let position = startPosition; position <= endPosition; position++) {
    const box = layout.boxByPosition.get(position);
    if (!box) continue;
    const bounds = characterBoundsForWord(characterRange, position, box.text);
    marks.push({
      wordId: box.wordId,
      position,
      x: bounds ? characterRangeCenterX(box, bounds.start, bounds.end) : box.centerX,
      characterStart: bounds?.start,
      characterEnd: bounds?.end,
      topY: box.topY,
      bottomY: box.bottomY,
      baselineY: box.baselineY,
    });
  }
  return marks;
}

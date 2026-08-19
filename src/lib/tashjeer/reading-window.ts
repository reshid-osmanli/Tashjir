// نافذة العمل في المحرر - Reading Window
//
// المحرر كان محبوسا في آية واحدة، والوقف والابتداء لا يقفان عند حدود الآية:
//
//   • قد يصل القارئ آخر آية بأول التي بعدها، فيكون الحكم واقعا بين آيتين
//     (مد منفصل، إدغام، سكت...)، ولا يمكن تشجيره في آية واحدة.
//   • وقد يقف المحقق في وسط الآية، فيريد تشجير المقطع المحدد وحده.
//
// «نافذة العمل» هي مدى الكلمات الذي يعمل عليه المحرر الآن: آية واحدة، أو
// آيتان موصولتان. المواضع فيها متسلسلة تسلسلا واحدا (١، ٢، ٣...) حتى يبقى
// كل ما بُني على `position` صحيحا بلا استثناء: التخطيط، والوصلات، والوقف.

import {
  getAyahByKey,
  getAyahWordsByKey,
  makeAyahKey,
  parseAyahKey,
  getSurah,
  type MushafWord,
} from '@/data/quran';

/** كلمة في نافذة العمل: تحمل موضعها في النافذة وأصلها في آيتها. */
export interface WindowWord extends MushafWord {
  /** ترتيب الكلمة داخل آيتها الأصلية (1-based). */
  ayahPosition: number;
  /** رقم الآية داخل السورة. */
  ayahNumber: number;
}

export interface ReadingWindow {
  /** الآية الأساسية (صاحبة المستند). */
  ayahKey: number;
  /** الآيات المشمولة بالترتيب. */
  ayahKeys: number[];
  /** كل الكلمات بمواضع متسلسلة عبر الآيتين. */
  words: WindowWord[];
  /** موضع آخر كلمة في الآية الأولى؛ عنده يقع حد الآيتين. */
  firstAyahEndPosition: number;
  /** هل ضُمّت الآية التالية فعلا؟ (تكون false في آخر السورة). */
  isLinked: boolean;
}

/** معرّف الآية التالية داخل السورة نفسها، أو null عند آخرها. */
export function nextAyahKeyInSurah(ayahKey: number): number | null {
  const { surahNumber, ayahNumber } = parseAyahKey(ayahKey);
  const surah = getSurah(surahNumber);
  if (!surah || ayahNumber >= surah.ayahsCount) return null;
  return makeAyahKey(surahNumber, ayahNumber + 1);
}

/**
 * يبني نافذة العمل.
 *
 * @param linkNextAyah وصل الآية بالتي بعدها في نافذة واحدة.
 */
export function buildReadingWindow(ayahKey: number, linkNextAyah = false): ReadingWindow {
  const baseWords = getAyahWordsByKey(ayahKey);
  const { ayahNumber } = parseAyahKey(ayahKey);

  const words: WindowWord[] = baseWords.map((word) => ({
    ...word,
    ayahPosition: word.position,
    ayahNumber,
  }));

  const nextKey = linkNextAyah ? nextAyahKeyInSurah(ayahKey) : null;
  const nextAyah = nextKey ? getAyahByKey(nextKey) : undefined;

  if (!nextKey || !nextAyah) {
    return {
      ayahKey,
      ayahKeys: [ayahKey],
      words,
      firstAyahEndPosition: words.length,
      isLinked: false,
    };
  }

  const offset = words.length;
  for (const word of getAyahWordsByKey(nextKey)) {
    words.push({
      ...word,
      // الموضع في النافذة يتسلسل عبر الآيتين، والمعرّف يبقى معرّف الكلمة
      // الأصلي فلا يلتبس على التخزين ولا على التصدير.
      position: offset + word.position,
      ayahPosition: word.position,
      ayahNumber: nextAyah.ayahNumber,
    });
  }

  return {
    ayahKey,
    ayahKeys: [ayahKey, nextKey],
    words,
    firstAyahEndPosition: offset,
    isLinked: true,
  };
}

/** نافذة العمل المستنتجة من إعدادات المستند مباشرة. */
export function documentReadingWindow(
  document: { ayahKey: number; readingWindow?: { linkNextAyah?: boolean } } | null | undefined
): ReadingWindow {
  if (!document) {
    return { ayahKey: 0, ayahKeys: [], words: [], firstAyahEndPosition: 0, isLinked: false };
  }
  return buildReadingWindow(document.ayahKey, document.readingWindow?.linkNextAyah === true);
}

/** كلمات نافذة العمل للمستند: الآية وحدها أو الآيتان الموصولتان. */
export function documentWindowWords(
  document: { ayahKey: number; readingWindow?: { linkNextAyah?: boolean } } | null | undefined
): WindowWord[] {
  return documentReadingWindow(document).words;
}

/** وصف الموضع للمحقق: «٢:٣٧ · الكلمة ٤» حتى مع وصل الآيتين. */
export function describeWindowPosition(window: ReadingWindow, position: number): string {
  const word = window.words.find((item) => item.position === position);
  if (!word) return `الكلمة ${position}`;
  const { surahNumber } = parseAyahKey(word.ayahKey);
  return `${surahNumber}:${word.ayahNumber} · الكلمة ${word.ayahPosition}`;
}

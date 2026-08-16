// المعايير النحوية والصرفية - Arabic Grammar & Morphology Criteria
//
// منهج هذا الملف صارم عمدا: لا يُدرج فيه إلا ما يمكن الجزم به من الرسم
// العثماني وضبطه، أو من قائمة أدوات مغلقة معدودة.
//
// لماذا هذا القيد؟ لأن الإعراب في العربية محتمِل كثيرا: «الكتابَ» مفعول به
// في سياق وفاعل لفعل محذوف في سياق آخر، والتمييز بينهما يحتاج تحليلا لا
// يجوز لمحرك أن يخمّنه في المصحف. أما تاء التأنيث المربوطة، وألف التأنيث
// المقصورة، وحرف الجر «مِن» قبل الكلمة، فكلها علامات ظاهرة لا احتمال فيها.
// فالمحصلة: قواعد أقل ادعاءً، ونتائج يثق بها المحقق ولا يراجعها حرفا حرفا.

import { splitQuranCharacters, type QuranCharacter } from './characters';
import type {
  MorphologyFeature,
  ParticleClass,
  WordEndingHaraka,
} from '@/types/tashjeer';

// ==================== علامات الضبط ====================

const FATHA = '\u064E';
const DAMMA = '\u064F';
const KASRA = '\u0650';
const SHADDA = '\u0651';
const SUKUN = '\u0652';
const TANWEEN_FATH = '\u064B';
const TANWEEN_DAMM = '\u064C';
const TANWEEN_KASR = '\u064D';
const SUPERSCRIPT_ALIF = '\u0670';

const TANWEEN_MARKS = [TANWEEN_FATH, TANWEEN_DAMM, TANWEEN_KASR];
const HAMZA_FORMS = ['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ'];
const MADD_LETTERS = ['ا', 'و', 'ي', 'ى', 'آ'];

// ==================== الأدوات النحوية ====================
//
// قوائم مغلقة مأخوذة من كتب النحو المتداولة. كل أداة تُطابق بعد تجريد
// الضبط، لأن ضبط الأداة قد يختلف بالوصل والوقف ولا يغيّر هويتها.

export const PARTICLE_CLASS_LABELS: Record<ParticleClass, string> = {
  JARR: 'حرف جر',
  NASB: 'ناصب للمضارع',
  JAZM: 'جازم للمضارع',
  INNA: 'إنّ وأخواتها',
  KANA: 'كان وأخواتها',
  NIDA: 'أداة نداء',
  ISTIFHAM: 'أداة استفهام',
  SHART: 'أداة شرط',
  ATF: 'حرف عطف',
  NAFY: 'أداة نفي',
  MAWSUL: 'اسم موصول',
};

export const PARTICLES: Record<ParticleClass, string[]> = {
  JARR: ['من', 'الى', 'عن', 'على', 'في', 'الا', 'الي', 'ب', 'ل', 'ك', 'حتى', 'منذ', 'مذ', 'رب', 'واو', 'تالله', 'بالله', 'لله'],
  NASB: ['ان', 'لن', 'كي', 'لكي', 'اذن', 'حتى'],
  JAZM: ['لم', 'لما', 'لا', 'ل', 'ان', 'من', 'ما', 'مهما', 'متى', 'اين', 'اينما', 'حيثما', 'اذما', 'اي', 'كيفما', 'انى'],
  INNA: ['ان', 'انا', 'انك', 'انه', 'انهم', 'انها', 'انكم', 'كان', 'لكن', 'ليت', 'لعل', 'كأن', 'انما'],
  KANA: ['كان', 'كانت', 'كانوا', 'اصبح', 'امسى', 'اضحى', 'ظل', 'بات', 'صار', 'ليس', 'ليست', 'مازال', 'زال', 'يكون', 'تكون', 'نكون', 'كنتم', 'كنا', 'كنت'],
  NIDA: ['يا', 'ايها', 'ياايها', 'اي'],
  ISTIFHAM: ['هل', 'ا', 'ما', 'من', 'متى', 'اين', 'كيف', 'كم', 'اي', 'انى', 'اذا', 'ايان', 'اما'],
  SHART: ['ان', 'اذا', 'لو', 'لولا', 'لوما', 'من', 'ما', 'مهما', 'متى', 'اينما', 'حيثما', 'كيفما', 'اي', 'اما', 'ولو', 'فان'],
  ATF: ['و', 'ف', 'ثم', 'او', 'ام', 'بل', 'لا', 'لكن', 'حتى'],
  NAFY: ['لا', 'ما', 'لم', 'لن', 'ليس', 'ليست', 'غير', 'ان', 'لات'],
  MAWSUL: ['الذي', 'التي', 'الذين', 'اللاتي', 'اللائي', 'اللذان', 'اللتان', 'ما', 'من', 'الاولى'],
};

/** أدوات تلتصق بالكلمة رسما، فتُفحص بادئةً لا كلمة مستقلة. */
const ATTACHED_PARTICLES: Partial<Record<ParticleClass, string[]>> = {
  JARR: ['ب', 'ل', 'ك'],
  ATF: ['و', 'ف'],
  NIDA: ['يا'],
};

// ==================== الخصائص الصرفية ====================

export const MORPHOLOGY_FEATURE_LABELS: Record<MorphologyFeature, string> = {
  TAA_MARBUTA: 'تاء التأنيث المربوطة (ـة)',
  TAA_MAFTUHA: 'تاء مبسوطة في الآخر (ـت)',
  ALIF_MAQSURA: 'ألف مقصورة (ـى)',
  ALIF_MAMDUDA: 'ألف ممدودة (ـاء)',
  NISBA_YAA: 'ياء النسب المشددة (ـيّ)',
  DUAL_SUFFIX: 'علامة التثنية (ـان / ـين)',
  SOUND_MASCULINE_PLURAL: 'جمع مذكر سالم (ـون / ـين)',
  SOUND_FEMININE_PLURAL: 'جمع مؤنث سالم (ـات)',
  DEFINITE_AL: 'معرّف بأل',
  TANWEEN: 'منوّن',
  SHADDA: 'فيه حرف مشدد',
  HAMZA: 'فيه همزة',
  MADD_LETTER: 'فيه حرف مد',
};

export const MORPHOLOGY_FEATURE_HINTS: Record<MorphologyFeature, string> = {
  TAA_MARBUTA: 'مثل: رحمة، جنة، بقرة.',
  TAA_MAFTUHA: 'مثل: رحمت، نعمت، امرأت في الرسم العثماني.',
  ALIF_MAQSURA: 'مثل: الكبرى، هدى، موسى.',
  ALIF_MAMDUDA: 'مثل: السماء، الدعاء.',
  NISBA_YAA: 'مثل: النبيّ، الأميّ.',
  DUAL_SUFFIX: 'مثل: رجلان، اثنين.',
  SOUND_MASCULINE_PLURAL: 'مثل: المؤمنون، الصابرين.',
  SOUND_FEMININE_PLURAL: 'مثل: المؤمنات، الصالحات.',
  DEFINITE_AL: 'يبدأ بألف ولام التعريف.',
  TANWEEN: 'فيه تنوين ضم أو فتح أو كسر.',
  SHADDA: 'فيه شدّة على أي حرف.',
  HAMZA: 'همزة بأي صورة: ء أ إ ؤ ئ آ.',
  MADD_LETTER: 'فيه ألف أو واو أو ياء مد.',
};

export const WORD_ENDING_HARAKA_LABELS: Record<WordEndingHaraka, string> = {
  DAMMA: 'ضمة (ـُ)',
  FATHA: 'فتحة (ـَ)',
  KASRA: 'كسرة (ـِ)',
  SUKUN: 'سكون (ـْ)',
  TANWEEN_DAMM: 'تنوين ضم (ـٌ)',
  TANWEEN_FATH: 'تنوين فتح (ـً)',
  TANWEEN_KASR: 'تنوين كسر (ـٍ)',
};

// ==================== الفحص ====================

/** يجرّد الكلمة من الضبط والتطويل ويوحّد صور الهمزة، للمقارنة بالأدوات. */
export function stripDiacritics(text: string): string {
  return Array.from(text)
    .filter((codePoint) => !/^\p{Mark}$/u.test(codePoint) && codePoint !== '\u0640')
    .join('')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة$/g, 'ة')
    .trim();
}

/** هل الكلمة أداة من الفئة المطلوبة؟ */
export function isParticleOfClass(word: string, particleClass: ParticleClass): boolean {
  const bare = stripDiacritics(word);
  if (!bare) return false;
  if (PARTICLES[particleClass].includes(bare)) return true;

  // الأدوات الملتصقة: الباء واللام والكاف والواو والفاء تُرسم مع ما بعدها،
  // فوجودها بادئةً في الكلمة السابقة هو صورتها الحقيقية في المصحف.
  const attached = ATTACHED_PARTICLES[particleClass];
  if (!attached) return false;
  return attached.some((particle) => bare.length > particle.length && bare.startsWith(particle));
}

/** فئات الأدوات التي تنطبق على كلمة. */
export function particleClassesOf(word: string): ParticleClass[] {
  return (Object.keys(PARTICLES) as ParticleClass[]).filter((particleClass) =>
    isParticleOfClass(word, particleClass)
  );
}

/** حركة آخر حرف منطوق في الكلمة، أو undefined إن لم تُضبط. */
export function endingHarakaOf(word: string): WordEndingHaraka | undefined {
  const characters = splitQuranCharacters(word);
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const marks = marksOf(characters[index]);
    if (marks.includes(TANWEEN_DAMM)) return 'TANWEEN_DAMM';
    if (marks.includes(TANWEEN_FATH)) return 'TANWEEN_FATH';
    if (marks.includes(TANWEEN_KASR)) return 'TANWEEN_KASR';
    if (marks.includes(DAMMA)) return 'DAMMA';
    if (marks.includes(FATHA)) return 'FATHA';
    if (marks.includes(KASRA)) return 'KASRA';
    if (marks.includes(SUKUN)) return 'SUKUN';
    // حرف المد الأخير بلا ضبط تابع لما قبله، فنواصل البحث إلى الحرف السابق.
    if (!isBareMaddLetter(characters[index])) return undefined;
  }
  return undefined;
}

/**
 * هل تتوافر الخاصية الصرفية في الكلمة؟
 *
 * كل فحص هنا يعتمد على حرف ظاهر أو علامة ضبط ظاهرة، لا على تحليل جذر
 * ولا على معجم.
 */
export function hasMorphologyFeature(word: string, feature: MorphologyFeature): boolean {
  const characters = splitQuranCharacters(word);
  if (characters.length === 0) return false;

  const bare = stripDiacritics(word);
  const letters = characters.map((character) => baseLetter(character));
  const marks = characters.map((character) => marksOf(character));
  const lastLetter = letters[letters.length - 1] ?? '';
  const lastMarks = marks[marks.length - 1] ?? '';

  switch (feature) {
    case 'TAA_MARBUTA':
      // التاء المربوطة لا تكون إلا آخرا، وقد تتبعها علامات ضبط أو وقف.
      return lastLetter === 'ة' || lastLetter === 'ۃ';

    case 'TAA_MAFTUHA':
      // «رحمت» و«نعمت» مرسومة بالتاء المبسوطة في الرسم العثماني، وهي تاء
      // تأنيث حقيقية لا لام كلمة، فنشترط ألا تكون الكلمة من حرفين فقط.
      return lastLetter === 'ت' && bare.length > 2;

    case 'ALIF_MAQSURA':
      return lastLetter === 'ى' || (lastLetter === 'ا' && lastMarks.includes(SUPERSCRIPT_ALIF));

    case 'ALIF_MAMDUDA':
      return bare.endsWith('اء') || bare.endsWith('آء');

    case 'NISBA_YAA':
      return lastLetter === 'ي' && lastMarks.includes(SHADDA);

    case 'DUAL_SUFFIX':
      // ـان / ـين مع فتح ما قبل النون؛ وهي علامة التثنية الظاهرة.
      return endsWithSuffix(letters, ['ا', 'ن']) || endsWithSuffix(letters, ['ي', 'ن']);

    case 'SOUND_MASCULINE_PLURAL':
      return endsWithSuffix(letters, ['و', 'ن']) || endsWithSuffix(letters, ['ي', 'ن']);

    case 'SOUND_FEMININE_PLURAL':
      return endsWithSuffix(letters, ['ا', 'ت']) && bare.length > 3;

    case 'DEFINITE_AL':
      return /^ا?ل./.test(bare) && (bare.startsWith('ال') || bare.startsWith('ٱل'));

    case 'TANWEEN':
      return marks.some((mark) => TANWEEN_MARKS.some((tanween) => mark.includes(tanween)));

    case 'SHADDA':
      return marks.some((mark) => mark.includes(SHADDA));

    case 'HAMZA':
      return letters.some((letter) => HAMZA_FORMS.includes(letter));

    case 'MADD_LETTER':
      return letters.some((letter) => MADD_LETTERS.includes(letter));

    default:
      return false;
  }
}

/** كل الخصائص الصرفية المتوافرة في كلمة؛ للعرض والشرح في الواجهة. */
export function morphologyFeaturesOf(word: string): MorphologyFeature[] {
  return (Object.keys(MORPHOLOGY_FEATURE_LABELS) as MorphologyFeature[]).filter((feature) =>
    hasMorphologyFeature(word, feature)
  );
}

// ==================== أدوات داخلية ====================

function endsWithSuffix(letters: string[], suffix: string[]): boolean {
  if (letters.length < suffix.length + 1) return false;
  const tail = letters.slice(letters.length - suffix.length);
  return tail.every((letter, index) => letter === suffix[index]);
}

function isBareMaddLetter(character: QuranCharacter): boolean {
  return MADD_LETTERS.includes(baseLetter(character)) && marksOf(character).length === 0;
}

function baseLetter(character: QuranCharacter): string {
  return Array.from(character.text)[0] ?? '';
}

function marksOf(character: QuranCharacter): string {
  return Array.from(character.text).slice(1).join('');
}

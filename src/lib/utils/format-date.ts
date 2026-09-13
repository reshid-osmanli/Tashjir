// تنسيق الوقت بالعربية — Arabic Date Formatting
// مشروع التشجير - نظام القراءات العشر
//
// الطوابع الزمنية في سجل التدقيق وسلاسل الإصدارات تُقرأ بالعربية وبأرقام
// عربية (NFR-07). بعض القيم في هذا المشروع ليست ISO أصلًا بل علامة ثابتة
// («system» لقواعد النظام، «matrix» لصفوف المصفوفة)، فتُعرض كما هي بدل
// «تاريخ غير صالح».

/** أسماء عربية مختصرة لمصادر الإصدار غير الزمنية. */
const NON_DATE_LABELS: Record<string, string> = {
  system: 'سياسة النظام',
  matrix: 'مصفوفة الدمج',
  '': '—',
};

const dateTimeFormat = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeStyle: 'short',
  numberingSystem: 'arab',
});

const dateFormat = new Intl.DateTimeFormat('ar', { dateStyle: 'medium', numberingSystem: 'arab' });

/** «٥ مايو ٢٠٢٦، ٢:٣٠ م» — أو التسمية الثابتة للقيم غير الزمنية. */
export function formatWhen(value: string | undefined | null): string {
  if (!value) return '—';
  if (NON_DATE_LABELS[value]) return NON_DATE_LABELS[value];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormat.format(date);
}

/** التاريخ وحده (لأعمدة السجل وتصفية اليوم). */
export function formatDay(value: string | undefined | null): string {
  if (!value) return '—';
  if (NON_DATE_LABELS[value]) return NON_DATE_LABELS[value];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormat.format(date);
}

/**
 * زمن نسبي مختصر للقوائم («قبل ٣ دقائق») — بالأرقام العربية. يُستعمل حيث
 * المساحة ضيقة، والتاريخ الكامل يبقى في `title`.
 */
export function formatRelative(value: string | undefined | null, now: number = Date.now()): string {
  if (!value) return '—';
  if (NON_DATE_LABELS[value]) return NON_DATE_LABELS[value];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (seconds < minute) return seconds <= 1 ? 'الآن' : `قبل ${toArabic(seconds)} ثانية`;
  if (seconds < hour) return `قبل ${toArabic(Math.floor(seconds / minute))} دقيقة`;
  if (seconds < day) return `قبل ${toArabic(Math.floor(seconds / hour))} ساعة`;
  if (seconds < week) return `قبل ${toArabic(Math.floor(seconds / day))} يوم`;
  return `قبل ${toArabic(Math.floor(seconds / week))} أسبوع`;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** رقم بالأرقام العربية (مرجع محلي صغير حتى لا تُستورد وحدة الأرقام كلها). */
function toArabic(value: number): string {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

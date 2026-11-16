// مولّد بيانات المصحف - Quran Data Generator
// مشروع التشجير - نظام القراءات العشر
//
// الهدف:
//   توليد ملف بيانات محلي مضغوط للمصحف كاملا (114 سورة / 6236 آية)
//   من مجموعة البيانات الرسمية **لمجمع الملك فهد لطباعة المصحف الشريف**
//   بالمدينة المنورة — رواية حفص عن عاصم، الرسم العثماني، الإصدار 3.0.
//
//   الملف المصدر (kfgqpc_hafs_v30.json) موزَّع من الموقع الرسمي:
//     https://qurancomplex.gov.sa/
//     https://fonts.qurancomplex.gov.sa/
//   وحُفظ حرفيًا في src/data/quran/sources/kfgqpc_hafs_v30.json.
//
// طريقة التشغيل:
//   npm run data:quran
//
// المخرجات:
//   src/data/quran/mushaf.json
//
// بنية الملف الناتجة (مختصرة عمدا لتقليل الحجم):
//   {
//     "version": 3,
//     "source": "King Fahd Glorious Quran Printing Complex (KFGQPC) — Hafs 'an 'Asim, Madinah Mushaf, KFGQPC HAFS Uthmanic Script v3.0",
//     "sourceUrl": "https://qurancomplex.gov.sa/",
//     "script": "uthmani",
//     "scriptFont": "KFGQPC HAFS Uthmanic Script (Mushaf Al-Madinah)",
//     "qiraah": "hafs",
//     "narrator": "hafs-an-asim",
//     "edition": "KFGQPC Hafs v3.0 — Madinah Mushaf",
//     "surahs": [
//       { "i": 1, "n": "الفاتحة", "t": "Al-Fatihah", "r": "MECCAN", "v": ["...", "..."] }
//     ]
//   }
//
// ملاحظات:
//   - لا نخزن الكلمات مفردة في الملف، بل نشتقها وقت التشغيل عبر src/data/quran/index.ts
//     لأن تقسيم الكلمات حتمي (deterministic) ومعرّف الكلمة يُحسب بصيغة ثابتة.
//   - نص الآيات يُحفظ حرفيًا كما ورد من المجمع بعد إزالة علامة نهاية الآية (۝ + رقم)
//     لأن التطبيق يُرقِّم الآيات في طبقته الخاصة.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const SOURCE_FILE = resolve(projectRoot, 'src/data/quran/sources/kfgqpc_hafs_v30.json');
const OUTPUT_FILE = resolve(projectRoot, 'src/data/quran/mushaf.json');

function main() {
  const raw = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));

  if (!Array.isArray(raw) || raw.length !== 6236) {
    throw new Error(`ملف المصدر غير صالح: يجب أن يحتوي على 6236 آية (وجد ${Array.isArray(raw) ? raw.length : 'غير مصفوفة'}).`);
  }

  // تجميع الآيات حسب السورة مع حفظ أسماء السور ونوع النزول من البيانات نفسها
  /** @type {Map<number, {name_ar:string, name_en:string, type:'MECCAN'|'MEDINAN', verses:string[]}>} */
  const surahMap = new Map();
  for (const row of raw) {
    const sNo = row.sura_no;
    if (!surahMap.has(sNo)) {
      surahMap.set(sNo, {
        name_ar: normalizeSurahName(row.sura_name_ar),
        name_en: row.sura_name_en,
        type: resolveRevelationType(sNo),
        verses: [],
      });
    }
    const entry = surahMap.get(sNo);
    entry.verses.push(stripAyahEndMarker(row.aya_text_unicode));
  }

  if (surahMap.size !== 114) {
    throw new Error(`عدد السور غير مطابق: ${surahMap.size} بدل 114.`);
  }

  const surahs = [...surahMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([i, s]) => ({ i, n: s.name_ar, t: s.name_en, r: s.type, v: s.verses.map(normalizeAyahText) }));

  const totalAyahs = surahs.reduce((total, surah) => total + surah.v.length, 0);
  const totalWords = surahs.reduce(
    (total, surah) => total + surah.v.reduce((sum, text) => sum + text.split(' ').length, 0),
    0
  );

  if (totalAyahs !== 6236) {
    throw new Error(`عدد الآيات غير مطابق: ${totalAyahs} بدل 6236.`);
  }

  const payload = {
    version: 3,
    source: 'King Fahd Glorious Quran Printing Complex (KFGQPC), Al-Madinah Al-Munawwarah — Hafs \'an \'Asim, KFGQPC HAFS Uthmanic Script (Mushaf Al-Madinah, edition v3.0). Text from official KFGQPC Hafs v3.0 dataset (src/kfgqpc_hafs_v30.json) distributed via qurancomplex.gov.sa; font KFGQPC-Hafs-V30.ttf.',
    sourceUrl: 'https://qurancomplex.gov.sa/',
    script: 'uthmani',
    scriptFont: 'KFGQPC HAFS Uthmanic Script (Mushaf Al-Madinah)',
    qiraah: 'hafs',
    narrator: 'hafs-an-asim',
    edition: 'KFGQPC Hafs v3.0 — Madinah Mushaf',
    totalSurahs: surahs.length,
    totalAyahs,
    totalWords,
    surahs,
  };

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(payload), 'utf8');

  console.log('تم توليد بيانات المصحف من مصدر مجمع الملك فهد:');
  console.log(`  الملف : ${OUTPUT_FILE}`);
  console.log(`  السور : ${surahs.length}`);
  console.log(`  الآيات: ${totalAyahs}`);
  console.log(`  الكلمات: ${totalWords}`);
}

/**
 * إزالة علامة نهاية الآية (۝ + رقم الآية) التي يضيفها المجمع في نهاية نص الآية.
 * قد تسبقها مسافة عادية أو مسافة غير فاصلة. التطبيق يُظهر أرقام الآيات في
 * طبقته الخاصة، فلا داعي لتضمينها في النص.
 *
 * ملاحظة: \d في JavaScript لا يطابق الأرقام العربية-الهندية (٠-٩ = U+0660..U+0669)،
 * لذلك نذكرها صراحة بجانب [0-9].
 */
function stripAyahEndMarker(text) {
  return String(text).replace(/[\s\u00A0]*۝[0-9\u0660-\u0669]+\s*$/u, '').trim();
}

/**
 * تنظيف نص الآية:
 * - توحيد المسافات (بما فيها المسافة العربية غير الفاصلة وعلامات الاتجاه).
 * - إزالة المسافات الطرفية.
 * - عدم المساس بأي حرف أو حركة داخل النص العثماني.
 */
function normalizeAyahText(text) {
  return String(text)
    .replace(/\u00A0|\u200F|\u200E/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * تطبيع اسم السورة:
 * مصدر KFGQPC يأتي بأسماء السور مشكّلة ومجرورة (مثلا "الفَاتِحَةِ"، "البَقَرَةِ")؛
 * نزيل التشكيل كله لنستعمل الاسم المتداول بلا حركات في عناوين الواجهة
 * (النص العثماني للآيات لا يتأثر بهذا).
 */
function normalizeSurahName(name) {
  return String(name)
    .trim()
    // حذف الحركات والتشكيل (فتحة، ضمة، كسرة، سكون، شدة، مدّة، تنوين).
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '');
}

/**
 * تحديد مكان النزول (مكي/مدني) حسب الترتيب القياسي.
 * نستخدم جدولا ثابتا ضمانًا للتطابق مع المصحف، لأن ملف KFGQPC لا يتضمن نوع السورة.
 * السور المدنية في الترتيب المعروف لدى علماء الرسم العثماني:
 */
const MEDINAN_SURAHS = new Set([
  2, 3, 4, 5, 8, 9, 22, 24, 33, 47, 48, 49, 57, 58, 59, 60, 61, 62, 63, 64, 65,
  66, 76, 98, 99, 110,
]);
function resolveRevelationType(suraNo) {
  return MEDINAN_SURAHS.has(suraNo) ? 'MEDINAN' : 'MECCAN';
}

main();

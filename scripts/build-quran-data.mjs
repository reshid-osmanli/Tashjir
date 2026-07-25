// مولّد بيانات المصحف - Quran Data Generator
// مشروع التشجير - نظام القراءات العشر
//
// الهدف:
//   توليد ملف بيانات محلي مضغوط للمصحف كاملا (114 سورة / 6236 آية)
//   انطلاقا من حزمة quran-json (نص عثماني، رخصة CC-BY-4.0).
//
// طريقة التشغيل:
//   npm run data:quran
//
// المخرجات:
//   src/data/quran/mushaf.json
//
// بنية الملف الناتجة (مختصرة عمدا لتقليل الحجم):
//   {
//     "version": 1,
//     "source": "quran-json@3.1.2 (CC-BY-4.0)",
//     "script": "uthmani",
//     "surahs": [
//       { "i": 1, "n": "الفاتحة", "t": "Al-Fatihah", "r": "MECCAN", "v": ["...", "..."] }
//     ]
//   }
//
// ملاحظات:
//   - لا نخزن الكلمات مفردة في الملف، بل نشتقها وقت التشغيل عبر src/data/quran/index.ts
//     لأن تقسيم الكلمات حتمي (deterministic) ومعرّف الكلمة يُحسب بصيغة ثابتة.
//   - أرقام الصفحات غير موجودة في المصدر، لذلك تُحسب تقريبيا في طبقة التحميل
//     ويجب استبدالها لاحقا بجدول صفحات مصحف المدينة عند توفره.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const SOURCE_FILE = resolve(projectRoot, 'node_modules/quran-json/dist/quran.json');
const OUTPUT_FILE = resolve(projectRoot, 'src/data/quran/mushaf.json');

function main() {
  const raw = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));

  if (!Array.isArray(raw) || raw.length !== 114) {
    throw new Error('ملف المصدر غير صالح: يجب أن يحتوي على 114 سورة.');
  }

  const surahs = raw.map((surah) => ({
    i: surah.id,
    n: surah.name,
    t: surah.transliteration,
    r: surah.type === 'meccan' ? 'MECCAN' : 'MEDINAN',
    v: surah.verses.map((verse) => normalizeAyahText(verse.text)),
  }));

  const totalAyahs = surahs.reduce((total, surah) => total + surah.v.length, 0);
  const totalWords = surahs.reduce(
    (total, surah) => total + surah.v.reduce((sum, text) => sum + text.split(' ').length, 0),
    0
  );

  if (totalAyahs !== 6236) {
    throw new Error(`عدد الآيات غير مطابق: ${totalAyahs} بدل 6236.`);
  }

  const payload = {
    version: 1,
    source: 'quran-json@3.1.2 (CC-BY-4.0)',
    script: 'uthmani',
    totalSurahs: surahs.length,
    totalAyahs,
    totalWords,
    surahs,
  };

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(payload), 'utf8');

  console.log('تم توليد بيانات المصحف:');
  console.log(`  الملف : ${OUTPUT_FILE}`);
  console.log(`  السور : ${surahs.length}`);
  console.log(`  الآيات: ${totalAyahs}`);
  console.log(`  الكلمات: ${totalWords}`);
}

/**
 * تنظيف نص الآية:
 * - توحيد المسافات (بما فيها المسافة العربية غير الفاصلة).
 * - إزالة المسافات الطرفية.
 * - عدم المساس بأي حرف أو حركة داخل النص العثماني.
 */
function normalizeAyahText(text) {
  return text
    .replace(/\u00A0|\u200F|\u200E/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

main();

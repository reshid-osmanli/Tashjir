// صفحة المصحف - Quran Page
// مشروع التشجير - نظام القراءات العشر
//
// عرض المصحف كاملا (114 سورة / 6236 آية) بالنص العثماني.
//
// بعد تطوير مرحلة «المحرر يصحّح المحرك»: كل آية لها عمل محفوظ يظهر تشجيرها
// النهائي مباشرة هنا — نفس خط الرسم الذي يستعمله المحرر (الروابط اليدوية،
// الأوجه المركبة، الأجزاء، الترتيب اليدوي كلها ظاهرة) — فلا حاجة لفتح
// المحرر لمجرد رؤية النتيجة:
//
//   المحرر → حفظ البيانات → /quran ⇒ نتائج متطابقة.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MUSHAF_SOURCE,
  SURAHS,
  TOTAL_AYAHS,
  getSurahAyahs,
  getSurahOrFirst,
  searchSurahs,
} from '@/data/quran';
import { exportAyahDocument, listDocuments } from '@/lib/storage/document-store';
import { surahAyahsWithTashjeer } from '@/lib/tashjeer/ayah-tashjeer-source';
import { listGlobalRules } from '@/lib/storage/global-rules-store';
import { AyahTashjeerView } from '@/components/quran/AyahTashjeerView';

export default function QuranPage() {
  const [surahNumber, setSurahNumber] = useState(1);
  const [query, setQuery] = useState('');
  const [savedKeys, setSavedKeys] = useState<Set<number>>(new Set());
  const [tashjeerKeys, setTashjeerKeys] = useState<Set<number>>(new Set());
  const [showTashjeer, setShowTashjeer] = useState(true);

  useEffect(() => {
    setSavedKeys(new Set(listDocuments().map((entry) => entry.ayahKey)));
    // يشمل المستندات المحفوظة ومواضع القواعد العامة النشطة في هذه السورة.
    setTashjeerKeys(surahAyahsWithTashjeer(surahNumber));
  }, [surahNumber]);

  const surah = getSurahOrFirst(surahNumber);
  const ayahs = useMemo(() => getSurahAyahs(surahNumber), [surahNumber]);
  const filteredSurahs = useMemo(() => searchSurahs(query), [query]);
  const savedInSurah = ayahs.filter((ayah) => savedKeys.has(ayah.key)).length;
  const tashjeerInSurah = ayahs.filter((ayah) => tashjeerKeys.has(ayah.key)).length;
  const globalRulesCount = listGlobalRules().filter((rule) => rule.isActive && rule.pattern).length;

  const exportAyahJson = (ayahKey: number, surah: number, ayah: number) => {
    const blob = new Blob([exportAyahDocument(ayahKey)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `tashjeer-${surah}-${ayah}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">المصحف</h1>
          <p className="mt-0.5 text-sm text-stone-600">
            النص العثماني كاملا — {SURAHS.length} سورة و{TOTAL_AYAHS.toLocaleString('ar')} آية
          </p>
        </div>
        <p className="text-[11px] text-stone-400">المصدر: {MUSHAF_SOURCE}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* فهرس السور */}
        <aside className="rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-200 p-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن سورة..."
              className="input"
              aria-label="بحث في أسماء السور"
            />
          </div>

          <ul className="max-h-[70vh] overflow-y-auto p-1">
            {filteredSurahs.map((item) => (
              <li key={item.number}>
                <button
                  type="button"
                  onClick={() => setSurahNumber(item.number)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-start transition-colors ${
                    item.number === surahNumber
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-[11px] tabular-nums text-stone-400">
                      {item.number}
                    </span>
                    <span className="text-sm">{item.name}</span>
                  </span>
                  <span className="text-[11px] text-stone-400">{item.ayahsCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* نص السورة */}
        <section className="rounded-xl border border-stone-200 bg-[#fdfaf2] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">سورة {surah.name}</h2>
              <p className="text-xs text-stone-500">
                {surah.revelationType === 'MECCAN' ? 'مكية' : 'مدنية'} · {surah.ayahsCount} آية ·
                تبدأ قرب الصفحة {surah.page}
                {tashjeerInSurah > 0
                  ? ` · آيات مشجَّرة: ${tashjeerInSurah.toLocaleString('ar')}${
                      savedInSurah > 0 ? ` (${savedInSurah.toLocaleString('ar')} محفوظة)` : ''
                    }`
                  : ''}
                {globalRulesCount > 0 ? ` · قواعد عامة نشطة: ${globalRulesCount.toLocaleString('ar')}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savedInSurah > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTashjeer((value) => !value)}
                  className={`rounded-md border px-3 py-1.5 text-[11px] transition-colors ${
                    showTashjeer
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                  title="عرض التشجير المحفوظ تحت الآيات مباشرة"
                >
                  {showTashjeer ? 'إخفاء التشجير' : 'إظهار التشجير'}
                </button>
              )}
              <span className="text-[11px] text-stone-400">{surah.transliteration}</span>
            </div>
          </div>

          <ol className="space-y-3">
            {ayahs.map((ayah) => {
              const isSaved = savedKeys.has(ayah.key);
              const hasTashjeer = tashjeerKeys.has(ayah.key);

              return (
                <li
                  key={ayah.key}
                  className="group rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-stone-200 hover:bg-white"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums ${
                        isSaved
                          ? 'bg-emerald-600 text-white'
                          : hasTashjeer
                            ? 'bg-violet-600 text-white'
                            : 'bg-stone-200 text-stone-600'
                      }`}
                      title={
                        isSaved
                          ? 'لهذه الآية تشجير محفوظ'
                          : hasTashjeer
                            ? 'تشجير مشتق من قاعدة عامة'
                            : undefined
                      }
                    >
                      {ayah.ayahNumber}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className="text-2xl leading-[2.4] text-stone-900"
                        style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                      >
                        {ayah.text}
                      </p>

                      {/* التشجير النهائي: المستند المحفوظ أو المشتق من القواعد العامة. */}
                      {hasTashjeer && showTashjeer && <AyahTashjeerView ayahKey={ayah.key} />}
                    </div>

                    <div className="mt-1.5 flex shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                      <Link
                        href={`/editor?ayah=${ayah.key}`}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] text-stone-600 hover:bg-stone-50"
                      >
                        تشجير
                      </Link>
                      <button
                        type="button"
                        onClick={() => exportAyahJson(ayah.key, ayah.surahNumber, ayah.ayahNumber)}
                        className="rounded-md border border-cyan-200 bg-white px-2 py-1 text-[11px] text-cyan-800 hover:bg-cyan-50"
                        title="تصدير ملف JSON لهذه الآية"
                      >
                        JSON
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}

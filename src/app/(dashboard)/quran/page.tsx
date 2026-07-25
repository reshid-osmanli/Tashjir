// صفحة المصحف - Quran Page
// مشروع التشجير - نظام القراءات العشر

'use client';

import { useMemo, useState } from 'react';
import { LOCAL_QURAN_SURAHS } from '@/data/quran';

export default function QuranPage() {
  const [selectedSurahNumber, setSelectedSurahNumber] = useState(1);

  const selectedIndex = useMemo(
    () => LOCAL_QURAN_SURAHS.findIndex((surah) => surah.number === selectedSurahNumber),
    [selectedSurahNumber]
  );

  const currentSurah = LOCAL_QURAN_SURAHS[selectedIndex] ?? LOCAL_QURAN_SURAHS[0];
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex < LOCAL_QURAN_SURAHS.length - 1;

  const goToSurah = (nextIndex: number) => {
    const nextSurah = LOCAL_QURAN_SURAHS[nextIndex];
    if (nextSurah) setSelectedSurahNumber(nextSurah.number);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المصحف</h1>
          <p className="text-gray-600">عرض محلي برواية حفص عن عاصم</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => goToSurah(selectedIndex - 1)}
            disabled={!canGoPrevious}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            السابقة
          </button>
          <span className="text-sm text-gray-600">
            الصفحة {currentSurah.page} من 604
          </span>
          <button
            onClick={() => goToSurah(selectedIndex + 1)}
            disabled={!canGoNext}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            التالية
          </button>
        </div>
      </div>

      <section className="bg-white rounded-xl shadow-lg p-8">
        <div className="mushaf-page min-h-[620px] border border-amber-200 bg-amber-50 px-8 py-10">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center min-w-48 rounded-full border border-amber-300 bg-white px-6 py-2">
              <span className="font-bold text-gray-900">
                سورة {currentSurah.name}
              </span>
            </div>
          </div>

          <div className="mx-auto max-w-4xl space-y-7 text-center font-amiri text-3xl leading-loose text-gray-900">
            {currentSurah.ayahs.map((ayah, index) => (
              <p key={`${currentSurah.number}-${index}`} className="mushaf-text">
                {ayah}
                <span className="ayah-number mx-3 align-middle">{index + 1}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">السور</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LOCAL_QURAN_SURAHS.map((surah) => (
            <button
              key={surah.number}
              onClick={() => setSelectedSurahNumber(surah.number)}
              className={`p-4 rounded-lg text-right transition-colors ${
                selectedSurahNumber === surah.number
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="text-sm opacity-80">سورة {surah.number}</div>
              <div className="text-lg font-bold">{surah.name}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

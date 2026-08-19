// مستعرض الآيات - Ayah Navigator
// مشروع التشجير - نظام القراءات العشر
//
// شريط التنقل بين السور والآيات. يعمل على المصحف كاملا (114 سورة / 6236 آية)
// ويوفّر:
//   - اختيار السورة والآية.
//   - التنقل بالسابق والتالي مع العبور بين السور تلقائيا.
//   - بحث نصي في المصحف كله مع تجاهل التشكيل.
//   - مؤشر يبيّن أي الآيات فيها عمل محفوظ.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SURAHS,
  getAyahCount,
  getSurahOrFirst,
  makeAyahKey,
  parseAyahKey,
  searchQuran,
  type QuranSearchHit,
} from '@/data/quran';
import { listDocuments } from '@/lib/storage/document-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

interface AyahNavigatorProps {
  ayahKey: number;
  onNavigate: (ayahKey: number) => void;
}

export function AyahNavigator({ ayahKey, onNavigate }: AyahNavigatorProps) {
  const { surahNumber, ayahNumber } = parseAyahKey(ayahKey);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<QuranSearchHit[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<number>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const surah = getSurahOrFirst(surahNumber);
  const ayahCount = getAyahCount(surahNumber);

  // فهرس المستندات المحفوظة يُقرأ بعد التركيب فقط (localStorage غير متاح في SSR).
  useEffect(() => {
    setSavedKeys(new Set(listDocuments().map((entry) => entry.ayahKey)));
  }, [ayahKey]);

  // بحث مؤجّل: لا نبحث في 6236 آية عند كل ضغطة مفتاح.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (query.trim().length < 2) {
      setHits([]);
      return;
    }

    searchTimer.current = setTimeout(() => setHits(searchQuran(query, 25)), 220);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const ayahOptions = useMemo(
    () => Array.from({ length: ayahCount }, (_, index) => index + 1),
    [ayahCount]
  );

  /** ينتقل خطوة للأمام أو للخلف، مع العبور بين السور. */
  const step = (delta: number) => {
    const next = ayahNumber + delta;

    if (next >= 1 && next <= ayahCount) {
      onNavigate(makeAyahKey(surahNumber, next));
      return;
    }

    if (next < 1 && surahNumber > 1) {
      const previousSurah = surahNumber - 1;
      onNavigate(makeAyahKey(previousSurah, getAyahCount(previousSurah)));
      return;
    }

    if (next > ayahCount && surahNumber < 114) {
      onNavigate(makeAyahKey(surahNumber + 1, 1));
    }
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2">
      <label className="flex items-center gap-1.5 text-xs text-stone-700">
        السورة
        <select
          value={surahNumber}
          onChange={(event) => onNavigate(makeAyahKey(Number(event.target.value), 1))}
          className="input h-8 w-48 text-xs"
        >
          {SURAHS.map((item) => (
            <option key={item.number} value={item.number}>
              {toArabicDigits(item.number)}. {item.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-stone-700">
        الآية
        <select
          value={ayahNumber}
          onChange={(event) => onNavigate(makeAyahKey(surahNumber, Number(event.target.value)))}
          className="input h-8 w-24 text-xs"
        >
          {ayahOptions.map((number) => (
            <option key={number} value={number}>
              {toArabicDigits(number)}
              {savedKeys.has(makeAyahKey(surahNumber, number)) ? ' ●' : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1">
        <NavButton onClick={() => step(-1)} disabled={surahNumber === 1 && ayahNumber === 1}>
          السابقة
        </NavButton>
        <NavButton
          onClick={() => step(1)}
          disabled={surahNumber === 114 && ayahNumber === ayahCount}
        >
          التالية
        </NavButton>
      </div>

      <span className="text-[11px] text-stone-500">
        {surah.name} · {surah.revelationType === 'MECCAN' ? 'مكية' : 'مدنية'} · {ayahCount} آية
      </span>

      {/* البحث */}
      <div className="relative ms-auto w-full max-w-xs">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث في المصحف كله..."
          className="input h-8 w-full text-xs"
          aria-label="بحث في نص المصحف"
        />

        {hits.length > 0 && (
          <ul className="absolute end-0 top-9 z-40 max-h-72 w-[26rem] overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-xl">
            {hits.map((hit) => (
              <li key={hit.ayahKey}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(hit.ayahKey);
                    setQuery('');
                    setHits([]);
                  }}
                  className="w-full rounded px-2 py-1.5 text-start hover:bg-stone-50"
                >
                  <span className="text-[11px] text-emerald-700">
                    {hit.surahName} {hit.ayahNumber}
                  </span>
                  <span
                    className="mt-0.5 block truncate text-sm text-stone-800"
                    style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                  >
                    {hit.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

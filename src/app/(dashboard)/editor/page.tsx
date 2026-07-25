'use client';

import { useEffect, useMemo, useState } from 'react';
import { TashjeerCanvas } from '@/components/editor/TashjeerCanvas';
import { Toolbar } from '@/components/editor/Toolbar';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { LOCAL_QURAN_SURAHS } from '@/data/quran';
import { readStoredSettings } from '@/lib/local-app-data';
import { useEditorStore } from '@/stores/editor-store';

export default function EditorPage() {
  const [selectedAyah, setSelectedAyah] = useState<number>(1);
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [showProperties, setShowProperties] = useState(true);

  const {
    zoom,
    setZoom,
    resetView,
    hasUnsavedChanges,
    setUnsavedChanges,
    setShowGrid,
    setShowRulers,
  } = useEditorStore();

  const currentSurah = useMemo(
    () => LOCAL_QURAN_SURAHS.find((surah) => surah.number === selectedSurah) ?? LOCAL_QURAN_SURAHS[0],
    [selectedSurah]
  );

  useEffect(() => {
    const settings = readStoredSettings();
    setZoom(settings.defaultZoom);
    setShowGrid(settings.showGrid);
    setShowRulers(settings.showRulers);
  }, [setShowGrid, setShowRulers, setZoom]);

  const handleSurahChange = (surahNumber: number) => {
    setSelectedSurah(surahNumber);
    setSelectedAyah(1);
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      <Toolbar
        zoom={zoom}
        onZoomChange={setZoom}
        onResetView={resetView}
        showProperties={showProperties}
        onToggleProperties={() => setShowProperties(!showProperties)}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={() => setUnsavedChanges(false)}
      />

      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700">السورة</label>
          <select
            value={selectedSurah}
            onChange={(event) => handleSurahChange(Number(event.target.value))}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {LOCAL_QURAN_SURAHS.map((surah) => (
              <option key={surah.number} value={surah.number}>
                {surah.name}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium text-gray-700">الآية</label>
          <select
            value={selectedAyah}
            onChange={(event) => setSelectedAyah(Number(event.target.value))}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {currentSurah.ayahs.map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-500">
          {hasUnsavedChanges ? 'توجد تعديلات محفوظة محليًا بانتظار اعتماد الحفظ' : 'كل التعديلات محفوظة محليًا'}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showProperties && (
          <PropertiesPanel
            ayahId={selectedAyah}
            surahId={selectedSurah}
          />
        )}

        <div className="flex-1 overflow-auto bg-amber-50 p-4">
          <TashjeerCanvas
            ayahId={selectedAyah}
            surahId={selectedSurah}
            qiraahOrder={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]}
          />
        </div>
      </div>

      <StatusBar
        surahName={currentSurah.name}
        surahId={selectedSurah}
        ayahId={selectedAyah}
        zoom={zoom}
      />
    </div>
  );
}

function StatusBar({
  surahName,
  surahId,
  ayahId,
  zoom,
}: {
  surahName: string;
  surahId: number;
  ayahId: number;
  zoom: number;
}) {
  return (
    <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-sm text-gray-600">
      <div className="flex items-center gap-4">
        <span>السورة: {surahName} ({surahId})</span>
        <span>الآية: {ayahId}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>التكبير: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}

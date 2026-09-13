// ملفات المحرك والمقارنة وإعادة التشغيل — FR-ES-11 / FR-EN-05
'use client';

import { useMemo, useState } from 'react';
import type { EngineConfig } from '@/lib/tashjeer/model/v8';
import { createDefaultEngineConfig } from '@/lib/tashjeer/decision/policy';
import { compareProfiles, isSafeToAdopt } from '@/lib/tashjeer/decision/profile-compare';
import { rerunEngine } from '@/lib/tashjeer/decision/engine-rerun';
import { saveProfile, loadProfile, listProfiles, DEFAULT_PROFILE_NAME } from '@/lib/tashjeer/profile-storage';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

const NAMED = ['default', 'experimental', 'testing', 'legacy', 'reference'] as const;

interface ProfilesPanelProps {
  config: EngineConfig;
  onLoadProfile: (config: EngineConfig) => void;
}

export function ProfilesPanel({ config, onLoadProfile }: ProfilesPanelProps) {
  const [other, setOther] = useState<(typeof NAMED)[number]>('experimental');
  const [scope, setScope] = useState<'ayah' | 'surah' | 'mushaf'>('mushaf');
  const otherConfig = useMemo(() => {
    const loaded = loadProfile(other);
    return loaded.rules.length ? loaded : createDefaultEngineConfig(other);
  }, [other]);

  const report = useMemo(() => compareProfiles(otherConfig, config), [otherConfig, config]);
  const rerun = useMemo(() => rerunEngine(otherConfig, config, scope), [otherConfig, config, scope]);
  const safe = isSafeToAdopt(report);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">ملفات المحرك (Profiles)</h3>
        <p className="mt-1 text-sm text-gray-500">Default / Experimental / Testing / Legacy / Reference — التبديل لا يمس البيانات الرسمية إلا بحفظ صريح.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {NAMED.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                saveProfile(name, name === config.profile ? config : loadProfile(name));
                onLoadProfile(loadProfile(name).rules.length ? loadProfile(name) : createDefaultEngineConfig(name));
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${config.profile === name ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200'}`}
            >
              {name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => saveProfile(config.profile || DEFAULT_PROFILE_NAME, config)}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          حفظ الملف الحالي باسمه
        </button>
        <p className="mt-2 text-xs text-gray-400">محفوظ: {listProfiles().map((e) => e.name).join('، ') || 'لا شيء بعد'}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">مقارنة الملفين</h3>
        <label className="mt-2 block text-xs text-gray-500">
          الملف أ
          <select value={other} onChange={(e) => setOther(e.target.value as (typeof NAMED)[number])} className="mt-1 rounded border px-2 py-1 text-sm">
            {NAMED.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="متغيّر" value={report.changed} />
          <Stat label="متطابق" value={report.same} />
          <Stat label="متحسّن" value={report.improved} />
          <Stat label="متراجع" value={report.regressed} />
        </div>
        <p className={`mt-3 text-sm ${safe ? 'text-emerald-700' : 'text-red-700'}`}>
          {safe ? 'آمن للاعتماد (لا تراجع عن المرجع).' : 'يوجد تراجع — راجع القوائم قبل الاعتماد.'}
        </p>
        <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
          {report.items.map((item) => (
            <li key={item.id} className="flex justify-between rounded bg-gray-50 px-3 py-1">
              <a href={`/editor?select=${encodeURIComponent(item.id)}`} className="text-emerald-700 underline">
                {item.id}
              </a>
              <span>{item.class}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">إعادة تشغيل المحرك</h3>
        <p className="mt-1 text-sm text-gray-500">التقرير قبل التطبيق وبعده. القرارات البشرية تبقى (P-06).</p>
        <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="mt-2 rounded border px-2 py-1 text-sm">
          <option value="ayah">آية</option>
          <option value="surah">سورة</option>
          <option value="mushaf">المصحف كله</option>
        </select>
        <p className="mt-2 text-sm">
          Dry Run مطابق: {toArabicDigits(String(rerun.dryRun.matched))} · مقارنة متحسّن:{' '}
          {toArabicDigits(String(rerun.compare.improved))} · متراجع: {toArabicDigits(String(rerun.compare.regressed))}
        </p>
        <p className="text-xs text-gray-400">القرارات اليدوية محفوظة: {rerun.preservedManual ? 'نعم' : 'لا'}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-2xl font-bold">{toArabicDigits(String(value))}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

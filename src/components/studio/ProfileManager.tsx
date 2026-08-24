'use client';

// مدير البروفايلات - Profile Manager
// FR-ES-11: Engine Profiles و Sandbox Mode

import { useState } from 'react';
import { useEngineStudioStore } from '@/stores/engine-studio-store';

export function ProfileManager() {
  const {
    profiles,
    activeProfileId,
    createProfile,
    duplicateProfile,
    deleteProfile,
    activateProfile,
    renameProfile,
  } = useEngineStudioStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProfile(newName, newDescription);
    setNewName('');
    setNewDescription('');
    setShowCreate(false);
  };

  const handleDuplicate = (profileId: string) => {
    const source = profiles.find((p) => p.id === profileId);
    if (!source) return;
    const name = prompt('اسم البروفايل الجديد:', `${source.name} — نسخة`);
    if (name) duplicateProfile(profileId, name);
  };

  const handleDelete = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile || profile.isActive) return;
    if (confirm(`حذف بروفايل «${profile.name}»؟`)) {
      deleteProfile(profileId);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">ملفات المحرك (Profiles)</h2>
          <p className="text-sm text-gray-500">
            حزم سياسات كاملة قابلة للتبديل والمقارنة (FR-ES-11)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + بروفايل جديد
        </button>
      </div>

      {showCreate && (
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">الاسم</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Experimental, Testing..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">الوصف</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
            >
              إنشاء
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`rounded-lg border p-4 transition-colors ${
                profile.isActive
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{profile.name}</h3>
                    {profile.isActive && (
                      <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        نشط
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {profile.description ?? 'بلا وصف'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>{profile.config.rules.length} قاعدة</span>
                    <span>{profile.config.mergeMatrix.length} صف دمج</span>
                    <span>{profile.config.priorityGroups.length} مجموعات أولوية</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!profile.isActive && (
                    <button
                      type="button"
                      onClick={() => activateProfile(profile.id)}
                      className="rounded bg-emerald-100 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-200"
                    >
                      تفعيل
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDuplicate(profile.id)}
                    className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                  >
                    نسخ
                  </button>
                  {!profile.isActive && (
                    <button
                      type="button"
                      onClick={() => handleDelete(profile.id)}
                      className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { QIRAAT_ORDER_TAYYIBAH } from '@/data/qiraat-data/qiraat';
import {
  LocalReader,
  createLocalId,
  formatLocalDate,
  readStoredReaders,
  saveStoredReaders,
} from '@/lib/local-app-data';

type ReaderFormState = {
  name: string;
  email: string;
  qiraahId: string;
  granter: string;
  grantedAt: string;
  paths: string;
};

const initialForm: ReaderFormState = {
  name: '',
  email: '',
  qiraahId: '',
  granter: '',
  grantedAt: new Date().toISOString().slice(0, 10),
  paths: '',
};

export default function ReadersPage() {
  const [readers, setReaders] = useState<LocalReader[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<ReaderFormState>(initialForm);
  const [error, setError] = useState('');

  useEffect(() => {
    setReaders(readStoredReaders());
  }, []);

  const stats = useMemo(() => {
    const ijazatCount = readers.reduce((total, reader) => total + reader.ijazat.length, 0);
    return {
      activeReaders: readers.filter((reader) => reader.isActive).length,
      ijazatCount,
    };
  }, [readers]);

  const persistReaders = (nextReaders: LocalReader[]) => {
    setReaders(nextReaders);
    saveStoredReaders(nextReaders);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim()) {
      setError('أدخل اسم القارئ وبريده الإلكتروني.');
      return;
    }

    const selectedQiraah = QIRAAT_ORDER_TAYYIBAH.find((qiraah) => String(qiraah.id) === form.qiraahId);
    const ijazat = selectedQiraah
      ? [
          {
            id: createLocalId('ijazah'),
            qiraahName: selectedQiraah.name,
            narratorName: selectedQiraah.narrator,
            granter: form.granter.trim() || 'غير محدد',
            grantedAt: form.grantedAt,
            paths: form.paths
              .split(',')
              .map((path) => path.trim())
              .filter(Boolean),
          },
        ]
      : [];

    const nextReader: LocalReader = {
      id: createLocalId('reader'),
      name: form.name.trim(),
      email: form.email.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
      ijazat,
    };

    persistReaders([nextReader, ...readers]);
    setForm(initialForm);
    setShowAddForm(false);
  };

  const toggleReaderStatus = (readerId: string) => {
    persistReaders(
      readers.map((reader) =>
        reader.id === readerId ? { ...reader, isActive: !reader.isActive } : reader
      )
    );
  };

  return (
    <div data-ui-id="A026" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">القراء</h1>
          <p className="text-gray-600">إدارة القراء والإجازات المرتبطة بالقراءات والطرق.</p>
        </div>
        <button data-ui-id="A555"
          onClick={() => setShowAddForm((value) => !value)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
          type="button"
        >
          {showAddForm ? 'إغلاق النموذج' : 'إضافة قارئ'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="القراء المسجلون" value={readers.length} />
        <SummaryCard label="القراء النشطون" value={stats.activeReaders} />
        <SummaryCard label="الإجازات" value={stats.ijazatCount} />
      </div>

      {showAddForm && (
        <section data-ui-id="A556" className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-gray-900">بيانات القارئ</h2>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form data-ui-id="A240" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <TextField data-ui-id="A2107"
              label="اسم القارئ"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
              required
            />
            <TextField data-ui-id="A2108"
              label="البريد الإلكتروني"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
              type="email"
              required
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">الإجازة</label>
              <select
                data-ui-id="A242"
                value={form.qiraahId}
                onChange={(event) => setForm({ ...form, qiraahId: event.target.value })}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option data-ui-id="A557" value="">بدون إجازة مضافة</option>
                {QIRAAT_ORDER_TAYYIBAH.map((qiraah) => (
                  <option data-ui-instance={String(qiraah.id)} data-ui-id="A558" key={qiraah.id} value={qiraah.id}>
                    {qiraah.narrator} عن {qiraah.name}
                  </option>
                ))}
              </select>
            </div>

            <TextField data-ui-id="A2109"
              label="المجيز"
              value={form.granter}
              onChange={(value) => setForm({ ...form, granter: value })}
            />
            <TextField data-ui-id="A2110"
              label="تاريخ الإجازة"
              value={form.grantedAt}
              onChange={(value) => setForm({ ...form, grantedAt: value })}
              type="date"
            />
            <TextField data-ui-id="A2111"
              label="الطرق"
              value={form.paths}
              onChange={(value) => setForm({ ...form, paths: value })}
              placeholder="مثال: الأزرق، الأصبهاني"
            />

            <div className="flex items-end justify-end gap-3 md:col-span-2">
              <button data-ui-id="A559"
                onClick={() => {
                  setForm(initialForm);
                  setShowAddForm(false);
                  setError('');
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
                type="button"
              >
                إلغاء
              </button>
              <button
                data-ui-id="A243"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                type="submit"
              >
                حفظ القارئ
              </button>
            </div>
          </form>
        </section>
      )}

      <section data-ui-id="A241" className="overflow-hidden rounded-xl bg-white shadow-lg">
        {readers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">لا يوجد قراء مسجلون حاليا.</div>
        ) : (
          <div className="overflow-x-auto">
            <table data-ui-id="A560" className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">القارئ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الإجازات</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">آخر إضافة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {readers.map((reader) => (
                  <tr data-ui-instance={String(reader.id)} data-ui-id="A561" key={reader.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{reader.name}</div>
                      <div className="text-sm text-gray-500">{reader.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {reader.ijazat.length === 0 ? (
                        <span className="text-sm text-gray-500">لا توجد إجازات</span>
                      ) : (
                        <div className="space-y-2">
                          {reader.ijazat.map((ijazah) => (
                            <div key={ijazah.id} className="text-sm">
                              <span className="font-medium text-gray-900">
                                {ijazah.narratorName} عن {ijazah.qiraahName}
                              </span>
                              <span className="text-gray-500"> - {ijazah.granter}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          reader.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {reader.isActive ? 'نشط' : 'متوقف'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatLocalDate(reader.createdAt)}</td>
                    <td className="px-6 py-4">
                      <button data-ui-instance={String(reader.id)} data-ui-id="A562"
                        onClick={() => toggleReaderStatus(reader.id)}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                        type="button"
                      >
                        {reader.isActive ? 'إيقاف' : 'تنشيط'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div data-ui-id="A563" className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function TextField({ 'data-ui-id': uiId,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
} & { 'data-ui-id'?: string }) {
  return (
    <div data-ui-id="A564">
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input data-ui-id={uiId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

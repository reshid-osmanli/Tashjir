// لوحة التحكم العلمية
//
// هذه الصفحة تدير البنية التي يقرأ منها المحرك فعليا: الأئمة والرواة والطرق
// والرموز، ثم قواعد ترتيب التشجير. التخزين محلي في هذه المرحلة، لكنه معزول
// في lib/transmissions/catalog وlib/tashjeer/engine-settings ليسهل نقله إلى API.

'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Narrator, ReadingImam, TransmissionPath } from '@/types';
import {
  catalogImamsInOrder,
  catalogNarratorsInOrder,
  catalogPathsForNarrator,
  createDefaultTransmissionCatalog,
  createTransmissionId,
  readTransmissionCatalog,
  resetTransmissionCatalog,
  saveTransmissionCatalog,
  type TransmissionCatalog,
} from '@/lib/transmissions/catalog';
import {
  DEFAULT_ENGINE_SETTINGS,
  readEngineSettings,
  resetEngineSettings,
  saveEngineSettings,
  type AlternativeOrderRule,
  type LineCompositionMode,
  type LineSpanMode,
  type SymbolDisplay,
  type TashjeerEngineSettings,
  type TieBreakOrder,
} from '@/lib/tashjeer/engine-settings';

const TABS = [
  { id: 'transmissions', label: 'القراء والرواة والطرق' },
  { id: 'engine', label: 'محرك التشجير' },
] as const;

type Tab = (typeof TABS)[number]['id'];
type EditorTarget =
  | { kind: 'IMAM'; id?: string }
  | { kind: 'NARRATOR'; id?: string; imamId?: string }
  | { kind: 'PATH'; id?: string; narratorId?: string }
  | null;

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('transmissions');
  const [catalog, setCatalog] = useState<TransmissionCatalog>(() => createDefaultTransmissionCatalog());
  const [engine, setEngine] = useState<TashjeerEngineSettings>(() => ({ ...DEFAULT_ENGINE_SETTINGS }));
  const [editor, setEditor] = useState<EditorTarget>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setCatalog(readTransmissionCatalog());
    setEngine(readEngineSettings());
  }, []);

  const persistCatalog = (next: TransmissionCatalog, successMessage: string) => {
    setCatalog(saveTransmissionCatalog(next));
    setMessage(successMessage);
  };

  const persistEngine = () => {
    setEngine(saveEngineSettings(engine));
    setMessage('تم حفظ إعدادات محرك التشجير. يعاد الرسم فورا في المحرر المفتوح.');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-emerald-700">لوحة التحكم</p>
          <h1 className="text-2xl font-bold text-stone-900">إدارة التشجير والقراءات</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-600">
            عدّل بنية القراء والرواة والطرق والرموز، واضبط ترتيب المحرك. تبقى نسبة الأوجه والوقف
            مادة علمية تحتاج مراجعة مختص؛ اللوحة لا تعتمد حكما تلقائيا.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          القاعدة النشطة: <strong>آخر الآية ← أولها</strong>
        </div>
      </header>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-emerald-800 hover:underline">
            إخفاء
          </button>
        </div>
      )}

      <nav className="flex flex-wrap gap-2 border-b border-stone-200" aria-label="أقسام لوحة التحكم">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === item.id
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'transmissions' ? (
        <TransmissionManager
          catalog={catalog}
          editor={editor}
          onOpenEditor={setEditor}
          onCloseEditor={() => setEditor(null)}
          onPersist={persistCatalog}
          onReset={() => {
            if (!window.confirm('إعادة القراء والرواة والطرق إلى بذرة المشروع؟ ستفقد التعديلات المحلية.')) return;
            setCatalog(resetTransmissionCatalog());
            setMessage('أعيد كتالوج القراءات إلى البذرة الافتراضية.');
            setEditor(null);
          }}
        />
      ) : (
        <EngineManager
          engine={engine}
          onChange={setEngine}
          onSave={persistEngine}
          onReset={() => {
            setEngine(resetEngineSettings());
            setMessage('أعيدت إعدادات المحرك الافتراضية: البدء من آخر الآية.');
          }}
        />
      )}
    </div>
  );
}

function TransmissionManager({
  catalog,
  editor,
  onOpenEditor,
  onCloseEditor,
  onPersist,
  onReset,
}: {
  catalog: TransmissionCatalog;
  editor: EditorTarget;
  onOpenEditor: (target: EditorTarget) => void;
  onCloseEditor: () => void;
  onPersist: (catalog: TransmissionCatalog, message: string) => void;
  onReset: () => void;
}) {
  const imams = useMemo(() => catalogImamsInOrder(catalog), [catalog]);
  const narrators = useMemo(() => catalogNarratorsInOrder(catalog), [catalog]);

  const removeImam = (imam: ReadingImam) => {
    const relatedNarrators = catalog.narrators.filter((narrator) => narrator.imamId === imam.id);
    const relatedIds = new Set(relatedNarrators.map((narrator) => narrator.id));
    const relatedPaths = catalog.paths.filter((path) => relatedIds.has(path.narratorId));
    if (!window.confirm(`حذف «${imam.name}» مع ${relatedNarrators.length} راو و${relatedPaths.length} طريق؟`)) return;
    onPersist(
      {
        ...catalog,
        imams: catalog.imams.filter((item) => item.id !== imam.id),
        narrators: catalog.narrators.filter((item) => item.imamId !== imam.id),
        paths: catalog.paths.filter((item) => !relatedIds.has(item.narratorId)),
      },
      `تم حذف القارئ ${imam.name} وتوابعه.`
    );
    onCloseEditor();
  };

  const removeNarrator = (narrator: Narrator) => {
    const pathsCount = catalog.paths.filter((path) => path.narratorId === narrator.id).length;
    if (!window.confirm(`حذف الراوي «${narrator.name}» مع ${pathsCount} طريق؟`)) return;
    onPersist(
      {
        ...catalog,
        narrators: catalog.narrators.filter((item) => item.id !== narrator.id),
        paths: catalog.paths.filter((path) => path.narratorId !== narrator.id),
      },
      `تم حذف الراوي ${narrator.name}.`
    );
    onCloseEditor();
  };

  const removePath = (path: TransmissionPath) => {
    if (!window.confirm(`حذف الطريق «${path.shortName}»؟`)) return;
    onPersist(
      { ...catalog, paths: catalog.paths.filter((item) => item.id !== path.id) },
      `تم حذف الطريق ${path.shortName}.`
    );
    onCloseEditor();
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <main className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="الأئمة" value={catalog.imams.length} />
          <Metric label="الرواة" value={catalog.narrators.length} />
          <Metric label="الطرق" value={catalog.paths.length} />
        </div>

        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={() => onOpenEditor({ kind: 'IMAM' })}>إضافة قارئ</PrimaryButton>
          <SecondaryButton
            disabled={imams.length === 0}
            onClick={() => onOpenEditor({ kind: 'NARRATOR', imamId: imams[0]?.id })}
          >
            إضافة راوٍ
          </SecondaryButton>
          <SecondaryButton
            disabled={narrators.length === 0}
            onClick={() => onOpenEditor({ kind: 'PATH', narratorId: narrators[0]?.id })}
          >
            إضافة طريق
          </SecondaryButton>
          <button
            type="button"
            onClick={onReset}
            className="ms-auto rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
          >
            استعادة البذرة
          </button>
        </div>

        {imams.length === 0 ? (
          <Empty text="لا يوجد قارئ في الكتالوج. أضف قارئا أولا." />
        ) : (
          <div className="space-y-3">
            {imams.map((imam) => {
              const imamNarrators = narrators.filter((narrator) => narrator.imamId === imam.id);
              return (
                <section key={imam.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <header className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 min-w-7 items-center justify-center rounded bg-stone-800 px-1 text-sm font-bold text-white"
                        style={{ fontFamily: "'Amiri Quran', serif" }}
                        title="رمز الإمام: يُطبع إذا اجتمع راوياه على وجه واحد"
                      >
                        {imam.symbol || '—'}
                      </span>
                      <div>
                        <h2 className="font-bold text-stone-900">{imam.order}. {imam.name}</h2>
                        <p className="text-[11px] text-stone-500">{imam.region || 'البلد غير مسجل'} · {imam.slug}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <TinyButton onClick={() => onOpenEditor({ kind: 'NARRATOR', imamId: imam.id })}>إضافة راوٍ</TinyButton>
                      <TinyButton onClick={() => onOpenEditor({ kind: 'IMAM', id: imam.id })}>تعديل</TinyButton>
                      <TinyButton tone="danger" onClick={() => removeImam(imam)}>حذف</TinyButton>
                    </div>
                  </header>

                  {imamNarrators.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-stone-500">لا يوجد رواة مسجلون لهذا القارئ.</p>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {imamNarrators.map((narrator) => {
                        const paths = catalogPathsForNarrator(catalog, narrator.id);
                        return (
                          <li key={narrator.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 min-w-7 items-center justify-center rounded bg-emerald-700 px-1 text-sm font-bold text-white" style={{ fontFamily: "'Amiri Quran', serif" }}>
                                  {narrator.symbol || '—'}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-stone-900">{narrator.name}</p>
                                  <p className="text-[11px] text-stone-500">ترتيب الراوي: {narrator.order} · الطيبة: {narrator.legacyOrderInTayyibah ?? '—'}</p>
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                <TinyButton onClick={() => onOpenEditor({ kind: 'PATH', narratorId: narrator.id })}>إضافة طريق</TinyButton>
                                <TinyButton onClick={() => onOpenEditor({ kind: 'NARRATOR', id: narrator.id })}>تعديل</TinyButton>
                                <TinyButton tone="danger" onClick={() => removeNarrator(narrator)}>حذف</TinyButton>
                              </div>
                            </div>

                            {paths.length > 0 && (
                              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                                {paths.map((path) => (
                                  <li key={path.id} className="flex items-center justify-between gap-2 rounded border border-stone-100 bg-stone-50 px-2 py-1.5">
                                    <span className="min-w-0">
                                      <span className="block truncate text-[11px] font-medium text-stone-800">
                                        {path.symbol ? `${path.symbol} · ` : ''}
                                        {path.shortName}
                                      </span>
                                      <span className="block truncate text-[10px] text-stone-500">{path.code}</span>
                                    </span>
                                    <span className="flex shrink-0 gap-1">
                                      <button type="button" onClick={() => onOpenEditor({ kind: 'PATH', id: path.id })} className="text-[10px] text-emerald-800 hover:underline">تعديل</button>
                                      <button type="button" onClick={() => removePath(path)} className="text-[10px] text-red-700 hover:underline">حذف</button>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <aside className="h-fit rounded-xl border border-stone-200 bg-white p-4 xl:sticky xl:top-24">
        {editor ? (
          <EntityEditor
            key={`${editor.kind}-${editor.id ?? 'new'}-${
              editor.kind === 'NARRATOR' ? editor.imamId ?? '' : ''
            }-${editor.kind === 'PATH' ? editor.narratorId ?? '' : ''}`}
            target={editor}
            catalog={catalog}
            onSave={(next, text) => {
              onPersist(next, text);
              onCloseEditor();
            }}
            onClose={onCloseEditor}
          />
        ) : (
          <div className="text-center">
            <p className="text-sm font-semibold text-stone-800">محرر الكتالوج</p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              اختر إضافة أو تعديل من القائمة. التغييرات في الرمز والترتيب تؤثر في التشجير فور حفظها.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function EntityEditor({
  target,
  catalog,
  onSave,
  onClose,
}: {
  target: Exclude<EditorTarget, null>;
  catalog: TransmissionCatalog;
  onSave: (catalog: TransmissionCatalog, message: string) => void;
  onClose: () => void;
}) {
  if (target.kind === 'IMAM') {
    const value = catalog.imams.find((imam) => imam.id === target.id);
    return <ImamForm value={value} catalog={catalog} onSave={onSave} onClose={onClose} />;
  }
  if (target.kind === 'NARRATOR') {
    const value = catalog.narrators.find((narrator) => narrator.id === target.id);
    return <NarratorForm value={value} initialImamId={target.imamId} catalog={catalog} onSave={onSave} onClose={onClose} />;
  }
  const value = catalog.paths.find((path) => path.id === target.id);
  return <PathForm value={value} initialNarratorId={target.narratorId} catalog={catalog} onSave={onSave} onClose={onClose} />;
}

function ImamForm({
  value,
  catalog,
  onSave,
  onClose,
}: {
  value?: ReadingImam;
  catalog: TransmissionCatalog;
  onSave: (catalog: TransmissionCatalog, message: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(value?.name ?? '');
  const [region, setRegion] = useState(value?.region ?? '');
  const [slug, setSlug] = useState(value?.slug ?? '');
  const [order, setOrder] = useState(value?.order ?? catalog.imams.length + 1);
  // رمز الإمام: يُطبع في طرف السطر إذا اجتمع راوياه على وجه واحد.
  const [symbol, setSymbol] = useState(value?.symbol ?? '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const imam: ReadingImam = {
      id: value?.id ?? createTransmissionId('imam'),
      name: name.trim(),
      region: region.trim() || undefined,
      slug: slug.trim() || undefinedSlug(name),
      order: Math.max(1, Number(order) || 1),
      symbol: symbol.trim(),
    };
    onSave(
      { ...catalog, imams: value ? catalog.imams.map((item) => item.id === value.id ? imam : item) : [...catalog.imams, imam] },
      value ? `تم تعديل القارئ ${imam.name}.` : `تمت إضافة القارئ ${imam.name}.`
    );
  };
  return <EntityForm title={value ? 'تعديل قارئ' : 'إضافة قارئ'} onSubmit={submit} onClose={onClose}>
    <TextInput label="اسم القارئ" value={name} onChange={setName} required />
    <div className="grid grid-cols-3 gap-2">
      <TextInput label="الرمز" value={symbol} onChange={setSymbol} placeholder="أ" />
      <TextInput label="الترتيب" value={String(order)} onChange={(next) => setOrder(Number(next))} type="number" required />
      <TextInput label="البلد" value={region} onChange={setRegion} />
    </div>
    <p className="text-[11px] leading-relaxed text-stone-500">
      رمز الإمام يُطبع في طرف السطر إذا اجتمع راوياه على الوجه نفسه، فيُختصر رمزان في رمز.
      أما الطريق فلا رمز له: يُذكر باسمه إذا انفرد بالوجه دون سائر طرق راويه.
    </p>
    <TextInput label="المعرّف المختصر" value={slug} onChange={setSlug} placeholder="nafi" />
  </EntityForm>;
}

function NarratorForm({
  value,
  initialImamId,
  catalog,
  onSave,
  onClose,
}: {
  value?: Narrator;
  initialImamId?: string;
  catalog: TransmissionCatalog;
  onSave: (catalog: TransmissionCatalog, message: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(value?.name ?? '');
  const [imamId, setImamId] = useState(value?.imamId ?? initialImamId ?? catalog.imams[0]?.id ?? '');
  const [symbol, setSymbol] = useState(value?.symbol ?? '');
  const [order, setOrder] = useState(value?.order ?? 1);
  const [tayyibahOrder, setTayyibahOrder] = useState(value?.legacyOrderInTayyibah ?? catalog.narrators.length + 1);
  const [slug, setSlug] = useState(value?.slug ?? '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !imamId) return;
    const narrator: Narrator = {
      id: value?.id ?? createTransmissionId('narrator'),
      name: name.trim(),
      imamId,
      symbol: symbol.trim(),
      order: Math.max(1, Number(order) || 1),
      legacyOrderInTayyibah: Math.max(1, Number(tayyibahOrder) || 1),
      slug: slug.trim() || undefinedSlug(name),
    };
    onSave(
      { ...catalog, narrators: value ? catalog.narrators.map((item) => item.id === value.id ? narrator : item) : [...catalog.narrators, narrator] },
      value ? `تم تعديل الراوي ${narrator.name}.` : `تمت إضافة الراوي ${narrator.name}.`
    );
  };
  return <EntityForm title={value ? 'تعديل راوٍ' : 'إضافة راوٍ'} onSubmit={submit} onClose={onClose}>
    <TextInput label="اسم الراوي" value={name} onChange={setName} required />
    <SelectInput label="القارئ" value={imamId} onChange={setImamId} required>
      <option value="">اختر القارئ</option>
      {catalogImamsInOrder(catalog).map((imam) => <option key={imam.id} value={imam.id}>{imam.name}</option>)}
    </SelectInput>
    <div className="grid grid-cols-3 gap-2">
      <TextInput label="الرمز" value={symbol} onChange={setSymbol} placeholder="ب" />
      <TextInput label="ترتيبه" value={String(order)} onChange={(next) => setOrder(Number(next))} type="number" required />
      <TextInput label="ترتيب الطيبة" value={String(tayyibahOrder)} onChange={(next) => setTayyibahOrder(Number(next))} type="number" required />
    </div>
    <TextInput label="المعرّف المختصر" value={slug} onChange={setSlug} placeholder="qalun" />
  </EntityForm>;
}

function PathForm({
  value,
  initialNarratorId,
  catalog,
  onSave,
  onClose,
}: {
  value?: TransmissionPath;
  initialNarratorId?: string;
  catalog: TransmissionCatalog;
  onSave: (catalog: TransmissionCatalog, message: string) => void;
  onClose: () => void;
}) {
  const [narratorId, setNarratorId] = useState(value?.narratorId ?? initialNarratorId ?? catalog.narrators[0]?.id ?? '');
  const [shortName, setShortName] = useState(value?.shortName ?? '');
  const [fullName, setFullName] = useState(value?.fullName ?? '');
  const [code, setCode] = useState(value?.code ?? '');
  const [order, setOrder] = useState(value?.order ?? 1);
  const [symbol, setSymbol] = useState(value?.symbol ?? '');
  const [canonical, setCanonical] = useState(value?.isCanonical ?? false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!narratorId || !shortName.trim()) return;
    const path: TransmissionPath = {
      id: value?.id ?? createTransmissionId('path'),
      narratorId,
      shortName: shortName.trim(),
      fullName: fullName.trim() || shortName.trim(),
      code: code.trim() || undefinedSlug(shortName),
      order: Math.max(1, Number(order) || 1),
      depth: value?.depth ?? 1,
      isCanonical: canonical,
      symbol: symbol.trim(),
      sourceRef: value?.sourceRef,
      notes: value?.notes,
    };
    onSave(
      { ...catalog, paths: value ? catalog.paths.map((item) => item.id === value.id ? path : item) : [...catalog.paths, path] },
      value ? `تم تعديل الطريق ${path.shortName}.` : `تمت إضافة الطريق ${path.shortName}.`
    );
  };
  return <EntityForm title={value ? 'تعديل طريق' : 'إضافة طريق'} onSubmit={submit} onClose={onClose}>
    <SelectInput label="الراوي" value={narratorId} onChange={setNarratorId} required>
      <option value="">اختر الراوي</option>
      {catalogNarratorsInOrder(catalog).map((narrator) => <option key={narrator.id} value={narrator.id}>{narrator.name}</option>)}
    </SelectInput>
    <TextInput label="الاسم المختصر" value={shortName} onChange={setShortName} placeholder="ورش / الأزرق" required />
    <TextInput label="الاسم الكامل" value={fullName} onChange={setFullName} placeholder="طريق الأزرق عن ورش..." />
    <div className="grid grid-cols-3 gap-2">
      <TextInput label="رمز الطريق" value={symbol} onChange={setSymbol} placeholder="أز" />
      <TextInput label="الرمز/الكود" value={code} onChange={setCode} placeholder="warsh-azraq" />
      <TextInput label="الترتيب" value={String(order)} onChange={(next) => setOrder(Number(next))} type="number" required />
    </div>
    <p className="text-[11px] leading-relaxed text-stone-500">
      إن انفرد الطريق بالوجه يُطبع <strong>اسمه</strong> على السطر («الأزرق»). الرمز اختياري يظهر في الدليل
      والبطاقات. وإذا اجتمع طريقاه طُبع رمز الراوي.
    </p>
    <label className="flex items-center gap-2 text-xs text-stone-700">
      <input type="checkbox" checked={canonical} onChange={(event) => setCanonical(event.target.checked)} className="accent-emerald-600" />
      طريق معتمد في الكتالوج
    </label>
  </EntityForm>;
}

function EngineManager({
  engine,
  onChange,
  onSave,
  onReset,
}: {
  engine: TashjeerEngineSettings;
  onChange: (settings: TashjeerEngineSettings) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-950">
          <strong>الترتيب المعتمد:</strong> يبدأ المحرك من آخر موضع اختلاف في الآية إلى أولها.
          لا تغيّر الفئة أو ترتيب الإدخال هذه القاعدة؛ لا تسمح لوحة الإدارة بحفظ ترتيب يبدأ من أول الآية.
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
            <p className="font-medium">اتجاه المرور في الآية</p>
            <p className="mt-1">ثابت منهجيا: <strong>من آخر الآية إلى أولها</strong>.</p>
            <p className="mt-1 text-[11px] text-emerald-800">يُضبط ترتيب المتساويات والأسطر اليدوية من الحقول الآتية.</p>
          </div>

          <SelectInput
            label="كسر التعادل عند الموضع نفسه"
            value={engine.tieBreakOrder}
            onChange={(tieBreakOrder) => onChange({ ...engine, tieBreakOrder: tieBreakOrder as TieBreakOrder })}
          >
            <option value="TAYYIBAH">ترتيب طيبة النشر</option>
            <option value="SYMBOL">ترتيب الرمز</option>
            <option value="MANUAL">المسارات اليدوية أولا</option>
          </SelectInput>

          <SelectInput
            label="تكوين السطر"
            value={engine.lineComposition}
            onChange={(lineComposition) =>
              onChange({ ...engine, lineComposition: lineComposition as LineCompositionMode })
            }
          >
            <option value="COMBINED">سطر لكل تركيب قراءة (المعتمد)</option>
            <option value="PER_VARIANT">سطر لكل وجه في كل موضع</option>
          </SelectInput>

          <SelectInput
            label="ترتيب أوجه الموضع الواحد"
            value={engine.alternativeOrder}
            onChange={(alternativeOrder) =>
              onChange({ ...engine, alternativeOrder: alternativeOrder as AlternativeOrderRule })
            }
          >
            <option value="STRENGTH">قوة الوجه في الكتاب</option>
            <option value="TAYYIBAH">ترتيب طيبة النشر</option>
            <option value="MANUAL">ترتيب المحقق لكل موضع</option>
          </SelectInput>

          <SelectInput
            label="ما يظهر في طرف السطر"
            value={engine.symbolDisplay}
            onChange={(symbolDisplay) => onChange({ ...engine, symbolDisplay: symbolDisplay as SymbolDisplay })}
          >
            <option value="SYMBOLS">رموز القراء</option>
            <option value="NAMES">الأسماء</option>
            <option value="BOTH">الرمز مع الاسم</option>
          </SelectInput>

          <SelectInput
            label="امتداد السطر الأفقي"
            value={engine.lineSpan}
            onChange={(lineSpan) => onChange({ ...engine, lineSpan: lineSpan as LineSpanMode })}
          >
            <option value="FULL_AYAH">يمتد مع الآية كلها</option>
            <option value="VARIANT_SPAN">يقتصر على مدى الاختلاف</option>
          </SelectInput>

          <div className="grid gap-2 rounded-lg border border-stone-200 p-3">
            <CheckboxInput
              label="إظهار اسم الحكم تحت الكلمة"
              checked={engine.showRuleUnderWord}
              onChange={(showRuleUnderWord) => onChange({ ...engine, showRuleUnderWord })}
            />
            <CheckboxInput
              label="إظهار حركات المد في الهامش"
              checked={engine.showMaddColumn}
              onChange={(showMaddColumn) => onChange({ ...engine, showMaddColumn })}
            />
            <CheckboxInput
              label="نص الآية في سطر واحد مهما طال"
              checked={engine.singleLineText}
              onChange={(singleLineText) => onChange({ ...engine, singleLineText })}
            />
          </div>

          <RangeInput
            label="تباعد أسطر الشجرة"
            value={engine.rowSpacing}
            min={0.7}
            max={2}
            step={0.1}
            onChange={(rowSpacing) => onChange({ ...engine, rowSpacing })}
          />
          <RangeInput
            label="المسافة بين النص وأول سطر"
            value={engine.textToTreeGap}
            min={0.7}
            max={2}
            step={0.1}
            onChange={(textToTreeGap) => onChange({ ...engine, textToTreeGap })}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton onClick={onReset}>استعادة الافتراضي</SecondaryButton>
          <PrimaryButton onClick={onSave}>حفظ إعدادات المحرك</PrimaryButton>
        </div>
      </section>

      <aside className="h-fit rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-bold text-stone-900">كيف يطبَّق الضبط؟</h2>
        <ol className="mt-3 space-y-2 text-xs leading-relaxed text-stone-600">
          <li><strong className="text-stone-800">1.</strong> تسجل الأوجه ونطاقات الرواة في محرر الآية.</li>
          <li><strong className="text-stone-800">2.</strong> يحدد المحقق الوقف والابتداء أو الوصل في مواضعه.</li>
          <li><strong className="text-stone-800">3.</strong> يقسم المحرك الآية إلى مقاطع، ويعالج آخر مقطع أولا في الوضع المعتمد.</li>
          <li><strong className="text-stone-800">4.</strong> يمكن نقل أي سطر وإزاحته من لوحة خصائص المحرر دون فقدانه عند الحفظ.</li>
        </ol>
        <p className="mt-4 border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-500">
          إعدادات المحرك عامة لهذا المتصفح؛ أما الوقف وكسور الأسطر والأسطر اليدوية فتحفظ مع كل آية وتدخل في ملف التصدير.
        </p>
      </aside>
    </div>
  );
}

function EntityForm({
  title,
  children,
  onSubmit,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-stone-900">{title}</h2>
        <button type="button" onClick={onClose} className="text-xs text-stone-500 hover:text-stone-900">إغلاق</button>
      </div>
      {children}
      <PrimaryButton type="submit" className="w-full justify-center">حفظ</PrimaryButton>
    </form>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs text-stone-700">
      <span className="mb-1 block font-medium">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className="input h-9 text-sm" />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  children,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs text-stone-700">
      <span className="mb-1 block font-medium">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required} className="input h-9 text-sm">
        {children}
      </select>
    </label>
  );
}

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-stone-200 p-3 text-xs text-stone-700">
      <span className="flex items-center justify-between font-medium"><span>{label}</span><span>{value.toFixed(1)}×</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-emerald-600" />
    </label>
  );
}

function CheckboxInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-stone-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-emerald-600"
      />
      {label}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-2xl font-bold text-stone-900">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">{text}</div>;
}

function PrimaryButton({ children, onClick, type = 'button', className = '' }: { children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; className?: string }) {
  return <button type={type} onClick={onClick} className={`inline-flex items-center rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 ${className}`}>{children}</button>;
}

function SecondaryButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">{children}</button>;
}

function TinyButton({ children, onClick, tone = 'normal' }: { children: React.ReactNode; onClick: () => void; tone?: 'normal' | 'danger' }) {
  return <button type="button" onClick={onClick} className={`rounded border px-2 py-1 text-[10px] ${tone === 'danger' ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-stone-200 text-stone-700 hover:bg-white'}`}>{children}</button>;
}

function undefinedSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '') || 'custom';
}

// لوحة التحكم العلمية
//
// هذه الصفحة تدير البنية التي يقرأ منها المحرك فعليا: الأئمة والرواة والطرق
// والرموز، ثم قواعد ترتيب التشجير. التخزين محلي في هذه المرحلة، لكنه معزول
// في lib/transmissions/catalog وlib/tashjeer/engine-settings ليسهل نقله إلى API.

'use client';

import Link from 'next/link';
import { confirmAction } from '@/lib/ui/confirm-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Narrator, ReadingImam, TransmissionPath } from '@/types';
import {
  catalogImamsInOrder,
  catalogNarratorsInOrder,
  catalogPathsForNarrator,
  createDefaultTransmissionCatalog,
  createTransmissionId,
  findOrderConflict,
  insertWithShift,
  movePeer,
  replacePeers,
  readTransmissionCatalog,
  resetTransmissionCatalog,
  saveTransmissionCatalog,
  type TransmissionCatalog,
} from '@/lib/transmissions/catalog';

/**
 * يفحص تعارض رقم الترتيب مع قرين آخر (FR-ED-14). عند التعارض يعرض خيارا كميا:
 * «إدراج مع إزاحة» يزيح من بعده رقما واحدا، أو إلغاء للعودة إلى النموذج.
 * يعيد قائمة الأقران النهائية، أو null إن ألغى المستخدم.
 */
async function resolveOrderConflict<T extends { id: string; order: number }>(
  peers: T[],
  item: T,
  describe: (peer: T) => string
): Promise<T[] | null> {
  const conflict = findOrderConflict(peers, item.id, item.order);
  const others = peers.filter((peer) => peer.id !== item.id);
  if (!conflict) return [...others, item];
  const shifted = others.filter((peer) => peer.order >= item.order).length;
  const ok = await confirmAction({
    title: `الرقم ${toArabicDigits(item.order)} مشغول`,
    message: `يشغله «${describe(conflict.occupant)}». هل تريد إدراج العنصر في هذا الرقم وإزاحة من بعده رقما واحدا؟ المعرّفات لا تتغير، والترتيب النسبي للباقي محفوظ.`,
    impacts: [{ label: 'عنصر ستتغير رتبته', count: shifted }],
    undoable: false,
    confirmLabel: 'إدراج مع إزاحة',
  });
  if (!ok) return null;
  return insertWithShift(peers, item, item.order);
}

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
  const [editor, setEditor] = useState<EditorTarget>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setCatalog(readTransmissionCatalog());
  }, []);

  const persistCatalog = (next: TransmissionCatalog, successMessage: string) => {
    setCatalog(saveTransmissionCatalog(next));
    setMessage(successMessage);
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
          onReset={async () => {
            const ok = await confirmAction({
              title: 'إعادة كتالوج القراءات إلى بذرة المشروع',
              message: 'تُفقد التعديلات المحلية على القراء والرواة والطرق وترتيبهم.',
              impacts: [
                { label: 'قارئ', count: catalog.imams.length },
                { label: 'راو', count: catalog.narrators.length },
                { label: 'طريق', count: catalog.paths.length },
              ],
              undoable: false,
              confirmLabel: 'إعادة',
            });
            if (!ok) return;
            setCatalog(resetTransmissionCatalog());
            setMessage('أعيد كتالوج القراءات إلى البذرة الافتراضية.');
            setEditor(null);
          }}
        />
      ) : (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 text-violet-950">
          <h2 className="font-bold">إعدادات المحرك انتقلت إلى الاستوديو</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-violet-900">
            حافظنا على هذا التبويب للرابط القديم، لكن مصدر الإعداد واحد الآن. افتح مركز المحرك لتحرير الأولويات والقواعد وإعدادات الرسم في مكانها المعتمد.
          </p>
          <Link href="/studio?section=settings" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            فتح إعدادات المحرك في Engine Studio
          </Link>
        </div>
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

  // سحب وإفلات لإعادة الترتيب (FR-ED-14): كل إفلات يعيد الترقيم 1..n صراحة.
  const [drag, setDrag] = useState<{ kind: 'IMAM' | 'NARRATOR' | 'PATH'; id: string; group?: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const dropOn = (kind: 'IMAM' | 'NARRATOR' | 'PATH', targetId: string, group?: string) => {
    if (!drag || drag.kind !== kind || drag.group !== group || drag.id === targetId) {
      setDrag(null);
      setDropTarget(null);
      return;
    }
    if (kind === 'IMAM') {
      const toIndex = imams.findIndex((imam) => imam.id === targetId);
      onPersist({ ...catalog, imams: movePeer(catalog.imams, drag.id, toIndex) }, 'أُعيد ترتيب القراء.');
    } else if (kind === 'NARRATOR') {
      const peers = catalog.narrators.filter((narrator) => narrator.imamId === group);
      const sorted = [...peers].sort((a, b) => a.order - b.order);
      const toIndex = sorted.findIndex((narrator) => narrator.id === targetId);
      onPersist({ ...catalog, narrators: replacePeers(catalog.narrators, movePeer(peers, drag.id, toIndex)) }, 'أُعيد ترتيب الرواة.');
    } else {
      const peers = catalog.paths.filter((path) => path.narratorId === group);
      const sorted = [...peers].sort((a, b) => a.order - b.order);
      const toIndex = sorted.findIndex((path) => path.id === targetId);
      onPersist({ ...catalog, paths: replacePeers(catalog.paths, movePeer(peers, drag.id, toIndex)) }, 'أُعيد ترتيب الطرق.');
    }
    setDrag(null);
    setDropTarget(null);
  };

  const dragProps = (kind: 'IMAM' | 'NARRATOR' | 'PATH', id: string, group?: string) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      setDrag({ kind, id, group });
    },
    onDragOver: (event: React.DragEvent) => {
      if (!drag || drag.kind !== kind || drag.group !== group) return;
      event.preventDefault();
      event.stopPropagation();
      setDropTarget(id);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dropOn(kind, id, group);
    },
    onDragEnd: () => {
      setDrag(null);
      setDropTarget(null);
    },
  });
  const dropClass = (id: string) => (dropTarget === id && drag?.id !== id ? 'ring-2 ring-emerald-400' : drag?.id === id ? 'opacity-50' : '');

  const removeImam = async (imam: ReadingImam) => {
    const relatedNarrators = catalog.narrators.filter((narrator) => narrator.imamId === imam.id);
    const relatedIds = new Set(relatedNarrators.map((narrator) => narrator.id));
    const relatedPaths = catalog.paths.filter((path) => relatedIds.has(path.narratorId));
    const ok = await confirmAction({
      title: `حذف القارئ «${imam.name}»`,
      message: 'يُحذف مع رواته وطرقهم؛ الأوجه المسنَدة إليهم تبقى في المستندات لكن بلا صاحب معروف.',
      impacts: [
        { label: 'راو', count: relatedNarrators.length },
        { label: 'طريق', count: relatedPaths.length },
      ],
      undoable: false,
      confirmLabel: 'حذف',
    });
    if (!ok) return;
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

  const removeNarrator = async (narrator: Narrator) => {
    const pathsCount = catalog.paths.filter((path) => path.narratorId === narrator.id).length;
    const ok = await confirmAction({
      title: `حذف الراوي «${narrator.name}»`,
      message: 'يُحذف مع طرقه.',
      impacts: [{ label: 'طريق', count: pathsCount }],
      undoable: false,
      confirmLabel: 'حذف',
    });
    if (!ok) return;
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

  const removePath = async (path: TransmissionPath) => {
    const ok = await confirmAction({
      title: `حذف الطريق «${path.shortName}»`,
      message: 'الأوجه المخصوصة بهذا الطريق تعود إلى نطاق راويه.',
      impacts: [{ label: 'طريق', count: 1 }],
      undoable: false,
      confirmLabel: 'حذف',
    });
    if (!ok) return;
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
                <section key={imam.id} className={`overflow-hidden rounded-xl border border-stone-200 bg-white ${dropClass(imam.id)}`} {...dragProps('IMAM', imam.id)}>
                  <header className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="cursor-grab select-none text-stone-300 hover:text-stone-500 active:cursor-grabbing" title="اسحب لإعادة ترتيب القراء" aria-hidden>⠿</span>
                      <span
                        className="flex h-7 min-w-7 items-center justify-center rounded bg-stone-800 px-1 text-sm font-bold text-white"
                        style={{ fontFamily: "'Amiri Quran', serif" }}
                        title="رمز الإمام: يُطبع إذا اجتمع راوياه على وجه واحد"
                      >
                        {imam.symbol || '—'}
                      </span>
                      <div>
                        <h2 className="font-bold text-stone-900">{toArabicDigits(imam.order)}. {imam.name}</h2>
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
                          <li key={narrator.id} className={`px-4 py-3 ${dropClass(narrator.id)}`} {...dragProps('NARRATOR', narrator.id, imam.id)}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="cursor-grab select-none text-stone-300 hover:text-stone-500 active:cursor-grabbing" title="اسحب لإعادة ترتيب رواة هذا القارئ" aria-hidden>⠿</span>
                                <span className="flex h-7 min-w-7 items-center justify-center rounded bg-emerald-700 px-1 text-sm font-bold text-white" style={{ fontFamily: "'Amiri Quran', serif" }}>
                                  {narrator.symbol || '—'}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-stone-900">{narrator.name}</p>
                                  <p className="text-[11px] text-stone-500">ترتيب الراوي: {toArabicDigits(narrator.order)} · الطيبة: {narrator.legacyOrderInTayyibah != null ? toArabicDigits(narrator.legacyOrderInTayyibah) : '—'}</p>
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
                                  <li key={path.id} className={`flex items-center justify-between gap-2 rounded border border-stone-100 bg-stone-50 px-2 py-1.5 ${dropClass(path.id)}`} {...dragProps('PATH', path.id, narrator.id)}>
                                    <span className="cursor-grab select-none text-stone-300 hover:text-stone-500 active:cursor-grabbing" title="اسحب لإعادة ترتيب طرق هذا الراوي" aria-hidden>⠿</span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[11px] font-medium text-stone-800">
                                        {path.symbol ? `${path.symbol} · ` : ''}
                                        {path.shortName}
                                      </span>
                                      <span className="block truncate text-[10px] text-stone-500">{toArabicDigits(path.order)} · {path.code}</span>
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
  const submit = async (event: FormEvent) => {
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
    const imams = await resolveOrderConflict(catalog.imams, imam, (peer) => peer.name);
    if (!imams) return;
    onSave(
      { ...catalog, imams },
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
  const submit = async (event: FormEvent) => {
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
    // الأقران: رواة الإمام نفسه (الترتيب داخل الإمام).
    const peers = catalog.narrators.filter((item) => item.imamId === imamId || item.id === narrator.id);
    const resolved = await resolveOrderConflict(peers, narrator, (peer) => peer.name);
    if (!resolved) return;
    const kept = value ? catalog.narrators : [...catalog.narrators, narrator];
    onSave(
      { ...catalog, narrators: replacePeers(kept, resolved) },
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
  const submit = async (event: FormEvent) => {
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
    const peers = catalog.paths.filter((item) => item.narratorId === narratorId || item.id === path.id);
    const resolved = await resolveOrderConflict(peers, path, (peer) => peer.shortName);
    if (!resolved) return;
    const kept = value ? catalog.paths : [...catalog.paths, path];
    onSave(
      { ...catalog, paths: replacePeers(kept, resolved) },
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

// لوحة التحكم العلمية
//
// هذه الصفحة تدير البنية التي يقرأ منها المحرك فعليا: الأئمة والرواة والطرق
// والرموز، ثم قواعد ترتيب التشجير. التخزين محلي في هذه المرحلة، لكنه معزول
// في lib/transmissions/catalog وlib/tashjeer/engine-settings ليسهل نقله إلى API.

'use client';

import { confirmAction } from '@/lib/ui/confirm-store';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Narrator, ReadingImam, TransmissionPath } from '@/types';
import {
  auditStoredCatalog,
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
  type CatalogAudit,
  type TransmissionCatalog,
} from '@/lib/transmissions/catalog';
import { describeDisplayOrderConflicts } from '@/lib/tashjeer/display-order';
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
  { id: 'display-order', label: 'ترتيب الظهور' },
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
  // ما صحّحه التطبيع تلقائيًا في الكتالوج المحفوظ (DM-04): يُعرض ولا يُخفى.
  const [audit, setAudit] = useState<CatalogAudit | null>(null);

  useEffect(() => {
    setAudit(auditStoredCatalog());
    setCatalog(readTransmissionCatalog());
    setEngine(readEngineSettings());
  }, []);

  const persistCatalog = (next: TransmissionCatalog, successMessage: string) => {
    setCatalog(saveTransmissionCatalog(next));
    setAudit(auditStoredCatalog());
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

      {audit && (audit.conflicts.length > 0 || audit.legacySchema) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <p className="font-semibold">
            صُحّحت أرقام الترتيب الصريحة تلقائيًا عند قراءة الكتالوج المحفوظ
            {audit.legacySchema ? ` (إصدار البيانات: ${toArabicDigits(audit.storedVersion ?? 0)})` : ''}.
          </p>
          {audit.legacySchema && (
            <p className="mt-1">
              بيانات أقدم من توحيد الرقم الصريح: عُبّئ رقم ظهور{' '}
              {toArabicDigits(audit.migratedNarrators)} راويًا من ترتيب الطيبة القائم، فالظهور
              المعتاد لم يتغير. راجع الأرقام في تبويب «ترتيب الظهور» ثم احفظ لتثبيتها.
            </p>
          )}
          {audit.conflicts.length > 0 && (
            <p className="mt-1">
              تعارضات فُضّت بالأصغر معرفًا: {describeDisplayOrderConflicts(audit.conflicts)}.
            </p>
          )}
        </div>
      )}

      {tab === 'display-order' ? (
        <DisplayOrderManager catalog={catalog} onPersist={persistCatalog} />
      ) : tab === 'transmissions' ? (
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

  // سحب وإفلات لإعادة الترتيب (FR-ED-14): كل إفلات يعيد الترقيم 1..n صراحة.
  // أقران الراوي هم **كل الرواة** لا رواة إمامه، فسحبه داخل الكتالوج المتشعب
  // يأخذ موضع الهدف في الترتيب العام، والسحب بين قارئين مختلفين جائز.
  const [drag, setDrag] = useState<{ kind: 'IMAM' | 'NARRATOR' | 'PATH'; id: string; group?: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  /** هل يصلح هذا الإفلات؟ الطرق وحدها مقيّدة براويها لأن أقرانها داخله. */
  const canDropOn = (kind: 'IMAM' | 'NARRATOR' | 'PATH', group?: string) =>
    Boolean(drag) && drag!.kind === kind && (kind === 'NARRATOR' || drag!.group === group);

  const dropOn = (kind: 'IMAM' | 'NARRATOR' | 'PATH', targetId: string, group?: string) => {
    if (!canDropOn(kind, group) || drag!.id === targetId) {
      setDrag(null);
      setDropTarget(null);
      return;
    }
    if (kind === 'IMAM') {
      const toIndex = imams.findIndex((imam) => imam.id === targetId);
      onPersist({ ...catalog, imams: movePeer(catalog.imams, drag!.id, toIndex) }, 'أُعيد ترتيب القراء.');
    } else if (kind === 'NARRATOR') {
      const toIndex = narrators.findIndex((narrator) => narrator.id === targetId);
      onPersist(
        { ...catalog, narrators: movePeer(catalog.narrators, drag!.id, toIndex) },
        `أُعيد ترتيب الرواة: صار رقم ${narrators[toIndex]?.name ?? ''} للساحب.`
      );
    } else {
      const peers = catalog.paths.filter((path) => path.narratorId === group);
      const sorted = [...peers].sort((a, b) => a.order - b.order);
      const toIndex = sorted.findIndex((path) => path.id === targetId);
      onPersist({ ...catalog, paths: replacePeers(catalog.paths, movePeer(peers, drag!.id, toIndex)) }, 'أُعيد ترتيب الطرق.');
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
      if (!canDropOn(kind, group)) return;
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
                                <span className="cursor-grab select-none text-stone-300 hover:text-stone-500 active:cursor-grabbing" title="اسحب لتغيير ترتيب ظهور الراوي بين كل الرواة" aria-hidden>⠿</span>
                                <span className="flex h-7 min-w-7 items-center justify-center rounded bg-emerald-700 px-1 text-sm font-bold text-white" style={{ fontFamily: "'Amiri Quran', serif" }}>
                                  {narrator.symbol || '—'}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-stone-900">
                                    <span className="text-emerald-800">{toArabicDigits(narrator.order)}.</span> {narrator.name}
                                  </p>
                                  <p className="text-[11px] text-stone-500">
                                    ترتيب الظهور بين كل الرواة: {toArabicDigits(narrator.order)} · الطيبة (مرجع):{' '}
                                    {narrator.legacyOrderInTayyibah != null ? toArabicDigits(narrator.legacyOrderInTayyibah) : '—'}
                                  </p>
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
                                      <span className="block truncate text-[10px] text-stone-500">ترتيب الظهور {toArabicDigits(path.order)} · {path.code}</span>
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
      <TextInput label="رقم ترتيب الظهور" value={String(order)} onChange={(next) => setOrder(Number(next))} type="number" required />
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
  // رقم الترتيب الصريح للظهور: عام بين **كل الرواة**، لا داخل الإمام.
  const [order, setOrder] = useState(value?.order ?? catalog.narrators.length + 1);
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
      // ترتيب الطيبة مرجع تاريخي لا يُعاد توليده من رقم الظهور: يبقى كما حُفظ،
      // والجديد الذي لا أصل له في الطيبة يبقى بلا مرجع («—» في القائمة).
      legacyOrderInTayyibah: value?.legacyOrderInTayyibah,
      slug: slug.trim() || undefinedSlug(name),
    };
    // الأقران: كل الرواة (FR-ED-14). التعارض يُعرض كميا ثم يُحل بإزاحة.
    const resolved = await resolveOrderConflict(catalog.narrators, narrator, (peer) => peer.name);
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
    <div className="grid grid-cols-2 gap-2">
      <TextInput label="الرمز" value={symbol} onChange={setSymbol} placeholder="ب" />
      <TextInput
        label="رقم ترتيب الظهور"
        value={String(order)}
        onChange={(next) => setOrder(Number(next))}
        type="number"
        required
      />
    </div>
    <p className="rounded bg-stone-50 px-2.5 py-2 text-[11px] leading-relaxed text-stone-600">
      الرقم الصريح هو الذي يحكم ظهور الراوي في كل الواجهات: بجانب الأسطر، وفي محدد
      النطاقات، وفي التصفية، وفي ترتيب الأمة، وفي التصدير. الاسم والرمز لا يحكمان
      شيئا. ترتيب الطيبة المحفوظ لهذا الراوي:{' '}
      <strong>
        {value?.legacyOrderInTayyibah != null ? toArabicDigits(value.legacyOrderInTayyibah) : '—'}
      </strong>{' '}
      (مرجع تاريخي لا يتغير من هنا).
    </p>
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
      <TextInput label="رقم ترتيب الظهور" value={String(order)} onChange={(next) => setOrder(Number(next))} type="number" required />
    </div>
    <p className="text-[11px] leading-relaxed text-stone-500">
      رقم الطريق صريح بين طرق راويه، وموضعه العام مشتق من رقم راويه فلا يقفز طريق
      على راوٍ آخر. إن انفرد الطريق بالوجه يُطبع <strong>اسمه</strong> على السطر («الأزرق»). الرمز اختياري يظهر في الدليل
      والبطاقات. وإذا اجتمع طريقاه طُبع رمز الراوي.
    </p>
    <label className="flex items-center gap-2 text-xs text-stone-700">
      <input type="checkbox" checked={canonical} onChange={(event) => setCanonical(event.target.checked)} className="accent-emerald-600" />
      طريق معتمد في الكتالوج
    </label>
  </EntityForm>;
}

// ==================== ترتيب الظهور الصريح (FR-ED-14، DM-04) ====================
//
// هذه اللوحة هي المكان الوحيد الذي يُضبط فيه **رقم الظهور** لكل قارئ وراوٍ
// وطريق. القاعدة التي تنفذها:
//
//   • الرقم صريح وقابل للتحرير، ولا رقمان متساويان أبدًا: إدخال رقم مشغول
//     يعرض تسوية كمية («إدراج مع إزاحة») بتأكيد قبل أن يقع أي تغيير.
//   • السحب اختصار لكتابة الأرقام: كل إفلات يعيد ترقيم الأقران ١..ن صراحة،
//     فلا يُخزَّن «ترتيب قائمة» ضمني يمكن أن يختلف عن الأرقام.
//   • المعرّفات مقدسة: لا يتغير معرّف بتغيير الترتيب، ولا يتغير الترتيب
//     بتغيير الاسم أو الرمز.

/** صف واحد في قائمة ترتيب الظهور. */
interface OrderRow {
  id: string;
  /** الرقم الصريح الحالي. */
  order: number;
  label: string;
  note?: string;
  symbol?: string;
}

function DisplayOrderManager({
  catalog,
  onPersist,
}: {
  catalog: TransmissionCatalog;
  onPersist: (catalog: TransmissionCatalog, message: string) => void;
}) {
  const imams = useMemo(() => catalogImamsInOrder(catalog), [catalog]);
  const narrators = useMemo(() => catalogNarratorsInOrder(catalog), [catalog]);

  /** يكتب رقمًا صريحًا لأحد الأئمة مع فضّ التعارض بتأكيد كمي. */
  const setImamOrder = async (imam: ReadingImam, order: number) => {
    if (!Number.isFinite(order) || order < 1 || order === imam.order) return;
    const next = await resolveOrderConflict(
      catalog.imams,
      { ...imam, order: Math.round(order) },
      (peer) => peer.name
    );
    if (!next) return;
    onPersist({ ...catalog, imams: next }, `صار رقم ظهور القارئ ${imam.name}: ${toArabicDigits(Math.round(order))}.`);
  };

  const moveImam = (id: string, toIndex: number) => {
    onPersist({ ...catalog, imams: movePeer(catalog.imams, id, toIndex) }, 'أُعيدت أرقام ظهور القراء.');
  };

  /** يكتب رقمًا صريحًا لراوٍ بين **كل الرواة**. */
  const setNarratorOrder = async (narrator: Narrator, order: number) => {
    if (!Number.isFinite(order) || order < 1 || order === narrator.order) return;
    const next = await resolveOrderConflict(
      catalog.narrators,
      { ...narrator, order: Math.round(order) },
      (peer) => peer.name
    );
    if (!next) return;
    onPersist(
      { ...catalog, narrators: replacePeers(catalog.narrators, next) },
      `صار رقم ظهور الراوي ${narrator.name}: ${toArabicDigits(Math.round(order))}.`
    );
  };

  const moveNarrator = (id: string, toIndex: number) => {
    onPersist({ ...catalog, narrators: movePeer(catalog.narrators, id, toIndex) }, 'أُعيدت أرقام ظهور الرواة.');
  };

  /** يكتب رقمًا صريحًا لطريق بين طرق راويه. */
  const setPathOrder = async (path: TransmissionPath, order: number) => {
    if (!Number.isFinite(order) || order < 1 || order === path.order) return;
    const peers = catalog.paths.filter((item) => item.narratorId === path.narratorId);
    const next = await resolveOrderConflict(
      peers,
      { ...path, order: Math.round(order) },
      (peer) => peer.shortName
    );
    if (!next) return;
    onPersist(
      { ...catalog, paths: replacePeers(catalog.paths, next) },
      `صار رقم ظهور الطريق ${path.shortName}: ${toArabicDigits(Math.round(order))}.`
    );
  };

  const movePath = (path: TransmissionPath, toIndex: number) => {
    const peers = catalog.paths.filter((item) => item.narratorId === path.narratorId);
    onPersist(
      { ...catalog, paths: replacePeers(catalog.paths, movePeer(peers, path.id, toIndex)) },
      'أُعيدت أرقام ظهور الطرق.'
    );
  };

  /**
   * يعيد أرقام ظهور الرواة إلى ترتيب الطيبة المحفوظ.
   *
   * مرجع للطوارئ بعد تجارب إعادة الترتيب: لا يمسّ المعرّفات ولا الرموز ولا
   * الأسماء، ويطلب تأكيدًا كميا لأنه يعيد كتابة أرقام كل الرواة.
   */
  const restoreTayyibah = async () => {
    const withLegacy = catalog.narrators.filter((narrator) => narrator.legacyOrderInTayyibah != null);
    if (withLegacy.length === 0) return;
    const changed = withLegacy.filter((narrator) => narrator.order !== narrator.legacyOrderInTayyibah);
    const ok = await confirmAction({
      title: 'إعادة أرقام ظهور الرواة إلى ترتيب الطيبة',
      message:
        'يُكتب رقم كل راوٍ من ترتيب الطيبة المحفوظ له، وتُفضّ التعارضات بالأصغر معرفًا. المعرّفات والرموز والأسماء لا تتغير.',
      impacts: [
        { label: 'راوٍ سيتغير رقمه', count: changed.length },
        { label: 'راوٍ بلا ترتيب طيبة محفوظ (يبقى رقمه)', count: catalog.narrators.length - withLegacy.length },
      ],
      undoable: false,
      confirmLabel: 'استعادة ترتيب الطيبة',
    });
    if (!ok) return;

    const byId = new Map(withLegacy.map((narrator) => [narrator.id, narrator.legacyOrderInTayyibah!]));
    onPersist(
      {
        ...catalog,
        narrators: catalog.narrators.map((narrator) =>
          byId.has(narrator.id) ? { ...narrator, order: byId.get(narrator.id)! } : narrator
        ),
      },
      'أُعيدت أرقام ظهور الرواة إلى ترتيب الطيبة.'
    );
  };

  const imamRows: OrderRow[] = imams.map((imam) => ({
    id: imam.id,
    order: imam.order,
    label: imam.name,
    note: imam.region || imam.slug,
    symbol: imam.symbol,
  }));

  const narratorRows: OrderRow[] = narrators.map((narrator) => ({
    id: narrator.id,
    order: narrator.order,
    label: narrator.name,
    note: imams.find((imam) => imam.id === narrator.imamId)?.name ?? narrator.imamId,
    symbol: narrator.symbol,
  }));

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-950">
        <p className="font-semibold">الترتيب رقم صريح، لا اسم ولا تاريخ إضافة.</p>
        <p className="mt-1">
          الرقم المكتوب هنا هو الذي يحكم الظهور في كل الواجهات: بطاقات الرموز بجانب
          الأسطر، محدد النطاقات، التصفية بقارئ، ترتيب الأمة في التركيب، المصحف
          (/quran)، التتبع (/tracking)، وملف التصدير. تعديل الاسم أو الرمز أو إعداد
          العرض لا يحرّك أحدًا من موضعه؛ ولا يغيّر الترتيب إلا تغيير الرقم نفسه.
        </p>
        <p className="mt-1 text-emerald-800">
          أقران القارئ: كل القراء. أقران الراوي: **كل الرواة** (لا رواة إمامه). أقران
          الطريق: طرق راويه — وموضع الطريق العام مشتق من رقم راويه.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <OrderList
          title="ترتيب ظهور القراء (الأئمة)"
          hint="اسحب أو اكتب الرقم. إدخال رقم مشغول يعرض تسوية بإزاحة من بعده."
          rows={imamRows}
          onSetOrder={(id, order) => {
            const imam = catalog.imams.find((item) => item.id === id);
            if (imam) void setImamOrder(imam, order);
          }}
          onMove={(id, toIndex) => moveImam(id, toIndex)}
        />

        <div className="space-y-4">
          <OrderList
            title="ترتيب ظهور الرواة (بين كل الرواة)"
            hint="هذا هو ترتيب الأمة الذي تُفرَز به الأسطر والبطاقات."
            rows={narratorRows}
            onSetOrder={(id, order) => {
              const narrator = catalog.narrators.find((item) => item.id === id);
              if (narrator) void setNarratorOrder(narrator, order);
            }}
            onMove={(id, toIndex) => moveNarrator(id, toIndex)}
            extraAction={
              <SecondaryButton onClick={() => void restoreTayyibah()}>
                استعادة ترتيب الطيبة
              </SecondaryButton>
            }
          />
        </div>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-stone-900">ترتيب ظهور الطرق</h2>
          <p className="text-[11px] text-stone-500">
            الرقم داخل طرق الراوي الواحد؛ الموضع العام = رقم الراوي ثم رقم الطريق.
          </p>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {narrators.map((narrator) => {
            const rows: OrderRow[] = catalogPathsForNarrator(catalog, narrator.id).map((path) => ({
              id: path.id,
              order: path.order,
              label: path.shortName.split('/').pop()?.trim() || path.shortName,
              note: path.code,
              symbol: path.symbol,
            }));
            if (rows.length === 0) return null;
            return (
              <OrderList
                key={narrator.id}
                compact
                title={`${narrator.name} — ${toArabicDigits(rows.length)} طريقًا`}
                rows={rows}
                onSetOrder={(id, order) => {
                  const path = catalog.paths.find((item) => item.id === id);
                  if (path) void setPathOrder(path, order);
                }}
                onMove={(id, toIndex) => {
                  const path = catalog.paths.find((item) => item.id === id);
                  if (path) movePath(path, toIndex);
                }}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

/**
 * قائمة ترتيب واحدة: مقبض سحب، ورقم صريح قابل للتحرير، وسهمان للمس.
 *
 * الرقم يُحرَّر محليا ثم يُثبَّت عند Enter أو فقد التركيز، فلا يقفز الحقل
 * أثناء الكتابة ولا يُحفظ رقم ناقص.
 */
function OrderList({
  title,
  hint,
  rows,
  onSetOrder,
  onMove,
  extraAction,
  compact = false,
}: {
  title: string;
  hint?: string;
  rows: OrderRow[];
  onSetOrder: (id: string, order: number) => void;
  onMove: (id: string, toIndex: number) => void;
  extraAction?: React.ReactNode;
  compact?: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const indexById = new Map(rows.map((row, index) => [row.id, index]));

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDropId(null);
      return;
    }
    const toIndex = indexById.get(targetId);
    if (toIndex != null) onMove(dragId, toIndex);
    setDragId(null);
    setDropId(null);
  };

  return (
    <section
      className={`rounded-xl border border-stone-200 bg-white ${compact ? 'p-3' : 'p-4'}`}
      aria-label={title}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-stone-900`}>{title}</h2>
        {extraAction}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-stone-500">{hint}</p>}

      <ul className="mt-2 space-y-1">
        {rows.map((row) => {
          const index = indexById.get(row.id) ?? 0;
          const isDragging = dragId === row.id;
          const isTarget = dropId === row.id && dragId !== row.id;
          return (
            <li
              key={row.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                setDragId(row.id);
              }}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                setDropId(row.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                drop(row.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropId(null);
              }}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                isTarget
                  ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300'
                  : 'border-stone-200 bg-white hover:bg-stone-50'
              } ${isDragging ? 'opacity-50' : ''}`}
            >
              <span
                className="cursor-grab select-none text-stone-300 hover:text-stone-600 active:cursor-grabbing"
                title="اسحب لكتابة أرقام ترتيب جديدة"
                aria-hidden
              >
                ⠿
              </span>

              <OrderNumberInput value={row.order} onCommit={(order) => onSetOrder(row.id, order)} />

              {row.symbol && (
                <span
                  className="flex h-6 min-w-6 items-center justify-center rounded bg-stone-800 px-1 text-xs font-bold text-white"
                  style={{ fontFamily: "'Amiri Quran', serif" }}
                  title="الرمز لا يحكم الترتيب"
                >
                  {row.symbol}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className={`block truncate font-medium text-stone-900 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                  {row.label}
                </span>
                {row.note && (
                  <span className="block truncate text-[10px] text-stone-500">{row.note}</span>
                )}
              </span>

              <span className="flex shrink-0 flex-col">
                <button
                  type="button"
                  aria-label={`تقديم ${row.label}`}
                  disabled={index === 0}
                  onClick={() => onMove(row.id, index - 1)}
                  className="rounded px-1 text-[10px] leading-none text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-25"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`تأخير ${row.label}`}
                  disabled={index === rows.length - 1}
                  onClick={() => onMove(row.id, index + 1)}
                  className="rounded px-1 text-[10px] leading-none text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-25"
                >
                  ▼
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && <p className="mt-2 text-[11px] text-stone-500">لا عناصر.</p>}
    </section>
  );
}

/**
 * حقل الرقم الصريح.
 *
 * يحتفظ بمسودة محلية أثناء الكتابة ويثبّتها عند Enter/فقد التركيز، ويعيد
 * المسودة إلى القيمة المحفوظة إن أُهملت، فلا يبقى في الواجهة رقم لا يطابق
 * البيانات (وهو جوهر «الترتيب رقم صريح»).
 */
function OrderNumberInput({ value, onCommit }: { value: number; onCommit: (order: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    // الأرقام العربية مقبولة في الحقل كما في كل واجهة المشروع.
    const normalized = draft.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraft(String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
    else setDraft(String(value));
  };

  return (
    <input
      type="number"
      min={1}
      inputMode="numeric"
      value={draft}
      aria-label="رقم ترتيب الظهور"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') setDraft(String(value));
      }}
      className="h-7 w-14 shrink-0 rounded border border-stone-300 bg-white px-1 text-center text-xs tabular-nums text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
    />
  );
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

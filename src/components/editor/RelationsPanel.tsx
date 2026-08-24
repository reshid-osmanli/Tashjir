// لوحة العلاقات والأجزاء والترتيب - Relations Panel
//
// هذه اللوحة هي «غرفة التحكم اليدوي» في نتيجة المحرك:
//
//   1. الأوجه المركبة: يختار المحقق وجها ويقرر أنه مرتبط/متفق مع وجه آخر —
//      من أي قارئ كان. كان هذا التركيب حكرا على المحرك، وصار قرار المحرر.
//   2. ربط السطر بالسطر: دمج سطرين في تركيب واحد (السطر ١٠ مع السطر ٢٥ مثلا).
//   3. الأجزاء: Line→Segment→Rule — جزء من كلمات الآية يُعزل ثم يُربط بسطر
//      آخر أو بقاعدة فيه، دون إنشاء سطر جديد كامل.
//   4. ترتيب الأسطر: تعديل رقم ترتيب الصف مباشرة بإزاحة المتأثرين تلقائيا.
//
// كل ما يُنشأ هنا يُحفظ في المستند ويظهر في JSON، ويُسجَّل في سجل التعديل،
// وينعكس فورا على لوحة الرسم وصفحة المصحف.

'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor } from '@/lib/tashjeer/color-system';
import { shiftLineInOrder, orderSnapshotOf, coalesceLineOrder } from '@/lib/tashjeer/manual-links';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import type { VariantCategory } from '@/types';
import type {
  LinkEndpoint,
  LineSegment,
  TashjeerLink,
  TashjeerLinkKind,
  TashjeerLinkRelation,
} from '@/types/tashjeer';
import type { ClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';

type LinkTab = 'FACE' | 'LINE' | 'SEGMENT' | 'ORDER';

const TABS: Array<{ id: LinkTab; label: string; hint: string }> = [
  { id: 'FACE', label: 'وجه ↔ وجه', hint: 'الأوجه المركبة: هذا الوجه متفق مع وجه آخر، أيا كان قارئه.' },
  { id: 'LINE', label: 'سطر ↔ سطر', hint: 'دمج سطرين مختلفين في تركيب واحد.' },
  { id: 'SEGMENT', label: 'جزء → قاعدة', hint: 'جزء محدد من الآية يُربط بسطر أو قاعدة في سطر آخر.' },
  { id: 'ORDER', label: 'ترتيب الأسطر', hint: 'تعديل رقم ترتيب الصف مباشرة بإزاحة المتأثرين.' },
];

export function RelationsPanel() {
  const document = useEditorStore((state) => state.document);
  const filter = useEditorStore((state) => state.filter);
  const catalog = useTransmissionCatalog();
  const engine = useEngineSettings();
  const strengthDegrees = useStrengthDegrees();
  const { classic } = useAyahTashjeer(document, filter, {}, { catalog, engine, strengthDegrees });
  const [tab, setTab] = useState<LinkTab>('FACE');

  if (!document) return null;

  return (
    <section className="border-b border-stone-200 px-4 py-3">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-stone-900">
        العلاقات والتحكم اليدوي
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
          تصحيح المحرك
        </span>
      </h3>

      <div className="mb-2 flex flex-wrap gap-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md border px-2 py-1 text-[10.5px] transition-colors ${
              tab === item.id
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[10px] leading-relaxed text-stone-500">
        {TABS.find((item) => item.id === tab)?.hint}
      </p>

      {tab === 'FACE' && <FaceLinkEditor classic={classic} />}
      {tab === 'LINE' && <LineLinkEditor classic={classic} />}
      {tab === 'SEGMENT' && <SegmentEditor classic={classic} />}
      {tab === 'ORDER' && <LineOrderEditor classic={classic} />}

      <LinksList links={document.links ?? []} segments={document.segments ?? []} classic={classic} />
    </section>
  );
}

// ==================== وجها بوجه: الأوجه المركبة ====================

function FaceLinkEditor({ classic }: { classic: ClassicTashjeer }) {
  const document = useEditorStore((state) => state.document);
  const addLink = useEditorStore((state) => state.addLink);
  const variants = useMemo(
    () => (document ? getEffectiveVariants(document) : []),
    [document]
  );

  const faces = useMemo(
    () =>
      variants.flatMap((variant) =>
        variant.alternatives
          .filter((alternative) => !alternative.isBase)
          .map((alternative) => ({
            key: `${variant.id}::${alternative.id}`,
            variantId: variant.id,
            alternativeId: alternative.id,
            label: `${variant.title} — ${alternative.label}`,
            category: variant.category,
          }))
      ),
    [variants]
  );

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (faces.length < 2) {
    return (
      <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-[11px] text-stone-600">
        يلزم وجهان على الأقل في هذه الآية لإنشاء تركيب. سجّل اختلافا آخر ثم عُد.
      </p>
    );
  }

  const submit = () => {
    if (!from || !to || from === to) {
      setError('اختر وجهين مختلفين.');
      return;
    }
    addLink({
      kind: 'FACE_TO_FACE',
      relation,
      from: { type: 'FACE', id: from },
      to: { type: 'FACE', id: to },
      notes,
    });
    setTo('');
    setNotes('');
    setError('');
  };

  return (
    <div className="space-y-2 rounded-md border border-stone-200 p-2.5">
      <FaceSelect faces={faces} value={from} onChange={setFrom} label="الوجه الأساسي" />
      <FaceSelect faces={faces} value={to} onChange={setTo} label="الوجه المرتبط به" />
      <RelationSelect value={relation} onChange={setRelation} />
      <NotesInput value={notes} onChange={setNotes} placeholder="مثال: هذان الوجهان يقرآن معا في أداء واحد." />
      {error && <p className="text-[10px] text-rose-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        className="w-full rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
      >
        {relation === 'MERGE' ? 'إنشاء الوجه المركب' : 'تسجيل العلاقة'}
      </button>
      <p className="text-[10px] leading-relaxed text-stone-500">
        لا يشترط اتحاد القارئ: الوجهان قد يكونان من راويين مختلفين، فالقرار قرار المحقق.
        {' '}{classic.appliedLinkIds.merge.length > 0 && 'الروابط المدمجة ظاهرة في اللوحة الآن.'}
      </p>
    </div>
  );
}

function FaceSelect({
  faces,
  value,
  onChange,
  label,
}: {
  faces: Array<{ key: string; label: string; category: VariantCategory }>;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium text-stone-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input h-8 py-0 text-[11px]">
        <option value="">— اختر وجها —</option>
        {faces.map((face) => (
          <option key={face.key} value={face.key}>
            [{CATEGORY_LABELS[face.category]}] {face.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ==================== سطر بسطر: الدمج المنطقي ====================

function LineLinkEditor({ classic }: { classic: ClassicTashjeer }) {
  const addLink = useEditorStore((state) => state.addLink);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (classic.lines.length < 2) {
    return (
      <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-[11px] text-stone-600">
        يلزم سطران معروضان على الأقل لإجراء الدمج. لا أسطر كافية في العرض الحالي.
      </p>
    );
  }

  const submit = () => {
    if (!from || !to || from === to) {
      setError('اختر سطرين مختلفين.');
      return;
    }
    addLink({
      kind: 'LINE_TO_LINE',
      relation,
      from: { type: 'LINE', id: from },
      to: { type: 'LINE', id: to },
      notes,
    });
    setFrom('');
    setTo('');
    setNotes('');
    setError('');
  };

  return (
    <div className="space-y-2 rounded-md border border-stone-200 p-2.5">
      <LineSelect lines={classic.lines} value={from} onChange={setFrom} label="السطر الأول" />
      <LineSelect lines={classic.lines} value={to} onChange={setTo} label="السطر المدمج به" />
      <RelationSelect value={relation} onChange={setRelation} />
      <NotesInput value={notes} onChange={setNotes} placeholder="مثال: السطر ١٠ مرتبط بالسطر ٢٥ — تركيب واحد." />
      {error && <p className="text-[10px] text-rose-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        className="w-full rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
      >
        {relation === 'MERGE' ? 'دمج السطرين' : 'تسجيل العلاقة'}
      </button>
    </div>
  );
}

function LineSelect({
  lines,
  value,
  onChange,
  label,
}: {
  lines: ClassicTashjeer['lines'];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium text-stone-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input h-8 py-0 text-[11px]">
        <option value="">— اختر سطرا —</option>
        {lines.map((line, index) => (
          <option key={line.id} value={line.id}>
            {toArabicDigits(index + 1)}. {line.label} · {line.ruleLabel.slice(0, 40)}
          </option>
        ))}
      </select>
    </label>
  );
}

// ==================== الأجزاء: Line → Segment → Rule ====================

function SegmentEditor({ classic }: { classic: ClassicTashjeer }) {
  const document = useEditorStore((state) => state.document);
  const markedPositions = useEditorStore((state) => state.markedPositions);
  const markedCharacters = useEditorStore((state) => state.markedCharacters);
  const addSegment = useEditorStore((state) => state.addSegment);
  const addLink = useEditorStore((state) => state.addLink);

  const variants = useMemo(
    () => (document ? getEffectiveVariants(document) : []),
    [document]
  );

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const [targetType, setTargetType] = useState<'LINE' | 'RULE'>('LINE');
  const [targetId, setTargetId] = useState('');
  const [relation, setRelation] = useState<TashjeerLinkRelation>('MERGE');

  const effectiveStart = start || (markedPositions.length ? String(Math.min(...markedPositions)) : '');
  const effectiveEnd = end || (markedPositions.length ? String(Math.max(...markedPositions)) : '');

  const create = () => {
    const startPosition = Number(effectiveStart);
    const endPosition = Number(effectiveEnd);
    if (!title.trim() || !Number.isFinite(startPosition) || !Number.isFinite(endPosition)) {
      setError('اكتب عنوان الجزء وحدد مداه (علّم الكلمات في اللوحة أو اكتب الرقمين).');
      return;
    }
    if (endPosition < startPosition || startPosition < 1) {
      setError('مدى الجزء غير صالح.');
      return;
    }

    const characterRange =
      markedCharacters.length >= 2
        ? {
            start: {
              position: Math.min(...markedCharacters.map((anchor) => anchor.position)),
              characterIndex: Math.min(...markedCharacters.map((anchor) => anchor.characterIndex)),
            },
            end: {
              position: Math.max(...markedCharacters.map((anchor) => anchor.position)),
              characterIndex: Math.max(...markedCharacters.map((anchor) => anchor.characterIndex)),
            },
          }
        : undefined;

    const segment = addSegment({
      title,
      startPosition,
      endPosition,
      characterRange,
      notes,
    });
    if (!segment) return;

    if (targetId) {
      addLink({
        kind: targetType === 'LINE' ? 'SEGMENT_TO_LINE' : 'SEGMENT_TO_RULE',
        relation,
        from: { type: 'SEGMENT', id: segment.id },
        to: targetType === 'LINE' ? { type: 'LINE', id: targetId } : { type: 'RULE', id: targetId },
        notes,
      });
    }

    setTitle('');
    setNotes('');
    setError('');
  };

  return (
    <div className="space-y-2 rounded-md border border-stone-200 p-2.5">
      <label className="block">
        <span className="mb-0.5 block text-[10px] font-medium text-stone-600">عنوان الجزء</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="input h-8 py-0 text-[11px]" placeholder="مثال: صلة الهاء في «عندهِ»" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-medium text-stone-600">من كلمة رقم</span>
          <input
            type="number"
            min={1}
            value={effectiveStart}
            onChange={(event) => setStart(event.target.value)}
            className="input h-8 py-0 text-[11px]"
            placeholder={markedPositions.length ? toArabicDigits(Math.min(...markedPositions)) : '١'}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-medium text-stone-600">إلى كلمة رقم</span>
          <input
            type="number"
            min={1}
            value={effectiveEnd}
            onChange={(event) => setEnd(event.target.value)}
            className="input h-8 py-0 text-[11px]"
            placeholder={markedPositions.length ? toArabicDigits(Math.max(...markedPositions)) : '١'}
          />
        </label>
      </div>

      {markedCharacters.length >= 2 && (
        <p className="rounded bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">
          مدى حرفي معلَّم: {toArabicDigits(markedCharacters[0].position)}/
          {toArabicDigits(markedCharacters[0].characterIndex)} —{' '}
          {toArabicDigits(markedCharacters[markedCharacters.length - 1].position)}/
          {toArabicDigits(markedCharacters[markedCharacters.length - 1].characterIndex)}
        </p>
      )}
      {markedPositions.length > 0 && markedCharacters.length < 2 && (
        <p className="rounded bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">
          كلمات معلَّمة: {markedPositions.map((position) => toArabicDigits(position)).join('، ')} — تُستخدم مدى للجزء.
        </p>
      )}

      <div className="rounded border border-stone-200 p-2">
        <p className="mb-1 text-[10px] font-semibold text-stone-700">ربط الجزء (يمكن لاحقا من قائمة العلاقات)</p>
        <div className="mb-1.5 flex gap-1">
          <button
            type="button"
            onClick={() => setTargetType('LINE')}
            className={`flex-1 rounded border px-2 py-1 text-[10px] ${targetType === 'LINE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600'}`}
          >
            بسطر آخر
          </button>
          <button
            type="button"
            onClick={() => setTargetType('RULE')}
            className={`flex-1 rounded border px-2 py-1 text-[10px] ${targetType === 'RULE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600'}`}
          >
            بقاعدة في سطر آخر
          </button>
        </div>
        {targetType === 'LINE' ? (
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="input h-8 py-0 text-[11px]">
            <option value="">— بلا رابط الآن —</option>
            {classic.lines.map((line, index) => (
              <option key={line.id} value={line.id}>
                {toArabicDigits(index + 1)}. {line.label} · {line.ruleLabel.slice(0, 30)}
              </option>
            ))}
          </select>
        ) : (
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="input h-8 py-0 text-[11px]">
            <option value="">— بلا رابط الآن —</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                [{CATEGORY_LABELS[variant.category]}] {variant.title}
              </option>
            ))}
          </select>
        )}
        {targetId && <div className="mt-1.5"><RelationSelect value={relation} onChange={setRelation} compact /></div>}
      </div>

      <NotesInput value={notes} onChange={setNotes} placeholder="ملاحظة على الجزء (اختياري)." />
      {error && <p className="text-[10px] text-rose-700">{error}</p>}
      <button
        type="button"
        onClick={create}
        className="w-full rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
      >
        إنشاء الجزء{targetId ? ' وربطه' : ''}
      </button>
    </div>
  );
}

// ==================== ترتيب الأسطر اليدوي ====================

function LineOrderEditor({ classic }: { classic: ClassicTashjeer }) {
  const document = useEditorStore((state) => state.document);
  const setLineOrder = useEditorStore((state) => state.setLineOrder);
  const moveLineInOrder = useEditorStore((state) => state.moveLineInOrder);
  const resetLineOrder = useEditorStore((state) => state.resetLineOrder);
  const addLink = useEditorStore((state) => state.addLink);

  // الترتيب الجاري: ما حفظه المستند إن وجد، مكمَّلا بأسطر المحرك الحالية.
  const savedOrder = document?.lineOrder;
  const engineOrder = useMemo(() => orderSnapshotOf(classic.lines), [classic.lines]);
  const hasManualOrder = (savedOrder?.length ?? 0) > 0;
  const workingOrder = useMemo(
    () => coalesceLineOrder(hasManualOrder ? savedOrder : undefined, engineOrder),
    [hasManualOrder, savedOrder, engineOrder]
  );

  // عرض بترتيب العمل حتى تطابق مؤشرات السحب مواضع العرض الفعلية (FR-ED-04).
  const lineById = useMemo(() => new Map(classic.lines.map((line) => [line.id, line])), [classic.lines]);
  const orderedLines = useMemo(
    () =>
      workingOrder
        .map((id) => lineById.get(id))
        .filter((line): line is ClassicTashjeer['lines'][number] => Boolean(line)),
    [workingOrder, lineById]
  );

  // حالة السحب: المعرّف المسحوب، وموضع مؤشر الإدراج.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // سحب الدمج: مقبض مخصص يُسحب فوق سطر آخر لدمجهما (FR-ED-05).
  const [mergeDragId, setMergeDragId] = useState<string | null>(null);

  const clearDrag = () => {
    setDraggingId(null);
    setDropIndex(null);
    setMergeDragId(null);
  };

  /** ملخّص موجز للسطر لرسالة التأكيد. */
  const lineSummary = (id: string): string => {
    const line = lineById.get(id);
    return line ? `${line.label}` : id;
  };

  /** ينفّذ النقل بعد تأكيد كمي (FR-ED-04.2)، ولا يغيّر شيئًا عند الإلغاء. */
  const commitDrop = (targetIndex: number) => {
    if (!draggingId) {
      clearDrag();
      return;
    }
    const fromIndex = workingOrder.indexOf(draggingId);
    if (fromIndex === -1 || fromIndex === targetIndex || fromIndex === targetIndex - 1) {
      clearDrag();
      return;
    }
    const before = targetIndex > 0 ? lineSummary(workingOrder[targetIndex - 1]) : null;
    const after = targetIndex < workingOrder.length ? lineSummary(workingOrder[targetIndex]) : null;
    const positionHint = before && after ? `بين «${before}» و«${after}»` : before ? `بعد «${before}»` : after ? `قبل «${after}»` : 'في الطرف';
    const confirmed = window.confirm(`نقل السطر «${lineSummary(draggingId)}» إلى هذا الموضع؟ (${positionHint})`);
    if (confirmed) {
      moveLineInOrder(workingOrder, draggingId, targetIndex);
    }
    clearDrag();
  };

  /** ينفّذ دمج سطرين بعد تأكيد، فوق نموذج البيانات الموحّد (Relation: MERGE) — FR-ED-05. */
  const commitMerge = (toId: string) => {
    const fromId = mergeDragId;
    clearDrag();
    if (!fromId || fromId === toId) return;
    const confirmed = window.confirm(`دمج السطر «${lineSummary(fromId)}» مع السطر «${lineSummary(toId)}»؟`);
    if (confirmed) {
      addLink({
        kind: 'LINE_TO_LINE',
        relation: 'MERGE',
        from: { type: 'LINE', id: fromId },
        to: { type: 'LINE', id: toId },
        notes: 'دمج بالسحب من المحرر',
      });
    }
  };

  const orderForIndex = (lineId: string): number => {
    const index = workingOrder.indexOf(lineId);
    return index === -1 ? engineOrder.indexOf(lineId) + 1 : index + 1;
  };

  if (classic.lines.length === 0) {
    return (
      <p className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-[11px] text-stone-600">
        لا أسطر معروضة في هذه الآية بعد.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-stone-200 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-stone-700">
          {hasManualOrder ? 'ترتيب يدوي مثبَّت' : 'ترتيب المحرك (لم يُعدَّل)'}
        </p>
        {hasManualOrder && (
          <button
            type="button"
            onClick={resetLineOrder}
            className="rounded border border-stone-300 px-2 py-0.5 text-[10px] text-stone-600 hover:bg-stone-50"
          >
            عودة لترتيب المحرك
          </button>
        )}
      </div>

      <ol className="max-h-72 space-y-1 overflow-y-auto">
        {orderedLines.map((line, index) => {
          const currentOrder = orderForIndex(line.id);
          const isDragging = draggingId === line.id;
          const isMergeTarget = Boolean(mergeDragId) && mergeDragId !== line.id;
          const showIndicatorBefore = dropIndex === index && !mergeDragId;
          return (
            <li key={line.id}>
              {showIndicatorBefore && (
                <div className="mb-0.5 h-0.5 rounded-full bg-emerald-500" aria-hidden />
              )}
              <div
                className={`flex items-center gap-1.5 rounded border bg-white px-2 py-1.5 transition ${
                  isMergeTarget
                    ? 'border-violet-400 bg-violet-50'
                    : isDragging
                      ? 'border-emerald-400 opacity-50'
                      : 'border-stone-100'
                }`}
                draggable
                onDragStart={(event) => {
                  setDraggingId(line.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', line.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = mergeDragId ? 'link' : 'move';
                  if (mergeDragId) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const before = event.clientY < rect.top + rect.height / 2;
                  setDropIndex(before ? index : index + 1);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (mergeDragId) {
                    commitMerge(line.id);
                    return;
                  }
                  commitDrop(dropIndex ?? index);
                }}
                onDragEnd={clearDrag}
              >
              <span
                className="cursor-grab shrink-0 text-stone-300 hover:text-stone-500 active:cursor-grabbing"
                title="اسحب لإعادة الترتيب (مع تأكيد)"
                aria-hidden
              >
                ⠿
              </span>
              <span
                className="cursor-grab shrink-0 text-violet-400 hover:text-violet-600 active:cursor-grabbing"
                title="مقبض الدمج: اسحب فوق سطر آخر لدمجهما (مع تأكيد)"
                draggable
                onDragStart={(event) => {
                  event.stopPropagation();
                  setMergeDragId(line.id);
                  setDraggingId(null);
                  setDropIndex(null);
                  event.dataTransfer.effectAllowed = 'link';
                  event.dataTransfer.setData('text/plain', `merge:${line.id}`);
                }}
                aria-label={`مقبض دمج السطر ${line.label}`}
              >
                ⛓
              </span>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getCategoryColor(line.category) }}
                title={CATEGORY_LABELS[line.category]}
              />
              <input
                type="number"
                min={1}
                max={classic.lines.length}
                value={currentOrder}
                onChange={(event) => {
                  const target = Number(event.target.value);
                  if (!Number.isFinite(target)) return;
                  moveLineInOrder(workingOrder, line.id, target);
                }}
                className="h-6 w-11 shrink-0 rounded border border-stone-300 bg-white px-1 text-center text-[11px] tabular-nums"
                aria-label={`ترتيب السطر ${line.label}`}
              />
              <button
                type="button"
                onClick={() => {
                  setLineOrder(shiftLineInOrder(workingOrder, line.id, -1));
                }}
                className="rounded border border-stone-200 px-1.5 text-[10px] text-stone-600 hover:bg-stone-50"
                title="أعلى"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => {
                  setLineOrder(shiftLineInOrder(workingOrder, line.id, 1));
                }}
                className="rounded border border-stone-200 px-1.5 text-[10px] text-stone-600 hover:bg-stone-50"
                title="أسفل"
              >
                ↓
              </button>
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-stone-700" title={line.ruleLabel}>
                {line.label} · {line.ruleLabel}
              </span>
              {(line.linkIds?.length ?? 0) > 0 && (
                <span className="shrink-0 rounded bg-violet-100 px-1 text-[9px] text-violet-800">
                  {toArabicDigits(line.linkIds?.length ?? 0)} رابطا
                </span>
              )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-[10px] leading-relaxed text-stone-500">
        تغيير رقم سطر يُزحزح الصفوف المتأثرة تلقائيا (إدخال لا استبدال)، فلا يتلف الترتيب ولا
        العلاقات المرتبطة بالأسطر.
      </p>
    </div>
  );
}

// ==================== قائمة العلاقات القائمة ====================

const KIND_LABELS: Record<TashjeerLinkKind, string> = {
  FACE_TO_FACE: 'وجه ↔ وجه',
  LINE_TO_LINE: 'سطر ↔ سطر',
  SEGMENT_TO_LINE: 'جزء → سطر',
  SEGMENT_TO_RULE: 'جزء → قاعدة',
};

const RELATION_LABELS: Record<TashjeerLinkRelation, string> = {
  MERGE: 'دمج في سطر واحد',
  REFERENCE: 'ربط مرجعي',
};

function LinksList({
  links,
  segments,
  classic,
}: {
  links: TashjeerLink[];
  segments: LineSegment[];
  classic: ClassicTashjeer;
}) {
  const deleteLink = useEditorStore((state) => state.deleteLink);
  const updateLink = useEditorStore((state) => state.updateLink);
  const deleteSegment = useEditorStore((state) => state.deleteSegment);
  const segmentTitles = new Map(segments.map((segment) => [segment.id, segment.title]));

  if (links.length === 0 && segments.length === 0) return null;

  const describe = (endpoint: LinkEndpoint): string => {
    if (endpoint.type === 'SEGMENT') {
      return `جزء «${segmentTitles.get(endpoint.id) ?? 'محذوف'}»`;
    }
    return `${endpoint.type === 'FACE' ? 'وجه' : endpoint.type === 'LINE' ? 'سطر' : 'قاعدة'} ${shortId(endpoint.id)}`;
  };

  return (
    <div className="mt-3 rounded-md border border-stone-200 bg-stone-50/60 p-2.5">
      <p className="mb-1.5 text-[10px] font-semibold text-stone-700">
        العلاقات والأجزاء المسجلة ({toArabicDigits(links.length + segments.length)})
      </p>
      <ul className="space-y-1.5">
        {links.map((link) => {
          const active =
            classic.appliedLinkIds.merge.includes(link.id) ||
            classic.appliedLinkIds.reference.includes(link.id);
          return (
            <li key={link.id} className="rounded border border-stone-200 bg-white px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-medium text-stone-800">
                    {KIND_LABELS[link.kind]} · {RELATION_LABELS[link.relation]}
                  </p>
                  <p className="truncate text-[10px] text-stone-600" title={`${describe(link.from)} → ${describe(link.to)}`}>
                    {describe(link.from)} ← {describe(link.to)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                    title={active ? 'مطبقة في العرض الحالي' : 'غير مطبقة: طرفها غير ظاهر'}
                  >
                    {active ? 'مفعّلة' : 'معلّقة'}
                  </span>
                  {link.relation === 'MERGE' ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateLink(link.id, { relation: 'REFERENCE' })
                      }
                      className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-600 hover:bg-stone-50"
                      title="تحويلها إلى ربط مرجعي دون دمج"
                    >
                      فك الدمج
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateLink(link.id, { relation: 'MERGE' })}
                      className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-600 hover:bg-stone-50"
                      title="تحويلها إلى دمج في سطر واحد"
                    >
                      دمج
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteLink(link.id)}
                    className="rounded border border-rose-200 px-1.5 py-0.5 text-[9px] text-rose-700 hover:bg-rose-50"
                  >
                    حذف
                  </button>
                </div>
              </div>
              {link.notes && <p className="mt-0.5 text-[9.5px] text-stone-500">{link.notes}</p>}
            </li>
          );
        })}

        {segments.map((segment) => (
          <li key={segment.id} className="rounded border border-stone-200 bg-white px-2 py-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10.5px] font-medium text-stone-800">
                  جزء: {segment.title}
                </p>
                <p className="text-[10px] text-stone-600">
                  الكلمات {toArabicDigits(segment.startPosition)}–{toArabicDigits(segment.endPosition)}
                  {segment.characterRange
                    ? ` · حروف ${toArabicDigits(segment.characterRange.start.position)}/${toArabicDigits(segment.characterRange.start.characterIndex)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteSegment(segment.id)}
                className="shrink-0 rounded border border-rose-200 px-1.5 py-0.5 text-[9px] text-rose-700 hover:bg-rose-50"
              >
                حذف
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function shortId(id: string): string {
  return id.length > 28 ? `${id.slice(0, 25)}…` : id;
}

// ==================== عناصر مشتركة ====================

function RelationSelect({
  value,
  onChange,
  compact = false,
}: {
  value: TashjeerLinkRelation;
  onChange: (value: TashjeerLinkRelation) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex gap-1 ${compact ? '' : 'mt-0.5'}`}>
      <button
        type="button"
        onClick={() => onChange('MERGE')}
        className={`flex-1 rounded border px-2 py-1 text-[10px] ${
          value === 'MERGE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600'
        }`}
      >
        دمج في سطر واحد
      </button>
      <button
        type="button"
        onClick={() => onChange('REFERENCE')}
        className={`flex-1 rounded border px-2 py-1 text-[10px] ${
          value === 'REFERENCE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600'
        }`}
      >
        ربط مرجعي فقط
      </button>
    </div>
  );
}

function NotesInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium text-stone-600">ملاحظة (اختياري)</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="input h-8 py-0 text-[11px]" placeholder={placeholder} />
    </label>
  );
}

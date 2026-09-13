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

import { confirmAction } from '@/lib/ui/confirm-store';
import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import { useAyahTashjeer } from '@/hooks/useAyahTashjeer';
import { useTransmissionCatalog } from '@/hooks/useTransmissionCatalog';
import { useEngineSettings } from '@/hooks/useEngineSettings';
import { useEngineConfig } from '@/hooks/useEngineConfig';
import { useStrengthDegrees } from '@/hooks/useStrengthDegrees';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { LineOrderEditor } from './LineOrderEditor';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { ScrollableList } from '@/components/ui/ScrollableList';
import { selectElement } from '@/lib/editor/selection-store';
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
  const engineConfig = useEngineConfig();
  const strengthDegrees = useStrengthDegrees();
  const { classic } = useAyahTashjeer(document, filter, {}, { catalog, engine, strengthDegrees, engineConfig });
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

      <LinkDecisionNoticeCard />

      {tab === 'FACE' && <FaceLinkEditor classic={classic} />}
      {tab === 'LINE' && <LineLinkEditor classic={classic} />}
      {tab === 'SEGMENT' && <SegmentEditor classic={classic} />}
      {tab === 'ORDER' && <LineOrderEditor classic={classic} />}

      <LinksList links={document.links ?? []} segments={document.segments ?? []} classic={classic} />
    </section>
  );
}

// ==================== قرار الرابط من Decision Resolver ====================

/**
 * يعرض آخر قرار أصدره Decision Resolver على رابط يدوي: رفض بقاعدة حاظرة،
 * أو قبول بتحذير مخالفة مصفوفة الدمج، مع أثر القرار (Why؟). الواجهة تعرض
 * فقط ولا تحسم (P-07).
 */
function LinkDecisionNoticeCard() {
  const notice = useEditorStore((state) => state.lastLinkDecision);
  const clear = useEditorStore((state) => state.clearLinkDecision);
  const [showTrace, setShowTrace] = useState(false);

  if (!notice) return null;
  if (notice.allowed && !notice.warning) return null;

  const tone = notice.allowed
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-red-300 bg-red-50 text-red-900';

  return (
    <div className={`mb-2 rounded-md border px-2.5 py-2 text-[10.5px] leading-relaxed ${tone}`} role="status">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">
          {notice.allowed ? 'سُجّل الرابط بخلاف سياسة المحرك' : 'رفض الرابط بقاعدة من سياسات المحرك'}
        </p>
        <button type="button" onClick={clear} className="text-[10px] underline opacity-70 hover:opacity-100">
          إخفاء
        </button>
      </div>
      <p className="mt-0.5">{notice.warning ?? notice.reason}</p>
      {notice.appliedRuleNames.length > 0 && (
        <p className="mt-0.5 opacity-80">القواعد المطابقة: {notice.appliedRuleNames.join('، ')}</p>
      )}
      <button
        type="button"
        onClick={() => setShowTrace((current) => !current)}
        className="mt-1 text-[10px] underline opacity-80 hover:opacity-100"
      >
        {showTrace ? 'إخفاء الأثر' : 'لماذا؟ (أثر القرار)'}
      </button>
      {showTrace && (
        <ol className="mt-1 space-y-0.5 border-t border-current/20 pt-1">
          {notice.trace.map((step, index) => (
            <li key={index} className="flex gap-2">
              <span className="font-mono text-[9px] opacity-60">{step.stage}</span>
              <span>{step.message}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
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
  // اختيار وجه من لوحة العلاقات يجعله هو العنصر النشط عالميًا (FR-ED-02).
  const handleChange = (key: string) => {
    onChange(key);
    const [variantId, alternativeId] = key.split('::');
    if (variantId && alternativeId) selectElement({ kind: 'FACE', id: alternativeId, differenceId: variantId, faceId: alternativeId });
  };
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium text-stone-600">{label}</span>
      <select value={value} onChange={(event) => handleChange(event.target.value)} className="input h-8 py-0 text-[11px]">
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
  // اختيار سطر من لوحة العلاقات يجعله هو العنصر النشط عالميًا: تنتقل اللوحة
  // إليه وتميّزه، وتميّزه كل اللوحات المفتوحة (AC-06).
  const handleChange = (lineId: string) => {
    onChange(lineId);
    const line = lines.find((item) => item.id === lineId);
    if (line) selectElement({ kind: 'LINE', id: line.id, lineId: line.id, differenceId: line.variantId, position: line.startPosition });
  };
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium text-stone-600">{label}</span>
      <select value={value} onChange={(event) => handleChange(event.target.value)} className="input h-8 py-0 text-[11px]">
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
          <select
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value);
              // معاينة السطر الهدف في اللوحة وكل اللوحات (التحديد الموحّد).
              const line = classic.lines.find((item) => item.id === event.target.value);
              if (line) selectElement({ kind: 'LINE', id: line.id, lineId: line.id, differenceId: line.variantId, position: line.startPosition });
            }}
            className="input h-8 py-0 text-[11px]"
          >
            <option value="">— بلا رابط الآن —</option>
            {classic.lines.map((line, index) => (
              <option key={line.id} value={line.id}>
                {toArabicDigits(index + 1)}. {line.label} · {line.ruleLabel.slice(0, 30)}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value);
              if (event.target.value) selectElement({ kind: 'DIFFERENCE', id: event.target.value, differenceId: event.target.value });
            }}
            className="input h-8 py-0 text-[11px]"
          >
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


// ==================== قائمة العلاقات القائمة ====================

const KIND_LABELS: Record<TashjeerLinkKind, string> = {
  FACE_TO_FACE: 'وجه ↔ وجه',
  LINE_TO_LINE: 'سطر ↔ سطر',
  SEGMENT_TO_LINE: 'جزء → سطر',
  SEGMENT_TO_RULE: 'جزء → قاعدة',
  DIFFERENCE_TO_DIFFERENCE: 'اختلاف ↔ اختلاف (قرار موضع)',
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
  const variantTitles = new Map((document?.variants ?? []).map((variant) => [variant.id, variant.title]));

  if (links.length === 0 && segments.length === 0) return null;

  const describe = (endpoint: LinkEndpoint): string => {
    if (endpoint.type === 'SEGMENT') {
      return `جزء «${segmentTitles.get(endpoint.id) ?? 'محذوف'}»`;
    }
    if (endpoint.type === 'RULE') {
      const title = variantTitles.get(endpoint.id);
      return title ? `اختلاف «${title}»` : `قاعدة ${shortId(endpoint.id)}`;
    }
    return `${endpoint.type === 'FACE' ? 'وجه' : 'سطر'} ${shortId(endpoint.id)}`;
  };

  /** النقر على طرف علاقة يجعله هو العنصر النشط عالميًا (FR-ED-02.3). */
  const selectEndpoint = (endpoint: LinkEndpoint) => {
    if (endpoint.type === 'FACE') {
      const [variantId, alternativeId] = endpoint.id.split('::');
      if (variantId && alternativeId) {
        selectElement({ kind: 'FACE', id: alternativeId, differenceId: variantId, faceId: alternativeId });
        return;
      }
    }
    if (endpoint.type === 'LINE') {
      selectElement({ kind: 'LINE', id: endpoint.id, lineId: endpoint.id });
      return;
    }
    if (endpoint.type === 'SEGMENT') {
      selectElement({ kind: 'SEGMENT', id: endpoint.id });
      return;
    }
    selectElement({ kind: 'RULE', id: endpoint.id, differenceId: endpoint.id });
  };
  const endpointIsSelected = (endpoint: LinkEndpoint): boolean =>
    selection?.id === endpoint.id ||
    (selection?.kind === 'FACE' && endpoint.type === 'FACE' && selection.faceId !== undefined && endpoint.id.endsWith(`::${selection.faceId}`));

  return (
    <div className="mt-3 rounded-md border border-stone-200 bg-stone-50/60 p-2.5">
      <p className="mb-1.5 text-[10px] font-semibold text-stone-700">
        العلاقات والأجزاء المسجلة ({toArabicDigits(links.length + segments.length)})
      </p>
      <p role="status" className="text-xs text-amber-900">{operationNotice}</p>
      <ul className="space-y-1.5">
        {links.map((link) => {
          const active =
            classic.appliedLinkIds.merge.includes(link.id) ||
            classic.appliedLinkIds.reference.includes(link.id);
          const isLocus = link.kind === 'DIFFERENCE_TO_DIFFERENCE';
          const locusLabel = isLocus
            ? link.locusVerdict === 'RELATED'
              ? 'مرتبطان'
              : 'متنافيان'
            : null;
          return (
            <li
              key={link.id}
              className={`rounded border bg-white px-2 py-1.5 ${
                selection?.kind === 'COMPOSITE_FACE' && selection.id === link.id ? 'selection-row-active' : 'border-stone-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-medium text-stone-800">
                    {KIND_LABELS[link.kind]} · {locusLabel ?? RELATION_LABELS[link.relation]}
                  </p>
                  <p className="truncate text-[10px] text-stone-600" title={`${describe(link.from)} → ${describe(link.to)}`}>
                    <button
                      type="button"
                      onClick={() => selectEndpoint(link.from)}
                      className={`rounded px-0.5 hover:underline ${endpointIsSelected(link.from) ? 'bg-emerald-100 text-emerald-800' : ''}`}
                      title="تحديد هذا الطرف عالميًا: تنتقل إليه اللوحة"
                    >
                      {describe(link.from)}
                    </button>
                    {' ← '}
                    <button
                      type="button"
                      onClick={() => selectEndpoint(link.to)}
                      className={`rounded px-0.5 hover:underline ${endpointIsSelected(link.to) ? 'bg-emerald-100 text-emerald-800' : ''}`}
                      title="تحديد هذا الطرف عالميًا: تنتقل إليه اللوحة"
                    >
                      {describe(link.to)}
                    </button>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                    title={active ? 'مطبقة في العرض الحالي' : 'غير مطبقة: طرفها غير ظاهر'}
                  >
                    {active ? 'مفعّلة' : 'معلّقة'}
                  </span>
                  {isLocus ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateLink(link.id, {
                          locusVerdict: link.locusVerdict === 'RELATED' ? 'EXCLUSIVE' : 'RELATED',
                          relation: link.locusVerdict === 'RELATED' ? 'REFERENCE' : 'MERGE',
                        })
                      }
                      className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-600 hover:bg-stone-50"
                      title="قلب القرار اليدوي على الزوج (يُسجَّل تصحيحا جديدا)"
                    >
                      {link.locusVerdict === 'RELATED' ? 'اجعلهما متنافيين' : 'اجعلهما مرتبطين'}
                    </button>
                  ) : link.relation === 'MERGE' ? (
                    <button
                      type="button"
                      onClick={() =>
                        mergeRecords?.some((record) => record.relationId === link.id && !record.restoredAt) ? void unmerge(link.id) : void confirmLegacy(() => updateLink(link.id, { relation: 'REFERENCE' }))
                      }
                      className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-600 hover:bg-stone-50"
                      title="تحويلها إلى ربط مرجعي دون دمج"
                    >
                      فك الدمج
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void confirmLegacy(() => updateLink(link.id, { relation: 'MERGE' }))}
                      className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-600 hover:bg-stone-50"
                      title="تحويلها إلى دمج في سطر واحد"
                    >
                      دمج
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => mergeRecords?.some((record) => record.relationId === link.id && !record.restoredAt) ? void unmerge(link.id) : void confirmLegacy(() => deleteLink(link.id))}
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
          <li
            key={segment.id}
            className={`rounded border bg-white px-2 py-1.5 ${
              selection?.kind === 'SEGMENT' && selection.id === segment.id ? 'selection-row-active' : 'border-stone-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => selectElement({ kind: 'SEGMENT', id: segment.id, position: segment.startPosition })}
                  className="text-start text-[10.5px] font-medium text-stone-800 hover:underline"
                  title="تحديد هذا الجزء عالميًا: تنتقل إليه اللوحة"
                >
                  جزء: {segment.title}
                </button>
                <p className="text-[10px] text-stone-600">
                  الكلمات {toArabicDigits(segment.startPosition)}–{toArabicDigits(segment.endPosition)}
                  {segment.characterRange
                    ? ` · حروف ${toArabicDigits(segment.characterRange.start.position)}/${toArabicDigits(segment.characterRange.start.characterIndex)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void confirmLegacy(() => deleteSegment(segment.id))}
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

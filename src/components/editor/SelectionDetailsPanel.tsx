// لوحة تفاصيل العنصر المحدد — Selection Details Panel (FR-ED-02.4)
// مشروع التشجير - نظام القراءات العشر
//
// «عند الضغط على أي سطر يجب أن أعرف فورًا كل تفاصيله». هذه اللوحة تقرأ
// التحديد الموحّد (مصدر الحقيقة الواحد) وتعرض فورًا: المعرّف، الرقم/الرتبة،
// الآية والصفحة، النوع/الفئة، القواعد المرتبطة، الاختلافات الموجودة في
// الموضع، العلاقات، الأجزاء، الأوجه المركبة، المصدر (محرك/محرر)، وحالة
// التصحيح. وتتيح العمليات المباشرة على العنصر النشط (نسخ/قص/لصق/حذف/ربط/ترتيب)
// عبر أوامر مشتركة مع قائمة السياق (selection-commands.ts).
//
// حين يكون التحديد على عنصر محذوف/ملغى تعرض آخر سلسلة سياق صالحة رمادية.

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { getSurah, getWordById } from '@/data/quran';
import { getEffectiveVariants } from '@/lib/quran-logic/global-rule-engine';
import {
  buildSelectionBreadcrumb,
  describeSelection,
  selectionKindLabel,
  type SelectionLookup,
} from '@/lib/tashjeer/selection-context';
import { selectionCommands, type SelectionCommand } from '@/lib/tashjeer/selection-commands';
import { CATEGORY_LABELS } from '@/lib/tashjeer/branch-engine';
import { getCategoryColor } from '@/lib/tashjeer/color-system';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';
import { coalesceLineOrder, orderSnapshotOf } from '@/lib/tashjeer/manual-links';
import { listGlobalRules } from '@/lib/storage/global-rules-store';
import type { ClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import type { EditorSelection, TashjeerLink } from '@/types/tashjeer';

interface SelectionDetailsPanelProps {
  /** ناتج محرك التشجير لاستخراج ترتيب السطر وأحكامه. */
  classic?: ClassicTashjeer;
  /** يفتح نافذة «لماذا؟» للقواعد (متاح في لوحة الخصائص). */
  onRequestWhy?: () => void;
}

export function SelectionDetailsPanel({ classic, onRequestWhy }: SelectionDetailsPanelProps) {
  const document = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);
  const lastSelection = useEditorStore((state) => state.lastSelection);
  const clipboard = useEditorStore((state) => state.clipboard);

  const [copiedId, setCopiedId] = useState(false);
  const effectiveVariants = useMemo(
    () => (document ? getEffectiveVariants(document) : []),
    [document]
  );

  const lookup = useMemo<SelectionLookup>(() => {
    const variants = document?.variants ?? [];
    return {
      surahNumber: document?.surahNumber ?? 1,
      ayahNumber: document?.ayahNumber ?? 1,
      variantTitle: (id) => effectiveVariants.find((variant) => variant.id === id)?.title,
      faceLabel: (variantId, faceId) =>
        variants.find((variant) => variant.id === variantId)?.alternatives.find((alt) => alt.id === faceId)?.label,
      segmentTitle: (id) => document?.segments?.find((segment) => segment.id === id)?.title,
      lineTitle: (id) => {
        const branch = document?.branches.find((item) => item.id === id);
        if (!branch) return undefined;
        return effectiveVariants.find((variant) => variant.id === branch.variantId)?.title ?? 'سطر';
      },
      wordText: (id) => getWordById(id)?.text,
      ruleTitle: (id) =>
        listGlobalRules().find((rule) => rule.id === id)?.ruleLabel ??
        listGlobalRules().find((rule) => rule.id === id)?.title,
      linkTitle: (id) => describeLinkTitle(document?.links ?? [], id, effectiveVariants),
      boundaryTitle: (id) => {
        const boundary = document?.boundaries.find((item) => item.id === id);
        return boundary ? boundary.label ?? (boundary.kind === 'NO_WASL' ? 'وقف (لا وصل)' : 'ابتداء') : undefined;
      },
    };
  }, [document, effectiveVariants]);

  // تحديد معلّق (عنصر حُذف): تعرض سلسلته الأخيرة رمادية بلا عمليات.
  const dangling = !selection && lastSelection !== null;
  const active: EditorSelection | null = selection ?? lastSelection;
  const crumbs = buildSelectionBreadcrumb(active, lookup);
  const summary = describeSelection(active, lookup);
  const commands = useMemo(
    () => selectionCommands(selection, { hasClipboard: clipboard !== null }),
    [selection, clipboard]
  );

  const variant = useMemo(() => {
    if (!active) return undefined;
    const id = active.kind === 'DIFFERENCE' || active.kind === 'RULE' || active.kind === 'FACE'
      ? active.differenceId ?? active.id
      : active.id;
    return effectiveVariants.find((item) => item.id === id);
  }, [active, effectiveVariants]);

  const relatedLinks = useMemo(() => {
    if (!active || !document) return [];
    const endpointIds = new Set<string>([active.id, active.lineId ?? '', active.differenceId ?? '', active.faceId ?? '']);
    if (variant) {
      endpointIds.add(variant.id);
      for (const alt of variant.alternatives) endpointIds.add(`${variant.id}::${alt.id}`);
    }
    return (document.links ?? []).filter((link) => endpointIds.has(link.from.id) || endpointIds.has(link.to.id));
  }, [active, document, variant]);

  const relatedSegments = useMemo(() => {
    if (!active || !document || typeof active.position !== 'number') return [];
    return (document.segments ?? []).filter(
      (segment) => active.position! >= segment.startPosition && active.position! <= segment.endPosition
    );
  }, [active, document]);

  const coveredDifferences = useMemo(() => {
    if (!active || typeof active.position !== 'number') return [];
    return effectiveVariants.filter(
      (item) => active.position! >= item.startPosition && active.position! <= item.endPosition
    );
  }, [active, effectiveVariants]);

  const lineOrderRank = useMemo(() => {
    if (!active?.lineId || !classic) return undefined;
    const base = coalesceLineOrder(
      (document?.lineOrder?.length ?? 0) > 0 ? document?.lineOrder : undefined,
      orderSnapshotOf(classic.lines)
    );
    const index = base.indexOf(active.lineId);
    return index >= 0 ? index + 1 : undefined;
  }, [active, classic, document]);

  if (!active || !summary) return null;

  const surah = document ? getSurah(document.surahNumber) : undefined;
  // الصفحة: أول صفحة تقريبي للسورة في مصحف المدينة (أرقام الصفحات الدقيقة
  // لكل آية خارج نطاق الحزمة — انظر PROGRESS.md).
  const approxPage = surah?.page;

  const runCommand = (command: SelectionCommand) => {
    const store = useEditorStore.getState();
    switch (command.id) {
      case 'COPY':
        store.copySelection();
        break;
      case 'CUT':
        store.cutSelection();
        break;
      case 'PASTE':
        store.pasteSelection();
        break;
      case 'COPY_ID':
        void navigator.clipboard?.writeText(active.id).then(() => {
          setCopiedId(true);
          window.setTimeout(() => setCopiedId(false), 1600);
        });
        break;
      default:
        // MOVE_UP/MOVE_DOWN/LINK/UNLINK/EDIT/WHY/DELETE: تتولى القوائم
        // المتخصصة (الخصائص/العلاقات) تنفيذها بأدواتها الكاملة، ويرد هنا
        // ما يشترك بين اللوحات فقط.
        break;
    }
  };

  return (
    <section
      className={`border-b px-4 py-3 ${dangling ? 'border-stone-200 bg-stone-50' : 'border-emerald-200 bg-emerald-50/40'}`}
      aria-label="تفاصيل العنصر المحدد"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
          {dangling ? (
            <span className="text-stone-500">آخر عنصر محدَّد (محذوف أو مُلغى)</span>
          ) : (
            <>
              العنصر المحدد
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: variant ? getCategoryColor(variant.category) : '#059669' }}
              >
                {selectionKindLabel(summary.kind)}
              </span>
            </>
          )}
        </h3>
        {summary.ayah && <span className="font-mono text-[10px] text-stone-400">{summary.ayah}</span>}
      </div>

      {/* سلسلة السياق الكاملة: الآية ← السطر ← الجزء ← الاختلاف ← الوجه */}
      <p className="mb-2 flex flex-wrap items-center gap-1 text-[11px]">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.kind}-${index}`} className="flex items-center gap-1">
            {index > 0 && <span className="text-stone-300">←</span>}
            <span
              className={`rounded px-1 py-0.5 ${
                index === crumbs.length - 1
                  ? dangling
                    ? 'bg-stone-200 text-stone-500'
                    : 'bg-emerald-600 font-medium text-white'
                  : 'bg-white text-stone-600'
              }`}
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Detail label="المعرّف" value={<span className="break-all font-mono text-[10px]">{active.id}</span>} />
        {approxPage && <Detail label="الصفحة (تقريبية)" value={toArabicDigits(approxPage)} />}
        {typeof summary.position === 'number' && <Detail label="الموضع" value={toArabicDigits(summary.position)} />}
        {variant && (
          <Detail label="الفئة" value={CATEGORY_LABELS[variant.category] ?? variant.category} />
        )}
        {variant && <Detail label="رتبة الترتيب" value={variant.orderRank ? toArabicDigits(variant.orderRank) : '—'} />}
        {typeof lineOrderRank === 'number' && (
          <Detail label="ترتيب الصف" value={`${toArabicDigits(lineOrderRank)} من ${toArabicDigits(classic?.lines.length ?? 0)}`} />
        )}
        {variant && (
          <Detail
            label="المصدر"
            value={variant.isGlobalDerived ? 'المحرك (قاعدة عامة)' : variant.origin === 'EDITOR' ? 'المحرر' : 'المحرك (أساسي)'}
          />
        )}
        {variant && <Detail label="حالة التصحيح" value={statusLabel(variant.status)} />}
      </dl>

      {/* الاختلافات الواقعة في هذا الموضع */}
      {coveredDifferences.length > 0 && (
        <DetailList title={`اختلافات في الموضع (${toArabicDigits(coveredDifferences.length)})`}>
          {coveredDifferences.slice(0, 6).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => useEditorStore.getState().selectVariant(item.id)}
                className="selection-row-focus w-full truncate rounded px-1.5 py-0.5 text-right text-[11px] text-stone-700 hover:bg-white"
                title="انتقل إلى هذا الاختلاف"
              >
                {item.title}
              </button>
            </li>
          ))}
        </DetailList>
      )}

      {/* القواعد المرتبطة */}
      {variant?.isGlobalDerived && variant.globalRuleId && (
        <DetailList title="القاعدة المرتبطة">
          <li className="text-[11px] text-violet-800">{variant.globalRuleId}</li>
        </DetailList>
      )}

      {/* الأجزاء المرتبطة بالموضع */}
      {relatedSegments.length > 0 && (
        <DetailList title={`أجزاء في الموضع (${toArabicDigits(relatedSegments.length)})`}>
          {relatedSegments.map((segment) => (
            <li key={segment.id}>
              <button
                type="button"
                onClick={() => useEditorStore.getState().selectSegment(segment.id)}
                className="selection-row-focus w-full truncate rounded px-1.5 py-0.5 text-right text-[11px] text-stone-700 hover:bg-white"
              >
                {segment.title}
              </button>
            </li>
          ))}
        </DetailList>
      )}

      {/* العلاقات والأوجه المركبة */}
      {relatedLinks.length > 0 && (
        <DetailList title={`علاقات (${toArabicDigits(relatedLinks.length)})`}>
          {relatedLinks.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2 text-[11px] text-stone-600">
              <span className="min-w-0 truncate">
                {linkKindLabel(link.kind)} · {relationLabel(link.relation)}
                {link.notes ? ` — ${link.notes}` : ''}
              </span>
              <button
                type="button"
                onClick={() => useEditorStore.getState().setSelection({ kind: 'COMPOSITE_FACE', id: link.id })}
                className="shrink-0 rounded border border-stone-200 px-1 text-[10px] text-stone-500 hover:bg-white"
                title="تحديد هذه العلاقة"
              >
                عرض
              </button>
            </li>
          ))}
        </DetailList>
      )}

      {/* العمليات المباشرة على العنصر النشط */}
      {!dangling && commands.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1 border-t border-emerald-200/70 pt-2">
          {commands.map((command) => (
            <button
              key={command.id}
              type="button"
              disabled={!command.enabled}
              onClick={() => runCommand(command)}
              title={command.hint}
              className={`rounded border px-1.5 py-0.5 text-[10.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                command.danger
                  ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
                  : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              {command.label}
            </button>
          ))}
          {copiedId && <span className="self-center text-[10px] text-emerald-700">نُسخ المعرف ✓</span>}
          {onRequestWhy && variant && (
            <button
              type="button"
              onClick={onRequestWhy}
              className="rounded border border-violet-200 bg-white px-1.5 py-0.5 text-[10.5px] text-violet-800 hover:bg-violet-50"
            >
              لماذا؟
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <dt className="shrink-0 text-stone-500">{label}</dt>
      <dd className="truncate text-right font-medium text-stone-800">{value}</dd>
    </div>
  );
}

function DetailList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-2 border-t border-emerald-200/70 pt-1.5">
      <p className="mb-0.5 text-[10px] font-semibold text-stone-600">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'مسودة',
    REVIEW: 'قيد المراجعة',
    APPROVED: 'معتمد (نهائي)',
    REJECTED: 'مرفوض',
  };
  return labels[status] ?? status;
}

function linkKindLabel(kind: TashjeerLink['kind']): string {
  const labels: Record<TashjeerLink['kind'], string> = {
    FACE_TO_FACE: 'وجه مركب',
    LINE_TO_LINE: 'سطر بسطر',
    SEGMENT_TO_LINE: 'جزء بسطر',
    SEGMENT_TO_RULE: 'جزء بقاعدة',
  };
  return labels[kind];
}

function relationLabel(relation: TashjeerLink['relation']): string {
  return relation === 'MERGE' ? 'دمج' : 'ربط مرجعي';
}

function describeLinkTitle(
  links: TashjeerLink[],
  linkId: string,
  variants: Array<{ id: string; title: string; alternatives: Array<{ id: string; label: string }> }>
): string | undefined {
  const link = links.find((item) => item.id === linkId);
  if (!link) return undefined;
  const sideLabel = (type: string, id: string): string => {
    const [variantId, altId] = id.includes('::') ? id.split('::') : [id, ''];
    if (type === 'FACE') {
      const owner = variants.find((variant) => variant.id === variantId);
      const alt = owner?.alternatives.find((alternative) => alternative.id === altId);
      if (owner && alt) return `${owner.title} — ${alt.label}`;
    }
    return id;
  };
  return `${sideLabel(link.from.type, link.from.id)} ↔ ${sideLabel(link.to.type, link.to.id)}`;
}

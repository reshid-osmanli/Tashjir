import type { LineSegment, TashjeerDocument, TashjeerLink, Variant, VariantAlternative } from '@/types/tashjeer';
import type { GlobalRule } from '@/lib/storage/global-rules-store';
import { createEntityId } from './model/v8';

/**
 * مستويات الحافظة الموحّدة (FR-ED-06): سطر كامل (بأجزائه) · جزء من سطر
 * (اختلافات محدّدة) · اختلاف واحد · وجه · قاعدة عامة. مستوى واحد لكل كيان،
 * وخوارزمية استنساخ واحدة: معرّفات جديدة + `copiedFrom` + طوابع جديدة.
 */
export type ClipboardPayload =
  | { kind: 'DIFFERENCE'; value: Variant }
  | { kind: 'DIFFERENCES'; value: Variant[] }
  | { kind: 'FACE'; value: VariantAlternative; sourceVariantId?: string }
  | { kind: 'FACES'; value: VariantAlternative[]; sourceVariantId: string }
  | { kind: 'SEGMENT'; value: LineSegment }
  | { kind: 'LINE'; value: { lineId: string; label: string; variants: Variant[]; segments?: LineSegment[] } }
  | { kind: 'RULE'; value: GlobalRule }
  | { kind: 'RULES'; value: GlobalRule[] };
export type EditorClipboard = (ClipboardPayload & { mode?: 'COPY' | 'CUT'; sourceAyahKey?: number; links?: TashjeerLink[] }) | null;
export interface SuspendedLink { id: string; original: TashjeerLink; mappedFrom?: string; mappedTo?: string; reason: string; at: string }

export function clipboardCount(clipboard: NonNullable<EditorClipboard>): number {
  if (clipboard.kind === 'LINE') return clipboard.value.variants.length;
  return Array.isArray(clipboard.value) ? clipboard.value.length : 1;
}
export function snapshotClipboard(document: TashjeerDocument, payload: ClipboardPayload): NonNullable<EditorClipboard> {
  return structuredClone({ ...payload, mode: 'COPY', sourceAyahKey: document.ayahKey, links: document.links ?? [] });
}

/**
 * استنساخ قواعد عامة للصقها (FR-ED-06 — مستوى «قاعدة»): معرّفات جديدة،
 * `copiedFrom` يوثّق الأصل، طوابع `createdAt/updatedAt` جديدة، وحالة «مسودة»
 * لأن النسخة لم تُراجع بعد (P-06: التوثيق لا يُورَّث). القاعدة الأم لا تُمس،
 * والدفعة تشترك في `createBatchId` واحد ليعرف التراجع أنها وحدة (DM-08/DM-12).
 */
export function cloneRulesForClipboard(rules: GlobalRule[], batchId?: string): GlobalRule[] {
  const now = new Date().toISOString();
  const sharedBatch = rules.length > 1 ? batchId ?? createEntityId('gbatch') : undefined;
  return rules.map((rule) => ({
    ...structuredClone(rule),
    id: createEntityId('rule'),
    copiedFrom: rule.id,
    title: `${rule.title} — نسخة`,
    status: 'DRAFT' as const,
    isActive: rule.isActive ?? true,
    createBatchId: sharedBatch ?? rule.createBatchId,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * مرساة سطر اللصق (FR-ED-06): مفتاح وجه داخل السطر الهدف يرسو عليه رابط
 * DIFFERENCE_TO_LINE. يُفضَّل أول وجه غير مصحفي لأن الوجه المصحفي لا يُرسم
 * (فلا تعثر عليه مطابقة الأطراف وتبقى العناصر في أسطرها الطبيعية).
 * الوجه مفتاح مستقر عبر إعادة توليد الأسطر بخلاف معرّف السطر المرئي.
 */
export function pasteAnchorFace(document: TashjeerDocument, differenceId: string | null | undefined, variants = document.variants): string | null {
  if (!differenceId) return null;
  const difference = variants.find((item) => item.id === differenceId);
  if (!difference) return null;
  const rendered = difference.alternatives.find((face) => !face.isBase) ?? difference.alternatives[0];
  return rendered ? `${difference.id}::${rendered.id}` : null;
}

/** وجهة اللصق داخل سطر: مرساة وجه من ذلك السطر (فرضًا من تحديد LINE الموحد). */
export interface PasteLineAnchor {
  faceKey: string;
}

/** يبني رابط إلحاق اختلاف بسطر مرساة، بمصدر المحرر وطوابع اللحظة. */
function differenceToLineLink(document: TashjeerDocument, differenceId: string, anchor: PasteLineAnchor, mode: 'COPY' | 'CUT'): TashjeerLink {
  const now = new Date().toISOString();
  return {
    id: createEntityId('link'),
    ayahKey: document.ayahKey,
    kind: 'DIFFERENCE_TO_LINE',
    relation: 'MERGE',
    from: { type: 'RULE', id: differenceId },
    to: { type: 'FACE', id: anchor.faceKey },
    notes: mode === 'CUT' ? 'نقل إلى سطر محدد عبر الحافظة (القص)' : 'إلحاق نسخة بسطر محدد عبر الحافظة (اللصق)',
    origin: 'EDITOR',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * معاملة نقية: لا حذف قبل نجاح تحقق الوجهة.
 *
 * `pasteAnchor` يفعّل «اللصق داخل سطر هدف» (AC-04): الاختلافات تلحق بالسطر
 * الذي يحمل وجه المرساة عبر رابط DIFFERENCE_TO_LINE بدل رميها في المستند —
 * نسخة (COPY) تستنسخ بمعرّفات جديدة ثم تُرسى على السطر، ونقل (CUT) يرسو
 * بالأصل بلا استنساخ فيختفي من سطره الطبيعي ومعرّفه محفوظ.
 */
export function pasteClipboard(document: TashjeerDocument, clipboard: NonNullable<EditorClipboard>, targetId?: string, pasteAnchor?: PasteLineAnchor, availableVariants = document.variants): { document: TashjeerDocument; ids: string[]; error?: string } {
  const reject = (error: string) => ({ document, ids: [], error });
  // القواعد العامة ليست كيانات مستند: لصقها يمرّ بمخزن القواعد عبر
  // `requestPasteSelection`. لا يُلمس المستند هنا ولا تُرمى القواعد فيه.
  if (clipboard.kind === 'RULE' || clipboard.kind === 'RULES') {
    return reject('لصق القواعد العامة يمرّ بمخزن القواعد لا بالمستند؛ لم يتغير شيء.');
  }
  const now = new Date().toISOString();
  const mapping = new Map<string, string>();
  const cloneEntity = <T extends { id: string }>(value: T): T & { copiedFrom: string; createdAt: string; updatedAt: string } => {
    const id = createEntityId('copy'); mapping.set(value.id, id);
    return { ...structuredClone(value), id, copiedFrom: value.id, createdAt: now, updatedAt: now };
  };
  const cloneFace = (face: VariantAlternative) => {
    const copy = { ...cloneEntity(face), source: 'editor' as const };
    copy.evidences = face.evidences?.map(cloneEntity);
    return copy;
  };
  const cloneDifference = (source: Variant): Variant => {
    const copy = { ...cloneEntity(source), source: 'editor' as const };
    copy.ayahKey = document.ayahKey; copy.origin = 'EDITOR'; copy.title = `${source.title} — نسخة`;
    copy.alternatives = source.alternatives.map((face) => {
      const next = cloneFace(face); mapping.set(`${source.id}::${face.id}`, `${copy.id}::${next.id}`); return next;
    });
    copy.alternativeOrder = source.alternativeOrder?.map((id) => mapping.get(id)!).filter(Boolean);
    delete copy.engineSnapshot; delete copy.editorModifiedAt; delete copy.isGlobalDerived; delete copy.globalRuleId; delete copy.hasLocalOverride; delete copy.globalMatchedText; delete copy.globalMatch;
    return copy;
  };

  let next = document;
  let ids: string[] = [];
  if (clipboard.kind === 'FACE' || clipboard.kind === 'FACES') {
    const target = document.variants.find((item) => item.id === targetId);
    if (!target) return reject('حدد اختلافًا محفوظًا وجهةً للصق الأوجه أولًا.');
    const sourceFaces = clipboard.kind === 'FACE' ? [clipboard.value] : clipboard.value;
    if (!sourceFaces.length) return reject('الحافظة فارغة.');
    if (clipboard.mode === 'CUT') {
      if (clipboard.sourceAyahKey !== document.ayahKey) return reject('النقل بين مستندين غير متاح بأمان بعد؛ استخدم النسخ. لم يُحذف المصدر.');
      const owner = document.variants.find((item) => item.id === clipboard.sourceVariantId);
      if (!owner || owner.id === target.id) return reject('اختر اختلافًا آخر للنقل. لم يتغير المصدر.');
      if (sourceFaces.some((face) => JSON.stringify(owner.alternatives.find((item) => item.id === face.id)) !== JSON.stringify(face))) return reject('تغيّر المصدر بعد القص؛ أعد تحديده وقصه.');
      if (sourceFaces.some((face) => target.alternatives.some((item) => item.id === face.id))) return reject('الوجه موجود في الوجهة؛ ألغي النقل لمنع التكرار.');
      ids = sourceFaces.map((face) => face.id);
      for (const face of sourceFaces) mapping.set(`${owner.id}::${face.id}`, `${target.id}::${face.id}`);
      next = {
        ...document,
        variants: document.variants.map((item) => item.id === owner.id ? { ...item, alternatives: item.alternatives.filter((face) => !ids.includes(face.id)), alternativeOrder: item.alternativeOrder?.filter((id) => !ids.includes(id)) } : item.id === target.id ? { ...item, alternatives: [...item.alternatives, ...structuredClone(sourceFaces)], alternativeOrder: item.alternativeOrder ? [...item.alternativeOrder, ...ids] : undefined } : item),
        links: (document.links ?? []).map((link) => ({ ...link, from: { ...link.from, id: mapping.get(link.from.id) ?? link.from.id }, to: { ...link.to, id: mapping.get(link.to.id) ?? link.to.id } })),
      };
      return { document: next, ids };
    }
    const faces = sourceFaces.map((face) => {
      const copy = { ...cloneFace(face), isBase: false };
      if (clipboard.sourceVariantId) mapping.set(`${clipboard.sourceVariantId}::${face.id}`, `${target.id}::${copy.id}`);
      return copy;
    });
    ids = faces.map((face) => face.id);
    next = { ...document, variants: document.variants.map((item) => item.id === target.id ? { ...item, alternatives: [...item.alternatives, ...faces], alternativeOrder: item.alternativeOrder ? [...item.alternativeOrder, ...ids] : undefined } : item) };
  } else {
    if (clipboard.mode === 'CUT') {
      // نقل الاختلافات إلى سطر هدف (AC-04: «القص ينقل ولا يكرر»): رابط
      // إلحاق لكل مقصوص بمرساة السطر — نقل حقيقي بلا استنساخ، المعرّفات
      // والعلاقات محفوظة، والاختفاء من السطر الطبيعي أثر عرضي للرابط.
      if (clipboard.kind === 'SEGMENT') return reject('نقل الأجزاء بين الأسطر غير متاح بعد؛ المصدر محفوظ. استخدم النسخ.');
      if (clipboard.sourceAyahKey !== document.ayahKey) return reject('النقل بين آيتين غير متاح بأمان؛ استخدم النسخ. المصدر محفوظ.');
      if (!pasteAnchor) return reject('حدد سطرًا في اللوحة أو لوحة الترتيب ثم ألصق لنقل المقصوص إليه؛ المصدر محفوظ.');
      const sources = clipboard.kind === 'LINE' ? clipboard.value.variants : clipboard.kind === 'DIFFERENCES' ? clipboard.value : [clipboard.value];
      const anchorDifferenceId = pasteAnchor.faceKey.split('::')[0];
      if (sources.some((source) => source.id === anchorDifferenceId)) return reject('لا يمكن نقل اختلاف إلى سطر يُرسى على وجه منه هو نفسه.');
      if (sources.some((source) => !availableVariants.some((item) => item.id === source.id))) return reject('أحد المقصوصات لم يعد في المستند؛ أعد القص.');
      if (sources.some((source) => JSON.stringify(availableVariants.find((item) => item.id === source.id)) !== JSON.stringify(source))) return reject('تغيّر المصدر بعد القص؛ أعد تحديده وقصه.');
      ids = sources.map((source) => source.id);
      const anchorLinks = ids.map((id) => differenceToLineLink(document, id, pasteAnchor, 'CUT'));
      next = { ...document, links: [...(document.links ?? []), ...anchorLinks] };
      return { document: next, ids };
    }
    if (clipboard.kind === 'SEGMENT') {
      const segment = { ...cloneEntity(clipboard.value), ayahKey: document.ayahKey, origin: 'EDITOR' as const };
      ids = [segment.id]; next = { ...document, segments: [...(document.segments ?? []), segment] };
    } else {
      const sources = clipboard.kind === 'LINE' ? clipboard.value.variants : clipboard.kind === 'DIFFERENCES' ? clipboard.value : [clipboard.value];
      const copies = sources.map(cloneDifference);
      ids = copies.map((item) => item.id);
      // أجزاء السطر المنسوخ (FR-ED-06 «نسخ سطر كامل»): تُستنسخ بمعرّفات جديدة
      // و`copiedFrom` وطوابع جديدة، وتدخل خريطة الربط فتتبعها روابطها
      // (SEGMENT_TO_LINE/SEGMENT_TO_RULE) إلى الأطراف الجديدة، أو تُعلَّق
      // dangling إن أشارت إلى عنصر خارج مجموعة النسخ.
      const segmentCopies = clipboard.kind === 'LINE'
        ? (clipboard.value.segments ?? []).map((segment) => ({ ...cloneEntity(segment), ayahKey: document.ayahKey, origin: 'EDITOR' as const }))
        : [];
      next = {
        ...document,
        variants: [...document.variants, ...copies],
        segments: segmentCopies.length ? [...(document.segments ?? []), ...segmentCopies] : document.segments,
      };
    }
  }
  const links: TashjeerLink[] = [];
  const suspended: SuspendedLink[] = [];
  for (const relation of clipboard.links ?? []) {
    const from = mapping.get(relation.from.id); const to = mapping.get(relation.to.id);
    if (!from && !to) continue;
    if (from && to) links.push({ ...structuredClone(relation), id: createEntityId('link'), ayahKey: document.ayahKey, from: { ...relation.from, id: from }, to: { ...relation.to, id: to }, createdAt: now, updatedAt: now, origin: 'EDITOR' });
    else suspended.push({ id: createEntityId('dangling'), original: structuredClone(relation), mappedFrom: from, mappedTo: to, reason: 'طرف العلاقة خارج مجموعة النسخ؛ معلّقة للمراجعة ولم تُطبّق.', at: now });
  }
  // روابط الرسوّ البنائية تُضاف بعد حساب التعليق حتى لا تُعلَّق هي نفسها:
  // طرفها الخارجي (مرساة السطر) مقصود بالتصميم لا علاقة منسوخة.
  const anchorLinks =
    pasteAnchor && (clipboard.kind === 'DIFFERENCE' || clipboard.kind === 'DIFFERENCES' || clipboard.kind === 'LINE')
      ? ids.map((id) => differenceToLineLink(document, id, pasteAnchor, 'COPY'))
      : [];
  return { document: { ...next, links: [...(next.links ?? []), ...links, ...anchorLinks], suspendedLinks: [...(document.suspendedLinks ?? []), ...suspended] }, ids };
}

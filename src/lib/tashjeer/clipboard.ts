import type { LineSegment, TashjeerDocument, TashjeerLink, Variant, VariantAlternative } from '@/types/tashjeer';
import { createEntityId } from './model/v8';

export type ClipboardPayload =
  | { kind: 'DIFFERENCE'; value: Variant }
  | { kind: 'DIFFERENCES'; value: Variant[] }
  | { kind: 'FACE'; value: VariantAlternative; sourceVariantId?: string }
  | { kind: 'FACES'; value: VariantAlternative[]; sourceVariantId: string }
  | { kind: 'SEGMENT'; value: LineSegment }
  | { kind: 'LINE'; value: { lineId: string; label: string; variants: Variant[] } };
export type EditorClipboard = (ClipboardPayload & { mode?: 'COPY' | 'CUT'; sourceAyahKey?: number; links?: TashjeerLink[] }) | null;
export interface SuspendedLink { id: string; original: TashjeerLink; mappedFrom?: string; mappedTo?: string; reason: string; at: string }

export function clipboardCount(clipboard: NonNullable<EditorClipboard>): number {
  if (clipboard.kind === 'LINE') return clipboard.value.variants.length;
  return Array.isArray(clipboard.value) ? clipboard.value.length : 1;
}
export function snapshotClipboard(document: TashjeerDocument, payload: ClipboardPayload): NonNullable<EditorClipboard> {
  return structuredClone({ ...payload, mode: 'COPY', sourceAyahKey: document.ayahKey, links: document.links ?? [] });
}

/** Pure transaction: no deletion can happen before destination validation succeeds. */
export function pasteClipboard(document: TashjeerDocument, clipboard: NonNullable<EditorClipboard>, targetId?: string): { document: TashjeerDocument; ids: string[]; error?: string } {
  const reject = (error: string) => ({ document, ids: [], error });
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
    delete copy.engineSnapshot; delete copy.editorModifiedAt; delete copy.isGlobalDerived; delete copy.globalRuleId;
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
    // Legacy differences/segments have no independent line ownership. Never fake a move.
    if (clipboard.mode === 'CUT') return reject('نقل الاختلاف/الجزء بين سطرين يحتاج ملكية أسطر مستقلة غير متاحة بعد؛ المصدر محفوظ. استخدم النسخ.');
    if (clipboard.kind === 'SEGMENT') {
      const segment = { ...cloneEntity(clipboard.value), ayahKey: document.ayahKey, origin: 'EDITOR' as const };
      ids = [segment.id]; next = { ...document, segments: [...(document.segments ?? []), segment] };
    } else {
      const sources = clipboard.kind === 'LINE' ? clipboard.value.variants : clipboard.kind === 'DIFFERENCES' ? clipboard.value : [clipboard.value];
      const copies = sources.map(cloneDifference);
      ids = copies.map((item) => item.id); next = { ...document, variants: [...document.variants, ...copies] };
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
  return { document: { ...next, links: [...(next.links ?? []), ...links], suspendedLinks: [...(document.suspendedLinks ?? []), ...suspended] }, ids };
}

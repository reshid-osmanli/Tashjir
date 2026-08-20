// الروابط اليدوية والأجزاء - Manual Links & Segments Engine
//
// هذه الوحدة هي جسر «المحرر يصحّح المحرك»:
//
//   المحرك يقترح الأسطر والترتيب تلقائيا، ثم يأتي المحقق فيصحّح النتيجة
//   يدويا من المحرر. كل تصحيح يُخزَّن في المستند بوصفه علاقة صريحة (رابط):
//
//     FACE_TO_FACE    هذا الوجه مركّب/متفق مع وجه آخر — أيا كان قارئه.
//     LINE_TO_LINE    هذا السطر يُدمج بسطر آخر في تركيب واحد.
//     SEGMENT_TO_LINE جزء محدد من السطر يتبع سطرا آخر (Line→Segment→Line).
//     SEGMENT_TO_RULE جزء محدد من السطر يرتبط بقاعدة في سطر آخر
//                     (Line→Segment→Rule) دون إنشاء سطر جديد كامل.
//
//   والعلاقة إما MERGE (تغيّر شكل العرض: سطر واحد يحمل الطرفين) أو
//   REFERENCE (تسجَّل وتُعرض في التتبع والخصائص دون تغيير الأسطر).
//
// ولا تفترض الدوال هنا شيئا عن القارئ ولا عن افتراضات المحرك: العلاقة
// بين وجهين من راوٍ واحد صحيحة، وبين وجهين من قارئين مختلفين صحيحة كذلك،
// لأن قرار المحقق هو المصدر.
//
// الترتيب اليدوي:
//   sortLinesByManualOrder يرتب أسطر العرض وفق document.lineOrder بعد أن
//   يبنيها المحرك، فتصحيح ترتيب صف واحد لا يستلزم إعادة تشغيل المحرك،
//   والصفوف المتأثرة تُزاح إزاحة إدراج آمنة لا تكسر روابطها.

import type {
  LineSegment,
  LinkEndpoint,
  TashjeerLink,
} from '@/types/tashjeer';
import type { AyahLayout } from '@/types/tashjeer';
import { getCategoryColor } from './color-system';
import { marksForWordRange } from './line-marks';
import { narratorTayyibahOrder } from './symbols';
import type { ClassicLine, ClassicLineEntry, ClassicReaderChip } from './classic-tashjeer';

// ==================== مطابقة الأطراف بالأسطر ====================

/** هل يحمل السطر وجها بعينه (معرّف الاختلاف والوجه)؟ */
function lineHasFace(line: ClassicLine, endpoint: LinkEndpoint): boolean {
  if (endpoint.type !== 'FACE') return false;
  const [variantId, alternativeId] = splitFaceKey(endpoint.id);
  return line.entries.some(
    (entry) => entry.variantId === variantId && entry.alternativeId === alternativeId
  );
}

/** هل السطر هو الطرف المطلوب (بمعرّفه أو ضمن ما دُمج فيه)؟ */
function lineMatchesEndpoint(line: ClassicLine, endpoint: LinkEndpoint): boolean {
  if (endpoint.type === 'FACE') return lineHasFace(line, endpoint);
  if (endpoint.type === 'LINE') {
    return line.id === endpoint.id || (line.mergedFrom ?? []).includes(endpoint.id);
  }
  return false;
}

/** أسطر يحمل الطرف المطلوب، مرتبة كما في قائمة الأسطر. */
function linesForEndpoint(lines: ClassicLine[], endpoint: LinkEndpoint): ClassicLine[] {
  return lines.filter((line) => lineMatchesEndpoint(line, endpoint));
}

/**
 * أسطر تستهدفها قاعدة: معرّف اختلاف صريح، أو معرّف قاعدة عامة فيطابق
 * مواضعها المشتقة (global:<ruleId>:...).
 */
function linesForRuleTarget(lines: ClassicLine[], ruleId: string): ClassicLine[] {
  return lines.filter((line) =>
    line.entries.some(
      (entry) => entry.variantId === ruleId || entry.variantId.startsWith(`global:${ruleId}:`)
    )
  );
}

function splitFaceKey(key: string): [string, string] {
  const separator = key.indexOf('::');
  if (separator === -1) return [key, ''];
  return [key.slice(0, separator), key.slice(separator + 2)];
}

// ==================== تطبيق الروابط ====================

export interface AppliedLinkResult {
  lines: ClassicLine[];
  /** الروابط التي وجدت طرفيها وطُبّقت فعلا (MERGE غيّر العرض). */
  appliedMergeIds: string[];
  /** الروابط المرجعية التي ارتبطت بأسطر ظاهرة. */
  appliedReferenceIds: string[];
}

/**
 * يطبّق روابط المحرر على أسطر المحرك: دمج الطرفين في سطر واحد للعلاقات
 * MERGE، ووسم الأسطر بالروابط المرجعية دون تغيير شكلها.
 *
 * الدالة نقية: تعدّل نسخة جديدة من القائمة وترجعها، ولا تلمس المدخلات.
 */
export function applyManualLinks(
  lines: ClassicLine[],
  layout: AyahLayout,
  links: TashjeerLink[],
  segments: LineSegment[]
): AppliedLinkResult {
  let current = lines.map((line) => ({ ...line }));
  const appliedMergeIds: string[] = [];
  const appliedReferenceIds: string[] = [];

  const mergeLinks = links.filter((link) => link.relation === 'MERGE');
  const referenceLinks = links.filter((link) => link.relation === 'REFERENCE');

  for (const link of mergeLinks) {
    if (link.kind === 'FACE_TO_FACE' || link.kind === 'LINE_TO_LINE') {
      const result = mergeEndpointLines(current, link);
      if (result) {
        current = result;
        appliedMergeIds.push(link.id);
      }
      continue;
    }

    if (link.kind === 'SEGMENT_TO_LINE' || link.kind === 'SEGMENT_TO_RULE') {
      const segment = segments.find((item) => item.id === link.from.id);
      if (!segment) continue;
      const targets =
        link.kind === 'SEGMENT_TO_LINE'
          ? linesForEndpoint(current, link.to)
          : linesForRuleTarget(current, link.to.id);
      const target = targets[0];
      if (!target) continue;

      const entry = segmentEntry(segment, target, layout);
      if (!entry) continue;

      target.entries = [...target.entries, entry];
      target.marks = [...target.marks, ...entry.marks].sort(
        (first, second) => first.position - second.position
      );
      target.startPosition = Math.min(target.startPosition, segment.startPosition);
      target.endPosition = Math.max(target.endPosition, segment.endPosition);
      target.linkIds = [...(target.linkIds ?? []), link.id];
      appliedMergeIds.push(link.id);
    }
  }

  for (const link of referenceLinks) {
    const owners = linesForEndpoint(current, link.from).concat(linesForEndpoint(current, link.to));
    if (owners.length === 0) continue;
    for (const owner of owners) {
      owner.linkIds = [...(owner.linkIds ?? []), link.id];
    }
    appliedReferenceIds.push(link.id);
  }

  return { lines: current, appliedMergeIds, appliedReferenceIds };
}

/** يدمج سطري الطرفين في سطر واحد يحمل أحكامهما معا. */
function mergeEndpointLines(
  lines: ClassicLine[],
  link: TashjeerLink
): ClassicLine[] | null {
  const fromLines = linesForEndpoint(lines, link.from);
  const toLines = linesForEndpoint(lines, link.to);
  const from = fromLines[0];
  const to = toLines.find((candidate) => candidate !== from);
  if (!from || !to) return null;

  const merged = mergeTwoLines(from, to);
  merged.linkIds = [...(from.linkIds ?? []), ...(to.linkIds ?? []), link.id];
  merged.mergedFrom = [...(from.mergedFrom ?? []), ...(to.mergedFrom ?? []), to.id];

  const fromIndex = lines.indexOf(from);
  return [
    ...lines.slice(0, fromIndex),
    merged,
    ...lines.slice(fromIndex + 1).filter((line) => line !== to),
  ];
}

/** دمج سطرين في تركيب واحد: الأحكام والقراء والرموز كلها مجتمعة. */
export function mergeTwoLines(from: ClassicLine, to: ClassicLine): ClassicLine {
  const existingEntries = new Set(
    from.entries.map((entry) => `${entry.variantId}::${entry.alternativeId}`)
  );
  const entries = [
    ...from.entries,
    ...to.entries.filter(
      (entry) => !existingEntries.has(`${entry.variantId}::${entry.alternativeId}`)
    ),
  ];

  const readers = combineChips(from.readers, to.readers);
  const narratorIds = [...new Set([...from.narratorIds, ...to.narratorIds])].sort(
    (first, second) => narratorTayyibahOrder(first) - narratorTayyibahOrder(second)
  );
  const marks = [...from.marks, ...to.marks].sort(
    (first, second) => first.position - second.position
  );

  return {
    ...from,
    entries,
    readers,
    narratorIds,
    symbols: readers.map((chip) => chip.symbol).filter(Boolean),
    primarySymbol: readers[0]?.symbol ?? from.primarySymbol,
    primaryNarratorName: readers[0]?.name ?? from.primaryNarratorName,
    readerNames: readers.map((chip) => chip.name),
    label: readers.map((chip) => chip.symbol || chip.name).join(' ') || from.label,
    readingText: [from.readingText, to.readingText].filter(Boolean).join(' … '),
    readingLabel: [from.readingLabel, to.readingLabel].filter(Boolean).join(' + '),
    ruleLabel: [from.ruleLabel, to.ruleLabel].filter(Boolean).join(' + '),
    marks,
    startPosition: Math.min(from.startPosition, to.startPosition),
    endPosition: Math.max(from.endPosition, to.endPosition),
    linkIds: [],
    mergedFrom: [],
  };
}

/** بناء حكم «جزء مرتبط» يلحق بالسطر الهدف. */
function segmentEntry(
  segment: LineSegment,
  target: ClassicLine,
  layout: AyahLayout
): ClassicLineEntry | null {
  const marks = marksForWordRange(
    segment.startPosition,
    segment.endPosition,
    layout,
    segment.characterRange
  );
  if (marks.length === 0) return null;

  return {
    variantId: `segment:${segment.id}`,
    alternativeId: '',
    category: target.category,
    categoryLabel: target.categoryLabel,
    ruleLabel: segment.title,
    readingText: segment.title,
    readingLabel: 'جزء مرتبط',
    color: getCategoryColor(target.category),
    marks,
    startPosition: segment.startPosition,
    endPosition: segment.endPosition,
    emphasisStartX: 0,
    emphasisEndX: 0,
    labelX: 0,
    emphases: [],
  };
}

function combineChips(first: ClassicReaderChip[], second: ClassicReaderChip[]): ClassicReaderChip[] {
  const byId = new Map(first.map((chip) => [`${chip.kind}:${chip.id}`, chip]));
  for (const chip of second) {
    const key = `${chip.kind}:${chip.id}`;
    if (!byId.has(key)) byId.set(key, chip);
  }
  return [...byId.values()];
}

// ==================== الترتيب اليدوي ====================

/**
 * يرتب الأسطر وفق الترتيب اليدوي المحفوظ.
 *
 * الأسطر المذكورة في الترتيب تأتي أولا بترتيبه، وما لم يذكر يبقى بعدها
 * بترتيب المحرك. الترتيب ينطبق على كل جهة (فوق/تحت) على حدة.
 */
export function sortLinesByManualOrder(lines: ClassicLine[], lineOrder?: string[]): ClassicLine[] {
  if (!lineOrder || lineOrder.length === 0) return lines;

  const rank = new Map(lineOrder.map((id, index) => [id, index]));
  const listed = new Set(lineOrder);

  const withIndex = lines.map((line, index) => ({ line, index }));
  withIndex.sort((first, second) => {
    const firstRank = rankOf(rank, listed, first.line);
    const secondRank = rankOf(rank, listed, second.line);
    if (firstRank !== secondRank) return firstRank - secondRank;
    return first.index - second.index;
  });

  return withIndex.map((item) => item.line);
}

function rankOf(
  rank: Map<string, number>,
  listed: Set<string>,
  line: ClassicLine
): number {
  if (rank.has(line.id)) return rank.get(line.id) as number;
  for (const merged of line.mergedFrom ?? []) {
    if (rank.has(merged)) return rank.get(merged) as number;
  }
  // غير المذكور يأتي بعد كل المذكورين، بترتيب المحرك بينهم.
  return listed.size;
}

/**
 * ينقل سطرا إلى موضع جديد في قائمة الترتيب بإزاحة المتأثرين.
 *
 * @param lineIds قائمة معرّفات الأسطر الحالية بترتيبها
 * @param lineId السطر المنقول
 * @param targetIndex الموضع الجديد (1-based كما يراه المحرر)
 */
export function moveLineToIndex(lineIds: string[], lineId: string, targetIndex: number): string[] {
  const without = lineIds.filter((id) => id !== lineId);
  if (!lineIds.includes(lineId)) return [...lineIds];

  const clamped = Math.max(1, Math.min(Math.round(targetIndex), without.length + 1));
  return [...without.slice(0, clamped - 1), lineId, ...without.slice(clamped - 1)];
}

/** ينقل سطرا خطوة واحدة في الترتيب (delta = ١ لأسفل، -١ لأعلى). */
export function shiftLineInOrder(lineIds: string[], lineId: string, delta: number): string[] {
  const index = lineIds.indexOf(lineId);
  if (index === -1) return [...lineIds];
  return moveLineToIndex(lineIds, lineId, index + 1 + delta);
}

/** يبني قائمة ترتيب كاملة من أسطر المحرك، أساس الترتيب اليدوي الأول. */
export function orderSnapshotOf(lines: ClassicLine[]): string[] {
  return lines.map((line) => line.id);
}

// سياق التحديد الموحّد — Selection Context (FR-ED-02)
// مشروع التشجير - نظام القراءات العشر
//
// مصدر الحقيقة الواحد لحالة «العنصر المحدد الآن» هو حقل `selection` في مخزن
// المحرر. هذه الوحدة النقيّة تُحوّل ذلك الحقل إلى:
//   1) سلسلة سياق (Breadcrumb) تُظهر التسلسل الهرمي: الآية ← السطر ← الجزء ←
//      الاختلاف ← الوجه (AC-06).
//   2) وصف موحّد للعنصر المحدد (النوع، المعرف، الآية، الموضع).
//
// مبدأ: لا تملك أي لوحة نظام تحديد مستقلًا (P-07). كل اللوحات تقرأ نفس
// `selection` وتصفه عبر هذه الدوال النقيّة، فلا منطق مكرر ولا تعارض.

import type { EditorSelection } from '@/types/tashjeer';

/** فتّاش الكيانات: توفّره الواجهة، والوحدة النقيّة تستهلكه بلا DOM. */
export interface SelectionLookup {
  surahNumber: number;
  ayahNumber: number;
  /** عنوان الاختلاف بمعرّفه، أو undefined. */
  variantTitle?: (id: string) => string | undefined;
  /** عنوان الوجه داخل اختلاف، أو undefined. */
  faceLabel?: (variantId: string, faceId: string) => string | undefined;
  /** عنوان الجزء بمعرّفه. */
  segmentTitle?: (id: string) => string | undefined;
  /** عنوان السطر/المسار بمعرّفه. */
  lineTitle?: (id: string) => string | undefined;
  /** نص الكلمة بمعرّفها. */
  wordText?: (id: number) => string | undefined;
  /** عنوان قاعدة عامة بمعرّفها. */
  ruleTitle?: (id: string) => string | undefined;
  /** عنوان الوجه المركب (الرابط) بمعرّفه. */
  linkTitle?: (id: string) => string | undefined;
  /** عنوان علامة الوقف/الابتداء بمعرّفها. */
  boundaryTitle?: (id: string) => string | undefined;
}

/** درجة في سلسلة السياق. */
export interface BreadcrumbCrumb {
  kind: EditorSelection['kind'] | 'AYAH';
  label: string;
}

/** وصف موحّد للعنصر المحدد (لشريط التفاصيل وللوصول الموحّد). */
export interface SelectionSummary {
  kind: EditorSelection['kind'];
  id: string;
  label: string;
  ayah: string;
  position?: number;
  /** هل العنصر أصغر درجة (وجه/حرف) أم أعلى (آية/سطر)؟ */
  leaf: boolean;
}

const KIND_LABEL: Record<EditorSelection['kind'], string> = {
  WORD: 'كلمة',
  CHARACTER: 'حرف',
  LOCUS: 'موضع',
  LINE: 'سطر',
  SEGMENT: 'جزء',
  DIFFERENCE: 'اختلاف',
  FACE: 'وجه',
  RULE: 'قاعدة',
  COMPOSITE_FACE: 'وجه مركب',
  WAQF_MARK: 'علامة وقف',
};

/** يبني عنوان الآية بصيغة «سورة:آية». */
export function ayahRef(lookup: Pick<SelectionLookup, 'surahNumber' | 'ayahNumber'>): string {
  return `${lookup.surahNumber}:${lookup.ayahNumber}`;
}

/**
 * يبني سلسلة السياق (Breadcrumb) من التحديد: الآية ← السطر ← الجزء ←
 * الاختلاف ← الوجه. تستعملها شريط التفاصيل وقابلية «الوصول الموحّد» (FR-ED-02.2).
 */
export function buildSelectionBreadcrumb(
  selection: EditorSelection | null,
  lookup: SelectionLookup
): BreadcrumbCrumb[] {
  const crumbs: BreadcrumbCrumb[] = [{ kind: 'AYAH', label: `آية ${ayahRef(lookup)}` }];
  if (!selection) return crumbs;

  if (selection.kind === 'LINE' && selection.lineId) {
    const title = lookup.lineTitle?.(selection.lineId) ?? 'سطر';
    crumbs.push({ kind: 'LINE', label: title });
  }
  if (selection.kind === 'SEGMENT') {
    const title = lookup.segmentTitle?.(selection.id) ?? 'جزء';
    crumbs.push({ kind: 'SEGMENT', label: title });
  }
  if (selection.kind === 'DIFFERENCE' || selection.differenceId) {
    const id = selection.differenceId ?? selection.id;
    const title = lookup.variantTitle?.(id) ?? 'اختلاف';
    crumbs.push({ kind: 'DIFFERENCE', label: title });
  }
  if (selection.kind === 'FACE' || selection.faceId) {
    const variantId = selection.differenceId ?? '';
    const faceId = selection.faceId ?? selection.id;
    const label = lookup.faceLabel?.(variantId, faceId) ?? 'وجه';
    crumbs.push({ kind: 'FACE', label });
  }
  if (selection.kind === 'WORD' || selection.kind === 'CHARACTER') {
    const text = lookup.wordText?.(Number(selection.wordId ?? selection.id));
    crumbs.push({ kind: selection.kind, label: text ?? 'كلمة' });
    if (selection.kind === 'CHARACTER') {
      crumbs.push({ kind: 'CHARACTER', label: `الحرف ${describeOrdinal(selection.characterIndex)}` });
    }
  }
  if (selection.kind === 'LOCUS') {
    crumbs.push({ kind: 'LOCUS', label: `موضع ${selection.id}` });
  }
  if (selection.kind === 'COMPOSITE_FACE') {
    crumbs.push({ kind: 'COMPOSITE_FACE', label: lookup.linkTitle?.(selection.id) ?? 'وجه مركب' });
  }
  if (selection.kind === 'WAQF_MARK') {
    crumbs.push({ kind: 'WAQF_MARK', label: lookup.boundaryTitle?.(selection.id) ?? 'علامة وقف' });
  }
  if (selection.kind === 'RULE') {
    const title = lookup.ruleTitle?.(selection.id) ?? 'قاعدة';
    crumbs.push({ kind: 'RULE', label: title });
  }
  return crumbs;
}

/** يصفّح رقما ترتيبيا عربيا (1 → «الأول»). يُستعمل لعرض الحرف في السلسلة. */
export function describeOrdinal(index: number | undefined): string {
  if (typeof index !== 'number' || Number.isNaN(index)) return '—';
  const ordinals = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
  return ordinals[index] ?? `رقم ${index + 1}`;
}

/** يلخّص العنصر المحدد في وصف موحّد للوصول والتفاصيل (FR-ED-02.4/6). */
export function describeSelection(
  selection: EditorSelection | null,
  lookup: SelectionLookup
): SelectionSummary | null {
  if (!selection) return null;

  const base = {
    id: selection.id,
    ayah: ayahRef(lookup),
    position: selection.position,
  };

  switch (selection.kind) {
    case 'WORD':
      return { kind: 'WORD', ...base, label: lookup.wordText?.(Number(selection.id)) ?? 'كلمة', leaf: true };
    case 'CHARACTER':
      return {
        kind: 'CHARACTER',
        ...base,
        label: `حرف ${describeOrdinal(selection.characterIndex)} من ${lookup.wordText?.(Number(selection.wordId ?? selection.id)) ?? 'كلمة'}`,
        leaf: true,
      };
    case 'LOCUS':
      return { kind: 'LOCUS', ...base, label: `موضع ${selection.id}`, leaf: true };
    case 'COMPOSITE_FACE':
      return {
        kind: 'COMPOSITE_FACE',
        ...base,
        label: lookup.linkTitle?.(selection.id) ?? 'وجه مركب',
        leaf: true,
      };
    case 'WAQF_MARK':
      return {
        kind: 'WAQF_MARK',
        ...base,
        label: lookup.boundaryTitle?.(selection.id) ?? 'علامة وقف',
        leaf: true,
      };
    case 'DIFFERENCE':
      return {
        kind: 'DIFFERENCE',
        ...base,
        label: lookup.variantTitle?.(selection.id) ?? 'اختلاف',
        leaf: false,
      };
    case 'FACE': {
      const variantId = selection.differenceId ?? '';
      return {
        kind: 'FACE',
        ...base,
        label: lookup.faceLabel?.(variantId, selection.id) ?? 'وجه',
        leaf: true,
      };
    }
    case 'SEGMENT':
      return { kind: 'SEGMENT', ...base, label: lookup.segmentTitle?.(selection.id) ?? 'جزء', leaf: false };
    case 'LINE':
      return {
        kind: 'LINE',
        ...base,
        label: lookup.lineTitle?.(selection.lineId ?? selection.id) ?? 'سطر',
        leaf: false,
      };
    case 'RULE':
      return { kind: 'RULE', ...base, label: lookup.ruleTitle?.(selection.id) ?? 'قاعدة', leaf: false };
    default:
      return null;
  }
}

/** تسمية نوع التحديد بالعربية (للعرض الموحّد). */
export function selectionKindLabel(kind: EditorSelection['kind']): string {
  return KIND_LABEL[kind];
}

/**
 * هل يحيل تحديدان إلى الكيان نفسه؟ يُستعمل لمقارنة التحديد الموحّد عبر اللوحات
 * دون الاعتماد على كائن المرجع (FR-ED-02.7: لون/نمط موحّد للتحديد).
 */
export function isSameSelectionTarget(a: EditorSelection | null, b: EditorSelection | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'FACE' && b.kind === 'FACE') {
    return (a.differenceId ?? a.id) === (b.differenceId ?? b.id) && (a.faceId ?? a.id) === (b.faceId ?? b.id);
  }
  if (a.kind === 'LINE' && b.kind === 'LINE') {
    return (a.lineId ?? a.id) === (b.lineId ?? b.id);
  }
  if (a.kind === 'CHARACTER' && b.kind === 'CHARACTER') {
    // هوية الحرف: موضع الكلمة وترتيب الحرف حين وُجدا، وإلا المعرّف نفسه.
    if (a.position !== undefined && a.characterIndex !== undefined && b.position !== undefined && b.characterIndex !== undefined) {
      return a.position === b.position && a.characterIndex === b.characterIndex;
    }
    return a.id === b.id;
  }
  return a.id === b.id;
}

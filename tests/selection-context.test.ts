// اختبارات سياق التحديد الموحّد — Selection Context (FR-ED-02)
// مشروع التشجير - نظام القراءات العشر
//
// مصدر الحقيقة الواحد هو `selection`. هذه الاختبارات تثبت أن سلسلة السياق
// (Breadcrumb) والوصف الموحّد يُشتقّان منه بثبات وبلا منطق مكرر، وأن مقارنة
// التحديد بين اللوحات دقيقة (AC-06).

import { describe, expect, it } from 'vitest';
import type { EditorSelection } from '@/types/tashjeer';
import {
  buildSelectionBreadcrumb,
  describeSelection,
  selectionKindLabel,
  isSameSelectionTarget,
  ayahRef,
  type SelectionLookup,
} from '@/lib/tashjeer/selection-context';

const lookup: SelectionLookup = {
  surahNumber: 2,
  ayahNumber: 4,
  variantTitle: (id) => (id === 'v1' ? 'اختلاف مَٰلِكِ' : undefined),
  faceLabel: (variantId, faceId) => (variantId === 'v1' && faceId === 'f1' ? 'بالياء' : undefined),
  segmentTitle: (id) => (id === 's1' ? 'جزء الكلمة' : undefined),
  lineTitle: (id) => (id === 'line25' ? 'السطر ٢٥' : undefined),
  wordText: (id) => (id === 1002004 ? 'مَٰلِكِ' : undefined),
  ruleTitle: (id) => (id === 'g1' ? 'قاعدة عامة' : undefined),
};

describe('سلسلة السياق (Breadcrumb)', () => {
  it('تبدأ بالآية دائمًا، ولو لم يكن تحديد', () => {
    expect(buildSelectionBreadcrumb(null, lookup)).toEqual([{ kind: 'AYAH', label: 'آية 2:4' }]);
  });

  it('تبني سلسلة اختلاف ← وجه', () => {
    const selection: EditorSelection = { kind: 'FACE', id: 'f1', differenceId: 'v1', faceId: 'f1' };
    const crumbs = buildSelectionBreadcrumb(selection, lookup);
    expect(crumbs.map((c) => c.label)).toEqual(['آية 2:4', 'اختلاف مَٰلِكِ', 'بالياء']);
  });

  it('تعرض السطر عند تحديده', () => {
    const selection: EditorSelection = { kind: 'LINE', id: 'line25', lineId: 'line25' };
    const crumbs = buildSelectionBreadcrumb(selection, lookup);
    expect(crumbs.map((c) => c.label)).toEqual(['آية 2:4', 'السطر ٢٥']);
  });

  it('تعرض الكلمة عند تحديدها', () => {
    const selection: EditorSelection = { kind: 'WORD', id: '1002004', position: 3 };
    expect(buildSelectionBreadcrumb(selection, lookup).at(-1)?.label).toBe('مَٰلِكِ');
  });
});

describe('الوصف الموحّد (FR-ED-02.4)', () => {
  it('يصف الكلمة المحددة كورقة (leaf)', () => {
    const summary = describeSelection({ kind: 'WORD', id: '1002004', position: 3 }, lookup);
    expect(summary?.label).toBe('مَٰلِكِ');
    expect(summary?.leaf).toBe(true);
    expect(summary?.ayah).toBe('2:4');
  });

  it('يصف الاختلاف كعقدة غير ورقية', () => {
    const summary = describeSelection({ kind: 'DIFFERENCE', id: 'v1' }, lookup);
    expect(summary?.label).toBe('اختلاف مَٰلِكِ');
    expect(summary?.leaf).toBe(false);
  });

  it('يُرجع null عند غياب التحديد', () => {
    expect(describeSelection(null, lookup)).toBeNull();
  });
});

describe('تسمية النوع ومقارنة التحديد', () => {
  it('تسمية الأنواع بالعربية', () => {
    expect(selectionKindLabel('FACE')).toBe('وجه');
    expect(selectionKindLabel('DIFFERENCE')).toBe('اختلاف');
  });

  it('مقارنة هدفين متطابقين عبر اللوحات', () => {
    const a: EditorSelection = { kind: 'FACE', id: 'f1', differenceId: 'v1', faceId: 'f1' };
    const b: EditorSelection = { kind: 'FACE', id: 'f1', differenceId: 'v1', faceId: 'f1' };
    expect(isSameSelectionTarget(a, b)).toBe(true);
  });

  it('تمييز هدفين مختلفين', () => {
    const a: EditorSelection = { kind: 'LINE', id: 'l1', lineId: 'l1' };
    const b: EditorSelection = { kind: 'LINE', id: 'l2', lineId: 'l2' };
    expect(isSameSelectionTarget(a, b)).toBe(false);
  });

  it('مرجع الآية', () => {
    expect(ayahRef({ surahNumber: 1, ayahNumber: 4 })).toBe('1:4');
  });
});

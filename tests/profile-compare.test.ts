// اختبارات مقارنة ملفات المحرك — Profile Comparison (FR-ES-11)
// مشروع التشجير - نظام القراءات العشر

import { describe, expect, it } from 'vitest';
import type { EngineConfig, MergeMatrixEntry } from '@/lib/tashjeer/model/v8';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';
import {
  compareProfiles,
  isSafeToAdopt,
  DEFAULT_COMPARE_INPUTS,
  type CompareInput,
} from '@/lib/tashjeer/decision/profile-compare';

const profile: EngineConfig = { ...DEFAULT_SYSTEM_PROFILE };

function withMatrix(matrix: MergeMatrixEntry[]): EngineConfig {
  return { ...DEFAULT_SYSTEM_PROFILE, mergeMatrix: matrix };
}

const inputs: CompareInput[] = [
  { id: 'a', differenceType: 'MADD', relatedType: 'TAHQIQ', referenceMerge: true },
  { id: 'b', differenceType: 'FARSH', relatedType: 'MADD', referenceMerge: false },
];

describe('مقارنة ملفّين (FR-ES-11)', () => {
  it('يصنّف SAME عندما يتّفق القراران', () => {
    const report = compareProfiles(profile, profile, inputs);
    expect(report.total).toBe(2);
    expect(report.same).toBe(2);
    expect(report.changed).toBe(0);
    expect(report.improved).toBe(0);
    expect(report.regressed).toBe(0);
  });

  it('يصنّف CHANGED عند اختلاف بلا مرجع، وIMPROVED/REGRESSED مع المرجع', () => {
    // الملف البديل يعكس قرار مد+تحقيق (المرجعي = دمج): B يفصل → تراجع.
    const alt = withMatrix([{ a: 'MADD', b: 'TAHQIQ', merge: false, priority: 200, reason: 'تجريبي' }]);
    const report = compareProfiles(profile, alt, inputs);
    const maddItem = report.items.find((item) => item.id === 'a')!;
    expect(maddItem.class).toBe('REGRESSED');
    expect(maddItem.aMerge).toBe(true);
    expect(maddItem.bMerge).toBe(false);
  });

  it('يصنّف IMPROVED حين يصحّح B خطأ A وفق المرجع', () => {
    // A يفصل خطأً (المرجعي = دمج)، B يدمج فيتحسّن.
    const a = withMatrix([{ a: 'MADD', b: 'TAHQIQ', merge: false, priority: 200, reason: 'خطأ' }]);
    const report = compareProfiles(a, profile, inputs);
    expect(report.items.find((item) => item.id === 'a')!.class).toBe('IMPROVED');
  });

  it('isSafeToAdopt يرفض وجود تراجع', () => {
    const alt = withMatrix([{ a: 'MADD', b: 'TAHQIQ', merge: false, priority: 200, reason: 'تجريبي' }]);
    expect(isSafeToAdopt(compareProfiles(profile, alt, inputs))).toBe(false);
    expect(isSafeToAdopt(compareProfiles(profile, profile, inputs))).toBe(true);
  });

  it('المدخلات الافتراضية تغطّي الأزواج الشائعة', () => {
    expect(DEFAULT_COMPARE_INPUTS.length).toBeGreaterThanOrEqual(4);
  });
});

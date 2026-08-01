// اختبارات محلّل النطاقات - Scope Resolver Tests
// مشروع التشجير - نظام القراءات العشر
//
// النطاق هو ما يمنع تكرار الحكم الواحد عشرين مرة. أي خطأ هنا ينسب قراءة
// إلى غير أهلها، وهو أخطر أنواع الخلل في هذا المشروع.

import { describe, expect, it } from 'vitest';
import {
  ALL_NARRATOR_IDS,
  complementScope,
  describeScope,
  formatPathName,
  getFullNarratorName,
  getNarratorName,
  getNarratorOrder,
  normalizeScope,
  resolveScope,
  scopeIncludes,
  scopeSize,
  scopesOverlap,
} from '@/lib/tashjeer/scope';

describe('حل النطاقات', () => {
  it('الرواة عشرون ومرتبون حسب طيبة النشر', () => {
    expect(ALL_NARRATOR_IDS).toHaveLength(20);
    expect(ALL_NARRATOR_IDS[0]).toBe('narrator-qalun');
    expect(ALL_NARRATOR_IDS[8]).toBe('narrator-hafs');
    expect(ALL_NARRATOR_IDS[19]).toBe('narrator-ishaq');
  });

  it('النطاق العام يشمل الجميع', () => {
    expect(resolveScope({ kind: 'ALL' })).toHaveLength(20);
  });

  it('نطاق الاستثناء يطرح المذكورين', () => {
    const scope = { kind: 'ALL_EXCEPT' as const, narratorIds: ['narrator-hafs'] };
    const result = resolveScope(scope);

    expect(result).toHaveLength(19);
    expect(result).not.toContain('narrator-hafs');
  });

  it('نطاق الإمام يشمل راوييه فقط', () => {
    const result = resolveScope({ kind: 'IMAMS', imamIds: ['imam-asim'] });
    expect(result).toEqual(['narrator-hafs', 'narrator-shubah']);
  });

  it('نطاق عدة أئمة يعيد الرواة بترتيب الطيبة لا بترتيب الإدخال', () => {
    const result = resolveScope({
      kind: 'IMAMS',
      imamIds: ['imam-khalaf', 'imam-nafi'],
    });

    expect(result[0]).toBe('narrator-qalun');
    expect(result[3]).toBe('narrator-ishaq');
  });

  it('نطاق الطرق يستنتج الرواة من الطرق', () => {
    const result = resolveScope({
      kind: 'PATHS',
      pathIds: ['path-hafs-ubayd', 'path-warsh-al-azraq'],
    });

    expect(result).toContain('narrator-hafs');
    expect(result).toContain('narrator-warsh');
    expect(result).toHaveLength(2);
  });

  it('يتجاهل المعرّفات غير الموجودة', () => {
    expect(resolveScope({ kind: 'NARRATORS', narratorIds: ['لا-يوجد'] })).toHaveLength(0);
  });

  it('يزيل التكرار', () => {
    const result = resolveScope({
      kind: 'NARRATORS',
      narratorIds: ['narrator-hafs', 'narrator-hafs'],
    });
    expect(result).toHaveLength(1);
  });
});

describe('دوال الاستعلام', () => {
  it('scopeSize يعطي العدد الصحيح', () => {
    expect(scopeSize({ kind: 'ALL' })).toBe(20);
    expect(scopeSize({ kind: 'IMAMS', imamIds: ['imam-nafi'] })).toBe(2);
  });

  it('scopeIncludes يكشف الانتماء', () => {
    expect(scopeIncludes({ kind: 'ALL' }, 'narrator-hafs')).toBe(true);
    expect(
      scopeIncludes({ kind: 'ALL_EXCEPT', narratorIds: ['narrator-hafs'] }, 'narrator-hafs')
    ).toBe(false);
  });

  it('scopesOverlap يكشف التعارض بين وجهين', () => {
    const a = { kind: 'IMAMS' as const, imamIds: ['imam-asim'] };
    const b = { kind: 'NARRATORS' as const, narratorIds: ['narrator-hafs'] };
    const c = { kind: 'NARRATORS' as const, narratorIds: ['narrator-warsh'] };

    expect(scopesOverlap(a, b)).toBe(true);
    expect(scopesOverlap(a, c)).toBe(false);
  });
});

describe('اختصار النطاقات', () => {
  it('يختصر كل الرواة إلى ALL', () => {
    expect(normalizeScope(ALL_NARRATOR_IDS)).toEqual({ kind: 'ALL' });
  });

  it('يختصر راويي إمام إلى IMAMS', () => {
    const scope = normalizeScope(['narrator-hafs', 'narrator-shubah']);
    expect(scope).toEqual({ kind: 'IMAMS', imamIds: ['imam-asim'] });
  });

  it('يستعمل الاستثناء حين يكون أقصر', () => {
    const nineteen = ALL_NARRATOR_IDS.filter((id) => id !== 'narrator-hafs');
    const scope = normalizeScope(nineteen);

    expect(scope.kind).toBe('ALL_EXCEPT');
    expect(scope.narratorIds).toEqual(['narrator-hafs']);
    expect(resolveScope(scope)).toHaveLength(19);
  });

  it('الاختصار لا يغيّر مجموعة الرواة الناتجة', () => {
    const sample = ['narrator-warsh', 'narrator-al-susi', 'narrator-ruways'];
    expect(resolveScope(normalizeScope(sample)).sort()).toEqual([...sample].sort());
  });

  it('النطاق المكمّل يغطي بقية الرواة تماما', () => {
    const scope = { kind: 'IMAMS' as const, imamIds: ['imam-asim'] };
    const complement = complementScope(scope);

    expect(resolveScope(complement)).toHaveLength(18);
    expect(scopesOverlap(scope, complement)).toBe(false);
  });
});

describe('وصف النطاقات بالعربية', () => {
  it('يصف النطاق العام', () => {
    expect(describeScope({ kind: 'ALL' })).toBe('الجميع');
  });

  it('يصف الاستثناء', () => {
    expect(
      describeScope({ kind: 'ALL_EXCEPT', narratorIds: ['narrator-hafs'] })
    ).toBe('الجميع إلا حفص');
  });

  it('يصف الإمام الكامل بصيغة مختصرة', () => {
    expect(describeScope({ kind: 'IMAMS', imamIds: ['imam-asim'] })).toBe('عاصم بكماله');
  });

  it('يفضّل وصف الإمام حين تكتمل رواته', () => {
    // قالون وورش هما راويا نافع، والبزي وقنبل راويا ابن كثير،
    // فالوصف بالإمامين أدق وأقصر من تعداد أربعة رواة.
    const scope = {
      kind: 'NARRATORS' as const,
      narratorIds: ['narrator-qalun', 'narrator-warsh', 'narrator-al-bazzi', 'narrator-qunbul'],
    };

    expect(describeScope(scope, { short: true })).toBe('نافع وابن كثير');
  });

  it('يختصر القوائم الطويلة المتفرقة في الوضع القصير', () => {
    // رواة من أئمة مختلفين بلا اكتمال أي إمام: هنا يظهر الاختصار بالعدد.
    const scope = {
      kind: 'NARRATORS' as const,
      narratorIds: ['narrator-qalun', 'narrator-al-bazzi', 'narrator-hafs', 'narrator-ruways'],
    };

    const description = describeScope(scope, { short: true });
    expect(description).toContain('آخرين');
    expect(description).toContain('قالون');
  });

  it('الوصف الكامل يعدّد الأسماء كلها', () => {
    const scope = {
      kind: 'NARRATORS' as const,
      narratorIds: ['narrator-qalun', 'narrator-al-bazzi', 'narrator-hafs'],
    };

    expect(describeScope(scope)).toBe('قالون، البزي وحفص');
  });

  it('يميّز الراويين المتشابهين في الاسم', () => {
    // الدوري راو عن أبي عمرو وعن الكسائي، فلا بد من التمييز.
    expect(getNarratorName('narrator-al-duri-abu-amr')).toBe('الدوري (أبو عمرو)');
    expect(getNarratorName('narrator-al-duri-kisai')).toBe('الدوري (الكسائي)');
    expect(getNarratorName('narrator-hafs')).toBe('حفص');
  });

  it('يعطي الاسم الكامل بصيغة الرواية', () => {
    expect(getFullNarratorName('narrator-hafs')).toBe('حفص عن عاصم');
  });

  it('يعطي ترتيب الراوي في الطيبة', () => {
    expect(getNarratorOrder('narrator-qalun')).toBe(1);
    expect(getNarratorOrder('narrator-hafs')).toBe(9);
    expect(getNarratorOrder('غير-موجود')).toBe(999);
  });

  it('يصيغ اسم الطريق بشكل سليم', () => {
    expect(formatPathName('path-warsh-al-azraq')).toBe('الأزرق عن ورش');
    expect(formatPathName('path-qalun-abu-nashit')).toBe('أبو نشيط عن قالون');
  });

  it('يصف النطاق المعتمد على الطرق التفصيلية', () => {
    const scope = {
      kind: 'PATHS' as const,
      pathIds: ['path-warsh-al-azraq', 'path-qalun-abu-nashit'],
    };
    expect(describeScope(scope)).toBe('الأزرق عن ورش وأبو نشيط عن قالون');
  });
});

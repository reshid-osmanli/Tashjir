// اختبارات بطاقات القراء: رمز الإمام، ورمز الراوي، واسم الطريق
//
// القاعدة المطلوبة في طرف السطر:
//   • اجتمع راويا الإمام  → رمز الإمام.
//   • انفرد راوٍ أو اجتمع طريقاه → رمز الراوي.
//   • انفرد طريق من طرق الراوي → اسم الطريق مكتوبا (ولا رمز للطرق).

import { describe, expect, it } from 'vitest';
import {
  chipsForUnits,
  describeReaderChips,
  getImamSymbol,
  getPathShortName,
  resolveReaderChips,
  scopeToUnits,
} from '@/lib/tashjeer/reader-symbols';
import {
  createDefaultTransmissionCatalog,
  normalizeTransmissionCatalog,
} from '@/lib/transmissions/catalog';

describe('رمز الإمام', () => {
  it('للأئمة العشرة رموز افتراضية في البذرة', () => {
    expect(getImamSymbol('imam-nafi')).toBe('أ');
    expect(getImamSymbol('imam-asim')).toBe('ذ');
  });

  it('يتقدّم رمز لوحة التحكم على البذرة', () => {
    const base = createDefaultTransmissionCatalog();
    const catalog = normalizeTransmissionCatalog({
      ...base,
      imams: base.imams.map((imam) =>
        imam.id === 'imam-nafi' ? { ...imam, symbol: 'ن' } : imam
      ),
    });

    expect(getImamSymbol('imam-nafi', catalog)).toBe('ن');
  });
});

describe('اختصار البطاقات', () => {
  it('يرفع راويي الإمام إلى بطاقة إمام واحدة', () => {
    const chips = resolveReaderChips({
      kind: 'NARRATORS',
      narratorIds: ['narrator-qalun', 'narrator-warsh'],
    });

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ kind: 'IMAM', id: 'imam-nafi', symbol: 'أ' });
    expect(chips[0].narratorIds).toEqual(['narrator-qalun', 'narrator-warsh']);
  });

  it('يبقي الراوي المنفرد ببطاقة راوٍ ويطبع اسمه', () => {
    const chips = resolveReaderChips({ kind: 'NARRATORS', narratorIds: ['narrator-qalun'] });

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      kind: 'NARRATOR',
      id: 'narrator-qalun',
      symbol: 'ب',
      name: 'قالون',
      text: 'ب',
    });
  });

  it('يحفظ رمز الطريق إن وضعه المشرف، ويبقى النص اسم الطريق', () => {
    const base = createDefaultTransmissionCatalog();
    const catalog = normalizeTransmissionCatalog({
      ...base,
      paths: base.paths.map((path) =>
        path.id === 'path-warsh-al-azraq' ? { ...path, symbol: 'أز' } : path
      ),
    });

    const chips = resolveReaderChips({ kind: 'PATHS', pathIds: ['path-warsh-al-azraq'] }, catalog);
    expect(chips[0]).toMatchObject({ kind: 'PATH', name: 'الأزرق', symbol: 'أز', text: 'الأزرق' });
  });

  it('يطبع اسم الطريق بلا رمز إذا انفرد بالوجه', () => {
    const chips = resolveReaderChips({ kind: 'PATHS', pathIds: ['path-warsh-al-azraq'] });

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ kind: 'PATH', name: 'الأزرق', symbol: '' });
    expect(chips[0].text).toBe('الأزرق');
  });

  it('يرجع إلى الراوي إذا اجتمع طريقاه', () => {
    const chips = resolveReaderChips({
      kind: 'PATHS',
      pathIds: ['path-warsh-al-azraq', 'path-warsh-al-asbahani'],
    });

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ kind: 'NARRATOR', id: 'narrator-warsh', symbol: 'ج' });
  });

  it('يجمع الطريق المنفرد مع إمام كامل في بطاقتين متمايزتين', () => {
    const chips = chipsForUnits([
      { narratorId: 'narrator-warsh', pathId: 'path-warsh-al-azraq' },
      { narratorId: 'narrator-hafs' },
      { narratorId: 'narrator-shubah' },
    ]);

    // الترتيب ترتيب الأمة: طريق ورش (الثاني في الطيبة) قبل إمام عاصم.
    expect(chips.map((chip) => chip.kind)).toEqual(['PATH', 'IMAM']);
    expect(chips[0].name).toBe('الأزرق');
    expect(chips[1].id).toBe('imam-asim');
  });

  it('يصف البطاقات وصفا مفهوما للمراجعة', () => {
    const chips = resolveReaderChips({ kind: 'IMAMS', imamIds: ['imam-nafi'] });
    expect(describeReaderChips(chips)).toBe('نافع (بكماله)');
  });
});

describe('وحدات القراءة', () => {
  it('يحوّل نطاق الطرق إلى وحدات طرق', () => {
    const units = scopeToUnits({ kind: 'PATHS', pathIds: ['path-qalun-abu-nashit'] });
    expect(units).toEqual([{ narratorId: 'narrator-qalun', pathId: 'path-qalun-abu-nashit' }]);
  });

  it('يحوّل نطاق الإمام إلى وحدات رواة كاملة', () => {
    const units = scopeToUnits({ kind: 'IMAMS', imamIds: ['imam-nafi'] });
    expect(units).toEqual([{ narratorId: 'narrator-qalun' }, { narratorId: 'narrator-warsh' }]);
  });

  it('يعطي اسم الطريق مجردا من اسم راويه', () => {
    expect(getPathShortName('path-warsh-al-asbahani')).toBe('الأصبهاني');
    expect(getPathShortName('path-hafs-ubayd')).toBe('عبيد');
  });
});

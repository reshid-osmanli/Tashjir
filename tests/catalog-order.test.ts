// اختبارات الترتيب الصريح للقراء/الرواة/الطرق وتعارضاته (FR-ED-14، DM-04)
import { describe, expect, it } from 'vitest';
import { findOrderConflict, insertWithShift, movePeer, renumberByPosition, replacePeers } from '@/lib/transmissions/catalog';

const peers = [
  { id: 'a', order: 1 },
  { id: 'b', order: 2 },
  { id: 'c', order: 3 },
];

describe('تعارض رقم الترتيب', () => {
  it('يكشف من يشغل الرقم ويستثني العنصر نفسه', () => {
    expect(findOrderConflict(peers, 'x', 2)?.occupant.id).toBe('b');
    expect(findOrderConflict(peers, 'b', 2)).toBeNull();
    expect(findOrderConflict(peers, 'x', 9)).toBeNull();
  });

  it('الإدراج مع الإزاحة يزيح من بعده رقما واحدا ويحفظ الترتيب النسبي', () => {
    const result = insertWithShift(peers, { id: 'x', order: 2 }, 2).sort((p, q) => p.order - q.order);
    expect(result.map((p) => `${p.id}:${p.order}`)).toEqual(['a:1', 'x:2', 'b:3', 'c:4']);
  });

  it('نقل عنصر موجود إلى رقم أعلى لا يترك فجوة', () => {
    const result = insertWithShift(peers, { id: 'a', order: 3 }, 3).sort((p, q) => p.order - q.order);
    expect(result.map((p) => `${p.id}:${p.order}`)).toEqual(['b:1', 'c:2', 'a:3']);
  });

  it('رقم أكبر من العدد يُلحق في الآخر', () => {
    const result = insertWithShift(peers, { id: 'x', order: 10 }, 10);
    expect(result.find((p) => p.id === 'x')?.order).toBe(10);
    expect(result.filter((p) => p.id !== 'x').map((p) => p.order)).toEqual([1, 2, 3]);
  });
});

describe('السحب وإعادة الترقيم', () => {
  it('movePeer يعيد الترقيم 1..n دون تغيير المعرّفات', () => {
    const moved = movePeer(peers, 'c', 0);
    expect(moved.map((p) => `${p.id}:${p.order}`)).toEqual(['c:1', 'a:2', 'b:3']);
  });

  it('renumberByPosition يحافظ على المراجع غير المتغيرة', () => {
    const out = renumberByPosition(peers);
    expect(out[0]).toBe(peers[0]);
  });

  it('replacePeers يستبدل داخل قائمة أكبر فقط ما تغيّر', () => {
    const all = [...peers, { id: 'z', order: 1 }];
    const out = replacePeers(all, movePeer(peers, 'b', 0));
    expect(out.find((p) => p.id === 'z')?.order).toBe(1);
    expect(out.find((p) => p.id === 'b')?.order).toBe(1);
    expect(out.find((p) => p.id === 'a')?.order).toBe(2);
  });
});

// ==================== الحزمة 03: إعادة التسمية لا تعيد الترتيب ====================
//
// معيار القبول: «تعديل اسم قارئ لا يغيّر ترتيب ظهوره في القوائم (الترتيب من
// البيانات)». مفتاح الترتيب في كل قوائم القراء/الرواة/الطرق هو الرقم الصريح
// (order/legacyOrderInTayyibah) والاسم مجرد كاسر تعادل لا أكثر — هذه الاختبارات
// تحرس ذلك فلا ينتكس الترتيب إلى أبجدي الاسم.

describe('إعادة تسمية قارئ لا تغيّر ترتيب القوائم (AC الحزمة 03)', () => {
  const imams = [
    { id: 'i-nafi', name: 'نافع', slug: 'nafi', order: 1 },
    { id: 'i-ibn-kathir', name: 'ابن كثير', slug: 'ibn-kathir', order: 2 },
    { id: 'i-abu-amr', name: 'أبو عمرو', slug: 'abu-amr', order: 3 },
  ];
  const narrators = [
    { id: 'n-qalun', imamId: 'i-nafi', name: 'قالون', slug: 'qalun', order: 1, legacyOrderInTayyibah: 2 },
    { id: 'n-warsh', imamId: 'i-nafi', name: 'ورش', slug: 'warsh', order: 2, legacyOrderInTayyibah: 1 },
    { id: 'n-al-bazzi', imamId: 'i-ibn-kathir', name: 'البزي', slug: 'al-bazzi', order: 1, legacyOrderInTayyibah: 4 },
  ];
  const paths = [
    { id: 'p-warsh', narratorId: 'n-warsh', code: 'warsh', shortName: 'ورش', fullName: 'ورش عن نافع', order: 1, depth: 1, isCanonical: true },
    { id: 'p-azraq', narratorId: 'n-warsh', code: 'azraq', shortName: 'الأزرق', fullName: 'الأزرق عن ورش', order: 2, depth: 2, isCanonical: false },
    { id: 'p-isab', narratorId: 'n-warsh', code: 'isab', shortName: 'الأصبهاني', fullName: 'الأصبهاني عن ورش', order: 3, depth: 2, isCanonical: false },
  ];

  it('ترتيب الأئمة يثبت بعد إعادة تسمية أحدهم بما يقلب الترتيب الأبجدي', async () => {
    const { catalogImamsInOrder } = await import('@/lib/transmissions/catalog');
    const before = catalogImamsInOrder({ imams, narrators, paths } as never).map((imam) => imam.id);
    // «آل» أبجديًا قبل «أبو عمرو» و«ابن كثير» — لو صار الاسم مفتاح الترتيب لانقلب.
    const renamed = imams.map((imam) => (imam.id === 'i-abu-amr' ? { ...imam, name: 'آل عمرو' } : imam));
    const after = catalogImamsInOrder({ imams: renamed, narrators, paths } as never).map((imam) => imam.id);
    expect(after).toEqual(before);
    expect(after).toEqual(['i-nafi', 'i-ibn-kathir', 'i-abu-amr']);
  });

  it('ترتيب الرواة (طيبة أولا ثم order) يثبت بعد إعادة التسمية', async () => {
    const { catalogNarratorsInOrder } = await import('@/lib/transmissions/catalog');
    const before = catalogNarratorsInOrder({ imams, narrators, paths } as never).map((narrator) => narrator.id);
    // ورش (طيبة 1) قبل قالون (طيبة 2) قبل البزي (طيبة 4) رغم الأبجدية.
    expect(before).toEqual(['n-warsh', 'n-qalun', 'n-al-bazzi']);
    const renamed = narrators.map((narrator) =>
      narrator.id === 'n-al-bazzi' ? { ...narrator, name: 'آل بزي' } : narrator
    );
    const after = catalogNarratorsInOrder({ imams, narrators: renamed, paths } as never).map((narrator) => narrator.id);
    expect(after).toEqual(before);
  });

  it('طرق الراوي الواحد تثبت بعد إعادة تسمية أحدها', async () => {
    const { catalogPathsForNarrator } = await import('@/lib/transmissions/catalog');
    const before = catalogPathsForNarrator({ imams, narrators, paths } as never, 'n-warsh').map((path) => path.id);
    // «آزرق» أبجديًا قبل «الأصبهاني» و«ورش» — لو رُتب بالاسم لانقلب الترتيب.
    const renamed = paths.map((path) => (path.id === 'p-azraq' ? { ...path, shortName: 'آزرق' } : path));
    const after = catalogPathsForNarrator({ imams, narrators, paths: renamed } as never, 'n-warsh').map((path) => path.id);
    expect(after).toEqual(before);
    expect(after).toEqual(['p-warsh', 'p-azraq', 'p-isab']);
  });

  it('normalizeTransmissionCatalog يحفظ موضع المعاد تسميته في المصفوفات', async () => {
    const { normalizeTransmissionCatalog } = await import('@/lib/transmissions/catalog');
    const before = normalizeTransmissionCatalog({
      schemaVersion: 1,
      updatedAt: '2026-09-14T00:00:00.000Z',
      imams,
      narrators,
      paths,
    } as never);
    const renamed = normalizeTransmissionCatalog({
      schemaVersion: 1,
      updatedAt: '2026-09-14T00:00:00.000Z',
      imams: imams.map((imam) => (imam.id === 'i-nafi' ? { ...imam, name: 'يَعْقوب' } : imam)),
      narrators,
      paths,
    } as never);
    expect(renamed.imams.map((imam) => imam.id)).toEqual(before.imams.map((imam) => imam.id));
    expect(renamed.imams.find((imam) => imam.id === 'i-nafi')?.name).toBe('يَعْقوب');
  });
});

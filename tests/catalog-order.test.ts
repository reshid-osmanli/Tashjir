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

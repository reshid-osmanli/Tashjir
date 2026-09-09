// اختبارات خدمة التأكيد الكمي (FR-ED-04.2، NFR-05)
//
// تحرس: وجود مستضيف يجعل التأكيد وعدا معلّقا حتى يجيب المستخدم؛ غيابه لا
// يعلّق شيئا؛ الطلب الجديد يلغي القديم؛ والأثر الكمي يُصاغ بالأرقام العربية.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('window', {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('confirmAction', () => {
  it('بلا مستضيف يعيد true فورا (بيئات الاختبار)', async () => {
    const { confirmAction } = await import('@/lib/ui/confirm-store');
    await expect(confirmAction({ title: 'حذف' })).resolves.toBe(true);
  });

  it('مع مستضيف يبقى معلّقا حتى يُحسم من الحوار', async () => {
    const { confirmAction, useConfirmStore } = await import('@/lib/ui/confirm-store');
    useConfirmStore.getState().setHostMounted(true);

    let settled: boolean | null = null;
    const promise = confirmAction({ title: 'حذف الاختلاف', impacts: [{ label: 'وجه', count: 3 }], undoable: true });
    promise.then((value) => {
      settled = value;
    });

    await Promise.resolve();
    expect(settled).toBeNull();
    expect(useConfirmStore.getState().pending?.title).toBe('حذف الاختلاف');
    expect(useConfirmStore.getState().pending?.impacts).toEqual([{ label: 'وجه', count: 3 }]);

    useConfirmStore.getState().resolve(false);
    await expect(promise).resolves.toBe(false);
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it('طلب جديد فوق طلب معلّق يلغي الأقدم', async () => {
    const { confirmAction, useConfirmStore } = await import('@/lib/ui/confirm-store');
    useConfirmStore.getState().setHostMounted(true);

    const first = confirmAction({ title: 'الأول' });
    const second = confirmAction({ title: 'الثاني' });
    await expect(first).resolves.toBe(false);
    useConfirmStore.getState().resolve(true);
    await expect(second).resolves.toBe(true);
  });

  it('يصوغ الأثر الكمي بالأرقام العربية', async () => {
    const { formatImpact } = await import('@/lib/ui/confirm-store');
    expect(formatImpact({ label: 'موضع', count: 12 })).toBe('١٢ موضع');
  });
});

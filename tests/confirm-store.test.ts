// اختبارات خدمة التأكيد الكمي
//
// الحماية من التغييرات غير المقصودة: مع مستضيف مركّب يبقى الطلب معلّقا حتى
// يجيب المستخدم، فلا يُنفَّذ نقل ولا دمج ولا حذف بلا حوار. خارج المتصفح
// (اختبارات الوحدة/SSR) تُعاد الموافقة فورا لأنه لا يوجد من يجيب.
//
// كان هذا الملف يختبر «الموافقة التلقائية» التي أُزيلت: كانت تُسقط حوار
// التأكيد كله وتخالف اختبارات E2E التي تطلب alertdialog. حُدّث ليعكس
// السلوك الصحيح دون حذف أي اختبار من الاختبارات القديمة.

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

  it('مع مستضيف مركّب يُفتح الحوار ويبقى معلّقا حتى الإلغاء', async () => {
    const { confirmAction, useConfirmStore } = await import('@/lib/ui/confirm-store');
    useConfirmStore.getState().setHostMounted(true);

    const promise = confirmAction({ title: 'حذف الاختلاف', impacts: [{ label: 'وجه', count: 3 }], undoable: true });
    await Promise.resolve();
    // الأثر الكمي محسوب ومعروض، والطلب لم يُحسم بعد.
    expect(useConfirmStore.getState().pending).toMatchObject({
      title: 'حذف الاختلاف',
      undoable: true,
      impacts: [{ label: 'وجه', count: 3 }],
    });
    useConfirmStore.getState().resolve(false);
    await expect(promise).resolves.toBe(false);
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it('تأكيد المستخدم يُعيد true ويُغلق الحوار', async () => {
    const { confirmAction, useConfirmStore } = await import('@/lib/ui/confirm-store');
    useConfirmStore.getState().setHostMounted(true);
    const promise = confirmAction({ title: 'نقل السطر' });
    useConfirmStore.getState().resolve(true);
    await expect(promise).resolves.toBe(true);
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it('الطلبات المتعاقبة كلها تُوافق فوراً بلا مستضيف', async () => {
    const { confirmAction } = await import('@/lib/ui/confirm-store');
    await expect(confirmAction({ title: 'الأول' })).resolves.toBe(true);
    await expect(confirmAction({ title: 'الثاني' })).resolves.toBe(true);
  });

  it('طلب جديد يُلغي الطلب المعلّق ولا يترك وعدا بلا جواب', async () => {
    const { confirmAction, useConfirmStore } = await import('@/lib/ui/confirm-store');
    useConfirmStore.getState().setHostMounted(true);
    const first = confirmAction({ title: 'الأول' });
    const second = confirmAction({ title: 'الثاني' });
    await expect(first).resolves.toBe(false);
    expect(useConfirmStore.getState().pending?.title).toBe('الثاني');
    useConfirmStore.getState().resolve(true);
    await expect(second).resolves.toBe(true);
  });

  it('يصوغ الأثر الكمي بالأرقام العربية', async () => {
    const { formatImpact } = await import('@/lib/ui/confirm-store');
    expect(formatImpact({ label: 'موضع', count: 12 })).toBe('١٢ موضع');
  });
});

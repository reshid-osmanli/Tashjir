// اختبارات خدمة التأكيد الكمي
//
// تم ضبط النظام على الموافقة الفورية التلقائية (auto-approve) للسرعة في العمل
// بناء على طلب المستخدم: لا حوار تأكيد، العمليات تنفذ فوراً.
// Ctrl+Z يبقى متاحا للتراجع.

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

  it('مع مستضيف مركّب تُحسب الأثر الكمي ثم تُوافق فوراً (auto-approve) — لا حاجة لتفاعل المستخدم', async () => {
    const { confirmAction, useConfirmStore } = await import('@/lib/ui/confirm-store');
    useConfirmStore.getState().setHostMounted(true);

    const promise = confirmAction({ title: 'حذف الاختلاف', impacts: [{ label: 'وجه', count: 3 }], undoable: true });
    // pending يُسجل الأثر الكمي للفحص ثم يُحسم في microtask التالية
    await Promise.resolve();
    await Promise.resolve();
    await expect(promise).resolves.toBe(true);
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it('الطلبات المتعاقبة كلها تُوافق فوراً', async () => {
    const { confirmAction } = await import('@/lib/ui/confirm-store');
    await expect(confirmAction({ title: 'الأول' })).resolves.toBe(true);
    await expect(confirmAction({ title: 'الثاني' })).resolves.toBe(true);
  });

  it('يصوغ الأثر الكمي بالأرقام العربية', async () => {
    const { formatImpact } = await import('@/lib/ui/confirm-store');
    expect(formatImpact({ label: 'موضع', count: 12 })).toBe('١٢ موضع');
  });
});

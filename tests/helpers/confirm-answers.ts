// محاكاة إجابة المستخدم على حوار التأكيد الكمي في اختبارات الوحدة
//
// بعد إعادة تفعيل الحوار لم تعد هناك «موافقة تلقائية»: confirmAction يبقى
// معلّقا حتى يجيب المستخدم. هذه الأداة تجيب «تأكيد» (أو «إلغاء») تلقائياً
// عن كل طلب، مع إبقاء الأثر الكمي قابلا للفحص قبل الحسم (الاختبارات تقرأ
// `pending` فورا بعد نداء الإجراء). هكذا تُختبر دورة التأكيد كاملة بدل
// تجاوزها، ولا يُحذف أي اختبار قديم.

import type { useConfirmStore } from '@/lib/ui/confirm-store';

type ConfirmStore = typeof useConfirmStore;

export function answerConfirms(confirm: ConfirmStore, answer = true): () => void {
  confirm.getState().setHostMounted(true);
  return confirm.subscribe((state, previous) => {
    const request = state.pending;
    if (!request || request === previous.pending) return;
    // الحسم في microtask: نفس توقيت نقرة المستخدم على زر الحوار، وبعد أن
    // يقرأ الاختبار الأثر الكمي المعروض.
    queueMicrotask(() => {
      if (confirm.getState().pending === request) confirm.getState().resolve(answer);
    });
  });
}

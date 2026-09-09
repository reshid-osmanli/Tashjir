// خدمة التأكيد الكمي - Quantitative Confirm Service (FR-ED-04.2، NFR-05)
// مشروع التشجير - نظام القراءات العشر
//
// كل عملية مدمّرة (حذف، إعادة ضبط، دمج، نقل) تمر من هنا بدل window.confirm:
//   - حوار عربي RTL بأرقام عربية يذكر ما سيتأثر كمّا (عدد الأوجه/المواضع/
//     الطرق)، لا سؤالا مجرّدا،
//   - يُبيّن هل العملية قابلة للتراجع أم لا،
//   - واجهة واحدة `confirmAction()` تُرجع Promise<boolean> فتبقى مواضع
//     الاستدعاء بسيطة كما كانت مع window.confirm.
//
// المخزن مستقل عن React حتى يُستدعى من أي مكان (مخازن، خطافات، مكوّنات)،
// ومكوّن ConfirmDialogHost في التخطيط هو من يعرضه. خارج المتصفح (اختبارات)
// يُعاد true مباشرة إن لم يوجد مستضيف، فلا تتعطل السيناريوهات الآلية.

import { create } from 'zustand';
import { toArabicDigits } from '@/lib/utils/arabic-numbers';

/** بند كمي يُعرض في الحوار: «٣ أوجه»، «٧ مواضع». */
export interface ConfirmImpactItem {
  label: string;
  count: number;
}

export interface ConfirmRequest {
  title: string;
  /** وصف العملية بجملة واحدة. */
  message?: string;
  /** ما سيتأثر كمّا. */
  impacts?: ConfirmImpactItem[];
  /** هل يمكن التراجع (Ctrl+Z) بعد التنفيذ؟ */
  undoable?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  /** نبرة الزر: خطِرة (حذف) أو عادية (نقل/دمج). */
  tone?: 'danger' | 'default';
}

interface PendingConfirm extends ConfirmRequest {
  id: number;
  resolve: (value: boolean) => void;
}

interface ConfirmState {
  pending: PendingConfirm | null;
  /** هل يوجد مستضيف مركّب يعرض الحوار؟ */
  hostMounted: boolean;
  open: (request: ConfirmRequest) => Promise<boolean>;
  resolve: (value: boolean) => void;
  setHostMounted: (mounted: boolean) => void;
}

let sequence = 0;

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  pending: null,
  hostMounted: false,

  open: (request) =>
    new Promise<boolean>((resolve) => {
      const previous = get().pending;
      // طلب جديد فوق طلب معلّق: يُلغى الأقدم حتى لا يبقى معلّقا للأبد.
      if (previous) previous.resolve(false);
      sequence += 1;
      set({ pending: { ...request, id: sequence, resolve } });
    }),

  resolve: (value) => {
    const current = get().pending;
    if (!current) return;
    set({ pending: null });
    current.resolve(value);
  },

  setHostMounted: (mounted) => set({ hostMounted: mounted }),
}));

/**
 * يطلب تأكيدا كميا ويعيد وعدا بالجواب. إن لم يكن هناك مستضيف مركّب (خارج
 * التطبيق أو في الاختبارات) يُعاد true فورا حتى لا تُعلَّق العمليات.
 */
export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  const state = useConfirmStore.getState();
  if (typeof window === 'undefined' || !state.hostMounted) return Promise.resolve(true);
  return state.open(request);
}

/** يصوغ بندا كميا بالأرقام العربية: «٣ أوجه». */
export function formatImpact(item: ConfirmImpactItem): string {
  return `${toArabicDigits(item.count)} ${item.label}`;
}

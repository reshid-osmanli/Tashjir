// خدمة التأكيد بسبب إلزامي — Reason Confirm Service (FR-ES-07.5، FR-ES-08.2)
// مشروع التشجير - نظام القراءات العشر
//
// القواعد المحمية لا تُغيَّر ولا تُحذف «بتأكيد إضافي صريح»، وتجاوز الانحدار لا
// يُحفظ إلا «بتأكيد صريح بالتجاوز الموثّق». في الحالتين التأكيد وحده لا يكفي:
// يلزم **سبب مكتوب** يُحفظ في إصدار القاعدة وفي سجل التدقيق.
//
// لماذا خدمة مستقلة ولا توسيع `confirmAction` القائمة؟ لأن تلك تُعيد
// `Promise<boolean>` ويستعملها ٤٠+ موضعًا مختبرًا؛ وتغيير عقدها يمسّ المحرر
// كله. هذه تعيد `{ confirmed, reason }` وتُستعمل حيث السبب إلزامي فقط.
//
// خارج المتصفح (اختبارات) أو بلا مستضيف مركّب: يُعاد تأكيد بلا سبب حتى لا
// تُعلَّق العمليات الآلية — والطبقة النقيّة (rule-governance) هي التي ترفض
// التغيير بلا سبب حين يكون السبب شرطًا في الانتقال.

import { create } from 'zustand';
import type { ConfirmImpactItem } from './confirm-store';

export interface ReasonConfirmRequest {
  title: string;
  message?: string;
  /** تحذيرات تُعرض قبل الطلب (قاعدة نافذة/محمية/انحدار). */
  warnings?: string[];
  impacts?: ConfirmImpactItem[];
  /** الفرق المعروض (قبل/بعد) — للانحدار وفرق الإصدارات. */
  diff?: Array<{ label: string; before?: string; after?: string }>;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  undoable?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** أدنى طول مقبول للسبب (افتراضيًا ٣ أحرف). */
  minReasonLength?: number;
}

export interface ReasonConfirmResult {
  confirmed: boolean;
  reason: string;
}

interface PendingReasonConfirm extends ReasonConfirmRequest {
  id: number;
  resolve: (value: ReasonConfirmResult) => void;
}

interface ReasonConfirmState {
  pending: PendingReasonConfirm | null;
  hostMounted: boolean;
  open: (request: ReasonConfirmRequest) => Promise<ReasonConfirmResult>;
  /** يحسم الحوار: `reason` يُهذّب (trim) ويُرفض إن كان أقصر من الحدّ. */
  resolve: (confirmed: boolean, reason?: string) => void;
  setHostMounted: (mounted: boolean) => void;
}

/** الحد الأدنى الافتراضي لطول السبب المكتوب. */
export const DEFAULT_MIN_REASON_LENGTH = 3;

let sequence = 0;

export const useReasonConfirmStore = create<ReasonConfirmState>((set, get) => ({
  pending: null,
  hostMounted: false,

  open: (request) =>
    new Promise<ReasonConfirmResult>((resolve) => {
      const previous = get().pending;
      // طلب جديد فوق طلب معلّق: يُلغى الأقدم حتى لا يبقى معلّقًا للأبد.
      if (previous) previous.resolve({ confirmed: false, reason: '' });
      sequence += 1;
      set({ pending: { ...request, id: sequence, resolve } });
    }),

  resolve: (confirmed, reason) => {
    const current = get().pending;
    if (!current) return;
    const trimmed = (reason ?? '').trim();
    const min = current.minReasonLength ?? DEFAULT_MIN_REASON_LENGTH;
    // التأكيد بلا سبب كافٍ لا يُقبل: يبقى الحوار مفتوحًا (الحارس في الواجهة
    // كذلك، وهذا حارس أخير لمن يستدعي الحلّ برمجيًا).
    if (confirmed && trimmed.length < min) return;
    set({ pending: null });
    current.resolve({ confirmed, reason: confirmed ? trimmed : '' });
  },

  setHostMounted: (mounted) => set({ hostMounted: mounted }),
}));

/**
 * يطلب تأكيدًا بسبب إلزامي. بلا مستضيف (اختبارات/خارج التطبيق) يُعاد تأكيد
 * بلا سبب، والطبقة النقيّة تقرر إن كان السبب شرطًا.
 */
export function confirmWithReason(request: ReasonConfirmRequest): Promise<ReasonConfirmResult> {
  const state = useReasonConfirmStore.getState();
  if (typeof window === 'undefined' || !state.hostMounted) {
    return Promise.resolve({ confirmed: true, reason: '' });
  }
  return state.open(request);
}

/** هل الطلب الحالي قابل للحسم (سبب كافٍ مكتوب)؟ — تُستعمل في تعطيل الزر. */
export function isReasonSufficient(request: ReasonConfirmRequest, reason: string): boolean {
  return reason.trim().length >= (request.minReasonLength ?? DEFAULT_MIN_REASON_LENGTH);
}

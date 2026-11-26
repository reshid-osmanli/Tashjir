// تنفيذ أوامر العنصر النشط — Selection Command Actions (A130 / A129)
//
// كل أمر في قائمة السياق (A130) ولوحة التفاصيل (A129) يجب أن ينفّذ إجراءً
// حقيقيًا. سابقًا كان `default: break` في `SelectionContextMenu.run` يبتلع
// خمسة أوامر (LINK / MOVE_UP / MOVE_DOWN / WHY / UNLINK) بلا أثر، وكان EDIT
// يعمل لنوع واحد فقط. هذا الملف يحوّل الأمر + التحديد إلى «خطة» نقية قابلة
// للاختبار، ثم ينفّذها من مخزن المحرر نفسه (لا نظام تحديد ثانٍ، لا أحداث
// شكلية). الوحدتان تستهلكان الخطة نفسها فلا يختلف سلوكهما.

import type { EditorSelection } from '@/types/tashjeer';
import type { SelectionCommand } from '@/lib/tashjeer/selection-commands';
import { confirmAction } from '@/lib/ui/confirm-store';
import { useEditorStore } from '@/stores/editor-store';

export type DeleteTarget =
  | { kind: 'DIFFERENCE'; id: string }
  | { kind: 'FACE'; id: string; ownerId: string }
  | { kind: 'SEGMENT'; id: string }
  | { kind: 'WAQF_MARK'; id: string }
  | { kind: 'COMPOSITE_FACE'; id: string };

export type EditTarget =
  | { kind: 'DIFFERENCE'; id: string }
  | { kind: 'FACE'; id: string; ownerId: string }
  | { kind: 'SEGMENT'; id: string }
  | { kind: 'LINE'; id: string; ownerId?: string; position?: number }
  | { kind: 'RULE'; id: string };

export type SelectionCommandPlan =
  | { type: 'copy' }
  | { type: 'cut' }
  | { type: 'paste' }
  | { type: 'delete'; target: DeleteTarget }
  | { type: 'copy-id'; text: string }
  | { type: 'edit'; target: EditTarget }
  | { type: 'link'; kind: 'FACE' | 'LINE'; id: string }
  | { type: 'unlink'; linkId: string }
  | { type: 'move-line'; delta: -1 | 1 }
  | { type: 'why'; ruleId: string; differenceId?: string }
  | { type: 'unsupported'; reason: string };

/**
 * يحوّل أمرًا إلى إجراء ملموس. نقيّة: لا DOM ولا مخزن، فتُختبر كل الأوامر
 * independently من الواجهة. `unsupported` لا يُعرض كزر فعّال أبدًا، بل
 * يُترجم إلى رسالة واضحة أو أمر معطّل بسبب معلوم.
 */
export function planSelectionCommand(
  command: Pick<SelectionCommand, 'id'> | SelectionCommand['id'],
  selection: EditorSelection | null
): SelectionCommandPlan {
  const id = typeof command === 'string' ? command : command.id;
  if (!selection && id !== 'COPY_ID') return { type: 'unsupported', reason: 'لا يوجد عنصر محدد.' };

  switch (id) {
    case 'COPY':
      if (selection?.kind === 'LINE' && !selection.differenceId) {
        return { type: 'unsupported', reason: 'لا يوجد اختلاف مرساة في هذا السطر لنسخه.' };
      }
      return { type: 'copy' };
    case 'CUT':
      return { type: 'cut' };
    case 'PASTE':
      // اللصق يمرّ بالتأكيد الكمي دائمًا (لا `pasteSelection` المنخفض المستوى).
      return { type: 'paste' };
    case 'COPY_ID':
      return { type: 'copy-id', text: selection?.id ?? '' };
    case 'DELETE':
      return planDelete(selection!);
    case 'EDIT':
      return planEdit(selection!);
    case 'LINK':
      if (selection?.kind === 'FACE') {
        // FaceSelect يستعمل المفتاح «اختلاف::وجه» لا معرّف الوجه وحده.
        return { type: 'link', kind: 'FACE', id: `${selection.differenceId ?? ''}::${selection.faceId ?? selection.id}` };
      }
      if (selection?.kind === 'LINE') return { type: 'link', kind: 'LINE', id: selection.lineId ?? selection.id };
      return { type: 'unsupported', reason: 'الربط متاح لوجه أو سطر محدد فقط.' };
    case 'UNLINK':
      return { type: 'unlink', linkId: selection!.id };
    case 'MOVE_UP':
      return { type: 'move-line', delta: -1 };
    case 'MOVE_DOWN':
      return { type: 'move-line', delta: 1 };
    case 'WHY':
      return { type: 'why', ruleId: selection!.id, differenceId: selection?.differenceId };
    default:
      return { type: 'unsupported', reason: 'الأمر غير معروف.' };
  }
}

function planDelete(selection: EditorSelection): SelectionCommandPlan {
  switch (selection.kind) {
    case 'DIFFERENCE':
      return { type: 'delete', target: { kind: 'DIFFERENCE', id: selection.id } };
    case 'FACE':
      return { type: 'delete', target: { kind: 'FACE', id: selection.faceId ?? selection.id, ownerId: selection.differenceId ?? '' } };
    case 'SEGMENT':
      return { type: 'delete', target: { kind: 'SEGMENT', id: selection.id } };
    case 'WAQF_MARK':
      return { type: 'delete', target: { kind: 'WAQF_MARK', id: selection.id } };
    case 'COMPOSITE_FACE':
      return { type: 'delete', target: { kind: 'COMPOSITE_FACE', id: selection.id } };
    default:
      return { type: 'unsupported', reason: 'حذف هذا النوع يتم من لوحته المتخصصة.' };
  }
}

function planEdit(selection: EditorSelection): SelectionCommandPlan {
  switch (selection.kind) {
    case 'DIFFERENCE':
    case 'RULE':
      return { type: 'edit', target: { kind: selection.kind, id: selection.id } };
    case 'FACE':
      return { type: 'edit', target: { kind: 'FACE', id: selection.faceId ?? selection.id, ownerId: selection.differenceId ?? '' } };
    case 'SEGMENT':
      return { type: 'edit', target: { kind: 'SEGMENT', id: selection.id } };
    case 'LINE':
      return { type: 'edit', target: { kind: 'LINE', id: selection.lineId ?? selection.id, ownerId: selection.differenceId, position: selection.position } };
    default:
      return { type: 'unsupported', reason: 'لا محرر مباشر لهذا النوع؛ استعمل لوحة الخصائص.' };
  }
}

/** هل الأمر ينفّذ فعلًا؟ تُستعمل لعدم عرض زر يوهم المستخدم بأنه يعمل. */
export function commandIsFunctional(plan: SelectionCommandPlan): boolean {
  return plan.type !== 'unsupported' && (plan.type !== 'copy-id' || plan.text.length > 0);
}

/** نسخ نص مع بديل حقيقي حين لا تتوفر Clipboard API (بيئات غير آمنة/قديمة). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // يُجرّب البديل أدناه.
  }
  if (typeof document === 'undefined') return false;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  field.remove();
  return copied;
}

/**
 * ينفّذ الخطة على مخزن المحرر ويعيد رسالة قصيرة تُعرض في الشريط/aria-live.
 * كل تعديل على المستند يمرّ من إجراءات المخزن القائمة (لقطة تراجع واحدة).
 */
export async function executeSelectionCommand(plan: SelectionCommandPlan): Promise<string> {
  const store = useEditorStore.getState();
  switch (plan.type) {
    case 'copy':
      store.copySelection();
      return useEditorStore.getState().clipboardNotice || 'نُسخ العنصر المحدد.';
    case 'cut':
      store.cutSelection();
      return useEditorStore.getState().clipboardNotice || 'جاهز للنقل بعد تأكيد اللصق.';
    case 'paste':
      await store.requestPasteSelection();
      return useEditorStore.getState().clipboardNotice || 'تم اللصق.';
    case 'copy-id': {
      const copied = await copyText(plan.text);
      const message = copied ? `نُسخ المعرّف: ${plan.text}` : `تعذّر نسخ المعرّف؛ انسخه يدويًا: ${plan.text}`;
      useEditorStore.setState({ clipboardNotice: message });
      return message;
    }
    case 'delete':
      return executeDelete(plan.target);
    case 'edit': {
      const live = useEditorStore.getState();
      switch (plan.target.kind) {
        case 'DIFFERENCE':
          live.selectVariant(plan.target.id);
          return 'فُتح الاختلاف في لوحة الاختلافات.';
        case 'FACE':
          live.selectAlternative(plan.target.ownerId, plan.target.id);
          return 'فُتح الوجه في محرر الأوجه.';
        case 'SEGMENT':
          live.selectSegment(plan.target.id);
          return 'حُدد الجزء في لوحة العلاقات.';
        case 'LINE':
          live.selectLine(plan.target.id, plan.target.ownerId, plan.target.position);
          live.requestLink({ kind: 'LINE', id: plan.target.id });
          return 'فُتح ترتيب الأسطر وانتقل التحديد الموحّد إلى السطر.';
        case 'RULE':
          if (typeof window !== 'undefined') window.location.assign(`/studio?rule=${encodeURIComponent(plan.target.id)}`);
          return 'فُتحت القاعدة في استوديو المحرك.';
      }
      return '';
    }
    case 'link':
      store.requestLink({ kind: plan.kind, id: plan.id });
      return plan.kind === 'FACE' ? 'فُتح تبويب «وجه ↔ وجه» والوجه المحدد طرف أول.' : 'فُتح تبويب «سطر ↔ سطر» والسطر المحدد طرف أول.';
    case 'unlink': {
      const document = store.document;
      const link = document?.links?.find((item) => item.id === plan.linkId);
      if (!link) return 'العلاقة غير موجودة؛ لم يتغير شيء.';
      const accepted = await confirmAction({
        title: 'فك هذا الوجه المركب؟',
        message: 'يُحذف الرابط ويعود كل وجه إلى سطره، ويمكن التراجع بخطوة واحدة.',
        impacts: [{ label: 'علاقات', count: 1 }], undoable: true, tone: 'default',
      });
      if (!accepted) return 'أُلغي الفك؛ لم تتغير البيانات.';
      if (useEditorStore.getState().document !== document) return 'تغيّر المستند أثناء التأكيد؛ أعد الطلب.';
      useEditorStore.getState().deleteLink(plan.linkId);
      return 'فُكّ الرابط؛ يمكن التراجع بخطوة واحدة.';
    }
    case 'move-line':
      return store.requestMoveSelectedLine(plan.delta);
    case 'why': {
      if (plan.differenceId) store.selectVariant(plan.differenceId);
      store.requestWhy({ ruleId: plan.ruleId });
      return 'فُتح أثر قرار المحرك (لماذا؟) للعنصر المحدد.';
    }
    case 'unsupported':
      return plan.reason;
  }
}

async function executeDelete(target: DeleteTarget): Promise<string> {
  const store = useEditorStore.getState();
  switch (target.kind) {
    case 'DIFFERENCE':
      store.deleteVariant(target.id);
      return 'حُذف الاختلاف؛ يمكن التراجع.';
    case 'FACE':
      if (!target.ownerId) return 'لا يعرف الاختلاف الحاضن لهذا الوجه.';
      store.deleteAlternative(target.ownerId, target.id);
      return 'حُذف الوجه؛ يمكن التراجع.';
    case 'SEGMENT':
      store.deleteSegment(target.id);
      return 'حُذف الجزء؛ يمكن التراجع.';
    case 'WAQF_MARK':
      store.deleteBoundary(target.id);
      return 'حُذفت علامة الوقف؛ يمكن التراجع.';
    case 'COMPOSITE_FACE': {
      const document = store.document;
      const link = document?.links?.find((item) => item.id === target.id);
      if (!link) return 'العلاقة غير موجودة؛ لم يتغير شيء.';
      const accepted = await confirmAction({
        title: 'حذف هذا الوجه المركب؟', impacts: [{ label: 'علاقات', count: 1 }], undoable: true, tone: 'danger',
      });
      if (!accepted) return 'أُلغي الحذف؛ لم تتغير البيانات.';
      if (useEditorStore.getState().document !== document) return 'تغيّر المستند؛ أعد الطلب.';
      useEditorStore.getState().deleteLink(target.id);
      return 'حُذف الوجه المركب؛ يمكن التراجع.';
    }
  }
}

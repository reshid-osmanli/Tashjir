# سجل تقدم حزم العمل — Work Packages Progress

> هذا الملف أُنشئ في فرع `arena/01a09b2a-tashjir` (الحزمة 10) لأنه لم يكن موجودًا في
> المستودع، وكانت حالة التنفيذ موثقة في `docs/SRS_STATUS.md`. الصفوف 01–09 أدناه
> مُلخَّصة من ذلك الملف ومن فحص الكود والاختبارات، وصف الحزمة 10 يُحدَّث هنا مباشرة.
>
> **حالة الأساس قبل الحزمة 10:** 504 اختبارًا ناجحًا | 2 متخطى | 46 ملف اختبار،
> `tsc --noEmit` نظيف، `next build` ناجح.

| # | الحزمة | المرحلة | المتطلبات | الحالة | الدليل |
|---|---|---|---|---|---|
| 01 | نموذج البيانات v8 والترتيب الصريح في النموذج | PH0 | DM-01..18، FR-EN-01..04 | ✅ منجزة | `src/lib/tashjeer/model/v8.ts` + `tests/model-v8.test.ts` |
| 02 | كتالوج القراء/الرواة/الطرق والرموز في `/admin` | PH0/PH1 | FR-ED-14 (جزئي) | ✅ منجزة | `src/lib/transmissions/catalog.ts`، `src/app/(dashboard)/admin/page.tsx` + `tests/reader-symbols.test.ts`، `tests/catalog-order.test.ts` |
| 03 | قوائم قابلة للتمرير وسياق تحديد موحّد | PH2 | FR-ED-01، FR-ED-02 | ✅ منجزة | `selection-context.ts`، `hooks/useWindowedList.ts` + `tests/selection-context.test.ts` |
| 04 | السحب والدمج والحافظة والحذف الجماعي | PH3 | FR-ED-04..07 | ✅ منجزة | `RelationsPanel.tsx`، `manual-links.ts` + `tests/manual-links.test.ts`، `tests/editor-manual-actions.test.ts` |
| 05 | تعدد الاختلافات في الموضع الواحد | PH4 | FR-ED-03، DM-09 | ✅ منجزة | `editor-store.ts` + `tests/editor-multi-difference.test.ts` |
| 06 | الإنشاء الذكي الموحّد | PH5 | FR-ED-08، FR-ED-09 | ✅ منجزة | `smart-create.ts`، `SmartCreateWizard.tsx` + `tests/smart-create*.test.ts` |
| 07 | التعميم والاستقلال المحلي (قواعد عامة) | PH6 | FR-ED-10، DM-08 | ✅ منجزة | `global-rule-engine.ts`، `rule-occurrences-store.ts` + `tests/global-rule-*.test.ts` |
| 08 | الوقف/الوصل/الابتداء وممنوع الوصل | PH7 | FR-ED-11، DM-06/07/11 | ✅ منجزة (جزئي بالواجهة) | `reading-window.ts` + `tests/reading-window.test.ts`، `tests/editor-forbidden-wasl.test.ts` |
| 09 | التتبع وحلقة التعلّم | PH8 | FR-ED-15/16، FR-ES-12/15 | ✅ منجزة | `/tracking`، `tracking-store.ts`، `candidate-rule.ts` + `tests/candidate-rule.test.ts` |
| **10** | **الترتيب الصريح للقراء/الرواة/الطرق + وضع إخفاء اللوحات** | **PH9** | **FR-ED-12، FR-ED-14 (+ DM-04، DM-17، NFR-03)** | **🔄 قيد التنفيذ** | — |

---

## الحزمة 10 — سجل التنفيذ

### البدء

- **تاريخ البدء:** 2026-09-13.
- **فرع العمل:** `arena/01a09b2a-tashjir` (من `fbdf94b` من `main`).
- **التحقق من افتراضات البدء (§5):**
  1. ✅ الحزمة 01 منجزة: `DisplayOrderEntry { id, kind, displayOrder }` موجود في
     `model/v8.ts`، ويُصدَّر في `ExportBundle.displayOrder` ويُطبَّق عند الاستيراد
     (`document-store.ts: displayOrderOfCatalog/applyDisplayOrder`).
  2. ✅ الكتالوج القائم في `/admin` يعمل: إضافة/تعديل/حذف القراء والرواة والطرق
     والرموز، مع سحب وإعادة ترقيم (`catalog.ts: insertWithShift/movePeer/renumberByPosition`).
  3. ✅ قاعدة الاختصار قائمة ومختبرة (`reader-symbols.ts` + `tests/reader-symbols.test.ts`).
  4. ⚠️ **الفجوة المكتشفة:** الرقم الذي يحكم الظهور فعليًا في المحرك كان
     `Narrator.legacyOrderInTayyibah` (ترتيب الطيبة التاريخي) لا رقمًا صريحًا واحدًا،
     وكان `Narrator.order` يعني «ترتيبه داخل إمامه» (١ أو ٢). أي أن للراوي رقمين
     متنافسين، وأن كسر التعادل في الفرز كان `name.localeCompare(...)` — أي أن **تغيير
     الاسم كان يغيّر الترتيب** عند التساوي، وهو ما تنفيه FR-ED-14 صراحة.
     وإخفاء اللوحات كان حالة محلية غير محفوظة في صفحة المحرر (`focusMode/revealedEdge`)
     بلا تثبيت لكل لوحة وبلا إعداد في `/settings`.
- **القرار المعتمد (الأكثر أمانًا، يوثَّق هنا وفق §2.6):** توحيد الرقم الصريح في حقل
  `order` نفسه لكل كيان (بمعنى `displayOrder`)، مع رفع إصدار الكتالوج إلى 2 وترحيل لطيف
  يعبّئ رقم الراوي من ترتيب الطيبة القائم، وجعل كسر التعادل بالمعرّف لا بالاسم.
  التفصيل في `docs/TRANSMISSIONS.md`.

### الانتهاء

- **تاريخ الانتهاء:** —
- **النتيجة:** —

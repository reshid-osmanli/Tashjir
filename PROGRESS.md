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
| **10** | **الترتيب الصريح للقراء/الرواة/الطرق + وضع إخفاء اللوحات** | **PH9** | **FR-ED-14، FR-ED-12 (+ DM-04، DM-17، NFR-03)** | **✅ منجزة** | `tashjeer/display-order.ts` + تبويب «ترتيب الظهور» في `/admin`؛ `lib/ui/panel-layout.ts` + `stores/panel-store.ts` + `hooks/usePanelAutoHide.ts` + `editor/PanelFrame.tsx` — `tests/display-order.test.ts` (٢٥) و`tests/panel-layout.test.ts` (٤٢)

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

- **تاريخ الانتهاء:** 2026-09-13.
- **النتيجة:** المهمتان منجزتان. `FR-ED-14: explicit display order` ✅ و`FR-ED-12: panel auto-hide` ✅.
- **بوابات التحقق النهائية:**
  - `npm test` → **571 ناجحًا | 2 متخطّى** في 49 ملفًّا: 48 ناجحًا وملف متخطّى
    (كانت الأساس 504 | 2 في 46 ملفًّا).
  - `npm run typecheck` (`tsc --noEmit`) → نظيف.
  - `npx eslint "src/**/*.{ts,tsx}"` → 0 مشكلة و0 تحذير.
  - `npm run build` → ناجح (17 مسارًا)، وحجم `/editor` 51.7 kB.
  - فحص يدوي بالواجهة: `/`، `/editor`، `/admin`، `/settings` تُرسم بلا خطأ وقت
    التشغيل (خادم التطوير)، وتبويب «ترتيب الظهور» وبطاقة «اللوحات ووضع
    الإخفاء» ظاهران في الناتج المولَّد.
- **لا اختبارات قُطعت:** كل اختبارات الأساس بقيت خضراء، ومنها
  `tests/reader-symbols.test.ts` (خط أحمر صريح) — قاعدته لم تتغير، بل صارت
  تقرأ الرقم الصريح من المصدر الموحّد.

### المهمة ١ — الترتيب الصريح للظهور (FR-ED-14، DM-04، DM-17)

- **الالتزام:** `FR-ED-14: explicit display order` — رقم صريح واحد لكل
  إمام/راوٍ/طريق من كتالوج `/admin` يحكم الظهور في **كل** الواجهات.
- **الملفات:** `src/lib/tashjeer/display-order.ts` (جديد، ٣٦٧ سطرًا)،
  `src/lib/transmissions/catalog.ts` (الإصدار ٢ + الترحيل + التدقيق)،
  `src/app/(dashboard)/admin/page.tsx` (تبويب «ترتيب الظهور» +
  `DisplayOrderManager`)، `src/types/index.ts`، وخمس واجهات قراءة
  (`reader-symbols.ts`، `scope.ts`، `symbols.ts`، `combination-engine.ts`،
  `classic-tashjeer.ts`، `manual-links.ts`، `ordering.ts`، `document-store.ts`،
  `qiraat.ts`، وصفحات `/variants` و`PropertiesPanel` و`RecitationControls`
  و`RulesIndexDialog` و`VariantEditor`).
- **ما تحقق من معايير القبول:**
  1. تغيير الاسم أو الرمز أو النص **لا يغيّر الترتيب** — كسر التعادل صار
     بالمعرّف الأبجدي الثابت (`compareExplicitOrder`) بدل
     `name.localeCompare(...)` الذي كان يحسم عند التساوي.
  2. حقل رقمي صريح قابل للتحرير لكل كيان في `/admin`، بأرقام عربية-هندية في
     العرض.
  3. الرقم المشغول → **حوار تأكيد كمي** يصف الأثر («إدراج مع إزاحة»: من رقمه
     ≥ الهدف يزاد واحدًا) ولا يقع التغيير إلا بعد الموافقة؛ لا يتساوى رقمان
     أبدًا (`findOrderConflict` + `insertWithShift`).
  4. السحب **يكتب أرقامًا صريحة** (١..ن عبر `movePeer` + `renumberByPosition`)
     فلا ترتيب ضمني في مصفوفة.
  5. البيانات القديمة: `migrateLegacyDisplayOrders` تعبّئ الرقم من ترتيب الطيبة
     القائم عند أول قراءة، و`auditStoredCatalog` يعرض للمشرف ما صُحّح
     (التعارضات + الترحيل + الإصدار) في شريط تحذير؛ الأرقام تُثبَّت عند أول
     حفظ. مفتاح التخزين `tashjeer:transmissions:v1` **لم يتغير** برفع الإصدار.
  6. الحتمية: `tests/display-order.test.ts` (٢٥) يثبت أن نفس الكتالوج يعطي نفس
     الترتيب في بطاقات الرموز والنطاقات والتصفية وترتيب الأمة والتصدير، وبعد
     إعادة التحميل وبعد دورة تصدير/استيراد.
- **قرار موثَّق (§2.6):** أرقام مكررة في ملف قديم مستورد → **الأصغر معرّفًا
  (أبجديًا) أولًا** + تحذير بما وقع (`resolveDisplayOrderConflicts` +
  `describeDisplayOrderConflicts`)، وهو الخيار الأكثر أمانًا لأنه حتمي ولا
  يفقد بيانات.
- **قرار موثَّق (§2.6):** ترتيب الظهور ≠ ترتيب الأسطر؛ `Line.order`/`orderRank`
  مستقلان تمامًا ولم يُمسّا.
- **التوثيق:** `docs/TRANSMISSIONS.md` (قسم «ترتيب الظهور الصريح»)،
  `docs/SRS_STATUS.md` (PH9 + صف التتبع)، `README.md`.
- **الإيداع:** `4e55233`.

### المهمة ٢ — وضع إخفاء اللوحات (FR-ED-12، NFR-03)

- **الالتزام:** `FR-ED-12: panel auto-hide` — وضع مهني للشاشات الصغيرة.
- **الملفات الجديدة:** `src/lib/ui/panel-layout.ts` (قواعد اللوحات + آلة الكشف
  `EdgeRevealController` حتمية بمُجدول قابل للحقن)، `src/stores/panel-store.ts`
  (zustand + حفظ `tashjeer:panels:v1` + ترحيل لطيف من
  `tashjeer:editor-workspace:v1`)، `src/hooks/usePanelAutoHide.ts`،
  `src/components/editor/PanelFrame.tsx`،
  `src/components/editor/PanelLayoutControls.tsx`،
  `src/components/layout/AppShell.tsx`، و`tests/panel-layout.test.ts` (٤٢).
- **الملفات المعدّلة:** `src/app/(dashboard)/editor/page.tsx` (أُعيد بناؤه على
  الأغلفة؛ حُذف `focusMode`/`revealedEdge` القديم ومنطقتا الـ٢px)،
  `src/stores/editor-store.ts` (حُذف `showPropertiesPanel`/`showVariantsPanel`
  فصار مصدر الإظهار واحدًا، والحقول القديمة بقيت اختيارية مهملة للترحيل)،
  `EditorToolbar.tsx` (قائمة «اللوحات»)، `useKeyboardShortcuts.ts` (`H`)،
  `PropertiesPanel.tsx` (لوحة العلاقات)، `settings/page.tsx` (بطاقة الضبط)،
  `app/(dashboard)/layout.tsx` (يفوّض إلى `AppShell`).
- **ما تحقق من معايير القبول:**
  1. ثماني لوحات مشمولة: شريط الأدوات، مستعرض الآيات، الخصائص، العلاقات،
     الاختلافات، شريط المسار، شريط الحالة، قائمة التطبيق الجانبية — ولكل
     واحدة حالة من ثلاث (`hidden`/`flow`/`overlay`) محسوبة في
     `panelPlacement`.
  2. الكشف **طبقة فوقية** `absolute` بـ`transform`: لا إزاحة للتخطيط ولا قفز؛
     وفي التدفق الغلاف `display: contents` فلا يضيف صندوقًا ولا يكسر flex.
  3. الإخفاء التلقائي عند الابتعاد (٤٢٠ms) إلا **المثبّتة**؛ وتثبيت لكل لوحة
     📌 محفوظ يُستعاد في الجلسة التالية.
  4. منطقة الحافة **١٤px** (تُضبط ٤–٤٨)، وتأخير ظهور ٩٠ms؛ والدخول المتكرر
     للحافة نفسها لا يعيد المؤقت، وعند الزوايا تُحسم الحافة للجانبين أولًا
     لأنهما الأكثر استعمالًا (اختبارات بمُجدول وهمي تحرس «لا وميض ولا فتح
     عرضي»).
  5. **لا مناطق شفافة فوق المحتوى** — الكشف يُحسب من الإحداثيات ومقاس منطقة
     المحرر، فلا عنصر يسرق نقرات اللوحة أو تحديد النص عند الحواف.
  6. اللمس: نقرة/سحب على الحافة يكشف فورًا، ولمس خارج اللوحة يغلقها، ولكل
     حافة **مقبض عائم** صغير يظهر وهي مغلقة (القرار المحسوم: «زر عائم صغير
     كبديل دائم»).
  7. الاختصار العام `H` + `Esc` لإغلاق المكشوف، وكلاهما في
     `SHORTCUT_HINTS` فتعرضه نافذة الاختصارات نفسها.
  8. الضبط في `/settings` (بطاقة «اللوحات ووضع الإخفاء»: تشغيل، منزلقات
     الحساسية، جدول اللوحات، استعادة الافتراضي) وفي `/editor` (زر عائم + قائمة
     «اللوحات» في الشريط + المقابض).
  9. يعمل على 1366×768 و1024×625: الحواف تُقاس من منطقة المحرر لا النافذة،
     ومنطق الزوايا واحد على كل المقاسات (واختبار على 1024×625 في
     `tests/panel-layout.test.ts`).
- **قرار موثَّق (§2.6):** التفضيل **عام واحد** (وضع الإخفاء + الحساسية) مع
  **تثبيت لكل لوحة**، كما حُسم سلفًا.
- **قرار موثَّق (§2.6):** قائمة الاختصارات وشريط الحالة قابلان للإخفاء كغيرهما
  من اللوحات (كانا في نص القرار).
- **قرار موثَّق (§2.6):** المقبض العائم يظهر والحافة **مغلقة** فقط؛ فإذا كُشفت
  اختفى حتى لا يغطي من اللوحة شيئًا، والإغلاق يعود إلى الابتعاد/`Esc`/اللمس
  خارجها/زر الوضع.
- **قرار موثَّق (§2.6):** حقلا `showPropertiesPanel`/`showVariantsPanel` في
  `tashjeer:editor-workspace:v1` لم يُحذفا من التخزين بل أُهملا (`@deprecated`)
  وتُقرأ قيمتهما مرة واحدة لترحيل لطيف، فلا يفقد مستخدم قديم إخفاءً ضبطه.
- **التوثيق:** `docs/EDITOR.md` §7.6 + جدول الاختصارات + §7.5 (نقل المفتاح) +
  جدول الاختبارات، `docs/COMPONENTS.md` §1.8/§1.9/§2.3، `docs/SRS_STATUS.md`،
  `README.md`.

### ما تبقى (بأولوياته)

| # | البند | الأولوية | السبب |
|---|-------|----------|-------|
| 1 | مراجعة قبول **يدوية** على شاشة 1024×625 فعلية (لمس + فأرة) لوضع اللوحات | P1 | معايير القبول البصرية/اللمسية لا يثبتها اختبار وحدة، وبيئة التطوير هنا بلا متصفح (E2E متعذّرة كما هو مسجل في `docs/EDITOR.md` §9). المنطق نفسه مغطى بـ٤٢ اختبارًا. |
| 2 | اختبارات E2E (Playwright) لوضع اللوحات ولتبويب ترتيب الظهور | P2 | تتوقف على توفر تنزيل المتصفح في بيئة CI. |
| 3 | تنظيف الحقول المهملة `showPropertiesPanel`/`showVariantsPanel` من نوع `WorkspacePrefs` بعد دورة إصدار كاملة | P3 | إزالتها الآن تكسر الترحيل اللطيف لبيانات المستخدمين القدماء. |

**خارج النطاق (كما حُدد سلفًا ولم يُعمل):** منطق اختصار البطاقات، أشرطة التمرير
الداخلية للوحات، إضافة/حذف كيانات الكتالوج (موجودة أصلًا ولم تُمسّ).
